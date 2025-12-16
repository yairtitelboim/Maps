#!/usr/bin/env python3
"""
Create a PDF manifest from existing downloaded PDFs.
This allows processing PDFs that were downloaded but don't have a manifest yet.
"""

import json
import hashlib
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse

def get_file_hash(filepath):
    """Calculate SHA256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256.update(chunk)
    return sha256.hexdigest()

def create_manifest_from_pdfs(pdfs_dir, output_manifest):
    """Create manifest from existing PDF files."""
    pdfs_dir = Path(pdfs_dir)
    manifest = {
        "download_date": datetime.now().isoformat(),
        "total_pdfs": 0,
        "successful_downloads": 0,
        "failed_downloads": 0,
        "pdfs": []
    }
    
    # Find all PDFs
    pdf_files = list(pdfs_dir.rglob("*.pdf"))
    
    for pdf_path in pdf_files:
        try:
            # Determine vertical from directory structure
            # e.g., data/grda/pdfs/power_assets/file.pdf -> power_assets
            relative_path = pdf_path.relative_to(pdfs_dir)
            parts = relative_path.parts
            vertical = parts[0] if len(parts) > 1 else "other"
            
            # Get file info
            file_size = pdf_path.stat().st_size
            file_hash = get_file_hash(pdf_path)
            
            # Create document entry
            pdf_entry = {
                "document_id": f"grda_{vertical}_{pdf_path.stem}",
                "url": f"file://{pdf_path}",  # Placeholder URL
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
            }
            
            manifest["pdfs"].append(pdf_entry)
            manifest["total_pdfs"] += 1
            manifest["successful_downloads"] += 1
            
        except Exception as e:
            print(f"Error processing {pdf_path}: {e}")
            manifest["failed_downloads"] += 1
    
    # Save manifest
    with open(output_manifest, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    
    print(f"Created manifest with {manifest['total_pdfs']} PDFs")
    print(f"  Successful: {manifest['successful_downloads']}")
    print(f"  Failed: {manifest['failed_downloads']}")
    
    return manifest

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Create PDF manifest from existing PDFs")
    parser.add_argument("--pdfs-dir", default="data/grda/pdfs",
                       help="Directory containing PDF files")
    parser.add_argument("--output", default="data/grda/pdf_manifest.json",
                       help="Output manifest file")
    
    args = parser.parse_args()
    
    create_manifest_from_pdfs(args.pdfs_dir, args.output)

