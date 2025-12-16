"""
Parse PJM Project Status & Cost Allocation XML and emit
AEP Ohio-focused transmission upgrade JSON for the Columbus map.

Input:
  data/pjm/raw/projectCostUpgrades.xml  (downloaded from:
    https://www.pjm.com/pjmfiles/media/planning/projectConstruction-data/projectCostUpgrades.xml)

Output:
  data/pjm/processed/aep_ohio_transmission_upgrades.json

Filtering logic:
  - TransmissionOwner == "AEP"
  - State == "OH"

Fields we keep (per row):
  - upgrade_id
  - description
  - project_type
  - voltage
  - transmission_owner
  - state
  - location
  - equipment
  - status
  - driver
  - cost_estimate_millions
  - required_date
  - projected_in_service_date
  - actual_in_service_date
  - immediate_need (bool)
  - initial_teac_date
  - latest_teac_date
  - percent_complete

This script is deliberately simple and dependency-light (only stdlib)
so it can be run as:

  cd /Users/yairtitelboim/Documents/Kernel/ALLAPPS/OH
  python scripts/pjm/aep_ohio_transmission_upgrades_from_xml.py
"""

import json
import os
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Any, Dict, List, Optional


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW_XML_PATH = os.path.join(REPO_ROOT, "data", "pjm", "raw", "projectCostUpgrades.xml")
OUTPUT_JSON_PATH = os.path.join(REPO_ROOT, "data", "pjm", "processed", "aep_ohio_transmission_upgrades.json")


def _text(elem: Optional[ET.Element]) -> str:
    """Return trimmed text from an XML element, or empty string."""
    if elem is None or elem.text is None:
        return ""
    return elem.text.strip()


def _parse_bool(value: str) -> Optional[bool]:
    if not value:
        return None
    lower = value.strip().lower()
    if lower in ("true", "t", "yes", "y", "1"):
        return True
    if lower in ("false", "f", "no", "n", "0"):
        return False
    return None


def _parse_float(value: str) -> Optional[float]:
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _parse_date(value: str) -> Optional[str]:
    """
    Normalize dates to ISO 8601 (YYYY-MM-DD) when possible.
    PJM XML uses formats like '5/9/2005'. We keep original if parsing fails.
    """
    if not value:
        return None

    value = value.strip()
    for fmt in ("%m/%d/%Y", "%m/%d/%y"):
        try:
            dt = datetime.strptime(value, fmt)
            return dt.date().isoformat()
        except ValueError:
            continue

    # Fallback: return original string
    return value


def load_and_filter_upgrades(xml_path: str) -> List[Dict[str, Any]]:
    if not os.path.exists(xml_path):
        raise FileNotFoundError(f"XML file not found: {xml_path}")

    tree = ET.parse(xml_path)
    root = tree.getroot()

    results: List[Dict[str, Any]] = []

    for upgrade in root.findall("Upgrade"):
        transmission_owner = _text(upgrade.find("TransmissionOwner"))
        state = _text(upgrade.find("State"))

        # Filter: AEP in Ohio only
        if transmission_owner != "AEP" or state != "OH":
            continue

        row: Dict[str, Any] = {
            "upgrade_id": _text(upgrade.find("UpgradeId")),
            "description": _text(upgrade.find("Description")),
            "project_type": _text(upgrade.find("ProjectType")),
            "voltage": _text(upgrade.find("Voltage")),
            "transmission_owner": transmission_owner,
            "state": state,
            "location": _text(upgrade.find("Location")),
            "equipment": _text(upgrade.find("Equipment")),
            "status": _text(upgrade.find("Status")),
            "driver": _text(upgrade.find("Driver")),
            "cost_estimate_millions": _parse_float(_text(upgrade.find("CostEstimate"))),
            "required_date": _parse_date(_text(upgrade.find("RequiredDate"))),
            "projected_in_service_date": _parse_date(_text(upgrade.find("ProjectedInServiceDate"))),
            "actual_in_service_date": _parse_date(_text(upgrade.find("ActualInServiceDate"))),
            "immediate_need": _parse_bool(_text(upgrade.find("ImmediateNeed"))),
            "initial_teac_date": _parse_date(_text(upgrade.find("InitialTEACDate"))),
            "latest_teac_date": _parse_date(_text(upgrade.find("LatestTEACDate"))),
            "percent_complete": _parse_float(_text(upgrade.find("PercentComplete"))),
        }

        results.append(row)

    return results


def main() -> int:
    print(f"📥 Reading PJM upgrades XML from: {RAW_XML_PATH}")
    upgrades = load_and_filter_upgrades(RAW_XML_PATH)
    print(f"✅ Found {len(upgrades)} AEP Ohio upgrade rows")

    os.makedirs(os.path.dirname(OUTPUT_JSON_PATH), exist_ok=True)

    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {
                "source": "pjm_project_construction_xml",
                "transmission_owner": "AEP",
                "state": "OH",
                "generated_at": datetime.utcnow().isoformat() + "Z",
                "upgrades": upgrades,
            },
            f,
            indent=2,
        )

    print(f"💾 Wrote AEP Ohio upgrades JSON to: {OUTPUT_JSON_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())



