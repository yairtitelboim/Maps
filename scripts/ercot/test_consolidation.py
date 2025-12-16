#!/usr/bin/env python3
"""
Test consolidation script on a few files first
"""

from pathlib import Path
from consolidate_gis_reports import load_gis_file, extract_report_date
import pandas as pd

def test_consolidation():
    """Test consolidation on 3-5 sample files."""
    
    input_dir = Path("data/ercot/gis_reports/raw")
    files = sorted(input_dir.glob("GIS_Report_*.xlsx"))
    
    if len(files) == 0:
        print("❌ No files found to test")
        return
    
    # Test on first 3 files
    test_files = files[:3]
    
    print("=" * 60)
    print("Testing Consolidation on Sample Files")
    print("=" * 60)
    print(f"Testing with {len(test_files)} files:")
    for f in test_files:
        print(f"  - {f.name}")
    print()
    
    # Load each file
    all_dfs = []
    for file_path in test_files:
        print(f"Loading: {file_path.name}")
        df = load_gis_file(file_path)
        if df is not None:
            all_dfs.append(df)
            print(f"  ✅ {len(df)} projects")
        print()
    
    if len(all_dfs) == 0:
        print("❌ No data loaded")
        return
    
    # Concatenate
    consolidated = pd.concat(all_dfs, ignore_index=True)
    
    print("=" * 60)
    print("Test Consolidation Results")
    print("=" * 60)
    print(f"Total projects: {len(consolidated)}")
    print(f"Columns: {len(consolidated.columns)}")
    print()
    
    print("Key columns:")
    key_cols = ['INR', 'Project Name', 'County', 'Capacity (MW)', 'report_date', 'source_file']
    for col in key_cols:
        if col in consolidated.columns:
            non_null = consolidated[col].notna().sum()
            print(f"  {col:20s}: {non_null:5d} / {len(consolidated):5d}")
    
    print()
    print("Sample data (first 3 rows):")
    sample_cols = ['INR', 'Project Name', 'County', 'Capacity (MW)', 'report_date']
    available_cols = [c for c in sample_cols if c in consolidated.columns]
    print(consolidated[available_cols].head(3).to_string())
    print()
    
    print("✅ Test successful! Ready for full consolidation.")

if __name__ == "__main__":
    test_consolidation()

