<!-- 20decc9f-f327-460a-bf8a-0ff96db1c3ce 2b0c82d8-4993-4b81-86c2-c9f08c079442 -->
# OKC Neighborhoods Layer Implementation Plan

## Overview

Implement an "OKC Neighborhoods" toggle layer that displays Oklahoma City census tract boundaries with stroke outlines. When a tract is clicked, load and display 3D buildings within that tract's boundary. This follows the same pattern as the Denver Neighborhoods layer.

## Implementation Steps

### 1. Convert Shapefile to GeoJSON

- **File**: Create conversion script or use existing tool
- **Input**: `/Users/yairtitelboim/Documents/Kernel/ALLAPPS/OKC/public/tl_2021_40_tract/tl_2021_40_tract.shp`
- **Output**: `/Users/yairtitelboim/Documents/Kernel/ALLAPPS/OKC/public/okc_census_tracts.geojson`
- **Process**: 
  - Use Python with `geopandas` or `fiona` to read shapefile
  - Convert to GeoJSON format
  - Ensure coordinate system is WGS84 (EPSG:4326)
  - Preserve all attribute fields (GEOID, NAME, etc.)

### 2. Create OKCNeighborhoodsLayer Component

- **File**: `src/components/Map/components/OKCNeighborhoodsLayer.jsx`
- **Pattern**: Follow `DenverNeighborhoodsLayer.jsx` structure
- **Features**:
  - Load GeoJSON source from `/okc_census_tracts.geojson`
  - Add invisible fill layer for hit testing (0.01 opacity)
  - Add stroke layer showing boundaries (visible on hover)
  - Add selected fill layer (20% opacity for clicked tract)
  - Handle mouse move for hover highlighting
  - Handle click to select tract and load 3D buildings
  - Display popup with tract information
- **Layer IDs**:
  - `okc-neighborhoods-source`
  - `okc-neighborhoods-layer` (base fill)
  - `okc-neighborhoods-hover-layer` (stroke on hover)
  - `okc-neighborhoods-selected-layer` (fill on click)
  - `okc-neighborhood-buildings-source`
  - `okc-neighborhood-buildings-layer` (3D extrusion)
- **3D Buildings**:
  - Use `fill-extrusion` layer type
  - Load buildings from OSM or separate GeoJSON per tract
  - Height from `height_m` or `levels * 3` fallback
  - Color: Use OKC theme color (suggest blue #3B82F6 or green #22c55e)

### 3. Add State Management in Map Component

- **File**: `src/components/Map/index.jsx`
- **Changes**:
  - Add `const [showOKCNeighborhoods, setShowOKCNeighborhoods] = useState(false);` around line 373
  - Add state to `layerStates` object (around line 424)
  - Add to `useEffect` dependencies for layer state updates (around line 492)
  - Pass props to `LayerToggle` component (around line 1713):
    ```jsx
    showOKCNeighborhoods={showOKCNeighborhoods}
    setShowOKCNeighborhoods={setShowOKCNeighborhoods}
    ```


### 4. Update LayerToggle Component

- **File**: `src/components/Map/components/LayerToggle.jsx`
- **Changes**:
  - Import `OKCNeighborhoodsLayer` at top (around line 24)
  - Add props to component signature (around line 73):
    ```jsx
    showOKCNeighborhoods,
    setShowOKCNeighborhoods,
    ```

  - Add to `onTransmissionLayerStateUpdate` effect (around line 200):
    - Include in `stateToSend` object
    - Add to dependency array
  - Add to `updateLayerStates` in `useImperativeHandle` (around line 344)
  - Add to `SceneManager` `layerStates` prop (around line 1941)
  - Add to `onLoadScene` handler (around line 1982)
  - Add toggle UI section (around line 1050, after Landcover section):
    ```jsx
    <CategorySection>
      <CategoryHeader onClick={() => setShowOKCNeighborhoods(v => !v)}>
        <CategoryIcon>...</CategoryIcon>
        <CategoryTitle>OKC Neighborhoods</CategoryTitle>
        <ToggleSwitch>...</ToggleSwitch>
      </CategoryHeader>
    </CategorySection>
    ```

  - Render component: `<OKCNeighborhoodsLayer map={map} visible={showOKCNeighborhoods} />`

### 5. Building Data Strategy

- **Option A**: Use OSM buildings filtered by tract boundary
  - Query OSM buildings within clicked tract geometry
  - Use existing OSM building data if available
- **Option B**: Pre-processed building GeoJSON files
  - Create index file similar to Denver: `neighborhood_buildings/neighborhood_index.json`
  - Store per-tract building files in `public/neighborhood_buildings/`
  - Index format: `{ "GEOID": { "name": "...", "building_count": N, "file_path": "..." } }`
- **Recommendation**: Start with Option A (OSM query), add Option B if performance requires it

### 6. Testing & Refinement

- Verify GeoJSON loads correctly
- Test hover highlighting works
- Test click selection and popup display
- Test 3D buildings load and display correctly
- Verify cleanup on toggle off
- Check performance with large building datasets

## Files to Create/Modify

**New Files:**

- `src/components/Map/components/OKCNeighborhoodsLayer.jsx`
- `public/okc_census_tracts.geojson` (after conversion)
- `scripts/convert_shapefile_to_geojson.py` (if needed)

**Modified Files:**

- `src/components/Map/index.jsx` (state management)
- `src/components/Map/components/LayerToggle.jsx` (toggle UI and integration)

## Key Implementation Details

1. **Unique ID Field**: Use `GEOID` from census tract data (similar to `NBHD_ID` in Denver)
2. **Color Scheme**: Use blue (#3B82F6) for OKC to differentiate from Denver's green
3. **Building Height**: Extract from OSM `height` or `building:levels` properties
4. **Popup Content**: Display GEOID, NAME, and building count when loaded
5. **Error Handling**: Gracefully handle missing building data or failed loads

## Dependencies

- `geopandas` or `fiona` for shapefile conversion (Python)
- Existing Mapbox GL JS setup
- `@turf/turf` for geometry operations (already in project)

### To-dos

- [x] Convert shapefile to GeoJSON format using Python script with geopandas/fiona
- [x] Create OKCNeighborhoodsLayer.jsx component following Denver pattern with stroke outlines, hover, click selection, and 3D buildings
- [x] Add showOKCNeighborhoods state to Map component and pass to LayerToggle
- [x] Add OKC Neighborhoods toggle UI section and integrate OKCNeighborhoodsLayer component in LayerToggle.jsx
- [x] Implement 3D building loading on tract click - either OSM query or pre-processed GeoJSON files
- [x] Test full integration: toggle on/off, hover highlighting, click selection, popup display, and 3D building rendering

## Code Cleanup & Bug Fixes (Post-Implementation)

### 1. Console Log Cleanup
- **Files Modified**: Multiple source files
- **Changes**:
  - Removed all `console.log` debug statements from production code
  - Preserved `console.error` and `console.warn` for actual errors/warnings
  - **Files Cleaned**:
    - `OKCNeighborhoodsLayer.jsx` - Removed 5 console.log statements
    - `index.jsx` - Removed 8 console.log statements
    - `LayerToggle.jsx` - Removed 19 console.log statements
    - `LoadingCard.jsx` - Removed 2 console.log statements
    - `TaylorCensusBlocksLayer.jsx` - Removed 8 console.log statements
    - `TaylorBuildingsLayer.jsx` - Removed 5 console.log statements
    - `PowerInfrastructureLayer.jsx` - Removed 2 console.log statements
    - `ToolExecutor.js` - Removed 2 console.log statements
    - `HolisticCacheManager.js` - Removed 1 console.log statement
    - `nodeAnimation.js` - Removed 1 console.warn statement
    - `OSMCall.jsx` - Removed 1 console.log statement

### 2. SVG Path Arc Flag Fixes
- **Issue**: SVG paths had arc commands with missing spaces between flags (e.g., `a2 2 0 00-2-2` instead of `a2 2 0 0 0-2-2`)
- **Error**: `Expected arc flag ('0' or '1')`
- **Files Fixed**:
  - `LayerToggle.jsx` - Fixed 3 paths with arc commands
  - `SceneManager.jsx` - Fixed 2 paths with arc commands
  - `VisualizationDisplay.jsx` - Fixed 5 paths with arc commands
  - `MessageList.jsx` - Fixed 3 paths with arc commands
- **Fix**: Added proper spacing between arc parameters (rx ry x-axis-rotation large-arc-flag sweep-flag x y)

### 3. Mapbox Filter Syntax Fixes
- **Issue**: Incorrect filter syntax causing "string expected, array found" errors
- **File**: `src/components/Map/components/Cards/OSMCall.jsx`
- **Fixes**:
  - Changed `['geometry-type']` to `'$type'` for geometry type checks (line 1192)
  - Changed `['!has', ['get', 'category']]` to `['!has', 'category']` (line 1193)
  - The `!has` operator expects a string property name, not an array expression
  - The `$type` keyword is the correct way to reference geometry type in Mapbox filters

### 4. Auto-Enable OKC Neighborhoods Layer
- **Feature**: Automatically enable OKC Neighborhoods layer 2 seconds after map initialization
- **File**: `src/components/Map/components/LayerToggle.jsx`
- **Implementation**:
  - Added `useEffect` hook (lines 348-384) that:
    - Waits for map style to load (if not already loaded)
    - Sets a 2-second timeout to enable the layer
    - Only runs once (skips if already enabled)
    - Properly cleans up timeouts and event listeners
- **Behavior**: Layer automatically toggles on 2 seconds after map initialization completes

## Summary of Changes

**Code Quality Improvements:**
- Removed 50+ console.log statements for cleaner production code
- Fixed 13+ SVG path syntax errors
- Fixed 2 Mapbox filter syntax errors

**Feature Enhancements:**
- Auto-enable OKC Neighborhoods layer on map load
- Improved error handling and code maintainability

