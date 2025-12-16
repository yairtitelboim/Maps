# Understanding Deck.gl in the Stillwater Animation

This document explains how Deck.gl works in our Stillwater circle animation, how it differs from regular Mapbox rendering, and what adjustments we made to get it working.

---

## 🎯 What is Deck.gl Doing Here?

### The Core Concept

Deck.gl is a **WebGL-powered visualization framework** that renders graphics directly on the GPU. In our animation, it's creating a pulsing circle that:

1. **Renders in WebGL** (not Canvas 2D or DOM)
2. **Stays fixed to geographic coordinates** (doesn't drift when zooming)
3. **Updates smoothly** (60 FPS animation via `requestAnimationFrame`)
4. **Integrates seamlessly** with Mapbox GL JS

### What Deck.gl is Rendering

```javascript
new ScatterplotLayer({
  data: [{ position: [-97.0584, 36.1156], radius: 1000 }],  // Stillwater coords, 1000m radius
  getPosition: d => d.position,                            // Extract [lng, lat]
  getRadius: d => d.radius,                                // Extract radius in meters
  getFillColor: [76, 175, 80, 120],                        // Green with transparency
  radiusScale: 1                                           // 1 = meters (geographic scale)
})
```

This creates a **circle** at Stillwater's coordinates that:
- Has a **geographic radius** (500m to 2000m, pulsing)
- Renders in **WebGL** (GPU-accelerated)
- Stays **fixed to the map** (moves with zoom/pan)

---

## 🔄 How Deck.gl Differs from Regular Mapbox Rendering

### Regular Mapbox GL JS (What We Use Elsewhere)

**Example: Teardrop Markers**
```javascript
// Regular Mapbox marker - DOM-based
const marker = new mapboxgl.Marker({
  color: '#ef4444',
  scale: 1.2
})
.setLngLat([lng, lat])
.addTo(map);
```

**How it works:**
- Creates a **DOM element** (HTML div)
- Mapbox positions it using CSS transforms
- **Fixed screen size** (doesn't scale with zoom)
- Rendered by the **browser's DOM engine**
- Limited to simple shapes (teardrop, circle, custom HTML)

**Example: Mapbox Layers**
```javascript
// Regular Mapbox layer - Canvas-based
map.addLayer({
  id: 'route-line',
  type: 'line',
  source: 'route-source',
  paint: {
    'line-color': '#ef4444',
    'line-width': 3
  }
});
```

**How it works:**
- Uses Mapbox's **internal canvas rendering**
- Styled using **Mapbox's paint properties**
- Limited to Mapbox's layer types (circle, line, fill, symbol, etc.)
- **No custom shaders** or GPU programming
- Good for static or simple animated features

### Deck.gl (What We Use for the Animation)

**Our Implementation (Updated for No-Drift):**
```javascript
// Deck.gl layer - WebGL-based, integrated into Mapbox pipeline
import MapboxLayer from './MapboxLayerWrapper'; // v9 compatibility

const layer = new MapboxLayer({
  id: 'stillwater-circle',
  type: ScatterplotLayer,
  data: circleData,
  getPosition: d => d.position,  // [lng, lat]
  getRadius: d => d.radius,       // Geographic radius in meters!
  radiusScale: 1,
  getFillColor: [76, 175, 80, 120]
});
map.addLayer(layer); // CRITICAL: addLayer() not addControl()
```

**How it works:**
- Creates a **custom Mapbox layer** that implements `CustomLayerInterface`
- Renders **directly into Mapbox's WebGL context** via `render()` method
- Uses **custom shaders** (GPU programs) for rendering
- Can handle **geographic scales** (meters, not pixels)
- **GPU-accelerated** (renders on graphics card)
- Supports **complex animations** and effects
- **No drift**: Integrates into Mapbox's rendering pipeline (not overlaid)

---

## 🔗 How Deck.gl Interacts with Mapbox

### The Integration: MapboxLayer (Custom Layer)

Deck.gl integrates with Mapbox through `MapboxLayer`, which implements Mapbox's `CustomLayerInterface` and integrates **directly into Mapbox's rendering pipeline**:

```
┌─────────────────────────────────────────────┐
│         Mapbox GL JS Map                    │
│  (WebGL Context - shared with Deck.gl)      │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  MapboxLayer (Custom Layer)          │ │
│  │  - Implements CustomLayerInterface    │ │
│  │  - render() called by Mapbox          │ │
│  │  ┌─────────────────────────────────┐ │ │
│  │  │  ScatterplotLayer (Deck.gl)     │ │ │
│  │  │  - Renders circle in WebGL      │ │ │
│  │  │  - Uses Mapbox's camera/viewport │ │ │
│  │  │  - Perfect sync (no drift)      │ │ │
│  │  └─────────────────────────────────┘ │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Regular Mapbox Layers (same pipeline)     │
│  - Roads, buildings, labels, etc.          │
└─────────────────────────────────────────────┘
```

### Key Integration Points

1. **`map.addLayer()` (Not `addControl()`)**
   ```javascript
   const layer = new MapboxLayer({ id: 'my-layer', type: ScatterplotLayer, ... });
   map.addLayer(layer);  // Integrates into Mapbox's rendering pipeline
   ```
   - Adds as a **custom Mapbox layer** (not a control)
   - Mapbox calls `layer.onAdd(map, gl)` and `layer.render(gl, matrix)`
   - Renders **within Mapbox's render cycle** (not overlaid)

2. **CustomLayerInterface**
   ```javascript
   class MapboxLayer {
     onAdd(map, gl) { /* Setup Deck instance */ }
     render(gl, matrix) { /* Render Deck.gl layers */ }
     onRemove() { /* Cleanup */ }
   }
   ```
   - Implements Mapbox's `CustomLayerInterface`
   - `render()` is called by Mapbox during its render cycle
   - Uses Mapbox's WebGL context and camera matrices directly

3. **Shared Deck Instance**
   ```javascript
   // Multiple layers can share the same Deck instance
   if (map.__deck) {
     // Reuse existing Deck instance
   } else {
     // Create new Deck instance and store on map
     map.__deck = new Deck({ gl, ... });
   }
   ```
   - Deck instance stored on `map.__deck` for reuse
   - Multiple `MapboxLayer` instances share the same Deck
   - Efficient resource usage

4. **Camera Synchronization**
   - Mapbox passes camera matrices to `render(gl, matrix)`
   - Deck.gl reads Mapbox's **camera state** directly from the map
   - **No manual sync needed** - perfect alignment guaranteed
   - **No drift** during pitch/zoom/rotate

---

## 🛠️ Adjustments We Made to Get It Working

### Problem 1: Overlay Recreating on Zoom/Pan

**Issue:** The overlay was being recreated every time the map zoomed or panned, causing the animation to "jump" or disappear.

**Root Cause:** React effects were re-running because `mapInstance` was changing on every render.

**Solution:**
```javascript
// ❌ BEFORE: mapInstance in dependencies
useEffect(() => {
  // ... overlay setup
}, [mapInstance, visible]);  // Re-runs when mapInstance changes

// ✅ AFTER: Use stable ref
const mapInstanceRef = useRef(null);

useEffect(() => {
  mapInstanceRef.current = mapInstance;  // Store stable reference
}, [mapInstance]);

useEffect(() => {
  const currentMapInstance = mapInstanceRef.current;  // Use ref
  // ... overlay setup
}, [visible]);  // Only re-run when visibility changes
```

**Why it works:** Refs don't trigger re-renders, so the effect only runs when `visible` changes, not on every zoom/pan.

---

### Problem 2: Map Not Detected as "Ready"

**Issue:** The animation waited forever for map load events that never fired because the map was already loaded.

**Root Cause:** We were checking `map.loaded()` which might not exist or return false even when the map is ready.

**Solution:**
```javascript
// ❌ BEFORE: Simple check
const isLoaded = mapInstance.loaded?.() || mapInstance.isStyleLoaded?.();

// ✅ AFTER: Robust check (like other components)
const isStyleLoaded = typeof currentMapInstance.isStyleLoaded === 'function' 
  ? currentMapInstance.isStyleLoaded() 
  : false;
const hasStyle = !!currentMapInstance.getStyle?.();
const hasLayers = currentMapInstance.getStyle?.()?.layers?.length > 0;
const isMapReady = isStyleLoaded || (hasStyle && hasLayers);
```

**Why it works:** Checks multiple indicators of map readiness, similar to how other components in the codebase do it.

---

### Problem 3: Animation Drifting During Zoom/Pitch

**Issue:** The circle would "travel" across the map when zooming or pitching, instead of staying fixed at Stillwater.

**Root Cause:** Using `MapboxOverlay` with `map.addControl()` creates a separate rendering layer that can drift. The camera synchronization isn't perfect, especially during pitch operations.

**Solution:**
```javascript
// ❌ BEFORE: MapboxOverlay (can drift)
const overlay = new MapboxOverlay({
  interleaved: true,
  layers: [new ScatterplotLayer({ ... })]
});
map.addControl(overlay); // Separate control layer

// ✅ AFTER: MapboxLayer (no drift)
import MapboxLayer from './MapboxLayerWrapper';
const layer = new MapboxLayer({
  id: 'stillwater-circle',
  type: ScatterplotLayer,
  data: circleData,
  getPosition: d => d.position,  // [lng, lat] format
  radiusScale: 1,                 // 1 = meters (geographic)
});
map.addLayer(layer); // Integrates into Mapbox pipeline
```

**Why it works:** `MapboxLayer` with `map.addLayer()` integrates directly into Mapbox's rendering pipeline. The `render()` method receives Mapbox's camera matrices directly, ensuring perfect synchronization with no drift.

---

### Problem 4: Animation Disappearing Too Quickly

**Issue:** The animation would mount but then disappear immediately when the workflow ended.

**Root Cause:** The workflow ended quickly, and nested timeouts weren't reliable.

**Solution:**
```javascript
// ❌ BEFORE: Nested timeouts tied to workflow end
setTimeout(() => {
  setPlayingWorkflow(null);
  if (workflowIndex === 2) {
    setTimeout(() => {
      setShowStillwaterAnimation(false);
    }, 10000);
  }
}, settings.finalDelay);

// ✅ AFTER: Single timeout from animation start
if (workflowIndex === 2) {
  setShowStillwaterAnimation(true);
  stillwaterAnimationTimeoutRef.current = setTimeout(() => {
    setShowStillwaterAnimation(false);
  }, 15000);  // 15 seconds from when shown
}
```

**Why it works:** Animation visibility is independent of workflow state, ensuring it stays visible for the full duration.

---

### Problem 5: Basemap Disappearing During Zoom

**Issue:** The basemap would blink or disappear when zooming/pitching, while the animation stayed visible.

**Root Cause:** The Deck instance was interfering with Mapbox's rendering cycle, possibly clearing the canvas or depth buffer.

**Solution:**
```javascript
// ✅ MapboxLayerWrapper ensures proper rendering settings
render(gl, matrix) {
  // ...
  this.deck._drawLayers('mapbox-repaint', {
    viewports: [viewport],
    layerFilter: (params) => params.layer.id === this.id,
    clearStack: false,  // CRITICAL: Don't clear depth/stencil stack
    clearCanvas: false  // CRITICAL: Don't clear canvas (preserves basemap)
  });
}
```

**Why it works:** `clearStack: false` and `clearCanvas: false` ensure Deck.gl doesn't interfere with Mapbox's rendering. The basemap continues to render normally.

### Problem 6: Preventing Duplicate Layers

**Issue:** Multiple layers could be created if the effect ran multiple times.

**Solution:**
```javascript
// ✅ Check if layer already exists before creating
if (layerRef.current) {
  const existingLayer = map.current.getLayer(LAYER_ID);
  if (existingLayer) {
    // Update existing layer instead of creating new one
    layerRef.current.setProps({ ... });
    return;
  }
}
```

**Why it works:** Verifies the layer is actually in the map before creating a new one, and updates existing layers instead of duplicating.

---

## 📊 Comparison Table

| Aspect | Regular Mapbox | Deck.gl (MapboxOverlay) | Deck.gl (MapboxLayer) |
|--------|---------------|------------------------|----------------------|
| **Rendering** | Canvas 2D / DOM | WebGL (GPU) | WebGL (GPU) |
| **Performance** | Good for < 1000 features | Excellent for 10,000+ features | Excellent for 10,000+ features |
| **Geographic Scale** | Pixel-based (scales with zoom) | Meter-based (fixed geographic size) | Meter-based (fixed geographic size) |
| **Animation** | Limited (CSS transforms) | Full GPU animation (60 FPS) | Full GPU animation (60 FPS) |
| **Customization** | Mapbox paint properties | Custom shaders, complex effects | Custom shaders, complex effects |
| **Integration** | Native Mapbox API | `map.addControl()` (overlay) | `map.addLayer()` (integrated) |
| **Drift** | None | Can drift during pitch/zoom | None (perfect sync) |
| **Basemap** | Native | Can interfere | Preserved |
| **Use Case** | Static/simple features | Complex animations (with drift risk) | Complex animations (no drift) |

---

## 🎬 How the Animation Works

### The Animation Loop

```javascript
// 1. Animation loop updates radius state
const animate = (timestamp) => {
  const progress = (elapsed % 3000) / 3000;  // 3 second cycle
  const pulse = Math.sin(progress * Math.PI * 2);
  const radius = 500 + (pulse * 1500);  // 500m to 2000m
  setRadius(radius);  // Triggers React re-render
  requestAnimationFrame(animate);
};
```

### The Update Cycle

```javascript
// 2. React effect watches radius changes
useEffect(() => {
  if (!overlayRef.current) return;
  
  // 3. Update Deck.gl layer with new radius
  overlayRef.current.setProps({
    layers: [
      new ScatterplotLayer({
        data: [{ position: STILLWATER_COORDS, radius: currentRadius }],
        // ... other props
      })
    ]
  });
  
  // 4. Trigger Mapbox repaint
  mapInstance.triggerRepaint?.();
}, [radius]);
```

### The Rendering Pipeline

1. **React** updates `radius` state (60 times per second)
2. **Effect** detects change and calls `overlay.setProps()`
3. **Deck.gl** updates the ScatterplotLayer data
4. **Mapbox** triggers a repaint
5. **WebGL** renders the circle with new radius
6. **Result**: Smooth pulsing animation

---

## 🔑 Key Takeaways

1. **Deck.gl renders in WebGL**, not Canvas or DOM
2. **MapboxLayer (via MapboxLayerWrapper) integrates** Deck.gl directly into Mapbox's rendering pipeline
3. **Use `map.addLayer()` not `map.addControl()`** to eliminate drift
4. **Geographic coordinates** stay fixed during zoom/pan/pitch (no drift)
5. **GPU acceleration** enables smooth 60 FPS animations
6. **Basemap preserved** by using `clearStack: false` and `clearCanvas: false`
7. **Stable refs** prevent unnecessary re-creation
8. **Robust map readiness checks** ensure proper mounting
9. **Shared Deck instance** (`map.__deck`) for efficiency across multiple layers
10. **Relative time** in animation loops (not `Date.now()`) for smooth looping

---

## 📚 Further Reading

- [Deck.gl Mapbox Integration](https://deck.gl/docs/developer-guide/base-maps/using-with-mapbox)
- [ScatterplotLayer Documentation](https://deck.gl/docs/api-reference/layers/scatterplot-layer)
- [TripsLayer Documentation](https://deck.gl/docs/api-reference/geo-layers/trips-layer)
- [Mapbox Custom Layers](https://docs.mapbox.com/mapbox-gl-js/api/map/#map#addlayer)
- **OKC Implementation**: `src/components/Map/components/MapboxLayerWrapper.js`
- **Working Example**: `src/components/Map/components/InfrastructureSitingPathAnimation.jsx`

