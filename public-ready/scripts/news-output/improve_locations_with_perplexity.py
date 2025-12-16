#!/usr/bin/env python3
"""
Production script to improve location coordinates using Perplexity API.

This script:
1. Identifies projects that could benefit from Perplexity extraction
2. Uses Perplexity API to extract coordinates from article text
3. Validates results (Texas bounds, distance checks)
4. Compares with existing coordinates
5. Updates database only when Perplexity provides better/more specific coordinates
6. Flags large differences for manual review
"""

import os
import sys
import sqlite3
import requests
import re
import json
from pathlib import Path
from typing import Optional, Tuple, Dict, List
from dotenv import load_dotenv
from math import radians, sin, cos, sqrt, atan2
from bs4 import BeautifulSoup

# Load environment
load_dotenv(Path('.env.local'))
PERPLEXITY_API_KEY = os.getenv('PRP')

if not PERPLEXITY_API_KEY:
    print("❌ Error: PERPLEXITY_API_KEY not found in .env.local")
    sys.exit(1)

PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions'
PERPLEXITY_MODEL = 'sonar-pro'

# Configuration
TEXAS_BOUNDS = {
    'lat_min': 25,
    'lat_max': 37,
    'lon_min': -107,
    'lon_max': -93
}

# Distance thresholds
DISTANCE_THRESHOLDS = {
    'high_accuracy': 5,      # <5km: High accuracy, likely correct
    'moderate': 20,          # 5-20km: Moderate, acceptable
    'significant': 50,       # 20-50km: Significant difference, verify
    'large': 100             # >50km: Large difference, manual review
}


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in kilometers."""
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))


def extract_coordinates_from_response(content: str) -> Optional[Tuple[float, float]]:
    """Extract latitude and longitude from Perplexity API response."""
    patterns = [
        r'(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)',  # Simple lat, lng
        r'latitude[:\s]*(-?\d+\.?\d*)[,\s]*longitude[:\s]*(-?\d+\.?\d*)',
        r'lat[:\s]*(-?\d+\.?\d*)[,\s]*lng[:\s]*(-?\d+\.?\d*)',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, content)
        if matches:
            for match in matches:
                try:
                    lat, lng = float(match[0]), float(match[1])
                    # Validate Texas bounds
                    if (TEXAS_BOUNDS['lat_min'] <= lat <= TEXAS_BOUNDS['lat_max'] and
                        TEXAS_BOUNDS['lon_min'] <= lng <= TEXAS_BOUNDS['lon_max']):
                        return (lat, lng)
                except (ValueError, IndexError):
                    continue
    return None


def call_perplexity_api(article_text: str, location_hint: str = None) -> Dict:
    """
    Call Perplexity API to extract coordinates from article text.
    
    Returns:
        {
            'success': bool,
            'lat': float or None,
            'lng': float or None,
            'response': str,
            'error': str or None
        }
    """
    # Build query
    if location_hint:
        query = f'Extract the exact latitude and longitude coordinates (in decimal degrees) for the data center location mentioned in this text. Location hint: {location_hint}. Text: "{article_text[:1000]}". Respond with ONLY the coordinates in format: latitude, longitude'
    else:
        query = f'Extract the exact latitude and longitude coordinates (in decimal degrees) for the data center location mentioned in this text: "{article_text[:1000]}". Respond with ONLY the coordinates in format: latitude, longitude'
    
    headers = {
        'Authorization': f'Bearer {PERPLEXITY_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'model': PERPLEXITY_MODEL,
        'messages': [
            {
                'role': 'system',
                'content': 'You are a geocoding assistant. Extract precise location coordinates from text. Always respond with ONLY latitude and longitude in decimal degrees format, separated by a comma. Example: 32.4824, -96.9944'
            },
            {
                'role': 'user',
                'content': query
            }
        ],
        'temperature': 0.1,
        'max_tokens': 150
    }
    
    try:
        response = requests.post(PERPLEXITY_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0]['message']['content']
            coords = extract_coordinates_from_response(content)
            
            return {
                'success': coords is not None,
                'lat': coords[0] if coords else None,
                'lng': coords[1] if coords else None,
                'response': content,
                'error': None
            }
        else:
            return {
                'success': False,
                'lat': None,
                'lng': None,
                'response': json.dumps(result),
                'error': 'Unexpected response format'
            }
    except requests.exceptions.RequestException as e:
        return {
            'success': False,
            'lat': None,
            'lng': None,
            'response': None,
            'error': str(e)
        }
    except Exception as e:
        return {
            'success': False,
            'lat': None,
            'lng': None,
            'response': None,
            'error': str(e)
        }


def fetch_article_from_url(url: str) -> str:
    """Fetch full article text from URL."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        for script in soup(['script', 'style']):
            script.decompose()
        
        article_text = None
        for selector in ['article', '[role="article"]', '.article-content', '.article-body', 'main']:
            article = soup.select_one(selector)
            if article:
                article_text = article.get_text(separator=' ', strip=True)
                if len(article_text) > 500:
                    break
        
        if not article_text or len(article_text) < 500:
            body = soup.find('body')
            if body:
                article_text = body.get_text(separator=' ', strip=True)
        
        return article_text if article_text else ''
    except Exception as e:
        return ''


def get_article_text(project_id: str, cursor) -> str:
    """Get article text for a project, fetching from URL if needed."""
    # Get article text from database
    cursor.execute('''
        SELECT 
            GROUP_CONCAT(m.raw_text || ' ' || m.snippet || ' ' || m.title, ' ') AS article_text,
            GROUP_CONCAT(m.url || ' ' || m.canonical_url, ' ') AS urls
        FROM projects p
        LEFT JOIN mentions m ON INSTR(p.mention_ids, '"' || m.mention_id || '"') > 0
        WHERE p.project_id = ?
        GROUP BY p.project_id
    ''', (project_id,))
    
    result = cursor.fetchone()
    if not result:
        return ''
    
    article_text, urls = result
    
    # If we have good article text, use it
    if article_text and len(article_text) > 500:
        return article_text
    
    # Otherwise, try fetching from URL
    if urls:
        url_list = [u for u in urls.split() if u and u.startswith('http')]
        for url in url_list[:1]:  # Try first URL
            fetched_text = fetch_article_from_url(url)
            if fetched_text and len(fetched_text) > 500:
                return fetched_text
    
    return article_text or ''


def should_update_coordinates(
    current_lat: float,
    current_lng: float,
    perplexity_lat: float,
    perplexity_lng: float,
    current_confidence: str,
    distance: float
) -> Tuple[bool, str]:
    """
    Determine if coordinates should be updated based on validation logic.
    
    Returns:
        (should_update: bool, reason: str)
    """
    # If distance is very small, no need to update
    if distance < DISTANCE_THRESHOLDS['high_accuracy']:
        return False, f'Coordinates are very close ({distance:.2f}km)'
    
    # If distance is large (>100km), flag for manual review
    if distance > DISTANCE_THRESHOLDS['large']:
        return False, f'LARGE DIFFERENCE ({distance:.2f}km) - Manual review required'
    
    # If distance is significant (50-100km), flag for review (too risky to auto-update)
    if DISTANCE_THRESHOLDS['significant'] < distance <= DISTANCE_THRESHOLDS['large']:
        return False, f'Significant difference ({distance:.2f}km) - Manual review recommended'
    
    # If distance is moderate (20-50km) and current confidence is low, update
    if DISTANCE_THRESHOLDS['moderate'] < distance <= DISTANCE_THRESHOLDS['significant']:
        if current_confidence in ['area', 'county']:
            return True, f'Moderate difference ({distance:.2f}km), current confidence is {current_confidence}'
        return False, f'Moderate difference ({distance:.2f}km), but current confidence is {current_confidence}'
    
    # If distance is small (5-20km) and current confidence is low, update
    if DISTANCE_THRESHOLDS['high_accuracy'] < distance <= DISTANCE_THRESHOLDS['moderate']:
        if current_confidence in ['area', 'county']:
            return True, f'Small difference ({distance:.2f}km), current confidence is {current_confidence}'
        return False, f'Small difference ({distance:.2f}km), but current confidence is {current_confidence}'
    
    # Default: don't update
    return False, f'Distance is acceptable ({distance:.2f}km)'


def process_projects(
    limit: int = None,
    update_db: bool = False,
    verbose: bool = True
) -> Dict:
    """
    Process projects and improve coordinates using Perplexity.
    
    Args:
        limit: Maximum number of projects to process (None for all)
        update_db: If True, update database with improved coordinates
        verbose: If True, print detailed output
    
    Returns:
        Summary statistics
    """
    db_path = Path('data/news/news_pipeline.db')
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        return {}
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Get projects that could benefit from Perplexity
    # Priority: vague location_text, low confidence, or no reference city
    query = '''
        SELECT 
            p.project_id,
            p.project_name,
            p.company,
            p.location_text,
            p.lat,
            p.lng,
            p.geocode_confidence,
            p.site_hint
        FROM projects p
        WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
        AND (
            p.location_text IN ('Texas', 'None', 'ew', 'ey', 'th', 'or', 'and Beyond')
            OR p.geocode_confidence IN ('area', 'county')
        )
        ORDER BY 
            CASE WHEN p.location_text IN ('Texas', 'None', 'ew', 'ey', 'th', 'or', 'and Beyond') THEN 1 ELSE 2 END,
            p.geocode_confidence
    '''
    
    if limit:
        query += f' LIMIT {limit}'
    
    cursor.execute(query)
    projects = cursor.fetchall()
    
    if verbose:
        print(f'🔍 PROCESSING {len(projects)} PROJECTS WITH PERPLEXITY')
        print('=' * 80)
        print()
    
    stats = {
        'total': len(projects),
        'processed': 0,
        'successful': 0,
        'updated': 0,
        'flagged': 0,
        'failed': 0,
        'skipped': 0
    }
    
    results = []
    
    for i, (project_id, name, company, location_text, lat, lng, confidence, site_hint) in enumerate(projects, 1):
        if verbose:
            print(f'[{i}/{len(projects)}] {company} - {name}')
            print(f'  Current: ({lat:.6f}, {lng:.6f}) - {confidence}')
            print(f'  Location text: {location_text}')
        
        stats['processed'] += 1
        
        # Get article text
        article_text = get_article_text(project_id, cursor)
        
        if not article_text or len(article_text) < 200:
            if verbose:
                print('  ⚠️  Insufficient article text')
            stats['skipped'] += 1
            results.append({
                'project_id': project_id,
                'status': 'skipped',
                'reason': 'insufficient_article_text'
            })
            continue
        
        # Call Perplexity API
        if verbose:
            print('  🔄 Calling Perplexity API...')
        
        result = call_perplexity_api(article_text, location_hint=location_text)
        
        if not result['success']:
            if verbose:
                print(f'  ❌ Failed: {result.get("error", "Unknown error")}')
            stats['failed'] += 1
            results.append({
                'project_id': project_id,
                'status': 'failed',
                'error': result.get('error')
            })
            continue
        
        perplexity_lat, perplexity_lng = result['lat'], result['lng']
        distance = distance_km(lat, lng, perplexity_lat, perplexity_lng)
        
        stats['successful'] += 1
        
        if verbose:
            print(f'  ✅ Perplexity: ({perplexity_lat:.6f}, {perplexity_lng:.6f})')
            print(f'  📏 Distance: {distance:.2f}km')
        
        # Determine if should update
        should_update, reason = should_update_coordinates(
            lat, lng, perplexity_lat, perplexity_lng, confidence, distance
        )
        
        if verbose:
            print(f'  💡 Decision: {reason}')
        
        if should_update and update_db:
            # Update database
            cursor.execute('''
                UPDATE projects
                SET lat = ?, lng = ?, geocode_confidence = 'address'
                WHERE project_id = ?
            ''', (perplexity_lat, perplexity_lng, project_id))
            
            if verbose:
                print(f'  ✅ Updated database')
            stats['updated'] += 1
            results.append({
                'project_id': project_id,
                'status': 'updated',
                'old_coords': (lat, lng),
                'new_coords': (perplexity_lat, perplexity_lng),
                'distance': distance,
                'reason': reason
            })
        elif distance > DISTANCE_THRESHOLDS['large']:
            stats['flagged'] += 1
            results.append({
                'project_id': project_id,
                'status': 'flagged',
                'current_coords': (lat, lng),
                'perplexity_coords': (perplexity_lat, perplexity_lng),
                'distance': distance,
                'reason': reason
            })
            if verbose:
                print(f'  ⚠️  FLAGGED for manual review')
        else:
            results.append({
                'project_id': project_id,
                'status': 'no_update',
                'distance': distance,
                'reason': reason
            })
        
        if verbose:
            print()
        
        # Rate limiting
        import time
        time.sleep(1)
    
    # Commit if updating
    if update_db:
        conn.commit()
        if verbose:
            print('💾 Changes committed to database')
    
    conn.close()
    
    # Print summary
    if verbose:
        print('📊 SUMMARY:')
        print('=' * 80)
        print(f'Total projects: {stats["total"]}')
        print(f'Processed: {stats["processed"]}')
        print(f'Successful extractions: {stats["successful"]}')
        print(f'Updated: {stats["updated"]}')
        print(f'Flagged for review: {stats["flagged"]}')
        print(f'Failed: {stats["failed"]}')
        print(f'Skipped: {stats["skipped"]}')
        print()
    
    return {
        'stats': stats,
        'results': results
    }


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Improve location coordinates using Perplexity API'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Maximum number of projects to process'
    )
    parser.add_argument(
        '--update',
        action='store_true',
        help='Update database with improved coordinates (default: dry run)'
    )
    parser.add_argument(
        '--quiet',
        action='store_true',
        help='Suppress detailed output'
    )
    
    args = parser.parse_args()
    
    if not args.update:
        print('⚠️  DRY RUN MODE - No database updates will be made')
        print('   Use --update to actually update the database')
        print()
    
    results = process_projects(
        limit=args.limit,
        update_db=args.update,
        verbose=not args.quiet
    )
    
    # Save results to JSON
    output_path = Path('scripts/news-output/perplexity_improvement_results.json')
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    if not args.quiet:
        print(f'💾 Results saved to: {output_path}')


if __name__ == '__main__':
    main()

