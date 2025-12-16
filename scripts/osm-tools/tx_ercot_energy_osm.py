#!/usr/bin/env python3
"""
Download statewide ERCOT power + gas infrastructure from OSM (Overpass) and
write a single GeoJSON FeatureCollection suitable for Mapbox layers.

Inspired by the Whitney / Thad Hill energy stack described in:
  docs/ENERGY_INFRA_OSM_MAPBOX_README.md

Key ideas:
  - Query high‑voltage power lines + plants/substations.
  - Query gas transmission pipelines.
  - Classify each feature into infra_type = "power" or "gas".
  - Output clean GeoJSON to: public/osm/tx_ercot_energy.json

This script is designed to be:
  - Chatty (logs progress + health checks)
  - Safe to re‑run (overwrites output file)
"""

from __future__ import annotations

import json
import math
import signal
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import Event, Thread
from typing import Dict, List, Tuple, Any

import requests


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = PROJECT_ROOT / "public" / "osm"
OUTPUT_PATH = OUTPUT_DIR / "tx_ercot_energy.json"

OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"
USER_AGENT = "tx-ercot-energy-osm/1.0 (energy-infra-map)"


def log(message: str) -> None:
    """Emit a timestamped log line (UTC) and flush immediately."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"[{ts}] {message}", flush=True)


def handle_sigint(signum, frame):
    log("⚠️  Received interrupt signal; stopping gracefully.")
    sys.exit(1)


signal.signal(signal.SIGINT, handle_sigint)


def heartbeat(message: str, interval: int = 10):
    """
    Emit a log message every `interval` seconds until the returned stop()
    function is called. Useful for long-running Overpass queries.
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


# --- ERCOT-ish bounding boxes -------------------------------------------------

@dataclass
class BBox:
    name: str
    min_lat: float
    min_lon: float
    max_lat: float
    max_lon: float

    @property
    def as_string(self) -> str:
        # Overpass: south,west,north,east
        return f"{self.min_lat},{self.min_lon},{self.max_lat},{self.max_lon}"


# Rough coverage of most ERCOT counties (not exact, but good enough for infra)
# Expanded southward to cover Rio Grande Valley and more of southern Texas
# Expanded northward to cover more of northern Texas including Panhandle region
ERCOT_BBOXES: List[BBox] = [
    BBox("central_tx", 25.5, -103.5, 36.0, -94.5),
    # Optional: you can split further if Overpass timeout becomes an issue.
]


# --- Classification helpers ----------------------------------------------------

def classify_infra_type(tags: Dict[str, str]) -> str:
    """
    Decide infra_type = 'power' or 'gas' based on OSM tags.

    Mirrors the logic from the Whitney README:
      - Power: power=* or clearly power-related.
      - Gas: pipeline/substance/product tags including 'gas', 'natural_gas', etc.
      - If it's a pipeline (man_made=pipeline or pipeline tag) and not power,
        default to 'gas', skipping explicit oil pipelines.
    """
    if not tags:
        return ""

    # Power markers - check first
    if "power" in tags:
        return "power"

    # Check if it's a pipeline
    is_pipeline = (
        tags.get("man_made") == "pipeline"
        or "pipeline" in tags
    )

    if is_pipeline:
        pipeline_val = (tags.get("pipeline") or "").lower()
        substance_val = (tags.get("substance") or "").lower()
        product_val = (tags.get("product") or "").lower()
        usage_val = (tags.get("usage") or "").lower()

        gas_keywords = ("gas", "natural_gas", "lng", "cng", "methane")
        oil_keywords = ("oil", "petroleum", "crude")

        # If explicitly oil, skip
        if any(k in pipeline_val for k in oil_keywords) or any(
            k in substance_val for k in oil_keywords
        ) or any(k in product_val for k in oil_keywords):
            return ""

        # Explicit gas → gas
        if any(k in pipeline_val for k in gas_keywords) or any(
            k in substance_val for k in gas_keywords
        ) or any(k in product_val for k in gas_keywords) or any(
            k in usage_val for k in gas_keywords
        ):
            return "gas"

        # Default: generic pipeline → gas
        return "gas"

    return ""


def extract_voltage_kv(tags: Dict[str, str]) -> float | None:
    """
    Try to normalize voltage to kV. If 'voltage_kv' is present, use that.
    Else parse 'voltage' in volts and convert.
    """
    if not tags:
        return None

    if "voltage_kv" in tags:
        try:
            return float(str(tags["voltage_kv"]).split(";")[0])
        except ValueError:
            return None

    if "voltage" in tags:
        raw = str(tags["voltage"]).split(";")[0]
        try:
            v = float(raw)
            if v > 1000:
                return round(v / 1000.0, 1)
            return v  # already kV-ish
        except ValueError:
            return None
    return None


# --- Overpass query helpers ----------------------------------------------------

def build_overpass_query(bbox: BBox) -> str:
    """
    Compose an Overpass query focused on:
      - High‑voltage power lines and related infrastructure.
      - Gas pipelines (transmission).
    """
    b = bbox.as_string
    query = f"""
    [out:json][timeout:300];
    (
      // Power transmission lines + cables (ways + relations)
      way["power"~"line|minor_line|cable"]({b});
      relation["power"~"line|minor_line|cable"]({b});

      // Power plants / substations / generators / transformers (nodes/ways/relations)
      node["power"~"plant|substation|generator|transformer"]({b});
      way["power"~"plant|substation|generator|transformer"]({b});
      relation["power"~"plant|substation|generator|transformer"]({b});

      // Pipelines (man_made or pipeline tag) - may include gas
      way["man_made"="pipeline"]({b});
      relation["man_made"="pipeline"]({b});
      way["pipeline"]({b});
      relation["pipeline"]({b});
    );
    out body;
    >;
    out skel qt;
    """
    return query


def call_overpass(query: str) -> Dict[str, Any]:
    headers = {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded"
    }
    log("📡 Sending Overpass request...")
    hb_stop = heartbeat("⌛ Waiting for Overpass response", interval=10)
    try:
        response = requests.post(OVERPASS_URL, data=query.encode("utf-8"), headers=headers, timeout=300)
        hb_stop()
    except requests.exceptions.RequestException as e:
        hb_stop()
        log(f"❌ Overpass request failed: {e}")
        raise

    if not response.ok:
        log(f"❌ Overpass HTTP error: {response.status_code} {response.text[:200]}")
        response.raise_for_status()

    log("✅ Overpass response received")
    return response.json()


# --- OSM → GeoJSON conversion --------------------------------------------------

def osm_to_geojson(osm_data: Dict[str, Any], bbox_name: str) -> List[Dict[str, Any]]:
    """
    Convert Overpass OSM JSON to GeoJSON Features, classifying infra_type
    and extracting voltage_kv where possible.
    """
    elements = osm_data.get("elements", [])
    nodes: Dict[int, Tuple[float, float]] = {}
    features: List[Dict[str, Any]] = []

    # First pass: collect nodes
    for el in elements:
        if el.get("type") == "node":
            nid = el.get("id")
            lat = el.get("lat")
            lon = el.get("lon")
            if nid is not None and lat is not None and lon is not None:
                nodes[nid] = (lon, lat)

    # Second pass: build features for ways and relations + important nodes
    for el in elements:
        el_type = el.get("type")
        el_id = el.get("id")
        tags = el.get("tags", {}) or {}

        # Classify infra type
        infra_type = classify_infra_type(tags)

        # For power=* we may treat it as power infra even if classify_infra_type returns ""
        if not infra_type and "power" in tags:
            infra_type = "power"

        if not infra_type:
            # Skip elements that are neither power nor gas
            continue

        # Extract voltage_kv if available
        voltage_kv = extract_voltage_kv(tags)

        if el_type == "way":
            nds = el.get("nodes") or []
            coords = []
            for nid in nds:
                if nid in nodes:
                    coords.append(nodes[nid])
            if len(coords) < 2:
                continue
            geom = {"type": "LineString", "coordinates": coords}
        elif el_type == "relation":
            # For simplicity: approximate relations by stitching member ways if available
            # or skipping if complex. For statewide overview, this is acceptable.
            members = el.get("members") or []
            line_coords: List[Tuple[float, float]] = []
            for m in members:
                if m.get("type") != "way":
                    continue
                way_ref = m.get("ref")
                # Overpass output includes way elements; we could look them up again,
                # but for now we rely on separate way entries to represent geometry.
                # Skip relation geometry if not directly provided.
            # No explicit geometry for relation; skip to avoid complex reconstruction.
            continue
        elif el_type == "node":
            # Only keep power nodes (plants/substations/etc.)
            if "power" not in tags:
                continue
            lat = el.get("lat")
            lon = el.get("lon")
            if lat is None or lon is None:
                continue
            geom = {"type": "Point", "coordinates": [lon, lat]}
        else:
            continue

        props = {
            "osm_id": el_id,
            "osm_type": el_type,
            "infra_type": infra_type,
            "voltage_kv": voltage_kv,
            "name": tags.get("name"),
            "ref": tags.get("ref"),
            "bbox_region": bbox_name,
            "tags": tags,
        }

        features.append(
            {
                "type": "Feature",
                "geometry": geom,
                "properties": props,
            }
        )

    return features


def main():
    log("🚀 Starting TX ERCOT energy OSM extraction...")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    all_features: List[Dict[str, Any]] = []

    for bbox in ERCOT_BBOXES:
        log(f"📦 Querying Overpass for bbox: {bbox.name} ({bbox.as_string})")
        query = build_overpass_query(bbox)
        osm_json = call_overpass(query)
        features = osm_to_geojson(osm_json, bbox_name=bbox.name)
        log(f"✅ Converted {len(features)} features for region: {bbox.name}")
        all_features.extend(features)

    if not all_features:
        log("⚠️  No features extracted; not writing output.")
        return

    # Deduplicate features by (osm_id, osm_type, infra_type, geometry type)
    seen = set()
    deduped: List[Dict[str, Any]] = []
    for feat in all_features:
        props = feat.get("properties", {})
        key = (
            props.get("osm_id"),
            props.get("osm_type"),
            props.get("infra_type"),
            feat.get("geometry", {}).get("type"),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(feat)

    log(f"🧮 Total features before dedupe: {len(all_features)}")
    log(f"🧮 Total features after dedupe:  {len(deduped)}")

    collection = {
        "type": "FeatureCollection",
        "features": deduped,
    }

    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(collection, f)

    log(f"💾 Saved TX ERCOT energy GeoJSON to: {OUTPUT_PATH}")
    log("✅ Done.")


if __name__ == "__main__":
    main()


