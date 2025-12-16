import React, { useEffect, useRef } from 'react';
import * as turf from '@turf/turf';

const SOURCE_ID = 'population-isochrones-source';
const FILL_LAYER_ID = `${SOURCE_ID}-fill`;
const OUTLINE_LAYER_ID = `${SOURCE_ID}-outline`;
const DATA_PATH = '/blockgroups_nc_region.geojson';
const POPULATION_PROPERTY = 'population_total';
const POPULATION_KEYS = [
  'total_population_2022',
  'B01003_001E_2022',
  'population',
  'POPULATION',
  'POP',
  'pop_total'
];

const COLOR_PALETTE = [
  'rgba(51,0,0,0.25)',
  'rgba(102,0,0,0.35)',
  'rgba(153,0,0,0.45)',
  'rgba(204,0,0,0.55)',
  'rgba(255,0,0,0.65)',
  'rgba(255,51,51,0.75)'
];

const OUTLINE_COLORS = ['#0f172a', '#1d4ed8', '#2563eb', '#0891b2', '#0f766e', '#991b1b'];

const QUANTILE_BREAKS = [0.2, 0.4, 0.6, 0.8];

const computeQuantileStops = (values) => {
  const filtered = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!filtered.length) return [];

  const stops = QUANTILE_BREAKS.map((percentile) => {
    const index = Math.min(filtered.length - 1, Math.floor(percentile * (filtered.length - 1)));
    return filtered[index];
  });

  // Remove duplicates while preserving ascending order
  return [...new Set(stops)].sort((a, b) => a - b);
};

const createStepExpression = (stops, colors) => {
  if (!stops.length) {
    return ['interpolate', ['linear'], ['get', POPULATION_PROPERTY], 0, colors[0], 1, colors[colors.length - 1]];
  }

  const expression = ['step', ['get', POPULATION_PROPERTY], colors[0]];
  stops.forEach((stop, index) => {
    const color = colors[Math.min(index + 1, colors.length - 1)];
    expression.push(stop, color);
  });
  return expression;
};

const PopulationIsochronesLayer = ({ map, visible }) => {
  const datasetRef = useRef(null);
  const thresholdsRef = useRef([]);
  const isMountedRef = useRef(false);
  const styleListenerAttachedRef = useRef(false);
  const didFitBoundsRef = useRef(false);

  useEffect(() => {
    if (!map?.current) return;
    const mapInstance = map.current;
    let cancelled = false;

    const removeLayers = () => {
      if (mapInstance.getLayer(OUTLINE_LAYER_ID)) {
        mapInstance.removeLayer(OUTLINE_LAYER_ID);
      }
      if (mapInstance.getLayer(FILL_LAYER_ID)) {
        mapInstance.removeLayer(FILL_LAYER_ID);
      }
      if (mapInstance.getSource(SOURCE_ID)) {
        mapInstance.removeSource(SOURCE_ID);
      }
    };

    const emitLegend = () => {
      if (typeof window === 'undefined' || !window.mapEventBus) return;
      window.mapEventBus.emit('population-isochrones:loaded', {
        thresholds: thresholdsRef.current,
        property: POPULATION_PROPERTY,
        generatedAt: new Date().toISOString()
      });
    };

    const ensureLayer = async () => {
      try {
        if (cancelled || !visible) return;

        if (!datasetRef.current) {
          const response = await fetch(DATA_PATH);
          if (!response.ok) {
            throw new Error(`Failed to load ${DATA_PATH} (${response.status})`);
          }
          const json = await response.json();
          const enrichedFeatures = (json.features || []).map((feature) => {
            const population = (() => {
              const properties = feature?.properties || {};
              for (const key of POPULATION_KEYS) {
                if (properties[key] !== undefined && properties[key] !== null && properties[key] !== '') {
                  const parsed = Number(properties[key]);
                  if (Number.isFinite(parsed)) {
                    return parsed;
                  }
                }
              }
              return 0;
            })();
            return {
              ...feature,
              properties: {
                ...feature.properties,
                [POPULATION_PROPERTY]: population
              }
            };
          });
          datasetRef.current = {
            type: 'FeatureCollection',
            features: enrichedFeatures
          };
        }

        const dataset = datasetRef.current;
        if (!dataset?.features?.length) {
          return;
        }

        const populations = dataset.features.map((feature) => feature.properties?.[POPULATION_PROPERTY] ?? 0);
        thresholdsRef.current = computeQuantileStops(populations);
        const validPopulations = populations.filter((value) => Number.isFinite(value) && value > 0);
        console.log(
          '👥 PopulationIsochronesLayer: features',
          dataset.features.length,
          'valid population count',
          validPopulations.length
        );

        if (mapInstance.getSource(SOURCE_ID)) {
          mapInstance.getSource(SOURCE_ID).setData(dataset);
        } else {
          mapInstance.addSource(SOURCE_ID, {
            type: 'geojson',
            data: dataset
          });
        }

        if (!didFitBoundsRef.current && typeof mapInstance.fitBounds === 'function') {
          const shouldSkipFit =
            typeof window !== 'undefined' && window.populationIsochronesDisableFitOnce === true;

          if (shouldSkipFit) {
            didFitBoundsRef.current = true;
            window.populationIsochronesDisableFitOnce = false;
          } else {
            try {
              const [minLng, minLat, maxLng, maxLat] = turf.bbox(dataset);
              if (Number.isFinite(minLng) && Number.isFinite(minLat) && Number.isFinite(maxLng) && Number.isFinite(maxLat)) {
                mapInstance.fitBounds(
                  [
                    [minLng, minLat],
                    [maxLng, maxLat]
                  ],
                  {
                    padding: 48,
                    duration: 1200
                  }
                );
                didFitBoundsRef.current = true;
              }
            } catch (boundsError) {
              console.warn('PopulationIsochronesLayer: failed to compute bounds', boundsError);
            }
          }
        }

        const beforeLayer =
          mapInstance.getLayer('admin-1-boundary') ||
          mapInstance.getLayer('waterway-label') ||
          mapInstance.getLayer('road-label');

        const fillColorExpression = createStepExpression(thresholdsRef.current, COLOR_PALETTE);
        const outlineColorExpression = createStepExpression(thresholdsRef.current, OUTLINE_COLORS);

        if (!mapInstance.getLayer(FILL_LAYER_ID)) {
          mapInstance.addLayer(
            {
              id: FILL_LAYER_ID,
              type: 'fill',
              source: SOURCE_ID,
              paint: {
                'fill-color': fillColorExpression,
                'fill-opacity': 0.55
              }
            },
            beforeLayer ? beforeLayer.id : undefined
          );
        } else {
          mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-color', fillColorExpression);
        }

        if (!mapInstance.getLayer(OUTLINE_LAYER_ID)) {
          mapInstance.addLayer(
            {
              id: OUTLINE_LAYER_ID,
              type: 'line',
              source: SOURCE_ID,
              paint: {
                'line-color': outlineColorExpression,
                'line-width': 0.8,
                'line-opacity': 0.8
              }
            },
            FILL_LAYER_ID
          );
        } else {
          mapInstance.setPaintProperty(OUTLINE_LAYER_ID, 'line-color', outlineColorExpression);
        }

        emitLegend();
        console.log('👥 PopulationIsochronesLayer: rendered with thresholds', thresholdsRef.current);
        isMountedRef.current = true;
      } catch (error) {
        console.error('❌ PopulationIsochronesLayer: Failed to render population data', error);
      }
    };

    const handleStyleData = () => {
      if (!visible || cancelled) return;
      ensureLayer();
    };

    if (!visible) {
      if (isMountedRef.current && typeof window !== 'undefined' && window.mapEventBus) {
        window.mapEventBus.emit('population-isochrones:unmounted');
      }
      removeLayers();
      isMountedRef.current = false;
      didFitBoundsRef.current = false;
      if (styleListenerAttachedRef.current) {
        mapInstance.off('styledata', handleStyleData);
        styleListenerAttachedRef.current = false;
      }
      return undefined;
    }

    if (!mapInstance.isStyleLoaded()) {
      const waitForStyle = () => {
        ensureLayer();
        mapInstance.off('styledata', waitForStyle);
      };
      mapInstance.on('styledata', waitForStyle);
      return () => {
        cancelled = true;
        mapInstance.off('styledata', waitForStyle);
      };
    }

    ensureLayer();

    if (!styleListenerAttachedRef.current) {
      mapInstance.on('styledata', handleStyleData);
      styleListenerAttachedRef.current = true;
    }

    return () => {
      cancelled = true;
      if (!visible) {
        removeLayers();
      }
      if (styleListenerAttachedRef.current) {
        mapInstance.off('styledata', handleStyleData);
        styleListenerAttachedRef.current = false;
      }
    };
  }, [map, visible]);

  useEffect(() => {
    return () => {
      if (!map?.current) return;
      const mapInstance = map.current;
      if (mapInstance.getLayer(OUTLINE_LAYER_ID)) {
        mapInstance.removeLayer(OUTLINE_LAYER_ID);
      }
      if (mapInstance.getLayer(FILL_LAYER_ID)) {
        mapInstance.removeLayer(FILL_LAYER_ID);
      }
      if (mapInstance.getSource(SOURCE_ID)) {
        mapInstance.removeSource(SOURCE_ID);
      }
    };
  }, [map]);

  return null;
};

export default PopulationIsochronesLayer;
