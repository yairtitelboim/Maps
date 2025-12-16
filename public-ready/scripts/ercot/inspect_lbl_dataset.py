#!/usr/bin/env python3
"""
Inspect LBL Interconnection Queue Dataset
Step 2: Download and Inspect Raw Data
"""

import pandas as pd
from pathlib import Path
import json
from datetime import datetime

def inspect_lbl_dataset(file_path="data/ercot/raw/lbnl_ix_queue_data_file_thru2024_v2.xlsx"):
    """Inspect the LBL dataset structure and content."""
    
    file_path = Path(file_path)
    
    if not file_path.exists():
        print(f"❌ File not found: {file_path}")
        return None
    
    file_size = file_path.stat().st_size
    print(f"📊 File: {file_path.name}")
    print(f"   Size: {file_size:,} bytes ({file_size / 1024 / 1024:.2f} MB)")
    print()
    
    # Load Excel file
    print("📖 Reading Excel file...")
    try:
        # Get sheet names first
        xl_file = pd.ExcelFile(file_path)
        sheet_names = xl_file.sheet_names
        
        print(f"✅ File loaded successfully")
        print(f"   Number of sheets: {len(sheet_names)}")
        print(f"   Sheet names: {', '.join(sheet_names[:10])}{'...' if len(sheet_names) > 10 else ''}")
        print()
        
        # Find the main data sheet (prioritize "Complete Queue Data")
        main_sheet = None
        for name in sheet_names:
            if 'complete queue data' in name.lower():
                main_sheet = name
                break
        
        # If not found, look for other data sheets
        if not main_sheet:
            for name in sheet_names:
                if 'data' in name.lower() and 'sample' not in name.lower():
                    main_sheet = name
                    break
        
        # Fallback to first sheet
        if not main_sheet:
            main_sheet = sheet_names[0]
        
        print(f"📋 Analyzing main sheet: '{main_sheet}'")
        print()
        
        # Load main sheet - first row contains headers
        df = pd.read_excel(file_path, sheet_name=main_sheet, header=0)
        
        # Clean up column names (remove "RETURN TO CONTENTS" if it's the first column)
        if df.columns[0] == 'RETURN TO CONTENTS':
            # The actual headers might be in the first row
            # Let's check if first row looks like headers
            first_row = df.iloc[0]
            if 'q_id' in str(first_row.values).lower() or 'project' in str(first_row.values).lower():
                # Use first row as headers
                df.columns = df.iloc[0]
                df = df.iloc[1:].reset_index(drop=True)
        
        # Clean column names
        df.columns = df.columns.str.strip()
        
        print("=" * 60)
        print("DATA STRUCTURE")
        print("=" * 60)
        print(f"Total rows: {len(df):,}")
        print(f"Total columns: {len(df.columns)}")
        print()
        
        print("Column Headers:")
        for i, col in enumerate(df.columns, 1):
            print(f"  {i:2d}. {col}")
        print()
        
        # Check for 2023 data
        print("=" * 60)
        print("2023 DATA CHECK")
        print("=" * 60)
        
        # Check q_year column (most reliable)
        if 'q_year' in df.columns:
            df['q_year'] = pd.to_numeric(df['q_year'], errors='coerce')
            year_counts = df['q_year'].value_counts().sort_index()
            if 2023 in year_counts.index:
                count_2023 = int(year_counts[2023])
                print(f"✅ Column 'q_year' (Queue Year):")
                print(f"   - 2023 entries: {count_2023:,}")
                print(f"   - Recent years: {dict(year_counts.tail(10))}")
                print()
        
        # Check prop_year column
        if 'prop_year' in df.columns:
            df['prop_year'] = pd.to_numeric(df['prop_year'], errors='coerce')
            prop_year_counts = df['prop_year'].value_counts().sort_index()
            if 2023 in prop_year_counts.index:
                count_2023_prop = int(prop_year_counts[2023])
                print(f"✅ Column 'prop_year' (Proposed Year):")
                print(f"   - 2023 entries: {count_2023_prop:,}")
                print()
        
        # Filter for ERCOT and 2023
        if 'region' in df.columns and 'q_year' in df.columns:
            ercot_2023 = df[(df['region'] == 'ERCOT') & (df['q_year'] == 2023)]
            print(f"✅ ERCOT entries from 2023: {len(ercot_2023):,}")
            print()
        
        # Check date columns (may be Excel serial numbers)
        date_columns = [col for col in df.columns if 'date' in col.lower()]
        if date_columns:
            print(f"Date columns found: {', '.join(date_columns)}")
            print("   (Note: These may be Excel serial numbers, use q_year/prop_year for filtering)")
            print()
        
        # Check for location data
        print("=" * 60)
        print("LOCATION DATA CHECK")
        print("=" * 60)
        location_columns = []
        for col in df.columns:
            if any(term in col.lower() for term in ['location', 'city', 'county', 'state', 'lat', 'lon', 'coord', 'address', 'region']):
                location_columns.append(col)
        
        if location_columns:
            print(f"Found location columns: {', '.join(location_columns)}")
            for col in location_columns:
                non_null = df[col].notna().sum()
                print(f"   - '{col}': {non_null:,} non-null values ({non_null/len(df)*100:.1f}%)")
        else:
            print("⚠️  No obvious location columns found")
        print()
        
        # Check for capacity data
        print("=" * 60)
        print("CAPACITY DATA CHECK")
        print("=" * 60)
        capacity_columns = []
        for col in df.columns:
            if any(term in col.lower() for term in ['capacity', 'mw', 'kw', 'size', 'power', 'generation']):
                capacity_columns.append(col)
        
        if capacity_columns:
            print(f"Found capacity columns: {', '.join(capacity_columns)}")
            for col in capacity_columns:
                non_null = df[col].notna().sum()
                if df[col].dtype in ['int64', 'float64']:
                    print(f"   - '{col}': {non_null:,} non-null values")
                    print(f"     Range: {df[col].min():,.0f} - {df[col].max():,.0f}")
                else:
                    print(f"   - '{col}': {non_null:,} non-null values")
        else:
            print("⚠️  No obvious capacity columns found")
        print()
        
        # Check for ERCOT data
        print("=" * 60)
        print("ERCOT DATA CHECK")
        print("=" * 60)
        ercot_columns = []
        for col in df.columns:
            if any(term in col.lower() for term in ['iso', 'rto', 'region', 'market', 'operator']):
                ercot_columns.append(col)
        
        if ercot_columns:
            print(f"Found ISO/RTO columns: {', '.join(ercot_columns)}")
            for col in ercot_columns:
                if df[col].dtype == 'object':
                    value_counts = df[col].value_counts()
                    if 'ERCOT' in value_counts.index or 'ercot' in str(value_counts.index).lower():
                        ercot_count = value_counts.get('ERCOT', 0) + value_counts.get('ercot', 0)
                        print(f"   - '{col}': {ercot_count:,} ERCOT entries")
                        print(f"     All values: {dict(value_counts.head(10))}")
        else:
            print("⚠️  No obvious ISO/RTO columns found")
        print()
        
        # Sample data
        print("=" * 60)
        print("SAMPLE DATA (First 3 Rows)")
        print("=" * 60)
        print(df.head(3).to_string())
        print()
        
        # Save summary
        summary = {
            'file_name': file_path.name,
            'file_size_mb': file_size / 1024 / 1024,
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'columns': list(df.columns),
            'sheet_names': sheet_names,
            'main_sheet': main_sheet,
            'inspection_date': datetime.now().isoformat(),
        }
        
        summary_path = Path('data/ercot/raw/dataset_summary.json')
        summary_path.parent.mkdir(parents=True, exist_ok=True)
        with open(summary_path, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"✅ Summary saved to: {summary_path}")
        
        return df, summary
        
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    print("=" * 60)
    print("LBL Interconnection Queue Dataset Inspection")
    print("Step 2: Download and Inspect Raw Data")
    print("=" * 60)
    print()
    
    result = inspect_lbl_dataset()
    
    if result:
        print("\n✅ Inspection complete! Ready for Step 3: Data Quality Assessment")
    else:
        print("\n❌ Inspection failed")

