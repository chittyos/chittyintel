// Minimal Miniflare tests for health and auth middleware
import { Miniflare } from "miniflare";

function createWorker(bindings = {}) {
  return new Miniflare({
    modules: true,
    scriptPath: "src/index.js",
    bindings,
  });
}

async function fetchFrom(mf, path, init = {}) {
  const res = await mf.dispatchFetch(`http://localhost${path}`, init);
  return { status: res.status, text: await res.text(), headers: res.headers };
}

describe("ChittyIntel worker", () => {
  it("/health returns 200", async () => {
    const mf = createWorker();
    const res = await fetchFrom(mf, "/health");
    expect(res.status).toBe(200);
  });

  it("/api routes require auth", async () => {
    const mf = createWorker();
    const res = await fetchFrom(mf, "/api/v1/patterns/abc", { method: "GET" });
    expect([401, 403]).toContain(res.status);
  });
});

