import React, { useCallback, useEffect, useRef, useState } from 'react';
// MapboxLayer is not exported from main index in v9, but exists in dist
// Using wrapper to access it (Seattle pattern for no-drift animations)
import MapboxLayer from './MapboxLayerWrapper';
import { TripsLayer } from '@deck.gl/geo-layers';

// Archived: Oklahoma infrastructure route files - removed for Columbus migration
// TODO: Add AEP Ohio infrastructure route files when available
// Route files for infrastructure connections (same as red animation)
const INFRASTRUCTURE_ROUTE_FILES = [
  // Archived: Oklahoma routes removed
  // Future: Add AEP Ohio transmission route files here
];

const LAYER_ID = 'infrastructure-siting-path-animation';
const PARTICLES_PER_ROUTE = 15;
const TRIP_DURATION = 10000; // milliseconds per particle trip
const LOOP_DURATION = TRIP_DURATION * PARTICLES_PER_ROUTE; // Total loop length
const BLUE_COLOR = [255, 140, 0, 200]; // bright orange with alpha

// Module-level cache to prevent reloading data on component remount
let cachedTrips = null;
let isLoadingTrips = false;

const resolveMapInstance = (map) => {
  if (!map) return null;
  if (typeof map.getStyle === 'function') return map;
  if (map.current && typeof map.current.getStyle === 'function') return map.current;
  return null;
};

const InfrastructureSitingPathAnimation = React.memo(({ map, onCleanup }) => {
  const mapInstanceRef = useRef(null);
  const mapInstance = resolveMapInstance(map);
  
  // Update ref when map instance changes
  useEffect(() => {
    mapInstanceRef.current = mapInstance;
  }, [mapInstance]);
  
  const overlayRef = useRef(null);
  const animationRef = useRef(null);
  const tripsLayerRef = useRef(null);
  const [trips, setTrips] = useState(null);
  const cleanupNotifiedRef = useRef(false);
  const retryCountRef = useRef(0);
  const overlaySetupRef = useRef(false);
  const tripsLoadedRef = useRef(false); // Track if trips have been loaded

  const notifyCleanup = useCallback((detail = { status: 'stopped' }) => {
    if (cleanupNotifiedRef.current) return;
    cleanupNotifiedRef.current = true;
    if (typeof onCleanup === 'function') {
      try {
        onCleanup(detail);
      } catch (error) {
        console.warn('⚠️ [InfrastructureSiting] onCleanup error', error);
      }
    }
  }, [onCleanup]);

  // Load route data and convert to trips
  useEffect(() => {
    console.log('🔵 [InfrastructureSiting] Load routes effect running', { 
      mapInstance: !!mapInstance, 
      cachedTrips: !!cachedTrips,
      trips: !!trips,
      isLoadingTrips 
    });
    
    if (!mapInstance) {
      console.log('🔵 [InfrastructureSiting] No map instance, skipping');
      return undefined;
    }
    
    // Use cached trips if available
    if (cachedTrips) {
      console.log('🔵 [InfrastructureSiting] Using cached trips');
      setTrips(cachedTrips);
      tripsLoadedRef.current = true;
      return undefined;
    }
    
    // Prevent reloading if trips are already in state
    if (trips) {
      console.log('🔵 [InfrastructureSiting] Trips already in state, caching');
      cachedTrips = trips;
      tripsLoadedRef.current = true;
      return undefined;
    }
    
    // Prevent concurrent loads
    if (isLoadingTrips) {
      console.log('🔵 [InfrastructureSiting] Already loading trips, skipping');
      return undefined;
    }
    
    isLoadingTrips = true;
    let canceled = false;

    const loadRoutes = async () => {
      try {
        console.log('🔄 [InfrastructureSiting] Loading route data...', {
          routeFileCount: INFRASTRUCTURE_ROUTE_FILES.length
        });

        const collections = await Promise.all(
          INFRASTRUCTURE_ROUTE_FILES.map(async (path) => {
            try {
              const res = await fetch(path);
              if (!res.ok) {
                console.warn(`⚠️ [InfrastructureSiting] Failed to load ${path}: ${res.status}`);
                return { features: [] };
              }
              return res.json();
            } catch (err) {
              console.warn(`⚠️ [InfrastructureSiting] Error loading ${path}:`, err);
              return { features: [] };
            }
          })
        );

        if (canceled) return;

        const tripsData = [];
        let tripIndex = 0;

        collections.forEach((collection, fileIndex) => {
          const features = collection.features || [];

          features.forEach((feature) => {
            if (feature.geometry?.type === 'LineString' && feature.geometry.coordinates) {
              const path = feature.geometry.coordinates;

              if (path.length < 2) return;

              // Create multiple particles per route for flow effect
              for (let particleIndex = 0; particleIndex < PARTICLES_PER_ROUTE; particleIndex++) {
                // Stagger start times so particles are spread along the route
                const particleOffset = particleIndex * TRIP_DURATION;

                const timestamps = path.map((_, index) => {
                  const progress = index / (path.length - 1);
                  return particleOffset + (progress * TRIP_DURATION);
                });

                tripsData.push({
                  id: `siting-trip-${fileIndex}-${tripIndex}-particle-${particleIndex}`,
                  path: path,
                  timestamps: timestamps,
                  color: BLUE_COLOR
                });
              }

              tripIndex++;
            } else if (feature.geometry?.type === 'MultiLineString') {
              feature.geometry.coordinates.forEach((line, lineIndex) => {
                if (line.length < 2) return;

                // Create multiple particles per line segment
                for (let particleIndex = 0; particleIndex < PARTICLES_PER_ROUTE; particleIndex++) {
                  const particleOffset = particleIndex * TRIP_DURATION;

                  const timestamps = line.map((_, index) => {
                    const progress = index / (line.length - 1);
                    return particleOffset + (progress * TRIP_DURATION);
                  });

                  tripsData.push({
                    id: `siting-trip-${fileIndex}-${lineIndex}-${tripIndex}-particle-${particleIndex}`,
                    path: line,
                    timestamps: timestamps,
                    color: BLUE_COLOR
                  });
                }

                tripIndex++;
              });
            }
          });
        });

        if (!canceled && tripsData.length > 0) {
          console.log(`✅ [InfrastructureSiting] Loaded ${tripsData.length} trips`, {
            tripCount: tripsData.length,
            particlesPerRoute: PARTICLES_PER_ROUTE,
            sampleTrip: tripsData[0] ? {
              id: tripsData[0].id,
              pathLength: tripsData[0].path.length,
              timestampsLength: tripsData[0].timestamps.length
            } : null
          });
          cachedTrips = tripsData; // Cache for future use
          console.log('🔵 [InfrastructureSiting] Setting trips state, should trigger overlay effect', { tripsCount: tripsData.length });
          setTrips(tripsData);
          tripsLoadedRef.current = true; // Mark as loaded
          isLoadingTrips = false;
        } else if (!canceled) {
          isLoadingTrips = false;
          console.warn('⚠️ [InfrastructureSiting] No trips generated');
          notifyCleanup({
            status: 'failed',
            reason: 'no_trips_generated'
          });
        }
      } catch (error) {
        if (!canceled) {
          console.error('❌ [InfrastructureSiting] Error loading routes:', error);
          isLoadingTrips = false;
          notifyCleanup({
            status: 'failed',
            reason: 'load_error',
            message: error?.message
          });
        }
      }
    };

    loadRoutes();

    return () => {
      canceled = true;
      isLoadingTrips = false;
    };
  }, [mapInstance, notifyCleanup]); // Removed trips from deps to prevent reload

  // Animation loop and layer management
  useEffect(() => {
    const currentMapInstance = mapInstanceRef.current || mapInstance;
    
    console.log('🔵 [InfrastructureSiting] Overlay effect running', { 
      mapInstance: !!currentMapInstance, 
      tripsLength: trips?.length,
      overlaySetup: overlaySetupRef.current 
    });
    
    if (!currentMapInstance || !trips?.length) {
      console.log('🔵 [InfrastructureSiting] Missing mapInstance or trips, cleaning up', {
        hasMapInstance: !!currentMapInstance,
        tripsLength: trips?.length
      });
      // Clean up if trips are cleared
      if (overlayRef.current && currentMapInstance) {
        try {
          if (currentMapInstance.getLayer(LAYER_ID)) {
            currentMapInstance.removeLayer(LAYER_ID);
          }
        } catch (_) {}
        overlayRef.current = null;
        overlaySetupRef.current = false;
      }
      return undefined;
    }

    let removed = false;
    let loadHandlerRef = null;
    let styleLoadHandlerRef = null;
    let timeoutIdRef = null;
    let isAddingRef = false;

    const startAnimation = () => {
      const startTime = performance.now();
      let lastFrameTime = startTime;
      const frameInterval = 16; // ~60fps

      const step = (timestamp) => {
        if (removed || !overlayRef.current || !trips) return;
        if (timestamp - lastFrameTime < frameInterval) {
          animationRef.current = requestAnimationFrame(step);
          return;
        }
        lastFrameTime = timestamp;
        const elapsed = (timestamp - startTime);
        const currentTimeValue = elapsed % LOOP_DURATION; // Keep in milliseconds
        try {
          // Update MapboxLayer's currentTime directly (Seattle pattern)
          // MapboxLayer.setProps() updates the underlying TripsLayer
          overlayRef.current.setProps({ 
            currentTime: currentTimeValue
          });
        } catch (error) {
          console.warn('⚠️ [InfrastructureSiting] Failed to update layer props', error);
          return;
        }
        try {
          currentMapInstance.triggerRepaint?.();
        } catch (_) {}
        animationRef.current = requestAnimationFrame(step);
      };

      animationRef.current = requestAnimationFrame(step);
    };

    const createLayer = () => {
      return new TripsLayer({
        id: LAYER_ID,
        data: trips,
        getPath: (d) => d?.path || [],
        getTimestamps: (d) => d?.timestamps || [],
        getColor: (d) => d?.color || BLUE_COLOR,
        getWidth: 8,
        widthMinPixels: 4,
        widthMaxPixels: 10,
        jointRounded: true,
        capRounded: true,
        trailLength: 6000,
        currentTime: 0,
        loopLength: LOOP_DURATION,
        fadeTrail: true,
        opacity: 0.9
      });
    };

    const addOverlay = () => {
      const currentMapInstance = mapInstanceRef.current || mapInstance;
      if (!currentMapInstance || removed) {
        console.log('🔵 [InfrastructureSiting] addOverlay aborted - no map instance or removed');
        return;
      }

      // Check if layer already exists in map
      if (overlayRef.current) {
        try {
          const existingLayer = currentMapInstance.getLayer(LAYER_ID);
          if (existingLayer) {
            console.log('🔵 [InfrastructureSiting] Layer already exists, updating props');
            // Layer exists, just update props
            overlayRef.current.setProps({
              data: trips,
              currentTime: 0
            });
            return;
          } else {
            console.log('🔵 [InfrastructureSiting] Layer ref exists but not in map, resetting');
            // Layer ref exists but not in map - reset
            overlayRef.current = null;
            overlaySetupRef.current = false;
          }
        } catch (error) {
          console.warn('⚠️ [InfrastructureSiting] Error checking layer', error);
          overlayRef.current = null;
          overlaySetupRef.current = false;
        }
      }

      // Create new overlay
      if (isAddingRef) {
        console.log('🔵 [InfrastructureSiting] Already adding overlay, skipping');
        return; // Prevent concurrent additions
      }
      isAddingRef = true;
      console.log('🔵 [InfrastructureSiting] Creating new overlay');

      const layer = createLayer();
      tripsLayerRef.current = layer;

      // Use MapboxLayer (Seattle pattern) - integrates directly into Mapbox rendering pipeline
      // This eliminates drift by using map.addLayer() instead of map.addControl()
      const mapboxLayer = new MapboxLayer({
        id: LAYER_ID,
        type: TripsLayer,
        data: trips,
        getPath: (d) => d?.path || [],
        getTimestamps: (d) => d?.timestamps || [],
        getColor: (d) => d?.color || BLUE_COLOR,
        getWidth: 8,
        widthMinPixels: 4,
        widthMaxPixels: 10,
        jointRounded: true,
        capRounded: true,
        trailLength: 6000,
        currentTime: 0,
        loopLength: LOOP_DURATION,
        fadeTrail: true,
        opacity: 0.9
      });

      try {
        currentMapInstance.addLayer(mapboxLayer);
        overlayRef.current = mapboxLayer; // Store as overlayRef for consistency
        overlaySetupRef.current = true;
        isAddingRef = false;
        console.log('✅ [InfrastructureSiting] MapboxLayer added (Seattle pattern - no drift)');
        startAnimation();
      } catch (error) {
        isAddingRef = false;
        console.warn('⚠️ [InfrastructureSiting] Failed to add MapboxLayer', error);
        overlaySetupRef.current = false;
        notifyCleanup({
          status: 'failed',
          reason: 'layer_add_failed',
          message: error?.message
        });
      }
    };

    const attemptOverlayAdd = () => {
      const currentMapInstance = mapInstanceRef.current || mapInstance;
      console.log('🔵 [InfrastructureSiting] attemptOverlayAdd called', {
        removed,
        mapInstance: !!currentMapInstance,
        tripsLength: trips?.length
      });
      
      if (removed || !currentMapInstance || !trips?.length) {
        console.log('🔵 [InfrastructureSiting] attemptOverlayAdd aborted - conditions not met');
        return;
      }

      // Try to add overlay directly - MapboxOverlay should handle map readiness
      // Similar to Seattle's approach - just try to add it
      try {
        console.log('🔵 [InfrastructureSiting] Attempting to add overlay directly');
        addOverlay();
      } catch (error) {
        console.warn('🔵 [InfrastructureSiting] Failed to add overlay, will retry on map load', error);
        // If it fails, set up listeners as fallback
        if (!loadHandlerRef) {
          loadHandlerRef = () => {
            if (!overlaySetupRef.current && !removed) {
              console.log('🔵 [InfrastructureSiting] Map loaded, retrying overlay add');
              addOverlay();
            }
          };
          currentMapInstance.on('load', loadHandlerRef);
        }
        if (!styleLoadHandlerRef) {
          styleLoadHandlerRef = () => {
            if (!overlaySetupRef.current && !removed) {
              console.log('🔵 [InfrastructureSiting] Style loaded, retrying overlay add');
              addOverlay();
            }
          };
          currentMapInstance.on('style.load', styleLoadHandlerRef);
        }
        
        // Fallback timeout - just try again
        if (!timeoutIdRef) {
          timeoutIdRef = setTimeout(() => {
            if (!overlaySetupRef.current && !removed) {
              console.log('⏰ [InfrastructureSiting] Timeout fallback - retrying overlay add');
              addOverlay();
            }
          }, 1000);
        }
      }
    };

    attemptOverlayAdd();

    return () => {
      removed = true;
      isAddingRef = false;
      
      const currentMapInstance = mapInstanceRef.current || mapInstance;
      if (loadHandlerRef && currentMapInstance) {
        currentMapInstance.off('load', loadHandlerRef);
      }
      if (styleLoadHandlerRef && currentMapInstance) {
        currentMapInstance.off('style.load', styleLoadHandlerRef);
      }
      if (timeoutIdRef) {
        clearTimeout(timeoutIdRef);
      }
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (overlayRef.current && currentMapInstance) {
        try {
          if (currentMapInstance.getLayer(LAYER_ID)) {
            currentMapInstance.removeLayer(LAYER_ID);
          }
        } catch (error) {
          console.warn('⚠️ [InfrastructureSiting] Failed to remove MapboxLayer', error);
        }
        try {
          if (currentMapInstance.getSource(LAYER_ID)) {
            currentMapInstance.removeSource(LAYER_ID);
          }
        } catch (_) {}
        overlayRef.current = null;
        overlaySetupRef.current = false;
      }
      notifyCleanup({ status: 'stopped' });
    };
  }, [map, trips, notifyCleanup]); // Use map instead of mapInstance to avoid re-renders

  return null;
});

InfrastructureSitingPathAnimation.displayName = 'InfrastructureSitingPathAnimation';

export default InfrastructureSitingPathAnimation;

