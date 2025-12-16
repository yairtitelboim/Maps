import { useEffect } from 'react';

/**
 * OG&E Power Pulse Animations Component
 * Creates Path B style pulse animations below OG&E power markers
 * Supports: Gas, Coal, Wind, and Solar
 * Faster animation: 1.0s period - all animations sync together
 */
const OGEPowerPulseAnimations = ({ map, gasMarkers = [], coalMarkers = [], windMarkers = [], solarMarkers = [] }) => {
  
  // Shared animation period for perfect synchronization
  const ANIMATION_PERIOD = 1.0; // 1.0 seconds per cycle - all animations use this
  
  // Helper function to calculate scaled radius based on capacity
  const calculateRadiusRange = (markers) => {
    if (markers.length === 0) return { min: 30, max: 90 };
    
    const capacities = markers.map(m => m.capacity || 0).filter(c => c > 0);
    if (capacities.length === 0) return { min: 30, max: 90 };
    
    const minCapacity = Math.min(...capacities);
    const maxCapacity = Math.max(...capacities);
    
    return {
      minCapacity,
      maxCapacity
    };
  };
  
  // Helper function to get radius for a specific marker based on its capacity
  const getRadiusForMarker = (marker, radiusRange) => {
    if (!marker.capacity || marker.capacity === 0) {
      return { min: 30, max: 90 };
    }
    
    const { minCapacity, maxCapacity } = radiusRange;
    if (maxCapacity === minCapacity) {
      return { min: 30, max: 90 };
    }
    
    // Base radius range
    const baseMin = 30;
    const baseMax = 90;
    
    // Normalize capacity (0.0 to 1.0)
    const normalizedCapacity = (marker.capacity - minCapacity) / (maxCapacity - minCapacity);
    
    // Scale radius proportionally - more reasonable scale (1.0x to 1.5x multiplier)
    const scaleFactor = 1.0 + (normalizedCapacity * 0.5); // 1.0x to 1.5x multiplier
    const minRadius = baseMin * scaleFactor;
    const maxRadius = baseMax * scaleFactor;
    
    return { min: minRadius, max: maxRadius };
  };
  
  // Add pulse animations for gas power markers
  useEffect(() => {
    if (!map?.current || gasMarkers.length === 0) return;

    const markerType = 'oge-gas';
    const color = '#f97316'; // Orange for gas
    const baseId = `${markerType}-power-pulse`;
    
    // Calculate radius range based on capacities
    const radiusRange = calculateRadiusRange(gasMarkers);

    // Remove existing pulse layers and sources
    gasMarkers.forEach((_, index) => {
      const sourceId = `${baseId}-${index}`;
      const layerId = `${baseId}-layer-${index}`;
      
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    });

    // Cancel any existing animation frames
    const animationKey = `${markerType}PowerPulseAnimations`;
    if (window[animationKey]) {
      window[animationKey].forEach(frame => {
        if (frame) cancelAnimationFrame(frame);
      });
    }
    window[animationKey] = [];

    // Create pulse layer for each marker
    gasMarkers.forEach((marker, index) => {
      const sourceId = `${baseId}-${index}`;
      const layerId = `${baseId}-layer-${index}`;
      
      // Calculate radius based on this marker's capacity
      const radius = getRadiusForMarker(marker, radiusRange);
      
      // Create initial pulse feature
      const pulseFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [marker.lng, marker.lat]
        },
        properties: { pulse_t: 0 }
      };

      const pulseGeojson = {
        type: 'FeatureCollection',
        features: [pulseFeature]
      };

      // Add source
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: pulseGeojson
      });

      // Add layer with Path B style pulse animation (scaled by capacity)
      map.current.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'pulse_t'],
            0, radius.min,   // Start at scaled min radius
            1, radius.max    // Expand to scaled max radius
          ],
          'circle-color': color,
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['get', 'pulse_t'],
            0, 0.45,   // Start at 45% opacity
            0.7, 0.22, // Fade to 22% at 70%
            1, 0       // Fade out completely
          ],
          'circle-blur': 0.5 // Soft glow effect
        }
      });

      // Animation loop (Path B style - synchronized with all other power animations)
      let frame;
      const animatePulse = () => {
        const t = ((Date.now() / 1000) % ANIMATION_PERIOD) / ANIMATION_PERIOD; // 0.0 to 1.0
        
        const updatedFeature = {
          ...pulseFeature,
          properties: { pulse_t: t }
        };

        if (map.current.getSource(sourceId)) {
          map.current.getSource(sourceId).setData({
            type: 'FeatureCollection',
            features: [updatedFeature]
          });
        }

        frame = requestAnimationFrame(animatePulse);
        window[animationKey][index] = frame;
      };

      animatePulse();
    });

    // Cleanup function
    return () => {
      gasMarkers.forEach((_, index) => {
        const sourceId = `${baseId}-${index}`;
        const layerId = `${baseId}-layer-${index}`;
        
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });

      if (window[animationKey]) {
        window[animationKey].forEach(frame => {
          if (frame) cancelAnimationFrame(frame);
        });
        window[animationKey] = [];
      }
    };
  }, [map, gasMarkers]);

  // Add pulse animations for coal power markers
  useEffect(() => {
    if (!map?.current || coalMarkers.length === 0) return;

    const markerType = 'oge-coal';
    const color = '#fbbf24'; // Yellow for coal
    const baseId = `${markerType}-power-pulse`;
    
    // Calculate radius range based on capacities
    const radiusRange = calculateRadiusRange(coalMarkers);

    // Remove existing pulse layers and sources
    coalMarkers.forEach((_, index) => {
      const sourceId = `${baseId}-${index}`;
      const layerId = `${baseId}-layer-${index}`;
      
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    });

    // Cancel any existing animation frames
    const animationKey = `${markerType}PowerPulseAnimations`;
    if (window[animationKey]) {
      window[animationKey].forEach(frame => {
        if (frame) cancelAnimationFrame(frame);
      });
    }
    window[animationKey] = [];

    // Create pulse layer for each marker
    coalMarkers.forEach((marker, index) => {
      const sourceId = `${baseId}-${index}`;
      const layerId = `${baseId}-layer-${index}`;
      
      // Calculate radius based on this marker's capacity
      const radius = getRadiusForMarker(marker, radiusRange);
      
      // Create initial pulse feature
      const pulseFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [marker.lng, marker.lat]
        },
        properties: { pulse_t: 0 }
      };

      const pulseGeojson = {
        type: 'FeatureCollection',
        features: [pulseFeature]
      };

      // Add source
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: pulseGeojson
      });

      // Add layer with Path B style pulse animation (scaled by capacity)
      map.current.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'pulse_t'],
            0, radius.min,   // Start at scaled min radius
            1, radius.max    // Expand to scaled max radius
          ],
          'circle-color': color,
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['get', 'pulse_t'],
            0, 0.45,   // Start at 45% opacity
            0.7, 0.22, // Fade to 22% at 70%
            1, 0       // Fade out completely
          ],
          'circle-blur': 0.5 // Soft glow effect
        }
      });

      // Animation loop (Path B style - synchronized with all other power animations)
      let frame;
      const animatePulse = () => {
        const t = ((Date.now() / 1000) % ANIMATION_PERIOD) / ANIMATION_PERIOD; // 0.0 to 1.0
        
        const updatedFeature = {
          ...pulseFeature,
          properties: { pulse_t: t }
        };

        if (map.current.getSource(sourceId)) {
          map.current.getSource(sourceId).setData({
            type: 'FeatureCollection',
            features: [updatedFeature]
          });
        }

        frame = requestAnimationFrame(animatePulse);
        window[animationKey][index] = frame;
      };

      animatePulse();
    });

    // Cleanup function
    return () => {
      coalMarkers.forEach((_, index) => {
        const sourceId = `${baseId}-${index}`;
        const layerId = `${baseId}-layer-${index}`;
        
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });

      if (window[animationKey]) {
        window[animationKey].forEach(frame => {
          if (frame) cancelAnimationFrame(frame);
        });
        window[animationKey] = [];
      }
    };
  }, [map, coalMarkers]);

  // Add pulse animations for wind power markers
  useEffect(() => {
    if (!map?.current || windMarkers.length === 0) return;

    const markerType = 'oge-wind';
    const color = '#10b981'; // Green for wind
    const baseId = `${markerType}-power-pulse`;
    
    // Calculate radius range based on capacities
    const radiusRange = calculateRadiusRange(windMarkers);

    // Remove existing pulse layers and sources
    windMarkers.forEach((_, index) => {
      const sourceId = `${baseId}-${index}`;
      const layerId = `${baseId}-layer-${index}`;
      
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    });

    // Cancel any existing animation frames
    const animationKey = `${markerType}PowerPulseAnimations`;
    if (window[animationKey]) {
      window[animationKey].forEach(frame => {
        if (frame) cancelAnimationFrame(frame);
      });
    }
    window[animationKey] = [];

    // Create pulse layer for each marker
    windMarkers.forEach((marker, index) => {
      const sourceId = `${baseId}-${index}`;
      const layerId = `${baseId}-layer-${index}`;
      
      // Calculate radius based on this marker's capacity
      const radius = getRadiusForMarker(marker, radiusRange);
      
      // Create initial pulse feature
      const pulseFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [marker.lng, marker.lat]
        },
        properties: { pulse_t: 0 }
      };

      const pulseGeojson = {
        type: 'FeatureCollection',
        features: [pulseFeature]
      };

      // Add source
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: pulseGeojson
      });

      // Add layer with Path B style pulse animation (scaled by capacity)
      map.current.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'pulse_t'],
            0, radius.min,   // Start at scaled min radius
            1, radius.max    // Expand to scaled max radius
          ],
          'circle-color': color,
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['get', 'pulse_t'],
            0, 0.45,   // Start at 45% opacity
            0.7, 0.22, // Fade to 22% at 70%
            1, 0       // Fade out completely
          ],
          'circle-blur': 0.5 // Soft glow effect
        }
      });

      // Animation loop (Path B style - synchronized with all other power animations)
      let frame;
      const animatePulse = () => {
        const t = ((Date.now() / 1000) % ANIMATION_PERIOD) / ANIMATION_PERIOD; // 0.0 to 1.0
        
        const updatedFeature = {
          ...pulseFeature,
          properties: { pulse_t: t }
        };

        if (map.current.getSource(sourceId)) {
          map.current.getSource(sourceId).setData({
            type: 'FeatureCollection',
            features: [updatedFeature]
          });
        }

        frame = requestAnimationFrame(animatePulse);
        window[animationKey][index] = frame;
      };

      animatePulse();
    });

    // Cleanup function
    return () => {
      windMarkers.forEach((_, index) => {
        const sourceId = `${baseId}-${index}`;
        const layerId = `${baseId}-layer-${index}`;
        
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });

      if (window[animationKey]) {
        window[animationKey].forEach(frame => {
          if (frame) cancelAnimationFrame(frame);
        });
        window[animationKey] = [];
      }
    };
  }, [map, windMarkers]);

  // Add pulse animations for solar power markers
  useEffect(() => {
    if (!map?.current || solarMarkers.length === 0) return;

    const markerType = 'oge-solar';
    const color = '#f59e0b'; // Amber for solar
    const baseId = `${markerType}-power-pulse`;
    
    // Calculate radius range based on capacities
    const radiusRange = calculateRadiusRange(solarMarkers);

    // Remove existing pulse layers and sources
    solarMarkers.forEach((_, index) => {
      const sourceId = `${baseId}-${index}`;
      const layerId = `${baseId}-layer-${index}`;
      
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    });

    // Cancel any existing animation frames
    const animationKey = `${markerType}PowerPulseAnimations`;
    if (window[animationKey]) {
      window[animationKey].forEach(frame => {
        if (frame) cancelAnimationFrame(frame);
      });
    }
    window[animationKey] = [];

    // Create pulse layer for each marker
    solarMarkers.forEach((marker, index) => {
      const sourceId = `${baseId}-${index}`;
      const layerId = `${baseId}-layer-${index}`;
      
      // Calculate radius based on this marker's capacity
      const radius = getRadiusForMarker(marker, radiusRange);
      
      // Create initial pulse feature
      const pulseFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [marker.lng, marker.lat]
        },
        properties: { pulse_t: 0 }
      };

      const pulseGeojson = {
        type: 'FeatureCollection',
        features: [pulseFeature]
      };

      // Add source
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: pulseGeojson
      });

      // Add layer with Path B style pulse animation (scaled by capacity)
      map.current.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'pulse_t'],
            0, radius.min,   // Start at scaled min radius
            1, radius.max    // Expand to scaled max radius
          ],
          'circle-color': color,
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['get', 'pulse_t'],
            0, 0.45,   // Start at 45% opacity
            0.7, 0.22, // Fade to 22% at 70%
            1, 0       // Fade out completely
          ],
          'circle-blur': 0.5 // Soft glow effect
        }
      });

      // Animation loop (Path B style - synchronized with all other power animations)
      let frame;
      const animatePulse = () => {
        const t = ((Date.now() / 1000) % ANIMATION_PERIOD) / ANIMATION_PERIOD; // 0.0 to 1.0
        
        const updatedFeature = {
          ...pulseFeature,
          properties: { pulse_t: t }
        };

        if (map.current.getSource(sourceId)) {
          map.current.getSource(sourceId).setData({
            type: 'FeatureCollection',
            features: [updatedFeature]
          });
        }

        frame = requestAnimationFrame(animatePulse);
        window[animationKey][index] = frame;
      };

      animatePulse();
    });

    // Cleanup function
    return () => {
      solarMarkers.forEach((_, index) => {
        const sourceId = `${baseId}-${index}`;
        const layerId = `${baseId}-layer-${index}`;
        
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });

      if (window[animationKey]) {
        window[animationKey].forEach(frame => {
          if (frame) cancelAnimationFrame(frame);
        });
        window[animationKey] = [];
      }
    };
  }, [map, solarMarkers]);

  return null; // This component doesn't render anything
};

export default OGEPowerPulseAnimations;

