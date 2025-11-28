/**
 * ChittyConnect Integration Client for ChittyIntel
 * Handles all service-to-service communication through ChittyConnect
 */

export class ChittyConnectClient {
  constructor(env) {
    this.env = env;
    this.baseUrl = env.CHITTYCONNECT_URL || 'https://connect.chitty.cc';
    this.serviceToken = env.CHITTYCONNECT_SERVICE_TOKEN;
    this.timeout = 30000; // 30 seconds for analysis operations
  }

  /**
   * Authenticate this service with ChittyConnect
   */
  async authenticate() {
    try {
      const response = await this.makeRequest('/api/v1/services/auth', {
        method: 'POST',
        body: JSON.stringify({
          service: 'chittyintel',
          version: '1.0.0'
        })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        authenticated: true,
        serviceId: data.serviceId,
        chittyId: data.chittyId,
        permissions: data.permissions
      };
    } catch (error) {
      console.error('ChittyConnect authentication error:', error);
      return { authenticated: false, error: error.message };
    }
  }

  /**
   * Get evidence data from ChittyEvidence via ChittyConnect
   */
  async getEvidence(evidenceId) {
    try {
      const response = await this.makeRequest(
        `/api/v1/proxy/chittyevidence/evidence/${evidenceId}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get evidence: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching evidence:', error);
      throw error;
    }
  }

  /**
   * Get case data from ChittyLedger via ChittyConnect
   */
  async getCaseData(caseId) {
    try {
      const response = await this.makeRequest(
        `/api/v1/proxy/chittyledger/cases/${caseId}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get case: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching case:', error);
      throw error;
    }
  }

  /**
   * Get all atomic facts for a case from ChittyLedger
   */
  async getAtomicFacts(caseId) {
    try {
      const response = await this.makeRequest(
        `/api/v1/proxy/chittyledger/cases/${caseId}/facts`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get facts: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching facts:', error);
      throw error;
    }
  }

  /**
   * Store fact pattern in ChittyLedger via ChittyConnect
   */
  async storeFactPattern(pattern) {
    try {
      const response = await this.makeRequest(
        '/api/v1/proxy/chittyledger/fact-patterns',
        {
          method: 'POST',
          body: JSON.stringify(pattern)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to store pattern: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error storing pattern:', error);
      throw error;
    }
  }

  /**
   * Store timeline event in ChittyLedger via ChittyConnect
   */
  async storeTimelineEvent(event) {
    try {
      const response = await this.makeRequest(
        '/api/v1/proxy/chittyledger/timeline-events',
        {
          method: 'POST',
          body: JSON.stringify(event)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to store event: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error storing timeline event:', error);
      throw error;
    }
  }

  /**
   * Request ChittyID minting for new entities
   */
  async mintChittyID(entityType, metadata) {
    try {
      const response = await this.makeRequest(
        '/api/v1/proxy/chittyid/mint',
        {
          method: 'POST',
          body: JSON.stringify({
            entityType,
            metadata,
            source: 'chittyintel'
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to mint ChittyID: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error minting ChittyID:', error);
      throw error;
    }
  }

  /**
   * Store analysis in MemoryCloude via ChittyConnect
   */
  async storeMemory(key, data, metadata = {}) {
    try {
      const response = await this.makeRequest(
        '/api/v1/memory/store',
        {
          method: 'POST',
          body: JSON.stringify({
            key,
            data,
            metadata: {
              ...metadata,
              source: 'chittyintel',
              timestamp: new Date().toISOString()
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to store memory: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error storing memory:', error);
      throw error;
    }
  }

  /**
   * Retrieve analysis from MemoryCloude via ChittyConnect
   */
  async retrieveMemory(key) {
    try {
      const response = await this.makeRequest(
        `/api/v1/memory/retrieve/${encodeURIComponent(key)}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null; // No memory found
        }
        throw new Error(`Failed to retrieve memory: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error retrieving memory:', error);
      throw error;
    }
  }

  /**
   * Notify ChittyConnect of analysis completion
   */
  async notifyAnalysisComplete(caseId, analysisResult) {
    try {
      const response = await this.makeRequest(
        '/api/v1/events/publish',
        {
          method: 'POST',
          body: JSON.stringify({
            eventType: 'intel.analysis.complete',
            source: 'chittyintel',
            data: {
              caseId,
              analysisResult,
              timestamp: new Date().toISOString()
            }
          })
        }
      );

      if (!response.ok) {
        console.warn('Failed to notify analysis completion:', response.statusText);
        // Non-critical, don't throw
      }

      return response.ok;
    } catch (error) {
      console.error('Error notifying analysis completion:', error);
      // Non-critical, don't throw
      return false;
    }
  }

  /**
   * Make HTTP request to ChittyConnect
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'ChittyIntel/1.0',
      'X-ChittyOS-Service': 'chittyintel',
      ...(options.headers || {})
    };

    // Add service authentication
    if (this.serviceToken) {
      headers['Authorization'] = `Bearer ${this.serviceToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Health check for ChittyConnect
   */
  async healthCheck() {
    try {
      const response = await this.makeRequest('/health', {
        method: 'GET'
      });

      return {
        healthy: response.ok,
        status: response.status,
        statusText: response.statusText
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}
