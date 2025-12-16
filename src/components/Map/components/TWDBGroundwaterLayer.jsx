import React, { useCallback, useEffect, useRef } from 'react';

const SOURCE_ID = 'twdb-groundwater-source';
const LAYER_ID = 'twdb-groundwater-layer';
const DATA_URL = '/data/TWDB_Groundwater.geojson';

const ensureSourceAndLayer = (mapInstance, data) => {
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
        'circle-radius': 1,
        'circle-color': '#0066cc',
        'circle-opacity': 0.7
      }
    });
  }
};

const setVisibility = (mapInstance, visible) => {
  if (!mapInstance.getLayer(LAYER_ID)) return;

  mapInstance.setLayoutProperty(
    LAYER_ID,
    'visibility',
    visible ? 'visible' : 'none'
  );
};

const TWDBGroundwaterLayer = ({ map, visible }) => {
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
      const data = await response.json();
      if (!data?.features) {
        throw new Error('Invalid GeoJSON structure');
      }
      dataRef.current = data;
      return data;
    } catch (error) {
      console.error('💧 TWDBGroundwaterLayer: Error loading data:', error);
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
      console.warn('💧 TWDBGroundwaterLayer: No data available; layer will not be shown.');
      return;
    }

    ensureSourceAndLayer(mapInstance, data);
    setVisibility(mapInstance, true);
  }, [loadData, map]);

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
  }, [addLayer, map, removeLayer, visible]);

  useEffect(() => {
    if (!map?.current) return;
    const mapInstance = map.current;

    if (!visible) {
      setVisibility(mapInstance, false);
      return () => {
        removeLayer();
      };
    }

    if (mapInstance.isStyleLoaded()) {
      addLayer();
    } else {
      const onStyleData = () => addLayer();
      mapInstance.once('styledata', onStyleData);
      return () => mapInstance.off('styledata', onStyleData);
    }
  }, [addLayer, map, removeLayer, visible]);

  return null;
};

export default TWDBGroundwaterLayer;
