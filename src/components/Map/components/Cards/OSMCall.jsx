import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import {
  NC_POWER_SITE_KEYS,
  getNcPowerSiteByKey
} from '../../../../config/ncPowerSites';
// Archived: Oklahoma data center sites - migrated to Columbus/AEP Ohio
// import {
//   OK_DATA_CENTER_SITE_KEYS,
//   getOkDataCenterSiteByKey
// } from '../../../../config/okDataCenterSites';
import { getGeographicConfig } from '../../../../config/geographicConfig.js';
import { TypewriterPopupCard } from './TypewriterPopupCard';
import useInfrastructureSites from '../../hooks/useInfrastructureSites';
import GasHydroPowerPulseAnimations from './GasHydroPowerPulseAnimations';
// Archived: PryorStillwaterCircleAnimation - Oklahoma-specific, removed for Columbus migration
// import PryorStillwaterCircleAnimation from '../PryorStillwaterCircleAnimation';

// Inject CSS for capacity badge pulse animation (if not already injected)
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
  return 'green'; // Default to green
};

const OSMCall = ({
  onClick,
  title = 'NC Infrastructure Analysis',
  color = '#34D399',
  size = '10px',
  position = { top: '0px', left: '0px' },
  map = null,
  onLoadingChange = null,
  disabled = false,
  updateToolFeedback = null,
  locationKey = 'default'
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showGRDALegend, setShowGRDALegend] = useState(false);
  const [gasPowerMarkers, setGasPowerMarkers] = useState([]);
  const [hydroPowerMarkers, setHydroPowerMarkers] = useState([]);
  const [windPowerMarkers, setWindPowerMarkers] = useState([]);

  const {
    mountedSite,
    setMountedSite,
    addSiteLayers,
    removeActiveLayers
  } = useInfrastructureSites({
    map,
    updateToolFeedback,
    onLayersCleared: () => {
      setShowGRDALegend(false);
      setGasPowerMarkers([]);
      setHydroPowerMarkers([]);
      setWindPowerMarkers([]);
    }
  });

  const activeSite = useMemo(() => {
    // Check NC Power sites first
    if (NC_POWER_SITE_KEYS.has(locationKey)) {
      return getNcPowerSiteByKey(locationKey);
    }
    // Archived: Oklahoma data center sites - removed for Columbus migration
    // TODO: Add AEP Ohio infrastructure sites configuration if needed
    // For now, default location (Columbus) will not have a specific site config
    // and will rely on geographic config for coordinates
    return null;
  }, [locationKey]);

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

  // Archived: Oklahoma campus teardrop markers - removed for Columbus migration
  // TODO: Implement AEP Ohio substation markers if needed for interconnection analysis
  // Note: Original implementation archived - see git history for reference
  const addCampusTeardropMarkers = useCallback(() => {
    // Function disabled - Oklahoma-specific implementation removed
    if (!map?.current) return;
    console.log('⚠️ Campus teardrop markers disabled - Oklahoma-specific feature removed');
    return;
      
    // Archived: Original implementation removed - contained JSX that cannot be in comments
    // See git history for full implementation details
  }, [map]);


  // Add blue teardrop markers for GRDA power generation facilities
  // Archived: GRDA power markers - Oklahoma-specific (Grand River Dam Authority)
  // TODO: Implement AEP Ohio power markers if needed
  // Note: Original implementation archived - see git history for reference
  const addGRDAPowerMarkers = useCallback(async () => {
    // Function disabled - Oklahoma-specific GRDA implementation removed
    if (!map?.current) return;
    console.log('⚠️ GRDA power markers disabled - Oklahoma-specific feature removed');
        return;
  }, [map]);

  // Archived: Oklahoma transit path layers - removed for Columbus migration
  // TODO: Implement AEP Ohio transmission route layers if needed
  const addTransitPathLayers = useCallback(async () => {
    // Function disabled - Oklahoma-specific implementation removed
    // Future: Add AEP Ohio transmission line visualization if needed
    if (!map?.current) return;
    console.log('⚠️ Transit path layers disabled - Oklahoma-specific feature removed');
    return;

    // Archived code below - kept for reference
    /*
    const SOURCE_ID = 'okc-campuses-route-source';
    const LAYER_ID = 'okc-campuses-route-layer';
    const PARTICLE_SOURCE_ID = 'okc-campuses-route-particles';
    const PARTICLE_LAYER_ID = 'okc-campuses-route-particles-layer';

    // Route segment files - ARCHIVED: Oklahoma routes
    const DEFAULT_SEGMENT_FILES = [
      '/data/okc_campuses/pryor_to_stillwater.geojson',
      '/data/okc_campuses/pryor_to_inola.geojson',
      '/data/okc_campuses/pryor_to_tulsa_suburbs.geojson',
      '/data/okc_campuses/tulsa_suburbs_to_tulsa_metro.geojson',
      '/data/okc_campuses/tulsa_metro_to_cimarron_link___tulsa.geojson',
      '/data/okc_campuses/stillwater_to_okc_innovation_district.geojson',
      '/data/okc_campuses/cushing_to_okc_innovation_district.geojson',
      '/data/okc_campuses/og&e_substation_okc_to_tinker_afb.geojson',
      '/data/okc_campuses/okc_innovation_district_to_tinker_afb.geojson',
      '/data/okc_campuses/ardmore_to_okc_innovation_district.geojson',
      '/data/okc_campuses/pryor_to_cushing.geojson',
      '/data/okc_campuses/stillwater_to_cushing.geojson',
      '/data/okc_campuses/pryor_to_pensacola_dam.geojson',
      '/data/okc_campuses/pryor_to_robert_s._kerr_dam.geojson',
      '/data/okc_campuses/pryor_to_salina_pumped_storage_project.geojson',
      '/data/okc_campuses/pryor_to_redbud_power_plant.geojson',
      '/data/okc_campuses/inola_to_pensacola_dam.geojson',
      '/data/okc_campuses/inola_to_robert_s._kerr_dam.geojson',
      '/data/okc_campuses/inola_to_salina_pumped_storage_project.geojson',
      '/data/okc_campuses/inola_to_redbud_power_plant.geojson',
      '/data/okc_campuses/pensacola_dam_to_robert_s._kerr_dam.geojson',
      '/data/okc_campuses/robert_s._kerr_dam_to_salina_pumped_storage_project.geojson',
      '/data/okc_campuses/salina_pumped_storage_project_to_redbud_power_plant.geojson',
    ];

    try {
      // Load all route files
      const collections = await Promise.all(
        DEFAULT_SEGMENT_FILES.map(async path => {
          try {
            const res = await fetch(path, { cache: 'no-cache' });
            if (!res.ok) {
              return { features: [] };
            }
            return res.json();
          } catch (err) {
            return { features: [] };
          }
        })
      );

      // Merge all features
      const allFeatures = collections.flatMap(c => c.features || []);
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
            visibility: 'none', // Hidden by default, controlled by legend toggle
          },
          paint: {
            'line-width': 1,
            'line-opacity': 0.5,
            'line-color': '#22c55e', // Green to match the OSM button
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
            visibility: 'none', // Hidden by default, controlled by legend toggle
          },
          paint: {
            'circle-radius': 3,
            'circle-color': '#86efac', // Light green particles
            'circle-opacity': 0.9,
            'circle-blur': 0.3,
          },
        });
      }

      // Emit event that layers are ready
      if (typeof window !== 'undefined' && window.mapEventBus) {
        window.mapEventBus.emit('okc-campuses-route:ready', true);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load transit path layers:', error);
    }
    */
  }, [map]);

  // Archived: Oklahoma marker pipelines - removed for Columbus migration
  // TODO: Implement AEP Ohio marker pipelines if needed for interconnection analysis
  const addMarkerPipelines = useCallback(async () => {
    // Function disabled - Oklahoma-specific implementation removed
    // Future: Add AEP Ohio substation pipeline data if needed
    if (!map?.current) return;
    console.log('⚠️ Marker pipelines disabled - Oklahoma-specific feature removed');
    return;

    // Archived code below - kept for reference
    /*
    // Marker keys mapping (infrastructure + GRDA) - ARCHIVED: Oklahoma markers
    const markerKeys = [
      // Infrastructure markers
      'pryor', 'stillwater', 'tulsa_suburbs', 'oge_substation_okc',
      'cimarron_link_tulsa', 'cimarron_link_panhandle', 'cushing',
      'tulsa_metro', 'okc_innovation_district', 'ardmore', 'inola', 'tinker_afb',
      // GRDA markers
      'pensacola_dam', 'robert_s_kerr_dam', 'salina_pumped_storage',
      'wind_generation', 'redbud_power_plant'
    ];

    // Remove existing marker pipeline layers
    markerKeys.forEach(key => {
      const sourceId = `marker-pipeline-${key}`;
      const layerId = `marker-pipeline-${key}-line`;
      const pointLayerId = `marker-pipeline-${key}-point`;
      
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getLayer(pointLayerId)) {
        map.current.removeLayer(pointLayerId);
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
      
      // Remove fixed-size endpoint markers
      if (window.pipelineEndpointMarkers && window.pipelineEndpointMarkers[key]) {
        window.pipelineEndpointMarkers[key].forEach(marker => marker.remove());
        window.pipelineEndpointMarkers[key] = [];
      }
    });

    // Load pipeline data for each marker
    for (const markerKey of markerKeys) {
      try {
        const pipelinePath = `/data/pipelines/pipeline_${markerKey}.json`;
        const response = await fetch(pipelinePath, { cache: 'no-cache' });
        
        if (!response.ok) {
          // Silently skip markers without pipeline data
          continue;
        }

        const pipelineData = await response.json();
        const pipelineFeatures = (pipelineData.features || []).filter(
          f => f.properties?.category === 'pipeline'
        );

        if (pipelineFeatures.length === 0) {
          continue;
        }

        const sourceId = `marker-pipeline-${markerKey}`;
        const geojsonData = {
          type: 'FeatureCollection',
          features: pipelineFeatures
        };

        // Add source
        if (map.current.getSource(sourceId)) {
          map.current.getSource(sourceId).setData(geojsonData);
        } else {
          map.current.addSource(sourceId, {
            type: 'geojson',
            data: geojsonData
          });
        }

        // Add line layer for pipeline routes
        const lineFeatures = pipelineFeatures.filter(f => f.geometry?.type === 'LineString');
        if (lineFeatures.length > 0) {
          const layerId = `marker-pipeline-${markerKey}-line`;
          if (!map.current.getLayer(layerId)) {
            map.current.addLayer({
              id: layerId,
              type: 'line',
              source: sourceId,
              filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'category'], 'pipeline']],
              layout: {
                visibility: 'none' // Hidden by default, controlled by legend toggle
              },
              paint: {
                'line-color': [
                  'case',
                  // Oil pipelines - darkest blue (#1e3a8a)
                  ['any',
                    ['==', ['get', 'pipeline_type'], 'oil'],
                    ['==', ['get', 'substance'], 'oil']
                  ], '#1e3a8a',
                  // Gas pipelines - medium-dark blue (#1e40af)
                  ['any',
                    ['==', ['get', 'pipeline_type'], 'gas'],
                    ['==', ['get', 'pipeline_type'], 'natural_gas'],
                    ['==', ['get', 'substance'], 'gas']
                  ], '#1e40af',
                  // Water pipelines - medium blue (#2563eb)
                  ['any',
                    ['==', ['get', 'pipeline_type'], 'water'],
                    ['==', ['get', 'substance'], 'water'],
                    ['==', ['get', 'man_made'], 'water_works']
                  ], '#2563eb',
                  // Sewer/wastewater pipelines - lighter blue (#3b82f6)
                  ['any',
                    ['==', ['get', 'pipeline_type'], 'sewer'],
                    ['==', ['get', 'pipeline_type'], 'wastewater'],
                    ['==', ['get', 'man_made'], 'sewer']
                  ], '#3b82f6',
                  // Default - light blue (#60a5fa)
                  '#60a5fa'
                ],
                'line-width': 2,
                'line-opacity': 0.5 // 50% opacity for pipeline lines
              }
            });
          }

          // Extract start and end points from pipeline lines and create fixed-size endpoint markers
          // Use mapboxgl.Marker for fixed size (doesn't scale with zoom)
          if (!window.pipelineEndpointMarkers) {
            window.pipelineEndpointMarkers = {};
          }
          if (!window.pipelineEndpointMarkers[markerKey]) {
            window.pipelineEndpointMarkers[markerKey] = [];
          }

          // Remove existing markers for this markerKey
          window.pipelineEndpointMarkers[markerKey].forEach(marker => marker.remove());
          window.pipelineEndpointMarkers[markerKey] = [];

          lineFeatures.forEach((feature, index) => {
            const coordinates = feature.geometry.coordinates;
            if (coordinates && coordinates.length >= 2) {
              // Determine color based on pipeline type
              const pipelineType = feature.properties?.pipeline_type || feature.properties?.substance || feature.properties?.man_made || '';
              const pipelineTypeLower = (pipelineType || '').toLowerCase();
              
              let markerColor = '#60a5fa'; // Default light blue
              if (pipelineTypeLower === 'oil' || pipelineTypeLower === 'petroleum') {
                markerColor = '#1e3a8a'; // Darkest blue for oil
              } else if (pipelineTypeLower === 'gas' || pipelineTypeLower === 'natural_gas') {
                markerColor = '#1e40af'; // Medium-dark blue for gas
              } else if (pipelineTypeLower === 'water' || pipelineTypeLower === 'water_works') {
                markerColor = '#2563eb'; // Medium blue for water
              } else if (pipelineTypeLower === 'sewer' || pipelineTypeLower === 'wastewater') {
                markerColor = '#3b82f6'; // Lighter blue for sewer
              }

              // Create fixed-size markers for start and end points (simple circles)
              const createEndpointMarker = (coords, endpointType, pipelineProps) => {
                // Create a simple circle element
                const el = document.createElement('div');
                el.style.width = '14px'; // 0.7 * 20px (30% smaller than default)
                el.style.height = '14px';
                el.style.borderRadius = '50%';
                el.style.backgroundColor = markerColor;
                el.style.opacity = '0'; // Hidden by default, controlled by legend toggle
                el.style.visibility = 'hidden'; // Hidden by default
                el.style.pointerEvents = 'none'; // Disable interaction when hidden
                el.style.border = 'none';
                el.style.cursor = 'pointer';
                
                // Determine pipeline type for popup
                const pipelineType = pipelineProps?.pipeline_type || pipelineProps?.substance || pipelineProps?.man_made || 'Unknown';
                const pipelineName = pipelineProps?.name || 'Unnamed Pipeline';
                const pipelineTypeDisplay = pipelineType.charAt(0).toUpperCase() + pipelineType.slice(1).replace(/_/g, ' ');
                
                // Create popup content
                const popupContent = `
                  <div style="
                    background: rgba(0, 0, 0, 0.85);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 12px;
                    min-width: 120px;
                  ">
                    <div style="font-weight: 600; margin-bottom: 4px;">${pipelineName}</div>
                    <div style="font-size: 11px; color: #9ca3af;">
                      Type: <span style="color: ${markerColor};">${pipelineTypeDisplay}</span>
                    </div>
                    <div style="font-size: 10px; color: #6b7280; margin-top: 4px;">
                      ${endpointType === 'start' ? 'Start' : 'End'} Point
                    </div>
                  </div>
                `;
                
                const popup = new mapboxgl.Popup({
                  closeButton: true,
                  closeOnClick: true,
                  anchor: 'bottom',
                  offset: 8
                }).setHTML(popupContent);
                
                const marker = new mapboxgl.Marker({
                  element: el,
                  anchor: 'center'
                })
                .setLngLat(coords)
                .setPopup(popup)
                .addTo(map.current);
                
                return marker;
              };

              // Start point marker
              const startMarker = createEndpointMarker(coordinates[0], 'start', feature.properties);
              window.pipelineEndpointMarkers[markerKey].push(startMarker);

              // End point marker
              const endMarker = createEndpointMarker(coordinates[coordinates.length - 1], 'end', feature.properties);
              window.pipelineEndpointMarkers[markerKey].push(endMarker);
            }
          });
        }

        // Add point layer for pipeline markers/stations
        const pointFeatures = pipelineFeatures.filter(f => f.geometry?.type === 'Point');
        if (pointFeatures.length > 0) {
          const pointLayerId = `marker-pipeline-${markerKey}-point`;
          if (!map.current.getLayer(pointLayerId)) {
            map.current.addLayer({
              id: pointLayerId,
              type: 'circle',
              source: sourceId,
              filter: ['all', ['==', '$type', 'Point'], ['==', 'category', 'pipeline']],
              layout: {
                visibility: 'none' // Hidden by default, controlled by legend toggle
              },
              paint: {
                'circle-radius': 2, // Pipeline point markers
                'circle-color': '#3b82f6',
                'circle-opacity': 0.2, // 50% opacity for pipeline point markers
                'circle-stroke-width': 0,
                'circle-stroke-color': '#1e40af'
              }
            });
          }
        }

        console.log(`✅ Loaded ${pipelineFeatures.length} pipeline features for ${markerKey}`);
      } catch (error) {
        console.warn(`⚠️ Failed to load pipeline data for ${markerKey}:`, error);
        // Continue with other markers
      }
    }
    */
  }, [map]);


  // Load AEP Ohio interconnection requests
  const loadAepOhioInterconnectionRequests = useCallback(async () => {
    if (!map?.current) return;

    const sourceId = 'aep-ohio-interconnection-requests';
    const layerId = 'aep-ohio-interconnection-points';

    try {
      console.log('🗺️ OSM: Loading AEP Ohio interconnection requests...');
      const response = await fetch('/data/aep_ohio_interconnection_requests.geojson', { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Failed to load interconnection requests: ${response.status}`);
      }
      const geojson = await response.json();
      const features = geojson.features || [];

      if (map.current.getSource(sourceId)) {
        map.current.getSource(sourceId).setData(geojson);
      } else {
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: geojson
        });
      }

      if (!map.current.getLayer(layerId)) {
        // Find a good insertion point (before labels)
        const beforeId = 'aep-ohio-substations-ultra-high';

        map.current.addLayer({
          id: layerId,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              6, 4,
              10, 6,
              14, 10,
              16, 14
            ],
            'circle-color': [
              'match',
              ['get', 'generation_type'],
              'solar', '#fbbf24',      // yellow
              'wind', '#60a5fa',       // blue
              'battery', '#a78bfa',    // purple
              'gas', '#f87171',        // red
              'hybrid', '#10b981',     // green
              '#9ca3af'                // gray (default)
            ],
            'circle-opacity': 0.8,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#000000',
            'circle-stroke-opacity': 0.9
          }
        }, beforeId);

        // Add hover effect
        map.current.on('mouseenter', layerId, () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });

        map.current.on('mouseleave', layerId, () => {
          map.current.getCanvas().style.cursor = '';
        });

        // Add click popup
        map.current.on('click', layerId, (e) => {
          const feature = e.features[0];
          if (!feature) return;

          const props = feature.properties;
          const projectName = props.project_name || props.queue_id || 'Unknown Project';
          const generationType = props.generation_type || 'unknown';
          const capacity = props.capacity_range_display || 
            (props.capacity_min_mw && props.capacity_max_mw 
              ? `${props.capacity_min_mw} - ${props.capacity_max_mw} MW`
              : 'Unknown capacity');
          const county = props.county ? `${props.county} County` : 'Unknown';
          const state = props.state || 'Unknown';
          const status = props.status || 'unknown';
          const interconnectionLocation = props.interconnection_location || 'Not specified';
          const transmissionOwner = props.transmission_owner || 'Not specified';
          const distanceToColumbus = props.distance_to_columbus_center_km 
            ? `${props.distance_to_columbus_center_km.toFixed(1)} km`
            : null;
          const nearestSubstation = props.nearest_substation_name 
            ? `${props.nearest_substation_name} (${props.distance_to_nearest_substation_km.toFixed(1)} km)`
            : null;

          // Generation type emoji
          const genTypeEmoji = {
            'solar': '☀️',
            'wind': '💨',
            'battery': '🔋',
            'gas': '🔥',
            'hybrid': '⚡',
            'unknown': '⚙️'
          }[generationType] || '⚙️';

          // Build popup HTML
          let popupHTML = `
            <div style="
              background: rgba(0, 0, 0, 0.9);
              color: white;
              padding: 12px;
              border-radius: 8px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 13px;
              max-width: 300px;
              line-height: 1.5;
            ">
              <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px; color: #fbbf24;">
                ${genTypeEmoji} ${projectName}
              </div>
              <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px;">
                Queue ID: <span style="color: white;">${props.queue_id || 'N/A'}</span>
              </div>
              <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px;">
                Status: <span style="color: ${status === 'active' ? '#10b981' : '#f59e0b'}; font-weight: 500;">${status.toUpperCase()}</span>
              </div>
              <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px;">
                Capacity: <span style="color: white; font-weight: 500;">${capacity}</span>
              </div>
              <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px;">
                Location: <span style="color: white;">${county}, ${state}</span>
              </div>
              <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px;">
                Interconnection: <span style="color: white;">${interconnectionLocation}</span>
              </div>
              <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px;">
                Transmission Owner: <span style="color: white;">${transmissionOwner}</span>
              </div>
          `;

          if (distanceToColumbus) {
            popupHTML += `
              <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px;">
                Distance to Columbus: <span style="color: white;">${distanceToColumbus}</span>
              </div>
            `;
          }

          if (nearestSubstation) {
            popupHTML += `
              <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px;">
                Nearest Substation: <span style="color: white;">${nearestSubstation}</span>
              </div>
            `;
          }

          if (props.project_url) {
            popupHTML += `
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #374151;">
                <a href="${props.project_url}" target="_blank" rel="noopener noreferrer" 
                   style="color: #60a5fa; text-decoration: none; font-size: 11px;">
                  View on interconnection.fyi →
                </a>
              </div>
            `;
          }

          popupHTML += `</div>`;

          new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: true,
            anchor: 'bottom',
            offset: 12
          })
          .setLngLat(e.lngLat)
          .setHTML(popupHTML)
          .addTo(map.current);
        });
      }

      console.log(`✅ OSM: AEP Ohio interconnection requests layer added { featureCount: ${features.length} }`);

      // Emit event for legend integration
      if (window.mapEventBus) {
        window.mapEventBus.emit('aep-ohio:interconnection-requests-mounted', {
          featureCount: features.length,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.warn('⚠️ OSM: Failed to load AEP Ohio interconnection requests:', error);
    }
  }, [map]);

  // Load AEP Ohio infrastructure data (substations, transmission lines)
  const loadAepOhioInfrastructure = useCallback(async () => {
    if (!map?.current) {
      console.error('🗺️ OSM: Map instance not available');
      return;
    }

    console.log('🗺️ OSM: Starting AEP Ohio infrastructure load...');
    
    try {
      // Load substations
      console.log('🗺️ OSM: Loading AEP Ohio substations...');
      const substationsResponse = await fetch('/osm/aep_ohio_substations.json', { cache: 'no-cache' });
      if (!substationsResponse.ok) {
        throw new Error(`Failed to load substations: ${substationsResponse.status}`);
      }
      const substationsData = await substationsResponse.json();
      const substationFeatures = substationsData.features || [];
      console.log(`🗺️ OSM: Loaded ${substationFeatures.length} substations`);

      // Debug: substation voltage / category stats
      const subVoltageCounts = {};
      const subCategoryCounts = {};
      substationFeatures.forEach(f => {
        const props = f.properties || {};
        const v = props.voltage || '';
        const cat = props.category || 'substation';
        subVoltageCounts[v || ''] = (subVoltageCounts[v || ''] || 0) + 1;
        subCategoryCounts[cat] = (subCategoryCounts[cat] || 0) + 1;
      });
      console.log('🗺️ OSM: Substation voltage stats', {
        total: substationFeatures.length,
        nonEmptyVoltageCount: Object.keys(subVoltageCounts).filter(k => k !== '').reduce((sum, k) => sum + subVoltageCounts[k], 0),
        byVoltageSample: Object.entries(subVoltageCounts).slice(0, 10),
        byCategorySample: Object.entries(subCategoryCounts).slice(0, 10)
      });

      // Load transmission lines
      console.log('🗺️ OSM: Loading AEP Ohio transmission lines...');
      const transmissionResponse = await fetch('/osm/aep_ohio_transmission_lines.json', { cache: 'no-cache' });
      if (!transmissionResponse.ok) {
        throw new Error(`Failed to load transmission lines: ${transmissionResponse.status}`);
      }
      const transmissionData = await transmissionResponse.json();
      const transmissionFeatures = transmissionData.features || [];
      console.log(`🗺️ OSM: Loaded ${transmissionFeatures.length} transmission line segments`);

      // Debug: transmission voltage stats
      const txVoltageCounts = {};
      transmissionFeatures.forEach(f => {
        const props = f.properties || {};
        const v = props.voltage || '';
        txVoltageCounts[v || ''] = (txVoltageCounts[v || ''] || 0) + 1;
      });
      console.log('🗺️ OSM: Transmission voltage stats', {
        total: transmissionFeatures.length,
        nonEmptyVoltageCount: Object.keys(txVoltageCounts).filter(k => k !== '').reduce((sum, k) => sum + txVoltageCounts[k], 0),
        byVoltageSample: Object.entries(txVoltageCounts).slice(0, 15)
      });

      // Get all layers to find insertion point (before labels) - do this once for both layers
      const layers = map.current.getStyle().layers;
      let beforeId = null;
      for (let i = layers.length - 1; i >= 0; i--) {
        if (layers[i].id.includes('label') || layers[i].id.includes('symbol')) {
          beforeId = layers[i].id;
          break;
        }
      }

      // Add substations to map
      const substationsSourceId = 'aep-ohio-substations';
      if (map.current.getSource(substationsSourceId)) {
        map.current.getSource(substationsSourceId).setData(substationsData);
      } else {
        map.current.addSource(substationsSourceId, {
          type: 'geojson',
          data: substationsData
        });
      }

      // Add substation point layers by voltage level
      // Ultra High Voltage (500kV+) - Bright orange-red
      if (!map.current.getLayer('aep-ohio-substations-ultra-high')) {
        map.current.addLayer({
          id: 'aep-ohio-substations-ultra-high',
          type: 'circle',
          source: substationsSourceId,
          filter: ['all',
            ['==', ['geometry-type'], 'Point'],
            ['any',
              ['==', ['get', 'category'], 'substation_500000'],
              ['==', ['get', 'category'], 'substation_765000'],
              ['==', ['get', 'category'], 'substation_500000;138000'],
              ['==', ['get', 'category'], 'substation_765000;345000'],
              ['==', ['get', 'category'], 'substation_765000;138000']
            ]
          ],
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 4,
              12, 6,
              15, 10
            ],
            'circle-color': '#ea580c', // Bright orange-red
            'circle-stroke-width': 2,
            'circle-stroke-color': '#dc2626',
            'circle-opacity': 0.9
          }
        }, beforeId);
      }

      // High Voltage (345kV) - Orange
      if (!map.current.getLayer('aep-ohio-substations-high')) {
        map.current.addLayer({
          id: 'aep-ohio-substations-high',
          type: 'circle',
          source: substationsSourceId,
          filter: ['all',
            ['==', ['geometry-type'], 'Point'],
            ['any',
              ['==', ['get', 'category'], 'substation_345000'],
              ['==', ['get', 'category'], 'substation_345000;138000'],
              ['==', ['get', 'category'], 'substation_345000;138000;69000']
            ]
          ],
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 3,
              12, 5,
              15, 8
            ],
            'circle-color': '#f97316', // Orange
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ea580c',
            'circle-opacity': 0.85
          }
        }, beforeId);
      }

      // Medium Voltage (138kV) - Blue
      if (!map.current.getLayer('aep-ohio-substations-medium')) {
        map.current.addLayer({
          id: 'aep-ohio-substations-medium',
          type: 'circle',
          source: substationsSourceId,
          filter: ['all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'category'], 'substation_138000']
          ],
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 2.5,
              12, 4,
              15, 7
            ],
            'circle-color': '#3b82f6', // Blue
            'circle-stroke-width': 1,
            'circle-stroke-color': '#2563eb',
            'circle-opacity': 0.8
          }
        }, beforeId);
      }

      // Low Voltage / Unknown (<138kV or missing voltage) - Neutral gray
      if (!map.current.getLayer('aep-ohio-substations-low')) {
        map.current.addLayer({
          id: 'aep-ohio-substations-low',
          type: 'circle',
          source: substationsSourceId,
          filter: ['all',
            ['==', ['geometry-type'], 'Point'],
            ['!', ['any',
              ['==', ['get', 'category'], 'substation_500000'],
              ['==', ['get', 'category'], 'substation_765000'],
              ['==', ['get', 'category'], 'substation_500000;138000'],
              ['==', ['get', 'category'], 'substation_765000;345000'],
              ['==', ['get', 'category'], 'substation_765000;138000'],
              ['==', ['get', 'category'], 'substation_345000'],
              ['==', ['get', 'category'], 'substation_345000;138000'],
              ['==', ['get', 'category'], 'substation_345000;138000;69000'],
              ['==', ['get', 'category'], 'substation_138000']
            ]]
          ],
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 2,
              12, 3.5,
              15, 6
            ],
            // Use neutral gray for unknown / low-voltage substations so high/medium voltage stand out
            'circle-color': '#9ca3af', // Gray
            'circle-stroke-width': 1,
            'circle-stroke-color': '#6b7280',
            'circle-opacity': 0.8
          }
        }, beforeId);
      }

      // Add transmission lines to map
      const transmissionSourceId = 'aep-ohio-transmission';
      
      // Add pulse_t property to all transmission line features for animation
      const transmissionDataWithPulse = {
        ...transmissionData,
        features: transmissionData.features.map(feature => ({
          ...feature,
          properties: {
            ...feature.properties,
            pulse_t: 0 // Initialize pulse value
          }
        }))
      };
      
      if (map.current.getSource(transmissionSourceId)) {
        map.current.getSource(transmissionSourceId).setData(transmissionDataWithPulse);
      } else {
        map.current.addSource(transmissionSourceId, {
          type: 'geojson',
          data: transmissionDataWithPulse
        });
      }

      // Helper function to get voltage level from feature
      // Returns: 'ultra_high' (500kV+), 'high' (345kV), 'medium' (138kV), 'low' (<138kV)
      const getVoltageLevel = (voltage) => {
        if (!voltage || voltage === '') return 'low';
        const voltageNum = parseInt(voltage.toString().split(';')[0]) || 0;
        if (voltageNum >= 500000) return 'ultra_high'; // 500kV+
        if (voltageNum >= 345000) return 'high'; // 345kV
        if (voltageNum >= 138000) return 'medium'; // 138kV
        return 'low'; // <138kV
      };

      // Add transmission line layers by voltage level
      // Ultra High Voltage (500kV+) - Brightest orange, thickest
      if (!map.current.getLayer('aep-ohio-transmission-ultra-high-halo')) {
        map.current.addLayer({
          id: 'aep-ohio-transmission-ultra-high-halo',
          type: 'line',
          source: transmissionSourceId,
          filter: ['all', 
            ['==', ['geometry-type'], 'LineString'],
            ['any',
              ['==', ['get', 'voltage'], '500000'],
              ['==', ['get', 'voltage'], '765000'],
              ['==', ['get', 'voltage'], '500000;138000']
            ]
          ],
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#ea580c', // Bright orange-red
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 10,
              12, 16,
              15, 22
            ],
            'line-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'pulse_t'],
              0, 0.3,
              0.5, 0.5,
              1, 0.3
            ],
            'line-blur': 4
          }
        }, beforeId);
      }

      if (!map.current.getLayer('aep-ohio-transmission-ultra-high')) {
        map.current.addLayer({
          id: 'aep-ohio-transmission-ultra-high',
          type: 'line',
          source: transmissionSourceId,
          filter: ['all', 
            ['==', ['geometry-type'], 'LineString'],
            ['any',
              ['==', ['get', 'voltage'], '500000'],
              ['==', ['get', 'voltage'], '765000'],
              ['==', ['get', 'voltage'], '500000;138000']
            ]
          ],
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#ea580c', // Bright orange-red
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 5,
              12, 7,
              15, 10
            ],
            'line-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'pulse_t'],
              0, 0.95,
              0.5, 1.0,
              1, 0.95
            ]
          }
        }, beforeId);
      }

      // High Voltage (345kV) - Orange
      if (!map.current.getLayer('aep-ohio-transmission-high-halo')) {
        map.current.addLayer({
          id: 'aep-ohio-transmission-high-halo',
          type: 'line',
          source: transmissionSourceId,
          filter: ['all', 
            ['==', ['geometry-type'], 'LineString'],
            ['==', ['get', 'voltage'], '345000']
          ],
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#f97316', // Orange
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 8,
              12, 12,
              15, 18
            ],
            'line-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'pulse_t'],
              0, 0.25,
              0.5, 0.45,
              1, 0.25
            ],
            'line-blur': 3
          }
        }, beforeId);
      }

      if (!map.current.getLayer('aep-ohio-transmission-high')) {
        map.current.addLayer({
          id: 'aep-ohio-transmission-high',
          type: 'line',
          source: transmissionSourceId,
          filter: ['all', 
            ['==', ['geometry-type'], 'LineString'],
            ['==', ['get', 'voltage'], '345000']
          ],
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#f97316', // Orange
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 4,
              12, 6,
              15, 8
            ],
            'line-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'pulse_t'],
              0, 0.9,
              0.5, 1.0,
              1, 0.9
            ]
          }
        }, beforeId);
      }

      // Medium Voltage (138kV) - Blue
      if (!map.current.getLayer('aep-ohio-transmission-medium-halo')) {
        map.current.addLayer({
          id: 'aep-ohio-transmission-medium-halo',
          type: 'line',
          source: transmissionSourceId,
          filter: ['all', 
            ['==', ['geometry-type'], 'LineString'],
            ['==', ['get', 'voltage'], '138000']
          ],
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3b82f6', // Blue
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 6,
              12, 10,
              15, 14
            ],
            'line-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'pulse_t'],
              0, 0.2,
              0.5, 0.35,
              1, 0.2
            ],
            'line-blur': 2.5
          }
        }, beforeId);
      }

      if (!map.current.getLayer('aep-ohio-transmission-medium')) {
        map.current.addLayer({
          id: 'aep-ohio-transmission-medium',
          type: 'line',
          source: transmissionSourceId,
          filter: ['all', 
            ['==', ['geometry-type'], 'LineString'],
            ['==', ['get', 'voltage'], '138000']
          ],
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3b82f6', // Blue
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 0.8,
              12, 1.2,
              15, 1.8
            ],
            'line-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'pulse_t'],
              0, 0.85,
              0.5, 0.95,
              1, 0.85
            ]
          }
        }, beforeId);
      }

      // Low Voltage (<138kV) - Light blue
      if (!map.current.getLayer('aep-ohio-transmission-low-halo')) {
        map.current.addLayer({
          id: 'aep-ohio-transmission-low-halo',
          type: 'line',
          source: transmissionSourceId,
          filter: ['all', 
            ['==', ['geometry-type'], 'LineString'],
            ['!', ['any',
              ['==', ['get', 'voltage'], '500000'],
              ['==', ['get', 'voltage'], '765000'],
              ['==', ['get', 'voltage'], '500000;138000'],
              ['==', ['get', 'voltage'], '345000'],
              ['==', ['get', 'voltage'], '138000']
            ]]
          ],
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#60a5fa', // Light blue
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 4,
              12, 7,
              15, 10
            ],
            'line-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'pulse_t'],
              0, 0.15,
              0.5, 0.25,
              1, 0.15
            ],
            'line-blur': 2
          }
        }, beforeId);
      }

      if (!map.current.getLayer('aep-ohio-transmission-low')) {
        map.current.addLayer({
          id: 'aep-ohio-transmission-low',
          type: 'line',
          source: transmissionSourceId,
          filter: ['all', 
            ['==', ['geometry-type'], 'LineString'],
            ['!', ['any',
              ['==', ['get', 'voltage'], '500000'],
              ['==', ['get', 'voltage'], '765000'],
              ['==', ['get', 'voltage'], '500000;138000'],
              ['==', ['get', 'voltage'], '345000'],
              ['==', ['get', 'voltage'], '138000']
            ]]
          ],
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#60a5fa', // Light blue
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 0.6,
              12, 0.9,
              15, 1.4
            ],
            'line-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'pulse_t'],
              0, 0.7,
              0.5, 0.85,
              1, 0.7
            ]
          }
        }, beforeId);
      }

      // Start pulse animation for transmission lines
      if (!window.aepOhioTransmissionPulseAnimation) {
        const period = 2000; // 2 second pulse cycle
        let animationFrame = null;

        const animate = () => {
          const t = ((Date.now() % period) / period);
          const source = map.current.getSource(transmissionSourceId);

          if (source) {
            try {
              const currentData = source._data || { type: 'FeatureCollection', features: [] };
              const updatedFeatures = currentData.features.map(feature => ({
                ...feature,
                properties: {
                  ...feature.properties,
                  pulse_t: t
                }
              }));

              source.setData({
                type: 'FeatureCollection',
                features: updatedFeatures
              });
            } catch (err) {
              console.warn('🗺️ OSM: Error updating transmission pulse data:', err);
            }
          }

          animationFrame = requestAnimationFrame(animate);
          window.aepOhioTransmissionPulseAnimation = animationFrame;
        };

        animate();
      }

      // Clean up any existing animation before starting new one
      if (window.aepOhioTransmissionPulseAnimation) {
        cancelAnimationFrame(window.aepOhioTransmissionPulseAnimation);
        window.aepOhioTransmissionPulseAnimation = null;
      }

      // Start pulse animation for transmission lines
      const period = 2000; // 2 second pulse cycle
      let animationFrame = null;

      const animate = () => {
        const t = ((Date.now() % period) / period);
        const source = map.current.getSource(transmissionSourceId);

        if (source) {
          try {
            const currentData = source._data || { type: 'FeatureCollection', features: [] };
            const updatedFeatures = currentData.features.map(feature => ({
              ...feature,
              properties: {
                ...feature.properties,
                pulse_t: t
              }
            }));

            source.setData({
              type: 'FeatureCollection',
              features: updatedFeatures
            });
          } catch (err) {
            console.warn('🗺️ OSM: Error updating transmission pulse data:', err);
          }
        }

        animationFrame = requestAnimationFrame(animate);
        window.aepOhioTransmissionPulseAnimation = animationFrame;
      };

      animate();

      // Load enriched upgrade points (if available) as an additional overlay
      try {
        console.log('🗺️ OSM: Loading AEP Ohio upgrade points...');
        const upgradesRes = await fetch('/data/aep_ohio_transmission_upgrades_points.geojson', { cache: 'no-cache' });
        if (upgradesRes.ok) {
          const upgradesData = await upgradesRes.json();
          const upgradesSourceId = 'aep-ohio-upgrades';
          const upgradesLayerId = 'aep-ohio-upgrades-circles';

          if (map.current.getSource(upgradesSourceId)) {
            map.current.getSource(upgradesSourceId).setData(upgradesData);
          } else {
            map.current.addSource(upgradesSourceId, {
              type: 'geojson',
              data: upgradesData
            });
          }

          if (!map.current.getLayer(upgradesLayerId)) {
            map.current.addLayer({
              id: upgradesLayerId,
              type: 'circle',
              source: upgradesSourceId,
              paint: {
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  6, 2,
                  10, 4,
                  14, 7
                ],
                'circle-color': [
                  'match',
                  ['get', 'status_bucket'],
                  'proceeded', '#22c55e',          // green
                  'stalled', '#f97316',            // orange
                  'active_or_planning', '#3b82f6', // blue
                  /* other */ '#9ca3af'
                ],
                'circle-opacity': 0.85,
                'circle-stroke-width': 0.6,
                'circle-stroke-color': '#020617'
              }
            }, beforeId);
          }

          console.log('✅ OSM: AEP Ohio upgrade points layer added', {
            featureCount: upgradesData.features?.length
          });

          // Emit event for legend / analytics consumers
          if (window.mapEventBus) {
            window.mapEventBus.emit('aep-ohio:transmission-upgrades-mounted', {
              featureCount: upgradesData.features?.length || 0,
              timestamp: Date.now()
            });
          }
        } else {
          console.warn('⚠️ OSM: Upgrade points file not available, skipping overlay', upgradesRes.status);
        }
      } catch (upgradeError) {
        console.warn('⚠️ OSM: Failed to load AEP Ohio upgrade points:', upgradeError);
      }

      console.log('✅ OSM: AEP Ohio infrastructure layers added to map');

      // Emit event for legend
      if (window.mapEventBus) {
        window.mapEventBus.emit('osm:geographicContext', {
          context: {
            visualLayers: {
              substations: substationsData.features || [],
              transmission: transmissionData.features || []
            },
            features: [...(substationsData.features || []), ...(transmissionData.features || [])]
          },
          timestamp: Date.now()
        });
      }

      // Load interconnection requests after infrastructure
      let interconnectionCount = 0;
      try {
        const interconnResponse = await fetch('/data/aep_ohio_interconnection_requests.geojson', { cache: 'no-cache' });
        if (interconnResponse.ok) {
          const interconnData = await interconnResponse.json();
          interconnectionCount = interconnData.features?.length || 0;
        }
      } catch (err) {
        console.warn('Could not fetch interconnection count:', err);
      }

      if (updateToolFeedback) {
        const totalFeatures = (substationsData.features?.length || 0) + (transmissionData.features?.length || 0);
        let details = `${substationsData.features?.length || 0} substations • ${transmissionData.features?.length || 0} transmission segments`;
        if (interconnectionCount > 0) {
          details += ` • ${interconnectionCount} interconnection requests`;
        }
        updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: '✅ AEP Ohio infrastructure loaded',
          progress: 100,
          details: details
        });
        setTimeout(() => {
          updateToolFeedback({ isActive: false, tool: null, status: '', progress: 0, details: '' });
        }, 3000);
      }

    } catch (error) {
      console.error('❌ OSM: Failed to load AEP Ohio infrastructure:', error);
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: '❌ Failed to load AEP Ohio data',
          progress: 0,
          details: error.message
        });
      }
    }
  }, [map, updateToolFeedback]);

  const handleClick = useCallback(async () => {
    console.log('🗺️ OSM Button Clicked:', {
      disabled,
      activeSite: activeSite?.key || null,
      locationKey,
      timestamp: new Date().toISOString()
    });

    if (disabled) {
      console.log('🗺️ OSM: Button is disabled, returning');
      return;
    }
    
    // For Columbus (default location) without activeSite, load AEP Ohio infrastructure
    if (!activeSite) {
      const locationConfig = getGeographicConfig(locationKey);
      console.log('🗺️ OSM: No activeSite, checking location config:', {
        locationKey,
        hasConfig: !!locationConfig,
        coordinates: locationConfig?.coordinates
      });

      const isAepOhioLocation = locationKey === 'default' || locationKey === 'columbus_metro';
      
      if (isAepOhioLocation && locationConfig?.coordinates) {
        console.log('🗺️ OSM: Loading AEP Ohio infrastructure for Columbus');
        await loadAepOhioInfrastructure();
        await loadAepOhioInterconnectionRequests();
        return;
      }

      // For other locations without activeSite, show message
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: 'ℹ️ OSM queries available',
          progress: 0,
          details: 'OSM data queries work with geographic coordinates. Site-specific layers require configuration.'
        });
        setTimeout(() => {
          updateToolFeedback({ isActive: false, tool: null, status: '', progress: 0, details: '' });
        }, 3000);
      }
      return;
    }

    console.log('🗺️ OSM: Loading site-specific infrastructure for:', activeSite.key);

    if (mountedSite?.key === activeSite.key) {
      removeActiveLayers();
      return;
    }

    removeActiveLayers();
    setIsLoading(true);
    if (onLoadingChange) {
      onLoadingChange(true);
    }
    if (updateToolFeedback) {
        // Updated: Removed Oklahoma-specific site type detection
        const siteType = NC_POWER_SITE_KEYS.has(activeSite?.key) ? 'NC' : 'AEP Ohio';
      updateToolFeedback({
        isActive: true,
        tool: 'osm',
        status: `🚀 Loading ${activeSite.shortName} infrastructure`,
        progress: 20,
          details: `Loading cached ${siteType} infrastructure layers`
      });
    }

    try {
      console.log('🗺️ OSM: Starting site layer load for:', activeSite.key);
      if (onClick) {
        onClick(`${activeSite.name} Infrastructure`);
      }

      const { featureCount, summary } = await addSiteLayers(activeSite);
      console.log('🗺️ OSM: Site layers loaded:', { featureCount, summary });

      // Archived: Oklahoma-specific marker and route loading removed
      // TODO: Add AEP Ohio-specific visualization if needed
      // Previous code loaded campus teardrop markers, pipelines, and transit paths for Oklahoma sites
      // These features are disabled for Columbus/AEP Ohio migration

      if (updateToolFeedback) {
        const categories = summary.categories || {};
        const categoryList = Object.keys(categories).length > 0
          ? Object.entries(categories).map(([k, v]) => `${k}:${v}`).join(', ')
          : 'power + water + utility layers';
        updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: `✅ Loaded ${activeSite.shortName}`,
          progress: 100,
          details: `${featureCount} features • ${categoryList}`
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
      console.error('❌ OSM: Infrastructure load failed:', error);
      removeActiveLayers();
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: '❌ Failed to load NC infrastructure cache',
          progress: 0,
          details: error.message
        });
      }
    } finally {
      setIsLoading(false);
      if (onLoadingChange) {
        onLoadingChange(false);
      }
    }
  }, [
    disabled,
    activeSite,
    mountedSite,
    removeActiveLayers,
    onLoadingChange,
    updateToolFeedback,
    onClick,
    addSiteLayers,
    addCampusTeardropMarkers,
    addGRDAPowerMarkers,
    addMarkerPipelines,
    addTransitPathLayers,
    loadAepOhioInfrastructure,
    loadAepOhioInterconnectionRequests
  ]);


  const buttonTitle = useMemo(() => {
    if (disabled) return 'Loading…';
    if (!activeSite) {
      // Updated: Removed Oklahoma location detection
      const isNcLocation = NC_POWER_SITE_KEYS.has(locationKey);
      // Default location is now Columbus, OH (AEP Ohio)
      const isAepOhioLocation = locationKey === 'default' || locationKey === 'columbus_metro';
      if (isNcLocation || isAepOhioLocation) {
        return `${isNcLocation ? 'North Carolina' : 'AEP Ohio'} OSM queries available`;
      }
      return 'OSM queries available when supported location is selected';
    }
    if (isLoading) {
      return `Loading ${activeSite.shortName} infrastructure…`;
    }
    if (mountedSite?.key === activeSite.key) {
      return `Hide ${activeSite.shortName} infrastructure layers`;
    }
    return `Load ${activeSite.shortName} infrastructure layers`;
  }, [disabled, activeSite, isLoading, mountedSite, locationKey]);

  return (
    <React.Fragment>
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          background: disabled
            ? 'rgba(0, 0, 0, 0.4)'
            : isLoading
            ? '#34D399'
            : mountedSite
            ? '#10b981'
            : isHovered
            ? `${color}ee`
            : `${color}cc`,
          border: disabled
            ? '1px solid rgba(0, 0, 0, 0.2)'
            : mountedSite
            ? '1px solid rgba(16, 185, 129, 0.6)'
            : `1px solid ${color}40`,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: disabled
            ? '0 1px 4px rgba(0, 0, 0, 0.1)'
            : mountedSite
            ? '0 3px 12px rgba(16, 185, 129, 0.35)'
            : isHovered
            ? `0 2px 8px ${color}40`
            : '0 1px 4px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.2s ease',
          zIndex: 1001,
          padding: '8px',
          opacity: disabled ? 0.6 : 1,
          animation: disabled || !isLoading ? 'none' : 'pinalButtonPulse 1.5s ease-out infinite'
        }}
        onClick={disabled ? undefined : handleClick}
        onMouseEnter={() => !disabled && !isLoading && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={buttonTitle}
      />
      {/* Gas, Hydro, and Wind Power Pulse Animations */}
      {mountedSite && map?.current && (gasPowerMarkers.length > 0 || hydroPowerMarkers.length > 0 || windPowerMarkers.length > 0) && (
        <GasHydroPowerPulseAnimations
          map={map}
          gasMarkers={gasPowerMarkers}
          hydroMarkers={hydroPowerMarkers}
          windMarkers={windPowerMarkers}
        />
      )}
      {/* Archived: Pryor and Stillwater Circle Animations - Oklahoma-specific */}
      {/* TODO: Add Columbus/AEP Ohio circle animations if needed */}
    </React.Fragment>
  );
};

export default OSMCall;
