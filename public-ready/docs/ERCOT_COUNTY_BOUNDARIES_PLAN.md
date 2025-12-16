# ERCOT County Boundaries Layer - Implementation Plan

**Date:** 2025-01-XX  
**Objective:** Create a county-level visualization of ERCOT interconnection requests using Texas county boundaries with aggregated data

---

## Overview

Transform the current point marker visualization (76,001 projects at county centroids) into a county boundaries fill layer that shows:
- **Project density** by county (count of projects)
- **Total capacity** by county (sum of MW)
- **Fuel type distribution** by county
- **Interactive popups** with county statistics

---

## Phase 1: Data Collection

### Step 1.1: Download Texas County Boundaries

**Source:** U.S. Census Bureau TIGER/Line Shapefiles  
**URL:** https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html  
**Specific:** 2023 TIGER/Line Shapefiles - Counties (or latest available)

**Alternative Sources:**
- Direct download: `https://www2.census.gov/geo/tiger/TIGER2023/COUNTY/tl_2023_us_county.zip`
- Filter for Texas (FIPS code 48) after download

**File Format:** Shapefile (.shp, .shx, .dbf, .prj)

**Script:** `scripts/ercot/download_texas_counties.py`
- Download TIGER shapefile
- Filter for Texas (STATEFP == '48')
- Convert to GeoJSON
- Save to `public/data/texas/texas_counties.geojson`

**Expected Output:**
- 254 Texas counties
- GeoJSON format
- Properties: NAME, GEOID, STATEFP, COUNTYFP, etc.

---

## Phase 2: Data Aggregation

### Step 2.1: Aggregate Projects by County

**Input:** 
- `public/data/ercot/ercot_gis_reports.geojson` (76,001 features)
- County name from `County` property

**Aggregations Needed:**
1. **Project count** per county
2. **Total capacity (MW)** per county
3. **Average capacity (MW)** per county
4. **Fuel type breakdown:**
   - Count by fuel type (SOL, WIN, GAS, BAT, etc.)
   - Capacity by fuel type
5. **Status breakdown:**
   - Count by study phase
   - Count by projected COD year

**Script:** `scripts/ercot/aggregate_by_county.py`

**Output:** JSON file with county aggregations
```json
{
  "Brazoria": {
    "project_count": 2975,
    "total_capacity_mw": 606094,
    "avg_capacity_mw": 204,
    "fuel_breakdown": {
      "SOL": {"count": 1500, "capacity": 300000},
      "WIN": {"count": 500, "capacity": 100000},
      ...
    },
    "status_breakdown": {...}
  },
  ...
}
```

**Save to:** `data/ercot/county_aggregations.json`

---

### Step 2.2: Merge Aggregations with County Boundaries

**Script:** `scripts/ercot/merge_county_data.py`

**Process:**
1. Load `public/data/texas/texas_counties.geojson`
2. Load `data/ercot/county_aggregations.json`
3. Match counties by name (handle variations: "Harris" vs "Harris County")
4. Add aggregated properties to each county feature
5. Handle counties with no projects (set to 0)

**Output:** `public/data/ercot/ercot_counties_aggregated.geojson`

**Properties added to each county:**
- `project_count` (integer)
- `total_capacity_mw` (float)
- `avg_capacity_mw` (float)
- `fuel_solar_count` (integer)
- `fuel_wind_count` (integer)
- `fuel_gas_count` (integer)
- `fuel_battery_count` (integer)
- `fuel_other_count` (integer)
- `fuel_solar_capacity` (float)
- `fuel_wind_capacity` (float)
- `fuel_gas_capacity` (float)
- `fuel_battery_capacity` (float)
- `fuel_other_capacity` (float)
- `has_projects` (boolean)

---

## Phase 3: Map Layer Implementation

### Step 3.1: Create County Boundaries Layer Component

**File:** `src/components/Map/components/ERCOTCountiesLayer.jsx`

**Features:**
1. Load `ercot_counties_aggregated.geojson`
2. Add fill layer with color-coding
3. Add stroke layer for boundaries
4. Add hover effects
5. Add click popups with county statistics
6. Toggle visibility based on prop

**Color Scheme Options:**

**Option A: By Project Count**
```javascript
'fill-color': [
  'interpolate',
  ['linear'],
  ['get', 'project_count'],
  0, '#f0f0f0',      // No projects: light gray
  10, '#cfe2f3',     // Low: light blue
  100, '#6fa8dc',    // Medium: blue
  500, '#3d85c6',    // High: darker blue
  1000, '#0b5394',   // Very high: dark blue
  2000, '#073763'    // Extreme: very dark blue
]
```

**Option B: By Total Capacity**
```javascript
'fill-color': [
  'interpolate',
  ['linear'],
  ['get', 'total_capacity_mw'],
  0, '#f0f0f0',
  10000, '#fff4cc',   // Low: light yellow
  50000, '#ffd966',   // Medium: yellow
  100000, '#f1c232',  // High: orange
  300000, '#e69138',  // Very high: dark orange
  500000, '#cc0000'   // Extreme: red
]
```

**Option C: By Dominant Fuel Type**
```javascript
'fill-color': [
  'case',
  ['>', ['get', 'fuel_solar_capacity'], ['get', 'fuel_wind_capacity']],
  ['>', ['get', 'fuel_solar_capacity'], ['get', 'fuel_gas_capacity']],
  '#fbbf24',  // Solar dominant: yellow
  ['>', ['get', 'fuel_wind_capacity'], ['get', 'fuel_gas_capacity']],
  '#60a5fa',  // Wind dominant: blue
  '#f87171',  // Gas dominant: red
  '#9ca3af'   // Other/mixed: gray
]
```

**Recommended:** Start with Option A (project count) - easiest to understand

---

### Step 3.2: Add Interactive Features

**Hover Effect:**
- Highlight county with darker stroke
- Show tooltip with county name and project count

**Click Popup:**
Display:
- County name
- Total projects
- Total capacity (MW)
- Average capacity (MW)
- Fuel type breakdown (count and capacity)
- Top 3 fuel types

**Example Popup:**
```
Brazoria County

📊 Projects: 2,975
⚡ Total Capacity: 606,094 MW
📈 Average: 204 MW/project

Fuel Breakdown:
  Solar: 1,500 projects (300,000 MW)
  Wind: 500 projects (100,000 MW)
  Gas: 200 projects (50,000 MW)
  Battery: 100 projects (20,000 MW)
  Other: 675 projects (136,094 MW)
```

---

### Step 3.3: Integrate with Layer Toggle

**File:** `src/components/Map/components/LayerToggle.jsx`

**Add:**
- New toggle for "ERCOT Counties" layer
- Place in same section as "ERCOT GIS Reports"
- Allow both layers to be visible simultaneously (boundaries + markers)

**State Management:**
- Add `showERCOTCounties` state to `Map/index.jsx`
- Pass to `LayerToggle` and `ERCOTCountiesLayer`

---

## Phase 4: Styling & Polish

### Step 4.1: Refine Color Scale

**Test different color schemes:**
- Ensure good contrast
- Colorblind-friendly palette
- Clear distinction between counties

**Consider:**
- Logarithmic scale for capacity (better distribution)
- Categorical colors for fuel types
- Opacity based on project count

---

### Step 4.2: Add Legend

**File:** `src/components/Map/legend/` (integrate with existing legend system)

**Show:**
- Color scale (project count or capacity)
- Min/max values
- Example counties at each level

---

### Step 4.3: Performance Optimization

**For 254 counties:**
- GeoJSON should be lightweight (< 5MB)
- Use simplified boundaries if needed
- Consider vector tiles for very large datasets

---

## Implementation Order

1. ✅ **Phase 1:** Download county boundaries (30 min)
2. ✅ **Phase 2:** Aggregate projects by county (30 min)
3. ✅ **Phase 2:** Merge with boundaries (15 min)
4. ✅ **Phase 3:** Create layer component (1-2 hours)
5. ✅ **Phase 3:** Add interactivity (1 hour)
6. ✅ **Phase 3:** Integrate with toggle (30 min)
7. ✅ **Phase 4:** Styling and polish (1 hour)

**Total Estimated Time:** 4-5 hours

---

## Files to Create

### Scripts:
- `scripts/ercot/download_texas_counties.py`
- `scripts/ercot/aggregate_by_county.py`
- `scripts/ercot/merge_county_data.py`

### Components:
- `src/components/Map/components/ERCOTCountiesLayer.jsx`

### Data Files:
- `public/data/texas/texas_counties.geojson`
- `data/ercot/county_aggregations.json`
- `public/data/ercot/ercot_counties_aggregated.geojson`

### Documentation:
- `docs/ERCOT_COUNTY_BOUNDARIES_PLAN.md` (this file)
- `docs/ERCOT_COUNTY_AGGREGATION_RESULTS.md` (after aggregation)

---

## Testing Checklist

- [ ] County boundaries load correctly
- [ ] All 254 Texas counties present
- [ ] Aggregations match point data totals
- [ ] Color-coding works correctly
- [ ] Hover effects work
- [ ] Click popups show correct data
- [ ] Layer toggle works
- [ ] Performance is acceptable
- [ ] Works at different zoom levels
- [ ] Handles counties with 0 projects

---

## Future Enhancements

1. **Time-based filtering:** Show projects by year
2. **Fuel type layers:** Toggle to show only solar/wind/gas counties
3. **Status filtering:** Show only active/approved projects
4. **Comparison mode:** Compare two time periods
5. **Export:** Download county statistics as CSV
6. **Drill-down:** Click county to show individual projects

---

## Notes

- County boundaries are static (rarely change)
- Aggregations can be regenerated if project data updates
- Consider caching aggregated data for performance
- May want to add county labels at appropriate zoom levels

