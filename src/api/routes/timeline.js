/**
 * Timeline routes for ChittyIntel
 * Builds chronological timelines from case facts
 */

import { TimelineBuilder } from '../../intelligence/timeline-builder.js';
import { NeonClient } from '../../lib/neon.js';

export const timelineRoutes = {
  /**
   * Get existing timeline for case
   */
  getTimeline: async (request, env) => {
    const { caseId } = request.params;

    try {
      const db = new NeonClient(env.NEON_DATABASE_URL);

      const result = await db.query(`
        SELECT te.*,
               array_agg(DISTINCT af.fact_text) as fact_texts
        FROM timeline_events te
        LEFT JOIN atomic_facts af ON af.id = ANY(te.related_facts)
        WHERE te.case_id = $1
        GROUP BY te.id
        ORDER BY te.event_date ASC NULLS LAST
      `, [caseId]);

      return new Response(JSON.stringify({
        caseId,
        eventCount: result.rows.length,
        timeline: result.rows
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Get timeline error:', error);
      return new Response(JSON.stringify({
        error: 'Failed to retrieve timeline',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * Build/rebuild timeline from case facts
   */
  buildTimeline: async (request, env) => {
    const { caseId } = request.params;

    try {
      const db = new NeonClient(env.NEON_DATABASE_URL);

      // Get all facts with dates
      const factsResult = await db.query(`
        SELECT af.*, e.evidence_number
        FROM atomic_facts af
        LEFT JOIN evidence e ON af.evidence_id = e.id
        WHERE af.case_id = $1
          AND (af.fact_type = 'WHEN' OR af.metadata->>'date' IS NOT NULL)
        ORDER BY af.metadata->>'date' ASC NULLS LAST
      `, [caseId]);

      const builder = new TimelineBuilder(env);
      const timeline = await builder.build(factsResult.rows, caseId, db);

      return new Response(JSON.stringify({
        success: true,
        caseId,
        eventsCreated: timeline.length,
        timeline
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Build timeline error:', error);
      return new Response(JSON.stringify({
        error: 'Failed to build timeline',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
