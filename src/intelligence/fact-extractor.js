/**
 * Fact Extractor - Extracts atomic facts from evidence
 * Uses AI to identify and classify facts with source verification
 */

export class FactExtractor {
  constructor(env) {
    this.env = env;
  }

  async extractFacts(evidence, caseId, env) {
    const contentText = evidence.content_text || evidence.metadata?.extracted_text || '';

    if (!contentText) {
      return [];
    }

    // Use AI to extract facts
    const extractedFacts = await this.aiExtractFacts(contentText, evidence, caseId);

    // Store facts in database with source verification
    const storedFacts = [];
    for (const fact of extractedFacts) {
      try {
        // Verify source excerpt exists in content
        const sourceVerified = this.verifySource(fact.fact_text, contentText, fact.source_excerpt);

        if (!sourceVerified) {
          console.warn(`Source verification failed for fact: ${fact.fact_text.substring(0, 50)}...`);
          continue;
        }

        // Generate ChittyID for fact
        const chittyId = await this.mintChittyId(fact, env);

        const factRecord = {
          id: crypto.randomUUID(),
          chitty_id: chittyId,
          evidence_id: evidence.id,
          case_id: caseId,
          fact_text: fact.fact_text,
          fact_type: fact.fact_type,
          classification_level: fact.classification_level || 'SUPPORTED_CLAIM',
          weight: this.calculateWeight(evidence, fact),
          metadata: {
            source_excerpt: fact.source_excerpt,
            date: fact.date,
            location: fact.location,
            entities: fact.entities,
            extraction_timestamp: new Date().toISOString()
          },
          verified: true,
          verification_method: 'AI_WITH_SOURCE_VERIFICATION'
        };

        storedFacts.push(factRecord);
      } catch (error) {
        console.error('Error storing fact:', error);
      }
    }

    return storedFacts;
  }

  async aiExtractFacts(text, evidence, caseId) {
    // Use Cloudflare AI or Anthropic for extraction
    const prompt = `Analyze this legal document text and extract all atomic facts.

For each fact, provide:
1. fact_text: The specific factual assertion (clear, concise)
2. fact_type: WHO, WHAT, WHEN, WHERE, WHY, or HOW
3. source_excerpt: Exact text from the document (min 30 chars)
4. classification_level: FACT, SUPPORTED_CLAIM, ALLEGATION, or UNCORROBORATED
5. date: If a date is mentioned (ISO format)
6. location: If a location is mentioned
7. entities: People, organizations, or things mentioned

Return as JSON array. Only include facts that are actually stated in the text.
Be precise - every fact must have source_excerpt that exists in the document.

Document text:
${text.substring(0, 10000)}`;

    try {
      if (this.env.AI) {
        // Use Cloudflare Workers AI
        const response = await this.env.AI.run('@cf/meta/llama-3.1-70b-instruct', {
          messages: [{ role: 'user', content: prompt }]
        });

        return this.parseFactsResponse(response.response);
      } else {
        // Fallback to basic extraction
        return this.basicExtraction(text);
      }
    } catch (error) {
      console.error('AI extraction failed:', error);
      return this.basicExtraction(text);
    }
  }

  parseFactsResponse(response) {
    try {
      // Find JSON array in response
      const match = response.match(/\[[\s\S]*\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
      return [];
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return [];
    }
  }

  basicExtraction(text) {
    // Fallback rule-based extraction
    const facts = [];

    // Extract dates
    const datePattern = /(?:on|dated?|as of)\s+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi;
    let match;
    while ((match = datePattern.exec(text)) !== null) {
      facts.push({
        fact_text: `Event occurred on ${match[1]}`,
        fact_type: 'WHEN',
        source_excerpt: match[0],
        classification_level: 'SUPPORTED_CLAIM'
      });
    }

    // Extract amounts
    const amountPattern = /\$[\d,]+(?:\.\d{2})?/g;
    while ((match = amountPattern.exec(text)) !== null) {
      const context = text.substring(Math.max(0, match.index - 50), match.index + 50);
      facts.push({
        fact_text: `Amount of ${match[0]} mentioned`,
        fact_type: 'WHAT',
        source_excerpt: context,
        classification_level: 'SUPPORTED_CLAIM'
      });
    }

    return facts;
  }

  verifySource(factText, documentText, sourceExcerpt) {
    if (!sourceExcerpt || sourceExcerpt.length < 20) {
      return false;
    }

    // Check if source excerpt exists in document
    const normalizedExcerpt = sourceExcerpt.toLowerCase().trim();
    const normalizedDocument = documentText.toLowerCase();

    return normalizedDocument.includes(normalizedExcerpt.substring(0, 30));
  }

  calculateWeight(evidence, fact) {
    // Calculate weight based on evidence tier and fact classification
    const tierWeights = {
      'SELF_AUTHENTICATING': 1.00,
      'GOVERNMENT': 0.95,
      'FINANCIAL_INSTITUTION': 0.90,
      'INDEPENDENT_THIRD_PARTY': 0.85,
      'BUSINESS_RECORDS': 0.80,
      'FIRST_PARTY_ADVERSE': 0.75,
      'FIRST_PARTY_FRIENDLY': 0.60,
      'UNCORROBORATED_PERSON': 0.40
    };

    const classificationMultipliers = {
      'FACT': 1.0,
      'SUPPORTED_CLAIM': 0.8,
      'ALLEGATION': 0.5,
      'UNCORROBORATED': 0.3
    };

    const tierWeight = tierWeights[evidence.evidence_tier] || 0.5;
    const classMultiplier = classificationMultipliers[fact.classification_level] || 0.5;

    return Math.round(tierWeight * classMultiplier * 100) / 100;
  }

  async mintChittyId(fact, env) {
    // Call ChittyID service to mint unique ID
    try {
      const response = await fetch(`${env.CHITTYID_SERVICE_URL || 'https://id.chitty.cc'}/api/v1/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.CHITTY_ID_TOKEN}`
        },
        body: JSON.stringify({
          type: 'atomic_fact',
          context: {
            fact_type: fact.fact_type,
            case_related: true
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        return result.chitty_id;
      }
    } catch (error) {
      console.error('Failed to mint ChittyID:', error);
    }

    // Fallback to generated ID
    return `did:chitty:fact:${crypto.randomUUID()}`;
  }
}
