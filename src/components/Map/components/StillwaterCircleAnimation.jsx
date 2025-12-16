import { useCallback, useEffect, useRef, useState } from 'react';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer } from '@deck.gl/layers';

const LAYER_ID = 'stillwater-circle-animation';
const STILLWATER_COORDS = [-97.0584, 36.1156]; // [lng, lat]

const resolveMapInstance = (map) => {
  if (!map) return null;
  if (typeof map.getStyle === 'function') return map;
  if (map.current && typeof map.current.getStyle === 'function') return map.current;
  return null;
};

const StillwaterCircleAnimation = ({ map, visible = false, onCleanup }) => {
  const mapInstance = resolveMapInstance(map);
  const overlayRef = useRef(null);
  const animationRef = useRef(null);
  const [radius, setRadius] = useState(0);
  const cleanupNotifiedRef = useRef(false);
  const overlaySetupRef = useRef(false); // Track if overlay setup has been initiated
  const mapInstanceRef = useRef(null); // Stable ref to map instance

  // Log when component mounts/unmounts or visibility changes
  useEffect(() => {
    console.log('🎬 [StillwaterCircle] Component mounted/updated:', { visible, mapInstance: !!mapInstance });
    return () => {
      console.log('🛑 [StillwaterCircle] Component unmounting');
    };
  }, [visible, mapInstance]);

  const notifyCleanup = useCallback((detail = { status: 'stopped' }) => {
    if (cleanupNotifiedRef.current) return;
    cleanupNotifiedRef.current = true;
    if (typeof onCleanup === 'function') {
      try {
        onCleanup(detail);
      } catch (error) {
        console.warn('⚠️ [StillwaterCircle] onCleanup error', error);
      }
    }
  }, [onCleanup]);

  // Animation loop for pulsing circle - use stable map ref
  useEffect(() => {
    const currentMapInstance = mapInstanceRef.current;
    if (!visible || !currentMapInstance) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    let startTime = performance.now();
    const animationDuration = 3000; // 3 seconds for full pulse cycle

    const animate = (timestamp) => {
      if (!visible || !overlayRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
        return;
      }

      const elapsed = timestamp - startTime;
      const progress = (elapsed % animationDuration) / animationDuration;
      
      // Create a pulsing effect: 0 -> 1 -> 0
      const pulse = Math.sin(progress * Math.PI * 2);
      const normalizedPulse = (pulse + 1) / 2; // Normalize to 0-1
      
      // Radius ranges from 500m to 2000m
      const minRadius = 500;
      const maxRadius = 2000;
      const currentRadius = minRadius + (normalizedPulse * (maxRadius - minRadius));
      
      setRadius(currentRadius);

      // Update overlay if it exists - this will be handled by the radius update effect
      // Don't update here to avoid double updates

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [visible]); // Removed mapInstance from deps - use ref instead

  // Store stable map instance reference
  useEffect(() => {
    mapInstanceRef.current = mapInstance;
  }, [mapInstance]);

  // Add/remove overlay - use stable refs to prevent re-creation on zoom/pan
  useEffect(() => {
    const currentMapInstance = mapInstanceRef.current;
    if (!currentMapInstance) return;

    if (!visible) {
      // Remove overlay if it exists
      if (overlayRef.current) {
        try {
          currentMapInstance.removeControl(overlayRef.current);
          console.log('✅ [StillwaterCircle] Overlay removed');
        } catch (error) {
          console.warn('⚠️ [StillwaterCircle] Failed to remove overlay', error);
        }
        overlayRef.current = null;
      }
      overlaySetupRef.current = false; // Reset setup flag when hidden
      return;
    }

    // CRITICAL: If overlay already exists and is in map, do NOT recreate it
    // This prevents recreation on zoom/pan events
    if (overlayRef.current && overlaySetupRef.current) {
      try {
        const controls = currentMapInstance._controls || [];
        const overlayExists = controls.some(control => control === overlayRef.current);
        if (overlayExists) {
          // Overlay exists and is properly set up - just return, don't recreate
          return;
        } else {
          // Overlay ref exists but not in map - something went wrong, reset
          overlayRef.current = null;
          overlaySetupRef.current = false;
        }
      } catch (error) {
        // If we can't verify, assume it's gone and allow re-setup
        overlayRef.current = null;
        overlaySetupRef.current = false;
      }
    }

    // If setup is already in progress, don't start again
    if (overlaySetupRef.current && !overlayRef.current) {
      // Setup was in progress but overlay is null - wait a bit
      return;
    }

    // Start setup only if not already done
    if (overlaySetupRef.current && overlayRef.current) {
      return; // Already set up
    }

    overlaySetupRef.current = true; // Mark setup as started immediately

    let loadHandlerRef = null;
    let styleLoadHandlerRef = null;
    let isAddingRef = false;
    let timeoutIdRef = null;

    // Wait for map to be ready (load event)
    const addOverlay = () => {
      // Final check before proceeding
      if (isAddingRef || (overlayRef.current && overlaySetupRef.current)) {
        return;
      }

      // More robust map readiness check - similar to other components
      const isStyleLoaded = typeof currentMapInstance.isStyleLoaded === 'function' 
        ? currentMapInstance.isStyleLoaded() 
        : false;
      const hasStyle = !!currentMapInstance.getStyle?.();
      const hasLayers = currentMapInstance.getStyle?.()?.layers?.length > 0;
      const isMapReady = isStyleLoaded || (hasStyle && hasLayers);
      
      console.log('🔍 [StillwaterCircle] Map readiness check:', {
        isStyleLoaded,
        hasStyle,
        hasLayers,
        isMapReady
      });
      
      // Check if map is already loaded, if not wait for load event
      if (!isMapReady) {
        // Only set up handlers once
        if (!loadHandlerRef && !styleLoadHandlerRef) {
          console.log('⏳ [StillwaterCircle] Map not loaded yet, waiting for load event...');
          
          // Use a timeout fallback in case events never fire
          timeoutIdRef = setTimeout(() => {
            console.log('⏰ [StillwaterCircle] Timeout waiting for map, proceeding anyway...');
            if (loadHandlerRef) currentMapInstance.off('load', loadHandlerRef);
            if (styleLoadHandlerRef) currentMapInstance.off('style.load', styleLoadHandlerRef);
            loadHandlerRef = null;
            styleLoadHandlerRef = null;
            timeoutIdRef = null;
            // Try to add overlay anyway - MapboxOverlay can handle it
            addOverlay();
          }, 2000); // 2 second timeout
          
          loadHandlerRef = () => {
            if (timeoutIdRef) {
              clearTimeout(timeoutIdRef);
              timeoutIdRef = null;
            }
            // Check again before proceeding
            if (overlayRef.current || isAddingRef) {
              if (loadHandlerRef) currentMapInstance.off('load', loadHandlerRef);
              if (styleLoadHandlerRef) currentMapInstance.off('style.load', styleLoadHandlerRef);
              loadHandlerRef = null;
              styleLoadHandlerRef = null;
              return;
            }
            console.log('✅ [StillwaterCircle] Map load event fired');
            if (loadHandlerRef) currentMapInstance.off('load', loadHandlerRef);
            if (styleLoadHandlerRef) currentMapInstance.off('style.load', styleLoadHandlerRef);
            loadHandlerRef = null;
            styleLoadHandlerRef = null;
            addOverlay();
          };
          
          styleLoadHandlerRef = () => {
            if (timeoutIdRef) {
              clearTimeout(timeoutIdRef);
              timeoutIdRef = null;
            }
            // Check again before proceeding
            if (overlayRef.current || isAddingRef) {
              if (loadHandlerRef) currentMapInstance.off('load', loadHandlerRef);
              if (styleLoadHandlerRef) currentMapInstance.off('style.load', styleLoadHandlerRef);
              loadHandlerRef = null;
              styleLoadHandlerRef = null;
              return;
            }
            console.log('✅ [StillwaterCircle] Map style.load event fired');
            if (loadHandlerRef) currentMapInstance.off('load', loadHandlerRef);
            if (styleLoadHandlerRef) currentMapInstance.off('style.load', styleLoadHandlerRef);
            loadHandlerRef = null;
            styleLoadHandlerRef = null;
            addOverlay();
          };
          
          // Try both 'load' and 'style.load' events
          currentMapInstance.once('load', loadHandlerRef);
          currentMapInstance.once('style.load', styleLoadHandlerRef);
        }
        return;
      }
      
      console.log('✅ [StillwaterCircle] Map is ready, proceeding with overlay creation');

      // Final check before creating overlay
      if (overlayRef.current || isAddingRef) {
        return;
      }

      isAddingRef = true;

      // Create the circle data point - use meters for radius
      // Use initial radius (1000m) - updates will be handled by radius update effect
      const circleData = [{
        position: STILLWATER_COORDS,
        radius: 1000 // Initial radius, will be updated by animation loop
      }];

      console.log('🎨 [StillwaterCircle] Creating and adding MapboxOverlay...');

      // Create MapboxOverlay with ScatterplotLayer
      // Following deck.gl Mapbox integration pattern: https://deck.gl/docs/developer-guide/base-maps/using-with-mapbox
      const overlay = new MapboxOverlay({
        interleaved: true, // Renders into Mapbox's WebGL2 context for proper integration
        layers: [
          new ScatterplotLayer({
            id: LAYER_ID,
            data: circleData,
            getPosition: d => d.position, // [lng, lat] format - MapboxOverlay handles coordinate system automatically
            getRadius: d => d.radius, // radius in meters
            getFillColor: [76, 175, 80, 120],
            getLineColor: [76, 175, 80, 200],
            radiusScale: 1, // 1 = meters, ensures geographic scale
            radiusMinPixels: 20,
            radiusMaxPixels: 1000,
            stroked: true,
            lineWidthMinPixels: 3,
            lineWidthMaxPixels: 6,
            pickable: false,
            visible: true
            // Note: coordinateSystem not needed - MapboxOverlay automatically uses LNGLAT
            // updateTriggers not needed - deck.gl handles updates automatically
          })
        ]
      });

      try {
        currentMapInstance.addControl(overlay);
        overlayRef.current = overlay;
        isAddingRef = false;
        console.log('✅ [StillwaterCircle] MapboxOverlay added successfully');
      } catch (error) {
        overlaySetupRef.current = false; // Reset on failure
        isAddingRef = false;
        console.error('❌ [StillwaterCircle] Failed to add MapboxOverlay', error);
        notifyCleanup({
          status: 'failed',
          reason: 'overlay_add_failed',
          message: error?.message
        });
      }
    };

    addOverlay();

    return () => {
      // Clean up timeout
      if (timeoutIdRef) {
        clearTimeout(timeoutIdRef);
        timeoutIdRef = null;
      }
      
      // Clean up event listeners
      if (loadHandlerRef && currentMapInstance) {
        currentMapInstance.off('load', loadHandlerRef);
        loadHandlerRef = null;
      }
      if (styleLoadHandlerRef && currentMapInstance) {
        currentMapInstance.off('style.load', styleLoadHandlerRef);
        styleLoadHandlerRef = null;
      }
      
      // Only remove overlay if visible is changing to false
      // Don't remove on zoom/pan (which might trigger effect re-run)
      if (!visible && overlayRef.current && currentMapInstance) {
        try {
          currentMapInstance.removeControl(overlayRef.current);
        } catch (error) {
          console.warn('⚠️ [StillwaterCircle] Failed to remove overlay on cleanup', error);
        }
        overlayRef.current = null;
        overlaySetupRef.current = false;
      }
    };
  }, [visible, notifyCleanup]); // Removed mapInstance and radius from deps - use refs instead

  // Separate effect to update overlay when radius changes - use stable map ref
  useEffect(() => {
    const currentMapInstance = mapInstanceRef.current;
    if (!overlayRef.current || !visible || !currentMapInstance) {
      // Silently skip if overlay doesn't exist yet (it's still being created)
      return;
    }

    const currentRadius = radius || 1000;
    const updatedData = [{
      position: STILLWATER_COORDS,
      radius: currentRadius
    }];

    try {
      overlayRef.current.setProps({
        layers: [
          new ScatterplotLayer({
            id: LAYER_ID,
            data: updatedData,
            getPosition: d => d.position,
            getRadius: d => d.radius,
            getFillColor: [76, 175, 80, 120],
            getLineColor: [76, 175, 80, 200],
            radiusScale: 1,
            radiusMinPixels: 20,
            radiusMaxPixels: 1000,
            stroked: true,
            lineWidthMinPixels: 3,
            lineWidthMaxPixels: 6,
            pickable: false,
            visible: true
            // Note: coordinateSystem not needed - MapboxOverlay automatically uses LNGLAT
            // updateTriggers not needed - deck.gl handles updates automatically
          })
        ]
      });
      currentMapInstance.triggerRepaint?.();
      // Removed verbose update logs - animation is working smoothly
    } catch (error) {
      console.warn('⚠️ [StillwaterCircle] Failed to update overlay', error);
      console.warn('⚠️ [StillwaterCircle] Update error details:', {
        message: error?.message,
        overlayExists: !!overlayRef.current,
        visible,
        mapInstance: !!currentMapInstance
      });
    }
  }, [radius, visible]); // Removed mapInstance from deps - use ref instead

  return null;
};

export default StillwaterCircleAnimation;

