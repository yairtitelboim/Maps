# Stillwater to OG&E Routes - Implementation Plan

## Overview
Create a transit path system similar to the existing "Transit Path" that connects the Stillwater red marker to all OG&E power generation facility markers.

## Current System Analysis

### How Transit Path Works
1. **Route Generation**: 
   - Script: `scripts/create_okc_infrastructure_routes.py`
   - Uses OSRM (Open Source Routing Machine) API to generate routes
   - Creates GeoJSON files in `public/data/okc_campuses/`
   - Routes connect red markers (campus/infrastructure sites) to each other and GRDA facilities

2. **Route Loading**:
   - Function: `addTransitPathLayers()` in `src/components/Map/components/Cards/OSMCall.jsx`
   - Loads multiple GeoJSON route files
   - Creates two layers:
     - **Route Layer**: Green line (`#22c55e`) with 0.5 opacity, 1px width
     - **Particle Layer**: Animated light green particles (`#86efac`) that move along routes
   - Layers are hidden by default, controlled by legend toggle

3. **Particle Animation**:
   - Component: `src/components/Map/components/OKCCampusesRouteLayer.jsx`
   - Extracts coordinates from route GeoJSON
   - Animates 120 particles moving along routes
   - Uses `requestAnimationFrame` for smooth animation

4. **Legend Integration**:
   - Legend entry in `src/components/Map/legend/utils/buildLegendSections.js`
   - Toggle handled in `src/components/Map/components/Cards/LegendContainer.jsx`
   - Event bus: `okc-campuses-route:toggle` and `okc-campuses-route:ready`

### OG&E Markers System
1. **Marker Creation**:
   - Function: `addOGEPowerMarkers()` in `src/components/Map/components/Cards/FirecrawlCall.jsx`
   - Loads data from `/data/oge/firecrawl_capacity_data.json`
   - Creates colored teardrop markers based on fuel type:
     - Gas: Orange (`#f97316`)
     - Coal: Yellow (`#fbbf24`)
     - Wind: Green (`#10b981`)
     - Solar: Amber (`#f59e0b`)
   - Stores markers in `window.okOGEPowerMarkers`

2. **OG&E Facilities** (from `firecrawl_capacity_data.json`):
   - Mustang Power Plant: 35.3928, -97.7247 (Gas, 1200 MW)
   - Seminole Power Plant: 35.2244, -96.6703 (Gas, 1200 MW)
   - Sooner Power Plant: 36.2831, -97.5164 (Gas, 1200 MW)
   - Frontier Power Plant: 36.1156, -97.0584 (Gas, 1200 MW) - **Note: This is the old Stillwater location, needs update**
   - Riverside Power Plant: 35.4676, -97.5164 (Gas, 600 MW)
   - Horseshoe Lake Power Plant: 35.4676, -97.5164 (Gas, 400 MW)
   - Chouteau Power Plant: 36.1887, -95.289 (Coal, 520 MW)
   - Muskogee Power Plant: 35.7479, -95.3697 (Coal, 1046 MW)
   - OG&E Wind Farms: 35.4676, -97.5164 (Wind, 498 MW)
   - OG&E Solar Farms: 35.4676, -97.5164 (Solar, 285 MW)

3. **Stillwater Marker**:
   - Location: 36.150317, -97.051131 (N Perkins Rd & E Richmond Rd)
   - Created in `addCampusTeardropMarkers()` in `OSMCall.jsx`
   - Red marker (`#ef4444`)

## Implementation Plan

### Phase 1: Route Generation Script
**File**: `scripts/create_stillwater_to_oge_routes.py`

**Tasks**:
1. Create new Python script similar to `create_okc_infrastructure_routes.py`
2. Define Stillwater coordinates: `(36.150317, -97.051131)`
3. Extract OG&E facility coordinates from `data/oge/firecrawl_capacity_data.json`
4. Generate routes from Stillwater to each OG&E facility using OSRM API
5. Save GeoJSON files to `public/data/okc_campuses/` with naming convention:
   - `stillwater_to_mustang_power_plant.geojson`
   - `stillwater_to_seminole_power_plant.geojson`
   - `stillwater_to_sooner_power_plant.geojson`
   - `stillwater_to_frontier_power_plant.geojson`
   - `stillwater_to_riverside_power_plant.geojson`
   - `stillwater_to_horseshoe_lake_power_plant.geojson`
   - `stillwater_to_chouteau_power_plant.geojson`
   - `stillwater_to_muskogee_power_plant.geojson`
   - `stillwater_to_oge_wind_farms.geojson`
   - `stillwater_to_oge_solar_farms.geojson`

**Note**: Some facilities share coordinates (Riverside, Horseshoe Lake, Wind Farms, Solar Farms all at 35.4676, -97.5164). May need to handle duplicates or create single route with multiple endpoints.

### Phase 2: Frontend Route Loading
**File**: `src/components/Map/components/Cards/OSMCall.jsx` or new component

**Options**:
- **Option A**: Add to existing `addTransitPathLayers()` function
  - Add Stillwater-to-OG&E route files to `DEFAULT_SEGMENT_FILES` array
  - Use same green color scheme
  - Pros: Reuses existing infrastructure
  - Cons: Mixes different route types

- **Option B**: Create separate function `addStillwaterToOGERoutes()`
  - New source/layer IDs: `stillwater-oge-route-source`, `stillwater-oge-route-layer`
  - Different color to distinguish (e.g., blue `#3b82f6` or orange `#f97316` to match OG&E theme)
  - Separate particle layer: `stillwater-oge-route-particles`
  - Pros: Clear separation, can style differently
  - Cons: More code duplication

**Recommendation**: Option B for better visual distinction and maintainability.

### Phase 3: Particle Animation
**File**: New component or extend `OKCCampusesRouteLayer.jsx`

**Tasks**:
1. Extract coordinates from Stillwater-to-OG&E route GeoJSON
2. Animate particles along routes (similar to existing system)
3. Use same animation parameters (120 particles, speed 0.000007)
4. Different particle color to match route color scheme

### Phase 4: Legend Integration
**Files**: 
- `src/components/Map/legend/utils/buildLegendSections.js`
- `src/components/Map/components/Cards/LegendContainer.jsx`

**Tasks**:
1. Add new legend entry: "Stillwater to OG&E Routes" or "OG&E Power Connections"
2. Add toggle handler in `LegendContainer.jsx`
3. Create event bus events: `stillwater-oge-route:ready`, `stillwater-oge-route:toggle`
4. Show in legend when OG&E markers are visible or when Stillwater marker exists

### Phase 5: Triggering
**Decision Point**: When should routes be loaded?

**Options**:
- **Option A**: Load when OSM button is clicked (Stillwater marker appears)
  - Add route loading to `addTransitPathLayers()` or new function in `OSMCall.jsx`
  - Routes appear when Stillwater infrastructure is loaded
  - Pros: Consistent with existing transit path behavior
  - Cons: Routes appear even if OG&E markers aren't visible

- **Option B**: Load when OG&E markers are created (Firecrawl button)
  - Add route loading to `addOGEPowerMarkers()` in `FirecrawlCall.jsx`
  - Routes appear when OG&E power facilities are shown
  - Pros: Routes only appear when relevant markers are visible
  - Cons: Requires Stillwater marker to exist first

- **Option C**: Load when both Stillwater and OG&E markers are visible
  - Check for both marker sets before loading routes
  - Pros: Most logical - routes connect visible markers
  - Cons: More complex logic

**Recommendation**: Option A (load with OSM button) for consistency, but add visibility check to only show routes when OG&E markers exist.

### Phase 6: Visual Design
**Color Scheme Options**:
1. **Orange** (`#f97316`): Matches OG&E gas power color, distinct from green transit paths
2. **Blue** (`#3b82f6`): Matches OG&E default color, professional look
3. **Amber/Yellow** (`#f59e0b` or `#fbbf24`): Matches OG&E solar/coal colors
4. **Cyan** (`#06b6d4`): Distinct from all existing colors

**Recommendation**: Orange (`#f97316`) to match OG&E gas power theme and create visual connection.

**Line Style**:
- Width: 1.5px (slightly thicker than transit paths to stand out)
- Opacity: 0.6 (more visible than transit paths)
- Dash pattern: Optional dashed line to distinguish from solid transit paths

**Particle Style**:
- Color: Light orange (`#fb923c` or `#fdba74`)
- Size: 3px (same as transit paths)
- Opacity: 0.9

## Implementation Steps

### Step 1: Create Route Generation Script
```bash
cd scripts
python create_stillwater_to_oge_routes.py
```

### Step 2: Update Frontend Route Loading
- Add `addStillwaterToOGERoutes()` function to `OSMCall.jsx` or create new component
- Load routes when OSM button is clicked (Stillwater marker appears)
- Use orange color scheme

### Step 3: Add Particle Animation
- Create or extend component for particle animation
- Extract coordinates and animate particles

### Step 4: Add Legend Entry
- Add to `buildLegendSections.js`
- Add toggle handler to `LegendContainer.jsx`
- Create event bus integration

### Step 5: Testing
- Verify routes appear when OSM button clicked
- Verify routes connect Stillwater to all OG&E facilities
- Verify particle animation works
- Verify legend toggle works
- Verify routes are visually distinct from transit paths

## Technical Considerations

### Coordinate Updates Needed
- **Frontier Power Plant** in OG&E data uses old Stillwater coordinates (36.1156, -97.0584)
- Should update to actual Frontier location or verify coordinates
- Stillwater marker now uses: 36.150317, -97.051131

### Duplicate Coordinates
- Multiple OG&E facilities share coordinates (35.4676, -97.5164):
  - Riverside Power Plant
  - Horseshoe Lake Power Plant
  - OG&E Wind Farms
  - OG&E Solar Farms
- **Solution**: Create single route to shared location, or use slightly offset coordinates for visual distinction

### Route File Naming
- Follow existing convention: `{start}_to_{end}.geojson`
- Use lowercase, underscores, handle special characters
- Example: `stillwater_to_mustang_power_plant.geojson`

### Performance
- Multiple routes (10+ files) may impact load time
- Consider lazy loading or loading routes on-demand
- Particle animation should handle multiple routes efficiently

## Files to Create/Modify

### New Files:
1. `scripts/create_stillwater_to_oge_routes.py` - Route generation script
2. `src/components/Map/components/StillwaterOGERouteLayer.jsx` - Optional: separate component for OG&E routes

### Files to Modify:
1. `src/components/Map/components/Cards/OSMCall.jsx` - Add route loading function
2. `src/components/Map/legend/utils/buildLegendSections.js` - Add legend entry
3. `src/components/Map/components/Cards/LegendContainer.jsx` - Add toggle handler
4. `data/oge/firecrawl_capacity_data.json` - Verify/update coordinates if needed

## Success Criteria
- ✅ Routes generated from Stillwater to all OG&E facilities
- ✅ Routes load when OSM button is clicked
- ✅ Routes visible on map with distinct styling
- ✅ Particle animation works along routes
- ✅ Legend toggle controls route visibility
- ✅ Routes visually distinct from existing transit paths
- ✅ Performance acceptable with multiple routes

