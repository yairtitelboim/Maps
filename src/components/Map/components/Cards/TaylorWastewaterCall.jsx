import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  TAYLOR_WASTEWATER_SITES,
  TAYLOR_WASTEWATER_SITE_KEYS,
  getTaylorWastewaterSiteByKey
} from '../../../../config/taylorWastewaterSites';

const ACTIVE_FILL_OPACITY = 0.18;
const ACTIVE_LINE_OPACITY = 0.22;
const ACTIVE_POINT_RADIUS = 2;
const ACTIVE_POINT_OPACITY = 0.3;
const ACTIVE_POINT_STROKE_OPACITY = 0.4;

const STRATEGIC_MARKERS = [
  {
    key: 'downtown_taylor',
    id: 'marker-downtown-taylor',
    center: { lat: 30.5709, lng: -97.4097 },
    title: 'Downtown Taylor, TX',
    subtitle: 'City center • anchor for wastewater and reuse analysis',
    autoOpen: true,
    color: '#10b981',
    iconImage: 'marker-teardrop-green',
    category: 'Municipal Anchor',
    strokeColor: '#064e3b'
  },
  {
    key: 'downtown_austin',
    id: 'marker-downtown-austin',
    center: { lat: 30.2711, lng: -97.7431 },
    title: 'Downtown Austin, TX',
    subtitle: 'Regional core • tech and civic infrastructure nexus',
    autoOpen: false,
    color: '#10b981',
    iconImage: 'marker-teardrop-green',
    category: 'Municipal Anchor',
    strokeColor: '#064e3b'
  },
  {
    key: 'downtown_san_antonio',
    id: 'marker-downtown-san-antonio',
    center: { lat: 29.4241, lng: -98.4936 },
    title: 'Downtown San Antonio, TX',
    subtitle: 'Regional hub • logistics, water, and power coordination',
    autoOpen: false,
    color: '#10b981',
    iconImage: 'marker-teardrop-green',
    category: 'Municipal Anchor',
    strokeColor: '#064e3b'
  },
  {
    key: 'samsung_taylor_fab',
    id: 'marker-samsung-taylor-fab',
    center: { lat: 30.543, lng: -97.388 },
    title: 'Samsung Electronics – Taylor Fab (NEW)',
    subtitle: '1530 FM 973 • 6M sq ft • $37B • 200+ MW • Target 2026',
    autoOpen: false,
    color: '#ef4444',
    iconImage: 'marker-teardrop-red',
    category: 'Semiconductor Manufacturing',
    strokeColor: '#7f1d1d'
  },
  {
    key: 'samsung_austin_semiconductor',
    id: 'marker-samsung-austin-semiconductor',
    center: { lat: 30.371, lng: -97.635 },
    title: 'Samsung Austin Semiconductor (Existing)',
    subtitle: '12100 Samsung Blvd • Operational since 1997 • $18B+',
    autoOpen: false,
    color: '#ef4444',
    iconImage: 'marker-teardrop-red',
    category: 'Semiconductor Manufacturing',
    strokeColor: '#7f1d1d'
  },
  {
    key: 'soulbrain_taylor',
    id: 'marker-soulbrain-taylor',
    center: { lat: 30.566, lng: -97.366 },
    title: 'Soulbrain TX LLC (Samsung Supplier)',
    subtitle: '201 FM-3349 • $175M • Phosphoric acid plant • Starts 2025',
    autoOpen: false,
    color: '#ef4444',
    iconImage: 'marker-teardrop-red',
    category: 'Semiconductor Supply Chain',
    strokeColor: '#7f1d1d'
  },
  {
    key: 'riot_whinstone',
    id: 'marker-riot-whinstone',
    center: { lat: 30.655, lng: -97.028 },
    title: 'Riot Platforms – Whinstone Facility',
    subtitle: '11025 FM 908 • 100 acres • 750 MW planned • Operational',
    autoOpen: false,
    color: '#ef4444',
    iconImage: 'marker-teardrop-red',
    category: 'Bitcoin Mining',
    strokeColor: '#7f1d1d'
  },
  {
    key: 'bitdeer_rockdale',
    id: 'marker-bitdeer-rockdale',
    center: { lat: 30.651, lng: -97.023 },
    title: 'Bitdeer (Bitmain) – Rockdale Campus',
    subtitle: '3291 Charles Martin Hall Rd • 170 MW → 742 MW expansion',
    autoOpen: false,
    color: '#ef4444',
    iconImage: 'marker-teardrop-red',
    category: 'Bitcoin Mining',
    strokeColor: '#7f1d1d'
  },
  {
    key: 'epcor_sandow',
    id: 'marker-epcor-sandow',
    center: { lat: 30.636, lng: -97.12 },
    title: 'EPCOR Sandow Water Project',
    subtitle: 'Milam County • Carrizo-Wilcox supply • Industrial pipeline',
    autoOpen: false,
    color: '#ef4444',
    iconImage: 'marker-teardrop-red',
    category: 'Water Infrastructure',
    strokeColor: '#1f2937'
  },
  {
    key: 'epcor_blue_sky',
    id: 'marker-epcor-blue-sky',
    center: { lat: 30.562, lng: -97.407 },
    title: 'EPCOR Blue Sky Water Reclamation',
    subtitle: 'Taylor • 75% reuse target • Supports Samsung operations',
    autoOpen: false,
    color: '#ef4444',
    iconImage: 'marker-teardrop-red',
    category: 'Water Infrastructure',
    strokeColor: '#1f2937'
  },
  {
    key: 'former_alcoa_smelter',
    id: 'marker-former-alcoa-smelter',
    center: { lat: 30.654, lng: -97.021 },
    title: 'Former Alcoa Aluminum Smelter Site',
    subtitle: 'Rockdale • 31-mile footprint • Hosts crypto + Sandow Switch',
    autoOpen: false,
    color: '#ef4444',
    iconImage: 'marker-teardrop-red',
    category: 'Supporting Infrastructure',
    strokeColor: '#1f2937'
  },
  {
    key: 'former_sandow_power',
    id: 'marker-former-sandow-power',
    center: { lat: 30.629, lng: -97.189 },
    title: 'Former Sandow Power Plant',
    subtitle: 'Rockdale • Retired 2018 coal plant • Grid backbone for miners',
    autoOpen: false,
    color: '#ef4444',
    iconImage: 'marker-teardrop-red',
    category: 'Supporting Infrastructure',
    strokeColor: '#1f2937'
  }
];

const TaylorWastewaterCall = ({
  onClick,
  title = 'Samsung Taylor Wastewater',
  color = '#0ea5e9',
  size = '10px',
  position = { top: '-25px', left: 'calc(98% + 20px)' },
  map = null,
  onLoadingChange = null,
  disabled = false,
  updateToolFeedback = null,
  locationKey = 'default'
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSites, setActiveSites] = useState([]);
  // Track per-city marker popups, animation handles, and click handlers for cleanup
  const markerPopupsRef = useRef({});
  const markerHandlersRef = useRef({});
  const markerLoadTimeoutRef = useRef(null);
  const wastewaterAnimationsRef = useRef({});

  const cleanupWastewaterFlow = useCallback((siteKey) => {
    const entry = wastewaterAnimationsRef.current[siteKey];
    const flow = entry?.flow;
    if (!flow) return;

    flow.isActive = false;
    if (flow.rafId) {
      cancelAnimationFrame(flow.rafId);
    }
    if (map?.current) {
      if (map.current.getLayer(flow.layerId)) {
        map.current.removeLayer(flow.layerId);
      }
      if (map.current.getSource(flow.sourceId)) {
        map.current.removeSource(flow.sourceId);
      }
    }
    if (entry) {
      delete entry.flow;
      if (!entry.pulse) {
        delete wastewaterAnimationsRef.current[siteKey];
      }
    }
  }, [map]);

  const cleanupWastewaterPulse = useCallback((siteKey) => {
    const entry = wastewaterAnimationsRef.current[siteKey];
    const pulse = entry?.pulse;
    if (!pulse) return;

    pulse.isActive = false;
    if (pulse.rafId) {
      cancelAnimationFrame(pulse.rafId);
    }
    if (map?.current) {
      if (map.current.getLayer(pulse.primaryLayerId)) {
        map.current.setPaintProperty(pulse.primaryLayerId, 'circle-radius', pulse.base.primary.radius);
        map.current.setPaintProperty(pulse.primaryLayerId, 'circle-opacity', pulse.base.primary.opacity);
        map.current.setPaintProperty(pulse.primaryLayerId, 'circle-stroke-width', pulse.base.primary.strokeWidth);
        map.current.setPaintProperty(pulse.primaryLayerId, 'circle-stroke-opacity', pulse.base.primary.strokeOpacity);
        map.current.setPaintProperty(pulse.primaryLayerId, 'circle-color', pulse.primaryColor || '#22d3ee');
        map.current.setPaintProperty(pulse.primaryLayerId, 'circle-stroke-color', pulse.primaryStrokeColor || '#0f172a');
      }
      if (pulse.secondaryLayerId && map.current.getLayer(pulse.secondaryLayerId)) {
        map.current.setPaintProperty(pulse.secondaryLayerId, 'circle-radius', pulse.base.secondary.radius);
        map.current.setPaintProperty(pulse.secondaryLayerId, 'circle-opacity', pulse.base.secondary.opacity);
        map.current.setPaintProperty(pulse.secondaryLayerId, 'circle-stroke-width', pulse.base.secondary.strokeWidth);
        map.current.setPaintProperty(pulse.secondaryLayerId, 'circle-color', pulse.secondaryColor || pulse.primaryColor || '#22d3ee');
      }
    }
    if (entry) {
      delete entry.pulse;
      if (!entry.flow) {
        delete wastewaterAnimationsRef.current[siteKey];
      }
    }
  }, [map]);

  const cleanupWastewaterAnimation = useCallback((siteKey) => {
    cleanupWastewaterFlow(siteKey);
    cleanupWastewaterPulse(siteKey);
  }, [cleanupWastewaterFlow, cleanupWastewaterPulse]);

  const setupWastewaterAnimation = useCallback((siteKey, lineFeatures, color) => {
    const m = map?.current;
    if (!m) return;

    cleanupWastewaterFlow(siteKey);

    const paths = [];
    const pushPath = coords => {
      if (!coords || coords.length < 2) return;
      const filtered = coords.filter(coord => Array.isArray(coord) && coord.length >= 2);
      if (filtered.length > 1) {
        paths.push(filtered);
      }
    };

    (lineFeatures || []).forEach(feature => {
      const geometry = feature?.geometry;
      if (!geometry) return;
      if (geometry.type === 'LineString') {
        pushPath(geometry.coordinates);
      } else if (geometry.type === 'MultiLineString') {
        geometry.coordinates.forEach(pushPath);
      }
    });

    if (paths.length === 0) {
      return;
    }

    const sourceId = `taylor-wastewater-${siteKey}-anim`;
    const layerId = `${sourceId}-layer`;

    if (m.getLayer(layerId)) {
      m.removeLayer(layerId);
    }
    if (m.getSource(sourceId)) {
      m.removeSource(sourceId);
    }

    m.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    m.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 3.2,
        'circle-color': color || '#22d3ee',
        'circle-opacity': 0.9,
        'circle-blur': 0.25
      }
    });

    const flowEntry = {
      sourceId,
      layerId,
      rafId: null,
      isActive: true
    };

    wastewaterAnimationsRef.current[siteKey] = {
      ...(wastewaterAnimationsRef.current[siteKey] || {}),
      flow: flowEntry
    };

    const baseCount = Math.max(36, Math.ceil(72 / paths.length));
    const speed = 0.00001;

    const animate = () => {
      if (!flowEntry.isActive || !map?.current) {
        return;
      }

      const now = Date.now() * speed;
      const particleFeatures = [];

      paths.forEach((path, pathIndex) => {
        const segments = path.length - 1;
        if (segments < 1) return;
        const particleCount = Math.max(8, Math.floor(baseCount / paths.length));

        for (let i = 0; i < particleCount; i += 1) {
          const progress = (now + (i / particleCount) + pathIndex * 0.17) % 1;
          const scaled = progress * segments;
          const segIdx = Math.floor(scaled);
          const frac = scaled - segIdx;
          const start = path[segIdx];
          const end = path[Math.min(segIdx + 1, path.length - 1)];
          if (!start || !end) continue;
          const lng = start[0] + (end[0] - start[0]) * frac;
          const lat = start[1] + (end[1] - start[1]) * frac;

          particleFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: {
              intensity: 0.6 + (progress * 0.4)
            }
          });
        }
      });

      try {
        const source = map.current.getSource(sourceId);
        if (source) {
          source.setData({ type: 'FeatureCollection', features: particleFeatures });
        }
      } catch (err) {
        console.warn('Taylor wastewater animation update failed:', err);
      }

      if (flowEntry.isActive) {
        flowEntry.rafId = requestAnimationFrame(animate);
      }
    };

    flowEntry.rafId = requestAnimationFrame(animate);
  }, [cleanupWastewaterFlow, map]);

  const setupWastewaterMarkerPulse = useCallback((siteKey, primaryLayerId, secondaryLayerId, config) => {
    const m = map?.current;
    if (!m || !primaryLayerId) return;

    cleanupWastewaterPulse(siteKey);

    const pulseEntry = {
      primaryLayerId,
      secondaryLayerId,
      rafId: null,
      isActive: true,
      base: {
        primary: {
          radius: config.basePrimaryRadius,
          opacity: config.basePrimaryOpacity,
          strokeWidth: config.basePrimaryStrokeWidth,
          strokeOpacity: config.basePrimaryStrokeOpacity
        },
        secondary: {
          radius: config.baseSecondaryRadius,
          opacity: config.baseSecondaryOpacity,
          strokeWidth: config.baseSecondaryStrokeWidth
        }
      },
      accent: config.accentColor || '#22d3ee',
      primaryColor: config.primaryColor || config.accentColor || '#22d3ee',
      primaryStrokeColor: config.primaryStrokeColor || '#0f172a',
      secondaryColor: config.secondaryColor || config.accentColor || '#22d3ee',
      startTime: Date.now(),
      durationMs: config.pulseDurationMs ?? 3000
    };

    wastewaterAnimationsRef.current[siteKey] = {
      ...(wastewaterAnimationsRef.current[siteKey] || {}),
      pulse: pulseEntry
    };

    const speed = 0.0022;
    const primaryRange = config.pulsePrimaryRange || { radius: 0.5, opacity: 0.15, stroke: 0.28 };
    const secondaryRange = config.pulseSecondaryRange || { radius: 0.8, opacity: 0.1, stroke: 0.2 };

    const animate = () => {
      if (!pulseEntry.isActive || !map?.current) {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - pulseEntry.startTime >= pulseEntry.durationMs) {
        cleanupWastewaterPulse(siteKey);
        return;
      }

      const time = currentTime * speed;
      const oscillation = 0.5 + 0.5 * Math.sin(time);
    const accent = pulseEntry.accent;
    const accentRGB = accent
      .replace('#', '')
      .match(/.{1,2}/g)
      ?.map(hex => parseInt(hex, 16)) || [34, 211, 238];
      const targetRGB = [255, 221, 148];
      const mixFactor = 0.12 + 0.18 * oscillation;
      const blend = accentRGB.map((channel, idx) => {
        const value = Math.round(channel + (targetRGB[idx] - channel) * mixFactor);
        return Math.min(255, Math.max(0, value));
      });
      const blendedColor = `rgba(${blend[0]}, ${blend[1]}, ${blend[2]}, 1)`;

      try {
        if (map.current.getLayer(primaryLayerId)) {
          map.current.setPaintProperty(primaryLayerId, 'circle-radius', pulseEntry.base.primary.radius + primaryRange.radius * oscillation);
          const primaryOpacity = pulseEntry.base.primary.opacity + primaryRange.opacity * oscillation;
          map.current.setPaintProperty(primaryLayerId, 'circle-opacity', Math.min(1, primaryOpacity));
          const primaryStroke = pulseEntry.base.primary.strokeWidth + primaryRange.stroke * oscillation;
          map.current.setPaintProperty(primaryLayerId, 'circle-stroke-width', primaryStroke);
          const strokeOpacity = pulseEntry.base.primary.strokeOpacity + 0.18 * oscillation;
          map.current.setPaintProperty(primaryLayerId, 'circle-stroke-opacity', Math.min(1, strokeOpacity));
          map.current.setPaintProperty(primaryLayerId, 'circle-color', blendedColor);
          map.current.setPaintProperty(primaryLayerId, 'circle-stroke-color', blendedColor);
        }

        if (secondaryLayerId && map.current.getLayer(secondaryLayerId)) {
          map.current.setPaintProperty(secondaryLayerId, 'circle-radius', pulseEntry.base.secondary.radius + secondaryRange.radius * oscillation);
          const secondaryOpacity = pulseEntry.base.secondary.opacity + secondaryRange.opacity * oscillation;
          map.current.setPaintProperty(secondaryLayerId, 'circle-opacity', Math.min(1, secondaryOpacity));
          map.current.setPaintProperty(secondaryLayerId, 'circle-stroke-width', pulseEntry.base.secondary.strokeWidth + secondaryRange.stroke * oscillation);
          map.current.setPaintProperty(secondaryLayerId, 'circle-color', blendedColor);
        }
      } catch (err) {
        console.warn('Taylor wastewater pulse update failed:', err);
      }

      pulseEntry.rafId = requestAnimationFrame(animate);
    };

    pulseEntry.rafId = requestAnimationFrame(animate);
  }, [cleanupWastewaterPulse, map]);

  const isTaylorLocation = useMemo(() => {
    if (locationKey === 'default') return true;
    return TAYLOR_WASTEWATER_SITE_KEYS.has(locationKey);
  }, [locationKey]);

  useEffect(() => {
    return () => {
      Object.keys(wastewaterAnimationsRef.current).forEach(siteKey => {
        cleanupWastewaterAnimation(siteKey);
      });
      wastewaterAnimationsRef.current = {};
    };
  }, [cleanupWastewaterAnimation]);

  const resolvedSites = useMemo(() => {
    if (locationKey === 'default') {
      return TAYLOR_WASTEWATER_SITES;
    }
    if (TAYLOR_WASTEWATER_SITE_KEYS.has(locationKey)) {
      return [getTaylorWastewaterSiteByKey(locationKey)];
    }
    return TAYLOR_WASTEWATER_SITES;
  }, [locationKey]);

  const removeSiteLayers = useCallback(
    site => {
      if (!map?.current) return;
      const baseId = `taylor-wastewater-${site.key}`;

      const layerSuffixes = ['polygon', 'line', 'point', 'labels', 'derived-line'];
      layerSuffixes.forEach(suffix => {
        const layerId = `${baseId}-${suffix}`;
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });

      if (map.current.getSource(baseId)) {
        map.current.removeSource(baseId);
      }
      const derivedSourceId = `${baseId}-derived`;
      if (map.current.getSource(derivedSourceId)) {
        map.current.removeSource(derivedSourceId);
      }

      cleanupWastewaterAnimation(site.key);
    },
    [map, cleanupWastewaterAnimation]
  );

  const removeAllLayers = useCallback((options = {}) => {
    const { suppressFeedback = false } = options;
    resolvedSites.forEach(site => removeSiteLayers(site));
    setActiveSites([]);
    if (map?.current) {
      STRATEGIC_MARKERS.forEach(marker => {
        const markerId = marker.id;
        ['-halo', '-core', '-symbol', '-outline'].forEach(suffix => {
          const lid = `${markerId}${suffix}`;
          if (map.current.getLayer(lid)) {
            map.current.removeLayer(lid);
          }
        });
        if (map.current.getLayer(markerId)) {
          map.current.removeLayer(markerId);
        }
        if (map.current.getSource(markerId)) {
          map.current.removeSource(markerId);
        }

        const handlers = markerHandlersRef.current[marker.key];
        if (handlers?.layerClick && handlers.layerId) {
          map.current.off('click', handlers.layerId, handlers.layerClick);
        }
        delete markerHandlersRef.current[marker.key];

        const popupEntry = markerPopupsRef.current[marker.key];
        if (popupEntry) {
          popupEntry.close?.();
          delete markerPopupsRef.current[marker.key];
        }
      });
      markerHandlersRef.current = {};
      markerPopupsRef.current = {};
      if (markerLoadTimeoutRef.current) {
        clearTimeout(markerLoadTimeoutRef.current);
        markerLoadTimeoutRef.current = null;
      }
      Object.keys(wastewaterAnimationsRef.current).forEach(siteKey => {
        cleanupWastewaterAnimation(siteKey);
      });
      wastewaterAnimationsRef.current = {};
    }
    if (window.mapEventBus) {
      window.mapEventBus.emit('osm:dataCleared');
    }
    if (updateToolFeedback && !suppressFeedback) {
      updateToolFeedback({
        isActive: true,
        tool: 'osm',
        status: '🧹 Taylor wastewater layers hidden',
        progress: 100,
        details: 'Click to reload Samsung Taylor wastewater infrastructure'
      });
      setTimeout(() => {
        updateToolFeedback({
          isActive: false,
          tool: null,
          status: '',
          progress: 0,
          details: ''
        });
      }, 2200);
    }
  }, [removeSiteLayers, resolvedSites, updateToolFeedback, cleanupWastewaterAnimation]);

  const addSiteLayers = useCallback(
    async site => {
      if (!map?.current) return;
      const response = await fetch(site.dataPath, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(
          `Missing wastewater cache ${site.dataPath} (status ${response.status}). Run scripts/osm-tools/tx_taylor_wastewater_osm.py`
        );
      }
      const data = await response.json();
      const baseId = `taylor-wastewater-${site.key}`;
      const features = data.features || [];

      const polygons = features.filter(
        feature => feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon'
      );
      const lines = features.filter(feature => feature.geometry?.type === 'LineString');
      const points = features.filter(feature => feature.geometry?.type === 'Point');

      // Derive simple polylines from points when no native lines exist
      const makeDerivedLines = (pts) => {
        if (!pts || pts.length < 2) return [];
        const coords = pts.map(f => f.geometry.coordinates).filter(Boolean);
        // Greedy nearest-neighbor chaining with max segment distance
        const MAX_DIST_M = 1000; // reasonable default
        const used = new Array(coords.length).fill(false);
        const result = [];
        const hav = (a,b) => {
          const toRad = d => (d*Math.PI)/180;
          const R=6371000;
          const dLat=toRad(b[1]-a[1]);
          const dLon=toRad(b[0]-a[0]);
          const lat1=toRad(a[1]);
          const lat2=toRad(b[1]);
          const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
          return 2*R*Math.asin(Math.sqrt(h));
        };
        // Start from the western-most point for stability
        let current = coords
          .map((c,i)=>({c,i}))
          .sort((a,b)=>a.c[0]-b.c[0])[0]?.i;
        if (current == null) return [];
        let chain = [coords[current]];
        used[current]=true;
        while (true) {
          let bestI = -1; let bestD = Infinity;
          for (let i=0;i<coords.length;i++) {
            if (used[i]) continue;
            const d = hav(coords[current], coords[i]);
            if (d < bestD) { bestD = d; bestI = i; }
          }
          if (bestI === -1 || bestD > MAX_DIST_M) {
            if (chain.length > 1) {
              result.push({ type:'Feature', geometry:{ type:'LineString', coordinates: chain }, properties:{ derived:true }});
            }
            // Start a new chain from next unused (if any)
            const next = used.findIndex(u=>!u);
            if (next === -1) break;
            current = next;
            used[current]=true;
            chain = [coords[current]];
            continue;
          }
          used[bestI]=true;
          chain.push(coords[bestI]);
          current = bestI;
        }
        return result;
      };

      map.current.addSource(baseId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features
        }
      });

      // Add derived source if needed
      let derivedLines = [];
      if (lines.length === 0 && points.length > 1) {
        derivedLines = makeDerivedLines(points);
        if (derivedLines.length > 0) {
          map.current.addSource(`${baseId}-derived`, {
            type: 'geojson',
            data: { type:'FeatureCollection', features: derivedLines }
          });
        }
      }

      let primaryPointLayerId = null;
      let secondaryPointLayerId = null;
      let primaryPointBase = null;
      let secondaryPointBase = null;

      if (polygons.length > 0) {
        map.current.addLayer({
          id: `${baseId}-polygon`,
          type: 'fill',
          source: baseId,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: {
            'fill-color': site.color,
            'fill-opacity': ACTIVE_FILL_OPACITY
          }
        });
      }

      if (lines.length > 0) {
        map.current.addLayer({
          id: `${baseId}-line`,
          type: 'line',
          source: baseId,
          filter: ['==', ['geometry-type'], 'LineString'],
          paint: {
            'line-color': site.highlightColor || site.color,
            'line-width': 1.8,
            'line-opacity': ACTIVE_LINE_OPACITY
          }
        });
      }
      if (derivedLines.length > 0) {
        map.current.addLayer({
          id: `${baseId}-derived-line`,
          type: 'line',
          source: `${baseId}-derived`,
          paint: {
            'line-color': site.highlightColor || site.color,
            'line-width': 1.4,
            'line-dasharray': [2, 1.4],
            'line-opacity': ACTIVE_LINE_OPACITY
          }
        });
      }

      // Show points, but dim them if derived lines exist to emphasize corridors
      if (points.length > 0) {
        primaryPointLayerId = `${baseId}-point`;
        primaryPointBase = {
          radius: ACTIVE_POINT_RADIUS,
          opacity: ACTIVE_POINT_OPACITY,
          strokeWidth: 1,
          strokeOpacity: ACTIVE_POINT_STROKE_OPACITY
        };

        map.current.addLayer({
          id: primaryPointLayerId,
          type: 'circle',
          source: baseId,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': primaryPointBase.radius,
            'circle-color': site.highlightColor || site.color,
            'circle-opacity': primaryPointBase.opacity,
            'circle-stroke-width': primaryPointBase.strokeWidth,
            'circle-stroke-color': '#0f172a',
            'circle-stroke-opacity': primaryPointBase.strokeOpacity
          }
        });

        // Key-asset highlight layer (monitoring stations, storage tanks) on top
        // Uses subcategory string from properties, e.g., "man_made:monitoring_station", "man_made:storage_tank"
        secondaryPointLayerId = `${baseId}-point-key`;
        secondaryPointBase = {
          radius: (derivedLines.length > 0 ? ACTIVE_POINT_RADIUS + 1 : ACTIVE_POINT_RADIUS + 1.6),
          opacity: 0.75,
          strokeWidth: 1.5
        };

        map.current.addLayer({
          id: secondaryPointLayerId,
          type: 'circle',
          source: baseId,
          filter: [
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['any',
              ['==', ['coalesce', ['get', 'subcategory'], ''], 'man_made:monitoring_station'],
              ['==', ['coalesce', ['get', 'subcategory'], ''], 'man_made:storage_tank']
            ]
          ],
          paint: {
            'circle-radius': secondaryPointBase.radius,
            'circle-color': site.highlightColor || site.color,
            'circle-opacity': secondaryPointBase.opacity,
            'circle-stroke-width': secondaryPointBase.strokeWidth,
            'circle-stroke-color': '#0f172a'
          }
        });
      }

      // Removed label layer to hide name tags under markers

      const animationFeatures = [...lines, ...derivedLines];
      if (animationFeatures.length > 0) {
        setupWastewaterAnimation(site.key, animationFeatures, site.highlightColor || site.color);
      } else {
        cleanupWastewaterAnimation(site.key);
      }

      if (primaryPointLayerId) {
        setupWastewaterMarkerPulse(site.key, primaryPointLayerId, secondaryPointLayerId, {
          basePrimaryRadius: primaryPointBase.radius,
          basePrimaryOpacity: primaryPointBase.opacity,
          basePrimaryStrokeWidth: primaryPointBase.strokeWidth,
          basePrimaryStrokeOpacity: primaryPointBase.strokeOpacity,
          baseSecondaryRadius: secondaryPointBase?.radius ?? 0,
          baseSecondaryOpacity: secondaryPointBase?.opacity ?? 0,
          baseSecondaryStrokeWidth: secondaryPointBase?.strokeWidth ?? 0,
          accentColor: site.highlightColor || site.color,
          primaryColor: site.highlightColor || site.color,
          primaryStrokeColor: '#0f172a',
          secondaryColor: site.highlightColor || site.color,
          pulsePrimaryRange: { radius: 0.5, opacity: 0.15, stroke: 0.28 },
          pulseSecondaryRange: { radius: 0.8, opacity: 0.1, stroke: 0.2 }
        });
      } else {
        cleanupWastewaterPulse(site.key);
      }

      return {
        site,
        summary: data.summary || {}
      };
    },
    [map, cleanupWastewaterAnimation, setupWastewaterAnimation, setupWastewaterMarkerPulse, cleanupWastewaterPulse]
  );

  const handleClick = useCallback(async () => {
    if (disabled || !map?.current) {
      return;
    }

    if (activeSites.length > 0) {
      removeAllLayers();
      return;
    }

    setIsLoading(true);
    if (onLoadingChange) {
      onLoadingChange(true);
    }
    if (updateToolFeedback) {
      updateToolFeedback({
        isActive: true,
        tool: 'osm',
        status: '🚀 Loading Taylor wastewater infrastructure…',
        progress: 15,
        details: 'Fetching Samsung Taylor wastewater + reuse caches'
      });
    }

    try {
      if (onClick) {
        onClick('Samsung Taylor Wastewater Analysis');
      }

      const results = [];
      for (const site of resolvedSites) {
        const result = await addSiteLayers(site);
        results.push(result);
        if (updateToolFeedback) {
          updateToolFeedback({
            isActive: true,
            tool: 'osm',
            status: `📡 Loaded ${site.shortName}`,
            progress: Math.min(90, 20 + results.length * (60 / resolvedSites.length)),
            details: `${result.summary.featureCount || result.summary.feature_count || 0} features (${site.description})`
          });
        }
      }

      setActiveSites(resolvedSites.map(site => site.key));

      // Drop strategic teardrop markers (downtown anchors + industrial assets)
      try {
        const ensureMarkerIcon = marker =>
          new Promise(resolve => {
            if (!map?.current) {
              resolve({ mode: 'fallback' });
              return;
            }

            const imageName = marker.iconImage || 'marker-teardrop-default';
            if (map.current.hasImage && map.current.hasImage(imageName)) {
              resolve({ mode: 'icon', imageName });
              return;
            }

            if (!map.current.addImage) {
              resolve({ mode: 'fallback' });
              return;
            }

            const size = 48;
            const fillColor = marker.color || '#10b981';
            const strokeColor = marker.strokeColor || '#0f172a';
            const svg = `
              <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.28)"/>
                  </filter>
                </defs>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                  fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.6" filter="url(#shadow)"/>
              </svg>
            `;

            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
              try {
                canvas.width = size;
                canvas.height = size;
                ctx?.clearRect(0, 0, size, size);
                ctx?.drawImage(img, 0, 0);
                const imageData = ctx?.getImageData ? ctx.getImageData(0, 0, size, size) : null;
                if (imageData && map.current.addImage) {
                  map.current.addImage(imageName, {
                    width: size,
                    height: size,
                    data: imageData.data
                  });
                  resolve({ mode: 'icon', imageName });
                } else {
                  resolve({ mode: 'fallback' });
                }
              } catch (err) {
                console.warn('Teardrop icon creation failed, fallback to circle', err);
                resolve({ mode: 'fallback' });
              }
            };

            img.onerror = () => {
              console.warn('Teardrop SVG load failed, fallback to circle');
              resolve({ mode: 'fallback' });
            };

            const encodeSvg = () => {
              if (typeof window !== 'undefined' && window.btoa) {
                return window.btoa(svg);
              }
              if (typeof Buffer !== 'undefined') {
                return Buffer.from(svg).toString('base64');
              }
              return '';
            };

            img.src = `data:image/svg+xml;base64,${encodeSvg()}`;
          });

        const typewrite = (element, text) => {
          if (!element) return;
          element.textContent = '';
          let index = 0;
          const step = () => {
            if (index <= text.length) {
              element.textContent = text.slice(0, index);
              index += 1;
              requestAnimationFrame(step);
            }
          };
          step();
        };

        const openDomPopup = (marker, lngLat = marker.center) => {
          if (!map?.current) return;

          const existing = markerPopupsRef.current[marker.key];
          if (existing) {
            existing.close?.();
            delete markerPopupsRef.current[marker.key];
          }

          const container = map.current.getContainer?.();
          if (!container) return;

          const accent = marker.color || '#10b981';
          const badge = marker.category || 'Strategic Asset';
          const el = document.createElement('div');
          el.className = `downtown-dom-popup downtown-dom-popup-${marker.key}`;
          el.style.position = 'absolute';
          el.style.transform = 'translate(-50%, -100%)';
          el.style.pointerEvents = 'auto';
          el.style.zIndex = '1002';
          el.innerHTML = `
            <div style="
              background: #0b1220;
              color: #e5e7eb;
              padding: 14px 16px;
              border-radius: 12px;
              box-shadow: 0 10px 28px rgba(0,0,0,0.5);
              border: 1px solid rgba(255,255,255,0.08);
              max-width: 320px;
              font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, 'Apple Color Emoji', 'Segoe UI Emoji';
            ">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <span style="font-size:10px;letter-spacing:0.4px;text-transform:uppercase;padding:2px 8px;border-radius:9999px;background:${accent}22;border:1px solid ${accent}33;color:${accent};font-weight:600;">${badge}</span>
                <div style="width:8px;height:8px;border-radius:50%;background:${accent};box-shadow:0 0 10px ${accent}66"></div>
              </div>
              <div data-role="title" style="font-weight:700;color:#ffffff;letter-spacing:0.2px;margin-bottom:4px;"></div>
              <div data-role="subtitle" style="font-size:12px;opacity:0.85;line-height:1.5;"></div>
            </div>`;

          container.appendChild(el);

          const resolvedLng = lngLat?.lng ?? lngLat?.[0] ?? marker.center.lng;
          const resolvedLat = lngLat?.lat ?? lngLat?.[1] ?? marker.center.lat;

          const project = () => map.current.project([resolvedLng, resolvedLat]);
          const position = () => {
            const point = project();
            el.style.left = `${point.x}px`;
            el.style.top = `${point.y - 8}px`;
          };

          position();

          const onMove = () => position();
          map.current.on('move', onMove);
          map.current.on('zoom', onMove);

          let closeOnMapClick;
          const close = () => {
            map.current.off('move', onMove);
            map.current.off('zoom', onMove);
            if (closeOnMapClick) {
              map.current.off('click', closeOnMapClick);
            }
            el.remove();
            delete markerPopupsRef.current[marker.key];
          };

          closeOnMapClick = event => {
            const target = event?.originalEvent?.target;
            if (target && target.closest && target.closest(`.downtown-dom-popup-${marker.key}`)) {
              return;
            }
            close();
          };

          markerPopupsRef.current[marker.key] = { el, close };

          typewrite(el.querySelector('[data-role="title"]'), marker.title);
          setTimeout(() => {
            typewrite(el.querySelector('[data-role="subtitle"]'), marker.subtitle);
          }, 160);

          el.addEventListener('click', event => {
            event.stopPropagation();
          });

          setTimeout(() => {
            if (map?.current) {
              map.current.on('click', closeOnMapClick);
            }
          }, 0);
        };

        const addMarkers = async markerList => {
          for (const marker of markerList) {
            if (!map?.current) {
              return;
            }

            const markerId = marker.id;

            ['-halo', '-symbol', '-core'].forEach(suffix => {
              const layerId = `${markerId}${suffix}`;
              if (map.current.getLayer(layerId)) {
                map.current.removeLayer(layerId);
              }
            });
            if (map.current.getSource(markerId)) {
              map.current.removeSource(markerId);
            }

            map.current.addSource(markerId, {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [marker.center.lng, marker.center.lat] },
                    properties: {
                      name: marker.title,
                      category: marker.category,
                      color: marker.color
                    }
                  }
                ]
              }
            });

            map.current.addLayer({
              id: `${markerId}-halo`,
              type: 'circle',
              source: markerId,
              paint: {
                'circle-radius': 14,
                'circle-color': marker.color || '#10b981',
                'circle-opacity': 0.18
              }
            });

            const { mode, imageName } = await ensureMarkerIcon(marker);

            let interactiveLayerId = `${markerId}-symbol`;
            if (mode === 'icon' && imageName) {
              map.current.addLayer({
                id: `${markerId}-symbol`,
                type: 'symbol',
                source: markerId,
                layout: {
                  'icon-image': imageName,
                  'icon-size': marker.iconScale || 1.0,
                  'icon-allow-overlap': true,
                  'icon-ignore-placement': true,
                  'icon-anchor': 'bottom'
                }
              });
            } else {
              map.current.addLayer({
                id: `${markerId}-core`,
                type: 'circle',
                source: markerId,
                paint: {
                  'circle-radius': 6,
                  'circle-color': marker.color || '#10b981',
                  'circle-stroke-width': 2,
                  'circle-stroke-color': marker.strokeColor || '#064e3b'
                }
              });
              interactiveLayerId = `${markerId}-core`;
            }

            const existingHandlers = markerHandlersRef.current[marker.key];
            if (existingHandlers?.layerClick && existingHandlers.layerId) {
              map.current.off('click', existingHandlers.layerId, existingHandlers.layerClick);
            }

            const clickHandler = event => {
              event?.preventDefault?.();
              openDomPopup(marker, event?.lngLat || marker.center);
            };

            markerHandlersRef.current[marker.key] = {
              layerClick: clickHandler,
              layerId: interactiveLayerId
            };
            map.current.on('click', interactiveLayerId, clickHandler);

            if (marker.autoOpen) {
              openDomPopup(marker, marker.center);
            }
          }
        };

        const primaryMarkers = STRATEGIC_MARKERS.filter(marker => (marker.color || '').toLowerCase() === '#10b981');
        const secondaryMarkers = STRATEGIC_MARKERS.filter(marker => (marker.color || '').toLowerCase() !== '#10b981');

        await addMarkers(primaryMarkers);

        if (markerLoadTimeoutRef.current) {
          clearTimeout(markerLoadTimeoutRef.current);
          markerLoadTimeoutRef.current = null;
        }

        if (secondaryMarkers.length > 0) {
          markerLoadTimeoutRef.current = setTimeout(() => {
            addMarkers(secondaryMarkers).catch(err => console.warn('Delayed strategic markers failed:', err));
            markerLoadTimeoutRef.current = null;
          }, 2000);
        }
      } catch (e) {
        console.warn('Strategic marker overlay failed:', e);
      }

      if (window.mapEventBus) {
        window.mapEventBus.emit('osm:dataLoaded', {
          source: 'taylor-wastewater',
          summary: results.map(result => ({
            site: result.site.shortName,
            featureCount: result.summary.featureCount || result.summary.feature_count || 0,
            categories: result.summary.categories || []
          }))
        });
      }

      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: '✅ Samsung Taylor wastewater layers loaded',
          progress: 100,
          details: 'Reuse corridors, outfalls, and monitoring points visualized on map'
        });
        setTimeout(() => {
          updateToolFeedback({
            isActive: false,
            tool: null,
            status: '',
            progress: 0,
            details: ''
          });
        }, 2500);
      }
    } catch (error) {
      console.error('❌ Taylor wastewater load failed:', error);
      removeAllLayers();
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: '❌ Failed to load Samsung Taylor wastewater data',
          progress: 0,
          details: error.message
        });
      }
    } finally {
      setIsLoading(false);
      if (onLoadingChange) {
        onLoadingChange(false);
      }
    }
  }, [
    disabled,
    map,
    activeSites.length,
    removeAllLayers,
    onLoadingChange,
    updateToolFeedback,
    resolvedSites,
    addSiteLayers,
    onClick,
    locationKey
  ]);

  const buttonTitle = useMemo(() => {
    if (disabled) return 'Loading…';
    if (!isTaylorLocation) {
      return 'Taylor wastewater layers reserved for Samsung Taylor location';
    }
    if (isLoading) return 'Loading Samsung Taylor wastewater layers…';
    if (activeSites.length > 0) return 'Hide Samsung Taylor wastewater layers';
    return 'Load Samsung Taylor wastewater infrastructure';
  }, [disabled, isTaylorLocation, isLoading, activeSites.length]);

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        background: disabled
          ? 'rgba(0, 0, 0, 0.4)'
          : isLoading
          ? '#0ea5e9'
          : activeSites.length > 0
          ? '#22d3ee'
          : isHovered
          ? `${color}ee`
          : `${color}cc`,
        border: disabled
          ? '1px solid rgba(0, 0, 0, 0.2)'
          : activeSites.length > 0
          ? '1px solid rgba(34, 211, 238, 0.75)'
          : `1px solid ${color}40`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled
          ? '0 1px 4px rgba(0, 0, 0, 0.1)'
          : activeSites.length > 0
          ? '0 3px 12px rgba(34, 211, 238, 0.35)'
          : isHovered
          ? `0 2px 8px ${color}40`
          : '0 1px 4px rgba(0, 0, 0, 0.2)',
        transition: 'all 0.2s ease',
        zIndex: 1001,
        padding: '8px',
        opacity: disabled ? 0.6 : 1,
        animation: disabled || !isLoading ? 'none' : 'pinalButtonPulse 1.5s ease-out infinite'
      }}
      onClick={disabled || !isTaylorLocation ? undefined : handleClick}
      onMouseEnter={() => !disabled && !isLoading && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={buttonTitle}
    />
  );
};

export default TaylorWastewaterCall;
