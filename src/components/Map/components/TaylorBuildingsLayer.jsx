import React, { useCallback, useEffect, useRef } from 'react';

const SOURCE_ID = 'taylor-buildings-source';
const FILL_LAYER_ID = 'taylor-buildings-fill';
const LINE_LAYER_ID = 'taylor-buildings-line';
const DATA_URL = '/data/osm/taylor_buildings.geojson';

const TaylorBuildingsLayer = ({ map, visible }) => {
  const dataRef = useRef(null);
  const loadingRef = useRef(false);
  const mountedRef = useRef(false);

  const removeLayer = useCallback(() => {
    if (!map?.current) return;
    const m = map.current;
    if (m.getLayer(FILL_LAYER_ID)) m.removeLayer(FILL_LAYER_ID);
    if (m.getLayer(LINE_LAYER_ID)) m.removeLayer(LINE_LAYER_ID);
    if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
  }, [map]);

  const ensureLayers = useCallback((m, data) => {
    if (!m.getSource(SOURCE_ID)) {
      m.addSource(SOURCE_ID, { type: 'geojson', data });
    } else {
      m.getSource(SOURCE_ID).setData(data);
    }

    if (!m.getLayer(FILL_LAYER_ID)) {
      m.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': '#ffffff',
          'fill-opacity': 0.6
        },
        filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']]
      });
    }

    if (!m.getLayer(LINE_LAYER_ID)) {
      m.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#ffffff',
          'line-width': 0.5,
          'line-opacity': 0.8
        }
      });
    }
    mountedRef.current = true;
  }, []);

  const setVisibility = useCallback((m, isVisible) => {
    if (m.getLayer(FILL_LAYER_ID)) m.setLayoutProperty(FILL_LAYER_ID, 'visibility', isVisible ? 'visible' : 'none');
    if (m.getLayer(LINE_LAYER_ID)) m.setLayoutProperty(LINE_LAYER_ID, 'visibility', isVisible ? 'visible' : 'none');
  }, []);

  const loadData = useCallback(async () => {
    if (dataRef.current || loadingRef.current) return dataRef.current;
    loadingRef.current = true;
    try {
      const resp = await fetch(DATA_URL);
      if (!resp.ok) throw new Error(`Failed to load ${DATA_URL} (${resp.status})`);
      const geojson = await resp.json();
      dataRef.current = geojson;
      return geojson;
    } catch (e) {
      console.error('TaylorBuildingsLayer: data load error', e);
      return null;
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const addLayer = useCallback(async () => {
    if (!map?.current) return;
    const m = map.current;
    const data = await loadData();
    if (!data) return;
    ensureLayers(m, data);
    setVisibility(m, true);
  }, [ensureLayers, loadData, map, setVisibility]);

  useEffect(() => {
    if (!map?.current) return;
    const m = map.current;
    const init = () => {
      if (visible) {
        // Only add once; subsequent toggles just change visibility
        if (!mountedRef.current) {
          addLayer();
        } else {
          setVisibility(m, true);
        }
      } else {
        setVisibility(m, false);
      }
    };

    if (m.isStyleLoaded()) {
      init();
    } else {
      m.once('style.load', init);
    }

    return () => {
      // Do not remove layers on dependency changes; keep them mounted.
      // Only visibility toggles happen via the effect above.
    };
  }, [addLayer, map, removeLayer, setVisibility, visible]);

  // Remove layers only when component unmounts
  useEffect(() => () => {
    if (!map?.current) return;
    removeLayer();
    mountedRef.current = false;
  }, [map, removeLayer]);

  useEffect(() => {
    if (!map?.current) return;
    const m = map.current;
    if (!visible) {
      setVisibility(m, false);
      return undefined;
    }
    if (m.isStyleLoaded()) {
      addLayer();
      return undefined;
    }
    const once = () => addLayer();
    m.once('styledata', once);
    return () => m.off('styledata', once);
  }, [addLayer, map, setVisibility, visible]);

  return null;
};

export default TaylorBuildingsLayer;
