# Firecrawl to Energy Markers Flow

This document describes the complete data pipeline from GRDA website scraping using Firecrawl to the colored energy markers displayed on the map when you click the green OSM button.

## Overview

The energy markers (colored teardrops for GRDA power generation facilities) are generated through a multi-step process:

1. **Data Extraction** - Firecrawl scrapes GRDA website
2. **Coordinate Addition** - Geocoding adds lat/long coordinates
3. **Data Storage** - JSON file saved to public directory
4. **Frontend Rendering** - OSM button triggers marker creation

## Complete Data Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Data Extraction (Python)                            │
│ scripts/grda/firecrawl_capacity_extractor.py                │
│                                                              │
│ • Uses Firecrawl API to scrape GRDA website                 │
│ • Extracts facility names, capacities, fuel types           │
│ • Output: data/grda/firecrawl_capacity_data.json            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Coordinate Addition (Python)                        │
│ scripts/grda/add_coordinates_to_capacity.py                 │
│                                                              │
│ • Adds latitude/longitude to each facility                    │
│ • Uses known coordinates or geocoding                         │
│ • Updates: data/grda/firecrawl_capacity_data.json            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Data File (JSON)                                    │
│ public/data/grda/firecrawl_capacity_data.json               │
│                                                              │
│ Structure:                                                   │
│ {                                                           │
│   "generating_units": [                                     │
│     {                                                       │
│       "name": "Pensacola Dam",                              │
│       "type": "Hydro",                                      │
│       "net_MW": 126,                                        │
│       "fuel": "Hydro",                                      │
│       "latitude": 36.4675,                                  │
│       "longitude": -95.04139                                │
│     }                                                       │
│   ],                                                        │
│   "capacity_mix": { ... }                                   │
│ }                                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Frontend Marker Rendering (React/Mapbox)           │
│ src/components/Map/components/Cards/OSMCall.jsx              │
│ Function: addGRDAPowerMarkers()                              │
│                                                              │
│ • Fetches JSON from /data/grda/firecrawl_capacity_data.json │
│ • Creates colored teardrop markers                           │
│ • Adds interactive popups                                   │
│ • Displays on map                                            │
└─────────────────────────────────────────────────────────────┘
```

## Step-by-Step Details

### Step 1: Data Extraction with Firecrawl

**Script:** `scripts/grda/firecrawl_capacity_extractor.py`

**What it does:**
- Uses Firecrawl API to scrape GRDA website pages:
  - `https://grda.com/electricity/`
  - `https://grda.com/about/`
- Extracts power generation facility information using regex patterns:
  - Facility names (e.g., "Pensacola Dam", "Redbud Power Plant")
  - Capacity in MW
  - Fuel types (Hydro, Wind, Gas, Coal, etc.)
- Structures data into JSON format
- Saves to: `data/grda/firecrawl_capacity_data.json`

**To run:**
```bash
cd scripts/grda
python firecrawl_capacity_extractor.py
```

**Requirements:**
- `FIRECRAWL_API_KEY` environment variable must be set
- Python packages: `requests`, `python-dotenv`

**Output format (before coordinates):**
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

### Step 2: Adding Coordinates

**Script:** `scripts/grda/add_coordinates_to_capacity.py`

**What it does:**
- Loads the capacity data from Step 1
- Adds `latitude` and `longitude` to each generating unit using:
  - **Known coordinates database** for verified locations (dams, major plants)
  - **Geopy/Nominatim geocoding** for facilities not in the database
  - **Fallback logic** for facilities that can't be geocoded
- Updates the same JSON file with coordinate data

**To run:**
```bash
cd scripts/grda
python add_coordinates_to_capacity.py
```

**Output format (after coordinates):**
```json
{
  "generating_units": [
    {
      "name": "Pensacola Dam",
      "type": "Hydro",
      "net_MW": 126,
      "fuel": "Hydro",
      "latitude": 36.4675,
      "longitude": -95.04139
    }
  ]
}
```

**Known coordinates:**
- Pensacola Dam: (36.4675, -95.04139)
- Robert S. Kerr Dam: (36.0831, -95.1167)
- Salina Pumped Storage Project: (36.292, -95.152)
- Redbud Power Plant: (36.2831, -95.1167)
- Grand River Energy Center: (36.188703, -95.289033)

### Step 3: Data File Location

**Source:** `data/grda/firecrawl_capacity_data.json`  
**Destination:** `public/data/grda/firecrawl_capacity_data.json`

The JSON file must be copied to the `public` directory so it can be served to the frontend:

```bash
cp data/grda/firecrawl_capacity_data.json public/data/grda/firecrawl_capacity_data.json
```

### Step 4: Frontend Marker Rendering

**Component:** `src/components/Map/components/Cards/OSMCall.jsx`  
**Function:** `addGRDAPowerMarkers()`

**How it's triggered:**
1. User clicks the **green OSM button** in `NestedCircleButton.jsx`
2. `OSMCall.jsx` loads OSM infrastructure data
3. After a 2-second delay, it calls `addGRDAPowerMarkers()` (line 990-993)

**What it does:**
1. **Fetches the JSON data:**
   ```javascript
   const response = await fetch('/data/grda/firecrawl_capacity_data.json', { cache: 'no-cache' });
   const data = await response.json();
   const generatingUnits = data.generating_units || [];
   ```

2. **Maps fuel types to colors:**
   ```javascript
   const getFuelColor = (fuel) => {
     const fuelLower = (fuel || '').toLowerCase();
     if (fuelLower === 'hydro') return '#06b6d4'; // Cyan for hydroelectric
     if (fuelLower === 'wind') return '#10b981';  // Green for wind
     if (fuelLower === 'gas') return '#f97316';   // Orange for gas
     return '#3b82f6'; // Default blue
   };
   ```

3. **Creates markers for each facility:**
   ```javascript
   generatingUnits.forEach(unit => {
     if (!unit.latitude || !unit.longitude) return;
     
     const markerColor = getFuelColor(unit.fuel);
     
     // Create popup with facility details
     const popup = new mapboxgl.Popup({
       closeButton: false,
       closeOnClick: false,
       anchor: 'bottom',
       offset: [0, 15]
     }).setDOMContent(popupContainer);
     
     // Create colored teardrop marker
     const marker = new mapboxgl.Marker({
       color: markerColor,
       scale: 1.2
     })
     .setLngLat([unit.longitude, unit.latitude])
     .setPopup(popup)
     .addTo(map.current);
     
     markers.push(marker);
   });
   ```

4. **Stores markers for cleanup:**
   ```javascript
   window.okGRDAPowerMarkers = markers;
   ```

## Marker Features

### Color Coding
- **Cyan (`#06b6d4`)**: Hydroelectric facilities (dams, pumped storage)
- **Green (`#10b981`)**: Wind generation facilities
- **Orange (`#f97316`)**: Gas-fired power plants
- **Blue (`#3b82f6`)**: Other/unknown fuel types

### Interactive Popups
Each marker displays a popup with:
- **Facility name** (large header)
- **Type indicator**: "GRDA Power Generation Facility"
- **Capacity badge**: Shows MW capacity with fuel type icon
- **Detailed data table**:
  - Type (Hydro, Wind, Gas, etc.)
  - Capacity in MW
  - Fuel source
  - Operator (Grand River Dam Authority)
  - Coordinates

### Marker Storage
Markers are stored in `window.okGRDAPowerMarkers` array for:
- Cleanup when layers are removed
- Toggle on/off functionality
- Animation coordination (gas, hydro, wind pulse animations)

## Usage Workflow

### For Developers: Updating GRDA Data

1. **Extract fresh data:**
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

4. **Test in frontend:**
   - Click the green OSM button
   - Wait 2 seconds
   - GRDA power markers should appear

### For Users: Viewing Energy Markers

1. Select an Oklahoma location (Stillwater, OK or Pryor, OK)
2. Click the **green OSM button** (infrastructure analysis)
3. Wait ~2 seconds for markers to load
4. Click any colored teardrop marker to see facility details
5. View the GRDA Power Legend (bottom right) for color reference

## Related Files

- **Data Extraction:** `scripts/grda/firecrawl_capacity_extractor.py`
- **Coordinate Addition:** `scripts/grda/add_coordinates_to_capacity.py`
- **Data File:** `public/data/grda/firecrawl_capacity_data.json`
- **Frontend Component:** `src/components/Map/components/Cards/OSMCall.jsx`
- **Marker Function:** `addGRDAPowerMarkers()` in OSMCall.jsx
- **Legend Component:** `src/components/Map/components/GRDAPowerLegend.jsx`
- **Button Integration:** `src/components/Map/components/Cards/NestedCircleButton.jsx`

## Troubleshooting

### Markers Not Appearing

1. **Check file exists:**
   ```bash
   ls -la public/data/grda/firecrawl_capacity_data.json
   ```

2. **Verify JSON structure:**
   - File should have `generating_units` array
   - Each unit needs `latitude` and `longitude`
   - Each unit needs `fuel` and `net_MW` fields

3. **Check browser console:**
   - Look for fetch errors
   - Check for coordinate validation warnings
   - Verify markers array is populated

4. **Verify OSM button click:**
   - Ensure location is Oklahoma-based (Stillwater or Pryor)
   - Wait full 2 seconds after OSM button click
   - Check that `addGRDAPowerMarkers` is called

### Data Not Updating

1. **Re-run extraction:**
   ```bash
   cd scripts/grda
   python firecrawl_capacity_extractor.py
   python add_coordinates_to_capacity.py
   ```

2. **Copy to public:**
   ```bash
   cp data/grda/firecrawl_capacity_data.json public/data/grda/firecrawl_capacity_data.json
   ```

3. **Clear browser cache:**
   - The fetch uses `cache: 'no-cache'` but browser may still cache
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

### Firecrawl API Issues

1. **Check API key:**
   ```bash
   echo $FIRECRAWL_API_KEY
   ```

2. **Verify credits:**
   - Firecrawl requires credits to scrape
   - Check account at https://firecrawl.dev/pricing

3. **Test API connection:**
   ```bash
   cd scripts/grda
   python firecrawl_integration.py
   ```

## Summary

The flow from Firecrawl to markers is:

1. **Firecrawl script** scrapes GRDA website → extracts facility data
2. **Coordinate script** adds lat/long → creates complete JSON
3. **JSON file** copied to public → served to frontend
4. **OSM button** triggers marker creation → displays colored teardrops
5. **Users** click markers → see detailed facility information

This pipeline ensures that GRDA power generation data stays current and is automatically displayed on the map when users analyze Oklahoma infrastructure.

