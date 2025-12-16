#!/usr/bin/env python3
"""
Test script for Perplexity API location extraction.

Tests Perplexity API's ability to extract coordinates from article text
and compares with existing geocoding results.
"""

import os
import sys
import json
import sqlite3
import requests
import re
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional, Tuple, Dict

# Load environment
load_dotenv(Path('.env.local'))
PERPLEXITY_API_KEY = os.getenv('PRP')

if not PERPLEXITY_API_KEY:
    print("❌ Error: PERPLEXITY_API_KEY not found in .env.local")
    sys.exit(1)

PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions'
PERPLEXITY_MODEL = 'sonar-pro'


def extract_coordinates_from_response(content: str) -> Optional[Tuple[float, float]]:
    """
    Extract latitude and longitude from Perplexity API response.
    
    Returns:
        (lat, lng) tuple or None if not found
    """
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
                    if 25 <= lat <= 37 and -107 <= lng <= -93:
                        return (lat, lng)
                except (ValueError, IndexError):
                    continue
    return None


def call_perplexity_api(article_text: str, location_hint: str = None) -> Dict:
    """
    Call Perplexity API to extract coordinates from article text.
    
    Args:
        article_text: Full article text or snippet
        location_hint: Optional location hint (e.g., "Texas", "Dallas area")
    
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


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in kilometers."""
    from math import radians, sin, cos, sqrt, atan2
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))


def test_on_sample_projects(limit: int = 5):
    """
    Test Perplexity extraction on sample projects from database.
    
    Selects projects with vague location_text or no reference city.
    """
    db_path = Path('data/news/news_pipeline.db')
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Get projects with vague location_text
    cursor.execute("""
        SELECT 
            p.project_id,
            p.project_name,
            p.company,
            p.location_text,
            p.lat,
            p.lng,
            p.geocode_confidence,
            GROUP_CONCAT(m.raw_text || m.snippet || m.title, ' ') AS article_text
        FROM projects p
        LEFT JOIN mentions m ON INSTR(p.mention_ids, '"' || m.mention_id || '"') > 0
        WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
        AND p.location_text IN ('Texas', 'None', 'ew', 'ey', 'th', 'or', 'and Beyond')
        GROUP BY p.project_id
        LIMIT ?
    """, (limit,))
    
    projects = cursor.fetchall()
    
    print(f'🧪 TESTING PERPLEXITY ON {len(projects)} PROJECTS:')
    print('=' * 80)
    print()
    
    results = []
    
    for i, (project_id, name, company, location_text, lat, lng, confidence, article_text) in enumerate(projects, 1):
        print(f'Test {i}/{len(projects)}: {company} - {name}')
        print(f'  Current: ({lat:.6f}, {lng:.6f}) - {confidence}')
        print(f'  Location text: {location_text}')
        
        if not article_text or len(article_text) < 100:
            print('  ⚠️  Insufficient article text')
            print()
            continue
        
        # Call Perplexity
        result = call_perplexity_api(article_text[:2000], location_hint=location_text)
        
        if result['success']:
            perplexity_lat, perplexity_lng = result['lat'], result['lng']
            distance = distance_km(lat, lng, perplexity_lat, perplexity_lng)
            
            print(f'  ✅ Perplexity: ({perplexity_lat:.6f}, {perplexity_lng:.6f})')
            print(f'  📏 Distance from current: {distance:.2f}km')
            
            if distance > 20:
                print(f'  ⚠️  SIGNIFICANT DIFFERENCE (>20km)')
            
            results.append({
                'project_id': project_id,
                'company': company,
                'current': (lat, lng),
                'perplexity': (perplexity_lat, perplexity_lng),
                'distance_km': distance,
                'response': result['response'][:200]
            })
        else:
            print(f'  ❌ Failed: {result.get("error", "Unknown error")}')
            if result.get('response'):
                print(f'  Response: {result["response"][:200]}')
        
        print()
        import time
        time.sleep(1)  # Rate limiting
    
    conn.close()
    
    # Summary
    print('📊 SUMMARY:')
    print('=' * 80)
    print(f'Total tested: {len(projects)}')
    print(f'Successful extractions: {len(results)}')
    if results:
        avg_distance = sum(r['distance_km'] for r in results) / len(results)
        max_distance = max(r['distance_km'] for r in results)
        significant_diffs = [r for r in results if r['distance_km'] > 20]
        
        print(f'Average distance: {avg_distance:.2f}km')
        print(f'Max distance: {max_distance:.2f}km')
        print(f'Significant differences (>20km): {len(significant_diffs)}')
        
        if significant_diffs:
            print()
            print('⚠️  Projects with significant coordinate differences:')
            for r in significant_diffs:
                print(f'  • {r["company"]}: {r["distance_km"]:.2f}km difference')
    
    return results


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Test Perplexity API for location extraction')
    parser.add_argument('--limit', type=int, default=5, help='Number of projects to test')
    parser.add_argument('--test-api', action='store_true', help='Test API connectivity only')
    
    args = parser.parse_args()
    
    if args.test_api:
        print('🧪 Testing API connectivity...')
        result = call_perplexity_api('Data center at 3441 Railport Parkway, Midlothian, Texas')
        if result['success']:
            print(f'✅ API working! Extracted: ({result["lat"]:.6f}, {result["lng"]:.6f})')
        else:
            print(f'❌ API failed: {result.get("error")}')
    else:
        test_on_sample_projects(limit=args.limit)

