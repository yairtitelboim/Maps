#!/usr/bin/env python3
"""
Health check utilities for Firecrawl API batch scraping.
"""

import os
import time
import json
import requests
from typing import Dict, Optional
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY") or os.environ.get("firecrawl")
FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"


def check_firecrawl_api_health() -> Dict:
    """
    Check Firecrawl API health status.
    
    Returns:
        Dict with health status, response_time, and any errors
    """
    if not FIRECRAWL_API_KEY:
        return {
            'healthy': False,
            'error': 'No API key found',
            'response_time_ms': None
        }
    
    # Make a lightweight test call to a simple page
    test_url = "https://example.com"
    
    headers = {
        "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "url": test_url,
        "formats": ["markdown"]
    }
    
    try:
        start_time = time.time()
        response = requests.post(
            f"{FIRECRAWL_BASE_URL}/scrape",
            headers=headers,
            json=payload,
            timeout=10
        )
        response_time = (time.time() - start_time) * 1000  # Convert to ms
        
        if response.status_code == 200:
            result = response.json()
            return {
                'healthy': result.get('success', True),
                'response_time_ms': round(response_time, 2),
                'status_code': response.status_code,
                'error': None
            }
        else:
            return {
                'healthy': False,
                'response_time_ms': round(response_time, 2),
                'status_code': response.status_code,
                'error': f"HTTP {response.status_code}: {response.text[:200]}"
            }
    except requests.exceptions.Timeout:
        return {
            'healthy': False,
            'response_time_ms': None,
            'error': 'Request timeout',
            'status_code': None
        }
    except requests.exceptions.RequestException as e:
        return {
            'healthy': False,
            'response_time_ms': None,
            'error': str(e),
            'status_code': None
        }


def validate_scrape_result(result: Dict) -> bool:
    """
    Validate that a scrape result contains expected data.
    
    Args:
        result: Firecrawl API response
    
    Returns:
        True if valid, False otherwise
    """
    if not result:
        return False
    
    # Check for success flag
    if not result.get('success', True):
        return False
    
    # Check for data field
    if 'data' not in result:
        return False
    
    data = result['data']
    
    # Check for markdown or html
    if not data.get('markdown') and not data.get('html'):
        return False
    
    return True


def check_rate_limit_status() -> Dict:
    """
    Check current rate limit status (if available from API).
    
    Note: Firecrawl may not expose rate limit info directly.
    This is a placeholder for future implementation.
    """
    # TODO: If Firecrawl exposes rate limit headers, parse them here
    return {
        'remaining': None,
        'reset_time': None,
        'limit': None
    }


def log_health_check(checkpoint_dir: Path, health_status: Dict):
    """Log health check results to file."""
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    log_file = checkpoint_dir / 'health_checks.jsonl'
    
    log_entry = {
        'timestamp': time.time(),
        'datetime': time.strftime('%Y-%m-%d %H:%M:%S'),
        **health_status
    }
    
    with open(log_file, 'a') as f:
        f.write(json.dumps(log_entry) + '\n')


def get_recent_health_status(checkpoint_dir: Path, lookback_minutes: int = 5) -> Optional[Dict]:
    """Get most recent health check status."""
    log_file = checkpoint_dir / 'health_checks.jsonl'
    
    if not log_file.exists():
        return None
    
    try:
        with open(log_file, 'r') as f:
            lines = f.readlines()
            if not lines:
                return None
            
            # Get last line
            last_entry = json.loads(lines[-1])
            
            # Check if it's recent enough
            age_seconds = time.time() - last_entry.get('timestamp', 0)
            if age_seconds > (lookback_minutes * 60):
                return None
            
            return last_entry
    except (json.JSONDecodeError, KeyError, FileNotFoundError):
        return None

