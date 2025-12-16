#!/usr/bin/env python3
"""
Parse individual project page data from Firecrawl batch results.

Extracts structured data from individual project detail pages.
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from interconnection_fyi.parse_interconnection_fyi import (
    parse_capacity,
    parse_date,
    normalize_status,
    normalize_generation_type,
    normalize_project_type,
    extract_county_name
)


def extract_table_value(markdown: str, field_name: str) -> Optional[str]:
    """
    Extract value from markdown table by field name.
    
    Looks for patterns like:
    | Field Name | Value |
    | Queue ID | AC1-098 |
    """
    # Pattern: | Field Name | Value | or | Field Name | Value
    # Handle escaped parentheses in field name - but don't double escape
    if r'\(' in field_name or r'\)' in field_name:
        # Already escaped, use as-is
        field_pattern = field_name
    else:
        field_pattern = re.escape(field_name)
    pattern = rf'\|\s*{field_pattern}\s*\|\s*([^|\n]+)'
    match = re.search(pattern, markdown, re.IGNORECASE | re.MULTILINE)
    if match:
        value = match.group(1).strip()
        # Remove markdown links: [text](url) -> text
        value = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', value)
        # Remove HTML tags (including <br>)
        value = re.sub(r'<[^>]+>', ' ', value)
        # Clean up whitespace
        value = re.sub(r'\s+', ' ', value)
        # Remove trailing parenthetical references like "( all interconnection requests...)"
        value = re.sub(r'\s*\([^)]*all interconnection[^)]*\)', '', value, flags=re.IGNORECASE)
        return value.strip() if value else None
    return None


def extract_project_name(markdown: str) -> Optional[str]:
    """Extract project name from markdown."""
    # Usually in the title or first heading
    title_match = re.search(r'^#\s+(.+?)\s+interconnection', markdown, re.MULTILINE | re.IGNORECASE)
    if title_match:
        return title_match.group(1).strip()
    
    # Or from table
    return extract_table_value(markdown, 'Project Name')


def extract_queue_id(markdown: str) -> Optional[str]:
    """Extract queue ID from markdown."""
    return extract_table_value(markdown, 'Queue ID')


def extract_interconnection_location(markdown: str) -> Optional[str]:
    """Extract interconnection location from markdown."""
    return extract_table_value(markdown, 'Interconnection Location')


def extract_transmission_owner(markdown: str) -> Optional[str]:
    """Extract transmission owner from markdown."""
    # Try short name first
    owner = extract_table_value(markdown, 'Transmission Owner Short Name\\(s\\)')
    if not owner:
        owner = extract_table_value(markdown, 'Transmission Owner\\(s\\)')
    if owner:
        # Remove HTML breaks
        owner = owner.replace('<br>', ' ').replace('<br/>', ' ')
        # Remove markdown links
        owner = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', owner)
        return owner.strip()
    return None


def clean_generation_type(gen_type_str: Optional[str]) -> Optional[str]:
    """Clean generation type string, extracting just the type name."""
    if not gen_type_str:
        return None
    
    # Remove parenthetical references like "( all projects of type Solar)"
    gen_type_str = re.sub(r'\s*\([^)]*all projects[^)]*\)', '', gen_type_str, flags=re.IGNORECASE)
    gen_type_str = gen_type_str.strip()
    
    # If multiple types (comma-separated), take first one
    if ',' in gen_type_str:
        gen_type_str = gen_type_str.split(',')[0].strip()
    
    # Normalize
    return normalize_generation_type(gen_type_str)


def clean_state_name(state_str: Optional[str]) -> Optional[str]:
    """Clean state name, extracting just the state abbreviation or name."""
    if not state_str:
        return None
    
    # Remove parenthetical references
    state_str = re.sub(r'\s*\([^)]*all interconnection[^)]*\)', '', state_str, flags=re.IGNORECASE)
    state_str = state_str.strip()
    
    # Extract state abbreviation if present (e.g., "North Carolina (NC)" -> "NC")
    abbr_match = re.search(r'\(([A-Z]{2})\)', state_str)
    if abbr_match:
        return abbr_match.group(1)
    
    # Common state name mappings
    state_map = {
        'North Carolina': 'NC',
        'Ohio': 'OH',
        'Pennsylvania': 'PA',
        'New York': 'NY',
        'Virginia': 'VA',
        'Maryland': 'MD',
        'West Virginia': 'WV',
        'Kentucky': 'KY',
        'Indiana': 'IN',
        'Michigan': 'MI',
        'Illinois': 'IL',
        'New Jersey': 'NJ',
        'Delaware': 'DE',
        'District of Columbia': 'DC',
    }
    
    for name, abbr in state_map.items():
        if name in state_str:
            return abbr
    
    return state_str


def extract_utility(markdown: str) -> Optional[str]:
    """Extract utility from markdown."""
    return extract_table_value(markdown, 'Utility')


def extract_proposed_completion_date(markdown: str) -> Optional[str]:
    """Extract proposed completion date from markdown."""
    date_str = extract_table_value(markdown, 'Proposed Completion Date')
    if date_str:
        # Parse various date formats
        return parse_date(date_str)
    return None


def extract_queue_date_from_table(markdown: str) -> Optional[str]:
    """Extract queue date from table."""
    date_str = extract_table_value(markdown, 'Queue Date')
    if date_str:
        return parse_date(date_str)
    return None


def parse_individual_project_page(result: Dict) -> Dict:
    """
    Parse a single project page from Firecrawl batch result.
    
    Args:
        result: Firecrawl API response for a project page
    
    Returns:
        Parsed project data dictionary
    """
    if not result or not result.get('data'):
        return {}
    
    data = result['data']
    markdown = data.get('markdown', '')
    url = result.get('url', '')
    
    # Extract project ID from URL
    project_id_match = re.search(r'/project/([^?]+)', url)
    project_id = project_id_match.group(1) if project_id_match else None
    
    # Extract all fields
    project = {
        'project_id': project_id,
        'project_url': url.split('?')[0] if url else None,
        'project_name': extract_project_name(markdown),
        'queue_id': extract_queue_id(markdown),
        'status': normalize_status(extract_table_value(markdown, 'Status')),
        'power_market': extract_table_value(markdown, 'Power Market'),
        'utility': extract_utility(markdown),
        'project_type': normalize_project_type(extract_table_value(markdown, 'Project Type')),
        'generation_type': clean_generation_type(extract_table_value(markdown, 'Generation Type\\(s\\)') or extract_table_value(markdown, 'Generation Type')),
        'county': extract_county_name(extract_table_value(markdown, 'County')),
        'state': clean_state_name(extract_table_value(markdown, 'State')),
        'interconnection_location': extract_interconnection_location(markdown),
        'transmission_owner': extract_transmission_owner(markdown),
        'queue_date': extract_queue_date_from_table(markdown),
        'proposed_completion_date': extract_proposed_completion_date(markdown),
    }
    
    # Parse capacity
    capacity_str = extract_table_value(markdown, 'Capacity Range \\(MW\\)')
    if capacity_str:
        # Remove "Purchase data" links
        capacity_str = re.sub(r'\([^)]*Purchase[^)]*\)', '', capacity_str).strip()
        capacity_min, capacity_max = parse_capacity(capacity_str)
        project['capacity_min_mw'] = capacity_min
        project['capacity_max_mw'] = capacity_max
        project['capacity_range_display'] = capacity_str
    else:
        project['capacity_min_mw'] = None
        project['capacity_max_mw'] = None
        project['capacity_range_display'] = None
    
    # Extract changes (if any)
    changes_str = extract_table_value(markdown, 'Changes in the last 1 week')
    if changes_str:
        project['recent_changes'] = changes_str
    else:
        project['recent_changes'] = None
    
    return project


def parse_batch_file(batch_file: Path) -> List[Dict]:
    """
    Parse all projects from a batch file.
    
    Args:
        batch_file: Path to batch JSON file
    
    Returns:
        List of parsed project dictionaries
    """
    with open(batch_file, 'r') as f:
        batch_data = json.load(f)
    
    results = batch_data.get('results', [])
    parsed_projects = []
    
    for result in results:
        parsed = parse_individual_project_page(result)
        if parsed:
            parsed_projects.append(parsed)
    
    return parsed_projects


def parse_all_batches(raw_dir: Path) -> List[Dict]:
    """
    Parse all batch files in the raw directory.
    
    Args:
        raw_dir: Directory containing batch JSON files
    
    Returns:
        List of all parsed projects
    """
    batch_files = sorted(raw_dir.glob("batch_*.json"))
    
    all_projects = []
    for batch_file in batch_files:
        print(f"📖 Parsing {batch_file.name}...")
        projects = parse_batch_file(batch_file)
        all_projects.extend(projects)
        print(f"   Extracted {len(projects)} projects")
    
    return all_projects


def main():
    """Main parsing function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Parse individual project pages from batch results')
    parser.add_argument('--raw-dir', default='data/interconnection_fyi/raw',
                       help='Directory containing batch JSON files')
    parser.add_argument('--output', default='data/interconnection_fyi/parsed_projects.json',
                       help='Output file for parsed projects')
    parser.add_argument('--batch-file', type=str,
                       help='Parse single batch file instead of all')
    
    args = parser.parse_args()
    
    raw_dir = Path(args.raw_dir)
    
    if args.batch_file:
        # Parse single batch file
        batch_file = Path(args.batch_file)
        print(f"📖 Parsing single batch file: {batch_file}")
        projects = parse_batch_file(batch_file)
    else:
        # Parse all batch files
        print(f"📖 Parsing all batch files from {raw_dir}...")
        projects = parse_all_batches(raw_dir)
    
    print(f"\n✅ Parsed {len(projects)} projects")
    
    # Save results
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    output_data = {
        'metadata': {
            'parsed_at': datetime.now().isoformat(),
            'total_projects': len(projects),
            'source': 'interconnection.fyi individual project pages'
        },
        'projects': projects
    }
    
    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"💾 Saved parsed projects to {output_path}")
    
    # Summary statistics
    if projects:
        statuses = {}
        gen_types = {}
        states = {}
        
        for project in projects:
            status = project.get('status', 'unknown')
            statuses[status] = statuses.get(status, 0) + 1
            
            gen_type = project.get('generation_type', 'unknown')
            gen_types[gen_type] = gen_types.get(gen_type, 0) + 1
            
            state = project.get('state', 'unknown')
            states[state] = states.get(state, 0) + 1
        
        print(f"\n📊 Summary:")
        print(f"   Status breakdown: {statuses}")
        print(f"   Generation types: {gen_types}")
        print(f"   States: {states}")


if __name__ == '__main__':
    main()

