import { useCallback, useEffect, useRef, useState } from 'react';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { TripsLayer } from '@deck.gl/geo-layers';

const LAYER_ID = 'infrastructure-flow-animation';

// Archived: Oklahoma infrastructure route files - removed for Columbus migration
// TODO: Add AEP Ohio infrastructure route files when available
// Route files for infrastructure connections (red markers only)
const INFRASTRUCTURE_ROUTE_FILES = [
  // Archived: Oklahoma routes removed
  // Future: Add AEP Ohio transmission route files here
];

const resolveMapInstance = (map) => {
  if (!map) return null;
  if (typeof map.getStyle === 'function') return map;
  if (map.current && typeof map.current.getStyle === 'function') return map.current;
  return null;
};

const InfrastructureFlowAnimation = ({ map, visible = false, onCleanup }) => {
  const mapInstance = resolveMapInstance(map);
  const overlayRef = useRef(null);
  const animationRef = useRef(null);
  const [trips, setTrips] = useState([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const cleanupNotifiedRef = useRef(false);
  const overlaySetupRef = useRef(false);
  const mapInstanceRef = useRef(null);

  // Log when component mounts/unmounts or visibility changes
  useEffect(() => {
    console.log('🎬 [InfrastructureFlow] Component mounted/updated:', { visible, mapInstance: !!mapInstance });
    return () => {
      console.log('🛑 [InfrastructureFlow] Component unmounting');
    };
  }, [visible, mapInstance]);

  const notifyCleanup = useCallback((detail = { status: 'stopped' }) => {
    if (cleanupNotifiedRef.current) return;
    cleanupNotifiedRef.current = true;
    if (typeof onCleanup === 'function') {
      try {
        onCleanup(detail);
      } catch (error) {
        console.warn('⚠️ [InfrastructureFlow] onCleanup error', error);
      }
    }
  }, [onCleanup]);

  // Store stable map instance reference
  useEffect(() => {
    mapInstanceRef.current = mapInstance;
  }, [mapInstance]);

  // Load route data and convert to trips format
  useEffect(() => {
    if (!visible) {
      setTrips([]);
      return;
    }

    const loadRoutes = async () => {
      try {
        console.log('🔄 [InfrastructureFlow] Loading route data...');
        
        // Load all route files
        const collections = await Promise.all(
          INFRASTRUCTURE_ROUTE_FILES.map(async (path) => {
            try {
              const res = await fetch(path);
              if (!res.ok) {
                console.warn(`⚠️ [InfrastructureFlow] Failed to load ${path}: ${res.status}`);
                return { features: [] };
              }
              return res.json();
            } catch (err) {
              console.warn(`⚠️ [InfrastructureFlow] Error loading ${path}:`, err);
              return { features: [] };
            }
          })
        );

        // Convert GeoJSON LineString features to trips format
        const tripsData = [];
        const baseTime = Date.now();
        const tripDuration = 30000; // 30 seconds per trip
        let tripIndex = 0;

        collections.forEach((collection, fileIndex) => {
          const features = collection.features || [];
          
          features.forEach((feature) => {
            if (feature.geometry?.type === 'LineString' && feature.geometry.coordinates) {
              const path = feature.geometry.coordinates;
              
              if (path.length < 2) return; // Skip invalid paths
              
              // Create timestamps for the path (evenly distributed over trip duration)
              const timestamps = path.map((_, index) => {
                const progress = index / (path.length - 1);
                return baseTime + (tripIndex * 2000) + (progress * tripDuration);
              });

              tripsData.push({
                id: `trip-${fileIndex}-${tripIndex}`,
                path: path,
                timestamps: timestamps,
                color: [239, 68, 68, 200] // Red color to match infrastructure markers
              });

              tripIndex++;
            } else if (feature.geometry?.type === 'MultiLineString') {
              // Handle MultiLineString by creating separate trips for each line
              feature.geometry.coordinates.forEach((line, lineIndex) => {
                if (line.length < 2) return;
                
                const timestamps = line.map((_, index) => {
                  const progress = index / (line.length - 1);
                  return baseTime + (tripIndex * 2000) + (progress * tripDuration);
                });

                tripsData.push({
                  id: `trip-${fileIndex}-${lineIndex}-${tripIndex}`,
                  path: line,
                  timestamps: timestamps,
                  color: [239, 68, 68, 200]
                });

                tripIndex++;
              });
            }
          });
        });

        console.log(`✅ [InfrastructureFlow] Loaded ${tripsData.length} trips from ${collections.length} route files`);
        setTrips(tripsData);
      } catch (error) {
        console.error('❌ [InfrastructureFlow] Error loading routes:', error);
        setTrips([]);
      }
    };

    loadRoutes();
  }, [visible]);

  // Animation loop for updating currentTime
  useEffect(() => {
    const currentMapInstance = mapInstanceRef.current;
    if (!visible || !currentMapInstance || trips.length === 0) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = () => {
      if (!visible || !overlayRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
        return;
      }

      setCurrentTime(Date.now());
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [visible, trips]);

  // Add/remove overlay - use stable refs to prevent re-creation on zoom/pan
  useEffect(() => {
    const currentMapInstance = mapInstanceRef.current;
    if (!currentMapInstance) return;

    if (!visible || trips.length === 0) {
      // Remove overlay if it exists
      if (overlayRef.current) {
        try {
          currentMapInstance.removeControl(overlayRef.current);
          console.log('✅ [InfrastructureFlow] Overlay removed');
        } catch (error) {
          console.warn('⚠️ [InfrastructureFlow] Failed to remove overlay', error);
        }
        overlayRef.current = null;
      }
      overlaySetupRef.current = false;
      return;
    }

    // CRITICAL: If overlay already exists and is in map, do NOT recreate it
    // Updates will be handled by the separate update effect
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
      return;
    }

    // Start setup only if not already done
    if (overlaySetupRef.current && overlayRef.current) {
      return;
    }

    overlaySetupRef.current = true;

    let loadHandlerRef = null;
    let styleLoadHandlerRef = null;
    let isAddingRef = false;
    let timeoutIdRef = null;

    // Wait for map to be ready
    const addOverlay = () => {
      // Final check before proceeding
      if (isAddingRef || (overlayRef.current && overlaySetupRef.current)) {
        return;
      }

      // More robust map readiness check
      const isStyleLoaded = typeof currentMapInstance.isStyleLoaded === 'function' 
        ? currentMapInstance.isStyleLoaded() 
        : false;
      const hasStyle = !!currentMapInstance.getStyle?.();
      const hasLayers = currentMapInstance.getStyle?.()?.layers?.length > 0;
      const isMapReady = isStyleLoaded || (hasStyle && hasLayers);
      
      console.log('🔍 [InfrastructureFlow] Map readiness check:', {
        isStyleLoaded,
        hasStyle,
        hasLayers,
        isMapReady
      });
      
      if (!isMapReady) {
        // Only set up handlers once
        if (!loadHandlerRef && !styleLoadHandlerRef) {
          console.log('⏳ [InfrastructureFlow] Map not loaded yet, waiting for load event...');
          
          timeoutIdRef = setTimeout(() => {
            console.log('⏰ [InfrastructureFlow] Timeout waiting for map, proceeding anyway...');
            if (loadHandlerRef) currentMapInstance.off('load', loadHandlerRef);
            if (styleLoadHandlerRef) currentMapInstance.off('style.load', styleLoadHandlerRef);
            loadHandlerRef = null;
            styleLoadHandlerRef = null;
            timeoutIdRef = null;
            addOverlay();
          }, 2000);
          
          loadHandlerRef = () => {
            if (timeoutIdRef) {
              clearTimeout(timeoutIdRef);
              timeoutIdRef = null;
            }
            if (overlayRef.current || isAddingRef) {
              if (loadHandlerRef) currentMapInstance.off('load', loadHandlerRef);
              if (styleLoadHandlerRef) currentMapInstance.off('style.load', styleLoadHandlerRef);
              loadHandlerRef = null;
              styleLoadHandlerRef = null;
              return;
            }
            console.log('✅ [InfrastructureFlow] Map load event fired');
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
            if (overlayRef.current || isAddingRef) {
              if (loadHandlerRef) currentMapInstance.off('load', loadHandlerRef);
              if (styleLoadHandlerRef) currentMapInstance.off('style.load', styleLoadHandlerRef);
              loadHandlerRef = null;
              styleLoadHandlerRef = null;
              return;
            }
            console.log('✅ [InfrastructureFlow] Map style.load event fired');
            if (loadHandlerRef) currentMapInstance.off('load', loadHandlerRef);
            if (styleLoadHandlerRef) currentMapInstance.off('style.load', styleLoadHandlerRef);
            loadHandlerRef = null;
            styleLoadHandlerRef = null;
            addOverlay();
          };
          
          currentMapInstance.once('load', loadHandlerRef);
          currentMapInstance.once('style.load', styleLoadHandlerRef);
        }
        return;
      }
      
      console.log('✅ [InfrastructureFlow] Map is ready, proceeding with overlay creation');

      // Final check before creating overlay
      if (overlayRef.current || isAddingRef) {
        return;
      }

      // Don't create overlay if trips haven't loaded yet
      if (trips.length === 0) {
        console.log('⏳ [InfrastructureFlow] Waiting for trips to load...');
        isAddingRef = false;
        overlaySetupRef.current = false;
        return;
      }

      isAddingRef = true;

      console.log('🎨 [InfrastructureFlow] Creating and adding MapboxOverlay with TripsLayer...', {
        tripCount: trips.length,
        currentTime
      });

      // Create MapboxOverlay with TripsLayer
      const overlay = new MapboxOverlay({
        interleaved: true,
        layers: [
          new TripsLayer({
            id: LAYER_ID,
            data: trips,
            getPath: d => d.path,
            getTimestamps: d => d.timestamps,
            getColor: d => d.color || [239, 68, 68, 200], // Red to match infrastructure markers
            getWidth: 3,
            widthMinPixels: 2,
            widthMaxPixels: 8,
            trailLength: 600, // 10 seconds at 60fps
            currentTime: currentTime,
            fadeTrail: true,
            capRounded: true,
            jointRounded: true,
            pickable: false,
            visible: true
          })
        ]
      });

      try {
        currentMapInstance.addControl(overlay);
        overlayRef.current = overlay;
        isAddingRef = false;
        console.log('✅ [InfrastructureFlow] MapboxOverlay added successfully');
      } catch (error) {
        overlaySetupRef.current = false;
        isAddingRef = false;
        console.error('❌ [InfrastructureFlow] Failed to add MapboxOverlay', error);
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
      if (!visible && overlayRef.current && currentMapInstance) {
        try {
          currentMapInstance.removeControl(overlayRef.current);
        } catch (error) {
          console.warn('⚠️ [InfrastructureFlow] Failed to remove overlay on cleanup', error);
        }
        overlayRef.current = null;
        overlaySetupRef.current = false;
      }
    };
  }, [visible, notifyCleanup, trips]); // Include trips to recreate overlay when trips load

  // Update overlay when trips or currentTime changes
  useEffect(() => {
    const currentMapInstance = mapInstanceRef.current;
    if (!overlayRef.current || !visible || !currentMapInstance || trips.length === 0) {
      return;
    }

    try {
      overlayRef.current.setProps({
        layers: [
          new TripsLayer({
            id: LAYER_ID,
            data: trips,
            getPath: d => d.path,
            getTimestamps: d => d.timestamps,
            getColor: d => d.color || [239, 68, 68, 200],
            getWidth: 3,
            widthMinPixels: 2,
            widthMaxPixels: 8,
            trailLength: 600,
            currentTime: currentTime,
            fadeTrail: true,
            capRounded: true,
            jointRounded: true,
            pickable: false,
            visible: true
          })
        ]
      });
      currentMapInstance.triggerRepaint?.();
    } catch (error) {
      console.warn('⚠️ [InfrastructureFlow] Failed to update overlay', error);
    }
  }, [trips, currentTime, visible]);

  return null;
};

export default InfrastructureFlowAnimation;

