# Adding Deck.GL Animations to OKC

This guide explains how to add GPU-accelerated animations using deck.gl to the Oklahoma City (OKC) map application. Deck.gl provides high-performance, WebGL-based visualizations that can handle thousands of animated particles, flows, and complex geometries.

## Table of Contents

1. [Overview](#overview)
2. [When to Use Deck.gl vs Mapbox GL JS](#when-to-use-deckgl-vs-mapbox-gl-js)
3. [Installation](#installation)
4. [Architecture Overview](#architecture-overview)
5. [Step-by-Step: Creating Your First Animation](#step-by-step-creating-your-first-animation)
6. [Integration with OKC Map System](#integration-with-okc-map-system)
7. [Common Animation Patterns](#common-animation-patterns)
8. [Performance Considerations](#performance-considerations)
9. [Troubleshooting](#troubleshooting)
10. [Reference: Seattle Implementation](#reference-seattle-implementation)

---

## Overview

Deck.gl is a WebGL-powered framework for visual exploratory data analysis of large datasets. In the OKC project, it enables:

- **High-performance animations**: Render 10,000+ animated particles smoothly
- **Complex visualizations**: Flow maps, trip animations, heatmaps, and more
- **GPU acceleration**: Leverages WebGL for smooth 60 FPS animations
- **Rich layer types**: TripsLayer, ArcLayer, PathLayer, ScatterplotLayer, and many more

### Current State

The OKC project currently uses **Mapbox GL JS** for route animations (see `OKCCampusesRouteLayer.jsx`), which works well for simple particle animations along routes. Deck.gl should be used when you need:

- More than ~500 animated particles
- Complex flow visualizations
- Advanced styling (gradients, trails, additive blending)
- Better performance with large datasets

---

## When to Use Deck.gl vs Mapbox GL JS

| Use Case | Technology | Example |
|----------|-----------|---------|
| Simple route lines | Mapbox GL JS | `OKCCampusesRouteLayer.jsx` |
| < 500 animated particles | Mapbox GL JS | Current route particles |
| > 500 animated particles | deck.gl | Power flow animations |
| Flow maps (origin → destination) | deck.gl | Energy transmission flows |
| Trip animations with trails | deck.gl | Infrastructure connection flows |
| Heatmaps | deck.gl | Power demand heatmaps |
| Complex gradients/styling | deck.gl | Multi-color flow animations |

**Rule of thumb**: If you need more than 500 particles or complex visual effects, use deck.gl.

---

## Installation

### 1. Install deck.gl packages

```bash
npm install @deck.gl/core @deck.gl/layers @deck.gl/mapbox
```

**Required packages:**
- `@deck.gl/core`: Core deck.gl functionality
- `@deck.gl/layers`: Pre-built layer types (TripsLayer, ArcLayer, etc.)
- `@deck.gl/mapbox`: Integration with Mapbox GL JS

### 2. Verify installation

```bash
npm list @deck.gl/core @deck.gl/layers @deck.gl/mapbox
```

---

## Architecture Overview

### Integration Pattern

Deck.gl integrates with Mapbox GL JS using **MapboxLayer**, which embeds deck.gl layers inside Mapbox's WebGL context. **Important**: In deck.gl v9, `MapboxLayer` is not exported from the main package, so we use a custom `MapboxLayerWrapper` that implements the same interface.

```
┌─────────────────────────────────────┐
│         Mapbox GL JS Map            │
│  ┌───────────────────────────────┐  │
│  │  MapboxLayerWrapper (custom)  │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │   TripsLayer/ArcLayer   │  │  │
│  │  │   (Your Animation)       │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Key Difference**: `MapboxLayer` uses `map.addLayer()` (not `map.addControl()`), which integrates directly into Mapbox's rendering pipeline and eliminates drift during pitch/zoom.

### Component Structure

```
src/components/Map/
├── index.jsx                    # Main map component
├── components/
│   └── YourDeckAnimation.jsx    # Your deck.gl animation component
└── hooks/
    └── useMapInitialization.js   # Map setup
```

### Event System

The OKC project uses `window.mapEventBus` for inter-component communication:

```javascript
// Emit event to start animation
window.mapEventBus.emit('okc:startPowerFlowAnimation');

// Listen for events
window.mapEventBus.on('okc:startPowerFlowAnimation', () => {
  // Start your animation
});
```

---

## Step-by-Step: Creating Your First Animation

### Example: Power Flow Animation Between GRDA Facilities

This example creates an animated flow showing power transmission between GRDA power generation facilities.

### Step 1: Create the Animation Component

Create `src/components/Map/components/OKCPowerFlowAnimation.jsx`:

**Important**: In deck.gl v9, `MapboxLayer` is not exported. Use `MapboxLayerWrapper` instead:

```javascript
import React, { useEffect, useRef, useState } from 'react';
import MapboxLayer from './MapboxLayerWrapper'; // Custom wrapper for v9 compatibility
import { TripsLayer } from '@deck.gl/geo-layers';

const LAYER_ID = 'okc-power-flow-layer';
const LOOP_DURATION = 120; // Animation loop in seconds
const TRAIL_LENGTH = 12; // Trail persistence

export default function OKCPowerFlowAnimation({ map, visible }) {
  const layerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [trips, setTrips] = useState([]);

  // Load and prepare trip data
  useEffect(() => {
    if (!visible) return;

    const loadTrips = async () => {
      try {
        // Load route data between GRDA facilities
        const routeFiles = [
          '/data/okc_campuses/pensacola_dam_to_robert_s._kerr_dam.geojson',
          '/data/okc_campuses/robert_s._kerr_dam_to_salina_pumped_storage_project.geojson',
          '/data/okc_campuses/salina_pumped_storage_project_to_redbud_power_plant.geojson',
        ];

        const routeData = await Promise.all(
          routeFiles.map(async (path) => {
            const res = await fetch(path);
            return res.json();
          })
        );

        // Convert routes to trip format for TripsLayer
        const tripFeatures = routeData.flatMap((collection, idx) => {
          return collection.features.map((feature, featureIdx) => {
            if (feature.geometry.type !== 'LineString') return null;

            const coordinates = feature.geometry.coordinates;
            const timestamps = coordinates.map((_, i) => 
              (i / coordinates.length) * LOOP_DURATION * 1000
            );

            return {
              path: coordinates.map(coord => [coord[0], coord[1]]), // [lng, lat]
              timestamps: timestamps,
              // Additional metadata
              capacity: 100 + Math.random() * 50, // MW
              facility: feature.properties?.name || `Route ${idx}-${featureIdx}`,
            };
          }).filter(Boolean);
        });

        setTrips(tripFeatures);
      } catch (error) {
        console.error('[OKCPowerFlowAnimation] Error loading trips:', error);
      }
    };

    loadTrips();
  }, [visible]);

  // Add/remove deck.gl layer
  useEffect(() => {
    if (!map?.current || !visible || trips.length === 0) return;

    const m = map.current;

    const addLayer = () => {
      if (!m.isStyleLoaded()) {
        m.once('style.load', addLayer);
        return;
      }

      // Remove existing layer if present
      if (layerRef.current) {
        try {
          m.removeLayer(LAYER_ID);
        } catch (e) {
          // Layer might not exist
        }
      }

      // Create deck.gl layer using MapboxLayerWrapper
      // CRITICAL: This uses map.addLayer() which integrates into Mapbox's rendering pipeline
      // This eliminates drift during pitch/zoom (unlike MapboxOverlay with addControl)
      const deckLayer = new MapboxLayer({
        id: LAYER_ID,
        type: TripsLayer,
        data: trips,
        getPath: d => d.path,
        getTimestamps: d => d.timestamps,
        getColor: d => {
          // Color based on capacity (cyan for hydro, orange for gas)
          if (d.facility?.includes('Hydro')) return [6, 182, 212, 200]; // Cyan
          if (d.facility?.includes('Gas')) return [249, 115, 22, 200]; // Orange
          return [59, 130, 246, 200]; // Default blue
        },
        getWidth: d => Math.max(2, d.capacity / 20), // Width based on capacity
        widthMinPixels: 2,
        widthMaxPixels: 8,
        trailLength: TRAIL_LENGTH,
        currentTime: currentTime,
        loopLength: LOOP_DURATION * 1000, // Convert to milliseconds
        fadeTrail: true,
        capRounded: true,
        jointRounded: true,
      });

      // Add to map using addLayer() - this integrates into Mapbox's rendering pipeline
      // This is the key difference from MapboxOverlay (which uses addControl)
      m.addLayer(deckLayer);
      layerRef.current = deckLayer;

      console.log(`✅ [OKCPowerFlowAnimation] Added layer with ${trips.length} trips`);
    };

    addLayer();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (m && layerRef.current) {
        try {
          m.removeLayer(LAYER_ID);
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
      layerRef.current = null;
    };
  }, [map, visible, trips, currentTime]);

  // Animation loop
  useEffect(() => {
    if (!visible || trips.length === 0 || !layerRef.current) return;

    const startTime = performance.now();
    let lastFrameTime = startTime;
    const frameInterval = 16; // ~60fps

    const animate = (timestamp) => {
      if (timestamp - lastFrameTime < frameInterval) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = timestamp;

      // Calculate relative time within loop (0 to LOOP_DURATION)
      const elapsed = (timestamp - startTime);
      const currentTimeValue = elapsed % (LOOP_DURATION * 1000);

      // Update layer props (MapboxLayer.setProps updates the underlying Deck.gl layer)
      if (layerRef.current) {
        try {
          layerRef.current.setProps({ currentTime: currentTimeValue });
          // Trigger repaint to ensure smooth animation
          if (map?.current) {
            map.current.triggerRepaint?.();
          }
        } catch (error) {
          console.warn('[OKCPowerFlowAnimation] Failed to update layer:', error);
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [visible, trips, map]);

  return null;
}
```

### Step 2: Integrate with Map Component

Add to `src/components/Map/index.jsx`:

```javascript
import OKCPowerFlowAnimation from './components/OKCPowerFlowAnimation';

// In the Map component:
const [isPowerFlowVisible, setIsPowerFlowVisible] = useState(false);

// Listen for events
useEffect(() => {
  const handleStart = () => setIsPowerFlowVisible(true);
  const handleStop = () => setIsPowerFlowVisible(false);

  window.mapEventBus.on('okc:startPowerFlowAnimation', handleStart);
  window.mapEventBus.on('okc:stopPowerFlowAnimation', handleStop);

  return () => {
    window.mapEventBus.off('okc:startPowerFlowAnimation', handleStart);
    window.mapEventBus.off('okc:stopPowerFlowAnimation', handleStop);
  };
}, []);

// Render the animation component
{isPowerFlowVisible && (
  <OKCPowerFlowAnimation map={map} visible={isPowerFlowVisible} />
)}
```

### Step 3: Trigger from UI

Add a button or card to trigger the animation:

```javascript
// In AITransmissionNav.jsx or similar component
const handlePowerFlowClick = () => {
  window.mapEventBus.emit('okc:startPowerFlowAnimation');
  
  // Auto-stop after 30 seconds
  setTimeout(() => {
    window.mapEventBus.emit('okc:stopPowerFlowAnimation');
  }, 30000);
};
```

---

## Integration with OKC Map System

### Event Bus Integration

The OKC project uses `window.mapEventBus` for communication. Follow this pattern:

```javascript
// Emit events
window.mapEventBus.emit('okc:startYourAnimation');
window.mapEventBus.emit('okc:stopYourAnimation');

// Listen for events
useEffect(() => {
  const handleStart = () => setVisible(true);
  const handleStop = () => setVisible(false);

  window.mapEventBus.on('okc:startYourAnimation', handleStart);
  window.mapEventBus.on('okc:stopYourAnimation', handleStop);

  return () => {
    window.mapEventBus.off('okc:startYourAnimation', handleStart);
    window.mapEventBus.off('okc:stopYourAnimation', handleStop);
  };
}, []);
```

### Map Initialization

Ensure the map is fully loaded before adding deck.gl layers:

```javascript
const addLayer = () => {
  if (!map.current.isStyleLoaded()) {
    map.current.once('style.load', addLayer);
    return;
  }
  
  // Add your deck.gl layer here
};
```

### State Management

Track animation visibility in the main Map component:

```javascript
const [isAnimationVisible, setIsAnimationVisible] = useState(false);
```

---

## Common Animation Patterns

### 1. TripsLayer (Route Animations)

Animate particles along routes with trails:

```javascript
import { TripsLayer } from '@deck.gl/geo-layers';

const layer = new MapboxLayer({
  id: 'trips-layer',
  type: TripsLayer,
  data: trips, // Array of { path: [[lng, lat], ...], timestamps: [ms, ...] }
  getPath: d => d.path,
  getTimestamps: d => d.timestamps,
  getColor: [255, 0, 0, 200],
  trailLength: 12,
  currentTime: Date.now(),
  fadeTrail: true,
});
```

### 2. ArcLayer (Origin-Destination Flows)

Show flows between points:

```javascript
import { ArcLayer } from '@deck.gl/layers';

const layer = new MapboxLayer({
  id: 'arc-layer',
  type: ArcLayer,
  data: flows, // Array of { source: [lng, lat], target: [lng, lat] }
  getSourcePosition: d => d.source,
  getTargetPosition: d => d.target,
  getSourceColor: [0, 128, 255],
  getTargetColor: [255, 0, 128],
  getWidth: 2,
});
```

### 3. PathLayer (Static Paths with Animation)

Animate along paths with custom styling:

```javascript
import { PathLayer } from '@deck.gl/layers';

const layer = new MapboxLayer({
  id: 'path-layer',
  type: PathLayer,
  data: paths,
  getPath: d => d.coordinates,
  getColor: [255, 0, 0, 200],
  getWidth: 3,
  widthMinPixels: 2,
  widthMaxPixels: 10,
});
```

### 4. ScatterplotLayer (Animated Points)

Animate point positions:

```javascript
import { ScatterplotLayer } from '@deck.gl/layers';

const layer = new MapboxLayer({
  id: 'scatter-layer',
  type: ScatterplotLayer,
  data: points,
  getPosition: d => [d.lng, d.lat],
  getRadius: 100,
  getFillColor: [255, 0, 0, 200],
  radiusMinPixels: 2,
  radiusMaxPixels: 20,
});
```

---

## Performance Considerations

### Optimization Tips

1. **Limit particle count**: Start with 1,000-5,000 particles, increase if performance allows
2. **Use binary data**: For very large datasets, use binary format instead of GeoJSON
3. **Reduce trail length**: Shorter trails = better performance
4. **Limit layer count**: Keep deck.gl layers to a minimum (1-3 layers)
5. **Profile regularly**: Use Chrome DevTools Performance tab to identify bottlenecks

### Performance Targets

- **Target FPS**: 60 FPS on modern hardware
- **Minimum FPS**: 30 FPS on mid-range hardware
- **Particle budget**: 10,000+ particles should maintain 60 FPS

### Monitoring

```javascript
// Add FPS monitoring
let frameCount = 0;
let lastTime = performance.now();

const animate = () => {
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    console.log(`FPS: ${frameCount}`);
    frameCount = 0;
    lastTime = now;
  }
  requestAnimationFrame(animate);
};
```

---

## Troubleshooting

### Common Issues

#### 1. Layer Not Appearing

**Symptoms**: No visual output, no errors in console

**Solutions**:
- Check that `map.isStyleLoaded()` returns `true` before adding layer
- Verify data format matches layer requirements
- Check browser console for WebGL errors
- Ensure layer is added after map initialization

```javascript
// Debug: Log layer state
console.log('Map style loaded:', map.current.isStyleLoaded());
console.log('Layer exists:', map.current.getLayer(LAYER_ID));
console.log('Data:', trips);
```

#### 2. Animation Not Smooth

**Symptoms**: Choppy animation, low FPS

**Solutions**:
- Reduce particle count
- Reduce trail length
- Simplify color/styling calculations
- Check for other heavy operations blocking main thread

#### 3. Layer Disappears on Style Change

**Symptoms**: Layer disappears when basemap changes

**Solutions**:
- Re-add layer on `styledata` event:

```javascript
map.current.on('styledata', () => {
  if (visible && trips.length > 0) {
    addLayer();
  }
});
```

#### 4. Memory Leaks

**Symptoms**: Browser memory usage increases over time

**Solutions**:
- Always cancel `requestAnimationFrame` in cleanup
- Remove layers and sources in `useEffect` cleanup
- Clear data references when component unmounts

```javascript
useEffect(() => {
  // Setup
  return () => {
    // Cleanup
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (map.current && layerRef.current) {
      map.current.removeLayer(LAYER_ID);
    }
  };
}, []);
```

#### 5. Basemap Disappears During Zoom/Pitch

**Symptoms**: Basemap blinks or disappears when zooming/pitching, animation stays visible

**Root Cause**: Deck instance is interfering with Mapbox's rendering cycle

**Solutions**:
- Ensure `MapboxLayerWrapper` uses `clearStack: false` and `clearCanvas: false` in render()
- Don't let Deck instance control canvas size - Mapbox handles that
- Use `map.addLayer()` not `map.addControl()` (MapboxLayer vs MapboxOverlay)

```javascript
// ✅ CORRECT: MapboxLayerWrapper handles this automatically
const layer = new MapboxLayer({
  id: LAYER_ID,
  type: TripsLayer,
  // ... props
});
map.addLayer(layer); // Integrates into Mapbox rendering pipeline

// ❌ WRONG: MapboxOverlay can cause basemap issues
const overlay = new MapboxOverlay({ layers: [...] });
map.addControl(overlay); // Renders as separate control
```

#### 6. Animation Drifts During Pitch/Zoom

**Symptoms**: Animation moves relative to basemap when pitching or zooming

**Root Cause**: Using `MapboxOverlay` with `addControl()` instead of `MapboxLayer` with `addLayer()`

**Solution**: Use `MapboxLayerWrapper` with `map.addLayer()` - this integrates directly into Mapbox's rendering pipeline and eliminates drift.

```javascript
// ✅ CORRECT: No drift
import MapboxLayer from './MapboxLayerWrapper';
const layer = new MapboxLayer({ id: 'my-layer', type: TripsLayer, ... });
map.addLayer(layer);

// ❌ WRONG: Can cause drift
import { MapboxOverlay } from '@deck.gl/mapbox';
const overlay = new MapboxOverlay({ layers: [...] });
map.addControl(overlay);
```

---

## Reference: Seattle Implementation

The Seattle waterfront foot traffic animation (`docs/deck-foot-traffic-readme.md`) provides a complete reference implementation. Key patterns to follow:

### Architecture Decisions

1. **MapboxLayer over MapboxOverlay**: Use `MapboxLayer` (via `MapboxLayerWrapper` in v9) for:
   - **No drift**: Integrates directly into Mapbox's rendering pipeline via `map.addLayer()`
   - **Basemap preservation**: Doesn't interfere with Mapbox's rendering cycle
   - **Better sync**: Shares Mapbox's WebGL context and camera matrices
2. **Style load handling**: Always wait for `map.isStyleLoaded()` before adding layers
3. **Event-driven**: Use `window.mapEventBus` for triggering animations
4. **Cleanup**: Properly remove layers and cancel animation frames
5. **Shared Deck instance**: Multiple layers can share `map.__deck` for efficiency

### Code Structure

```javascript
// 1. Import MapboxLayerWrapper (v9 compatibility)
import MapboxLayer from './MapboxLayerWrapper';

// 2. Load data
const loadTrips = async () => { /* ... */ };

// 3. Create layer
const deckLayer = new MapboxLayer({
  id: LAYER_ID,
  type: TripsLayer,
  data: trips,
  getPath: d => d.path,
  getTimestamps: d => d.timestamps,
  currentTime: 0,
  loopLength: LOOP_DURATION * 1000,
  // ... other configuration
});

// 4. Add to map using addLayer() - CRITICAL for no-drift behavior
map.current.addLayer(deckLayer);

// 5. Animate with relative time (not absolute Date.now())
const animate = (timestamp) => {
  const elapsed = (timestamp - startTime);
  const currentTime = elapsed % (LOOP_DURATION * 1000);
  layerRef.current.setProps({ currentTime });
  map.current.triggerRepaint?.();
  requestAnimationFrame(animate);
};
```

### Key Differences from MapboxOverlay

| Aspect | MapboxLayer (addLayer) | MapboxOverlay (addControl) |
|--------|------------------------|----------------------------|
| **Integration** | Direct into Mapbox pipeline | Separate control layer |
| **Drift** | None - perfect sync | Can drift during pitch/zoom |
| **Basemap** | Preserved | Can interfere |
| **API** | `map.addLayer(layer)` | `map.addControl(overlay)` |
| **v9 Support** | Via `MapboxLayerWrapper` | Native support |

### Data Format

TripsLayer expects data in this format:

```javascript
[
  {
    path: [[lng1, lat1], [lng2, lat2], ...], // Array of [lng, lat] pairs
    timestamps: [0, 1000, 2000, ...], // Array of timestamps in milliseconds
    // Optional metadata
    capacity: 100,
    facility: 'Pensacola Dam',
  }
]
```

---

## Example Use Cases for OKC

### 1. Power Flow Animation

Animate power transmission between GRDA facilities and infrastructure sites:

- **Data**: Route GeoJSON files in `/data/okc_campuses/`
- **Layer**: `TripsLayer`
- **Colors**: Cyan (hydro), Orange (gas), Green (wind)
- **Trigger**: `okc:startPowerFlowAnimation`

### 2. Infrastructure Connection Flows

Show data/energy flows between infrastructure markers:

- **Data**: Routes between red infrastructure markers
- **Layer**: `TripsLayer` or `ArcLayer`
- **Colors**: Red to match infrastructure markers
- **Trigger**: `okc:startInfrastructureFlowAnimation`

### 3. Pipeline Flow Animation

Animate flow along pipeline networks:

- **Data**: Pipeline GeoJSON from `/data/pipelines/`
- **Layer**: `TripsLayer`
- **Colors**: Based on pipeline type
- **Trigger**: `okc:startPipelineFlowAnimation`

### 4. Demand-Supply Heatmap

Visualize power demand and supply across the region:

- **Data**: Grid capacity data from GRDA JSON
- **Layer**: `HeatmapLayer` or `ScatterplotLayer`
- **Colors**: Gradient based on capacity/demand
- **Trigger**: `okc:startDemandSupplyHeatmap`

---

## Quick Start Checklist

- [ ] Install deck.gl packages (`@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox`)
- [ ] **Use `MapboxLayerWrapper`** (not `MapboxLayer` directly - v9 compatibility)
- [ ] Create animation component (e.g., `OKCPowerFlowAnimation.jsx`)
- [ ] Load and format data (convert GeoJSON to trip/flow format)
- [ ] Create `MapboxLayer` (via wrapper) with appropriate layer type
- [ ] **Use `map.addLayer()`** (not `map.addControl()`) to add layer
- [ ] Wait for `map.isStyleLoaded()` before adding layer
- [ ] Set up animation loop with `requestAnimationFrame` using **relative time**
- [ ] Update layer with `layer.setProps({ currentTime })` in animation loop
- [ ] Call `map.triggerRepaint()` after updating layer props
- [ ] Integrate with `window.mapEventBus` for triggering
- [ ] Add cleanup logic (remove layer, cancel animation)
- [ ] Test for drift during pitch/zoom (should be none)
- [ ] Test that basemap doesn't disappear (should stay visible)
- [ ] Test performance and optimize if needed
- [ ] Add UI trigger (button/card) to start animation

---

## Additional Resources

- **deck.gl Documentation**: https://deck.gl/docs/
- **MapboxLayer API**: https://deck.gl/docs/api-reference/mapbox/mapbox-layer
- **TripsLayer API**: https://deck.gl/docs/api-reference/geo-layers/trips-layer
- **Performance Guide**: https://deck.gl/docs/developer-guide/performance
- **Seattle Implementation**: `docs/deck-foot-traffic-readme.md`
- **GRDA Marker Generation**: `docs/GRDA_MARKER_GENERATION_README.md`

---

## Summary

Deck.gl provides powerful GPU-accelerated animations for the OKC map. Key takeaways:

1. **Use deck.gl for complex animations** (>500 particles, flows, advanced styling)
2. **Use MapboxLayerWrapper** (not MapboxOverlay) for integration with Mapbox GL JS
   - **Critical**: Use `map.addLayer()` not `map.addControl()` to eliminate drift
   - **Critical**: Ensures basemap stays visible during zoom/pitch
3. **Follow the event bus pattern** for triggering animations
4. **Always wait for style load** before adding layers
5. **Use relative time** in animation loops (not `Date.now()`)
6. **Update layers with `setProps()`** and call `map.triggerRepaint()`
7. **Clean up properly** to avoid memory leaks
8. **Monitor performance** and optimize as needed

### Critical Implementation Notes

- **MapboxLayerWrapper**: Required for deck.gl v9 (MapboxLayer not exported)
- **addLayer() vs addControl()**: `addLayer()` integrates into Mapbox pipeline, `addControl()` can cause drift
- **clearStack/clearCanvas**: Must be `false` to preserve basemap
- **Relative time**: Use `elapsed % loopLength` not `Date.now()` for smooth looping

For specific implementation details, refer to:
- `src/components/Map/components/MapboxLayerWrapper.js` (v9 compatibility layer)
- `src/components/Map/components/InfrastructureSitingPathAnimation.jsx` (working example)
- The Seattle waterfront animation documentation
- The deck.gl official docs

