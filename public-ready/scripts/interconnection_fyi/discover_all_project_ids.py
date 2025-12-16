#!/usr/bin/env python3
"""
Discover all 256 project IDs from interconnection.fyi.

Strategies:
1. Try scraping projects listing page
2. Try pagination on main Ohio page
3. Check for Airtable API access
4. Use Firecrawl crawl feature
"""

import os
import json
import re
import sys
import requests
from pathlib import Path
from typing import List, Set
from dotenv import load_dotenv

load_dotenv()

FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY") or os.environ.get("firecrawl")
FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"


def extract_project_ids_from_text(text: str) -> Set[str]:
    """Extract all PJM project IDs from text."""
    project_ids = set()
    
    # Pattern: pjm-{queue}{num}-{proj_num}
    pattern = r'\b(pjm-[a-z]+\d+-\d+)\b'
    matches = re.findall(pattern, text, re.IGNORECASE)
    project_ids.update(matches)
    
    return project_ids


def scrape_with_firecrawl(url: str) -> dict:
    """Scrape a URL with Firecrawl."""
    if not FIRECRAWL_API_KEY:
        print("⚠️  No Firecrawl API key found")
        return {}
    
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
        return response.json()
    except Exception as e:
        print(f"❌ Error scraping {url}: {e}")
        return {}


def discover_from_projects_listing() -> Set[str]:
    """Try to discover project IDs from projects listing page."""
    print("🔍 Strategy 1: Trying projects listing page...")
    
    urls_to_try = [
        "https://www.interconnection.fyi/projects?state=OH",
        "https://www.interconnection.fyi/projects",
        "https://www.interconnection.fyi/?state=OH&view=all",
    ]
    
    all_ids = set()
    
    for url in urls_to_try:
        print(f"   Scraping {url}...")
        result = scrape_with_firecrawl(url)
        
        if result.get('data'):
            markdown = result['data'].get('markdown', '')
            html = result['data'].get('html', '')
            text = markdown + ' ' + html
            
            ids = extract_project_ids_from_text(text)
            all_ids.update(ids)
            print(f"   Found {len(ids)} project IDs")
    
    return all_ids


def discover_from_pagination() -> Set[str]:
    """Try to discover project IDs by scraping paginated pages."""
    print("🔍 Strategy 2: Trying pagination...")
    
    # Try different pagination approaches
    base_url = "https://www.interconnection.fyi/?state=OH"
    
    # Check if there are pagination parameters we can use
    # Airtable embeds sometimes support offset parameters
    all_ids = set()
    
    # Try a few different approaches
    test_urls = [
        base_url,
        f"{base_url}&offset=0",
        f"{base_url}&page=1",
    ]
    
    for url in test_urls:
        print(f"   Scraping {url}...")
        result = scrape_with_firecrawl(url)
        
        if result.get('data'):
            markdown = result['data'].get('markdown', '')
            html = result['data'].get('html', '')
            text = markdown + ' ' + html
            
            ids = extract_project_ids_from_text(text)
            all_ids.update(ids)
            print(f"   Found {len(ids)} project IDs")
    
    return all_ids


def discover_from_airtable_api() -> Set[str]:
    """Try to discover project IDs from Airtable API (if exposed)."""
    print("🔍 Strategy 3: Checking for Airtable API access...")
    
    # interconnection.fyi uses Airtable embed
    # The embed might make API calls we can intercept
    # But this would require browser inspection, not Firecrawl
    
    print("   ⚠️  Airtable API access requires browser inspection")
    print("   This would need manual network request analysis")
    
    return set()


def generate_candidate_ids() -> Set[str]:
    """
    Generate candidate project IDs based on discovered patterns.
    
    This is a fallback - we'll try to generate likely IDs based on
    the patterns we've seen, but we can't know for sure which exist.
    """
    print("🔍 Strategy 4: Generating candidate IDs from patterns...")
    
    # From discovered IDs, we see patterns:
    # - ac1: 98-99
    # - ac2: 84
    # - ag1: 100
    # - ai2: 251-491 (big range!)
    # - aj1: 8-23
    
    # This is risky - we don't know the full ranges
    # Better to discover them properly
    
    print("   ⚠️  Pattern-based generation is unreliable")
    print("   We need actual discovery, not guessing")
    
    return set()


def main():
    """Main discovery function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Discover all project IDs from interconnection.fyi')
    parser.add_argument('--output', default='data/interconnection_fyi/discovered_project_ids.json',
                       help='Output file for project IDs')
    parser.add_argument('--strategy', choices=['all', 'listing', 'pagination', 'api'],
                       default='all', help='Discovery strategy to use')
    
    args = parser.parse_args()
    
    print("🔍 Discovering all project IDs from interconnection.fyi...")
    print(f"   Target: 256 Ohio projects")
    print(f"   Current: 16 discovered")
    print(f"   Missing: ~240 project IDs\n")
    
    all_ids = set()
    
    # Load existing IDs
    existing_file = Path(args.output)
    if existing_file.exists():
        with open(existing_file, 'r') as f:
            existing_data = json.load(f)
            all_ids.update(existing_data.get('project_ids', []))
            print(f"📂 Loaded {len(all_ids)} existing project IDs")
    
    # Run discovery strategies
    if args.strategy in ['all', 'listing']:
        listing_ids = discover_from_projects_listing()
        all_ids.update(listing_ids)
        print(f"   Total after listing: {len(all_ids)}")
    
    if args.strategy in ['all', 'pagination']:
        pagination_ids = discover_from_pagination()
        all_ids.update(pagination_ids)
        print(f"   Total after pagination: {len(all_ids)}")
    
    if args.strategy in ['all', 'api']:
        api_ids = discover_from_airtable_api()
        all_ids.update(api_ids)
        print(f"   Total after API check: {len(all_ids)}")
    
    # Save results
    project_ids = sorted(list(all_ids))
    
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    data = {
        'discovered_at': str(Path(args.output).stat().st_mtime) if output_path.exists() else None,
        'total_count': len(project_ids),
        'project_ids': project_ids,
        'project_urls': [f"https://www.interconnection.fyi/project/{pid}" for pid in project_ids]
    }
    
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"\n✅ Discovery complete!")
    print(f"   Total project IDs: {len(project_ids)}")
    print(f"   Still missing: {256 - len(project_ids)}")
    print(f"\n💾 Saved to {args.output}")
    
    if len(project_ids) < 256:
        print(f"\n⚠️  Still missing {256 - len(project_ids)} project IDs")
        print(f"   Options:")
        print(f"   1. Manual export from interconnection.fyi")
        print(f"   2. Browser inspection for Airtable API")
        print(f"   3. Contact interconnection.fyi for data access")
        print(f"   4. Use discovered IDs and note limitation")


if __name__ == '__main__':
    main()

