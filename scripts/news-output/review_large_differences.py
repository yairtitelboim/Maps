#!/usr/bin/env python3
"""
Manual review script for projects with >100km differences between
current coordinates and Perplexity extraction results.
"""

import sqlite3
import requests
import os
import re
from pathlib import Path
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from math import radians, sin, cos, sqrt, atan2

load_dotenv(Path('.env.local'))
PERPLEXITY_API_KEY = os.getenv('PRP')

def fetch_article_from_url(url):
    """Fetch article text from URL."""
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

def get_perplexity_coords(article_text):
    """Get coordinates from Perplexity API."""
    url = 'https://api.perplexity.ai/chat/completions'
    headers = {
        'Authorization': f'Bearer {PERPLEXITY_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    query = f'Extract the exact latitude and longitude coordinates (in decimal degrees) for the data center location mentioned in this text: "{article_text[:1000]}". Respond with ONLY the coordinates in format: latitude, longitude'
    
    payload = {
        'model': 'sonar-pro',
        'messages': [
            {
                'role': 'system',
                'content': 'You are a geocoding assistant. Extract precise location coordinates from text. Always respond with ONLY latitude and longitude in decimal degrees format, separated by a comma.'
            },
            {
                'role': 'user',
                'content': query
            }
        ],
        'temperature': 0.1,
        'max_tokens': 100
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=20)
        response.raise_for_status()
        result = response.json()
        if 'choices' in result:
            content = result['choices'][0]['message']['content']
            matches = re.findall(r'(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)', content)
            if matches:
                lat, lng = float(matches[0][0]), float(matches[0][1])
                if 25 <= lat <= 37 and -107 <= lng <= -93:
                    return (lat, lng), content
    except Exception as e:
        return None, str(e)
    return None, None

def distance_km(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in kilometers."""
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))

def main():
    db_path = Path('data/news/news_pipeline.db')
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Projects with >100km differences from validation test
    projects_to_review = [
        ('Calpine', 'Texas', 32.962478, -96.826477, 31.859400, -97.358600, 132.44),
        ('Vantage', 'Texas', 29.400294, -98.472914, 32.585000, -99.523000, 367.99),
        ('None', 'and Beyond', 29.868835, -95.424841, 27.506748, -99.502914, 476.63)
    ]
    
    print('🔍 MANUAL REVIEW - PROJECTS WITH >100KM DIFFERENCES')
    print('=' * 80)
    print()
    
    review_results = []
    
    for company, location_text, curr_lat, curr_lng, perp_lat, perp_lng, expected_distance in projects_to_review:
        print(f'📋 {company} - "{location_text}"')
        print(f'   Current: ({curr_lat:.6f}, {curr_lng:.6f})')
        print(f'   Perplexity (from test): ({perp_lat:.6f}, {perp_lng:.6f})')
        print(f'   Expected distance: {expected_distance:.2f}km')
        print()
        
        # Find project by coordinates
        cursor.execute('''
            SELECT 
                p.project_id,
                p.project_name,
                p.company,
                p.location_text,
                p.site_hint,
                p.lat,
                p.lng,
                p.geocode_confidence,
                p.mention_ids,
                GROUP_CONCAT(m.raw_text || ' ' || m.snippet || ' ' || m.title, ' ') AS article_text,
                GROUP_CONCAT(m.url || ' ' || m.canonical_url, ' ') AS urls
            FROM projects p
            LEFT JOIN mentions m ON INSTR(p.mention_ids, '"' || m.mention_id || '"') > 0
            WHERE ABS(p.lat - ?) < 0.01 AND ABS(p.lng - ?) < 0.01
            GROUP BY p.project_id
            LIMIT 1
        ''', (curr_lat, curr_lng))
        
        result = cursor.fetchone()
        if not result:
            print('   ⚠️  Project not found in database')
            print()
            continue
        
        project_id, name, comp, loc_text, site_hint, lat, lng, confidence, mention_ids, article_text, urls = result
        print(f'   Project ID: {project_id}')
        print(f'   Project Name: {name}')
        print(f'   Confidence: {confidence}')
        print(f'   Site Hint: {site_hint or "None"}')
        print()
        
        # Get article text
        text_to_use = ''
        if article_text and len(article_text) > 200:
            text_to_use = article_text
            print(f'   ✅ Has article text ({len(article_text)} chars)')
        elif urls:
            url_list = [u for u in urls.split() if u and u.startswith('http')]
            if url_list:
                print(f'   🔄 Attempting to fetch from URL...')
                for url in url_list[:1]:
                    text_to_use = fetch_article_from_url(url)
                    if text_to_use and len(text_to_use) > 200:
                        print(f'   ✅ Fetched {len(text_to_use)} chars from URL')
                        break
                if not text_to_use:
                    print(f'   ⚠️  Could not fetch article text')
        else:
            print(f'   ⚠️  No article text or URLs available')
        
        if text_to_use and len(text_to_use) > 200:
            # Extract location clues
            text_lower = text_to_use.lower()
            cities = ['dallas', 'austin', 'houston', 'san antonio', 'fort worth', 'midlothian', 
                     'plano', 'irving', 'arlington', 'round rock', 'taylor', 'georgetown',
                     'jarrell', 'cedar park', 'pflugerville', 'richardson', 'lewisville',
                     'abilene', 'waco', 'temple', 'killeen', 'el paso', 'lubbock']
            
            mentioned_cities = [c.title() for c in cities if c in text_lower]
            if mentioned_cities:
                cities_str = ', '.join(set(mentioned_cities[:5]))
                print(f'   📍 Cities mentioned: {cities_str}')
            
            print()
            print(f'   📄 Article snippet (first 600 chars):')
            print(f'   {text_to_use[:600]}...')
            print()
            
            # Get fresh Perplexity coordinates
            print('   🔄 Getting fresh Perplexity coordinates...')
            perp_coords, response = get_perplexity_coords(text_to_use)
            if perp_coords:
                p_lat, p_lng = perp_coords
                actual_distance = distance_km(curr_lat, curr_lng, p_lat, p_lng)
                print(f'   ✅ Perplexity result: ({p_lat:.6f}, {p_lng:.6f})')
                print(f'   📏 Actual distance: {actual_distance:.2f}km')
                print()
                
                # Analysis
                print('   🎯 ANALYSIS:')
                if mentioned_cities:
                    cities_str = ', '.join(set(mentioned_cities[:3]))
                    print(f'      Article mentions: {cities_str}')
                
                # Determine which is more likely correct
                print(f'      Current coords: ({curr_lat:.6f}, {curr_lng:.6f})')
                print(f'      Perplexity coords: ({p_lat:.6f}, {p_lng:.6f})')
                
                # Recommendation
                if actual_distance > 50:
                    print(f'      ⚠️  LARGE DIFFERENCE - Manual review recommended')
                    recommendation = 'manual_review'
                elif actual_distance > 20:
                    print(f'      ⚠️  Significant difference - Check article context')
                    recommendation = 'verify'
                else:
                    print(f'      ✅ Coordinates are close - Likely both acceptable')
                    recommendation = 'acceptable'
                
                review_results.append({
                    'project_id': project_id,
                    'company': company,
                    'current': (curr_lat, curr_lng),
                    'perplexity': (p_lat, p_lng),
                    'distance': actual_distance,
                    'mentioned_cities': mentioned_cities,
                    'recommendation': recommendation
                })
            else:
                print(f'   ❌ Could not get Perplexity coordinates: {response}')
                review_results.append({
                    'project_id': project_id,
                    'company': company,
                    'current': (curr_lat, curr_lng),
                    'perplexity': None,
                    'distance': None,
                    'mentioned_cities': mentioned_cities if 'mentioned_cities' in locals() else [],
                    'recommendation': 'failed'
                })
        else:
            print('   ⚠️  Cannot analyze - insufficient text')
            review_results.append({
                'project_id': project_id,
                'company': company,
                'current': (curr_lat, curr_lng),
                'perplexity': None,
                'distance': None,
                'mentioned_cities': [],
                'recommendation': 'insufficient_data'
            })
        
        print()
        print('-' * 80)
        print()
        
        import time
        time.sleep(2)
    
    conn.close()
    
    # Summary
    print('📊 REVIEW SUMMARY:')
    print('=' * 80)
    print()
    for result in review_results:
        print(f'{result["company"]}: {result["recommendation"]}')
        if result['distance']:
            print(f'  Distance: {result["distance"]:.2f}km')
        if result['mentioned_cities']:
            cities_str = ', '.join(set(result['mentioned_cities'][:3]))
            print(f'  Cities: {cities_str}')
        print()
    
    return review_results

if __name__ == '__main__':
    main()

