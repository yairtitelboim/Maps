# Columbus Migration: Preprocessing Layer Analysis

## Overview

This document analyzes the OSM data preprocessing pipeline and identifies which scripts need to be modified or created for the Columbus, Ohio migration. The preprocessing layer generates cached OSM data files that the frontend consumes to avoid live Overpass API calls.

---

## Current Preprocessing Architecture

### Data Flow

```
Python Scripts (scripts/osm-tools/)
    ↓
Generate OSM Cache Files (public/osm/*.json)
    ↓
Frontend Loads Cache Files (src/components/Map/hooks/useInfrastructureSites.js)
    ↓
Display on Map (OSMCall.jsx, LegendContainer.jsx)
```

### Key Scripts

#### 1. **`ok_data_center_osm.py`** - Primary Data Center OSM Cache Generator
**Location:** `scripts/osm-tools/ok_data_center_osm.py`

**Purpose:** Generates comprehensive OSM infrastructure caches for data center sites.

**Current Sites:**
- `google_stillwater_ok` (36.1156, -97.0584) - 8km radius
- `google_pryor_ok` (36.3086, -95.3167) - 10km radius

**Output Files:**
- `public/osm/ok_data_center_google_stillwater_ok.json`
- `public/osm/ok_data_center_google_pryor_ok.json`

**What It Queries:**
- Power infrastructure (power lines, substations, generators)
- Water & utility infrastructure (water towers, treatment plants, pipelines)
- Data center infrastructure (telecom, data centers)
- Industrial buildings (warehouses, factories)
- Universities and research institutions
- Transportation (roads, transit)
- Parks and green spaces
- Waterways (rivers, streams, canals)

**Frontend Usage:**
- Loaded by `useInfrastructureSites.js` → `addSiteLayers()`
- Referenced in `okDataCenterSites.js` → `dataPath` field
- Displayed via `OSMCall.jsx` and `LegendContainer.jsx`

**Columbus Migration Required:**
- ✅ **CREATE NEW:** `columbus_metro_osm.py` (or similar name)
- Update site coordinates to Columbus metro area
- Update radius to 10km (metro area coverage)
- Remove Oklahoma-specific lake queries (Lake McMurtry, Lake Carl Blackwell)
- Add Columbus-specific POIs if needed (Ohio State University, etc.)

---

#### 2. **`ok_marker_pipelines_osm.py`** - Infrastructure Marker Pipeline Data
**Location:** `scripts/osm-tools/ok_marker_pipelines_osm.py`

**Purpose:** Generates pipeline infrastructure data for individual teardrop markers (5-mile radius around each marker).

**Current Markers:**
- Infrastructure markers (red teardrops): Pryor, Stillwater, Tulsa Suburbs, OG&E Substation, etc.
- GRDA Power markers (blue teardrops): Pensacola Dam, Robert S. Kerr Dam, etc.

**Output Files:**
- `public/data/pipelines/pipeline_pryor.json`
- `public/data/pipelines/pipeline_stillwater.json`
- `public/data/pipelines/pipeline_*.json` (one per marker)

**What It Queries:**
- Pipeline infrastructure (gas, oil, water, sewer)
- Power transmission lines
- Utility infrastructure within 5-mile radius

**Frontend Usage:**
- Loaded by `OSMCall.jsx` → `addMarkerPipelines()`
- Used for particle animations around teardrop markers
- Referenced in `LegendContainer.jsx` for pipeline layer toggles

**Columbus Migration Required:**
- ✅ **CREATE NEW:** `columbus_marker_pipelines_osm.py`
- Replace Oklahoma marker coordinates with Columbus markers
- Identify Columbus infrastructure markers (AEP Ohio substations, key facilities, etc.)
- Update marker keys to Columbus-specific names
- Output to `public/data/pipelines/pipeline_columbus_*.json`

**Columbus Marker Candidates:**
- AEP Ohio major substations
- Ohio State University campus
- Key industrial facilities
- Water treatment facilities
- Power generation facilities (if any)

---

#### 3. **`ok_expanded_pipeline_osm.py`** - Expanded Pipeline Coverage
**Location:** `scripts/osm-tools/ok_expanded_pipeline_osm.py`

**Purpose:** Generates expanded pipeline coverage (up to 50km radius) for regional pipeline infrastructure.

**Current Sites:**
- Stillwater (expanded coverage)
- Pryor (expanded coverage)

**Output Files:**
- `public/osm/ok_pipeline_expanded_google_stillwater_ok.json`
- `public/osm/ok_pipeline_expanded_google_pryor_ok.json`

**What It Queries:**
- Regional pipeline infrastructure (larger radius)
- Pipeline relations (not just nodes/ways)
- Bounding box queries for broader coverage

**Frontend Usage:**
- Loaded by `OSMCall.jsx` (if still used)
- May be deprecated in favor of individual marker pipelines

**Columbus Migration Required:**
- ⚠️ **DECISION NEEDED:** Do we need expanded pipeline coverage for Columbus?
- If yes: Create `columbus_expanded_pipeline_osm.py`
- If no: Archive this script (expanded coverage may not be needed)

---

#### 4. **`okc_tract_buildings_osm.py`** - Building Data for Census Tracts
**Location:** `scripts/osm-tools/okc_tract_buildings_osm.py`

**Purpose:** Generates building data for Oklahoma City census tracts.

**Output Files:**
- `public/data/buildings/okc_tract_*.geojson` (one per tract)

**Frontend Usage:**
- Likely used for building layer visualization
- May be tied to OKC-specific features

**Columbus Migration Required:**
- ⚠️ **DECISION NEEDED:** Do we need census tract building data for Columbus?
- If yes: Create `columbus_tract_buildings_osm.py`
- If no: Archive this script
- Alternative: Use dynamic OSM queries instead of pre-cached buildings

---

#### 5. **`nc_power_utility_osm.py`** - Template for Power Utility Sites
**Location:** `scripts/osm-tools/nc_power_utility_osm.py`

**Purpose:** Generates OSM cache for North Carolina power utility sites (Toyota, VinFast, Wolfspeed).

**Current Sites:**
- Toyota Battery NC
- VinFast NC
- Wolfspeed NC
- Harris Nuclear Plant
- Raleigh Grid
- Greensboro Grid

**Output Files:**
- `public/osm/nc_power_*.json`

**What It Queries:**
- Power infrastructure
- Water & utility infrastructure
- Simpler query structure than `ok_data_center_osm.py`

**Frontend Usage:**
- Loaded by `useInfrastructureSites.js` for NC sites
- Similar structure to Oklahoma data center sites

**Columbus Migration Required:**
- ✅ **USE AS TEMPLATE:** This script is a good template for Columbus
- Simpler than `ok_data_center_osm.py` (no university/transportation queries)
- Can be adapted for Columbus power utility sites

---

## Frontend Integration Points

### 1. **`useInfrastructureSites.js`**
**Location:** `src/components/Map/hooks/useInfrastructureSites.js`

**Key Function:** `addSiteLayers()`

**Current Logic:**
```javascript
const scriptName = OK_DATA_CENTER_SITE_KEYS.has(site.key)
  ? 'scripts/osm-tools/ok_data_center_osm.py'
  : 'scripts/osm-tools/nc_power_utility_osm.py';
```

**Columbus Migration Required:**
- Update script name logic to include Columbus script
- Add Columbus site keys to detection logic
- Update error messages to reference Columbus script

---

### 2. **`okDataCenterSites.js`** (Now Stubbed)
**Location:** `src/config/okDataCenterSites.js`

**Current State:** Stubbed for Columbus migration (empty arrays)

**Columbus Migration Required:**
- If Columbus has data center sites: Add Columbus sites with `dataPath` pointing to new cache files
- If no data centers: Keep stubbed, or create `columbusInfrastructureSites.js`

---

### 3. **`OSMCall.jsx`**
**Location:** `src/components/Map/components/Cards/OSMCall.jsx`

**Current Logic:**
- Loads OSM cache files via `addSiteLayers()`
- Loads pipeline data via `addMarkerPipelines()`
- References Oklahoma-specific file paths

**Columbus Migration Required:**
- Update file path references
- Update marker keys for Columbus markers
- Remove Oklahoma-specific logic

---

## Columbus Preprocessing Implementation Plan

### Focus: AEP Ohio Interconnection Request Analysis

**Primary Use Case:** Map interconnection request locations, land transactions, and transmission infrastructure to analyze data center speculation patterns in AEP Ohio territory.

**Key Analysis Goals:**
1. Plot 90 sites where 30 GW was requested (50 customers at 90 sites)
2. Show clustering around substations (<5 miles)
3. Overlay: sites that survived tariff (13 GW) vs disappeared (17 GW)
4. Land transactions 2023-2024 near substations
5. Transmission infrastructure: planned vs built
6. Multiple requests on same parcels (flipping behavior)

---

### Phase 1: Create AEP Ohio Substation & Transmission Infrastructure Cache

**New Script:** `scripts/osm-tools/aep_ohio_infrastructure_osm.py`

**Based On:** `nc_power_utility_osm.py` (template) with enhancements for batching and health checks

**Configuration:**
```python
# AEP Ohio Territory Coverage
AEP_OHIO_BOUNDS = {
    "north": 41.5,   # Northern extent of AEP Ohio territory
    "south": 38.5,  # Southern extent
    "east": -80.0,  # Eastern extent
    "west": -85.0,  # Western extent
}

# Key Substation Locations (to be discovered via OSM)
SUBSTATION_QUERY_RADIUS = 5000  # 5km radius for detailed substation analysis

# Batching Configuration
BATCH_SIZE = 50  # Process queries in batches to avoid rate limits
BATCH_DELAY = 3  # Seconds between batches
MAX_RETRIES = 3  # Retry failed queries
```

**Query Structure - Focus Areas:**

1. **Substations (Primary Focus):**
   ```python
   # Query all substations in AEP Ohio territory
   node["power"="substation"](bbox);
   way["power"="substation"](bbox);
   relation["power"="substation"](bbox);
   ```

2. **Transmission Lines:**
   ```python
   # High-voltage transmission lines
   way["power"="line"]["voltage"~"^(345|230|138|69)$"](bbox);
   way["power"="line"]["cables"~"^[0-9]+$"](bbox);
   ```

3. **Substation Details (for clustering analysis):**
   ```python
   # Detailed substation attributes
   - voltage levels
   - capacity (if available)
   - operator (AEP Ohio)
   - name/identifier
   ```

**Output Files:**
- `public/osm/aep_ohio_substations.json` - All substations in AEP territory
- `public/osm/aep_ohio_transmission_lines.json` - Transmission infrastructure
- `public/osm/aep_ohio_substation_clusters.json` - Clustered substations for analysis

**Batching Implementation:**
```python
def batch_query_overpass(queries: List[str], batch_size: int = 50, delay: int = 3) -> List[Dict]:
    """
    Execute Overpass queries in batches with rate limiting.
    
    Args:
        queries: List of Overpass query strings
        batch_size: Number of queries per batch
        delay: Seconds to wait between batches
    
    Returns:
        List of query results
    """
    results = []
    total_batches = (len(queries) + batch_size - 1) // batch_size
    
    for i in range(0, len(queries), batch_size):
        batch = queries[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        
        log(f"Processing batch {batch_num}/{total_batches} ({len(batch)} queries)")
        
        for query in batch:
            result = execute_query_with_retry(query)
            results.append(result)
        
        # Rate limiting between batches
        if i + batch_size < len(queries):
            log(f"Waiting {delay}s before next batch...")
            time.sleep(delay)
    
    return results
```

**Health Checks:**
```python
def health_check_query_result(result: Dict) -> Dict[str, Any]:
    """
    Validate query result and return health metrics.
    
    Returns:
        {
            "valid": bool,
            "element_count": int,
            "error_count": int,
            "warnings": List[str],
            "coverage": float  # Percentage of expected area covered
        }
    """
    health = {
        "valid": True,
        "element_count": 0,
        "error_count": 0,
        "warnings": [],
        "coverage": 0.0
    }
    
    if "elements" not in result:
        health["valid"] = False
        health["error_count"] = 1
        health["warnings"].append("Missing 'elements' key in response")
        return health
    
    elements = result["elements"]
    health["element_count"] = len(elements)
    
    # Check for errors in response
    if "remark" in result:
        health["warnings"].append(f"API remark: {result['remark']}")
    
    # Validate element structure
    for element in elements:
        if "type" not in element or "id" not in element:
            health["error_count"] += 1
            health["warnings"].append(f"Invalid element structure: {element}")
    
    # Coverage check (if bounding box provided)
    if health["element_count"] == 0:
        health["warnings"].append("No elements returned - possible coverage issue")
    
    return health
```

**Error Handling & Retry Logic:**
```python
def execute_query_with_retry(query: str, max_retries: int = 3, backoff: int = 5) -> Dict:
    """
    Execute Overpass query with exponential backoff retry.
    
    Args:
        query: Overpass query string
        max_retries: Maximum number of retry attempts
        backoff: Initial backoff delay in seconds
    
    Returns:
        Query result dictionary
    """
    for attempt in range(max_retries):
        try:
            response = requests.post(
                OVERPASS_URL,
                data={"data": query},
                headers={"User-Agent": USER_AGENT},
                timeout=300  # 5 minute timeout for large queries
            )
            response.raise_for_status()
            
            result = response.json()
            health = health_check_query_result(result)
            
            if not health["valid"]:
                log(f"⚠️ Health check failed: {health['warnings']}")
                if attempt < max_retries - 1:
                    wait_time = backoff * (2 ** attempt)
                    log(f"Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
            
            return result
            
        except requests.exceptions.Timeout:
            log(f"⚠️ Query timeout (attempt {attempt + 1}/{max_retries})")
            if attempt < max_retries - 1:
                wait_time = backoff * (2 ** attempt)
                log(f"Retrying in {wait_time}s...")
                time.sleep(wait_time)
        
        except requests.exceptions.RequestException as e:
            log(f"❌ Query error: {e}")
            if attempt < max_retries - 1:
                wait_time = backoff * (2 ** attempt)
                log(f"Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise
    
    raise Exception(f"Query failed after {max_retries} attempts")
```

---

### Phase 2: Substation Clustering Analysis

**New Script:** `scripts/osm-tools/aep_ohio_clustering_analysis.py`

**Purpose:** Analyze substation clustering and generate 5-mile radius buffers for interconnection request analysis.

**Configuration:**
```python
CLUSTER_RADIUS_M = 8047  # 5 miles in meters
MIN_SUBSTATIONS_PER_CLUSTER = 1  # Minimum substations to form a cluster

# Analysis zones around each substation
ANALYSIS_ZONES = {
    "immediate": 1609,      # 1 mile
    "proximity": 8047,     # 5 miles (primary analysis zone)
    "extended": 16093,     # 10 miles
}
```

**Clustering Algorithm:**
```python
def cluster_substations(substations: List[Dict], radius_m: float) -> List[Dict]:
    """
    Cluster substations within specified radius.
    Uses DBSCAN-like algorithm for density-based clustering.
    
    Returns:
        List of clusters with:
        - center: (lat, lon)
        - substations: List of substation IDs in cluster
        - radius_m: Cluster radius
        - total_capacity: Sum of substation capacities (if available)
    """
    from scipy.spatial.distance import cdist
    import numpy as np
    
    # Extract coordinates
    coords = np.array([[s["lat"], s["lon"]] for s in substations])
    
    # Calculate distance matrix
    distances = cdist(coords, coords, metric='haversine') * 6371000  # Convert to meters
    
    # Cluster using radius threshold
    clusters = []
    assigned = set()
    
    for i, substation in enumerate(substations):
        if i in assigned:
            continue
        
        cluster = {
            "center": {"lat": substation["lat"], "lon": substation["lon"]},
            "substations": [substation["id"]],
            "radius_m": radius_m,
            "substation_details": [substation]
        }
        
        # Find all substations within radius
        for j, other in enumerate(substations):
            if i != j and j not in assigned:
                if distances[i][j] <= radius_m:
                    cluster["substations"].append(other["id"])
                    cluster["substation_details"].append(other)
                    assigned.add(j)
        
        clusters.append(cluster)
        assigned.add(i)
    
    return clusters
```

**Output Files:**
- `public/osm/aep_ohio_substation_clusters.json` - Clustered substations with 5-mile buffers
- `public/osm/aep_ohio_cluster_analysis.json` - Clustering statistics and metadata

---

### Phase 3: Interconnection Request Data Integration

**New Script:** `scripts/osm-tools/aep_ohio_interconnection_analysis.py`

**Purpose:** Integrate external interconnection request data with OSM substation data.

**Data Sources:**
1. **Interconnection Requests (External Data):**
   - 90 sites where 30 GW was requested
   - 50 customers at 90 sites
   - Sites that survived tariff (13 GW)
   - Sites that disappeared (17 GW)

2. **Land Transactions (External Data):**
   - County assessor records 2023-2024
   - Parcels that changed hands
   - Industrial zoning filter
   - Proximity to substations (<5 miles)

3. **Transmission Infrastructure (OSM + PJM Filings):**
   - Existing substations (OSM)
   - Planned upgrades (PJM filings)
   - Which upgrades proceeded vs stalled

**Data Structure:**
```python
INTERCONNECTION_REQUEST_SCHEMA = {
    "site_id": str,
    "customer_name": str,
    "requested_capacity_mw": float,
    "coordinates": {"lat": float, "lon": float},
    "request_date": str,  # ISO format
    "status": str,  # "active", "withdrawn", "approved", "rejected"
    "survived_tariff": bool,  # True if in 13 GW, False if in 17 GW
    "parcel_id": str,  # Link to land transaction data
    "nearest_substation_id": str,
    "distance_to_substation_m": float,
    "cluster_id": str,  # Which substation cluster
}

LAND_TRANSACTION_SCHEMA = {
    "parcel_id": str,
    "sale_date": str,  # ISO format
    "sale_price": float,
    "buyer": str,
    "seller": str,
    "zoning": str,  # Must be industrial
    "coordinates": {"lat": float, "lon": float},
    "area_acres": float,
    "nearest_substation_id": str,
    "distance_to_substation_m": float,
    "price_per_acre": float,
    "comparable_price_per_acre": float,  # From parcels >5 miles away
    "price_premium": float,  # Percentage premium vs comparable
    "interconnection_requests": List[str],  # Site IDs with requests on this parcel
}
```

**Integration Logic:**
```python
def integrate_interconnection_data(
    substations: List[Dict],
    clusters: List[Dict],
    interconnection_requests: List[Dict],
    land_transactions: List[Dict]
) -> Dict:
    """
    Integrate all data sources for analysis.
    
    Returns:
        {
            "substations": List[Dict],
            "clusters": List[Dict],
            "interconnection_requests": List[Dict],  # Enriched with substation proximity
            "land_transactions": List[Dict],  # Enriched with substation proximity
            "analysis": {
                "total_requests": int,
                "total_capacity_mw": float,
                "survived_capacity_mw": float,
                "withdrawn_capacity_mw": float,
                "clusters_with_requests": int,
                "parcels_with_multiple_requests": int,
                "land_transaction_spike_2023_2024": int,
            }
        }
    """
    # Enrich interconnection requests with substation proximity
    for request in interconnection_requests:
        nearest = find_nearest_substation(
            request["coordinates"],
            substations
        )
        request["nearest_substation_id"] = nearest["id"]
        request["distance_to_substation_m"] = nearest["distance_m"]
        request["cluster_id"] = find_cluster_for_substation(
            nearest["id"],
            clusters
        )
    
    # Enrich land transactions with substation proximity
    for transaction in land_transactions:
        nearest = find_nearest_substation(
            transaction["coordinates"],
            substations
        )
        transaction["nearest_substation_id"] = nearest["id"]
        transaction["distance_to_substation_m"] = nearest["distance_m"]
        
        # Find interconnection requests on this parcel
        transaction["interconnection_requests"] = [
            req["site_id"] for req in interconnection_requests
            if req.get("parcel_id") == transaction["parcel_id"]
        ]
    
    # Calculate analysis metrics
    analysis = calculate_analysis_metrics(
        interconnection_requests,
        land_transactions,
        clusters
    )
    
    return {
        "substations": substations,
        "clusters": clusters,
        "interconnection_requests": interconnection_requests,
        "land_transactions": land_transactions,
        "analysis": analysis
    }
```

**Output Files:**
- `public/data/aep_ohio_interconnection_analysis.json` - Complete integrated dataset
- `public/data/aep_ohio_cluster_summary.json` - Clustering summary statistics

---

### Phase 3: Update Frontend Integration

**Files to Update:**
1. `src/config/okDataCenterSites.js` or create `columbusInfrastructureSites.js`
2. `src/components/Map/hooks/useInfrastructureSites.js`
3. `src/components/Map/components/Cards/OSMCall.jsx`

---

## Decision Points

### 1. **Data Center Sites**
**Question:** Does Columbus have data center sites to map?

**Options:**
- **Yes:** Create `columbus_metro_osm.py` similar to `ok_data_center_osm.py`
- **No:** Use simpler `nc_power_utility_osm.py` template for general infrastructure

**Recommendation:** Start with general infrastructure (power, utilities) - can add data center-specific queries later if needed.

---

### 2. **Expanded Pipeline Coverage**
**Question:** Do we need expanded pipeline coverage (50km radius) for Columbus?

**Options:**
- **Yes:** Create `columbus_expanded_pipeline_osm.py`
- **No:** Archive script, use individual marker pipelines only

**Recommendation:** Start without expanded coverage - can add later if needed.

---

### 3. **Census Tract Buildings**
**Question:** Do we need pre-cached building data for Columbus census tracts?

**Options:**
- **Yes:** Create `columbus_tract_buildings_osm.py`
- **No:** Use dynamic OSM queries or Mapbox 3D buildings layer

**Recommendation:** Use dynamic queries or Mapbox 3D buildings - pre-caching buildings is memory-intensive.

---

### 4. **Marker Identification**
**Question:** What are the key infrastructure markers for Columbus?

**Research Needed:**
- AEP Ohio major substations
- Key industrial facilities
- Water treatment facilities
- Power generation facilities
- Major universities (OSU, Columbus State, etc.)
- Key transportation hubs

**Action:** Research Columbus infrastructure before creating marker pipeline script.

---

### Phase 4: Transmission Infrastructure Analysis

**New Script:** `scripts/osm-tools/aep_ohio_transmission_analysis.py`

**Purpose:** Compare existing transmission infrastructure (OSM) with planned upgrades (PJM filings) to identify stalled projects.

**Data Sources:**
1. **Existing Infrastructure (OSM):**
   - Current substations
   - Existing transmission lines
   - Voltage levels
   - Capacity (if available)

2. **Planned Infrastructure (PJM Filings - External Data / PJM XML):**
   - Primary source: `data/pjm/processed/aep_ohio_transmission_upgrades.json` generated by `scripts/pjm/aep_ohio_transmission_upgrades_from_xml.py` from PJM’s Project Status & Cost Allocation XML feed
   - Optional supplements: specific TEAC / planning PDFs (via Firecrawl) for richer narrative context or missing fields
   - Planned substation upgrades
   - Planned transmission line additions
   - Project status (proceeded vs stalled)
   - Timeline (before/after tariff)

**Analysis Logic:**
```python
def analyze_transmission_plans(
    existing_infrastructure: Dict,
    planned_upgrades: List[Dict]
) -> Dict:
    """
    Compare existing vs planned infrastructure.
    
    Returns:
        {
            "existing": {
                "substations": List[Dict],
                "transmission_lines": List[Dict],
            },
            "planned": {
                "upgrades": List[Dict],
                "new_lines": List[Dict],
            },
            "status": {
                "proceeded": List[Dict],  # Upgrades that were built
                "stalled": List[Dict],     # Upgrades that were cancelled/delayed
                "in_progress": List[Dict], # Upgrades currently being built
            },
            "correlation": {
                "upgrades_near_interconnection_sites": int,
                "stalled_after_tariff": int,
            }
        }
    """
    # Match planned upgrades to existing infrastructure
    proceeded = []
    stalled = []
    in_progress = []
    
    for upgrade in planned_upgrades:
        # Check if upgrade was completed
        if upgrade_exists_in_osm(upgrade, existing_infrastructure):
            proceeded.append(upgrade)
        elif upgrade["status"] == "cancelled" or upgrade["status"] == "delayed":
            stalled.append(upgrade)
        else:
            in_progress.append(upgrade)
    
    # Correlate with interconnection requests
    correlation = correlate_with_interconnection_sites(
        planned_upgrades,
        interconnection_requests  # From Phase 3
    )
    
    return {
        "existing": existing_infrastructure,
        "planned": {
            "upgrades": planned_upgrades,
            "new_lines": [u for u in planned_upgrades if u["type"] == "new_line"]
        },
        "status": {
            "proceeded": proceeded,
            "stalled": stalled,
            "in_progress": in_progress
        },
        "correlation": correlation
    }
```

**Output Files:**
- `public/data/aep_ohio_transmission_analysis.json` - Transmission infrastructure comparison
- `public/data/aep_ohio_stalled_projects.json` - Projects that stalled after tariff

---

### Phase 5: Multiple Request Analysis (Flipping Detection)

**New Script:** `scripts/osm-tools/aep_ohio_flipping_analysis.py`

**Purpose:** Identify parcels with multiple interconnection requests from different developers (proving "flipping" behavior).

**Analysis Logic:**
```python
def detect_flipping_behavior(
    interconnection_requests: List[Dict],
    land_transactions: List[Dict]
) -> Dict:
    """
    Identify parcels with multiple requests from different developers.
    
    Returns:
        {
            "flipped_parcels": List[Dict],  # Parcels with 2+ requests
            "flipping_statistics": {
                "total_flipped_parcels": int,
                "total_requests_on_flipped": int,
                "unique_developers": int,
                "average_requests_per_parcel": float,
            },
            "timeline": {
                "first_request_date": str,
                "last_request_date": str,
                "request_frequency": Dict[str, int],  # Requests per month
            }
        }
    """
    # Group requests by parcel
    requests_by_parcel = {}
    for request in interconnection_requests:
        parcel_id = request.get("parcel_id")
        if parcel_id:
            if parcel_id not in requests_by_parcel:
                requests_by_parcel[parcel_id] = []
            requests_by_parcel[parcel_id].append(request)
    
    # Find parcels with multiple requests
    flipped_parcels = []
    for parcel_id, requests in requests_by_parcel.items():
        if len(requests) >= 2:
            # Check if requests are from different developers
            developers = set(req.get("customer_name") for req in requests)
            if len(developers) > 1:
                flipped_parcels.append({
                    "parcel_id": parcel_id,
                    "requests": requests,
                    "developers": list(developers),
                    "request_count": len(requests),
                    "developer_count": len(developers),
                    "total_capacity_mw": sum(req.get("requested_capacity_mw", 0) for req in requests)
                })
    
    # Calculate statistics
    stats = {
        "total_flipped_parcels": len(flipped_parcels),
        "total_requests_on_flipped": sum(len(p["requests"]) for p in flipped_parcels),
        "unique_developers": len(set(
            dev for p in flipped_parcels for dev in p["developers"]
        )),
        "average_requests_per_parcel": (
            sum(len(p["requests"]) for p in flipped_parcels) / len(flipped_parcels)
            if flipped_parcels else 0
        )
    }
    
    return {
        "flipped_parcels": flipped_parcels,
        "flipping_statistics": stats,
        "timeline": build_timeline(interconnection_requests)
    }
```

**Output Files:**
- `public/data/aep_ohio_flipping_analysis.json` - Flipping behavior analysis

---

## Implementation Checklist

### Pre-Implementation
- [ ] Research AEP Ohio substation locations (OSM + AEP public data)
- [ ] Obtain interconnection request data (90 sites, 30 GW)
- [ ] Obtain land transaction data (county assessor records 2023-2024)
- [ ] Obtain PJM filing data (planned transmission upgrades)
- [ ] Identify industrial zoning areas in AEP Ohio territory
- [ ] Map AEP Ohio service territory boundaries

### Script Creation
- [ ] Create `aep_ohio_infrastructure_osm.py` with batching and health checks
- [ ] Create `aep_ohio_clustering_analysis.py` for substation clustering
- [ ] Create `aep_ohio_interconnection_analysis.py` for data integration
- [ ] Create `aep_ohio_transmission_analysis.py` for planned vs built analysis
- [ ] Create `aep_ohio_flipping_analysis.py` for multiple request detection
- [ ] Implement batching logic for large queries
- [ ] Implement health check validation
- [ ] Implement retry logic with exponential backoff
- [ ] Test all scripts generate valid JSON files
- [ ] Verify output files are in correct format

### Data Collection
- [ ] Run OSM queries for AEP Ohio substations (with batching)
- [ ] Run OSM queries for transmission lines
- [ ] Generate substation clusters (5-mile radius)
- [ ] Integrate interconnection request data
- [ ] Integrate land transaction data
- [ ] Integrate PJM filing data
- [ ] Calculate clustering statistics
- [ ] Calculate price premiums for land transactions
- [ ] Identify stalled transmission projects

### Frontend Integration
- [ ] Update `useInfrastructureSites.js` to reference AEP Ohio scripts
- [ ] Create `aepOhioInfrastructureSites.js` configuration file
- [ ] Update `OSMCall.jsx` to load AEP Ohio cache files
- [ ] Add interconnection request overlay layer
- [ ] Add land transaction overlay layer
- [ ] Add transmission plan overlay layer
- [ ] Add clustering visualization
- [ ] Add flipping behavior visualization

### Testing
- [ ] Test OSM script batching with large queries
- [ ] Test health check validation
- [ ] Test retry logic with simulated failures
- [ ] Verify clustering algorithm accuracy
- [ ] Test data integration with sample data
- [ ] Test frontend loads AEP Ohio cache files
- [ ] Verify map displays substations correctly
- [ ] Verify clustering visualization works
- [ ] Verify overlay layers display correctly
- [ ] Test performance with large datasets

---

## File Structure After Migration

```
scripts/osm-tools/
├── aep_ohio_infrastructure_osm.py     # NEW: AEP Ohio substations & transmission (with batching)
├── aep_ohio_clustering_analysis.py     # NEW: Substation clustering analysis
├── aep_ohio_interconnection_analysis.py # NEW: Interconnection request integration
├── aep_ohio_transmission_analysis.py   # NEW: Planned vs built transmission analysis
├── aep_ohio_flipping_analysis.py       # NEW: Multiple request detection
├── ok_data_center_osm.py               # ARCHIVE: Oklahoma-specific
├── ok_marker_pipelines_osm.py          # ARCHIVE: Oklahoma-specific
├── ok_expanded_pipeline_osm.py         # ARCHIVE: Oklahoma-specific
├── okc_tract_buildings_osm.py          # ARCHIVE: Oklahoma-specific
└── nc_power_utility_osm.py             # KEEP: Template/other locations

public/osm/
├── aep_ohio_substations.json           # NEW: All AEP Ohio substations
├── aep_ohio_transmission_lines.json   # NEW: Transmission infrastructure
├── aep_ohio_substation_clusters.json   # NEW: Clustered substations (5-mile buffers)
├── ok_data_center_*.json                # ARCHIVE: Oklahoma caches
└── nc_power_*.json                     # KEEP: NC caches

public/data/
├── aep_ohio_interconnection_analysis.json  # NEW: Complete interconnection dataset
├── aep_ohio_cluster_summary.json          # NEW: Clustering statistics
├── aep_ohio_transmission_analysis.json    # NEW: Transmission comparison
├── aep_ohio_stalled_projects.json         # NEW: Stalled projects after tariff
└── aep_ohio_flipping_analysis.json        # NEW: Flipping behavior analysis

public/data/pipelines/
└── pipeline_pryor.json                 # ARCHIVE: Oklahoma pipelines (not needed for AEP analysis)
```

---

## Key Features

### Batching & Performance
- **Batch Processing:** Process large OSM queries in configurable batches (default: 50 queries/batch)
- **Rate Limiting:** Configurable delay between batches (default: 3 seconds)
- **Timeout Handling:** 5-minute timeout for large queries with retry logic
- **Health Checks:** Validate query results before processing
- **Error Recovery:** Exponential backoff retry (max 3 attempts)

### Data Integration
- **Multi-Source:** Integrates OSM data with external data (interconnection requests, land transactions, PJM filings)
- **Spatial Analysis:** Proximity calculations (distance to substations, clustering)
- **Temporal Analysis:** Timeline analysis (2023-2024 land transactions, request frequency)
- **Correlation Analysis:** Links interconnection requests to land transactions and transmission plans

### Analysis Capabilities
- **Clustering:** DBSCAN-like algorithm for substation clustering (5-mile radius)
- **Price Premiums:** Compare land transaction prices near vs far from substations
- **Flipping Detection:** Identify parcels with multiple requests from different developers
- **Status Tracking:** Track which projects proceeded vs stalled after tariff

## Next Steps

1. **Data Collection Phase:**
   - Obtain interconnection request data (90 sites, 30 GW)
   - Obtain land transaction data (county assessor records 2023-2024)
   - Obtain PJM filing data (planned transmission upgrades)
   - Research AEP Ohio substation locations

2. **Script Development:**
   - Create `aep_ohio_infrastructure_osm.py` with batching and health checks
   - Create clustering and analysis scripts
   - Test with sample data

3. **Data Generation:**
   - Run OSM queries for AEP Ohio territory
   - Generate substation clusters
   - Integrate external data sources
   - Calculate analysis metrics

4. **Frontend Integration:**
   - Update frontend to load AEP Ohio data
   - Add overlay layers for interconnection requests
   - Add visualization for clustering and flipping behavior

5. **Testing:**
   - Test batching with large queries
   - Test health checks and error recovery
   - Verify analysis accuracy
   - Test frontend visualization

---

**Last Updated:** [Current Date]  
**Status:** Analysis Complete - Revised for AEP Ohio Interconnection Analysis  
**Focus:** Interconnection requests, land transactions, transmission infrastructure analysis

