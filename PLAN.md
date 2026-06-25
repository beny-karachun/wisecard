# WiseCard — Mortgage-Advisory CRM Platform — Build Plan

> A Hebrew/RTL SaaS for Israeli mortgage advisors: CRM + advanced mortgage
> simulator + AI intake + document handling + dashboards. Modeled on the
> feature set of wisecard.co.il's "Wise" product, built as original work.

---

## 1. Scope

Rebuild the full Wise feature set, grouped by build difficulty:

| Tier | Features |
|------|----------|
| 🟢 Core engineering | CRM (leads/clients/pipeline/tasks), mortgage simulator + mix-optimizer, scenario comparison, PDF reports, document library, e-signatures, client portal, AI questionnaire, dashboards, digital business card |
| 🟡 Heavy but unblocked | Live reference-data feeds (BOI rates, CPI, anchors), integrations (WhatsApp, Gmail, Google Drive/Calendar, Zapier, Make), chatbot |
| 🔴 Blocked on access | Live per-customer bank data (balance statements, tentative approvals), digital mortgage submission to banks |

The 🔴 tier is a **business/licensing problem, not a coding problem** — see §6.

---

## 2. Tech Stack

- **Framework:** Next.js (App Router) + TypeScript — one full-stack codebase, first-class RTL/Hebrew support, server actions for forms.
- **DB:** PostgreSQL + Prisma ORM. Row-level multi-tenancy by `organizationId`.
- **UI:** Tailwind CSS + shadcn/ui, configured `dir="rtl"`, Hebrew font (e.g. Heebo/Assistant).
- **Auth:** Auth.js (NextAuth) or Clerk; email/password + Google OAuth.
- **Background jobs:** a queue (BullMQ/Redis or a hosted equivalent) for data-feed syncs, document parsing, report generation.
- **AI:** Claude API — Haiku 4.5 for high-volume extraction/chat, Sonnet 4.6 for reasoning-heavy tasks (refinance analysis, optimizer narratives).
- **Files:** S3-compatible storage; Google Drive sync as an optional mirror.
- **PDF:** server-side render (React-PDF or Puppeteer) with per-advisor branding.
- **Hosting:** Vercel (app) + managed Postgres (Neon/Supabase/RDS). Prefer **EU/Israel data residency** for PII (see §9).

---

## 3. Data Sources (the open/free reality)

### ✅ Free & open — fully powers the simulator + "financial data center"

| Source | What you get | Access |
|--------|--------------|--------|
| **Bank of Israel "Edge" series DB** (`edge.boi.gov.il`) | BOI interest rate, exchange rates, yields, zero-curve, many time series | **SDMX REST API**, free, public. SDMX-JSON/XML. |
| **BOI average mortgage rates (the עוגנים / anchors)** | Monthly avg lending rates per track (indexed / non-indexed) — the anchors for variable & fixed-in-installments | Published monthly (~mid-month) as **Excel files** on boi.org.il → needs a scheduled scraper/parser |
| **CBS / הלמ"ס API** | **CPI (מדד המחירים לצרכן)** + other price indices | Official public **JSON API**, free. CPI released 15th of month 18:30 |
| **data.gov.il (CKAN API)** | Misc government open datasets | Free CKAN REST API |

These cover **all reference data** the simulator and dashboards need: prime (= BOI rate + 1.5% spread), CPI for linked tracks, anchors for variable tracks, forecasts.

### ❌ NOT free/open — per-customer bank data

- Reading a client's **account balance / mortgage submission** = **Open Banking**, which requires being a **licensed/registered TPP (AISP)** under Bank of Israel / Capital Market Authority regulation, with OAuth2/OIDC consent flows. Banks (e.g. Leumi's FinTeka) expose APIs but gated behind that licensing.
- Commercial **aggregators** (Salt Edge, Finanda) resell access — **paid**, and you still need contracts/licensing.
- **Mortgage submission** to banks isn't covered by Open Banking at all — it stays partnership/advisor-portal based (how the real Wise almost certainly does it).

---

## 4. Architecture

```
Next.js app (App Router)
├─ Marketing site (public, SSG)        ── /
├─ App (authed, multi-tenant)          ── /app/*
│   ├─ CRM            (leads, clients, pipeline, tasks, activity)
│   ├─ Cases         (the central "mortgage file" object)
│   ├─ Simulator     (tracks, mix, amortization, optimizer)
│   ├─ Documents     (library, templates, e-sign, Drive sync)
│   ├─ Dashboards    (business + market/anchor analytics)
│   └─ Settings      (org, users, branding, integrations)
├─ Client Portal     (per-client tokenized links, questionnaire)  ── /portal/*
├─ Chatbot widget    (embeddable, lead capture → CRM)
└─ API routes / server actions

Background workers
├─ ReferenceDataSync   (BOI Edge, CBS CPI, anchor Excel parser — scheduled)
├─ DocumentParser      (OCR + Claude extraction of statements/approvals)
├─ ReportGenerator     (branded PDF)
└─ IntegrationSync     (Google, WhatsApp, Zapier/Make webhooks)

Postgres (Prisma)  +  Redis (queue/cache)  +  Object storage (S3)
```

---

## 5. Data Model (core entities)

```
Organization(id, name, branding, plan)              ── tenant root
User(id, orgId, role[principal|advisor|assistant])

Contact(id, orgId, type[lead|client], name, phone, email, source, stage)
Case(id, orgId, contactId, status, purpose[purchase|refinance|...])   ── central file
  Borrower(id, caseId, income, obligations, employment, ...)          ── household financials
  Property(id, caseId, value, location, type, ltvBasis)

Scenario(id, caseId, label, isChosen)               ── a תמהיל / mix
  Track(id, scenarioId, type, amount, termMonths, nominalRate,
        indexation[none|cpi], resetEveryMonths, anchorRef)
  AmortizationRow(...)  // or computed on demand & cached

Document(id, orgId, caseId, kind, bankTemplateId?, storageKey,
         signatureStatus, parsedData JSONB)
BankSubmission(id, caseId, bankId, status, externalRef)   // stubbed initially
Task(id, orgId, caseId?, dueAt, assigneeId, status)
Activity(id, orgId, caseId?, channel[call|whatsapp|email|note], payload)

// Reference data (from open APIs)
RateSeries(code, source, ...)  RatePoint(seriesId, date, value)
CpiPoint(date, value)
MortgageAnchor(date, track, value)   // BOI monthly anchors
Forecast(date, kind, value)

// Client-facing & AI
QuestionnaireSession(id, caseId?, token, answers JSONB, status)
ChatConversation(id, orgId, transcript JSONB, capturedLeadId?)
```

---

## 6. The interesting domain part — Simulator & Optimizer

**Tracks (מסלולים)** to model: פריים, קבועה לא צמודה (קל״צ), קבועה צמודה, משתנה צמודה/לא צמודה (reset every N yrs off an anchor), מק״מ, זכאות.

**Per-track math:** Spitzer amortization (לוח שפיצר); CPI-linked tracks inflate principal by CPI; prime = BOI rate + 1.5%; variable tracks re-price at reset dates off the anchor + margin.

**Regulatory constraints (Bank of Israel directives) — feed the optimizer:**
- Prime portion ≤ 2/3 of loan; at least 1/3 in a stable track.
- Max LTV: 75% first home / 70% improver / 50% investment.
- Max term 30 yrs; payment-to-income (PTI) ≤ 50% (advise < 40%).

**The "WISE AI" optimizer (the "20,000 combinations"):** not an LLM — a **constrained search**. Discretize the loan allocation across tracks (e.g. 5% steps) × candidate terms, compute each mix's monthly payment / total cost / sensitivity to rate & CPI scenarios (using BOI forecast paths), filter by regulatory + customer constraints, return the **Pareto-optimal** set (cost vs. monthly vs. risk). Runs in well under a second — the "<10s / 20,000 combos" is comfortably achievable.

---

## 7. AI Features (Claude API)

- **AI intake questionnaire:** conversational client portal form → structured borrower/property/goal JSON (Haiku/Sonnet).
- **Document scanning:** balance statements & tentative approvals (PDF/image) → OCR + Claude extraction → structured fields on the Case.
- **Chatbot:** embeddable widget, answers + captures leads into CRM.
- **Refinance evaluation:** given an existing mortgage, compute break-even & savings vs. current-market mixes; narrate the recommendation.
- **Report narrative:** human-readable explanation attached to the PDF.

---

## 8. Phased Roadmap

| Phase | Deliverable | Blocked? |
|-------|-------------|----------|
| **0 — Foundation** | Next.js + Prisma + auth + multi-tenant skeleton, RTL shell, CI | No |
| **1 — CRM MVP** | Contacts, Cases, pipeline, tasks, activity log | No |
| **2 — Simulator** | Tracks, Spitzer engine, scenario comparison, **optimizer**, branded PDF | No |
| **3 — Reference data** | BOI Edge + CBS CPI + anchor sync jobs → financial-data center & dashboards | No |
| **4 — Documents + AI intake** | Library, templates, e-sign, Drive sync, client portal + AI questionnaire, doc parsing | No |
| **5 — Integrations + chatbot** | WhatsApp/Gmail/Calendar/Zapier/Make, chatbot widget | No |
| **6 — Bank submission** | UI + data model built against **mocks**; wire to real banks **only** once licensing/partnership exists | 🔴 Yes |

**MVP = Phases 0–2** (CRM + simulator). That alone is a sellable product.

---

## 9. Cross-cutting concerns

- **RTL/i18n:** Hebrew-first, `dir="rtl"`, locale-aware number/currency/date formatting (₪).
- **Compliance:** This stores sensitive financial PII → **Israeli Privacy Protection Law** (incl. Amendment 13, 2025): consent, encryption at rest/in transit, access controls, breach handling, data-residency preference. Get this right from Phase 0.
- **Multi-tenancy & roles:** principal / advisor / assistant; row-level isolation by org.
- **Security:** per-tenant data isolation tests, audit log on Case/Document access.

---

## 10. Open questions / decisions for you

1. **Bank submission (🔴):** confirm we build Phase 6 against mocks now, and treat real bank access as a later business track (licensing or partnership). Aggregators (Salt Edge/Finanda) are the paid shortcut if/when you want live account data.
2. **Hosting/residency:** is Israeli/EU data residency a hard requirement? (Affects DB host choice.)
3. **Single-tenant or true multi-tenant SaaS** from day one? (I've assumed multi-tenant.)
4. **Marketing site:** rebuild it too, or app-only for now?

---

## Sources (open data)

- Bank of Israel Edge series DB / SDMX API — https://edge.boi.gov.il/
- BOI statistics & API docs — https://www.boi.org.il/en/economic-roles/statistics/
- BOI average mortgage rates (anchors) — https://www.boi.org.il/information/interestrates/mortgage/
- CBS (הלמ״ס) price-index API — https://www.cbs.gov.il/he/Pages/מדדי-מחירים-באמצעות-API.aspx
- data.gov.il CKAN API — https://data.gov.il/api/docs
- BOI Open Banking implementation guidelines — https://www.boi.org.il/en/communication-and-publications/press-releases/the-bank-of-israel-publishes-guidelines-for-the-banks-and-credit-card-companies-for-implementation-of-the-open-banking-standard-in-israel/
- Open Banking Tracker — Israel — https://www.openbankingtracker.com/country/israel
