import React, { useState, useEffect, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { generateCircleCoordinates } from '../../../../utils/whitneyMapUtils';
import WHITNEY_SITES from '../../../../data/whitneySites';
import { resolveCoordinatesForSites } from '../../../../utils/geocodeSites';
import { createWhitneyMarker } from './utils/whitneyMarkers';

import { WHITNEY_ZONES } from '../../../../config/whitneyConfig';

const OSMCallCached = ({ 
  onClick, 
  title = "Liberty Infrastructure Analysis",
  color = "#059669",
  size = "10px",
  position = { top: '-25px', left: 'calc(98% + 20px)' },
  aiState = null,
  map = null,
  onLoadingChange = null,
  disabled = false,
  updateToolFeedback = null,
  locationKey = 'default'
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cachedData, setCachedData] = useState(null);

  // Load cached data from public folder
  const loadCachedData = useCallback(async () => {
    try {
      console.log('📁 Loading Liberty cached data from public folder...');
      const response = await fetch('/whitney-cache.json');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Liberty cached data loaded successfully');
      console.log(`📊 Loaded ${data.features?.length || 0} features`);
      
      setCachedData(data);
      return data;
    } catch (error) {
      console.error('❌ Failed to load Liberty cached data:', error);
      return null;
    }
  }, []);

  // Load cached data on component mount
  useEffect(() => {
    loadCachedData();
  }, [loadCachedData]);


  // Function to add Liberty infrastructure to map with sequence animation
  const addLibertyInfrastructureToMap = async (features, marker) => {
    try {
      if (features.length === 0) {
        console.log('⚠️ No Liberty infrastructure features found');
        return;
      }
      
      // Remove any existing OSM layers and sources
      const layersToRemove = [
        'osm-features-fill',
        'osm-features-lines', 
        'osm-pois',
        'osm-highway-junctions'
      ];
      
      layersToRemove.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });
      
      // Remove sources after layers are removed
      if (map.current.getSource('osm-features')) {
        map.current.removeSource('osm-features');
      }
      
      // Add Liberty infrastructure features to the map
      const whitneyGeoJSON = {
        type: 'FeatureCollection',
        features: features
      };
      
      // Check if source already exists before adding
      if (!map.current.getSource('osm-features')) {
        map.current.addSource('osm-features', {
          type: 'geojson',
          data: whitneyGeoJSON
        });
      } else {
        // Update existing source data
        map.current.getSource('osm-features').setData(whitneyGeoJSON);
      }
      
      // Sequence animation timing configuration
      const animationSequence = {
        // Phase 1: Infrastructure layers (0-2000ms)
        infrastructure: {
          lines: { delay: 0, duration: 800 },
          fill: { delay: 200, duration: 800 },
          pois: { delay: 400, duration: 800 },
          junctions: { delay: 600, duration: 800 }
        },
        // Phase 2: Zone circles (2000-4000ms)
        zones: {
          data_center: { delay: 2000, duration: 1000 },
          downtown: { delay: 2500, duration: 1000 },
          lake_whitney: { delay: 3000, duration: 1000 }
        },
        // Phase 3: Key sites (4000-6000ms)
        keySites: { delay: 4000, duration: 1500 }
      };

      // Phase 1: Animate infrastructure layers in sequence
      console.log('🎬 Starting Liberty infrastructure sequence animation...');
      
      // 1. Lines layer (0ms delay)
      setTimeout(() => {
        if (!map.current.getLayer('osm-features-lines')) {
          map.current.addLayer({
            id: 'osm-features-lines',
            type: 'line',
            source: 'osm-features',
            paint: {
              'line-color': [
                'case',
                ['==', ['get', 'category'], 'office_building'], '#059669',
                ['==', ['get', 'category'], 'commercial_building'], '#0ea5e9',
                ['==', ['get', 'category'], 'retail_building'], '#3b82f6',
                ['==', ['get', 'category'], 'government_facility'], '#dc2626',
                ['==', ['get', 'category'], 'education'], '#7c3aed',
                ['==', ['get', 'category'], 'healthcare'], '#ef4444',
                ['==', ['get', 'category'], 'emergency_services'], '#dc2626',
                ['==', ['get', 'category'], 'transit_hub'], '#10b981',
                ['==', ['get', 'category'], 'highway_access'], '#6b7280',
                ['==', ['get', 'category'], 'recreation_area'], '#22c55e',
                ['==', ['get', 'category'], 'industrial'], '#8b5cf6',
                '#6b7280'
              ],
              'line-width': [
                'case',
                ['==', ['get', 'priority'], 3], 3,
                ['==', ['get', 'priority'], 2], 2,
                1
              ],
              'line-opacity': 0
            }
          });
          
          // Animate line opacity
          let lineOpacity = 0;
          const lineAnimation = () => {
            lineOpacity += 0.05;
            if (lineOpacity <= 0.8) {
              map.current.setPaintProperty('osm-features-lines', 'line-opacity', lineOpacity);
              requestAnimationFrame(lineAnimation);
            }
          };
          requestAnimationFrame(lineAnimation);
          
          console.log('✅ Lines layer animated in');
        }
      }, animationSequence.infrastructure.lines.delay);

      // 2. Fill layer (200ms delay)
      setTimeout(() => {
        if (!map.current.getLayer('osm-features-fill')) {
          map.current.addLayer({
            id: 'osm-features-fill',
            type: 'fill',
            source: 'osm-features',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: {
              'fill-color': [
                'case',
                ['==', ['get', 'category'], 'office_building'], 'rgba(5, 150, 105, 0.2)',
                ['==', ['get', 'category'], 'commercial_building'], 'rgba(14, 165, 233, 0.2)',
                ['==', ['get', 'category'], 'retail_building'], 'rgba(59, 130, 246, 0.2)',
                ['==', ['get', 'category'], 'government_facility'], 'rgba(220, 38, 38, 0.2)',
                ['==', ['get', 'category'], 'education'], 'rgba(124, 58, 237, 0.2)',
                ['==', ['get', 'category'], 'healthcare'], 'rgba(239, 68, 68, 0.2)',
                ['==', ['get', 'category'], 'emergency_services'], 'rgba(220, 38, 38, 0.2)',
                ['==', ['get', 'category'], 'recreation_area'], 'rgba(34, 197, 94, 0.2)',
                ['==', ['get', 'category'], 'industrial'], 'rgba(139, 92, 246, 0.2)',
                'rgba(107, 114, 128, 0.05)'
              ],
              'fill-opacity': 0
            }
          });
          
          // Animate fill opacity
          let fillOpacity = 0;
          const fillAnimation = () => {
            fillOpacity += 0.05;
            if (fillOpacity <= 0.3) {
              map.current.setPaintProperty('osm-features-fill', 'fill-opacity', fillOpacity);
              requestAnimationFrame(fillAnimation);
            }
          };
          requestAnimationFrame(fillAnimation);
          
          console.log('✅ Fill layer animated in');
        }
      }, animationSequence.infrastructure.fill.delay);

      // 3. POI markers (400ms delay)
      setTimeout(() => {
        if (!map.current.getLayer('osm-pois')) {
          map.current.addLayer({
            id: 'osm-pois',
            type: 'circle',
            source: 'osm-features',
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
              'circle-radius': [
                'case',
                ['==', ['get', 'priority'], 3], 8,
                ['==', ['get', 'priority'], 2], 6,
                4
              ],
              'circle-color': [
                'case',
                ['==', ['get', 'category'], 'government_facility'], '#dc2626',
                ['==', ['get', 'category'], 'education'], '#7c3aed',
                ['==', ['get', 'category'], 'healthcare'], '#ef4444',
                ['==', ['get', 'category'], 'emergency_services'], '#dc2626',
                ['==', ['get', 'category'], 'transit_hub'], '#10b981',
                '#059669'
              ],
              'circle-opacity': 0
            }
          });
          
          // Animate POI opacity
          let poiOpacity = 0;
          const poiAnimation = () => {
            poiOpacity += 0.1;
            if (poiOpacity <= 1) {
              map.current.setPaintProperty('osm-pois', 'circle-opacity', poiOpacity);
              requestAnimationFrame(poiAnimation);
            }
          };
          requestAnimationFrame(poiAnimation);
          
          console.log('✅ POI markers animated in');
        }
      }, animationSequence.infrastructure.pois.delay);

      // 4. Highway junctions (600ms delay)
      setTimeout(() => {
        if (!map.current.getLayer('osm-highway-junctions')) {
          map.current.addLayer({
            id: 'osm-highway-junctions',
            type: 'circle',
            source: 'osm-features',
            filter: ['==', ['get', 'category'], 'highway_junction'],
            paint: {
              'circle-radius': 8,
              'circle-color': '#dc2626',
              'circle-opacity': 0
            }
          });
          
          // Animate junction opacity
          let junctionOpacity = 0;
          const junctionAnimation = () => {
            junctionOpacity += 0.1;
            if (junctionOpacity <= 1) {
              map.current.setPaintProperty('osm-highway-junctions', 'circle-opacity', junctionOpacity);
              requestAnimationFrame(junctionAnimation);
            }
          };
          requestAnimationFrame(junctionAnimation);
          
          console.log('✅ Highway junctions animated in');
        }
      }, animationSequence.infrastructure.junctions.delay);
      
      console.log('✅ Added', features.length, 'Liberty infrastructure features to map');
      
      // Phase 2: Animate zone circles in sequence (2000-4000ms)
      console.log('🎬 Starting zone circles sequence animation...');
      
      const orderedZones = ['data_center', 'downtown', 'lake_whitney'];
      
      orderedZones.forEach((zoneKey, index) => {
        const zone = WHITNEY_ZONES[zoneKey];
        const zoneCircle = {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [generateCircleCoordinates(zone.lat, zone.lng, zone.radius / 1000, 64)]
          },
          properties: {
            name: zone.name,
            category: 'fifa_zone',
            zone: zoneKey,
            focus: zone.focus
          }
        };

        // Add zone source
        if (!map.current.getSource(`whitney-zone-${zoneKey}`)) {
          map.current.addSource(`whitney-zone-${zoneKey}`, {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [zoneCircle]
            }
          });
        } else {
          map.current.getSource(`whitney-zone-${zoneKey}`).setData({
            type: 'FeatureCollection',
            features: [zoneCircle]
          });
        }

        // Animate zone circle appearance
        setTimeout(() => {
          // Add circle line with animation
          if (!map.current.getLayer(`whitney-zone-${zoneKey}-circle`)) {
            map.current.addLayer({
              id: `whitney-zone-${zoneKey}-circle`,
              type: 'line',
              source: `whitney-zone-${zoneKey}`,
              paint: {
                'line-color': [
                  'case',
                  ['==', ['get', 'zone'], 'data_center'], '#059669',
                  ['==', ['get', 'zone'], 'downtown'], '#7c3aed',
                  '#0ea5e9'
                ],
                'line-width': 3,
                'line-dasharray': [6, 3],
                'line-opacity': 0
              }
            });
            
            // Animate line opacity
            let zoneLineOpacity = 0;
            const zoneLineAnimation = () => {
              zoneLineOpacity += 0.05;
              if (zoneLineOpacity <= 0.8) {
                map.current.setPaintProperty(`whitney-zone-${zoneKey}-circle`, 'line-opacity', zoneLineOpacity);
                requestAnimationFrame(zoneLineAnimation);
              }
            };
            requestAnimationFrame(zoneLineAnimation);
          }

          // Add circle fill with animation
          if (!map.current.getLayer(`whitney-zone-${zoneKey}-fill`)) {
            map.current.addLayer({
              id: `whitney-zone-${zoneKey}-fill`,
              type: 'fill',
              source: `whitney-zone-${zoneKey}`,
              paint: {
                'fill-color': [
                  'case',
                  ['==', ['get', 'zone'], 'data_center'], 'rgba(5, 150, 105, 0.1)',
                  ['==', ['get', 'zone'], 'downtown'], 'rgba(124, 58, 237, 0.1)',
                  'rgba(14, 165, 233, 0.1)'
                ],
                'fill-opacity': 0
              }
            });
            
            // Animate fill opacity
            let zoneFillOpacity = 0;
            const zoneFillAnimation = () => {
              zoneFillOpacity += 0.05;
              if (zoneFillOpacity <= 0.2) {
                map.current.setPaintProperty(`whitney-zone-${zoneKey}-fill`, 'fill-opacity', zoneFillOpacity);
                requestAnimationFrame(zoneFillAnimation);
              }
            };
            requestAnimationFrame(zoneFillAnimation);
          }
          
          console.log(`✅ Zone ${zoneKey} animated in`);
        }, animationSequence.zones[zoneKey].delay);
      });

      // Phase 3: Animate key sites in sequence (4000-6000ms)
      setTimeout(async () => {
      console.log('🎬 Starting key sites sequence animation...');
        
        try {
          console.log('🏷️ Resolving coordinates for key Liberty sites...', { count: WHITNEY_SITES.length });
          
          const resolvedSites = await resolveCoordinatesForSites(WHITNEY_SITES, { forceRefresh: false, parallelLimit: 1 });
          const validSites = resolvedSites.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
          
          if (validSites.length > 0) {
            // Remove any previous DOM markers
            try {
              if (typeof window !== 'undefined' && window.libertySiteMarkers) {
                Object.values(window.libertySiteMarkers).forEach(m => { try { m.remove(); } catch(e) {} });
              }
            } catch (e) {}
            if (typeof window !== 'undefined') window.libertySiteMarkers = {};

            // Create simple Mapbox markers (like the red one) for each site with staggered animation
            validSites.forEach((site, index) => {
              setTimeout(() => {
                // Create simple Mapbox marker (same style as red marker)
                const marker = new mapboxgl.Marker({ 
                  color: '#ef4444', // Red color like the main marker
                  scale: 1.0,
                  anchor: 'center'
                })
                  .setLngLat([site.lng, site.lat])
                  .addTo(map.current);
                
                // Add title for hover
                marker.getElement().title = site.name;

                // Add click handler
                marker.getElement().addEventListener('click', () => {
                  if (window.mapEventBus) {
                    window.mapEventBus.emit('marker:clicked', {
                      id: site.id,
                      name: site.name,
                      type: 'Key Site',
                      category: site.provider || 'Infrastructure Site',
                      coordinates: [site.lng, site.lat],
                      formatter: 'whitney',
                      zonesAnalyzed: 3,
                      cachedDataAvailable: !!cachedData,
                      analysisStatus: `${site.city || ''}${site.city ? ', ' : ''}${site.state || ''}`,
                      provider: site.provider,
                      confidence: (Number(site.confidence) * 100).toFixed(0) + '%',
                      lastVerified: new Date(site.lastVerified).toLocaleString()
                    });
                  }
                });

                if (typeof window !== 'undefined') {
                  window.libertySiteMarkers[site.id] = marker;
                }
              }, index * 200); // Stagger each site by 200ms
            });

            console.log('✅ Added key site emoji markers with animation:', validSites.length);
          }
        } catch (e) {
          console.warn('⚠️ Failed to add key sites layer', e);
        }
      }, animationSequence.keySites.delay);
      
      console.log('✅ Liberty analysis complete with cached data');
      
      // Emit analysis complete event for legend
      if (window.mapEventBus) {
        window.mapEventBus.emit('liberty:analysisComplete', {
          features: features,
          summary: {
            office_building: features.filter(f => f.properties.category === 'office_building').length,
            commercial_building: features.filter(f => f.properties.category === 'commercial_building').length,
            retail_building: features.filter(f => f.properties.category === 'retail_building').length,
            government_facility: features.filter(f => f.properties.category === 'government_facility').length,
            education: features.filter(f => f.properties.category === 'education').length,
            healthcare: features.filter(f => f.properties.category === 'healthcare').length,
            industrial: features.filter(f => f.properties.category === 'industrial').length,
            power_facility: features.filter(f => f.properties.category === 'power_facility').length,
            county_boundary: 1
          },
          zones_queried: Object.keys(WHITNEY_ZONES),
          totalFeatures: features.length,
          timestamp: Date.now()
        });
      }
      
    } catch (error) {
      console.error('❌ Error adding Whitney infrastructure to map:', error);
      throw error;
    }
  };

  const handleClick = async (event) => {
    if (isLoading || !cachedData) return;
    
    // Clear previous OSM data from legend
    if (window.mapEventBus) {
      window.mapEventBus.emit('osm:dataCleared');
      window.mapEventBus.emit('liberty:analysisCleared');
      window.mapEventBus.emit('osm:loading');
    }

    
    setIsLoading(true);
    if (onLoadingChange) {
      onLoadingChange(true);
    }
    
    try {
      const city = 'Liberty';
      const state = 'NC';
      
      // Start Liberty analysis feedback
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: '🚀 Starting Liberty infrastructure analysis...',
          progress: 10,
          details: `Loading cached data for ${city}, ${state}`
        });
      }
      
      // Call the original onClick if provided
      if (onClick) {
        onClick('Liberty Infrastructure Analysis');
      }
      
      // Toggle on Irrigation Districts and Well Registry layers when Whitney analysis starts
      if (window.mapEventBus) {
        window.mapEventBus.emit('irrigation:toggle', true);
        window.mapEventBus.emit('well-registry:toggle', true);
        window.mapEventBus.emit('r3-data:toggle', true);
      }
      
      // Toggle on Roads layer 1 second after the other toggles
      setTimeout(() => {
        if (window.mapEventBus) {
          window.mapEventBus.emit('main-roads:toggle', true);
        }
      }, 1000);
      
      // Phase 1: Create central marker for Liberty
      if (map?.current) {
        try {
          // Use Liberty focus coordinates as the central marker
          const dataCenter = WHITNEY_ZONES.data_center;
          const lat = dataCenter.lat;
          const lng = dataCenter.lng;
          
          // Remove any existing site marker
          if (map.current.getLayer('site-marker')) {
            map.current.removeLayer('site-marker');
          }
          
          if (map.current.getSource('site-marker')) {
            map.current.removeSource('site-marker');
          }
          
          // Create a marker using utility function
          const marker = createWhitneyMarker(map.current, lng, lat, cachedData);
          
          // Auto-trigger Liberty popup after a short delay
          setTimeout(() => {
            if (window.mapEventBus) {
              window.mapEventBus.emit('marker:clicked', {
                id: 'liberty-marker',
                name: 'Liberty Focus Area',
                type: 'Liberty Infrastructure',
                category: 'North Carolina Development',
                coordinates: [lng, lat],
                formatter: 'pinal',
                zonesAnalyzed: 3,
                cachedDataAvailable: !!cachedData,
                analysisStatus: 'Analyzing infrastructure...',
                isAutomatic: true
              });
            }
          }, 3000);
          
          // Add larger pulsing green circle around Liberty marker
          console.log('🏞️ Adding larger pulsing green circle around Liberty marker...');
          
          // Remove existing Liberty large pulse layer if it exists
          if (map.current.getLayer('liberty-pulse-large')) {
            map.current.removeLayer('liberty-pulse-large');
          }
          if (map.current.getSource('liberty-pulse-large')) {
            map.current.removeSource('liberty-pulse-large');
          }

          // Create larger pulsing circle with animation properties
          const largeRadiusKm = 4.2; // Triple the radius
          const whitneyLargePulseCircle = turf.circle([lng, lat], largeRadiusKm, { 
            steps: 80, 
            units: 'kilometers',
            properties: { 
              name: 'Liberty Large Pulse Circle',
              pulse: 0
            }
          });

          // Add large pulse source
          map.current.addSource('liberty-pulse-large', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [whitneyLargePulseCircle]
            }
          });

          // Add larger pulsing fill layer
          map.current.addLayer({
            id: 'liberty-pulse-large',
            type: 'fill',
            source: 'liberty-pulse-large',
            paint: {
              'fill-color': '#10b981',
              'fill-opacity': 0.03
            },
            layout: { visibility: 'visible' },
            maxzoom: 18
          });

          // Start large pulse animation
          let whitneyLargePulseValue = 0;
          const whitneyLargePulseSpeed = 0.0008;
          let whitneyLargeAnimationId = null;
          
          const whitneyLargePulseAnimation = () => {
            try {
              whitneyLargePulseValue = (whitneyLargePulseValue + whitneyLargePulseSpeed) % 1;
              
              if (map.current.getLayer('liberty-pulse-large')) {
                const sineValue = Math.abs(Math.sin(whitneyLargePulseValue * Math.PI * 2));
                const opacity = 0.03 + (sineValue * 0.12);
                
                map.current.setPaintProperty('liberty-pulse-large', 'fill-opacity', opacity);
              } else {
                if (whitneyLargeAnimationId) {
                  cancelAnimationFrame(whitneyLargeAnimationId);
                  whitneyLargeAnimationId = null;
                }
                return;
              }
              
              whitneyLargeAnimationId = requestAnimationFrame(whitneyLargePulseAnimation);
            } catch (error) {
              console.warn('⚠️ Whitney large pulse animation error:', error);
              if (whitneyLargeAnimationId) {
                cancelAnimationFrame(whitneyLargeAnimationId);
                whitneyLargeAnimationId = null;
              }
            }
          };
          
          // Start the large pulse animation
          setTimeout(() => {
            whitneyLargeAnimationId = requestAnimationFrame(whitneyLargePulseAnimation);
            if (typeof window !== 'undefined') {
              window.libertyLargePulseAnimationId = whitneyLargeAnimationId;
            }
          }, 300);

          console.log('✅ Larger pulsing green circle added around Liberty marker');
          
          // Initialize container for zone markers
          if (typeof window !== 'undefined') {
            if (!window.libertyZoneMarkers) window.libertyZoneMarkers = {};
          }

          // Add zone markers with sequence animation
          const zoneMarkerSequence = {
            downtown: { delay: 2500, duration: 800 },
            lake_whitney: { delay: 3000, duration: 800 }
          };

          // Liberty Downtown Core marker
          setTimeout(() => {
            try {
              const downtown = WHITNEY_ZONES.downtown;
              const downtownMarker = new mapboxgl.Marker({ 
                color: '#7c3aed', 
                scale: 1.2,
                anchor: 'center'
              })
                .setLngLat([downtown.lng, downtown.lat])
                .addTo(map.current);
              
              downtownMarker.getElement().addEventListener('click', () => {
                if (window.mapEventBus) {
                  window.mapEventBus.emit('marker:clicked', {
                    id: 'liberty-downtown-marker',
                    name: 'Liberty Downtown Core',
                    type: 'Liberty Infrastructure',
                    category: 'Civic Center & Historic Downtown',
                    coordinates: [downtown.lng, downtown.lat],
                    formatter: 'whitney',
                    zonesAnalyzed: 3,
                    cachedDataAvailable: !!cachedData,
                    analysisStatus: 'Civic center, services, and growth corridor'
                  });
                }
              });
              
              if (window.libertyZoneMarkers) window.libertyZoneMarkers.downtown = downtownMarker;
              console.log('✅ Downtown marker animated in');
            } catch (e) {
              console.warn('⚠️ Could not add Downtown marker:', e);
            }
          }, zoneMarkerSequence.downtown.delay);

          // Liberty Regional Area marker
          setTimeout(() => {
            try {
              const lakeWhitneyZone = WHITNEY_ZONES.lake_whitney;
              const lakeWhitneyMarker = new mapboxgl.Marker({ 
                color: '#0ea5e9', 
                scale: 1.2,
                anchor: 'center'
              })
                .setLngLat([lakeWhitneyZone.lng, lakeWhitneyZone.lat])
                .addTo(map.current);
              
              lakeWhitneyMarker.getElement().addEventListener('click', () => {
                if (window.mapEventBus) {
                  window.mapEventBus.emit('marker:clicked', {
                    id: 'liberty-regional-marker',
                    name: 'Liberty Regional Area',
                    type: 'Liberty Infrastructure',
                    category: 'Regional Access & Recreation',
                    coordinates: [lakeWhitneyZone.lng, lakeWhitneyZone.lat],
                    formatter: 'whitney',
                    zonesAnalyzed: 3,
                    cachedDataAvailable: !!cachedData,
                    analysisStatus: 'Regional access and recreational assets'
                  });
                }
              });
              
              if (window.libertyZoneMarkers) window.libertyZoneMarkers.lake_whitney = lakeWhitneyMarker;
              console.log('✅ Liberty Regional Area marker animated in');
            } catch (e) {
              console.warn('⚠️ Could not add Lake Whitney Gateway marker:', e);
            }
          }, zoneMarkerSequence.lake_whitney.delay);
          
          // Update feedback for Liberty infrastructure analysis
          if (updateToolFeedback) {
            updateToolFeedback({
              isActive: true,
              tool: 'osm',
              status: '🎬 Starting Liberty sequence animation...',
              progress: 20,
              details: `Phase 1: Infrastructure layers (0-2s)`
            });
          }
          
          // Ensure map is fully loaded before adding infrastructure
          if (!map.current.isStyleLoaded()) {
            await new Promise(resolve => {
              if (map.current.isStyleLoaded()) {
                resolve();
              } else {
                map.current.once('style.load', resolve);
              }
            });
          }
          
          // Add a small delay to ensure map is ready
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Phase 2: Add infrastructure to map with sequence animation
          await addLibertyInfrastructureToMap(cachedData.features, marker);
          
          // Update feedback for zone circles phase
          setTimeout(() => {
            if (updateToolFeedback) {
              updateToolFeedback({
                isActive: true,
                tool: 'osm',
                status: '🎬 Zone circles appearing...',
                progress: 60,
                details: `Phase 2: Zone circles (2-4s)`
              });
            }
          }, 2000);
          
          // Update feedback for key sites phase
          setTimeout(() => {
            if (updateToolFeedback) {
              updateToolFeedback({
                isActive: true,
                tool: 'osm',
                status: '🎬 Key sites loading...',
                progress: 80,
                details: `Phase 3: Key sites (4-6s)`
              });
            }
          }, 4000);
          
          // Update feedback for completion
          setTimeout(() => {
            if (updateToolFeedback) {
              updateToolFeedback({
                isActive: true,
                tool: 'osm',
                status: '✅ Liberty sequence animation completed!',
                progress: 100,
                details: `All ${cachedData.features.length} infrastructure features animated in sequence.`
              });
            }
          }, 6000);
          
          // Clear feedback after a delay
          setTimeout(() => {
            if (updateToolFeedback) {
              updateToolFeedback({
                isActive: false,
                tool: null,
                status: '',
                progress: 0,
                details: ''
              });
            }
          }, 8000);

            
        } catch (error) {
          console.error('❌ Error in Liberty analysis:', error);
            
          // Update feedback for error
          if (updateToolFeedback) {
            updateToolFeedback({
              isActive: true,
              tool: 'osm',
              status: '❌ Liberty analysis failed',
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
        }
      }
      
    } catch (error) {
      console.error('❌ Whitney Analysis Error:', error.message);
      
      // Update feedback for error
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: '❌ Whitney analysis failed',
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

  return (
    <div
      style={{
        position: 'relative',
        top: position?.top || '0px',
        left: position?.left || '0px',
        transform: 'none',
        width: size,
        height: size,
        borderRadius: '50%',
        background: disabled ? 'rgba(0, 0, 0, 0.4)' : (isLoading ? '#059669' : (cachedData ? '#10b981' : (isHovered ? `${color}ee` : `${color}cc`))),
        border: disabled ? '1px solid rgba(0, 0, 0, 0.2)' : `1px solid ${color}40`,
        cursor: disabled ? 'not-allowed' : (isLoading ? 'default' : 'pointer'),
        boxShadow: disabled ? '0 1px 4px rgba(0, 0, 0, 0.1)' : (isHovered 
          ? `0 2px 8px ${color}40` 
          : '0 1px 4px rgba(0, 0, 0, 0.2)'),
        transition: 'all 0.2s ease',
        zIndex: 1001,
        padding: '8px',
        opacity: disabled ? 0.6 : (isLoading ? 0.7 : 1),
        animation: disabled ? 'none' : (isLoading ? 'whitneyButtonPulse 1.5s ease-out infinite' : 'none')
      }}
      onClick={disabled ? undefined : handleClick}
      onMouseEnter={() => !disabled && !isLoading && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={disabled ? 'Loading...' : (isLoading ? 'Analyzing Whitney infrastructure...' : 
        cachedData ? `${title} (Cached - Click to analyze)` : `${title} (Loading data...)`)}
    />
  );
};

export default OSMCallCached;
