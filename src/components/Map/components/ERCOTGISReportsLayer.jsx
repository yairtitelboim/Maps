import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const SOURCE_ID = 'ercot-gis-reports-source';
const LAYER_ID = 'ercot-gis-reports-layer';
const GEOJSON_URL = '/data/ercot/ercot_gis_reports.geojson';

// Color mapping by fuel type
const FUEL_COLORS = {
  'SOL': '#fbbf24',      // Yellow for Solar
  'WIN': '#60a5fa',      // Blue for Wind
  'BAT': '#a78bfa',      // Purple for Battery
  'GAS': '#f87171',      // Red for Gas
  'HYB': '#10b981',      // Green for Hybrid
  'OTH': '#9ca3af',      // Gray for Other
  'NUC': '#f59e0b',      // Orange for Nuclear
  'COA': '#6b7280',      // Dark gray for Coal
  'BIO': '#84cc16',      // Lime for Biomass
  'GEO': '#14b8a6',      // Teal for Geothermal
  'WAT': '#3b82f6',      // Blue for Water/Hydro
};

const getFuelColor = (fuel) => {
  if (!fuel || typeof fuel !== 'string') return '#9ca3af';
  return FUEL_COLORS[fuel.toUpperCase()] || '#9ca3af';
};

const ERCOTGISReportsLayer = ({ map, visible }) => {
  const sourceLoadedRef = useRef(false);
  const layersAddedRef = useRef(false);

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

        // For large files, we need to fetch and load the data directly
        // Mapbox may have issues with 447MB files via URL
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
            
            // Add source with loaded data
            mapInstance.addSource(SOURCE_ID, {
              type: 'geojson',
              data: geojsonData
            });

            sourceLoadedRef.current = true;
            
            // Now add layers
            addLayers();
          })
          .catch(error => {
            // Error loading GeoJSON
          });
        
        // Data is already loaded via fetch, no need for data event listener

        // Layers will be added after fetch completes (see fetch().then() above)

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
        // Check if layer already exists
        if (mapInstance.getLayer(LAYER_ID)) {
          layersAddedRef.current = true;
          return;
        }

        // Build color expression with all fuel types
        // Using match expression directly (no case wrapper needed if we handle missing values)
        const colorExpression = [
          'match',
          ['get', 'Fuel'],
          // Match exact fuel codes
          'SOL', FUEL_COLORS.SOL,
          'WIN', FUEL_COLORS.WIN,
          'BAT', FUEL_COLORS.BAT,
          'GAS', FUEL_COLORS.GAS,
          'HYB', FUEL_COLORS.HYB,
          'NUC', FUEL_COLORS.NUC,
          'COA', FUEL_COLORS.COA,
          'BIO', FUEL_COLORS.BIO,
          'GEO', FUEL_COLORS.GEO,
          'WAT', FUEL_COLORS.WAT,
          'OTH', FUEL_COLORS.OTH,
          // Fallback for any other value (including null/undefined)
          FUEL_COLORS.OTH
        ];

        mapInstance.addLayer({
            id: LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            minzoom: 3, // Show layer starting at zoom 3 (country/region level)
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                // At zoom 3: small sizes
                3, [
                  'case',
                  ['has', 'Capacity (MW)'],
                  [
                    'max',
                    [
                      'interpolate',
                      ['linear'],
                      ['max', ['get', 'Capacity (MW)'], 0], // Ensure non-negative
                      0, 1,
                      50, 1.5,
                      100, 2,
                      500, 3,
                      1000, 4,
                      2000, 5
                    ],
                    1  // Minimum size
                  ],
                  1.5  // Default if no capacity
                ],
                // At zoom 4
                4, [
                  'case',
                  ['has', 'Capacity (MW)'],
                  [
                    'max',
                    [
                      'interpolate',
                      ['linear'],
                      ['max', ['get', 'Capacity (MW)'], 0],
                      0, 1.5,
                      50, 2,
                      100, 3,
                      500, 4,
                      1000, 6,
                      2000, 8
                    ],
                    1.5
                  ],
                  2
                ],
                // At zoom 6
                6, [
                  'case',
                  ['has', 'Capacity (MW)'],
                  [
                    'max',
                    [
                      'interpolate',
                      ['linear'],
                      ['max', ['get', 'Capacity (MW)'], 0],
                      0, 2,
                      50, 3,
                      100, 4,
                      500, 6,
                      1000, 8,
                      2000, 10
                    ],
                    2
                  ],
                  3
                ],
                // At zoom 10
                10, [
                  'case',
                  ['has', 'Capacity (MW)'],
                  [
                    'max',
                    [
                      'interpolate',
                      ['linear'],
                      ['max', ['get', 'Capacity (MW)'], 0],
                      0, 3,
                      50, 4,
                      100, 6,
                      500, 8,
                      1000, 12,
                      2000, 16
                    ],
                    3
                  ],
                  6
                ],
                // At zoom 14
                14, [
                  'case',
                  ['has', 'Capacity (MW)'],
                  [
                    'max',
                    [
                      'interpolate',
                      ['linear'],
                      ['max', ['get', 'Capacity (MW)'], 0],
                      0, 5,
                      50, 7,
                      100, 10,
                      500, 14,
                      1000, 18,
                      2000, 22
                    ],
                    5
                  ],
                  10
                ],
                // At zoom 16
                16, [
                  'case',
                  ['has', 'Capacity (MW)'],
                  [
                    'max',
                    [
                      'interpolate',
                      ['linear'],
                      ['max', ['get', 'Capacity (MW)'], 0],
                      0, 7,
                      50, 10,
                      100, 14,
                      500, 18,
                      1000, 24,
                      2000, 28
                    ],
                    7
                  ],
                  14
                ]
              ],
              'circle-color': colorExpression,
              'circle-opacity': visible ? 0.9 : 0
            }
        });
        
        // Also log when zoom changes to track rendering
        const zoomHandler = () => {
          try {
            const zoom = mapInstance.getZoom();
            const renderedFeatures = mapInstance.queryRenderedFeatures({
              layers: [LAYER_ID]
            });
            
            // Check layer visibility
            const layer = mapInstance.getLayer(LAYER_ID);
            const visibility = layer ? mapInstance.getLayoutProperty(LAYER_ID, 'visibility') : 'unknown';
            const opacity = layer ? mapInstance.getPaintProperty(LAYER_ID, 'circle-opacity') : 'unknown';
            const radius = layer ? mapInstance.getPaintProperty(LAYER_ID, 'circle-radius') : 'unknown';
            
            // If 0 features at low zoom, it might be because circles are too small
          } catch (err) {
            // Error querying rendered features
          }
        };
        
        mapInstance.on('zoomend', zoomHandler);
        mapInstance.on('moveend', zoomHandler);

        // Add click event for popups
        mapInstance.on('click', LAYER_ID, (e) => {
            const feature = e.features[0];
            if (feature) {
              const props = feature.properties;
              const coords = feature.geometry.coordinates.slice();

              const popupContent = `
                <div style="
                  background: rgba(0, 0, 0, 0.85);
                  color: white;
                  padding: 12px 16px;
                  border-radius: 8px;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  font-size: 13px;
                  max-width: 320px;
                ">
                  <div style="font-weight: 700; margin-bottom: 8px; font-size: 15px; color: #fff;">
                    ${props['Project Name'] || props.INR || 'ERCOT Project'}
                  </div>
                  <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">
                    INR: <span style="color: white; font-weight: 500;">${props.INR || 'N/A'}</span>
                  </div>
                  <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">
                    County: <span style="color: white; font-weight: 500;">${props.County || 'N/A'}</span>
                  </div>
                  <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">
                    Capacity: <span style="color: white; font-weight: 500;">${props['Capacity (MW)'] ? `${props['Capacity (MW)']} MW` : 'N/A'}</span>
                  </div>
                  <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">
                    Fuel: <span style="color: ${getFuelColor(props.Fuel)}; font-weight: 500;">${props.Fuel || 'N/A'}</span>
                  </div>
                  <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">
                    Technology: <span style="color: white; font-weight: 500;">${props.Technology || 'N/A'}</span>
                  </div>
                  <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">
                    Phase: <span style="color: white; font-weight: 500;">${props['GIM Study Phase'] || 'N/A'}</span>
                  </div>
                  ${props['Projected COD'] ? `
                  <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">
                    Projected COD: <span style="color: white; font-weight: 500;">${props['Projected COD']}</span>
                  </div>
                  ` : ''}
                  ${props['report_date'] ? `
                  <div style="font-size: 11px; color: #9ca3af;">
                    Report Date: <span style="color: white; font-weight: 500;">${props['report_date']}</span>
                  </div>
                  ` : ''}
                </div>
              `;

              new mapboxgl.Popup({ offset: 15, closeButton: true, closeOnClick: true })
                .setLngLat(coords)
                .setHTML(popupContent)
                .addTo(mapInstance);
          }
        });

        // Change cursor on hover
        mapInstance.on('mouseenter', LAYER_ID, () => {
          mapInstance.getCanvas().style.cursor = 'pointer';
        });

        mapInstance.on('mouseleave', LAYER_ID, () => {
          mapInstance.getCanvas().style.cursor = '';
        });

        layersAddedRef.current = true;

        // Emit event for legend integration
        if (window.mapEventBus) {
          window.mapEventBus.emit('ercot-gis-reports:mounted', {
            timestamp: Date.now()
          });
        }

        // Set initial visibility
        if (mapInstance.getLayer(LAYER_ID)) {
          mapInstance.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
        }

      } catch (error) {
        // Error adding layer
      }
    };

    // Load layer when map is ready
    if (mapInstance.isStyleLoaded()) {
      loadLayer();
    } else {
      mapInstance.once('styledata', loadLayer);
    }

    // Update visibility when prop changes
    const updateVisibility = () => {
      if (mapInstance.getLayer(LAYER_ID)) {
        const currentVisibility = mapInstance.getLayoutProperty(LAYER_ID, 'visibility');
        const currentOpacity = mapInstance.getPaintProperty(LAYER_ID, 'circle-opacity');
        
        mapInstance.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
        mapInstance.setPaintProperty(LAYER_ID, 'circle-opacity', visible ? 0.9 : 0);
        
        // If layer is being turned on, check if we need to pan to Texas
        if (visible && !currentVisibility) {
          const center = mapInstance.getCenter();
          const zoom = mapInstance.getZoom();
          
          // Texas approximate center: [-99.5, 31.0]
          // Check if we're far from Texas (more than 5 degrees away)
          const distanceFromTexas = Math.sqrt(
            Math.pow(center.lng - (-99.5), 2) + Math.pow(center.lat - 31.0, 2)
          );
          
          if (distanceFromTexas > 5) {
            // Optionally auto-pan to Texas (uncomment to enable)
            // mapInstance.flyTo({
            //   center: [-99.5, 31.0], // Central Texas
            //   zoom: 6,
            //   duration: 2000
            // });
          }
        }
      }
    };

    if (sourceLoadedRef.current && layersAddedRef.current) {
      updateVisibility();
    } else {
      // Wait for layer to be added, then update visibility
      const checkAndUpdate = () => {
        if (mapInstance.getLayer(LAYER_ID)) {
          updateVisibility();
        } else {
          setTimeout(checkAndUpdate, 100);
        }
      };
      checkAndUpdate();
    }

    // Cleanup
    return () => {
      // Don't remove source/layer on unmount, just hide it
      if (mapInstance.getLayer(LAYER_ID)) {
        mapInstance.setLayoutProperty(LAYER_ID, 'visibility', 'none');
      }
    };
  }, [map, visible]);

  return null;
};

export default ERCOTGISReportsLayer;

