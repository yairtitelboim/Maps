#!/usr/bin/env python3
"""
Breakdown of data center projects by status (active vs dead vs uncertain)
"""
import json
from pathlib import Path
from collections import Counter

def get_status_breakdown():
    """Get status breakdown of data center projects."""
    geojson_path = Path(__file__).parent.parent.parent / 'public/data/texas_data_centers.geojson'
    
    with open(geojson_path, 'r') as f:
        data = json.load(f)
    
    status_counts = Counter()
    status_by_county = {}
    total_projects = len(data.get('features', []))
    
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        status = props.get('status', 'unknown')
        county = props.get('location', '').split(',')[0].strip()  # Simple county extraction
        
        status_counts[status] += 1
        
        if county not in status_by_county:
            status_by_county[county] = Counter()
        status_by_county[county][status] += 1
    
    print("=" * 80)
    print("DATA CENTER STATUS BREAKDOWN")
    print("=" * 80)
    print(f"\n📊 Overall Status Distribution:")
    print(f"   Total projects: {total_projects}")
    print(f"\n   By Status:")
    for status, count in status_counts.most_common():
        percentage = (count / total_projects * 100) if total_projects > 0 else 0
        print(f"      • {status.upper()}: {count} projects ({percentage:.1f}%)")
    
    # Status by county (top counties)
    print(f"\n📊 Status by Top Counties:")
    county_totals = {county: sum(status_by_county[county].values()) for county in status_by_county}
    top_counties = sorted(county_totals.items(), key=lambda x: x[1], reverse=True)[:10]
    
    for county, total in top_counties:
        print(f"\n   {county} ({total} projects):")
        for status, count in status_by_county[county].most_common():
            print(f"      • {status}: {count}")
    
    # Summary statistics
    active_count = status_counts.get('active', 0)
    uncertain_count = status_counts.get('uncertain', 0)
    dead_count = status_counts.get('dead_candidate', 0) + status_counts.get('revived', 0)
    unknown_count = status_counts.get('unknown', 0)
    
    result = {
        'total_projects': total_projects,
        'status_counts': dict(status_counts),
        'status_percentages': {
            status: (count / total_projects * 100) if total_projects > 0 else 0
            for status, count in status_counts.items()
        },
        'summary': {
            'active': active_count,
            'uncertain': uncertain_count,
            'dead_or_revived': dead_count,
            'unknown': unknown_count
        },
        'status_by_county': {
            county: dict(statuses) 
            for county, statuses in status_by_county.items()
        }
    }
    
    return result

if __name__ == '__main__':
    result = get_status_breakdown()
    
    # Save to file
    output_path = Path(__file__).parent.parent.parent / 'data/analysis/story1_status_breakdown.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"\n✅ Saved to {output_path}")

