/**
 * Pattern Analyzer - Identifies corroborations, gaps, and other patterns
 */

export class PatternAnalyzer {
  constructor(env) {
    this.env = env;
  }

  async analyze(facts, caseId, db) {
    const patterns = [];

    // Find corroborations (facts that support each other)
    const corroborations = await this.findCorroborations(facts, caseId);
    patterns.push(...corroborations);

    // Find timeline gaps
    const gaps = this.findTimelineGaps(facts, caseId);
    patterns.push(...gaps);

    // Find unsupported claims
    const unsupported = this.findUnsupportedClaims(facts, caseId);
    patterns.push(...unsupported);

    // Store patterns
    for (const pattern of patterns) {
      try {
        pattern.id = crypto.randomUUID();
        pattern.chitty_id = `did:chitty:pattern:${crypto.randomUUID()}`;
        pattern.case_id = caseId;

        await db.insertPattern(pattern);
      } catch (error) {
        console.error('Error storing pattern:', error);
      }
    }

    return patterns;
  }

  async findCorroborations(facts, caseId) {
    const corroborations = [];

    // Group facts by similar content
    for (let i = 0; i < facts.length; i++) {
      for (let j = i + 1; j < facts.length; j++) {
        const fact1 = facts[i];
        const fact2 = facts[j];

        // Check if from different sources but say same thing
        if (fact1.evidence_id !== fact2.evidence_id) {
          const similarity = this.calculateSimilarity(fact1.fact_text, fact2.fact_text);

          if (similarity > 0.7) {
            // Combined weight is higher when multiple sources agree
            const combinedWeight = Math.min(1.0, (fact1.weight || 0.5) + (fact2.weight || 0.5) * 0.5);

            corroborations.push({
              pattern_type: 'CORROBORATION',
              involved_facts: [fact1.id, fact2.id],
              confidence_score: similarity,
              ai_analysis: {
                type: 'MULTI_SOURCE_CORROBORATION',
                description: `Two independent sources support same fact`,
                combined_weight: combinedWeight,
                fact1_evidence: fact1.evidence_id,
                fact2_evidence: fact2.evidence_id
              },
              metadata: {
                similarity_score: similarity
              }
            });
          }
        }
      }
    }

    return corroborations;
  }

  findTimelineGaps(facts, caseId) {
    const gaps = [];

    // Get dated facts sorted
    const datedFacts = facts
      .filter(f => f.metadata?.date)
      .map(f => ({
        ...f,
        parsedDate: new Date(f.metadata.date)
      }))
      .filter(f => !isNaN(f.parsedDate.getTime()))
      .sort((a, b) => a.parsedDate - b.parsedDate);

    // Find significant time gaps
    for (let i = 1; i < datedFacts.length; i++) {
      const prev = datedFacts[i - 1];
      const curr = datedFacts[i];

      const daysBetween = (curr.parsedDate - prev.parsedDate) / (1000 * 60 * 60 * 24);

      // Flag gaps longer than 30 days
      if (daysBetween > 30) {
        gaps.push({
          pattern_type: 'TIMELINE_GAP',
          involved_facts: [prev.id, curr.id],
          confidence_score: Math.min(1.0, daysBetween / 365),
          ai_analysis: {
            type: 'TEMPORAL_GAP',
            description: `${Math.round(daysBetween)} day gap between events`,
            gap_start: prev.metadata.date,
            gap_end: curr.metadata.date,
            days: Math.round(daysBetween)
          },
          metadata: {
            gap_days: Math.round(daysBetween)
          }
        });
      }
    }

    return gaps;
  }

  findUnsupportedClaims(facts, caseId) {
    const unsupported = [];

    for (const fact of facts) {
      // Check if fact has low weight and no corroboration
      if (fact.weight && fact.weight < 0.5) {
        const hasCorroboration = facts.some(f =>
          f.id !== fact.id &&
          f.evidence_id !== fact.evidence_id &&
          this.calculateSimilarity(f.fact_text, fact.fact_text) > 0.7
        );

        if (!hasCorroboration) {
          unsupported.push({
            pattern_type: 'UNSUPPORTED_CLAIM',
            involved_facts: [fact.id],
            confidence_score: 1.0 - fact.weight,
            ai_analysis: {
              type: 'LOW_WEIGHT_NO_CORROBORATION',
              description: `Claim with low evidence weight and no supporting facts`,
              fact_weight: fact.weight,
              evidence_tier: fact.evidence_tier
            },
            metadata: {
              original_weight: fact.weight
            }
          });
        }
      }
    }

    return unsupported;
  }

  calculateSimilarity(text1, text2) {
    // Simple Jaccard similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }
}
