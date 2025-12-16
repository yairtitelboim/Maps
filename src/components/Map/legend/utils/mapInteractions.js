const hasWindow = () => typeof window !== 'undefined';

export const highlightMarker = (mapRef, markerData) => {
  if (!mapRef?.current || !markerData?.serp_id) {
    return;
  }

  const layerId = 'serp-startup-ecosystem-markers';
  if (!mapRef.current.getLayer(layerId)) {
    return;
  }

  mapRef.current.setPaintProperty(layerId, 'circle-color', [
    'case',
    ['==', ['get', 'serp_id'], markerData.serp_id], '#ef4444',
    ['==', ['get', 'category'], 'startups'], '#ef4444',
    ['==', ['get', 'category'], 'investors'], '#f59e0b',
    ['==', ['get', 'category'], 'co-working spaces'], '#8b5cf6',
    ['==', ['get', 'category'], 'universities'], '#10b981',
    ['==', ['get', 'category'], 'research institutions'], '#3b82f6',
    '#6b7280'
  ]);

  mapRef.current.setPaintProperty(layerId, 'circle-radius', [
    'case',
    ['==', ['get', 'serp_id'], markerData.serp_id], 12,
    ['==', ['get', 'category'], 'startups'], 8,
    ['==', ['get', 'category'], 'investors'], 7,
    ['==', ['get', 'category'], 'co-working spaces'], 6,
    ['==', ['get', 'category'], 'universities'], 9,
    ['==', ['get', 'category'], 'research institutions'], 8,
    5
  ]);

  mapRef.current.setPaintProperty(layerId, 'circle-opacity', [
    'case',
    ['==', ['get', 'serp_id'], markerData.serp_id], 1.0,
    0.8
  ]);
};

export const zoomToMarker = (mapRef, markerData, { zoom = 14, duration = 1500 } = {}) => {
  if (!mapRef?.current || !markerData?.coordinates) {
    return;
  }

  mapRef.current.flyTo({
    center: markerData.coordinates,
    zoom,
    duration,
    essential: true
  });
};

export const focusSiteOnMap = (mapRef, site, { zoom = 12, speed = 0.8, curve = 1.4 } = {}) => {
  if (!mapRef?.current || !site?.coordinates) {
    return;
  }

  const { lng, lat } = site.coordinates;
  if (lng === undefined || lat === undefined) {
    return;
  }

  mapRef.current.flyTo({
    center: [lng, lat],
    zoom,
    speed,
    curve,
    essential: true
  });
};

export const emitSiteSelection = ({
  site,
  idPrefix,
  typeName,
  categoryName,
  siteType
}) => {
  if (!hasWindow() || !window.mapEventBus || !site) {
    return;
  }

  const payload = {
    id: `${idPrefix}${site.key}`,
    name: site.name,
    type: typeName,
    category: categoryName,
    coordinates: site.coordinates ? [site.coordinates.lng, site.coordinates.lat] : null,
    formatter: 'pinal',
    featureCount: site.featureCount || 0,
    summary: site.summary || {},
    categories: site.categories || {},
    siteMetadata: site,
    analysisStatus: site.description || `${siteType} infrastructure context loaded`,
    isAutomatic: false
  };

  window.mapEventBus.emit('marker:clicked', payload);
};
