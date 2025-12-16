# AEP Ohio Interconnection Request Analysis Scripts

This directory contains preprocessing scripts for analyzing AEP Ohio interconnection requests, land transactions, and transmission infrastructure.

## Scripts Overview

### 1. `aep_ohio_infrastructure_osm.py`
**Primary OSM Data Collection**

Fetches substations and transmission lines from OpenStreetMap for AEP Ohio territory.

**Features:**
- Batching support for large queries
- Health checks for query validation
- Retry logic with exponential backoff
- 5-minute timeout for large queries

**Usage:**
```bash
python scripts/osm-tools/aep_ohio_infrastructure_osm.py
```

**Output:**
- `public/osm/aep_ohio_substations.json` - All substations in AEP Ohio territory
- `public/osm/aep_ohio_transmission_lines.json` - Transmission infrastructure

**Configuration:**
- Edit `AEP_OHIO_BOUNDS` to adjust territory bounding box
- Adjust `BATCH_SIZE`, `BATCH_DELAY`, `MAX_RETRIES` for performance tuning

---

### 2. `aep_ohio_clustering_analysis.py`
**Substation Clustering**

Analyzes substation locations and creates clusters with 5-mile radius buffers.

**Usage:**
```bash
python scripts/osm-tools/aep_ohio_clustering_analysis.py
```

**Prerequisites:**
- Must run `aep_ohio_infrastructure_osm.py` first

**Output:**
- `public/osm/aep_ohio_substation_clusters.json` - Clustered substations with buffers

**Configuration:**
- `CLUSTER_RADIUS_M` - Cluster radius in meters (default: 8047m = 5 miles)
- `ANALYSIS_ZONES` - Analysis zone radii (1-mile, 5-mile, 10-mile)

---

### 3. `aep_ohio_interconnection_analysis.py`
**Data Integration**

Integrates OSM data with external data sources (interconnection requests, land transactions).

**Usage:**
```bash
python scripts/osm-tools/aep_ohio_interconnection_analysis.py
```

**Prerequisites:**
- Must run `aep_ohio_infrastructure_osm.py` first
- Must run `aep_ohio_clustering_analysis.py` first
- Requires external data files (see Data Requirements below)

**Input Files (External Data):**
- `public/data/interconnection_requests.json` - Interconnection request data
- `public/data/land_transactions.json` - Land transaction data

**Output:**
- `public/data/aep_ohio_interconnection_analysis.json` - Complete integrated dataset

**Data Schema:**
See `docs/COLUMBUS_PREPROCESSING_ANALYSIS.md` for required data schemas.

---

### 4. `aep_ohio_transmission_analysis.py`
**Transmission Infrastructure Comparison**

Compares existing transmission infrastructure (OSM) with planned upgrades (PJM filings).

**Usage:**
```bash
python scripts/osm-tools/aep_ohio_transmission_analysis.py
```

**Prerequisites:**
- Must run `aep_ohio_infrastructure_osm.py` first
- Requires PJM filing data (see Data Requirements below)

**Input Files (External Data):**
- `public/data/pjm_filings.json` - PJM filing data (planned upgrades)

**Output:**
- `public/data/aep_ohio_transmission_analysis.json` - Transmission comparison
- `public/data/aep_ohio_stalled_projects.json` - Projects that stalled after tariff

---

### 5. `aep_ohio_flipping_analysis.py`
**Flipping Behavior Detection**

Identifies parcels with multiple interconnection requests from different developers.

**Usage:**
```bash
python scripts/osm-tools/aep_ohio_flipping_analysis.py
```

**Prerequisites:**
- Must run `aep_ohio_interconnection_analysis.py` first

**Output:**
- `public/data/aep_ohio_flipping_analysis.json` - Flipping behavior analysis

---

## Execution Order

Run scripts in this order:

1. **`aep_ohio_infrastructure_osm.py`** - Fetch OSM data
2. **`aep_ohio_clustering_analysis.py`** - Cluster substations
3. **`aep_ohio_interconnection_analysis.py`** - Integrate external data (requires external data files)
4. **`aep_ohio_transmission_analysis.py`** - Analyze transmission plans (requires PJM filings)
5. **`aep_ohio_flipping_analysis.py`** - Detect flipping behavior

---

## Data Requirements

### Interconnection Requests (`public/data/interconnection_requests.json`)

Expected schema:
```json
[
  {
    "site_id": "string",
    "customer_name": "string",
    "requested_capacity_mw": 100.0,
    "coordinates": {"lat": 39.9612, "lon": -82.9988},
    "request_date": "2023-01-15T00:00:00Z",
    "status": "active|withdrawn|approved|rejected",
    "survived_tariff": true,
    "parcel_id": "string"
  }
]
```

### Land Transactions (`public/data/land_transactions.json`)

Expected schema:
```json
[
  {
    "parcel_id": "string",
    "sale_date": "2023-06-15",
    "sale_price": 500000.0,
    "buyer": "string",
    "seller": "string",
    "zoning": "industrial",
    "coordinates": {"lat": 39.9612, "lon": -82.9988},
    "area_acres": 10.5
  }
]
```

### PJM Filings (`public/data/pjm_filings.json`)

Expected schema:
```json
[
  {
    "project_id": "string",
    "type": "substation|transmission_line",
    "coordinates": {"lat": 39.9612, "lon": -82.9988},
    "status": "approved|in_progress|cancelled|delayed|stalled",
    "planned_date": "2023-01-01",
    "completion_date": "2024-12-31",
    "description": "string"
  }
]
```

---

## Configuration

### AEP Ohio Territory Bounds

Edit `AEP_OHIO_BOUNDS` in `aep_ohio_infrastructure_osm.py`:
```python
AEP_OHIO_BOUNDS = {
    "north": 41.5,
    "south": 38.5,
    "east": -80.0,
    "west": -85.0,
}
```

### Performance Tuning

In `aep_ohio_infrastructure_osm.py`:
- `BATCH_SIZE` - Queries per batch (default: 50)
- `BATCH_DELAY` - Seconds between batches (default: 3)
- `MAX_RETRIES` - Maximum retry attempts (default: 3)
- `QUERY_TIMEOUT` - Query timeout in seconds (default: 300)

### Clustering Parameters

In `aep_ohio_clustering_analysis.py`:
- `CLUSTER_RADIUS_M` - Cluster radius in meters (default: 8047 = 5 miles)
- `ANALYSIS_ZONES` - Analysis zone radii

---

## Dependencies

Required Python packages:
- `requests` - HTTP requests
- `numpy` - Numerical operations
- `scipy` - Scientific computing (for clustering)

Install with:
```bash
pip install requests numpy scipy
```

---

## Troubleshooting

### "Input file not found" errors
- Ensure previous scripts have been run in order
- Check that output files exist in `public/osm/` or `public/data/`

### "External data file not found" warnings
- Create the required external data files (see Data Requirements above)
- Place them in `public/data/` directory

### Overpass API timeouts
- Increase `QUERY_TIMEOUT` in `aep_ohio_infrastructure_osm.py`
- Reduce bounding box size if querying too large an area
- Add delays between queries

### Health check failures
- Check Overpass API status
- Verify bounding box coordinates are valid
- Check network connectivity

---

## Output Files

All output files are written to:
- `public/osm/` - OSM-derived data
- `public/data/` - Integrated analysis data

See individual script documentation for specific output file names.

---

## Next Steps

After running all scripts:
1. Review output files in `public/osm/` and `public/data/`
2. Integrate with frontend (see `docs/COLUMBUS_MIGRATION_PLAN.md`)
3. Update frontend components to load AEP Ohio data
4. Visualize interconnection requests, land transactions, and clustering

---

**Last Updated:** [Current Date]  
**Status:** Implementation Complete


