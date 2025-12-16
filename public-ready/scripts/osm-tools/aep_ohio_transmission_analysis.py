#!/usr/bin/env python3
"""
AEP Ohio Transmission Infrastructure Analysis.

Compares existing transmission infrastructure (OSM) with planned upgrades
(PJM filings) to identify which projects proceeded vs stalled after tariff.

This script expects PJM filing data in a specific format.
See the data schema documentation for required fields.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[2]
INPUT_DIR = PROJECT_ROOT / "public" / "osm"
PUBLIC_DATA_DIR = PROJECT_ROOT / "public" / "data"
PRIVATE_DATA_DIR = PROJECT_ROOT / "data"
OUTPUT_DIR = PUBLIC_DATA_DIR

# Expected input file paths
# Primary planned-upgrades source: parsed PJM XML feed
PJM_UPGRADES_FILE = (
    PRIVATE_DATA_DIR
    / "pjm"
    / "processed"
    / "aep_ohio_transmission_upgrades.json"
)
INTERCONNECTION_ANALYSIS_FILE = PUBLIC_DATA_DIR / "aep_ohio_interconnection_analysis.json"


def log(message: str) -> None:
    """Emit a timestamped log line."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"[{timestamp}] {message}", flush=True)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great circle distance between two points in meters."""
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2) ** 2 +
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def upgrade_exists_in_osm(
    planned_upgrade: Dict,
    existing_infrastructure: Dict,
    tolerance_m: float = 1000  # 1km tolerance for matching
) -> bool:
    """
    Check if a planned upgrade exists in OSM data.
    
    Args:
        planned_upgrade: Planned upgrade dictionary
        existing_infrastructure: Existing infrastructure from OSM
        tolerance_m: Distance tolerance in meters for matching
    
    Returns:
        True if upgrade appears to have been built
    """
    upgrade_coords = planned_upgrade.get("coordinates", {})
    upgrade_lat = upgrade_coords.get("lat")
    upgrade_lon = upgrade_coords.get("lon")
    
    if upgrade_lat is None or upgrade_lon is None:
        return False
    
    # Check substations
    substations = existing_infrastructure.get("substations", {}).get("features", [])
    for substation in substations:
        geometry = substation.get("geometry", {})
        if geometry.get("type") == "Point":
            coords = geometry.get("coordinates", [])
            if len(coords) >= 2:
                sub_lon, sub_lat = coords[0], coords[1]
                distance = haversine_distance(upgrade_lat, upgrade_lon, sub_lat, sub_lon)
                if distance <= tolerance_m:
                    # Check if properties match
                    props = substation.get("properties", {})
                    if planned_upgrade.get("type") == "substation":
                        return True
    
    # Check transmission lines (more complex - would need to check line segments)
    # For now, simplified check
    transmission_lines = existing_infrastructure.get("transmission_lines", {}).get("features", [])
    for line in transmission_lines:
        geometry = line.get("geometry", {})
        if geometry.get("type") == "LineString":
            coords = geometry.get("coordinates", [])
            # Check if upgrade coordinates are near any point on the line
            for coord in coords:
                if len(coord) >= 2:
                    line_lon, line_lat = coord[0], coord[1]
                    distance = haversine_distance(upgrade_lat, upgrade_lon, line_lat, line_lon)
                    if distance <= tolerance_m:
                        if planned_upgrade.get("type") == "transmission_line":
                            return True
    
    return False


def correlate_with_interconnection_sites(
    planned_upgrades: List[Dict],
    interconnection_requests: List[Dict],
    proximity_m: float = 5000  # 5km proximity
) -> Dict:
    """
    Correlate planned upgrades with interconnection request sites.
    
    Returns:
        Dictionary with correlation statistics
    """
    upgrades_near_sites = 0
    stalled_after_tariff = 0
    
    for upgrade in planned_upgrades:
        upgrade_coords = upgrade.get("coordinates", {})
        upgrade_lat = upgrade_coords.get("lat")
        upgrade_lon = upgrade_coords.get("lon")
        
        if upgrade_lat is None or upgrade_lon is None:
            continue
        
        # Check if upgrade is near any interconnection request site
        for request in interconnection_requests:
            req_coords = request.get("coordinates", {})
            req_lat = req_coords.get("lat")
            req_lon = req_coords.get("lon")
            
            if req_lat is None or req_lon is None:
                continue
            
            distance = haversine_distance(upgrade_lat, upgrade_lon, req_lat, req_lon)
            if distance <= proximity_m:
                upgrades_near_sites += 1
                
                # Check if upgrade was stalled and request was withdrawn
                if (upgrade.get("status") in ["cancelled", "delayed", "stalled"] and
                    not request.get("survived_tariff", True)):
                    stalled_after_tariff += 1
                break
    
    return {
        "upgrades_near_interconnection_sites": upgrades_near_sites,
        "stalled_after_tariff": stalled_after_tariff
    }


def analyze_transmission_plans(
    existing_infrastructure: Dict,
    planned_upgrades: List[Dict],
    interconnection_requests: List[Dict],
) -> Dict:
    """
    Compare existing vs planned infrastructure.
    
    Returns:
        Analysis dictionary with proceeded, stalled, and in-progress projects
    """
    proceeded: List[Dict] = []
    stalled: List[Dict] = []
    in_progress: List[Dict] = []
    
    for upgrade in planned_upgrades:
        raw_status = (upgrade.get("status") or "").strip()
        status = raw_status.lower()

        # PJM XML uses short codes like "IS" – normalise a few key buckets
        is_proceeded = (
            status == "is"
            or "in service" in status
            or "partially in service" in status
        )
        is_stalled = any(
            key in status
            for key in ["cancelled", "canceled", "withdrawn", "on hold"]
        )
        is_active_or_planning = any(
            key in status
            for key in [
                "active",
                "planning",
                "engineering",
                "procurement",
                "under construction",
            ]
        )

        # Prefer explicit PJM status buckets; fall back to spatial check if we ever
        # add approximate coordinates for upgrades.
        if is_proceeded:
            proceeded.append(upgrade)
        elif is_stalled:
            stalled.append(upgrade)
        elif is_active_or_planning:
            in_progress.append(upgrade)
        else:
            # Unknown textual status – try to infer from OSM presence.
            if upgrade_exists_in_osm(upgrade, existing_infrastructure):
                proceeded.append(upgrade)
            else:
                in_progress.append(upgrade)
    
    # Correlate with interconnection requests
    correlation = correlate_with_interconnection_sites(
        planned_upgrades,
        interconnection_requests
    )
    
    return {
        "existing": existing_infrastructure,
        "planned": {
            "upgrades": planned_upgrades,
            "new_lines": [u for u in planned_upgrades if u.get("type") == "transmission_line"],
            "substation_upgrades": [u for u in planned_upgrades if u.get("type") == "substation"]
        },
        "status": {
            "proceeded": proceeded,
            "stalled": stalled,
            "in_progress": in_progress,
            "proceeded_count": len(proceeded),
            "stalled_count": len(stalled),
            "in_progress_count": len(in_progress)
        },
        "correlation": correlation
    }


def load_pjm_upgrades() -> List[Dict]:
    """Load planned transmission upgrades from the processed PJM XML feed."""
    if not PJM_UPGRADES_FILE.exists():
        log(f"⚠️ PJM upgrades file not found: {PJM_UPGRADES_FILE}")
        log("💡 Run scripts/pjm/aep_ohio_transmission_upgrades_from_xml.py first.")
        return []
    
    log(f"📂 Loading PJM upgrades from {PJM_UPGRADES_FILE}")
    with PJM_UPGRADES_FILE.open("r", encoding="utf-8") as f:
        data = json.load(f)
        if isinstance(data, dict) and "upgrades" in data:
            return data["upgrades"]
    return []


def main() -> None:
    """Main execution function."""
    log("🚀 Starting AEP Ohio transmission infrastructure analysis")
    
    # Load existing infrastructure
    substations_file = INPUT_DIR / "aep_ohio_substations.json"
    transmission_file = INPUT_DIR / "aep_ohio_transmission_lines.json"
    
    existing_infrastructure = {
        "substations": {},
        "transmission_lines": {}
    }
    
    if substations_file.exists():
        log(f"📂 Loading substations from {substations_file}")
        with substations_file.open("r", encoding="utf-8") as f:
            existing_infrastructure["substations"] = json.load(f)
        log(f"✅ Loaded {len(existing_infrastructure['substations'].get('features', []))} substations")
    else:
        log(f"⚠️ Substations file not found: {substations_file}")
    
    if transmission_file.exists():
        log(f"📂 Loading transmission lines from {transmission_file}")
        with transmission_file.open("r", encoding="utf-8") as f:
            existing_infrastructure["transmission_lines"] = json.load(f)
        log(f"✅ Loaded {len(existing_infrastructure['transmission_lines'].get('features', []))} transmission lines")
    else:
        log(f"⚠️ Transmission lines file not found: {transmission_file}")
    
    # Load planned upgrades (PJM XML-derived feed)
    planned_upgrades = load_pjm_upgrades()
    
    if not planned_upgrades:
        log("❌ No PJM filing data found. Cannot proceed with analysis.")
        log("💡 Please create the PJM filings file (see documentation)")
        return
    
    log(f"✅ Loaded {len(planned_upgrades)} planned upgrades")
    
    # Load interconnection requests for correlation
    interconnection_requests = []
    if INTERCONNECTION_ANALYSIS_FILE.exists():
        log(f"📂 Loading interconnection requests from {INTERCONNECTION_ANALYSIS_FILE}")
        with INTERCONNECTION_ANALYSIS_FILE.open("r", encoding="utf-8") as f:
            analysis_data = json.load(f)
            interconnection_requests = analysis_data.get("interconnection_requests", [])
        log(f"✅ Loaded {len(interconnection_requests)} interconnection requests")
    
    # Perform analysis
    log("\n🔍 Analyzing transmission plans...")
    analysis = analyze_transmission_plans(
        existing_infrastructure,
        planned_upgrades,
        interconnection_requests
    )
    
    # Create output
    output_data = {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "planned_upgrades_count": len(planned_upgrades),
            "existing_substations_count": len(existing_infrastructure["substations"].get("features", [])),
            "existing_transmission_lines_count": len(existing_infrastructure["transmission_lines"].get("features", []))
        },
        **analysis
    }
    
    # Write output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUT_DIR / "aep_ohio_transmission_analysis.json"
    with output_file.open("w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
    
    # Write stalled projects separately
    stalled_file = OUTPUT_DIR / "aep_ohio_stalled_projects.json"
    stalled_data = {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "stalled_count": len(analysis["status"]["stalled"])
        },
        "stalled_projects": analysis["status"]["stalled"]
    }
    with stalled_file.open("w", encoding="utf-8") as f:
        json.dump(stalled_data, f, indent=2)
    
    log(f"\n💾 Saved transmission analysis to {output_file.relative_to(PROJECT_ROOT)}")
    log(f"💾 Saved stalled projects to {stalled_file.relative_to(PROJECT_ROOT)}")
    log("\n📊 Analysis Summary:")
    log(f"   Planned Upgrades: {len(planned_upgrades)}")
    log(f"   - Proceeded: {analysis['status']['proceeded_count']}")
    log(f"   - Stalled: {analysis['status']['stalled_count']}")
    log(f"   - In Progress: {analysis['status']['in_progress_count']}")
    log(f"   Upgrades near interconnection sites: {analysis['correlation']['upgrades_near_interconnection_sites']}")
    log(f"   Stalled after tariff: {analysis['correlation']['stalled_after_tariff']}")
    log("\n🎉 Transmission analysis complete!")


if __name__ == "__main__":
    main()

