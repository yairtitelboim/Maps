/**
 * Archived: Oklahoma campus route layer - removed for Columbus migration
 * This component handled route visualization for Oklahoma infrastructure sites.
 * TODO: Implement AEP Ohio route layer if needed
 */
import { useEffect, useRef } from 'react';

const SOURCE_ID = 'okc-campuses-route-source';
const LAYER_ID = 'okc-campuses-route-layer';
const PARTICLE_SOURCE_ID = 'okc-campuses-route-particles';
const PARTICLE_LAYER_ID = 'okc-campuses-route-particles-layer';

export default function OKCCampusesRouteLayer({ map, visible }) {
  // Component disabled - Oklahoma-specific routes removed
  // Will gracefully handle missing sources (no-op)
  const rafRef = useRef(null);
  const particleDataRef = useRef([]);
  
  // Helper function to check if any Infrastructure Sites (campus teardrop markers) are visible
  const checkInfrastructureSitesVisible = () => {
    if (!window.okCampusTeardropMarkers || window.okCampusTeardropMarkers.length === 0) {
      return false;
    }
    
    // Check if at least one Infrastructure Site marker is visible
    for (const marker of window.okCampusTeardropMarkers) {
      const markerElement = marker.getElement();
      if (markerElement) {
        const computedStyle = window.getComputedStyle(markerElement);
        const opacity = parseFloat(computedStyle.opacity) || 0;
        const visibility = computedStyle.visibility;
        const display = computedStyle.display;
        
        // Marker is visible if opacity > 0, visibility is not 'hidden', and display is not 'none'
        if (opacity > 0 && visibility !== 'hidden' && display !== 'none') {
          return true;
        }
      }
    }
    
    return false;
  };
  
  // Extract particle coordinates and start animation when layers are ready
  useEffect(() => {
    if (!map?.current) return;
    const m = map.current;

    // Wait for route source to be loaded (created by OSMCall.jsx)
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

    // Listen for ready event from OSMCall.jsx
    if (window.mapEventBus) {
      const handleReady = () => {
        // Wait a bit for source to be fully ready, then extract coords
        setTimeout(() => {
          extractParticleCoords();
        }, 200);
      };

      window.mapEventBus.on('okc-campuses-route:ready', handleReady);

      // Also try to extract immediately in case event already fired
      extractParticleCoords();

      return () => {
        if (window.mapEventBus) {
          window.mapEventBus.off('okc-campuses-route:ready', handleReady);
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

  // Listen for toggle events from legend - layers are now created by OSMCall.jsx
  useEffect(() => {
    if (!window.mapEventBus) return;

    const handleToggle = (isVisible) => {
      if (!map?.current) return;
      const m = map.current;
      
      // Layers should exist now (created by OSMCall.jsx), but check anyway
      if (m.getLayer(LAYER_ID)) {
        m.setLayoutProperty(LAYER_ID, 'visibility', isVisible ? 'visible' : 'none');
      }
      
      if (m.getLayer(PARTICLE_LAYER_ID)) {
        m.setLayoutProperty(PARTICLE_LAYER_ID, 'visibility', isVisible ? 'visible' : 'none');
      }
    };

    window.mapEventBus.on('okc-campuses-route:toggle', handleToggle);

    return () => {
      if (window.mapEventBus) {
        window.mapEventBus.off('okc-campuses-route:toggle', handleToggle);
      }
    };
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

