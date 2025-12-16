# Guide: Setting Up a New Location

This guide walks you through setting up a new geographic location with neighborhoods, OSM data collection, and 3D buildings.

## Overview

Setting up a new location involves 4 main steps:
1. **Map Initialization** - Configure map center, zoom, and geographic settings
2. **OSM Data Collection** - Set up the green button (OSMCall) for location-specific OSM queries
3. **3D Building Download** - Download and organize building data for neighborhoods
4. **LayerToggle Integration** - Add the new layer to the UI

---

## Step 1: Map Initialization

### 1.1 Update Map Center and Zoom

**File:** `src/components/Map/constants.js`

Update the `MAP_CONFIG` object with your new location's coordinates:

```javascript
export const MAP_CONFIG = {
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-97.0584, 36.1156], // [longitude, latitude] for your location
    zoom: 12, // Initial zoom level (adjust as needed)
    minZoom: 1,
    maxZoom: 17,
    pitch: 0,
    dragRotate: true,
    touchZoomRotate: true,
    doubleClickZoom: true,
    touchPitch: false,
    pitchWithRotate: false
};
```

**Example for Oklahoma City:**
```javascript
center: [-97.5164, 35.4676], // OKC coordinates
zoom: 11, // City-level view
```

### 1.2 Update Geographic Configuration (Optional)

**File:** `src/config/geographicConfig.js`

Add your location to the `GEOGRAPHIC_CONFIG` object:

```javascript
export const GEOGRAPHIC_CONFIG = {
  // ... existing locations ...
  
  your_location: {
    coordinates: { lat: 35.4676, lng: -97.5164 },
    city: 'Oklahoma City',
    state: 'OK',
    county: 'Oklahoma County',
    region: 'Central Oklahoma',
    gridOperator: 'OG&E',
    timezone: 'America/Chicago',
    searchRadius: 5000, // meters
    businessContext: 'Your location description',
    dataCenterCompany: 'Company Name',
    facilityName: 'Facility Name'
  }
};
```

**Note:** This is used by various tools and strategies throughout the app.

---

## Step 2: OSM Data Collection (Green Button)

### 2.1 Understand OSMCall Component

**File:** `src/components/Map/components/Cards/OSMCall.jsx`

The OSMCall component (green button) allows users to query OpenStreetMap data for the current location. It uses geographic configuration to determine search radius and context.

### 2.2 Key Configuration Points

The component automatically uses:
- `GEOGRAPHIC_CONFIG` from `src/config/geographicConfig.js`
- Search radius from the geographic config
- Location coordinates from the geographic config

**No code changes needed** if you've updated `geographicConfig.js` correctly.

### 2.3 Testing OSM Collection

1. Open the app
2. Click the green "OSM" button
3. Verify it queries the correct location
4. Check that results are relevant to your area

**If issues occur:**
- Verify coordinates in `geographicConfig.js`
- Check search radius is appropriate (5000m = 5km)
- Ensure the location key matches what's being used

---

## Step 3: 3D Building Download

### 3.1 Prepare Census Tract Data

You need census tract boundaries for your location. These are typically available as:
- Shapefiles from U.S. Census Bureau
- GeoJSON files
- Other geospatial formats

**For OKC, we used:** `public/tl_2021_40_tract/` (shapefile)

### 3.2 Convert Shapefile to GeoJSON

**Script:** `scripts/convert_shapefile_to_geojson.py`

**Usage:**
```bash
# Update the script with your shapefile path
python3 scripts/convert_shapefile_to_geojson.py
```

**What to update in the script:**
```python
# Input shapefile path
input_shp_path = Path('public/your_location_tracts/tracts.shp')

# Output GeoJSON path
output_geojson_path = Path('public/your_location_census_tracts.geojson')
```

**Output:** Creates `public/your_location_census_tracts.geojson`

**Coordinate System:**
- The script automatically converts to WGS84 (EPSG:4326)
- If your shapefile is in a different CRS, the script handles conversion
- Verify the output coordinates are in `[longitude, latitude]` format

**Verification:**
After conversion, verify the GeoJSON:
```bash
# Check file size (should be reasonable, not too large)
ls -lh public/your_location_census_tracts.geojson

# Check first few features
python3 -c "import json; data = json.load(open('public/your_location_census_tracts.geojson')); print(f'Features: {len(data[\"features\"])}'); print(f'Sample GEOID: {data[\"features\"][0][\"properties\"].get(\"GEOID\", \"N/A\")}')"
```

### 3.3 Download OSM Buildings for Tracts

**Script:** `scripts/osm-tools/okc_tract_buildings_osm.py`

**Create a new script for your location** (or modify the existing one):

**File:** `scripts/osm-tools/your_location_tract_buildings_osm.py`

**Key changes needed:**

1. **Update paths:**
```python
tracts_file = project_root / 'public' / 'your_location_census_tracts.geojson'
output_dir = project_root / 'public' / 'neighborhood_buildings'
index_file = output_dir / 'neighborhood_index.json'
```

2. **Update GEOID property name** (if different):
```python
tract_id = tract['properties'].get('GEOID', f"tract_{i}")
# Or use: tract['properties'].get('TRACTCE') or other property name
```

3. **Run the script:**
```bash
# Test with a few tracts
python3 scripts/osm-tools/your_location_tract_buildings_osm.py --limit 10

# Process all tracts (will take hours)
python3 scripts/osm-tools/your_location_tract_buildings_osm.py
```

**Output structure:**
```
public/neighborhood_buildings/
  ├── neighborhood_index.json
  ├── tract_12345_buildings.geojson
  ├── tract_12346_buildings.geojson
  └── ...
```

### 3.4 Building Data Strategy

You have two options for building data:

**Option A: OSM Query on Click (Dynamic)**
- Query OSM buildings within clicked tract geometry when user clicks
- No pre-processing required
- Slower on first click, but no storage needed
- Good for testing or small datasets

**Option B: Pre-processed Building Files (Recommended)**
- Pre-download buildings for all tracts using the script
- Store per-tract building files in `public/neighborhood_buildings/`
- Create index file: `neighborhood_buildings/neighborhood_index.json`
- Faster loading, better user experience
- Recommended for production

**Index File Format:**
```json
{
  "GEOID_12345": {
    "name": "Tract Name",
    "building_count": 237,
    "file_path": "/neighborhood_buildings/tract_12345_buildings.geojson"
  }
}
```

**Building Height Extraction:**
The script extracts building height from OSM data:
- Primary: `height_m` property (meters)
- Fallback: `height` property (converted to meters)
- Fallback: `levels * 3` (estimated from floor count)
- Default: 5 meters if no height data

**Building File Format:**
Each building GeoJSON file contains:
- `type`: "FeatureCollection"
- `features`: Array of building features with:
  - `geometry`: Polygon coordinates
  - `properties`:
    - `osm_id`: OSM way ID
    - `building`: Building type
    - `name`: Building name (if available)
    - `height`: Building height (meters)
    - `height_m`: Building height in meters
    - `levels`: Number of floors
    - `tract_id`: Census tract GEOID
    - `tract_name`: Tract name
    - `tags`: All OSM tags

### 3.4 Create Download Remaining Script

**File:** `scripts/osm-tools/download_remaining_buildings.py`

Update the paths in this script to match your location:

```python
tracts_file = project_root / 'public' / 'your_location_census_tracts.geojson'
```

**Usage:**
```bash
# Download remaining buildings
python3 scripts/osm-tools/download_remaining_buildings.py

# Check progress
python3 scripts/osm-tools/check_buildings_progress.py
```

### 3.5 Development Server Reload Issue

**Problem:** The development server's file watcher detects new building files and triggers hot reloads every few seconds.

**Solutions:**

1. **Temporary:** Stop the building download while developing:
   ```bash
   ps aux | grep tract_buildings_osm.py
   kill <PID>
   ```

2. **Permanent:** The script batches writes (every 10 files) to reduce reloads. Restart the download with the updated script.

3. **Alternative:** Configure webpack to ignore the directory (requires ejecting from react-scripts or custom webpack config).

**Note:** This only affects development. Production builds are not affected.

---

## Step 4: LayerToggle Integration

### 4.1 Create Neighborhoods Layer Component

**File:** `src/components/Map/components/YourLocationNeighborhoodsLayer.jsx`

**Template:** Copy from `OKCNeighborhoodsLayer.jsx` and modify:

**Key changes:**

1. **Update constants (Layer IDs):**
```javascript
const YOUR_LOCATION_NEIGHBORHOODS_SOURCE_ID = 'your-location-neighborhoods-source';
const YOUR_LOCATION_NEIGHBORHOODS_LAYER_ID = 'your-location-neighborhoods-layer';
const YOUR_LOCATION_NEIGHBORHOODS_HOVER_LAYER_ID = 'your-location-neighborhoods-hover-layer';
const YOUR_LOCATION_NEIGHBORHOODS_SELECTED_LAYER_ID = 'your-location-neighborhoods-selected-layer';
const YOUR_LOCATION_NEIGHBORHOOD_BUILDINGS_SOURCE_ID = 'your-location-neighborhood-buildings-source';
const YOUR_LOCATION_NEIGHBORHOOD_BUILDINGS_LAYER_ID = 'your-location-neighborhood-buildings-layer';
```

**Layer Structure:**
- **Base layer**: Invisible fill layer (0.01 opacity) for hit testing
- **Hover layer**: Stroke layer showing boundaries on hover (green stroke)
- **Selected layer**: Fill layer (20% opacity) for clicked tract
- **Buildings layer**: 3D fill-extrusion for buildings

2. **Update GeoJSON path:**
```javascript
map.current.addSource(YOUR_LOCATION_NEIGHBORHOODS_SOURCE_ID, {
  type: 'geojson',
  data: '/your_location_census_tracts.geojson' // Your GeoJSON file
});
```

3. **Update index path:**
```javascript
const response = await fetch('/neighborhood_buildings/neighborhood_index.json');
```

4. **Update Unique ID Property:**
```javascript
// Use the unique identifier from your census tract data
// Common names: GEOID, NBHD_ID, TRACTCE, etc.
const tractId = feature.properties.GEOID; // Or your property name
```

**Important:** Ensure this property is consistent across:
- GeoJSON features
- Building index file
- Building file naming

5. **Update colors:**
```javascript
// Hover stroke color (green is standard)
'line-color': '#22c55e', // Green for hover

// Selected fill color
'fill-color': '#3B82F6', // Blue for selected

// Building extrusion color (choose a distinct color for your location)
'fill-extrusion-color': '#3B82F6', // Blue for OKC, use different for other locations
```

**Color Scheme Recommendations:**
- Use distinct colors to differentiate from other locations
- OKC uses blue (#3B82F6)
- Denver uses green (#22c55e)
- Choose colors that work with dark map style

6. **Layer Ordering (Z-Index):**
```javascript
// Ensure your layers appear above base map layers
// Add layers in this order (bottom to top):
// 1. Base fill layer (invisible, for hit testing)
// 2. Selected fill layer
// 3. Hover stroke layer
// 4. Buildings layer (should be on top)

// If you need to move layers above other map layers:
map.current.moveLayer(YOUR_LOCATION_NEIGHBORHOOD_BUILDINGS_LAYER_ID);
// This moves the layer to the top
```

**Layer Order Best Practices:**
- Buildings layer should be on top (most visible)
- Hover/selected layers should be above base map
- Use `moveLayer()` if layers appear in wrong order

### 4.2 Add to LayerToggle Component

**File:** `src/components/Map/components/LayerToggle.jsx`

#### 4.2.1 Import the Component

```javascript
import YourLocationNeighborhoodsLayer from './YourLocationNeighborhoodsLayer';
```

#### 4.2.2 Add State Props

In the `forwardRef` function parameters, add:
```javascript
showYourLocationNeighborhoods,
setShowYourLocationNeighborhoods,
```

#### 4.2.3 Add to State Transmission

In the `onTransmissionLayerStateUpdate` useEffect, add:
```javascript
const stateToSend = {
  // ... existing states ...
  showYourLocationNeighborhoods,
};
```

And in the dependency array:
```javascript
}, [
  // ... existing dependencies ...
  showYourLocationNeighborhoods,
  onTransmissionLayerStateUpdate
]);
```

#### 4.2.4 Add to useImperativeHandle

In the `updateLayerStates` function:
```javascript
if (newStates.showYourLocationNeighborhoods !== undefined) {
  setShowYourLocationNeighborhoods(newStates.showYourLocationNeighborhoods);
}
```

And in the dependency array:
```javascript
}), [setShowTransportation, /* ... */, setShowYourLocationNeighborhoods]);
```

#### 4.2.5 Add UI Toggle Section

Add a new `CategorySection`:
```javascript
{/* Your Location Neighborhoods Section */}
<CategorySection>
  <CategoryHeader onClick={() => setShowYourLocationNeighborhoods(v => !v)} style={{ cursor: 'pointer' }}>
    <CategoryIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
        <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
      </svg>
    </CategoryIcon>
    <CategoryTitle>Your Location Neighborhoods</CategoryTitle>
    <ToggleSwitch>
      <input
        type="checkbox"
        checked={showYourLocationNeighborhoods}
        onClick={e => e.stopPropagation()}
        onChange={() => setShowYourLocationNeighborhoods(v => !v)}
      />
      <span></span>
    </ToggleSwitch>
  </CategoryHeader>
</CategorySection>

<YourLocationNeighborhoodsLayer
  map={map}
  visible={showYourLocationNeighborhoods}
/>
```

#### 4.2.6 Add to SceneManager

In the `layerStates` prop:
```javascript
<SceneManager
  map={map.current}
  layerStates={{
    // ... existing states ...
    showYourLocationNeighborhoods,
  }}
  onLoadScene={(sceneLayerStates) => {
    // ... existing scene loading ...
    if (sceneLayerStates.showYourLocationNeighborhoods !== undefined) {
      setShowYourLocationNeighborhoods(sceneLayerStates.showYourLocationNeighborhoods);
    }
  }}
/>
```

#### 4.2.7 Optional: Auto-Enable Layer (Optional)

If you want the layer to automatically enable after map loads (like OKC does):

Add this `useEffect` in `LayerToggle.jsx`:
```javascript
// Auto-enable Your Location Neighborhoods layer 2 seconds after map initialization
useEffect(() => {
  if (!map?.current) return;
  if (showYourLocationNeighborhoods) return; // Already enabled, don't run again

  let timeoutId = null;

  const enableYourLocationNeighborhoods = () => {
    setShowYourLocationNeighborhoods(true);
  };

  // Check if map is already loaded
  if (map.current.isStyleLoaded()) {
    timeoutId = setTimeout(enableYourLocationNeighborhoods, 2000);
  } else {
    // Wait for map to load, then set timeout
    const handleStyleLoad = () => {
      timeoutId = setTimeout(enableYourLocationNeighborhoods, 2000);
      if (map.current) {
        map.current.off('styledata', handleStyleLoad);
      }
    };
    
    map.current.on('styledata', handleStyleLoad);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (map.current) {
        map.current.off('styledata', handleStyleLoad);
      }
    };
  }

  return () => {
    if (timeoutId) clearTimeout(timeoutId);
  };
}, [map, showYourLocationNeighborhoods]);
```

**Note:** This is optional - remove if you don't want auto-enable behavior.

### 4.3 Add State to Map Component

**File:** `src/components/Map/index.jsx`

#### 4.3.1 Add State Declaration

```javascript
const [showYourLocationNeighborhoods, setShowYourLocationNeighborhoods] = useState(false);
```

#### 4.3.2 Pass to LayerToggle

```javascript
<LayerToggle
  // ... existing props ...
  showYourLocationNeighborhoods={showYourLocationNeighborhoods}
  setShowYourLocationNeighborhoods={setShowYourLocationNeighborhoods}
/>
```

#### 4.3.3 Add to Layer States Update

In the `updateLayerStates` function (if it exists):
```javascript
const layerStates = {
  // ... existing states ...
  showYourLocationNeighborhoods,
};
```

---

## Step 4.5: Update LegendContainer Component

**File:** `src/components/Map/components/Cards/LegendContainer.jsx`

The LegendContainer displays map layer legends and needs location-specific configuration for universities and OSM layers.

### 4.5.1 Add Location to University Configuration

Update the `getLocationUniversities` function to include your new location:

```javascript
const getLocationUniversities = (locationKey) => {
  const config = getGeographicConfig(locationKey);
  const { city, state } = config;
  
  // Define location-specific universities
  const locationUniversities = {
    boston: {
      mit: { name: 'MIT', color: '#dc2626', description: 'Massachusetts Institute of Technology' },
      harvard: { name: 'Harvard', color: '#7c2d12', description: 'Harvard University' },
      // ... other Boston universities
    },
    default: { // Houston
      rice: { name: 'Rice University', color: '#dc2626', description: 'Rice University' },
      // ... other Houston universities
    },
    seattle: {
      uw: { name: 'University of Washington', color: '#dc2626', description: 'University of Washington' },
      // ... other Seattle universities
    },
    your_location: { // Add your new location here
      university1: { name: 'University Name 1', color: '#dc2626', description: 'Description' },
      university2: { name: 'University Name 2', color: '#7c2d12', description: 'Description' },
      // Add all relevant universities for your location
    }
  };
  
  return locationUniversities[locationKey] || locationUniversities.default;
};
```

**Key Points:**
- Each university needs: `name`, `color`, `description`
- Use distinct colors for each university
- Colors should work with dark map style
- The `locationKey` should match your geographic config key

### 4.5.2 Ensure currentLocation Prop is Passed

**File:** `src/components/Map/index.jsx` (or wherever LegendContainer is used)

Make sure `currentLocation` prop is passed correctly:

```javascript
<LegendContainer
  // ... other props ...
  currentLocation="your_location" // Should match your geographic config key
/>
```

**Note:** The `currentLocation` prop determines which university configuration to use and affects OSM layer visibility states.

### 4.5.3 OSM Layer Visibility States

The component automatically initializes OSM layer visibility states based on `currentLocation`. The `useEffect` at lines 152-178 handles this:

```javascript
// Reset layer visibility when location changes
useEffect(() => {
  const locationUniversities = getLocationUniversities(currentLocation);
  const universityLayers = {};
  Object.keys(locationUniversities).forEach(key => {
    universityLayers[key] = true;
  });
  
  setOsmLayerVisibility({
    ...universityLayers,
    otherUniversities: true,
    offices: true,
    transportation: true,
    // ... other common layers
  });
}, [currentLocation]);
```

**No changes needed** if you've added your location to `getLocationUniversities` correctly.

### 4.5.4 Layer Mapping

The `toggleOsmLayer` function (lines 1064-1162) uses location-aware layer mapping:

```javascript
const locationUniversities = getLocationUniversities(currentLocation);
const layerMap = {
  // Dynamic university layers based on location
  ...Object.keys(locationUniversities).reduce((acc, key) => {
    acc[key] = `osm-${key}`;
    return acc;
  }, {}),
  // Common layers (same for all locations)
  otherUniversities: 'osm-other-universities',
  offices: 'osm-offices',
  // ... etc
};
```

**No changes needed** - this is automatically generated from your university configuration.

### 4.5.5 Testing LegendContainer

After setup, verify:
- [ ] Legend appears when map data is loaded
- [ ] University layers show correct names and colors
- [ ] Toggle buttons work for all layer types
- [ ] Location-specific universities appear (not default)
- [ ] OSM layers toggle correctly
- [ ] Legend sections collapse/expand properly

### 4.5.6 Optional: Custom Legend Sections

If your location has unique data types (like OKC has data centers), you may need to add custom legend sections. See the `getLegendSections` function (lines 1991-2664) for examples.

**Example:** Adding a custom section for your location:
```javascript
// In getLegendSections function
if (yourLocationData.totalFeatures > 0) {
  const yourLocationItems = yourLocationData.features.map(feature => ({
    label: feature.properties.name,
    color: '#YOUR_COLOR',
    count: 1,
    type: 'circle',
    description: 'Your location feature'
  }));
  
  sections.push({
    title: 'Your Location Features',
    items: yourLocationItems
  });
}
```

---

## Step 5: Testing Checklist

### 5.1 Map Initialization
- [ ] Map centers on correct location
- [ ] Zoom level is appropriate
- [ ] Map loads without errors
- [ ] Geographic config is correct

### 5.2 OSM Data Collection
- [ ] Green button appears
- [ ] Clicking button queries correct location
- [ ] Results are relevant to area
- [ ] Search radius is appropriate

### 5.3 Data Conversion
- [ ] Shapefile converts to GeoJSON successfully
- [ ] GeoJSON loads correctly in browser
- [ ] All features have required properties (GEOID, NAME, etc.)
- [ ] Coordinate system is WGS84 (EPSG:4326)

### 5.4 3D Buildings
- [ ] Census tracts GeoJSON loads correctly
- [ ] Building download script runs without errors
- [ ] Buildings appear when clicking tracts
- [ ] Buildings have correct heights (from height_m, height, or levels)
- [ ] Index file is created and updated
- [ ] Building files are properly formatted
- [ ] Performance is acceptable with large building datasets

### 5.5 LayerToggle Integration
- [ ] Toggle appears in sidebar
- [ ] Toggle can be turned on/off
- [ ] Layer appears/disappears correctly
- [ ] Hover highlighting works (green stroke)
- [ ] Click selection works (blue fill)
- [ ] Buildings load on click
- [ ] Popup displays correctly (GEOID, NAME, building count)
- [ ] Scene saving/loading works
- [ ] Cleanup works on toggle off (layers removed)

### 5.5.1 LegendContainer Integration
- [ ] Legend appears when map data is loaded
- [ ] Location-specific universities appear (not default)
- [ ] University names and colors are correct
- [ ] OSM layer toggles work correctly
- [ ] Legend sections collapse/expand properly
- [ ] All/None toggle buttons work
- [ ] Layer visibility states persist correctly

### 5.6 Error Handling
- [ ] Gracefully handles missing building data
- [ ] Handles failed building loads
- [ ] Handles missing index file
- [ ] Handles invalid GEOIDs
- [ ] Console errors are minimal

### 5.7 Performance
- [ ] Layer loads quickly (< 2 seconds)
- [ ] Buildings load quickly on click (< 3 seconds)
- [ ] No lag when hovering over tracts
- [ ] Map remains responsive with many buildings
- [ ] Memory usage is reasonable

### 5.8 Layer Ordering
- [ ] Layers appear in correct visual order
- [ ] Buildings appear above base map
- [ ] Hover/selected layers are visible
- [ ] No layer conflicts with other map layers

---

## File Structure Summary

```
YourProject/
├── public/
│   ├── your_location_census_tracts.geojson          # Census tract boundaries
│   └── neighborhood_buildings/
│       ├── neighborhood_index.json                   # Building index
│       └── tract_*_buildings.geojson               # Individual building files
├── src/
│   ├── components/
│   │   └── Map/
│   │       ├── index.jsx                           # Map component (state)
│   │       ├── constants.js                         # MAP_CONFIG
│   │       └── components/
│   │           ├── LayerToggle.jsx                 # UI toggle
│   │           ├── YourLocationNeighborhoodsLayer.jsx  # Layer component
│   │           └── Cards/
│   │               └── LegendContainer.jsx         # Legend display
│   └── config/
│       └── geographicConfig.js                      # Geographic settings
└── scripts/
    ├── convert_shapefile_to_geojson.py             # Shapefile converter
    └── osm-tools/
        ├── your_location_tract_buildings_osm.py    # Building downloader
        ├── download_remaining_buildings.py          # Resume download
        └── check_buildings_progress.py             # Progress checker
```

---

## Common Issues and Solutions

### Issue: Map doesn't center correctly
**Solution:** Verify coordinates are `[longitude, latitude]` (not lat/lng). Check `MAP_CONFIG.center` in `constants.js`.

### Issue: OSM queries wrong location
**Solution:** Update `GEOGRAPHIC_CONFIG` with correct coordinates and ensure the location key is used correctly.

### Issue: Buildings don't load
**Solution:** 
- Check index file exists and has correct GEOIDs
- Verify building files are in `public/neighborhood_buildings/`
- Check browser console for fetch errors
- Ensure GEOID property name matches in all files

### Issue: Toggle doesn't appear
**Solution:**
- Verify component is imported
- Check state props are passed correctly
- Ensure CategorySection is added to JSX
- Check for console errors

### Issue: Layer doesn't render
**Solution:**
- Verify map ref is passed correctly
- Check layer IDs are unique
- Ensure GeoJSON file path is correct
- Check Mapbox console for layer errors

---

## Quick Reference: Key Files to Modify

| Step | File | What to Change |
|------|------|---------------|
| 1.1 | `src/components/Map/constants.js` | `MAP_CONFIG.center`, `MAP_CONFIG.zoom` |
| 1.2 | `src/config/geographicConfig.js` | Add new location config |
| 2.1 | (No changes needed if 1.2 is done) | - |
| 3.1 | `scripts/convert_shapefile_to_geojson.py` | Input/output paths |
| 3.2 | `scripts/osm-tools/*_tract_buildings_osm.py` | Create new script, update paths |
| 4.1 | `src/components/Map/components/*NeighborhoodsLayer.jsx` | Create new component |
| 4.2 | `src/components/Map/components/LayerToggle.jsx` | Add import, state, UI section |
| 4.3 | `src/components/Map/index.jsx` | Add state, pass to LayerToggle |
| 4.5 | `src/components/Map/components/Cards/LegendContainer.jsx` | Add location to university config |

---

## Example: Complete OKC Implementation

For reference, see:
- `OKCNeighborhoodsLayer.jsx` - Complete layer component
- `LayerToggle.jsx` lines 1038-1063 - OKC toggle section
- `scripts/osm-tools/okc_tract_buildings_osm.py` - Building download script
- `public/okc_census_tracts.geojson` - Census tract data

---

## Next Steps After Setup

1. **Test thoroughly** - Use the testing checklist above
2. **Optimize performance** - Consider caching, batching, etc.
3. **Add features** - Building info popups, statistics, filtering
4. **Document** - Update this guide with location-specific notes

## Best Practices

### Start Small
- Always test with `--limit 10` first
- Verify everything works before processing all tracts
- Check a few building files manually

### Data Quality
- Verify GEOID consistency across all files
- Check coordinate system is WGS84
- Ensure building heights are reasonable
- Validate GeoJSON structure

### Development Workflow
1. **Initial Setup:** Configure map center, geographic config
2. **Data Preparation:** Convert shapefile, verify GeoJSON
3. **Test Download:** Download 10-20 tracts to verify script works
4. **Full Download:** Run full download (overnight recommended)
5. **Component Development:** Create layer component, test with sample data
6. **Integration:** Add to LayerToggle, test UI
7. **Final Testing:** Complete testing checklist

### Production Considerations
- Building files should be optimized (remove unnecessary properties)
- Consider compressing large GeoJSON files
- Index file should be small and fast to load
- Implement error boundaries for graceful failures
- Add loading states for better UX
- Consider CDN for static building files

---

## Dependencies

### Required Python Packages
```bash
pip install geopandas overpy shapely
```

- **geopandas** - For shapefile reading and conversion
- **overpy** - OSM Overpass API client for building downloads
- **shapely** - Geometric operations (point-in-polygon, intersections)

### Required JavaScript/React Packages
- `mapbox-gl` - Map rendering (already in project)
- `@turf/turf` - Geospatial utilities (already in project)
- React hooks: `useState`, `useEffect`, `useRef`, `useCallback`

## Key Implementation Details

### Unique ID Field
- Use a consistent unique identifier across all data
- Common names: `GEOID`, `NBHD_ID`, `TRACTCE`
- Must match between:
  - GeoJSON features
  - Building index file keys
  - Building file names

### Color Scheme
- Choose distinct colors to differentiate from other locations
- OKC: Blue (#3B82F6)
- Denver: Green (#22c55e)
- Ensure colors work with dark map style
- Hover: Green stroke (#22c55e)
- Selected: Blue fill (#3B82F6)

### Building Height
- Extract from OSM `height` or `building:levels` properties
- Priority order:
  1. `height_m` (meters)
  2. `height` (converted to meters)
  3. `levels * 3` (estimated)
  4. Default: 5 meters

### Popup Content
- Display unique ID (GEOID)
- Display tract name (NAME)
- Display building count when loaded
- Show loading state while fetching

### Error Handling
- Gracefully handle missing building data
- Handle failed OSM API calls
- Handle missing index files
- Log errors to console for debugging
- Don't break map if one tract fails

### Rate Limiting
- OSM Overpass API has rate limits
- Script includes 1-second delay between API calls
- For large datasets, consider:
  - Running downloads overnight
  - Using multiple API endpoints (if available)
  - Implementing exponential backoff for retries
  - Processing in smaller batches

### Performance Optimization
- **Large datasets:** Consider processing in batches
- **Building file size:** Individual files should be < 10MB for fast loading
- **Index file:** Keep it small (< 1MB) for quick loading
- **Caching:** Consider browser localStorage for frequently accessed tracts
- **Lazy loading:** Only load buildings when tract is clicked

### Index File Recovery
If the index file gets corrupted or deleted:
```bash
# Rebuild from existing building files
python3 scripts/osm-tools/rebuild_buildings_index.py
```

This scans all building files and recreates the index.

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify all file paths are correct
3. Ensure all dependencies are installed
4. Review the OKC implementation as a reference
5. Check that GEOID property names are consistent
6. Verify coordinate system is WGS84 (EPSG:4326)
7. Check that layer IDs are unique
8. Ensure building index file format is correct

---

**Last Updated:** Based on OKC implementation
**Version:** 1.1 (Added plan details)

