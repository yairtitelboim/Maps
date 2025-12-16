#!/usr/bin/env python3
"""
GRDA PDF Downloader

This script downloads all PDFs identified by the website mapper,
organizes them by vertical, and creates a manifest file.

Requirements:
pip install requests
"""

import os
import json
import logging
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime
import hashlib
import time

try:
    import requests
    HAVE_REQUESTS = True
except ImportError:
    HAVE_REQUESTS = False
    print("Warning: requests not installed. Install with: pip install requests")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class GRDAPDFDownloader:
    def __init__(self, website_structure_path, output_dir):
        """
        Initialize the PDF downloader.
        
        Args:
            website_structure_path: Path to website_structure.json from mapper
            output_dir: Base directory for PDF storage
        """
        self.website_structure_path = Path(website_structure_path)
        self.output_dir = Path(output_dir)
        self.pdfs_dir = self.output_dir / "pdfs"
        self.pdfs_dir.mkdir(parents=True, exist_ok=True)
        
        self.manifest = {
            "download_date": None,
            "total_pdfs": 0,
            "successful_downloads": 0,
            "failed_downloads": 0,
            "pdfs": []
        }
        
        # Session for connection pooling
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        # Load website structure
        with open(self.website_structure_path, 'r', encoding='utf-8') as f:
            self.website_structure = json.load(f)
    
    def get_filename_from_url(self, url):
        """Extract a safe filename from URL."""
        parsed = urlparse(url)
        path = parsed.path
        
        # Get the last part of the path
        filename = os.path.basename(path)
        
        # If no filename in URL, create one from URL hash
        if not filename or not filename.endswith('.pdf'):
            url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
            filename = f"document_{url_hash}.pdf"
        
        # Sanitize filename
        filename = "".join(c for c in filename if c.isalnum() or c in "._-")
        
        return filename
    
    def download_pdf(self, pdf_info, retries=3):
        """Download a single PDF with retry logic."""
        url = pdf_info["url"]
        vertical = pdf_info.get("vertical", "other")
        link_text = pdf_info.get("link_text", "")
        
        # Create vertical directory
        vertical_dir = self.pdfs_dir / vertical
        vertical_dir.mkdir(parents=True, exist_ok=True)
        
        # Get filename
        filename = self.get_filename_from_url(url)
        filepath = vertical_dir / filename
        
        # Skip if already downloaded
        if filepath.exists():
            logger.info(f"Skipping {filename} (already exists)")
            return {
                "url": url,
                "filename": filename,
                "filepath": str(filepath),
                "vertical": vertical,
                "status": "skipped",
                "size": filepath.stat().st_size,
                "link_text": link_text
            }
        
        # Download with retries
        for attempt in range(retries):
            try:
                logger.info(f"Downloading {filename} (attempt {attempt + 1}/{retries})")
                response = self.session.get(url, timeout=30, stream=True)
                response.raise_for_status()
                
                # Verify it's actually a PDF
                content_type = response.headers.get('Content-Type', '').lower()
                if 'pdf' not in content_type and not url.lower().endswith('.pdf'):
                    logger.warning(f"URL {url} doesn't appear to be a PDF (Content-Type: {content_type})")
                
                # Save file
                with open(filepath, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                file_size = filepath.stat().st_size
                logger.info(f"✓ Downloaded {filename} ({file_size:,} bytes)")
                
                return {
                    "url": url,
                    "filename": filename,
                    "filepath": str(filepath),
                    "vertical": vertical,
                    "status": "success",
                    "size": file_size,
                    "link_text": link_text,
                    "download_date": datetime.now().isoformat()
                }
            
            except requests.RequestException as e:
                logger.error(f"Error downloading {url} (attempt {attempt + 1}): {e}")
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                else:
                    return {
                        "url": url,
                        "filename": filename,
                        "filepath": str(filepath),
                        "vertical": vertical,
                        "status": "failed",
                        "error": str(e),
                        "link_text": link_text
                    }
        
        return None
    
    def download_all_pdfs(self):
        """Download all PDFs from the website structure."""
        all_pdfs = self.website_structure.get("all_pdfs", [])
        total = len(all_pdfs)
        
        logger.info(f"Starting download of {total} PDFs")
        
        self.manifest["download_date"] = datetime.now().isoformat()
        self.manifest["total_pdfs"] = total
        
        for i, pdf_info in enumerate(all_pdfs, 1):
            logger.info(f"Processing PDF {i}/{total}: {pdf_info.get('link_text', 'Unknown')}")
            
            result = self.download_pdf(pdf_info)
            if result:
                self.manifest["pdfs"].append(result)
                
                if result["status"] == "success":
                    self.manifest["successful_downloads"] += 1
                elif result["status"] == "failed":
                    self.manifest["failed_downloads"] += 1
            
            # Be polite - small delay between downloads
            time.sleep(0.5)
        
        logger.info(f"\nDownload complete!")
        logger.info(f"  Successful: {self.manifest['successful_downloads']}")
        logger.info(f"  Failed: {self.manifest['failed_downloads']}")
        logger.info(f"  Skipped: {total - self.manifest['successful_downloads'] - self.manifest['failed_downloads']}")
        
        return self.manifest
    
    def save_manifest(self, filename="pdf_manifest.json"):
        """Save the download manifest to JSON file."""
        manifest_path = self.output_dir / filename
        
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(self.manifest, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved manifest to {manifest_path}")
        return manifest_path


def main():
    """Main execution function."""
    if not HAVE_REQUESTS:
        logger.error("Required library not installed. Install with: pip install requests")
        return
    
    import argparse
    parser = argparse.ArgumentParser(description="Download GRDA PDFs from website structure")
    parser.add_argument("--website-structure", default="data/grda/website_structure.json",
                       help="Path to website_structure.json")
    parser.add_argument("--output-dir", default="data/grda",
                       help="Output directory for PDFs and manifest")
    
    args = parser.parse_args()
    
    if not Path(args.website_structure).exists():
        logger.error(f"Website structure file not found: {args.website_structure}")
        logger.error("Run grda_website_mapper.py first to create the structure file.")
        return
    
    downloader = GRDAPDFDownloader(args.website_structure, args.output_dir)
    manifest = downloader.download_all_pdfs()
    downloader.save_manifest()
    
    print(f"\n✓ Download complete!")
    print(f"  Total PDFs: {manifest['total_pdfs']}")
    print(f"  Successful: {manifest['successful_downloads']}")
    print(f"  Failed: {manifest['failed_downloads']}")


if __name__ == "__main__":
    main()

