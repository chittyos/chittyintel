/**
 * Analysis routes for ChittyIntel
 * Analyzes cases and evidence for atomic facts
 */

import { FactExtractor } from '../../intelligence/fact-extractor.js';
import { NeonClient } from '../../lib/neon.js';

export const analyzeRoutes = {
  /**
   * Analyze entire case - extract facts from all evidence
   */
  analyzeCase: async (request, env) => {
    const { caseId } = request.params;

    try {
      const db = new NeonClient(env.NEON_DATABASE_URL);

      // Get all evidence for case from ChittyLedger
      const evidence = await db.query(`
        SELECT e.*, t.file_hash, t.metadata
        FROM evidence e
        JOIN things t ON e.thing_id = t.id
        WHERE e.case_id = $1
        ORDER BY e.created_at
      `, [caseId]);

      if (!evidence.rows.length) {
        return new Response(JSON.stringify({
          error: 'No evidence found',
          caseId
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Extract facts from each piece of evidence
      const extractor = new FactExtractor(env);
      const results = [];

      for (const item of evidence.rows) {
        const facts = await extractor.extractFacts(item, caseId, env);
        results.push({
          evidenceId: item.id,
          factsExtracted: facts.length,
          facts
        });
      }

      // Store patterns and update case analysis timestamp
      await db.query(`
        UPDATE cases
        SET last_analyzed = NOW(),
            metadata = jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{intel_analysis}',
              $2::jsonb
            )
        WHERE id = $1
      `, [caseId, JSON.stringify({
        timestamp: new Date().toISOString(),
        evidenceAnalyzed: evidence.rows.length,
        factsExtracted: results.reduce((sum, r) => sum + r.factsExtracted, 0)
      })]);

      return new Response(JSON.stringify({
        success: true,
        caseId,
        analysis: {
          evidenceCount: evidence.rows.length,
          totalFactsExtracted: results.reduce((sum, r) => sum + r.factsExtracted, 0),
          results
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Case analysis error:', error);
      return new Response(JSON.stringify({
        error: 'Analysis failed',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * Analyze single evidence item
   */
  analyzeEvidence: async (request, env) => {
    const { caseId, evidenceId } = request.params;

    try {
      const db = new NeonClient(env.NEON_DATABASE_URL);

      // Get evidence item
      const result = await db.query(`
        SELECT e.*, t.file_hash, t.metadata, t.content_text
        FROM evidence e
        JOIN things t ON e.thing_id = t.id
        WHERE e.id = $1 AND e.case_id = $2
      `, [evidenceId, caseId]);

      if (!result.rows.length) {
        return new Response(JSON.stringify({
          error: 'Evidence not found',
          evidenceId,
          caseId
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const evidence = result.rows[0];

      // Extract facts
      const extractor = new FactExtractor(env);
      const facts = await extractor.extractFacts(evidence, caseId, env);

      return new Response(JSON.stringify({
        success: true,
        evidenceId,
        caseId,
        analysis: {
          factsExtracted: facts.length,
          facts
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Evidence analysis error:', error);
      return new Response(JSON.stringify({
        error: 'Analysis failed',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
