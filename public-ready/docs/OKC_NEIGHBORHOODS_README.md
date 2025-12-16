# OKC Neighborhoods Layer Implementation

This document describes the complete implementation of the OKC Neighborhoods layer feature, which allows users to view census tracts with hover effects, click to select, and load 3D buildings for each tract.

## Overview

The OKC Neighborhoods feature provides an interactive map layer showing Oklahoma City census tracts. When enabled:
- Census tract boundaries are displayed with stroke outlines
- Hovering over a tract highlights it with a green stroke
- Clicking a tract selects it and loads 3D buildings within that tract
- Buildings are displayed as 3D extrusions with height information

## Architecture

### Components

1. **LayerToggle.jsx** - UI toggle switch for enabling/disabling the layer
2. **OKCNeighborhoodsLayer.jsx** - Main layer component handling Mapbox integration
3. **Map/index.jsx** - Parent component managing layer state

### Data Files

1. **`public/okc_census_tracts.geojson`** - Census tract boundaries (converted from shapefile)
2. **`public/neighborhood_buildings/neighborhood_index.json`** - Index mapping GEOID to building files
3. **`public/neighborhood_buildings/tract_{GEOID}_buildings.geojson`** - Individual building files per tract

## Implementation Steps

### Step 1: Convert Shapefile to GeoJSON

The census tract data was provided as a shapefile located at:
```
public/tl_2021_40_tract/
```

**Conversion Script:** `scripts/convert_shapefile_to_geojson.py`

**Usage:**
```bash
python3 scripts/convert_shapefile_to_geojson.py
```

**Output:** `public/okc_census_tracts.geojson`

**What it does:**
- Reads the shapefile using `geopandas`
- Converts to GeoJSON format
- Preserves all properties including `GEOID` (used as unique identifier)
- Saves to `public/` directory for web access

### Step 2: Create OKCNeighborhoodsLayer Component

**File:** `src/components/Map/components/OKCNeighborhoodsLayer.jsx`

**Based on:** Denver's `DenverNeighborhoodsLayer.jsx` implementation

**Key Features:**
- Loads census tracts GeoJSON as a Mapbox source
- Creates multiple layers:
  - **Base layer**: Invisible fill layer for hit testing
  - **Hover layer**: Green stroke on hover
  - **Selected layer**: Highlighted stroke for selected tract
  - **Buildings layer**: 3D fill-extrusion for buildings
- Handles mouse events (mousemove for hover, click for selection)
- Loads building data on tract click
- Clears previous buildings when selecting a new tract

**Layer IDs:**
- `okc-neighborhoods-source` - GeoJSON source
- `okc-neighborhoods-layer` - Base fill layer
- `okc-neighborhoods-hover-layer` - Hover stroke layer
- `okc-neighborhoods-selected-layer` - Selected stroke layer
- `okc-neighborhood-buildings-source` - Buildings GeoJSON source
- `okc-neighborhood-buildings-layer` - 3D buildings layer

### Step 3: Add Toggle to LayerToggle Component

**File:** `src/components/Map/components/LayerToggle.jsx`

**Changes:**
1. Added `showOKCNeighborhoods` and `setShowOKCNeighborhoods` props
2. Added new `CategorySection` with toggle switch
3. Rendered `OKCNeighborhoodsLayer` component

**UI Structure:**
```jsx
<CategorySection>
  <CategoryHeader onClick={() => setShowOKCNeighborhoods(v => !v)}>
    <CategoryIcon>...</CategoryIcon>
    <CategoryTitle>OKC Neighborhoods</CategoryTitle>
    <ToggleSwitch>...</ToggleSwitch>
  </CategoryHeader>
</CategorySection>
<OKCNeighborhoodsLayer map={map} visible={showOKCNeighborhoods} />
```

### Step 4: Add State Management in Map Component

**File:** `src/components/Map/index.jsx`

**Changes:**
1. Added state: `const [showOKCNeighborhoods, setShowOKCNeighborhoods] = useState(false)`
2. Passed props to `LayerToggle`:
   ```jsx
   <LayerToggle
     showOKCNeighborhoods={showOKCNeighborhoods}
     setShowOKCNeighborhoods={setShowOKCNeighborhoods}
     ...
   />
   ```
3. Added to `updateLayerStates` for scene management

### Step 5: Download OSM Buildings for Each Tract

**Script:** `scripts/osm-tools/okc_tract_buildings_osm.py`

**Purpose:** Downloads building data from OpenStreetMap for each census tract and organizes it for the layer component.

**How it works:**
1. Reads `public/okc_census_tracts.geojson`
2. For each tract:
   - Calculates bounding box
   - Queries Overpass API for buildings in that area
   - Filters buildings to only those within the tract boundary
   - Extracts building height/level information
   - Saves to `public/neighborhood_buildings/tract_{GEOID}_buildings.geojson`
3. Creates index file mapping GEOID to building files

**Usage:**

```bash
# Process all tracts (will take many hours - 1,205 tracts)
python3 scripts/osm-tools/okc_tract_buildings_osm.py

# Test with a few tracts
python3 scripts/osm-tools/okc_tract_buildings_osm.py --limit 10

# Process a specific tract
python3 scripts/osm-tools/okc_tract_buildings_osm.py --tract 40119010300
```

**Output Structure:**
```
public/neighborhood_buildings/
  ├── neighborhood_index.json
  ├── tract_40143006703_buildings.geojson
  ├── tract_40143006801_buildings.geojson
  └── ...
```

**Index File Format:**
```json
{
  "40143006703": {
    "name": "67.03",
    "building_count": 237,
    "file_path": "/neighborhood_buildings/tract_40143006703_buildings.geojson"
  }
}
```

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

**Performance Optimizations:**
- Writes files in batches of 10 to reduce file watcher triggers
- Uses atomic file operations (write to `.tmp`, then rename)
- Rate limiting (1 second delay between API calls)
- Index file only written at the end

## How It Works

### User Flow

1. **Enable Layer:**
   - User toggles "OKC Neighborhoods" switch in LayerToggle
   - `OKCNeighborhoodsLayer` component mounts
   - Census tracts GeoJSON is loaded as Mapbox source
   - Base layer is added (invisible fill for hit testing)
   - Hover and selected layers are added (initially hidden)

2. **Hover Interaction:**
   - User moves mouse over a tract
   - `mousemove` event fires
   - Hover layer filter updates to show green stroke around hovered tract
   - Cursor changes to pointer

3. **Click to Select:**
   - User clicks on a tract
   - `click` event fires
   - Selected layer filter updates to highlight clicked tract
   - Popup appears with tract information
   - `loadNeighborhoodBuildings()` is called

4. **Load Buildings:**
   - Component checks `neighborhood_index.json` for tract GEOID
   - If found, fetches corresponding building GeoJSON file
   - Clears any existing buildings from previous selection
   - Adds buildings as 3D fill-extrusion layer
   - Buildings render with height based on:
     - `height_m` property (if available)
     - `height` property (if available)
     - `levels * 3` (estimated from floor count)
     - Default: 5 meters

5. **Select New Tract:**
   - Previous buildings are cleared
   - New buildings are loaded for the new tract

### Data Loading

**On Component Mount:**
```javascript
useEffect(() => {
  const loadNeighborhoodIndex = async () => {
    const response = await fetch('/neighborhood_buildings/neighborhood_index.json');
    const index = await response.json();
    neighborhoodIndexRef.current = index;
  };
  loadNeighborhoodIndex();
}, []);
```

**On Tract Click:**
```javascript
const loadNeighborhoodBuildings = async (tractId, tractGeometry) => {
  // Clear previous buildings
  clearNeighborhoodBuildings();
  
  // Check index
  if (neighborhoodIndexRef.current[tractId]) {
    const tractInfo = neighborhoodIndexRef.current[tractId];
    const response = await fetch(tractInfo.file_path);
    const buildingsData = await response.json();
    
    // Add to map as 3D layer
    map.current.addSource(OKC_NEIGHBORHOOD_BUILDINGS_SOURCE_ID, {
      type: 'geojson',
      data: buildingsData
    });
    
    map.current.addLayer({
      id: OKC_NEIGHBORHOOD_BUILDINGS_LAYER_ID,
      type: 'fill-extrusion',
      ...
    });
  }
};
```

## File Structure

```
OKC/
├── public/
│   ├── okc_census_tracts.geojson                    # Census tract boundaries
│   └── neighborhood_buildings/
│       ├── neighborhood_index.json                   # Index mapping GEOID to files
│       ├── tract_40143006703_buildings.geojson       # Buildings for tract 40143006703
│       └── ...
├── src/
│   └── components/
│       └── Map/
│           ├── index.jsx                             # Main map component (state management)
│           └── components/
│               ├── LayerToggle.jsx                   # UI toggle switch
│               └── OKCNeighborhoodsLayer.jsx         # Layer implementation
└── scripts/
    ├── convert_shapefile_to_geojson.py              # Shapefile → GeoJSON converter
    └── osm-tools/
        ├── okc_tract_buildings_osm.py               # OSM building downloader
        ├── check_buildings_progress.py              # Progress checker
        └── rebuild_buildings_index.py               # Index rebuilder
```

## Dependencies

### Python Scripts
- `geopandas` - Shapefile reading
- `overpy` - OSM Overpass API client
- `shapely` - Geometric operations

Install with:
```bash
pip install geopandas overpy shapely
```

### React/Mapbox
- `mapbox-gl` - Map rendering
- `@turf/turf` - Geospatial utilities
- React hooks: `useState`, `useEffect`, `useRef`

## Troubleshooting

### App Reloads Every 5 Seconds

**Problem:** Development server file watcher detects new building files and triggers hot reloads.

**Solutions:**

1. **Temporary:** Stop the building download process:
   ```bash
   ps aux | grep okc_tract_buildings_osm.py
   kill <PID>
   ```

2. **Permanent:** The script now batches writes (every 10 files) to reduce reloads. Restart the download with the updated script.

3. **Alternative:** Configure webpack to ignore the directory (requires ejecting from react-scripts or custom webpack config).

### Buildings Not Loading

**Check:**
1. Is the tract in the index? Check `public/neighborhood_buildings/neighborhood_index.json`
2. Does the building file exist? Check `public/neighborhood_buildings/tract_{GEOID}_buildings.geojson`
3. Check browser console for fetch errors
4. Rebuild index: `python3 scripts/osm-tools/rebuild_buildings_index.py`

### Missing Buildings for a Tract

**Process the specific tract:**
```bash
python3 scripts/osm-tools/okc_tract_buildings_osm.py --tract <GEOID>
```

Then rebuild the index:
```bash
python3 scripts/osm-tools/rebuild_buildings_index.py
```

## Progress Monitoring

**Check download progress:**
```bash
python3 scripts/osm-tools/check_buildings_progress.py
```

**Rebuild index from existing files:**
```bash
python3 scripts/osm-tools/rebuild_buildings_index.py
```

## Performance Notes

- Processing all 1,205 tracts takes **many hours** (estimate: 1-2 seconds per tract + API delays)
- Script includes rate limiting (1 second delay between tracts)
- Overpass API has timeout limits - some large tracts may fail
- Consider processing in batches or overnight
- Files are written in batches of 10 to reduce file watcher triggers

## Future Enhancements

Potential improvements:
- [ ] Cache buildings in browser localStorage
- [ ] Progressive loading (load buildings as user zooms)
- [ ] Building filtering (by type, height, etc.)
- [ ] Building information popups
- [ ] Statistics overlay (building count, average height, etc.)
- [ ] Export functionality for selected tracts

## Related Documentation

- [Denver Neighborhoods Implementation](../DENVER/denver2/README.md) - Reference implementation
- [OSM Integration README](./OSM_INTEGRATION_README.md) - General OSM data integration
- [LayerToggle Architecture](./LAYERTOGGLE_ARCHITECTURE_REVIEW.md) - Layer toggle system

## Credits

- Based on Denver Neighborhoods layer implementation
- Uses OpenStreetMap data (© OpenStreetMap contributors)
- Census tract data from U.S. Census Bureau

