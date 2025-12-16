# Teardrop Markers and Animation System Documentation

## Overview

This document explains how the teardrop marker system works in the map application, including marker mounting, click event handling, particle animations, and Deck GL animation triggers from popup cards.

---

## Table of Contents

1. [Teardrop Marker System](#teardrop-marker-system)
2. [Marker Mounting Process](#marker-mounting-process)
3. [Click Event Handling](#click-event-handling)
4. [Particle Animations](#particle-animations)
5. [Deck GL Animations](#deck-gl-animations)
6. [Integration Flow](#integration-flow)

---

## Teardrop Marker System

### What Are Teardrop Markers?

Teardrop markers are Mapbox GL JS markers (DOM-based) that appear on the map to represent infrastructure locations. They use Mapbox's built-in marker system with custom styling and popup cards.

**Key Characteristics:**
- **DOM-based rendering** (not WebGL)
- **Fixed screen size** (doesn't scale with zoom)
- **Custom popup cards** (TypewriterPopupCard component)
- **Color-coded** by category/utility type
- **Interactive** (click to open popup, hover effects)

### Types of Teardrop Markers

1. **Campus Teardrop Markers** (Red) - Infrastructure sites (Pryor, Stillwater, etc.)
2. **GRDA Power Markers** (Cyan/Green/Orange) - Power generation facilities
3. **OG&E Power Markers** (Orange/Yellow) - OG&E power generation facilities

---

## Marker Mounting Process

### 1. Campus Teardrop Markers (OSM Button Trigger)

**File:** `src/components/Map/components/Cards/OSMCall.jsx`

**Function:** `addCampusTeardropMarkers()`

**Trigger:** Called 1 second after OSM button click for Oklahoma data center sites

**Mounting Flow:**

```javascript
// 1. Cleanup existing markers
if (window.okCampusTeardropMarkers) {
  window.okCampusTeardropMarkers.forEach(marker => marker.remove());
  window.okCampusTeardropMarkers = [];
}

// 2. Define campus locations
const campuses = [
  {
    name: 'Pryor',
    lat: 36.2411,
    lng: -95.3301,
    category: 'Supply',
    // ... other properties
  },
  // ... more campuses
];

// 3. Create markers with popups
campuses.forEach(campus => {
  // Create popup container (DOM element)
  const popupContainer = document.createElement('div');
  
  // Create TypewriterPopupCard content
  const typewriterContent = {
    description: `**${campus.fullName}** — ${campus.description}`,
    data: {
      'Category': campus.category,
      'Address': campus.address,
      // ... more data
    }
  };
  
  // Render React component into DOM container
  const root = createRoot(popupContainer);
  root.render(
    <TypewriterPopupCard
      content={typewriterContent}
      theme="green"
      header={header}
      shouldStart={true}
      enableTypewriter={true}
    />
  );
  
  // Create Mapbox popup
  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: 'okc-campus-popup-transparent',
    anchor: 'bottom',
    offset: [0, -40]
  }).setDOMContent(popupContainer);
  
  // Create marker
  const marker = new mapboxgl.Marker({
    color: markerColor, // Red (#ef4444 for Pryor/Stillwater, darker for others)
    scale: 1.2
  })
  .setLngLat([campus.lng, campus.lat])
  .setPopup(popup)
  .addTo(map.current);
  
  // Store data attributes
  const markerElement = marker.getElement();
  markerElement.setAttribute('data-marker-type', 'campus');
  markerElement.setAttribute('data-category', campus.category);
  markerElement.setAttribute('data-campus-name', campus.name);
  
  // Add popup open/close handlers for color change
  popup.on('open', () => {
    // Change marker color to green when popup opens
    // ... color change logic
  });
  
  popup.on('close', () => {
    // Revert to original red color
    // ... color revert logic
  });
  
  markers.push(marker);
});

// 4. Store markers globally
window.okCampusTeardropMarkers = markers;

// 5. Add map click handler to close popups
map.current.on('click', handleMapClick);
```

**Key Points:**
- Markers are created using `mapboxgl.Marker()` API
- Popups use React's `createRoot()` to render TypewriterPopupCard
- Markers stored in `window.okCampusTeardropMarkers` for global access
- Map click handler closes all popups when clicking map background

---

### 2. GRDA Power Markers (Perplexity Button Trigger)

**File:** `src/components/Map/components/Cards/OSMCall.jsx`

**Function:** `addGRDAPowerMarkers()`

**Trigger:** Called from PerplexityCall.jsx when Perplexity button is clicked

**Mounting Flow:**

```javascript
// 1. Load GRDA capacity data
const response = await fetch('/data/grda/firecrawl_capacity_data.json');
const data = await response.json();
const generatingUnits = data.generating_units || [];

// 2. Create markers for each power unit
generatingUnits.forEach(unit => {
  // Determine color by fuel type
  const markerColor = getFuelColor(unit.fuel);
  // - Hydro: #06b6d4 (Cyan)
  // - Wind: #10b981 (Green)
  // - Gas: #f97316 (Orange)
  
  // Create popup with clickable capacity badge
  const header = (
    <div>
      <div>{unit.name}</div>
      <div>GRDA Power Generation Facility</div>
      <div
        className="capacity-badge"
        onClick={(e) => {
          e.stopPropagation();
          // Emit event to trigger Infrastructure Siting animation
          window.mapEventBus.emit('infrastructure-siting:play');
        }}
      >
        Capacity: {unit.net_MW || 0} MW
      </div>
    </div>
  );
  
  // Create marker with popup
  const marker = new mapboxgl.Marker({
    color: markerColor,
    scale: 1.2
  })
  .setLngLat([unit.longitude, unit.latitude])
  .setPopup(popup)
  .addTo(map.current);
  
  // Store fuel type for legend toggling
  markerElement.setAttribute('data-fuel-type', fuelLower);
  markerElement.setAttribute('data-utility', 'grda');
  
  // Calculate opacity based on capacity
  const markerOpacity = getOpacityFromCapacity(unit.net_MW);
  markerElement.style.opacity = markerOpacity.toString();
  
  markers.push(marker);
});

// 3. Store markers globally
window.okGRDAPowerMarkers = markers;
```

**Key Points:**
- Markers loaded from JSON data file (`/data/grda/firecrawl_capacity_data.json`)
- Color-coded by fuel type (hydro, wind, gas)
- Opacity based on capacity (0.4 to 1.0 range)
- Capacity badge in popup triggers Deck GL animation

---

### 3. OG&E Power Markers (Firecrawl Button Trigger)

**File:** `src/components/Map/components/Cards/FirecrawlCall.jsx`

**Function:** `addOGEPowerMarkers()` (similar to GRDA)

**Trigger:** Called when Firecrawl button is clicked (via NestedCircleButton)

**Mounting Flow:**
- Similar to GRDA markers
- Loads from `/data/oge/firecrawl_capacity_data.json`
- Color-coded by fuel type (gas, coal, wind, solar)
- Stored in `window.okOGEPowerMarkers`

---

## Click Event Handling

### 1. Marker Click → Popup Display

**Flow:**
1. User clicks teardrop marker
2. Mapbox GL JS triggers marker's built-in click handler
3. Popup opens (if not already open)
4. TypewriterPopupCard starts typewriter animation
5. Marker color changes (red → green for campus markers)

**Code Location:** `OSMCall.jsx` lines 436-475

```javascript
// Popup open handler
popup.on('open', () => {
  const markerElement = marker.getElement();
  const svg = markerElement.querySelector('svg');
  if (svg) {
    const path = svg.querySelector('path');
    if (path) {
      path.setAttribute('fill', '#22c55e'); // Green
      path.setAttribute('stroke', '#22c55e');
    }
  }
});

// Popup close handler
popup.on('close', () => {
  // Revert to original color
  path.setAttribute('fill', markerColor); // Original red
  path.setAttribute('stroke', markerColor);
});
```

### 2. Map Background Click → Close All Popups

**File:** `OSMCall.jsx` lines 482-533

**Handler:** `handleMapClick()`

```javascript
const handleMapClick = (e) => {
  const clickedElement = e.originalEvent?.target;
  
  // Check if click is on marker or popup
  const isMarkerClick = clickedElement.closest('.mapboxgl-marker');
  const isPopupClick = clickedElement.closest('.mapboxgl-popup');
  
  // Only close if clicking map background
  if (!isMarkerClick && !isPopupClick) {
    // Close all campus teardrop marker popups
    markers.forEach(marker => {
      const popup = marker.getPopup();
      if (popup && popup.isOpen()) {
        popup.remove();
      }
    });
    
    // Close GRDA and OG&E marker popups
    // ... similar logic
  }
};

map.current.on('click', handleMapClick);
```

**Key Points:**
- Handler checks if click target is marker or popup
- Only closes popups when clicking map background
- Handler stored in `window.okCampusTeardropMarkersClickHandler` for cleanup

---

## Particle Animations

### 1. Pipeline Particles (Around Teardrop Markers)

**File:** `src/components/Map/osm/utils/layerAnimations.js`

**Function:** `addPipelineParticles()`

**Trigger:** Called from `addMarkerPipelines()` in OSMCall.jsx, which is triggered 1 second after OSM button click

**Mounting Flow:**

```javascript
// 1. Called from OSMCall.jsx
const addMarkerPipelines = useCallback(async () => {
  const markerKeys = [
    'pryor', 'stillwater', 'tulsa_suburbs', 
    // ... all marker keys
  ];
  
  // 2. For each marker, load pipeline data
  for (const markerKey of markerKeys) {
    const pipelinePath = `/data/pipelines/pipeline_${markerKey}.json`;
    const response = await fetch(pipelinePath);
    const pipelineData = await response.json();
    
    // 3. Extract pipeline line features (5-mile radius around marker)
    const pipelineFeatures = pipelineData.features.filter(
      f => f.properties?.category === 'pipeline'
    );
    
    // 4. Add particles to pipeline lines
    addPipelineParticles(map, `marker-pipeline-${markerKey}`, pipelineFeatures);
  }
}, [map]);
```

**Particle Animation Implementation:**

```javascript
export const addPipelineParticles = (mapRef, baseId, lineFeatures) => {
  // 1. Create particle source and layer
  const particleSourceId = `${baseId}-pipeline-particles`;
  const particleLayerId = `${baseId}-pipeline-particles-layer`;
  
  mapRef.current.addSource(particleSourceId, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });
  
  mapRef.current.addLayer({
    id: particleLayerId,
    type: 'circle',
    source: particleSourceId,
    paint: {
      'circle-radius': 3,
      'circle-color': '#93c5fd', // Light blue
      'circle-opacity': 0.9,
      'circle-blur': 0.4
    }
  });
  
  // 2. Extract continuous paths from line features
  const continuousPaths = [];
  lineFeatures.forEach(feature => {
    if (feature.geometry?.coordinates && feature.geometry.coordinates.length > 1) {
      const coords = feature.geometry.coordinates.filter(coord => coord && coord.length === 2);
      if (coords.length >= 2) {
        continuousPaths.push(coords);
      }
    }
  });
  
  // 3. Animate particles along paths
  const particleCount = 120;
  const speed = 0.000003;
  let animationFrame = null;
  
  const animate = () => {
    const now = Date.now() * speed;
    const features = [];
    const particlesPerPath = Math.max(1, Math.floor(particleCount / continuousPaths.length));
    
    continuousPaths.forEach((path, pathIndex) => {
      const pathLength = path.length - 1;
      
      for (let i = 0; i < particlesPerPath; i += 1) {
        const pathOffset = pathIndex * 0.1;
        const particleProgress = ((now + pathOffset + i / particleCount) % 1);
        const idx = Math.floor(particleProgress * pathLength);
        const nextIdx = Math.min(idx + 1, pathLength);
        const frac = (particleProgress * pathLength) % 1;
        
        // Interpolate position along path
        const a = path[idx];
        const b = path[nextIdx];
        const lng = a[0] + (b[0] - a[0]) * frac;
        const lat = a[1] + (b[1] - a[1]) * frac;
        
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: {}
        });
      }
    });
    
    // Update source data
    const source = mapRef.current.getSource(particleSourceId);
    if (source) {
      source.setData({ type: 'FeatureCollection', features });
    }
    
    animationFrame = requestAnimationFrame(animate);
  };
  
  // Store animation frame for cleanup
  if (!window.okPipelineParticles) {
    window.okPipelineParticles = {};
  }
  window.okPipelineParticles[baseId] = animationFrame;
  animationFrame = requestAnimationFrame(animate);
};
```

**Key Points:**
- Particles are **Mapbox circle layers** (not Deck GL)
- Animation uses `requestAnimationFrame` loop
- Particles move along pipeline line coordinates
- 120 particles total, distributed across all paths
- Speed: `0.000003` (controls animation speed)
- Particles stored in `window.okPipelineParticles` for cleanup

---

### 2. Transportation Particles (Route Paths)

**File:** `src/components/Map/osm/utils/layerAnimations.js`

**Function:** `addTransportationParticles()`

**Trigger:** Called from `addTransitPathLayers()` in OSMCall.jsx

**Similar to pipeline particles:**
- Creates particle source and layer
- Animates particles along route line coordinates
- Uses same animation pattern (requestAnimationFrame loop)
- Stored in `window.okTransportationParticles`

---

### 3. Route Particles (Transit Paths)

**File:** `src/components/Map/components/Cards/OSMCall.jsx`

**Function:** `addTransitPathLayers()`

**Implementation:**
- Loads route GeoJSON files from `/data/okc_campuses/*.geojson`
- Creates particle layer: `okc-campuses-route-particles-layer`
- Animates particles along route segments
- Similar animation pattern to pipeline particles

---

## Deck GL Animations

### 1. Infrastructure Siting Path Animation (Triggered from Popup Card)

**File:** `src/components/Map/components/InfrastructureSitingPathAnimation.jsx`

**Trigger:** Clicking "Capacity: X MW" badge in GRDA/OG&E marker popup

**Flow:**

```
1. User clicks teardrop marker → Popup opens
2. User clicks "Capacity: X MW" badge in popup
3. Badge onClick handler emits event:
   window.mapEventBus.emit('infrastructure-siting:play');
4. Map component listens for event:
   window.mapEventBus.on('infrastructure-siting:play', handleInfrastructureSitingAnimation);
5. Map component sets state:
   setShowInfrastructureSitingAnimation(true);
6. InfrastructureSitingPathAnimation component mounts
7. Component loads route GeoJSON files
8. Converts routes to TripsLayer data format
9. Creates Deck GL MapboxLayer with TripsLayer
10. Adds layer to map
11. Starts animation loop
```

**Code Location:** `src/components/Map/index.jsx` lines 979-1028

```javascript
// Event listener in Map component
const handleInfrastructureSitingAnimation = () => {
  // Show animation immediately
  setShowInfrastructureSitingAnimation(true);
  
  // Keep visible for 20 seconds minimum
  infrastructureSitingAnimationTimeoutRef.current = setTimeout(() => {
    setShowInfrastructureSitingAnimation(false);
  }, 20000);
};

window.mapEventBus.on('infrastructure-siting:play', handleInfrastructureSitingAnimation);
```

**InfrastructureSitingPathAnimation Component:**

```javascript
// 1. Load route files
const INFRASTRUCTURE_ROUTE_FILES = [
  '/data/okc_campuses/pryor_to_stillwater.geojson',
  '/data/okc_campuses/pryor_to_inola.geojson',
  // ... more routes
];

// 2. Convert routes to trips data
const tripsData = [];
collections.forEach((collection) => {
  collection.features.forEach((feature) => {
    if (feature.geometry?.type === 'LineString') {
      const path = feature.geometry.coordinates;
      
      // Create multiple particles per route
      for (let particleIndex = 0; particleIndex < PARTICLES_PER_ROUTE; particleIndex++) {
        const particleOffset = particleIndex * TRIP_DURATION;
        const timestamps = path.map((_, index) => {
          const progress = index / (path.length - 1);
          return particleOffset + (progress * TRIP_DURATION);
        });
        
        tripsData.push({
          id: `siting-trip-${fileIndex}-${tripIndex}-particle-${particleIndex}`,
          path: path,
          timestamps: timestamps,
          color: [255, 140, 0, 200] // Orange
        });
      }
    }
  });
});

// 3. Create Deck GL TripsLayer
const layer = new TripsLayer({
  id: 'infrastructure-siting-path-animation',
  data: tripsData,
  getPath: (d) => d?.path || [],
  getTimestamps: (d) => d?.timestamps || [],
  getColor: (d) => d?.color || [255, 140, 0, 200],
  getWidth: 8,
  trailLength: 6000,
  currentTime: 0,
  loopLength: LOOP_DURATION,
  fadeTrail: true,
  opacity: 0.9
});

// 4. Wrap in MapboxLayer (Seattle pattern - no drift)
const mapboxLayer = new MapboxLayer({
  id: 'infrastructure-siting-path-animation',
  type: TripsLayer,
  // ... same props
});

// 5. Add to map
mapInstance.addLayer(mapboxLayer);

// 6. Start animation loop
const animate = () => {
  const elapsed = (timestamp - startTime);
  const currentTimeValue = elapsed % LOOP_DURATION;
  
  // Update layer's currentTime prop
  overlayRef.current.setProps({ 
    currentTime: currentTimeValue
  });
  
  animationRef.current = requestAnimationFrame(animate);
};
```

**Key Points:**
- Uses **Deck GL TripsLayer** (WebGL-based)
- Wrapped in **MapboxLayer** to prevent drift (Seattle pattern)
- Animation updates `currentTime` prop on each frame
- Particles move along route paths with trail effect
- 15 particles per route, 10 second trip duration

---

### 2. Stillwater Circle Animation (Deck GL ScatterplotLayer)

**File:** `src/components/Map/components/StillwaterCircleAnimation.jsx`

**Trigger:** Can be triggered from various sources (GeoAI, scene loading, etc.)

**Implementation:**

```javascript
// 1. Create pulsing radius animation
const animate = (timestamp) => {
  const elapsed = timestamp - startTime;
  const progress = (elapsed % animationDuration) / animationDuration;
  
  // Pulsing effect: 0 -> 1 -> 0
  const pulse = Math.sin(progress * Math.PI * 2);
  const normalizedPulse = (pulse + 1) / 2;
  
  // Radius: 500m to 2000m
  const currentRadius = minRadius + (normalizedPulse * (maxRadius - minRadius));
  setRadius(currentRadius);
  
  animationRef.current = requestAnimationFrame(animate);
};

// 2. Create Deck GL ScatterplotLayer
const layer = new ScatterplotLayer({
  id: 'stillwater-circle-animation',
  data: [{ position: STILLWATER_COORDS, radius: radius }],
  getPosition: d => d.position,
  getRadius: d => d.radius,
  getFillColor: [76, 175, 80, 120], // Green with transparency
  radiusScale: 1, // 1 = meters (geographic scale)
  radiusMinPixels: 0,
  radiusMaxPixels: Infinity
});

// 3. Wrap in MapboxOverlay
const overlay = new MapboxOverlay({
  layers: [layer],
  interleaved: true
});

// 4. Add to map
mapInstance.addControl(overlay);
```

**Key Points:**
- Uses **Deck GL ScatterplotLayer** (WebGL-based)
- Geographic radius (meters, not pixels)
- Pulsing animation: 500m → 2000m → 500m
- 3 second pulse cycle
- Stays fixed to geographic coordinates (no drift)

---

### 3. Infrastructure Flow Animation (Deck GL TripsLayer)

**File:** `src/components/Map/components/InfrastructureFlowAnimation.jsx`

**Similar to Infrastructure Siting Path Animation:**
- Uses TripsLayer
- Animates particles along infrastructure routes
- Red particles (different from blue Infrastructure Siting)

---

## Integration Flow

### Complete Flow: OSM Button → Markers → Particles → Deck GL Animation

```
1. User clicks OSM button (green circle)
   ↓
2. OSMCall.handleClick() executes
   ↓
3. addSiteLayers() loads OSM infrastructure layers
   ↓
4. After 1 second delay:
   - addCampusTeardropMarkers() → Creates red teardrop markers
   - addMarkerPipelines() → Loads pipeline data, calls addPipelineParticles()
   - addTransitPathLayers() → Loads route data, creates route particles
   ↓
5. User clicks teardrop marker
   ↓
6. Popup opens with TypewriterPopupCard
   ↓
7. User clicks "Capacity: X MW" badge in popup
   ↓
8. Event emitted: window.mapEventBus.emit('infrastructure-siting:play')
   ↓
9. Map component receives event, sets showInfrastructureSitingAnimation = true
   ↓
10. InfrastructureSitingPathAnimation component mounts
    ↓
11. Component loads route GeoJSON files
    ↓
12. Converts routes to TripsLayer trips data
    ↓
13. Creates MapboxLayer with TripsLayer
    ↓
14. Adds layer to map
    ↓
15. Starts animation loop (requestAnimationFrame)
    ↓
16. Orange particles animate along routes with trail effect
```

---

### Complete Flow: Firecrawl Button → OG&E Markers → Particles

```
1. User clicks Firecrawl button (orange circle) in NestedCircleButton
   ↓
2. FirecrawlCall component executes
   ↓
3. addOGEPowerMarkers() creates OG&E power teardrop markers
   ↓
4. addStillwaterToOGERoutes() loads route layers
   ↓
5. Route particles animate along Stillwater → OG&E power plant routes
```

---

## Key Technical Details

### Marker Storage

All markers are stored globally for access across components:

```javascript
// Campus markers
window.okCampusTeardropMarkers = [marker1, marker2, ...];

// GRDA power markers
window.okGRDAPowerMarkers = [marker1, marker2, ...];

// OG&E power markers
window.okOGEPowerMarkers = [marker1, marker2, ...];
```

### Particle Animation Storage

Particle animation frames stored for cleanup:

```javascript
// Pipeline particles
window.okPipelineParticles = {
  'marker-pipeline-pryor': animationFrameId,
  'marker-pipeline-stillwater': animationFrameId,
  // ...
};

// Transportation particles
window.okTransportationParticles = {
  'ok-data-center-google_stillwater_ok-transportation-particles': animationFrameId,
  // ...
};
```

### Event Bus Communication

The system uses `window.mapEventBus` for component communication:

```javascript
// Emit events
window.mapEventBus.emit('infrastructure-siting:play');
window.mapEventBus.emit('infrastructure-siting:start');
window.mapEventBus.emit('infrastructure-siting:stop');

// Listen for events
window.mapEventBus.on('infrastructure-siting:play', handler);
```

---

## File Structure

```
src/components/Map/components/Cards/
├── OSMCall.jsx                    # Campus teardrop markers, GRDA markers, pipeline particles
├── FirecrawlCall.jsx              # OG&E markers, Stillwater-to-OG&E routes
├── PerplexityCall.jsx             # GRDA markers (alternative trigger)
└── TypewriterPopupCard.jsx        # Popup card component

src/components/Map/components/
├── InfrastructureSitingPathAnimation.jsx  # Deck GL TripsLayer animation (blue/orange)
├── InfrastructureFlowAnimation.jsx        # Deck GL TripsLayer animation (red)
├── StillwaterCircleAnimation.jsx          # Deck GL ScatterplotLayer (pulsing circle)
└── DeckGLOverlayManager.jsx               # Unified Deck GL overlay manager

src/components/Map/osm/utils/
└── layerAnimations.js             # Pipeline and transportation particle functions

src/components/Map/index.jsx     # Map component, event listeners, animation state
```

---

## Animation Types Summary

| Animation Type | Technology | Trigger | Visual Effect |
|----------------|-----------|---------|---------------|
| **Pipeline Particles** | Mapbox Circle Layer | OSM button → addMarkerPipelines() | Light blue particles moving along pipeline lines |
| **Transportation Particles** | Mapbox Circle Layer | OSM button → addTransitPathLayers() | White particles moving along route lines |
| **Route Particles** | Mapbox Circle Layer | OSM button → addTransitPathLayers() | Green particles on transit paths |
| **Infrastructure Siting** | Deck GL TripsLayer | Popup badge click → event bus | Orange particles with trail effect |
| **Infrastructure Flow** | Deck GL TripsLayer | Scene/AI trigger | Red particles with trail effect |
| **Stillwater Circle** | Deck GL ScatterplotLayer | GeoAI/Scene trigger | Pulsing green circle (500m-2000m) |

---

## Cleanup and Memory Management

### Marker Cleanup

```javascript
// Remove all markers
if (window.okCampusTeardropMarkers) {
  window.okCampusTeardropMarkers.forEach(marker => marker.remove());
  window.okCampusTeardropMarkers = [];
}
```

### Particle Animation Cleanup

```javascript
// Cancel pipeline particle animations
if (window.okPipelineParticles) {
  Object.values(window.okPipelineParticles).forEach(frameId => {
    if (frameId) cancelAnimationFrame(frameId);
  });
  window.okPipelineParticles = {};
}
```

### Deck GL Animation Cleanup

```javascript
// Remove Deck GL layers
if (mapInstance.getLayer('infrastructure-siting-path-animation')) {
  mapInstance.removeLayer('infrastructure-siting-path-animation');
}

// Cancel animation frames
if (animationRef.current) {
  cancelAnimationFrame(animationRef.current);
  animationRef.current = null;
}
```

---

## Migration Notes for Columbus

When migrating to Columbus, the following will need updates:

1. **Campus Locations** - Update `campuses` array in `addCampusTeardropMarkers()`
2. **Pipeline Data Files** - Replace `/data/pipelines/pipeline_*.json` with Columbus data
3. **Route Files** - Replace `/data/okc_campuses/*.geojson` with Columbus routes
4. **Marker Keys** - Update `markerKeys` array in `addMarkerPipelines()`
5. **Power Utility Data** - Replace GRDA/OG&E data with Columbus utility data (AEP Ohio)
6. **Deck GL Animations** - Update route file paths in animation components

---

## Debugging Tips

### Check if Markers are Mounted

```javascript
console.log('Campus markers:', window.okCampusTeardropMarkers?.length);
console.log('GRDA markers:', window.okGRDAPowerMarkers?.length);
console.log('OG&E markers:', window.okOGEPowerMarkers?.length);
```

### Check if Particles are Running

```javascript
console.log('Pipeline particles:', window.okPipelineParticles);
console.log('Transportation particles:', window.okTransportationParticles);
```

### Check if Deck GL Animation is Active

```javascript
// In browser console
map.getLayer('infrastructure-siting-path-animation');
// Should return layer object if active
```

### Event Bus Debugging

```javascript
// Listen to all events
window.mapEventBus.on('*', (event, data) => {
  console.log('Event:', event, data);
});
```

---

**Last Updated:** [Current Date]  
**Version:** 1.0


