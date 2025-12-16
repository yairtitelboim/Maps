#!/usr/bin/env python3
"""
Discover all project IDs from interconnection.fyi Ohio page.
"""

import json
import re
import sys
from pathlib import Path
from typing import List, Set

# Import from parse_interconnection_fyi
sys.path.insert(0, str(Path(__file__).parent))
try:
    from parse_interconnection_fyi import extract_projects_from_markdown
except ImportError:
    # Fallback if import fails
    def extract_projects_from_markdown(markdown: str):
        return []


def extract_project_ids_from_markdown(markdown: str) -> Set[str]:
    """
    Extract all project IDs from markdown.
    
    Looks for:
    - URLs with pattern: /project/pjm-xxx-xxx
    - Direct project ID mentions
    """
    project_ids = set()
    
    # Pattern 1: Extract from URLs
    url_pattern = r'/project/(pjm-[a-z0-9]+-[0-9]+)'
    matches = re.findall(url_pattern, markdown, re.IGNORECASE)
    project_ids.update(matches)
    
    # Pattern 2: Direct project ID mentions (standalone)
    id_pattern = r'\b(pjm-[a-z0-9]+-[0-9]+)\b'
    matches = re.findall(id_pattern, markdown, re.IGNORECASE)
    project_ids.update(matches)
    
    return project_ids


def discover_project_ids_from_firecrawl_output(firecrawl_file: str) -> List[str]:
    """
    Discover project IDs from existing Firecrawl output.
    
    Args:
        firecrawl_file: Path to Firecrawl JSON output
    
    Returns:
        List of project IDs
    """
    with open(firecrawl_file, 'r') as f:
        data = json.load(f)
    
    markdown = data['data']['markdown']
    
    # Extract project IDs
    project_ids = extract_project_ids_from_markdown(markdown)
    
    # Also extract from parsed projects
    projects = extract_projects_from_markdown(markdown)
    for project in projects:
        if project.get('project_id'):
            project_ids.add(project['project_id'])
    
    return sorted(list(project_ids))


def generate_project_urls(project_ids: List[str]) -> List[str]:
    """Generate full URLs for project pages."""
    base_url = "https://www.interconnection.fyi/project"
    return [f"{base_url}/{project_id}" for project_id in project_ids]


def save_project_ids(project_ids: List[str], output_file: str):
    """Save discovered project IDs to JSON file."""
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    data = {
        'discovered_at': str(Path(output_file).stat().st_mtime) if output_path.exists() else None,
        'total_count': len(project_ids),
        'project_ids': project_ids,
        'project_urls': generate_project_urls(project_ids)
    }
    
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"💾 Saved {len(project_ids)} project IDs to {output_file}")


def main():
    """Main discovery function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Discover project IDs from Firecrawl output')
    parser.add_argument('firecrawl_file', nargs='?', default='/tmp/firecrawl_interconnection_oh.md.json',
                       help='Path to Firecrawl JSON output')
    parser.add_argument('--output', default='data/interconnection_fyi/discovered_project_ids.json',
                       help='Output file for project IDs')
    
    args = parser.parse_args()
    
    print(f"🔍 Discovering project IDs from {args.firecrawl_file}...")
    
    project_ids = discover_project_ids_from_firecrawl_output(args.firecrawl_file)
    
    print(f"✅ Found {len(project_ids)} project IDs")
    print(f"   Sample: {project_ids[:5]}")
    
    save_project_ids(project_ids, args.output)
    
    print(f"\n📋 Next steps:")
    print(f"   1. Review discovered IDs: {args.output}")
    print(f"   2. Run batch scraper: python3 scripts/interconnection_fyi/batch_scrape_projects.py")


if __name__ == '__main__':
    main()

