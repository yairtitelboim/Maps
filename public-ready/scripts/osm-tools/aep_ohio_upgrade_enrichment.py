#!/usr/bin/env python3
"""
Enrich AEP Ohio transmission upgrades (from PJM XML) with:
  - Approximate coordinates (lat/lng) using OSM substations
  - Distance to Columbus city center
  - Voltage band buckets
  - Normalized status buckets

Inputs:
  - data/pjm/processed/aep_ohio_transmission_upgrades.json
  - public/osm/aep_ohio_substations.json

Outputs:
  - data/pjm/processed/aep_ohio_transmission_upgrades_enriched.json
  - public/data/aep_ohio_transmission_upgrades_points.geojson

Run from repo root:

  python scripts/osm-tools/aep_ohio_upgrade_enrichment.py
"""

from __future__ import annotations

import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import difflib


PROJECT_ROOT = Path(__file__).resolve().parents[2]

PJM_INPUT = PROJECT_ROOT / "data" / "pjm" / "processed" / "aep_ohio_transmission_upgrades.json"
ENRICHED_OUTPUT = PROJECT_ROOT / "data" / "pjm" / "processed" / "aep_ohio_transmission_upgrades_enriched.json"
POINTS_GEOJSON_OUTPUT = PROJECT_ROOT / "public" / "data" / "aep_ohio_transmission_upgrades_points.geojson"

SUBSTATIONS_FILE = PROJECT_ROOT / "public" / "osm" / "aep_ohio_substations.json"


COLUMBUS_CENTER = (39.9612, -82.9988)  # lat, lng


def log(msg: str) -> None:
  ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
  print(f"[{ts}] {msg}", flush=True)


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
  """Great-circle distance in km."""
  R = 6371.0
  phi1 = math.radians(lat1)
  phi2 = math.radians(lat2)
  dphi = math.radians(lat2 - lat1)
  dlambda = math.radians(lon2 - lon1)
  a = (
      math.sin(dphi / 2) ** 2
      + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
  )
  c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
  return R * c


def normalize_name(name: str) -> str:
  """Lowercase, strip 'substation'/'station', punctuation and extra spaces."""
  if not name:
    return ""
  n = name.lower()
  # Remove common suffixes
  n = re.sub(r"\b(substation|station)\b", "", n)
  # Remove KV markers & quotes
  n = re.sub(r"\b\d+\s*k?v\b", "", n)
  n = re.sub(r"[^\w\s-]", " ", n)
  n = re.sub(r"\s+", " ", n)
  return n.strip()


def load_substations() -> Tuple[List[Dict[str, Any]], List[str]]:
  if not SUBSTATIONS_FILE.exists():
    raise FileNotFoundError(f"Substations file not found: {SUBSTATIONS_FILE}")

  with SUBSTATIONS_FILE.open("r", encoding="utf-8") as f:
    data = json.load(f)

  features = data.get("features", [])
  indexed: List[Dict[str, Any]] = []
  names: List[str] = []

  for feat in features:
    props = feat.get("properties", {}) or {}
    geom = feat.get("geometry", {}) or {}

    raw_name = props.get("name") or ""
    norm = normalize_name(raw_name)
    if not norm or norm == "unnamed":
      continue

    coords_raw = geom.get("coordinates")
    if not coords_raw:
      continue

    # Normalize geometry to a representative point (centroid-ish)
    coords_list: List[Tuple[float, float]] = []
    gtype = geom.get("type")

    if gtype == "Point":
      if len(coords_raw) >= 2:
        coords_list.append((float(coords_raw[0]), float(coords_raw[1])))
    else:
      # Flatten nested coordinate arrays for LineString / Polygon / Multi*
      def _flatten(obj):
        if isinstance(obj, (list, tuple)):
          if len(obj) == 2 and all(isinstance(v, (int, float)) for v in obj):
            coords_list.append((float(obj[0]), float(obj[1])))
          else:
            for item in obj:
              _flatten(item)

      _flatten(coords_raw)

    if not coords_list:
      continue

    avg_lon = sum(c[0] for c in coords_list) / len(coords_list)
    avg_lat = sum(c[1] for c in coords_list) / len(coords_list)

    entry = {
        "raw_name": raw_name,
        "norm_name": norm,
        "lon": avg_lon,
        "lat": avg_lat,
        "osm_id": props.get("osm_id"),
        "properties": props,
    }
    indexed.append(entry)
    names.append(norm)

  log(f"Loaded {len(indexed)} substations with usable names")
  return indexed, names


def extract_candidate_names(location: str, description: str) -> List[str]:
  candidates: List[str] = []

  for text in (location or "", description or ""):
    if not text:
      continue
    # Split on separators commonly used between station names
    parts = re.split(r"[–\-_/]", text)
    for part in parts:
      cleaned = normalize_name(part)
      if cleaned and cleaned not in candidates:
        candidates.append(cleaned)

    # Look for "X Substation" or "at X"
    m = re.findall(r"([\w\s\-]+)\s+(Substation|Station)", text, flags=re.IGNORECASE)
    for name_part, _ in m:
      cleaned = normalize_name(name_part)
      if cleaned and cleaned not in candidates:
        candidates.append(cleaned)

  return candidates


def match_substations(
    candidates: List[str],
    substation_index: List[Dict[str, Any]],
    norm_names: List[str],
    max_matches: int = 2,
) -> Tuple[List[Dict[str, Any]], str]:
  """
  Return up to max_matches substations and a rough confidence bucket.
  """
  if not candidates:
    return [], "none"

  best_matches: List[Dict[str, Any]] = []
  confidence = "low"

  for cand in candidates:
    if not cand:
      continue

    # Exact match on normalized name
    for entry in substation_index:
      if entry["norm_name"] == cand:
        best_matches.append(entry)
        confidence = "high"
        if len(best_matches) >= max_matches:
          return best_matches, confidence

    # Fuzzy match on normalized names
    close = difflib.get_close_matches(cand, norm_names, n=max_matches, cutoff=0.8)
    for norm in close:
      for entry in substation_index:
        if entry["norm_name"] == norm and entry not in best_matches:
          best_matches.append(entry)
          confidence = "medium"
          if len(best_matches) >= max_matches:
            return best_matches, confidence

  # De-duplicate
  seen = set()
  unique_matches: List[Dict[str, Any]] = []
  for m in best_matches:
    key = (m["lat"], m["lon"], m["raw_name"])
    if key not in seen:
      seen.add(key)
      unique_matches.append(m)

  if unique_matches and confidence == "low":
    confidence = "medium"

  return unique_matches[:max_matches], confidence if unique_matches else "none"


def classify_voltage_band(voltage_str: str) -> str:
  if not voltage_str:
    return "unknown"
  nums = re.findall(r"\d+", voltage_str)
  if not nums:
    return "unknown"
  # Take the highest voltage mentioned
  kv = max(int(n) for n in nums)
  if kv >= 500:
    return "UHV_500_765"
  if kv >= 345:
    return "EHV_345"
  if kv >= 115:
    return "HV_115_138"
  return "MV_LV_other"


def classify_status_bucket(status: str) -> str:
  s = (status or "").strip().lower()
  if not s:
    return "unknown"
  if s == "is" or "in service" in s or "partially in service" in s:
    return "proceeded"
  if any(k in s for k in ["cancelled", "canceled", "withdrawn", "on hold"]):
    return "stalled"
  if any(k in s for k in ["planning", "engineering", "procurement", "construction", "active"]):
    return "active_or_planning"
  return "other"


def enrich() -> None:
  log("Starting AEP Ohio upgrade enrichment")

  if not PJM_INPUT.exists():
    raise FileNotFoundError(f"PJM upgrades file not found: {PJM_INPUT}")

  with PJM_INPUT.open("r", encoding="utf-8") as f:
    base_data = json.load(f)

  upgrades = base_data.get("upgrades", [])
  metadata = {k: v for k, v in base_data.items() if k != "upgrades"}

  substation_index, norm_names = load_substations()

  enriched_upgrades: List[Dict[str, Any]] = []
  matched_count = 0
  matched_dual = 0

  for upgrade in upgrades:
    location = upgrade.get("location") or ""
    description = upgrade.get("description") or ""
    candidates = extract_candidate_names(location, description)

    matches, confidence = match_substations(candidates, substation_index, norm_names)

    lat: Optional[float] = None
    lng: Optional[float] = None
    matched_names: List[str] = []
    matched_ids: List[Any] = []

    if matches:
      matched_count += 1
      if len(matches) >= 2:
        matched_dual += 1
      # Single or dual: take average position
      lat = sum(m["lat"] for m in matches) / len(matches)
      lng = sum(m["lon"] for m in matches) / len(matches)
      matched_names = [m["raw_name"] for m in matches]
      matched_ids = [m["osm_id"] for m in matches]

    dist_km: Optional[float] = None
    if lat is not None and lng is not None:
      dist_km = haversine_distance_km(lat, lng, COLUMBUS_CENTER[0], COLUMBUS_CENTER[1])

    voltage_band = classify_voltage_band(upgrade.get("voltage") or "")
    status_bucket = classify_status_bucket(upgrade.get("status") or "")

    enriched = dict(upgrade)
    if lat is not None and lng is not None:
      enriched["lat"] = lat
      enriched["lng"] = lng
      enriched["coordinates"] = {"lat": lat, "lon": lng}
      enriched["distance_to_columbus_center_km"] = round(dist_km or 0.0, 2)
      enriched["is_near_columbus_10mi"] = (dist_km is not None and dist_km <= 16.0934)
    else:
      enriched["lat"] = None
      enriched["lng"] = None
      enriched["coordinates"] = None
      enriched["distance_to_columbus_center_km"] = None
      enriched["is_near_columbus_10mi"] = None

    enriched["voltage_band"] = voltage_band
    enriched["status_bucket"] = status_bucket
    enriched["matched_substations"] = matched_names
    enriched["matched_substation_ids"] = matched_ids
    enriched["match_confidence"] = confidence

    enriched_upgrades.append(enriched)

  log(f"Total upgrades: {len(upgrades)}")
  log(f"Upgrades with at least one matched substation: {matched_count}")
  log(f"Upgrades matched to two substations (line-style locations): {matched_dual}")

  enriched_data = {
      **metadata,
      "enriched_at": datetime.now(timezone.utc).isoformat(),
      "upgrades": enriched_upgrades,
  }

  ENRICHED_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
  with ENRICHED_OUTPUT.open("w", encoding="utf-8") as f:
    json.dump(enriched_data, f, indent=2)
  log(f"Wrote enriched upgrades to {ENRICHED_OUTPUT}")

  # GeoJSON points for mapping
  features: List[Dict[str, Any]] = []
  for u in enriched_upgrades:
    lat = u.get("lat")
    lng = u.get("lng")
    if lat is None or lng is None:
      continue
    feat = {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lng, lat]},
        "properties": {k: v for k, v in u.items() if k not in ("lat", "lng", "coordinates")},
    }
    features.append(feat)

  geojson = {
      "type": "FeatureCollection",
      "metadata": {
          "generated_at": datetime.now(timezone.utc).isoformat(),
          "feature_count": len(features),
      },
      "features": features,
  }

  POINTS_GEOJSON_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
  with POINTS_GEOJSON_OUTPUT.open("w", encoding="utf-8") as f:
    json.dump(geojson, f, indent=2)
  log(f"Wrote GeoJSON points to {POINTS_GEOJSON_OUTPUT}")


if __name__ == "__main__":
  enrich()


