#!/usr/bin/env python3
"""
Download pipeline infrastructure from OSM for each marker location.

This script generates individual pipeline GeoJSON files for each marker:
  - Red infrastructure markers (Supply and Demand sites)
  - Blue/colored GRDA power generation facilities

Each marker gets a 5-mile radius (8047 meters) pipeline query.
The resulting JSON files are stored in public/data/pipelines/.
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
OUTPUT_DIR = PROJECT_ROOT / "public" / "data" / "pipelines"
OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"
USER_AGENT = "ok-marker-pipelines/1.0 (github.com/)"

# 5 miles in meters
RADIUS_M = int(5 * 1609.34)  # ~8047 meters


def log(message: str) -> None:
    """Emit a timestamped log line with flush so the user can monitor progress in real time."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"[{timestamp}] {message}", flush=True)


def handle_sigint(signum, frame):
    log("⚠️ Received interrupt signal; stopping gracefully.")
    sys.exit(1)


signal.signal(signal.SIGINT, handle_sigint)


# Infrastructure markers (red teardrops)
INFRASTRUCTURE_MARKERS = [
    {
        "key": "pryor",
        "name": "Pryor (MidAmerica Industrial Park)",
        "lat": 36.2411,
        "lon": -95.3301,
    },
    {
        "key": "stillwater",
        "name": "Stillwater Campus",
        "lat": 36.1156,
        "lon": -97.0584,
    },
    {
        "key": "tulsa_suburbs",
        "name": "Tulsa Suburbs (Coweta, Broken Arrow)",
        "lat": 36.0,
        "lon": -95.72,
    },
    {
        "key": "oge_substation_okc",
        "name": "OG&E Major Substation, Oklahoma City",
        "lat": 35.4676,
        "lon": -97.5164,
    },
    {
        "key": "cimarron_link_tulsa",
        "name": "Cimarron Link Transmission Corridor (Tulsa Terminus)",
        "lat": 36.15,
        "lon": -95.99,
    },
    {
        "key": "cimarron_link_panhandle",
        "name": "Cimarron Link Transmission Corridor (Texas Panhandle Edge)",
        "lat": 36.5,
        "lon": -102.0,
    },
    {
        "key": "cushing",
        "name": "Cushing",
        "lat": 35.9851,
        "lon": -96.7670,
    },
    {
        "key": "tulsa_metro",
        "name": "Tulsa Metro",
        "lat": 36.1539,
        "lon": -95.9925,
    },
    {
        "key": "okc_innovation_district",
        "name": "Oklahoma City Innovation District",
        "lat": 35.4676,
        "lon": -97.5164,
    },
    {
        "key": "ardmore",
        "name": "Ardmore",
        "lat": 34.1743,
        "lon": -97.1436,
    },
    {
        "key": "inola",
        "name": "Inola (near Pryor)",
        "lat": 36.15,
        "lon": -95.52,
    },
    {
        "key": "tinker_afb",
        "name": "Tinker Air Force Base",
        "lat": 35.4147,
        "lon": -97.4027,
    },
]

# GRDA Power Generation Facilities (blue/colored teardrops)
GRDA_MARKERS = [
    {
        "key": "pensacola_dam",
        "name": "Pensacola Dam",
        "lat": 36.4675,
        "lon": -95.04139,
    },
    {
        "key": "robert_s_kerr_dam",
        "name": "Robert S. Kerr Dam",
        "lat": 36.0831,
        "lon": -95.1167,
    },
    {
        "key": "salina_pumped_storage",
        "name": "Salina Pumped Storage Project",
        "lat": 36.292,
        "lon": -95.152,
    },
    {
        "key": "wind_generation",
        "name": "Wind Generation",
        "lat": 35.4676,
        "lon": -97.5164,
    },
    {
        "key": "redbud_power_plant",
        "name": "Redbud Power Plant",
        "lat": 36.2831,
        "lon": -95.1167,
    },
]

ALL_MARKERS = INFRASTRUCTURE_MARKERS + GRDA_MARKERS


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
    """Compose an Overpass query focused specifically on pipeline infrastructure."""
    
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
    );
    out body;
    >;
    out skel qt;
    """
    
    return query


def categorize_pipeline(tags: Dict[str, str]) -> str:
    """Categorize pipeline features."""
    if not tags:
        return "pipeline"
    
    # Direct pipeline tag
    pipeline_tag = tags.get("pipeline", "").lower()
    if pipeline_tag:
        return "pipeline"
    
    # Man-made pipeline
    man_made = tags.get("man_made", "").lower()
    if man_made in {"pipeline", "pipeline_substation", "pipeline_marker", "sewer", "water_works"}:
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
    
    return "pipeline:unknown"


def node_to_feature(marker_key: str, element: Dict) -> Dict | None:
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
            "marker_key": marker_key,
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


def way_to_feature(marker_key: str, element: Dict, node_lookup: Dict[int, Dict]) -> Dict | None:
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
            "marker_key": marker_key,
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


def relation_to_feature(marker_key: str, element: Dict, node_lookup: Dict[int, Dict], way_lookup: Dict[int, Dict]) -> Dict | None:
    """Convert OSM relation to GeoJSON feature (for pipeline routes/networks)."""
    members = element.get("members", [])
    if not members:
        return None
    
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
            "marker_key": marker_key,
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
                timeout=180,
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


def build_features(marker_key: str, data: Dict) -> List[Dict]:
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
            feature = node_to_feature(marker_key, element)
        elif element_type == "way":
            feature = way_to_feature(marker_key, element, node_lookup)
        elif element_type == "relation":
            feature = relation_to_feature(marker_key, element, node_lookup, way_lookup)

        if feature:
            features.append(feature)

    return features


def summarize_categories(features: List[Dict]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for feature in features:
        category = feature.get("properties", {}).get("category", "pipeline")
        counts[category] = counts.get(category, 0) + 1
    return counts


def fetch_marker_data(marker: Dict) -> Dict:
    log(f"🧭 Building pipeline query for {marker['name']} (radius {RADIUS_M}m / 5 miles)")
    query = build_pipeline_query(marker["lat"], marker["lon"], RADIUS_M)
    raw_data = execute_overpass(query)
    log(f"📦 Processing Overpass payload for {marker['key']}")
    features = build_features(marker["key"], raw_data)
    if not features:
        log("⚠️ No pipeline features returned for this marker; Overpass may have truncated the response.")

    counts = summarize_categories(features)

    envelope = {
        "min_lon": marker["lon"] - RADIUS_M / 111320,
        "min_lat": marker["lat"] - RADIUS_M / 110540,
        "max_lon": marker["lon"] + RADIUS_M / 111320,
        "max_lat": marker["lat"] + RADIUS_M / 110540,
    }

    return {
        "marker": {
            "key": marker["key"],
            "name": marker["name"],
            "center": {"lat": marker["lat"], "lng": marker["lon"]},
            "radius_m": RADIUS_M,
        },
        "summary": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "feature_count": len(features),
            "categories": counts,
            "query_radius_m": RADIUS_M,
            "bounding_box": envelope,
            "raw_element_count": len(raw_data.get("elements", [])),
        },
        "features": features,
    }


def ensure_output_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_marker_file(marker: Dict, payload: Dict) -> Path:
    filename = f"pipeline_{marker['key']}.json"
    filepath = OUTPUT_DIR / filename
    with filepath.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return filepath


def main() -> None:
    ensure_output_dir(OUTPUT_DIR)

    log("🔍 Starting pipeline infrastructure download for all markers")
    log(f"📏 Using 5-mile radius ({RADIUS_M}m) for each marker")

    for marker in ALL_MARKERS:
        log(f"🔍 Fetching pipeline data for {marker['name']} ({marker['key']})")
        payload = fetch_marker_data(marker)
        output_file = write_marker_file(marker, payload)
        log(
            f"💾 Saved {payload['summary']['feature_count']} pipeline features "
            f"to {output_file.relative_to(PROJECT_ROOT)} (categories: {payload['summary']['categories']})"
        )
        log("⏳ Waiting 3s before next marker to avoid rate limits...")
        time.sleep(3)

    log("🎉 All marker pipeline caches generated.")


if __name__ == "__main__":
    main()




