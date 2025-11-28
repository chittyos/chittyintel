/**
 * Pattern analysis routes for ChittyIntel
 * Identifies corroborations, gaps, and other patterns
 */

import { PatternAnalyzer } from '../../intelligence/pattern-analyzer.js';
import { NeonClient } from '../../lib/neon.js';

export const patternsRoutes = {
  /**
   * Get all patterns for case
   */
  getPatterns: async (request, env) => {
    const { caseId } = request.params;
    const url = new URL(request.url);
    const patternType = url.searchParams.get('type'); // CORROBORATION, GAP, etc.

    try {
      const db = new NeonClient(env.NEON_DATABASE_URL);

      let query = `
        SELECT fp.*,
               (SELECT array_agg(fact_text) FROM atomic_facts WHERE id = ANY(fp.involved_facts)) as fact_texts
        FROM fact_patterns fp
        WHERE fp.case_id = $1
      `;
      const params = [caseId];

      if (patternType) {
        query += ` AND fp.pattern_type = $2`;
        params.push(patternType);
      }

      query += ` ORDER BY fp.confidence_score DESC`;

      const result = await db.query(query, params);

      return new Response(JSON.stringify({
        caseId,
        patternCount: result.rows.length,
        patterns: result.rows
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Get patterns error:', error);
      return new Response(JSON.stringify({
        error: 'Failed to retrieve patterns',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * Analyze case for all pattern types
   */
  analyzePatterns: async (request, env) => {
    const { caseId } = request.params;

    try {
      const db = new NeonClient(env.NEON_DATABASE_URL);

      // Get all facts for case
      const factsResult = await db.query(`
        SELECT af.*, e.evidence_number, e.evidence_tier, e.weight
        FROM atomic_facts af
        LEFT JOIN evidence e ON af.evidence_id = e.id
        WHERE af.case_id = $1
        ORDER BY af.created_at
      `, [caseId]);

      const analyzer = new PatternAnalyzer(env);
      const patterns = await analyzer.analyze(factsResult.rows, caseId, db);

      // Group by pattern type
      const grouped = patterns.reduce((acc, p) => {
        if (!acc[p.pattern_type]) acc[p.pattern_type] = [];
        acc[p.pattern_type].push(p);
        return acc;
      }, {});

      return new Response(JSON.stringify({
        success: true,
        caseId,
        factsAnalyzed: factsResult.rows.length,
        patternsFound: patterns.length,
        byType: grouped,
        patterns
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Analyze patterns error:', error);
      return new Response(JSON.stringify({
        error: 'Failed to analyze patterns',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
