#!/usr/bin/env python3
"""
GRDA Website Mapper

This script maps the GRDA website structure and discovers all PDF documents.
It crawls the website starting from the electricity page and catalogs all PDFs
by vertical/category.

Requirements:
pip install requests beautifulsoup4 lxml
"""

import os
import json
import re
import logging
from pathlib import Path
from urllib.parse import urljoin, urlparse
from collections import defaultdict
import time

try:
    import requests
    from bs4 import BeautifulSoup
    HAVE_SCRAPING = True
except ImportError:
    HAVE_SCRAPING = False
    print("Warning: requests and beautifulsoup4 not installed. Install with: pip install requests beautifulsoup4 lxml")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# GRDA website base URL
GRDA_BASE_URL = "https://grda.com"
GRDA_ELECTRICITY_URL = "https://grda.com/electricity/"

# Document verticals/categories to look for
DOCUMENT_VERTICALS = {
    "permits": ["permit", "permitting", "lake permitting", "shoreline"],
    "financial_reports": ["financial", "report", "annual", "budget", "audit"],
    "shoreline_management": ["shoreline", "management", "plan", "habitable structures"],
    "recreation": ["recreation", "boat", "safety", "rules", "maps"],
    "flood_control": ["flood", "control", "water", "lake levels"],
    "pensacola_relicensing": ["pensacola", "relicensing", "hydroelectric"],
    "ccr_compliance": ["ccr", "coal", "compliance", "rule"],
    "other": []
}

class GRDAWebsiteMapper:
    def __init__(self, output_dir):
        """
        Initialize the GRDA website mapper.
        
        Args:
            output_dir: Directory to save website structure JSON
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.visited_urls = set()
        self.pdf_links = []
        self.site_structure = {
            "base_url": GRDA_BASE_URL,
            "mapping_date": None,
            "pages": [],
            "pdfs_by_vertical": defaultdict(list),
            "pdfs_by_page": defaultdict(list),
            "all_pdfs": []
        }
        
        # Session for connection pooling
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def is_pdf_link(self, url):
        """Check if a URL points to a PDF file."""
        parsed = urlparse(url)
        path = parsed.path.lower()
        return path.endswith('.pdf') or 'pdf' in parsed.query.lower()
    
    def normalize_url(self, url):
        """Normalize URL to absolute form."""
        if url.startswith('//'):
            return 'https:' + url
        elif url.startswith('/'):
            return urljoin(GRDA_BASE_URL, url)
        elif url.startswith('http'):
            return url
        else:
            return urljoin(GRDA_BASE_URL, url)
    
    def categorize_pdf(self, url, page_title="", page_text=""):
        """Categorize a PDF into a vertical based on URL and context."""
        url_lower = url.lower()
        text_lower = (page_title + " " + page_text).lower()
        combined = url_lower + " " + text_lower
        
        # Check each vertical
        for vertical, keywords in DOCUMENT_VERTICALS.items():
            if vertical == "other":
                continue
            for keyword in keywords:
                if keyword in combined:
                    return vertical
        
        return "other"
    
    def extract_pdfs_from_page(self, url, html_content):
        """Extract all PDF links from a page's HTML content."""
        pdfs = []
        soup = BeautifulSoup(html_content, 'lxml')
        
        # Find all links
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')
            normalized_url = self.normalize_url(href)
            
            if self.is_pdf_link(normalized_url):
                pdf_info = {
                    "url": normalized_url,
                    "link_text": link.get_text(strip=True),
                    "page_url": url,
                    "vertical": self.categorize_pdf(normalized_url, soup.title.string if soup.title else "", soup.get_text())
                }
                pdfs.append(pdf_info)
        
        # Also check for PDFs in iframes, embeds, and object tags
        for tag in soup.find_all(['iframe', 'embed', 'object']):
            src = tag.get('src') or tag.get('data')
            if src:
                normalized_url = self.normalize_url(src)
                if self.is_pdf_link(normalized_url):
                    pdf_info = {
                        "url": normalized_url,
                        "link_text": tag.get('title', '') or tag.get('alt', ''),
                        "page_url": url,
                        "vertical": self.categorize_pdf(normalized_url, soup.title.string if soup.title else "", soup.get_text())
                    }
                    pdfs.append(pdf_info)
        
        return pdfs
    
    def crawl_page(self, url, max_depth=3, current_depth=0):
        """Crawl a single page and extract PDFs."""
        if current_depth > max_depth:
            return
        
        if url in self.visited_urls:
            return
        
        # Only crawl GRDA domain
        parsed = urlparse(url)
        if parsed.netloc and 'grda.com' not in parsed.netloc:
            return
        
        self.visited_urls.add(url)
        logger.info(f"Crawling: {url} (depth: {current_depth})")
        
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            # Check if it's HTML
            content_type = response.headers.get('Content-Type', '').lower()
            if 'html' not in content_type:
                return
            
            html_content = response.text
            soup = BeautifulSoup(html_content, 'lxml')
            page_title = soup.title.string if soup.title else ""
            
            # Extract PDFs from this page
            pdfs = self.extract_pdfs_from_page(url, html_content)
            
            page_info = {
                "url": url,
                "title": page_title,
                "depth": current_depth,
                "pdf_count": len(pdfs),
                "pdfs": pdfs
            }
            
            self.site_structure["pages"].append(page_info)
            
            # Add PDFs to collections
            for pdf in pdfs:
                if pdf["url"] not in [p["url"] for p in self.site_structure["all_pdfs"]]:
                    self.site_structure["all_pdfs"].append(pdf)
                    self.site_structure["pdfs_by_vertical"][pdf["vertical"]].append(pdf)
                    self.site_structure["pdfs_by_page"][url].append(pdf)
            
            # Find links to other pages on GRDA domain
            if current_depth < max_depth:
                for link in soup.find_all('a', href=True):
                    href = link.get('href', '')
                    next_url = self.normalize_url(href)
                    
                    # Only follow GRDA links
                    if 'grda.com' in next_url and next_url not in self.visited_urls:
                        # Avoid crawling PDFs, images, etc.
                        if not any(next_url.lower().endswith(ext) for ext in ['.pdf', '.jpg', '.png', '.gif', '.zip', '.doc', '.docx']):
                            time.sleep(0.5)  # Be polite
                            self.crawl_page(next_url, max_depth, current_depth + 1)
        
        except requests.RequestException as e:
            logger.error(f"Error crawling {url}: {e}")
        except Exception as e:
            logger.error(f"Unexpected error crawling {url}: {e}")
    
    def map_website(self, start_url=None, max_depth=3):
        """Map the entire GRDA website starting from a given URL."""
        if start_url is None:
            start_url = GRDA_ELECTRICITY_URL
        
        logger.info(f"Starting website mapping from {start_url}")
        logger.info(f"Max crawl depth: {max_depth}")
        
        from datetime import datetime
        self.site_structure["mapping_date"] = datetime.now().isoformat()
        
        # Start crawling
        self.crawl_page(start_url, max_depth=max_depth)
        
        # Also crawl main pages that might have PDFs
        important_pages = [
            "https://grda.com/",
            "https://grda.com/resources/",
            "https://grda.com/lake-permitting/",
            "https://grda.com/financial-reports/",
            "https://grda.com/shoreline-management-plans/",
        ]
        
        for page_url in important_pages:
            if page_url not in self.visited_urls:
                time.sleep(1)
                self.crawl_page(page_url, max_depth=2)
        
        # Summary statistics
        total_pdfs = len(self.site_structure["all_pdfs"])
        logger.info(f"Mapping complete. Found {total_pdfs} PDFs across {len(self.site_structure['pages'])} pages")
        
        for vertical, pdfs in self.site_structure["pdfs_by_vertical"].items():
            logger.info(f"  {vertical}: {len(pdfs)} PDFs")
        
        return self.site_structure
    
    def save_structure(self, filename="website_structure.json"):
        """Save the website structure to JSON file."""
        output_path = self.output_dir / filename
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.site_structure, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved website structure to {output_path}")
        return output_path


def main():
    """Main execution function."""
    if not HAVE_SCRAPING:
        logger.error("Required libraries not installed. Install with: pip install requests beautifulsoup4 lxml")
        return
    
    import argparse
    parser = argparse.ArgumentParser(description="Map GRDA website and discover PDFs")
    parser.add_argument("--output-dir", default="data/grda", help="Output directory for website structure")
    parser.add_argument("--start-url", default=GRDA_ELECTRICITY_URL, help="Starting URL for crawl")
    parser.add_argument("--max-depth", type=int, default=3, help="Maximum crawl depth")
    
    args = parser.parse_args()
    
    mapper = GRDAWebsiteMapper(args.output_dir)
    structure = mapper.map_website(start_url=args.start_url, max_depth=args.max_depth)
    mapper.save_structure()
    
    print(f"\n✓ Mapping complete!")
    print(f"  Total PDFs found: {len(structure['all_pdfs'])}")
    print(f"  Pages crawled: {len(structure['pages'])}")
    print(f"\nPDFs by vertical:")
    for vertical, pdfs in structure["pdfs_by_vertical"].items():
        if pdfs:
            print(f"  {vertical}: {len(pdfs)}")


if __name__ == "__main__":
    main()

