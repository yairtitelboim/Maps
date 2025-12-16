import { useEffect } from 'react';

/**
 * Gas, Hydro, and Wind Power Pulse Animations Component
 * Creates Path B style pulse animations below gas, hydro, and wind power markers
 * Faster animation: 1.0s period (was 1.6s) - all animations sync together
 */
const GasHydroPowerPulseAnimations = ({ map, gasMarkers = [], hydroMarkers = [], windMarkers = [] }) => {
  
  // Shared animation period for perfect synchronization
  const ANIMATION_PERIOD = 1.0; // 1.0 seconds per cycle - all animations use this
  
  // Helper function to calculate scaled radius based on capacity (make it real obvious)
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
    // This gives: smallest = 30-90px, largest = 45-135px
    const scaleFactor = 1.0 + (normalizedCapacity * 0.5); // 1.0x to 1.5x multiplier
    const minRadius = baseMin * scaleFactor;
    const maxRadius = baseMax * scaleFactor;
    
    return { min: minRadius, max: maxRadius };
  };
  
  // Add pulse animations for gas power markers
  useEffect(() => {
    if (!map?.current || gasMarkers.length === 0) return;

    const markerType = 'gas';
    const color = '#f97316'; // Orange for gas
    const baseId = `${markerType}-power-pulse`;
    
    // Calculate radius range based on capacities
    const radiusRange = calculateRadiusRange(gasMarkers);

    // Only clean up pulse layers and sources that are no longer needed
    // Check existing layers and remove ones that don't have corresponding markers
    const animationKey = `${markerType}PowerPulseAnimations`;
    
    // Cancel animation frames for markers that no longer exist
    if (window[animationKey]) {
      // Keep frames for existing markers, cancel ones beyond current count
      for (let i = gasMarkers.length; i < window[animationKey].length; i++) {
        if (window[animationKey][i]) {
          cancelAnimationFrame(window[animationKey][i]);
        }
      }
      // Resize array to match current marker count
      window[animationKey] = window[animationKey].slice(0, gasMarkers.length);
    } else {
      window[animationKey] = [];
    }
    
    // Remove layers and sources for markers that no longer exist
    let index = gasMarkers.length;
    while (true) {
      const sourceId = `${baseId}-${index}`;
      const layerId = `${baseId}-layer-${index}`;
      
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      } else {
        break; // No more sources to remove
      }
      index++;
    }

    // Create or update pulse layer for each marker
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

      // Only add source if it doesn't exist
      if (!map.current.getSource(sourceId)) {
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: pulseGeojson
        });
      } else {
        // Update existing source data
        map.current.getSource(sourceId).setData(pulseGeojson);
      }

      // Only add layer if it doesn't exist
      if (!map.current.getLayer(layerId)) {
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
      }

      // Only start animation if it's not already running
      if (!window[animationKey] || !window[animationKey][index]) {
        // Initialize array if needed
        if (!window[animationKey]) {
          window[animationKey] = [];
        }
        
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
      }
    });

    // Cleanup function - only runs on unmount, not on re-render
    // We don't clean up here because we handle cleanup in the main effect when markers are removed
    return () => {
      // Only clean up if component is actually unmounting (not just re-rendering)
      // This is handled by checking if markers array is empty or component is unmounting
      // For now, we let the main effect handle cleanup when markers change
    };
  }, [map, gasMarkers]);

  // Add pulse animations for hydro power markers
  useEffect(() => {
    if (!map?.current || hydroMarkers.length === 0) {
      return;
    }

    const markerType = 'hydro';
    const color = '#06b6d4'; // Cyan for hydro
    const baseId = `${markerType}-power-pulse`;
    
    // Calculate radius range based on capacities
    const radiusRange = calculateRadiusRange(hydroMarkers);

    // Only clean up pulse layers and sources that are no longer needed
    // Check existing layers and remove ones that don't have corresponding markers
    const animationKey = `${markerType}PowerPulseAnimations`;
    
    // Cancel animation frames for markers that no longer exist
    if (window[animationKey]) {
      // Keep frames for existing markers, cancel ones beyond current count
      for (let i = hydroMarkers.length; i < window[animationKey].length; i++) {
        if (window[animationKey][i]) {
          cancelAnimationFrame(window[animationKey][i]);
        }
      }
      // Resize array to match current marker count
      window[animationKey] = window[animationKey].slice(0, hydroMarkers.length);
    } else {
      window[animationKey] = [];
    }
    
    // Remove layers and sources for markers that no longer exist
    let index = hydroMarkers.length;
    while (true) {
      const sourceId = `${baseId}-${index}`;
      const layerId = `${baseId}-layer-${index}`;
      
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      } else {
        break; // No more sources to remove
      }
      index++;
    }

    // Create or update pulse layer for each marker
    hydroMarkers.forEach((marker, index) => {
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

      // Only add source if it doesn't exist
      if (!map.current.getSource(sourceId)) {
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: pulseGeojson
        });
      } else {
        // Update existing source data
        map.current.getSource(sourceId).setData(pulseGeojson);
      }

      // Only add layer if it doesn't exist
      if (!map.current.getLayer(layerId)) {
        map.current.addLayer({
          id: layerId,
          type: 'circle',
          source: sourceId,
          layout: {
            visibility: 'visible' // Explicitly set to visible when creating
          },
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
      } else {
        // Layer exists - ensure it's visible if it exists
        const currentVisibility = map.current.getLayoutProperty(layerId, 'visibility');
        if (currentVisibility !== 'visible') {
          map.current.setLayoutProperty(layerId, 'visibility', 'visible');
        }
      }

      // Always ensure animation is running - restart if needed
      // Initialize array if needed
      if (!window[animationKey]) {
        window[animationKey] = [];
      }
      
      // Check if animation is already running
      const existingFrame = window[animationKey][index];
      if (!existingFrame) {
        // Animation loop (Path B style - synchronized with all other power animations)
        let frame;
        const animatePulse = () => {
          const t = ((Date.now() / 1000) % ANIMATION_PERIOD) / ANIMATION_PERIOD; // 0.0 to 1.0
          
          const updatedFeature = {
            ...pulseFeature,
            properties: { pulse_t: t }
          };

          // Check if source still exists before updating
          if (!map.current || !map.current.getSource(sourceId)) {
            if (window[animationKey]) {
              window[animationKey][index] = null;
            }
            return; // Stop animation if source is gone
          }

          try {
            map.current.getSource(sourceId).setData({
              type: 'FeatureCollection',
              features: [updatedFeature]
            });
          } catch (error) {
            if (window[animationKey]) {
              window[animationKey][index] = null;
            }
            return; // Stop animation on error
          }

          frame = requestAnimationFrame(animatePulse);
          if (window[animationKey]) {
            window[animationKey][index] = frame;
          }
        };

        animatePulse();
      }
    });

    // Cleanup function - only runs on unmount, not on re-render
    // We don't clean up here because we handle cleanup in the main effect when markers are removed
    return () => {
      // Only clean up if component is actually unmounting (not just re-rendering)
      // This is handled by checking if markers array is empty or component is unmounting
      // For now, we let the main effect handle cleanup when markers change
    };
  }, [map, hydroMarkers]);

  // Add pulse animations for wind power markers
  useEffect(() => {
    if (!map?.current || windMarkers.length === 0) return;

    const markerType = 'wind';
    const color = '#10b981'; // Green for wind
    const baseId = `${markerType}-power-pulse`;
    
    // Calculate radius range based on capacities
    const radiusRange = calculateRadiusRange(windMarkers);

    // Only clean up pulse layers and sources that are no longer needed
    // Check existing layers and remove ones that don't have corresponding markers
    const animationKey = `${markerType}PowerPulseAnimations`;
    
    // Cancel animation frames for markers that no longer exist
    if (window[animationKey]) {
      // Keep frames for existing markers, cancel ones beyond current count
      for (let i = windMarkers.length; i < window[animationKey].length; i++) {
        if (window[animationKey][i]) {
          cancelAnimationFrame(window[animationKey][i]);
        }
      }
      // Resize array to match current marker count
      window[animationKey] = window[animationKey].slice(0, windMarkers.length);
    } else {
      window[animationKey] = [];
    }
    
    // Remove layers and sources for markers that no longer exist
    let index = windMarkers.length;
    while (true) {
      const sourceId = `${baseId}-${index}`;
      const layerId = `${baseId}-layer-${index}`;
      
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      } else {
        break; // No more sources to remove
      }
      index++;
    }

    // Create or update pulse layer for each marker
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

      // Only add source if it doesn't exist
      if (!map.current.getSource(sourceId)) {
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: pulseGeojson
        });
      } else {
        // Update existing source data
        map.current.getSource(sourceId).setData(pulseGeojson);
      }

      // Only add layer if it doesn't exist
      if (!map.current.getLayer(layerId)) {
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
      }

      // Only start animation if it's not already running
      if (!window[animationKey][index]) {
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
      }
    });

    // Cleanup function - only runs on unmount, not on re-render
    // We don't clean up here because we handle cleanup in the main effect when markers are removed
    return () => {
      // Only clean up if component is actually unmounting (not just re-rendering)
      // This is handled by checking if markers array is empty or component is unmounting
      // For now, we let the main effect handle cleanup when markers change
    };
  }, [map, windMarkers]);

  return null; // This component doesn't render anything
};

export default GasHydroPowerPulseAnimations;
