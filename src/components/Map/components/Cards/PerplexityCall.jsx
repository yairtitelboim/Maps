import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
// Gentrification utilities removed - Houston/EADO specific, not needed for Oklahoma
// import { addGentrificationClickHandler, addGentrificationHoverEffects } from '../../../../utils/gentrificationPopupUtils';
// import { addGentrificationDataSource, addGentrificationStyles, addPulseSource, addPulseMarkersLayer, addStaticCircleMarkersLayer, cleanupGentrificationLayers } from '../../../../utils/gentrificationMapUtils';
// import { addParticlesLayer, startParticleAnimation } from '../../../../utils/gentrificationParticleUtils';
// import { startGentrificationPulseAnimation } from '../../../../utils/gentrificationPulseUtils';
import { TypewriterPopupCard } from './TypewriterPopupCard';
import GasHydroPowerPulseAnimations from './GasHydroPowerPulseAnimations';

// Helper function to map marker color to popup theme
const getThemeFromMarkerColor = (color) => {
  const colorLower = (color || '').toLowerCase();
  if (colorLower === '#ef4444' || colorLower === '#dc2626') return 'red';
  if (colorLower === '#06b6d4' || colorLower === '#0891b2') return 'cyan';
  if (colorLower === '#f97316' || colorLower === '#ea580c') return 'orange';
  if (colorLower === '#10b981' || colorLower === '#059669') return 'green';
  if (colorLower === '#3b82f6' || colorLower === '#2563eb') return 'blue';
  return 'green'; // Default to green
};

const PerplexityCall = ({ 
  onClick, 
  title = "Perplexity AI Analysis",
  color = "rgba(0, 0, 0, 0.8)", // Black color for Perplexity
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
  // Gentrification functionality removed - Houston/EADO specific
  const [isGentrificationLoaded, setIsGentrificationLoaded] = useState(false);
  
  // State for GRDA pulse animations
  const [gasPowerMarkers, setGasPowerMarkers] = useState([]);
  const [hydroPowerMarkers, setHydroPowerMarkers] = useState([]);
  const [windPowerMarkers, setWindPowerMarkers] = useState([]);

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

  // Gentrification analysis removed - Houston/EADO specific, not needed for Oklahoma
  const loadGentrificationAnalysis = async () => {
    console.warn('⚠️ Gentrification analysis is not available for Oklahoma locations');
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
        status: '⚠️ Feature not available',
          progress: 0,
        details: 'Gentrification analysis is specific to Houston/EADO and not available for Oklahoma'
        });
        setTimeout(() => {
          updateToolFeedback({
            isActive: false,
            tool: null,
            status: '',
            progress: 0,
            details: ''
          });
      }, 3000);
    }
  };

  // Tear-drop markers removed - gentrification specific
  const addTearDropMarkers = (map, gentrificationData) => {
    console.warn('⚠️ Tear-drop markers not available for Oklahoma');
    try {
      console.log('💧 Adding tear-drop markers for gentrification risk points...');
      
      // Remove any existing tear-drop markers
      if (map.current.getLayer('gentrification-teardrop-markers')) {
        map.current.removeLayer('gentrification-teardrop-markers');
      }
      if (map.current.getSource('gentrification-teardrop-markers')) {
        map.current.removeSource('gentrification-teardrop-markers');
      }

      // Create tear-drop markers for each gentrification risk point
      const teardropFeatures = gentrificationData.features.map(feature => {
        const riskLevel = feature.properties.gentrification_risk || 0;
        const neighborhood = feature.properties.neighborhood_name || 'default';
        
        // Use the same color scheme as pulse markers with proper color names
        let riskColor, colorName, riskSize;
        if (riskLevel >= 0.85) {
          riskColor = '#dc2626'; // Red for critical risk
          colorName = 'red';
          riskSize = 'large';
        } else if (riskLevel >= 0.8) {
          riskColor = '#ea580c'; // Orange for high risk
          colorName = 'orange';
          riskSize = 'medium';
        } else if (riskLevel >= 0.6) {
          riskColor = '#f59e0b'; // Yellow for medium risk
          colorName = 'yellow';
          riskSize = 'medium';
        } else {
          riskColor = '#6b7280'; // Gray for low risk
          colorName = 'gray';
          riskSize = 'small';
        }
        
        return {
          type: 'Feature',
          geometry: feature.geometry,
          properties: {
            ...feature.properties,
            teardrop_color: riskColor,
            teardrop_colorName: colorName,
            teardrop_size: riskSize,
            risk_level: riskLevel,
            icon: `teardrop-${colorName}`
          }
        };
      });

      // Add teardrop markers using Mapbox's built-in marker system (same as OSMCall.jsx)
      const teardropMarkers = [];
      
      teardropFeatures.forEach(feature => {
        const riskLevel = feature.properties.risk_level;
        const neighborhood = feature.properties.neighborhood;
        
        // Determine color and size based on risk level (same as OSMCall.jsx approach)
        let markerColor, markerSize;
        if (riskLevel >= 0.85) {
          markerColor = '#dc2626'; // Red for critical risk
          markerSize = 1.5;
        } else if (riskLevel >= 0.8) {
          markerColor = '#ea580c'; // Orange for high risk
          markerSize = 1.2;
        } else if (riskLevel >= 0.6) {
          markerColor = '#f59e0b'; // Yellow for medium risk
          markerSize = 1.0;
        } else {
          markerColor = '#6b7280'; // Gray for low risk
          markerSize = 0.8;
        }
        
        // Create Mapbox marker (same as OSMCall.jsx)
        const marker = new mapboxgl.Marker({
          color: markerColor,
          scale: markerSize
        })
        .setLngLat(feature.geometry.coordinates)
        .setPopup(new mapboxgl.Popup().setHTML(`
          <div style="padding: 8px; font-family: Inter, sans-serif;">
            <h4 style="margin: 0 0 8px 0; color: #1f2937;">🏠 Gentrification Risk</h4>
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
              ${neighborhood || 'Unknown Area'}
            </p>
            <hr style="margin: 8px 0; border: 1px solid #e5e7eb;">
            <p style="margin: 0; color: ${markerColor}; font-size: 11px; font-weight: 600;">
              Risk Level: ${(riskLevel * 100).toFixed(1)}%
            </p>
            <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 10px;">
              ${riskLevel >= 0.85 ? 'Critical Risk' : 
                riskLevel >= 0.8 ? 'High Risk' : 
                riskLevel >= 0.6 ? 'Medium Risk' : 'Low Risk'}
            </p>
          </div>
        `))
        .addTo(map.current);
        
        teardropMarkers.push(marker);
      });

      // Store markers for cleanup (same as OSMCall.jsx approach)
      window.gentrificationTeardropMarkers = teardropMarkers;

      console.log('✅ Tear-drop markers added:', teardropFeatures.length);
      
    } catch (error) {
      console.error('❌ Error adding tear-drop markers:', error);
    }
  };

  // Gentrification data processing removed - Houston/EADO specific
  const processGentrificationData = async (gentrificationData) => {
    console.warn('⚠️ Gentrification processing not available for Oklahoma');
  };

  // Gentrification cleanup removed - Houston/EADO specific
  const cleanupGentrification = () => {
    console.warn('⚠️ Gentrification cleanup not available for Oklahoma');
      setIsGentrificationLoaded(false);
  };

  // Archived: GRDA power markers - Oklahoma-specific (Grand River Dam Authority)
  // TODO: Implement AEP Ohio power markers if needed
  const addGRDAPowerMarkers = useCallback(async () => {
    // Function disabled - Oklahoma-specific GRDA implementation removed
    if (!map?.current) return;
    console.log('⚠️ GRDA power markers disabled - Oklahoma-specific feature removed');
    return;
    
    // Archived code below - kept for reference
    /*
    if (!map?.current) return;

    // Remove existing markers if they exist
    if (window.okGRDAPowerMarkers) {
      window.okGRDAPowerMarkers.forEach(marker => marker.remove());
      window.okGRDAPowerMarkers = [];
    }

    try {
      // Load GRDA capacity data
      const response = await fetch('/data/grda/firecrawl_capacity_data.json', { cache: 'no-cache' });
      if (!response.ok) {
        console.warn('⚠️ Failed to load GRDA capacity data:', response.status);
        return;
      }

      const data = await response.json();
      const generatingUnits = data.generating_units || [];

      if (generatingUnits.length === 0) {
        console.warn('⚠️ No GRDA generating units found in data');
        return;
      }

      // Color mapping based on fuel type
      const getFuelColor = (fuel) => {
        const fuelLower = (fuel || '').toLowerCase();
        if (fuelLower === 'hydro') return '#06b6d4'; // Cyan for hydroelectric
        if (fuelLower === 'wind') return '#10b981'; // Green for wind
        if (fuelLower === 'gas') return '#f97316'; // Orange for gas
        return '#3b82f6'; // Default blue
      };

      // Calculate capacity range for opacity normalization
      const capacities = generatingUnits
        .map(unit => unit.net_MW || 0)
        .filter(cap => cap > 0);
      const minCapacity = capacities.length > 0 ? Math.min(...capacities) : 0;
      const maxCapacity = capacities.length > 0 ? Math.max(...capacities) : 1;
      const capacityRange = maxCapacity - minCapacity || 1;

      const getOpacityFromCapacity = (capacity) => {
        if (!capacity || capacity === 0) return 0.4;
        const normalized = (capacity - minCapacity) / capacityRange;
        return 0.4 + (normalized * 0.6);
      };

      const markers = [];
      const gasMarkers = []; // Store gas power markers for pulse animation
      const hydroMarkers = []; // Store hydro power markers for pulse animation
      const windMarkers = []; // Store wind power markers for pulse animation
      
      generatingUnits.forEach(unit => {
        if (!unit.latitude || !unit.longitude) return;

        const markerColor = getFuelColor(unit.fuel);
        const fuelLower = (unit.fuel || '').toLowerCase();
        const isGasMarker = fuelLower === 'gas';
        const isHydroMarker = fuelLower === 'hydro';
        const isWindMarker = fuelLower === 'wind';

        // Create popup container
        const popupContainer = document.createElement('div');
        
          const typewriterContent = {
            description: `**${unit.name}** — ${unit.type} power generation facility operated by Grand River Dam Authority (GRDA).`,
            data: {
              'Fuel Type': unit.fuel || 'N/A',
              'Capacity': `${unit.net_MW || 0} MW`,
              'Type': unit.type || 'N/A',
              'Coordinates': `${unit.latitude?.toFixed(4) || 'N/A'}, ${unit.longitude?.toFixed(4) || 'N/A'}`
            }
          };
        
        // Icon components for power types
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
          }
          return null;
        };
        
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
              GRDA Power Generation Facility
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
        
        const popupTheme = getThemeFromMarkerColor(markerColor);
        const root = createRoot(popupContainer);
        root.render(
          <TypewriterPopupCard
            content={typewriterContent}
            theme={popupTheme}
            header={header}
            shouldStart={true}
            enableTypewriter={true}
            showDescription={false} // Hide description for GRDA markers
          />
        );
        
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'okc-campus-popup-transparent',
          anchor: 'bottom',
          offset: [0, -35] // Moved up 50px from original 15px offset
        }).setDOMContent(popupContainer);
        
        const capacityMW = unit.net_MW || 0;
        const markerOpacity = getOpacityFromCapacity(capacityMW);

        const marker = new mapboxgl.Marker({
          color: markerColor,
          scale: 1.2
        })
        .setLngLat([unit.longitude, unit.latitude])
        .setPopup(popup)
        .addTo(map.current);
        
        const markerElement = marker.getElement();
        if (markerElement) {
          markerElement.style.opacity = markerOpacity.toString();
          markerElement.setAttribute('data-fuel-type', fuelLower);
          markerElement.setAttribute('data-utility', 'grda');
        }
        
        markers.push(marker);
        
        // Store gas, hydro, and wind markers for pulse animation (with capacity)
        // capacityMW is already declared above
        if (isGasMarker) {
          gasMarkers.push({
            lng: unit.longitude,
            lat: unit.latitude,
            name: unit.name,
            capacity: capacityMW
          });
        }
        if (isHydroMarker) {
          hydroMarkers.push({
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
      });

      window.okGRDAPowerMarkers = markers;
      
      // Store markers for the pulse animation component
      setGasPowerMarkers(gasMarkers);
      setHydroPowerMarkers(hydroMarkers);
      setWindPowerMarkers(windMarkers);
      console.log(`✅ Added ${markers.length} colored teardrop markers for GRDA power generation facilities`);
      
      // Show all GRDA markers immediately (they should be visible when loaded via Perplexity button)
      markers.forEach(marker => {
        const markerElement = marker.getElement();
        if (markerElement) {
          const originalOpacity = markerElement.getAttribute('data-original-opacity') || 
                                 markerElement.style.opacity || 
                                 window.getComputedStyle(markerElement).opacity || 
                                 '1';
          markerElement.setAttribute('data-original-opacity', originalOpacity);
          markerElement.style.setProperty('opacity', originalOpacity, 'important');
          markerElement.style.setProperty('visibility', 'visible', 'important');
          markerElement.style.setProperty('pointer-events', 'auto', 'important');
          markerElement.setAttribute('data-visibility-initialized', 'true');
        }
      });
      
      // Emit event to update legend visibility state (show all GRDA fuel types)
      if (typeof window !== 'undefined' && window.mapEventBus) {
        window.mapEventBus.emit('grda-markers-loaded', {
          showHydro: true,
          showWind: true,
          showGas: true
        });
      }
      
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: `✅ Loaded ${markers.length} GRDA power facilities`,
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
      console.warn('⚠️ Error loading GRDA power markers:', error);
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '⚠️ Failed to load GRDA markers',
          progress: 0,
          details: error.message
        });
      }
    }
    */
  }, [map, updateToolFeedback]);

  // Archived: Pryor to GRDA routes - Oklahoma-specific
  // TODO: Implement AEP Ohio route layers if needed
  const addPryorToGRDARoutes = useCallback(async () => {
    // Function disabled - Oklahoma-specific route implementation removed
    if (!map?.current) return;
    console.log('⚠️ Pryor to GRDA routes disabled - Oklahoma-specific feature removed');
    return;
    
    // Archived code below - kept for reference
    /*
    if (!map?.current) return;

    const SOURCE_ID = 'pryor-grda-route-source';
    const LAYER_ID = 'pryor-grda-route-layer';
    const PARTICLE_SOURCE_ID = 'pryor-grda-route-particles';
    const PARTICLE_LAYER_ID = 'pryor-grda-route-particles-layer';

    // Check if Pryor marker exists
    const hasPryorMarker = window.okCampusTeardropMarkers && 
      window.okCampusTeardropMarkers.some(marker => {
        const element = marker.getElement();
        if (!element) return false;
        const campusName = element.getAttribute('data-campus-name');
        return campusName === 'Pryor';
      });

    if (!hasPryorMarker) {
      console.log('⚠️ Pryor marker not found, skipping GRDA routes');
      return;
    }

    // Route segment files - only include files that were actually generated
    const potentialRouteFiles = [
      '/data/okc_campuses/pryor_to_pensacola_dam.geojson',
      '/data/okc_campuses/pryor_to_robert_s_kerr_dam.geojson',
      '/data/okc_campuses/pryor_to_salina_pumped_storage_project.geojson',
      '/data/okc_campuses/pryor_to_wind_generation.geojson',
      '/data/okc_campuses/pryor_to_redbud_power_plant.geojson',
    ];

    try {
      // Load all route files (only those that exist)
      const collections = await Promise.all(
        potentialRouteFiles.map(async path => {
          try {
            const res = await fetch(path, { cache: 'no-cache' });
            if (!res.ok) {
              return { features: [] };
            }
            // Check if response is actually JSON or GeoJSON
            const contentType = res.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json') || 
                          contentType.includes('application/geo+json') ||
                          contentType.includes('text/json') ||
                          contentType.includes('json');
            if (!isJson) {
              return { features: [] };
            }
            const data = await res.json();
            return data;
          } catch (err) {
            return { features: [] };
          }
        })
      );

      // Merge all features
      const allFeatures = collections.flatMap(c => c.features || []);
      
      if (allFeatures.length === 0) {
        console.log('⚠️ No Pryor to GRDA route files found');
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
            visibility: 'visible', // Visible by default when GRDA markers are shown
          },
          paint: {
            'line-width': 1.5,
            'line-opacity': 0.6,
            'line-color': '#3b82f6', // Blue to match Perplexity button theme
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
            'circle-color': '#60a5fa', // Light blue particles
            'circle-opacity': 0.9,
            'circle-blur': 0.3,
          },
        });
      }

      // Emit event that layers are ready
      if (typeof window !== 'undefined' && window.mapEventBus) {
        window.mapEventBus.emit('pryor-grda-route:ready', true);
      }

      console.log(`✅ Loaded ${allFeatures.length} Pryor to GRDA routes`);
    } catch (error) {
      console.warn('⚠️ Failed to load Pryor to GRDA route layers:', error);
    }
    */
  }, [map]);

  const handleClick = async () => {
    if (isLoading) return;
    
    // Check if map is available
    if (!map?.current) {
      console.error('❌ Map is not available for gentrification analysis');
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '❌ Map not ready',
          progress: 0,
          details: 'Map is not available. Please wait for map to load.'
        });
        setTimeout(() => {
          updateToolFeedback({
            isActive: false,
            tool: null,
            status: '',
            progress: 0,
            details: ''
          });
        }, 3000);
      }
      return;
    }
    
    setIsLoading(true);
    if (onLoadingChange) {
      onLoadingChange(true);
    }
    
    console.log('🔵 Perplexity Button clicked - Loading GRDA markers and routes');
    
    try {
      // Call the original onClick if provided
      if (onClick) {
        onClick();
      }
      
      // Archived: GRDA markers and routes - Oklahoma-specific
      // TODO: Add AEP Ohio power markers and routes if needed
      // Previous code loaded GRDA markers and Pryor-to-GRDA routes
      // These features are disabled for Columbus/AEP Ohio migration
      
    } catch (error) {
      console.error('❌ Perplexity GRDA Loading Error:', error.message);
      
      // Update feedback for error
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '❌ GRDA markers failed to load',
          progress: 0,
          details: `Error: ${error.message}`
        });
        
        // Clear error feedback after delay
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
    } finally {
      setIsLoading(false);
      if (onLoadingChange) {
        onLoadingChange(false);
      }
    }
  };

  // Add CSS animations for pulsing effects
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes perplexityButtonPulse {
        0% { 
          transform: scale(1);
          background-color: rgba(0, 0, 0, 0.8);
        }
        50% { 
          transform: scale(1.1);
          background-color: rgba(0, 0, 0, 1);
        }
        100% { 
          transform: scale(1);
          background-color: rgba(0, 0, 0, 0.8);
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isGentrificationLoaded && map?.current) {
        cleanupGentrification();
      }
    };
  }, [isGentrificationLoaded, map]);

  return (
    <React.Fragment>
    <div
      style={{
        position: 'relative',
        top: position?.top || '0px',
        left: position?.left || '0px',
        width: size,
        height: size,
        borderRadius: '50%',
        background: disabled ? 'rgba(0, 0, 0, 0.4)' : (isLoading ? '#000000' : (isHovered ? 'rgba(0, 0, 0, 1)' : (isGentrificationLoaded ? 'rgba(220, 38, 38, 0.8)' : color))),
        border: disabled ? '1px solid rgba(0, 0, 0, 0.2)' : (isGentrificationLoaded ? '1px solid rgba(220, 38, 38, 0.5)' : '1px solid rgba(59, 130, 246, 0.2)'),
        cursor: disabled ? 'not-allowed' : (isLoading ? 'default' : 'pointer'),
        boxShadow: disabled ? '0 1px 4px rgba(0, 0, 0, 0.1)' : (isHovered 
          ? '0 2px 8px rgba(0, 0, 0, 0.4)' 
          : '0 1px 4px rgba(0, 0, 0, 0.2)'),
        transition: 'all 0.2s ease',
        zIndex: 1001,
        padding: '8px',
        opacity: disabled ? 0.6 : (isLoading ? 0.7 : 1),
        animation: disabled ? 'none' : (isLoading ? 'perplexityButtonPulse 1.5s ease-out infinite' : 'none')
      }}
      onClick={disabled ? undefined : handleClick}
      onMouseEnter={() => !disabled && !isLoading && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={disabled ? 'Loading...' : (isLoading ? 'Loading gentrification analysis...' : (isGentrificationLoaded ? 'Remove gentrification analysis' : title))}
    />
      {/* Gas, Hydro, and Wind Power Pulse Animations for GRDA markers */}
      {map?.current && (gasPowerMarkers.length > 0 || hydroPowerMarkers.length > 0 || windPowerMarkers.length > 0) && (
        <GasHydroPowerPulseAnimations
          map={map}
          gasMarkers={gasPowerMarkers}
          hydroMarkers={hydroPowerMarkers}
          windMarkers={windPowerMarkers}
        />
      )}
    </React.Fragment>
  );
};

export default PerplexityCall;