#!/usr/bin/env python3
"""
Phase D: Extract Project Cards - Extract structured fields from project announcements.
Probabilistic extraction - many fields will be null (that's expected).
Timeout protection: <60 seconds
"""

import sys
import time
import signal
import re
from typing import Dict, List, Optional
from pathlib import Path
import sqlite3
import json
import uuid

# Timeout configuration
MAX_RUNTIME_SECONDS = 55
TIMEOUT_EXCEEDED = False

def timeout_handler(signum, frame):
    """Handle timeout signal."""
    global TIMEOUT_EXCEEDED
    TIMEOUT_EXCEEDED = True
    print("\n⚠️  Timeout approaching - stopping gracefully...")
    raise TimeoutError("Script exceeded maximum runtime")

def health_check(start_time: float) -> bool:
    """Check if script is still within time limit."""
    elapsed = time.time() - start_time
    if elapsed > MAX_RUNTIME_SECONDS:
        return False
    return True

def clean_location_name(location: str, preserve_county: bool = False) -> str:
    """Clean location text for use in project names."""
    if not location:
        return ""
    
    # Store County suffix if present and we want to preserve it
    county_suffix = ""
    if preserve_county and " County" in location:
        county_suffix = " County"
        location = location.replace(" County", "")
    
    # Remove directional prefixes (more aggressive)
    location = re.sub(r'^(Northeast|Northwest|Southeast|Southwest|North|South|East|West|Central)\s+', '', location, flags=re.IGNORECASE)
    # Remove "Area" suffix
    location = re.sub(r'\s+Area$', '', location, flags=re.IGNORECASE)
    # Remove common suffixes (but keep if it's part of the name like "Fort Worth")
    # Only remove if it's a standalone suffix
    location = re.sub(r'\s+(Texas|TX)(?:\s|$)', ' ', location, flags=re.IGNORECASE)
    # Remove article words
    location = re.sub(r'^(the|a|an)\s+', '', location, flags=re.IGNORECASE)
    # Remove trailing punctuation
    location = location.strip('.,;:')
    # Remove leading/trailing whitespace
    location = location.strip()
    
    # Re-add County suffix if it was preserved
    if county_suffix:
        location = location + county_suffix
    
    return location

def extract_project_card(mention: Dict) -> Dict:
    """
    Extract structured project card from classified mention.
    Many fields will be null - that's expected (probabilistic extraction).
    
    Returns:
        Project card dict with extracted fields
    """
    text = mention.get("snippet", "") or ""
    title = mention.get("title", "") or ""
    full_text = f"{title} {text}"
    
    card = {
        "project_name": None,
        "company": None,
        "location_text": None,
        "site_hint": None,
        "size_mw": None,
        "size_sqft": None,
        "size_acres": None,
        "announced_date": mention.get("published_at"),
        "expected_completion_date": None,
        "probability_score": "unknown",
        "extraction_confidence": "low"
    }
    
    # Extract company (enhanced with aliases and multiple sources)
    # Company dictionary: canonical_name -> [aliases, variations]
    company_dict = {
        "Amazon": ["Amazon", "AWS", "Amazon Web Services", "amazon-web-services"],
        "Google": ["Google", "Alphabet", "google"],
        "Microsoft": ["Microsoft", "MSFT", "microsoft"],
        "Meta": ["Meta", "Facebook", "meta", "facebook"],
        "Oracle": ["Oracle", "oracle"],
        "CoreWeave": ["CoreWeave", "Core Weave", "coreweave", "core-weave"],
        "Digital Realty": ["Digital Realty", "DigitalRealty", "digital-realty", "digitalrealty"],
        "QTS": ["QTS", "QTS Realty", "qts"],
        "Switch": ["Switch", "switch"],
        "Aligned": ["Aligned", "Aligned Data Centers", "aligned"],
        "Equinix": ["Equinix", "equinix"],
        "CyrusOne": ["CyrusOne", "Cyrus One", "cyrusone", "cyrus-one"],
        "Vantage": ["Vantage", "Vantage Data Centers", "vantage"],
        "STACK": ["STACK", "STACK Infrastructure", "stack"],
        "Rowan Digital Infrastructure": ["Rowan Digital Infrastructure", "Rowan Digital", "rowan-digital", "rowan"],
        "Roxanne Marquis": ["Roxanne Marquis", "roxanne-marquis", "8888CRE"],
        "Calpine": ["Calpine", "calpine"],
        "Cipher Mining": ["Cipher Mining", "Cipher", "cipher"],
        "Nvidia": ["Nvidia", "NVIDIA", "nvidia"],
        "DataBank": ["DataBank", "Data Bank", "databank"],
        "TierPoint": ["TierPoint", "Tier Point", "tierpoint"],
        "Flexential": ["Flexential", "flexential"],
        "Cologix": ["Cologix", "cologix"],
        "Blueprint Projects": ["Blueprint Projects", "Blueprint", "blueprint"],
        "Energy Capital Partners": ["Energy Capital Partners", "ECP", "energy-capital-partners"],
        "KKR": ["KKR", "kkr"],
        "Texas Critical Data Center": ["Texas Critical Data Center", "Texas Critical", "texas-critical"],
        # Phase 4.1: Additional companies found in snippets
        "Sabey Data Centers": ["Sabey Data Centers", "Sabey", "sabey", "sabey-data-centers"],
        "Cielo Digital Infrastructure": ["Cielo Digital Infrastructure", "Cielo", "cielo", "cielo-digital"],
        "EdgeConneX": ["EdgeConneX", "EdgeConneX Inc.", "EdgeConneX Inc", "edgeconnex", "edge-connex"],
        "TRG Datacenters": ["TRG Datacenters", "TRG", "trg", "trg-datacenters"],
        "Skybox Datacenters": ["Skybox Datacenters", "Skybox Datacenters LLC", "Skybox", "skybox", "skybox-datacenters"],
        "KDC": ["KDC", "kdc"],
        # New companies discovered from triage (2025-01)
        "CleanSpark": ["CleanSpark", "CleanSpark Inc.", "CleanSpark, Inc.", "CLSK", "cleanspark"],
        "Black Mountain Power": ["Black Mountain Power", "Black Mountain Power LLC", "black-mountain-power", "blackmountainpower"],
        "Black Mountain Energy": ["Black Mountain Energy", "black-mountain-energy", "blackmountainenergy"],
        "PowerHouse Data Centers": ["PowerHouse Data Centers", "PowerHouse", "Powerhouse Data Centers", "powerhouse", "powerhouse-data-centers"],
        "Provident Data Centers": ["Provident Data Centers", "Provident", "provident", "provident-data-centers"],
    }
    
    detected_company = None
    
    # Strategy 1: Check title first (higher confidence)
    title_text = title.lower()
    url = mention.get("url", "") or mention.get("canonical_url", "") or ""
    url_lower = url.lower()
    
    # Check title for company names
    for canonical_name, aliases in company_dict.items():
        for alias in aliases:
            # Check in title (word boundary to avoid partial matches)
            if re.search(rf"\b{re.escape(alias)}\b", title_text, re.IGNORECASE):
                card["company"] = canonical_name
                detected_company = canonical_name
                break
        if detected_company:
            break
    
    # Strategy 2: Check URL for company names (if not found in title)
    if not detected_company:
        for canonical_name, aliases in company_dict.items():
            for alias in aliases:
                # Check in URL (more lenient - can be part of slug)
                if alias.lower() in url_lower:
                    card["company"] = canonical_name
                    detected_company = canonical_name
                    break
            if detected_company:
                break
    
    # Strategy 3: Check snippet specifically (higher priority than full text)
    snippet_text = text.lower()
    if not detected_company:
        for canonical_name, aliases in company_dict.items():
            for alias in aliases:
                # Check in snippet with word boundary (companies often appear in snippets)
                if re.search(rf"\b{re.escape(alias)}\b", snippet_text, re.IGNORECASE):
                    card["company"] = canonical_name
                    detected_company = canonical_name
                    break
            if detected_company:
                break
    
    # Strategy 4: Check full text (if not found in title, URL, or snippet)
    if not detected_company:
        # Also check raw_text if available (full article content)
        raw_text = mention.get("raw_text", "") or ""
        extended_text = f"{full_text} {raw_text}".lower()
        
        for canonical_name, aliases in company_dict.items():
            for alias in aliases:
                # Check in extended text with word boundary
                if re.search(rf"\b{re.escape(alias)}\b", extended_text, re.IGNORECASE):
                    card["company"] = canonical_name
                    detected_company = canonical_name
                    break
            if detected_company:
                break
    
    # Extract location (Phase 4.2: Enhanced patterns with better snippet/title detection)
    # Phase 4.2.1: Check title first for location mentions (highest confidence)
    title_location_patterns = [
        (r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County.*data center", 1),  # "Bastrop County data center" or "Cherokee County inks"
        (r"data center.*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+Texas", 1),  # "data center In Taylor, Texas"
        (r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+Texas.*data center", 1),  # "Taylor Texas data center"
        (r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County", 1),  # "Cherokee County" in title
    ]
    
    # Try title patterns first
    for pattern, group_idx in title_location_patterns:
        match = re.search(pattern, title, re.IGNORECASE)
        if match:
            location = match.group(group_idx).strip()
            # Preserve County suffix if present
            if "County" in match.group(0) and "County" not in location:
                county_match = re.search(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County", match.group(0), re.IGNORECASE)
                if county_match:
                    location = county_match.group(1) + " County"
            
            # Validate location
            if location and len(location) > 1 and location.lower() not in ['texas', 'data', 'center', 'campus']:
                location = clean_location_name(location, preserve_county="County" in location)
                if location:
                    card["location_text"] = location
                    break
    
    # Phase 4.2.2: Enhanced patterns for snippet/full text
    location_patterns = [
        # Specific county patterns (highest priority) - preserve "County" suffix
        (r"\b(?:in|near|outside|at|within|for)\s+(Northeast|Northwest|Southeast|Southwest|North|South|East|West|Central)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County", 2),  # "in West Bexar County" → "Bexar County"
        # City with direction
        (r"\b(?:in|near|outside|at|for)\s+(Northeast|Northwest|Southeast|Southwest|North|South|East|West|Central)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*?)(?:-area|\s+Texas|,|$)", 2),  # "in Northeast El Paso" → "El Paso"
        # D-FW variations
        (r"\b(?:in|near|outside|at)\s+(D-FW|DFW|Dallas-Fort Worth|Dallas Fort Worth)", 1),  # "in D-FW" or "in Dallas-Fort Worth"
        # Unincorporated areas
        (r"\bin\s+unincorporated\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County", 1),
        # City, Texas pattern
        (r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+Texas", 1),
        # Standalone county (more lenient)
        (r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County(?!\s+(?:Texas|TX|will|said|announces|data|center))", 1),  # "Bastrop County" or "Cherokee County"
        # Industrial park
        (r"\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+industrial\s+park", 1),
        # "Central Texas" with specific location mentioned elsewhere
        (r"\b(?:in|near|outside|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*?)(?:\s+(?:County|City|area|region))", 1),  # "in Bosque County" from "Central Texas"
        # Phase 4.2: City, Texas pattern (more specific)
        (r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+Texas", 1),  # "Taylor, Texas" or "Round Rock, Texas"
        # Phase 4.2: Additional patterns for common cities (more specific)
        (r"\b(?:in|near|outside|at|for|coming to|proposed in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*?)(?:\s+for|\s+Texas|,|$|\.)", 1),  # "coming to Taylor" or "proposed in Round Rock"
        # Specific city mentions with better context (must be followed by data center keywords or end of sentence)
        (r"\b(Austin|Dallas|Houston|San Antonio|Fort Worth|El Paso|Plano|Frisco|Round Rock|Taylor|Cedar Creek|Whitney|Midlothian)(?:\s+(?:Texas|TX|campus|data center|facility|project)|,|$|\.)", 1),  # Direct city mentions with context
    ]
    
    # Try patterns on snippet first (if location not found in title), then full text
    search_text = snippet_text if not card["location_text"] else ""
    if not card["location_text"]:
        for pattern, group_idx in location_patterns:
            match = re.search(pattern, search_text, re.IGNORECASE)
            if match:
                # Process match (same logic as below)
                if group_idx == 2 and len(match.groups()) >= 2:
                    location = match.group(2).strip() if match.group(2) else match.group(1).strip()
                    if "County" in match.group(0):
                        county_match = re.search(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County", match.group(0), re.IGNORECASE)
                        if county_match:
                            location = county_match.group(1) + " County"
                else:
                    # Check if group exists before accessing
                    if match.lastindex and group_idx <= match.lastindex:
                        location = match.group(group_idx).strip() if match.group(group_idx) else None
                    else:
                        location = None
                
                if location:
                    location = re.sub(r'^(in|near|outside|at|within|for|coming to|proposed in)\s+', '', location, flags=re.IGNORECASE)
                    location = re.sub(r'\s+(will|said|announces|plans|to|build|data|center|campus|facility|sprawling|growing|expanding|the|a|an|this|that|its|two|major|companies|partnering|develop|billion|hyperscale|square|feet|newest|initiative|increase|electrical|workers|for|Texas|could|soon|start|construction|,|$|\.).*$', '', location, flags=re.IGNORECASE)
                    location = location.strip('.,;:')
                    location = re.sub(r'-area$', '', location, flags=re.IGNORECASE)
                    location = re.sub(r'\s+(the|a|an|two|major|newest)$', '', location, flags=re.IGNORECASE)
                    
                    preserve_county = "County" in match.group(0) if match else False
                    location = clean_location_name(location, preserve_county=preserve_county)
                    
                    invalid_locations = ['texas', 'the', 'a', 'an', 'this', 'that', 'billion', 'million', 'its', 'ern', 'center', 
                                       'square', 'feet', 'two', 'major', 'companies', 'hyperscale', 'calpine', 'newest', 'initiative',
                                       'electrical', 'workers', 'iowa', 'ohio', 'data', 'campus']
                    invalid_prefixes = ['meta ', 'cyrusone ', 'google ', 'microsoft ', 'amazon ', 'oracle ']
                    invalid_patterns = [r'\b(billion|million|square|feet|two|major|hyperscale|newest|initiative|electrical|workers)\b']
                    
                    is_valid = (
                        location and 
                        len(location) < 50 and 
                        len(location) > 1 and
                        location.lower() not in invalid_locations and
                        not any(location.lower().startswith(prefix) for prefix in invalid_prefixes) and
                        not re.match(r'^[a-z]+$', location.lower()) and
                        not any(re.search(pattern, location.lower()) for pattern in invalid_patterns) and
                        not re.match(r'^(its|their|our|your|my|his|her)\s+', location.lower())
                    )
                    
                    if is_valid:
                        card["location_text"] = location
                        break
    
    # Try patterns on full text (if location still not found)
    if not card["location_text"]:
        for pattern, group_idx in location_patterns:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                # Get the location group (usually the last group, or specified group)
                if group_idx == 2 and len(match.groups()) >= 2:
                    # For patterns with direction + location, get the location part
                    # Group 1 is direction (optional), Group 2 is location
                    location = match.group(2).strip() if match.group(2) else match.group(1).strip()
                    # If the pattern was for a county, preserve "County" suffix
                    if "County" in match.group(0):
                        # Extract the county name with "County" suffix
                        county_match = re.search(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County", match.group(0), re.IGNORECASE)
                        if county_match:
                            location = county_match.group(1) + " County"
                else:
                    # Check if group exists before accessing
                    if match.lastindex and group_idx <= match.lastindex:
                        location = match.group(group_idx).strip() if match.group(group_idx) else None
                    else:
                        location = None
                
                if location:
                    # Remove leading prepositions that might have been captured
                    location = re.sub(r'^(in|near|outside|at|within)\s+', '', location, flags=re.IGNORECASE)
                    
                    # Clean up: remove trailing words that aren't part of location
                    location = re.sub(r'\s+(will|said|announces|plans|to|build|data|center|campus|facility|sprawling|growing|expanding|the|a|an|this|that|its|two|major|companies|partnering|develop|billion|hyperscale|square|feet|newest|initiative|increase|electrical|workers).*$', '', location, flags=re.IGNORECASE)
                    location = location.strip('.,;:')
                    # Remove "-area" suffix but keep the city name
                    location = re.sub(r'-area$', '', location, flags=re.IGNORECASE)
                    # Remove trailing "The" or other articles
                    location = re.sub(r'\s+(the|a|an|two|major|newest)$', '', location, flags=re.IGNORECASE)
                    
                    # Apply enhanced location cleaning (but preserve "County" if it was in the original match)
                    preserve_county = "County" in match.group(0)
                    location = clean_location_name(location, preserve_county=preserve_county)
                    
                    # Filter out common false positives and validate length
                    invalid_locations = ['texas', 'the', 'a', 'an', 'this', 'that', 'billion', 'million', 'its', 'ern', 'center', 
                                       'square', 'feet', 'two', 'major', 'companies', 'hyperscale', 'calpine', 'newest', 'initiative',
                                       'electrical', 'workers', 'iowa', 'ohio']  # Exclude non-Texas states for now
                    invalid_prefixes = ['meta ', 'cyrusone ', 'google ', 'microsoft ', 'amazon ', 'oracle ']
                    invalid_patterns = [r'\b(billion|million|square|feet|two|major|hyperscale|newest|initiative|electrical|workers)\b']
                    
                    # Check if location is valid
                    is_valid = (
                        location and 
                        len(location) < 50 and 
                        len(location) > 1 and
                        location.lower() not in invalid_locations and
                        not any(location.lower().startswith(prefix) for prefix in invalid_prefixes) and
                        not re.match(r'^[a-z]+$', location.lower()) and  # Reject single lowercase words
                        not any(re.search(pattern, location.lower()) for pattern in invalid_patterns) and
                        not re.match(r'^(its|their|our|your|my|his|her)\s+', location.lower())  # Reject possessive pronouns
                    )
                    
                    if is_valid:
                        card["location_text"] = location
                        break
    
    # Fallback: look for "in [Place]" or "[Place], Texas" patterns more loosely
    if not card["location_text"]:
        # First, try to find specific county/city when "Central Texas" or similar is mentioned
        central_texas_match = re.search(r"\b(Central|Northeast|Northwest|Southeast|Southwest|North|South|East|West)\s+Texas\b", full_text, re.IGNORECASE)
        if central_texas_match:
            # Look for specific county or city mentioned in the text
            specific_location = re.search(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County\b", full_text)
            if specific_location:
                location = specific_location.group(1).strip()
                location = clean_location_name(location)
                if location and len(location) > 1 and location.lower() not in ['texas', 'the', 'a', 'an']:
                    card["location_text"] = f"{location} County"
                    # Skip to end if we found a good location
                    if card["location_text"]:
                        pass  # Continue to next check
        
        # Try "in Texas" or "Texas" as last resort
        if not card["location_text"]:
            texas_match = re.search(r"\b(?:in\s+)?(Texas|TX)\b", full_text, re.IGNORECASE)
            if texas_match:
                card["location_text"] = "Texas"
            else:
                loose_match = re.search(r"\b(?:in|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*?)(?:\s+County|\s+Texas|,|$)", full_text)
                if loose_match:
                    location = loose_match.group(1).strip()
                    # Clean up and filter
                    location = re.sub(r'\s+(will|said|announces|plans|to|build|data|center|campus|facility|the|a|an|this|that|its|two|major|companies|partnering|develop|billion|hyperscale|square|feet).*$', '', location, flags=re.IGNORECASE)
                    location = location.strip('.,;:')
                    # Apply enhanced cleaning
                    location = clean_location_name(location)
                    # Remove trailing "The" or other articles
                    location = re.sub(r'\s+(the|a|an|two|major)$', '', location, flags=re.IGNORECASE)
                    invalid_locations = ['the', 'a', 'an', 'this', 'that', 'its', 'two', 'major', 'billion', 'million', 'square', 'feet', 'hyperscale', 'calpine', 'iowa', 'ohio']
                    if (location and 
                        location.lower() not in invalid_locations and 
                        len(location) < 50 and
                        len(location) > 1 and
                        not location.lower().startswith('meta ') and
                        not location.lower().startswith('cyrusone ') and
                        not location.lower().startswith('google ') and
                        not re.search(r'\b(billion|million|square|feet|two|major|hyperscale)\b', location.lower())):
                        card["location_text"] = location
    
    # Extract size (MW)
    mw_patterns = [
        r"(\d+(?:\.\d+)?)\s*MW",
        r"(\d+(?:\.\d+)?)\s*megawatts?",
        r"\$(\d+(?:\.\d+)?)\s*billion",  # Sometimes size is implied by cost
    ]
    for pattern in mw_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            try:
                value = float(match.group(1))
                # If it's a billion dollar amount, estimate MW (rough heuristic)
                if "billion" in pattern:
                    # Rough estimate: $1B ≈ 100-200 MW (very rough)
                    card["size_mw"] = value * 150  # Middle estimate
                else:
                    card["size_mw"] = value
            except ValueError:
                pass
            if card["size_mw"]:
                break
    
    # Extract size (sqft)
    sqft_patterns = [
        r"(\d+(?:,\d{3})*)\s*sq\.?\s*ft\.?",
        r"(\d+(?:,\d{3})*)\s*square\s+feet",
    ]
    for pattern in sqft_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            try:
                card["size_sqft"] = int(match.group(1).replace(",", ""))
            except ValueError:
                pass
            if card["size_sqft"]:
                break
    
    # Extract size (acres)
    acres_patterns = [
        r"(\d+(?:,\d{3})*)\s*acres?",
        r"(\d+(?:,\d{3})*)-acre",
        r"(\d+(?:,\d{3})*)\s*acre\s+(?:campus|site|facility|data center)",
    ]
    for pattern in acres_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            try:
                card["size_acres"] = float(match.group(1).replace(",", ""))
            except ValueError:
                pass
            if card["size_acres"]:
                break
    
    # Extract site hint (substation, industrial park, road)
    site_patterns = [
        r"(substation\s+[A-Z0-9]+)",
        r"([A-Z][a-z]+\s+Industrial\s+Park)",
        r"([A-Z][a-z]+\s+(?:Road|Street|Avenue|Boulevard))",
        r"(Northeast|Northwest|Southeast|Southwest)\s+([A-Z][a-z]+)",  # "Northeast El Paso"
    ]
    for pattern in site_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            card["site_hint"] = " ".join(match.groups()) if isinstance(match.groups(), tuple) else match.group(1)
            break
    
    # Extract expected completion date
    completion_date_patterns = [
        r"expected to (?:open|complete|operational|launch|come online) (?:in|by|during) (\d{4})",
        r"scheduled for (?:completion|opening|operational) (?:in|by) (\d{4})",
        r"will be operational (?:in|by) (\d{4})",
        r"set to (?:open|complete|operational) (?:in|by) (\d{4})",
        r"to (?:open|complete|operational) (?:in|by) (\d{4})",
        r"(\d{4}) (?:completion|opening|operational)",
        r"through (\d{4})",  # "investment through 2027"
        r"wrap up (?:in|by) (?:the\s+)?(?:first|second|third|fourth)\s+quarter\s+of\s+(\d{4})",
        r"Q[1-4]\s+(\d{4})",  # "Q2 2026"
        r"(?:late|early)\s+(\d{4})",  # "late 2025"
    ]
    for pattern in completion_date_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            year = match.group(1)
            # Validate year is reasonable (2024-2030)
            try:
                year_int = int(year)
                if 2024 <= year_int <= 2030:
                    card["expected_completion_date"] = year
                    break
            except ValueError:
                pass
    
    # Extract probability score based on signals
    probability_signals = {
        "high": [
            r"breaking ground",
            r"groundbreaking",
            r"construction (?:started|begins|began|has begun)",
            r"construction (?:is|set to) (?:begin|start)",
            r"permit (?:approved|granted|filed)",
            r"zoning (?:approved|granted)",
            r"construction (?:on|of).*?set to begin",
        ],
        "medium": [
            r"plans to build",
            r"announced plans",
            r"proposed",
            r"proposal",
            r"expected to begin",
            r"will begin",
            r"filed (?:for|with)",
        ],
        "low": [
            r"exploring",
            r"considering",
            r"in discussions",
            r"future plans",
            r"no timeline",
            r"timeline (?:not|yet) (?:announced|set)",
        ]
    }
    
    # Check for signals in order of priority (high -> medium -> low)
    for level in ["high", "medium", "low"]:
        for pattern in probability_signals[level]:
            if re.search(pattern, full_text, re.IGNORECASE):
                card["probability_score"] = level
                break
        if card["probability_score"] != "unknown":
            break
    
    # Extract project name (if mentioned)
    # Strategy 1: Try title first (higher confidence)
    title_name_patterns = [
        (r'"([^"]+)"', 1),  # Quoted project name
    ]
    
    # Add DFW/TX pattern only if we have a detected company
    if detected_company:
        # Escape company name for regex
        escaped_company = re.escape(detected_company)
        title_name_patterns.append(
            (rf"({escaped_company})\s+(DFW\d+|TX\d+|Campus\s+\d+)", 2),  # "CyrusOne DFW10" - only if company matches
        )
    
    # Add company + location patterns (only if we have a detected company to avoid false matches)
    if detected_company:
        escaped_company = re.escape(detected_company)
        title_name_patterns.extend([
            (rf"({escaped_company})\s+(?:to build|plans|announces|commits).*?(?:data center|campus|facility)\s+(?:in|at|near)\s+(?:Northeast|Northwest|Southeast|Southwest|North|South|East|West|Central)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", 2),  # "Meta to build data center in El Paso"
            (rf"({escaped_company})\s+(?:data center|campus|facility)\s+(?:in|at|near)\s+(?:Northeast|Northwest|Southeast|Southwest|North|South|East|West|Central)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", 2),  # "Meta data center in El Paso"
        ])
    
    # Try title first
    for pattern, group_count in title_name_patterns:
        match = re.search(pattern, title, re.IGNORECASE)
        if match:
            if group_count > 1:
                # Combine company + location (skip direction words)
                parts = []
                for g in match.groups()[:group_count]:
                    if g and g.strip() and g.strip().lower() not in ['northeast', 'northwest', 'southeast', 'southwest', 'north', 'south', 'east', 'west', 'central']:
                        parts.append(g.strip())
                extracted_name = " ".join(parts).strip()
            else:
                extracted_name = match.group(1).strip()
            
            # Validate: should be reasonable length and not just common words
            invalid_names = ['billion', 'million', 'data center', 'campus', 'facility', 'to build', 'plans', 'announces', 
                            'center', 'ern', 'its', 'sprawling', 'growing', 'expanding', 'the', 'a', 'an', 'named', 'called']
            if (len(extracted_name) > 2 and len(extracted_name) < 50 and 
                extracted_name.lower() not in invalid_names and
                not re.match(r'^[a-z]+$', extracted_name.lower()) and  # Reject single lowercase words
                not extracted_name.lower().startswith('named ') and  # Reject "Named ..."
                not extracted_name.lower().startswith('called ')):  # Reject "Called ..."
                card["project_name"] = extracted_name
                break
    
    # Strategy 2: Try full text with expanded patterns
    if not card["project_name"]:
        name_patterns = [
            (r'"([^"]+)"', 1),  # Quoted project name
            (r"project\s+called\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", 1),
        ]
        
        # Handle "Named DFW10" or "Called DFW10" - extract identifier and combine with company
        if detected_company:
            named_pattern = re.search(r"(?:named|called)\s+(DFW\d+|TX\d+|Campus\s+\d+)", full_text, re.IGNORECASE)
            if named_pattern:
                identifier = named_pattern.group(1)
                card["project_name"] = f"{detected_company} {identifier}"
                # Skip to Strategy 3 if we set it
                if card["project_name"]:
                    pass  # Continue to Strategy 3 if needed
        
        # Add DFW/TX pattern only if we have a detected company (and haven't set name yet)
        if detected_company and not card["project_name"]:
            escaped_company = re.escape(detected_company)
            name_patterns.append(
                (rf"({escaped_company})\s+(DFW\d+|TX\d+|Campus\s+\d+)", 2),  # "CyrusOne DFW10"
            )
        
        name_patterns.extend([
            (r"(?:data center|campus|facility)\s+(?:called|named|known as)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", 1),  # "facility called Project Name"
            (r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Phase\s+\d+|Building\s+\d+)", 1),  # "Project Phase 2"
        ])
        
        for pattern, group_count in name_patterns:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                if group_count > 1:
                    extracted_name = " ".join([g for g in match.groups()[:group_count] if g]).strip()
                else:
                    extracted_name = match.group(1).strip()
                
                # Validate: should be reasonable length and not just common words
                invalid_names = ['billion', 'million', 'data center', 'campus', 'facility', 'center', 'ern', 'its', 'named', 'called']
                if (len(extracted_name) > 2 and len(extracted_name) < 50 and 
                    extracted_name.lower() not in invalid_names and
                    not re.match(r'^[a-z]+$', extracted_name.lower()) and  # Reject single lowercase words
                    not extracted_name.lower().startswith('named ') and  # Reject "Named ..."
                    not extracted_name.lower().startswith('called ') and  # Reject "Called ..."
                    not extracted_name.lower().endswith(' center') and  # Reject "... center"
                    not extracted_name.lower() == 'center'):  # Reject just "center"
                    card["project_name"] = extracted_name
                    break
    
    # Strategy 3: Generate fallback name from company + location
    if not card["project_name"]:
        if card["company"] and card["location_text"]:
            clean_location = clean_location_name(card["location_text"])
            if clean_location:
                card["project_name"] = f"{card['company']} {clean_location}"
        elif card["company"]:
            card["project_name"] = f"{card['company']} Data Center"
    
    # Calculate confidence
    filled_fields = sum(1 for v in card.values() if v is not None)
    if filled_fields >= 4:
        card["extraction_confidence"] = "high"
    elif filled_fields >= 2:
        card["extraction_confidence"] = "medium"
    
    # Add geocode confidence (set later during geocoding)
    card["location_geocode_confidence"] = None
    
    return card

def extract_project_cards(db_path: Path):
    """Extract project cards from classified project announcements."""
    start_time = time.time()
    
    # Set up timeout signal handler
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(MAX_RUNTIME_SECONDS)
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Fetch project announcements that haven't been extracted
        cursor.execute("""
            SELECT m.mention_id, m.title, m.snippet, m.published_at, m.publisher, 
                   COALESCE(m.canonical_url, m.url) as url
            FROM mentions m
            JOIN classified_mentions c ON m.mention_id = c.mention_id
            WHERE c.classification = 'project_announcement'
            AND m.mention_id NOT IN (SELECT pc.mention_id FROM project_cards pc WHERE pc.mention_id IS NOT NULL)
            ORDER BY m.published_at
        """)
        
        mentions = []
        for row in cursor.fetchall():
            mentions.append({
                "mention_id": row[0],
                "title": row[1],
                "snippet": row[2],
                "published_at": row[3],
                "publisher": row[4],
                "url": row[5] if len(row) > 5 else None,
                "canonical_url": row[5] if len(row) > 5 else None
            })
        
        if not mentions:
            print("✅ No new project announcements to extract")
            conn.close()
            return
        
        print(f"📊 Extracting project cards from {len(mentions)} mentions...")
        
        extracted_count = 0
        
        for i, mention in enumerate(mentions):
            # Health check every 20 mentions
            if i > 0 and i % 20 == 0:
                if not health_check(start_time):
                    print(f"⚠️  Stopping at {i} mentions due to time limit")
                    break
            
            card = extract_project_card(mention)
            
            # Generate project_id (use mention_id as base)
            project_id = f"proj_{mention['mention_id'][:12]}"
            
            try:
                cursor.execute("""
                    INSERT INTO project_cards
                    (project_id, mention_id, project_name, company, location_text, site_hint,
                     size_mw, size_sqft, size_acres, announced_date, expected_completion_date,
                     probability_score, extraction_confidence,
                     location_geocode_confidence, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    project_id,
                    mention["mention_id"],
                    card["project_name"],
                    card["company"],
                    card["location_text"],
                    card["site_hint"],
                    card["size_mw"],
                    card["size_sqft"],
                    card["size_acres"],
                    card["announced_date"],
                    card["expected_completion_date"],
                    card["probability_score"],
                    card["extraction_confidence"],
                    card["location_geocode_confidence"]
                ))
                extracted_count += 1
            except sqlite3.IntegrityError:
                pass
        
        conn.commit()
        conn.close()
        
        elapsed = time.time() - start_time
        print(f"✅ Extracted {extracted_count} project cards in {elapsed:.2f}s")
        
        if elapsed > 60:
            print(f"⚠️  WARNING: Script exceeded 60 seconds!")
        
    except TimeoutError:
        elapsed = time.time() - start_time
        print(f"⏱️  Timeout after {elapsed:.2f}s - partial extraction complete")
    except Exception as e:
        signal.alarm(0)
        raise
    finally:
        signal.alarm(0)

def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Extract project cards from mentions')
    parser.add_argument('--db', type=str, 
                       default=str(Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"),
                       help='Database path')
    
    args = parser.parse_args()
    
    db_path = Path(args.db)
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        sys.exit(1)
    
    extract_project_cards(db_path)

if __name__ == "__main__":
    main()

