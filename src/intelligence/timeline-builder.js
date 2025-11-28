/**
 * Timeline Builder - Constructs chronological timelines from facts
 */

export class TimelineBuilder {
  constructor(env) {
    this.env = env;
  }

  async build(facts, caseId, db) {
    if (!facts.length) {
      return [];
    }

    // Extract and normalize dates from facts
    const datedFacts = facts
      .filter(f => f.metadata?.date)
      .map(f => ({
        ...f,
        parsedDate: this.parseDate(f.metadata.date)
      }))
      .filter(f => f.parsedDate)
      .sort((a, b) => a.parsedDate - b.parsedDate);

    // Group facts by date
    const dateGroups = this.groupByDate(datedFacts);

    // Build timeline events
    const events = [];

    for (const [dateStr, groupFacts] of Object.entries(dateGroups)) {
      const event = await this.createTimelineEvent(dateStr, groupFacts, caseId, db);
      if (event) {
        events.push(event);
      }
    }

    // Store events
    for (const event of events) {
      try {
        await db.insertTimelineEvent(event);
      } catch (error) {
        console.error('Error storing timeline event:', error);
      }
    }

    return events;
  }

  parseDate(dateStr) {
    if (!dateStr) return null;

    // Try various date formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try parsing common formats
    const patterns = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/
    ];

    for (const pattern of patterns) {
      const match = dateStr.match(pattern);
      if (match) {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }

    return null;
  }

  groupByDate(facts) {
    return facts.reduce((acc, fact) => {
      const dateKey = fact.parsedDate.toISOString().split('T')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(fact);
      return acc;
    }, {});
  }

  async createTimelineEvent(dateStr, facts, caseId, db) {
    const factIds = facts.map(f => f.id);
    const evidenceIds = [...new Set(facts.map(f => f.evidence_id).filter(Boolean))];

    // Generate narrative from facts
    const narrative = await this.generateNarrative(facts);

    // Determine event type
    const eventType = this.determineEventType(facts);

    return {
      id: crypto.randomUUID(),
      chitty_id: `did:chitty:timeline:${crypto.randomUUID()}`,
      case_id: caseId,
      event_date: new Date(dateStr).toISOString(),
      event_type: eventType,
      related_facts: factIds,
      related_evidence: evidenceIds,
      narrative,
      metadata: {
        fact_count: facts.length,
        generated_at: new Date().toISOString()
      }
    };
  }

  async generateNarrative(facts) {
    if (!this.env.AI) {
      // Simple concatenation
      return facts.map(f => f.fact_text).join(' ');
    }

    try {
      const prompt = `Combine these related facts into a single coherent narrative paragraph.
Keep it factual and concise.

Facts:
${facts.map(f => `- ${f.fact_text}`).join('\n')}

Return only the narrative paragraph.`;

      const response = await this.env.AI.run('@cf/meta/llama-3.1-70b-instruct', {
        messages: [{ role: 'user', content: prompt }]
      });

      return response.response.trim();
    } catch (error) {
      console.error('Narrative generation failed:', error);
      return facts.map(f => f.fact_text).join(' ');
    }
  }

  determineEventType(facts) {
    const factTypes = facts.map(f => f.fact_type);

    // Prioritize certain types
    if (factTypes.includes('WHEN')) return 'DATED_EVENT';
    if (factTypes.includes('WHO')) return 'PARTY_ACTION';
    if (factTypes.includes('WHAT')) return 'OCCURRENCE';
    if (factTypes.includes('WHERE')) return 'LOCATION_EVENT';

    return 'GENERAL';
  }
}
