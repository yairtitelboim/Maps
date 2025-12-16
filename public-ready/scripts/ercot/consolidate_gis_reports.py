#!/usr/bin/env python3
"""
Consolidate ERCOT GIS Report files into single dataset
Handles schema evolution and adds metadata
"""

import pandas as pd
from pathlib import Path
import json
import re
from datetime import datetime
from typing import Dict, List, Optional

def extract_report_date(filename: str) -> Dict[str, Optional[str]]:
    """Extract month and year from filename."""
    # Pattern: GIS_Report_October2025.xlsx
    # Pattern: GIS_Report_September2025.xlsx
    match = re.search(r'GIS_Report_(\w+)(\d{4})', filename)
    if match:
        month_str = match.group(1)
        year_str = match.group(2)
        
        # Map month names to numbers
        month_map = {
            'January': '01', 'February': '02', 'March': '03', 'April': '04',
            'May': '05', 'June': '06', 'July': '07', 'August': '08',
            'September': '09', 'October': '10', 'November': '11', 'December': '12'
        }
        
        month_num = month_map.get(month_str, None)
        if month_num:
            report_date = f"{year_str}-{month_num}-01"
            return {
                'report_month': month_str,
                'report_year': year_str,
                'report_date': report_date
            }
    
    return {
        'report_month': None,
        'report_year': None,
        'report_date': None
    }

def standardize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Standardize column names across different file versions."""
    # Create mapping for known column variations
    column_mapping = {
        # Standardize common variations
        'INR': 'INR',
        'Project Name': 'Project Name',
        'County': 'County',
        'POI Location': 'POI Location',
        'Capacity (MW)': 'Capacity (MW)',
        'Fuel': 'Fuel',
        'Technology': 'Technology',
        'Projected COD': 'Projected COD',
        'GIM Study Phase': 'GIM Study Phase',
    }
    
    # Rename columns if they exist
    df_renamed = df.copy()
    for old_name, new_name in column_mapping.items():
        if old_name in df_renamed.columns:
            df_renamed = df_renamed.rename(columns={old_name: new_name})
    
    return df_renamed

def load_gis_file(file_path: Path) -> Optional[pd.DataFrame]:
    """Load a single GIS report file."""
    try:
        print(f"  Loading: {file_path.name}")
        
        # Try different sheet names (older files may have different names)
        # Older files (pre-2021) use "Project Details" (combined Large + Small)
        # Newer files use "Project Details - Large Gen" and "Project Details - Small Gen"
        sheet_names_to_try = [
            'Project Details - Large Gen',  # Newer files
            'Project Details - Large Generators',
            'Project Details',  # Older files (combined)
            'Large Gen',
            'Large Generators'
        ]
        
        df = None
        sheet_name_used = None
        
        xl_file = pd.ExcelFile(file_path, engine='openpyxl')
        available_sheets = xl_file.sheet_names
        
        # Find matching sheet
        for sheet_name in sheet_names_to_try:
            if sheet_name in available_sheets:
                sheet_name_used = sheet_name
                break
        
        if sheet_name_used is None:
            # Try to find any sheet with "Project Details" or "Large" or "Gen" in name
            for sheet in available_sheets:
                if 'project details' in sheet.lower() or 'large' in sheet.lower() or 'gen' in sheet.lower():
                    sheet_name_used = sheet
                    print(f"    Using alternative sheet: {sheet}")
                    break
        
        if sheet_name_used is None:
            print(f"    ⚠️  Could not find appropriate sheet. Available: {available_sheets}")
            return None
        
        # Read the sheet
        # Header is at row 31 (skip 30 rows) for newer files
        # Try different skiprows for older files
        skiprows_options = [30, 25, 20, 15, 10, 5, 0]
        
        for skiprows in skiprows_options:
            try:
                df = pd.read_excel(
                    file_path,
                    sheet_name=sheet_name_used,
                    header=0,
                    skiprows=skiprows,
                    engine='openpyxl'
                )
                
                # Check if we got valid data (has INR column or first column has data)
                if 'INR' in df.columns:
                    break
                elif len(df.columns) > 0:
                    first_col = df.columns[0]
                    if df[first_col].notna().sum() > 10:  # At least 10 non-null values
                        break
            except:
                continue
        
        if df is None or len(df) == 0:
            print(f"    ⚠️  Could not read data from sheet")
            return None
        
        # Filter to rows with actual data (INR not null)
        if 'INR' in df.columns:
            df = df[df['INR'].notna()].copy()
        else:
            print(f"    ⚠️  Warning: 'INR' column not found, using first column")
            first_col = df.columns[0]
            df = df[df[first_col].notna()].copy()
        
        if len(df) == 0:
            print(f"    ⚠️  No data rows found")
            return None
        
        # Standardize columns
        df = standardize_columns(df)
        
        # Extract report date from filename
        date_info = extract_report_date(file_path.name)
        
        # Add metadata columns
        df['source_file'] = file_path.name
        df['report_month'] = date_info['report_month']
        df['report_year'] = date_info['report_year']
        df['report_date'] = date_info['report_date']
        df['extraction_date'] = datetime.now().strftime('%Y-%m-%d')
        
        print(f"    ✅ Loaded {len(df)} projects")
        return df
        
    except Exception as e:
        print(f"    ❌ Error loading {file_path.name}: {e}")
        return None

def consolidate_gis_reports(
    input_dir: str = "data/ercot/gis_reports/raw",
    output_dir: str = "data/ercot/gis_reports/consolidated",
    output_format: str = "both"  # "csv", "json", or "both"
) -> Dict:
    """Consolidate all GIS report files into single dataset."""
    
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("ERCOT GIS Report Consolidation")
    print("=" * 60)
    print(f"Input directory: {input_path}")
    print(f"Output directory: {output_path}")
    print()
    
    # Find all XLSX files
    files = sorted(input_path.glob("GIS_Report_*.xlsx"))
    
    if len(files) == 0:
        print("❌ No GIS Report files found!")
        return {}
    
    print(f"Found {len(files)} files to process")
    print()
    
    # Load all files
    all_dataframes = []
    successful_files = []
    failed_files = []
    
    for idx, file_path in enumerate(files, 1):
        print(f"[{idx}/{len(files)}] Processing: {file_path.name}")
        df = load_gis_file(file_path)
        
        if df is not None and len(df) > 0:
            all_dataframes.append(df)
            successful_files.append(file_path.name)
        else:
            failed_files.append(file_path.name)
        print()
    
    if len(all_dataframes) == 0:
        print("❌ No data loaded from any files!")
        return {}
    
    # Concatenate all dataframes
    print("=" * 60)
    print("Consolidating data...")
    print("=" * 60)
    
    consolidated_df = pd.concat(all_dataframes, ignore_index=True)
    
    print(f"Total projects: {len(consolidated_df)}")
    print(f"Total files processed: {len(successful_files)}")
    print(f"Failed files: {len(failed_files)}")
    print()
    
    # Data quality checks
    print("Data Quality Summary:")
    print("-" * 60)
    
    key_columns = ['INR', 'Project Name', 'County', 'POI Location', 'Capacity (MW)']
    for col in key_columns:
        if col in consolidated_df.columns:
            non_null = consolidated_df[col].notna().sum()
            pct = (non_null / len(consolidated_df)) * 100
            print(f"  {col:20s}: {non_null:5d} / {len(consolidated_df):5d} ({pct:5.1f}%)")
    
    print()
    
    # Check for duplicates
    if 'INR' in consolidated_df.columns:
        duplicates = consolidated_df.duplicated(subset=['INR', 'report_date'], keep=False)
        dup_count = duplicates.sum()
        if dup_count > 0:
            print(f"⚠️  Found {dup_count} duplicate entries (same INR + report_date)")
            print("   These are expected - same project appears in multiple monthly reports")
        print()
    
    # Date range
    if 'report_date' in consolidated_df.columns:
        dates = pd.to_datetime(consolidated_df['report_date'], errors='coerce')
        valid_dates = dates.dropna()
        if len(valid_dates) > 0:
            print(f"Report date range: {valid_dates.min().date()} to {valid_dates.max().date()}")
            print()
    
    # Save consolidated data
    print("=" * 60)
    print("Saving consolidated data...")
    print("=" * 60)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    if output_format in ['csv', 'both']:
        csv_file = output_path / f"ercot_gis_reports_consolidated_{timestamp}.csv"
        consolidated_df.to_csv(csv_file, index=False)
        print(f"✅ CSV saved: {csv_file}")
        print(f"   Size: {csv_file.stat().st_size / 1024 / 1024:.2f} MB")
    
    if output_format in ['json', 'both']:
        json_file = output_path / f"ercot_gis_reports_consolidated_{timestamp}.json"
        
        # Use pandas to_json which handles datetime objects better
        # Convert datetime columns to ISO format strings first
        df_for_json = consolidated_df.copy()
        for col in df_for_json.columns:
            if df_for_json[col].dtype == 'datetime64[ns]':
                df_for_json[col] = df_for_json[col].dt.strftime('%Y-%m-%d')
        
        # Use pandas to_json with orient='records' for JSON array format
        json_str = df_for_json.to_json(orient='records', date_format='iso', default_handler=str)
        
        with open(json_file, 'w') as f:
            f.write(json_str)
        
        # Also parse and pretty-print for readability (optional, but makes it easier to read)
        try:
            records = json.loads(json_str)
            with open(json_file, 'w') as f:
                json.dump(records, f, indent=2, ensure_ascii=False)
        except:
            # If pretty-printing fails, keep the original
            pass
        print(f"✅ JSON saved: {json_file}")
        print(f"   Size: {json_file.stat().st_size / 1024 / 1024:.2f} MB")
    
    # Also save latest version (without timestamp)
    if output_format in ['csv', 'both']:
        latest_csv = output_path / "ercot_gis_reports_consolidated_latest.csv"
        consolidated_df.to_csv(latest_csv, index=False)
        print(f"✅ Latest CSV: {latest_csv}")
    
    if output_format in ['json', 'both']:
        latest_json = output_path / "ercot_gis_reports_consolidated_latest.json"
        with open(latest_json, 'w') as f:
            json.dump(records, f, indent=2, default=str, ensure_ascii=False)
        print(f"✅ Latest JSON: {latest_json}")
    
    print()
    
    # Generate summary statistics
    summary = {
        'consolidation_date': datetime.now().isoformat(),
        'total_projects': len(consolidated_df),
        'total_files_processed': len(successful_files),
        'failed_files': len(failed_files),
        'successful_files': successful_files,
        'failed_file_list': failed_files,
        'date_range': {
            'earliest': str(valid_dates.min().date()) if len(valid_dates) > 0 else None,
            'latest': str(valid_dates.max().date()) if len(valid_dates) > 0 else None
        },
        'data_quality': {}
    }
    
    for col in key_columns:
        if col in consolidated_df.columns:
            summary['data_quality'][col] = {
                'non_null_count': int(consolidated_df[col].notna().sum()),
                'null_count': int(consolidated_df[col].isna().sum()),
                'completeness_pct': float((consolidated_df[col].notna().sum() / len(consolidated_df)) * 100)
            }
    
    # Save summary
    summary_file = output_path / f"consolidation_summary_{timestamp}.json"
    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2, default=str)
    print(f"✅ Summary saved: {summary_file}")
    
    print()
    print("=" * 60)
    print("✅ Consolidation complete!")
    print("=" * 60)
    
    return summary

if __name__ == "__main__":
    import sys
    
    output_format = "both"
    if len(sys.argv) > 1:
        output_format = sys.argv[1]  # "csv", "json", or "both"
    
    print("=" * 60)
    print("ERCOT GIS Report Consolidation")
    print("=" * 60)
    print("\nThis script will:")
    print("1. Load all GIS_Report_*.xlsx files")
    print("2. Extract 'Project Details - Large Gen' sheet")
    print("3. Add metadata (report_date, source_file)")
    print("4. Consolidate into single dataset")
    print("5. Save as CSV and JSON")
    print("\n" + "=" * 60 + "\n")
    
    summary = consolidate_gis_reports(output_format=output_format)
    
    if summary:
        print(f"\n✅ Successfully consolidated {summary['total_projects']} projects")
        print(f"   from {summary['total_files_processed']} files")
    else:
        print("\n❌ Consolidation failed")

