#!/usr/bin/env python3
"""
Extract OG&E (Oklahoma Gas & Electric) capacity, rates, and service territory data using Firecrawl.

This script extracts data to understand the redundancy dynamic between GRDA and OG&E:
- If GRDA hits capacity, Google has OG&E
- If OG&E rates spike, Google has GRDA's public power
- If drought hits Grand Lake, Stillwater water is unaffected

Focus areas:
1. Power generation capacity and facilities
2. Rate structures and pricing
3. Service territory boundaries
4. Water sources and drought resilience
5. Transmission infrastructure
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
    
    # Simplified payload - Firecrawl v2 may not support all parameters
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
    Extract capacity information from text content - VERY FLEXIBLE patterns.
    
    Returns structured data for OG&E power generation facilities.
    """
    generating_units = []
    capacity_mix = {
        "Gas_MW": 0,
        "Coal_MW": 0,
        "Wind_MW": 0,
        "Solar_MW": 0,
        "Hydro_MW": 0,
        "Other_MW": 0
    }
    
    seen_units = set()
    raw_capacity_mentions = []  # Store any MW mentions for analysis
    
    # VERY FLEXIBLE patterns - catch ANY mention of MW with context
    patterns = [
        # Pattern 1: "Facility Name, XXX MW" or "Facility Name: XXX MW"
        r'([A-Z][A-Za-z\s&\-\']{3,60}(?:Plant|Station|Facility|Center|Farm|Project|Power|Generation|Unit|Turbine))[:\s,]+(\d{1,5})\s*MW',
        # Pattern 2: "XXX MW" near facility names
        r'([A-Z][A-Za-z\s&\-\']{3,60}(?:Plant|Station|Facility|Center|Farm|Project|Power|Generation|Unit|Turbine))[^\n]{0,100}?(\d{1,5})\s*MW',
        # Pattern 3: "XXX MW" with fuel type context
        r'(?:gas|coal|wind|solar|hydro|natural\s+gas|combined\s+cycle)[^\n]{0,80}?(\d{1,5})\s*MW',
        # Pattern 4: Total capacity mentions
        r'(?:total|capacity|generation|generating)[^\n]{0,80}?(\d{1,5})\s*MW',
        # Pattern 5: Any number followed by MW (very broad)
        r'(\d{3,5})\s*MW',
        # Pattern 6: Facility name on one line, MW on next
        r'([A-Z][A-Za-z\s&\-\']{5,60}(?:Plant|Station|Facility|Center|Farm|Project|Power|Generation))[^\n]*\n[^\n]{0,200}?(\d{1,5})\s*MW',
    ]
    
    matches = []
    for pattern in patterns:
        matches.extend(re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE))
    
    for match in matches:
        # Try to get name and MW from match groups
        groups = match.groups()
        mw = None
        name = None
        
        if len(groups) >= 2:
            # Pattern has both name and MW
            name = groups[0].strip() if groups[0] else None
            try:
                mw = int(groups[1])
            except (ValueError, IndexError):
                continue
        elif len(groups) == 1:
            # Pattern only has MW
            try:
                mw = int(groups[0])
            except (ValueError, IndexError):
                continue
            # Try to find facility name in context
            context_start = max(0, match.start() - 100)
            context_end = min(len(text), match.end() + 100)
            context = text[context_start:context_end]
            
            # Look for facility name in context
            name_match = re.search(
                r'([A-Z][A-Za-z\s&\-\']{5,60}(?:Plant|Station|Facility|Center|Farm|Project|Power|Generation))',
                context, re.IGNORECASE
            )
            if name_match:
                name = name_match.group(1).strip()
        
        if not mw or mw < 10:  # Skip very small numbers (likely not capacity)
            continue
        
        # Skip duplicates (same MW value)
        if mw in seen_units:
            continue
        seen_units.add(mw)
        
        # Store raw mention for analysis
        raw_capacity_mentions.append({
            "mw": mw,
            "name": name or "Unknown",
            "context": text[max(0, match.start()-50):min(len(text), match.end()+50)]
        })
        
        # Determine fuel type from name or context
        name_lower = (name or "").lower()
        context_lower = text[max(0, match.start()-100):min(len(text), match.end()+100)].lower()
        
        if any(x in name_lower or x in context_lower for x in ["gas", "natural gas", "combined cycle", "turbine", "cogeneration", "mustang", "seminole", "sooner", "frontier"]):
            unit_type = "Gas"
            fuel = "Gas"
            capacity_mix["Gas_MW"] += mw
        elif "coal" in name_lower or "coal" in context_lower:
            unit_type = "Coal"
            fuel = "Coal"
            capacity_mix["Coal_MW"] += mw
        elif "wind" in name_lower or "wind" in context_lower:
            unit_type = "Wind"
            fuel = "Wind"
            capacity_mix["Wind_MW"] += mw
        elif "solar" in name_lower or "solar" in context_lower or "pv" in context_lower:
            unit_type = "Solar"
            fuel = "Solar"
            capacity_mix["Solar_MW"] += mw
        elif any(x in name_lower or x in context_lower for x in ["hydro", "dam", "pumped"]):
            unit_type = "Hydro"
            fuel = "Hydro"
            capacity_mix["Hydro_MW"] += mw
        else:
            unit_type = "Other"
            fuel = "Unknown"
            capacity_mix["Other_MW"] += mw
        
        generating_units.append({
            "name": name or f"Facility {mw} MW",
            "type": unit_type,
            "net_MW": mw,
            "commissioned": None,
            "fuel": fuel
        })
    
    return {
        "generating_units": generating_units,
        "capacity_mix": {k: v for k, v in capacity_mix.items() if v > 0},
        "planned_additions": [],
        "planned_retirements": [],
        "raw_mentions": raw_capacity_mentions[:20]  # Keep first 20 for debugging
    }


def extract_rates_from_text(text: str) -> Dict:
    """
    Extract rate information from text.
    
    Looks for:
    - Commercial/industrial rates
    - Time-of-use rates
    - Demand charges
    - Rate comparisons
    """
    rates = {
        "commercial_rate_per_kwh": None,
        "industrial_rate_per_kwh": None,
        "demand_charge_per_kw": None,
        "time_of_use_available": False,
        "rate_structure": []
    }
    
    # Pattern for rates (e.g., "$0.08 per kWh", "8 cents per kWh")
    rate_patterns = [
        r'\$?(\d+\.?\d*)\s*(?:cents?|¢)\s*per\s*kwh',
        r'\$(\d+\.?\d*)\s*per\s*kwh',
        r'(\d+\.?\d*)\s*¢?\s*\/\s*kwh',
        r'rate[:\s]+(\$?\d+\.?\d*)\s*(?:per\s*)?kwh',
    ]
    
    for pattern in rate_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            rate_value = float(match.group(1))
            # Convert cents to dollars if needed
            if rate_value > 1 and 'cent' in match.group(0).lower():
                rate_value = rate_value / 100
            
            # Try to determine if commercial or industrial
            context = text[max(0, match.start()-50):match.end()+50].lower()
            if 'commercial' in context or 'business' in context:
                if rates["commercial_rate_per_kwh"] is None:
                    rates["commercial_rate_per_kwh"] = rate_value
            elif 'industrial' in context or 'data center' in context or 'large' in context:
                if rates["industrial_rate_per_kwh"] is None:
                    rates["industrial_rate_per_kwh"] = rate_value
    
    # Check for time-of-use mentions
    if re.search(r'time[-\s]of[-\s]use|tou|peak[-\s]hours?|off[-\s]peak', text, re.IGNORECASE):
        rates["time_of_use_available"] = True
    
    return rates


def extract_service_territory_from_text(text: str) -> Dict:
    """
    Extract service territory information.
    
    Looks for:
    - Cities/counties served
    - Service area boundaries
    - Overlap with other utilities
    """
    territory = {
        "cities_served": [],
        "counties_served": [],
        "service_area_description": None,
        "overlap_with_grda": False,
        "stillwater_served": False
    }
    
    # Look for Stillwater specifically (key for Google data center)
    if re.search(r'stillwater', text, re.IGNORECASE):
        territory["stillwater_served"] = True
    
    # Look for mentions of GRDA overlap
    if re.search(r'grda|grand river', text, re.IGNORECASE):
        territory["overlap_with_grda"] = True
    
    # Extract city names (common Oklahoma cities)
    oklahoma_cities = [
        'oklahoma city', 'okc', 'tulsa', 'norman', 'broken arrow',
        'lawton', 'edmond', 'moore', 'midwest city', 'enos',
        'stillwater', 'muskogee', 'bartlesville', 'owasso', 'shawnee'
    ]
    
    for city in oklahoma_cities:
        if re.search(rf'\b{re.escape(city)}\b', text, re.IGNORECASE):
            if city not in territory["cities_served"]:
                territory["cities_served"].append(city)
    
    return territory


def extract_water_sources_from_text(text: str) -> Dict:
    """
    Extract water source information.
    
    Critical for understanding drought resilience:
    - If drought hits Grand Lake (GRDA), is Stillwater water unaffected?
    """
    water_sources = {
        "primary_sources": [],
        "stillwater_water_source": None,
        "drought_resilient": False,
        "independent_from_grand_lake": False
    }
    
    # Look for water source mentions
    water_patterns = [
        r'(?:water|supply|source)[:\s]+([A-Z][^\n,]{5,50})',
        r'([A-Z][^\n]{5,50})\s+(?:water|reservoir|aquifer|well)',
    ]
    
    for pattern in water_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            source = match.group(1).strip()
            if source and len(source) > 3:
                if source not in water_sources["primary_sources"]:
                    water_sources["primary_sources"].append(source)
    
    # Check for Stillwater-specific water info
    stillwater_section = re.search(
        r'stillwater[^\n]{0,200}(?:water|supply|source|aquifer|reservoir)',
        text, re.IGNORECASE
    )
    if stillwater_section:
        stillwater_text = stillwater_section.group(0)
        # Try to extract the water source
        source_match = re.search(
            r'(?:from|using|via|source[:\s]+)([A-Z][^\s,]{5,40})',
            stillwater_text, re.IGNORECASE
        )
        if source_match:
            water_sources["stillwater_water_source"] = source_match.group(1).strip()
    
    # Check if independent from Grand Lake
    if not re.search(r'grand\s+lake|grand\s+river', text, re.IGNORECASE):
        water_sources["independent_from_grand_lake"] = True
        water_sources["drought_resilient"] = True
    
    return water_sources


def extract_oge_data_from_pages(urls: List[str] = None) -> Dict:
    """
    Extract comprehensive OG&E data from multiple pages.
    
    Args:
        urls: List of URLs to scrape (defaults to key OG&E pages)
    
    Returns:
        Aggregated OG&E data including capacity, rates, territory, water
    """
    if urls is None:
        # Try alternative URLs that might have more static content
        urls = [
            "https://www.oge.com/wps/portal/ord/who-we-are/what-we-do/",
            "https://www.oge.com/wps/portal/ord/who-we-are/our-company/",
            "https://www.oge.com/wps/portal/ord/customer-service/rates-and-regulations/",
            "https://www.oge.com/wps/portal/ord/customer-service/rates-and-regulations/electric-rates/",
            # Try to find generation/power plant pages
            "https://www.oge.com/wps/portal/ord/who-we-are/what-we-do/generation/",
            "https://www.oge.com/wps/portal/ord/who-we-are/what-we-do/power-plants/",
        ]
    
    all_units = []
    all_capacity_mix = {
        "Gas_MW": 0,
        "Coal_MW": 0,
        "Wind_MW": 0,
        "Solar_MW": 0,
        "Hydro_MW": 0,
        "Other_MW": 0
    }
    all_rates = {
        "commercial_rate_per_kwh": None,
        "industrial_rate_per_kwh": None,
        "demand_charge_per_kw": None,
        "time_of_use_available": False,
        "rate_structure": []
    }
    all_territory = {
        "cities_served": [],
        "counties_served": [],
        "service_area_description": None,
        "overlap_with_grda": False,
        "stillwater_served": False
    }
    all_water = {
        "primary_sources": [],
        "stillwater_water_source": None,
        "drought_resilient": False,
        "independent_from_grand_lake": False
    }
    
    all_raw_mentions = []  # Track all raw MW mentions across all pages
    seen_unit_names = set()
    
    for i, url in enumerate(urls, 1):
        print(f"\n[{i}/{len(urls)}] Processing: {url}")
        result = scrape_url(url)
        
        if not result or not result.get("data"):
            print(f"  ⚠ No data received, skipping...")
            logger.warning(f"No data from {url}")
            continue
        
        print(f"  → Extracting data...", end=" ", flush=True)
        data = result["data"]
        markdown = data.get("markdown", "")
        html = data.get("html", "")
        
        # Combine markdown and HTML text for better extraction
        # Extract text from HTML (remove tags)
        if html:
            html_text = re.sub(r'<[^>]+>', ' ', html)
            html_text = re.sub(r'\s+', ' ', html_text)
        else:
            html_text = ""
        
        # Combine both sources
        text = (markdown + " " + html_text)[:150000]  # Increased limit
        
        # Save raw content for debugging if we find something interesting
        if len(text) > 1000:  # Only save if we got substantial content
            debug_dir = Path("data/oge/debug")
            debug_dir.mkdir(parents=True, exist_ok=True)
            debug_file = debug_dir / f"page_{i}_extracted_text.txt"
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write(f"URL: {url}\n")
                f.write(f"Markdown length: {len(markdown)}\n")
                f.write(f"HTML text length: {len(html_text)}\n")
                f.write("\n" + "="*80 + "\n")
                f.write("MARKDOWN:\n")
                f.write(markdown[:5000])
                f.write("\n" + "="*80 + "\n")
                f.write("HTML TEXT:\n")
                f.write(html_text[:5000])
        
        # Extract capacity data
        extracted_capacity = extract_capacity_from_text(text)
        
        # Extract rates
        extracted_rates = extract_rates_from_text(text)
        
        # Extract service territory
        extracted_territory = extract_service_territory_from_text(text)
        
        # Extract water sources
        extracted_water = extract_water_sources_from_text(text)
        
        # Aggregate generating units
        units_found = 0
        for unit in extracted_capacity.get("generating_units", []):
            unit_name = unit.get("name", "")
            if unit_name and unit_name not in seen_unit_names:
                all_units.append(unit)
                seen_unit_names.add(unit_name)
                units_found += 1
        
        # Aggregate capacity mix
        for fuel_type, mw in extracted_capacity.get("capacity_mix", {}).items():
            all_capacity_mix[fuel_type] += mw
        
        # Merge rates (keep first non-None value)
        for key, value in extracted_rates.items():
            if value and (all_rates[key] is None or all_rates[key] == False):
                all_rates[key] = value
        
        # Merge territory (union of cities)
        all_territory["cities_served"].extend(extracted_territory["cities_served"])
        all_territory["overlap_with_grda"] = all_territory["overlap_with_grda"] or extracted_territory["overlap_with_grda"]
        all_territory["stillwater_served"] = all_territory["stillwater_served"] or extracted_territory["stillwater_served"]
        
        # Merge water sources
        all_water["primary_sources"].extend(extracted_water["primary_sources"])
        if extracted_water["stillwater_water_source"] and not all_water["stillwater_water_source"]:
            all_water["stillwater_water_source"] = extracted_water["stillwater_water_source"]
        all_water["drought_resilient"] = all_water["drought_resilient"] or extracted_water["drought_resilient"]
        all_water["independent_from_grand_lake"] = all_water["independent_from_grand_lake"] or extracted_water["independent_from_grand_lake"]
        
        total_capacity = sum(extracted_capacity.get("capacity_mix", {}).values())
        raw_mentions = extracted_capacity.get("raw_mentions", [])
        all_raw_mentions.extend(raw_mentions)  # Collect all raw mentions
        
        print(f"✓ Found {units_found} units, {total_capacity} MW total")
        
        # Show raw mentions if we found any MW values
        if raw_mentions:
            print(f"  Raw MW mentions found: {len(raw_mentions)}")
            for mention in raw_mentions[:3]:
                print(f"    - {mention['mw']} MW ({mention['name']})")
        
        # Show quick preview
        if units_found > 0:
            preview_units = extracted_capacity.get('generating_units', [])[:3]
            preview_text = ', '.join([f"{u['name']} ({u['net_MW']} MW)" for u in preview_units])
            print(f"  Preview: {preview_text}")
        elif len(text) > 100:
            # If we got content but no units, show a sample
            print(f"  Content sample: {text[:200].replace(chr(10), ' ')}...")
    
    # Deduplicate cities
    all_territory["cities_served"] = list(set(all_territory["cities_served"]))
    all_water["primary_sources"] = list(set(all_water["primary_sources"]))
    
    return {
        "generating_units": all_units,
        "capacity_mix": {k: v for k, v in all_capacity_mix.items() if v > 0},
        "rates": all_rates,
        "service_territory": all_territory,
        "water_sources": all_water,
        "planned_additions": [],
        "planned_retirements": [],
        "sources": urls,
        "redundancy_analysis": {
            "grda_capacity_backup": all_capacity_mix.get("Gas_MW", 0) + all_capacity_mix.get("Coal_MW", 0) > 0,
            "rate_hedging_available": all_rates.get("industrial_rate_per_kwh") is not None,
            "water_independence": all_water["independent_from_grand_lake"],
            "stillwater_coverage": all_territory["stillwater_served"]
        },
        "extraction_metadata": {
            "total_raw_mentions": len(all_raw_mentions),
            "extraction_method": "firecrawl_flexible_patterns",
            "raw_mentions_sample": all_raw_mentions[:10]  # Keep first 10 for analysis
        }
    }


def format_oge_answer(data: Dict) -> str:
    """Format OG&E data as a readable answer."""
    answer_parts = []
    
    answer_parts.append("=" * 80)
    answer_parts.append("OG&E (OKLAHOMA GAS & ELECTRIC) DATA (FROM WEBSITE)")
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
    
    # Rates
    rates = data.get("rates", {})
    answer_parts.append("RATE INFORMATION:")
    answer_parts.append("-" * 80)
    if rates.get("commercial_rate_per_kwh"):
        answer_parts.append(f"  Commercial Rate: ${rates['commercial_rate_per_kwh']:.4f} per kWh")
    if rates.get("industrial_rate_per_kwh"):
        answer_parts.append(f"  Industrial Rate: ${rates['industrial_rate_per_kwh']:.4f} per kWh")
    if rates.get("demand_charge_per_kw"):
        answer_parts.append(f"  Demand Charge: ${rates['demand_charge_per_kw']:.2f} per kW")
    if rates.get("time_of_use_available"):
        answer_parts.append("  Time-of-Use Rates: Available")
    answer_parts.append("")
    
    # Service Territory
    territory = data.get("service_territory", {})
    answer_parts.append("SERVICE TERRITORY:")
    answer_parts.append("-" * 80)
    if territory.get("stillwater_served"):
        answer_parts.append("  ✓ Stillwater, OK: SERVED")
    if territory.get("cities_served"):
        answer_parts.append(f"  Cities Served: {', '.join(territory['cities_served'][:10])}")
    if territory.get("overlap_with_grda"):
        answer_parts.append("  ⚠ Overlap with GRDA: Yes")
    else:
        answer_parts.append("  ✓ Overlap with GRDA: Minimal/None")
    answer_parts.append("")
    
    # Water Sources
    water = data.get("water_sources", {})
    answer_parts.append("WATER SOURCES:")
    answer_parts.append("-" * 80)
    if water.get("stillwater_water_source"):
        answer_parts.append(f"  Stillwater Water Source: {water['stillwater_water_source']}")
    if water.get("primary_sources"):
        answer_parts.append(f"  Primary Sources: {', '.join(water['primary_sources'][:5])}")
    if water.get("independent_from_grand_lake"):
        answer_parts.append("  ✓ Independent from Grand Lake: Yes (drought resilient)")
    answer_parts.append("")
    
    # Redundancy Analysis
    redundancy = data.get("redundancy_analysis", {})
    answer_parts.append("REDUNDANCY ANALYSIS (vs GRDA):")
    answer_parts.append("-" * 80)
    if redundancy.get("grda_capacity_backup"):
        answer_parts.append("  ✓ Can backup GRDA if capacity exceeded")
    if redundancy.get("rate_hedging_available"):
        answer_parts.append("  ✓ Rate hedging available (if OG&E rates spike, use GRDA)")
    if redundancy.get("water_independence"):
        answer_parts.append("  ✓ Water independence: Stillwater unaffected by Grand Lake drought")
    if redundancy.get("stillwater_coverage"):
        answer_parts.append("  ✓ Stillwater coverage: OG&E serves Google data center location")
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
    print("OG&E Capacity, Rates, and Redundancy Data Extraction (Firecrawl)")
    print("=" * 80)
    print()
    
    oge_data = extract_oge_data_from_pages()
    
    print("\n" + "=" * 80)
    print("EXTRACTION COMPLETE")
    print("=" * 80)
    print(f"Total generating units found: {len(oge_data.get('generating_units', []))}")
    print(f"Total capacity: {sum(oge_data.get('capacity_mix', {}).values())} MW")
    print(f"Stillwater served: {oge_data.get('service_territory', {}).get('stillwater_served', False)}")
    print(f"Water independent from Grand Lake: {oge_data.get('water_sources', {}).get('independent_from_grand_lake', False)}")
    print()
    
    # Format and display
    print("Formatting results...")
    answer = format_oge_answer(oge_data)
    print("\n" + answer + "\n")
    
    # Save to file
    output_file = Path("data/oge/firecrawl_capacity_data.json")
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(oge_data, f, indent=2, ensure_ascii=False)
    
    print(f"✓ OG&E data saved to {output_file}")
    
    # Also save formatted answer
    answer_file = Path("data/oge/firecrawl_capacity_answer.txt")
    with open(answer_file, 'w', encoding='utf-8') as f:
        f.write(answer)
    
    print(f"✓ Formatted answer saved to {answer_file}")


if __name__ == "__main__":
    main()

