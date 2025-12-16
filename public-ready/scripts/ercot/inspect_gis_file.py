#!/usr/bin/env python3
"""
Inspect ERCOT GIS Report file structure
Analyzes a single file to understand data schema
"""

import pandas as pd
from pathlib import Path
import json

def inspect_gis_file(file_path):
    """Inspect a single GIS report file."""
    
    file_path = Path(file_path)
    if not file_path.exists():
        print(f"❌ File not found: {file_path}")
        return None
    
    print("=" * 60)
    print(f"Inspecting: {file_path.name}")
    print("=" * 60)
    print(f"Size: {file_path.stat().st_size / 1024:.1f} KB")
    print()
    
    try:
        xl_file = pd.ExcelFile(file_path)
        
        print(f"Total Sheets: {len(xl_file.sheet_names)}")
        print()
        print("Sheet Names:")
        for i, sheet in enumerate(xl_file.sheet_names, 1):
            print(f"  {i:2d}. {sheet}")
        print()
        
        # Focus on main data sheets
        main_sheets = [
            'Project Details - Large Gen',
            'Project Details - Small Gen',
            'Summary',
            'Commissioning Update',
            'Inactive Projects'
        ]
        
        inspection_results = {
            'file_name': file_path.name,
            'file_size_kb': file_path.stat().st_size / 1024,
            'total_sheets': len(xl_file.sheet_names),
            'sheet_names': xl_file.sheet_names,
            'main_sheets': {}
        }
        
        for sheet_name in main_sheets:
            if sheet_name in xl_file.sheet_names:
                try:
                    print(f"📊 Sheet: {sheet_name}")
                    print("-" * 60)
                    
                    # For "Project Details" sheets, header is at row 31 (skip 30 rows)
                    # Try to detect header row automatically
                    skip_rows = None
                    if 'Project Details' in sheet_name:
                        # Known structure: header at row 31 (0-indexed: skip 30)
                        skip_rows = 30
                    else:
                        # For other sheets, try to find header
                        temp_df = pd.read_excel(file_path, sheet_name=sheet_name, header=None, nrows=35)
                        for idx in range(30, min(35, len(temp_df))):
                            row = temp_df.iloc[idx]
                            if row.notna().sum() > 10:  # Header should have many columns
                                skip_rows = idx
                                break
                    
                    if skip_rows is None:
                        skip_rows = 0
                    
                    print(f"  Using skiprows: {skip_rows} (header at row {skip_rows + 1})")
                    print()
                    
                    # Read with correct skiprows
                    df = pd.read_excel(file_path, sheet_name=sheet_name, header=0, skiprows=skip_rows)
                    
                    print(f"  Rows: {len(df)}")
                    print(f"  Columns: {len(df.columns)}")
                    print()
                    print("  Column Headers:")
                    for i, col in enumerate(df.columns, 1):
                        print(f"    {i:2d}. {col}")
                    print()
                    
                    # Check for location-related columns
                    location_cols = [col for col in df.columns if any(term in str(col).lower() for term in ['county', 'city', 'state', 'location', 'lat', 'lon', 'coord', 'address'])]
                    if location_cols:
                        print(f"  📍 Location columns found: {location_cols}")
                    
                    # Check for capacity-related columns
                    capacity_cols = [col for col in df.columns if any(term in str(col).lower() for term in ['capacity', 'mw', 'kw', 'size', 'power'])]
                    if capacity_cols:
                        print(f"  ⚡ Capacity columns found: {capacity_cols}")
                    
                    # Check for date-related columns
                    date_cols = [col for col in df.columns if any(term in str(col).lower() for term in ['date', 'time', 'year', 'month', 'day'])]
                    if date_cols:
                        print(f"  📅 Date columns found: {date_cols}")
                    
                    # Show sample data
                    print()
                    print("  Sample Data (first 2 rows, first 5 columns):")
                    sample = df.head(2).iloc[:, :5]
                    print(sample.to_string())
                    print()
                    
                    inspection_results['main_sheets'][sheet_name] = {
                        'rows': len(df),
                        'columns': len(df.columns),
                        'column_names': list(df.columns),
                        'location_columns': location_cols,
                        'capacity_columns': capacity_cols,
                        'date_columns': date_cols,
                        'sample_data': df.head(2).to_dict('records') if len(df) > 0 else [],
                        'data_row_count': df[df.columns[0]].notna().sum() if len(df.columns) > 0 else 0
                    }
                    
                except Exception as e:
                    print(f"  ⚠️  Error reading sheet: {e}")
                    print()
        
        # Save inspection results
        output_file = Path('data/ercot/gis_reports/inspection_results.json')
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w') as f:
            json.dump(inspection_results, f, indent=2, default=str, ensure_ascii=False)
        
        print("=" * 60)
        print(f"✅ Inspection complete. Results saved to: {output_file}")
        print("=" * 60)
        
        return inspection_results
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
    else:
        # Find most recent file
        files = list(Path('data/ercot/gis_reports/raw').glob('*.xlsx'))
        if not files:
            print("❌ No XLSX files found in data/ercot/gis_reports/raw/")
            print("   Run download script first or provide file path as argument")
            sys.exit(1)
        
        file_path = max(files, key=lambda p: p.stat().st_mtime)
        print(f"Using most recent file: {file_path.name}")
        print()
    
    inspect_gis_file(file_path)

