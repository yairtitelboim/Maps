#!/usr/bin/env python3
"""
Download AEP Ohio power & transmission infrastructure caches from OSM.

Generates GeoJSON FeatureCollections for:
  - All substations in AEP Ohio territory
  - Transmission lines (high-voltage)
  - Power infrastructure for interconnection request analysis

The resulting JSON files are stored in public/osm and are consumed directly
by the frontend for analyzing interconnection requests, land transactions,
and transmission infrastructure.

Features:
  - Batching for large queries
  - Health checks for query validation
  - Retry logic with exponential backoff
  - Timeout handling for large queries
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from threading import Event, Thread
from typing import Dict, List, Any, Optional

import requests
import signal
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = PROJECT_ROOT / "public" / "osm"
OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"
USER_AGENT = "aep-ohio-infrastructure-cache/1.0 (github.com/)"

# Batching Configuration
BATCH_SIZE = 50  # Process queries in batches
BATCH_DELAY = 3  # Seconds between batches
MAX_RETRIES = 3  # Maximum retry attempts
INITIAL_BACKOFF = 5  # Initial backoff delay in seconds
QUERY_TIMEOUT = 300  # 5 minute timeout for large queries

# AEP Ohio Territory Bounding Box (approximate - adjust as needed)
AEP_OHIO_BOUNDS = {
    "north": 41.5,   # Northern extent
    "south": 38.5,  # Southern extent
    "east": -80.0,  # Eastern extent
    "west": -85.0,  # Western extent
}


def log(message: str) -> None:
    """Emit a timestamped log line with flush so the user can monitor progress in real time."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"[{timestamp}] {message}", flush=True)


def handle_sigint(signum, frame):
    log("⚠️ Received interrupt signal; stopping gracefully.")
    sys.exit(1)


signal.signal(signal.SIGINT, handle_sigint)


def heartbeat(message: str, interval: int = 10):
    """
    Emit a log message every `interval` seconds until the returned stop
    function is called. This keeps long-running requests chatty so we
    know they are still alive.
    """
    stop_event = Event()

    def _runner():
        ticks = 0
        while not stop_event.wait(interval):
            ticks += 1
            log(f"{message} (waiting {ticks * interval}s)")

    thread = Thread(target=_runner, daemon=True)
    thread.start()

    def stop():
        stop_event.set()
        thread.join(timeout=interval + 1)

    return stop


def health_check_query_result(result: Dict) -> Dict[str, Any]:
    """
    Validate query result and return health metrics.
    
    Args:
        result: Overpass API response dictionary
    
    Returns:
        Health check dictionary with validation results
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
    
    # Check for API remarks/warnings
    if "remark" in result:
        health["warnings"].append(f"API remark: {result['remark']}")
    
    # Validate element structure
    for element in elements:
        if "type" not in element or "id" not in element:
            health["error_count"] += 1
            health["warnings"].append(f"Invalid element structure: missing type/id")
    
    # Coverage check - warn if no elements returned
    if health["element_count"] == 0:
        health["warnings"].append("No elements returned - possible coverage issue")
    
    return health


def execute_query_with_retry(
    query: str,
    max_retries: int = MAX_RETRIES,
    backoff: int = INITIAL_BACKOFF
) -> Dict:
    """
    Execute Overpass query with exponential backoff retry.
    
    Args:
        query: Overpass query string
        max_retries: Maximum number of retry attempts
        backoff: Initial backoff delay in seconds
    
    Returns:
        Query result dictionary
    
    Raises:
        Exception: If query fails after all retries
    """
    for attempt in range(max_retries):
        try:
            log(f"⏱️ Overpass request attempt {attempt + 1}/{max_retries}")
            stop_heartbeat = heartbeat("⌛ Waiting for Overpass response")
            
            response = requests.post(
                OVERPASS_URL,
                data={"data": query},
                headers={"User-Agent": USER_AGENT},
                timeout=QUERY_TIMEOUT
            )
            
            stop_heartbeat()
            response.raise_for_status()
            
            result = response.json()
            
            # Health check
            health = health_check_query_result(result)
            if not health["valid"]:
                log(f"⚠️ Health check failed: {health['warnings']}")
                if attempt < max_retries - 1:
                    wait_time = backoff * (2 ** attempt)
                    log(f"Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
            else:
                if health["warnings"]:
                    log(f"ℹ️ Health check warnings: {health['warnings']}")
                log(f"✅ Query succeeded: {health['element_count']} elements returned")
            
            return result
            
        except requests.exceptions.Timeout:
            log(f"⚠️ Query timeout (attempt {attempt + 1}/{max_retries})")
            if attempt < max_retries - 1:
                wait_time = backoff * (2 ** attempt)
                log(f"Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise RuntimeError(f"Query timeout after {max_retries} attempts")
        
        except requests.exceptions.HTTPError as e:
            if e.response.status_code in {429, 502, 503}:
                log(f"⚠️ Overpass throttled ({e.response.status_code}); backing off.")
                if attempt < max_retries - 1:
                    wait_time = backoff * (2 ** attempt)
                    log(f"Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
            raise
        
        except requests.exceptions.RequestException as e:
            log(f"❌ Request error: {e}")
            if attempt < max_retries - 1:
                wait_time = backoff * (2 ** attempt)
                log(f"Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise RuntimeError(f"Query failed after {max_retries} attempts: {e}")
    
    raise RuntimeError(f"Query failed after {max_retries} attempts")


def build_substation_query(bbox: Dict[str, float]) -> str:
    """
    Build Overpass query for all substations in AEP Ohio territory.
    
    Args:
        bbox: Bounding box dictionary with north, south, east, west
    
    Returns:
        Overpass query string
    """
    return f"""
    [out:json][timeout:300];
    (
      // Substations (nodes, ways, and relations)
      node["power"="substation"]({bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']});
      way["power"="substation"]({bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']});
      relation["power"="substation"]({bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']});
    );
    out body;
    >;
    out skel qt;
    """


def build_transmission_line_query(bbox: Dict[str, float]) -> str:
    """
    Build Overpass query for high-voltage transmission lines.
    
    Args:
        bbox: Bounding box dictionary with north, south, east, west
    
    Returns:
        Overpass query string
    """
    return f"""
    [out:json][timeout:300];
    (
      // High-voltage transmission lines (345kV, 230kV, 138kV, 69kV)
      way["power"="line"]["voltage"~"^(345|230|138|69)$"]({bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']});
      way["power"="line"]["cables"~"^[0-9]+$"]({bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']});
      // Also get lines without voltage tag but with power=line
      way["power"="line"]({bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']});
    );
    out body;
    >;
    out skel qt;
    """


def categorize_substation(tags: Dict[str, str]) -> str:
    """Categorize substation based on tags."""
    if not tags:
        return "substation"
    
    voltage = tags.get("voltage", "")
    if voltage:
        return f"substation_{voltage}"
    
    return tags.get("power", "substation")


def categorize_transmission(tags: Dict[str, str]) -> str:
    """Categorize transmission line based on voltage."""
    if not tags:
        return "transmission_line"
    
    voltage = tags.get("voltage", "")
    if voltage:
        return f"transmission_{voltage}kv"
    
    cables = tags.get("cables", "")
    if cables:
        return f"transmission_{cables}cable"
    
    return "transmission_line"


def node_to_feature(element: Dict, category_fn) -> Optional[Dict]:
    """Convert OSM node to GeoJSON feature."""
    try:
        lon = float(element["lon"])
        lat = float(element["lat"])
    except (KeyError, TypeError, ValueError):
        return None

    tags = element.get("tags", {}) or {}
    category = category_fn(tags)

    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [lon, lat],
        },
        "properties": {
            "osm_type": "node",
            "osm_id": element.get("id"),
            "name": tags.get("name", "Unnamed"),
            "category": category,
            "voltage": tags.get("voltage", ""),
            "operator": tags.get("operator", ""),
            "substation": tags.get("substation", ""),
            "tags": tags,
            "source": "openstreetmap",
        },
    }


def way_to_feature(element: Dict, node_lookup: Dict[int, Dict], category_fn) -> Optional[Dict]:
    """Convert OSM way to GeoJSON feature."""
    node_ids = element.get("nodes") or []
    coordinates: List[List[float]] = []

    for node_id in node_ids:
        node = node_lookup.get(node_id)
        if not node:
            continue
        try:
            coordinates.append([float(node["lon"]), float(node["lat"])])
        except (KeyError, TypeError, ValueError):
            continue

    if len(coordinates) < 2:
        return None

    tags = element.get("tags", {}) or {}
    category = category_fn(tags)

    geometry = {
        "type": "LineString",
        "coordinates": coordinates,
    }

    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": {
            "osm_type": "way",
            "osm_id": element.get("id"),
            "name": tags.get("name", "Unnamed"),
            "category": category,
            "voltage": tags.get("voltage", ""),
            "cables": tags.get("cables", ""),
            "circuits": tags.get("circuits", ""),
            "operator": tags.get("operator", ""),
            "tags": tags,
            "source": "openstreetmap",
        },
    }


def build_features(data: Dict, category_fn) -> List[Dict]:
    """Build GeoJSON features from Overpass response."""
    elements = data.get("elements", [])
    node_lookup = {
        element["id"]: element
        for element in elements
        if element.get("type") == "node"
    }

    features: List[Dict] = []
    for element in elements:
        element_type = element.get("type")
        feature = None
        
        if element_type == "node":
            feature = node_to_feature(element, category_fn)
        elif element_type == "way":
            feature = way_to_feature(element, node_lookup, category_fn)
        # Relations are more complex - skip for now or implement separately

        if feature:
            features.append(feature)

    return features


def summarize_categories(features: List[Dict]) -> Dict[str, int]:
    """Summarize features by category."""
    counts: Dict[str, int] = {}
    for feature in features:
        category = feature.get("properties", {}).get("category", "other")
        counts[category] = counts.get(category, 0) + 1
    return counts


def fetch_substations(bbox: Dict[str, float]) -> Dict:
    """Fetch all substations in AEP Ohio territory."""
    log("🔍 Fetching substations from OSM...")
    query = build_substation_query(bbox)
    raw_data = execute_query_with_retry(query)
    
    log("📦 Processing substation data...")
    features = build_features(raw_data, categorize_substation)
    
    if not features:
        log("⚠️ No substations found - check bounding box")
    
    counts = summarize_categories(features)
    
    return {
        "type": "FeatureCollection",
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "feature_count": len(features),
            "categories": counts,
            "bounding_box": bbox,
            "raw_element_count": len(raw_data.get("elements", [])),
        },
        "features": features,
    }


def fetch_transmission_lines(bbox: Dict[str, float]) -> Dict:
    """Fetch all transmission lines in AEP Ohio territory."""
    log("🔍 Fetching transmission lines from OSM...")
    query = build_transmission_line_query(bbox)
    raw_data = execute_query_with_retry(query)
    
    log("📦 Processing transmission line data...")
    features = build_features(raw_data, categorize_transmission)
    
    if not features:
        log("⚠️ No transmission lines found - check bounding box")
    
    counts = summarize_categories(features)
    
    return {
        "type": "FeatureCollection",
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "feature_count": len(features),
            "categories": counts,
            "bounding_box": bbox,
            "raw_element_count": len(raw_data.get("elements", [])),
        },
        "features": features,
    }


def ensure_output_dir(path: Path) -> None:
    """Ensure output directory exists."""
    path.mkdir(parents=True, exist_ok=True)


def write_output_file(filename: str, payload: Dict) -> Path:
    """Write output file to disk."""
    filepath = OUTPUT_DIR / filename
    with filepath.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return filepath


def main() -> None:
    """Main execution function."""
    ensure_output_dir(OUTPUT_DIR)
    
    log("🚀 Starting AEP Ohio infrastructure data collection")
    log(f"📍 AEP Ohio territory bounds: {AEP_OHIO_BOUNDS}")
    
    # Fetch substations
    log("\n" + "="*60)
    log("PHASE 1: Fetching Substations")
    log("="*60)
    substations_data = fetch_substations(AEP_OHIO_BOUNDS)
    substations_file = write_output_file("aep_ohio_substations.json", substations_data)
    log(
        f"💾 Saved {substations_data['metadata']['feature_count']} substations "
        f"to {substations_file.relative_to(PROJECT_ROOT)}"
    )
    log(f"📊 Categories: {substations_data['metadata']['categories']}")
    
    # Rate limiting between queries
    log("⏳ Waiting 3s before next query to avoid rate limits...")
    time.sleep(3)
    
    # Fetch transmission lines
    log("\n" + "="*60)
    log("PHASE 2: Fetching Transmission Lines")
    log("="*60)
    transmission_data = fetch_transmission_lines(AEP_OHIO_BOUNDS)
    transmission_file = write_output_file("aep_ohio_transmission_lines.json", transmission_data)
    log(
        f"💾 Saved {transmission_data['metadata']['feature_count']} transmission lines "
        f"to {transmission_file.relative_to(PROJECT_ROOT)}"
    )
    log(f"📊 Categories: {transmission_data['metadata']['categories']}")
    
    log("\n" + "="*60)
    log("🎉 AEP Ohio infrastructure data collection complete!")
    log("="*60)
    log(f"✅ Substations: {substations_data['metadata']['feature_count']} features")
    log(f"✅ Transmission Lines: {transmission_data['metadata']['feature_count']} features")


if __name__ == "__main__":
    main()


