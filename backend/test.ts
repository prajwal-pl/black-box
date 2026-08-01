import { $ } from "bun";

const BASE = "http://localhost:3001";
const TEST_EMAIL = `test_${Date.now()}@blackbox.dev`;
const TEST_PASSWORD = "Test1234!";

let token = "";
let caseId = "";
let evidenceId = "";
let hypothesisId = "";
let contradictionId = "";

type Result = { route: string; status: number; ms: number; ok: boolean; body: unknown };
const results: Result[] = [];

async function req(method: string, path: string, body?: unknown, auth = true): Promise<{ status: number; body: unknown; ms: number }> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth && token) headers["Authorization"] = `Bearer ${token}`;
    const start = Date.now();
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const ms = Date.now() - start;
    const text = await res.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, body: parsed, ms };
}

function log(route: string, r: { status: number; body: unknown; ms: number }, expectStatus: number) {
    const ok = r.status === expectStatus;
    results.push({ route, status: r.status, ms: r.ms, ok, body: r.body });
    const icon = ok ? "✅" : "❌";
    const flag = r.ms > 3000 ? " ⚠️  SLOW" : "";
    console.log(`${icon} [${r.status}] ${route} (${r.ms}ms)${flag}`);
    if (!ok) console.log(`   Expected ${expectStatus}, body:`, JSON.stringify(r.body).slice(0, 200));
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
console.log("\n── AUTH ──");

let r = await req("POST", "/auth/register", { email: TEST_EMAIL, password: TEST_PASSWORD, name: "Test User" }, false);
log("POST /auth/register", r, 201);
token = (r.body as any)?.token ?? "";

r = await req("POST", "/auth/login", { email: TEST_EMAIL, password: TEST_PASSWORD }, false);
log("POST /auth/login", r, 200);
token = (r.body as any)?.token ?? token;

r = await req("POST", "/auth/login", { email: "wrong@x.com", password: "bad" }, false);
log("POST /auth/login (invalid creds)", r, 401);

// ── CASES ─────────────────────────────────────────────────────────────────────
console.log("\n── CASES ──");

r = await req("POST", "/cases", { name: "Test Case Alpha" });
log("POST /cases", r, 201);
caseId = (r.body as any)?.case?.id ?? "";

r = await req("GET", "/cases");
log("GET /cases", r, 200);

r = await req("GET", `/cases/${caseId}`);
log("GET /cases/:id", r, 200);

r = await req("PUT", `/cases/${caseId}`, { severity: "HIGH" });
log("PUT /cases/:id", r, 200);

r = await req("GET", "/cases/nonexistent-id-000");
log("GET /cases/:id (not found)", r, 404);

// ── EVIDENCE ──────────────────────────────────────────────────────────────────
console.log("\n── EVIDENCE ──");

r = await req("GET", `/cases/${caseId}/evidence`);
log("GET /cases/:caseId/evidence", r, 200);

// ── TIMELINE ──────────────────────────────────────────────────────────────────
console.log("\n── TIMELINE ──");

r = await req("GET", `/cases/${caseId}/timeline`);
log("GET /cases/:caseId/timeline", r, 200);

// ── HYPOTHESES ────────────────────────────────────────────────────────────────
console.log("\n── HYPOTHESES ──");

r = await req("GET", `/cases/${caseId}/hypotheses`);
log("GET /cases/:caseId/hypotheses", r, 200);

// Use seeded case hypotheses if this case has none
const seedCaseId = await (async () => {
    const res = await req("GET", "/cases");
    const cases = (res.body as any)?.cases ?? [];
    return cases.find((c: any) => c.name === "Operation Nightfall")?.id ?? caseId;
})();

r = await req("GET", `/cases/${seedCaseId}/hypotheses`);
log("GET /cases/:caseId/hypotheses (seeded)", r, 200);
hypothesisId = ((r.body as any)?.[0])?.id ?? "";

if (hypothesisId) {
    r = await req("PATCH", `/hypotheses/${hypothesisId}`, { status: "CONFIRMED" });
    log("PATCH /hypotheses/:id", r, 200);
}

// ── CONTRADICTIONS ────────────────────────────────────────────────────────────
console.log("\n── CONTRADICTIONS ──");

r = await req("GET", `/cases/${seedCaseId}/contradictions`);
log("GET /cases/:caseId/contradictions", r, 200);
contradictionId = ((r.body as any)?.[0])?.id ?? "";

if (contradictionId) {
    r = await req("PATCH", `/contradictions/${contradictionId}`, { status: "RESOLVED" });
    log("PATCH /contradictions/:id", r, 200);
}

// Trigger contradiction scan (needs evidenceId)
const evidenceList = await req("GET", `/cases/${seedCaseId}/evidence`);
const firstEvidenceId = ((evidenceList.body as any)?.evidence?.[0])?.id;
if (firstEvidenceId) {
    r = await req("POST", `/cases/${seedCaseId}/contradictions/scan`, { evidenceId: firstEvidenceId });
    log("POST /cases/:caseId/contradictions/scan", r, 200);
} else {
    console.log("⚠️  Skipped contradiction scan — no evidence in seeded case");
}

// ── GRAPH ─────────────────────────────────────────────────────────────────────
console.log("\n── GRAPH ──");

r = await req("GET", `/cases/${seedCaseId}/graph`);
log("GET /cases/:caseId/graph", r, 200);
const graphBody = r.body as any;
if (graphBody?.nodes) console.log(`   nodes=${graphBody.nodes.length}, edges=${graphBody.edges.length}`);

// ── AUTH GUARD ────────────────────────────────────────────────────────────────
console.log("\n── AUTH GUARD ──");

r = await req("GET", "/cases", undefined, false);
log("GET /cases (no token)", r, 401);

// ── CLEANUP ───────────────────────────────────────────────────────────────────
console.log("\n── CLEANUP ──");

r = await req("DELETE", `/cases/${caseId}`);
log("DELETE /cases/:id", r, 200);

// ── SUMMARY ───────────────────────────────────────────────────────────────────
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
const slow = results.filter(r => r.ms > 3000);

console.log(`\n${"─".repeat(50)}`);
console.log(`PASSED: ${passed}  FAILED: ${failed}  TOTAL: ${results.length}`);
if (slow.length) {
    console.log(`\n⚠️  SLOW ROUTES (>3s):`);
    slow.forEach(s => console.log(`   ${s.route} — ${s.ms}ms`));
}
if (failed > 0) {
    console.log(`\n❌ FAILED ROUTES:`);
    results.filter(r => !r.ok).forEach(f => console.log(`   [${f.status}] ${f.route}`));
}
