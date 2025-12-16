# Interconnection.fyi Parser Plan

## Objective
Parse the Firecrawl output from `https://www.interconnection.fyi/?state=OH` into structured JSON for AEP Ohio interconnection queue analysis.

## Input
- Firecrawl JSON output: `/tmp/firecrawl_interconnection_oh.md.json`
- Contains markdown with embedded Airtable table data for 256 active Ohio generation projects

## Output
- `data/interconnection_fyi/aep_ohio_interconnection_requests.json`
- GeoJSON version: `public/data/aep_ohio_interconnection_requests.geojson` (with county centroids)

---

## Step-by-Step Plan

### Step 1: Extract Raw Project Entries from Markdown
**Goal:** Parse the markdown to find all project entries.

**Pattern to match:**
```
[Open Project Details](https://www.interconnection.fyi/project/{project_id}?ref=airtable_iframe)

{capacity_range} MW
(contact sales for exact capacity)

{status}

{generation_type}

{project_type}

{county} County

{state}

{date}
```

**Implementation:**
- Use regex to find all `[Open Project Details](url)` links
- For each link, extract the following lines (structured pattern)
- Handle edge cases:
  - Some entries may have different formatting
  - Some may be missing fields
  - Capacity may be a single number or range

**Output:** List of raw project dictionaries with extracted text fields

---

### Step 2: Parse and Normalize Fields
**Goal:** Convert raw text into structured, typed fields.

**Fields to extract:**

1. **`project_id`** (string)
   - Extract from URL: `pjm-aj1-023` from `https://www.interconnection.fyi/project/pjm-aj1-023?ref=airtable_iframe)`
   - Pattern: `pjm-[a-z0-9]+-[0-9]+`

2. **`project_url`** (string)
   - Full URL from the link

3. **`queue_date`** (string, ISO format)
   - Parse dates like `12/1/2024`, `10/1/2028`, `3/11/2023`
   - Convert to ISO: `2024-12-01`
   - Handle missing dates (set to `null`)

4. **`capacity_min_mw`** (number)
   - Extract from patterns like:
     - `50 - 75 MW` → `50`
     - `750 - 1000 MW` → `750`
     - `0 - 10 MW` → `0`
   - If single number: `100 MW` → `100` (both min and max)

5. **`capacity_max_mw`** (number)
   - Extract from capacity range
   - If single number, same as min

6. **`capacity_range_display`** (string)
   - Keep original: `"50 - 75 MW"` or `"100 MW"`

7. **`status`** (string, normalized)
   - Map: `"Active In Queue"` → `"active"`
   - Other possible values: `"withdrawn"`, `"operational"`, `"suspended"`

8. **`generation_type`** (string, normalized)
   - Lowercase: `"Gas"` → `"gas"`, `"Solar"` → `"solar"`
   - Possible values: `solar`, `wind`, `gas`, `battery`, `hybrid`, etc.

9. **`project_type`** (string, normalized)
   - Lowercase: `"Generation"` → `"generation"`
   - Possible values: `generation`, `upgrade`, `surplus`, `replacement`, `transmission`

10. **`county`** (string)
    - Extract: `"Trumbull County"` → `"Trumbull"`
    - Remove "County" suffix

11. **`state`** (string)
    - Should be `"OH"` for all entries

12. **`power_market`** (string)
    - Extract from project_id prefix or infer from state
    - For Ohio: `"PJM"`

**Output:** List of normalized project dictionaries

---

### Step 3: Geocode County Names to Centroids
**Goal:** Add `lat`/`lng` coordinates for each project based on county.

**Approach:**
- Use a county centroid lookup (Ohio counties)
- Options:
  1. **Hardcoded dictionary** (fastest, most reliable)
  2. **Geopy/Nominatim** (slower, but dynamic)
  3. **US Census TIGER/Line** (most accurate, but requires download)

**Implementation:**
- Create `scripts/utils/ohio_county_centroids.py` with a dictionary of Ohio county centroids
- For each project, lookup county → `(lat, lng)`
- Add fields: `latitude`, `longitude`, `coordinates` (GeoJSON format)

**Output:** Projects with geographic coordinates

---

### Step 4: Enrich with Spatial Context
**Goal:** Add distance/proximity metrics to AEP Ohio infrastructure.

**Calculations:**
1. **`distance_to_columbus_center_km`**
   - Haversine distance to Columbus center: `39.9612, -82.9988`

2. **`is_near_columbus_10mi`** (boolean)
   - Within 10 miles (~16 km) of Columbus center

3. **`nearest_substation_id`** (string, optional)
   - Find closest AEP Ohio substation from `public/osm/aep_ohio_substations.json`
   - Add `distance_to_nearest_substation_km`

4. **`voltage_at_nearest_substation_kv`** (number, optional)
   - Voltage of nearest substation

**Implementation:**
- Load `public/osm/aep_ohio_substations.json`
- For each project, calculate distances to all substations
- Find minimum distance and store substation metadata

**Output:** Enriched projects with spatial context

---

### Step 5: Generate Output Files
**Goal:** Write structured JSON and GeoJSON files.

**Files to create:**

1. **`data/interconnection_fyi/aep_ohio_interconnection_requests.json`**
   ```json
   {
     "metadata": {
       "source": "interconnection.fyi",
       "source_url": "https://www.interconnection.fyi/?state=OH",
       "scrape_date": "2025-01-XX",
       "total_projects": 256,
       "status_breakdown": {
         "active": 256,
         "withdrawn": 0,
         "operational": 0
       },
       "generation_type_breakdown": {
         "solar": 180,
         "wind": 30,
         "gas": 5,
         "battery": 40,
         ...
       },
       "total_capacity_min_mw": 5000,
       "total_capacity_max_mw": 12000
     },
     "projects": [
       {
         "project_id": "pjm-aj1-023",
         "project_url": "https://www.interconnection.fyi/project/pjm-aj1-023",
         "queue_date": "2024-12-01",
         "capacity_min_mw": 50,
         "capacity_max_mw": 75,
         "capacity_range_display": "50 - 75 MW",
         "status": "active",
         "generation_type": "gas",
         "project_type": "generation",
         "county": "Trumbull",
         "state": "OH",
         "power_market": "PJM",
         "latitude": 41.3017,
         "longitude": -80.7656,
         "coordinates": [-80.7656, 41.3017],
         "distance_to_columbus_center_km": 180.5,
         "is_near_columbus_10mi": false,
         "nearest_substation_id": "substation_123",
         "distance_to_nearest_substation_km": 2.3,
         "voltage_at_nearest_substation_kv": 138
       },
       ...
     ]
   }
   ```

2. **`public/data/aep_ohio_interconnection_requests.geojson`**
   - GeoJSON FeatureCollection
   - Each project as a Point feature
   - Properties include all non-geographic fields

**Output:** Two files ready for map visualization

---

### Step 6: Validation and Error Handling
**Goal:** Ensure data quality and handle edge cases.

**Checks:**
1. **Required fields present:** `project_id`, `county`, `state`, `generation_type`
2. **Date parsing:** All dates valid ISO format or `null`
3. **Capacity ranges:** `capacity_min_mw <= capacity_max_mw`
4. **Coordinates:** Valid lat/lng within Ohio bounds
5. **County names:** Match known Ohio counties (warn on unknown)

**Error handling:**
- Log warnings for projects with missing/invalid data
- Skip projects that can't be parsed (log reason)
- Generate summary report of parsing results

**Output:** Validated dataset + error log

---

## Implementation Order

1. ✅ **Step 1:** Extract raw entries (regex parsing)
2. ✅ **Step 2:** Normalize fields (text processing)
3. ✅ **Step 3:** Geocode counties (lookup)
4. ✅ **Step 4:** Spatial enrichment (distance calculations)
5. ✅ **Step 5:** Write output files (JSON + GeoJSON)
6. ✅ **Step 6:** Validation (quality checks)

---

## File Structure

```
scripts/
  interconnection_fyi/
    parse_interconnection_fyi.py          # Main parser script
    ohio_county_centroids.py               # County centroid lookup
    test_parser.py                         # Unit tests

data/
  interconnection_fyi/
    aep_ohio_interconnection_requests.json # Structured JSON output

public/
  data/
    aep_ohio_interconnection_requests.geojson  # GeoJSON for map
```

---

## Next Steps After Parsing

1. **Visualize on map:** Load GeoJSON into `OSMCall.jsx` as markers
2. **Cluster analysis:** Identify high-density counties
3. **Join with substations:** Show projects near each substation
4. **Timeline analysis:** Filter by `queue_date` to see 2023-2024 spike
5. **Capacity analysis:** Sum `capacity_min_mw` / `capacity_max_mw` by county

---

## Notes

- **Limitation:** Interconnection.fyi hides exact MW and developer names in free tier
- **Workaround:** Use capacity ranges and county-level aggregation
- **Future:** Could scrape individual project pages for more detail (costs more Firecrawl credits)


