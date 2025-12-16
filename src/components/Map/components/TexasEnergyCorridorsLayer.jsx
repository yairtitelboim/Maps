import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const SOURCE_ID = 'tx-energy-corridors-source';
const POWER_LINES_LAYER_ID = 'tx-energy-power-lines';
const POWER_HALO_LAYER_ID = 'tx-energy-power-lines-halo';
const POWER_LABEL_LAYER_ID = 'tx-energy-power-lines-labels';
const GAS_LINES_LAYER_ID = 'tx-energy-gas-lines';
const GAS_LABEL_LAYER_ID = 'tx-energy-gas-lines-labels';

// Try full dataset first, fallback to sample
const GEOJSON_URL = '/osm/tx_ercot_energy.json';
const GEOJSON_SAMPLE_URL = '/osm/tx_ercot_energy_sample.json';

const TexasEnergyCorridorsLayer = ({ map, visible }) => {
  const sourceLoadedRef = useRef(false);
  const layersAddedRef = useRef(false);

  useEffect(() => {
    if (!map?.current) return;
    const mapInstance = map.current;

    const addLayers = () => {
      if (layersAddedRef.current || !mapInstance.getSource(SOURCE_ID)) return;

      try {
        // Voltage expression (kV) for power lines
        const voltageExpr = [
          'to-number',
          [
            'coalesce',
            ['get', 'voltage_kv'],
            [
              'round',
              [
                '/',
                ['to-number', ['get', 'voltage']],
                1000
              ]
            ],
            0
          ]
        ];

        const voltageColorExpr = [
          'case',
          ['>=', voltageExpr, 500], '#dc2626', // deep red
          ['>=', voltageExpr, 345], '#ef4444', // red
          ['>=', voltageExpr, 230], '#f97316', // orange
          ['>=', voltageExpr, 138], '#fbbf24', // yellow
          ['>=', voltageExpr, 69], '#22d3ee',  // cyan
          '#3b82f6'                            // blue
        ];

        // Power halo
        if (!mapInstance.getLayer(POWER_HALO_LAYER_ID)) {
          mapInstance.addLayer({
            id: POWER_HALO_LAYER_ID,
            type: 'line',
            source: SOURCE_ID,
            filter: ['all', ['==', ['get', 'infra_type'], 'power'], ['==', ['geometry-type'], 'LineString']],
            paint: {
              'line-color': voltageColorExpr,
              // Extra-thin halo
              'line-width': 1.5,
              'line-opacity': 0.6,
              'line-blur': 1.2
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
              visibility: visible ? 'visible' : 'none'
            }
          });
        }

        // Power main lines
        if (!mapInstance.getLayer(POWER_LINES_LAYER_ID)) {
          mapInstance.addLayer({
            id: POWER_LINES_LAYER_ID,
            type: 'line',
            source: SOURCE_ID,
            filter: ['all', ['==', ['get', 'infra_type'], 'power'], ['==', ['geometry-type'], 'LineString']],
            paint: {
              'line-color': voltageColorExpr,
              // Extra-thin main line
              'line-width': 0.8,
              'line-opacity': 0.6
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
              visibility: visible ? 'visible' : 'none'
            }
          });
        }

        // Power line labels
        if (!mapInstance.getLayer(POWER_LABEL_LAYER_ID)) {
          mapInstance.addLayer({
            id: POWER_LABEL_LAYER_ID,
            type: 'symbol',
            source: SOURCE_ID,
            filter: ['all', ['==', ['get', 'infra_type'], 'power'], ['==', ['geometry-type'], 'LineString']],
            layout: {
              'symbol-placement': 'line',
              'symbol-spacing': 400,
              'text-field': [
                'case',
                // Prefer explicit kV
                ['has', 'voltage_kv'],
                ['concat', ['to-string', ['get', 'voltage_kv']], ' kV'],
                // Else derive from voltage in volts
                [
                  '>',
                  ['coalesce', ['to-number', ['get', 'voltage']], 0],
                  0
                ],
                [
                  'concat',
                  [
                    'to-string',
                    [
                      'round',
                      [
                        '/',
                        ['to-number', ['get', 'voltage']],
                        1000
                      ]
                    ]
                  ],
                  ' kV'
                ],
                // Fallback
                [
                  'coalesce',
                  ['get', 'name'],
                  ['get', 'ref'],
                  'Transmission Line'
                ]
              ],
              'text-size': 22,
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-keep-upright': true,
              'text-offset': [0, -0.5],
              visibility: visible ? 'visible' : 'none'
            },
            paint: {
              'text-color': voltageColorExpr,
              'text-halo-width': 0
            }
          });
        }

        // Gas lines
        if (!mapInstance.getLayer(GAS_LINES_LAYER_ID)) {
          mapInstance.addLayer({
            id: GAS_LINES_LAYER_ID,
            type: 'line',
            source: SOURCE_ID,
            filter: ['all', ['==', ['get', 'infra_type'], 'gas'], ['==', ['geometry-type'], 'LineString']],
            paint: {
              'line-color': '#22c55e',
              // Extra-thin gas line
              'line-width': 0.5,
              'line-dasharray': [3, 2],
              'line-opacity': 0.6
            },
            layout: {
              visibility: visible ? 'visible' : 'none'
            }
          });
        }

        // Gas line labels
        if (!mapInstance.getLayer(GAS_LABEL_LAYER_ID)) {
          mapInstance.addLayer({
            id: GAS_LABEL_LAYER_ID,
            type: 'symbol',
            source: SOURCE_ID,
            filter: ['all', ['==', ['get', 'infra_type'], 'gas'], ['==', ['geometry-type'], 'LineString']],
            layout: {
              'symbol-placement': 'line',
              'symbol-spacing': 400,
              'text-field': [
                'coalesce',
                ['get', 'name'],
                ['get', 'ref'],
                'Gas Pipeline'
              ],
              'text-size': 22,
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-keep-upright': true,
              'text-offset': [0, -0.5],
              visibility: visible ? 'visible' : 'none'
            },
            paint: {
              'text-color': '#22c55e',
              'text-halo-width': 0
            }
          });
        }

        layersAddedRef.current = true;
        console.log('✅ [TexasEnergyCorridors] Layers added (power + gas lines + labels)');
      } catch (error) {
        console.error('❌ [TexasEnergyCorridors] Error adding layers:', error);
      }
    };

    const loadSourceAndLayers = async () => {
      if (sourceLoadedRef.current) {
        addLayers();
        return;
      }

      try {
        console.log('📥 [TexasEnergyCorridors] Fetching GeoJSON from:', GEOJSON_URL);
        const response = await fetch(GEOJSON_URL);
        if (!response.ok) {
          console.error('❌ [TexasEnergyCorridors] Failed to fetch GeoJSON:', response.status);
          return;
        }
        const data = await response.json();
        const featureCount = Array.isArray(data.features) ? data.features.length : 0;
        console.log('✅ [TexasEnergyCorridors] Loaded GeoJSON with features:', featureCount);

        if (!mapInstance.getSource(SOURCE_ID)) {
          mapInstance.addSource(SOURCE_ID, {
            type: 'geojson',
            data
          });
        }

        sourceLoadedRef.current = true;
        addLayers();
      } catch (error) {
        console.error('❌ [TexasEnergyCorridors] Error loading GeoJSON:', error);
      }
    };

    // Mount pattern: load once, then control visibility
    if (visible && !sourceLoadedRef.current) {
      if (mapInstance.isStyleLoaded()) {
        loadSourceAndLayers();
      } else {
        mapInstance.once('styledata', loadSourceAndLayers);
      }
    }

    if (layersAddedRef.current) {
      const visibility = visible ? 'visible' : 'none';
      try {
        if (mapInstance.getLayer(POWER_LINES_LAYER_ID)) {
          mapInstance.setLayoutProperty(POWER_LINES_LAYER_ID, 'visibility', visibility);
        }
        if (mapInstance.getLayer(POWER_HALO_LAYER_ID)) {
          mapInstance.setLayoutProperty(POWER_HALO_LAYER_ID, 'visibility', visibility);
        }
        if (mapInstance.getLayer(POWER_LABEL_LAYER_ID)) {
          mapInstance.setLayoutProperty(POWER_LABEL_LAYER_ID, 'visibility', visibility);
        }
        if (mapInstance.getLayer(GAS_LINES_LAYER_ID)) {
          mapInstance.setLayoutProperty(GAS_LINES_LAYER_ID, 'visibility', visibility);
        }
        if (mapInstance.getLayer(GAS_LABEL_LAYER_ID)) {
          mapInstance.setLayoutProperty(GAS_LABEL_LAYER_ID, 'visibility', visibility);
        }
        console.log('🔄 [TexasEnergyCorridors] Visibility set to:', visibility);
      } catch (error) {
        console.error('❌ [TexasEnergyCorridors] Error toggling visibility:', error);
      }
    }

    // Cleanup: just hide layers on unmount; keep source cached
    return () => {
      if (!mapInstance) return;
      try {
        if (mapInstance.getLayer(POWER_LINES_LAYER_ID)) {
          mapInstance.setLayoutProperty(POWER_LINES_LAYER_ID, 'visibility', 'none');
        }
        if (mapInstance.getLayer(POWER_HALO_LAYER_ID)) {
          mapInstance.setLayoutProperty(POWER_HALO_LAYER_ID, 'visibility', 'none');
        }
        if (mapInstance.getLayer(POWER_LABEL_LAYER_ID)) {
          mapInstance.setLayoutProperty(POWER_LABEL_LAYER_ID, 'visibility', 'none');
        }
        if (mapInstance.getLayer(GAS_LINES_LAYER_ID)) {
          mapInstance.setLayoutProperty(GAS_LINES_LAYER_ID, 'visibility', 'none');
        }
        if (mapInstance.getLayer(GAS_LABEL_LAYER_ID)) {
          mapInstance.setLayoutProperty(GAS_LABEL_LAYER_ID, 'visibility', 'none');
        }
      } catch (error) {
        // ignore cleanup errors
      }
    };
  }, [map, visible]);

  return null;
};

export default TexasEnergyCorridorsLayer;


