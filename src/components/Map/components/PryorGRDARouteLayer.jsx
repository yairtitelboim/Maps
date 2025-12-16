/**
 * Archived: Pryor to GRDA route layer - Oklahoma-specific, removed for Columbus migration
 * This component handled route visualization from Pryor to GRDA power facilities.
 * TODO: Implement AEP Ohio route layers if needed
 */
import { useEffect, useRef } from 'react';

const SOURCE_ID = 'pryor-grda-route-source';
const LAYER_ID = 'pryor-grda-route-layer';
const PARTICLE_SOURCE_ID = 'pryor-grda-route-particles';
const PARTICLE_LAYER_ID = 'pryor-grda-route-particles-layer';

export default function PryorGRDARouteLayer({ map, visible }) {
  // Component disabled - Oklahoma-specific routes removed
  // Will gracefully handle missing sources (no-op)
  const rafRef = useRef(null);
  const particleDataRef = useRef([]);
  
  // Extract particle coordinates and start animation when layers are ready
  useEffect(() => {
    if (!map?.current) return;
    const m = map.current;

    // Wait for route source to be loaded (created by PerplexityCall.jsx)
    const extractParticleCoords = () => {
      const source = m.getSource(SOURCE_ID);
      if (!source) {
        // Retry if source not ready yet
        setTimeout(extractParticleCoords, 200);
        return;
      }

      try {
        const data = source._data || source._geojson;
        if (!data || !data.features) {
          setTimeout(extractParticleCoords, 200);
          return;
        }

        // Extract coordinates for particles
        const coords = [];
        data.features.forEach(feature => {
          if (feature.geometry?.type === 'LineString' && feature.geometry.coordinates) {
            coords.push(...feature.geometry.coordinates);
          } else if (feature.geometry?.type === 'MultiLineString') {
            feature.geometry.coordinates.forEach(line => {
              coords.push(...line);
            });
          }
        });
        particleDataRef.current = coords;

        // Start particle animation 1 second after coordinates are extracted
        if (coords.length > 0) {
          setTimeout(() => {
            startParticleAnimation();
          }, 1000);
        }
      } catch (err) {
        // Silently retry
        setTimeout(extractParticleCoords, 200);
      }
    };

    // Helper function to start particle animation
    const startParticleAnimation = () => {
      if (!map?.current || particleDataRef.current.length === 0) return;
      const m = map.current;

      // Stop any existing animation
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      const count = 120; // Number of particles
      const speed = 0.000007; // Animation speed

      const animate = () => {
        const now = Date.now() * speed;
        const features = [];
        const n = particleDataRef.current.length - 1;

        for (let i = 0; i < count; i += 1) {
          const particleProgress = ((now + i / count) % 1);
          const idx = Math.floor(particleProgress * n);
          const nextIdx = Math.min(idx + 1, n);
          const frac = (particleProgress * n) % 1;

          const a = particleDataRef.current[idx];
          const b = particleDataRef.current[nextIdx];
          const lng = a[0] + (b[0] - a[0]) * frac;
          const lat = a[1] + (b[1] - a[1]) * frac;

          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: {}
          });
        }

        try {
          const source = m.getSource(PARTICLE_SOURCE_ID);
          if (source) {
            source.setData({ type: 'FeatureCollection', features });
          }
        } catch (_) {}

        rafRef.current = requestAnimationFrame(animate);
      };

      rafRef.current = requestAnimationFrame(animate);
    };

    // Listen for ready event from PerplexityCall.jsx
    if (window.mapEventBus) {
      const handleReady = () => {
        // Wait a bit for source to be fully ready, then extract coords
        setTimeout(() => {
          extractParticleCoords();
        }, 200);
      };

      window.mapEventBus.on('pryor-grda-route:ready', handleReady);

      // Also try to extract immediately in case event already fired
      extractParticleCoords();

      return () => {
        if (window.mapEventBus) {
          window.mapEventBus.off('pryor-grda-route:ready', handleReady);
        }
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    } else {
      // Fallback: try to extract coords directly
      extractParticleCoords();
      return () => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }
  }, [map]);

  // Control visibility based on visible prop (animation runs independently)
  useEffect(() => {
    if (!map?.current) return;
    const m = map.current;

    // Update visibility based on visible prop
    if (m.getLayer(PARTICLE_LAYER_ID)) {
      m.setLayoutProperty(PARTICLE_LAYER_ID, 'visibility', visible ? 'visible' : 'none');
    }
    if (m.getLayer(LAYER_ID)) {
      m.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
    }
  }, [map, visible]);

  return null;
}

