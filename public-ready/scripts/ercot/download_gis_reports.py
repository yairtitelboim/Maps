#!/usr/bin/env python3
"""
Download ERCOT GIS Report XLSX Files
Based on our LBL download experience - handles JavaScript, modals, file downloads
"""

from playwright.sync_api import sync_playwright
from pathlib import Path
import time
import re
from datetime import datetime

def download_gis_reports(
    output_dir="data/ercot/gis_reports/raw",
    file_type="GIS_Report",  # or "Co-located_Battery" or "all"
    max_files=None  # Limit for testing
):
    """Download ERCOT GIS Report files."""
    
    page_url = "https://www.ercot.com/mp/data-products/data-product-details?id=pg7-200-er"
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("ERCOT GIS Report Downloader")
    print("=" * 60)
    print(f"Target: {file_type} files")
    print(f"Output: {output_dir}")
    print()
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        
        try:
            print(f"📥 Navigating to: {page_url}")
            page.goto(page_url, wait_until="domcontentloaded", timeout=120000)
            time.sleep(3)
            
            # Wait for table to load
            try:
                page.wait_for_selector('table, [role="table"]', timeout=30000)
            except:
                print("⚠️  Table selector not found, continuing anyway...")
            
            # Take screenshot for documentation
            screenshot_path = output_dir.parent.parent / "docs/screenshots/ercot/gis_report_page.png"
            screenshot_path.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(screenshot_path))
            print(f"📸 Screenshot saved: {screenshot_path}")
            
            # Handle modals (like LBL experience)
            print("🔍 Checking for modals...")
            modal_selectors = [
                'button:has-text("Close")',
                'button:has-text("X")',
                '[aria-label="Close"]',
                '.modal-close',
            ]
            
            for selector in modal_selectors:
                try:
                    close_btn = page.query_selector(selector)
                    if close_btn and close_btn.is_visible():
                        close_btn.click()
                        time.sleep(1)
                        print("✅ Modal closed")
                        break
                except:
                    continue
            
            # Try Escape key
            page.keyboard.press('Escape')
            time.sleep(1)
            
            # Find the "Available Files" table
            print("🔍 Looking for file table...")
            
            # Scroll to find table (may be below fold)
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(2)
            
            # Look for table with file links
            # Based on snapshot, files are in table rows with download links
            print("Searching for file table...")
            
            # Try multiple approaches to find the table
            file_data = []
            
            # Approach 1: Look for links with "xl x" text
            links = page.query_selector_all('a')
            print(f"Found {len(links)} total links on page")
            
            for link in links:
                try:
                    link_text = link.inner_text().strip()
                    href = link.get_attribute('href') or ''
                    
                    # Check if this looks like a download link
                    if 'xl x' in link_text.lower() or '.xlsx' in href.lower() or '.xls' in href.lower():
                        # Get parent row to extract file name
                        row = link.evaluate_handle("el => el.closest('tr')")
                        if row:
                            row_text = row.inner_text()
                            
                            # Check if row contains GIS_Report or Battery report
                            if 'GIS_Report' in row_text or 'Co-located_Battery' in row_text:
                                # Extract file name from row (first cell usually)
                                cells = row.query_selector_all('td, th')
                                file_name = None
                                if len(cells) > 0:
                                    file_name = cells[0].inner_text().strip()
                                
                                file_data.append({
                                    'link': link,
                                    'href': href,
                                    'row_text': row_text,
                                    'file_name': file_name
                                })
                                print(f"   Found: {file_name}")
                except Exception as e:
                    continue
            
            print(f"Extracted {len(file_data)} file entries")
            
            if len(file_data) == 0:
                # Approach 2: Look for table rows directly
                print("Trying table row approach...")
                rows = page.query_selector_all('table tr')
                print(f"Found {len(rows)} table rows")
                
                for row in rows:
                    try:
                        row_text = row.inner_text()
                        if 'GIS_Report' in row_text or 'Co-located_Battery' in row_text:
                            # Find link in this row
                            link = row.query_selector('a')
                            if link:
                                href = link.get_attribute('href') or ''
                                cells = row.query_selector_all('td')
                                file_name = cells[0].inner_text().strip() if len(cells) > 0 else None
                                
                                file_data.append({
                                    'link': link,
                                    'href': href,
                                    'row_text': row_text,
                                    'file_name': file_name
                                })
                    except:
                        continue
            
            file_links = [item['link'] for item in file_data]
            print(f"Total file links found: {len(file_links)}")
            
            # Filter by file type using file_data
            if file_type != "all":
                filtered_data = []
                for item in file_data:
                    if file_type == "GIS_Report" and "GIS_Report" in item['row_text']:
                        filtered_data.append(item)
                    elif file_type == "Co-located_Battery" and "Co-located_Battery" in item['row_text']:
                        filtered_data.append(item)
                
                file_data = filtered_data
                file_links = [item['link'] for item in file_data]
                print(f"Filtered to {len(file_links)} {file_type} files")
            
            # Limit for testing
            if max_files:
                file_links = file_links[:max_files]
                file_data = file_data[:max_files]
                print(f"Limited to {max_files} files for testing")
            
            print()
            print(f"📥 Downloading {len(file_links)} files...")
            print()
            
            downloaded_files = []
            failed_files = []
            
            # Set up download handler (before loop)
            download_paths = {}  # Track downloads by file name
            
            def handle_download(download):
                """Handle file download."""
                try:
                    suggested = download.suggested_filename
                    # Try to match to our file name, or use suggested
                    file_name = suggested
                    for fname in download_paths.keys():
                        if fname in suggested or suggested in fname:
                            file_name = fname
                            break
                    
                    output_path = output_dir / file_name
                    download.save_as(str(output_path))
                    download_paths[file_name] = output_path
                    print(f"   📥 Download started: {file_name}")
                except Exception as e:
                    print(f"   ⚠️  Download handler error: {e}")
            
            page.on("download", handle_download)
            
            for idx, item in enumerate(zip(file_links, file_data), 1):
                link, data = item
                try:
                    # Use file name from data
                    file_name_raw = data['file_name'] or ""
                    
                    # Extract file name (remove extra whitespace, add .xlsx if needed)
                    file_name = file_name_raw.strip()
                    if not file_name.endswith('.xlsx') and not file_name.endswith('.xls'):
                        file_name = file_name + ".xlsx"
                    
                    # Clean up file name (remove special chars that might cause issues)
                    file_name = re.sub(r'[<>:"/\\|?*]', '_', file_name)
                    
                    print(f"[{idx}/{len(file_links)}] Clicking: {file_name}")
                    
                    # Track this file
                    download_paths[file_name] = None
                    
                    # Click the link and wait for download
                    with page.expect_download(timeout=30000) as download_info:
                        link.click()
                    
                    download = download_info.value
                    
                    # Save the download
                    output_path = output_dir / file_name
                    download.save_as(str(output_path))
                    
                    # Wait a moment for file to be written
                    time.sleep(1)
                    
                    # Check if file was downloaded successfully
                    if output_path.exists() and output_path.stat().st_size > 0:
                        file_size = output_path.stat().st_size
                        print(f"   ✅ Saved: {file_size:,} bytes ({file_size/1024:.1f} KB)")
                        downloaded_files.append(str(output_path))
                    else:
                        print(f"   ⚠️  Download failed or file is empty")
                        failed_files.append(file_name)
                    
                    # Rate limiting
                    time.sleep(2)
                    
                except Exception as e:
                    print(f"   ❌ Error: {e}")
                    if 'file_name' in locals():
                        failed_files.append(file_name)
                    continue
            
            print()
            print("=" * 60)
            print("DOWNLOAD SUMMARY")
            print("=" * 60)
            print(f"✅ Successfully downloaded: {len(downloaded_files)} files")
            print(f"❌ Failed: {len(failed_files)} files")
            
            if failed_files:
                print(f"\nFailed files: {failed_files}")
            
            print(f"\nFiles saved to: {output_dir}")
            
            return downloaded_files, failed_files
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
            return [], []
        finally:
            time.sleep(3)
            browser.close()

if __name__ == "__main__":
    print("=" * 60)
    print("ERCOT GIS Report Downloader")
    print("=" * 60)
    print("\nThis script will:")
    print("1. Open a browser window")
    print("2. Navigate to ERCOT GIS Report page")
    print("3. Find all file download links")
    print("4. Download XLSX files")
    print("5. Save to data/ercot/gis_reports/raw/")
    print("\n" + "=" * 60 + "\n")
    
    # Download all files (remove max_files to test with 2 first)
    import sys
    if '--test' in sys.argv:
        print("⚠️  TEST MODE: Downloading 2 files first")
        print("   Run without --test to download all files\n")
        downloaded, failed = download_gis_reports(max_files=2)
    else:
        print("📥 Downloading ALL files...")
        print("   This may take 10-20 minutes for ~90 files\n")
        downloaded, failed = download_gis_reports()
    
    if downloaded:
        print(f"\n✅ Test successful! Ready to download all files.")
        print("   Remove 'max_files=2' parameter to download all files")
    else:
        print(f"\n⚠️  Test had issues. Check browser window and errors above.")

