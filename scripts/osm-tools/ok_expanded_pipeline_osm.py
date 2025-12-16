#!/usr/bin/env python3
"""
Download expanded pipeline infrastructure from OSM for Oklahoma data centers.

This script focuses specifically on pipeline infrastructure with expanded coverage:
  - Larger search radius (up to 50km from sites)
  - Comprehensive pipeline tags (gas, oil, water, sewer, etc.)
  - Pipeline relations (not just nodes and ways)
  - Bounding box queries for broader regional coverage

Generates GeoJSON FeatureCollections for:
  - Google Stillwater Data Center Campus (Stillwater, OK)
  - Google Pryor Data Center Expansion (Pryor, OK - MidAmerica Industrial Park)

The resulting JSON files are stored in public/osm and supplement the main
ok_data_center_*.json files with expanded pipeline coverage.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from threading import Event, Thread
from typing import Dict, List

import requests
import signal
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = PROJECT_ROOT / "public" / "osm"
OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"
USER_AGENT = "ok-expanded-pipeline-cache/1.0 (github.com/)"


def log(message: str) -> None:
    """Emit a timestamped log line with flush so the user can monitor progress in real time."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"[{timestamp}] {message}", flush=True)


def handle_sigint(signum, frame):
    log("⚠️ Received interrupt signal; stopping gracefully.")
    sys.exit(1)


signal.signal(signal.SIGINT, handle_sigint)


SITES = [
    {
        "key": "google_stillwater_ok",
        "name": "Google Stillwater Data Center Campus",
        "lat": 36.1156,
        "lon": -97.0584,
        "radius_m": 50000,  # Expanded to 50km for pipeline coverage
        "note": "Stillwater, OK - Expanded pipeline coverage for Google data center campus.",
    },
    {
        "key": "google_pryor_ok",
        "name": "Google Pryor Data Center Expansion",
        "lat": 36.3086,
        "lon": -95.3167,
        "radius_m": 50000,  # Expanded to 50km for pipeline coverage
        "note": "MidAmerica Industrial Park, Pryor, OK - Expanded pipeline coverage.",
    },
]


# Comprehensive pipeline-related tags
PIPELINE_MAN_MADE = {"pipeline", "pipeline_substation", "pipeline_marker"}
PIPELINE_TAGS = {
    "pipeline", "gas", "oil", "water", "sewer", "wastewater", 
    "reclaimed_water", "reuse", "recycled", "petroleum", "natural_gas",
    "propane", "lpg", "crude_oil", "refined_product"
}
PIPELINE_LOCATION = {"underground", "overground", "overhead", "surface"}
PIPELINE_USAGE = {"transmission", "distribution", "supply", "disposal"}


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


def build_pipeline_query(lat: float, lon: float, radius_m: int) -> str:
    """Compose an Overpass query focused specifically on pipeline infrastructure
    with comprehensive coverage including all pipeline types, relations, and extended radius."""
    
    # Calculate bounding box for more efficient queries
    # Approximate conversion: 1 degree lat ≈ 111km, 1 degree lon ≈ 111km * cos(lat)
    lat_deg_offset = radius_m / 111320
    lon_deg_offset = radius_m / (111320 * abs(lat))
    
    bbox_min_lat = lat - lat_deg_offset
    bbox_max_lat = lat + lat_deg_offset
    bbox_min_lon = lon - lon_deg_offset
    bbox_max_lon = lon + lon_deg_offset
    
    query = f"""[out:json][timeout:300];
    (
      // PRIMARY PIPELINE QUERIES - Direct pipeline tags
      node["pipeline"](around:{radius_m},{lat},{lon});
      way["pipeline"](around:{radius_m},{lat},{lon});
      relation["pipeline"](around:{radius_m},{lat},{lon});
      
      // MAN_MADE PIPELINE INFRASTRUCTURE
      node["man_made"="pipeline"](around:{radius_m},{lat},{lon});
      way["man_made"="pipeline"](around:{radius_m},{lat},{lon});
      relation["man_made"="pipeline"](around:{radius_m},{lat},{lon});
      
      node["man_made"="pipeline_substation"](around:{radius_m},{lat},{lon});
      way["man_made"="pipeline_substation"](around:{radius_m},{lat},{lon});
      
      node["man_made"="pipeline_marker"](around:{radius_m},{lat},{lon});
      way["man_made"="pipeline_marker"](around:{radius_m},{lat},{lon});
      
      // PIPELINE BY SUBSTANCE TYPE
      node["pipeline"="gas"](around:{radius_m},{lat},{lon});
      way["pipeline"="gas"](around:{radius_m},{lat},{lon});
      relation["pipeline"="gas"](around:{radius_m},{lat},{lon});
      
      node["pipeline"="oil"](around:{radius_m},{lat},{lon});
      way["pipeline"="oil"](around:{radius_m},{lat},{lon});
      relation["pipeline"="oil"](around:{radius_m},{lat},{lon});
      
      node["pipeline"="water"](around:{radius_m},{lat},{lon});
      way["pipeline"="water"](around:{radius_m},{lat},{lon});
      relation["pipeline"="water"](around:{radius_m},{lat},{lon});
      
      node["pipeline"="sewer"](around:{radius_m},{lat},{lon});
      way["pipeline"="sewer"](around:{radius_m},{lat},{lon});
      relation["pipeline"="sewer"](around:{radius_m},{lat},{lon});
      
      node["pipeline"="wastewater"](around:{radius_m},{lat},{lon});
      way["pipeline"="wastewater"](around:{radius_m},{lat},{lon});
      relation["pipeline"="wastewater"](around:{radius_m},{lat},{lon});
      
      node["pipeline"="petroleum"](around:{radius_m},{lat},{lon});
      way["pipeline"="petroleum"](around:{radius_m},{lat},{lon});
      relation["pipeline"="petroleum"](around:{radius_m},{lat},{lon});
      
      node["pipeline"="natural_gas"](around:{radius_m},{lat},{lon});
      way["pipeline"="natural_gas"](around:{radius_m},{lat},{lon});
      relation["pipeline"="natural_gas"](around:{radius_m},{lat},{lon});
      
      // ALTERNATIVE PIPELINE TAGS
      node["substance"="gas"](around:{radius_m},{lat},{lon});
      way["substance"="gas"](around:{radius_m},{lat},{lon});
      
      node["substance"="oil"](around:{radius_m},{lat},{lon});
      way["substance"="oil"](around:{radius_m},{lat},{lon});
      
      node["substance"="water"](around:{radius_m},{lat},{lon});
      way["substance"="water"](around:{radius_m},{lat},{lon});
      
      // PIPELINE INFRASTRUCTURE (pumping stations, compressor stations, etc.)
      node["pipeline:marker"](around:{radius_m},{lat},{lon});
      way["pipeline:marker"](around:{radius_m},{lat},{lon});
      
      node["pipeline:substation"](around:{radius_m},{lat},{lon});
      way["pipeline:substation"](around:{radius_m},{lat},{lon});
      
      // SEWER AND WASTEWATER INFRASTRUCTURE (often tagged as pipelines)
      node["man_made"="sewer"](around:{radius_m},{lat},{lon});
      way["man_made"="sewer"](around:{radius_m},{lat},{lon});
      
      node["sewer"](around:{radius_m},{lat},{lon});
      way["sewer"](around:{radius_m},{lat},{lon});
      
      // WATER SUPPLY PIPELINES (water mains, transmission lines)
      node["man_made"="water_works"](around:{radius_m},{lat},{lon});
      way["man_made"="water_works"](around:{radius_m},{lat},{lon});
      
      // BOUNDING BOX QUERY FOR COMPREHENSIVE COVERAGE
      // This catches pipelines that might be just outside the radius
      node["pipeline"]({bbox_min_lat},{bbox_min_lon},{bbox_max_lat},{bbox_max_lon});
      way["pipeline"]({bbox_min_lat},{bbox_min_lon},{bbox_max_lat},{bbox_max_lon});
      relation["pipeline"]({bbox_min_lat},{bbox_min_lon},{bbox_max_lat},{bbox_max_lon});
      
      node["man_made"="pipeline"]({bbox_min_lat},{bbox_min_lon},{bbox_max_lat},{bbox_max_lon});
      way["man_made"="pipeline"]({bbox_min_lat},{bbox_min_lon},{bbox_max_lat},{bbox_max_lon});
      relation["man_made"="pipeline"]({bbox_min_lat},{bbox_min_lon},{bbox_max_lat},{bbox_max_lon});
    );
    out body;
    >;
    out skel qt;
    """
    
    return query


def categorize_pipeline(tags: Dict[str, str]) -> str:
    """Categorize pipeline features with detailed pipeline-specific logic."""
    if not tags:
        return "pipeline"
    
    # Direct pipeline tag
    pipeline_tag = tags.get("pipeline", "").lower()
    if pipeline_tag:
        # Map common pipeline values to standardized categories
        if pipeline_tag in {"gas", "natural_gas", "lpg", "propane"}:
            return "pipeline"  # Keep as pipeline, but we can add subcategory
        elif pipeline_tag in {"oil", "petroleum", "crude_oil", "refined_product"}:
            return "pipeline"
        elif pipeline_tag in {"water", "drinking_water", "potable_water"}:
            return "pipeline"
        elif pipeline_tag in {"sewer", "wastewater", "reclaimed_water", "reuse", "recycled"}:
            return "pipeline"
        else:
            return "pipeline"
    
    # Man-made pipeline
    man_made = tags.get("man_made", "").lower()
    if man_made == "pipeline":
        return "pipeline"
    if man_made in {"pipeline_substation", "pipeline_marker"}:
        return "pipeline"
    if man_made == "sewer":
        return "pipeline"
    if man_made == "water_works":
        return "pipeline"
    
    # Substance tag
    substance = tags.get("substance", "").lower()
    if substance in {"gas", "oil", "water"}:
        return "pipeline"
    
    # Sewer tag
    if tags.get("sewer"):
        return "pipeline"
    
    # Default to pipeline if we have any pipeline-related indicators
    if any(key in tags for key in ["pipeline", "pipeline:marker", "pipeline:substation"]):
        return "pipeline"
    
    return "pipeline"


def infer_pipeline_subcategory(tags: Dict[str, str]) -> str:
    """Infer detailed subcategory for pipeline features."""
    pipeline_tag = tags.get("pipeline", "").lower()
    if pipeline_tag:
        return f"pipeline:{pipeline_tag}"
    
    substance = tags.get("substance", "").lower()
    if substance:
        return f"substance:{substance}"
    
    man_made = tags.get("man_made", "").lower()
    if man_made:
        return f"man_made:{man_made}"
    
    location = tags.get("location", "").lower()
    if location:
        return f"location:{location}"
    
    usage = tags.get("usage", "").lower()
    if usage:
        return f"usage:{usage}"
    
    # Check for diameter, pressure, or other technical attributes
    if tags.get("diameter"):
        return f"diameter:{tags['diameter']}"
    
    if tags.get("pressure"):
        return f"pressure:{tags['pressure']}"
    
    return "pipeline:unknown"


def node_to_feature(site_key: str, element: Dict) -> Dict | None:
    try:
        lon = float(element["lon"])
        lat = float(element["lat"])
    except (KeyError, TypeError, ValueError):
        return None

    tags = element.get("tags", {}) or {}
    category = categorize_pipeline(tags)
    subcategory = infer_pipeline_subcategory(tags)

    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [lon, lat],
        },
        "properties": {
            "site_key": site_key,
            "osm_type": "node",
            "osm_id": element.get("id"),
            "name": tags.get("name", "Unnamed Pipeline"),
            "category": category,
            "subcategory": subcategory,
            "pipeline_type": tags.get("pipeline", ""),
            "substance": tags.get("substance", ""),
            "man_made": tags.get("man_made", ""),
            "location": tags.get("location", ""),
            "usage": tags.get("usage", ""),
            "diameter": tags.get("diameter", ""),
            "pressure": tags.get("pressure", ""),
            "operator": tags.get("operator", ""),
            "tags": tags,
            "source": "openstreetmap",
        },
    }


def way_to_feature(site_key: str, element: Dict, node_lookup: Dict[int, Dict]) -> Dict | None:
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

    is_closed = coordinates[0] == coordinates[-1]
    if is_closed and len(coordinates) >= 4:
        geometry = {
            "type": "Polygon",
            "coordinates": [coordinates],
        }
    else:
        geometry = {
            "type": "LineString",
            "coordinates": coordinates,
        }

    tags = element.get("tags", {}) or {}
    category = categorize_pipeline(tags)
    subcategory = infer_pipeline_subcategory(tags)

    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": {
            "site_key": site_key,
            "osm_type": "way",
            "osm_id": element.get("id"),
            "name": tags.get("name", "Unnamed Pipeline"),
            "category": category,
            "subcategory": subcategory,
            "pipeline_type": tags.get("pipeline", ""),
            "substance": tags.get("substance", ""),
            "man_made": tags.get("man_made", ""),
            "location": tags.get("location", ""),
            "usage": tags.get("usage", ""),
            "diameter": tags.get("diameter", ""),
            "pressure": tags.get("pressure", ""),
            "operator": tags.get("operator", ""),
            "length": tags.get("length", ""),
            "tags": tags,
            "source": "openstreetmap",
        },
    }


def relation_to_feature(site_key: str, element: Dict, node_lookup: Dict[int, Dict], way_lookup: Dict[int, Dict]) -> Dict | None:
    """Convert OSM relation to GeoJSON feature (for pipeline routes/networks)."""
    members = element.get("members", [])
    if not members:
        return None
    
    # For pipeline relations, we typically want to extract the geometry from member ways
    # This is a simplified version - full relation processing is more complex
    tags = element.get("tags", {}) or {}
    category = categorize_pipeline(tags)
    subcategory = infer_pipeline_subcategory(tags)
    
    # Try to get a representative point from the first member
    first_member = members[0]
    member_ref = first_member.get("ref")
    member_type = first_member.get("type")
    
    geometry = None
    if member_type == "node" and member_ref in node_lookup:
        node = node_lookup[member_ref]
        try:
            geometry = {
                "type": "Point",
                "coordinates": [float(node["lon"]), float(node["lat"])],
            }
        except (KeyError, TypeError, ValueError):
            pass
    elif member_type == "way" and member_ref in way_lookup:
        # Use way geometry
        way = way_lookup[member_ref]
        node_ids = way.get("nodes", [])
        coordinates = []
        for node_id in node_ids:
            node = node_lookup.get(node_id)
            if node:
                try:
                    coordinates.append([float(node["lon"]), float(node["lat"])])
                except (KeyError, TypeError, ValueError):
                    continue
        if len(coordinates) >= 2:
            geometry = {
                "type": "LineString",
                "coordinates": coordinates,
            }
    
    if not geometry:
        return None
    
    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": {
            "site_key": site_key,
            "osm_type": "relation",
            "osm_id": element.get("id"),
            "name": tags.get("name", "Unnamed Pipeline Network"),
            "category": category,
            "subcategory": subcategory,
            "pipeline_type": tags.get("pipeline", ""),
            "substance": tags.get("substance", ""),
            "man_made": tags.get("man_made", ""),
            "operator": tags.get("operator", ""),
            "type": tags.get("type", ""),
            "tags": tags,
            "source": "openstreetmap",
        },
    }


def execute_overpass(query: str, retries: int = 3, backoff: int = 15) -> Dict:
    for attempt in range(1, retries + 1):
        try:
            log(f"⏱️ Overpass request attempt {attempt}/{retries}")
            stop_heartbeat = heartbeat("⌛ Waiting for Overpass response")
            response = requests.post(
                OVERPASS_URL,
                data={"data": query},
                headers={"User-Agent": USER_AGENT},
                timeout=180,  # Longer timeout for expanded queries
            )
            stop_heartbeat()

            if response.status_code in {429, 502, 503}:
                log(f"⚠️ Overpass throttled us ({response.status_code}); backing off.")
                if attempt == retries:
                    response.raise_for_status()
                time.sleep(backoff * attempt)
                continue

            response.raise_for_status()
            log("✅ Overpass request succeeded.")
            try:
                return response.json()
            except ValueError as exc:
                snippet = response.text[:200].strip()
                log(f"⚠️ Overpass returned non-JSON payload (first 200 chars): {snippet!r}")
                raise exc
        except (requests.exceptions.RequestException, ValueError) as exc:
            if 'stop_heartbeat' in locals():
                stop_heartbeat()
            if attempt >= retries:
                raise RuntimeError(f"Overpass request failed after {attempt} attempts") from exc
            log(f"⚠️ Request error: {exc}. Retrying in {backoff * attempt}s.")
            time.sleep(backoff * attempt)


def build_features(site_key: str, data: Dict) -> List[Dict]:
    elements = data.get("elements", [])
    
    # Build lookups for nodes, ways, and relations
    node_lookup = {
        element["id"]: element
        for element in elements
        if element.get("type") == "node"
    }
    
    way_lookup = {
        element["id"]: element
        for element in elements
        if element.get("type") == "way"
    }

    features: List[Dict] = []
    for element in elements:
        element_type = element.get("type")
        feature = None
        if element_type == "node":
            feature = node_to_feature(site_key, element)
        elif element_type == "way":
            feature = way_to_feature(site_key, element, node_lookup)
        elif element_type == "relation":
            feature = relation_to_feature(site_key, element, node_lookup, way_lookup)

        if feature:
            features.append(feature)

    return features


def summarize_categories(features: List[Dict]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for feature in features:
        category = feature.get("properties", {}).get("category", "pipeline")
        counts[category] = counts.get(category, 0) + 1
    return counts


def fetch_site_data(site: Dict) -> Dict:
    log(f"🧭 Building expanded pipeline query for {site['name']} (radius {site['radius_m']}m)")
    query = build_pipeline_query(site["lat"], site["lon"], site["radius_m"])
    raw_data = execute_overpass(query)
    log(f"📦 Processing Overpass payload for {site['key']}")
    features = build_features(site["key"], raw_data)
    if not features:
        log("⚠️ No pipeline features returned for this site; Overpass may have truncated the response.")

    counts = summarize_categories(features)

    envelope = {
        "min_lon": site["lon"] - site["radius_m"] / 111320,
        "min_lat": site["lat"] - site["radius_m"] / 110540,
        "max_lon": site["lon"] + site["radius_m"] / 111320,
        "max_lat": site["lat"] + site["radius_m"] / 110540,
    }

    return {
        "site": {
            "key": site["key"],
            "name": site["name"],
            "center": {"lat": site["lat"], "lng": site["lon"]},
            "radius_m": site["radius_m"],
            "note": site["note"],
        },
        "summary": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "feature_count": len(features),
            "categories": counts,
            "query_radius_m": site["radius_m"],
            "bounding_box": envelope,
            "raw_element_count": len(raw_data.get("elements", [])),
        },
        "features": features,
    }


def ensure_output_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_site_file(site: Dict, payload: Dict) -> Path:
    filename = f"ok_pipeline_expanded_{site['key']}.json"
    filepath = OUTPUT_DIR / filename
    with filepath.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return filepath


def main() -> None:
    ensure_output_dir(OUTPUT_DIR)

    log("🔍 Starting expanded pipeline infrastructure download for Oklahoma data centers")
    log("📏 Using expanded 50km radius for comprehensive pipeline coverage")

    for site in SITES:
        log(f"🔍 Fetching expanded pipeline data for {site['name']} ({site['key']})")
        payload = fetch_site_data(site)
        output_file = write_site_file(site, payload)
        log(
            f"💾 Saved {payload['summary']['feature_count']} pipeline features "
            f"to {output_file.relative_to(PROJECT_ROOT)} (categories: {payload['summary']['categories']})"
        )
        log("⏳ Waiting 3s before next site to avoid rate limits...")
        time.sleep(3)

    log("🎉 Expanded Oklahoma data center pipeline caches refreshed.")


if __name__ == "__main__":
    main()

