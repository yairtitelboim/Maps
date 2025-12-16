#!/usr/bin/env python3
"""
Parse Firecrawl output from interconnection.fyi Ohio page into structured JSON.

Input: /tmp/firecrawl_interconnection_oh.md.json (or path provided)
Output: data/interconnection_fyi/aep_ohio_interconnection_requests.json
        public/data/aep_ohio_interconnection_requests.geojson
"""

import json
import re
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from interconnection_fyi.ohio_county_centroids import get_county_centroid


def parse_capacity(capacity_str: str) -> Tuple[Optional[float], Optional[float]]:
    """Parse capacity string like '50 - 75 MW' or '100 MW' into min/max."""
    if not capacity_str:
        return None, None
    
    # Remove "MW" and whitespace
    capacity_str = capacity_str.strip().replace('MW', '').strip()
    
    # Pattern: "50 - 75" or "100"
    range_match = re.match(r'(\d+)\s*-\s*(\d+)', capacity_str)
    if range_match:
        return float(range_match.group(1)), float(range_match.group(2))
    
    # Single number
    single_match = re.match(r'(\d+)', capacity_str)
    if single_match:
        val = float(single_match.group(1))
        return val, val
    
    return None, None


def parse_date(date_str: str) -> Optional[str]:
    """Parse date string like '12/1/2024' into ISO format '2024-12-01'."""
    if not date_str:
        return None
    
    # Pattern: MM/DD/YYYY
    date_match = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', date_str)
    if date_match:
        month, day, year = date_match.groups()
        try:
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            return None
    
    return None


def normalize_status(status: str) -> str:
    """Normalize status strings."""
    if not status:
        return 'unknown'
    
    status_lower = status.lower()
    if 'active' in status_lower:
        return 'active'
    elif 'withdrawn' in status_lower:
        return 'withdrawn'
    elif 'operational' in status_lower:
        return 'operational'
    elif 'suspended' in status_lower:
        return 'suspended'
    return 'unknown'


def normalize_generation_type(gen_type: str) -> str:
    """Normalize generation type strings."""
    if not gen_type:
        return 'unknown'
    return gen_type.lower().strip()


def normalize_project_type(proj_type: str) -> str:
    """Normalize project type strings."""
    if not proj_type:
        return 'unknown'
    return proj_type.lower().strip()


def extract_county_name(county_str: str) -> str:
    """Extract county name, removing 'County' suffix."""
    if not county_str:
        return ''
    
    county_str = county_str.strip()
    if county_str.endswith(' County'):
        return county_str[:-7].strip()
    return county_str.strip()


def extract_project_id(url: str) -> Optional[str]:
    """Extract project ID from URL like 'pjm-aj1-023'."""
    match = re.search(r'/project/([^?]+)', url)
    return match.group(1) if match else None


def extract_projects_from_markdown(markdown: str) -> List[Dict]:
    """
    Extract project entries from markdown.
    
    Pattern:
    - Date (queue date)
    - [Open Project Details](url)
    - Capacity
    - Status
    - Generation Type
    - Project Type
    - County
    - State
    - (Optional) Completion date
    """
    projects = []
    
    # Find all "Open Project Details" links
    link_pattern = r'\[Open Project Details\]\(([^)]+)\)'
    
    for match in re.finditer(link_pattern, markdown):
        url = match.group(1)
        start_pos = match.start()
        
        # Extract project ID
        project_id = extract_project_id(url)
        if not project_id:
            continue
        
        # Get text after the link (next ~10 lines)
        text_after = markdown[start_pos:start_pos + 2000]
        lines = [line.strip() for line in text_after.split('\n') if line.strip()]
        
        # Look for date before the link (scan backwards)
        text_before = markdown[max(0, start_pos - 500):start_pos]
        date_match = re.search(r'(\d{1,2}/\d{1,2}/\d{4})(?=\s*\[Open Project Details\])', text_before)
        queue_date_str = date_match.group(1) if date_match else None
        
        # Parse fields from lines after the link
        capacity_str = None
        status = None
        gen_type = None
        proj_type = None
        county = None
        state = None
        completion_date_str = None
        
        # Skip the link line itself
        line_idx = 1
        
        # Capacity is usually first non-empty line
        if line_idx < len(lines):
            capacity_candidate = lines[line_idx]
            if 'MW' in capacity_candidate and not capacity_candidate.startswith('('):
                capacity_str = capacity_candidate
                line_idx += 1
        
        # Skip "(contact sales...)" line
        if line_idx < len(lines) and lines[line_idx].startswith('('):
            line_idx += 1
        
        # Status
        if line_idx < len(lines):
            status = lines[line_idx]
            line_idx += 1
        
        # Generation Type
        if line_idx < len(lines):
            gen_type = lines[line_idx]
            line_idx += 1
        
        # Project Type (sometimes appears twice, take first)
        if line_idx < len(lines):
            proj_type = lines[line_idx]
            line_idx += 1
        
        # Skip duplicate project type if present
        if line_idx < len(lines) and lines[line_idx].lower() == proj_type.lower() if proj_type else False:
            line_idx += 1
        
        # County
        if line_idx < len(lines):
            county_candidate = lines[line_idx]
            if 'County' in county_candidate:
                county = county_candidate
                line_idx += 1
        
        # State
        if line_idx < len(lines):
            state_candidate = lines[line_idx]
            if state_candidate in ['OH', 'OHIO']:
                state = state_candidate
                line_idx += 1
        
        # Look for completion date (usually after state)
        if line_idx < len(lines):
            date_candidate = lines[line_idx]
            date_match = re.match(r'(\d{1,2}/\d{1,2}/\d{4})', date_candidate)
            if date_match:
                completion_date_str = date_match.group(1)
        
        # Parse capacity
        capacity_min, capacity_max = parse_capacity(capacity_str) if capacity_str else (None, None)
        
        # Build project dict
        project = {
            'project_id': project_id,
            'project_url': url.split('?')[0],  # Remove query params
            'queue_date': parse_date(queue_date_str) if queue_date_str else None,
            'completion_date': parse_date(completion_date_str) if completion_date_str else None,
            'capacity_min_mw': capacity_min,
            'capacity_max_mw': capacity_max,
            'capacity_range_display': capacity_str if capacity_str else None,
            'status': normalize_status(status) if status else 'unknown',
            'generation_type': normalize_generation_type(gen_type) if gen_type else 'unknown',
            'project_type': normalize_project_type(proj_type) if proj_type else 'unknown',
            'county': extract_county_name(county) if county else None,
            'state': 'OH' if state else None,
            'power_market': 'PJM',
            '_raw': {
                'capacity_str': capacity_str,
                'status_str': status,
                'gen_type_str': gen_type,
                'proj_type_str': proj_type,
                'county_str': county,
                'state_str': state
            }
        }
        
        projects.append(project)
    
    return projects


def enrich_with_geography(projects: List[Dict]) -> List[Dict]:
    """Add geographic coordinates and spatial context."""
    enriched = []
    
    for project in projects:
        county = project.get('county')
        if not county:
            enriched.append(project)
            continue
        
        # Get county centroid
        centroid = get_county_centroid(county)
        if centroid:
            lat, lng = centroid
            project['latitude'] = lat
            project['longitude'] = lng
            project['coordinates'] = [lng, lat]  # GeoJSON format (lng, lat)
        else:
            project['latitude'] = None
            project['longitude'] = None
            project['coordinates'] = None
        
        enriched.append(project)
    
    return enriched


def calculate_distances(projects: List[Dict]) -> List[Dict]:
    """Calculate distances to Columbus center."""
    columbus_lat = 39.9612
    columbus_lng = -82.9988
    
    from math import radians, cos, sin, asin, sqrt
    
    def haversine(lon1, lat1, lon2, lat2):
        """Calculate haversine distance in km."""
        lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        r = 6371  # Earth radius in km
        return c * r
    
    enriched = []
    for project in projects:
        if project.get('latitude') and project.get('longitude'):
            lat = project['latitude']
            lng = project['longitude']
            distance_km = haversine(lng, lat, columbus_lng, columbus_lat)
            project['distance_to_columbus_center_km'] = round(distance_km, 2)
            project['is_near_columbus_10mi'] = distance_km <= 16.09  # 10 miles in km
        else:
            project['distance_to_columbus_center_km'] = None
            project['is_near_columbus_10mi'] = False
        
        enriched.append(project)
    
    return enriched


def generate_metadata(projects: List[Dict]) -> Dict:
    """Generate metadata summary."""
    status_breakdown = {}
    gen_type_breakdown = {}
    total_capacity_min = 0
    total_capacity_max = 0
    
    for project in projects:
        status = project.get('status', 'unknown')
        status_breakdown[status] = status_breakdown.get(status, 0) + 1
        
        gen_type = project.get('generation_type', 'unknown')
        gen_type_breakdown[gen_type] = gen_type_breakdown.get(gen_type, 0) + 1
        
        if project.get('capacity_min_mw'):
            total_capacity_min += project['capacity_min_mw']
        if project.get('capacity_max_mw'):
            total_capacity_max += project['capacity_max_mw']
    
    return {
        'source': 'interconnection.fyi',
        'source_url': 'https://www.interconnection.fyi/?state=OH',
        'scrape_date': datetime.now().strftime('%Y-%m-%d'),
        'total_projects': len(projects),
        'status_breakdown': status_breakdown,
        'generation_type_breakdown': gen_type_breakdown,
        'total_capacity_min_mw': round(total_capacity_min, 2),
        'total_capacity_max_mw': round(total_capacity_max, 2)
    }


def create_geojson(projects: List[Dict]) -> Dict:
    """Create GeoJSON FeatureCollection from projects."""
    features = []
    
    for project in projects:
        if not project.get('coordinates'):
            continue
        
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': project['coordinates']
            },
            'properties': {
                k: v for k, v in project.items()
                if k not in ['coordinates', 'latitude', 'longitude', '_raw']
            }
        }
        features.append(feature)
    
    return {
        'type': 'FeatureCollection',
        'features': features
    }


def validate_projects(projects: List[Dict]) -> Tuple[List[Dict], List[str]]:
    """Validate projects and return valid ones + error messages."""
    valid = []
    errors = []
    
    ohio_counties = set()  # We'll populate this from the centroid lookup
    
    for i, project in enumerate(projects):
        project_errors = []
        
        # Required fields
        if not project.get('project_id'):
            project_errors.append('Missing project_id')
        
        if not project.get('county'):
            project_errors.append('Missing county')
        
        if not project.get('state'):
            project_errors.append('Missing state')
        
        # Capacity validation
        cap_min = project.get('capacity_min_mw')
        cap_max = project.get('capacity_max_mw')
        if cap_min is not None and cap_max is not None:
            if cap_min > cap_max:
                project_errors.append(f'Invalid capacity range: {cap_min} > {cap_max}')
        
        # Coordinate validation (if present)
        lat = project.get('latitude')
        lng = project.get('longitude')
        if lat is not None and lng is not None:
            if not (38.0 <= lat <= 42.0) or not (-85.0 <= lng <= -80.0):
                project_errors.append(f'Coordinates out of Ohio bounds: ({lat}, {lng})')
        
        if project_errors:
            errors.append(f"Project {project.get('project_id', i)}: {', '.join(project_errors)}")
        else:
            valid.append(project)
    
    return valid, errors


def main():
    """Main parsing function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Parse interconnection.fyi Firecrawl output')
    parser.add_argument('input_file', nargs='?', default='/tmp/firecrawl_interconnection_oh.md.json',
                       help='Path to Firecrawl JSON output')
    parser.add_argument('--output-dir', default='data/interconnection_fyi',
                       help='Output directory for JSON files')
    parser.add_argument('--public-dir', default='public/data',
                       help='Public directory for GeoJSON files')
    
    args = parser.parse_args()
    
    # Load Firecrawl output
    print(f"📖 Loading Firecrawl output from {args.input_file}...")
    with open(args.input_file, 'r') as f:
        firecrawl_data = json.load(f)
    
    markdown = firecrawl_data['data']['markdown']
    
    # Step 1: Extract projects
    print("🔍 Extracting project entries...")
    print("   ⚠️  Note: Firecrawl may only capture the first page of the paginated table.")
    print("   ⚠️  For full dataset (256 projects), consider multiple scrapes or direct API access.")
    projects = extract_projects_from_markdown(markdown)
    print(f"   Found {len(projects)} projects")
    
    # Step 2: Enrich with geography
    print("🗺️  Adding geographic coordinates...")
    projects = enrich_with_geography(projects)
    
    # Step 3: Calculate distances
    print("📏 Calculating distances to Columbus...")
    projects = calculate_distances(projects)
    
    # Step 4: Validate
    print("✅ Validating projects...")
    valid_projects, errors = validate_projects(projects)
    print(f"   Valid: {len(valid_projects)}, Errors: {len(errors)}")
    
    if errors:
        print("\n⚠️  Validation errors:")
        for error in errors[:10]:  # Show first 10
            print(f"   {error}")
        if len(errors) > 10:
            print(f"   ... and {len(errors) - 10} more")
    
    # Step 5: Generate metadata
    print("📊 Generating metadata...")
    metadata = generate_metadata(valid_projects)
    
    # Step 6: Create output structures
    output_data = {
        'metadata': metadata,
        'projects': valid_projects
    }
    
    # Create GeoJSON
    geojson = create_geojson(valid_projects)
    
    # Write files
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    public_dir = Path(args.public_dir)
    public_dir.mkdir(parents=True, exist_ok=True)
    
    json_path = output_dir / 'aep_ohio_interconnection_requests.json'
    geojson_path = public_dir / 'aep_ohio_interconnection_requests.geojson'
    
    print(f"💾 Writing JSON to {json_path}...")
    with open(json_path, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"💾 Writing GeoJSON to {geojson_path}...")
    with open(geojson_path, 'w') as f:
        json.dump(geojson, f, indent=2)
    
    print(f"\n✅ Done! Parsed {len(valid_projects)} projects")
    print(f"   Total capacity: {metadata['total_capacity_min_mw']:.1f} - {metadata['total_capacity_max_mw']:.1f} MW")
    print(f"   Status breakdown: {metadata['status_breakdown']}")
    print(f"   Generation types: {len(metadata['generation_type_breakdown'])} types")


if __name__ == '__main__':
    main()

