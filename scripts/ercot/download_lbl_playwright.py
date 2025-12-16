#!/usr/bin/env python3
"""
Download LBL Interconnection Queue Dataset using Playwright
Handles JavaScript-rendered pages and click-based downloads.
"""

from playwright.sync_api import sync_playwright
from pathlib import Path
import time

def download_lbl_with_playwright(output_dir="data/ercot/raw"):
    """Download LBL dataset using Playwright to handle JavaScript."""
    
    page_url = "https://emp.lbl.gov/publications/us-interconnection-queue-data"
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"🎭 Starting Playwright browser...")
    
    with sync_playwright() as p:
        # Launch browser (headless=False to see what's happening)
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            accept_downloads=True,
            viewport={'width': 1920, 'height': 1080}
        )
        page = context.new_page()
        
        try:
            print(f"📥 Navigating to: {page_url}")
            page.goto(page_url, wait_until="networkidle", timeout=60000)
            
            # Take screenshot for documentation
            screenshot_path = output_dir.parent.parent / "docs/screenshots/ercot/discovery/lbl_page.png"
            screenshot_path.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(screenshot_path))
            print(f"📸 Screenshot saved: {screenshot_path}")
            
            # Wait for page to fully load
            time.sleep(2)
            
            # Check for and close modal/popup if present
            print("🔍 Checking for modal/popup...")
            modal_selectors = [
                'button:has-text("Close")',
                'button:has-text("X")',
                '[aria-label="Close"]',
                '.modal-close',
                '.close-button',
                'button[class*="close"]',
                # Try to find the email signup modal and close it
                'form[class*="email"] button:has-text("Close")',
                'div[class*="modal"] button:has-text("Close")',
            ]
            
            modal_closed = False
            for selector in modal_selectors:
                try:
                    close_button = page.query_selector(selector)
                    if close_button and close_button.is_visible():
                        print(f"   Found close button: {selector}")
                        close_button.click()
                        time.sleep(1)
                        modal_closed = True
                        print("✅ Modal closed")
                        break
                except:
                    continue
            
            # If no close button found, try pressing Escape key
            if not modal_closed:
                print("   Trying Escape key to close modal...")
                page.keyboard.press('Escape')
                time.sleep(1)
            
            # Also try clicking outside the modal to dismiss it
            if not modal_closed:
                print("   Trying to click outside modal...")
                try:
                    # Click on a non-modal area (top left corner)
                    page.mouse.click(10, 10)
                    time.sleep(1)
                except:
                    pass
            
            # Look for download link
            print("🔍 Looking for download link...")
            
            # Try multiple selectors for the download link
            download_selectors = [
                'a:has-text("Data File XLSX")',
                'a[href*=".xlsx"]',
                'a:has-text("13.42 MB")',
                'a:has-text("download")',
            ]
            
            download_link = None
            for selector in download_selectors:
                try:
                    download_link = page.query_selector(selector)
                    if download_link:
                        print(f"✅ Found download link with selector: {selector}")
                        break
                except:
                    continue
            
            if not download_link:
                print("⚠️  Could not find download link automatically")
                print("💡 Please manually click the download link in the browser window")
                print("   The file should download to your default download folder")
                input("Press Enter after you've downloaded the file...")
                browser.close()
                return None
            
            # Set up download handler
            download_path = None
            
            def handle_download(download):
                nonlocal download_path
                # Wait for download to complete
                suggested_filename = download.suggested_filename
                output_path = output_dir / suggested_filename
                download.save_as(str(output_path))
                download_path = output_path
                print(f"✅ Download started: {suggested_filename}")
            
            page.on("download", handle_download)
            
            # Click the download link
            print("🖱️  Clicking download link...")
            download_link.click()
            
            # Wait for download to complete (up to 5 minutes for large file)
            print("⏳ Waiting for download to complete...")
            time.sleep(10)  # Initial wait
            
            # Check if download completed
            max_wait = 300  # 5 minutes
            waited = 0
            while download_path is None and waited < max_wait:
                time.sleep(2)
                waited += 2
                if waited % 10 == 0:
                    print(f"   Still waiting... ({waited}s)")
            
            if download_path and download_path.exists():
                file_size = download_path.stat().st_size
                print(f"\n✅ Download completed!")
                print(f"   Location: {download_path}")
                print(f"   Size: {file_size:,} bytes ({file_size / 1024 / 1024:.2f} MB)")
                return download_path
            else:
                print("⚠️  Download may not have completed")
                print("💡 Check your browser's download folder")
                return None
                
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
            return None
        finally:
            # Keep browser open for a moment to see result
            time.sleep(3)
            browser.close()

if __name__ == "__main__":
    print("=" * 60)
    print("LBL Dataset Downloader (Playwright)")
    print("=" * 60)
    print("\nThis script will:")
    print("1. Open a browser window")
    print("2. Navigate to the LBL publication page")
    print("3. Click the download link")
    print("4. Save the file to data/ercot/raw/")
    print("\nNote: No sign-in required (confirmed by web search)")
    print("\n" + "=" * 60 + "\n")
    
    result = download_lbl_with_playwright()
    
    if result:
        print(f"\n✅ Success! File ready for Step 2 analysis.")
    else:
        print(f"\n⚠️  Download may have failed. Check browser window or download folder.")

