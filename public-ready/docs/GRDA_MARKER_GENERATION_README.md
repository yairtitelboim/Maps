# GRDA Power Generation Marker Generation

This document explains how the blue teardrop markers for GRDA (Grand River Dam Authority) power generation facilities are generated and displayed on the map. These markers are dynamically created from utility data stored in JSON format.

## Overview

The GRDA power markers are generated from structured JSON data that contains information about power generation facilities, including their names, types, capacities, fuel sources, and geographic coordinates. The markers are color-coded based on fuel type and include interactive popups with detailed information.

## Data Flow

```
1. Data Extraction (Python)
   ↓
2. Coordinate Addition (Python)
   ↓
3. JSON Data File
   ↓
4. Frontend Marker Rendering (React/Mapbox)
```

## Step 1: Data Extraction

**Script:** `scripts/grda/firecrawl_capacity_extractor.py`

This script extracts power generation capacity data from GRDA's website using the Firecrawl API.

### Process:

1. **Scrapes GRDA web pages** using Firecrawl API:
   - `https://grda.com/electricity/`
   - `https://grda.com/about/`

2. **Extracts generating unit information** using regex patterns to identify:
   - Facility names (e.g., "Pensacola Dam", "Redbud Power Plant")
   - Capacity in MW
   - Fuel types (Hydro, Wind, Gas, etc.)

3. **Structures the data** into a JSON format with:
   ```json
   {
     "generating_units": [
       {
         "name": "Pensacola Dam",
         "type": "Hydro",
         "net_MW": 126,
         "fuel": "Hydro",
         "commissioned": null
       }
     ],
     "capacity_mix": {
       "Hydro_MW": 514,
       "Gas_MW": 457,
       "Wind_MW": 385
     }
   }
   ```

4. **Saves to:** `data/grda/firecrawl_capacity_data.json`

### Running the Extraction:

```bash
cd scripts/grda
python firecrawl_capacity_extractor.py
```

**Requirements:**
- `FIRECRAWL_API_KEY` environment variable must be set
- Python packages: `requests`, `python-dotenv`

## Step 2: Adding Coordinates

**Script:** `scripts/grda/add_coordinates_to_capacity.py`

This script adds latitude and longitude coordinates to each generating unit in the JSON data.

### Process:

1. **Loads the capacity data** from `data/grda/firecrawl_capacity_data.json`

2. **Geocodes facilities** using:
   - **Known coordinates database** for verified locations (dams, major plants)
   - **Geopy/Nominatim geocoding** for facilities not in the database
   - **Fallback logic** for facilities that can't be geocoded (uses approximate locations)

3. **Updates the JSON** with `latitude` and `longitude` fields:
   ```json
   {
     "name": "Pensacola Dam",
     "type": "Hydro",
     "net_MW": 126,
     "fuel": "Hydro",
     "latitude": 36.4675,
     "longitude": -95.04139
   }
   ```

4. **Saves the updated data** back to the same file

### Known Coordinates:

The script maintains a database of verified coordinates for major facilities:
- Pensacola Dam: `36.4675, -95.04139` (Langley, OK - Grand Lake)
- Robert S. Kerr Dam: `36.0831, -95.1167` (Lake Hudson, OK)
- Salina Pumped Storage Project: `36.292, -95.152` (Near Salina, OK)
- Redbud Power Plant: `36.2831, -95.1167` (Locust Grove, OK)
- Wind Generation: `35.4676, -97.5164` (Approximate center - multiple locations)

### Running the Coordinate Addition:

```bash
cd scripts/grda
python add_coordinates_to_capacity.py
```

**Requirements:**
- Python package: `geopy` (optional, for geocoding)
- Input file: `data/grda/firecrawl_capacity_data.json`

## Step 3: Data File Location

The final JSON data file must be placed in the `public` directory to be accessible by the frontend:

**Source:** `data/grda/firecrawl_capacity_data.json`  
**Destination:** `public/data/grda/firecrawl_capacity_data.json`

The file is served statically and fetched via HTTP by the React application.

### File Structure:

```json
{
  "generating_units": [
    {
      "name": "Pensacola Dam",
      "type": "Hydro",
      "net_MW": 126,
      "commissioned": null,
      "fuel": "Hydro",
      "latitude": 36.4675,
      "longitude": -95.04139
    },
    {
      "name": "Robert S. Kerr Dam",
      "type": "Hydro",
      "net_MW": 128,
      "commissioned": null,
      "fuel": "Hydro",
      "latitude": 36.0831,
      "longitude": -95.1167
    },
    {
      "name": "Salina Pumped Storage Project",
      "type": "Hydro",
      "net_MW": 260,
      "commissioned": null,
      "fuel": "Hydro",
      "latitude": 36.292,
      "longitude": -95.152
    },
    {
      "name": "Wind Generation",
      "type": "Wind",
      "net_MW": 385,
      "commissioned": null,
      "fuel": "Wind",
      "latitude": 35.4676,
      "longitude": -97.5164
    },
    {
      "name": "Redbud Power Plant",
      "type": "Gas",
      "net_MW": 457,
      "commissioned": null,
      "fuel": "Gas",
      "latitude": 36.2831,
      "longitude": -95.1167
    }
  ],
  "capacity_mix": {
    "Hydro_MW": 514,
    "Gas_MW": 457,
    "Wind_MW": 385
  },
  "sources": [
    "https://grda.com/electricity/",
    "https://grda.com/about/"
  ]
}
```

## Step 4: Frontend Marker Rendering

**Component:** `src/components/Map/components/Cards/OSMCall.jsx`  
**Function:** `addGRDAPowerMarkers()`

This React component function loads the JSON data and creates Mapbox GL markers for each generating unit.

### Process:

1. **Fetches the JSON data** from `/data/grda/firecrawl_capacity_data.json`

2. **Iterates through generating units** and for each unit:
   - Validates that coordinates exist (`latitude` and `longitude`)
   - Determines marker color based on fuel type
   - Creates a popup with detailed information
   - Creates a Mapbox GL marker with the appropriate color
   - Adds the marker to the map

3. **Color Mapping:**
   ```javascript
   const getFuelColor = (fuel) => {
     const fuelLower = (fuel || '').toLowerCase();
     if (fuelLower === 'hydro') return '#06b6d4'; // Cyan
     if (fuelLower === 'wind') return '#10b981';  // Green
     if (fuelLower === 'gas') return '#f97316';   // Orange
     return '#3b82f6'; // Default blue
   };
   ```

4. **Creates interactive popups** using the `TypewriterPopupCard` component with:
   - Facility name as header
   - Typewriter animation for description
   - Data table showing:
     - Type
     - Capacity (MW)
     - Fuel
     - Operator
     - Coordinates

5. **Stores markers** in `window.okGRDAPowerMarkers` for later cleanup

6. **Shows/hides the legend** based on whether markers were successfully loaded

### Marker Styling:

- **Type:** Teardrop marker (Mapbox GL default)
- **Scale:** 1.2x (20% larger than default)
- **Colors:** Dynamic based on fuel type
- **Popup:** Custom React component with typewriter effect
- **Animation:** Pulse animation on popup card entrance (0.8s duration)

### Code Example:

```javascript
const addGRDAPowerMarkers = useCallback(async () => {
  if (!map?.current) return;

  // Remove existing markers
  if (window.okGRDAPowerMarkers) {
    window.okGRDAPowerMarkers.forEach(marker => marker.remove());
    window.okGRDAPowerMarkers = [];
  }

  try {
    // Load GRDA capacity data
    const response = await fetch('/data/grda/firecrawl_capacity_data.json', { 
      cache: 'no-cache' 
    });
    const data = await response.json();
    const generatingUnits = data.generating_units || [];

    // Color mapping
    const getFuelColor = (fuel) => {
      const fuelLower = (fuel || '').toLowerCase();
      if (fuelLower === 'hydro') return '#06b6d4';
      if (fuelLower === 'wind') return '#10b981';
      if (fuelLower === 'gas') return '#f97316';
      return '#3b82f6';
    };

    const markers = [];
    generatingUnits.forEach(unit => {
      if (!unit.latitude || !unit.longitude) return;

      const markerColor = getFuelColor(unit.fuel);
      
      // Create popup with TypewriterPopupCard
      const popupContainer = document.createElement('div');
      const root = createRoot(popupContainer);
      root.render(
        <TypewriterPopupCard
          content={{
            description: `**${unit.name}** — ${unit.type} power generation facility...`,
            data: {
              'Type': unit.type || 'N/A',
              'Capacity': `${unit.net_MW || 0} MW`,
              'Fuel': unit.fuel || 'N/A',
              'Operator': 'Grand River Dam Authority (GRDA)',
              'Coordinates': `${unit.latitude}°N, ${Math.abs(unit.longitude)}°W`
            }
          }}
          theme="green"
          header={/* header component */}
          shouldStart={true}
          enableTypewriter={true}
        />
      );

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: true,
        className: 'okc-campus-popup-transparent',
        anchor: 'bottom',
        offset: 15
      }).setDOMContent(popupContainer);

      // Create marker
      const marker = new mapboxgl.Marker({
        color: markerColor,
        scale: 1.2
      })
      .setLngLat([unit.longitude, unit.latitude])
      .setPopup(popup)
      .addTo(map.current);

      markers.push(marker);
    });

    window.okGRDAPowerMarkers = markers;
    setShowGRDALegend(markers.length > 0);
  } catch (error) {
    console.warn('⚠️ Error loading GRDA power markers:', error);
    setShowGRDALegend(false);
  }
}, [map]);
```

## Legend Component

**Component:** `src/components/Map/components/GRDAPowerLegend.jsx`

A legend component displays the color coding for different fuel types:

- **Cyan (#06b6d4):** Hydroelectric
- **Green (#10b981):** Wind
- **Orange (#f97316):** Gas

The legend is positioned at the bottom right of the map, above the "Show Graph" button, and automatically shows/hides based on whether GRDA markers are loaded.

## Complete Workflow

### Initial Setup:

1. **Extract capacity data:**
   ```bash
   cd scripts/grda
   python firecrawl_capacity_extractor.py
   ```

2. **Add coordinates:**
   ```bash
   python add_coordinates_to_capacity.py
   ```

3. **Copy to public directory:**
   ```bash
   cp data/grda/firecrawl_capacity_data.json public/data/grda/firecrawl_capacity_data.json
   ```

### Updating Data:

When GRDA adds new facilities or updates capacity information:

1. Re-run the extraction script to get latest data
2. Re-run the coordinate addition script
3. Copy the updated file to the public directory
4. Refresh the frontend application

## Dependencies

### Python Scripts:
- `requests` - HTTP requests to Firecrawl API
- `python-dotenv` - Environment variable management
- `geopy` (optional) - Geocoding for coordinate lookup

### Frontend:
- `mapbox-gl` - Map rendering and markers
- `react` - UI components
- `react-dom` - DOM rendering for popups

## Troubleshooting

### Markers Not Appearing:

1. **Check file location:** Ensure `public/data/grda/firecrawl_capacity_data.json` exists
2. **Check coordinates:** Verify each unit has `latitude` and `longitude` fields
3. **Check browser console:** Look for fetch errors or warnings
4. **Check map initialization:** Ensure `addGRDAPowerMarkers()` is called after map loads

### Missing Coordinates:

1. Run `add_coordinates_to_capacity.py` to add coordinates
2. Check the script's `KNOWN_COORDINATES` dictionary for hardcoded locations
3. Verify geocoding service is accessible (if using Geopy)

### Data Not Updating:

1. Clear browser cache or use `cache: 'no-cache'` in fetch (already implemented)
2. Verify the JSON file in `public/data/grda/` is the latest version
3. Check that the extraction script successfully updated the source file

## Related Files

- **Data Extraction:** `scripts/grda/firecrawl_capacity_extractor.py`
- **Coordinate Addition:** `scripts/grda/add_coordinates_to_capacity.py`
- **Data File:** `public/data/grda/firecrawl_capacity_data.json`
- **Marker Rendering:** `src/components/Map/components/Cards/OSMCall.jsx`
- **Legend Component:** `src/components/Map/components/GRDAPowerLegend.jsx`
- **Popup Component:** `src/components/Map/components/Cards/TypewriterPopupCard.jsx`

