#!/usr/bin/env python3
"""
Compare data center locations vs ERCOT energy capacity by county.
Generate mismatch analysis report.
"""
import json
from pathlib import Path
from datetime import datetime

def normalize_county_name(name):
    """Normalize county name for matching."""
    if not name:
        return None
    # Remove "County" suffix, lowercase, strip
    name = name.replace(' County', '').replace(' county', '').strip().lower()
    return name

def compare_mismatch():
    """Compare DC counties vs ERCOT counties."""
    # Load data
    base_path = Path(__file__).parent.parent.parent
    dc_path = base_path / 'data/analysis/story1_dc_by_county.json'
    ercot_path = base_path / 'data/analysis/story1_ercot_by_county.json'
    
    if not dc_path.exists():
        print(f"❌ Error: {dc_path} not found. Run story1_extract_dc_by_county.py first.")
        return
    
    if not ercot_path.exists():
        print(f"❌ Error: {ercot_path} not found. Run story1_extract_ercot_by_county.py first.")
        return
    
    with open(dc_path, 'r') as f:
        dc_data = json.load(f)
        dc_by_county = dc_data.get('county_counts', {})
    
    with open(ercot_path, 'r') as f:
        ercot_by_county = json.load(f)
    
    # Get top 10 for each
    top10_dc = list(dc_by_county.items())[:10]
    top10_ercot = sorted(
        ercot_by_county.items(),
        key=lambda x: x[1]['total_capacity_mw'],
        reverse=True
    )[:10]
    
    # Normalize names for matching
    dc_counties_normalized = {normalize_county_name(k): k for k, v in top10_dc}
    ercot_counties_normalized = {normalize_county_name(k): k for k, v in top10_ercot}
    
    # Find overlap
    overlap = set(dc_counties_normalized.keys()) & set(ercot_counties_normalized.keys())
    dc_only = set(dc_counties_normalized.keys()) - set(ercot_counties_normalized.keys())
    ercot_only = set(ercot_counties_normalized.keys()) - set(dc_counties_normalized.keys())
    
    # Check for counties in ERCOT top 10 that have DCs but aren't in DC top 10
    ercot_with_dcs_but_not_top10 = []
    for ercot_county in ercot_only:
        ercot_original = ercot_counties_normalized[ercot_county]
        dc_count = dc_by_county.get(ercot_original, 0)
        if dc_count > 0:
            ercot_with_dcs_but_not_top10.append(ercot_original)
    
    # Generate report
    report = {
        'analysis_date': datetime.now().isoformat(),
        'top10_dc_counties': [
            {
                'county': county,
                'dc_count': count,
                'ercot_capacity_mw': ercot_by_county.get(county, {}).get('total_capacity_mw', 0),
                'ercot_project_count': ercot_by_county.get(county, {}).get('project_count', 0)
            }
            for county, count in top10_dc
        ],
        'top10_ercot_counties': [
            {
                'county': county,
                'total_capacity_mw': data['total_capacity_mw'],
                'project_count': data['project_count'],
                'dc_count': dc_by_county.get(county, 0)
            }
            for county, data in top10_ercot
        ],
        'overlap_analysis': {
            'overlap_count': len(overlap),
            'overlap_percentage': len(overlap) / 10 * 100,
            'overlapping_counties': [dc_counties_normalized[c] for c in overlap],
            'dc_only_counties': [dc_counties_normalized[c] for c in dc_only],
            'ercot_only_counties': [ercot_counties_normalized[c] for c in ercot_only],
            'ercot_top10_with_dcs_but_not_dc_top10': ercot_with_dcs_but_not_top10
        },
        'mismatch_interpretation': {
            'overlap_level': 'high' if len(overlap) >= 7 else 'medium' if len(overlap) >= 4 else 'low',
            'has_mismatch': len(overlap) < 7,
            'mismatch_severity': 'severe' if len(overlap) <= 3 else 'moderate' if len(overlap) <= 5 else 'minor'
        }
    }
    
    # Print report
    print("=" * 80)
    print("STORY 1: THE MISMATCH - ANALYSIS RESULTS")
    print("=" * 80)
    
    print(f"\n📊 Top 10 Counties by Data Center Count:")
    for i, entry in enumerate(report['top10_dc_counties'], 1):
        print(f"   {i}. {entry['county']}: {entry['dc_count']} DCs | "
              f"ERCOT: {entry['ercot_capacity_mw']:,.0f} MW ({entry['ercot_project_count']} projects)")
    
    print(f"\n📊 Top 10 Counties by ERCOT Energy Capacity:")
    for i, entry in enumerate(report['top10_ercot_counties'], 1):
        print(f"   {i}. {entry['county']}: {entry['total_capacity_mw']:,.0f} MW ({entry['project_count']} projects) | "
              f"DCs: {entry['dc_count']}")
    
    print(f"\n🔍 Overlap Analysis:")
    print(f"   Overlapping counties: {len(overlap)}/10 ({len(overlap)/10*100:.0f}%)")
    print(f"   Overlap level: {report['mismatch_interpretation']['overlap_level'].upper()}")
    print(f"   Has mismatch: {'✅ YES' if report['mismatch_interpretation']['has_mismatch'] else '❌ NO'}")
    print(f"   Mismatch severity: {report['mismatch_interpretation']['mismatch_severity'].upper()}")
    
    if overlap:
        print(f"\n   ✅ Overlapping Counties:")
        for county in report['overlap_analysis']['overlapping_counties']:
            dc_count = dc_by_county.get(county, 0)
            ercot_data = ercot_by_county.get(county, {})
            print(f"      • {county}: {dc_count} DCs, {ercot_data.get('total_capacity_mw', 0):,.0f} MW energy")
    
    if dc_only:
        print(f"\n   ⚠️  DC-Only Counties (DCs but low energy):")
        for county in report['overlap_analysis']['dc_only_counties']:
            dc_count = dc_by_county.get(county, 0)
            ercot_cap = ercot_by_county.get(county, {}).get('total_capacity_mw', 0)
            print(f"      • {county}: {dc_count} DCs, {ercot_cap:,.0f} MW energy")
    
    if ercot_only:
        print(f"\n   ⚠️  Energy-Only Counties (Energy but not in DC top 10):")
        for county in report['overlap_analysis']['ercot_only_counties']:
            ercot_data = ercot_by_county.get(county, {})
            dc_count = dc_by_county.get(county, 0)
            if dc_count > 0:
                print(f"      • {county}: {ercot_data.get('total_capacity_mw', 0):,.0f} MW energy ({ercot_data.get('project_count', 0)} projects), {dc_count} DCs ⚠️ (has DCs but not in top 10)")
            else:
                print(f"      • {county}: {ercot_data.get('total_capacity_mw', 0):,.0f} MW energy ({ercot_data.get('project_count', 0)} projects), {dc_count} DCs")
    
    # Generate story hook if mismatch exists
    if report['mismatch_interpretation']['has_mismatch']:
        print(f"\n" + "=" * 80)
        print("🎯 STORY HOOK:")
        print("=" * 80)
        
        dc_counties_str = ", ".join(report['overlap_analysis']['dc_only_counties'][:5])
        ercot_counties_str = ", ".join(report['overlap_analysis']['ercot_only_counties'][:5])
        
        print(f"\n\"Data centers are clustering in [{dc_counties_str}]")
        print(f"but energy infrastructure is building out in [{ercot_counties_str}]. ")
        print(f"This is a $50B coordination problem.\"")
        print(f"\nHook: The buildout is happening in the wrong places")
    
    # Save report
    output_path = base_path / 'data/analysis/story1_mismatch_report.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n✅ Report saved to {output_path}")
    
    return report

if __name__ == '__main__':
    compare_mismatch()

