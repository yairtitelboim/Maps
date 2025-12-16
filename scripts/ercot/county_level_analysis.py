#!/usr/bin/env python3
"""
County-Level Infrastructure Analysis
Test relationship between infrastructure buildout and data center locations
"""

import pandas as pd
from pathlib import Path
import json

def load_ercot_data():
    """Load ERCOT 2023 data."""
    df = pd.read_csv('data/ercot/processed/ercot_2023_100mw_filtered.csv')
    return df

def load_dc_locations():
    """Load data center locations."""
    df = pd.read_csv('data/ercot/dc_locations.csv')
    return df

def analyze_county_infrastructure(ercot_df):
    """Analyze infrastructure by county."""
    
    print("=" * 60)
    print("Question 1: Which Texas counties had the most battery + gas capacity filed in 2023?")
    print("=" * 60)
    print()
    
    # Filter to battery and gas projects
    battery_gas = ercot_df[ercot_df['type_clean'].isin(['Battery', 'Gas'])].copy()
    
    # Group by county and sum capacity
    county_totals = battery_gas.groupby('county').agg({
        'mw1': 'sum',
        'q_id': 'count'
    }).reset_index()
    county_totals.columns = ['county', 'total_capacity_mw', 'project_count']
    
    # Add breakdown by type
    battery_by_county = battery_gas[battery_gas['type_clean'] == 'Battery'].groupby('county')['mw1'].sum().reset_index()
    battery_by_county.columns = ['county', 'battery_capacity_mw']
    
    gas_by_county = battery_gas[battery_gas['type_clean'] == 'Gas'].groupby('county')['mw1'].sum().reset_index()
    gas_by_county.columns = ['county', 'gas_capacity_mw']
    
    # Merge
    county_analysis = county_totals.merge(battery_by_county, on='county', how='left')
    county_analysis = county_analysis.merge(gas_by_county, on='county', how='left')
    county_analysis['battery_capacity_mw'] = county_analysis['battery_capacity_mw'].fillna(0)
    county_analysis['gas_capacity_mw'] = county_analysis['gas_capacity_mw'].fillna(0)
    
    # Sort by total capacity
    county_analysis = county_analysis.sort_values('total_capacity_mw', ascending=False)
    
    print("Top 20 Counties by Battery + Gas Capacity (2023):")
    print()
    print(f"{'County':<20} {'Total MW':>12} {'Projects':>10} {'Battery MW':>12} {'Gas MW':>10}")
    print("-" * 70)
    
    for _, row in county_analysis.head(20).iterrows():
        print(f"{row['county']:<20} {row['total_capacity_mw']:>12,.0f} {int(row['project_count']):>10} {row['battery_capacity_mw']:>12,.0f} {row['gas_capacity_mw']:>10,.0f}")
    
    print()
    print(f"Total counties with battery + gas: {len(county_analysis)}")
    print(f"Total capacity: {county_analysis['total_capacity_mw'].sum():,.0f} MW")
    print()
    
    return county_analysis

def analyze_dc_counties(dc_df):
    """Analyze which counties have data centers."""
    
    print("=" * 60)
    print("Question 2: Which counties have known data centers?")
    print("=" * 60)
    print()
    
    dc_by_county = dc_df.groupby('county').agg({
        'dc_id': 'count',
        'company': lambda x: ', '.join(x.unique()),
        'name': lambda x: ', '.join(x)
    }).reset_index()
    dc_by_county.columns = ['county', 'dc_count', 'companies', 'dc_names']
    
    print("Counties with Data Centers:")
    print()
    for _, row in dc_by_county.iterrows():
        print(f"  {row['county']} County:")
        print(f"    Data Centers: {int(row['dc_count'])}")
        print(f"    Companies: {row['companies']}")
        print(f"    Names: {row['dc_names']}")
        print()
    
    return dc_by_county

def check_overlap(county_analysis, dc_by_county):
    """Check for overlap between infrastructure and data centers."""
    
    print("=" * 60)
    print("Question 3: Is there overlap?")
    print("=" * 60)
    print()
    
    # Get counties with data centers
    dc_counties = set(dc_by_county['county'].str.upper())
    
    # Check which infrastructure counties have data centers
    county_analysis['has_dc'] = county_analysis['county'].str.upper().isin(dc_counties)
    
    # Separate into with/without DC
    with_dc = county_analysis[county_analysis['has_dc']].copy()
    without_dc = county_analysis[~county_analysis['has_dc']].copy()
    
    print("Counties with BOTH infrastructure AND data centers:")
    print()
    if len(with_dc) > 0:
        print(f"{'County':<20} {'Total MW':>12} {'Projects':>10} {'DC Count':>10}")
        print("-" * 55)
        for _, row in with_dc.iterrows():
            dc_count = dc_by_county[dc_by_county['county'].str.upper() == row['county'].upper()]['dc_count'].values[0]
            print(f"{row['county']:<20} {row['total_capacity_mw']:>12,.0f} {int(row['project_count']):>10} {int(dc_count):>10}")
        print()
        print(f"Total: {len(with_dc)} counties")
        print(f"Total capacity in these counties: {with_dc['total_capacity_mw'].sum():,.0f} MW")
        print(f"Percentage of total capacity: {with_dc['total_capacity_mw'].sum() / county_analysis['total_capacity_mw'].sum() * 100:.1f}%")
    else:
        print("  ❌ NO OVERLAP FOUND")
        print("  No counties with both infrastructure and data centers")
    
    print()
    print("Counties with infrastructure BUT NO data centers:")
    print(f"  {len(without_dc)} counties")
    print(f"  Total capacity: {without_dc['total_capacity_mw'].sum():,.0f} MW")
    print()
    
    # Check counties with DCs but no infrastructure
    infra_counties = set(county_analysis['county'].str.upper())
    dc_only = dc_by_county[~dc_by_county['county'].str.upper().isin(infra_counties)]
    
    if len(dc_only) > 0:
        print("Counties with data centers BUT NO infrastructure (2023):")
        for _, row in dc_only.iterrows():
            print(f"  {row['county']} County: {int(row['dc_count'])} data centers")
        print()
    
    return with_dc, without_dc

def statistical_analysis(county_analysis, dc_by_county):
    """Statistical analysis of the pattern."""
    
    print("=" * 60)
    print("Question 4: Does this suggest a pattern worth tracking?")
    print("=" * 60)
    print()
    
    # Get counties with data centers
    dc_counties = set(dc_by_county['county'].str.upper())
    county_analysis['has_dc'] = county_analysis['county'].str.upper().isin(dc_counties)
    
    # Calculate statistics
    total_counties = len(county_analysis)
    counties_with_dc = county_analysis['has_dc'].sum()
    counties_without_dc = total_counties - counties_with_dc
    
    total_capacity = county_analysis['total_capacity_mw'].sum()
    capacity_with_dc = county_analysis[county_analysis['has_dc']]['total_capacity_mw'].sum()
    capacity_without_dc = total_capacity - capacity_with_dc
    
    print("Statistical Summary:")
    print()
    print(f"Total counties with battery + gas infrastructure: {total_counties}")
    print(f"  - Counties WITH data centers: {counties_with_dc} ({counties_with_dc/total_counties*100:.1f}%)")
    print(f"  - Counties WITHOUT data centers: {counties_without_dc} ({counties_without_dc/total_counties*100:.1f}%)")
    print()
    print(f"Total capacity (battery + gas): {total_capacity:,.0f} MW")
    print(f"  - Capacity in counties WITH data centers: {capacity_with_dc:,.0f} MW ({capacity_with_dc/total_capacity*100:.1f}%)")
    print(f"  - Capacity in counties WITHOUT data centers: {capacity_without_dc:,.0f} MW ({capacity_without_dc/total_capacity*100:.1f}%)")
    print()
    
    # Calculate average capacity per county
    avg_with_dc = capacity_with_dc / counties_with_dc if counties_with_dc > 0 else 0
    avg_without_dc = capacity_without_dc / counties_without_dc if counties_without_dc > 0 else 0
    
    print("Average capacity per county:")
    print(f"  - Counties WITH data centers: {avg_with_dc:,.0f} MW/county")
    print(f"  - Counties WITHOUT data centers: {avg_without_dc:,.0f} MW/county")
    if avg_without_dc > 0:
        ratio = avg_with_dc / avg_without_dc
        print(f"  - Ratio: {ratio:.2f}x")
    print()
    
    # Verdict
    print("Verdict:")
    print()
    
    if counties_with_dc == 0:
        print("❌ NO PATTERN DETECTED")
        print("   - Zero overlap between infrastructure counties and data center counties")
        print("   - This suggests NO relationship")
    elif capacity_with_dc / total_capacity > 0.30:
        print("✅ STRONG PATTERN DETECTED")
        print(f"   - {capacity_with_dc/total_capacity*100:.1f}% of capacity in data center counties")
        print("   - Suggests infrastructure follows data centers")
    elif capacity_with_dc / total_capacity > 0.15:
        print("⚠️  MODERATE PATTERN DETECTED")
        print(f"   - {capacity_with_dc/total_capacity*100:.1f}% of capacity in data center counties")
        print("   - Pattern exists but may be coincidental")
    else:
        print("❌ WEAK/NO PATTERN DETECTED")
        print(f"   - Only {capacity_with_dc/total_capacity*100:.1f}% of capacity in data center counties")
        print("   - Likely random distribution")
    
    print()
    
    return {
        'total_counties': int(total_counties),
        'counties_with_dc': int(counties_with_dc),
        'counties_without_dc': int(counties_without_dc),
        'total_capacity': float(total_capacity),
        'capacity_with_dc': float(capacity_with_dc),
        'capacity_without_dc': float(capacity_without_dc),
        'pct_capacity_with_dc': float(capacity_with_dc / total_capacity * 100 if total_capacity > 0 else 0)
    }

def main():
    """Main analysis."""
    
    print("=" * 60)
    print("County-Level Infrastructure Analysis")
    print("Testing relationship between infrastructure and data centers")
    print("=" * 60)
    print()
    
    # Load data
    print("Loading data...")
    ercot_df = load_ercot_data()
    dc_df = load_dc_locations()
    print(f"✅ Loaded {len(ercot_df)} ERCOT projects")
    print(f"✅ Loaded {len(dc_df)} data center locations")
    print()
    
    # Analysis
    county_analysis = analyze_county_infrastructure(ercot_df)
    dc_by_county = analyze_dc_counties(dc_df)
    with_dc, without_dc = check_overlap(county_analysis, dc_by_county)
    stats = statistical_analysis(county_analysis, dc_by_county)
    
    # Save results
    output_dir = Path('data/ercot/analysis')
    output_dir.mkdir(parents=True, exist_ok=True)
    
    county_analysis.to_csv(output_dir / 'county_infrastructure_analysis.csv', index=False)
    dc_by_county.to_csv(output_dir / 'dc_by_county.csv', index=False)
    
    with open(output_dir / 'statistical_summary.json', 'w') as f:
        json.dump(stats, f, indent=2)
    
    print(f"✅ Results saved to: {output_dir}/")
    print()
    print("Analysis complete!")

if __name__ == "__main__":
    main()

