import { test } from "node:test";
import assert from "node:assert/strict";
import {
  monthlyPayment,
  schedule,
  simulate,
  optimize,
  defaultRates,
  annualMilestones,
  type SimulationInput,
} from "../src/lib/mortgage/engine";
import {
  scenarioInputSchema,
  simulationSchema,
} from "../src/lib/mortgage/input";
import { maximumLoan, TRACKS } from "../src/lib/mortgage/tracks";
import { readSnapshot } from "../src/lib/mortgage/snapshot";
const close = (a: number, b: number, tolerance = 1e-7) =>
  assert.ok(
    Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)),
    `${a} != ${b}`,
  );
const base = simulationSchema.parse({
  amount: 1_000_000,
  termMonths: 240,
  cpi: 2.5,
  legs: [{ type: "FIXED_UNLINKED", pct: 100, rate: 5 }],
  constraints: {
    monthlyIncome: 20000,
    monthlyObligations: 2000,
    propertyValue: 2000000,
    ltvBasis: "FIRST_HOME",
    existingHousingPayment: 0,
    existingHousingBalance: 0,
    approvalDate: "2026-09-05",
  },
});
const check = (input: unknown, key: string) =>
  simulate(input).result.checks.find((c) => c.key === key)!;

test("reference annuity, zero interest, very small rate and one-month payoff", () => {
  close(monthlyPayment(100000, 6, 360), 599.5505251527569);
  close(monthlyPayment(120000, 0, 120), 1000);
  close(monthlyPayment(120000, 1e-10, 120), 1000);
  close(monthlyPayment(100000, 12, 1), 101000);
  assert.equal(monthlyPayment(0, 5, 360), 0);
});
test("public payment function rejects invalid numbers and periods", () => {
  for (const amount of [-1, NaN, Infinity])
    assert.throws(() => monthlyPayment(amount, 5, 360));
  for (const rate of [-1, NaN, Infinity, 41])
    assert.throws(() => monthlyPayment(100, rate, 360));
  for (const term of [0, -1, 361, 12.5, Infinity])
    assert.throws(() => monthlyPayment(100, 5, term));
});
test("CPI compounds to the effective annual assumption, including first month", () => {
  const rows = schedule(120000, 0, 120, 12, true);
  close(rows[0].payment, 1000 * 1.12 ** (1 / 12));
  close(rows[11].payment, 1120);
  close(rows[11].balance, 108000 * 1.12);
  assert.ok(rows[0].indexation > 0);
  close(schedule(120000, 0, 120, -2, true)[11].payment, 980);
});
test("unlinked cash flows ignore CPI; fixed rates ignore rate shocks", () => {
  assert.deepEqual(
    schedule(100000, 5, 120, 0, false),
    schedule(100000, 5, 120, 15, false),
  );
  assert.deepEqual(simulate(base).rows, simulate(base).stressRows);
});
test("monthly accounting identities reconcile for 100 varied base and stressed loans", () => {
  let seed = 123456;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let n = 0; n < 100; n++) {
    const amount = 1 + Math.floor(random() * 100_000_000),
      months = 1 + Math.floor(random() * 360),
      rate = random() * 30,
      cpi = -5 + random() * 20;
    const rows = schedule(amount, rate, months, cpi, n % 2 === 0, {
      resetMonths: [1, 12, 60][n % 3],
      stress: {
        afterMonth: Math.floor(random() * 360),
        rateBump: random() * 10,
        cpiBump: random() * 10,
      },
    });
    let balance = amount;
    for (const row of rows) {
      for (const value of Object.values(row)) assert.ok(Number.isFinite(value));
      assert.ok(row.payment >= 0 && row.balance >= 0);
      close(
        balance + row.indexation + row.interest - row.payment,
        row.balance,
        1e-5,
      );
      close(row.principal + row.interest, row.payment);
      balance = row.balance;
    }
    assert.equal(rows.length, months);
    assert.equal(rows.at(-1)!.balance, 0);
    close(
      rows.reduce((s, r) => s + r.payment, 0),
      amount + rows.reduce((s, r) => s + r.interest + r.indexation, 0),
    );
  }
});
test("five-year rate shock re-amortizes only at month 61 and preserves prior cash flows", () => {
  const sim = simulate({
    ...base,
    legs: [{ type: "VARIABLE_UNLINKED", pct: 100, rate: 5 }],
    stress: { afterMonth: 48, rateBump: 2, cpiBump: 0 },
  });
  assert.deepEqual(sim.rows.slice(0, 60), sim.stressRows.slice(0, 60));
  close(
    sim.stressRows[60].payment,
    monthlyPayment(sim.rows[59].balance, 7, 180),
  );
  assert.ok(sim.stressRows[60].payment > sim.rows[60].payment);
});
test("MAKAM waits for annual reset while prime reacts next month", () => {
  for (const [type, firstAffected] of [
    ["MAKAM", 73],
    ["PRIME", 63],
  ] as const) {
    const sim = simulate({
      ...base,
      legs: [{ type, pct: 100, rate: 5 }],
      stress: { afterMonth: 62, rateBump: 2, cpiBump: 0 },
    });
    assert.deepEqual(
      sim.rows.slice(0, firstAffected - 1),
      sim.stressRows.slice(0, firstAffected - 1),
    );
    assert.ok(
      sim.stressRows[firstAffected - 1].payment >
        sim.rows[firstAffected - 1].payment,
    );
  }
});
test("CPI shock starts after boundary even without a rate reset", () => {
  const sim = simulate({
    ...base,
    legs: [{ type: "FIXED_LINKED", pct: 100, rate: 3 }],
    stress: { afterMonth: 24, rateBump: 2, cpiBump: 1.5 },
  });
  assert.deepEqual(sim.rows.slice(0, 24), sim.stressRows.slice(0, 24));
  assert.ok(sim.stressRows[24].payment > sim.rows[24].payment);
});
test("matured tracks stop contributing and observations after payoff are zero", () => {
  const sim = simulate({
    ...base,
    legs: [
      { type: "PRIME", pct: 50, rate: 5, termMonths: 60 },
      { type: "FIXED_UNLINKED", pct: 50, rate: 5, termMonths: 121 },
    ],
  });
  close(sim.result.stressedPayment, monthlyPayment(500000, 5, 121));
  assert.equal(sim.rows.length, 121);
  assert.equal(annualMilestones(sim.rows).at(-1)!.month, 121);
  assert.equal(sim.rows.at(-1)!.balance, 0);
  const short = simulate({ ...base, termMonths: 36 });
  assert.equal(short.result.stressedPayment, 0);
  close(short.result.totalPaid, short.result.stressedTotalPaid);
});
test("fees are counted once and insurance lasts until longest actual term", () => {
  const sim = simulate({
    ...base,
    upfrontCosts: 7000,
    monthlyInsurance: 200,
    legs: [{ ...base.legs[0], termMonths: 121 }],
  });
  close(sim.result.totalOutlay - sim.result.totalPaid, 7000 + 200 * 121);
  close(sim.result.firstOutlay - sim.result.firstPayment, 200);
  close(sim.result.ptiPct!, (100 * sim.result.firstPayment) / 18000);
  close(
    sim.result.totalInterest + sim.result.totalIndexation,
    sim.result.financingCost,
  );
});
test("invalid allocations, rates, months, duplicate and unknown tracks are rejected", () => {
  for (const legs of [
    [],
    [{ ...base.legs[0], pct: 99.6 }],
    [{ ...base.legs[0], pct: 100.1 }],
    [{ ...base.legs[0], pct: 0 }],
    [{ ...base.legs[0], rate: -1 }],
    [{ ...base.legs[0], rate: NaN }],
    [{ ...base.legs[0], termMonths: 361 }],
    [{ ...base.legs[0], termMonths: 5.5 }],
    [
      { ...base.legs[0], pct: 50 },
      { ...base.legs[0], pct: 50 },
    ],
    [{ ...base.legs[0], type: "UNKNOWN" }],
  ])
    assert.throws(() => simulate({ ...base, legs }));
  for (const amount of [0, -1, 1.5, 100000001, Infinity, NaN])
    assert.throws(() => simulate({ ...base, amount }));
  for (const termMonths of [0, 361, 120.5])
    assert.throws(() => simulate({ ...base, termMonths }));
  assert.throws(() =>
    simulate({ ...base, constraints: { approvalDate: "2026-02-30" } }),
  );
  assert.throws(() => simulate({ ...base, stress: { afterMonth: -1 } }));
});
test("66.66% cap covers all variable types, independent of prime share", () => {
  for (const t of TRACKS.filter((t) => t.variable)) {
    assert.equal(
      check(
        {
          ...base,
          legs: [
            { type: t.type, pct: 66.66, rate: 5 },
            { type: "FIXED_UNLINKED", pct: 33.34, rate: 5 },
          ],
        },
        "mix",
      ).status,
      "pass",
    );
    assert.equal(
      check(
        {
          ...base,
          legs: [
            { type: t.type, pct: 66.67, rate: 5 },
            { type: "FIXED_UNLINKED", pct: 33.33, rate: 5 },
          ],
        },
        "mix",
      ).status,
      "fail",
    );
  }
});
test("PTI uses disposable income denominator and distinguishes absent from explicit zero", () => {
  const sim = simulate(base);
  close(sim.result.ptiPct!, (sim.result.firstPayment / 18000) * 100);
  assert.equal(sim.result.assessment, "pass");
  assert.equal(
    check(
      {
        ...base,
        constraints: { ...base.constraints, monthlyObligations: undefined },
      },
      "pti",
    ).status,
    "incomplete",
  );
  assert.equal(
    check(
      { ...base, constraints: { ...base.constraints, monthlyIncome: 2000 } },
      "pti",
    ).status,
    "fail",
  );
  assert.equal(
    simulate({ ...base, constraints: {} }).result.assessment,
    "incomplete",
  );
});
test("PTI 50% boundary and 40% risk warning", () => {
  const payment = simulate(base).result.firstPayment;
  const half = {
    ...base,
    constraints: {
      ...base.constraints,
      monthlyObligations: 0,
      monthlyIncome: payment * 2,
    },
  };
  assert.equal(check(half, "pti").status, "pass");
  assert.ok(simulate(half).result.warnings.some((w) => w.includes("40%")));
  assert.equal(
    check(
      {
        ...half,
        constraints: { ...half.constraints, monthlyIncome: payment * 2 - 1 },
      },
      "pti",
    ).status,
    "fail",
  );
});
test("housing PTI switches precisely on October 1 with no double counting", () => {
  const before = simulate({
    ...base,
    constraints: {
      ...base.constraints,
      existingHousingPayment: 3000,
      approvalDate: "2026-09-30",
    },
  }).result;
  const after = simulate({
    ...base,
    constraints: {
      ...base.constraints,
      existingHousingPayment: 3000,
      approvalDate: "2026-10-01",
    },
  }).result;
  close(before.ptiPct!, (before.firstPayment / 15000) * 100);
  close(after.ptiPct!, ((after.firstPayment + 3000) / 18000) * 100);
});
test("post-October composition uses same-bank balance, requires missing breakdown", () => {
  const constraints = {
    ...base.constraints,
    approvalDate: "2026-10-01",
    existingHousingBalance: 500000,
    sameBankBalance: 500000,
    sameBankVariableBalance: 0,
  };
  const input = {
    ...base,
    constraints,
    legs: [
      { type: "PRIME", pct: 90, rate: 5 },
      { type: "FIXED_UNLINKED", pct: 10, rate: 5 },
    ],
  };
  assert.equal(check(input, "mix").status, "pass"); // 900k / 1.5m = 60%
  assert.equal(
    check(
      { ...input, constraints: { ...constraints, approvalDate: "2026-09-30" } },
      "mix",
    ).status,
    "fail",
  );
  assert.equal(
    check(
      {
        ...input,
        constraints: { ...constraints, sameBankVariableBalance: undefined },
      },
      "mix",
    ).status,
    "incomplete",
  );
  assert.throws(() =>
    simulate({
      ...base,
      constraints: { ...constraints, sameBankVariableBalance: 500001 },
    }),
  );
  assert.throws(() =>
    simulate({
      ...base,
      constraints: { ...constraints, sameBankBalance: 600000 },
    }),
  );
});
test("purchase LTV includes continuing balances, with purpose-specific caps", () => {
  for (const [ltvBasis, cap] of [
    ["FIRST_HOME", 1500000],
    ["UPGRADER", 1400000],
    ["INVESTMENT", 1000000],
  ] as const) {
    assert.equal(maximumLoan(2000000, ltvBasis), cap);
    const input = {
      ...base,
      amount: cap - 100000,
      constraints: {
        ...base.constraints,
        ltvBasis,
        existingHousingBalance: 100000,
      },
    };
    assert.equal(check(input, "ltv").status, "pass");
    assert.equal(
      check({ ...input, amount: input.amount + 1 }, "ltv").status,
      "fail",
    );
  }
});
test("consolidation concession is capped both ways and always needs bank discretion", () => {
  assert.equal(maximumLoan(1000000, "CONSOLIDATION", true), 700000);
  assert.equal(maximumLoan(4000000, "CONSOLIDATION", true), 2200000);
  const input = {
    ...base,
    amount: 700000,
    constraints: {
      ...base.constraints,
      propertyValue: 1000000,
      ltvBasis: "CONSOLIDATION",
      consolidationConcession: true,
    },
  };
  assert.equal(check(input, "ltv").status, "pass");
  assert.equal(check(input, "concession").status, "incomplete");
  assert.equal(check({ ...input, amount: 700001 }, "ltv").status, "fail");
});
test("refinance has no blanket 100% LTV exemption and eligibility needs manual review", () => {
  assert.equal(maximumLoan(1000000, "REFINANCE"), null);
  const input = {
    ...base,
    constraints: {
      ...base.constraints,
      ltvBasis: "REFINANCE",
      refinanceBalance: base.amount,
    },
  };
  assert.equal(check(input, "ltv").status, "incomplete");
  assert.equal(
    check({ ...input, amount: base.amount + 1 }, "ltv").status,
    "incomplete",
  );
  assert.equal(
    check(
      { ...base, legs: [{ type: "ELIGIBILITY", pct: 100, rate: 3 }] },
      "eligibility",
    ).status,
    "incomplete",
  );
});
test("optimizer returns auditable grid results consistent with direct simulation", () => {
  const result = optimize({
    amount: base.amount,
    termMonths: 240,
    cpi: base.cpi,
    rates: defaultRates(),
    constraints: {
      ...base.constraints,
      terms: { PRIME: 60, FIXED_UNLINKED: 121 },
    },
    stepPct: 10,
    tracks: ["PRIME", "FIXED_UNLINKED", "FIXED_LINKED"],
    monthlyInsurance: 100,
    upfrontCosts: 5000,
    stress: { afterMonth: 62, rateBump: 2, cpiBump: 1 },
  });
  assert.equal(result.evaluated, 66);
  assert.ok(result.feasibleCount > 0);
  for (const candidate of [
    result.byCost,
    result.byPayment,
    result.byRisk,
    result.balanced,
  ]) {
    assert.ok(candidate);
    const direct = simulate({
      ...base,
      legs: candidate.legs,
      monthlyInsurance: 100,
      upfrontCosts: 5000,
      stress: { afterMonth: 62, rateBump: 2, cpiBump: 1 },
    }).result;
    for (const key of [
      "firstPayment",
      "totalPaid",
      "totalOutlay",
      "stressedPayment",
      "stressedPeakPayment",
      "termMonths",
    ] as const)
      close(candidate[key], direct[key]);
  }
});
test("optimizer cost and stress objectives match exhaustive two-track search", () => {
  const rates = defaultRates();
  const result = optimize({
    amount: base.amount,
    termMonths: 240,
    cpi: 2.5,
    rates,
    constraints: base.constraints,
    stepPct: 10,
    tracks: ["PRIME", "FIXED_UNLINKED"],
  });
  const feasible = Array.from(
    { length: 11 },
    (_, i) =>
      simulate({
        ...base,
        legs: [
          { type: "PRIME", pct: i * 10, rate: rates.PRIME },
          {
            type: "FIXED_UNLINKED",
            pct: 100 - i * 10,
            rate: rates.FIXED_UNLINKED,
          },
        ].filter((l) => l.pct > 0),
      }).result,
  ).filter((r) => r.feasible);
  close(
    result.byCost!.totalOutlay,
    Math.min(...feasible.map((r) => r.totalOutlay)),
  );
  close(
    result.byRisk!.stressedPeakPayment,
    Math.min(...feasible.map((r) => r.stressedPeakPayment)),
  );
  close(
    result.byPayment!.firstPayment,
    Math.min(...feasible.map((r) => r.firstPayment)),
  );
});
test("optimizer bounds search and returns no candidates when constraints fail", () => {
  const input = {
    amount: base.amount,
    termMonths: 240,
    cpi: 2.5,
    rates: defaultRates(),
    constraints: base.constraints,
  };
  for (const stepPct of [0, 3, -1, NaN, 0.01])
    assert.throws(() => optimize({ ...input, stepPct }));
  assert.throws(() => optimize({ ...input, tracks: [] }));
  assert.throws(() => optimize({ ...input, tracks: ["PRIME", "PRIME"] }));
  const none = optimize({
    ...input,
    constraints: { ...base.constraints, monthlyIncome: 1 },
    tracks: ["PRIME", "FIXED_UNLINKED"],
    stepPct: 10,
  });
  assert.equal(none.feasibleCount, 0);
  assert.equal(none.byCost, null);
});
test("versioned snapshots round-trip all assumptions; legacy/invalid values are rejected", () => {
  const saved: SimulationInput = {
    ...base,
    upfrontCosts: 1234,
    stress: { afterMonth: 36, rateBump: 1, cpiBump: 3 },
  };
  const read = readSnapshot(
    JSON.parse(JSON.stringify({ version: 2, input: saved })),
  );
  assert.deepEqual(read, saved);
  assert.deepEqual(simulate(read).result, simulate(saved).result);
  for (const value of [
    null,
    {},
    { version: 1, input: base },
    { version: 2, input: { ...base, legs: [] } },
  ])
    assert.equal(readSnapshot(value), null);
});
test("save input strips client totals and approval flags before server calculation", () => {
  const parsed = scenarioInputSchema.parse({
    caseId: "owned-case",
    label: "בדיקה",
    simulation: { ...base, totalPaid: 1, feasible: true },
    firstPayment: 0,
    totalPaid: 0,
    feasible: true,
  });
  assert.equal("totalPaid" in parsed, false);
  assert.equal("feasible" in parsed.simulation, false);
  assert.equal(
    scenarioInputSchema.safeParse({ ...parsed, label: " " }).success,
    false,
  );
  assert.ok(simulate(parsed.simulation).result.totalPaid > base.amount);
});

test("constant-payment peak uses the first month, ignoring sub-cent payoff residue", () => {
  assert.equal(simulate(base).result.peakMonth, 1);
});
test("historical or missing approval dates stay explicitly incomplete", () => {
  assert.equal(
    check(
      {
        ...base,
        constraints: { ...base.constraints, approvalDate: "2020-01-01" },
      },
      "historical",
    ).status,
    "incomplete",
  );
  assert.equal(
    check(
      {
        ...base,
        constraints: { ...base.constraints, approvalDate: undefined },
      },
      "date",
    ).status,
    "incomplete",
  );
});
test("schedule validates stress and reset arguments even before the shock", () => {
  assert.throws(() => schedule(100000, 5, 60, 2, true, { resetMonths: 0 }));
  assert.throws(() =>
    schedule(100000, 5, 60, 2, true, {
      stress: { afterMonth: 60, rateBump: NaN, cpiBump: 1 },
    }),
  );
});
