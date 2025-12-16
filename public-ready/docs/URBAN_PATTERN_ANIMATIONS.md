# Urban Pattern Animations with Deck.gl

This guide explores Deck.gl layer types that can create urban pattern visualizations, perfect for showing activity, flows, density, and movement in Stillwater and other urban areas.

---

## 🎨 Available Urban Pattern Layers

### 1. **HeatmapLayer** - Activity Density
**Best for:** Showing population density, activity hotspots, demand patterns

```javascript
import { HeatmapLayer } from '@deck.gl/aggregation-layers';

new HeatmapLayer({
  id: 'urban-heatmap',
  data: activityPoints, // Array of { coordinates: [lng, lat], weight: 0-1 }
  getPosition: d => d.coordinates,
  getWeight: d => d.weight || 1,
  radiusPixels: 60,
  intensity: 1,
  threshold: 0.05,
  colorRange: [
    [0, 0, 128, 0],      // Low activity - dark blue
    [0, 128, 255, 128],  // Medium - blue
    [255, 255, 0, 192],  // High - yellow
    [255, 0, 0, 255]     // Very high - red
  ],
  aggregation: 'SUM'
})
```

**Urban Use Cases:**
- Power demand hotspots around data centers
- Population density patterns
- Traffic congestion areas
- Industrial activity zones

---

### 2. **TripsLayer** - Movement Flows
**Best for:** Showing traffic, power flows, people movement

```javascript
import { TripsLayer } from '@deck.gl/geo-layers';

new TripsLayer({
  id: 'urban-trips',
  data: trips, // Array of { path: [[lng, lat], ...], timestamps: [ms, ...] }
  getPath: d => d.path,
  getTimestamps: d => d.timestamps,
  getColor: [255, 200, 0, 200], // Amber for urban energy
  trailLength: 600, // 10 seconds at 60fps
  currentTime: currentTime,
  fadeTrail: true,
  widthMinPixels: 2,
  widthMaxPixels: 8,
  capRounded: true,
  jointRounded: true
})
```

**Urban Use Cases:**
- Power transmission flows (grid → data centers)
- Vehicle traffic patterns
- Pedestrian movement
- Supply chain logistics

---

### 3. **ArcLayer** - Origin-Destination Flows
**Best for:** Showing connections between points (power lines, supply chains)

```javascript
import { ArcLayer } from '@deck.gl/layers';

new ArcLayer({
  id: 'urban-arcs',
  data: connections, // Array of { source: [lng, lat], target: [lng, lat], value: number }
  getSourcePosition: d => d.source,
  getTargetPosition: d => d.target,
  getSourceColor: [0, 200, 255, 200], // Cyan
  getTargetColor: [255, 100, 0, 200], // Orange
  getWidth: d => Math.max(1, d.value / 10),
  widthMinPixels: 2,
  widthMaxPixels: 10,
  greatCircle: true, // Curved arcs
  getTilt: 0 // Flat arcs
})
```

**Urban Use Cases:**
- Power grid connections (generation → consumption)
- Data center interconnections
- Supply chain routes
- Infrastructure dependencies

---

### 4. **GridLayer** - Aggregated Activity Grid
**Best for:** Showing activity in a grid pattern (like city blocks)

```javascript
import { GridLayer } from '@deck.gl/aggregation-layers';

new GridLayer({
  id: 'urban-grid',
  data: activityPoints,
  getPosition: d => d.coordinates,
  cellSize: 200, // 200 meters per cell
  colorRange: [
    [0, 0, 0, 0],           // Empty
    [0, 100, 200, 128],     // Low
    [100, 200, 255, 192],   // Medium
    [255, 200, 0, 255]      // High
  ],
  elevationScale: 50,
  extruded: true, // 3D bars
  getElevation: d => d.count * 10,
  getColorValue: d => d.count,
  coverage: 0.9,
  opacity: 0.8
})
```

**Urban Use Cases:**
- Power consumption by city block
- Population density grids
- Industrial activity zones
- Data center capacity distribution

---

### 5. **HexagonLayer** - Hexagonal Binning
**Best for:** Smooth, organic-looking density patterns

```javascript
import { HexagonLayer } from '@deck.gl/aggregation-layers';

new HexagonLayer({
  id: 'urban-hexagons',
  data: activityPoints,
  getPosition: d => d.coordinates,
  radius: 500, // 500 meters
  elevationScale: 100,
  extruded: true,
  getElevation: d => d.count * 20,
  getColorValue: d => d.count,
  colorRange: [
    [26, 152, 80, 0],    // Green (low)
    [102, 194, 165, 128],
    [255, 255, 191, 192],
    [254, 224, 139, 255],
    [253, 174, 97, 255],
    [244, 109, 67, 255],
    [215, 48, 39, 255]   // Red (high)
  ],
  coverage: 1,
  opacity: 0.8
})
```

**Urban Use Cases:**
- Smooth population density
- Power demand visualization
- Activity hotspots
- Service coverage areas

---

### 6. **ContourLayer** - Isolines/Contours
**Best for:** Showing elevation, density contours, service boundaries

```javascript
import { ContourLayer } from '@deck.gl/aggregation-layers';

new ContourLayer({
  id: 'urban-contours',
  data: activityPoints,
  getPosition: d => d.coordinates,
  getWeight: d => d.value,
  contours: [
    { threshold: 0.2, color: [255, 255, 0, 128], strokeWidth: 2 },
    { threshold: 0.5, color: [255, 200, 0, 192], strokeWidth: 3 },
    { threshold: 0.8, color: [255, 0, 0, 255], strokeWidth: 4 }
  ],
  cellSize: 200
})
```

**Urban Use Cases:**
- Power grid coverage zones
- Service area boundaries
- Demand level contours
- Infrastructure reach

---

### 7. **ScatterplotLayer** (Enhanced) - Particle Systems
**Best for:** Individual points with pulsing/animating effects

```javascript
import { ScatterplotLayer } from '@deck.gl/layers';

new ScatterplotLayer({
  id: 'urban-particles',
  data: points, // Array of { position: [lng, lat], size: number, color: [r, g, b, a] }
  getPosition: d => d.position,
  getRadius: d => d.size,
  getFillColor: d => d.color,
  radiusMinPixels: 3,
  radiusMaxPixels: 30,
  radiusScale: 1,
  stroked: true,
  getLineColor: [255, 255, 255, 200],
  lineWidthMinPixels: 1,
  // Animate by updating radius/color in animation loop
})
```

**Urban Use Cases:**
- Individual facility markers with pulsing
- Real-time activity indicators
- Animated status points
- Interactive hotspots

---

## 🏙️ Recommended Patterns for Stillwater

### Pattern 1: **Power Demand Heatmap**
Show power consumption density around data centers:

```javascript
const StillwaterPowerHeatmap = ({ map, visible, powerData }) => {
  const overlayRef = useRef(null);
  
  useEffect(() => {
    if (!map?.current || !visible) return;
    
    const overlay = new MapboxOverlay({
      interleaved: true,
      layers: [
        new HeatmapLayer({
          id: 'stillwater-power-heatmap',
          data: powerData, // Points with power consumption values
          getPosition: d => d.coordinates,
          getWeight: d => d.powerConsumption,
          radiusPixels: 80,
          intensity: 1.5,
          threshold: 0.03,
          colorRange: [
            [0, 0, 0, 0],           // No power
            [0, 100, 200, 100],     // Low (blue)
            [100, 200, 255, 180],   // Medium (cyan)
            [255, 200, 0, 240],     // High (yellow)
            [255, 100, 0, 255]      // Very high (orange-red)
          ]
        })
      ]
    });
    
    map.current.addControl(overlay);
    overlayRef.current = overlay;
    
    return () => {
      if (overlayRef.current) {
        map.current.removeControl(overlayRef.current);
      }
    };
  }, [map, visible, powerData]);
  
  return null;
};
```

---

### Pattern 2: **Grid-to-Data-Center Flows**
Show power transmission from grid to data centers:

```javascript
const StillwaterPowerFlows = ({ map, visible, flowData }) => {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const overlayRef = useRef(null);
  
  // Animation loop
  useEffect(() => {
    if (!visible) return;
    
    const animate = () => {
      setCurrentTime(Date.now());
      requestAnimationFrame(animate);
    };
    animate();
  }, [visible]);
  
  useEffect(() => {
    if (!map?.current || !visible) return;
    
    const overlay = new MapboxOverlay({
      interleaved: true,
      layers: [
        new TripsLayer({
          id: 'stillwater-power-flows',
          data: flowData, // Array of power transmission paths
          getPath: d => d.path,
          getTimestamps: d => d.timestamps,
          getColor: d => {
            // Color by power source type
            if (d.sourceType === 'hydro') return [6, 182, 212, 200]; // Cyan
            if (d.sourceType === 'gas') return [249, 115, 22, 200];   // Orange
            if (d.sourceType === 'wind') return [34, 197, 94, 200];  // Green
            return [59, 130, 246, 200]; // Default blue
          },
          getWidth: d => Math.max(2, d.capacity / 50),
          trailLength: 600, // 10 seconds
          currentTime: currentTime,
          fadeTrail: true,
          widthMinPixels: 2,
          widthMaxPixels: 12
        })
      ]
    });
    
    map.current.addControl(overlay);
    overlayRef.current = overlay;
    
    return () => {
      if (overlayRef.current) {
        map.current.removeControl(overlayRef.current);
      }
    };
  }, [map, visible, flowData, currentTime]);
  
  return null;
};
```

---

### Pattern 3: **Activity Grid (3D Bars)**
Show power consumption as 3D bars by city block:

```javascript
const StillwaterActivityGrid = ({ map, visible, activityData }) => {
  useEffect(() => {
    if (!map?.current || !visible) return;
    
    const overlay = new MapboxOverlay({
      interleaved: true,
      layers: [
        new GridLayer({
          id: 'stillwater-activity-grid',
          data: activityData,
          getPosition: d => d.coordinates,
          cellSize: 250, // 250m x 250m cells
          colorRange: [
            [0, 0, 0, 0],
            [0, 100, 200, 100],
            [100, 200, 255, 180],
            [255, 200, 0, 240],
            [255, 100, 0, 255]
          ],
          elevationScale: 100,
          extruded: true,
          getElevation: d => d.powerConsumption / 10,
          getColorValue: d => d.powerConsumption,
          coverage: 0.95,
          opacity: 0.85
        })
      ]
    });
    
    map.current.addControl(overlay);
    overlayRef.current = overlay;
    
    return () => {
      if (overlayRef.current) {
        map.current.removeControl(overlayRef.current);
      }
    };
  }, [map, visible, activityData]);
  
  return null;
};
```

---

### Pattern 4: **Connection Arcs**
Show infrastructure connections as curved arcs:

```javascript
const StillwaterConnections = ({ map, visible, connections }) => {
  useEffect(() => {
    if (!map?.current || !visible) return;
    
    const overlay = new MapboxOverlay({
      interleaved: true,
      layers: [
        new ArcLayer({
          id: 'stillwater-connections',
          data: connections, // { source: [lng, lat], target: [lng, lat], capacity: number }
          getSourcePosition: d => d.source,
          getTargetPosition: d => d.target,
          getSourceColor: [0, 200, 255, 200], // Cyan (source)
          getTargetColor: [255, 100, 0, 200], // Orange (destination)
          getWidth: d => Math.max(1, d.capacity / 100),
          widthMinPixels: 2,
          widthMaxPixels: 15,
          greatCircle: true, // Curved arcs
          getTilt: 0,
          opacity: 0.8
        })
      ]
    });
    
    map.current.addControl(overlay);
    overlayRef.current = overlay;
    
    return () => {
      if (overlayRef.current) {
        map.current.removeControl(overlayRef.current);
      }
    };
  }, [map, visible, connections]);
  
  return null;
};
```

---

## 🎯 Quick Comparison

| Layer Type | Best For | Performance | Visual Style |
|------------|----------|-------------|--------------|
| **HeatmapLayer** | Density hotspots | Excellent | Smooth gradients |
| **TripsLayer** | Movement flows | Excellent | Animated trails |
| **ArcLayer** | Point-to-point connections | Excellent | Curved lines |
| **GridLayer** | Block-level aggregation | Good | 3D bars |
| **HexagonLayer** | Organic density | Good | Hexagonal cells |
| **ContourLayer** | Boundary lines | Good | Isolines |
| **ScatterplotLayer** | Individual points | Excellent | Simple circles |

---

## 🚀 Implementation Tips

### 1. **Performance**
- Use `interleaved: true` for MapboxOverlay
- Limit data points to < 10,000 for smooth 60 FPS
- Use aggregation layers (GridLayer, HexagonLayer) for large datasets

### 2. **Animation**
- Update `currentTime` for TripsLayer animations
- Use `requestAnimationFrame` for smooth updates
- Update layer props via `overlay.setProps()` in animation loop

### 3. **Styling**
- Use color ranges that match your theme
- Adjust opacity for layering multiple visualizations
- Use `radiusPixels` for screen-space sizing, `radius` for geographic

### 4. **Data Format**
```javascript
// Heatmap data
const heatmapData = [
  { coordinates: [-97.0584, 36.1156], weight: 0.8 },
  // ...
];

// Trips data
const tripsData = [
  {
    path: [[-97.1, 36.1], [-97.05, 36.12], [-97.0, 36.15]],
    timestamps: [0, 1000, 2000] // milliseconds
  },
  // ...
];

// Arc data
const arcData = [
  {
    source: [-97.1, 36.1],
    target: [-97.0, 36.15],
    value: 100
  },
  // ...
];
```

---

## 📚 References

- [Deck.gl Layer Catalog](https://deck.gl/docs/api-reference/layers)
- [Aggregation Layers](https://deck.gl/docs/api-reference/aggregation-layers)
- [Geo Layers](https://deck.gl/docs/api-reference/geo-layers)
- [Mapbox Integration](https://deck.gl/docs/developer-guide/base-maps/using-with-mapbox)

---

## 🎨 Next Steps

1. **Choose a pattern** that matches your data and use case
2. **Prepare your data** in the required format
3. **Create a component** following the StillwaterCircleAnimation pattern
4. **Integrate** with the map using MapboxOverlay
5. **Test** performance with your dataset size

