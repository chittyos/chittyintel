/**
 * Neon PostgreSQL client for ChittyIntel
 * Connects to ChittyLedger database
 */

export class NeonClient {
  constructor(connectionString) {
    this.connectionString = connectionString;
  }

  async query(sql, params = []) {
    // Use Neon's HTTP API for Cloudflare Workers compatibility
    const response = await fetch(`${this.getBaseUrl()}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({
        query: sql,
        params
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Database query failed: ${error}`);
    }

    return response.json();
  }

  getBaseUrl() {
    // Extract host from connection string
    const match = this.connectionString.match(/@([^/]+)/);
    if (match) {
      return `https://${match[1]}`;
    }
    throw new Error('Invalid connection string');
  }

  getAuthToken() {
    // Extract password from connection string for API auth
    const match = this.connectionString.match(/:([^@]+)@/);
    if (match) {
      return match[1];
    }
    throw new Error('Invalid connection string');
  }

  // Convenience methods

  async getCase(caseId) {
    const result = await this.query('SELECT * FROM cases WHERE id = $1', [caseId]);
    return result.rows[0];
  }

  async getEvidenceForCase(caseId) {
    return this.query(`
      SELECT e.*, t.file_hash, t.metadata, t.content_text
      FROM evidence e
      JOIN things t ON e.thing_id = t.id
      WHERE e.case_id = $1
      ORDER BY e.evidence_number
    `, [caseId]);
  }

  async getFactsForCase(caseId) {
    return this.query(`
      SELECT af.*, e.evidence_number, e.evidence_tier
      FROM atomic_facts af
      LEFT JOIN evidence e ON af.evidence_id = e.id
      WHERE af.case_id = $1
      ORDER BY af.created_at
    `, [caseId]);
  }

  async insertFact(fact) {
    return this.query(`
      INSERT INTO atomic_facts (
        id, chitty_id, evidence_id, case_id, fact_text, fact_type,
        classification_level, weight, metadata, verified, verification_method
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING *
    `, [
      fact.id,
      fact.chitty_id,
      fact.evidence_id,
      fact.case_id,
      fact.fact_text,
      fact.fact_type,
      fact.classification_level,
      fact.weight,
      JSON.stringify(fact.metadata || {}),
      fact.verified || false,
      fact.verification_method || 'AI_EXTRACTION'
    ]);
  }

  async insertPattern(pattern) {
    return this.query(`
      INSERT INTO fact_patterns (
        id, chitty_id, case_id, pattern_type, involved_facts,
        confidence_score, ai_analysis, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING *
    `, [
      pattern.id,
      pattern.chitty_id,
      pattern.case_id,
      pattern.pattern_type,
      pattern.involved_facts,
      pattern.confidence_score,
      JSON.stringify(pattern.ai_analysis || {}),
      JSON.stringify(pattern.metadata || {})
    ]);
  }

  async insertTimelineEvent(event) {
    return this.query(`
      INSERT INTO timeline_events (
        id, chitty_id, case_id, event_date, event_type,
        related_facts, related_evidence, narrative, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING *
    `, [
      event.id,
      event.chitty_id,
      event.case_id,
      event.event_date,
      event.event_type,
      event.related_facts,
      event.related_evidence,
      event.narrative,
      JSON.stringify(event.metadata || {})
    ]);
  }
}
