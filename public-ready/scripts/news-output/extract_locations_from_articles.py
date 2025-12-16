#!/usr/bin/env python3
"""
Extract precise locations from raw article text for projects with overlapping coordinates.
Uses pattern matching to find addresses, neighborhoods, landmarks, and area descriptions.
"""

import sys
import re
import json
from pathlib import Path
import sqlite3
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
import time
import requests
from bs4 import BeautifulSoup

# Texas cities for context
TEXAS_CITIES = {
    'Dallas': ['uptown', 'downtown', 'plano', 'frisco', 'richardson', 'irving', 'garland', 
               'mesquite', 'carrollton', 'lewisville', 'midlothian', 'red oak', 'lancaster',
               'allen', 'mckinney', 'denton'],
    'Austin': ['taylor', 'jarrell', 'round rock', 'cedar park', 'georgetown', 'pflugerville', 
               'leander', 'san marcos'],
    'Houston': ['sugar land', 'katy', 'the woodlands', 'cypress', 'pearland', 'league city',
                'pasadena', 'baytown'],
    'San Antonio': ['lytle', 'schertz', 'new braunfels', 'boerne', 'universal city'],
    'El Paso': ['northeast el paso', 'east el paso', 'west el paso', 'southeast el paso'],
    'Fort Worth': ['alliance', 'keller', 'southlake', 'grapevine', 'arlington', 'euless'],
}

# Location extraction patterns
ADDRESS_PATTERNS = [
    r'\b(\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Street|Avenue|Road|Drive|Lane|Boulevard|Way|Circle|Court|Place|Highway|Freeway))\b',
    r'\b(at|on|near|along)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Street|Avenue|Road|Drive|Lane|Boulevard))\b',
    r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Street|Avenue|Road|Drive|Lane|Boulevard))\s+(?:and|&|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Street|Avenue|Road|Drive|Lane|Boulevard))',
]

NEIGHBORHOOD_PATTERNS = [
    r'\b(in|at|near|within)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:neighborhood|district|area|region|section)\b',
    r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:suburb|community|town|village)\b',
    r'\b(north|south|east|west|northeast|northwest|southeast|southwest)\s+(?:of|in|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b',
    r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(north|south|east|west|northeast|northwest|southeast|southwest)\b',
]

LANDMARK_PATTERNS = [
    r'\b(near|close to|adjacent to|next to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b',
    r'\b(on|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Road|Street|Avenue|Drive|Lane|Boulevard))\b',
    r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Airport|University|Hospital|Park|Mall|Center|Campus)\b',
]

AREA_DESCRIPTION_PATTERNS = [
    r'\b(southeast|southwest|northeast|northwest|north|south|east|west)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b',
    r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:corridor|highway|freeway|interstate)\b',
    r'\b(off|along|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Highway|Freeway|Interstate|Road))\b',
]

def geocode_with_context(query: str, city_context: str = None) -> dict:
    """Geocode a location query with optional city context."""
    try:
        geocoder = Nominatim(user_agent="texas_data_center_article_extraction", timeout=10)
        
        # Try with city context first
        if city_context:
            full_query = f"{query}, {city_context}, Texas, USA"
        else:
            full_query = f"{query}, Texas, USA"
        
        location = geocoder.geocode(full_query, exactly_one=True)
        
        if location:
            # Validate Texas coordinates
            if 25 <= location.latitude <= 37 and -107 <= location.longitude <= -93:
                result_type = location.raw.get('type', '')
                address = location.raw.get('display_name', '')
                
                # Determine confidence
                if 'house' in result_type or 'building' in result_type:
                    confidence = 'address'
                elif 'neighbourhood' in result_type or 'suburb' in result_type:
                    confidence = 'neighborhood'
                elif 'city' in result_type or 'town' in result_type:
                    confidence = 'city'
                elif 'county' in result_type:
                    confidence = 'county'
                else:
                    confidence = 'area'
                
                return {
                    'lat': location.latitude,
                    'lng': location.longitude,
                    'confidence': confidence,
                    'address': address
                }
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        pass
    except Exception as e:
        pass
    
    return None

# Words to filter out from extracted locations
FILTER_WORDS = ['data', 'center', 'centre', 'square', 'feet', 'foot', 'million', 'billion', 
                'facility', 'campus', 'building', 'construction', 'project', 'expansion']

def is_valid_location(location: str) -> bool:
    """Check if extracted location is valid."""
    if not location or len(location) < 3:
        return False
    
    location_lower = location.lower()
    
    # Filter out if contains data center related words
    if any(word in location_lower for word in FILTER_WORDS):
        return False
    
    # Filter out if it's just a number or very short
    if location_lower.strip().isdigit() or len(location.strip()) < 3:
        return False
    
    return True

def extract_locations_from_text(text: str) -> list:
    """Extract location candidates from text using pattern matching."""
    candidates = []
    
    if not text:
        return candidates
    
    text_clean = text.replace('\n', ' ').replace('\r', ' ')
    
    # Extract street names (e.g., "Omicron Drive", "Forest Hill Road")
    street_pattern = r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|Avenue|Road|Drive|Lane|Boulevard|Way|Circle|Court|Place|Highway|Freeway|Interstate|I-\d+))\b'
    for match in re.finditer(street_pattern, text_clean):
        street = match.group(1)
        if is_valid_location(street):
            candidates.append({
                'location': street,
                'type': 'address',
                'confidence': 'high'
            })
    
    # Extract addresses with numbers (including Parkway)
    address_pattern = r'\b(\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Street|Avenue|Road|Drive|Lane|Boulevard|Way|Circle|Court|Place|Highway|Freeway|Parkway))\b'
    for match in re.finditer(address_pattern, text_clean):
        address = match.group(1)
        if is_valid_location(address):
                candidates.append({
                    'location': address,
                    'type': 'address',
                    'confidence': 'high'
                })
    
    # Extract "at [address] in [city]" pattern (e.g., "at 3441 Railport Parkway in Midlothian")
    address_city_pattern = r'\b(at|on)\s+(\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Street|Avenue|Road|Drive|Lane|Boulevard|Way|Circle|Court|Place|Highway|Freeway|Parkway))\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b'
    for match in re.finditer(address_city_pattern, text_clean):
        address = match.group(2)
        city = match.group(3)
        full_location = f"{address}, {city}, Texas"
        if is_valid_location(full_location):
            candidates.append({
                'location': full_location,
                'type': 'address_with_city',
                'confidence': 'high',
                'city_context': city
            })
    
    # Extract "[address], [city], Texas" pattern
    address_city_comma_pattern = r'\b(\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Street|Avenue|Road|Drive|Lane|Boulevard|Way|Circle|Court|Place|Highway|Freeway|Parkway)),\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+Texas\b'
    for match in re.finditer(address_city_comma_pattern, text_clean):
        address = match.group(1)
        city = match.group(2)
        full_location = f"{address}, {city}, Texas"
        if is_valid_location(full_location):
            candidates.append({
                'location': full_location,
                'type': 'address_with_city',
                'confidence': 'high',
                'city_context': city
            })
    
    # Extract "along X Drive/Road" patterns
    along_pattern = r'\b(?:along|on|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|Avenue|Road|Drive|Lane|Boulevard))\b'
    for match in re.finditer(along_pattern, text_clean):
        street = match.group(1)
        if is_valid_location(street):
                    candidates.append({
                'location': street,
                'type': 'address',
                'confidence': 'high'
                    })
    
    # Extract county names with direction (e.g., "West Bexar County")
    county_pattern = r'\b(north|south|east|west|northeast|northwest|southeast|southwest)?\s*([A-Z][a-z]+\s+County)\b'
    for match in re.finditer(county_pattern, text_clean):
        direction = match.group(1)
        county = match.group(2)
        if direction:
            location = f"{direction.title()} {county}"
        else:
            location = county
        if is_valid_location(location):
                    candidates.append({
                        'location': location,
                'type': 'area',
                        'confidence': 'medium'
                    })
    
    # Extract area descriptions (e.g., "West Side", "North Texas")
    area_pattern = r'\b(north|south|east|west|northeast|northwest|southeast|southwest)\s+(?:of|in|near|side|end)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b'
    for match in re.finditer(area_pattern, text_clean):
        direction = match.group(1)
        place = match.group(2)
        if place and place.lower() not in ['texas', 'county', 'city', 'state']:
            location = f"{direction.title()} {place}"
            if is_valid_location(location):
                    candidates.append({
                        'location': location,
                        'type': 'area',
                    'confidence': 'medium'
                    })
    
    # Extract known Texas neighborhoods/towns
    text_lower = text_clean.lower()
    for city, neighborhoods in TEXAS_CITIES.items():
        for neighborhood in neighborhoods:
            pattern = r'\b' + re.escape(neighborhood) + r'\b'
            if re.search(pattern, text_lower):
                candidates.append({
                    'location': neighborhood.title(),
                    'type': 'neighborhood',
                    'confidence': 'high',
                    'city_context': city
                })
    
    # Deduplicate candidates and filter
    seen = set()
    unique_candidates = []
    for candidate in candidates:
        key = candidate['location'].lower()
        if key not in seen and is_valid_location(candidate['location']):
            seen.add(key)
            unique_candidates.append(candidate)
    
    # Sort by confidence and type (address_with_city > address > others)
    confidence_order = {'high': 0, 'medium': 1, 'low': 2}
    type_priority = {'address_with_city': 0, 'address': 1, 'neighborhood': 2, 'area': 3}
    unique_candidates.sort(key=lambda x: (
        confidence_order.get(x['confidence'], 3),
        type_priority.get(x['type'], 99)
    ))
    
    return unique_candidates

def fetch_article_from_url(url: str) -> str:
    """Fetch full article text from URL when raw_text is missing."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Try to find main article content
        # Common article selectors
        article_selectors = [
            'article',
            '[role="article"]',
            '.article-content',
            '.article-body',
            '.post-content',
            '.entry-content',
            'main',
            '.content'
        ]
        
        article_text = None
        for selector in article_selectors:
            article = soup.select_one(selector)
            if article:
                article_text = article.get_text(separator=' ', strip=True)
                if len(article_text) > 500:  # Reasonable article length
                    break
        
        # Fallback to body text
        if not article_text or len(article_text) < 500:
            body = soup.find('body')
            if body:
                article_text = body.get_text(separator=' ', strip=True)
        
        return article_text if article_text else ""
    except Exception as e:
        print(f"   ⚠️  Error fetching article: {str(e)[:100]}")
        return ""

def get_text_from_mentions(mention_ids: str, cursor, fetch_url: bool = True) -> str:
    """Get combined text from all mentions, optionally fetching from URL if raw_text missing."""
    if not mention_ids:
        return ""
    
    try:
        mention_list = json.loads(mention_ids) if isinstance(mention_ids, str) else mention_ids
        if not mention_list:
            return ""
    except:
        return ""
    
    texts = []
    urls_to_fetch = []
    
    for mention_id in mention_list:
        cursor.execute("""
            SELECT raw_text, snippet, title, url, canonical_url
            FROM mentions
            WHERE mention_id = ?
        """, (mention_id,))
        result = cursor.fetchone()
        if result:
            raw_text, snippet, title, url, canonical_url = result
            # Check if we have substantial raw_text
            if raw_text and len(raw_text) > 200:
                texts.append(raw_text)
            else:
                # Need to fetch - store URL for fetching
                article_url = canonical_url or url
                if article_url and fetch_url:
                    urls_to_fetch.append((mention_id, article_url, snippet or title or ""))
            elif snippet:
                texts.append(snippet)
            elif title:
                texts.append(title)
    
    # Fetch articles from URLs if needed
    if urls_to_fetch and fetch_url:
        for mention_id, url, fallback_text in urls_to_fetch:
            print(f"   🌐 Fetching article from URL: {url[:80]}...")
            fetched_text = fetch_article_from_url(url)
            if fetched_text and len(fetched_text) > 200:
                texts.append(fetched_text)
                # Optionally update the database with fetched text
                try:
                    cursor.execute("""
                        UPDATE mentions
                        SET raw_text = ?
                        WHERE mention_id = ?
                    """, (fetched_text, mention_id))
                except:
                    pass  # Don't fail if update doesn't work
            elif fallback_text:
                texts.append(fallback_text)
    
    return " ".join(texts)

def infer_city_from_coordinates(lat: float, lng: float) -> str:
    """Infer likely city from coordinates."""
    # Approximate city centers
    city_centers = {
        'Dallas': (32.7767, -96.7970),
        'Austin': (30.2672, -97.7431),
        'Houston': (29.7604, -95.3698),
        'San Antonio': (29.4241, -98.4936),
        'El Paso': (31.7619, -106.4850),
        'Fort Worth': (32.7555, -97.3308),
    }
    
    min_dist = float('inf')
    closest_city = None
    
    for city, (city_lat, city_lng) in city_centers.items():
        dist = ((lat - city_lat)**2 + (lng - city_lng)**2)**0.5
        if dist < min_dist:
            min_dist = dist
            closest_city = city
    
    # If within ~0.5 degrees (~50km), consider it that city
    if min_dist < 0.5:
        return closest_city
    
    return None

def validate_coordinates_against_cities(lat: float, lng: float, article_text: str) -> bool:
    """Check if coordinates are within mentioned cities in article."""
    if not article_text:
        return True  # Can't validate, assume OK
    
    text_lower = article_text.lower()
    
    # City bounding boxes (lat range, lng range)
    city_boxes = {
        'dallas': {'lat': (32.5, 33.0), 'lng': (-97.2, -96.5)},
        'austin': {'lat': (30.0, 30.5), 'lng': (-98.0, -97.5)},
        'houston': {'lat': (29.5, 30.0), 'lng': (-95.8, -95.0)},
        'san antonio': {'lat': (29.3, 29.6), 'lng': (-98.7, -98.3)},
        'fort worth': {'lat': (32.6, 32.9), 'lng': (-97.5, -97.0)},
        'midlothian': {'lat': (32.4, 32.5), 'lng': (-97.0, -96.9)},
        'el paso': {'lat': (31.6, 32.0), 'lng': (-106.6, -106.3)},
    }
    
    # Check which cities are mentioned
    mentioned_cities = []
    for city, box in city_boxes.items():
        if city in text_lower:
            mentioned_cities.append((city, box))
    
    if not mentioned_cities:
        return True  # No cities mentioned, can't validate
    
    # Check if coordinates are within any mentioned city
    for city, box in mentioned_cities:
        if (box['lat'][0] <= lat <= box['lat'][1] and 
            box['lng'][0] <= lng <= box['lng'][1]):
            return True  # Coordinates match a mentioned city
    
    return False  # Coordinates don't match any mentioned city

def main():
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Find projects needing re-extraction (expanded scope)
    print("🔍 Finding projects needing location re-extraction...")
    cursor.execute("""
        SELECT 
            p.project_id,
            p.project_name,
            p.company,
            p.location_text,
            p.site_hint,
            p.lat,
            p.lng,
            p.geocode_confidence,
            p.mention_ids,
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM projects p2
                    WHERE p2.lat = p.lat AND p2.lng = p.lng
                    AND p2.project_id != p.project_id
                ) THEN 'overlap'
                WHEN p.geocode_confidence IN ('area', 'county') THEN 'low_confidence'
                WHEN p.location_text IN ('Texas', 'Dallas-area', 'Austin-area', 'Houston-area', 'DFW', 'DFW area') THEN 'vague_location'
                WHEN (
                    p.location_text IS NOT NULL
                    AND p.location_text != ''
                    AND (
                        (p.location_text LIKE '%Dallas%' AND NOT (p.lat BETWEEN 32.5 AND 33.0 AND p.lng BETWEEN -97.2 AND -96.5))
                        OR (p.location_text LIKE '%Austin%' AND NOT (p.lat BETWEEN 30.0 AND 30.5 AND p.lng BETWEEN -98.0 AND -97.5))
                        OR (p.location_text LIKE '%Houston%' AND NOT (p.lat BETWEEN 29.5 AND 30.0 AND p.lng BETWEEN -95.8 AND -95.0))
                        OR (p.location_text LIKE '%San Antonio%' AND NOT (p.lat BETWEEN 29.3 AND 29.6 AND p.lng BETWEEN -98.7 AND -98.3))
                    )
                ) THEN 'city_mismatch'
                ELSE 'other'
            END as reason
        FROM projects p
        WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
        AND p.lat BETWEEN 25 AND 37 AND p.lng BETWEEN -107 AND -93
        AND (
            -- Overlapping coordinates (existing)
            EXISTS (
            SELECT 1 FROM projects p2
            WHERE p2.lat = p.lat AND p2.lng = p.lng
            AND p2.project_id != p.project_id
        )
            OR
            -- Low confidence geocodes
            p.geocode_confidence IN ('area', 'county')
            OR
            -- Vague location text
            p.location_text IN ('Texas', 'Dallas-area', 'Austin-area', 'Houston-area', 'DFW', 'DFW area')
            OR
            -- Projects where coordinates don't match mentioned cities
            (
                p.location_text IS NOT NULL
                AND p.location_text != ''
                AND (
                    (p.location_text LIKE '%Dallas%' AND NOT (p.lat BETWEEN 32.5 AND 33.0 AND p.lng BETWEEN -97.2 AND -96.5))
                    OR (p.location_text LIKE '%Austin%' AND NOT (p.lat BETWEEN 30.0 AND 30.5 AND p.lng BETWEEN -98.0 AND -97.5))
                    OR (p.location_text LIKE '%Houston%' AND NOT (p.lat BETWEEN 29.5 AND 30.0 AND p.lng BETWEEN -95.8 AND -95.0))
                    OR (p.location_text LIKE '%San Antonio%' AND NOT (p.lat BETWEEN 29.3 AND 29.6 AND p.lng BETWEEN -98.7 AND -98.3))
                )
            )
        )
        ORDER BY 
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM projects p2
                    WHERE p2.lat = p.lat AND p2.lng = p.lng
                    AND p2.project_id != p.project_id
                ) THEN 1
                WHEN p.geocode_confidence = 'area' THEN 2
                WHEN p.location_text = 'Texas' THEN 3
                ELSE 4
            END,
            p.company
    """)
    
    projects = cursor.fetchall()
    
    if not projects:
        print("✅ No projects found needing re-extraction")
        conn.close()
        return
    
    # Count by reason
    reason_counts = {}
    for project in projects:
        reason = project[9]  # reason is 10th column (index 9)
        reason_counts[reason] = reason_counts.get(reason, 0) + 1
    
    print(f"📊 Found {len(projects)} projects needing re-extraction:")
    for reason, count in sorted(reason_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"   - {reason}: {count} projects")
    print()
    
    improved_count = 0
    processed = set()
    
    for i, (project_id, name, company, location_text, site_hint, lat, lng, confidence, mention_ids, reason) in enumerate(projects):
        if project_id in processed:
            continue
        
        print(f"[{i+1}/{len(projects)}] {project_id}")
        print(f"   Company: {company or 'Unknown'}")
        print(f"   Current: ({lat:.6f}, {lng:.6f}) - {confidence or 'unknown'} confidence")
        print(f"   Location: {location_text or 'None'}")
        print(f"   Reason: {reason}")
        
        # Get text from all mentions (with URL fetching if needed)
        article_text = get_text_from_mentions(mention_ids, cursor, fetch_url=True)
        
        if not article_text:
            print(f"   ⚠️  No article text available")
            print()
            processed.add(project_id)
            continue
        
        # Log if we fetched from URL
        if len(article_text) > 500:  # Likely fetched full article
            print(f"   📄 Article text: {len(article_text)} chars")
        
        # Validate coordinates against mentioned cities
        is_valid = validate_coordinates_against_cities(lat, lng, article_text)
        if not is_valid:
            print(f"   ⚠️  Coordinates don't match mentioned cities - high priority for re-extraction")
        
        # Extract location candidates
        candidates = extract_locations_from_text(article_text)
        
        if not candidates:
            print(f"   ⚠️  No location candidates found in article text")
            print()
            processed.add(project_id)
            continue
        
        print(f"   🔍 Found {len(candidates)} location candidates")
        
        # Infer city context from coordinates (but don't trust it if validation failed)
        city_context = infer_city_from_coordinates(lat, lng)
        if city_context and is_valid:
            print(f"   📍 Inferred city context: {city_context}")
        elif city_context and not is_valid:
            print(f"   ⚠️  Ignoring inferred city context (coordinates don't match article)")
            city_context = None
        
        # Try geocoding candidates (limit to top 5)
        improved = False
        for candidate in candidates[:5]:
            location = candidate['location']
            candidate_city = candidate.get('city_context') or city_context
            
            print(f"   🔍 Trying: '{location}'" + (f" (in {candidate_city})" if candidate_city else ""))
            
            coords = geocode_with_context(location, candidate_city)
            
            if coords:
                # Check if new coordinates are significantly different
                lat_diff = abs(coords['lat'] - lat)
                lng_diff = abs(coords['lng'] - lng)
                
                # If coordinates are significantly different (> 0.01 degrees = ~1km), update
                # OR if validation failed (coordinates don't match article), update even if close
                should_update = False
                if lat_diff > 0.01 or lng_diff > 0.01:
                    should_update = True
                elif not is_valid:
                    # If coordinates don't match article, update even if close (might be wrong city)
                    should_update = True
                    print(f"   ⚠️  Updating despite small difference (coordinates don't match article)")
                
                if should_update:
                    print(f"   ✅ Found more precise location: ({coords['lat']:.6f}, {coords['lng']:.6f})")
                    print(f"      Confidence: {coords['confidence']}")
                    print(f"      Address: {coords['address'][:80]}...")
                    
                    # Validate new coordinates against article
                    new_is_valid = validate_coordinates_against_cities(coords['lat'], coords['lng'], article_text)
                    if new_is_valid:
                        print(f"      ✅ New coordinates match mentioned cities")
                    else:
                        print(f"      ⚠️  New coordinates still don't match - may need manual review")
                    
                    # Update database
                    cursor.execute("""
                        UPDATE projects
                        SET lat = ?, lng = ?, geocode_confidence = ?
                        WHERE project_id = ?
                    """, (coords['lat'], coords['lng'], coords['confidence'], project_id))
                    
                    improved_count += 1
                    improved = True
                    break
                else:
                    print(f"   ⚠️  Coordinates too similar to existing")
            else:
                print(f"   ❌ Could not geocode")
            
            # Rate limit
            time.sleep(1)
        
        if not improved:
            print(f"   ⚠️  Could not improve location")
        
        print()
        processed.add(project_id)
        
        # Health check every 10 projects
        if (i + 1) % 10 == 0:
            print()
            print("=" * 80)
            print(f"🏥 HEALTH CHECK - Progress: {i + 1}/{len(projects)} projects")
            print("=" * 80)
            
            # Count improvements so far
            cursor.execute("""
                SELECT COUNT(*) 
                FROM projects 
                WHERE project_id IN (
                    SELECT project_id FROM projects 
                    WHERE lat IS NOT NULL AND lng IS NOT NULL
                    AND lat BETWEEN 25 AND 37 AND lng BETWEEN -107 AND -93
                )
                AND geocode_confidence IN ('city', 'neighborhood', 'address')
            """)
            high_conf_count = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT COUNT(*) 
                FROM projects 
                WHERE lat IS NOT NULL AND lng IS NOT NULL
                AND lat BETWEEN 25 AND 37 AND lng BETWEEN -107 AND -93
            """)
            total_geocoded = cursor.fetchone()[0]
            
            print(f"   ✅ Projects improved this run: {improved_count}")
            print(f"   📊 Total high-confidence geocodes: {high_conf_count}")
            print(f"   📊 Total geocoded projects: {total_geocoded}")
            print(f"   📈 Success rate: {(improved_count / (i + 1) * 100):.1f}%")
            print(f"   ⏱️  Remaining: {len(projects) - (i + 1)} projects")
            print("=" * 80)
            print()
            
            # Commit progress
            conn.commit()
            print("💾 Committed progress...")
            print()
    
    conn.commit()
    conn.close()
    
    print(f"\n✅ Improved {improved_count} project locations")
    print(f"📊 Processed {len(processed)} projects")

if __name__ == "__main__":
    main()

