/**
 * Health check routes for ChittyIntel
 */

export const healthRoutes = {
  health: async (request, env) => {
    return new Response(JSON.stringify({
      status: 'healthy',
      service: 'chittyintel',
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  },

  status: async (request, env) => {
    // Check dependencies
    const checks = {
      kv: false,
      vectorize: false,
      ai: false
    };

    try {
      // Check KV
      if (env.INTEL_CACHE) {
        await env.INTEL_CACHE.get('health-check');
        checks.kv = true;
      }

      // Check Vectorize
      if (env.INTEL_VECTORIZE) {
        checks.vectorize = true;
      }

      // Check AI
      if (env.AI) {
        checks.ai = true;
      }
    } catch (error) {
      console.error('Health check error:', error);
    }

    const allHealthy = Object.values(checks).every(v => v);

    return new Response(JSON.stringify({
      status: allHealthy ? 'healthy' : 'degraded',
      service: 'chittyintel',
      version: '1.0.0',
      checks,
      timestamp: new Date().toISOString()
    }), {
      status: allHealthy ? 200 : 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
