# Geocoding Improvement - Implementation Details

## Quick Stats
- **70 projects** with low confidence or vague "Texas" location
- **7 projects** with overlapping coordinates (current scope)
- **Impact**: Fixing Phase 1 will improve ~70 projects vs current ~7

## Phase 1: Expand Enhanced Extraction (IMMEDIATE)

### File: `scripts/news-output/extract_locations_from_articles.py`

### Current Query (Lines 291-312):
```python
# Only finds overlapping coordinates
WHERE EXISTS (
    SELECT 1 FROM projects p2
    WHERE p2.lat = p.lat AND p2.lng = p.lng
    AND p2.project_id != p.project_id
)
```

### New Query - Replace with:
```python
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
            WHEN p.location_text IN ('Texas', 'Dallas-area', 'Austin-area', 'Houston-area') THEN 'vague_location'
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
```

### Add City Validation Function:
```python
def validate_coordinates_against_cities(lat: float, lng: float, article_text: str) -> bool:
    """Check if coordinates are within mentioned cities in article."""
    if not article_text:
        return True  # Can't validate, assume OK
    
    text_lower = article_text.lower()
    
    # City bounding boxes
    city_boxes = {
        'dallas': {'lat': (32.5, 33.0), 'lng': (-97.2, -96.5)},
        'austin': {'lat': (30.0, 30.5), 'lng': (-98.0, -97.5)},
        'houston': {'lat': (29.5, 30.0), 'lng': (-95.8, -95.0)},
        'san antonio': {'lat': (29.3, 29.6), 'lng': (-98.7, -98.3)},
        'fort worth': {'lat': (32.6, 32.9), 'lng': (-97.5, -97.0)},
        'midlothian': {'lat': (32.4, 32.5), 'lng': (-97.0, -96.9)},
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
```

### Update Processing Loop:
```python
for i, (project_id, name, company, location_text, site_hint, lat, lng, confidence, mention_ids, reason) in enumerate(projects):
    # ... existing code ...
    
    print(f"   Reason: {reason}")
    
    # Validate coordinates against article text
    if article_text:
        is_valid = validate_coordinates_against_cities(lat, lng, article_text)
        if not is_valid:
            print(f"   ⚠️  Coordinates don't match mentioned cities - high priority for re-extraction")
    
    # ... rest of existing code ...
```

## Phase 2: Improve Address Pattern Matching

### File: `scripts/news-output/extract_locations_from_articles.py`

### Update ADDRESS_PATTERNS (Line 31-35):
```python
ADDRESS_PATTERNS = [
    # Existing patterns...
    r'\b(\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Street|Avenue|Road|Drive|Lane|Boulevard|Way|Circle|Court|Place|Highway|Freeway|Parkway))\b',
    # Add pattern for "at [address] in [city]"
    r'\b(at|on)\s+(\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Street|Avenue|Road|Drive|Lane|Boulevard|Way|Circle|Court|Place|Highway|Freeway|Parkway))\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b',
    # Add pattern for "[address], [city], Texas"
    r'\b(\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Street|Avenue|Road|Drive|Lane|Boulevard|Way|Circle|Court|Place|Highway|Freeway|Parkway)),\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+Texas\b',
]
```

### Add Function to Extract Address + City:
```python
def extract_address_with_city(text: str) -> list:
    """Extract addresses with their city context."""
    candidates = []
    
    # Pattern: "at [address] in [city]"
    pattern1 = r'\b(at|on)\s+(\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Street|Avenue|Road|Drive|Lane|Boulevard|Way|Circle|Court|Place|Highway|Freeway|Parkway))\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b'
    matches = re.finditer(pattern1, text)
    for match in matches:
        address = match.group(2)
        city = match.group(3)
        candidates.append({
            'location': f"{address}, {city}, Texas",
            'city_context': city,
            'type': 'address_with_city',
            'priority': 1  # Highest priority
        })
    
    # Pattern: "[address], [city], Texas"
    pattern2 = r'\b(\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Street|Avenue|Road|Drive|Lane|Boulevard|Way|Circle|Court|Place|Highway|Freeway|Parkway)),\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+Texas\b'
    matches = re.finditer(pattern2, text)
    for match in matches:
        address = match.group(1)
        city = match.group(2)
        candidates.append({
            'location': f"{address}, {city}, Texas",
            'city_context': city,
            'type': 'address_with_city',
            'priority': 1
        })
    
    return candidates
```

### Update extract_locations_from_text to prioritize addresses:
```python
def extract_locations_from_text(text: str) -> list:
    """Extract location candidates from text, prioritizing addresses."""
    candidates = []
    
    # First, try to extract addresses with city context (highest priority)
    address_candidates = extract_address_with_city(text)
    candidates.extend(address_candidates)
    
    # Then extract other location types...
    # (existing code)
    
    # Sort by priority
    candidates.sort(key=lambda x: x.get('priority', 99))
    
    return candidates
```

## Phase 3: Add Re-extraction Flag System

### New File: `scripts/news-output/flag_for_reextraction.py`

```python
#!/usr/bin/env python3
"""
Flag projects that need re-extraction based on various criteria.
"""

import sqlite3
from pathlib import Path

def flag_projects_for_reextraction(db_path: Path):
    """Identify and flag projects needing re-extraction."""
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Add flag column if it doesn't exist
    try:
        cursor.execute("ALTER TABLE projects ADD COLUMN needs_reextraction INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    # Reset all flags
    cursor.execute("UPDATE projects SET needs_reextraction = 0")
    
    # Flag projects based on criteria
    cursor.execute("""
        UPDATE projects
        SET needs_reextraction = 1
        WHERE (
            -- Low confidence
            geocode_confidence IN ('area', 'county')
            OR
            -- Vague locations
            location_text IN ('Texas', 'Dallas-area', 'Austin-area', 'Houston-area', 'DFW', 'DFW area')
            OR
            -- Coordinates don't match location text
            (
                location_text IS NOT NULL
                AND location_text != ''
                AND (
                    (location_text LIKE '%Dallas%' AND NOT (lat BETWEEN 32.5 AND 33.0 AND lng BETWEEN -97.2 AND -96.5))
                    OR (location_text LIKE '%Austin%' AND NOT (lat BETWEEN 30.0 AND 30.5 AND lng BETWEEN -98.0 AND -97.5))
                    OR (location_text LIKE '%Houston%' AND NOT (lat BETWEEN 29.5 AND 30.0 AND lng BETWEEN -95.8 AND -95.0))
                    OR (location_text LIKE '%San Antonio%' AND NOT (lat BETWEEN 29.3 AND 29.6 AND lng BETWEEN -98.7 AND -98.3))
                )
            )
        )
        AND lat IS NOT NULL AND lng IS NOT NULL
    """)
    
    flagged_count = cursor.rowcount
    conn.commit()
    conn.close()
    
    print(f"✅ Flagged {flagged_count} projects for re-extraction")
    return flagged_count

if __name__ == "__main__":
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    flag_projects_for_reextraction(db_path)
```

## Testing Plan

### Test Case 1: Google Texas / Midlothian
```python
# Should extract: "3441 Railport Parkway, Midlothian, Texas"
# Should geocode to: Midlothian coordinates (~32.4824, -96.9944)
# Current: Geocoded to Houston (~29.8219, -95.5448)
```

### Test Case 2: Vague "Texas" locations
```python
# Find all projects with location_text = "Texas"
# Re-extract from full article text
# Verify improved geocoding
```

### Test Case 3: Low confidence geocodes
```python
# Find all projects with geocode_confidence = 'area'
# Re-extract and verify improved confidence
```

## Rollout Steps

1. **Backup database** before making changes
2. **Test Phase 1** on sample of 10 projects
3. **Verify improvements** manually
4. **Run Phase 1** on full dataset
5. **Measure results**: Count improved projects
6. **Deploy Phase 2** improvements
7. **Run Phase 3** flagging system
8. **Schedule periodic re-extraction** for new projects

## Success Criteria

- ✅ Google Texas project geocoded to Midlothian
- ✅ 70+ low-confidence projects improved
- ✅ Address extraction working for "Parkway" addresses
- ✅ City validation catching mismatches
- ✅ No regressions in existing good geocodes

