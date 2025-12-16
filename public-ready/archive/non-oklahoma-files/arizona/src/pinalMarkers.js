import mapboxgl from 'mapbox-gl';

export const createWhitneyMarker = (map, lng, lat, cachedData) => {
  const marker = new mapboxgl.Marker({
    color: '#059669',
    scale: 1.5
  })
  .setLngLat([lng, lat])
  .addTo(map);

  marker.getElement().addEventListener('click', () => {
    if (window.mapEventBus) {
      window.mapEventBus.emit('marker:clicked', {
        id: 'whitney-marker',
        name: 'Whitney Data Center Campus',
        type: 'Whitney Infrastructure',
        category: 'Texas Data Center Development',
        coordinates: [lng, lat],
        formatter: 'pinal',
        zonesAnalyzed: 3,
        cachedDataAvailable: !!cachedData,
        analysisStatus: 'Analyzing infrastructure...'
      });
    }
  });

  return marker;
};

export const createLibertyMarker = (map, lng, lat, cachedData) => {
  const marker = new mapboxgl.Marker({
    color: '#059669',
    scale: 1.5
  })
  .setLngLat([lng, lat])
  .addTo(map);

  marker.getElement().addEventListener('click', () => {
    if (window.mapEventBus) {
      window.mapEventBus.emit('marker:clicked', {
        id: 'liberty-marker',
        name: 'Liberty Focus Area',
        type: 'Liberty Infrastructure',
        category: 'North Carolina Development',
        coordinates: [lng, lat],
        formatter: 'pinal',
        zonesAnalyzed: 3,
        cachedDataAvailable: !!cachedData,
        analysisStatus: 'Analyzing infrastructure...'
      });
    }
  });

  return marker;
};
