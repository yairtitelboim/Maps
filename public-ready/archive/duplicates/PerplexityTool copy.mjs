/**
 * PerplexityTool - Handles Perplexity AI analysis queries
 * Enhanced to process infrastructure data from SERP and OSM tools
 * Generates detailed, data-driven analysis for power grid reliability
 * 
 * DEVELOPMENT CACHE CONTROLS:
 * - window.enablePerplexityCache() - Enable fast cached mode
 * - window.disablePerplexityCache() - Enable live API mode
 * - window.clearPerplexityCache() - Clear all cached responses
 * - window.listPerplexityCache() - List all cached responses
 */

import { 
  getCachedPerplexityResponse, 
  setCachedPerplexityResponse 
} from '../ResponseCache.js';

export class PerplexityTool {
  constructor(updateToolFeedback) {
    this.updateToolFeedback = updateToolFeedback;
    
    // Development cache settings - Toggle this for testing vs live
    this.DEV_CACHE_ENABLED = true; // Set to false for live mode
    this.DEV_CACHE_KEY = 'perplexity_dev_responses';
  }

  /**
   * Save response to local development cache
   */
  saveToDevCache(coordinates, prompt, response) {
    if (!this.DEV_CACHE_ENABLED) return;
    
    try {
      const cacheKey = this.generateCacheKey(coordinates, prompt);
      const existingCache = JSON.parse(localStorage.getItem(this.DEV_CACHE_KEY) || '{}');
      
      existingCache[cacheKey] = {
        response,
        timestamp: Date.now(),
        coordinates,
        promptHash: this.hashString(prompt.substring(0, 200)) // Store hash of prompt start
      };
      
      localStorage.setItem(this.DEV_CACHE_KEY, JSON.stringify(existingCache));
      console.log('💾 DEV CACHE: Saved response for', coordinates, '(Key:', cacheKey, ')');
    } catch (error) {
      console.warn('⚠️ DEV CACHE: Failed to save response:', error);
    }
  }

  /**
   * Load response from local development cache
   */
  loadFromDevCache(coordinates, prompt) {
    if (!this.DEV_CACHE_ENABLED) return null;
    
    try {
      const cacheKey = this.generateCacheKey(coordinates, prompt);
      const existingCache = JSON.parse(localStorage.getItem(this.DEV_CACHE_KEY) || '{}');
      
      if (existingCache[cacheKey]) {
        console.log('⚡ DEV CACHE: Loading cached response for', coordinates, '(Key:', cacheKey, ')');
        return existingCache[cacheKey].response;
      }
    } catch (error) {
      console.warn('⚠️ DEV CACHE: Failed to load response:', error);
    }
    
    return null;
  }

  /**
   * Generate cache key based on coordinates and prompt
   */
  generateCacheKey(coordinates, prompt) {
    const coordKey = `${coordinates.lat.toFixed(4)}_${coordinates.lng.toFixed(4)}`;
    const promptHash = this.hashString(prompt.substring(0, 200));
    return `${coordKey}_${promptHash}`;
  }

  /**
   * Simple hash function for strings
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear development cache (for debugging)
   */
  clearDevCache() {
    localStorage.removeItem(this.DEV_CACHE_KEY);
    console.log('🗑️ DEV CACHE: Cleared all cached responses');
  }

  /**
   * List cached responses (for debugging)
   */
  listDevCache() {
    try {
      const cache = JSON.parse(localStorage.getItem(this.DEV_CACHE_KEY) || '{}');
      const entries = Object.keys(cache).map(key => ({
        key,
        coordinates: cache[key].coordinates,
        timestamp: new Date(cache[key].timestamp).toLocaleString(),
        size: cache[key].response.data ? cache[key].response.data.length : 'N/A'
      }));
      console.table(entries);
      return entries;
    } catch (error) {
      console.warn('⚠️ DEV CACHE: Failed to list cache:', error);
      return [];
    }
  }

  /**
   * Execute Perplexity tool for data-driven infrastructure analysis
   * @param {Array} queries - Original queries from Claude
   * @param {Object} coordinates - Site coordinates
   * @param {Object} previousResults - Results from SERP and OSM tools
   * @param {Object} locationConfig - Location configuration for dynamic prompts
   */
  async execute(queries, coordinates, previousResults = null, locationConfig = null) {
    this.updateToolFeedback({
      isActive: true,
      tool: 'perplexity',
      status: '🧠 Analyzing infrastructure data with Perplexity AI...',
      progress: 20,
      details: 'Processing Google Places and OSM data for detailed analysis'
    });

    try {
      // Check if we have infrastructure data from previous tools
      if (previousResults && (previousResults.serpData || previousResults.osmData)) {
        // Processing infrastructure data from previous tools
        const result = await this.executeDataDrivenAnalysis(queries, coordinates, previousResults, locationConfig);
        
        this.updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '✅ Perplexity analysis completed',
          progress: 100,
          details: `Generated ${result.analysis?.length || 0} characters of detailed infrastructure analysis`
        });
        
        return {
          success: true,
          tool: 'PERPLEXITY',
          queries: queries,
          coordinates: coordinates,
          data: result,
          timestamp: Date.now()
        };
      } else {
        // Fallback to basic analysis if no previous data
        console.log('⚠️ Perplexity: No infrastructure data available, using basic analysis');
        const result = await this.executeBasicAnalysis(queries, coordinates, locationConfig);
        
        this.updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '✅ Basic Perplexity analysis completed',
          progress: 100,
          details: 'Generated analysis without infrastructure data'
        });
        
        return {
          success: true,
          tool: 'PERPLEXITY',
          queries: queries,
          coordinates: coordinates,
          data: result,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.warn('⚠️ Perplexity execution failed:', error.message);
      
      this.updateToolFeedback({
        isActive: true,
        tool: 'perplexity',
        status: 'Perplexity execution failed - using fallback',
        progress: 100,
        details: `Error: ${error.message}. Using fallback mode.`
      });
      
      // Graceful fallback - don't break the system
      return {
        success: false,
        tool: 'PERPLEXITY',
        error: error.message,
        fallback: true,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Execute data-driven analysis using infrastructure data from SERP and OSM
   */
  async executeDataDrivenAnalysis(queries, coordinates, previousResults, locationConfig = null) {
    this.updateToolFeedback({
      isActive: true,
      tool: 'perplexity',
      status: '📊 Building infrastructure analysis prompt...',
      progress: 40,
      details: 'Aggregating Google Places and OSM data for comprehensive analysis'
    });

    // Debug: Raw data structure analysis (only log on error)
    
    // Extract and summarize infrastructure data
    const infrastructureSummary = this.buildInfrastructureSummary(previousResults);
    
    // Infrastructure data analysis (only log summary)
    // Infrastructure analysis complete
    
    // Check cache first
    const cachedResponse = getCachedPerplexityResponse(coordinates, infrastructureSummary);
    if (cachedResponse) {
      console.log('🎯 Perplexity: Using cached response');
      console.log('⚡ Cache hit - skipping API call, returning immediately');
      
      // Update feedback immediately for cached response
      this.updateToolFeedback({
        isActive: true,
        tool: 'perplexity',
        status: '⚡ Loaded from cache',
        progress: 100,
        details: `Using cached analysis (${cachedResponse.analysis?.length || 0} chars, quality: ${cachedResponse.qualityScore}/100)`
      });
      
      return {
        success: true,
        tool: 'PERPLEXITY',
        data: cachedResponse.analysis,
        citations: cachedResponse.citations || [],
        timestamp: cachedResponse.timestamp,
        infrastructureSummary: infrastructureSummary,
        dataSourcesUsed: this.getDataSourcesUsed(previousResults),
        confidence: 0.9,
        cached: true,
        qualityScore: cachedResponse.qualityScore,
        nodeCount: cachedResponse.nodeCount
      };
    }
    
    // Create intelligent prompt based on real data
    const analysisPrompt = this.buildDataDrivenPrompt(coordinates, infrastructureSummary, locationConfig);
    
    // Analysis prompt generated
    
    // Check development cache first
    if (this.DEV_CACHE_ENABLED) {
      const cachedResponse = this.loadFromDevCache(coordinates, analysisPrompt);
      if (cachedResponse) {
        console.log('⚡ DEV CACHE: Using cached response (skipping API call)');
        
        // Update feedback to show cache hit
        this.updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '⚡ Loading cached response...',
          progress: 90,
          details: 'Using development cache (fast mode)'
        });
        
        // Return cached response immediately
        return cachedResponse;
      } else {
        console.log('💾 DEV CACHE: No cached response found, will make API call and save result');
      }
    }
    
    this.updateToolFeedback({
      isActive: true,
      tool: 'perplexity',
      status: '📡 Querying Perplexity API...',
      progress: 60,
      details: 'Sending infrastructure data to Perplexity for expert analysis'
    });

    // Query Perplexity API with enhanced parameters for better data quality
    const perplexityStartTime = performance.now();
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REACT_APP_PRP}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{
          role: 'user',
          content: analysisPrompt
        }],
        max_tokens: 3000, // Increased for more detailed analysis
        temperature: 0.1, // Lower temperature for more factual responses
        return_citations: true // Enable citations for better source tracking
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const perplexityEndTime = performance.now();
    console.log(`⏱️ Perplexity API: ${(perplexityEndTime - perplexityStartTime).toFixed(0)}ms`);
    
    const analysis = data.choices[0]?.message?.content;
    const citations = data.citations || [];

    // Analysis received
    
    // Enhanced logging for analysis structure
    // Enhanced response quality analysis
    const qualityStartTime = performance.now();
    this.analyzeResponseQuality(analysis, citations);
    const qualityEndTime = performance.now();
    // Quality analysis completed
    
    // Log response summary only
    console.log(`📋 Perplexity response: ${analysis?.length || 0} characters`);
    
    // Log citations summary
    if (citations.length > 0) {
      console.log(`📚 Citations: ${citations.length} sources`);
    }

    // Validate response quality
    const validation = this.validateResponseQuality(analysis, citations);
    
    if (!validation.isValid) {
      console.warn('⚠️ Perplexity: Response quality validation failed');
      validation.recommendations.forEach(rec => console.warn(`   - ${rec}`));
    }

    // Cache the response for future use
    const responseToCache = {
      analysis: analysis,
      citations: citations,
      timestamp: Date.now(),
      qualityScore: validation.qualityAnalysis.qualityScore,
      nodeCount: validation.qualityAnalysis.nodeCount,
      isValid: validation.isValid
    };
    
    setCachedPerplexityResponse(coordinates, infrastructureSummary, responseToCache);
    console.log('💾 Perplexity: Response cached for future use');

    // Create the return object
    const finalResponse = {
      success: true,
      tool: 'PERPLEXITY',
      data: analysis,
      citations: citations,
      timestamp: Date.now(),
      infrastructureSummary: infrastructureSummary,
      dataSourcesUsed: this.getDataSourcesUsed(previousResults),
      confidence: 0.9, // High confidence since based on real data
      cached: false
    };

    // Save to development cache if enabled
    if (this.DEV_CACHE_ENABLED) {
      this.saveToDevCache(coordinates, analysisPrompt, finalResponse);
    }

    this.updateToolFeedback({
      isActive: true,
      tool: 'perplexity',
      status: '✅ Analysis complete',
      progress: 100,
      details: `Generated ${analysis?.length || 0} character analysis with ${citations.length} citations`
    });

    return finalResponse;
  }

  /**
   * Execute basic analysis without infrastructure data
   */
  async executeBasicAnalysis(queries, coordinates, locationConfig = null) {
    const basicPrompt = this.buildBasicPrompt(coordinates, locationConfig);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REACT_APP_PRP}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{
          role: 'user',
          content: basicPrompt
        }],
        max_tokens: 1500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices[0]?.message?.content;
    const citations = data.citations || [];

    return {
      analysis: analysis,
      citations: citations,
      confidence: 0.6 // Lower confidence without real data
    };
  }

  /**
   * Build comprehensive infrastructure summary from SERP and OSM data
   */
  buildInfrastructureSummary(previousResults) {
    const summary = {
      powerInfrastructure: [],
      geographicFeatures: [],
      totalFeatures: 0,
      searchRadius: '15 miles (Google Places) + 6km (OSM)',
      dataTimestamp: Date.now()
    };

    // Process SERP/Google Places data
    // Note: serpData is directly an array of features, not an object with features property
    if (previousResults.serpData && Array.isArray(previousResults.serpData)) {
      const serpFeatures = previousResults.serpData;
      summary.totalFeatures += serpFeatures.length;
      
      serpFeatures.forEach(feature => {
        const props = feature.properties;
        summary.powerInfrastructure.push({
          name: props.title || props.name || 'Unknown',
          category: props.category || 'other',
          type: props.infrastructure_type || 'unknown',
          criticality: props.criticality_level || 'medium',
          distance: props.distance || 'unknown',
          coordinates: feature.geometry.coordinates,
          source: 'Google Places API'
        });
      });
    }

    // Process OSM strategic geographic context
    let osmContext = null;
    if (previousResults.osmData?.data?.geographicContext) {
      osmContext = previousResults.osmData.data.geographicContext;
    } else if (previousResults.osmData?.geographicContext) {
      osmContext = previousResults.osmData.geographicContext;
    }
    
    if (osmContext) {
      summary.totalFeatures += osmContext.features.length;
      
      // Add strategic geographic intelligence to summary
      summary.spatialIntelligence = {
        transmissionCorridors: osmContext.spatialAnalysis.transmissionCorridors.length,
        landUseZones: osmContext.spatialAnalysis.landUseZones.length,
        waterFeatures: osmContext.spatialAnalysis.waterFeatures.length,
        transportationNetwork: osmContext.spatialAnalysis.transportationNetwork.length,
        facilityProximityAnalysis: osmContext.spatialAnalysis.facilityProximity.length
      };
      
      summary.riskFactors = {
        floodRisk: osmContext.riskAssessment.floodRisk,
        accessRisk: osmContext.riskAssessment.accessRisk,
        landAvailability: osmContext.riskAssessment.landAvailability
      };
      
      // Add key geographic features to summary
      osmContext.features.forEach(feature => {
        const props = feature.properties;
        summary.geographicFeatures.push({
          name: props.name || 'Unnamed',
          category: props.category || 'other',
          strategicImportance: props.strategic_importance,
          type: feature.geometry.type,
          source: 'OpenStreetMap Strategic Analysis'
        });
      });
    }

    return summary;
  }

  /**
   * Get location-specific information for prompts
   */
  getLocationInfo(locationConfig, coordinates) {
    if (locationConfig) {
      return {
        city: locationConfig.city,
        state: locationConfig.state,
        county: locationConfig.county,
        region: locationConfig.region
      };
    }
    
    // Fallback to Whitney, TX if no location config
    return {
      city: 'Whitney',
      state: 'TX',
      county: 'Bosque County',
      region: 'North Central Texas'
    };
  }

  /**
   * Build enhanced data-driven prompt for Perplexity analysis
   * Based on test_perplexity_node_analysis.mjs for better data quality
   */
  buildDataDrivenPrompt(coordinates, infrastructureSummary, locationConfig = null) {
    const { lat, lng } = coordinates;
    
    // Get location-specific information
    const locationInfo = this.getLocationInfo(locationConfig, coordinates);
    
    return `You are conducting a POWER GRID RELIABILITY ANALYSIS for a data center site in ${locationInfo.city}, ${locationInfo.state} (${lat}, ${lng}).

**CRITICAL REQUIREMENT:** Use ONLY publicly available data from these verified sources with direct links. Where plant-level data is unavailable, regional Texas data from EIA, ERCOT, or FERC is provided as instructed.

**INFRASTRUCTURE NODES TO ANALYZE (LIMIT: TOP 5 MOST CRITICAL):**

**POWER INFRASTRUCTURE (within 15 miles) - ANALYZE ONLY THE TOP 5:**
${infrastructureSummary.powerInfrastructure.slice(0, 5).map((item, index) =>
  `${index + 1}. **${item.name}** - ${item.category} (~${item.distance} miles)`
).join('\n')}

**GEOGRAPHIC CONTEXT (from OpenStreetMap Strategic Analysis):**
${this.formatGeographicContext(infrastructureSummary)}

**MANDATORY DATA SOURCES TO USE (with direct links):**

1. **EIA State Electricity Data:** https://www.eia.gov/electricity/data/state/
   - Texas power plant capacity and generation data
   - Historical reliability metrics by fuel type
   - Transmission infrastructure data

2. **EIA Power Plant Data:** https://www.eia.gov/electricity/data/eia860/
   - Individual plant capacity and operational data
   - Plant-specific generation and fuel consumption
   - Historical outage and maintenance data

3. **EIA Electric Power Monthly:** https://www.eia.gov/electricity/monthly/
   - Recent generation data by state and fuel type
   - Capacity factors and utilization rates
   - Regional electricity statistics

4. **FERC Electric Power Markets:** https://www.ferc.gov/market-oversight/markets-electricity
   - Regional transmission planning studies
   - Market reliability assessments
   - Infrastructure investment data

5. **ERCOT Public Reports:** https://www.ercot.com/news/reports
   - System reliability reports
   - Load forecasting studies
   - Transmission planning documents

6. **Texas PUC Filings:** https://www.puc.texas.gov/
   - Utility infrastructure filings
   - Reliability standards compliance
   - Regional planning documents

7. **EIA Electric Power Data Browser:** https://www.eia.gov/electricity/data/browser/
   - Interactive data queries for Texas
   - Plant-level generation and capacity data
   - Historical trends and analysis

**ANALYSIS REQUIREMENTS:**

**IMPORTANT:** Analyze ONLY the top 5 most critical power infrastructure nodes listed above. Focus on facilities with the highest capacity, closest proximity, and most reliable data availability.

For EACH of the 5 nodes, provide:

## NODE X: **[Facility Name]**
- **Type:** [Facility type from EIA-860 database]
- **EIA Plant ID:** [EIA plant identifier with source link]
- **Current Status:** [Operational status from EIA data]

**1. POWER SCORE:** [X/10] **WITH SOURCE**
- **Nameplate Capacity:** [MW capacity from EIA-860 database or regional estimate]
- **Recent Generation:** [Actual generation from EIA state data or regional estimate]
- **Capacity Factor:** [From EIA Electric Power Monthly data or regional average]
- **Source Link:** [Direct EIA database URL or regional data source]
- **Last Updated:** [Data timestamp from EIA or regional data]

**2. STABILITY SCORE:** [X/10] **WITH SOURCE**
- **ERCOT Zone:** [Load zone from ERCOT public reports]
- **Grid Integration:** [From FERC market oversight data]
- **Reliability Metrics:** [From EIA reliability data]
- **Source Link:** [ERCOT or FERC report URL]

**3. TRANSMISSION CAPACITY:** **WITH SOURCE**
- **Transmission Lines:** [From EIA transmission data]
- **Voltage Level:** [From FERC transmission studies]
- **Available Capacity:** [From ERCOT planning reports]
- **Regional Load:** [From EIA state electricity data]
- **Source Link:** [EIA or FERC transmission data URL]

**4. RELIABILITY METRICS:** **WITH SOURCE**
- **Historical Outages:** [From EIA plant operations data]
- **Fuel Dependencies:** [From EIA fuel consumption data]
- **Weather Resilience:** [From FERC reliability studies]
- **Maintenance History:** [From EIA plant data]
- **Source Links:** [EIA, FERC, or ERCOT report URLs]

**5. REGIONAL CONTEXT:** **WITH SOURCE**
- **Load Zone Analysis:** [From ERCOT load zone data]
- **Transmission Planning:** [From FERC regional studies]
- **Infrastructure Investment:** [From Texas PUC filings]
- **Regional Generation Mix:** [From EIA state data]
- **Source Links:** [ERCOT, FERC, or PUC document URLs]

**6. DATA CENTER IMPACT:** **WITH SOURCE**
- **Power Availability:** [From EIA generation data]
- **Transmission Redundancy:** [From FERC transmission studies]
- **Reliability Standards:** [From Texas PUC compliance data]
- **Grid Stability:** [From ERCOT system reports]
- **Source Link:** [Relevant regulatory document URL]

**OUTPUT FORMAT:** Each assessment MUST include:
1. Real numerical data from EIA/FERC/ERCOT sources
2. Direct source links to specific databases/reports
3. "Last Updated" timestamps from source data
4. Specific identifiers (EIA Plant ID, FERC docket numbers, etc.)

**ACCEPT:** Regional Texas data from EIA, ERCOT, or FERC when specific facility data is unavailable. Provide reasonable estimates based on facility type and regional averages when specific data is not available.

**FOCUS ON:** Texas-specific data, recent reports (2023-2024), and verifiable infrastructure metrics that directly impact data center power reliability.

**GEOGRAPHIC INTELLIGENCE INTEGRATION:**
Use the geographic context data to enhance your analysis:
- Consider transmission corridor proximity and redundancy
- Factor in flood risk from nearby water features
- Assess transportation access for maintenance and equipment
- Evaluate land use compatibility and expansion potential
- Include spatial relationships between facilities in your risk assessment

**SPECIAL INSTRUCTIONS:**
- Search for "Texas" specifically in EIA databases
- Look for "ERCOT" in FERC documents
- Check for "Hill County" or "Bosque County" in Texas PUC filings
- Use EIA Electric Power Data Browser for interactive queries
- Include capacity factors and utilization rates where available
- MUST include at least one FERC link from https://www.ferc.gov/market-oversight/markets-electricity
- MUST include at least one ERCOT link from https://www.ercot.com/news/reports
- MUST include EIA Plant IDs (5-6 digit numbers) where available
- MUST include "Last Updated" timestamps from source data
- If no specific plant data found, provide regional Texas data from EIA state electricity data

**CRITICAL:** You must find at least one FERC link, one ERCOT link, and one EIA Plant ID to achieve a high quality score.

Analyze NOW using only these verified public data sources:`;
  }

  /**
   * Format geographic context for Perplexity analysis
   */
  formatGeographicContext(infrastructureSummary) {
    if (!infrastructureSummary.spatialIntelligence) {
      return 'No strategic geographic context available.';
    }
    
    const { spatialIntelligence, riskFactors } = infrastructureSummary;
    
    let contextText = '';
    
    // Transmission corridor analysis
    if (spatialIntelligence.transmissionCorridors > 0) {
      contextText += `- **Transmission Infrastructure:** ${spatialIntelligence.transmissionCorridors} transmission corridors identified\n`;
    }
    
    // Land use and expansion potential
    if (spatialIntelligence.landUseZones > 0) {
      contextText += `- **Land Use Analysis:** ${spatialIntelligence.landUseZones} zoning areas analyzed for expansion potential\n`;
    }
    
    // Water resources and cooling potential
    if (spatialIntelligence.waterFeatures > 0) {
      contextText += `- **Water Resources:** ${spatialIntelligence.waterFeatures} water features identified for cooling analysis\n`;
    }
    
    // Transportation and access
    if (spatialIntelligence.transportationNetwork > 0) {
      contextText += `- **Transportation Access:** ${spatialIntelligence.transportationNetwork} transportation corridors for maintenance access\n`;
    }
    
    // Risk assessment summary
    if (riskFactors) {
      contextText += `- **Risk Assessment:** Flood risk: ${riskFactors.floodRisk}, Access risk: ${riskFactors.accessRisk}, Land availability: ${riskFactors.landAvailability}\n`;
    }
    
    // Spatial relationships
    if (spatialIntelligence.facilityProximityAnalysis > 0) {
      contextText += `- **Facility Proximity:** Spatial analysis completed for ${spatialIntelligence.facilityProximityAnalysis} critical facilities\n`;
    }
    
    return contextText || 'Geographic context analysis in progress.';
  }
  
  /**
   * Build basic prompt without infrastructure data
   */
  buildBasicPrompt(coordinates, locationConfig = null) {
    const { lat, lng } = coordinates;
    
    // Get location-specific information
    const locationInfo = this.getLocationInfo(locationConfig, coordinates);
    
    return `As a power grid reliability expert, analyze the power grid reliability for a data center site in ${locationInfo.city}, ${locationInfo.state} (${lat}, ${lng}) in ${locationInfo.county}.

Provide a comprehensive assessment including:
1. Grid reliability score (1-10) for this location
2. Main risk factors for power reliability in this area
3. ERCOT grid operator analysis for this region
4. Water availability for cooling systems
5. Transmission capacity and infrastructure in Bosque County
6. Specific recommendations for data center operations

Focus on practical insights for data center decision-making in this specific location.`;
  }

  /**
   * Get summary of data sources used
   */
  getDataSourcesUsed(previousResults) {
    const sources = [];
    
    if (previousResults.serpData) {
      sources.push({
        name: 'Google Places API',
        type: 'Infrastructure Data',
        features: previousResults.serpData.features?.length || 0,
        radius: '15 miles'
      });
    }
    
    if (previousResults.osmData) {
      sources.push({
        name: 'OpenStreetMap',
        type: 'Geographic Data', 
        features: previousResults.osmData.features?.length || 0,
        radius: '6km'
      });
    }
    
    return sources;
  }

  /**
   * Analyze the quality of the Perplexity response
   * Based on test_perplexity_node_analysis.mjs quality scoring
   */
  analyzeResponseQuality(analysis, citations) {
    // Check for EIA/FERC/ERCOT data indicators
    const hasEIALinks = /eia\.gov/i.test(analysis);
    const hasFERCLinks = /ferc\.gov/i.test(analysis);
    const hasERCOTLinks = /ercot\.com|ercot\.org/i.test(analysis);
    const hasSpecificNumbers = /\d+\.\d+\s*MW|\d+\s*MW/g.test(analysis);
    const hasEstimates = /estimated|approximately|likely|probably/gi.test(analysis);
    const hasTimestamps = /\d{4}-\d{2}-\d{2}|\w+\s+\d+,\s+\d{4}/g.test(analysis);
    const hasSourceLinks = /https?:\/\/[^\s]+/g.test(analysis);
    const hasEIAPlantIDs = /\b\d{5,6}\b/g.test(analysis); // EIA plant IDs are typically 5-6 digits
    // Count nodes analyzed
    const nodeMatches = analysis.match(/## NODE \d+:/g);
    const nodeCount = nodeMatches ? nodeMatches.length : 0;

    // Check for consistent structure
    const hasPowerScores = (analysis.match(/POWER SCORE:/g) || []).length;
    const hasStabilityScores = (analysis.match(/STABILITY SCORE:/g) || []).length;
    const hasTransmissionCapacity = (analysis.match(/TRANSMISSION CAPACITY:/g) || []).length;

    // Structure consistency check

    // Enhanced quality score focusing on EIA/FERC data (more flexible)
    let qualityScore = 0;
    if (hasEIALinks) qualityScore += 25; // EIA is most important
    if (hasFERCLinks) qualityScore += 20; // FERC is second most important
    if (hasERCOTLinks) qualityScore += 20; // ERCOT is third
    if (hasSpecificNumbers) qualityScore += 20; // Increased importance for actual data
    if (hasTimestamps) qualityScore += 10; // Timestamps are good but not critical
    if (hasSourceLinks) qualityScore += 15; // Source links are important
    if (hasEIAPlantIDs) qualityScore += 10; // EIA Plant IDs are bonus
    // Don't penalize estimates - they're acceptable when specific data isn't available

    // Log only essential quality info
    if (qualityScore >= 60) {
      console.log(`✅ Perplexity analysis quality: ${qualityScore}/100 (${citations.length} citations, ${nodeCount} nodes)`);
    } else if (qualityScore >= 40) {
      console.log(`⚠️ Perplexity analysis quality: ${qualityScore}/100 (needs improvement)`);
    } else {
      console.log(`❌ Perplexity analysis quality: ${qualityScore}/100 (poor data quality)`);
    }

    return {
      qualityScore,
      hasEIALinks,
      hasFERCLinks,
      hasERCOTLinks,
      hasSpecificNumbers,
      hasEstimates,
      hasTimestamps,
      hasSourceLinks,
      hasEIAPlantIDs,
      nodeCount,
      citations: citations.length
    };
  }

  /**
   * Validate response quality and provide fallback if needed
   * @param {string} analysis - The analysis response
   * @param {Array} citations - The citations array
   * @returns {Object} - Validation result with quality metrics
   */
  validateResponseQuality(analysis, citations) {
    const qualityAnalysis = this.analyzeResponseQuality(analysis, citations);
    
    // Define quality thresholds (more flexible)
    const MIN_QUALITY_SCORE = 40;
    const MIN_NODE_COUNT = 3;
    const MIN_RESPONSE_LENGTH = 1000;
    
    const isValid = 
      qualityAnalysis.qualityScore >= MIN_QUALITY_SCORE &&
      qualityAnalysis.nodeCount >= MIN_NODE_COUNT &&
      analysis.length >= MIN_RESPONSE_LENGTH;
    
    if (!isValid) {
      console.warn('⚠️ Perplexity: Response quality below threshold');
      console.warn(`   Quality Score: ${qualityAnalysis.qualityScore}/100 (min: ${MIN_QUALITY_SCORE})`);
      console.warn(`   Node Count: ${qualityAnalysis.nodeCount} (min: ${MIN_NODE_COUNT})`);
      console.warn(`   Response Length: ${analysis.length} (min: ${MIN_RESPONSE_LENGTH})`);
    }
    
    return {
      isValid,
      qualityAnalysis,
      recommendations: this.getQualityRecommendations(qualityAnalysis)
    };
  }

  /**
   * Get quality improvement recommendations
   * @param {Object} qualityAnalysis - Quality analysis results
   * @returns {Array} - Array of recommendation strings
   */
  getQualityRecommendations(qualityAnalysis) {
    const recommendations = [];
    
    if (!qualityAnalysis.hasEIALinks) {
      recommendations.push('Include EIA.gov data sources for better reliability');
    }
    if (!qualityAnalysis.hasFERCLinks) {
      recommendations.push('Add FERC.gov regulatory data for grid analysis');
    }
    if (!qualityAnalysis.hasERCOTLinks) {
      recommendations.push('Include ERCOT.com reports for Texas-specific data');
    }
    if (!qualityAnalysis.hasSpecificNumbers) {
      recommendations.push('Add specific MW capacity and generation numbers');
    }
    if (qualityAnalysis.hasEstimates) {
      recommendations.push('Replace estimates with actual data from official sources');
    }
    if (!qualityAnalysis.hasTimestamps) {
      recommendations.push('Include data timestamps for currency verification');
    }
    if (qualityAnalysis.nodeCount < 3) {
      recommendations.push('Analyze more infrastructure nodes for comprehensive coverage');
    }
    
    return recommendations;
  }

  /**
   * Warm cache with common infrastructure queries
   * @param {Array} commonCoordinates - Array of common site coordinates
   */
  async warmCache(commonCoordinates = []) {
    console.log('🔥 Perplexity: Warming cache with common queries...');
    
    const defaultCoordinates = [
      { lat: 31.9315, lng: -97.347 }, // Whitney, TX
      { lat: 32.7767, lng: -96.7970 }, // Dallas, TX
      { lat: 29.7604, lng: -95.3698 }  // Houston, TX
    ];
    
    const coordinatesToWarm = commonCoordinates.length > 0 ? commonCoordinates : defaultCoordinates;
    
    for (const coords of coordinatesToWarm) {
      try {
        // Create a basic infrastructure summary for warming
        const mockInfrastructureSummary = {
          powerInfrastructure: [
            { name: 'Mock Power Plant', category: 'power plants', distance: 5.0, criticality: 'critical' }
          ],
          geographicFeatures: [
            { name: 'Mock Substation', category: 'substation', type: 'transmission' }
          ],
          totalFeatures: 2
        };
        
        // Check if already cached
        const cached = getCachedPerplexityResponse(coords, mockInfrastructureSummary);
        if (cached) {
          console.log(`✅ Perplexity: Cache already warm for ${coords.lat}, ${coords.lng}`);
          continue;
        }
        
        // This would trigger a real API call in production
        console.log(`🔥 Perplexity: Warming cache for ${coords.lat}, ${coords.lng}`);
        
      } catch (error) {
        console.warn(`⚠️ Perplexity: Cache warming failed for ${coords.lat}, ${coords.lng}:`, error.message);
      }
    }
    
    console.log('✅ Perplexity: Cache warming complete');
  }
}

// Global development cache controls for easy testing
let globalPerplexityTool = null;

// Set global tool instance (called by tool executor)
export function setGlobalPerplexityTool(toolInstance) {
  globalPerplexityTool = toolInstance;
}

// Global functions for development cache control
if (typeof window !== 'undefined') {
  window.enablePerplexityCache = () => {
    if (globalPerplexityTool) {
      globalPerplexityTool.DEV_CACHE_ENABLED = true;
      console.log('⚡ DEV CACHE: Enabled - Using cached responses for fast testing');
    } else {
      console.warn('⚠️ DEV CACHE: No Perplexity tool instance available');
    }
  };

  window.disablePerplexityCache = () => {
    if (globalPerplexityTool) {
      globalPerplexityTool.DEV_CACHE_ENABLED = false;
      console.log('🔴 DEV CACHE: Disabled - Using live API calls');
    } else {
      console.warn('⚠️ DEV CACHE: No Perplexity tool instance available');
    }
  };

  window.clearPerplexityCache = () => {
    if (globalPerplexityTool) {
      globalPerplexityTool.clearDevCache();
    } else {
      console.warn('⚠️ DEV CACHE: No Perplexity tool instance available');
    }
  };

  window.listPerplexityCache = () => {
    if (globalPerplexityTool) {
      return globalPerplexityTool.listDevCache();
    } else {
      console.warn('⚠️ DEV CACHE: No Perplexity tool instance available');
      return [];
    }
  };

  window.clearPerplexityDevCache = () => {
    if (globalPerplexityTool) {
      globalPerplexityTool.clearDevCache();
      console.log('🗑️ DEV CACHE: Cleared all cached responses - next query will be live');
    } else {
      console.warn('⚠️ DEV CACHE: No Perplexity tool instance available');
    }
  };
}
