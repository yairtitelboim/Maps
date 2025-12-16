import React, { useCallback, useEffect, useRef } from 'react';
import * as turf from '@turf/turf';

const SOURCE_ID = 'water-layer-source';
const LAYER_ID = 'water-layer-circles';
const DATA_URL = '/data/osm/corridor_water.geojson';
const FEATURE_LIMIT = 8000;

const processFeature = (feature, index) => {
  if (!feature || !feature.geometry) return null;

  let pointGeometry = null;

  switch (feature.geometry.type) {
    case 'Point':
    case 'MultiPoint':
      pointGeometry = feature.geometry.type === 'Point'
        ? feature.geometry
        : {
            type: 'Point',
            coordinates: feature.geometry.coordinates[0]
          };
      break;
    case 'LineString':
    case 'MultiLineString':
    case 'Polygon':
    case 'MultiPolygon':
      try {
        const centroid = turf.centroid(feature);
        pointGeometry = centroid.geometry;
      } catch (error) {
        console.warn('💦 WaterLayer: Failed to compute centroid for feature', error);
      }
      break;
    default:
      break;
  }

  if (!pointGeometry) return null;

  return {
    type: 'Feature',
    geometry: pointGeometry,
    properties: {
      ...feature.properties,
      __waterId: feature.properties?.id ?? `water-${index}`
    }
  };
};

const WaterLayer = ({ map, visible }) => {
  const dataRef = useRef(null);
  const loadingRef = useRef(false);

  const removeLayer = useCallback(() => {
    if (!map?.current) return;
    const mapInstance = map.current;

    if (mapInstance.getLayer(LAYER_ID)) {
      mapInstance.removeLayer(LAYER_ID);
    }
    if (mapInstance.getSource(SOURCE_ID)) {
      mapInstance.removeSource(SOURCE_ID);
    }
  }, [map]);

  const ensureLayer = useCallback((mapInstance, data) => {
    if (!mapInstance.getSource(SOURCE_ID)) {
      mapInstance.addSource(SOURCE_ID, {
        type: 'geojson',
        data
      });
    } else {
      mapInstance.getSource(SOURCE_ID).setData(data);
    }

    if (!mapInstance.getLayer(LAYER_ID)) {
      mapInstance.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 3,
          'circle-color': '#0099FF',
          'circle-opacity': 0.37
        }
      });
    }
  }, []);

  const setVisibility = useCallback((mapInstance, isVisible) => {
    if (!mapInstance.getLayer(LAYER_ID)) return;
    mapInstance.setLayoutProperty(
      LAYER_ID,
      'visibility',
      isVisible ? 'visible' : 'none'
    );
  }, []);

  const loadData = useCallback(async () => {
    if (dataRef.current || loadingRef.current) {
      return dataRef.current;
    }

    loadingRef.current = true;
    try {
      const response = await fetch(DATA_URL);
      if (!response.ok) {
        throw new Error(`Failed to load ${DATA_URL} (status ${response.status})`);
      }

      const geojson = await response.json();
      const features = Array.isArray(geojson?.features) ? geojson.features : [];

      const processedFeatures = [];
      for (let i = 0; i < features.length && processedFeatures.length < FEATURE_LIMIT; i += 1) {
        const processed = processFeature(features[i], processedFeatures.length);
        if (processed?.geometry?.coordinates) {
          processedFeatures.push(processed);
        }
      }

      const collection = {
        type: 'FeatureCollection',
        features: processedFeatures
      };

      dataRef.current = collection;
      return collection;
    } catch (error) {
      console.error('💦 WaterLayer: Error loading data:', error);
      return null;
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const addLayer = useCallback(async () => {
    if (!map?.current) return;
    const mapInstance = map.current;

    const data = await loadData();
    if (!data) {
      console.warn('💦 WaterLayer: No data available; skipping layer creation.');
      return;
    }

    ensureLayer(mapInstance, data);
    setVisibility(mapInstance, true);
  }, [ensureLayer, loadData, map, setVisibility]);

  useEffect(() => {
    if (!map?.current) return;
    const mapInstance = map.current;

    const handleStyleData = () => {
      if (!mapInstance.isStyleLoaded()) return;
      if (visible) {
        addLayer();
      } else {
        setVisibility(mapInstance, false);
      }
    };

    if (mapInstance.isStyleLoaded()) {
      handleStyleData();
    } else {
      mapInstance.once('styledata', handleStyleData);
    }

    mapInstance.on('styledata', handleStyleData);

    return () => {
      mapInstance.off('styledata', handleStyleData);
      removeLayer();
    };
  }, [addLayer, map, removeLayer, setVisibility, visible]);

  useEffect(() => {
    if (!map?.current) return;
    const mapInstance = map.current;

    if (!visible) {
      setVisibility(mapInstance, false);
      return undefined;
    }

    if (mapInstance.isStyleLoaded()) {
      addLayer();
      return undefined;
    }

    const onStyleData = () => addLayer();
    mapInstance.once('styledata', onStyleData);
    return () => mapInstance.off('styledata', onStyleData);
  }, [addLayer, map, setVisibility, visible]);

  return null;
};

export default WaterLayer;
