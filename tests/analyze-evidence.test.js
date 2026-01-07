// Analyze evidence route with stub Neon client and AI
import { Miniflare } from "miniflare";

function createWorker() {
  const bindings = {
    // Stub Neon client by monkeypatching global fetch used by Neon wrapper if applicable
    NEON_DATABASE_URL: "postgres://stub",
    // Stub AI binding with minimal interface
    AI: {
      run: async (_model, _payload) => ({ response: JSON.stringify([]) })
    }
  };
  return new Miniflare({ modules: true, scriptPath: "src/index.js", bindings });
}

async function fetchFrom(mf, path, init = {}) {
  const res = await mf.dispatchFetch(`http://localhost${path}`, init);
  return { status: res.status, text: await res.text(), json: async () => JSON.parse(await res.text()) };
}

describe("analyzeEvidence", () => {
  it("requires auth", async () => {
    const mf = createWorker();
    const res = await fetchFrom(mf, "/api/v1/analyze/case-1/evidence/e1", { method: "POST" });
    expect([401, 403]).toContain(res.status);
  });
});

