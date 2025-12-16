#!/usr/bin/env python3
"""
Debug script to see what Firecrawl actually returns from OG&E pages.
This helps us understand the format so we can improve extraction patterns.
"""

import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

try:
    import requests
    HAVE_REQUESTS = True
except ImportError:
    HAVE_REQUESTS = False
    print("requests library required")

FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY") or os.environ.get("firecrawl")
FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v2"


def scrape_url(url: str) -> dict:
    """Scrape a URL using Firecrawl."""
    if not HAVE_REQUESTS or not FIRECRAWL_API_KEY:
        return {}
    
    headers = {
        "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "url": url,
        "formats": ["markdown", "html"]
    }
    
    try:
        response = requests.post(
            f"{FIRECRAWL_BASE_URL}/scrape",
            headers=headers,
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return {}


def main():
    """Debug: Save raw content from OG&E pages."""
    urls = [
        "https://www.oge.com/wps/portal/ord/who-we-are/what-we-do/",
    ]
    
    output_dir = Path("data/oge/debug")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    for i, url in enumerate(urls, 1):
        print(f"\n[{i}/{len(urls)}] Scraping: {url}")
        result = scrape_url(url)
        
        if not result or not result.get("data"):
            print("  ⚠ No data received")
            continue
        
        data = result["data"]
        markdown = data.get("markdown", "")
        html = data.get("html", "")
        
        # Save markdown
        md_file = output_dir / f"page_{i}_markdown.txt"
        with open(md_file, 'w', encoding='utf-8') as f:
            f.write(markdown)
        print(f"  ✓ Saved markdown ({len(markdown)} chars) to {md_file}")
        
        # Save first 5000 chars of HTML
        html_file = output_dir / f"page_{i}_html_sample.txt"
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(html[:5000])
        print(f"  ✓ Saved HTML sample ({min(5000, len(html))} chars) to {html_file}")
        
        # Save full JSON
        json_file = output_dir / f"page_{i}_full.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"  ✓ Saved full JSON to {json_file}")
        
        # Print a sample of the markdown
        print(f"\n  Markdown sample (first 500 chars):")
        print("  " + "-" * 60)
        print("  " + markdown[:500].replace("\n", "\n  "))
        print("  " + "-" * 60)
    
    print(f"\n✓ Debug files saved to {output_dir}/")
    print("  Review these files to understand OG&E's website format")


if __name__ == "__main__":
    main()

