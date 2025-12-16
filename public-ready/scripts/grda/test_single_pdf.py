#!/usr/bin/env python3
"""
Test script to process a single PDF and extract power capacity data.
"""

import json
import hashlib
import sys
from pathlib import Path
from datetime import datetime

def get_file_hash(filepath):
    """Calculate SHA256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256.update(chunk)
    return sha256.hexdigest()

def create_test_manifest(pdf_path, output_manifest):
    """Create a test manifest with a single PDF."""
    pdf_path = Path(pdf_path)
    
    if not pdf_path.exists():
        print(f"Error: PDF not found: {pdf_path}")
        return None
    
    # Determine vertical - try to guess from filename or use "power_assets" for testing
    vertical = "power_assets"  # Force to power_assets for testing
    
    file_size = pdf_path.stat().st_size
    file_hash = get_file_hash(pdf_path)
    
    manifest = {
        "download_date": datetime.now().isoformat(),
        "total_pdfs": 1,
        "successful_downloads": 1,
        "failed_downloads": 0,
        "pdfs": [{
            "document_id": f"grda_test_{pdf_path.stem}",
            "url": f"file://{pdf_path}",
            "vertical": vertical,
            "filename": pdf_path.name,
            "filepath": str(pdf_path),
            "sha256": file_hash,
            "discovered_on": datetime.now().isoformat(),
            "downloaded_on": datetime.now().isoformat(),
            "filesize_bytes": file_size,
            "http_status": 200,
            "status": "success",
            "link_text": pdf_path.stem.replace("-", " ").replace("_", " "),
            "size": file_size,
            "download_date": datetime.now().isoformat()
        }]
    }
    
    # Save manifest
    output_manifest = Path(output_manifest)
    output_manifest.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_manifest, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Created test manifest with: {pdf_path.name}")
    print(f"  Size: {file_size:,} bytes")
    print(f"  Vertical: {vertical}")
    print(f"  Saved to: {output_manifest}")
    
    return manifest

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Create test manifest for single PDF")
    parser.add_argument("pdf_path", help="Path to PDF file to test")
    parser.add_argument("--output", default="data/grda/pdf_manifest_test.json",
                       help="Output manifest file")
    
    args = parser.parse_args()
    
    create_test_manifest(args.pdf_path, args.output)

