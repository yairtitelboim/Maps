// Utility helpers extracted from OSMCall.jsx to keep presentation leaner.

export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const getFeatureCenter = (feature) => {
  const geom = feature.geometry;
  if (!geom || !geom.coordinates) return null;

  if (geom.type === 'Point') {
    return { lat: geom.coordinates[1], lon: geom.coordinates[0] };
  } else if (geom.type === 'LineString' && geom.coordinates.length > 0) {
    const midIdx = Math.floor(geom.coordinates.length / 2);
    return { lat: geom.coordinates[midIdx][1], lon: geom.coordinates[midIdx][0] };
  } else if (geom.type === 'Polygon' && geom.coordinates[0]?.length > 0) {
    return { lat: geom.coordinates[0][0][1], lon: geom.coordinates[0][0][0] };
  } else if (geom.type === 'MultiPolygon' && geom.coordinates[0]?.[0]?.length > 0) {
    return { lat: geom.coordinates[0][0][0][1], lon: geom.coordinates[0][0][0][0] };
  }
  return null;
};

const calculateDistance = (coord1, coord2) => {
  const dx = coord1[0] - coord2[0];
  const dy = coord1[1] - coord2[1];
  return Math.sqrt(dx * dx + dy * dy);
};

export const addPowerPulseAnimation = (mapRef, baseId, powerPointFeatures = []) => {
  if (!mapRef?.current || powerPointFeatures.length === 0) return;

  try {
    const sourceId = baseId;
    const haloLayerId = `${baseId}-power-point-halo`;
    const pointLayerId = `${baseId}-power-point`;

    if (!mapRef.current.getLayer(haloLayerId) || !mapRef.current.getLayer(pointLayerId)) {
      return;
    }

    const period = 2000; // 2 second pulse cycle
    let animationFrame = null;

    const animate = () => {
      const t = ((Date.now() % period) / period);
      const source = mapRef.current.getSource(sourceId);

      if (source) {
        try {
          const currentData = source._data || { type: 'FeatureCollection', features: [] };
          const updatedFeatures = currentData.features.map(feature => {
            if (feature.properties?.category === 'power' && feature.geometry?.type === 'Point') {
              return {
                ...feature,
                properties: {
                  ...feature.properties,
                  pulse_t: t
                }
              };
            }
            return feature;
          });

          source.setData({
            type: 'FeatureCollection',
            features: updatedFeatures
          });
        } catch (err) {
          console.warn('Error updating pulse data:', err);
        }
      }

      animationFrame = requestAnimationFrame(animate);
    };

    if (!window.okPowerPulseAnimations) {
      window.okPowerPulseAnimations = {};
    }
    window.okPowerPulseAnimations[baseId] = animationFrame;
    animationFrame = requestAnimationFrame(animate);
  } catch (error) {
    console.warn('Error adding power pulse animation:', error);
  }
};

export const addPipelineParticles = (mapRef, baseId, lineFeatures) => {
  if (!mapRef?.current || !lineFeatures || lineFeatures.length === 0) return;

  const particleSourceId = `${baseId}-pipeline-particles`;
  const particleLayerId = `${baseId}-pipeline-particles-layer`;

  try {
    if (mapRef.current.getLayer(particleLayerId)) {
      mapRef.current.removeLayer(particleLayerId);
    }
    if (mapRef.current.getSource(particleSourceId)) {
      mapRef.current.removeSource(particleSourceId);
    }

    const continuousPaths = [];
    lineFeatures.forEach(feature => {
      if (feature.geometry?.coordinates && feature.geometry.coordinates.length > 1) {
        const coords = feature.geometry.coordinates.filter(coord => coord && coord.length === 2);
        if (coords.length >= 2) {
          let isValidPath = true;
          for (let i = 1; i < coords.length; i++) {
            const dist = calculateDistance(coords[i - 1], coords[i]);
            if (dist > 0.01) {
              isValidPath = false;
              break;
            }
          }
          if (isValidPath) {
            continuousPaths.push(coords);
          }
        }
      }
    });

    if (continuousPaths.length === 0) return;

    mapRef.current.addSource(particleSourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    mapRef.current.addLayer({
      id: particleLayerId,
      type: 'circle',
      source: particleSourceId,
      paint: {
        'circle-radius': 3,
        'circle-color': '#93c5fd',
        'circle-opacity': 0.9,
        'circle-blur': 0.4,
        'circle-stroke-width': 0.5,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.7
      }
    });

    const particleCount = 120;
    const speed = 0.000003;
    let animationFrame = null;

    const animate = () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      const now = Date.now() * speed;
      const features = [];
      const particlesPerPath = Math.max(1, Math.floor(particleCount / continuousPaths.length));

      continuousPaths.forEach((path, pathIndex) => {
        const pathLength = path.length - 1;
        if (pathLength < 1) return;

        const particlesForThisPath = pathIndex === continuousPaths.length - 1
          ? particleCount - (pathIndex * particlesPerPath)
          : particlesPerPath;

        for (let i = 0; i < particlesForThisPath; i += 1) {
          const pathOffset = pathIndex * 0.1;
          const particleProgress = ((now + pathOffset + i / particleCount) % 1);
          const idx = Math.floor(particleProgress * pathLength);
          const nextIdx = Math.min(idx + 1, pathLength);
          const frac = (particleProgress * pathLength) % 1;

          const a = path[idx];
          const b = path[nextIdx];
          if (a && b && a.length === 2 && b.length === 2) {
            const lng = a[0] + (b[0] - a[0]) * frac;
            const lat = a[1] + (b[1] - a[1]) * frac;

            features.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lng, lat] },
              properties: {}
            });
          }
        }
      });

      try {
        const source = mapRef.current.getSource(particleSourceId);
        if (source) {
          source.setData({ type: 'FeatureCollection', features });
        }
      } catch (err) {
        console.warn('Error updating particles:', err);
      }

      animationFrame = requestAnimationFrame(animate);
    };

    if (!window.okPipelineParticles) {
      window.okPipelineParticles = {};
    }
    window.okPipelineParticles[baseId] = animationFrame;
    animationFrame = requestAnimationFrame(animate);
  } catch (error) {
    console.warn('Error adding pipeline particles:', error);
  }
};

export const addTransportationParticles = (mapRef, baseId, lineFeatures) => {
  if (!mapRef?.current || !lineFeatures || lineFeatures.length === 0) return;

  const particleSourceId = `${baseId}-transportation-particles`;
  const particleLayerId = `${baseId}-transportation-particles-layer`;

  try {
    if (mapRef.current.getLayer(particleLayerId)) {
      mapRef.current.removeLayer(particleLayerId);
    }
    if (mapRef.current.getSource(particleSourceId)) {
      mapRef.current.removeSource(particleSourceId);
    }

    const continuousPaths = [];
    lineFeatures.forEach(feature => {
      if (feature.geometry?.coordinates && feature.geometry.coordinates.length > 1) {
        const coords = feature.geometry.coordinates.filter(coord => coord && coord.length === 2);
        if (coords.length >= 2) {
          let isValidPath = true;
          for (let i = 1; i < coords.length; i++) {
            const dist = calculateDistance(coords[i - 1], coords[i]);
            if (dist > 0.01) {
              isValidPath = false;
              break;
            }
          }
          if (isValidPath) {
            continuousPaths.push(coords);
          }
        }
      }
    });

    if (continuousPaths.length === 0) return;

    mapRef.current.addSource(particleSourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    mapRef.current.addLayer({
      id: particleLayerId,
      type: 'circle',
      source: particleSourceId,
      paint: {
        'circle-radius': 2.5,
        'circle-color': '#a855f7',
        'circle-opacity': 0.9,
        'circle-blur': 0.3,
        'circle-stroke-width': 0.5,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.6
      }
    });

    const particleCount = 100;
    const speed = 0.000004;
    let animationFrame = null;

    const animate = () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      const now = Date.now() * speed;
      const features = [];
      const particlesPerPath = Math.max(1, Math.floor(particleCount / continuousPaths.length));

      continuousPaths.forEach((path, pathIndex) => {
        const pathLength = path.length - 1;
        if (pathLength < 1) return;

        const particlesForThisPath = pathIndex === continuousPaths.length - 1
          ? particleCount - (pathIndex * particlesPerPath)
          : particlesPerPath;

        for (let i = 0; i < particlesForThisPath; i += 1) {
          const pathOffset = pathIndex * 0.1;
          const particleProgress = ((now + pathOffset + i / particleCount) % 1);
          const idx = Math.floor(particleProgress * pathLength);
          const nextIdx = Math.min(idx + 1, pathLength);
          const frac = (particleProgress * pathLength) % 1;

          const a = path[idx];
          const b = path[nextIdx];
          if (a && b && a.length === 2 && b.length === 2) {
            const lng = a[0] + (b[0] - a[0]) * frac;
            const lat = a[1] + (b[1] - a[1]) * frac;

            features.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lng, lat] },
              properties: {}
            });
          }
        }
      });

      try {
        const source = mapRef.current.getSource(particleSourceId);
        if (source) {
          source.setData({ type: 'FeatureCollection', features });
        }
      } catch (err) {
        console.warn('Error updating particles:', err);
      }

      animationFrame = requestAnimationFrame(animate);
    };

    if (!window.okTransportationParticles) {
      window.okTransportationParticles = {};
    }
    window.okTransportationParticles[baseId] = animationFrame;
    animationFrame = requestAnimationFrame(animate);
  } catch (error) {
    console.warn('Error adding transportation particles:', error);
  }
};
