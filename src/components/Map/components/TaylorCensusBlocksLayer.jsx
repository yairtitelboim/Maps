import React, { useCallback, useEffect, useRef } from 'react';

const SOURCE_ID = 'taylor-census-blocks-source';
const FILL_LAYER_ID = 'taylor-census-blocks-fill';
const LINE_LAYER_ID = 'taylor-census-blocks-line';
const DATA_URL = '/data/osm/taylor_census_blocks_tx_150mi.geojson';

const TaylorCensusBlocksLayer = ({ map, visible }) => {
  const dataRef = useRef(null);
  const loadingRef = useRef(false);
  const mountedRef = useRef(false);
  const didFitRef = useRef(false);
  const hoverIdRef = useRef(null);
  const hoverMoveHandlerRef = useRef(null);
  const hoverLeaveHandlerRef = useRef(null);
  const hoverHandlersAttachedRef = useRef(false);

  const removeLayers = useCallback((m, removeSource = false) => {
    if (!m) return;
    if (hoverHandlersAttachedRef.current) {
      if (hoverMoveHandlerRef.current) {
        m.off('mousemove', FILL_LAYER_ID, hoverMoveHandlerRef.current);
      }
      if (hoverLeaveHandlerRef.current) {
        m.off('mouseleave', FILL_LAYER_ID, hoverLeaveHandlerRef.current);
      }
      hoverHandlersAttachedRef.current = false;
      hoverMoveHandlerRef.current = null;
      hoverLeaveHandlerRef.current = null;
      if (hoverIdRef.current !== null) {
        try {
          m.setFeatureState({ source: SOURCE_ID, id: hoverIdRef.current }, { hover: false });
        } catch (err) {
          console.warn('TaylorCensusBlocksLayer: failed clearing hover state during removal', err);
        }
        hoverIdRef.current = null;
      }
      if (m.getCanvas()) {
        m.getCanvas().style.cursor = '';
      }
    }
    if (m.getLayer(LINE_LAYER_ID)) m.removeLayer(LINE_LAYER_ID);
    if (m.getLayer(FILL_LAYER_ID)) m.removeLayer(FILL_LAYER_ID);
    if (removeSource && m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
    mountedRef.current = false;
    didFitRef.current = false;
  }, []);

  const computeBounds = useCallback((data) => {
    if (!data?.features?.length) return null;

    let minLng = Number.POSITIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;

    const push = ([lng, lat]) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    };

    const walk = (geometry) => {
      if (!geometry?.coordinates) return;
      const { type, coordinates } = geometry;
      switch (type) {
        case 'Point':
          push(coordinates);
          break;
        case 'MultiPoint':
        case 'LineString':
          coordinates.forEach(push);
          break;
        case 'MultiLineString':
        case 'Polygon':
          coordinates.forEach((ring) => ring.forEach(push));
          break;
        case 'MultiPolygon':
          coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach(push)));
          break;
        default:
          break;
      }
    };

    data.features.forEach((feature) => walk(feature.geometry));

    if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
      return null;
    }

    return [
      [minLng, minLat],
      [maxLng, maxLat]
    ];
  }, []);

  const ensureLayers = useCallback((m, data) => {
    if (!m.getSource(SOURCE_ID)) {
      m.addSource(SOURCE_ID, { type: 'geojson', data, generateId: true });
    } else {
      m.getSource(SOURCE_ID).setData(data);
    }

    if (!m.getLayer(FILL_LAYER_ID)) {
      m.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': '#ef4444',
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.12, 0.01]
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
          'line-color': '#ef4444',
          'line-width': 1.5,
          'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0]
        }
      });
    }

    try {
      // Ensure fill sits below outline for crisp edges
      if (m.getLayer(LINE_LAYER_ID) && m.getLayer(FILL_LAYER_ID)) {
        m.moveLayer(FILL_LAYER_ID, LINE_LAYER_ID);
      }
      // Bring outline to the top of custom layers
      if (m.getLayer(LINE_LAYER_ID)) {
        m.moveLayer(LINE_LAYER_ID);
      }
    } catch (error) {
      console.warn('TaylorCensusBlocksLayer: failed to reorder layers', error);
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
      const features = Array.isArray(geojson?.features) ? geojson.features : [];

      const enriched = features.map((feature, index) => {
        const props = feature.properties && typeof feature.properties === 'object' ? { ...feature.properties } : {};
        props.__tc_index = index;
        return {
          ...feature,
          properties: props
        };
      });

      dataRef.current = {
        type: 'FeatureCollection',
        features: enriched
      };
      return dataRef.current;
    } catch (error) {
      console.error('TaylorCensusBlocksLayer: data load error', error);
      return null;
    } finally {
      loadingRef.current = false;
    }
  }, []);

    const attachHoverHandlers = useCallback((m) => {
    if (!m?.getLayer(FILL_LAYER_ID) || hoverHandlersAttachedRef.current) {
      return;
    }

    const clearHoverState = () => {
      if (hoverIdRef.current !== null) {
        try {
          m.setFeatureState({ source: SOURCE_ID, id: hoverIdRef.current }, { hover: false });
        } catch (err) {
          console.warn('TaylorCensusBlocksLayer: failed clearing hover state', err);
        }
        hoverIdRef.current = null;
      }
      if (m.getCanvas()) {
        m.getCanvas().style.cursor = '';
      }
    };

    const handleMouseMove = (event) => {
      if (!event?.features?.length) {
        clearHoverState();
        return;
      }
      const feature = event.features[0];
      if (!feature || feature.id === undefined || feature.id === null) {
        clearHoverState();
        return;
      }

      if (hoverIdRef.current !== null && hoverIdRef.current !== feature.id) {
        try {
          m.setFeatureState({ source: SOURCE_ID, id: hoverIdRef.current }, { hover: false });
        } catch (err) {
          console.warn('TaylorCensusBlocksLayer: failed updating previous hover state', err);
        }
      }

      hoverIdRef.current = feature.id;
      try {
        m.setFeatureState({ source: SOURCE_ID, id: feature.id }, { hover: true });
      } catch (err) {
        console.warn('TaylorCensusBlocksLayer: failed setting hover state', err);
      }

      if (m.getCanvas()) {
        m.getCanvas().style.cursor = 'pointer';
      }
    };

    const handleMouseLeave = () => {
      clearHoverState();
    };

    hoverMoveHandlerRef.current = handleMouseMove;
    hoverLeaveHandlerRef.current = handleMouseLeave;
    m.on('mousemove', FILL_LAYER_ID, handleMouseMove);
    m.on('mouseleave', FILL_LAYER_ID, handleMouseLeave);
    hoverHandlersAttachedRef.current = true;
  }, []);

  const addLayer = useCallback(async (mapInstance) => {
    const m = mapInstance || map?.current;
    const data = await loadData();
    if (!data) return;
    ensureLayers(m, data);
    setVisibility(m, true);
    attachHoverHandlers(m);

    if (!didFitRef.current && typeof m.fitBounds === 'function') {
      const bounds = computeBounds(data);
      if (bounds) {
        try {
          m.fitBounds(bounds, { padding: 48, duration: 1200, essential: false });
          didFitRef.current = true;
        } catch (error) {
          console.warn('TaylorCensusBlocksLayer: failed to fit bounds', error);
        }
      }
    }
  }, [attachHoverHandlers, computeBounds, ensureLayers, loadData, map, setVisibility]);

  const initializeLayer = useCallback((m) => {
    if (!m) return;
    const hasLayers = !!(m.getLayer(FILL_LAYER_ID) && m.getLayer(LINE_LAYER_ID));

    if (visible) {
      if (!mountedRef.current || !hasLayers) {
        mountedRef.current = false;
        addLayer(m);
      } else {
        setVisibility(m, true);
        attachHoverHandlers(m);
      }
    } else {
      if (mountedRef.current && hasLayers) {
        removeLayers(m);
      } else if (hasLayers) {
        setVisibility(m, false);
      }
    }
}, [addLayer, attachHoverHandlers, removeLayers, setVisibility, visible]);

  useEffect(() => {
    let cancelled = false;
    let frameId = null;
    let styleHandler = null;

    const ensureReady = () => {
      if (cancelled) return;
      const m = map?.current;
      if (!m) {
        frameId = requestAnimationFrame(ensureReady);
        return;
      }

      const proceed = () => {
        if (cancelled) return;
        initializeLayer(m);
      };

      if (typeof m.isStyleLoaded === 'function' && !m.isStyleLoaded()) {
        styleHandler = () => {
          m.off('style.load', styleHandler);
          styleHandler = null;
          proceed();
        };
        m.on('style.load', styleHandler);
        return;
      }

      proceed();
    };

    ensureReady();

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (styleHandler && map?.current) {
        map.current.off('style.load', styleHandler);
      }
    };
  }, [initializeLayer, map]);

  useEffect(() => {
    const eventBus = typeof window !== 'undefined' ? window.mapEventBus : null;
    if (!eventBus || typeof eventBus.on !== 'function') return undefined;

    const handleToggle = (enabled) => {
      const m = map?.current;
      if (!m) return;
      if (enabled) {
        initializeLayer(m);
      } else {
        removeLayers(m);
      }
    };

    eventBus.on('taylor-blocks:toggle', handleToggle);

    return () => {
      if (typeof eventBus.off === 'function') {
        eventBus.off('taylor-blocks:toggle', handleToggle);
      }
    };
  }, [initializeLayer, map, removeLayers]);

  useEffect(() => {
    if (!map?.current) return undefined;
    const m = map.current;

    const clearHoverState = () => {
      if (hoverIdRef.current !== null) {
        try {
          m.setFeatureState({ source: SOURCE_ID, id: hoverIdRef.current }, { hover: false });
        } catch (err) {
          console.warn('TaylorCensusBlocksLayer: failed clearing hover state', err);
        }
        hoverIdRef.current = null;
      }
      if (m && m.getCanvas()) {
        m.getCanvas().style.cursor = '';
      }
    };

    if (!visible) {
      if (hoverHandlersAttachedRef.current) {
        if (hoverMoveHandlerRef.current) {
          m.off('mousemove', FILL_LAYER_ID, hoverMoveHandlerRef.current);
          hoverMoveHandlerRef.current = null;
        }
        if (hoverLeaveHandlerRef.current) {
          m.off('mouseleave', FILL_LAYER_ID, hoverLeaveHandlerRef.current);
          hoverLeaveHandlerRef.current = null;
        }
        hoverHandlersAttachedRef.current = false;
      }
      if (hoverIdRef.current !== null) {
        try {
          m.setFeatureState({ source: SOURCE_ID, id: hoverIdRef.current }, { hover: false });
        } catch (err) {
          console.warn('TaylorCensusBlocksLayer: failed clearing hover state on visibility off', err);
        }
        hoverIdRef.current = null;
      }
      if (m.getCanvas()) {
        m.getCanvas().style.cursor = '';
      }
      return undefined;
    }

    attachHoverHandlers(m);

    return () => {
      if (hoverHandlersAttachedRef.current) {
        if (hoverMoveHandlerRef.current) {
          m.off('mousemove', FILL_LAYER_ID, hoverMoveHandlerRef.current);
          hoverMoveHandlerRef.current = null;
        }
        if (hoverLeaveHandlerRef.current) {
          m.off('mouseleave', FILL_LAYER_ID, hoverLeaveHandlerRef.current);
          hoverLeaveHandlerRef.current = null;
        }
        hoverHandlersAttachedRef.current = false;
      }
      if (hoverIdRef.current !== null) {
        try {
          m.setFeatureState({ source: SOURCE_ID, id: hoverIdRef.current }, { hover: false });
        } catch (err) {
          console.warn('TaylorCensusBlocksLayer: failed clearing hover state on cleanup', err);
        }
        hoverIdRef.current = null;
      }
      if (m.getCanvas()) {
        m.getCanvas().style.cursor = '';
      }
    };
  }, [attachHoverHandlers, map, visible]);

  useEffect(() => () => {
    if (!map?.current) return;
    removeLayers(map.current, true);
  }, [map, removeLayers]);

  return null;
};

export default TaylorCensusBlocksLayer;
