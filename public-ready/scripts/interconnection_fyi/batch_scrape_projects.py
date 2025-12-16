#!/usr/bin/env python3
"""
Batch scrape individual project pages from interconnection.fyi with health checks.

Features:
- Batch processing (configurable batch size)
- Health checks every N batches
- Retry logic for failed requests
- Checkpoint saving for resume capability
- Progress tracking and logging
"""

import os
import json
import time
import sys
import requests
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from interconnection_fyi.health_check import (
    check_firecrawl_api_health,
    validate_scrape_result,
    log_health_check
)

load_dotenv()

FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY") or os.environ.get("firecrawl")
FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"

# Configuration
BATCH_SIZE = 10
DELAY_BETWEEN_BATCHES = 2  # seconds
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds
HEALTH_CHECK_INTERVAL = 5  # Check health every N batches
MAX_CREDITS = 300  # Safety limit
CHECKPOINT_DIR = Path("data/interconnection_fyi/checkpoints")
RAW_DIR = Path("data/interconnection_fyi/raw")


def scrape_project_page(url: str, retry_count: int = 0) -> Optional[Dict]:
    """
    Scrape a single project page using Firecrawl.
    
    Args:
        url: Project page URL
        retry_count: Current retry attempt
    
    Returns:
        Firecrawl response dict or None if failed
    """
    if not FIRECRAWL_API_KEY:
        print(f"❌ No Firecrawl API key found")
        return None
    
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
        result = response.json()
        
        if validate_scrape_result(result):
            return result
        else:
            print(f"⚠️  Invalid response for {url}")
            return None
            
    except requests.exceptions.Timeout:
        if retry_count < MAX_RETRIES:
            print(f"⏳ Timeout, retrying ({retry_count + 1}/{MAX_RETRIES})...")
            time.sleep(RETRY_DELAY * (retry_count + 1))  # Exponential backoff
            return scrape_project_page(url, retry_count + 1)
        else:
            print(f"❌ Max retries reached for {url}")
            return None
            
    except requests.exceptions.RequestException as e:
        if retry_count < MAX_RETRIES:
            print(f"⚠️  Error: {e}, retrying ({retry_count + 1}/{MAX_RETRIES})...")
            time.sleep(RETRY_DELAY * (retry_count + 1))
            return scrape_project_page(url, retry_count + 1)
        else:
            print(f"❌ Failed after {MAX_RETRIES} retries: {url}")
            return None


def save_batch_results(batch_num: int, results: List[Dict], failed_urls: List[str]):
    """Save batch results to file."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    
    batch_file = RAW_DIR / f"batch_{batch_num:03d}.json"
    
    data = {
        'batch_number': batch_num,
        'timestamp': datetime.now().isoformat(),
        'total_requests': len(results) + len(failed_urls),
        'successful': len(results),
        'failed': len(failed_urls),
        'results': results,
        'failed_urls': failed_urls
    }
    
    with open(batch_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"💾 Saved batch {batch_num} to {batch_file}")


def save_checkpoint(batch_num: int, processed_urls: List[str], failed_urls: List[str], remaining_urls: List[str]):
    """Save checkpoint for resume capability."""
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    
    checkpoint_file = CHECKPOINT_DIR / f"checkpoint_batch_{batch_num:03d}.json"
    
    checkpoint = {
        'batch_number': batch_num,
        'timestamp': datetime.now().isoformat(),
        'processed_urls': processed_urls,
        'failed_urls': failed_urls,
        'remaining_urls': remaining_urls,
        'total_processed': len(processed_urls),
        'total_failed': len(failed_urls),
        'total_remaining': len(remaining_urls)
    }
    
    with open(checkpoint_file, 'w') as f:
        json.dump(checkpoint, f, indent=2)
    
    print(f"💾 Checkpoint saved: {checkpoint_file}")


def load_checkpoint() -> Optional[Dict]:
    """Load most recent checkpoint."""
    if not CHECKPOINT_DIR.exists():
        return None
    
    checkpoint_files = sorted(CHECKPOINT_DIR.glob("checkpoint_batch_*.json"))
    if not checkpoint_files:
        return None
    
    latest_checkpoint = checkpoint_files[-1]
    
    with open(latest_checkpoint, 'r') as f:
        checkpoint = json.load(f)
    
    print(f"📂 Loaded checkpoint from batch {checkpoint['batch_number']}")
    print(f"   Processed: {checkpoint['total_processed']}, Failed: {checkpoint['total_failed']}, Remaining: {checkpoint['total_remaining']}")
    
    return checkpoint


def scrape_projects_in_batches(project_urls: List[str], start_from_checkpoint: bool = False, batch_size: int = BATCH_SIZE, max_credits: int = MAX_CREDITS) -> Tuple[List[Dict], List[str]]:
    """
    Scrape projects in batches with health checks.
    
    Args:
        project_urls: List of project page URLs
        start_from_checkpoint: Whether to resume from checkpoint
    
    Returns:
        Tuple of (successful_results, failed_urls)
    """
    all_results = []
    all_failed_urls = []
    
    # Load checkpoint if resuming
    if start_from_checkpoint:
        checkpoint = load_checkpoint()
        if checkpoint:
            # Start with remaining URLs
            project_urls = checkpoint['remaining_urls']
            all_failed_urls = checkpoint['failed_urls']
            start_batch = checkpoint['batch_number'] + 1
            print(f"🔄 Resuming from batch {start_batch}")
        else:
            start_batch = 1
            print("ℹ️  No checkpoint found, starting from beginning")
    else:
        start_batch = 1
    
    total_batches = (len(project_urls) + batch_size - 1) // batch_size
    credits_used = 0
    
    print(f"\n📦 Starting batch scraping:")
    print(f"   Total URLs: {len(project_urls)}")
    print(f"   Batch size: {batch_size}")
    print(f"   Total batches: {total_batches}")
    print(f"   Starting from batch: {start_batch}")
    print(f"   Max credits: {max_credits}")
    
    for batch_start in range(0, len(project_urls), batch_size):
        batch = project_urls[batch_start:batch_start + batch_size]
        batch_num = (batch_start // batch_size) + start_batch
        
        # Check credit limit
        if credits_used >= max_credits:
            print(f"\n⚠️  Credit limit reached ({credits_used}/{MAX_CREDITS})")
            print(f"   Saving checkpoint and stopping...")
            remaining_urls = project_urls[batch_start:]
            save_checkpoint(batch_num - 1, 
                          [r.get('url', '') for r in all_results if r.get('url')],
                          all_failed_urls,
                          remaining_urls)
            break
        
        # Health check every N batches
        if batch_num % HEALTH_CHECK_INTERVAL == 0:
            print(f"\n🏥 Health check (batch {batch_num})...")
            health_status = check_firecrawl_api_health()
            log_health_check(CHECKPOINT_DIR, health_status)
            
            if not health_status.get('healthy', False):
                print(f"⚠️  Health check failed: {health_status.get('error')}")
                print(f"   Waiting 30 seconds before continuing...")
                time.sleep(30)
            else:
                print(f"✅ Health check passed (response time: {health_status.get('response_time_ms', 0):.0f}ms)")
        
        print(f"\n📦 Batch {batch_num}/{total_batches}: Processing {len(batch)} projects...")
        
        batch_results = []
        batch_failed = []
        
        for i, url in enumerate(batch, 1):
            print(f"   [{i}/{len(batch)}] Scraping {url}...", end=" ", flush=True)
            
            result = scrape_project_page(url)
            
            if result:
                # Add URL to result for tracking
                result['url'] = url
                batch_results.append(result)
                credits_used += 1
                print("✅")
            else:
                batch_failed.append(url)
                print("❌")
            
            # Small delay between requests
            if i < len(batch):
                time.sleep(0.5)
        
        all_results.extend(batch_results)
        all_failed_urls.extend(batch_failed)
        
        # Save batch results
        save_batch_results(batch_num, batch_results, batch_failed)
        
        # Save checkpoint
        remaining_urls = project_urls[batch_start + BATCH_SIZE:]
        save_checkpoint(batch_num, 
                      [r.get('url', '') for r in all_results if r.get('url')],
                      all_failed_urls,
                      remaining_urls)
        
        # Progress summary
        success_rate = (len(all_results) / (len(all_results) + len(all_failed_urls)) * 100) if (all_results or all_failed_urls) else 0
        print(f"\n📊 Progress: {len(all_results)} successful, {len(all_failed_urls)} failed ({success_rate:.1f}% success)")
        print(f"   Credits used: {credits_used}/{max_credits}")
        
        # Delay between batches
        if batch_start + batch_size < len(project_urls) and credits_used < max_credits:
            print(f"   Waiting {DELAY_BETWEEN_BATCHES} seconds before next batch...")
            time.sleep(DELAY_BETWEEN_BATCHES)
    
    return all_results, all_failed_urls


def main():
    """Main batch scraping function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Batch scrape interconnection.fyi project pages')
    parser.add_argument('--project-ids-file', default='data/interconnection_fyi/discovered_project_ids.json',
                       help='JSON file with project IDs')
    parser.add_argument('--resume', action='store_true',
                       help='Resume from last checkpoint')
    parser.add_argument('--batch-size', type=int, default=BATCH_SIZE,
                       help=f'Batch size (default: {BATCH_SIZE})')
    parser.add_argument('--max-credits', type=int, default=MAX_CREDITS,
                       help=f'Maximum credits to use (default: {MAX_CREDITS})')
    parser.add_argument('--test', type=int, metavar='N',
                       help='Test mode: only process first N URLs')
    
    args = parser.parse_args()
    
    # Use args values instead of modifying globals
    batch_size = args.batch_size
    max_credits = args.max_credits
    
    # Load project IDs
    project_ids_file = Path(args.project_ids_file)
    if not project_ids_file.exists():
        print(f"❌ Project IDs file not found: {project_ids_file}")
        print(f"   Run: python3 scripts/interconnection_fyi/project_id_discovery.py")
        sys.exit(1)
    
    with open(project_ids_file, 'r') as f:
        data = json.load(f)
    
    project_ids = data.get('project_ids', [])
    if not project_ids:
        print(f"❌ No project IDs found in {project_ids_file}")
        sys.exit(1)
    
    # Generate URLs
    project_urls = [f"https://www.interconnection.fyi/project/{pid}" for pid in project_ids]
    
    # Test mode: limit URLs
    if args.test:
        project_urls = project_urls[:args.test]
        print(f"🧪 Test mode: Processing first {args.test} URLs only")
    
    # Start scraping
    results, failed = scrape_projects_in_batches(
        project_urls, 
        start_from_checkpoint=args.resume,
        batch_size=batch_size,
        max_credits=max_credits
    )
    
    # Final summary
    print(f"\n✅ Batch scraping complete!")
    print(f"   Successful: {len(results)}")
    print(f"   Failed: {len(failed)}")
    print(f"   Success rate: {len(results) / (len(results) + len(failed)) * 100:.1f}%")
    print(f"\n📋 Next steps:")
    print(f"   1. Review results in: data/interconnection_fyi/raw/")
    print(f"   2. Parse individual pages: python3 scripts/interconnection_fyi/parse_individual_project.py")
    print(f"   3. Merge data: python3 scripts/interconnection_fyi/merge_project_data.py")


if __name__ == '__main__':
    main()

