# Columbus Metro Area Migration Plan

## Overview

This document outlines a comprehensive phased plan to reconfigure the map application from focusing on Oklahoma (Stillwater/Pryor) to the Columbus, Ohio metro area. The migration involves updating geographic configurations, map initialization, data files, route layers, and multiple component integrations.

**Target Location:** Columbus, Ohio Metro Area  
**Coordinates:** ~39.9612° N, 82.9988° W (Columbus city center)  
**Metro Area:** Franklin County and surrounding counties (Delaware, Fairfield, Licking, Madison, Pickaway, Union)

---

## Quick Reference: Implementation Strategy Summary

### Key Principles
1. **Incremental Development:** Complete one phase before starting the next
2. **Feature Flags:** Use flags for safe rollback (`const USE_COLUMBUS = true`)
3. **Archive, Don't Delete:** Keep Oklahoma code commented for reference
4. **Test Continuously:** Test after each phase, not just at the end
5. **Version Control:** Tag commits at phase milestones for easy rollback

### Critical Phases (Highest Risk)
- **Phase 3.1 (OSMCall.jsx):** HIGH RISK - Complex component with many dependencies
- **Phase 6.4 (LegendContainer.jsx):** HIGH RISK - Large file (2000+ lines) with extensive Oklahoma-specific logic

### Recommended Implementation Order
1. **Phase 1** (Core Config) → Foundation, low risk
2. **Phase 2** (Map Components) → Verify foundation works
3. **Phase 3** (OSM Components) → Most complex, do incrementally
4. **Phase 4** (Data Files) → Archive systematically
5. **Phase 5** (Tool Integration) → Update tools one by one
6. **Phase 6** (Legend/UI) → Refactor incrementally
7. **Phase 7** (Scripts) → Archive, create new if needed
8. **Phase 8** (Testing) → Continuous throughout
9. **Phase 9** (Cleanup) → Final polish

### Testing Strategy
- **After each phase:** Verify no breaking changes
- **Isolation testing:** Test components independently
- **Integration testing:** Test components working together
- **Edge case testing:** Missing data, invalid locations, etc.

See **"Implementation Strategies"** section below for detailed step-by-step guidance.

---

## Phase 1: Core Geographic Configuration

### 1.1 Update Map Initialization Constants

**File:** `src/components/Map/constants.js`

**Changes Required:**
- Update `MAP_CONFIG.center` to Columbus coordinates
- Adjust `MAP_CONFIG.zoom` for metro area view
- Update any Columbus-specific bounds if needed

**Current State:**
```javascript
center: [-97.0584, 36.1156], // Stillwater, OK
zoom: 12,
```

**Target State:**
```javascript
center: [-82.9988, 39.9612], // Columbus, OH
zoom: 11, // Metro area view (adjust as needed)
```

**Dependencies:** None  
**Estimated Time:** 15 minutes  
**Risk Level:** Low

---

### 1.2 Update Geographic Configuration System

**File:** `src/config/geographicConfig.js`

**Changes Required:**
1. Update `default` location to Columbus
2. Add Columbus-specific configuration entry
3. Update or remove Oklahoma-specific entries (`google_stillwater_ok`, `google_pryor_ok`)
4. Update location display names and metadata

**Current State:**
- `default`: Stillwater, OK (36.1156, -97.0584)
- `google_stillwater_ok`: Stillwater, OK
- `google_pryor_ok`: Pryor, OK

**Target State:**
- `default`: Columbus, OH (39.9612, -82.9988)
- `columbus_metro`: Columbus Metro Area (optional separate entry)

**Key Fields to Update:**
- `coordinates`: { lat: 39.9612, lng: -82.9988 }
- `city`: 'Columbus'
- `state`: 'OH'
- `county`: 'Franklin County'
- `region`: 'Columbus Metro Area'
- `gridOperator`: 'AEP Ohio' (or appropriate utility)
- `timezone`: 'America/New_York'
- `searchRadius`: 10000 (meters - adjust for metro area)
- `businessContext`: Update to Columbus context
- `dataCenterCompany`: Update if applicable
- `facilityName`: Update if applicable

**Dependencies:** None  
**Estimated Time:** 30 minutes  
**Risk Level:** Low

---

### 1.3 Update Oklahoma Data Center Sites Configuration

**File:** `src/config/okDataCenterSites.js`

**Changes Required:**
- **Option A:** Rename file to `columbusDataCenterSites.js` and update all references
- **Option B:** Replace Oklahoma sites with Columbus sites (if applicable)
- **Option C:** Archive Oklahoma config and create new Columbus config

**Decision Needed:** Does Columbus have data center sites to map? If not, this file may be archived or repurposed.

**Files That Import This:**
- `src/components/Map/components/Cards/OSMCall.jsx`
- `src/components/Map/components/Cards/NestedCircleButton.jsx` (indirectly)

**Dependencies:** Phase 1.2  
**Estimated Time:** 1-2 hours (depending on decision)  
**Risk Level:** Medium (affects multiple components)

---

## Phase 2: Map Component Updates

### 2.1 Update Map Initialization Hook

**File:** `src/components/Map/hooks/useMapInitialization.js`

**Changes Required:**
- Verify map initialization uses updated `MAP_CONFIG` from constants
- No direct changes needed if using constants properly
- Test that map centers on Columbus on load

**Dependencies:** Phase 1.1  
**Estimated Time:** 15 minutes (testing)  
**Risk Level:** Low

---

### 2.2 Update Main Map Component

**File:** `src/components/Map/index.jsx`

**Changes Required:**
- Verify `currentLocation` state defaults to Columbus location key
- Update any hardcoded Oklahoma references
- Test map initialization with Columbus coordinates

**Dependencies:** Phase 1.1, Phase 1.2  
**Estimated Time:** 30 minutes  
**Risk Level:** Low

---

## Phase 2.5: Preprocessing Layer - OSM Data Generation

**⚠️ CRITICAL:** This phase should be completed BEFORE Phase 3, as Phase 3 depends on the generated OSM cache files.

### Overview

The preprocessing layer consists of Python scripts that generate cached OSM data files. These files are consumed by the frontend to avoid live Overpass API calls. For Columbus migration, we need to create new scripts or modify existing ones to generate Columbus-specific OSM data.

**Reference Document:** See `docs/COLUMBUS_PREPROCESSING_ANALYSIS.md` for complete analysis of the preprocessing pipeline.

### Key Scripts Requiring Updates

1. **`ok_data_center_osm.py`** → Create `columbus_metro_osm.py`
   - Generates comprehensive OSM infrastructure cache
   - Output: `public/osm/columbus_metro.json`
   - Based on: `nc_power_utility_osm.py` (simpler) or `ok_data_center_osm.py` (comprehensive)

2. **`ok_marker_pipelines_osm.py`** → Create `columbus_marker_pipelines_osm.py`
   - Generates pipeline data for teardrop markers (5-mile radius)
   - Output: `public/data/pipelines/pipeline_columbus_*.json`
   - Requires: Research on Columbus infrastructure markers

3. **`ok_expanded_pipeline_osm.py`** → Decision needed
   - Expanded pipeline coverage (50km radius)
   - May not be needed for Columbus

4. **`okc_tract_buildings_osm.py`** → Decision needed
   - Census tract building data
   - May use dynamic queries instead

### Implementation Steps

1. **Research Phase:**
   - Identify Columbus infrastructure markers (AEP Ohio substations, key facilities)
   - Identify key locations (OSU campus, downtown, industrial areas)
   - Determine if data center sites exist

2. **Script Creation:**
   - Create `columbus_metro_osm.py` with Columbus coordinates
   - Create `columbus_marker_pipelines_osm.py` with Columbus markers
   - Test scripts generate valid JSON files

3. **Data Generation:**
   - Run scripts to generate Columbus cache files
   - Verify output files are in correct format
   - Place files in `public/osm/` and `public/data/pipelines/`

4. **Frontend Integration:**
   - Update `useInfrastructureSites.js` to reference Columbus script
   - Update `okDataCenterSites.js` or create Columbus equivalent
   - Update `OSMCall.jsx` to load Columbus cache files

**Dependencies:** None (can run in parallel with Phase 1-2, but must complete before Phase 3)  
**Estimated Time:** 4-6 hours (including research)  
**Risk Level:** Medium (depends on Columbus infrastructure research)

---

## Phase 3: OSM Data and Infrastructure Components

### 3.1 Update OSMCall Component

**File:** `src/components/Map/components/Cards/OSMCall.jsx`

**Changes Required:**
1. **Remove Oklahoma-specific route files:**
   - Remove all `/data/okc_campuses/*.geojson` route file references
   - Remove `addTransitPathLayers()` function or update for Columbus routes
   - Remove `addCampusTeardropMarkers()` if Oklahoma-specific
   - Remove `addMarkerPipelines()` if Oklahoma-specific

2. **Update location detection logic:**
   - Remove `OK_DATA_CENTER_SITE_KEYS` checks
   - Update to use Columbus location keys
   - Update site detection for Columbus sites

3. **Update OSM data paths:**
   - Remove references to `/osm/ok_data_center_google_stillwater_ok.json`
   - Remove references to `/osm/ok_data_center_google_pryor_ok.json`
   - Add Columbus OSM data paths (if pre-cached) or use dynamic queries

4. **Update route layer loading:**
   - Remove `addTransitPathLayers()` calls
   - Remove Oklahoma infrastructure route loading
   - Add Columbus infrastructure routes (if applicable)

**Key Functions to Review:**
- `addSiteLayers()` - Update for Columbus sites
- `addCampusTeardropMarkers()` - Remove or update
- `addMarkerPipelines()` - Remove or update
- `addTransitPathLayers()` - Remove or update
- `handleClick()` - Update location-specific logic

**Dependencies:** Phase 1.3, **Phase 2.5 (CRITICAL - OSM cache files must exist)**  
**Estimated Time:** 3-4 hours  
**Risk Level:** High (complex component with many dependencies)

---

### 3.2 Update FirecrawlCall Component

**File:** `src/components/Map/components/Cards/FirecrawlCall.jsx`

**Changes Required:**
1. **Remove Stillwater-to-OG&E routes:**
   - Remove `addStillwaterToOGERoutes()` function
   - Remove all `/data/okc_campuses/stillwater_to_*.geojson` references
   - Remove OG&E power plant route loading

2. **Update for Columbus infrastructure:**
   - Add Columbus-specific infrastructure routes (if applicable)
   - Update power utility references (OG&E → AEP Ohio or appropriate)
   - Update facility names and locations

3. **Remove Oklahoma-specific event bus emissions:**
   - Remove Taylor buildings toggle logic (Texas-specific, but check for any references)
   - Update any location-specific layer toggles

**Key Functions to Review:**
- `addStillwaterToOGERoutes()` - Remove or replace
- Any Oklahoma-specific route loading logic

**Dependencies:** Phase 3.1  
**Estimated Time:** 2-3 hours  
**Risk Level:** Medium

---

### 3.3 Update Infrastructure Route Layers

**Files:**
- `src/components/Map/components/InfrastructureFlowAnimation.jsx`
- `src/components/Map/components/InfrastructureSitingPathAnimation.jsx`
- `src/components/Map/components/OKCCampusesRouteLayer.jsx`
- `src/components/Map/components/PryorStillwaterCircleAnimation.jsx`
- `src/components/Map/components/PryorGRDARouteLayer.jsx`
- `src/components/Map/components/StillwaterOGERouteLayer.jsx`

**Changes Required:**
1. **Archive or remove Oklahoma-specific components:**
   - `PryorStillwaterCircleAnimation.jsx` - Archive
   - `PryorGRDARouteLayer.jsx` - Archive
   - `StillwaterOGERouteLayer.jsx` - Archive
   - `OKCCampusesRouteLayer.jsx` - Archive or rename to Columbus equivalent

2. **Update route file references:**
   - Remove all `/data/okc_campuses/*.geojson` references
   - Create Columbus route files (if needed) or remove route animations

3. **Update animation components:**
   - `InfrastructureFlowAnimation.jsx` - Update route files array
   - `InfrastructureSitingPathAnimation.jsx` - Update route files array

**Decision Needed:** Do we need Columbus infrastructure route animations? If not, these components can be disabled/archived.

**Dependencies:** Phase 3.1  
**Estimated Time:** 2-4 hours  
**Risk Level:** Medium

---

### 3.4 Update OSM Tool

**File:** `src/utils/tools/OsmTool.js`

**Changes Required:**
1. **Remove Oklahoma-specific cached data checks:**
   - Remove any hardcoded Oklahoma location checks
   - Ensure location-agnostic OSM queries work for Columbus

2. **Update location detection:**
   - Verify Columbus coordinates trigger correct OSM queries
   - Update search radius logic if needed

**Dependencies:** Phase 1.2  
**Estimated Time:** 1 hour  
**Risk Level:** Low

---

### 3.5 Update Teardrop Markers and Particle Animations

**Files:**
- `src/components/Map/components/Cards/OSMCall.jsx` - `addCampusTeardropMarkers()`, `addMarkerPipelines()`
- `src/components/Map/osm/utils/layerAnimations.js` - `addPipelineParticles()`, `addTransportationParticles()`

**Changes Required:**
1. **Update campus teardrop markers:**
   - Replace Oklahoma campus locations with Columbus locations
   - Update `campuses` array in `addCampusTeardropMarkers()`
   - Update marker coordinates, addresses, utility information
   - Update marker colors if needed

2. **Update pipeline particles:**
   - Replace `markerKeys` array with Columbus marker keys
   - Update pipeline data file paths: `/data/pipelines/pipeline_*.json`
   - Create Columbus pipeline data files (5-mile radius around each marker)
   - Update `addPipelineParticles()` calls if marker structure changes

3. **Update transportation/route particles:**
   - Replace route file paths in `addTransitPathLayers()`
   - Update route file references from `/data/okc_campuses/*.geojson` to Columbus routes
   - Create Columbus route GeoJSON files if needed

4. **Update marker storage:**
   - Consider renaming `window.okCampusTeardropMarkers` to `window.columbusCampusTeardropMarkers`
   - Update all references to marker storage variables

**Reference Documentation:** See `docs/TEARDROP_MARKERS_AND_ANIMATIONS.md` for complete system documentation.

**Dependencies:** Phase 1.2, Phase 4.1, Phase 4.2  
**Estimated Time:** 3-4 hours  
**Risk Level:** Medium

---

## Phase 4: Data Files and Routes

### 4.1 Archive Oklahoma Route Data Files

**Directory:** `public/data/okc_campuses/`

**Changes Required:**
- Archive all `.geojson` route files
- Move to `archive/oklahoma-routes/` or similar
- Update any remaining references to these files

**Files to Archive:**
- All `pryor_to_*.geojson` files
- All `stillwater_to_*.geojson` files
- All other Oklahoma infrastructure route files
- `pryor_stillwater_circles.geojson`

**Dependencies:** Phase 3.1, Phase 3.2, Phase 3.3  
**Estimated Time:** 30 minutes  
**Risk Level:** Low

---

### 4.2 Archive Oklahoma Pipeline Data

**Directory:** `public/data/pipelines/`

**Changes Required:**
- Archive Oklahoma-specific pipeline JSON files
- Files like `pipeline_pryor.json`, `pipeline_stillwater.json`, etc.

**Dependencies:** Phase 3.1  
**Estimated Time:** 15 minutes  
**Risk Level:** Low

---

### 4.3 Update or Archive OSM Cache Files

**Directory:** `public/osm/` or `public/`

**Changes Required:**
- Archive `ok_data_center_google_stillwater_ok.json`
- Archive `ok_data_center_google_pryor_ok.json`
- Create Columbus OSM cache files (if pre-caching) or rely on dynamic queries

**Dependencies:** Phase 3.1  
**Estimated Time:** 30 minutes  
**Risk Level:** Low

---

### 4.4 Update Power Utility Data

**Directories:**
- `public/data/oge/` - OG&E data (Oklahoma-specific)
- `public/data/grda/` - GRDA data (Oklahoma-specific)

**Changes Required:**
- Archive Oklahoma utility data files
- Create Columbus utility data files (AEP Ohio, etc.) if needed
- Update utility data loading components

**Files to Review:**
- `src/components/Map/components/OGEPowerLegend.jsx`
- `src/components/Map/components/GRDAPowerLegend.jsx`
- `src/components/Map/components/Cards/OGEPowerPulseAnimations.jsx`

**Dependencies:** Phase 3.2  
**Estimated Time:** 2-3 hours  
**Risk Level:** Medium

---

## Phase 5: NestedCircleButton and Tool Integration

### 5.1 Update NestedCircleButton Component

**File:** `src/components/Map/components/Cards/NestedCircleButton.jsx`

**Changes Required:**
1. **Remove Oklahoma-specific location themes:**
   - Keep location theme system but update for Columbus
   - Remove or update `isTaylorWastewaterLocation` logic (already removed per comments)

2. **Update location selector:**
   - Ensure Columbus appears in location dropdown
   - Update location display names

3. **Update clear map data function:**
   - Remove Oklahoma-specific animation references:
     - `window.lakeWhitneyShoreAnimationRef`
     - `window.whitneyAnimationRef`
     - `window.vinFastAnimationRef` (NC-specific, but check)
     - `window.toyotaBatteryAnimationRef` (NC-specific, but check)
     - `window.wolfspeedAnimationRef` (NC-specific, but check)
   - Add Columbus-specific animations (if applicable)

4. **Update OSM button hover text:**
   - Remove "Stillwater OSM" / "Pryor OSM" logic
   - Update to Columbus OSM or generic

**Key Functions to Review:**
- `clearAllMapData()` - Update animation references
- Location dropdown rendering
- Location theme selection

**Dependencies:** Phase 1.2, Phase 3.1  
**Estimated Time:** 2-3 hours  
**Risk Level:** Medium

---

### 5.2 Update PerplexityCall Component

**File:** `src/components/Map/components/Cards/PerplexityCall.jsx`

**Changes Required:**
1. **Remove Oklahoma-specific logic:**
   - Remove any hardcoded Oklahoma location checks
   - Ensure location-agnostic Perplexity queries work

2. **Update GRDA marker loading:**
   - Remove GRDA power marker loading (Oklahoma-specific)
   - Add Columbus utility markers if applicable

**Dependencies:** Phase 1.2  
**Estimated Time:** 1 hour  
**Risk Level:** Low

---

### 5.3 Update GeoAI Component

**File:** `src/components/Map/components/Cards/GeoAI.jsx`

**Changes Required:**
- Verify GeoAI queries work with Columbus coordinates
- No direct changes needed if location-agnostic
- Test GeoAI analysis for Columbus area

**Dependencies:** Phase 1.2  
**Estimated Time:** 30 minutes (testing)  
**Risk Level:** Low

---

### 5.4 Update Deck GL Animation Components

**Files:**
- `src/components/Map/components/InfrastructureSitingPathAnimation.jsx`
- `src/components/Map/components/InfrastructureFlowAnimation.jsx`
- `src/components/Map/components/StillwaterCircleAnimation.jsx` (may need renaming/archiving)
- `src/components/Map/components/DeckGLOverlayManager.jsx`

**Changes Required:**
1. **Update Infrastructure Siting Path Animation:**
   - Replace `INFRASTRUCTURE_ROUTE_FILES` array with Columbus route files
   - Update route file paths from `/data/okc_campuses/*.geojson` to Columbus routes
   - Update animation colors if needed (currently orange)

2. **Update Infrastructure Flow Animation:**
   - Replace route files array with Columbus routes
   - Update animation colors if needed (currently red)

3. **Stillwater Circle Animation:**
   - **Decision Needed:** Archive or repurpose for Columbus?
   - If repurposing: Update coordinates, rename component
   - If archiving: Remove from DeckGLOverlayManager

4. **Update DeckGLOverlayManager:**
   - Remove Stillwater-specific animations if archiving
   - Update animation visibility state management
   - Update cleanup functions

**Reference Documentation:** See `docs/TEARDROP_MARKERS_AND_ANIMATIONS.md` for Deck GL animation details.

**Dependencies:** Phase 3.1, Phase 4.1  
**Estimated Time:** 2-3 hours  
**Risk Level:** Medium

---

## Phase 6: Legend and UI Components

### 6.1 Update Legend Configuration

**File:** `src/components/Map/legend/legendConfig.js`

**Changes Required:**
1. **Add Columbus university configuration:**
   - Add `columbus` or `default` entry to `UNIVERSITY_CONFIG`
   - Include: Ohio State University, Columbus State, Capital University, Otterbein University, Franklin University
   - Assign distinct colors for each university

2. **Update Oklahoma site collapsed states:**
   - Remove or archive `DEFAULT_OK_SITE_COLLAPSED` (Stillwater, Pryor)
   - Create Columbus site collapsed states if applicable

3. **Update OK Data Center visibility:**
   - Remove or archive `DEFAULT_OK_DATA_CENTER_CATEGORY_VISIBILITY`
   - Remove references to `google_stillwater_ok` and `google_pryor_ok`
   - Create Columbus data center visibility configs if applicable

**Key Universities for Columbus:**
- `osu`: Ohio State University (OSU) - Primary research university
- `columbus_state`: Columbus State Community College
- `capital`: Capital University
- `otterbein`: Otterbein University
- `franklin`: Franklin University

**Dependencies:** Phase 1.2  
**Estimated Time:** 1-2 hours  
**Risk Level:** Low

---

### 6.2 Update Build Legend Sections

**File:** `src/components/Map/legend/utils/buildLegendSections.js`

**Changes Required:**
1. **Remove Oklahoma Data Center Infrastructure section:**
   - Remove or update section title "Oklahoma Data Center Infrastructure"
   - Remove Stillwater site handling (lines 53-60, 611-630)
   - Remove Pryor site handling
   - Update section to show Columbus sites if applicable

2. **Update Power Generation section:**
   - Remove GRDA (Oklahoma-specific) power generation items
   - Remove OG&E (Oklahoma-specific) power generation items
   - Remove Stillwater toggle from infrastructure section
   - Add Columbus utility power generation if applicable (AEP Ohio)
   - Update infrastructure sites section to remove Oklahoma-specific markers

3. **Update pipeline and transit path detection:**
   - Remove Oklahoma pipeline marker keys (pryor, stillwater, tulsa_suburbs, etc.)
   - Remove `okc-campuses-route-layer` references
   - Add Columbus infrastructure routes if applicable

4. **Update location-specific logic:**
   - Ensure `getLocationUniversities(currentLocation)` works for Columbus
   - Update any hardcoded location checks

**Key Functions to Update:**
- Power Generation section building (lines 521-689)
- Oklahoma Data Center section (lines 51-115)
- Infrastructure sites detection
- Pipeline layer detection

**Dependencies:** Phase 1.2, Phase 3.1, Phase 6.1  
**Estimated Time:** 3-4 hours  
**Risk Level:** Medium

---

### 6.3 Update Legend Data Sources Hook

**File:** `src/components/Map/legend/hooks/useLegendDataSources.js`

**Changes Required:**
1. **Update OK Data Center data handling:**
   - Review `createOkDataCenterData()` - may need to rename or archive
   - Update event listeners for `ok-data-center:*` events
   - Remove or update Stillwater/Pryor-specific data handling

2. **Update power marker event listeners:**
   - Review `grda-markers-loaded` event handling
   - Review `oge-markers-loaded` event handling (if exists)
   - Update to Columbus utility markers if applicable

3. **Update data source initialization:**
   - Ensure Columbus sites are properly detected
   - Update any Oklahoma-specific data source checks

**Dependencies:** Phase 3.1, Phase 6.1  
**Estimated Time:** 1-2 hours  
**Risk Level:** Low

---

### 6.4 Update LegendContainer Component

**File:** `src/components/Map/components/Cards/LegendContainer.jsx`

**Changes Required:**
1. **Remove Oklahoma-specific state management:**
   - Remove or update `okSiteCollapsed` state (Stillwater, Pryor)
   - Remove or update `okDataCenterCategoryVisibility` state
   - Update `powerLegendVisibility` to remove GRDA/OG&E/Stillwater references

2. **Update toggle functions:**
   - Remove or update `toggleOkDataCenterLayer()` - remove Stillwater/Pryor handling
   - Update `togglePowerLegendCategory()` - remove GRDA/OG&E/Stillwater logic
   - Update `togglePowerMarkers()` - remove Oklahoma utility markers
   - Remove Oklahoma pipeline marker toggling (lines 1124-1171)
   - Remove transit path toggling for `okc-campuses-route` (lines 1051-1121)

3. **Update cleanup functions:**
   - Remove GRDA power marker cleanup (lines 2321-2330)
   - Remove OG&E power marker cleanup (lines 2332-2342)
   - Remove Oklahoma campus teardrop markers cleanup (lines 2344-2354)
   - Remove GRDA/OG&E pulse layer cleanup (lines 2356-2384)
   - Remove Oklahoma pipeline cleanup (lines 2386-2422)
   - Remove `okc-campuses-route` cleanup (lines 2424-2438)
   - Remove Pryor-Stillwater circle animations cleanup (lines 2651-2685)
   - Remove Stillwater circle animation cleanup (lines 2672-2685)

4. **Update event listeners:**
   - Remove `grda-markers-loaded` event listener (lines 1379-1434)
   - Update power marker detection polling (lines 2748-2786) - remove Oklahoma markers

5. **Update visibility state management:**
   - Remove Oklahoma-specific visibility states from `captureVisibilityState()`
   - Remove Oklahoma-specific states from `restoreVisibilityState()`
   - Update `turnAllLayersOff()` to remove Oklahoma cleanup

6. **Update legend item click handling:**
   - Remove Oklahoma data center site handling (lines 220-226)
   - Update site focus logic to work with Columbus sites

**Key Functions to Review:**
- `handleLegendItemClick()` - Remove OK site handling
- `toggleOkDataCenterLayer()` - Remove or update
- `togglePowerLegendCategory()` - Remove GRDA/OG&E/Stillwater
- `togglePowerMarkers()` - Remove Oklahoma utilities
- `captureVisibilityState()` - Remove OK states
- `restoreVisibilityState()` - Remove OK states
- `turnAllLayersOff()` - Remove OK cleanup

**Dependencies:** Phase 1.2, Phase 3.1, Phase 6.1, Phase 6.2  
**Estimated Time:** 4-6 hours  
**Risk Level:** High (complex component with many dependencies)

---

### 6.5 Update Visibility Presets

**File:** `src/components/Map/legend/components/VisibilityPresets.jsx`

**Changes Required:**
1. **Remove Oklahoma placeholder scenes:**
   - Remove `PLACEHOLDER_SCENES.stillwater` (lines 18-58)
   - Remove `PLACEHOLDER_SCENES.pryor` (lines 60-100)
   - Create Columbus placeholder scene if needed

2. **Update scene type detection:**
   - Remove Stillwater/Pryor scene type checks (lines 137-238, 387-396)
   - Remove Oklahoma coordinate references
   - Add Columbus scene type if applicable

3. **Update scene loading logic:**
   - Remove Stillwater/Pryor-specific scene loading
   - Update scene name matching to remove Oklahoma references

**Dependencies:** Phase 1.2, Phase 6.1  
**Estimated Time:** 2-3 hours  
**Risk Level:** Medium

---

### 6.6 Update Legend Panel Component

**File:** `src/components/Map/legend/components/LegendPanel.jsx`

**Changes Required:**
1. **Remove Oklahoma-specific rendering:**
   - Remove OK Data Center site collapse/expand UI (lines 710-803)
   - Remove OK subcategory checkbox rendering (lines 971-1033)
   - Update section titles to remove "Oklahoma" references

2. **Update power legend rendering:**
   - Remove GRDA expansion/collapse UI
   - Remove OG&E expansion/collapse UI
   - Remove Stillwater toggle rendering
   - Update infrastructure section to remove Oklahoma markers

**Dependencies:** Phase 6.2, Phase 6.4  
**Estimated Time:** 1-2 hours  
**Risk Level:** Low

---

### 6.7 Update LayerToggle Component

**File:** `src/components/Map/components/LayerToggle.jsx`

**Changes Required:**
- Remove Oklahoma-specific layer toggles (if any)
- Add Columbus-specific layers (if needed)
- Update any hardcoded location references

**Dependencies:** Phase 6.1  
**Estimated Time:** 1 hour  
**Risk Level:** Low

---

## Phase 7: Scripts and Data Generation

### 7.1 Archive Oklahoma Route Generation Scripts

**Files:**
- `scripts/create_okc_infrastructure_routes.py`
- `scripts/create_pryor_to_grda_routes.py`
- `scripts/create_stillwater_to_oge_routes.py`
- `scripts/create_continuous_pryor_stillwater_route.py`

**Changes Required:**
- Archive these scripts
- Create Columbus route generation scripts (if needed)

**Dependencies:** Phase 4.1  
**Estimated Time:** 30 minutes  
**Risk Level:** Low

---

### 7.2 Update OSM Data Collection Scripts

**Files:**
- `scripts/osm-tools/ok_data_center_osm.py`
- `scripts/osm-tools/ok_expanded_pipeline_osm.py`
- `scripts/osm-tools/ok_marker_pipelines_osm.py`

**Changes Required:**
- Archive Oklahoma-specific OSM scripts
- Create Columbus OSM data collection scripts (if pre-caching)

**Dependencies:** Phase 3.1  
**Estimated Time:** 1-2 hours  
**Risk Level:** Low

---

### 7.3 Update Utility Data Scripts

**Files:**
- `scripts/oge/*.py` - OG&E (Oklahoma) scripts
- `scripts/grda/*.py` - GRDA (Oklahoma) scripts

**Changes Required:**
- Archive Oklahoma utility scripts
- Create Columbus utility data scripts (AEP Ohio, etc.) if needed

**Dependencies:** Phase 4.4  
**Estimated Time:** 2-3 hours  
**Risk Level:** Medium

---

## Phase 8: Testing and Validation

### 8.1 Map Initialization Testing

**Test Cases:**
- [ ] Map centers on Columbus on load
- [ ] Zoom level is appropriate for metro area
- [ ] Map loads without errors
- [ ] Geographic config loads correctly

**Dependencies:** Phase 1, Phase 2  
**Estimated Time:** 1 hour  
**Risk Level:** Low

---

### 8.2 OSM Button Testing

**Test Cases:**
- [ ] OSM button appears and is clickable
- [ ] OSM queries return Columbus-area data
- [ ] No Oklahoma route files are loaded
- [ ] OSM layers render correctly
- [ ] No console errors related to missing files

**Dependencies:** Phase 3.1  
**Estimated Time:** 2 hours  
**Risk Level:** Medium

---

### 8.3 Location Selector Testing

**Test Cases:**
- [ ] Columbus appears in location dropdown
- [ ] Location selection works correctly
- [ ] Map updates when location changes
- [ ] Location theme applies correctly

**Dependencies:** Phase 5.1  
**Estimated Time:** 1 hour  
**Risk Level:** Low

---

### 8.4 Tool Integration Testing

**Test Cases:**
- [ ] GeoAI button works for Columbus
- [ ] Perplexity button works for Columbus
- [ ] Firecrawl button works (if applicable)
- [ ] All tool feedback messages are correct
- [ ] No Oklahoma-specific references in UI

**Dependencies:** Phase 5  
**Estimated Time:** 2-3 hours  
**Risk Level:** Medium

---

### 8.5 Legend and Layer Testing

**Test Cases:**
- [ ] Legend displays Columbus universities
- [ ] OSM layer toggles work correctly
- [ ] Layer visibility states persist
- [ ] No Oklahoma-specific layers appear

**Dependencies:** Phase 6  
**Estimated Time:** 1-2 hours  
**Risk Level:** Low

---

## Phase 9: Cleanup and Documentation

### 9.1 Code Cleanup

**Tasks:**
- Remove unused imports
- Remove commented-out Oklahoma code
- Update code comments
- Remove dead code paths

**Dependencies:** All previous phases  
**Estimated Time:** 2-3 hours  
**Risk Level:** Low

---

### 9.2 Documentation Updates

**Files to Update:**
- `README.md` - Update location references
- `docs/SETUP_NEW_LOCATION_GUIDE.md` - Update examples
- Any other location-specific documentation

**Dependencies:** All previous phases  
**Estimated Time:** 1-2 hours  
**Risk Level:** Low

---

## Critical Dependencies Map

```
Phase 1 (Core Config)
  ├─> Phase 2 (Map Components)
  │     └─> Phase 8.1 (Testing)
  │
  ├─> Phase 2.5 (Preprocessing - OSM Data Generation)
  │     └─> Phase 3 (OSM Components) [CRITICAL DEPENDENCY]
  │           ├─> Phase 4 (Data Files)
  │           │     └─> Phase 7 (Scripts)
  │           │
  │           └─> Phase 5 (Tool Integration)
  │                 └─> Phase 8.3, 8.4 (Testing)
  │
  └─> Phase 6 (Legend/UI)
        └─> Phase 8.5 (Testing)
```

---

## Risk Assessment Summary

| Phase | Risk Level | Critical Issues |
|-------|------------|-----------------|
| Phase 1 | Low | Straightforward config updates |
| Phase 2 | Low | Standard component updates |
| Phase 3 | **High** | Complex OSM component with many dependencies |
| Phase 4 | Low | File archiving, straightforward |
| Phase 5 | Medium | Multiple tool integrations to update |
| Phase 6 | **High** | Complex legend system with many Oklahoma-specific references |
| Phase 7 | Low | Script archiving |
| Phase 8 | Medium | Comprehensive testing required |
| Phase 9 | Low | Cleanup and documentation |

---

## Estimated Total Time

**Conservative Estimate:** 30-40 hours  
**Optimistic Estimate:** 20-25 hours  
**With Testing:** 35-45 hours

**Breakdown:**
- Core Configuration: 2-3 hours
- Component Updates: 12-18 hours
- Legend System Updates: 12-18 hours (new - complex system)
- Data File Management: 2-3 hours
- Script Updates: 4-6 hours
- Testing: 8-10 hours
- Cleanup: 2-3 hours

---

## Key Decisions Needed

1. **Data Center Sites:** Does Columbus have data center sites to map? If not, `okDataCenterSites.js` can be archived.

2. **Infrastructure Routes:** Do we need Columbus infrastructure route animations? If not, route layer components can be disabled.

3. **Utility Data:** Do we need Columbus utility (AEP Ohio) data integration? If not, utility components can be simplified.

4. **OSM Pre-caching:** Do we want to pre-cache Columbus OSM data, or rely on dynamic queries?

5. **Animation Components:** Which animations (if any) should be ported for Columbus? Many are location-specific.

---

## Migration Checklist

### Pre-Migration
- [ ] Backup current codebase
- [ ] Create feature branch: `columbus-migration`
- [ ] Document current Oklahoma-specific features
- [ ] Identify Columbus-specific requirements

### Phase 1: Core Config
- [ ] Update `MAP_CONFIG` in `constants.js`
- [ ] Update `GEOGRAPHIC_CONFIG` in `geographicConfig.js`
- [ ] Update/archive `okDataCenterSites.js`

### Phase 2: Map Components
- [ ] Update `useMapInitialization.js`
- [ ] Update `Map/index.jsx`

### Phase 2.5: Preprocessing Layer (CRITICAL - Must complete before Phase 3)
- [ ] Research Columbus infrastructure markers
- [ ] Create `columbus_metro_osm.py` script
- [ ] Create `columbus_marker_pipelines_osm.py` script
- [ ] Run scripts to generate Columbus cache files
- [ ] Verify output files are valid
- [ ] Update frontend to reference Columbus scripts

### Phase 3: OSM Components
- [ ] Update `OSMCall.jsx` (remove OK routes)
- [ ] Update `FirecrawlCall.jsx`
- [ ] Archive/update route animation components
- [ ] Update `OsmTool.js`
- [ ] Update teardrop markers (`addCampusTeardropMarkers()`)
- [ ] Update particle animations (`addMarkerPipelines()`, `addPipelineParticles()`)

### Phase 4: Data Files
- [ ] Archive `public/data/okc_campuses/`
- [ ] Archive `public/data/pipelines/` (OK files)
- [ ] Archive OSM cache files
- [ ] Update utility data directories

### Phase 5: Tool Integration
- [ ] Update `NestedCircleButton.jsx`
- [ ] Update `PerplexityCall.jsx`
- [ ] Test `GeoAI.jsx`
- [ ] Update Deck GL animation components
- [ ] Update animation route files

### Phase 6: Legend and UI Components
- [ ] Update `legendConfig.js` (university config, OK site states)
- [ ] Update `buildLegendSections.js` (remove OK sections, update power section)
- [ ] Update `useLegendDataSources.js` (remove OK data center handling)
- [ ] Update `LegendContainer.jsx` (remove OK state, toggles, cleanup)
- [ ] Update `VisibilityPresets.jsx` (remove Stillwater/Pryor scenes)
- [ ] Update `LegendPanel.jsx` (remove OK UI rendering)
- [ ] Update `LayerToggle.jsx`

### Phase 7: Scripts
- [ ] Archive OK route generation scripts
- [ ] Archive OK OSM scripts
- [ ] Archive OK utility scripts

### Phase 8: Testing
- [ ] Map initialization tests
- [ ] OSM button tests
- [ ] Location selector tests
- [ ] Tool integration tests
- [ ] Legend/layer tests

### Phase 9: Cleanup
- [ ] Code cleanup
- [ ] Documentation updates

---

## Post-Migration Tasks

1. **Performance Testing:** Verify map performance with Columbus data
2. **User Acceptance:** Test with end users familiar with Columbus area
3. **Data Validation:** Verify all Columbus data loads correctly
4. **Error Monitoring:** Monitor for any location-specific errors
5. **Documentation:** Update user-facing documentation

---

## Notes and Considerations

1. **Backward Compatibility:** Consider if Oklahoma locations should remain as selectable options, or be completely removed.

2. **Data Availability:** Verify Columbus OSM data availability and quality before migration.

3. **Utility Integration:** AEP Ohio data structure may differ from OG&E/GRDA - plan for data format differences.

4. **Animation Porting:** Many animations are location-specific (e.g., Pryor-Stillwater circles). Decide which (if any) should be ported.

5. **Route Files:** Columbus infrastructure routes may need to be generated from scratch if they don't exist.

6. **Testing Environment:** Set up a testing environment with Columbus data before production deployment.

7. **Teardrop Markers and Animations:** See `docs/TEARDROP_MARKERS_AND_ANIMATIONS.md` for detailed documentation on:
   - How teardrop markers are mounted
   - How click events are handled
   - How particle animations work around markers
   - How Deck GL animations are triggered from popup cards
   - Complete integration flow from button clicks to animations

---

## Implementation Strategies

This section provides step-by-step implementation strategies for each phase, including risk mitigation, testing approaches, and best practices.

---

### Phase 1: Core Geographic Configuration - Implementation Strategy

#### Strategy Overview
**Approach:** Start with the foundation - update configuration files that all other components depend on. This is low-risk and enables incremental testing.

#### 1.1 Map Initialization Constants

**Implementation Steps:**
1. **Create backup branch:**
   ```bash
   git checkout -b columbus-migration-phase1
   git checkout -b backup-before-columbus-migration
   ```

2. **Update `src/components/Map/constants.js`:**
   - Change `MAP_CONFIG.center` to `[-82.9988, 39.9612]`
   - Adjust `MAP_CONFIG.zoom` to `11` (metro area view)
   - Test immediately: Start dev server and verify map centers on Columbus

3. **Testing Strategy:**
   - Visual verification: Map should center on Columbus
   - Console check: No errors on map initialization
   - Zoom test: Verify zoom level is appropriate for metro area

**Risk Mitigation:**
- Keep original values in comments for quick rollback
- Test in isolation before proceeding to Phase 1.2

#### 1.2 Geographic Configuration System

**Implementation Steps:**
1. **Update `default` entry first:**
   - Change coordinates, city, state, county, region
   - Update `gridOperator` to `'AEP Ohio'`
   - Update `timezone` to `'America/New_York'`
   - Adjust `searchRadius` to `10000` (10km for metro area)

2. **Add Columbus-specific entry (optional):**
   ```javascript
   columbus_metro: {
     coordinates: { lat: 39.9612, lng: -82.9988 },
     city: 'Columbus',
     state: 'OH',
     county: 'Franklin County',
     region: 'Columbus Metro Area',
     gridOperator: 'AEP Ohio',
     timezone: 'America/New_York',
     searchRadius: 10000,
     businessContext: 'Columbus metro area infrastructure and development analysis',
     dataCenterCompany: null, // Update if applicable
     facilityName: 'Columbus Metro Area'
   }
   ```

3. **Archive Oklahoma entries (don't delete yet):**
   - Comment out `google_stillwater_ok` and `google_pryor_ok`
   - Add comment: `// Archived: Oklahoma locations - see archive/`
   - Keep for reference during migration

4. **Update helper functions:**
   - Verify `getGeographicConfig()` works with new default
   - Test `getAvailableLocations()` returns Columbus

**Testing Strategy:**
- Unit test: `getGeographicConfig('default')` returns Columbus config
- Integration test: Location selector shows Columbus
- Verify no components break from config changes

**Risk Mitigation:**
- Use feature flags if needed: `const USE_COLUMBUS = true`
- Keep Oklahoma configs commented (not deleted) for rollback
- Test each component that uses `GEOGRAPHIC_CONFIG` individually

#### 1.3 Oklahoma Data Center Sites Configuration

**Decision Tree:**
```
Does Columbus have data center sites?
├─ YES → Create columbusDataCenterSites.js
│   └─ Update all imports from okDataCenterSites.js
└─ NO → Archive okDataCenterSites.js
    └─ Remove/comment out all imports
```

**Implementation Steps:**

**Option A: Columbus has data centers**
1. Create `src/config/columbusDataCenterSites.js`:
   ```javascript
   export const COLUMBUS_DATA_CENTER_SITES = [
     {
       key: 'columbus_site_1',
       name: 'Columbus Data Center Site 1',
       // ... Columbus-specific data
     }
   ];
   ```

2. Update imports in:
   - `src/components/Map/components/Cards/OSMCall.jsx`
   - `src/components/Map/hooks/useInfrastructureSites.js`
   - Any other files importing `okDataCenterSites`

3. Use find-and-replace carefully:
   ```bash
   # Find all imports
   grep -r "okDataCenterSites" src/
   ```

**Option B: No Columbus data centers (recommended for initial migration)**
1. Archive the file:
   ```bash
   mv src/config/okDataCenterSites.js archive/okDataCenterSites.js.backup
   ```

2. Create stub file to prevent import errors:
   ```javascript
   // src/config/okDataCenterSites.js
   export const OK_DATA_CENTER_SITES = [];
   export const OK_DATA_CENTER_SITE_KEYS = new Set();
   export const getOkDataCenterSiteByKey = () => null;
   export const isOkDataCenterLocation = () => false;
   ```

3. Update components to handle empty data gracefully

**Testing Strategy:**
- Verify no import errors
- Test that components handle missing data center sites
- Check console for any undefined references

**Risk Mitigation:**
- Keep original file in archive for reference
- Use stub pattern to prevent breaking imports
- Add null checks in components that use this config

---

### Phase 2: Map Component Updates - Implementation Strategy

#### Strategy Overview
**Approach:** Verify map components use updated configs correctly. Minimal changes expected if architecture is sound.

#### 2.1 Map Initialization Hook

**Implementation Steps:**
1. **Verify hook uses `MAP_CONFIG`:**
   - Check `useMapInitialization.js` imports `MAP_CONFIG` from constants
   - Verify no hardcoded coordinates exist

2. **Test map initialization:**
   - Clear browser cache
   - Load application
   - Verify map centers on Columbus
   - Check zoom level

**Testing Strategy:**
- Visual test: Map should show Columbus metro area
- Console test: No coordinate-related errors
- Performance test: Map loads in reasonable time

#### 2.2 Main Map Component

**Implementation Steps:**
1. **Check `currentLocation` default:**
   - Verify `useState` initializes with Columbus location key
   - Update if hardcoded to Oklahoma key

2. **Search for hardcoded references:**
   ```bash
   grep -r "stillwater\|pryor\|36.1156\|-97.0584" src/components/Map/index.jsx
   ```

3. **Update any found references:**
   - Replace with `getGeographicConfig()` calls
   - Use location key from state

**Testing Strategy:**
- Location selector test: Default selection is Columbus
- Map update test: Changing location updates map correctly
- State persistence test: Location persists across refreshes

---

### Phase 3: OSM Data and Infrastructure Components - Implementation Strategy

#### Strategy Overview
**Approach:** This is the most complex phase. Use incremental refactoring with feature flags. Test each component in isolation.

#### 3.1 OSMCall Component - Critical Implementation

**Risk Level: HIGH** - This component has many dependencies and Oklahoma-specific logic.

**Implementation Strategy: Incremental Refactoring**

**Step 1: Identify all Oklahoma-specific code**
```bash
# Find all Oklahoma references
grep -n "okc_campuses\|stillwater\|pryor\|OK_DATA_CENTER\|grda\|oge" src/components/Map/components/Cards/OSMCall.jsx
```

**Step 2: Create feature flag system**
```javascript
// At top of OSMCall.jsx
const USE_COLUMBUS = true; // Feature flag
const ARCHIVE_OK_ROUTES = true; // Archive instead of delete
```

**Step 3: Refactor incrementally (one function at a time)**

**3.1a: Remove Oklahoma route files**
- Comment out `addTransitPathLayers()` calls
- Add TODO comments for Columbus route implementation
- Test: Verify no 404 errors for missing route files

**3.1b: Update location detection**
```javascript
// Before
if (OK_DATA_CENTER_SITE_KEYS.has(locationKey)) {
  // Oklahoma logic
}

// After
const isColumbusLocation = locationKey === 'default' || locationKey.startsWith('columbus');
if (isColumbusLocation) {
  // Columbus logic
}
```

**3.1c: Update campus teardrop markers**
- Remove `addCampusTeardropMarkers()` or create Columbus version
- Create new function: `addColumbusCampusTeardropMarkers()`
- Update marker coordinates to Columbus locations

**3.1d: Update pipeline markers**
- Archive `addMarkerPipelines()` calls
- Create Columbus pipeline data structure
- Update `markerKeys` array

**Testing Strategy for Each Step:**
1. **Unit test each function:**
   - Mock map object
   - Verify function doesn't throw errors
   - Check that Oklahoma-specific code is not executed

2. **Integration test:**
   - Click OSM button
   - Verify no console errors
   - Check that appropriate layers load (or gracefully fail if data missing)

3. **Visual test:**
   - Verify map displays correctly
   - Check that markers appear in correct locations

**Risk Mitigation:**
- Use feature flags to toggle between old/new code
- Keep Oklahoma functions commented (not deleted) initially
- Test in isolation before integrating
- Have rollback plan for each function

**Code Pattern for Safe Refactoring:**
```javascript
const addCampusTeardropMarkers = (map, locationKey) => {
  if (USE_COLUMBUS) {
    return addColumbusCampusTeardropMarkers(map, locationKey);
  }
  
  // Original Oklahoma code (commented but kept)
  // if (locationKey === 'google_stillwater_ok') {
  //   ...
  // }
};
```

#### 3.2 FirecrawlCall Component

**Implementation Steps:**
1. **Remove Stillwater-to-OG&E routes:**
   - Comment out `addStillwaterToOGERoutes()` function
   - Remove function calls
   - Add TODO for Columbus infrastructure routes

2. **Update layer toggles:**
   - Remove hardcoded layer IDs: `toyota-access-route`, `greensboro-durham-route`, `nc-power`
   - Create location-agnostic layer toggle system
   - Use `currentLocation` to determine which layers to toggle

**Testing Strategy:**
- Click Firecrawl button
- Verify no errors for missing routes
- Check that layer toggles work (or fail gracefully)

#### 3.3 Infrastructure Route Layers

**Decision Needed:** Do we need Columbus infrastructure route animations?

**Implementation Strategy:**

**Option A: Archive all route animations (recommended for initial migration)**
1. Move route animation components to `archive/`:
   ```bash
   mkdir -p archive/oklahoma-route-components
   mv src/components/Map/components/PryorStillwaterCircleAnimation.jsx archive/
   mv src/components/Map/components/PryorGRDARouteLayer.jsx archive/
   mv src/components/Map/components/StillwaterOGERouteLayer.jsx archive/
   ```

2. Update `DeckGLOverlayManager.jsx`:
   - Remove imports for archived components
   - Comment out animation initialization
   - Add TODO for Columbus animations

**Option B: Create Columbus route animations**
1. Identify Columbus infrastructure routes needed
2. Generate route GeoJSON files (see Phase 4)
3. Create Columbus-specific animation components
4. Update `DeckGLOverlayManager.jsx` to use new components

**Testing Strategy:**
- Verify no import errors after archiving
- Test that map still loads without route animations
- Check Deck.gl overlay manager doesn't break

#### 3.4 OSM Tool

**Implementation Steps:**
1. **Verify location-agnostic queries:**
   - Check that OSM queries use `getGeographicConfig()` coordinates
   - Test with Columbus coordinates
   - Verify search radius is appropriate

2. **Update cached data checks:**
   - Remove hardcoded Oklahoma location checks
   - Use dynamic location detection

**Testing Strategy:**
- Trigger OSM query for Columbus
- Verify data returns correctly
- Check that cached data logic works

#### 3.5 Teardrop Markers and Particle Animations

**Implementation Steps:**
1. **Update campus teardrop markers:**
   - Research Columbus campus/POI locations
   - Create `columbusCampuses` array with coordinates
   - Update `addCampusTeardropMarkers()` to use Columbus data

2. **Update pipeline particles:**
   - Identify Columbus infrastructure markers
   - Generate pipeline data files (5-mile radius around each)
   - Update `markerKeys` array
   - Update `addPipelineParticles()` calls

3. **Update transportation particles:**
   - Generate Columbus route GeoJSON files
   - Update route file paths
   - Update `addTransportationParticles()` calls

**Testing Strategy:**
- Visual test: Markers appear in correct Columbus locations
- Animation test: Particles animate correctly around markers
- Performance test: Animations don't cause lag

---

### Phase 4: Data Files and Routes - Implementation Strategy

#### Strategy Overview
**Approach:** Archive systematically, maintain file structure, document what's archived.

#### 4.1 Archive Oklahoma Route Data Files

**Implementation Steps:**
1. **Create archive structure:**
   ```bash
   mkdir -p archive/oklahoma-data/okc_campuses
   mkdir -p archive/oklahoma-data/pipelines
   mkdir -p archive/oklahoma-data/osm-cache
   ```

2. **Move files systematically:**
   ```bash
   # Move route files
   mv public/data/okc_campuses/*.geojson archive/oklahoma-data/okc_campuses/
   
   # Create README in archive
   cat > archive/oklahoma-data/README.md << EOF
   # Archived Oklahoma Data Files
   Archived on: $(date)
   Reason: Migration to Columbus, OH metro area
   
   ## Contents
   - okc_campuses/: Route GeoJSON files for Oklahoma infrastructure
   - pipelines/: Pipeline data JSON files
   - osm-cache/: Cached OSM data for Oklahoma locations
   EOF
   ```

3. **Update .gitignore if needed:**
   - Ensure archived files are still tracked (don't add to .gitignore)
   - Or create separate archive branch

**Testing Strategy:**
- Verify no broken file references in code
- Check that components handle missing files gracefully
- Test that map still loads without route files

#### 4.2-4.4 Archive Other Data Files

**Similar approach:**
1. Create organized archive structure
2. Move files with documentation
3. Update components to handle missing files
4. Test that application doesn't break

---

### Phase 5: NestedCircleButton and Tool Integration - Implementation Strategy

#### Strategy Overview
**Approach:** Update tool integrations systematically, test each tool button individually.

#### 5.1 NestedCircleButton Component

**Implementation Steps:**
1. **Update clear map data function:**
   ```javascript
   const clearAllMapData = () => {
     // Remove Oklahoma-specific animations
     if (window.lakeWhitneyShoreAnimationRef) {
       // Archive - Oklahoma-specific
     }
     if (window.whitneyAnimationRef) {
       // Archive - Oklahoma-specific
     }
     
     // Remove NC-specific (if not needed)
     // if (window.vinFastAnimationRef) { ... }
     
     // Add Columbus-specific cleanup (if applicable)
   };
   ```

2. **Update location selector:**
   - Verify Columbus appears in dropdown
   - Test location switching
   - Update location display names

3. **Update OSM button hover text:**
   - Remove "Stillwater OSM" / "Pryor OSM" logic
   - Use generic or Columbus-specific text

**Testing Strategy:**
- Click each tool button
- Verify no errors
- Check that location selector works
- Test clear map data function

#### 5.2-5.4 Other Tool Components

**Similar approach for each:**
1. Remove Oklahoma-specific logic
2. Verify location-agnostic behavior
3. Test with Columbus coordinates
4. Update any hardcoded references

---

### Phase 6: Legend and UI Components - Implementation Strategy

#### Strategy Overview
**Approach:** This is complex. Refactor incrementally, test each legend section independently.

#### 6.1 Legend Configuration

**Implementation Steps:**
1. **Add Columbus university configuration:**
   ```javascript
   columbus: {
     osu: { name: 'Ohio State University', color: '#BB0000' },
     columbus_state: { name: 'Columbus State', color: '#0066CC' },
     capital: { name: 'Capital University', color: '#8B0000' },
     otterbein: { name: 'Otterbein University', color: '#000080' },
     franklin: { name: 'Franklin University', color: '#003366' }
   }
   ```

2. **Update default entry:**
   - Change `default` to use `columbus` universities
   - Or create separate `columbus` entry and update default

3. **Archive Oklahoma configs:**
   - Comment out `DEFAULT_OK_SITE_COLLAPSED`
   - Comment out `DEFAULT_OK_DATA_CENTER_CATEGORY_VISIBILITY`

**Testing Strategy:**
- Verify universities appear in legend
- Check colors are distinct
- Test university layer toggles

#### 6.2 Build Legend Sections

**Implementation Steps:**
1. **Remove Oklahoma Data Center section:**
   - Comment out section building code
   - Add TODO for Columbus data centers (if applicable)
   - Test that legend still renders correctly

2. **Update Power Generation section:**
   - Remove GRDA/OG&E items
   - Add AEP Ohio items (if data available)
   - Or remove section entirely if no power data

3. **Update pipeline detection:**
   - Remove Oklahoma pipeline marker keys
   - Add Columbus pipeline keys (if applicable)

**Testing Strategy:**
- Visual test: Legend displays correctly
- Toggle test: Each section expands/collapses
- Layer test: Toggling legend items affects map layers

#### 6.3-6.7 Other Legend Components

**Similar incremental approach:**
1. Remove Oklahoma-specific state
2. Update event listeners
3. Test each component in isolation
4. Integrate and test together

**Critical for LegendContainer.jsx:**
- This is a large file (2000+ lines)
- Refactor one function at a time
- Use feature flags for safe rollback
- Test extensively after each change

---

### Phase 7: Scripts and Data Generation - Implementation Strategy

#### Strategy Overview
**Approach:** Archive systematically, create Columbus scripts only if needed.

#### Implementation Steps:
1. **Archive Oklahoma scripts:**
   ```bash
   mkdir -p archive/oklahoma-scripts
   mv scripts/create_okc_infrastructure_routes.py archive/oklahoma-scripts/
   mv scripts/create_pryor_to_grda_routes.py archive/oklahoma-scripts/
   # ... etc
   ```

2. **Create Columbus scripts (if needed):**
   - Only create if Columbus data generation is required
   - Base on archived Oklahoma scripts
   - Update coordinates and location references

3. **Document script purposes:**
   - Add README in scripts directory
   - Document which scripts are Columbus-specific
   - Note which are location-agnostic

---

### Phase 8: Testing and Validation - Implementation Strategy

#### Strategy Overview
**Approach:** Test incrementally after each phase, not just at the end.

#### Testing Phases:

**After Phase 1:**
- [ ] Map centers on Columbus
- [ ] Geographic config loads correctly
- [ ] Location selector shows Columbus

**After Phase 3:**
- [ ] OSM button works
- [ ] No missing file errors
- [ ] Layers render correctly

**After Phase 5:**
- [ ] All tool buttons work
- [ ] No Oklahoma references in UI
- [ ] Location switching works

**After Phase 6:**
- [ ] Legend displays correctly
- [ ] Layer toggles work
- [ ] No Oklahoma-specific sections

**Final Integration Test:**
- [ ] Full user workflow test
- [ ] Performance test
- [ ] Cross-browser test
- [ ] Mobile responsiveness test

#### Testing Tools:
- Browser DevTools console for errors
- React DevTools for state inspection
- Network tab for file loading
- Performance profiler for lag detection

---

### Phase 9: Cleanup and Documentation - Implementation Strategy

#### Implementation Steps:
1. **Code cleanup:**
   - Remove commented-out code (after confirming migration works)
   - Remove unused imports
   - Update code comments
   - Run linter and fix issues

2. **Documentation updates:**
   - Update README.md with Columbus information
   - Update setup guides
   - Document any Columbus-specific requirements

---

## Implementation Best Practices

### 1. Incremental Development
- **Don't change everything at once**
- Complete one phase before starting the next
- Test after each significant change
- Use feature flags for safe rollback

### 2. Version Control Strategy
```bash
# Create feature branch
git checkout -b columbus-migration

# Work in phases with commits
git commit -m "Phase 1.1: Update MAP_CONFIG to Columbus"
git commit -m "Phase 1.2: Update GEOGRAPHIC_CONFIG"
# ... etc

# Tag major milestones
git tag -a phase1-complete -m "Core configuration complete"
git tag -a phase3-complete -m "OSM components updated"
```

### 3. Testing Strategy
- **Test in isolation:** Test each component independently
- **Test incrementally:** Test after each phase
- **Test integration:** Test components working together
- **Test edge cases:** Test with missing data, invalid locations, etc.

### 4. Rollback Plan
- Keep original code commented (not deleted) initially
- Use feature flags for easy toggling
- Tag commits at each phase completion
- Keep backup branch with original code

### 5. Documentation
- Document decisions as you make them
- Update migration plan with actual changes
- Note any deviations from plan
- Document Columbus-specific requirements discovered

### 6. Code Review Checklist
Before considering migration complete:
- [ ] No hardcoded Oklahoma coordinates
- [ ] No references to Oklahoma-specific files
- [ ] All imports updated or archived
- [ ] Error handling for missing data
- [ ] Console logs updated (no Oklahoma references)
- [ ] Comments updated
- [ ] Tests pass

---

## Support and Resources

- **Columbus Coordinates:** 39.9612° N, 82.9988° W
- **Metro Area Counties:** Franklin, Delaware, Fairfield, Licking, Madison, Pickaway, Union
- **Grid Operator:** AEP Ohio (American Electric Power)
- **Timezone:** America/New_York (EST/EDT)

---

**Last Updated:** [Current Date]  
**Version:** 1.0  
**Status:** Planning Phase

