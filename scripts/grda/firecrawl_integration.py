#!/usr/bin/env python3
"""
Firecrawl integration for GRDA website scraping.

Firecrawl can simplify website crawling and PDF discovery by:
1. Scraping pages and extracting all links (including PDFs)
2. Following links automatically
3. Extracting structured content from pages
4. Handling JavaScript-rendered content

This script demonstrates how to use Firecrawl for GRDA data extraction.
"""

import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    import requests
    HAVE_REQUESTS = True
except ImportError:
    HAVE_REQUESTS = False
    logger.warning("requests not installed. Install with: pip install requests")

FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY") or os.environ.get("firecrawl")
FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v2"  # Using v2 API


def scrape_url(url: str, include_tags: List[str] = None) -> Dict:
    """
    Scrape a single URL using Firecrawl.
    
    Args:
        url: URL to scrape
        include_tags: Optional list of HTML tags to include (e.g., ['a', 'pdf'])
    
    Returns:
        Dictionary with scraped content
    """
    if not HAVE_REQUESTS:
        logger.error("requests library required")
        return {}
    
    if not FIRECRAWL_API_KEY:
        logger.error("FIRECRAWL_API_KEY not set in environment")
        return {}
    
    headers = {
        "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # v2 API format
    payload = {
        "url": url,
        "formats": ["markdown", "html"]  # Get both formats
    }
    
    if include_tags:
        payload["includeTags"] = include_tags
    
    try:
        response = requests.post(
            f"{FIRECRAWL_BASE_URL}/scrape",
            headers=headers,
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        
        # Check for errors
        if not result.get("success", True):
            error = result.get("error", "Unknown error")
            logger.error(f"Firecrawl API error: {error}")
            if "credits" in error.lower():
                logger.warning("⚠️  Insufficient credits. Please upgrade your Firecrawl plan at https://firecrawl.dev/pricing")
            return {}
        
        return result
    except requests.exceptions.RequestException as e:
        logger.error(f"Firecrawl API request error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_data = e.response.json()
                logger.error(f"Error response: {error_data}")
            except:
                logger.error(f"Response: {e.response.text}")
        return {}


def extract_pdf_links_from_markdown(markdown: str, base_url: str = "") -> List[str]:
    """
    Extract PDF links from Firecrawl markdown content.
    
    Args:
        markdown: Markdown content from Firecrawl
        base_url: Base URL for resolving relative links
    
    Returns:
        List of PDF URLs
    """
    import re
    from urllib.parse import urljoin
    
    pdf_links = []
    
    # Pattern 1: Markdown links [text](url.pdf)
    markdown_pattern = r'\[([^\]]+)\]\(([^)]+\.pdf[^)]*)\)'
    matches = re.findall(markdown_pattern, markdown, re.IGNORECASE)
    for text, url in matches:
        if base_url:
            url = urljoin(base_url, url)
        pdf_links.append(url)
    
    # Pattern 2: Direct PDF URLs
    direct_pattern = r'https?://[^\s\)]+\.pdf'
    direct_matches = re.findall(direct_pattern, markdown, re.IGNORECASE)
    pdf_links.extend(direct_matches)
    
    # Deduplicate
    return list(set(pdf_links))


def extract_pdf_links_from_firecrawl_data(data: List[Dict]) -> List[Dict]:
    """
    Extract PDF links from Firecrawl scraped data.
    
    Args:
        data: List of scraped page data from Firecrawl
    
    Returns:
        List of PDF link information
    """
    pdf_links = []
    
    for page in data:
        page_url = page.get("url", "")
        links = page.get("links", [])
        
        for link in links:
            link_url = link.get("url", "") if isinstance(link, dict) else str(link)
            if link_url.lower().endswith('.pdf'):
                pdf_links.append({
                    "url": link_url,
                    "source_page": page_url,
                    "title": page.get("title", ""),
                    "metadata": page.get("metadata", {})
                })
    
    return pdf_links


def discover_grda_pdfs_with_firecrawl(start_urls: List[str] = None) -> List[Dict]:
    """
    Discover GRDA PDFs using Firecrawl.
    
    Args:
        start_urls: List of starting URLs (defaults to GRDA electricity page)
    
    Returns:
        List of discovered PDF information
    """
    if start_urls is None:
        start_urls = [
            "https://grda.com/electricity/",
            "https://grda.com/about/",
            "https://grda.com/water/",
            "https://grda.com/governance/",
            "https://grda.com/financials/"
        ]
    
    all_pdfs = []
    
    logger.info(f"Starting Firecrawl discovery from {len(start_urls)} URLs")
    
    for url in start_urls:
        logger.info(f"Scraping: {url}")
        
        # Use scrape endpoint (v2 API doesn't have the same crawl endpoint)
        scraped = scrape_url(url)
        
        if scraped and scraped.get("data"):
            data = scraped["data"]
            markdown = data.get("markdown", "")
            html = data.get("html", "")
            
            # Extract PDF links from both markdown and HTML
            pdf_urls = extract_pdf_links_from_markdown(markdown, base_url=url)
            
            # Also extract from HTML (more reliable for links)
            if html:
                import re
                from urllib.parse import urljoin
                html_pdfs = re.findall(r'href=[\"\']([^\"\']+\.pdf[^\"\']*)[\"\']', html, re.IGNORECASE)
                for pdf_url in html_pdfs:
                    if base_url:
                        pdf_url = urljoin(url, pdf_url)
                    if pdf_url not in pdf_urls:
                        pdf_urls.append(pdf_url)
            
            for pdf_url in pdf_urls:
                all_pdfs.append({
                    "url": pdf_url,
                    "source_page": url,
                    "title": data.get("metadata", {}).get("title", ""),
                    "discovered_via": "firecrawl_scrape"
                })
            
            logger.info(f"Found {len(pdf_urls)} PDFs from {url}")
    
    # Deduplicate
    seen_urls = set()
    unique_pdfs = []
    for pdf in all_pdfs:
        url = pdf.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique_pdfs.append(pdf)
    
    logger.info(f"Total unique PDFs discovered: {len(unique_pdfs)}")
    return unique_pdfs


def save_firecrawl_results(pdfs: List[Dict], output_file: str = "data/grda/firecrawl_pdfs.json"):
    """Save discovered PDFs to JSON file."""
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({
            "discovery_method": "firecrawl",
            "total_pdfs": len(pdfs),
            "pdfs": pdfs
        }, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Saved {len(pdfs)} PDFs to {output_path}")


def main():
    """Main execution."""
    if not FIRECRAWL_API_KEY:
        logger.error("FIRECRAWL_API_KEY not found in environment")
        logger.info("Set it in .env file: FIRECRAWL_API_KEY=fc-...")
        return
    
    # Test API key first
    logger.info("Testing Firecrawl API key...")
    test_result = scrape_url("https://grda.com/electricity/")
    
    if not test_result:
        logger.error("Failed to connect to Firecrawl API")
        logger.info("This could be due to:")
        logger.info("  1. Invalid API key")
        logger.info("  2. Insufficient credits (most likely)")
        logger.info("  3. Network issues")
        logger.info("\nTo add credits, visit: https://firecrawl.dev/pricing")
        return
    
    if "error" in test_result:
        error_msg = test_result.get('error', 'Unknown error')
        logger.error(f"Firecrawl API error: {error_msg}")
        if "credits" in error_msg.lower() or "payment" in error_msg.lower():
            logger.warning("\n⚠️  INSUFFICIENT CREDITS")
            logger.warning("The API key is valid but the account needs credits.")
            logger.warning("Please upgrade your Firecrawl plan at: https://firecrawl.dev/pricing")
        return
    
    logger.info("✓ Firecrawl API key is valid and has credits")
    
    # Discover PDFs
    pdfs = discover_grda_pdfs_with_firecrawl()
    
    if pdfs:
        save_firecrawl_results(pdfs)
        print(f"\n✓ Discovered {len(pdfs)} PDFs using Firecrawl")
        print(f"  Saved to: data/grda/firecrawl_pdfs.json")
    else:
        logger.warning("No PDFs discovered")


if __name__ == "__main__":
    main()

