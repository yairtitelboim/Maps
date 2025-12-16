# Blue Path Animation Implementation Plan

## Overview
Create a new blue path animation for the 5th card ("Infrastructure Siting") that uses the Seattle pattern (`MapboxLayer`) to eliminate drift, while keeping the existing red animation (4th card) unchanged.

## Key Differences: Seattle Pattern vs Current Pattern

### Seattle Pattern (No Drift) ✅
- Uses `MapboxLayer` from `@deck.gl/mapbox` (older API, but stable)
- Directly integrates with Mapbox's layer system via `map.addLayer()`
- Mapbox controls the render loop - no manual sync needed
- Animation loop only updates `currentTime` via `layerRef.current.setProps({ currentTime })`
- No `viewState` management required

### Current Pattern (Has Drift) ⚠️
- Uses `MapboxOverlay` from `@deck.gl/mapbox` (newer API)
- Separate overlay control that needs manual camera sync
- Requires `interleaved: true` and manual view state management
- More complex lifecycle management

## Implementation Plan

### Phase 1: Create New Component
**File**: `src/components/Map/components/InfrastructureSitingPathAnimation.jsx`

**Key Features**:
1. Use `MapboxLayer` instead of `MapboxOverlay`
2. Load same route files as red animation (`INFRASTRUCTURE_ROUTE_FILES`)
3. Use blue color: `[59, 130, 246, 200]` (blue-500 with alpha)
4. Same particle system (multiple particles per route, staggered timestamps)
5. Same animation loop pattern as Seattle (update `currentTime` only)
6. Layer ID: `'infrastructure-siting-path-animation'`

**Structure**:
```javascript
- resolveMapInstance() - same as Seattle
- loadRoutes() - fetch GeoJSON files, convert to trips
- buildTrips() - create trip data with blue colors
- Animation loop - update currentTime via setProps
- Layer management - add/remove MapboxLayer
```

### Phase 2: Wire to 5th Card
**File**: `src/components/Map/components/AITransmissionNav.jsx`

**Changes**:
1. Import new component: `InfrastructureSitingPathAnimation`
2. Add state: `showInfrastructureSitingAnimation`
3. Add timeout ref: `infrastructureSitingAnimationTimeoutRef`
4. In `playWorkflow`, check for `workflowIndex === 4` ("Infrastructure Siting")
5. Set `showInfrastructureSitingAnimation(true)` and schedule timeout (20 seconds)
6. Render component conditionally: `{map?.current && showInfrastructureSitingAnimation && <InfrastructureSitingPathAnimation map={map} />}`

## Technical Details

### Color Scheme
- **Red Animation (4th card)**: `[239, 68, 68, 200]` (red-500)
- **Blue Animation (5th card)**: `[59, 130, 246, 200]` (blue-500)

### Route Files
Both animations use the same route files:
- `/data/okc_campuses/pryor_to_stillwater.geojson`
- `/data/okc_campuses/pryor_to_inola.geojson`
- ... (all 12 files)

### Animation Parameters
- `PARTICLES_PER_ROUTE`: 15 (same as red)
- `TRIP_DURATION`: 10000ms (same as red)
- `LOOP_LENGTH`: `TRIP_DURATION * PARTICLES_PER_ROUTE`
- `trailLength`: 6000ms (same as red)
- `getWidth`: 8 (same as red)

### Layer Configuration
```javascript
new MapboxLayer({
  id: 'infrastructure-siting-path-animation',
  type: TripsLayer,
  data: trips,
  getPath: (d) => d?.path || [],
  getTimestamps: (d) => d?.timestamps || [],
  getColor: (d) => d?.color || [59, 130, 246, 200], // Blue
  getWidth: 8,
  widthMinPixels: 4,
  widthMaxPixels: 10,
  trailLength: 6000,
  currentTime: 0,
  loopLength: LOOP_LENGTH,
  fadeTrail: true,
  capRounded: true,
  jointRounded: true,
  opacity: 0.9
})
```

## File Structure
```
src/components/Map/components/
├── DeckGLOverlayManager.jsx (existing - red animation, keep as-is)
├── InfrastructureSitingPathAnimation.jsx (new - blue animation)
└── AITransmissionNav.jsx (modify - add trigger)
```

## Testing Checklist
- [ ] Blue animation appears when clicking 5th card
- [ ] Blue animation stays synced during pitch/zoom/rotate
- [ ] Red animation (4th card) still works independently
- [ ] Both animations can run simultaneously without conflicts
- [ ] Blue animation auto-hides after 20 seconds
- [ ] No console errors
- [ ] Performance is acceptable

## Notes
- The blue animation is completely separate from `DeckGLOverlayManager`
- Uses the proven Seattle pattern that eliminates drift
- Keeps existing red animation unchanged (no risk to working code)
- Both animations can coexist since they use different layer IDs

