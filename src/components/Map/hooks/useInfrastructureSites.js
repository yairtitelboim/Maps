import { useState, useCallback } from 'react';
import {
  OK_DATA_CENTER_SITE_KEYS
} from '../../../config/okDataCenterSites';
import {
  calculateDistanceKm,
  getFeatureCenter,
  addPowerPulseAnimation,
  addPipelineParticles,
  addTransportationParticles
} from '../osm/utils/layerAnimations';

const HOOK_MARKER_KEYS = [
  'pryor', 'stillwater', 'tulsa_suburbs', 'oge_substation_okc',
  'cimarron_link_tulsa', 'cimarron_link_panhandle', 'cushing',
  'tulsa_metro', 'okc_innovation_district', 'ardmore', 'inola', 'tinker_afb',
  'pensacola_dam', 'robert_s_kerr_dam', 'salina_pumped_storage',
  'wind_generation', 'redbud_power_plant'
];

const useInfrastructureSites = ({
  map,
  updateToolFeedback,
  onLayersCleared = () => {}
}) => {
  const [mountedSite, setMountedSite] = useState(null);

  const removeSiteLayers = useCallback((site) => {
    if (!map?.current || !site) return;
    const baseId = OK_DATA_CENTER_SITE_KEYS.has(site.key)
      ? `ok-data-center-${site.key}`
      : `nc-power-${site.key}`;

    const categoryLayers = [
      `${baseId}-power-point`, `${baseId}-power-point-halo`, `${baseId}-power-line`,
      `${baseId}-water-fill`, `${baseId}-water-line`, `${baseId}-water-point`,
      `${baseId}-university`,
      `${baseId}-office`,
      `${baseId}-transportation`,
      `${baseId}-transportation-lines`,
      `${baseId}-transportation-particles-layer`,
      `${baseId}-park`,
      `${baseId}-commercial`,
      `${baseId}-road`,
      `${baseId}-industrial-fill`, `${baseId}-industrial-point`,
      `${baseId}-critical`,
      `${baseId}-pipeline`,
      `${baseId}-pipeline-point`,
      `${baseId}-pipeline-particles-layer`,
      `${baseId}-other`,
      `${baseId}-radius`,
      `${baseId}-polygon`, `${baseId}-line`, `${baseId}-point`, `${baseId}-labels`
    ];

    categoryLayers.forEach(layerId => {
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
    });

    if (map.current.getSource(baseId)) {
      map.current.removeSource(baseId);
    }
    if (map.current.getSource(`${baseId}-radius`)) {
      map.current.removeSource(`${baseId}-radius`);
    }

    const transportationParticleSourceId = `${baseId}-transportation-particles`;
    if (map.current.getSource(transportationParticleSourceId)) {
      map.current.removeSource(transportationParticleSourceId);
    }
    if (window.okTransportationParticles && window.okTransportationParticles[baseId]) {
      cancelAnimationFrame(window.okTransportationParticles[baseId]);
      delete window.okTransportationParticles[baseId];
    }

    const pipelineParticleSourceId = `${baseId}-pipeline-particles`;
    if (map.current.getSource(pipelineParticleSourceId)) {
      map.current.removeSource(pipelineParticleSourceId);
    }
    if (window.okPipelineParticles && window.okPipelineParticles[baseId]) {
      cancelAnimationFrame(window.okPipelineParticles[baseId]);
      delete window.okPipelineParticles[baseId];
    }

    if (window.okPowerPulseAnimations && window.okPowerPulseAnimations[baseId]) {
      cancelAnimationFrame(window.okPowerPulseAnimations[baseId]);
      delete window.okPowerPulseAnimations[baseId];
    }
  }, [map]);

  const removeActiveLayers = useCallback(() => {
    if (!mountedSite) return;

    removeSiteLayers(mountedSite);
    setMountedSite(null);
    onLayersCleared();

    if (window.okCampusTeardropMarkers) {
      window.okCampusTeardropMarkers.forEach(marker => marker.remove());
      window.okCampusTeardropMarkers = [];
    }

    if (window.okGRDAPowerMarkers) {
      window.okGRDAPowerMarkers.forEach(marker => marker.remove());
      window.okGRDAPowerMarkers = [];
    }

    if (window.okCampusTeardropMarkersClickHandler && map?.current) {
      map.current.off('click', window.okCampusTeardropMarkersClickHandler);
      window.okCampusTeardropMarkersClickHandler = null;
    }

    if (map?.current) {
      HOOK_MARKER_KEYS.forEach(key => {
        const sourceId = `marker-pipeline-${key}`;
        const lineId = `marker-pipeline-${key}-line`;
        const pointId = `marker-pipeline-${key}-point`;

        if (map.current.getLayer(lineId)) {
          map.current.removeLayer(lineId);
        }
        if (map.current.getLayer(pointId)) {
          map.current.removeLayer(pointId);
        }
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }

        if (window.pipelineEndpointMarkers && window.pipelineEndpointMarkers[key]) {
          window.pipelineEndpointMarkers[key].forEach(marker => marker.remove());
          window.pipelineEndpointMarkers[key] = [];
        }
      });
    }

    if (window.mapEventBus) {
      const eventName = OK_DATA_CENTER_SITE_KEYS.has(mountedSite.key)
        ? 'ok-data-center:unmounted'
        : 'nc-power:unmounted';
      window.mapEventBus.emit(eventName, { siteKey: mountedSite.key });
      window.mapEventBus.emit('osm:dataCleared');
    }

    if (updateToolFeedback) {
      const siteType = OK_DATA_CENTER_SITE_KEYS.has(mountedSite.key) ? 'OK data center' : 'NC';
      updateToolFeedback({
        isActive: true,
        tool: 'osm',
        status: `🧹 ${siteType} infrastructure layers hidden`,
        progress: 100,
        details: `Click to reload local ${siteType} caches`
      });
      setTimeout(() => {
        updateToolFeedback({ isActive: false, tool: null, status: '', progress: 0, details: '' });
      }, 2200);
    }
  }, [map, mountedSite, removeSiteLayers, updateToolFeedback, onLayersCleared]);

  const addSiteLayers = useCallback(
    async site => {
      if (!map?.current) {
        throw new Error('Map instance not available');
      }

      const response = await fetch(site.dataPath, { cache: 'no-cache' });
      if (!response.ok) {
        const scriptName = OK_DATA_CENTER_SITE_KEYS.has(site.key)
          ? 'scripts/osm-tools/ok_data_center_osm.py'
          : 'scripts/osm-tools/nc_power_utility_osm.py';
        throw new Error(
          `Missing cache ${site.dataPath} (status ${response.status}). Run ${scriptName} to generate it.`
        );
      }
      const data = await response.json();
      let features = data.features || [];
      const baseId = OK_DATA_CENTER_SITE_KEYS.has(site.key)
        ? `ok-data-center-${site.key}`
        : `nc-power-${site.key}`;

      // Note: Individual marker pipeline data is now loaded separately via addMarkerPipelines()
      // This replaces the old expanded pipeline loading for Stillwater/Pryor
      // Filter out pipeline features from main OSM data - they're now loaded individually per marker
      if (OK_DATA_CENTER_SITE_KEYS.has(site.key)) {
        features = features.filter(f => f.properties?.category !== 'pipeline');
        console.log(`ℹ️ Filtered out pipeline features from main OSM data - using individual marker pipeline JSONs instead`);
      }

      // Calculate radius for water clipping (0.5x the analysis radius)
      const radiusKm = (site.radiusMeters || 8000) / 1000;
      const waterClipRadiusKm = radiusKm * 1.12; // 0.5x (half) the analysis radius
      const centerLat = site.coordinates.lat;
      const centerLon = site.coordinates.lng;
      
      // Filter water features to only include those within 0.5x the radius
      features = features.map(f => {
        // Only filter water features
        if (f.properties?.category === 'water') {
          const featureCenter = getFeatureCenter(f);
          if (featureCenter) {
            const distanceKm = calculateDistanceKm(centerLat, centerLon, featureCenter.lat, featureCenter.lon);
            // Exclude if beyond 0.5x radius
            if (distanceKm > waterClipRadiusKm) {
              return null; // Mark for removal
            }
          }
        }
        return f; // Keep all non-water features and water features within radius
      }).filter(f => f !== null); // Remove null entries

      map.current.addSource(baseId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features
        }
      });

      // Helper function to generate circle coordinates for perimeter
      const generateCircle = (centerLat, centerLng, radiusKm, points = 64) => {
        const coordinates = [];
        const radiusDegrees = radiusKm / 111.32;
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * 2 * Math.PI;
          const lat = centerLat + (radiusDegrees * Math.cos(angle));
          const lng = centerLng + (radiusDegrees * Math.sin(angle) / Math.cos(centerLat * Math.PI / 180));
          coordinates.push([lng, lat]);
        }
        return coordinates;
      };

      // Add analysis radius circle (dashed perimeter)
      // Note: radiusKm already calculated above for water filtering
      const circleCoordinates = generateCircle(site.coordinates.lat, site.coordinates.lng, radiusKm);
      const radiusCircle = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [circleCoordinates]
        },
        properties: {
          name: 'Analysis Radius',
          category: 'analysis_boundary'
        }
      };

      map.current.addSource(`${baseId}-radius`, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [radiusCircle]
        }
      });

        map.current.addLayer({
        id: `${baseId}-radius`,
        type: 'line',
        source: `${baseId}-radius`,
        paint: {
          'line-color': '#ef4444',
          'line-width': 2,
          'line-dasharray': [4, 4],
          'line-opacity': 0.8
        }
      });

      // Category-specific color mapping
      const categoryColors = {
        power: '#fbbf24', // Yellow/amber for power
        water: '#0ea5e9', // Blue for water
        university: '#dc2626', // Red for universities
        office: '#3b82f6', // Blue for offices
        transportation: '#f59e0b', // Orange for transportation
        park: '#10b981', // Green for parks
        commercial: '#8b5cf6', // Purple for commercial
        road: '#6b7280', // Gray for roads
        industrial: '#ef4444', // Red for industrial
        telecom: '#6366f1', // Indigo for telecom
        pipeline: '#1e3a8a', // Dark blue for pipelines (matches line color)
        critical: '#dc2626', // Red for critical infrastructure
        data_center: '#ec4899', // Pink for data centers
        utility: '#14b8a6', // Teal for utilities
        other: '#64748b' // Slate for other
      };

      // Collect features by category for staggered loading
      // Power infrastructure (points and lines)
      const powerFeatures = features.filter(f => 
        f.properties?.category === 'power' && 
        (f.geometry?.type === 'Point' || f.geometry?.type === 'LineString')
      );

      // Water infrastructure (already filtered to 0.5x radius in source data above)
      const waterFeatures = features.filter(f => 
        f.properties?.category === 'water'
      );

      // Universities
      const universityFeatures = features.filter(f => 
        f.properties?.category === 'university'
      );
      
      // Offices
      const officeFeatures = features.filter(f => 
        f.properties?.category === 'office'
      );
      
      // Transportation
      const transportationFeatures = features.filter(f => 
        f.properties?.category === 'transportation'
      );
      
      // Parks
      const parkFeatures = features.filter(f => 
        f.properties?.category === 'park' && 
        (f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')
      );
      
      // Commercial zones
      const commercialFeatures = features.filter(f => 
        f.properties?.category === 'commercial' && 
        (f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')
      );
      
      // Roads
      const roadFeatures = features.filter(f => 
        f.properties?.category === 'road'
      );
      
      // Industrial
      const industrialFeatures = features.filter(f => 
        f.properties?.category === 'industrial'
      );
      
      // Critical infrastructure
      const criticalFeatures = features.filter(f => 
        f.properties?.category === 'critical'
      );
      
      // Pipelines
      const pipelineFeatures = features.filter(f => 
        f.properties?.category === 'pipeline'
      );
      
      // Other features (fallback for uncategorized)
      const otherFeatures = features.filter(f => 
        !f.properties?.category || f.properties?.category === 'other'
      );

      // Helper function to add a single layer
      const addLayerWithConfig = (layerConfig) => {
        if (!map.current.getSource(baseId) || map.current.getLayer(layerConfig.id)) {
          return;
        }
        map.current.addLayer(layerConfig);
      };

      // Build layer loading sequence with delays
      const layerSequence = [];
      let delay = 0;

      if (powerFeatures.length > 0) {
        if (powerFeatures.some(f => f.geometry?.type === 'Point')) {
          // Add halo layer first (behind the main point)
          layerSequence.push({
            id: `${baseId}-power-point-halo`,
            delay: delay,
            config: {
              id: `${baseId}-power-point-halo`,
              type: 'circle',
              source: baseId,
              filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'category'], 'power']],
              paint: {
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['get', 'pulse_t'],
                  0, 8,
                  0.5, 16,
                  1, 8
                ],
                'circle-color': categoryColors.power,
                'circle-opacity': [
                  'interpolate',
                  ['linear'],
                  ['get', 'pulse_t'],
                  0, 0.2,
                  0.5, 0.4,
                  1, 0.2
                ],
                'circle-blur': 1.5
              }
            }
          });
          delay += 150;
          
          // Add main power point layer with pulse
          layerSequence.push({
            id: `${baseId}-power-point`,
            delay: delay,
            config: {
              id: `${baseId}-power-point`,
              type: 'circle',
              source: baseId,
              filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'category'], 'power']],
              paint: {
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['get', 'pulse_t'],
                  0, 4,
                  0.5, 6,
                  1, 4
                ],
                'circle-color': categoryColors.power,
                'circle-opacity': [
                  'interpolate',
                  ['linear'],
                  ['get', 'pulse_t'],
                  0, 0.6,
                  0.5, 0.9,
                  1, 0.6
                ],
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-opacity': 0.8
              }
            }
          });
          delay += 150;
        }
        if (powerFeatures.some(f => f.geometry?.type === 'LineString')) {
          layerSequence.push({
            id: `${baseId}-power-line`,
            delay: delay,
            config: {
              id: `${baseId}-power-line`,
              type: 'line',
              source: baseId,
              filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'category'], 'power']],
              paint: { 
                'line-color': categoryColors.power, 
                'line-width': 1, // Thinner lines (was 2)
                'line-opacity': 0.3 // 30% opacity for power lines (not the halo points)
              }
            }
          });
          delay += 150;
        }
      }

      if (waterFeatures.length > 0) {
        // Check for Polygon or MultiPolygon (large lakes/reservoirs can be MultiPolygon)
        if (waterFeatures.some(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')) {
          layerSequence.push({
            id: `${baseId}-water-fill`,
            delay: delay,
            config: {
              id: `${baseId}-water-fill`,
          type: 'fill',
          source: baseId,
              filter: ['all', 
                ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]], 
                ['==', ['get', 'category'], 'water']
              ],
              paint: { 'fill-color': categoryColors.water, 'fill-opacity': 0.25 } // 25% opacity - very light blue fill for reservoirs
            }
          });
          delay += 150;
        }
        if (waterFeatures.some(f => f.geometry?.type === 'LineString')) {
          layerSequence.push({
            id: `${baseId}-water-line`,
            delay: delay,
            config: {
              id: `${baseId}-water-line`,
              type: 'line',
              source: baseId,
              filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'category'], 'water']],
              paint: { 'line-color': categoryColors.water, 'line-width': 2, 'line-opacity': 0.3 } // 30% opacity - very light water lines
            }
          });
          delay += 150;
        }
        if (waterFeatures.some(f => f.geometry?.type === 'Point')) {
          layerSequence.push({
            id: `${baseId}-water-point`,
            delay: delay,
            config: {
              id: `${baseId}-water-point`,
              type: 'circle',
              source: baseId,
              filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'category'], 'water']],
              paint: { 'circle-radius': 3, 'circle-color': categoryColors.water, 'circle-opacity': 0.3 } // 30% opacity - very light water points
            }
          });
          delay += 150;
        }
      }

      if (universityFeatures.length > 0) {
        layerSequence.push({
          id: `${baseId}-university`,
          delay: delay,
          config: {
            id: `${baseId}-university`,
            type: 'circle',
            source: baseId,
            filter: ['==', ['get', 'category'], 'university'],
            paint: { 'circle-radius': 8, 'circle-color': categoryColors.university, 'circle-opacity': 0.7 }
          }
        });
        delay += 150;
      }

      if (officeFeatures.length > 0) {
        layerSequence.push({
          id: `${baseId}-office`,
          delay: delay,
          config: {
            id: `${baseId}-office`,
            type: 'circle',
            source: baseId,
            filter: ['==', ['get', 'category'], 'office'],
            paint: { 'circle-radius': 5, 'circle-color': categoryColors.office, 'circle-opacity': 0.5 }
          }
        });
        delay += 150;
      }

      if (transportationFeatures.length > 0) {
        // Check if this is Stillwater - use dark blue for transportation
        const isStillwater = site.key === 'google_stillwater_ok';
        const transportationColor = isStillwater ? '#1e3a8a' : categoryColors.transportation; // Dark blue for Stillwater
        
        layerSequence.push({
          id: `${baseId}-transportation`,
          delay: delay,
          config: {
            id: `${baseId}-transportation`,
            type: 'circle',
            source: baseId,
            filter: ['==', ['get', 'category'], 'transportation'],
            paint: { 'circle-radius': 4, 'circle-color': transportationColor, 'circle-opacity': 0.6 }
          }
        });
        delay += 150;
        
        // Add transportation route lines layer for Stillwater (if there are line features)
        const transportationLines = features.filter(f => 
          f.properties?.category === 'transportation' && 
          f.geometry?.type === 'LineString'
        );
        
        if (isStillwater && transportationLines.length > 0) {
          layerSequence.push({
            id: `${baseId}-transportation-lines`,
            delay: delay,
            config: {
              id: `${baseId}-transportation-lines`,
              type: 'line',
              source: baseId,
              filter: ['all', 
                ['==', ['geometry-type'], 'LineString'], 
                ['==', ['get', 'category'], 'transportation']
              ],
          paint: {
                'line-color': '#1e3a8a', // Dark blue
                'line-width': 2, 
                'line-opacity': 0.8 
              }
            }
          });
          delay += 150;
        }
      }

      if (parkFeatures.length > 0) {
        layerSequence.push({
          id: `${baseId}-park`,
          delay: delay,
          config: {
            id: `${baseId}-park`,
            type: 'fill',
            source: baseId,
            filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'category'], 'park']],
            paint: { 'fill-color': categoryColors.park, 'fill-opacity': 0.3 }
          }
        });
        delay += 150;
      }

      if (commercialFeatures.length > 0) {
        layerSequence.push({
          id: `${baseId}-commercial`,
          delay: delay,
          config: {
            id: `${baseId}-commercial`,
            type: 'fill',
            source: baseId,
            filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'category'], 'commercial']],
            paint: { 'fill-color': categoryColors.commercial, 'fill-opacity': 0.3 }
          }
        });
        delay += 150;
      }

      if (roadFeatures.length > 0) {
        layerSequence.push({
          id: `${baseId}-road`,
          delay: delay,
          config: {
            id: `${baseId}-road`,
            type: 'line',
            source: baseId,
            filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'category'], 'road']],
            paint: { 'line-color': categoryColors.road, 'line-width': 2, 'line-opacity': 0.6 }
          }
        });
        delay += 150;
      }

      if (industrialFeatures.length > 0) {
        if (industrialFeatures.some(f => f.geometry?.type === 'Polygon')) {
          layerSequence.push({
            id: `${baseId}-industrial-fill`,
            delay: delay,
            config: {
              id: `${baseId}-industrial-fill`,
              type: 'fill',
              source: baseId,
              filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'category'], 'industrial']],
              paint: { 'fill-color': categoryColors.industrial, 'fill-opacity': 0.25 }
            }
          });
          delay += 150;
        }
        if (industrialFeatures.some(f => f.geometry?.type === 'Point')) {
          layerSequence.push({
            id: `${baseId}-industrial-point`,
            delay: delay,
            config: {
              id: `${baseId}-industrial-point`,
              type: 'circle',
              source: baseId,
              filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'category'], 'industrial']],
              paint: { 'circle-radius': 5, 'circle-color': categoryColors.industrial, 'circle-opacity': 0.6 }
            }
          });
          delay += 150;
        }
      }

      if (criticalFeatures.length > 0) {
        layerSequence.push({
          id: `${baseId}-critical`,
          delay: delay,
          config: {
            id: `${baseId}-critical`,
            type: 'circle',
            source: baseId,
            filter: ['==', ['get', 'category'], 'critical'],
            paint: { 'circle-radius': 7, 'circle-color': categoryColors.critical, 'circle-opacity': 0.8 }
          }
        });
        delay += 150;
      }

      if (pipelineFeatures.length > 0) {
        // Check if this is Stillwater pipeline - should be hidden by default
        const isStillwater = site.key === 'google_stillwater_ok';
        const pipelineVisibility = isStillwater ? 'none' : 'visible';
        
        // Different shades of blue for different pipeline types
        // Dark blue palette: #1e3a8a (darkest) -> #1e40af -> #2563eb -> #3b82f6 -> #60a5fa (lightest)
        layerSequence.push({
          id: `${baseId}-pipeline`,
          delay: delay,
          config: {
            id: `${baseId}-pipeline`,
            type: 'line',
            source: baseId,
            filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'category'], 'pipeline']],
            paint: { 
              // Color by pipeline type with different shades of blue
              // Properties are already flattened in the feature, so check direct properties
              'line-color': [
                'case',
                // Oil pipelines - darkest blue (#1e3a8a)
                ['any',
                  ['==', ['get', 'pipeline_type'], 'oil'],
                  ['==', ['get', 'substance'], 'oil'],
                  ['==', ['get', 'man_made'], 'petroleum_well']
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
                // NGL/Fuel pipelines - light blue (#60a5fa)
                ['any',
                  ['==', ['get', 'substance'], 'ngl'],
                  ['==', ['get', 'substance'], 'fuel']
                ], '#60a5fa',
                // General pipelines - default dark blue (#1e3a8a)
                '#1e3a8a'
              ],
              'line-width': 1.5, // Half the original thickness (was 3)
              'line-opacity': 0.9 // Solid, more opaque
              // Removed 'line-dasharray' to make it solid
            },
            layout: { visibility: pipelineVisibility }
          }
        });
        delay += 150;
        
        // Add pipeline point markers (valves, wells, substations, etc.)
        if (pipelineFeatures.some(f => f.geometry?.type === 'Point')) {
          layerSequence.push({
            id: `${baseId}-pipeline-point`,
            delay: delay,
            config: {
              id: `${baseId}-pipeline-point`,
              type: 'circle',
              source: baseId,
              filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'category'], 'pipeline']],
              paint: {
                // Size by marker type - much larger for visibility
                'circle-radius': [
                  'case',
                  // Petroleum wells - largest (20px)
                  ['==', ['get', 'man_made'], 'petroleum_well'], 20,
                  // Valves, substations, pig launchers - large (18px)
                  ['any',
                    ['==', ['get', 'pipeline_type'], 'valve'],
                    ['==', ['get', 'pipeline_type'], 'substation'],
                    ['==', ['get', 'pipeline_type'], 'pig_launcher'],
                    ['==', ['get', 'man_made'], 'pipeline_substation']
                  ], 18,
                  // Pipeline markers - large (16px)
                  ['==', ['get', 'man_made'], 'pipeline_marker'], 16,
                  // General pipeline points - medium-large (14px)
                  14
                ],
                // Color by pipeline type with different shades of blue (matching lines)
                'circle-color': [
                  'case',
                  // Oil pipelines - darkest blue (#1e3a8a)
                  ['any',
                    ['==', ['get', 'pipeline_type'], 'oil'],
                    ['==', ['get', 'substance'], 'oil'],
                    ['==', ['get', 'man_made'], 'petroleum_well']
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
                  // NGL/Fuel pipelines - light blue (#60a5fa)
                  ['any',
                    ['==', ['get', 'substance'], 'ngl'],
                    ['==', ['get', 'substance'], 'fuel']
                  ], '#60a5fa',
                  // General pipelines - default dark blue (#1e3a8a)
                  '#1e3a8a'
                ],
                'circle-opacity': 0.8
              },
              layout: { visibility: pipelineVisibility }
            }
          });
          delay += 150;
        }
      }

      if (otherFeatures.length > 0 && otherFeatures.some(f => f.geometry?.type === 'Point')) {
        layerSequence.push({
          id: `${baseId}-other`,
          delay: delay,
          config: {
            id: `${baseId}-other`,
          type: 'circle',
          source: baseId,
            filter: ['all',
              ['==', '$type', 'Point'],
              ['any',
                ['!', ['has', 'category']],
                ['==', ['get', 'category'], 'other']
              ]
            ],
            paint: { 'circle-radius': 2, 'circle-color': categoryColors.other, 'circle-opacity': 0.3 }
          }
        });
      }

      // Start staggered loading
      layerSequence.forEach(layerItem => {
        setTimeout(() => {
          addLayerWithConfig(layerItem.config);
        }, layerItem.delay);
      });

      // Add pulse animation for power points
      const powerPoints = features.filter(f => 
        f.properties?.category === 'power' && 
        f.geometry?.type === 'Point'
      );
      
      if (powerPoints.length > 0) {
        setTimeout(() => {
          addPowerPulseAnimation(map, baseId, powerPoints);
        }, delay + 300);
      }

      // Add animated particles for Stillwater transportation routes
      const isStillwater = site.key === 'google_stillwater_ok';
      if (isStillwater) {
        // Collect all transportation line features
        const transportationLines = features.filter(f => 
          f.properties?.category === 'transportation' && 
          f.geometry?.type === 'LineString' &&
          f.geometry?.coordinates?.length > 1
        );
        
        // Also collect road line features for particle animation
        const roadLines = features.filter(f => 
          f.properties?.category === 'road' && 
          f.geometry?.type === 'LineString' &&
          f.geometry?.coordinates?.length > 1
        );
        
        // Combine all line features for particle animation
        const allTransportLines = [...transportationLines, ...roadLines];
        
        if (allTransportLines.length > 0) {
          // Start particle animation after layers are loaded
          setTimeout(() => {
            addTransportationParticles(map, baseId, allTransportLines);
          }, delay + 300); // Start after all layers are loaded
        }
      }

      // Add animated particles for pipeline routes (for all OK data center sites)
      if (OK_DATA_CENTER_SITE_KEYS.has(site.key)) {
        // Collect all pipeline line features
        const pipelineLines = features.filter(f => 
          f.properties?.category === 'pipeline' && 
          f.geometry?.type === 'LineString' &&
          f.geometry?.coordinates?.length > 1
        );
        
        if (pipelineLines.length > 0) {
          // Start particle animation after layers are loaded
          setTimeout(() => {
            addPipelineParticles(map, baseId, pipelineLines);
          }, delay + 400); // Start after all layers are loaded (slightly after transportation)
        }
      }

      // Recalculate category counts after merging expanded pipeline data
      const categoryCounts = {};
      features.forEach(feature => {
        const category = feature.properties?.category || 'other';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });

      setMountedSite(site);
      if (window.mapEventBus) {
        const eventName = OK_DATA_CENTER_SITE_KEYS.has(site.key)
          ? 'ok-data-center:mounted'
          : 'nc-power:mounted';
        const summary = data.summary || {};
        // Use recalculated category counts that include expanded pipeline data
        window.mapEventBus.emit(eventName, {
          siteKey: site.key,
          featureCount: features.length,
          summary: {
            ...summary,
            categories: categoryCounts, // Use recalculated counts
            feature_count: features.length // Update total feature count
          },
          categories: categoryCounts, // Use recalculated counts
          site: site
        });
      }

      if (map.current) {
        map.current.flyTo({
          center: [site.coordinates.lng, site.coordinates.lat],
          zoom: 12.5,
          speed: 0.8,
          curve: 1.4,
          essential: true
        });
      }

      return {
        featureCount: features.length,
        summary: {
          ...(data.summary || {}),
          categories: categoryCounts, // Use recalculated counts
          feature_count: features.length // Update total feature count
        }
      };
    },
    [map]
  );

  return {
    mountedSite,
    setMountedSite,
    addSiteLayers,
    removeActiveLayers
  };
};

export default useInfrastructureSites;
