#!/usr/bin/env python3
"""
Discover all 256 project IDs from interconnection.fyi using browser automation.
This script scrolls through the page to trigger lazy loading of all projects.
"""

import json
import re
import sys
import time
from pathlib import Path
from typing import Set

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
except ImportError:
    print("❌ Selenium not installed. Install with: pip install selenium")
    print("   Also need ChromeDriver: brew install chromedriver (Mac) or download from chromedriver.chromium.org")
    sys.exit(1)


def extract_pjm_ids_from_page_source(source: str) -> Set[str]:
    """Extract all PJM project IDs from page source."""
    pjm_ids = set()
    
    # Pattern: pjm-{queue}{num}-{proj_num}
    pattern = r'\b(pjm-[a-z]+\d+-\d+)\b'
    matches = re.findall(pattern, source, re.IGNORECASE)
    pjm_ids.update(matches)
    
    return pjm_ids


def discover_all_project_ids() -> Set[str]:
    """Use browser automation to discover all project IDs."""
    print("🌐 Starting browser automation to discover all project IDs...")
    
    # Setup Chrome options
    chrome_options = Options()
    chrome_options.add_argument('--headless')  # Run in background
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    
    driver = None
    all_ids = set()
    
    try:
        driver = webdriver.Chrome(options=chrome_options)
        url = "https://www.interconnection.fyi/?state=OH"
        print(f"   Navigating to {url}...")
        driver.get(url)
        
        # Wait for page to load
        time.sleep(3)
        
        # Get initial IDs
        initial_ids = extract_pjm_ids_from_page_source(driver.page_source)
        all_ids.update(initial_ids)
        print(f"   Initial load: {len(initial_ids)} project IDs")
        
        # Wait a bit more for initial content to load
        print("   Waiting for initial content to load...")
        time.sleep(5)
        
        # Try to find and click any "Load More" or "Show More" buttons
        try:
            load_more_buttons = driver.find_elements(By.XPATH, "//button[contains(text(), 'Load') or contains(text(), 'More') or contains(text(), 'Show')]")
            for button in load_more_buttons:
                try:
                    button.click()
                    time.sleep(2)
                    print("   Clicked a 'Load More' button")
                except:
                    pass
        except:
            pass
        
        # Scroll to load more projects - more aggressive
        print("   Scrolling to trigger lazy loading...")
        last_count = len(all_ids)
        no_change_count = 0
        max_scrolls = 100  # More scrolls
        scroll_count = 0
        
        while scroll_count < max_scrolls:
            # Scroll down incrementally
            scroll_position = driver.execute_script("return window.pageYOffset;")
            driver.execute_script("window.scrollTo(0, arguments[0] + 500);", scroll_position)
            time.sleep(1)  # Shorter wait
            
            # Also try scrolling to bottom every 5 scrolls
            if scroll_count % 5 == 0:
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(2)
            
            # Extract IDs from updated page
            current_ids = extract_pjm_ids_from_page_source(driver.page_source)
            all_ids.update(current_ids)
            
            new_count = len(all_ids)
            if new_count > last_count:
                print(f"   Found {new_count} project IDs (added {new_count - last_count})")
                last_count = new_count
                no_change_count = 0
            else:
                no_change_count += 1
                if no_change_count >= 5:  # More tolerance
                    print(f"   No new IDs after {no_change_count} scrolls, trying one more time...")
                    # One final scroll to bottom
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                    time.sleep(3)
                    current_ids = extract_pjm_ids_from_page_source(driver.page_source)
                    all_ids.update(current_ids)
                    if len(all_ids) > new_count:
                        print(f"   Found {len(all_ids)} total after final scroll!")
                        last_count = len(all_ids)
                        no_change_count = 0
                    else:
                        print(f"   Stopping after {no_change_count} scrolls with no new IDs")
                        break
            
            scroll_count += 1
        
        print(f"\n✅ Discovery complete: {len(all_ids)} project IDs found")
        
    except Exception as e:
        print(f"❌ Error during browser automation: {e}")
        print(f"   Make sure ChromeDriver is installed and in PATH")
    
    finally:
        if driver:
            driver.quit()
    
    return all_ids


def main():
    """Main function."""
    output_file = Path('data/interconnection_fyi/discovered_project_ids.json')
    
    # Load existing IDs
    existing_ids = set()
    if output_file.exists():
        with open(output_file, 'r') as f:
            data = json.load(f)
            existing_ids = set(data.get('project_ids', []))
            print(f"📂 Loaded {len(existing_ids)} existing project IDs")
    
    # Discover new IDs
    discovered_ids = discover_all_project_ids()
    
    # Merge
    all_ids = existing_ids | discovered_ids
    project_ids = sorted(list(all_ids))
    
    # Save
    output_file.parent.mkdir(parents=True, exist_ok=True)
    data = {
        'discovered_at': None,
        'total_count': len(project_ids),
        'project_ids': project_ids,
        'project_urls': [f"https://www.interconnection.fyi/project/{pid}" for pid in project_ids]
    }
    
    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"\n💾 Saved {len(project_ids)} project IDs to {output_file}")
    print(f"   Target: 256 Ohio projects")
    print(f"   Progress: {len(project_ids)}/{256} ({len(project_ids)/256*100:.1f}%)")
    
    if len(project_ids) >= 256:
        print(f"\n🎉 Found all {len(project_ids)} project IDs!")
    else:
        print(f"\n⚠️  Still missing {256 - len(project_ids)} project IDs")
        print(f"   You may need to:")
        print(f"   1. Check if the page has filters that need to be adjusted")
        print(f"   2. Try different scroll strategies")
        print(f"   3. Check browser console for API calls")


if __name__ == '__main__':
    main()

