import { useCallback, useEffect, useRef, useState } from 'react';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer } from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';

// Archived: Stillwater circle animation - Oklahoma-specific
const STILLWATER_LAYER_ID = 'stillwater-circle-animation';
const INFRASTRUCTURE_FLOW_LAYER_ID = 'infrastructure-flow-animation';
// Archived: STILLWATER_COORDS removed - Oklahoma-specific

// Archived: Oklahoma infrastructure route files - removed for Columbus migration
// TODO: Add AEP Ohio infrastructure route files when available
const INFRASTRUCTURE_ROUTE_FILES = [
  // Archived: Oklahoma routes removed
  // Future: Add AEP Ohio transmission route files here
];

const INFRASTRUCTURE_PARTICLES_PER_ROUTE = 15;
const INFRASTRUCTURE_TRIP_DURATION = 10000; // milliseconds per particle trip
const INFRASTRUCTURE_LOOP_LENGTH = INFRASTRUCTURE_TRIP_DURATION * INFRASTRUCTURE_PARTICLES_PER_ROUTE;

const resolveMapInstance = (map) => {
  if (!map) return null;
  if (typeof map.getStyle === 'function') return map;
  if (map.current && typeof map.current.getStyle === 'function') return map.current;
  return null;
};

/**
 * Unified Deck.gl Overlay Manager
 * Manages all Deck.gl animations in a single MapboxOverlay instance
 * This prevents conflicts when multiple animations are active
 */
const DeckGLOverlayManager = ({ 
  map, 
  stillwaterVisible = false,
  infrastructureFlowVisible = false,
  onCleanup 
}) => {
  const mapInstance = resolveMapInstance(map);
  const overlayRef = useRef(null);
  const stillwaterAnimationRef = useRef(null);
  const infrastructureFlowAnimationRef = useRef(null);
  const [stillwaterRadius, setStillwaterRadius] = useState(0);
  const [infrastructureTrips, setInfrastructureTrips] = useState([]);
  const [infrastructureCurrentTime, setInfrastructureCurrentTime] = useState(0);
  const cleanupNotifiedRef = useRef(false);
  const overlaySetupRef = useRef(false);
  const mapInstanceRef = useRef(null);
  const infrastructureLastFrameTimeRef = useRef(null);

  // Store stable map instance reference
  useEffect(() => {
    mapInstanceRef.current = mapInstance;
  }, [mapInstance]);

  const notifyCleanup = useCallback((detail = { status: 'stopped' }) => {
    if (cleanupNotifiedRef.current) return;
    cleanupNotifiedRef.current = true;
    if (typeof onCleanup === 'function') {
      try {
        onCleanup(detail);
      } catch (error) {
        console.warn('⚠️ [DeckGLOverlayManager] onCleanup error', error);
      }
    }
  }, [onCleanup]);

  // Stillwater circle animation loop
  useEffect(() => {
    const currentMapInstance = mapInstanceRef.current;
    if (!stillwaterVisible || !currentMapInstance) {
      if (stillwaterAnimationRef.current) {
        cancelAnimationFrame(stillwaterAnimationRef.current);
        stillwaterAnimationRef.current = null;
      }
      return;
    }

    let startTime = performance.now();
    const animationDuration = 3000; // 3 seconds for full pulse cycle

    const animate = (timestamp) => {
      if (!stillwaterVisible || !overlayRef.current) {
        cancelAnimationFrame(stillwaterAnimationRef.current);
        stillwaterAnimationRef.current = null;
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
      
      setStillwaterRadius(currentRadius);
      stillwaterAnimationRef.current = requestAnimationFrame(animate);
    };

    stillwaterAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      if (stillwaterAnimationRef.current) {
        cancelAnimationFrame(stillwaterAnimationRef.current);
        stillwaterAnimationRef.current = null;
      }
    };
  }, [stillwaterVisible]);

  // Infrastructure flow animation loop
  useEffect(() => {
    const currentMapInstance = mapInstanceRef.current;
    if (!infrastructureFlowVisible || !currentMapInstance || infrastructureTrips.length === 0) {
      if (infrastructureFlowAnimationRef.current) {
        cancelAnimationFrame(infrastructureFlowAnimationRef.current);
        infrastructureFlowAnimationRef.current = null;
      }
      infrastructureLastFrameTimeRef.current = null;
      setInfrastructureCurrentTime(0);
      return;
    }

    const animate = (timestamp) => {
      if (!infrastructureFlowVisible || !overlayRef.current || infrastructureTrips.length === 0) {
        if (infrastructureFlowAnimationRef.current) {
          cancelAnimationFrame(infrastructureFlowAnimationRef.current);
          infrastructureFlowAnimationRef.current = null;
        }
        infrastructureLastFrameTimeRef.current = null;
        return;
      }

      if (infrastructureLastFrameTimeRef.current == null) {
        infrastructureLastFrameTimeRef.current = timestamp;
      }

      const delta = timestamp - infrastructureLastFrameTimeRef.current;
      infrastructureLastFrameTimeRef.current = timestamp;

      setInfrastructureCurrentTime((prev) => {
        const next = prev + delta;
        return next >= INFRASTRUCTURE_LOOP_LENGTH ? next % INFRASTRUCTURE_LOOP_LENGTH : next;
      });

      infrastructureFlowAnimationRef.current = requestAnimationFrame(animate);
    };

    infrastructureLastFrameTimeRef.current = null;
    infrastructureFlowAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      if (infrastructureFlowAnimationRef.current) {
        cancelAnimationFrame(infrastructureFlowAnimationRef.current);
        infrastructureFlowAnimationRef.current = null;
      }
      infrastructureLastFrameTimeRef.current = null;
    };
  }, [infrastructureFlowVisible, infrastructureTrips]);

  // Load infrastructure route data
  useEffect(() => {
    console.log('🔄 [DeckGLOverlayManager] Infrastructure flow visibility changed:', {
      infrastructureFlowVisible,
      willLoad: infrastructureFlowVisible
    });
    
    if (!infrastructureFlowVisible) {
      console.log('⏸️ [DeckGLOverlayManager] Infrastructure flow not visible, clearing trips');
      setInfrastructureTrips([]);
      setInfrastructureCurrentTime(0);
      infrastructureLastFrameTimeRef.current = null;
      return;
    }

    const loadRoutes = async () => {
      try {
        console.log('🔄 [DeckGLOverlayManager] Loading infrastructure route data...', {
          routeFileCount: INFRASTRUCTURE_ROUTE_FILES.length,
          files: INFRASTRUCTURE_ROUTE_FILES
        });
        
        const collections = await Promise.all(
          INFRASTRUCTURE_ROUTE_FILES.map(async (path) => {
            try {
              const res = await fetch(path);
              if (!res.ok) {
                console.warn(`⚠️ [DeckGLOverlayManager] Failed to load ${path}: ${res.status}`);
                return { features: [] };
              }
              return res.json();
            } catch (err) {
              console.warn(`⚠️ [DeckGLOverlayManager] Error loading ${path}:`, err);
              return { features: [] };
            }
          })
        );

        const tripsData = [];
        let tripIndex = 0;

        collections.forEach((collection, fileIndex) => {
          const features = collection.features || [];
          
          features.forEach((feature) => {
            if (feature.geometry?.type === 'LineString' && feature.geometry.coordinates) {
              const path = feature.geometry.coordinates;
              
              if (path.length < 2) return;
              
              // Create multiple particles per route for flow effect
              for (let particleIndex = 0; particleIndex < INFRASTRUCTURE_PARTICLES_PER_ROUTE; particleIndex++) {
                // Stagger start times so particles are spread along the route
                const particleOffset = particleIndex * INFRASTRUCTURE_TRIP_DURATION;

                const timestamps = path.map((_, index) => {
                  const progress = index / (path.length - 1);
                  return particleOffset + (progress * INFRASTRUCTURE_TRIP_DURATION);
                });

                tripsData.push({
                  id: `trip-${fileIndex}-${tripIndex}-particle-${particleIndex}`,
                  path: path,
                  timestamps: timestamps,
                  color: [239, 68, 68, 200] // Red color
                });
              }

              tripIndex++;
            } else if (feature.geometry?.type === 'MultiLineString') {
              feature.geometry.coordinates.forEach((line, lineIndex) => {
                if (line.length < 2) return;
                
                // Create multiple particles per line segment
                for (let particleIndex = 0; particleIndex < INFRASTRUCTURE_PARTICLES_PER_ROUTE; particleIndex++) {
                  const particleOffset = particleIndex * INFRASTRUCTURE_TRIP_DURATION;

                  const timestamps = line.map((_, index) => {
                    const progress = index / (line.length - 1);
                    return particleOffset + (progress * INFRASTRUCTURE_TRIP_DURATION);
                  });

                  tripsData.push({
                    id: `trip-${fileIndex}-${lineIndex}-${tripIndex}-particle-${particleIndex}`,
                    path: line,
                    timestamps: timestamps,
                    color: [239, 68, 68, 200]
                  });
                }

                tripIndex++;
              });
            }
          });
        });

        console.log(`✅ [DeckGLOverlayManager] Loaded ${tripsData.length} infrastructure trips`, {
          tripCount: tripsData.length,
          particlesPerRoute: INFRASTRUCTURE_PARTICLES_PER_ROUTE,
          expectedTrips: collections.reduce((sum, c) => sum + (c.features?.length || 0), 0) * INFRASTRUCTURE_PARTICLES_PER_ROUTE,
          sampleTrip: tripsData[0] ? {
            id: tripsData[0].id,
            pathLength: tripsData[0].path.length,
            timestampsLength: tripsData[0].timestamps.length
          } : null
        });
        setInfrastructureTrips(tripsData);
        setInfrastructureCurrentTime(0);
        infrastructureLastFrameTimeRef.current = null;
      } catch (error) {
        console.error('❌ [DeckGLOverlayManager] Error loading routes:', error);
        setInfrastructureTrips([]);
      }
    };

    loadRoutes();
  }, [infrastructureFlowVisible]);

  // Build layers array based on what's visible
  const buildLayers = useCallback(() => {
    const layers = [];

    // Archived: Stillwater circle layer - Oklahoma-specific
    // TODO: Add Columbus/AEP Ohio circle layers if needed
    if (false && stillwaterVisible) { // Disabled - Oklahoma-specific
      const currentRadius = stillwaterRadius || 1000;
      layers.push(
        new ScatterplotLayer({
          id: STILLWATER_LAYER_ID,
          data: [{
            position: [-97.0584, 36.1156], // Archived: STILLWATER_COORDS
            radius: currentRadius
          }],
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
        })
      );
    }

    // Infrastructure flow layer - animated flow with multiple particles
    if (infrastructureFlowVisible && infrastructureTrips.length > 0) {
      layers.push(
        new TripsLayer({
          id: INFRASTRUCTURE_FLOW_LAYER_ID,
          data: infrastructureTrips,
          getPath: d => d.path,
          getTimestamps: d => d.timestamps,
          getColor: d => d.color || [239, 68, 68, 200],
          getWidth: 8, // Slightly wider for better visibility
          widthMinPixels: 4,
          widthMaxPixels: 10,
          trailLength: 6000, // 4 seconds of trail for visible flow (in ms)
          currentTime: infrastructureCurrentTime,
          loopLength: INFRASTRUCTURE_LOOP_LENGTH,
          fadeTrail: true, // Fading trails create flow effect
          capRounded: true,
          jointRounded: true,
          pickable: false,
          visible: true
        })
      );
    } else if (infrastructureFlowVisible && infrastructureTrips.length === 0) {
      console.log('⏳ [DeckGLOverlayManager] Infrastructure flow visible but trips not loaded yet:', {
        infrastructureFlowVisible,
        tripCount: infrastructureTrips.length
      });
    }

    return layers;
  }, [stillwaterVisible, stillwaterRadius, infrastructureFlowVisible, infrastructureTrips, infrastructureCurrentTime]);

  // Add/remove overlay - single instance for all animations
  useEffect(() => {
    const currentMapInstance = mapInstanceRef.current;
    if (!currentMapInstance) return;

    const hasAnyVisible = stillwaterVisible || infrastructureFlowVisible;

    if (!hasAnyVisible) {
      // Remove overlay if it exists
      if (overlayRef.current) {
        try {
          currentMapInstance.removeControl(overlayRef.current);
          console.log('✅ [DeckGLOverlayManager] Overlay removed');
        } catch (error) {
          console.warn('⚠️ [DeckGLOverlayManager] Failed to remove overlay', error);
        }
        overlayRef.current = null;
      }
      overlaySetupRef.current = false;
      return;
    }

    // CRITICAL: If overlay already exists and is in map, verify it's still valid
    if (overlayRef.current && overlaySetupRef.current) {
      try {
        const controls = currentMapInstance._controls || [];
        const overlayExists = controls.some(control => control === overlayRef.current);
        if (overlayExists) {
          // Overlay exists and is in map - verify it's still functional
          try {
            // Try to get layers to verify overlay is still working
            const currentLayers = overlayRef.current.props?.layers || [];
            // Overlay is valid - update will be handled by the separate update effect
            return;
          } catch (verifyError) {
            // Overlay exists but might be broken - remove and recreate
            console.warn('⚠️ [DeckGLOverlayManager] Overlay exists but appears broken, removing...');
            try {
              currentMapInstance.removeControl(overlayRef.current);
            } catch (removeError) {
              // Ignore removal errors
            }
            overlayRef.current = null;
            overlaySetupRef.current = false;
          }
        } else {
          // Overlay ref exists but not in map - reset
          overlayRef.current = null;
          overlaySetupRef.current = false;
        }
      } catch (error) {
        // Error checking overlay - reset and recreate
        console.warn('⚠️ [DeckGLOverlayManager] Error checking overlay, resetting:', error);
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

    const addOverlay = () => {
      // Double-check visibility hasn't changed
      const stillVisible = stillwaterVisible || infrastructureFlowVisible;
      if (!stillVisible) {
        console.log('⏸️ [DeckGLOverlayManager] Animation no longer visible, aborting overlay creation');
        overlaySetupRef.current = false;
        isAddingRef = false;
        return;
      }
      
      if (isAddingRef || (overlayRef.current && overlaySetupRef.current)) {
        // Verify overlay is actually in map before skipping
        if (overlayRef.current) {
          try {
            const controls = currentMapInstance._controls || [];
            const overlayExists = controls.some(control => control === overlayRef.current);
            if (overlayExists) {
              return; // Overlay is valid, skip
            } else {
              // Overlay ref exists but not in map - reset and continue
              overlayRef.current = null;
              overlaySetupRef.current = false;
            }
          } catch (error) {
            // Error checking - reset and continue
            overlayRef.current = null;
            overlaySetupRef.current = false;
          }
        } else {
          return; // Setup in progress, wait
        }
      }

      // More robust map readiness check
      const isStyleLoaded = typeof currentMapInstance.isStyleLoaded === 'function' 
        ? currentMapInstance.isStyleLoaded() 
        : false;
      const hasStyle = !!currentMapInstance.getStyle?.();
      const hasLayers = currentMapInstance.getStyle?.()?.layers?.length > 0;
      const isMapReady = isStyleLoaded || (hasStyle && hasLayers);
      
      if (!isMapReady) {
        if (!loadHandlerRef && !styleLoadHandlerRef) {
          console.log('⏳ [DeckGLOverlayManager] Map not loaded yet, waiting for load event...');
          
          timeoutIdRef = setTimeout(() => {
            console.log('⏰ [DeckGLOverlayManager] Timeout waiting for map, proceeding anyway...');
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
            console.log('✅ [DeckGLOverlayManager] Map load event fired');
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
            console.log('✅ [DeckGLOverlayManager] Map style.load event fired');
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
      
      console.log('✅ [DeckGLOverlayManager] Map is ready, proceeding with overlay creation');

      if (overlayRef.current || isAddingRef) {
        return;
      }

      isAddingRef = true;

      // Build initial layers
      const layers = buildLayers();

      // Create overlay even if no layers yet - layers will be added when data loads
      // This ensures the overlay exists when infrastructure flow trips are still loading
      if (layers.length === 0) {
        console.log('⏳ [DeckGLOverlayManager] No layers to render yet, but creating overlay anyway (data may be loading)');
        // Still create overlay with empty layers - it will be updated when data loads
      }

      // Final check before adding - make sure animation is still visible
      const finalCheckVisible = stillwaterVisible || infrastructureFlowVisible;
      if (!finalCheckVisible) {
        console.log('⏸️ [DeckGLOverlayManager] Animation no longer visible before adding overlay, aborting');
        overlaySetupRef.current = false;
        isAddingRef = false;
        return;
      }

      console.log('🎨 [DeckGLOverlayManager] Creating unified MapboxOverlay with', layers.length, 'layers');

      // Create single MapboxOverlay with all layers
      // Using interleaved: true so deck.gl shares Mapbox's WebGL context and camera
      const overlay = new MapboxOverlay({
        interleaved: true,
        layers: layers
      });

      try {
        currentMapInstance.addControl(overlay);
        overlayRef.current = overlay;
        isAddingRef = false;
        console.log('✅ [DeckGLOverlayManager] Unified MapboxOverlay added successfully');

        // Immediately align the overlay camera with the current map camera
        try {
          const center = currentMapInstance.getCenter();
          overlay.setProps({
            viewState: {
              longitude: center.lng,
              latitude: center.lat,
              zoom: currentMapInstance.getZoom(),
              pitch: currentMapInstance.getPitch(),
              bearing: currentMapInstance.getBearing()
            }
          });
        } catch (syncError) {
          console.warn('⚠️ [DeckGLOverlayManager] Initial view state sync failed', syncError);
        }
      } catch (error) {
        overlaySetupRef.current = false;
        isAddingRef = false;
        console.error('❌ [DeckGLOverlayManager] Failed to add MapboxOverlay', error);
        // Reset refs on error so we can retry
        overlayRef.current = null;
        notifyCleanup({
          status: 'failed',
          reason: 'overlay_add_failed',
          message: error?.message
        });
      }
    };

    addOverlay();

    return () => {
      if (timeoutIdRef) {
        clearTimeout(timeoutIdRef);
        timeoutIdRef = null;
      }
      
      if (loadHandlerRef && currentMapInstance) {
        currentMapInstance.off('load', loadHandlerRef);
        loadHandlerRef = null;
      }
      if (styleLoadHandlerRef && currentMapInstance) {
        currentMapInstance.off('style.load', styleLoadHandlerRef);
        styleLoadHandlerRef = null;
      }
      
      if (!hasAnyVisible && overlayRef.current && currentMapInstance) {
        try {
          currentMapInstance.removeControl(overlayRef.current);
        } catch (error) {
          console.warn('⚠️ [DeckGLOverlayManager] Failed to remove overlay on cleanup', error);
        }
        overlayRef.current = null;
        overlaySetupRef.current = false;
      }
    };
  }, [stillwaterVisible, infrastructureFlowVisible, notifyCleanup]); // Removed buildLayers from deps

  // Update overlay when layers change
  useEffect(() => {
    const currentMapInstance = mapInstanceRef.current;
    if (!overlayRef.current || !currentMapInstance) {
      return;
    }

    const layers = buildLayers();
    
    // Always update overlay, even with empty layers if animations are visible
    // This ensures the overlay is ready when data loads
    try {
      overlayRef.current.setProps({ layers });
      currentMapInstance.triggerRepaint?.();
    } catch (error) {
      console.warn('⚠️ [DeckGLOverlayManager] Failed to update overlay', error);
    }
  }, [stillwaterVisible, stillwaterRadius, infrastructureFlowVisible, infrastructureTrips, infrastructureCurrentTime, buildLayers]);

  // Helper to push the current map camera into deck.gl immediately
  const syncViewStateNow = useCallback(() => {
    const mapRef = mapInstanceRef.current;
    const overlay = overlayRef.current;
    if (!mapRef || !overlay) {
      return;
    }

    try {
      const center = mapRef.getCenter();
      const viewState = {
        longitude: center.lng,
        latitude: center.lat,
        zoom: mapRef.getZoom(),
        pitch: mapRef.getPitch(),
        bearing: mapRef.getBearing()
      };
      // In interleaved mode deck.gl reads the camera directly from Mapbox; no need to call setProps.
    } catch (error) {
      console.warn('⚠️ [DeckGLOverlayManager] Immediate view state sync failed', error);
    }
  }, [infrastructureFlowVisible, stillwaterVisible]);

  // Listen to map camera changes (pitch, rotation, zoom) to ensure overlay stays synced
  // In overlaid mode we must push the latest view state into deck.gl manually
  useEffect(() => {
    const currentMapInstance = mapInstanceRef.current;
    if (!currentMapInstance) return;

    let rafId = null;
    let needsUpdate = false;

    const syncOverlayViewState = () => {
      if (needsUpdate) {
        return;
      }
      needsUpdate = true;
      rafId = requestAnimationFrame(() => {
        needsUpdate = false;
        syncViewStateNow();
      });
    };

    // Use render event so we update every frame during easeTo / flyTo animations
    currentMapInstance.on('render', syncOverlayViewState);
    currentMapInstance.on('movestart', syncViewStateNow);
    currentMapInstance.on('pitchstart', syncViewStateNow);
    currentMapInstance.on('rotatestart', syncViewStateNow);
    currentMapInstance.on('zoomstart', syncViewStateNow);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      currentMapInstance.off('render', syncOverlayViewState);
      currentMapInstance.off('movestart', syncViewStateNow);
      currentMapInstance.off('pitchstart', syncViewStateNow);
      currentMapInstance.off('rotatestart', syncViewStateNow);
      currentMapInstance.off('zoomstart', syncViewStateNow);
    };
  }, [mapInstance, syncViewStateNow]);

  return null;
};

export default DeckGLOverlayManager;

