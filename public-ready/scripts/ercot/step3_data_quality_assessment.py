#!/usr/bin/env python3
"""
ERCOT Queue Deep Dive - Step 3: Data Quality Assessment
Filters ERCOT 2023 entries, checks capacity ≥100 MW, verifies location data
"""

import pandas as pd
from pathlib import Path
import json
from datetime import datetime

def step3_data_quality_assessment(
    input_file="data/ercot/raw/lbnl_ix_queue_data_file_thru2024_v2.xlsx",
    output_dir="data/ercot/processed"
):
    """Perform Step 3: Data Quality Assessment."""
    
    input_file = Path(input_file)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("ERCOT Queue Deep Dive - Step 3: Data Quality Assessment")
    print("=" * 60)
    print()
    
    # Load dataset
    print("📖 Loading dataset...")
    df = pd.read_excel(input_file, sheet_name="03. Complete Queue Data", header=0)
    
    # Clean up column names
    if df.columns[0] == 'RETURN TO CONTENTS':
        df.columns = df.iloc[0]
        df = df.iloc[1:].reset_index(drop=True)
    df.columns = df.columns.str.strip()
    
    print(f"✅ Loaded {len(df):,} total entries")
    print()
    
    # Step 3.1: Filter to ERCOT entries only
    print("=" * 60)
    print("STEP 3.1: FILTER TO ERCOT ENTRIES")
    print("=" * 60)
    
    ercot_all = df[df['region'] == 'ERCOT'].copy()
    print(f"✅ ERCOT entries (all years): {len(ercot_all):,}")
    print()
    
    # Step 3.2: Filter to 2023 entries
    print("=" * 60)
    print("STEP 3.2: FILTER TO 2023 ENTRIES")
    print("=" * 60)
    
    ercot_all['q_year'] = pd.to_numeric(ercot_all['q_year'], errors='coerce')
    ercot_2023 = ercot_all[ercot_all['q_year'] == 2023].copy()
    print(f"✅ ERCOT entries from 2023: {len(ercot_2023):,}")
    print()
    
    # Step 3.3: Filter to capacity ≥100 MW
    print("=" * 60)
    print("STEP 3.3: FILTER TO CAPACITY ≥100 MW")
    print("=" * 60)
    
    ercot_2023['mw1'] = pd.to_numeric(ercot_2023['mw1'], errors='coerce')
    ercot_2023_100mw = ercot_2023[ercot_2023['mw1'] >= 100].copy()
    print(f"✅ ERCOT 2023 entries with capacity ≥100 MW: {len(ercot_2023_100mw):,}")
    print()
    
    # Capacity distribution
    if len(ercot_2023_100mw) > 0:
        print("Capacity Distribution (≥100 MW):")
        print(f"   Min: {ercot_2023_100mw['mw1'].min():,.0f} MW")
        print(f"   Max: {ercot_2023_100mw['mw1'].max():,.0f} MW")
        print(f"   Mean: {ercot_2023_100mw['mw1'].mean():,.0f} MW")
        print(f"   Median: {ercot_2023_100mw['mw1'].median():,.0f} MW")
        print()
    
    # Step 3.4: Check location data completeness
    print("=" * 60)
    print("STEP 3.4: LOCATION DATA COMPLETENESS")
    print("=" * 60)
    
    location_fields = ['county', 'state', 'county_state_pairs', 'fips_codes', 'poi_name']
    location_stats = {}
    
    for field in location_fields:
        if field in ercot_2023_100mw.columns:
            non_null = ercot_2023_100mw[field].notna().sum()
            total = len(ercot_2023_100mw)
            pct = (non_null / total * 100) if total > 0 else 0
            location_stats[field] = {
                'non_null': int(non_null),
                'total': total,
                'percentage': round(pct, 1)
            }
            print(f"   {field:20s}: {non_null:4d}/{total:4d} ({pct:5.1f}%)")
    
    print()
    
    # Step 3.5: Check capacity data completeness
    print("=" * 60)
    print("STEP 3.5: CAPACITY DATA COMPLETENESS")
    print("=" * 60)
    
    capacity_fields = ['mw1', 'mw2', 'mw3']
    capacity_stats = {}
    
    for field in capacity_fields:
        if field in ercot_2023_100mw.columns:
            non_null = ercot_2023_100mw[field].notna().sum()
            total = len(ercot_2023_100mw)
            pct = (non_null / total * 100) if total > 0 else 0
            capacity_stats[field] = {
                'non_null': int(non_null),
                'total': total,
                'percentage': round(pct, 1)
            }
            if field == 'mw1':
                print(f"   {field:20s}: {non_null:4d}/{total:4d} ({pct:5.1f}%) ✅ REQUIRED")
            else:
                print(f"   {field:20s}: {non_null:4d}/{total:4d} ({pct:5.1f}%) (optional)")
    
    print()
    
    # Step 3.6: Check date data completeness
    print("=" * 60)
    print("STEP 3.6: DATE DATA COMPLETENESS")
    print("=" * 60)
    
    date_fields = ['q_year', 'prop_year']
    date_stats = {}
    
    for field in date_fields:
        if field in ercot_2023_100mw.columns:
            non_null = ercot_2023_100mw[field].notna().sum()
            total = len(ercot_2023_100mw)
            pct = (non_null / total * 100) if total > 0 else 0
            date_stats[field] = {
                'non_null': int(non_null),
                'total': total,
                'percentage': round(pct, 1)
            }
            print(f"   {field:20s}: {non_null:4d}/{total:4d} ({pct:5.1f}%)")
    
    print()
    
    # Step 3.7: Status distribution
    print("=" * 60)
    print("STEP 3.7: STATUS DISTRIBUTION")
    print("=" * 60)
    
    if 'q_status' in ercot_2023_100mw.columns:
        status_counts = ercot_2023_100mw['q_status'].value_counts()
        print("Queue Status:")
        for status, count in status_counts.items():
            pct = (count / len(ercot_2023_100mw) * 100)
            print(f"   {status:20s}: {count:4d} ({pct:5.1f}%)")
        print()
    
    if 'IA_status_clean' in ercot_2023_100mw.columns:
        ia_status_counts = ercot_2023_100mw['IA_status_clean'].value_counts()
        print("IA Status (Cleaned):")
        for status, count in ia_status_counts.items():
            pct = (count / len(ercot_2023_100mw) * 100)
            print(f"   {status:20s}: {count:4d} ({pct:5.1f}%)")
        print()
    
    # Step 3.8: Generation type distribution
    print("=" * 60)
    print("STEP 3.8: GENERATION TYPE DISTRIBUTION")
    print("=" * 60)
    
    if 'type_clean' in ercot_2023_100mw.columns:
        type_counts = ercot_2023_100mw['type_clean'].value_counts()
        print("Generation Types:")
        for gen_type, count in type_counts.items():
            pct = (count / len(ercot_2023_100mw) * 100)
            print(f"   {str(gen_type):20s}: {count:4d} ({pct:5.1f}%)")
        print()
    
    # Step 3.9: Extract sample entries for manual verification
    print("=" * 60)
    print("STEP 3.9: SAMPLE ENTRIES FOR VERIFICATION")
    print("=" * 60)
    
    # Select 3 random entries with good data quality
    sample_criteria = (
        ercot_2023_100mw['county'].notna() &
        ercot_2023_100mw['state'].notna() &
        ercot_2023_100mw['mw1'].notna()
    )
    
    sample_entries = ercot_2023_100mw[sample_criteria].sample(
        n=min(3, len(ercot_2023_100mw[sample_criteria])),
        random_state=42
    )
    
    print(f"Selected {len(sample_entries)} sample entries:")
    print()
    
    for idx, (_, row) in enumerate(sample_entries.iterrows(), 1):
        print(f"Sample Entry #{idx}:")
        print(f"   Queue ID: {row.get('q_id', 'N/A')}")
        print(f"   Status: {row.get('q_status', 'N/A')}")
        print(f"   Capacity: {row.get('mw1', 'N/A'):,.0f} MW" if pd.notna(row.get('mw1')) else f"   Capacity: N/A")
        print(f"   Location: {row.get('county', 'N/A')}, {row.get('state', 'N/A')}")
        print(f"   Generation Type: {row.get('type_clean', 'N/A')}")
        print(f"   POI Name: {row.get('poi_name', 'N/A')}")
        print(f"   Utility: {row.get('utility', 'N/A')}")
        print(f"   Developer: {row.get('developer', 'N/A')}")
        print()
    
    # Save filtered dataset
    print("=" * 60)
    print("SAVING FILTERED DATASET")
    print("=" * 60)
    
    output_file = output_dir / "ercot_2023_100mw_filtered.csv"
    ercot_2023_100mw.to_csv(output_file, index=False)
    print(f"✅ Saved filtered dataset: {output_file}")
    print(f"   Rows: {len(ercot_2023_100mw):,}")
    print(f"   Columns: {len(ercot_2023_100mw.columns)}")
    print()
    
    # Save sample entries
    sample_file = output_dir / "ercot_2023_100mw_samples.json"
    sample_data = []
    for _, row in sample_entries.iterrows():
        sample_data.append({
            'q_id': str(row.get('q_id', '')),
            'q_status': str(row.get('q_status', '')),
            'q_year': float(row.get('q_year', 0)) if pd.notna(row.get('q_year')) else None,
            'capacity_mw': float(row.get('mw1', 0)) if pd.notna(row.get('mw1')) else None,
            'county': str(row.get('county', '')),
            'state': str(row.get('state', '')),
            'county_state': str(row.get('county_state_pairs', '')),
            'fips_code': str(row.get('fips_codes', '')),
            'poi_name': str(row.get('poi_name', '')),
            'generation_type': str(row.get('type_clean', '')),
            'utility': str(row.get('utility', '')),
            'developer': str(row.get('developer', '')),
            'project_name': str(row.get('project_name', '')),
        })
    
    with open(sample_file, 'w') as f:
        json.dump(sample_data, f, indent=2)
    print(f"✅ Saved sample entries: {sample_file}")
    print()
    
    # Create summary report
    summary = {
        'step': 3,
        'assessment_date': datetime.now().isoformat(),
        'filters_applied': {
            'region': 'ERCOT',
            'year': 2023,
            'min_capacity_mw': 100
        },
        'results': {
            'total_entries_all_regions': int(len(df)),
            'ercot_entries_all_years': int(len(ercot_all)),
            'ercot_entries_2023': int(len(ercot_2023)),
            'ercot_entries_2023_100mw': int(len(ercot_2023_100mw))
        },
        'data_quality': {
            'location': location_stats,
            'capacity': capacity_stats,
            'date': date_stats
        },
        'status_distribution': {str(k): int(v) for k, v in (dict(status_counts).items() if 'q_status' in ercot_2023_100mw.columns else {})},
        'generation_type_distribution': {str(k): int(v) for k, v in (dict(type_counts).items() if 'type_clean' in ercot_2023_100mw.columns else {})},
        'sample_entries': sample_data
    }
    
    summary_file = output_dir / "step3_assessment_summary.json"
    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2)
    print(f"✅ Saved assessment summary: {summary_file}")
    print()
    
    # Decision point
    print("=" * 60)
    print("DECISION POINT")
    print("=" * 60)
    
    if len(ercot_2023_100mw) >= 20:
        print("✅ SUFFICIENT DATA: Proceed to Step 4")
        print(f"   Found {len(ercot_2023_100mw):,} entries (threshold: 20+)")
    elif len(ercot_2023_100mw) >= 5:
        print("⚠️  LIMITED DATA: Proceed with caution")
        print(f"   Found {len(ercot_2023_100mw):,} entries (threshold: 20+)")
        print("   Consider lowering capacity threshold or expanding year range")
    else:
        print("❌ INSUFFICIENT DATA: Stop and reassess")
        print(f"   Found only {len(ercot_2023_100mw):,} entries (threshold: 20+)")
        print("   Need to adjust filters or find alternate data source")
    
    print()
    
    # Location data quality check
    location_pct = location_stats.get('county', {}).get('percentage', 0)
    if location_pct >= 80:
        print("✅ LOCATION DATA: Good quality")
    elif location_pct >= 50:
        print("⚠️  LOCATION DATA: Moderate quality")
    else:
        print("❌ LOCATION DATA: Poor quality")
    print(f"   County coverage: {location_pct:.1f}%")
    print()
    
    # Capacity data quality check
    capacity_pct = capacity_stats.get('mw1', {}).get('percentage', 0)
    if capacity_pct >= 95:
        print("✅ CAPACITY DATA: Excellent quality")
    elif capacity_pct >= 80:
        print("⚠️  CAPACITY DATA: Good quality")
    else:
        print("❌ CAPACITY DATA: Poor quality")
    print(f"   Primary capacity coverage: {capacity_pct:.1f}%")
    print()
    
    return summary

if __name__ == "__main__":
    summary = step3_data_quality_assessment()
    print("\n✅ Step 3 Complete!")

