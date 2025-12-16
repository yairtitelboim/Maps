#!/usr/bin/env python3
"""
Analyze timeline sync: DC announced date vs ERCOT COD (Commercial Operation Date)
"""
import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime
import re

def parse_date(date_str):
    """Parse various date formats."""
    if not date_str:
        return None
    
    # Try ISO format
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except:
        pass
    
    # Try YYYY-MM-DD
    try:
        return datetime.strptime(date_str[:10], '%Y-%m-%d')
    except:
        pass
    
    # Try YYYY
    try:
        year_match = re.search(r'(\d{4})', date_str)
        if year_match:
            return datetime(int(year_match.group(1)), 1, 1)
    except:
        pass
    
    return None

def get_timeline_sync():
    """Analyze timeline sync between DC announcements and ERCOT COD dates."""
    base_path = Path(__file__).parent.parent.parent
    
    # Load DC data
    dc_path = base_path / 'public/data/texas_data_centers.geojson'
    with open(dc_path, 'r') as f:
        dc_data = json.load(f)
    
    # Load ERCOT data
    ercot_path = base_path / 'public/data/ercot/ercot_gis_reports.geojson'
    
    # For performance, we'll sample ERCOT data or use aggregated
    # Let's use the aggregated county data and look for COD patterns
    ercot_agg_path = base_path / 'public/data/ercot/ercot_counties_aggregated.geojson'
    
    dc_timeline = []
    for feature in dc_data.get('features', []):
        props = feature.get('properties', {})
        announced_date = props.get('announced_date')
        expected_date = props.get('expected_completion_date')
        county = props.get('location', '').split(',')[0].strip()
        
        announced_dt = parse_date(announced_date) if announced_date else None
        expected_dt = None
        if expected_date:
            # Expected date might be just a year
            year_match = re.search(r'(\d{4})', expected_date)
            if year_match:
                expected_dt = datetime(int(year_match.group(1)), 1, 1)
        
        dc_timeline.append({
            'project_name': props.get('project_name', 'Unknown'),
            'county': county,
            'announced_date': announced_date,
            'announced_dt': announced_dt,
            'expected_completion_date': expected_date,
            'expected_dt': expected_dt,
            'status': props.get('status', 'unknown')
        })
    
    # Group by county and year
    dc_by_county_year = defaultdict(list)
    for dc in dc_timeline:
        if dc['announced_dt']:
            year = dc['announced_dt'].year
            county = dc['county']
            dc_by_county_year[(county, year)].append(dc)
    
    print("=" * 80)
    print("TIMELINE SYNC: DC ANNOUNCEMENTS vs ERCOT COD")
    print("=" * 80)
    
    print(f"\n📊 Data Center Announcements by Year:")
    dc_by_year = defaultdict(int)
    for dc in dc_timeline:
        if dc['announced_dt']:
            dc_by_year[dc['announced_dt'].year] += 1
    
    for year in sorted(dc_by_year.keys()):
        print(f"   {year}: {dc_by_year[year]} announcements")
    
    print(f"\n📊 Expected Completion Dates:")
    expected_by_year = defaultdict(int)
    for dc in dc_timeline:
        if dc['expected_dt']:
            expected_by_year[dc['expected_dt'].year] += 1
    
    for year in sorted(expected_by_year.keys()):
        print(f"   {year}: {expected_by_year[year]} projects expected")
    
    # Timeline gaps
    print(f"\n🔍 Timeline Analysis:")
    gaps = []
    for dc in dc_timeline:
        if dc['announced_dt'] and dc['expected_dt']:
            gap_years = (dc['expected_dt'] - dc['announced_dt']).days / 365.25
            gaps.append({
                'project': dc['project_name'],
                'county': dc['county'],
                'announced': dc['announced_dt'].year,
                'expected': dc['expected_dt'].year,
                'gap_years': gap_years
            })
    
    if gaps:
        avg_gap = sum(g['gap_years'] for g in gaps) / len(gaps)
        print(f"   Projects with both dates: {len(gaps)}")
        print(f"   Average timeline (announcement → completion): {avg_gap:.1f} years")
        print(f"   Shortest timeline: {min(g['gap_years'] for g in gaps):.1f} years")
        print(f"   Longest timeline: {max(g['gap_years'] for g in gaps):.1f} years")
    
    # Status by timeline
    print(f"\n📊 Status by Timeline:")
    status_timeline = defaultdict(lambda: {'active': 0, 'uncertain': 0, 'dead': 0, 'unknown': 0})
    for dc in dc_timeline:
        if dc['announced_dt']:
            year = dc['announced_dt'].year
            status = dc['status']
            if status == 'active':
                status_timeline[year]['active'] += 1
            elif status == 'uncertain':
                status_timeline[year]['uncertain'] += 1
            elif status in ['dead_candidate', 'revived']:
                status_timeline[year]['dead'] += 1
            else:
                status_timeline[year]['unknown'] += 1
    
    for year in sorted(status_timeline.keys()):
        stats = status_timeline[year]
        total = sum(stats.values())
        print(f"   {year}: {total} total (Active: {stats['active']}, Uncertain: {stats['uncertain']}, Dead: {stats['dead']}, Unknown: {stats['unknown']})")
    
    result = {
        'dc_timeline': dc_timeline,
        'announcements_by_year': dict(dc_by_year),
        'expected_by_year': dict(expected_by_year),
        'timeline_gaps': gaps,
        'status_by_year': {year: dict(stats) for year, stats in status_timeline.items()}
    }
    
    return result

if __name__ == '__main__':
    result = get_timeline_sync()
    
    # Save to file
    output_path = Path(__file__).parent.parent.parent / 'data/analysis/story1_timeline_sync.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(result, f, indent=2, default=str)
    
    print(f"\n✅ Saved to {output_path}")

