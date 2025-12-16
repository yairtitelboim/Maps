#!/usr/bin/env python3
"""
Download Oklahoma Google data center power & utility infrastructure caches from OSM.

Generates GeoJSON FeatureCollections for:
  - Google Stillwater Data Center Campus (Stillwater, OK)
  - Google Pryor Data Center Expansion (Pryor, OK - MidAmerica Industrial Park)

The resulting JSON files are stored in public/osm and are consumed directly
by the frontend OSM toggle so that the application can operate without
live Overpass API calls.
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
USER_AGENT = "ok-data-center-cache/1.0 (github.com/)"


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
        "radius_m": 8000,
        "note": "Stillwater, OK - New Google data center campus at Richmond & Jardot intersection with OG&E substation.",
    },
    {
        "key": "google_pryor_ok",
        "name": "Google Pryor Data Center Expansion",
        "lat": 36.3086,
        "lon": -95.3167,
        "radius_m": 10000,
        "note": "MidAmerica Industrial Park, Pryor, OK - Google data center expansion at existing campus.",
    },
]


POWER_TAGS = {"power", "generator:type"}
WATER_MAN_MADE = {"water_tower", "water_works", "reservoir_covered", "plant"}
WATER_AMENITIES = {"water_treatment", "water_works", "drinking_water"}
PIPELINE_VALUES = {"pipeline", "gas", "oil", "sewer", "water"}
# Data center specific tags
DATA_CENTER_TAGS = {"data_center", "telecom", "telecommunications", "internet_exchange"}
INDUSTRIAL_TAGS = {"industrial", "warehouse", "factory"}


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


def build_query(lat: float, lon: float, radius_m: int) -> str:
    """Compose an Overpass query covering comprehensive infrastructure including power, utilities, 
    data center infrastructure, universities, offices, transportation, parks, water, and commercial zones.
    Includes targeted queries for specific lakes (Lake McMurtry, Lake Carl Blackwell) near Stillwater."""
    
    # Check if this is Stillwater to add targeted lake queries
    is_stillwater = abs(lat - 36.1156) < 0.01 and abs(lon - (-97.0584)) < 0.01
    
    # Targeted lake coordinates (approximate)
    lake_mcmurtry_lat, lake_mcmurtry_lon = 36.15, -97.25
    lake_carl_blackwell_lat, lake_carl_blackwell_lon = 36.12, -97.20
    lake_radius = 5000  # 5km radius around each lake
    
    # Build base query
    query_parts = [
        f"""[out:json][timeout:180];
    (
      // POWER INFRASTRUCTURE
      node["power"](around:{radius_m},{lat},{lon});
      way["power"](around:{radius_m},{lat},{lon});

      // WATER & UTILITY INFRASTRUCTURE
      node["man_made"~"^(water_tower|water_works|reservoir_covered|pipeline|plant|data_center)$"](around:{radius_m},{lat},{lon});
      way["man_made"~"^(water_tower|water_works|reservoir_covered|pipeline|plant|data_center)$"](around:{radius_m},{lat},{lon});

      node["amenity"~"^(water_treatment|water_works|power_station)$"](around:{radius_m},{lat},{lon});
      way["amenity"~"^(water_treatment|water_works|power_station)$"](around:{radius_m},{lat},{lon});

      // Waterways within main radius
      node["waterway"~"^(canal|drain|ditch|river|stream)$"](around:{radius_m},{lat},{lon});
      way["waterway"~"^(canal|drain|ditch|river|stream)$"](around:{radius_m},{lat},{lon});

      node["pipeline"](around:{radius_m},{lat},{lon});
      way["pipeline"](around:{radius_m},{lat},{lon});

      // TELECOM & DATA CENTER
      node["telecom"](around:{radius_m},{lat},{lon});
      way["telecom"](around:{radius_m},{lat},{lon});

      // INDUSTRIAL BUILDINGS
      node["landuse"="industrial"](around:{radius_m},{lat},{lon});
      way["landuse"="industrial"](around:{radius_m},{lat},{lon});

      node["building"="industrial"](around:{radius_m},{lat},{lon});
      way["building"="industrial"](around:{radius_m},{lat},{lon});

      node["building"="warehouse"](around:{radius_m},{lat},{lon});
      way["building"="warehouse"](around:{radius_m},{lat},{lon});

      // UNIVERSITIES AND RESEARCH INSTITUTIONS
      node["amenity"~"^(university|college)$"](around:{radius_m},{lat},{lon});
      way["amenity"~"^(university|college)$"](around:{radius_m},{lat},{lon});

      // OFFICE BUILDINGS AND COMMERCIAL SPACES
      node["office"](around:{radius_m},{lat},{lon});
      way["office"](around:{radius_m},{lat},{lon});
      node["building"="office"](around:{radius_m},{lat},{lon});
      way["building"="office"](around:{radius_m},{lat},{lon});

      // PUBLIC TRANSPORTATION
      node["public_transport"="station"](around:{radius_m},{lat},{lon});
      node["railway"="station"](around:{radius_m},{lat},{lon});
      node["highway"="bus_stop"](around:{radius_m},{lat},{lon});

      // PARKS AND PUBLIC SPACES
      way["leisure"="park"](around:{radius_m},{lat},{lon});
      way["amenity"="park"](around:{radius_m},{lat},{lon});

      // WATER FEATURES (rivers, lakes, ponds, reservoirs) within main radius
      way["natural"="water"](around:{radius_m},{lat},{lon});
      way["waterway"="river"](around:{radius_m},{lat},{lon});
      way["water"="reservoir"](around:{radius_m},{lat},{lon});
      way["water"="lake"](around:{radius_m},{lat},{lon});
      way["water"="pond"](around:{radius_m},{lat},{lon});
      relation["natural"="water"](around:{radius_m},{lat},{lon});
      relation["water"="reservoir"](around:{radius_m},{lat},{lon});
      relation["water"="lake"](around:{radius_m},{lat},{lon})"""
    ]
    
    # Add targeted lake queries for Stillwater only
    if is_stillwater:
        query_parts.append(f"""
      // TARGETED: Lake McMurtry and Lake Carl Blackwell (specific lakes near Stillwater)
      // Query by location around each lake
      way["natural"="water"](around:{lake_radius},{lake_mcmurtry_lat},{lake_mcmurtry_lon});
      way["natural"="water"](around:{lake_radius},{lake_carl_blackwell_lat},{lake_carl_blackwell_lon});
      relation["natural"="water"](around:{lake_radius},{lake_mcmurtry_lat},{lake_mcmurtry_lon});
      relation["natural"="water"](around:{lake_radius},{lake_carl_blackwell_lat},{lake_carl_blackwell_lon});
      
      // Waterways connecting to these specific lakes (extended to reach the lakes)
      way["waterway"~"^(canal|drain|ditch|river|stream)$"](around:{lake_radius},{lake_mcmurtry_lat},{lake_mcmurtry_lon});
      way["waterway"~"^(canal|drain|ditch|river|stream)$"](around:{lake_radius},{lake_carl_blackwell_lat},{lake_carl_blackwell_lon})""")
    
    query_parts.append(f"""
      // COMMERCIAL AND MIXED-USE ZONES
      way["landuse"="commercial"](around:{radius_m},{lat},{lon});
      way["landuse"="retail"](around:{radius_m},{lat},{lon});

      // MAJOR ROADS (for context)
      way["highway"~"^(motorway|trunk|primary)$"](around:{radius_m},{lat},{lon});

      // CRITICAL INFRASTRUCTURE
      node["amenity"="hospital"](around:{radius_m},{lat},{lon});
      way["amenity"="hospital"](around:{radius_m},{lat},{lon});
    );
    out body;
    >;
    out skel qt;
    """)
    
    return "".join(query_parts)


def categorize(tags: Dict[str, str]) -> str:
    if not tags:
        return "other"

    # Power infrastructure
    if any(key in tags for key in POWER_TAGS):
        return "power"

    # Water infrastructure
    amenity = tags.get("amenity", "")
    if amenity in WATER_AMENITIES:
        return "water"

    man_made = tags.get("man_made", "")
    if man_made in WATER_MAN_MADE:
        return "water"
    if man_made == "pipeline":
        return "pipeline"
    if man_made == "data_center":
        return "data_center"

    pipeline = tags.get("pipeline", "")
    if pipeline or pipeline in PIPELINE_VALUES:
        return "pipeline"

    if tags.get("utility"):
        return "utility"

    waterway = tags.get("waterway", "")
    if waterway in {"canal", "drain", "ditch", "river", "stream"}:
        return "water"
    
    # Natural water features (lakes, ponds, reservoirs)
    if tags.get("natural") == "water":
        return "water"
    
    # Water tags for reservoirs and lakes
    water_tag = tags.get("water", "")
    if water_tag in {"reservoir", "lake", "pond"}:
        return "water"

    # Telecom infrastructure
    telecom = tags.get("telecom", "")
    if telecom:
        return "telecom"

    # Universities and colleges
    if amenity in {"university", "college"}:
        return "university"

    # Office buildings
    if tags.get("office") or tags.get("building") == "office":
        return "office"

    # Industrial buildings
    building = tags.get("building", "")
    if building in {"industrial", "warehouse", "data_center"}:
        return "industrial"

    if tags.get("landuse") == "industrial":
        if tags.get("industrial") in {"power", "water"}:
            return tags.get("industrial")
        return "industrial"

    # Transportation
    if tags.get("public_transport") == "station" or tags.get("railway") == "station":
        return "transportation"
    if tags.get("highway") == "bus_stop":
        return "transportation"

    # Parks and public spaces
    if tags.get("leisure") == "park" or amenity == "park":
        return "park"

    # Commercial zones
    landuse = tags.get("landuse", "")
    if landuse in {"commercial", "retail"}:
        return "commercial"

    # Major roads
    highway = tags.get("highway", "")
    if highway in {"motorway", "trunk", "primary"}:
        return "road"

    # Critical infrastructure (hospitals, etc.)
    if amenity == "hospital":
        return "critical"

    return "other"


def infer_subcategory(tags: Dict[str, str]) -> str:
    for key in ("power", "generator:type", "amenity", "man_made", "pipeline", "waterway", "utility", "telecom", "building"):
        if tags.get(key):
            return f"{key}:{tags[key]}"
    if tags.get("landuse"):
        return f"landuse:{tags['landuse']}"
    return "unknown"


def node_to_feature(site_key: str, element: Dict) -> Dict | None:
    try:
        lon = float(element["lon"])
        lat = float(element["lat"])
    except (KeyError, TypeError, ValueError):
        return None

    tags = element.get("tags", {}) or {}
    category = categorize(tags)
    subcategory = infer_subcategory(tags)

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
            "name": tags.get("name", "Unnamed"),
            "category": category,
            "subcategory": subcategory,
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
    category = categorize(tags)
    subcategory = infer_subcategory(tags)

    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": {
            "site_key": site_key,
            "osm_type": "way",
            "osm_id": element.get("id"),
            "name": tags.get("name", "Unnamed"),
            "category": category,
            "subcategory": subcategory,
            "tags": tags,
            "source": "openstreetmap",
        },
    }


def execute_overpass(query: str, retries: int = 3, backoff: int = 10) -> Dict:
    for attempt in range(1, retries + 1):
        try:
            log(f"⏱️ Overpass request attempt {attempt}/{retries}")
            stop_heartbeat = heartbeat("⌛ Waiting for Overpass response")
            response = requests.post(
                OVERPASS_URL,
                data={"data": query},
                headers={"User-Agent": USER_AGENT},
                timeout=120,
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
            feature = node_to_feature(site_key, element)
        elif element_type == "way":
            feature = way_to_feature(site_key, element, node_lookup)

        if feature:
            features.append(feature)

    return features


def summarize_categories(features: List[Dict]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for feature in features:
        category = feature.get("properties", {}).get("category", "other")
        counts[category] = counts.get(category, 0) + 1
    return counts


def fetch_site_data(site: Dict) -> Dict:
    log(f"🧭 Building Overpass query for {site['name']} (radius {site['radius_m']}m)")
    query = build_query(site["lat"], site["lon"], site["radius_m"])
    raw_data = execute_overpass(query)
    log(f"📦 Processing Overpass payload for {site['key']}")
    features = build_features(site["key"], raw_data)
    if not features:
        log("⚠️ No features returned for this site; Overpass may have truncated the response.")

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
    filename = f"ok_data_center_{site['key']}.json"
    filepath = OUTPUT_DIR / filename
    with filepath.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return filepath


def main() -> None:
    ensure_output_dir(OUTPUT_DIR)

    for site in SITES:
        log(f"🔍 Fetching OSM infrastructure for {site['name']} ({site['key']})")
        payload = fetch_site_data(site)
        output_file = write_site_file(site, payload)
        log(
            f"💾 Saved {payload['summary']['feature_count']} features "
            f"to {output_file.relative_to(PROJECT_ROOT)} (categories: {payload['summary']['categories']})"
        )
        log("⏳ Waiting 2s before next site to avoid rate limits...")
        time.sleep(2)

    log("🎉 Oklahoma data center power & utility caches refreshed.")


if __name__ == "__main__":
    main()

