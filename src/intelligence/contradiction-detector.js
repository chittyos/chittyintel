/**
 * Contradiction Detector - Identifies conflicting facts
 * Uses semantic analysis to find contradictions
 */

export class ContradictionDetector {
  constructor(env) {
    this.env = env;
  }

  async detect(facts, caseId, db) {
    if (facts.length < 2) {
      return [];
    }

    const contradictions = [];

    // Group facts by type for comparison
    const factsByType = this.groupFactsByType(facts);

    // Compare facts within same types
    for (const [factType, typeFacts] of Object.entries(factsByType)) {
      const typeContradictions = await this.detectWithinType(typeFacts, caseId);
      contradictions.push(...typeContradictions);
    }

    // Use AI for semantic contradiction detection
    const semanticContradictions = await this.aiDetectContradictions(facts, caseId);
    contradictions.push(...semanticContradictions);

    // Store detected contradictions
    for (const contradiction of contradictions) {
      try {
        contradiction.id = crypto.randomUUID();
        contradiction.chitty_id = `did:chitty:pattern:${crypto.randomUUID()}`;
        contradiction.case_id = caseId;
        contradiction.pattern_type = 'CONTRADICTION';

        await db.insertPattern(contradiction);
      } catch (error) {
        console.error('Error storing contradiction:', error);
      }
    }

    return contradictions;
  }

  groupFactsByType(facts) {
    return facts.reduce((acc, fact) => {
      const type = fact.fact_type || 'UNKNOWN';
      if (!acc[type]) acc[type] = [];
      acc[type].push(fact);
      return acc;
    }, {});
  }

  async detectWithinType(facts, caseId) {
    const contradictions = [];

    // Date contradictions
    const dateFacts = facts.filter(f => f.metadata?.date);
    for (let i = 0; i < dateFacts.length; i++) {
      for (let j = i + 1; j < dateFacts.length; j++) {
        const fact1 = dateFacts[i];
        const fact2 = dateFacts[j];

        // Check if facts describe same event with different dates
        if (this.describeSameEvent(fact1, fact2) && fact1.metadata.date !== fact2.metadata.date) {
          contradictions.push({
            involved_facts: [fact1.id, fact2.id],
            confidence_score: 0.85,
            ai_analysis: {
              type: 'DATE_CONTRADICTION',
              description: `Same event has different dates: ${fact1.metadata.date} vs ${fact2.metadata.date}`,
              fact1_text: fact1.fact_text,
              fact2_text: fact2.fact_text
            }
          });
        }
      }
    }

    // Amount contradictions
    const amountFacts = facts.filter(f => f.fact_text.includes('$'));
    for (let i = 0; i < amountFacts.length; i++) {
      for (let j = i + 1; j < amountFacts.length; j++) {
        const fact1 = amountFacts[i];
        const fact2 = amountFacts[j];

        const amount1 = this.extractAmount(fact1.fact_text);
        const amount2 = this.extractAmount(fact2.fact_text);

        if (amount1 && amount2 && this.describeSameItem(fact1, fact2) && amount1 !== amount2) {
          contradictions.push({
            involved_facts: [fact1.id, fact2.id],
            confidence_score: 0.90,
            ai_analysis: {
              type: 'AMOUNT_CONTRADICTION',
              description: `Same item has different amounts: ${amount1} vs ${amount2}`,
              fact1_text: fact1.fact_text,
              fact2_text: fact2.fact_text
            }
          });
        }
      }
    }

    return contradictions;
  }

  async aiDetectContradictions(facts, caseId) {
    if (!this.env.AI || facts.length < 2) {
      return [];
    }

    // Sample facts if too many
    const sampleFacts = facts.length > 50 ? facts.slice(0, 50) : facts;

    const prompt = `Analyze these facts for contradictions. Look for:
1. Direct contradictions (X happened vs X did not happen)
2. Temporal impossibilities (event A before B, but B required for A)
3. Logical inconsistencies
4. Different claims about same event

Facts:
${sampleFacts.map((f, i) => `${i + 1}. [${f.id}] ${f.fact_text}`).join('\n')}

Return JSON array of contradictions:
[{
  "fact_ids": ["id1", "id2"],
  "confidence": 0.0-1.0,
  "type": "DIRECT|TEMPORAL|LOGICAL",
  "description": "Explanation of contradiction"
}]

Only return real contradictions with high confidence.`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-70b-instruct', {
        messages: [{ role: 'user', content: prompt }]
      });

      const parsed = this.parseContradictionsResponse(response.response);

      return parsed.map(c => ({
        involved_facts: c.fact_ids,
        confidence_score: c.confidence,
        ai_analysis: {
          type: c.type,
          description: c.description
        }
      }));
    } catch (error) {
      console.error('AI contradiction detection failed:', error);
      return [];
    }
  }

  parseContradictionsResponse(response) {
    try {
      const match = response.match(/\[[\s\S]*\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  describeSameEvent(fact1, fact2) {
    // Simple similarity check - could be enhanced with embeddings
    const words1 = new Set(fact1.fact_text.toLowerCase().split(/\s+/));
    const words2 = new Set(fact2.fact_text.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    const similarity = intersection.size / union.size;
    return similarity > 0.3;
  }

  describeSameItem(fact1, fact2) {
    return this.describeSameEvent(fact1, fact2);
  }

  extractAmount(text) {
    const match = text.match(/\$[\d,]+(?:\.\d{2})?/);
    return match ? match[0] : null;
  }
}
