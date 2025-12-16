#!/usr/bin/env python3
"""
Download LBL Interconnection Queue Dataset
Attempts to download the XLSX file from LBL publication page.
"""

import requests
from pathlib import Path
import re
from urllib.parse import urljoin, urlparse

def find_download_url(page_url, page_content):
    """Extract download URL from page content."""
    # Look for XLSX file links
    patterns = [
        r'href=["\']([^"\']*\.xlsx[^"\']*)["\']',
        r'href=["\']([^"\']*download[^"\']*xlsx[^"\']*)["\']',
        r'https?://[^"\'\s]+\.xlsx',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, page_content, re.IGNORECASE)
        if matches:
            for match in matches:
                # Make absolute URL if relative
                if match.startswith('http'):
                    return match
                else:
                    return urljoin(page_url, match)
    
    return None

def download_lbl_dataset(output_dir="data/ercot/raw"):
    """Download LBL interconnection queue dataset."""
    
    page_url = "https://emp.lbl.gov/publications/us-interconnection-queue-data"
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Headers to simulate browser
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
    
    print(f"📥 Fetching LBL publication page: {page_url}")
    
    try:
        # Fetch the page
        response = requests.get(page_url, headers=headers, timeout=30)
        response.raise_for_status()
        
        print(f"✅ Page fetched successfully (status: {response.status_code})")
        
        # Try to find download URL in page content
        download_url = find_download_url(page_url, response.text)
        
        if not download_url:
            print("⚠️  Could not find direct download URL in page content")
            print("💡 Options:")
            print("   1. Use Playwright to click the download link")
            print("   2. Manually download from browser")
            print("   3. Check if URL requires authentication")
            return None
        
        print(f"🔗 Found download URL: {download_url}")
        
        # Download the file
        print(f"📥 Downloading file...")
        file_response = requests.get(download_url, headers=headers, timeout=300, stream=True)
        file_response.raise_for_status()
        
        # Determine filename
        content_disposition = file_response.headers.get('Content-Disposition', '')
        if 'filename=' in content_disposition:
            filename = re.findall(r'filename="?([^";]+)"?', content_disposition)[0]
        else:
            filename = Path(urlparse(download_url).path).name or "lbl_interconnection_queue_data.xlsx"
        
        output_path = output_dir / filename
        
        # Save file
        total_size = int(file_response.headers.get('Content-Length', 0))
        downloaded = 0
        
        with open(output_path, 'wb') as f:
            for chunk in file_response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        print(f"\r   Progress: {percent:.1f}% ({downloaded}/{total_size} bytes)", end='', flush=True)
        
        print(f"\n✅ File downloaded successfully!")
        print(f"   Location: {output_path}")
        print(f"   Size: {downloaded:,} bytes ({downloaded / 1024 / 1024:.2f} MB)")
        
        return output_path
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error downloading: {e}")
        print("\n💡 Alternative approaches:")
        print("   1. Use Playwright to handle JavaScript/download")
        print("   2. Manually download from browser (no sign-in required per web search)")
        print("   3. Check if Cloudflare protection is blocking automated access")
        return None

if __name__ == "__main__":
    result = download_lbl_dataset()
    if not result:
        print("\n⚠️  Automated download failed. Consider using Playwright or manual download.")

