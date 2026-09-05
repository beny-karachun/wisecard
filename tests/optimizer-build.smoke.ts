/** Execute the actual production worker bundle in a worker-like VM.
 * Run after `npm run build`; complements engine tests without requiring a browser.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import {
  defaultRates,
  optimize,
  type OptimizeInput,
} from "../src/lib/mortgage/engine";
async function main() {
  const chunks = readdirSync(".next/static/chunks").filter((f) =>
    f.endsWith(".js"),
  );
  const code = chunks
    .map((f) => readFileSync(`.next/static/chunks/${f}`, "utf8"))
    .find((s) => /e\.b\(t,"static\/chunks\/turbopack-worker-/.test(s));
  assert.ok(code, "Compiled worker bootstrap reference exists");
  const match = code.match(
    /e\.b\(t,"(static\/chunks\/turbopack-worker-[^"]+)",(\[[^\]]+\])/,
  );
  assert.ok(match);
  const paths = JSON.parse(match[2]);
  const origin = "http://localhost:3000";
  let posted:
    | { key: string; result?: ReturnType<typeof optimize>; error?: string }
    | undefined;
  class WorkerGlobalScope {}
  const scope = Object.assign(new WorkerGlobalScope(), {
    WorkerGlobalScope,
    URL,
    console,
    setTimeout,
    clearTimeout,
    location: new URL(
      `${origin}/_next/${match[1]}?params=${encodeURIComponent(JSON.stringify([paths.map((p: string) => `/_next/${p}`)]))}`,
    ),
    postMessage: (data: typeof posted) => {
      posted = data;
    },
    importScripts: (...urls: string[]) => {
      for (const url of urls) {
        const path = new URL(url).pathname;
        assert.ok(path.startsWith("/_next/static/chunks/"));
        runInContext(readFileSync(`.next/${path.slice(7)}`, "utf8"), context, {
          filename: path,
        });
      }
    },
  });
  const context = createContext(scope);
  Object.assign(scope, { self: scope });
  runInContext(
    "WorkerGlobalScope = class { static [Symbol.hasInstance](value) { return value === self; } };",
    context,
  );
  runInContext(readFileSync(`.next/${match[1]}`, "utf8"), context);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const input: OptimizeInput = {
    amount: 1200000,
    termMonths: 360,
    rates: defaultRates(),
    cpi: 2.5,
  };
  const worker = scope as typeof scope & {
    onmessage: (e: { data: { key: string; input: OptimizeInput } }) => void;
  };
  assert.equal(
    typeof worker.onmessage,
    "function",
    "Built worker registers message handler",
  );
  worker.onmessage({ data: { key: "worker-smoke", input } });
  assert.equal(posted?.key, "worker-smoke");
  assert.equal(posted?.error, undefined);
  const expected = optimize(input);
  assert.equal(posted?.result?.evaluated, 10626);
  assert.equal(
    posted?.result?.byCost?.totalOutlay,
    expected.byCost?.totalOutlay,
  );
  worker.onmessage({
    data: { key: "invalid", input: { ...input, tracks: [] } },
  });
  assert.equal(posted?.key, "invalid");
  assert.ok(posted?.error);
  console.log(
    "Production optimizer worker: valid search and invalid-input response passed.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
