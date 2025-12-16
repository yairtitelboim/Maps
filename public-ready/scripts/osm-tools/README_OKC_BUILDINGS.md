# OKC Census Tract Buildings Downloader

This script downloads OSM building data for OKC census tracts and organizes them for use with the OKC Neighborhoods layer.

## Overview

The script:
1. Reads the OKC census tracts GeoJSON file (`public/okc_census_tracts.geojson`)
2. For each tract, queries OpenStreetMap for buildings within the tract's bounding box
3. Filters buildings to only those within the tract boundary
4. Extracts building height/level information for 3D rendering
5. Saves buildings per tract in `public/neighborhood_buildings/`
6. Creates an index file (`neighborhood_index.json`) mapping GEOID to building files

## Usage

### Process all tracts (will take a very long time - 1,205 tracts)
```bash
python3 scripts/osm-tools/okc_tract_buildings_osm.py
```

### Test with a few tracts
```bash
python3 scripts/osm-tools/okc_tract_buildings_osm.py --limit 10
```

### Process a specific tract
```bash
python3 scripts/osm-tools/okc_tract_buildings_osm.py --tract 40143006703
```

## Output Structure

```
public/
  neighborhood_buildings/
    neighborhood_index.json          # Index mapping GEOID to building files
    tract_40143006703_buildings.geojson
    tract_40143006801_buildings.geojson
    ...
```

## Index File Format

```json
{
  "40143006703": {
    "name": "67.03",
    "building_count": 237,
    "file_path": "/neighborhood_buildings/tract_40143006703_buildings.geojson"
  }
}
```

## Building Data Format

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

## Performance Notes

- Processing all 1,205 tracts will take **many hours** (estimate: 1-2 seconds per tract + API delays)
- The script includes rate limiting (1 second delay between tracts)
- Overpass API has timeout limits - some large tracts may fail
- Consider processing in batches or overnight

## Integration with OKCNeighborhoodsLayer

The `OKCNeighborhoodsLayer` component automatically:
1. Loads the index file on mount
2. When a tract is clicked, looks up the tract's GEOID in the index
3. Loads the corresponding building GeoJSON file
4. Displays buildings as 3D extrusions on the map

## Requirements

- Python 3.7+
- `overpy` - OSM Overpass API client
- `shapely` - Geometric operations
- `geopandas` (optional, for advanced operations)

Install with:
```bash
pip install overpy shapely
```

