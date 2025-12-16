# OSM Marker Pulse Animation System

## Overview

The OSM marker pulse animation system creates synchronized, color-matched pulse animations for power generation facility markers on the map. Each marker type (gas, hydro, wind) has a corresponding pulse animation that expands outward from the marker location, matching the marker's color and fading out as it expands.

## Architecture

### Component Structure

The pulse animation system is implemented in:
- **Main Component**: `src/components/Map/components/Cards/GasHydroPowerPulseAnimations.jsx`
- **Integration Point**: `src/components/Map/components/Cards/OSMCall.jsx` (line 1369)

### How It Works

#### 1. Color Synchronization

The pulse animation colors are **hardcoded to match the marker colors**:

```javascript
// Gas markers
const color = '#f97316'; // Orange - matches gas power markers

// Hydro markers  
const color = '#06b6d4'; // Cyan - matches hydroelectric markers

// Wind markers
const color = '#10b981'; // Green - matches wind power markers
```

These colors are used in the Mapbox layer's `circle-color` paint property, ensuring perfect visual synchronization between the marker and its pulse animation.

#### 2. Animation Implementation

Each pulse animation consists of:

**Mapbox Circle Layer** with dynamic properties:
- **Radius**: Expands from `min` to `max` based on `pulse_t` (0.0 to 1.0)
- **Color**: Fixed to match marker color (gas/hydro/wind specific)
- **Opacity**: Fades from 45% → 22% → 0% as it expands
- **Blur**: 0.5 for soft glow effect

**Animation Loop**:
```javascript
const animatePulse = () => {
  const t = ((Date.now() / 1000) % ANIMATION_PERIOD) / ANIMATION_PERIOD; // 0.0 to 1.0
  
  const updatedFeature = {
    ...pulseFeature,
    properties: { pulse_t: t }
  };
  
  map.current.getSource(sourceId).setData({
    type: 'FeatureCollection',
    features: [updatedFeature]
  });
  
  frame = requestAnimationFrame(animatePulse);
};
```

#### 3. Synchronization

All pulse animations are **perfectly synchronized** using a shared `ANIMATION_PERIOD`:

```javascript
const ANIMATION_PERIOD = 1.0; // 1.0 seconds per cycle
```

All animations use `Date.now() / 1000 % ANIMATION_PERIOD`, ensuring they start and cycle together regardless of when markers are added.

#### 4. Capacity-Based Scaling

The pulse radius scales based on the marker's power generation capacity:

```javascript
// Base radius range
const baseMin = 30;
const baseMax = 90;

// Scale factor: 1.0x to 1.5x multiplier based on capacity
const scaleFactor = 1.0 + (normalizedCapacity * 0.5);
const minRadius = baseMin * scaleFactor;
const maxRadius = baseMax * scaleFactor;
```

**Result**:
- Smallest markers: 30-90px pulse radius
- Largest markers: 45-135px pulse radius

## Integration Flow

### 1. Marker Creation (OSMCall.jsx)

When GRDA power markers are created in `addGRDAPowerMarkers()`:

```javascript
// Markers are stored by fuel type
const gasMarkers = [];
const hydroMarkers = [];
const windMarkers = [];

// Each marker includes capacity for scaling
gasMarkers.push({
  lng: unit.longitude,
  lat: unit.latitude,
  name: unit.name,
  capacity: capacityMW
});
```

### 2. State Management

Marker arrays are stored in React state:

```javascript
const [gasPowerMarkers, setGasPowerMarkers] = useState([]);
const [hydroPowerMarkers, setHydroPowerMarkers] = useState([]);
const [windPowerMarkers, setWindPowerMarkers] = useState([]);
```

### 3. Pulse Animation Component

The `GasHydroPowerPulseAnimations` component receives these arrays:

```jsx
<GasHydroPowerPulseAnimations
  map={map}
  gasMarkers={gasPowerMarkers}
  hydroMarkers={hydroPowerMarkers}
  windMarkers={windPowerMarkers}
/>
```

### 4. Layer Creation

For each marker, the component:
1. Creates a GeoJSON source with a Point feature
2. Adds a Mapbox circle layer with color-matched paint properties
3. Starts an animation loop that updates `pulse_t` property
4. Mapbox interpolates radius and opacity based on `pulse_t`

## Technical Details

### Layer Naming Convention

```
{markerType}-power-pulse-{index}
{markerType}-power-pulse-layer-{index}
```

Examples:
- `gas-power-pulse-0` (source)
- `gas-power-pulse-layer-0` (layer)
- `hydro-power-pulse-1` (source)
- `hydro-power-pulse-layer-1` (layer)

### Animation Frame Management

Animation frames are stored in global window objects:

```javascript
window.gasPowerPulseAnimations = [frame1, frame2, ...];
window.hydroPowerPulseAnimations = [frame1, frame2, ...];
window.windPowerPulseAnimations = [frame1, frame2, ...];
```

This allows proper cleanup when markers are removed.

### Opacity Interpolation

The pulse fades out using a three-point interpolation:

```javascript
'circle-opacity': [
  'interpolate',
  ['linear'],
  ['get', 'pulse_t'],
  0, 0.45,   // Start at 45% opacity
  0.7, 0.22, // Fade to 22% at 70%
  1, 0       // Fade out completely
]
```

This creates a smooth fade that's most visible near the marker and gradually disappears.

## Configuration

### Animation Speed

Change `ANIMATION_PERIOD` to adjust speed:

```javascript
const ANIMATION_PERIOD = 1.0; // 1.0 seconds = current speed
// Faster: 0.5 seconds
// Slower: 2.0 seconds
```

### Radius Range

Adjust base radius in `getRadiusForMarker()`:

```javascript
const baseMin = 30; // Minimum pulse radius
const baseMax = 90; // Maximum pulse radius
```

### Capacity Scaling

Modify scale factor in `getRadiusForMarker()`:

```javascript
const scaleFactor = 1.0 + (normalizedCapacity * 0.5); // 1.0x to 1.5x
// Increase multiplier for more dramatic scaling:
// const scaleFactor = 1.0 + (normalizedCapacity * 1.0); // 1.0x to 2.0x
```

### Opacity Curve

Adjust opacity interpolation points:

```javascript
'circle-opacity': [
  'interpolate',
  ['linear'],
  ['get', 'pulse_t'],
  0, 0.45,   // Start opacity
  0.7, 0.22, // Mid-point opacity
  1, 0       // End opacity
]
```

## Cleanup

The component handles cleanup automatically:

1. **Removed Markers**: When markers are removed, corresponding animation frames are cancelled and layers/sources are removed
2. **Component Unmount**: When the component unmounts, all animations are stopped
3. **Marker Count Changes**: The component detects when marker arrays change and updates accordingly

## Visual Effect

The pulse animation creates a **ripple effect** that:
- ✅ Draws attention to power generation facilities
- ✅ Provides visual feedback for marker locations
- ✅ Scales with facility capacity (larger facilities = larger pulses)
- ✅ Maintains color consistency with markers
- ✅ Synchronizes across all markers for cohesive animation

## Dependencies

- **Mapbox GL JS**: For map rendering and layer management
- **React**: For component lifecycle and state management
- **requestAnimationFrame**: For smooth animation loop

## Related Files

- `src/components/Map/components/Cards/OSMCall.jsx` - Marker creation and integration
- `src/components/Map/components/Cards/GasHydroPowerPulseAnimations.jsx` - Pulse animation implementation
- `src/components/Map/components/Cards/OGEPowerPulseAnimations.jsx` - Similar system for OG&E markers

## Future Enhancements

Potential improvements:
- [ ] Add pulse animation for solar markers
- [ ] Make colors configurable via props
- [ ] Add pulse intensity based on real-time generation data
- [ ] Support multiple simultaneous pulses per marker
- [ ] Add sound effects synchronized with pulses

