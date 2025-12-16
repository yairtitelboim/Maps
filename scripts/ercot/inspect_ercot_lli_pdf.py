#!/usr/bin/env python3
"""
Inspect ERCOT Large Load Interconnection PDF
Check structure and extractable data
"""

import pdfplumber
from pathlib import Path

def inspect_pdf(pdf_path="data/ercot/large_load/ercot_lli_queue_2024-09-06.pdf"):
    """Inspect ERCOT LLI PDF structure."""
    
    pdf_path = Path(pdf_path)
    
    if not pdf_path.exists():
        print(f"❌ PDF not found: {pdf_path}")
        return
    
    print("=" * 60)
    print("ERCOT Large Load Interconnection PDF Inspection")
    print("=" * 60)
    print(f"File: {pdf_path.name}")
    print(f"Size: {pdf_path.stat().st_size / 1024:.1f} KB")
    print()
    
    with pdfplumber.open(pdf_path) as pdf:
        print(f"Total pages: {len(pdf.pages)}")
        print()
        
        # Check each page for tables
        for page_num, page in enumerate(pdf.pages, 1):
            print(f"Page {page_num}:")
            
            # Extract text
            text = page.extract_text()
            if text:
                lines = text.split('\n')[:10]  # First 10 lines
                print(f"   Text preview (first 10 lines):")
                for line in lines:
                    if line.strip():
                        print(f"      {line[:80]}")
            
            # Extract tables
            tables = page.extract_tables()
            if tables:
                print(f"   ✅ Found {len(tables)} table(s)")
                for i, table in enumerate(tables, 1):
                    if table:
                        print(f"      Table {i}: {len(table)} rows x {len(table[0]) if table[0] else 0} cols")
                        if len(table) > 0:
                            print(f"      Headers: {table[0]}")
                            if len(table) > 1:
                                print(f"      Sample row: {table[1]}")
            else:
                print(f"   ⚠️  No tables found")
            
            print()
        
        # Summary
        print("=" * 60)
        print("SUMMARY")
        print("=" * 60)
        
        total_tables = sum(len(page.extract_tables()) for page in pdf.pages)
        print(f"Total tables found: {total_tables}")
        
        if total_tables > 0:
            print("✅ PDF contains extractable tables")
            print("   Next step: Extract tables to CSV")
        else:
            print("⚠️  PDF does not contain tables")
            print("   May need manual extraction or OCR")

if __name__ == "__main__":
    inspect_pdf()

