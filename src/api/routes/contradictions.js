/**
 * Contradiction detection routes for ChittyIntel
 * Identifies conflicting facts and claims
 */

import { ContradictionDetector } from '../../intelligence/contradiction-detector.js';
import { NeonClient } from '../../lib/neon.js';

export const contradictionsRoutes = {
  /**
   * Get detected contradictions for case
   */
  getContradictions: async (request, env) => {
    const { caseId } = request.params;

    try {
      const db = new NeonClient(env.NEON_DATABASE_URL);

      const result = await db.query(`
        SELECT fp.*,
               (SELECT array_agg(fact_text) FROM atomic_facts WHERE id = ANY(fp.involved_facts)) as fact_texts
        FROM fact_patterns fp
        WHERE fp.case_id = $1
          AND fp.pattern_type = 'CONTRADICTION'
        ORDER BY fp.confidence_score DESC
      `, [caseId]);

      return new Response(JSON.stringify({
        caseId,
        contradictionCount: result.rows.length,
        contradictions: result.rows
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Get contradictions error:', error);
      return new Response(JSON.stringify({
        error: 'Failed to retrieve contradictions',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * Detect contradictions in case facts
   */
  detectContradictions: async (request, env) => {
    const { caseId } = request.params;

    try {
      const db = new NeonClient(env.NEON_DATABASE_URL);

      // Get all facts for case
      const factsResult = await db.query(`
        SELECT af.*, e.evidence_number, e.evidence_tier
        FROM atomic_facts af
        LEFT JOIN evidence e ON af.evidence_id = e.id
        WHERE af.case_id = $1
        ORDER BY af.created_at
      `, [caseId]);

      if (!factsResult.rows.length) {
        return new Response(JSON.stringify({
          caseId,
          contradictionsFound: 0,
          message: 'No facts found for analysis'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const detector = new ContradictionDetector(env);
      const contradictions = await detector.detect(factsResult.rows, caseId, db);

      return new Response(JSON.stringify({
        success: true,
        caseId,
        factsAnalyzed: factsResult.rows.length,
        contradictionsFound: contradictions.length,
        contradictions
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Detect contradictions error:', error);
      return new Response(JSON.stringify({
        error: 'Failed to detect contradictions',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
