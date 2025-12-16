import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';

const SOURCE_ID = 'ercot-counties-source';
const FILL_LAYER_ID = 'ercot-counties-fill';
const STROKE_LAYER_ID = 'ercot-counties-stroke';
const LABEL_LAYER_ID = 'ercot-counties-labels';
const GEOJSON_URL = '/data/ercot/ercot_counties_aggregated.geojson';

const ERCOTCountiesLayer = ({ map, visible }) => {
  const sourceLoadedRef = useRef(false);
  const layersAddedRef = useRef(false);
  const selectedCountyIdRef = useRef(null);
  const adjacentCountyIdsRef = useRef(new Set());
  const geojsonDataRef = useRef(null);
  const fadeTimeoutRef = useRef(null);

  useEffect(() => {
    if (!map?.current) return;

    const mapInstance = map.current;

    const loadLayer = async () => {
      try {
        // Check if source already exists
        if (mapInstance.getSource(SOURCE_ID)) {
          sourceLoadedRef.current = true;
          return;
        }

        // Wait for map to be ready
        if (!mapInstance.isStyleLoaded()) {
          mapInstance.once('styledata', loadLayer);
          return;
        }
        
        // Fetch and load GeoJSON
        fetch(GEOJSON_URL)
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
          })
          .then(geojsonData => {
            if (!geojsonData.features || geojsonData.features.length === 0) {
              return;
            }
            
            // Ensure all features have IDs for setFeatureState to work
            // Use county name or GEOID as ID, or generate one from index
            geojsonData.features.forEach((feature, index) => {
              if (!feature.id && feature.id !== 0) {
                // Try to use a unique property as ID
                const countyName = feature.properties?.NAME || feature.properties?.name || feature.properties?.COUNTY || feature.properties?.county;
                const geoid = feature.properties?.GEOID || feature.properties?.geoid;
                
                if (geoid) {
                  feature.id = geoid;
                } else if (countyName) {
                  // Use county name as ID (should be unique within Texas)
                  feature.id = `county-${countyName.toLowerCase().replace(/\s+/g, '-')}`;
                } else {
                  // Fallback: use index
                  feature.id = `county-${index}`;
                }
              }
            });
            
            // Store GeoJSON data for adjacency calculations
            geojsonDataRef.current = geojsonData;
            
            // Add source with loaded data
            mapInstance.addSource(SOURCE_ID, {
              type: 'geojson',
              data: geojsonData,
              generateId: true  // Fallback: Mapbox will generate IDs if features still don't have them
            });

            sourceLoadedRef.current = true;
            
            // Now add layers
            addLayers();
          })
          .catch(error => {
            // Error loading GeoJSON
          });

      } catch (error) {
        // Error loading layer
      }
    };

    const addLayers = () => {
      if (layersAddedRef.current) return;
      if (!mapInstance.getSource(SOURCE_ID)) {
        return;
      }

      try {
        // Color expression: by project count (red scale - darker, saturated reds for dark theme)
        // Focus on making 1000+ really stand out, using colors that work on dark backgrounds
        const colorExpression = [
          'interpolate',
          ['linear'],
          ['get', 'project_count'],
          0, '#1a1a1a',        // No projects: dark gray (visible on dark maps)
          10, '#2d1414',       // Very low: dark red tint
          50, '#4a1f1f',       // Low: darker red
          100, '#6b2a2a',      // Medium-low: medium dark red
          500, '#8b3a3a',      // Medium: darker red
          1000, '#dc2626',     // High: saturated red (threshold)
          2000, '#b91c1c',     // Very high: very dark red
          3000, '#991b1b'      // Extreme: darkest red
        ];

        // Add fill layer with opacity that scales with project count
        // Opacity will be reduced to 10% for non-selected counties
        if (!mapInstance.getLayer(FILL_LAYER_ID)) {
          mapInstance.addLayer({
            id: FILL_LAYER_ID,
            type: 'fill',
            source: SOURCE_ID,
            paint: {
              'fill-color': colorExpression,
              'fill-opacity': [
                'case',
                ['==', ['get', 'project_count'], 0],
                0,  // No projects: completely transparent
                [
                  '*',  // Multiply base opacity by selection factor
                  [
                    'case',
                    [
                      'all',
                    ['boolean', ['feature-state', 'selected'], false],
                      ['==', ['coalesce', ['get', '_faded'], false], false]
                    ],
                    1,  // Selected and not faded: full opacity
                    [
                      'all',
                      ['boolean', ['feature-state', 'selected'], false],
                      ['==', ['coalesce', ['get', '_faded'], false], true]
                    ],
                    0.1,  // Selected but faded: 10% opacity (90% reduction)
                    ['boolean', ['feature-state', 'adjacent'], false],
                    0.4,  // Adjacent: 40% opacity (some fill)
                    0.1  // Not selected/adjacent: 10% opacity (90% dim)
                  ],
                  [
                    'interpolate',
                    ['linear'],
                    ['get', 'project_count'],
                    // Less than 100: minimal fill (very transparent)
                    1, 0.05,   // 1-10 projects: barely visible (5%)
                    10, 0.08,  // 10-50 projects: very transparent (8%)
                    50, 0.12,  // 50-100 projects: still very transparent (12%)
                    // 100-1000: gradual increase
                    100, 0.2,  // 100 projects: starting to be visible (20%)
                    500, 0.4,  // 500 projects: more visible (40%)
                    // 1000+: max fill (very opaque)
                    1000, 0.85, // 1000 projects: max opacity (85%)
                    2000, 0.9,  // 2000 projects: max opacity (90%)
                    3000, 0.95  // 3000+ projects: near max (95%)
                  ]
                ]
              ]
            },
            minzoom: 4
          });
        }

        // Add stroke layer for selected county border
        if (!mapInstance.getLayer(STROKE_LAYER_ID)) {
          mapInstance.addLayer({
            id: STROKE_LAYER_ID,
            type: 'line',
            source: SOURCE_ID,
            paint: {
              'line-color': [
                'case',
                [
                  'all',
                  ['boolean', ['feature-state', 'selected'], false],
                  ['==', ['coalesce', ['get', '_faded'], false], true]
                ],
                '#dc2626',  // Selected and faded: red border
                [
                  'all',
                  ['boolean', ['feature-state', 'selected'], false],
                  ['==', ['coalesce', ['get', '_faded'], false], false]
                ],
                '#ffffff',  // Selected and not faded: white border
                '#ffffff'   // Default: white (shouldn't show when not selected)
              ],
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                3,  // Selected: 3px border
                0   // Not selected: no border
              ],
              'line-opacity': 1
            },
            minzoom: 4
          });
        }

        // Add text labels showing project count
        if (!mapInstance.getLayer(LABEL_LAYER_ID)) {
          mapInstance.addLayer({
            id: LABEL_LAYER_ID,
            type: 'symbol',
            source: SOURCE_ID,
            layout: {
              'text-field': [
                'case',
                ['>', ['get', 'project_count'], 0],
                [
                  'format',
                  ['get', 'NAME'],  // County name
                  {
                    'font-scale': 1.1,
                    'font-weight': 'bold',
                    'text-color': '#ffffff'
                  },
                  '\n',  // Newline
                  {},
                  ['to-string', ['get', 'project_count']],  // Project count
                  {
                    'font-scale': 0.9,
                    'text-color': '#ffffff'
                  }
                ],
                ''  // Don't show label for counties with 0 projects
              ],
              'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
              'text-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                4, 11,
                6, 13,
                8, 15,
                10, 17,
                12, 19
              ],
              'text-anchor': 'center',
              'text-allow-overlap': true,  // Allow overlap so all labels show
              'text-ignore-placement': false,
              'text-optional': false
            },
            paint: {
              'text-color': '#ffffff',  // White text for all labels
              'text-halo-color': 'transparent',
              'text-halo-width': 0,
              'text-halo-blur': 0,
              'text-opacity': [
                'case',
                ['==', ['get', 'project_count'], 0],
                0,  // No projects: no label
                [
                  'case',
                  ['boolean', ['feature-state', 'selected'], false],
                  1,  // Selected: full opacity
                  ['boolean', ['feature-state', 'adjacent'], false],
                  0.4,  // Adjacent: 40% opacity
                  0.1  // Not selected/adjacent: 10% opacity (dimmed)
                ]
              ]
            },
            minzoom: 4
          });
        }

        // Add hover effect
        let hoveredCountyId = null;

        mapInstance.on('mouseenter', FILL_LAYER_ID, (e) => {
          if (e.features.length > 0) {
            mapInstance.getCanvas().style.cursor = 'pointer';
            
            const feature = e.features[0];
            const props = feature.properties;
            
            // Highlight county with darker fill on hover
            if (hoveredCountyId !== null && hoveredCountyId !== undefined) {
              try {
                mapInstance.setFeatureState(
                  { source: SOURCE_ID, id: hoveredCountyId },
                  { hover: false }
                );
              } catch (e) {
                // Failed to clear previous hover state
              }
            }
            
            const featureId = feature.id;
            if (featureId !== null && featureId !== undefined) {
              hoveredCountyId = featureId;
              try {
                mapInstance.setFeatureState(
                  { source: SOURCE_ID, id: hoveredCountyId },
                  { hover: true }
                );
              } catch (e) {
                hoveredCountyId = null;
              }
            }
            
            // Darken fill on hover (increase opacity)
            const baseOpacity = props.project_count === 0 ? 0 : 
              props.project_count < 10 ? 0.2 :
              props.project_count < 100 ? 0.4 :
              props.project_count < 500 ? 0.6 :
              props.project_count < 1000 ? 0.75 : 0.9;
            
            mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              [
                'case',
                ['==', ['get', 'project_count'], 0],
                0,
                [
                  'interpolate',
                  ['linear'],
                  ['get', 'project_count'],
                  1, 0.2,
                  10, 0.25,
                  50, 0.4,
                  100, 0.5,
                  500, 0.65,
                  1000, 0.8,
                  2000, 0.95
                ]
              ],
              [
                'case',
                ['==', ['get', 'project_count'], 0],
                0,
                [
                  'interpolate',
                  ['linear'],
                  ['get', 'project_count'],
                  1, 0.1,
                  10, 0.15,
                  50, 0.25,
                  100, 0.35,
                  500, 0.5,
                  1000, 0.65,
                  2000, 0.8
                ]
              ]
            ]);
          }
        });

        mapInstance.on('mouseleave', FILL_LAYER_ID, () => {
          mapInstance.getCanvas().style.cursor = '';
          
          if (hoveredCountyId !== null && hoveredCountyId !== undefined) {
            try {
              mapInstance.setFeatureState(
                { source: SOURCE_ID, id: hoveredCountyId },
                { hover: false }
              );
            } catch (e) {
              // Failed to clear hover state
            }
            hoveredCountyId = null;
          }
          
          // Reset is handled by the opacity expression which uses feature-state
          // No need to manually reset here
        });

        // Add click event for selection (details shown in label, no popup)
        mapInstance.on('click', FILL_LAYER_ID, (e) => {
          // Check if click is on a Texas Data Center marker - if so, skip ERCOT selection
          try {
            // Only check if the layer exists
            if (mapInstance.getLayer('texas-data-centers-layer')) {
          const dataCenterFeatures = mapInstance.queryRenderedFeatures(e.point, {
            layers: ['texas-data-centers-layer']
          });
          if (dataCenterFeatures && dataCenterFeatures.length > 0) {
            // Click is on a data center marker, skip ERCOT selection
            return;
              }
            }
          } catch (error) {
            // Layer doesn't exist or query failed, continue with ERCOT selection
          }
          
          const feature = e.features[0];
          if (feature) {
            const props = feature.properties;
            const coordinates = e.lngLat;
            const clickedCountyId = feature.id;

            // Validate feature ID
            if (clickedCountyId === null || clickedCountyId === undefined) {
              return;
            }

            // Zoom into the county area
            try {
              if (feature.geometry) {
                // Use turf.js to calculate bounding box and centroid
                const bbox = turf.bbox(feature.geometry);
                const centroid = turf.centroid(feature.geometry);
                
                // Calculate bounding box size
                const lngDiff = bbox[2] - bbox[0];
                const latDiff = bbox[3] - bbox[1];
                const maxDiff = Math.max(lngDiff, latDiff);
                
                // Determine zoom level based on county size
                // Smaller counties get higher zoom, larger counties get lower zoom
                let zoomLevel = 9; // Default zoom
                if (maxDiff < 0.1) zoomLevel = 11; // Very small county
                else if (maxDiff < 0.2) zoomLevel = 10; // Small county
                else if (maxDiff < 0.5) zoomLevel = 9; // Medium county
                else if (maxDiff < 1.0) zoomLevel = 8; // Large county
                else zoomLevel = 7; // Very large county
                
                // Zoom to county centroid with appropriate zoom level
                mapInstance.flyTo({
                  center: centroid.geometry.coordinates,
                  zoom: zoomLevel,
                  duration: 1000,
                  essential: true
                });
              } else {
                // Fallback: use click coordinates with moderate zoom
                mapInstance.flyTo({
                  center: [coordinates.lng, coordinates.lat],
                  zoom: 9,
                  duration: 1000,
                  essential: true
                });
              }
            } catch (error) {
              // If zoom fails, just use click coordinates
              try {
                mapInstance.flyTo({
                  center: [coordinates.lng, coordinates.lat],
                  zoom: 9,
                  duration: 1000,
                  essential: true
                });
              } catch (fallbackError) {
                // Zoom failed, continue with selection
              }
            }

            // Emit event for table to highlight corresponding row
            if (window.mapEventBus) {
              window.mapEventBus.emit('ercot-county:map-selected', {
                countyId: clickedCountyId,
                countyName: props.NAME || props.name,
                properties: props,
                geometry: feature.geometry
              });
            }

            // Clear previous selection and adjacent counties
            if (selectedCountyIdRef.current !== null && selectedCountyIdRef.current !== undefined) {
              // Clear fade timeout if switching to a different county
              if (fadeTimeoutRef.current) {
                console.log('🔄 [ERCOTCountiesLayer] Clearing fade timeout - switching counties:', {
                  previousCountyId: selectedCountyIdRef.current,
                  newCountyId: clickedCountyId,
                  action: 'Canceling previous fade timeout'
                });
                clearTimeout(fadeTimeoutRef.current);
                fadeTimeoutRef.current = null;
              }
              
              try {
                // Clear _faded property from source data
                if (geojsonDataRef.current) {
                  const featureToClear = geojsonDataRef.current.features.find(f => f.id === selectedCountyIdRef.current);
                  if (featureToClear && featureToClear.properties) {
                    featureToClear.properties._faded = false;
                    
                    // Update the source
                    const source = mapInstance.getSource(SOURCE_ID);
                    if (source && source.setData) {
                      source.setData(geojsonDataRef.current);
                    }
                  }
                }
                
                mapInstance.setFeatureState(
                  { source: SOURCE_ID, id: selectedCountyIdRef.current },
                  { selected: false, faded: false }
                );
                console.log('🧹 [ERCOTCountiesLayer] Cleared previous selection:', {
                  countyId: selectedCountyIdRef.current,
                  selected: false,
                  faded: false
                });
              } catch (e) {
                // Failed to clear previous selection
              }
            }
            
            // Clear previous adjacent counties
            adjacentCountyIdsRef.current.forEach(adjacentId => {
              if (adjacentId !== null && adjacentId !== undefined) {
                try {
                  mapInstance.setFeatureState(
                    { source: SOURCE_ID, id: adjacentId },
                    { adjacent: false }
                  );
                } catch (e) {
                  // Failed to clear adjacent state
                }
              }
            });
            adjacentCountyIdsRef.current.clear();

            // Set new selection
            if (selectedCountyIdRef.current === clickedCountyId) {
              // Clicking the same county again - deselect
              selectedCountyIdRef.current = null;
              
              // Clear fade timeout
              if (fadeTimeoutRef.current) {
                clearTimeout(fadeTimeoutRef.current);
                fadeTimeoutRef.current = null;
              }
              
              // Clear feature state data
              try {
                // Clear _faded property from source data
                if (geojsonDataRef.current) {
                  const featureToClear = geojsonDataRef.current.features.find(f => f.id === clickedCountyId);
                  if (featureToClear && featureToClear.properties) {
                    featureToClear.properties._faded = false;
                    
                    // Update the source
                    const source = mapInstance.getSource(SOURCE_ID);
                    if (source && source.setData) {
                      source.setData(geojsonDataRef.current);
                    }
                  }
                }
                
                mapInstance.setFeatureState(
                  { source: SOURCE_ID, id: clickedCountyId },
                  { 
                    selected: false,
                    faded: false,
                    totalCapacity: 0,
                    avgCapacity: 0,
                    dominantFuel: ''
                  }
                );
              } catch (e) {
                // Failed to clear feature state
              }
              
              // Clear selection from source data
              if (geojsonDataRef.current) {
                geojsonDataRef.current.features.forEach(f => {
                  if (f.properties) {
                    f.properties._selected = false;
                  }
                });
                
                // Update the source
                const source = mapInstance.getSource(SOURCE_ID);
                if (source && source.setData) {
                  source.setData(geojsonDataRef.current);
                }
              }
              
              // Reset label to show only name and count
              if (mapInstance.getLayer(LABEL_LAYER_ID)) {
                try {
                  // text-field is a LAYOUT property, not a paint property!
                  mapInstance.setLayoutProperty(LABEL_LAYER_ID, 'text-field', [
                    'case',
                    ['>', ['get', 'project_count'], 0],
                    [
                      'format',
                      ['get', 'NAME'],
                      {
                        'font-scale': 1.1,
                        'font-weight': 'bold',
                        'text-color': '#ffffff'
                      },
                      '\n',
                      {},
                      ['to-string', ['get', 'project_count']],
                      {
                        'font-scale': 0.9,
                        'text-color': '#ffffff'
                      }
                    ],
                    ''
                  ]);
                } catch (e) {
                  // Failed to reset label
                }
              }
              
              // Clear adjacent counties
              adjacentCountyIdsRef.current.forEach(adjacentId => {
                if (adjacentId !== null && adjacentId !== undefined) {
                  try {
                    mapInstance.setFeatureState(
                      { source: SOURCE_ID, id: adjacentId },
                      { adjacent: false }
                    );
                  } catch (e) {
                    // Failed to clear adjacent state
                  }
                }
              });
              adjacentCountyIdsRef.current.clear();
              
              // Reset opacity for all counties
              mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', [
                'case',
                ['==', ['get', 'project_count'], 0],
                0,
                [
                  'interpolate',
                  ['linear'],
                  ['get', 'project_count'],
                  1, 0.05,
                  10, 0.08,
                  50, 0.12,
                  100, 0.2,
                  500, 0.4,
                  1000, 0.85,
                  2000, 0.9,
                  3000, 0.95
                ]
              ]);
              
              return; // Exit early, don't proceed with selection
            } else {
              // Select new county
              selectedCountyIdRef.current = clickedCountyId;
              
              console.log('🗺️ [ERCOTCountiesLayer] County clicked:', {
                countyId: clickedCountyId,
                countyName: props.NAME || props.name,
                timestamp: new Date().toISOString(),
                action: 'Initial selection - full opacity'
              });
              
              // Clear any existing fade timeout
              if (fadeTimeoutRef.current) {
                console.log('🧹 [ERCOTCountiesLayer] Clearing previous fade timeout');
                clearTimeout(fadeTimeoutRef.current);
                fadeTimeoutRef.current = null;
              }
              
              try {
                mapInstance.setFeatureState(
                  { source: SOURCE_ID, id: clickedCountyId },
                  { selected: true, faded: false }
                );
                
                console.log('✅ [ERCOTCountiesLayer] Set feature state:', {
                  countyId: clickedCountyId,
                  selected: true,
                  faded: false,
                  fillOpacity: '100% (full)'
                });
                
                // After 2 seconds, reduce opacity by 90% (from full to 10%)
                console.log('⏰ [ERCOTCountiesLayer] Scheduling fade timeout for 2 seconds...');
                fadeTimeoutRef.current = setTimeout(() => {
                  if (selectedCountyIdRef.current === clickedCountyId) {
                    console.log('⏱️ [ERCOTCountiesLayer] 2 seconds elapsed - reducing fill opacity:', {
                      countyId: clickedCountyId,
                      countyName: props.NAME || props.name,
                      timestamp: new Date().toISOString(),
                      action: 'Fading fill - reducing opacity by 90%',
                      fromOpacity: '100% (full)',
                      toOpacity: '10% (90% reduction)'
                    });
                    
                    try {
                      // Update source data directly instead of using feature-state
                      // This is more reliable for expression evaluation
                      console.log('🔍 [ERCOTCountiesLayer] Attempting to fade county:', {
                        countyId: clickedCountyId,
                        countyIdType: typeof clickedCountyId,
                        countyName: props.NAME || props.name,
                        hasGeoJsonData: !!geojsonDataRef.current,
                        geoJsonFeatureCount: geojsonDataRef.current?.features?.length || 0
                      });
                      
                      if (geojsonDataRef.current) {
                        // Try multiple ID matching strategies
                        let featureToFade = geojsonDataRef.current.features.find(f => f.id === clickedCountyId);
                        
                        // If not found, try string/number conversion
                        if (!featureToFade) {
                          featureToFade = geojsonDataRef.current.features.find(f => 
                            f.id == clickedCountyId || // Loose equality
                            String(f.id) === String(clickedCountyId) ||
                            Number(f.id) === Number(clickedCountyId)
                          );
                        }
                        console.log('🔍 [ERCOTCountiesLayer] Feature lookup result:', {
                          found: !!featureToFade,
                          featureId: featureToFade?.id,
                          hasProperties: !!featureToFade?.properties,
                          countyName: featureToFade?.properties?.NAME || featureToFade?.properties?.name
                        });
                        
                        if (featureToFade && featureToFade.properties) {
                          // Mark as faded in source data
                          const previousFaded = featureToFade.properties._faded;
                          featureToFade.properties._faded = true;
                          
                          console.log('📝 [ERCOTCountiesLayer] Setting _faded property:', {
                            countyId: clickedCountyId,
                            countyName: featureToFade.properties?.NAME || featureToFade.properties?.name,
                            previousFaded: previousFaded,
                            newFaded: featureToFade.properties._faded
                          });
                          
                          // Update the source
                          const source = mapInstance.getSource(SOURCE_ID);
                          if (source && source.setData) {
                            source.setData(geojsonDataRef.current);
                            console.log('✅ [ERCOTCountiesLayer] Updated source data with _faded property:', {
                              countyId: clickedCountyId,
                              countyName: featureToFade.properties?.NAME || featureToFade.properties?.name,
                              _faded: featureToFade.properties._faded,
                              sourceUpdated: true
                            });
                            
                            // Verify the update by querying the source
                            const updatedFeature = mapInstance.querySourceFeatures(SOURCE_ID, {
                              filter: ['==', ['id'], clickedCountyId]
                            });
                            console.log('🔍 [ERCOTCountiesLayer] Verified updated feature:', {
                              found: updatedFeature.length > 0,
                              _faded: updatedFeature[0]?.properties?._faded,
                              allProperties: Object.keys(updatedFeature[0]?.properties || {})
                            });
                          } else {
                            console.warn('⚠️ [ERCOTCountiesLayer] Source not found or setData not available');
                          }
                        } else {
                          // Try alternative lookup methods
                          // Log more details about the mismatch
                          const sampleIds = geojsonDataRef.current.features.slice(0, 10).map(f => ({
                            id: f.id,
                            idType: typeof f.id,
                            name: f.properties?.NAME || f.properties?.name
                          }));
                          
                          console.warn('⚠️ [ERCOTCountiesLayer] Feature not found by ID, trying alternative lookup:', {
                            clickedCountyId: clickedCountyId,
                            clickedIdType: typeof clickedCountyId,
                            countyName: props.NAME || props.name,
                            sampleIds: sampleIds,
                            totalFeatures: geojsonDataRef.current.features.length
                          });
                          
                          // Try finding by name instead
                          const featureByName = geojsonDataRef.current.features.find(f => 
                            f.properties?.NAME === (props.NAME || props.name) ||
                            f.properties?.name === (props.NAME || props.name)
                          );
                          
                          if (featureByName && featureByName.properties) {
                            console.log('✅ [ERCOTCountiesLayer] Found feature by name, setting _faded:', {
                              foundId: featureByName.id,
                              clickedId: clickedCountyId,
                              countyName: featureByName.properties?.NAME || featureByName.properties?.name
                            });
                            
                            featureByName.properties._faded = true;
                            
                            const source = mapInstance.getSource(SOURCE_ID);
                            if (source && source.setData) {
                              source.setData(geojsonDataRef.current);
                              console.log('✅ [ERCOTCountiesLayer] Updated source data by name lookup:', {
                                countyId: featureByName.id,
                                countyName: featureByName.properties?.NAME || featureByName.properties?.name,
                                _faded: featureByName.properties._faded,
                                _fadedType: typeof featureByName.properties._faded,
                                allProperties: Object.keys(featureByName.properties).filter(k => k.includes('faded') || k.includes('selected'))
                              });
                              
                              // Note: querySourceFeatures may not immediately reflect setData changes
                              // The visibility toggle ensures the expression re-evaluates with the new data
                              
                              // Force Mapbox to re-evaluate expressions by toggling layer visibility
                              // This ensures the expression reads the new _faded property
                              setTimeout(() => {
                                const currentVisibility = mapInstance.getLayoutProperty(FILL_LAYER_ID, 'visibility');
                                if (currentVisibility === 'visible') {
                                  mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', 'none');
                                  requestAnimationFrame(() => {
                                    mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', 'visible');
                                    mapInstance.triggerRepaint();
                                    console.log('🔄 [ERCOTCountiesLayer] Toggled visibility to force expression re-evaluation');
                                  });
                                }
                              }, 50);
                            }
                          } else {
                            // Try finding by matching any property that might match
                            const featureByProps = geojsonDataRef.current.features.find(f => {
                              const fName = f.properties?.NAME || f.properties?.name;
                              const clickedName = props.NAME || props.name;
                              return fName === clickedName || 
                                     fName?.toLowerCase() === clickedName?.toLowerCase();
                            });
                            
                            if (featureByProps && featureByProps.properties) {
                              console.log('✅ [ERCOTCountiesLayer] Found feature by property match, setting _faded:', {
                                foundId: featureByProps.id,
                                clickedId: clickedCountyId
                              });
                              
                              featureByProps.properties._faded = true;
                              
                              const source = mapInstance.getSource(SOURCE_ID);
                              if (source && source.setData) {
                                source.setData(geojsonDataRef.current);
                                console.log('✅ [ERCOTCountiesLayer] Updated source data by property match');
                                
                                // Force Mapbox to re-evaluate expressions
                                setTimeout(() => {
                                  const currentVisibility = mapInstance.getLayoutProperty(FILL_LAYER_ID, 'visibility');
                                  if (currentVisibility === 'visible') {
                                    mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', 'none');
                                    requestAnimationFrame(() => {
                                      mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', 'visible');
                                      mapInstance.triggerRepaint();
                                      console.log('🔄 [ERCOTCountiesLayer] Toggled visibility to force expression re-evaluation (property match)');
                                    });
                                  }
                                }, 50);
                              }
                            } else {
                              console.error('❌ [ERCOTCountiesLayer] Could not find feature by any method:', {
                                clickedId: clickedCountyId,
                                clickedName: props.NAME || props.name,
                                totalFeatures: geojsonDataRef.current.features.length
                              });
                            }
                          }
                        }
                      } else {
                        console.warn('⚠️ [ERCOTCountiesLayer] geojsonDataRef.current is null');
                      }
                      
                      // Also set feature-state for consistency
                      mapInstance.setFeatureState(
                        { source: SOURCE_ID, id: clickedCountyId },
                        { selected: true, faded: true }
                      );
                      
                      // Force a repaint
                      mapInstance.triggerRepaint();
                      
                      console.log('✅ [ERCOTCountiesLayer] Updated feature to faded state:', {
                        countyId: clickedCountyId,
                        selected: true,
                        faded: true,
                        fillOpacity: '10% (faded)',
                        method: 'Source data update + feature-state'
                      });
                    } catch (e) {
                      console.error('❌ [ERCOTCountiesLayer] Failed to update fade state:', e);
                    }
                  } else {
                    console.log('⚠️ [ERCOTCountiesLayer] Fade timeout fired but county changed:', {
                      expectedCountyId: clickedCountyId,
                      currentSelectedCountyId: selectedCountyIdRef.current,
                      action: 'Skipping fade - different county selected'
                    });
                  }
                }, 2000);
                
                // Find adjacent counties using turf.js
                // Query all features from the source and compare geometries directly
                if (feature.geometry) {
                  const clickedTurfFeature = turf.feature(feature.geometry);
                  let adjacentCount = 0;
                  
                  // Query all features from the Mapbox source (this gets the actual features with their IDs)
                  const allFeatures = mapInstance.querySourceFeatures(SOURCE_ID, {
                    filter: ['!=', ['id'], clickedCountyId]  // Exclude the clicked feature
                  });
                  
                  // Check each feature for adjacency
                  allFeatures.forEach(otherFeature => {
                    if (otherFeature.geometry && otherFeature.id !== clickedCountyId) {
                      try {
                        const otherTurfFeature = turf.feature(otherFeature.geometry);
                        
                        // Check if counties touch (share a border)
                        const touches = turf.booleanTouches(clickedTurfFeature, otherTurfFeature);
                        
                        if (touches) {
                          // Set adjacent state using the feature's actual ID from Mapbox
                          try {
                            mapInstance.setFeatureState(
                              { source: SOURCE_ID, id: otherFeature.id },
                              { adjacent: true }
                            );
                            adjacentCountyIdsRef.current.add(otherFeature.id);
                            adjacentCount++;
                          } catch (stateError) {
                            // Failed to set adjacent state
                          }
                        }
                      } catch (e) {
                        // Skip if geometry is invalid
                      }
                    }
                  });
                  
                  // Force a repaint to show adjacent counties
                  mapInstance.triggerRepaint();
                }
              } catch (e) {
                return;
              }
            }

            // Update opacity for all counties based on selection
            // This triggers a repaint with the new feature-state values
            mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', [
              'case',
              ['==', ['get', 'project_count'], 0],
              0,
              [
                '*',
                [
                  'case',
                  ['boolean', ['feature-state', 'selected'], false],
                  1,  // Selected: full opacity
                  ['boolean', ['feature-state', 'adjacent'], false],
                  0.4,  // Adjacent: 40% opacity (some fill)
                  0.1  // Not selected/adjacent: 10% opacity (90% dim)
                ],
                [
                  'interpolate',
                  ['linear'],
                  ['get', 'project_count'],
                  1, 0.05,
                  10, 0.08,
                  50, 0.12,
                  100, 0.2,
                  500, 0.4,
                  1000, 0.85,
                  2000, 0.9,
                  3000, 0.95
                ]
              ]
            ]);

            // Store county data in feature-state for label display
            const countyName = props.NAME || props.name || 'Unknown County';
            const projectCount = props.project_count || 0;
            const totalCapacity = props.total_capacity_mw || 0;
            const avgCapacity = props.avg_capacity_mw || 0;
            const dominantFuel = props.dominant_fuel_type || 'NONE';
            
            // Store data in feature-state for opacity/adjacency (paint properties can use feature-state)
            try {
              mapInstance.setFeatureState(
                { source: SOURCE_ID, id: clickedCountyId },
                { 
                  selected: true,
                  faded: false,
                  totalCapacity: totalCapacity,
                  avgCapacity: avgCapacity,
                  dominantFuel: dominantFuel
                }
              );
            } catch (e) {
              // Failed to store county data in feature-state
            }
            
            // Update source data to mark this feature as selected (for layout properties)
            // Since feature-state doesn't work in layout properties, we update the source directly
            if (geojsonDataRef.current) {
              const selectedFeature = geojsonDataRef.current.features.find(f => f.id === clickedCountyId);
              if (selectedFeature) {
                // Clear previous selection
                geojsonDataRef.current.features.forEach(f => {
                  if (f.properties) {
                    f.properties._selected = false;
                  }
                });
                
                // Mark this feature as selected
                selectedFeature.properties._selected = true;
                
                // Update the source
                const source = mapInstance.getSource(SOURCE_ID);
                if (source && source.setData) {
                  source.setData(geojsonDataRef.current);
                }
              }
            }
            
            // Update label to show details when selected
            // Check if layer exists first and wait a bit for it to be ready
            if (mapInstance.getLayer(LABEL_LAYER_ID)) {
              // Use setTimeout to ensure the layer is fully ready before setting layout property
              setTimeout(() => {
                // Check if layer still exists (might have been removed)
                if (!mapInstance.getLayer(LABEL_LAYER_ID)) {
                  return;
                }
                
                try {
                  // Use coalesce to safely access properties that might be missing
                  // Use _selected property from source data (not feature-state)
                  const labelExpression = [
                    'case',
                    ['>', ['coalesce', ['get', 'project_count'], 0], 0],
                    [
                      'case',
                      ['==', ['coalesce', ['get', '_selected'], false], true],
                      // Selected: show name, count, and details using feature properties
                      [
                        'format',
                        ['coalesce', ['get', 'NAME'], 'Unknown'],  // County name
                        {
                          'font-scale': 1.1,
                          'font-weight': 'bold',
                          'text-color': '#ffffff'
                        },
                        '\n',  // Newline
                        {},
                        ['to-string', ['coalesce', ['get', 'project_count'], 0]],  // Project count
                        {
                          'font-scale': 0.9,
                          'text-color': '#ffffff'
                        },
                        '\n',  // Newline for capacity
                        {},
                        [
                          'concat',
                          [
                            'to-string',
                            [
                              'round',
                              [
                                '/',
                                ['coalesce', ['get', 'total_capacity_mw'], 0],
                                1000
                              ]
                            ]
                          ],
                          ' GW'
                        ],
                        {
                          'font-scale': 0.7,
                          'text-color': '#b0b5ba'
                        },
                        '\n',  // Newline for avg
                        {},
                        [
                          'concat',
                          'Avg: ',
                          [
                            'to-string',
                            [
                              'round',
                              ['coalesce', ['get', 'avg_capacity_mw'], 0]
                            ]
                          ],
                          ' MW'
                        ],
                        {
                          'font-scale': 0.7,
                          'text-color': '#b0b5ba'
                        },
                        [
                          'case',
                          [
                            'all',
                            ['has', 'dominant_fuel_type'],
                            ['!=', ['coalesce', ['get', 'dominant_fuel_type'], ''], ''],
                            ['!=', ['coalesce', ['get', 'dominant_fuel_type'], ''], 'NONE']
                          ],
                          [
                            'concat',
                            '\n',
                            'Primary: ',
                            ['get', 'dominant_fuel_type']
                          ],
                          ''
                        ],
                        {
                          'font-scale': 0.7,
                          'text-color': '#b0b5ba'
                        }
                      ],
                      // Not selected: show name and count only
                      [
                        'format',
                        ['coalesce', ['get', 'NAME'], 'Unknown'],  // County name
                        {
                          'font-scale': 1.1,
                          'font-weight': 'bold',
                          'text-color': '#ffffff'
                        },
                        '\n',  // Newline
                        {},
                        ['to-string', ['coalesce', ['get', 'project_count'], 0]],  // Project count
                        {
                          'font-scale': 0.9,
                          'text-color': '#ffffff'
                        }
                      ]
                    ],
                    ''  // Don't show label for counties with 0 projects
                  ];
                  
                  // text-field is a LAYOUT property, not a paint property!
                  mapInstance.setLayoutProperty(LABEL_LAYER_ID, 'text-field', labelExpression);
                  
                  // Force a repaint to update labels
                  mapInstance.triggerRepaint();
                } catch (e) {
                  // Failed to update label
                }
              }, 50); // Small delay to ensure layer is ready
            }
          }
        });

        // Also allow clicking on map to deselect
        mapInstance.on('click', (e) => {
          // Check if click was on a county
          const features = mapInstance.queryRenderedFeatures(e.point, {
            layers: [FILL_LAYER_ID]
          });
          
          // If click was not on a county, clear selection
          if (features.length === 0 && selectedCountyIdRef.current !== null && selectedCountyIdRef.current !== undefined) {
            // Clear fade timeout
            if (fadeTimeoutRef.current) {
              clearTimeout(fadeTimeoutRef.current);
              fadeTimeoutRef.current = null;
            }
            
            try {
              mapInstance.setFeatureState(
                { source: SOURCE_ID, id: selectedCountyIdRef.current },
                { 
                  selected: false,
                  faded: false,
                  totalCapacity: 0,
                  avgCapacity: 0,
                  dominantFuel: ''
                }
              );
            } catch (e) {
              // Failed to clear selection on map click
            }
            selectedCountyIdRef.current = null;
            
            // Clear adjacent counties
            adjacentCountyIdsRef.current.forEach(adjacentId => {
              if (adjacentId !== null && adjacentId !== undefined) {
                try {
                  mapInstance.setFeatureState(
                    { source: SOURCE_ID, id: adjacentId },
                    { adjacent: false }
                  );
                } catch (e) {
                  // Failed to clear adjacent on map click
                }
              }
            });
            adjacentCountyIdsRef.current.clear();
            
            // Clear selection from source data
            if (geojsonDataRef.current) {
              geojsonDataRef.current.features.forEach(f => {
                if (f.properties) {
                  f.properties._selected = false;
                }
              });
              
              // Update the source
              const source = mapInstance.getSource(SOURCE_ID);
              if (source && source.setData) {
                source.setData(geojsonDataRef.current);
              }
            }
            
            // Reset label to show only name and count
            if (mapInstance.getLayer(LABEL_LAYER_ID)) {
              try {
                // text-field is a LAYOUT property, not a paint property!
                mapInstance.setLayoutProperty(LABEL_LAYER_ID, 'text-field', [
                  'case',
                  ['>', ['get', 'project_count'], 0],
                  [
                    'format',
                    ['get', 'NAME'],
                    {
                      'font-scale': 1.1,
                      'font-weight': 'bold',
                      'text-color': '#ffffff'
                    },
                    '\n',
                    {},
                    ['to-string', ['get', 'project_count']],
                    {
                      'font-scale': 0.9,
                      'text-color': '#ffffff'
                    }
                  ],
                  ''
                ]);
              } catch (e) {
                // Failed to reset label
              }
            }
            
            // Reset opacity for all counties
            mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', [
              'case',
              ['==', ['get', 'project_count'], 0],
              0,
              [
                'interpolate',
                ['linear'],
                ['get', 'project_count'],
                1, 0.05,
                10, 0.08,
                50, 0.12,
                100, 0.2,
                500, 0.4,
                1000, 0.85,
                2000, 0.9,
                3000, 0.95
              ]
            ]);
          }
        });

        layersAddedRef.current = true;

        // Emit event for legend integration
        if (window.mapEventBus) {
          window.mapEventBus.emit('ercot-counties:mounted', {
            timestamp: Date.now()
          });
        }

        // Set initial visibility
        updateVisibility();

      } catch (error) {
        // Error adding layer
      }
    };

    // Update visibility when prop changes
    const updateVisibility = () => {
      if (mapInstance.getLayer(FILL_LAYER_ID)) {
        mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', visible ? 'visible' : 'none');
        // Opacity is data-driven, so we just need to toggle visibility
        if (!visible) {
          mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', 0);
        } else {
          // Restore data-driven opacity with selection support
          mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', [
            'case',
            ['==', ['get', 'project_count'], 0],
            0,
            [
              '*',  // Multiply base opacity by selection factor
              [
                'case',
                    [
                      'all',
                ['boolean', ['feature-state', 'selected'], false],
                      ['==', ['coalesce', ['get', '_faded'], false], false]
                    ],
                    1,  // Selected and not faded: full opacity
                    [
                      'all',
                      ['boolean', ['feature-state', 'selected'], false],
                      ['==', ['coalesce', ['get', '_faded'], false], true]
                    ],
                    0.1,  // Selected but faded: 10% opacity (90% reduction)
                ['boolean', ['feature-state', 'adjacent'], false],
                0.4,  // Adjacent: 40% opacity (some fill)
                0.1  // Not selected/adjacent: 10% opacity (90% dim)
              ],
              [
                'interpolate',
                ['linear'],
                ['get', 'project_count'],
                1, 0.05,
                10, 0.08,
                50, 0.12,
                100, 0.2,
                500, 0.4,
                1000, 0.85,
                2000, 0.9,
                3000, 0.95
              ]
            ]
          ]);
        }
      }
      if (mapInstance.getLayer(STROKE_LAYER_ID)) {
        mapInstance.setLayoutProperty(STROKE_LAYER_ID, 'visibility', visible ? 'visible' : 'none');
      }
      if (mapInstance.getLayer(LABEL_LAYER_ID)) {
        mapInstance.setLayoutProperty(LABEL_LAYER_ID, 'visibility', visible ? 'visible' : 'none');
        if (!visible) {
          mapInstance.setPaintProperty(LABEL_LAYER_ID, 'text-opacity', 0);
        } else {
          // Restore data-driven opacity with selection support
          mapInstance.setPaintProperty(LABEL_LAYER_ID, 'text-opacity', [
            'case',
            ['==', ['get', 'project_count'], 0],
            0,  // No projects: no label
            [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              1,  // Selected: full opacity
              ['boolean', ['feature-state', 'adjacent'], false],
              0.4,  // Adjacent: 40% opacity
              0.1  // Not selected/adjacent: 10% opacity (dimmed)
            ]
          ]);
        }
      }
    };

    // Load layer when map is ready
    if (mapInstance.isStyleLoaded()) {
      loadLayer();
    } else {
      mapInstance.once('styledata', loadLayer);
    }

    // Update visibility when prop changes
    if (sourceLoadedRef.current && layersAddedRef.current) {
      updateVisibility();
    } else {
      // Wait for layer to be added, then update visibility
      const checkAndUpdate = () => {
        if (mapInstance.getLayer(FILL_LAYER_ID)) {
          updateVisibility();
        } else {
          setTimeout(checkAndUpdate, 100);
        }
      };
      checkAndUpdate();
    }

    // Cleanup
    return () => {
      // Clear fade timeout on cleanup
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }
      
      // Don't remove source/layer on unmount, just hide it
      if (mapInstance.getLayer(FILL_LAYER_ID)) {
        mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', 'none');
      }
      if (mapInstance.getLayer(STROKE_LAYER_ID)) {
        mapInstance.setLayoutProperty(STROKE_LAYER_ID, 'visibility', 'none');
      }
      if (mapInstance.getLayer(LABEL_LAYER_ID)) {
        mapInstance.setLayoutProperty(LABEL_LAYER_ID, 'visibility', 'none');
      }
    };
  }, [map, visible]);

  return null;
};

export default ERCOTCountiesLayer;

