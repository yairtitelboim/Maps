#!/usr/bin/env python3
"""
Extract GRDA capacity data directly from HTML pages using Firecrawl.

This bypasses PDF processing and extracts capacity information directly
from the website pages.
"""

import os
import json
import re
import logging
from pathlib import Path
from typing import Dict, List, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    import requests
    HAVE_REQUESTS = True
except ImportError:
    HAVE_REQUESTS = False
    logger.error("requests library required. Install with: pip install requests")

FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY") or os.environ.get("firecrawl")
FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v2"


def scrape_url(url: str) -> Dict:
    """Scrape a URL using Firecrawl."""
    if not HAVE_REQUESTS or not FIRECRAWL_API_KEY:
        return {}
    
    print(f"  → Requesting page from Firecrawl...", end=" ", flush=True)
    
    headers = {
        "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "url": url,
        "formats": ["markdown", "html"]
    }
    
    try:
        response = requests.post(
            f"{FIRECRAWL_BASE_URL}/scrape",
            headers=headers,
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        
        if not result.get("success", True):
            error = result.get("error", "Unknown error")
            print(f"✗ Error: {error}")
            logger.error(f"Firecrawl API error: {error}")
            return {}
        
        print("✓ Received")
        return result
    except requests.exceptions.RequestException as e:
        print(f"✗ Failed: {e}")
        logger.error(f"Firecrawl API request error: {e}")
        return {}


def extract_capacity_from_text(text: str) -> Dict:
    """
    Extract capacity information from text content - optimized for speed.
    
    Returns structured data matching the power_assets schema.
    """
    generating_units = []
    capacity_mix = {
        "Hydro_MW": 0,
        "Gas_MW": 0,
        "Coal_MW": 0,
        "Wind_MW": 0,
        "Thermal_MW": 0,
        "Purchase_Contracts_MW": 0
    }
    
    seen_units = set()
    
    # Multiple patterns to catch different formats
    patterns = [
        r'\*\*([^*]{5,60}(?:Dam|Plant|Project|Center|Generation|Storage|Power)[^*]{0,30}),\s*(\d+)\s*MW\*\*',
        r'([A-Z][^\n]{5,60}(?:Dam|Plant|Project|Center|Generation|Storage|Power))[^\n]*\n[^\n]*\*\*(\d+)\s*MW\*\*',
        r'([A-Z][^,\n]{5,60}(?:Dam|Plant|Project|Center|Generation|Storage|Power))[,\s]+(\d+)\s*MW',
    ]
    
    matches = []
    for pattern in patterns:
        matches.extend(re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE))
    
    for match in matches:
        name = match.group(1).strip()
        mw = int(match.group(2))
        
        # Skip duplicates
        if mw in seen_units:
            continue
        seen_units.add(mw)
        
        # Quick type detection
        name_lower = name.lower()
        if any(x in name_lower for x in ["hydro", "dam", "pumped", "storage", "salina", "pensacola", "kerr"]):
            unit_type = "Hydro"
            fuel = "Hydro"
            capacity_mix["Hydro_MW"] += mw
        elif any(x in name_lower for x in ["gas", "grec", "redbud", "combined cycle"]):
            unit_type = "Gas"
            fuel = "Gas"
            capacity_mix["Gas_MW"] += mw
        elif "coal" in name_lower:
            unit_type = "Coal"
            fuel = "Coal"
            capacity_mix["Coal_MW"] += mw
        elif "wind" in name_lower:
            unit_type = "Wind"
            fuel = "Wind"
            capacity_mix["Wind_MW"] += mw
        elif "thermal" in name_lower:
            unit_type = "Thermal"
            fuel = "Thermal"
            capacity_mix["Thermal_MW"] += mw
        else:
            unit_type = "Other"
            fuel = "Unknown"
        
        generating_units.append({
            "name": name,
            "type": unit_type,
            "net_MW": mw,
            "commissioned": None,
            "fuel": fuel
        })
    
    # Quick scan for planned additions (simplified)
    planned_additions = []
    planned_pattern = r'(\d+)\s*MW[^\n]{0,100}(?:planned|construction|expected|in service|coming online)'
    for match in re.finditer(planned_pattern, text, re.IGNORECASE):
        mw = int(match.group(1))
        if mw not in [u["net_MW"] for u in generating_units]:
            planned_additions.append({
                "name": f"New Unit",
                "MW": mw,
                "in_service": None,
                "status": "planned"
            })
    
    return {
        "generating_units": generating_units,
        "capacity_mix": {k: v for k, v in capacity_mix.items() if v > 0},
        "owned_vs_purchased": {},
        "planned_additions": planned_additions[:5],  # Limit to 5
        "planned_retirements": []
    }


def extract_capacity_from_grda_pages(urls: List[str] = None) -> Dict:
    """
    Extract capacity data from multiple GRDA pages.
    
    Args:
        urls: List of URLs to scrape (defaults to key GRDA pages)
    
    Returns:
        Aggregated capacity data
    """
    if urls is None:
        urls = [
            "https://grda.com/electricity/",
            "https://grda.com/about/",
        ]
    
    all_units = []
    all_capacity_mix = {
        "Hydro_MW": 0,
        "Gas_MW": 0,
        "Coal_MW": 0,
        "Wind_MW": 0,
        "Thermal_MW": 0,
        "Purchase_Contracts_MW": 0
    }
    all_additions = []
    all_retirements = []
    
    seen_unit_names = set()
    
    for i, url in enumerate(urls, 1):
        print(f"\n[{i}/{len(urls)}] Processing: {url}")
        result = scrape_url(url)
        
        if not result or not result.get("data"):
            print(f"  ⚠ No data received, skipping...")
            logger.warning(f"No data from {url}")
            continue
        
        print(f"  → Extracting capacity data...", end=" ", flush=True)
        data = result["data"]
        markdown = data.get("markdown", "")
        
        # Use only markdown for faster processing (HTML is large and slow)
        # Limit text size to first 50000 chars for speed
        text = markdown[:50000] if len(markdown) > 50000 else markdown
        
        extracted = extract_capacity_from_text(text)
        
        # Aggregate generating units
        units_found = 0
        for unit in extracted.get("generating_units", []):
            unit_name = unit.get("name", "")
            if unit_name and unit_name not in seen_unit_names:
                all_units.append(unit)
                seen_unit_names.add(unit_name)
                units_found += 1
        
        # Aggregate capacity mix
        for fuel_type, mw in extracted.get("capacity_mix", {}).items():
            all_capacity_mix[fuel_type] += mw
        
        # Aggregate planned additions/retirements
        all_additions.extend(extracted.get("planned_additions", []))
        all_retirements.extend(extracted.get("planned_retirements", []))
        
        total_capacity = sum(extracted.get("capacity_mix", {}).values())
        print(f"✓ Found {units_found} units, {total_capacity} MW total")
        
        # Show quick preview
        if units_found > 0:
            preview_units = extracted.get('generating_units', [])[:3]
            preview_text = ', '.join([f"{u['name']} ({u['net_MW']} MW)" for u in preview_units])
            print(f"  Preview: {preview_text}")
    
    return {
        "generating_units": all_units,
        "capacity_mix": {k: v for k, v in all_capacity_mix.items() if v > 0},
        "owned_vs_purchased": {},
        "planned_additions": all_additions,
        "planned_retirements": all_retirements,
        "sources": urls
    }


def format_capacity_answer(data: Dict) -> str:
    """Format capacity data as a readable answer."""
    answer_parts = []
    
    answer_parts.append("=" * 80)
    answer_parts.append("GRDA GENERATING CAPACITY (FROM WEBSITE)")
    answer_parts.append("=" * 80)
    answer_parts.append("")
    
    # Current capacity by resource type
    answer_parts.append("CURRENT CAPACITY BY RESOURCE TYPE:")
    answer_parts.append("-" * 80)
    capacity_mix = data.get("capacity_mix", {})
    total_mw = sum(capacity_mix.values())
    
    if total_mw > 0:
        for fuel_type, mw in sorted(capacity_mix.items(), key=lambda x: x[1], reverse=True):
            pct = (mw / total_mw * 100) if total_mw > 0 else 0
            fuel_name = fuel_type.replace("_MW", "").replace("_", " ").title()
            answer_parts.append(f"  {fuel_name}: {mw:,.0f} MW ({pct:.1f}%)")
        answer_parts.append(f"\n  TOTAL: {total_mw:,.0f} MW")
    else:
        answer_parts.append("  No capacity data found.")
    
    answer_parts.append("")
    
    # Generating units
    units = data.get("generating_units", [])
    if units:
        answer_parts.append("GENERATING UNITS:")
        answer_parts.append("-" * 80)
        for unit in units:
            name = unit.get("name", "Unknown")
            mw = unit.get("net_MW", "N/A")
            fuel = unit.get("fuel", "Unknown")
            answer_parts.append(f"  • {name}: {mw} MW ({fuel})")
        answer_parts.append("")
    
    # Planned additions
    additions = data.get("planned_additions", [])
    if additions:
        answer_parts.append("PLANNED ADDITIONS:")
        answer_parts.append("-" * 80)
        for addition in additions:
            name = addition.get("name", "Unknown")
            mw = addition.get("MW", "N/A")
            in_service = addition.get("in_service", "TBD")
            answer_parts.append(f"  • {name}: {mw} MW - In Service: {in_service}")
        answer_parts.append("")
    
    # Planned retirements
    retirements = data.get("planned_retirements", [])
    if retirements:
        answer_parts.append("PLANNED RETIREMENTS:")
        answer_parts.append("-" * 80)
        for retirement in retirements:
            name = retirement.get("name", "Unknown")
            mw = retirement.get("MW", "N/A")
            date = retirement.get("retirement_date", "TBD")
            answer_parts.append(f"  • {name}: {mw} MW - Retirement: {date}")
        answer_parts.append("")
    
    # Sources
    sources = data.get("sources", [])
    if sources:
        answer_parts.append("SOURCES:")
        answer_parts.append("-" * 80)
        for source in sources:
            answer_parts.append(f"  • {source}")
        answer_parts.append("")
    
    answer_parts.append("=" * 80)
    
    return "\n".join(answer_parts)


def main():
    """Main execution."""
    if not FIRECRAWL_API_KEY:
        logger.error("FIRECRAWL_API_KEY not found in environment")
        return
    
    print("=" * 80)
    print("GRDA Capacity Data Extraction (Firecrawl)")
    print("=" * 80)
    print()
    
    capacity_data = extract_capacity_from_grda_pages()
    
    print("\n" + "=" * 80)
    print("EXTRACTION COMPLETE")
    print("=" * 80)
    print(f"Total generating units found: {len(capacity_data.get('generating_units', []))}")
    print(f"Total capacity: {sum(capacity_data.get('capacity_mix', {}).values())} MW")
    print()
    
    # Format and display
    print("Formatting results...")
    answer = format_capacity_answer(capacity_data)
    print("\n" + answer + "\n")
    
    # Save to file
    output_file = Path("data/grda/firecrawl_capacity_data.json")
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(capacity_data, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Capacity data saved to {output_file}")
    
    # Also save formatted answer
    answer_file = Path("data/grda/firecrawl_capacity_answer.txt")
    with open(answer_file, 'w', encoding='utf-8') as f:
        f.write(answer)
    
    print(f"✓ Formatted answer saved to {answer_file}")


if __name__ == "__main__":
    main()

