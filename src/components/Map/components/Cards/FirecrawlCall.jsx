import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import { TypewriterPopupCard } from './TypewriterPopupCard';
import OGEPowerPulseAnimations from './OGEPowerPulseAnimations';

// Inject CSS for capacity badge pulse animation
if (typeof document !== 'undefined') {
  const styleId = 'capacity-badge-pulse-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes capacityBadgePulse {
        0%, 100% {
          background-color: rgba(255, 255, 255, 0.1);
        }
        50% {
          background-color: rgba(255, 234, 0, 0.4);
        }
      }
      .capacity-badge-pulsing {
        animation: capacityBadgePulse 1.5s ease-in-out infinite !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// Helper function to map marker color to popup theme
const getThemeFromMarkerColor = (color) => {
  const colorLower = (color || '').toLowerCase();
  if (colorLower === '#ef4444' || colorLower === '#dc2626') return 'red';
  if (colorLower === '#06b6d4' || colorLower === '#0891b2') return 'cyan';
  if (colorLower === '#f97316' || colorLower === '#ea580c') return 'orange';
  if (colorLower === '#10b981' || colorLower === '#059669') return 'green';
  if (colorLower === '#3b82f6' || colorLower === '#2563eb') return 'blue';
  if (colorLower === '#fbbf24') return 'yellow'; // Yellow for coal
  if (colorLower === '#f59e0b') return 'amber'; // Amber for solar
  return 'green'; // Default to green
};

const FirecrawlCall = ({ 
  onClick, 
  title = "Web Crawling with Firecrawl",
  color = "rgba(255, 165, 0, 0.8)", // Orange color for Firecrawl
  size = "10px",
  position = { top: '0px', left: '0px' },
  aiState = null,
  map = null,
  onLoadingChange = null,
  disabled = false,
  updateToolFeedback = null
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showOGELegend, setShowOGELegend] = useState(false);
  const [gasPowerMarkers, setGasPowerMarkers] = useState([]);
  const [coalPowerMarkers, setCoalPowerMarkers] = useState([]);
  const [windPowerMarkers, setWindPowerMarkers] = useState([]);
  const [solarPowerMarkers, setSolarPowerMarkers] = useState([]);

  /**
   * Load precomputed AEP Ohio transmission analysis results and broadcast them
   * through the global map event bus. This lets the legend / other components
   * react to Firecrawl-triggered planning insights without hitting any remote APIs.
   */
  const loadTransmissionAnalysis = useCallback(async () => {
    try {
      console.log('🛰️ Firecrawl: Loading AEP Ohio transmission analysis...', {
        ts: new Date().toISOString()
      });

      const [analysisRes, stalledRes] = await Promise.all([
        fetch('/data/aep_ohio_transmission_analysis.json', { cache: 'no-cache' }),
        fetch('/data/aep_ohio_stalled_projects.json', { cache: 'no-cache' }).catch(() => null)
      ]);

      if (!analysisRes.ok) {
        throw new Error(`Analysis HTTP ${analysisRes.status}`);
      }

      const analysis = await analysisRes.json();
      const stalled = stalledRes && stalledRes.ok ? await stalledRes.json() : null;

      const payload = {
        analysis,
        stalled,
        timestamp: Date.now()
      };

      console.log('✅ Firecrawl: Transmission analysis payload ready', {
        planned: analysis?.metadata?.planned_upgrades_count,
        proceeded: analysis?.status?.proceeded_count,
        stalled: analysis?.status?.stalled_count
      });

      if (typeof window !== 'undefined' && window.mapEventBus && typeof window.mapEventBus.emit === 'function') {
        window.mapEventBus.emit('aep-ohio:transmission-analysis', payload);
      }

      const status = analysis?.status || {};
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'firecrawl',
          status: 'AEP Ohio transmission analysis loaded',
          progress: 100,
          details: `Upgrades: ${analysis?.metadata?.planned_upgrades_count ?? '–'} • In service: ${status.proceeded_count ?? '–'} • Stalled: ${status.stalled_count ?? '–'}`
        });

        setTimeout(() => {
          updateToolFeedback({
            isActive: false,
            tool: null,
            status: '',
            progress: 0,
            details: ''
          });
        }, 4000);
      }
    } catch (error) {
      console.warn('⚠️ FirecrawlCall: Failed to load AEP Ohio transmission analysis', error);
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'firecrawl',
          status: 'Failed to load AEP Ohio transmission analysis',
          progress: 100,
          details: error?.message || 'Unknown error'
        });

        setTimeout(() => {
          updateToolFeedback({
            isActive: false,
            tool: null,
            status: '',
            progress: 0,
            details: ''
          });
        }, 4000);
      }
    }
  }, [updateToolFeedback]);

  // Archived: OG&E markers cleanup - Oklahoma-specific
  useEffect(() => {
    return () => {
      // Archived: OG&E marker cleanup removed
      /*
      if (window.okOGEPowerMarkers) {
        window.okOGEPowerMarkers.forEach(marker => marker.remove());
        window.okOGEPowerMarkers = [];
      }
      */
    };
  }, []);

  // Listen for Infrastructure Siting animation events to pulse capacity badges
  useEffect(() => {
    if (!window.mapEventBus) return;

    const handleAnimationStart = () => {
      // Find all capacity badges and add pulsing class
      const badges = document.querySelectorAll('.capacity-badge');
      badges.forEach(badge => {
        badge.classList.add('capacity-badge-pulsing');
      });
    };

    const handleAnimationStop = () => {
      // Find all capacity badges and remove pulsing class
      const badges = document.querySelectorAll('.capacity-badge');
      badges.forEach(badge => {
        badge.classList.remove('capacity-badge-pulsing');
      });
    };

    window.mapEventBus.on('infrastructure-siting:start', handleAnimationStart);
    window.mapEventBus.on('infrastructure-siting:stop', handleAnimationStop);

    return () => {
      if (window.mapEventBus) {
        window.mapEventBus.off('infrastructure-siting:start', handleAnimationStart);
        window.mapEventBus.off('infrastructure-siting:stop', handleAnimationStop);
      }
    };
  }, []);

  // Archived: OG&E power markers - Oklahoma-specific (Oklahoma Gas & Electric)
  // TODO: Implement AEP Ohio power markers if needed
  const addOGEPowerMarkers = useCallback(async () => {
    // Function disabled - Oklahoma-specific OG&E implementation removed
    if (!map?.current) return;
    console.log('⚠️ OG&E power markers disabled - Oklahoma-specific feature removed');
    return;
    
    // Archived code below - kept for reference
    /*
    if (!map?.current) return;

    // Remove existing markers if they exist
    if (window.okOGEPowerMarkers) {
      window.okOGEPowerMarkers.forEach(marker => marker.remove());
      window.okOGEPowerMarkers = [];
    }

    // Reset marker state arrays
    setGasPowerMarkers([]);
    setCoalPowerMarkers([]);
    setWindPowerMarkers([]);
    setSolarPowerMarkers([]);

    // Clean up gas, coal, wind, and solar power pulse animations
    ['oge-gasPowerPulseAnimations', 'oge-coalPowerPulseAnimations', 'oge-windPowerPulseAnimations', 'oge-solarPowerPulseAnimations'].forEach(animationKey => {
      if (window[animationKey]) {
        window[animationKey].forEach(frame => {
          if (frame) cancelAnimationFrame(frame);
        });
        window[animationKey] = [];
      }
    });
    
    // Remove all OG&E power pulse layers and sources
    if (map.current) {
      ['oge-gas', 'oge-coal', 'oge-wind', 'oge-solar'].forEach(markerType => {
        let index = 0;
        while (true) {
          const sourceId = `${markerType}-power-pulse-${index}`;
          const layerId = `${markerType}-power-pulse-layer-${index}`;
          
          if (map.current.getLayer(layerId)) {
            map.current.removeLayer(layerId);
          }
          if (map.current.getSource(sourceId)) {
            map.current.removeSource(sourceId);
          } else {
            break; // No more sources to remove
          }
          index++;
        }
      });
    }

    try {
      // Load OG&E capacity data
      const response = await fetch('/data/oge/firecrawl_capacity_data.json', { cache: 'no-cache' });
      if (!response.ok) {
        console.warn('⚠️ Failed to load OG&E capacity data:', response.status);
        return;
      }

      const data = await response.json();
      const generatingUnits = data.generating_units || [];

      if (generatingUnits.length === 0) {
        console.warn('⚠️ No OG&E generating units found in data');
        return;
      }

      // Color mapping based on fuel type (same as GRDA)
      const getFuelColor = (fuel) => {
        const fuelLower = (fuel || '').toLowerCase();
        if (fuelLower === 'hydro') return '#06b6d4'; // Cyan for hydroelectric
        if (fuelLower === 'wind') return '#10b981'; // Green for wind
        if (fuelLower === 'gas') return '#f97316'; // Orange for gas
        if (fuelLower === 'coal') return '#fbbf24'; // Yellow for coal
        if (fuelLower === 'solar') return '#f59e0b'; // Amber for solar
        return '#3b82f6'; // Default blue
      };

      // Calculate capacity range for opacity normalization
      const capacities = generatingUnits
        .map(unit => unit.net_MW || 0)
        .filter(cap => cap > 0);
      const minCapacity = capacities.length > 0 ? Math.min(...capacities) : 0;
      const maxCapacity = capacities.length > 0 ? Math.max(...capacities) : 1;
      const capacityRange = maxCapacity - minCapacity || 1; // Avoid division by zero

      // Helper function to calculate opacity based on capacity
      // Maps capacity to opacity range: 0.4 (min) to 1.0 (max)
      const getOpacityFromCapacity = (capacity) => {
        if (!capacity || capacity === 0) return 0.4;
        const normalized = (capacity - minCapacity) / capacityRange;
        return 0.4 + (normalized * 0.6); // 0.4 to 1.0
      };

      const markers = [];
      const gasMarkers = []; // Store gas power markers for pulse animation
      const coalMarkers = []; // Store coal power markers for pulse animation
      const windMarkers = []; // Store wind power markers for pulse animation
      const solarMarkers = []; // Store solar power markers for pulse animation
      
      generatingUnits.forEach(unit => {
        if (!unit.latitude || !unit.longitude) return;

        // Get color based on fuel type
        const markerColor = getFuelColor(unit.fuel);
        const fuelLower = (unit.fuel || '').toLowerCase();
        const isGasMarker = fuelLower === 'gas';
        const isCoalMarker = fuelLower === 'coal';
        const isWindMarker = fuelLower === 'wind';
        const isSolarMarker = fuelLower === 'solar';

        // Create popup container
        const popupContainer = document.createElement('div');
        
        // Create typewriter popup content with data section for toggle
        const typewriterContent = {
          description: `**${unit.name}** — ${unit.type} power generation facility operated by Oklahoma Gas & Electric (OG&E).`,
          data: {
            'Fuel Type': unit.fuel || 'N/A',
            'Capacity': `${unit.net_MW || 0} MW`,
            'Type': unit.type || 'N/A',
            'Coordinates': `${unit.latitude?.toFixed(4) || 'N/A'}, ${unit.longitude?.toFixed(4) || 'N/A'}`
          }
        };
        
        // Icon components for power types (same as GRDA)
        const PowerTypeIcon = ({ type, color }) => {
          const marginTop = type === 'hydro' ? '0px' : '-1px'; // Moved up 5px from original (3px/4px)
          
          const iconStyle = {
            width: '14px',
            height: '14px',
            display: 'inline-block',
            marginTop: marginTop,
            verticalAlign: 'middle',
            flexShrink: 0
          };
          
          if (type === 'wind') {
            return (
              <span style={iconStyle} className="power-icon-wind">
                <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 10 Q6 8 8 10" />
                  <path d="M2 14 Q5 12 7 14" />
                  <path d="M2 18 Q4 16 6 18" />
                  <path d="M8 10 Q12 8 14 10" />
                  <path d="M7 14 Q10 12 12 14" />
                  <path d="M6 18 Q8 16 10 18" />
                  <path d="M14 10 Q18 8 20 10" />
                  <path d="M12 14 Q15 12 17 14" />
                  <path d="M10 18 Q12 16 14 18" />
                </svg>
              </span>
            );
          } else if (type === 'hydro') {
            return (
              <span style={iconStyle} className="power-icon-hydro">
                <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2C9 2 7 4 7 7c0 4 5 10 5 10s5-6 5-10c0-3-2-5-5-5z" fill={color} fillOpacity="0.4" />
                  <path d="M12 2C9 2 7 4 7 7c0 4 5 10 5 10s5-6 5-10c0-3-2-5-5-5z" stroke={color} />
                </svg>
              </span>
            );
          } else if (type === 'gas') {
            return (
              <span style={iconStyle} className="power-icon-gas">
                <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </span>
            );
          } else if (type === 'coal') {
            return (
              <span style={iconStyle} className="power-icon-coal">
                <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 9h6M9 15h6M9 12h6" />
                </svg>
              </span>
            );
          } else if (type === 'solar') {
            return (
              <span style={iconStyle} className="power-icon-solar">
                <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v6M12 17v6M23 12h-6M7 12H1M19.07 4.93l-4.24 4.24M9.17 14.83l-4.24 4.24M19.07 19.07l-4.24-4.24M9.17 9.17l-4.24-4.24" />
                </svg>
              </span>
            );
          }
          return null;
        };
        
        // Create header with Capacity indicator (clickable to trigger animation)
        const header = (
          <div>
            <div style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#f9fafb',
              marginBottom: '4px'
            }}>
              {unit.name}
            </div>
            <div style={{
              fontSize: '11px',
              fontWeight: '500',
              color: '#9ca3af',
              marginBottom: '6px'
            }}>
              OG&E Power Generation Facility
            </div>
            <div
              className="capacity-badge"
              onClick={(e) => {
                e.stopPropagation();
                // Emit event to trigger Infrastructure Siting animation
                if (typeof window !== 'undefined' && window.mapEventBus) {
                  window.mapEventBus.emit('infrastructure-siting:play');
                }
                // Change background color on click
                const badge = e.currentTarget;
                const originalBg = badge.style.backgroundColor;
                badge.style.backgroundColor = 'rgba(255, 140, 0, 0.3)';
                setTimeout(() => {
                  badge.style.backgroundColor = originalBg;
                }, 300);
              }}
              style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#f9fafb',
              padding: '4px 16px', // Equal padding on both sides for centered text
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center', // Center text horizontally
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                minWidth: '120px', // Ensure minimum width for better balance
                textAlign: 'center' // Center text content
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.classList.contains('capacity-badge-pulsing')) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.classList.contains('capacity-badge-pulsing')) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }
              }}
              title="Click to play Infrastructure Siting Animation"
            >
              Capacity: {unit.net_MW || 0} MW
            </div>
          </div>
        );
        
        // Render TypewriterPopupCard into container with theme matching marker color
        const popupTheme = getThemeFromMarkerColor(markerColor);
        const root = createRoot(popupContainer);
        root.render(
          <TypewriterPopupCard
            content={typewriterContent}
            theme={popupTheme}
            header={header}
            shouldStart={true}
            enableTypewriter={true}
            showDescription={false} // Hide description for OG&E markers
          />
        );
        
        // Create marker with custom TypewriterPopupCard popup
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'okc-campus-popup-transparent',
          anchor: 'bottom',
          offset: [0, -35] // Moved up 50px from original 15px offset
        }).setDOMContent(popupContainer);
        
        // Calculate opacity based on capacity
        const capacityMW = unit.net_MW || 0;
        const markerOpacity = getOpacityFromCapacity(capacityMW);

        // Create marker with color based on fuel type
        const marker = new mapboxgl.Marker({
          color: markerColor,
          scale: 1.2
        })
        .setLngLat([unit.longitude, unit.latitude])
        .setPopup(popup)
        .addTo(map.current);
        
        // Apply opacity to marker element
        const markerElement = marker.getElement();
        if (markerElement) {
          markerElement.style.opacity = markerOpacity.toString();
          // Store fuel type as data attribute for legend toggling
          markerElement.setAttribute('data-fuel-type', fuelLower);
          markerElement.setAttribute('data-utility', 'oge');
        }
        
        markers.push(marker);
        
        // Store gas, coal, wind, and solar markers for pulse animation (with capacity)
        if (isGasMarker) {
          gasMarkers.push({
            lng: unit.longitude,
            lat: unit.latitude,
            name: unit.name,
            capacity: capacityMW
          });
        }
        if (isCoalMarker) {
          coalMarkers.push({
            lng: unit.longitude,
            lat: unit.latitude,
            name: unit.name,
            capacity: capacityMW
          });
        }
        if (isWindMarker) {
          windMarkers.push({
            lng: unit.longitude,
            lat: unit.latitude,
            name: unit.name,
            capacity: capacityMW
          });
        }
        if (isSolarMarker) {
          solarMarkers.push({
            lng: unit.longitude,
            lat: unit.latitude,
            name: unit.name,
            capacity: capacityMW
          });
        }
      });

      window.okOGEPowerMarkers = markers;
      setShowOGELegend(markers.length > 0);
      console.log(`✅ Added ${markers.length} colored teardrop markers for OG&E power generation facilities`);
      
      // Store markers for the pulse animation component
      setGasPowerMarkers(gasMarkers);
      setCoalPowerMarkers(coalMarkers);
      setWindPowerMarkers(windMarkers);
      setSolarPowerMarkers(solarMarkers);
      
      // Update tool feedback
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'firecrawl',
          status: `✅ Loaded ${markers.length} OG&E power facilities`,
          progress: 100,
          details: `${markers.length} generating units displayed`
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
      console.warn('⚠️ Error loading OG&E power markers:', error);
      setShowOGELegend(false);
      
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'firecrawl',
          status: '⚠️ Failed to load OG&E markers',
          progress: 0,
          details: error.message
        });
      }
    }
    */
  }, [map, updateToolFeedback]);

  // Archived: Stillwater to OG&E routes - Oklahoma-specific
  // TODO: Implement AEP Ohio route layers if needed
  const addStillwaterToOGERoutes = useCallback(async () => {
    // Function disabled - Oklahoma-specific route implementation removed
    if (!map?.current) return;
    console.log('⚠️ Stillwater to OG&E routes disabled - Oklahoma-specific feature removed');
    return;
    
    // Archived code below - kept for reference
    /*
    if (!map?.current) return;

    const SOURCE_ID = 'stillwater-oge-route-source';
    const LAYER_ID = 'stillwater-oge-route-layer';
    const PARTICLE_SOURCE_ID = 'stillwater-oge-route-particles';
    const PARTICLE_LAYER_ID = 'stillwater-oge-route-particles-layer';

    // Check if Stillwater marker exists
    const hasStillwaterMarker = window.okCampusTeardropMarkers && 
      window.okCampusTeardropMarkers.some(marker => {
        const element = marker.getElement();
        if (!element) return false;
        const campusName = element.getAttribute('data-campus-name');
        return campusName === 'Stillwater';
      });

    if (!hasStillwaterMarker) {
      console.log('⚠️ Stillwater marker not found, skipping OG&E routes');
      return;
    }

    // Route segment files - only include files that were actually generated
    // Note: Horseshoe Lake, Wind Farms, and Solar Farms share coordinates with Riverside,
    // so they use the same route file
    const potentialRouteFiles = [
      '/data/okc_campuses/stillwater_to_mustang_power_plant.geojson',
      '/data/okc_campuses/stillwater_to_seminole_power_plant.geojson',
      '/data/okc_campuses/stillwater_to_sooner_power_plant.geojson',
      '/data/okc_campuses/stillwater_to_frontier_power_plant.geojson',
      '/data/okc_campuses/stillwater_to_riverside_power_plant.geojson', // Also serves Horseshoe Lake, Wind Farms, Solar Farms
      '/data/okc_campuses/stillwater_to_chouteau_power_plant.geojson',
      '/data/okc_campuses/stillwater_to_muskogee_power_plant.geojson',
    ];

    try {
      // Load all route files (only those that exist)
      const collections = await Promise.all(
        potentialRouteFiles.map(async path => {
          try {
            const res = await fetch(path, { cache: 'no-cache' });
            if (!res.ok) {
              // Silently skip missing files (404s are expected for some facilities)
              return { features: [] };
            }
            // Check if response is actually JSON or GeoJSON (not HTML error page)
            const contentType = res.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json') || 
                          contentType.includes('application/geo+json') ||
                          contentType.includes('text/json') ||
                          contentType.includes('json');
            if (!isJson) {
              console.warn(`⚠️ Skipping ${path}: not JSON (${contentType})`);
              return { features: [] };
            }
            const data = await res.json();
            return data;
          } catch (err) {
            // Silently skip files that fail to load
            return { features: [] };
          }
        })
      );

      // Merge all features
      const allFeatures = collections.flatMap(c => c.features || []);
      
      if (allFeatures.length === 0) {
        console.log('⚠️ No Stillwater to OG&E route files found');
        return;
      }

      const multi = {
        type: 'FeatureCollection',
        features: allFeatures
      };

      // Add or update source
      if (!map.current.getSource(SOURCE_ID)) {
        map.current.addSource(SOURCE_ID, { type: 'geojson', data: multi });
      } else {
        map.current.getSource(SOURCE_ID).setData(multi);
      }

      // Add route layer if it doesn't exist
      if (!map.current.getLayer(LAYER_ID)) {
        map.current.addLayer({
          id: LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
            visibility: 'visible', // Visible by default when OG&E markers are shown
          },
          paint: {
            'line-width': 1.5,
            'line-opacity': 0.6,
            'line-color': '#f97316', // Orange to match OG&E gas power theme
          },
        });
      }

      // Setup particle source and layer
      if (!map.current.getSource(PARTICLE_SOURCE_ID)) {
        map.current.addSource(PARTICLE_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      if (!map.current.getLayer(PARTICLE_LAYER_ID)) {
        map.current.addLayer({
          id: PARTICLE_LAYER_ID,
          type: 'circle',
          source: PARTICLE_SOURCE_ID,
          layout: {
            visibility: 'visible', // Visible by default
          },
          paint: {
            'circle-radius': 3,
            'circle-color': '#fb923c', // Light orange particles
            'circle-opacity': 0.9,
            'circle-blur': 0.3,
          },
        });
      }

      // Emit event that layers are ready
      if (typeof window !== 'undefined' && window.mapEventBus) {
        window.mapEventBus.emit('stillwater-oge-route:ready', true);
      }

      console.log(`✅ Loaded ${allFeatures.length} Stillwater to OG&E routes`);
    } catch (error) {
      console.warn('⚠️ Failed to load Stillwater to OG&E route layers:', error);
    }
    */
  }, [map]);

  // Function to perform web crawling with Firecrawl
  const performWebCrawling = async (lat, lng, marker) => {
    try {
      console.log('🕷️ Starting web crawling with Firecrawl...');
      
      if (updateToolFeedback) {
        updateToolFeedback('firecrawl', 'Starting web crawl...', 0);
      }

      // Simulate web crawling process
      const crawlResponse = {
        success: true,
        data: {
          urls: [
            'https://www.ercot.com/gridmgt/real-time',
            'https://www.txdot.gov/inside-txdot/division/transportation-planning/planning-studies.html',
            'https://www.bosquecountytexas.org/planning-zoning'
          ],
          extractedData: {
            ercotGridStatus: 'Normal operations',
            transmissionCapacity: 'Adequate for current load',
            planningUpdates: 'Recent zoning changes in Bosque County',
            infrastructureProjects: 'I-35 expansion project in planning phase'
          },
          metadata: {
            crawlTime: new Date().toISOString(),
            pagesProcessed: 15,
            dataPoints: 47
          }
        }
      };

      // Update tool feedback
      if (updateToolFeedback) {
        updateToolFeedback('firecrawl', 'Web crawl completed successfully', 100);
      }

      // Call the onClick callback with the response
      if (onClick) {
        onClick(crawlResponse);
      }

      console.log('✅ Firecrawl web crawling completed:', crawlResponse);

    } catch (error) {
      console.error('❌ Firecrawl web crawling error:', error);
      
      if (updateToolFeedback) {
        updateToolFeedback('firecrawl', 'Web crawl failed', 0);
      }

      // Return error response
      if (onClick) {
        onClick({
          success: false,
          error: error.message,
          data: null
        });
      }
    }
  };

  const handleClick = () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    if (onLoadingChange) {
      onLoadingChange(true);
    }

    // Always mount the latest AEP Ohio transmission analysis when Firecrawl runs.
    // This is local JSON only – no additional API credits are consumed.
    loadTransmissionAnalysis();

    // Get current map center if available
    let lat = 31.9686; // Default to Texas center
    let lng = -99.9018;
    
    if (map && map.current) {
      const center = map.current.getCenter();
      lat = center.lat;
      lng = center.lng;
    }

    // Archived: OG&E power markers and routes - Oklahoma-specific
    // TODO: Add AEP Ohio power markers and routes if needed
    // Previous code loaded OG&E markers and Stillwater-to-OG&E routes
    // These features are disabled for Columbus/AEP Ohio migration

    // Perform the web crawling
    performWebCrawling(lat, lng).finally(() => {
      setIsLoading(false);
      if (onLoadingChange) {
        onLoadingChange(false);
      }
    });
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        border: `1px solid ${color.replace('0.8', '0.6')}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(255, 165, 0, 0.3)',
        padding: '8px',
        opacity: disabled ? 0.5 : 1,
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
        pointerEvents: 'auto'
      }}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={title}
    >
      {/* Loading spinner */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '8px',
          height: '8px',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderTop: '2px solid rgba(255, 255, 255, 0.8)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      )}

      {/* Firecrawl icon (spider web) */}
      {!isLoading && (
        <div style={{
          width: '6px',
          height: '6px',
          background: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '50%',
          position: 'relative'
        }}>
          {/* Web lines radiating from center */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '1px',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.6)',
            transform: 'translate(-50%, -50%) rotate(0deg)'
          }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '1px',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.6)',
            transform: 'translate(-50%, -50%) rotate(45deg)'
          }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '1px',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.6)',
            transform: 'translate(-50%, -50%) rotate(90deg)'
          }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '1px',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.6)',
            transform: 'translate(-50%, -50%) rotate(135deg)'
          }} />
        </div>
      )}

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>

      {/* OG&E Power Pulse Animations */}
      {map?.current && (gasPowerMarkers.length > 0 || coalPowerMarkers.length > 0 || windPowerMarkers.length > 0 || solarPowerMarkers.length > 0) && (
        <OGEPowerPulseAnimations
          map={map}
          gasMarkers={gasPowerMarkers}
          coalMarkers={coalPowerMarkers}
          windMarkers={windPowerMarkers}
          solarMarkers={solarPowerMarkers}
        />
      )}
    </div>
  );
};

export default FirecrawlCall;
