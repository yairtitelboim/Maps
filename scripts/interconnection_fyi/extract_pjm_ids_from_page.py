#!/usr/bin/env python3
"""
Extract all PJM project IDs from interconnection.fyi Ohio page.
The page embeds JSON data in __NEXT_DATA__ script tag.
"""

import json
import re
import sys
import requests
from pathlib import Path
from typing import List, Set

def extract_pjm_ids_from_next_data(html: str) -> Set[str]:
    """Extract PJM project IDs from __NEXT_DATA__ JSON."""
    pjm_ids = set()
    
    # Find __NEXT_DATA__ script tag
    match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not match:
        print("⚠️  Could not find __NEXT_DATA__ script tag")
        return pjm_ids
    
    try:
        next_data = json.loads(match.group(1))
        
        # Navigate through the JSON structure to find projects
        # The structure might be in props.pageProps or similar
        def find_projects(obj, path=""):
            """Recursively search for project data."""
            if isinstance(obj, dict):
                # Check if this looks like project data
                if 'id' in obj and isinstance(obj['id'], str) and obj['id'].startswith('pjm-'):
                    pjm_ids.add(obj['id'])
                
                # Also check for arrays of projects
                if 'projects' in obj and isinstance(obj['projects'], list):
                    for proj in obj['projects']:
                        if isinstance(proj, dict) and 'id' in proj:
                            if proj['id'].startswith('pjm-'):
                                pjm_ids.add(proj['id'])
                
                # Recurse into nested structures
                for key, value in obj.items():
                    find_projects(value, f"{path}.{key}")
            
            elif isinstance(obj, list):
                for item in obj:
                    find_projects(item, path)
        
        find_projects(next_data)
        
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing JSON: {e}")
    
    return pjm_ids


def extract_pjm_ids_from_text(text: str) -> Set[str]:
    """Extract PJM project IDs using regex."""
    pjm_ids = set()
    
    # Pattern: pjm-{queue}{num}-{proj_num}
    pattern = r'\b(pjm-[a-z]+\d+-\d+)\b'
    matches = re.findall(pattern, text, re.IGNORECASE)
    pjm_ids.update(matches)
    
    return pjm_ids


def main():
    """Main extraction function."""
    output_file = Path('data/interconnection_fyi/discovered_project_ids.json')
    
    print("🔍 Fetching interconnection.fyi Ohio page...")
    
    try:
        response = requests.get(
            "https://www.interconnection.fyi/?state=OH",
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            timeout=30
        )
        response.raise_for_status()
        html = response.text
        
        print(f"✅ Fetched page ({len(html)} bytes)")
        
        # Extract from __NEXT_DATA__
        print("🔍 Extracting from __NEXT_DATA__ JSON...")
        ids_from_json = extract_pjm_ids_from_next_data(html)
        print(f"   Found {len(ids_from_json)} PJM IDs from JSON")
        
        # Also extract from text (fallback)
        print("🔍 Extracting from text (regex)...")
        ids_from_text = extract_pjm_ids_from_text(html)
        print(f"   Found {len(ids_from_text)} PJM IDs from text")
        
        # Combine
        all_ids = ids_from_json | ids_from_text
        
        # Load existing IDs
        existing_ids = set()
        if output_file.exists():
            with open(output_file, 'r') as f:
                data = json.load(f)
                existing_ids = set(data.get('project_ids', []))
        
        # Merge
        all_ids.update(existing_ids)
        
        project_ids = sorted(list(all_ids))
        
        # Save
        output_file.parent.mkdir(parents=True, exist_ok=True)
        data = {
            'discovered_at': None,
            'total_count': len(project_ids),
            'project_ids': project_ids,
            'project_urls': [f"https://www.interconnection.fyi/project/{pid}" for pid in project_ids]
        }
        
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"\n✅ Extraction complete!")
        print(f"   Total PJM project IDs: {len(project_ids)}")
        print(f"   Target: 256 Ohio projects")
        print(f"   Missing: {max(0, 256 - len(project_ids))}")
        print(f"\n💾 Saved to {output_file}")
        
        if len(project_ids) < 256:
            print(f"\n⚠️  Still missing {256 - len(project_ids)} project IDs")
            print(f"   The page may be paginated. Try:")
            print(f"   1. Scroll through the page to load more projects")
            print(f"   2. Check browser network requests for API calls")
            print(f"   3. Try different URL parameters")
        else:
            print(f"\n🎉 Found all {len(project_ids)} project IDs!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()

