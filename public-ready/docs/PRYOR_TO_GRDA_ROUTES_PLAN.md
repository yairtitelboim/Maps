# Pryor to GRDA Routes - Implementation Plan

## Overview
Create a transit path system that connects the Pryor red marker to all GRDA power generation facility markers. Routes should be displayed in blue, and both GRDA markers and routes should be triggered by the blue Perplexity button in NestedCircleButton.jsx.

## Current System Analysis

### How Stillwater-to-OG&E Routes Work (Reference Implementation)
1. **Route Generation**: 
   - Script: `scripts/create_stillwater_to_oge_routes.py`
   - Uses OSRM routing API
   - Creates GeoJSON files in `public/data/okc_campuses/`
   - Routes connect Stillwater marker to OG&E facilities

2. **Route Loading**:
   - Function: `addStillwaterToOGERoutes()` in `FirecrawlCall.jsx`
   - Triggered when Firecrawl button is clicked
   - Creates orange route layers and particle animation
   - Checks if Stillwater marker exists before loading

3. **Particle Animation**:
   - Component: `StillwaterOGERouteLayer.jsx`
   - Animates particles along routes
   - Listens for `stillwater-oge-route:ready` event

### Current GRDA Markers System
1. **Marker Creation**:
   - Function: `addGRDAPowerMarkers()` in `OSMCall.jsx` (line 482)
   - Currently triggered when OSM button is clicked (line 1160)
   - Loads data from `/data/grda/firecrawl_capacity_data.json`
   - Creates colored teardrop markers:
     - Hydro: Cyan (`#06b6d4`)
     - Wind: Green (`#10b981`)
     - Gas: Orange (`#f97316`)
   - Stores markers in `window.okGRDAPowerMarkers`

2. **GRDA Facilities** (from `data/grda/firecrawl_capacity_data.json`):
   - Pensacola Dam: 36.4675, -95.04139 (Hydro, 126 MW)
   - Robert S. Kerr Dam: 36.0831, -95.1167 (Hydro, 128 MW)
   - Salina Pumped Storage Project: 36.292, -95.152 (Hydro, 260 MW)
   - Wind Generation: 35.4676, -97.5164 (Wind, 385 MW)
   - Redbud Power Plant: 36.2831, -95.1167 (Gas, 457 MW)

3. **Pryor Marker**:
   - Location: 36.2411, -95.3301 (MidAmerica Industrial Park)
   - Created in `addCampusTeardropMarkers()` in `OSMCall.jsx`
   - Red marker (`#ef4444`) - lighter red, same as Stillwater

### Current Perplexity Button
1. **Location**: `NestedCircleButton.jsx` (line 1008-1031)
2. **Current Behavior**: 
   - Toggles Perplexity mode (`onPerplexityModeToggle()`)
   - Blue color: `rgba(59, 130, 246, 0.8)` or `rgba(59, 130, 246, 1)` when active
   - Component: `PerplexityCall.jsx`
3. **PerplexityCall.jsx**:
   - Currently loads gentrification analysis data
   - Has `loadGentrificationAnalysis()` function
   - Not currently related to GRDA markers

## Implementation Plan

### Phase 1: Route Generation Script
**File**: `scripts/create_pryor_to_grda_routes.py`

**Tasks**:
1. Create new Python script similar to `create_stillwater_to_oge_routes.py`
2. Define Pryor coordinates: `(36.2411, -95.3301)`
3. Extract GRDA facility coordinates from `data/grda/firecrawl_capacity_data.json`
4. Generate routes from Pryor to each GRDA facility using OSRM API
5. Save GeoJSON files to `public/data/okc_campuses/` with naming convention:
   - `pryor_to_pensacola_dam.geojson`
   - `pryor_to_robert_s_kerr_dam.geojson`
   - `pryor_to_salina_pumped_storage_project.geojson`
   - `pryor_to_wind_generation.geojson`
   - `pryor_to_redbud_power_plant.geojson`

**Note**: Some facilities may share coordinates (check data). Handle duplicates similar to Stillwater-to-OG&E script.

### Phase 2: Move GRDA Marker Loading to PerplexityCall
**File**: `src/components/Map/components/Cards/PerplexityCall.jsx`

**Current State**:
- PerplexityCall.jsx loads gentrification analysis
- GRDA markers are loaded in OSMCall.jsx when OSM button is clicked

**Changes Needed**:
1. **Option A (Recommended)**: Add GRDA marker loading to PerplexityCall.jsx
   - Import `addGRDAPowerMarkers` function from OSMCall.jsx OR
   - Create new function in PerplexityCall.jsx that loads GRDA markers
   - Call it when Perplexity button is clicked
   - Keep gentrification functionality separate (maybe toggle between modes?)

2. **Option B**: Keep GRDA markers in OSMCall but add route loading to PerplexityCall
   - Less ideal - markers and routes should be together

**Recommendation**: Option A - Add GRDA marker loading to PerplexityCall.jsx when button is clicked. This makes the Perplexity button the trigger for both GRDA markers and routes.

### Phase 3: Add Route Loading Function
**File**: `src/components/Map/components/Cards/PerplexityCall.jsx`

**Tasks**:
1. Create `addPryorToGRDARoutes()` function (similar to `addStillwaterToOGERoutes()`)
2. Check if Pryor marker exists before loading routes
3. Load route GeoJSON files from `public/data/okc_campuses/`
4. Create route layer with **blue color** (`#3b82f6` or `#2563eb`)
5. Create particle source and layer with light blue particles (`#60a5fa` or `#93c5fd`)
6. Emit `pryor-grda-route:ready` event when ready

**Color Scheme**:
- Route line: Blue (`#3b82f6` or `#2563eb`) - matches Perplexity button color
- Particles: Light blue (`#60a5fa` or `#93c5fd`)
- Line width: 1.5px
- Line opacity: 0.6

### Phase 4: Particle Animation Component
**File**: `src/components/Map/components/PryorGRDARouteLayer.jsx`

**Tasks**:
1. Create new component similar to `StillwaterOGERouteLayer.jsx`
2. Extract coordinates from Pryor-to-GRDA route GeoJSON
3. Animate 120 particles along routes
4. Listen for `pryor-grda-route:ready` event
5. Use light blue particles

### Phase 5: Integration
**Files**: 
- `src/components/Map/components/LayerToggle.jsx`
- `src/components/Map/components/Cards/PerplexityCall.jsx`

**Tasks**:
1. Add `PryorGRDARouteLayer` component to `LayerToggle.jsx`
2. Add state for route visibility: `showPryorGRDARoutes`
3. Update `PerplexityCall.jsx` to:
   - Load GRDA markers when button is clicked
   - Load Pryor-to-GRDA routes after markers are loaded
   - Check if Pryor marker exists before loading routes

### Phase 6: Remove GRDA Markers from OSM Button
**File**: `src/components/Map/components/Cards/OSMCall.jsx`

**Tasks**:
1. Remove or comment out `addGRDAPowerMarkers()` call from OSM button handler (line 1160)
2. Keep the function definition (it will be called from PerplexityCall instead)
3. Ensure GRDA markers are only loaded via Perplexity button

**Alternative**: Keep GRDA markers in OSM button but add routes only via Perplexity button. However, this splits functionality - better to have both markers and routes together.

## Implementation Steps

### Step 1: Create Route Generation Script
```bash
cd scripts
python create_pryor_to_grda_routes.py
```

### Step 2: Update PerplexityCall.jsx
- Add GRDA marker loading function
- Add route loading function
- Update button click handler to load both

### Step 3: Create Particle Animation Component
- Create `PryorGRDARouteLayer.jsx`
- Add to `LayerToggle.jsx`

### Step 4: Remove GRDA from OSM Button
- Remove `addGRDAPowerMarkers()` call from OSMCall.jsx handler
- Test that GRDA markers only appear via Perplexity button

### Step 5: Testing
- Verify routes appear when Perplexity button clicked
- Verify routes connect Pryor to all GRDA facilities
- Verify particle animation works
- Verify blue color scheme
- Verify Pryor marker must exist for routes to load

## Technical Considerations

### Coordinate Verification
- Pryor: 36.2411, -95.3301 (confirmed in OSMCall.jsx)
- GRDA facilities: Verify all coordinates in `firecrawl_capacity_data.json`

### Duplicate Coordinates
- Check if any GRDA facilities share coordinates
- Handle similar to Stillwater-to-OG&E script

### Route File Naming
- Follow convention: `pryor_to_{facility_name}.geojson`
- Use lowercase, underscores, handle special characters
- Example: `pryor_to_robert_s_kerr_dam.geojson`

### Color Scheme
- **Route Line**: Blue `#3b82f6` (matches Perplexity button blue)
- **Particles**: Light blue `#60a5fa`
- **Distinct from**: 
  - Green transit paths (`#22c55e`)
  - Orange OG&E routes (`#f97316`)

### Trigger Behavior
- **Current**: Perplexity button toggles Perplexity mode
- **New**: Perplexity button should:
  - Load GRDA markers (if not already loaded)
  - Load Pryor-to-GRDA routes (if Pryor marker exists)
  - May need to preserve Perplexity mode toggle OR
  - Make it a separate action (click to load GRDA, long-press for Perplexity mode?)

**Decision Needed**: Should Perplexity button:
- **Option A**: Always load GRDA markers/routes (replace current behavior)
- **Option B**: Load GRDA on first click, toggle Perplexity mode on second click
- **Option C**: Load GRDA markers/routes AND toggle Perplexity mode (both happen)

**Recommendation**: Option A - Make Perplexity button load GRDA markers and routes. Perplexity mode can be accessed via other means if needed, or we can add a separate toggle.

## Files to Create/Modify

### New Files:
1. `scripts/create_pryor_to_grda_routes.py` - Route generation script
2. `src/components/Map/components/PryorGRDARouteLayer.jsx` - Particle animation component

### Files to Modify:
1. `src/components/Map/components/Cards/PerplexityCall.jsx` - Add GRDA marker and route loading
2. `src/components/Map/components/Cards/OSMCall.jsx` - Remove GRDA marker loading from OSM button
3. `src/components/Map/components/LayerToggle.jsx` - Add PryorGRDARouteLayer component

## Success Criteria
- ✅ Routes generated from Pryor to all GRDA facilities
- ✅ Routes load when Perplexity button is clicked
- ✅ GRDA markers load when Perplexity button is clicked
- ✅ Routes visible on map with blue styling
- ✅ Particle animation works along routes
- ✅ Routes only appear when Pryor marker exists
- ✅ Routes visually distinct from other route systems
- ✅ GRDA markers no longer appear via OSM button

## Questions to Resolve

1. **Perplexity Mode**: Should Perplexity mode functionality be preserved? If so, how?
   - Separate button?
   - Different click pattern?
   - Both happen simultaneously?

2. **Gentrification Analysis**: Current PerplexityCall loads gentrification data. Should this:
   - Be moved to a different button?
   - Coexist with GRDA loading?
   - Be replaced by GRDA loading?

3. **GRDA Marker Timing**: Should GRDA markers:
   - Only load via Perplexity button (remove from OSM)?
   - Load via both OSM and Perplexity (routes only via Perplexity)?

**Recommendation**: 
- Move GRDA markers to Perplexity button only
- Move gentrification to a different button or keep it separate
- Make Perplexity button the primary trigger for GRDA infrastructure visualization

