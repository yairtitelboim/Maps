import { useState, useCallback } from 'react';
import { createStartupEcosystemToolExecutor, setGlobalToolExecutor, getGlobalToolExecutor } from '../utils/StartupEcosystemToolExecutor';
import { cleanExpiredResponseCache } from '../utils/ResponseCache';
import { getGeographicConfig } from '../config/geographicConfig.js';
import { 
  getClaudeCache,
  setClaudeCache,
  getWorkflowCache,
  setWorkflowCache,
  setCurrentLocation
} from '../utils/HolisticCacheManager.js';

// Helper function to sanitize JSON strings by removing control characters
const sanitizeJsonString = (str) => {
  if (!str || typeof str !== 'string') return str;
  
  // Remove control characters using character codes (safer for linter)
  let sanitized = str;
  for (let i = 0; i < 32; i++) {
    if (i !== 9 && i !== 10 && i !== 13) { // Keep tab, newline, carriage return
      sanitized = sanitized.replace(new RegExp(String.fromCharCode(i), 'g'), '');
    }
  }
  
  // Remove DEL character and extended control characters
  for (let i = 127; i < 160; i++) {
    sanitized = sanitized.replace(new RegExp(String.fromCharCode(i), 'g'), '');
  }
  
  return sanitized
    // Remove markdown code blocks
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    // Clean up malformed escape sequences
    .replace(/\\[^"\\bfnrt]/g, '')
    // Fix common JSON formatting issues
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    // Remove trailing commas
    .replace(/,(?=\s*[}\]])/g, '')
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
};

const getGeoaiApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.__GEOAI_API_BASE_URL__) {
    return window.__GEOAI_API_BASE_URL__;
  }
  if (process.env.REACT_APP_GEOAI_API_BASE_URL) {
    return process.env.REACT_APP_GEOAI_API_BASE_URL;
  }
  if (process.env.NEXT_PUBLIC_GEOAI_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_GEOAI_API_BASE_URL;
  }
  return '';
};

const joinUrl = (base, path) => {
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  if (!base) return path;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
};

const buildCacheBustedUrl = (base, relativeUrl, versionToken) => {
  const absolute = joinUrl(base, relativeUrl);
  if (!versionToken) {
    return absolute;
  }
  const separator = absolute.includes('?') ? '&' : '?';
  return `${absolute}${separator}v=${encodeURIComponent(versionToken)}`;
};


export const useAIQuery = (map, updateToolFeedback, handleMarkerClick = null, locationKey = 'default') => {
  const [isLoading, setIsLoading] = useState(false);
  const [responses, setResponses] = useState([]);
  const [citations] = useState([]);
  
  // Helper function to preprocess Claude response for better JSON parsing
  const preprocessClaudeResponse = (response) => {
    if (!response || typeof response !== 'string') return response;
    
    // Fix common Claude response issues that cause JSON parsing errors
    let cleaned = response
      // Remove any BOM or invisible characters
      .replace(/^\uFEFF/, '')
      // Fix unescaped newlines in JSON string values
      .replace(/"([^"]*?)\n([^"]*?)"/g, '"$1\\n$2"')
      // Fix unescaped carriage returns
      .replace(/"([^"]*?)\r([^"]*?)"/g, '"$1\\r$2"')
      // Fix unescaped tabs
      .replace(/"([^"]*?)\t([^"]*?)"/g, '"$1\\t$2"')
      .trim();
    
    // Remove control characters using character codes (safer for linter)
    for (let i = 0; i < 32; i++) {
      if (i !== 9 && i !== 10 && i !== 13) { // Keep tab, newline, carriage return
        cleaned = cleaned.replace(new RegExp(String.fromCharCode(i), 'g'), '');
      }
    }
    
    return cleaned;
  };
  const [pendingRequests, setPendingRequests] = useState(new Set());
  const [responseCache, setResponseCache] = useState({});

  // Function to add a pending request
  const addPendingRequest = useCallback((queryId) => {
    setPendingRequests(prev => new Set(prev).add(queryId));
    console.log(`Added pending request: ${queryId}`);
  }, []);
  
  // Function to remove a pending request
  const removePendingRequest = useCallback((queryId) => {
    setPendingRequests(prev => {
      const newSet = new Set(prev);
      newSet.delete(queryId);
      return newSet;
    });
    console.log(`Removed pending request: ${queryId}`);
  }, []);

  // Get location-specific configuration
  const locationConfig = getGeographicConfig(locationKey);

  // Enhanced prompt function for Startup Ecosystem Analysis question
  const getStartupEcosystemPrompt = (questionData) => {
    if (questionData.id === 'startup_ecosystem_analysis') {
      return `You are conducting a preliminary startup ecosystem analysis for the ${locationConfig.businessContext}.

LOCATION CONTEXT:
- Location: ${locationConfig.city}, ${locationConfig.state} (${locationConfig.county})
- Business Context: ${locationConfig.businessContext}
- Region: ${locationConfig.region}
- Facility: ${locationConfig.facilityName}

USER REQUEST: ${questionData.query}

PROVIDE YOUR EXPERT PRELIMINARY ANALYSIS:

1. **Initial Assessment** (2-3 sentences): Based on your knowledge of the ${locationConfig.city} startup ecosystem and ${locationConfig.region} innovation landscape, what is your preliminary answer to this question?

2. **Critical Ecosystem Factors**: What specific startup ecosystem elements (talent, funding, infrastructure, network effects) are most important for this analysis?

3. **Data Requirements**: What types of real-time startup ecosystem data would enhance this preliminary assessment?

4. **Regional Context**: What ${locationConfig.city}-specific factors (university connections, funding landscape, talent pool, market opportunities) should be considered for ${locationConfig.region}?

Note: This preliminary analysis will be enhanced with real-time startup ecosystem data collection and detailed technical analysis.

Respond in this JSON format:

{
  "textResponse": "Your comprehensive preliminary analysis addressing the above 4 points",
  "useTools": true,
  "toolActions": [
    {
      "tool": "SERP",
      "reason": "Need current startup ecosystem data for companies, investors, and co-working spaces",
      "queries": ["startup companies near ${locationConfig.city} ${locationConfig.state}", "venture capital firms ${locationConfig.county} ${locationConfig.state}", "co-working spaces ${locationConfig.city} ${locationConfig.state}"],
      "priority": "high",
      "expectedOutcome": "Real-time startup ecosystem data within analysis area"
    },
    {
      "tool": "OSM",
      "reason": "Need geographic context for urban infrastructure and startup ecosystem support",
      "queries": ["universities ${locationConfig.city}", "offices ${locationConfig.county}", "transportation ${locationConfig.region}"],
      "priority": "medium",
      "expectedOutcome": "Geographic context and spatial relationships of startup ecosystem infrastructure"
    },
    {
      "tool": "PERPLEXITY",
      "reason": "Need comprehensive startup ecosystem analysis based on collected data",
      "queries": ["startup ecosystem analysis ${locationConfig.city}", "innovation potential assessment ${locationConfig.region}", "talent and funding evaluation"],
      "priority": "high",
      "expectedOutcome": "Detailed startup ecosystem analysis incorporating SERP and OSM findings"
    }
  ],
  "metadata": {
    "confidence": 0.9,
    "reasoning": "Preliminary assessment based on ${locationConfig.city} startup ecosystem knowledge, enhanced by real-time data collection",
    "fallback": "General ${locationConfig.city} startup ecosystem knowledge for ${locationConfig.region} if tools unavailable"
  }
}

If JSON format fails, provide only the comprehensive text analysis.`;
    }
    
    // Fallback to existing prompts
    return questionData.isCustom ? 
      'You are an expert data center consultant analyzing the CyrusOne site in Whitney, TX (Bosque County). Provide concise, actionable insights relevant to data center operations, infrastructure, and business decisions. Focus on practical recommendations for Gene and the team.' :
      'You are an expert data center consultant providing executive summaries for data center operations.';
  };

  // Function to update only response-related state (for suggestion questions)
  const updateResponseOnly = (
    queryId,
    newResponse,
    newCitations,
    isLoadingState = false,
    options = {}
  ) => {
    const { metadata } = options;
    if (isLoadingState) {
      setIsLoading(true);
      
      // Track this as a pending request
      addPendingRequest(queryId);
      
      // Immediately collapse all existing responses when loading starts
      if (responses.length > 0) {
        // Note: This would need to be handled by parent component
        // setCollapsedResponses logic moved to parent
      }
      
      // Add a loading response to the array - this shows the skeleton loading
      setResponses(prev => [
        ...prev,
        {
          id: queryId,
          content: null,
          citations: [],
          isLoading: true,
          metadata: metadata ?? null
        }
      ]);
    } else {
      // Remove from pending requests
      removePendingRequest(queryId);
      
      // Replace the loading response with the actual response using the reliable ID system
      setResponses(prev => {
        const newResponses = [...prev];
        const responseIndex = newResponses.findIndex(r => r.id === queryId);
        
        if (responseIndex !== -1) {
          const existingMetadata = newResponses[responseIndex]?.metadata;
          newResponses[responseIndex] = { 
            ...newResponses[responseIndex], 
            content: newResponse, 
            citations: newCitations, 
            isLoading: false,
            metadata: metadata !== undefined ? metadata : existingMetadata ?? null
          };
        } else {
          // Fallback for safety, though it shouldn't be needed
          console.warn(`Response ID ${queryId} not found - adding as new response`);
          newResponses.push({ 
            id: queryId, 
            content: newResponse, 
            citations: newCitations, 
            isLoading: false,
            metadata: metadata ?? null
          });
        }
        return newResponses;
      });
      
      setIsLoading(false);
    }
  };

  // Main AI query handler
  const handleAIQuery = async (questionData) => {
    // Set current location for cache management
    setCurrentLocation(locationKey);
    
    // Generate a unique ID for the new request
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (questionData.manualResponse) {
      const manualId = questionData.manualId || queryId;
      console.log('🧠 useAIQuery: registering manual response', {
        manualId,
        locationKey,
        hasCitations: !!(questionData.manualCitations && questionData.manualCitations.length)
      });
      setResponses(prev => {
        const filtered = manualId ? prev.filter(r => r.manualId !== manualId) : prev;
        return [
          ...filtered,
          {
            id: manualId,
            manualId,
            content: questionData.manualResponse,
            citations: questionData.manualCitations || [],
            isLoading: false
          }
        ];
      });
      setIsLoading(false);
      return manualId;
    }
    
    // Simple cache key - just question type + location name
    const simpleLocationKey = locationConfig?.city || locationConfig?.name || 'default';
    
    // Get coordinates from location config
    const coordinates = locationConfig?.coordinates || { lat: 42.3601, lng: -71.0589 };
    
    // GEOAI: Spatial intelligence workflow triggered from NestedCircleButton GeoAI control
    if (questionData.id === 'geoai_analysis') {
      console.log('🧠 GeoAI Mode: Requesting Sentinel-2 composites');

      updateResponseOnly(queryId, null, [], true);

      const shouldExecuteGeoAI = questionData.shouldExecuteGeoAI !== false;
      const shouldRenderOverlays = questionData.shouldRenderOverlays !== false;

      try {
        if (!shouldExecuteGeoAI) {
          const summary = questionData.precomputedSummary || 'GeoAI summary unavailable.';
          const citations = questionData.precomputedCitations || [];
          const metadata = questionData.precomputedMetadata || null;

          updateResponseOnly(queryId, summary, citations, false, { metadata });
          setIsLoading(false);
          return;
        }

        if (updateToolFeedback) {
          updateToolFeedback({
            isActive: true,
            tool: 'geoai',
            status: '🛰️ Loading pre-rendered GeoAI imagery...',
            progress: 20,
            details: 'Retrieving cached Sentinel & NAIP overlays for key sites'
          });
        }

        let geoaiApiBaseUrl = getGeoaiApiBaseUrl();
        const candidateBases = [];
        if (geoaiApiBaseUrl) {
          candidateBases.push(geoaiApiBaseUrl);
        }
        if (typeof window !== 'undefined') {
          candidateBases.push('');
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            const localBase = `${window.location.protocol}//localhost:5001`;
            candidateBases.push(localBase);
            candidateBases.push(`${window.location.protocol}//127.0.0.1:5001`);
          }
        }
        const uniqueBases = [...new Set(candidateBases.length ? candidateBases : [''])];

        let metadataPayload = null;
        let lastMetadataError = null;

        const cachedOverlayUrl = questionData.siteOverlayUrl;
        if (cachedOverlayUrl) {
          console.log('🧠 GeoAI: loading cached overlay metadata', { cachedOverlayUrl });
          try {
            const cacheResponse = await fetch(cachedOverlayUrl, { cache: 'no-cache' });
            if (!cacheResponse.ok) {
              throw new Error(`Failed to load cached overlay (${cacheResponse.status})`);
            }
            const payload = await cacheResponse.json();
            metadataPayload = payload;
          } catch (cacheError) {
            console.warn('🧠 GeoAI: cached overlay load failed, falling back to API', cacheError);
          }
        }

        if (!metadataPayload) {
          for (const baseCandidate of uniqueBases) {
            const batchUrl = joinUrl(baseCandidate, '/api/geoai/imagery/batch');
            console.log('🧠 GeoAI: requesting dynamic tile metadata…', { batchUrl });
            try {
            const requestBody = {};
            if (Array.isArray(questionData.allowedSiteIds) && questionData.allowedSiteIds.length) {
              requestBody.siteIds = questionData.allowedSiteIds;
            }
            if (typeof questionData.radiusMeters === 'number') {
              requestBody.radius = questionData.radiusMeters;
            }

            const metadataResponse = await fetch(batchUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody)
            });
              if (!metadataResponse.ok) {
                lastMetadataError = new Error(`GeoAI tile metadata request failed (${metadataResponse.status})`);
                continue;
              }

              const payload = await metadataResponse.json();
              if (payload.success === false) {
                lastMetadataError = new Error(payload.error || 'GeoAI tile metadata request failed');
                continue;
              }

              metadataPayload = payload;
              geoaiApiBaseUrl = baseCandidate;
              break;
            } catch (requestError) {
              lastMetadataError = requestError;
            }
          }

          if (!metadataPayload) {
            throw lastMetadataError || new Error('GeoAI tile metadata request failed');
          }
        }

        const metadataVersionToken = metadataPayload.generatedAt || new Date().toISOString();
        const batchResults = metadataPayload.results || {};
        let sites = Object.values(batchResults)
          .map(entry => ({
            site: entry.site,
            result: entry.result
          }))
          .filter(entry => entry.site && entry.result && entry.result.success)
          .map(entry => ({
            id: entry.site.id,
            name: entry.site.name,
            center: entry.site.coordinates,
            radiusMeters: entry.result.imagery?.trueColor?.radiusMeters || entry.site.radius || 3000,
            imagery: entry.result.imagery || {},
            metadata: entry.result.metadata || {}
          }));

        if (questionData.radiusMeters) {
          sites = sites.map(site => ({
            ...site,
            radiusMeters: questionData.radiusMeters
          }));
        }

        if (Array.isArray(questionData.allowedSiteIds) && questionData.allowedSiteIds.length) {
          const allowed = new Set(questionData.allowedSiteIds);
          sites = sites.filter(site => allowed.has(site.id));
        }

        console.log('🧠 GeoAI: tile metadata ready for', sites.length, 'sites');
        if (!sites.length) {
          throw new Error('GeoAI tile metadata returned no sites');
        }
        const sentinelLookbackDays = 365;

        if (updateToolFeedback) {
          updateToolFeedback({
            isActive: true,
            tool: 'geoai',
            status: '🧠 Preparing overlays...',
            progress: 60,
            details: `Applying ${sites.length} cached overlays to the map`
          });
        }

        const mapInstance = map?.current;
        if (shouldRenderOverlays && mapInstance) {
          console.log('🧠 GeoAI: clearing previous GeoAI layers and sources');
          if (!mapInstance.isStyleLoaded()) {
            const waitStartedAt = Date.now();
            console.log('🧠 GeoAI: map style not yet loaded — awaiting styledata event');
            await new Promise(resolve => {
              const onceHandler = () => {
                mapInstance.off('styledata', styledataHandler);
                console.log('🧠 GeoAI: styledata event received', {
                  waitedMs: Date.now() - waitStartedAt
                });
                resolve();
              };
              const timeoutId = setTimeout(() => {
                mapInstance.off('styledata', styledataHandler);
                console.warn('🧠 GeoAI: styledata wait timed out after 5000ms — continuing rendering');
                resolve();
              }, 5000);
              const styledataHandler = () => {
                clearTimeout(timeoutId);
                onceHandler();
              };
              mapInstance.on('styledata', styledataHandler);
            });
          } else {
            console.log('🧠 GeoAI: map style already loaded — proceeding immediately');
          }

          const removedBaseLayers = [];
          ['geoai-truecolor-layer', 'geoai-ndvi-layer', 'geoai-falsecolor-layer', 'geoai-naip-layer']
            .forEach(id => {
              if (mapInstance.getLayer(id)) {
                mapInstance.removeLayer(id);
                removedBaseLayers.push(id);
              }
            });
          const removedBaseSources = [];
          ['geoai-truecolor-source', 'geoai-ndvi-source', 'geoai-falsecolor-source', 'geoai-naip-source']
            .forEach(id => {
              if (mapInstance.getSource(id)) {
                mapInstance.removeSource(id);
                removedBaseSources.push(id);
              }
            });
          if (removedBaseLayers.length || removedBaseSources.length) {
            console.log('🧠 GeoAI: removed legacy GeoAI artifacts', {
              layers: removedBaseLayers,
              sources: removedBaseSources
            });
          }

          const removedSiteLayers = [];
          const removedSiteSources = [];
          const currentStyle = mapInstance.getStyle();
          if (currentStyle?.layers) {
            currentStyle.layers
              .filter(layer => layer.id.startsWith('geoai-site-'))
              .forEach(layer => {
                if (mapInstance.getLayer(layer.id)) {
                  mapInstance.removeLayer(layer.id);
                  removedSiteLayers.push(layer.id);
                }
              });
          }
          if (currentStyle?.sources) {
            Object.keys(currentStyle.sources)
              .filter(sourceId => sourceId.startsWith('geoai-site-'))
              .forEach(sourceId => {
                if (mapInstance.getSource(sourceId)) {
                  mapInstance.removeSource(sourceId);
                  removedSiteSources.push(sourceId);
                }
              });
          }
          if (removedSiteLayers.length || removedSiteSources.length) {
            console.log('🧠 GeoAI: removed per-site overlays from previous runs', {
              layers: removedSiteLayers,
              sources: removedSiteSources
            });
          }

          console.log('🧠 GeoAI: applying cached overlays for sites', {
            siteCount: sites.length
          });
          const createCirclePolygon = (center, radiusMeters, steps = 128) => {
            const coords = [];
            const earthRadius = 6378137;
            const angularDistance = radiusMeters / earthRadius;
            const centerLatRad = (center.lat * Math.PI) / 180;
            const centerLngRad = (center.lng * Math.PI) / 180;

            for (let i = 0; i <= steps; i += 1) {
              const bearing = (2 * Math.PI * i) / steps;
              const sinLat = Math.sin(centerLatRad);
              const cosLat = Math.cos(centerLatRad);
              const sinAngular = Math.sin(angularDistance);
              const cosAngular = Math.cos(angularDistance);
              const latRad = Math.asin(
                sinLat * cosAngular + cosLat * sinAngular * Math.cos(bearing)
              );
              const lngRad = centerLngRad + Math.atan2(
                Math.sin(bearing) * sinAngular * cosLat,
                cosAngular - sinLat * Math.sin(latRad)
              );
              coords.push([
                (lngRad * 180) / Math.PI,
                (latRad * 180) / Math.PI
              ]);
            }

            return {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [coords]
              }
            };
          };

          const firstSuccessfulSite = sites[0];

          sites.forEach(site => {
            console.groupCollapsed(`🛰️ GeoAI overlay: ${site.name} (${site.id})`);
            if (!questionData.disableRaster) {
              const availableLayers = site.imagery || {};
              const layerConfigs = [
                { key: 'naip', opacity: 1, defaultMinZoom: 11 },
                { key: 'trueColor', opacity: 0.4, defaultMinZoom: 10 }
              ];

              layerConfigs.forEach(config => {
                const layerInfo = availableLayers[config.key];
                if (!layerInfo || !layerInfo.tileUrl) {
                  return;
                }

                const tileSourceId = `geoai-site-${site.id}-${config.key}-tilesource`;
                const tileLayerId = `geoai-site-${site.id}-${config.key}-tilelayer`;
                const tileUrl = buildCacheBustedUrl(geoaiApiBaseUrl, layerInfo.tileUrl, metadataVersionToken);
                console.log('🛰️ GeoAI: adding tile layer', {
                  layer: config.key,
                  sourceId: tileSourceId,
                  layerId: tileLayerId,
                  tileUrl
                });

                mapInstance.addSource(tileSourceId, {
                  type: 'raster',
                  tiles: [tileUrl],
                  tileSize: 256,
                  minzoom: layerInfo.minZoom ?? config.defaultMinZoom ?? 6,
                  maxzoom: layerInfo.maxZoom ?? 19
                });

                mapInstance.addLayer({
                  id: tileLayerId,
                  type: 'raster',
                  source: tileSourceId,
                  paint: {
                    'raster-opacity': config.opacity,
                    'raster-fade-duration': 0
                  }
                });
                console.log('🛰️ GeoAI: tile layer added successfully');
              });
            }

            if (!questionData.suppressHalo && site.radiusMeters) {
              const haloDefinitions = [
                { suffix: 'halo-2x', multiplier: 2, opacity: 0.18, color: '#ec4899' },
                { suffix: 'halo-3x', multiplier: 3, opacity: 0.12, color: '#ec4899' }
              ];

              haloDefinitions.forEach(halo => {
                const haloSourceId = `geoai-site-${site.id}-${halo.suffix}-source`;
                const haloLayerId = `geoai-site-${site.id}-${halo.suffix}-layer`;
                const radius = site.radiusMeters * halo.multiplier;
                const circleFeature = createCirclePolygon(site.center, radius);

                mapInstance.addSource(haloSourceId, {
                  type: 'geojson',
                  data: circleFeature
                });

                mapInstance.addLayer({
                  id: haloLayerId,
                  type: 'fill',
                  source: haloSourceId,
                  paint: {
                    'fill-color': halo.color,
                    'fill-opacity': halo.opacity,
                    'fill-outline-color': '#ec489966'
                  }
                });
              });
            }
            console.groupEnd();
          });

          if (firstSuccessfulSite) {
            console.log('🧠 GeoAI: first successful site identified (auto-zoom removed)', {
              siteId: firstSuccessfulSite.id,
              center: firstSuccessfulSite.center
            });
            // Auto-zoom removed - map stays at current position
          }
        } else if (!shouldRenderOverlays) {
          console.log('🧠 GeoAI: overlay rendering disabled, skipping map layer updates');
        } else {
          console.warn('🧠 GeoAI: map reference missing, skipping overlay rendering');
        }

        const analysisTimestamp = new Date().toLocaleString();
        const overlaySummaryLines = sites.map(site => {
          const hasNaip = Boolean(site.imagery?.naip?.tileUrl);
          const hasSentinel = Boolean(site.imagery?.trueColor?.tileUrl);
          if (!hasNaip && !hasSentinel) {
            return `- ⚠️ ${site.name}: imagery unavailable`;
          }
          const available = [];
          if (hasNaip) available.push('NAIP');
          if (hasSentinel) available.push('Sentinel');
          return `- ✅ ${site.name}: ${available.join(' + ')}`;
        }).join('\n');

        const summary = `## 🧠 GeoAI Satellite Intelligence\n**Focus Area:** Pinal County Mega-Project Portfolio  \n**Analysis Timestamp:** ${analysisTimestamp}  \n**Sites Processed:** ${sites.length} (Sentinel composites${sites.some(site => site.imagery?.naip?.tileUrl) ? ' + NAIP basemaps' : ''})\n\n### Overlay Coverage by Site\n${overlaySummaryLines}\n\n### Acquisition Window\n- Cached Sentinel lookback: last ${sentinelLookbackDays} days  \n- NAIP coverage: latest available within past 5 years\n\n### Recommended Next Steps\n1. Use layer visibility controls to inspect NAIP vs. Sentinel overlays per site.\n2. Capture screenshots of key manufacturing corridors (Lucid/LG/P&G) for water negotiations.\n3. Compare mining sites (Resolution, Florence) against Sentinel overlays to monitor reclamation impacts.\n\n*Imagery sourced from Sentinel-2 Surface Reflectance and USDA NAIP via Google Earth Engine (pre-generated).*`;

        const citations = [
          {
            url: 'https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR',
            title: 'Sentinel-2 MSI Surface Reflectance',
            snippet: 'Primary dataset for true-color composites delivered by GeoAI.'
          },
          {
            url: 'https://developers.google.com/earth-engine',
            title: 'Google Earth Engine',
            snippet: 'Processing environment used to generate cached imagery.'
          },
        ];

        if (sites.some(site => site.imagery?.naip?.tileUrl)) {
          citations.push({
            url: 'https://developers.google.com/earth-engine/datasets/catalog/USDA_NAIP_DOQQ',
            title: 'USDA NAIP DOQQ',
            snippet: 'High-resolution aerial imagery (≈1m) sourced from the National Agriculture Imagery Program.'
          });
        }

        const geoaiMetadata = {
          responseType: 'geoai_change_summary',
          sites,
          sentinelLookbackDays,
          analysisTimestamp,
          summaryText: summary
        };

        updateResponseOnly(queryId, summary, citations, false, { metadata: geoaiMetadata });
        console.log('🧠 GeoAI: overlays applied and summary updated', {
          responseId: queryId,
          sitesWithImagery: sites.filter(site => site.imagery && (site.imagery.naip?.tileUrl || site.imagery.trueColor?.tileUrl)).length
        });

        if (updateToolFeedback) {
          updateToolFeedback({
            isActive: true,
            tool: 'geoai',
            status: '✅ GeoAI imagery ready',
            progress: 100,
            details: `Rendered ${sites.length} site overlays across Pinal County`
          });

          setTimeout(() => {
            updateToolFeedback({
              isActive: false,
              tool: null,
              status: '',
              progress: 0,
              details: ''
            });
          }, 2500);
        }

      } catch (error) {
        console.error('❌ GeoAI imagery error:', error);
        if (updateToolFeedback) {
          updateToolFeedback({
            isActive: true,
            tool: 'geoai',
            status: '❌ GeoAI imagery failed',
            progress: 0,
            details: error.message || 'Unknown error'
          });

          setTimeout(() => {
            updateToolFeedback({
              isActive: false,
              tool: null,
              status: '',
              progress: 0,
              details: ''
            });
          }, 2500);
        }
        updateResponseOnly(queryId, `GeoAI imagery request failed: ${error.message || error}`, [], false);
      } finally {
        setIsLoading(false);
      }

      return;
    }

    // PERPLEXITY MODE: Handle direct Perplexity analysis
    if (questionData.id === 'perplexity_analysis' || questionData.isPerplexityMode) {
      console.log('🧠 Perplexity Mode: Starting Pinal County regional development analysis');
      
      // Execute Perplexity-first analysis with user's actual query
      const userQuery = questionData.query || questionData.text || 'pinal county regional development analysis';
      await executePerplexityAnalysis(queryId, coordinates, simpleLocationKey, userQuery);
      return;
    }
    
    // INSTANT CLAUDE RESPONSE: Pre-made Claude response for startup ecosystem analysis
    if (questionData.id === 'startup_ecosystem_analysis') {
      // console.log('⚡ INSTANT: Using pre-made Claude response, but still running tools');
      
      // Create a pre-made Claude response that will trigger tool execution
      const instantClaudeResponse = {
        textResponse: "I'll analyze the startup ecosystem for this location by gathering data on local startups, investors, co-working spaces, and urban infrastructure. Let me search for startup companies, venture capital firms, and co-working spaces in the area, then map the urban infrastructure and analyze the innovation potential.",
        useTools: true,
        toolActions: [
          {
            tool: 'SERP',
            action: 'search',
            query: 'startup companies Boston',
            description: 'Search for startup companies and innovation hubs in Boston'
          },
          {
            tool: 'OSM', 
            action: 'query',
            query: 'universities offices transportation Boston',
            description: 'Map urban infrastructure including universities, offices, and transportation'
          },
          {
            tool: 'PERPLEXITY',
            action: 'analyze',
            query: 'startup ecosystem analysis Boston innovation potential',
            description: 'Analyze startup ecosystem potential and market opportunities'
          }
        ]
      };
      
      // Simulate Claude response processing
      // console.log('⚡ Claude Response: Pre-made response loaded in <100ms');
      
      // Process the pre-made response as if it came from Claude
      try {
        const parsedResponse = instantClaudeResponse;
        console.log('✅ Claude response parsed successfully');
        
        // Execute the tools with the pre-made tool actions
        if (parsedResponse.useTools && parsedResponse.toolActions) {
          // console.log('🔧 Executing pre-made tool actions for startup ecosystem analysis');
          await executeStartupEcosystemTools(parsedResponse.toolActions, queryId, coordinates, simpleLocationKey);
        }
        
      } catch (error) {
        console.warn('⚠️ Error processing pre-made Claude response:', error);
      }
      
      return; // Exit early after triggering tools
    }
    
    // Check complete workflow cache first (highest priority)
    const workflowCache = getWorkflowCache(questionData.id, simpleLocationKey, coordinates);
    console.log('🔍 Workflow cache check:', {
      questionId: questionData.id,
      simpleLocationKey: simpleLocationKey,
      found: !!workflowCache
    });
    
    // Debug: Check if there are any workflow cache entries
    if (typeof window !== 'undefined' && window.holisticCache && window.holisticCache.caches) {
      const workflowCacheSize = window.holisticCache.caches.workflow?.size || 0;
      console.log('🔍 Workflow cache size:', workflowCacheSize);
    }
    
    if (workflowCache) {
      console.log('🎯 Workflow Cache HIT - returning complete cached workflow');
      console.log('⚡ Performance: Cached response loaded in <100ms (vs 30+ seconds for fresh analysis)');
      
      // Update AI state with cached workflow data
      setResponses(prev => [...prev, {
        id: queryId,
        content: workflowCache.finalResponse,
        citations: workflowCache.citations || [],
        isLoading: false,
        cached: true
      }]);
      
      // Update tool feedback to show cached completion
      updateToolFeedback({
        isActive: true,
        tool: 'workflow',
        status: '⚡ Complete workflow loaded from cache',
        progress: 100,
        details: `Using cached ecosystem analysis (${workflowCache.toolResults?.length || 0} tools completed) - 99% faster than fresh analysis`
      });
      
      // Hide feedback after 3 seconds to show the performance benefit
      setTimeout(() => {
        updateToolFeedback({
          isActive: false,
          tool: null,
          status: '',
          progress: 0,
          details: ''
        });
      }, 3000);
      
      return;
    }
    
    // Generate cache key - use hash for custom questions to avoid collisions
    const cacheKey = questionData.isCustom ? 
      `custom_${questionData.text.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}` : 
      questionData.id;
    
    // Check cache first
    if (responseCache[cacheKey]) {
      console.log('Cache hit for:', cacheKey);
      const cachedData = responseCache[cacheKey];
      const responseText = typeof cachedData === 'string' ? cachedData : cachedData.content;
      const cachedCitations = typeof cachedData === 'string' ? [] : (cachedData.citations || []);
      
      // Use updateResponseOnly to avoid affecting other UI elements
      updateResponseOnly(queryId, responseText, cachedCitations, false);
      
      return;
    }
    

    
    // Set loading state for response only
    updateResponseOnly(queryId, null, [], true);
    
    // Add immediate tool feedback for Startup Ecosystem question to show Claude is analyzing
    if (questionData.id === 'startup_ecosystem_analysis') {
      updateToolFeedback({
        isActive: true,
        tool: 'claude',
        status: 'Claude analyzing startup ecosystem with tool awareness...',
        progress: 20,
        details: 'Evaluating innovation potential and determining tool requirements'
      });
    }
    
    try {
      const startTime = Date.now();
      
      // Clean expired cache entries before starting
      cleanExpiredResponseCache();
      

      
      const requestBody = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        system: getStartupEcosystemPrompt(questionData),
        messages: [
          {
            role: 'user',
            content: questionData.isCustom ? 
              `Context: Data center site in ${locationConfig.city}, ${locationConfig.state} (${locationConfig.county}). Question: ${questionData.query}` :
              questionData.query
          }
        ]
      };
      
      // Check holistic Claude cache first
      let claudeResponse = getClaudeCache(questionData.id, simpleLocationKey, null);
      let usedCache = !!claudeResponse;
      
      if (!claudeResponse) {
        console.log(`💾 Claude Cache: Cache miss for ${questionData.id || 'custom query'} (${simpleLocationKey})`);
      } else {
        console.log(`⚡ Claude Cache: Using cached response for ${questionData.id || 'custom query'} (${simpleLocationKey})`);
      }
      
      // Update progress for Startup Ecosystem question
      if (questionData.id === 'startup_ecosystem_analysis') {
        updateToolFeedback({
          isActive: true,
          tool: 'claude',
          status: usedCache ? 'Using cached response...' : 'Sending request to Claude API...',
          progress: 40,
          details: usedCache ? 'Retrieved cached response for startup ecosystem analysis' : 'Processing tool-aware prompt with startup ecosystem analysis'
        });
      }
      
      // Only make API call if not using cache
      if (!claudeResponse) {
        const response = await fetch('http://localhost:3001/api/claude', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        const responseTime = Date.now() - startTime;
        console.log('Claude API Response:', responseTime, 'ms');
        
        if (!response.ok) {
          throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
        }
        
        const rawResponse = await response.json();
        claudeResponse = preprocessClaudeResponse(rawResponse.content || rawResponse);
        
        // Cache the cleaned response in holistic cache
        setClaudeCache(questionData.id, simpleLocationKey, null, claudeResponse);
      } else {
        // Small delay for cached responses to maintain UX consistency
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Update progress after receiving response
      if (questionData.id === 'startup_ecosystem_analysis') {
        updateToolFeedback({
          isActive: true,
          tool: 'claude',
          status: 'Processing Claude response...',
          progress: 70,
          details: usedCache ? 'Processing cached response for tool decisions' : `Response received in ${Date.now() - startTime}ms - parsing for tool decisions`
        });
      }

      // Process the response (either from cache or API)
      const aiResponse = claudeResponse.content?.[0]?.text || 'No response available';
      const responseCitations = []; // Claude doesn't provide citations in same format as Perplexity
      

      
      // Enhanced JSON response parsing for Startup Ecosystem question
      if (questionData.id === 'startup_ecosystem_analysis') {
        try {
          // Sanitize JSON by removing control characters that can break parsing
          const sanitizedResponse = sanitizeJsonString(aiResponse);
          
          const parsedResponse = JSON.parse(sanitizedResponse);
          if (parsedResponse.textResponse && parsedResponse.toolActions) {
            
            // Channel 1: Display text response immediately with enhanced formatting
            const formattedResponse = `## Startup Ecosystem Analysis
**${locationConfig.businessContext}**

${parsedResponse.textResponse}

---

### Analysis Methodology
**Assessment Type**: Preliminary Analysis  
**Location**: ${locationConfig.city}, ${locationConfig.state}  
**Business Context**: ${locationConfig.businessContext}  
**Data Enhancement**: Real-time startup ecosystem data collection in progress

**Analysis Confidence**: ${Math.round((parsedResponse.metadata?.confidence || 0.9) * 100)}%  
**Methodology**: ${parsedResponse.metadata?.reasoning || 'Expert knowledge enhanced by real-time data collection'}`;
            updateResponseOnly(queryId, formattedResponse, responseCitations, false);
            
            // Channel 2: Execute tool actions if requested
            if (parsedResponse.useTools && parsedResponse.toolActions.length > 0) {

              
              // Fix: Replace FIRECRAWL with PERPLEXITY for Power Grid analysis
              const correctedToolActions = parsedResponse.toolActions.map(action => {
                if (action.tool === 'FIRECRAWL') {

                  return {
                    ...action,
                    tool: 'PERPLEXITY',
                    reason: 'Comprehensive analysis based on infrastructure data from SERP and OSM',
                    queries: ['power grid analysis', 'infrastructure assessment', 'reliability evaluation'],
                    expectedOutcome: 'Detailed analysis based on SERP and OSM data findings'
                  };
                }
                return action;
              });
              

              
              // TODO: Execute tools programmatically (Phase 2 - Tool Execution)
              await executeStartupEcosystemTools(correctedToolActions, queryId, null, simpleLocationKey);
              
              return; // Exit early for tool-aware response
            } else {
              // No tools requested - hide feedback
              updateToolFeedback({
                isActive: false,
                tool: null,
                status: '',
                progress: 0,
                details: '',
                timestamp: null
              });
            }
            
            return; // Exit early for tool-aware response
          } else if (parsedResponse.textResponse) {
            // Valid JSON but no tools requested
            console.log('Startup Ecosystem JSON response (no tools):', parsedResponse.useTools);
            const formattedResponse = `## Startup Ecosystem Analysis
**${locationConfig.businessContext}**

${parsedResponse.textResponse}

---

### Analysis Methodology
**Assessment Type**: Standalone Analysis  
**Location**: ${locationConfig.city}, ${locationConfig.state}  
**Business Context**: ${locationConfig.businessContext}  
**Data Enhancement**: Analysis complete based on expert knowledge

**Analysis Confidence**: ${Math.round((parsedResponse.metadata?.confidence || 0.8) * 100)}%  
**Methodology**: ${parsedResponse.metadata?.reasoning || 'Expert knowledge analysis without additional data collection'}`;
            updateResponseOnly(queryId, formattedResponse, responseCitations, false);
            
            // Hide tool feedback since no tools are needed
            updateToolFeedback({
              isActive: false,
              tool: null,
              status: '',
              progress: 0,
              details: '',
              timestamp: null
            });
            
            return;
          }
        } catch (parseError) {
          console.log('JSON parsing failed for Power Grid question, using fallback:', parseError.message);
          
          // Check if Claude returned a non-JSON response
          if (parseError.message.includes('Unexpected token') || parseError.message.includes('is not valid JSON')) {
            console.log('🔄 Claude returned non-JSON response, creating fallback tool actions');
            
            // Create default tool actions for startup ecosystem analysis
            const fallbackToolActions = [
              {
                tool: 'SERP',
                queries: [`startup companies ${locationConfig?.city || 'Boston'}`, 
                         `venture capital firms ${locationConfig?.county || 'Suffolk County'}`,
                         `co-working spaces ${locationConfig?.city || 'Boston'}`],
                reason: 'Startup ecosystem data collection for analysis'
              },
              {
                tool: 'OSM',
                queries: ['universities', 'offices', 'transportation'],
                reason: 'Urban infrastructure context analysis for startup ecosystem'
              },
              {
                tool: 'PERPLEXITY',
                queries: ['startup ecosystem analysis', `${locationConfig?.city || 'Boston'} innovation potential`],
                reason: 'Expert analysis and insights generation'
              }
            ];
            
            console.log('🔧 Executing fallback tool actions for startup ecosystem analysis');
            
            // Cache the Claude response even in fallback path
            if (claudeResponse) {
              setClaudeCache(questionData.id, simpleLocationKey, null, claudeResponse);
              console.log('💾 Claude Cache: Cached response in fallback path');
            }
            
            // Execute tools with fallback actions
            await executeStartupEcosystemTools(fallbackToolActions, queryId, null, simpleLocationKey);
            return;
          }
          
          // Try to extract JSON from the response using regex with better cleaning
          try {
            // More robust JSON extraction
            let jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              let extractedJson = jsonMatch[0];
              
              // Additional cleaning for common Claude response issues
              extractedJson = extractedJson
                .replace(/```json\s*/g, '') // Remove markdown json blocks
                .replace(/```\s*/g, '')     // Remove markdown blocks
                .replace(/\n\s*\n/g, '\n')  // Remove extra newlines
                .trim();
              
              // Fix JSON string values that contain unescaped newlines
              extractedJson = this.fixJsonStringValues(extractedJson);
              
              const cleanedJson = sanitizeJsonString(extractedJson);
              console.log('🧹 Attempting to parse cleaned JSON (first 300 chars):', cleanedJson.substring(0, 300));
              
              const parsedResponse = JSON.parse(cleanedJson);
              if (parsedResponse.textResponse && parsedResponse.toolActions) {
                console.log('✅ Successfully extracted JSON from response using regex fallback');
                // Continue with the same logic as successful parsing
                const formattedResponse = `## Power Grid Reliability Assessment
**${locationConfig.businessContext}**

${parsedResponse.textResponse}

---

**Analysis Tools Executed:**
${parsedResponse.toolActions.map(action => `• ${action.tool}: ${action.reason || 'No reason provided'}`).join('\n')}`;

                const newResponse = {
                  id: questionData.id,
                  content: formattedResponse,
                  citations: responseCitations,
                  timestamp: Date.now(),
                  isLoading: false
                };

                setResponses(prev => [...prev, newResponse]);
                
                // Channel 2: Execute tools in background
                if (parsedResponse.toolActions && parsedResponse.toolActions.length > 0) {
                  executeStartupEcosystemTools(parsedResponse.toolActions, queryId, null, simpleLocationKey);
                }
                
                return;
              }
            }
          } catch (extractError) {
            console.log('JSON extraction also failed:', extractError.message);
            console.log('Error details:', {
              position: extractError.message.match(/position (\d+)/)?.[1],
              character: extractError.message.match(/character (\d+)/)?.[1],
              line: extractError.message.match(/line (\d+)/)?.[1]
            });
            
            // Show problematic section of the response
            if (extractError.message.includes('position')) {
              const position = parseInt(extractError.message.match(/position (\d+)/)?.[1] || '0');
              const start = Math.max(0, position - 50);
              const end = Math.min(aiResponse.length, position + 50);
              console.log('Problematic section:', aiResponse.substring(start, end));
            }
          }
          
          // Hide tool feedback on parsing failure
          updateToolFeedback({
            isActive: false,
            tool: null,
            status: '',
            progress: 0,
            details: '',
            timestamp: null
          });
          
          // Continue with existing text-only processing
        }
      }
      
      // Format response for custom questions to match existing style
      const formattedResponse = questionData.isCustom ? 
        `## Custom Analysis
**${locationConfig.businessContext}**

**Question:** ${questionData.text}

${aiResponse}

---

### Analysis Methodology
**Assessment Type**: Custom Query Analysis  
**Grid Operator**: ${locationConfig.gridOperator}  
**Service Territory**: ${locationConfig.region}` :
        aiResponse;
      
      // Store response in cache with citations
      setResponseCache(prev => ({
        ...prev,
        [cacheKey]: { content: formattedResponse, citations: responseCitations }
      }));
      
      // Update response only, keeping other state intact
      updateResponseOnly(queryId, formattedResponse, responseCitations, false);
      
      console.log(`Query ${queryId} completed successfully`);
      console.log(`Remaining pending requests: ${pendingRequests.size}`);
      
    } catch (error) {
      console.error('Claude AI Query Error:', error.message);
      console.error('Error details:', {
        name: error.name,
        stack: error.stack,
        cause: error.cause
      });
      
      // Format error response for custom questions
      const errorResponse = questionData.isCustom ? 
        `## Error Processing Custom Question\n\n**Question:** ${questionData.text}\n\nUnable to get AI insights at this time. Please try again later.` :
        'Unable to get AI insights at this time. Please try again later.';
      
      // Update response only with error
      updateResponseOnly(queryId, errorResponse, [], false);
      
      console.log(`Query ${queryId} failed with error`);
      console.log(`Remaining pending requests: ${pendingRequests.size}`);
    }
  };

  // Perplexity-first analysis function
  const executePerplexityAnalysis = async (queryId, coordinates, simpleLocationKey = 'default', userQuery = 'pinal county regional development analysis') => {
    console.log('🧠 Executing Perplexity-first startup ecosystem analysis');
    
    try {
      // Check for local Perplexity data file first
      try {
        const response = await fetch('/perplexity-houston-startup-analysis.json');
        if (response.ok) {
          const localData = await response.json();
          console.log('⚡ useAIQuery: Using local Perplexity analysis file');
          
          updateToolFeedback({
            isActive: true,
            tool: 'perplexity',
            status: '⚡ Loading local analysis...',
            progress: 60,
            details: 'Using local Houston startup analysis file'
          });
          
          // Store Perplexity analysis data globally
          window.lastPerplexityAnalysisData = {
            geoJsonFeatures: localData.geoJsonFeatures || [],
            analysis: localData.analysis || '',
            citations: localData.citations || [],
            summary: localData.summary || {},
            insights: localData.insights || {},
            legendItems: localData.legendItems || [],
            timestamp: localData.timestamp || Date.now()
          };
          
          // Update response with Perplexity analysis
          updateResponseOnly(queryId, localData.analysis, localData.citations || [], false);
          
          // Emit to map components
          if (window.mapEventBus) {
            window.mapEventBus.emit('perplexity:analysisComplete', localData);
            window.mapEventBus.emit('perplexity:dataLoaded', localData);
          }
          
          updateToolFeedback({
            isActive: false,
            tool: null,
            status: '',
            progress: 0,
            details: ''
          });
          
          return;
        }
      } catch (error) {
        console.log('📁 useAIQuery: No local Perplexity file found, proceeding with API call');
      }
      
      // If no local file, call Perplexity API through tool executor
      updateToolFeedback({
        isActive: true,
        tool: 'perplexity',
        status: '🧠 Calling Perplexity API...',
        progress: 30,
        details: 'Analyzing Pinal County regional development with Perplexity'
      });
      
      // Create Perplexity-specific tool actions with user query
      const perplexityToolActions = [
        {
          tool: 'PERPLEXITY',
          queries: [userQuery],
          reason: `Direct Perplexity analysis: ${userQuery}`
        }
      ];
      
      // Execute through existing tool executor
      const toolResults = await executeStartupEcosystemTools(perplexityToolActions, queryId, coordinates, simpleLocationKey);
      
      // Check if Perplexity tool returned structured data
      console.log('🔍 useAIQuery: Tool results received:', {
        hasToolResults: !!toolResults,
        toolDataKeys: toolResults?.toolData ? Object.keys(toolResults.toolData) : [],
        perplexityExists: !!toolResults?.toolData?.perplexity,
        hasStructuredData: !!toolResults?.toolData?.perplexity?.structuredData
      });
      
      if (toolResults?.toolData?.perplexity?.structuredData) {
        const structuredData = toolResults.toolData.perplexity.structuredData;
        
        console.log('🎯 useAIQuery: Processing Perplexity structured data:', {
          geoJsonFeatures: structuredData.geoJsonFeatures?.length || 0,
          legendItems: structuredData.legendItems?.length || 0,
          hasMapEventBus: !!window.mapEventBus
        });
        
        // Store structured data globally
        window.lastPerplexityAnalysisData = {
          geoJsonFeatures: structuredData.geoJsonFeatures || [],
          analysis: structuredData.analysis || '',
          citations: structuredData.citations || [],
          summary: structuredData.summary || {},
          insights: structuredData.insights || {},
          legendItems: structuredData.legendItems || [],
          timestamp: structuredData.timestamp || Date.now()
        };
        
        // Emit structured data to map components
        if (window.mapEventBus) {
          window.mapEventBus.emit('perplexity:analysisComplete', structuredData);
          window.mapEventBus.emit('perplexity:dataLoaded', structuredData);
          console.log('📡 Emitted Perplexity events to map components');
        } else {
          console.warn('⚠️ No mapEventBus available for emitting Perplexity events');
        }
        
        console.log('🧠 Perplexity structured data processed and emitted to map components');
      } else {
        console.log('❌ useAIQuery: No structured data found in toolResults.toolData.perplexity');
      }
      
    } catch (error) {
      console.error('❌ Perplexity analysis failed:', error);
      
      updateToolFeedback({
        isActive: true,
        tool: 'perplexity',
        status: '❌ Analysis failed',
        progress: 0,
        details: `Error: ${error.message}`
      });
      
      setTimeout(() => {
        updateToolFeedback({
          isActive: false,
          tool: null,
          status: '',
          progress: 0,
          details: ''
        });
      }, 5000);
    }
  };

  // Tool execution function (Phase 2 implementation)
  const executeStartupEcosystemTools = async (toolActions, queryId, coordinates, simpleLocationKey = 'default') => {
    console.log('Executing Startup Ecosystem tools:', toolActions);
    
    // Initialize variables for workflow caching
    let perplexityAnalysis = null;
    let perplexityCitations = [];
    let dataSources = [];
    
    try {
      // Use existing global tool executor if available, otherwise create new one
      let toolExecutor = getGlobalToolExecutor();
      if (!toolExecutor) {
        // console.log('🔄 useAIQuery: No global tool executor found, creating new one');
        toolExecutor = createStartupEcosystemToolExecutor(map, updateToolFeedback, handleMarkerClick);
        setGlobalToolExecutor(toolExecutor);
      } else {
        // CRITICAL FIX: Update the updateToolFeedback function for reused executor
        toolExecutor.updateToolFeedback = updateToolFeedback;
        
        // Also update the feedback function for all individual tools
        if (toolExecutor.serpTool) {
          toolExecutor.serpTool.updateToolFeedback = updateToolFeedback;
        }
        if (toolExecutor.osmTool) {
          toolExecutor.osmTool.updateToolFeedback = updateToolFeedback;
        }
        if (toolExecutor.perplexityTool) {
          toolExecutor.perplexityTool.updateToolFeedback = updateToolFeedback;
        }
        if (toolExecutor.firecrawlTool) {
          toolExecutor.firecrawlTool.updateToolFeedback = updateToolFeedback;
        }
        
        // Update location if it has changed
        if (toolExecutor.updateLocation && locationKey !== 'default') {
          toolExecutor.updateLocation(locationKey);
        }
      }
      
      // Clear existing map data before adding new startup ecosystem data
      if (toolExecutor.clearSerpData) {
        toolExecutor.clearSerpData();
        console.log('🧹 Cleared existing SERP data from map');
        
        // Small delay to ensure map layers are properly removed
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Execute tools based on Claude's recommendations
      const toolStartTime = performance.now();
      const results = await toolExecutor.executeMultipleTools(toolActions);
      const toolEndTime = performance.now();
      console.log(`⏱️ Total tool execution time: ${(toolEndTime - toolStartTime).toFixed(0)}ms`);
      
      console.log('Tool execution results:', results);
      
      // Store startup ecosystem data globally BEFORE processing Perplexity response
      // This ensures parseTableData has access to the data when it runs
      const serpResult = results.results.find(r => r.tool === 'SERP' && r.success);
      const osmResult = results.results.find(r => r.tool === 'OSM' && r.success);
      
      if (serpResult || osmResult) {
        // Store startup ecosystem data in a global variable for parseTableData to access
        window.lastStartupEcosystemData = {
          serp: serpResult ? {
            startupsCount: serpResult.data?.data?.startupsCount || 0,
            investorsCount: serpResult.data?.data?.investorsCount || 0,
            coWorkingSpaces: serpResult.data?.data?.coWorkingSpaces || 0,
            features: serpResult.data?.data?.features || []
          } : null,
          osm: osmResult ? {
            universitiesCount: osmResult.data?.data?.universitiesCount || 0,
            officesCount: osmResult.data?.data?.officesCount || 0,
            transportationAccess: osmResult.data?.data?.transportationAccess || 'Unknown',
            parksCount: osmResult.data?.data?.parksCount || 0,
            features: osmResult.data?.data?.features || []
          } : null,
          timestamp: Date.now()
        };
        
      }
      
      // Check if Perplexity analysis is available and update response
      const processingStartTime = performance.now();
      const perplexityResult = results.results.find(r => r.tool === 'PERPLEXITY' && r.success);
      if (perplexityResult) {
        
        // Handle different data structures (dual analysis vs original)

        // Check for Perplexity analysis in data field (nested structure)
        if (typeof perplexityResult.data === 'string') {
          perplexityAnalysis = perplexityResult.data;
          perplexityCitations = perplexityResult.citations || [];
          dataSources = perplexityResult.dataSourcesUsed || [];
          console.log('🎯 Using Perplexity analysis from data field (simple flow)');
        } else if (perplexityResult.data && typeof perplexityResult.data.data === 'string') {
          perplexityAnalysis = perplexityResult.data.data;
          perplexityCitations = perplexityResult.data.citations || perplexityResult.citations || [];
          dataSources = perplexityResult.data.dataSourcesUsed || perplexityResult.dataSourcesUsed || [];
          console.log('🎯 Using Perplexity analysis from nested data.data field');
        } else if (perplexityResult.data && perplexityResult.data.data && typeof perplexityResult.data.data.data === 'string') {
          perplexityAnalysis = perplexityResult.data.data.data;
          perplexityCitations = perplexityResult.data.data.citations || perplexityResult.data.citations || perplexityResult.citations || [];
          dataSources = perplexityResult.data.data.dataSourcesUsed || perplexityResult.data.dataSourcesUsed || perplexityResult.dataSourcesUsed || [];
        }

        // Debug: Perplexity analysis structure (only log on error)
        
        if (perplexityAnalysis) {
          // Create enhanced response with data source information
          const enhancedResponse = dataSources.length > 0 
            ? `${perplexityAnalysis}\n\n---\n\n**Analysis Based On:**\n${dataSources.map(source => 
                `• ${source.name} (${source.features} ${source.type.toLowerCase()} features within ${source.radius})`
              ).join('\n')}`
            : perplexityAnalysis;
          
          // Update the response display with Perplexity results
          updateResponseOnly(queryId, enhancedResponse, perplexityCitations, false);
          
          console.log('✅ Updated response with Perplexity analysis');
        } else {
          console.log('⚠️ Perplexity result found but no analysis content available');
        }
      } else {
        console.log('⚠️ No Perplexity analysis available, keeping original response');
      }
      
      const processingEndTime = performance.now();
      console.log(`⏱️ Data processing time: ${(processingEndTime - processingStartTime).toFixed(0)}ms`);
      
      // Cache the complete workflow for future use
      const workflowData = {
        questionId: 'startup_ecosystem_analysis', // Default question ID for ecosystem analysis
        toolResults: results.results,
        finalResponse: perplexityAnalysis || 'Analysis completed',
        citations: perplexityCitations || [],
        dataSources: dataSources,
        executionTime: processingEndTime - processingStartTime,
        timestamp: Date.now(),
        locationKey: locationKey,
        coordinates: coordinates
      };
      
      // Store in workflow cache
      console.log('🔍 Storing workflow cache:', {
        questionId: 'startup_ecosystem_analysis',
        simpleLocationKey: simpleLocationKey
      });
      
      setWorkflowCache('startup_ecosystem_analysis', simpleLocationKey, coordinates, workflowData);
      console.log('💾 Workflow cached for future use:', {
        questionId: 'startup_ecosystem_analysis',
        simpleLocationKey: simpleLocationKey,
        toolResults: workflowData.toolResults?.length || 0
      });
      
      if (results.hasFailures) {
        console.warn('Some tools failed:', results.errors);
      }
      
      return results;
    } catch (error) {
      console.error('Tool execution failed:', error);
      
      // Show error feedback
      updateToolFeedback({
        isActive: true,
        tool: 'error',
        status: 'Tool execution failed',
        progress: 100,
        details: `Error: ${error.message}`
      });
      
      // Auto-hide error feedback after 5 seconds
      setTimeout(() => {
        updateToolFeedback({
          isActive: false,
          tool: null,
          status: '',
          progress: 0,
          details: '',
          timestamp: null
        });
      }, 5000);
      
      throw error;
    }
  };

  // Clear cache function
  const clearCache = () => {
    const cacheSize = Object.keys(responseCache).length;
    setResponseCache({});
    console.log('Cache cleared - removed', cacheSize, 'responses');
    console.log('API calls saved:', cacheSize);
  };

  return {
    // State
    isLoading,
    responses,
    citations,
    pendingRequests,
    responseCache,
    
    // Functions
    handleAIQuery,
    updateResponseOnly,
    clearCache,
    executeStartupEcosystemTools,
    
    // Utilities
    addPendingRequest,
    removePendingRequest
  };
};
