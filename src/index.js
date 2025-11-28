/**
 * ChittyIntel - Case Intelligence Service
 * Fact analysis, contradiction detection, timeline construction
 */

import { Router } from 'itty-router';

// API Routes
import { analyzeRoutes } from './api/routes/analyze.js';
import { timelineRoutes } from './api/routes/timeline.js';
import { contradictionsRoutes } from './api/routes/contradictions.js';
import { patternsRoutes } from './api/routes/patterns.js';
import { healthRoutes } from './api/routes/health.js';

// Middleware
import { authMiddleware } from './middleware/auth.js';
import { corsMiddleware } from './middleware/cors.js';

const router = Router();

// CORS preflight
router.options('*', corsMiddleware);

// Health check (no auth)
router.get('/health', healthRoutes.health);
router.get('/api/v1/status', healthRoutes.status);

// All other routes require auth
router.all('/api/*', authMiddleware);

// Intelligence API routes
router.post('/api/v1/analyze/:caseId', analyzeRoutes.analyzeCase);
router.post('/api/v1/analyze/:caseId/evidence/:evidenceId', analyzeRoutes.analyzeEvidence);

// Timeline routes
router.get('/api/v1/timeline/:caseId', timelineRoutes.getTimeline);
router.post('/api/v1/timeline/:caseId/build', timelineRoutes.buildTimeline);

// Contradiction detection
router.get('/api/v1/contradictions/:caseId', contradictionsRoutes.getContradictions);
router.post('/api/v1/contradictions/:caseId/detect', contradictionsRoutes.detectContradictions);

// Pattern analysis
router.get('/api/v1/patterns/:caseId', patternsRoutes.getPatterns);
router.post('/api/v1/patterns/:caseId/analyze', patternsRoutes.analyzePatterns);

// 404 handler
router.all('*', () => new Response('Not Found', { status: 404 }));

export default {
  async fetch(request, env, ctx) {
    try {
      // Add CORS headers
      const response = await router.handle(request, env, ctx);

      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-ChittyID');

      return new Response(response.body, {
        status: response.status,
        headers
      });
    } catch (error) {
      console.error('ChittyIntel error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
