#!/usr/bin/env python3
"""
Comprehensive review of flagged projects with large coordinate differences.
"""

import sqlite3
import requests
from pathlib import Path
from bs4 import BeautifulSoup
from math import radians, sin, cos, sqrt, atan2

def fetch_article_from_url(url):
    """Fetch article text from URL."""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
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

def distance_km(lat1, lon1, lat2, lon2):
    """Calculate distance between coordinates."""
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
    
    # Known flagged projects
    flagged_projects = [
        ('proj_a3fea98293a9', 'None', 'and Beyond', 476.63, (29.868835, -95.424841), (27.506748, -99.502914)),
        ('proj_ad88ebe8b5a3', 'Aligned', 'th', 60, (33.009455, -96.693498), (32.602500, -97.129200)),
        ('proj_3f81efc4358b', 'Oracle', 'Texas', 121, (30.321975, -97.765669), (29.424100, -98.493600)),
        ('proj_4d94eab6404e', 'Google', 'None', 265, (32.838781, -96.574449), (35.181200, -97.102500)),
        ('proj_5dddcc6b9fb5', 'Google', 'None', 58, (32.539400, -96.950600), (32.445400, -96.970000)),
    ]
    
    cities = {
        'Dallas': (32.7767, -96.7970),
        'Austin': (30.2672, -97.7431),
        'Houston': (29.7604, -95.3698),
        'San Antonio': (29.4241, -98.4936),
        'Fort Worth': (32.7555, -97.3308),
        'Laredo': (27.5306, -99.4803),
        'Abilene': (32.4487, -99.7331),
    }
    
    print('🔍 COMPREHENSIVE REVIEW OF FLAGGED PROJECTS:')
    print('=' * 80)
    print()
    
    recommendations = []
    
    for project_id, company, loc_text, dist, curr_coords, perp_coords in flagged_projects:
        print(f'📋 {company} - "{loc_text}"')
        print(f'   Project ID: {project_id}')
        print(f'   Current: ({curr_coords[0]:.6f}, {curr_coords[1]:.6f})')
        print(f'   Perplexity: ({perp_coords[0]:.6f}, {perp_coords[1]:.6f})')
        print(f'   Distance: {dist:.2f}km')
        print()
        
        # Get project info
        cursor.execute('''
            SELECT 
                p.project_id,
                p.company,
                p.project_name,
                p.location_text,
                p.lat,
                p.lng,
                p.geocode_confidence,
                p.site_hint,
                GROUP_CONCAT(m.raw_text || ' ' || m.snippet || ' ' || m.title, ' ') AS article_text,
                GROUP_CONCAT(m.url || ' ' || m.canonical_url, ' ') AS urls
            FROM projects p
            LEFT JOIN mentions m ON INSTR(p.mention_ids, '"' || m.mention_id || '"') > 0
            WHERE p.project_id = ?
            GROUP BY p.project_id
        ''', (project_id,))
        
        result = cursor.fetchone()
        if result:
            proj_id, comp, name, loc, lat, lng, confidence, site_hint, article_text, urls = result
            print(f'   Project Name: {name}')
            print(f'   Confidence: {confidence}')
            if site_hint:
                print(f'   Site hint: {site_hint}')
            print()
            
            # Try to get article text
            text_to_use = article_text or ''
            if not text_to_use or len(text_to_use) < 200:
                if urls:
                    url_list = [u for u in urls.split() if u and u.startswith('http')]
                    if url_list:
                        print(f'   🔄 Fetching from URL...')
                        for url in url_list[:1]:
                            text_to_use = fetch_article_from_url(url)
                            if text_to_use and len(text_to_use) > 200:
                                print(f'   ✅ Fetched {len(text_to_use)} chars')
                                break
            
            if text_to_use and len(text_to_use) > 200:
                text_lower = text_to_use.lower()
                mentioned_cities = [c for c in cities.keys() if c.lower() in text_lower]
                if mentioned_cities:
                    cities_str = ', '.join(mentioned_cities[:5])
                    print(f'   📍 Cities mentioned: {cities_str}')
                
                # Check which coordinates are closer to mentioned cities
                print()
                print('   🎯 COORDINATE VALIDATION:')
                for city in mentioned_cities[:3]:
                    c_lat, c_lng = cities[city]
                    dist_curr = distance_km(curr_coords[0], curr_coords[1], c_lat, c_lng)
                    dist_perp = distance_km(perp_coords[0], perp_coords[1], c_lat, c_lng)
                    print(f'      {city}: Current {dist_curr:.1f}km, Perplexity {dist_perp:.1f}km')
                
                print()
                print(f'   📄 Article snippet (first 400 chars):')
                print(f'   {text_to_use[:400]}...')
            else:
                print('   ⚠️  No article text available')
            
            # Check closest cities to both coordinates
            print()
            print('   📍 Closest cities to coordinates:')
            for coord_name, coords in [('Current', curr_coords), ('Perplexity', perp_coords)]:
                closest = None
                min_dist = float('inf')
                for city, (c_lat, c_lng) in cities.items():
                    dist = distance_km(coords[0], coords[1], c_lat, c_lng)
                    if dist < min_dist:
                        min_dist = dist
                        closest = city
                print(f'      {coord_name}: {closest} ({min_dist:.1f}km)')
            
            # Recommendation
            print()
            print('   💡 RECOMMENDATION:')
            if dist > 200:
                print(f'      ⚠️  VERY LARGE DIFFERENCE ({dist:.0f}km)')
                print(f'      → Likely: Article mentions multiple locations')
                print(f'      → Action: Keep current OR mark for manual review')
                recommendations.append((project_id, company, 'keep_or_review'))
            elif dist > 50:
                print(f'      ⚠️  Significant difference ({dist:.0f}km)')
                print(f'      → Need to verify which is correct')
                recommendations.append((project_id, company, 'verify'))
            else:
                print(f'      ✅ Acceptable difference ({dist:.0f}km)')
                recommendations.append((project_id, company, 'acceptable'))
        
        print()
        print('-' * 80)
        print()
        
        import time
        time.sleep(1)
    
    conn.close()
    
    # Summary
    print('📊 REVIEW SUMMARY:')
    print('=' * 80)
    print()
    for proj_id, company, rec in recommendations:
        print(f'{company}: {rec}')
    print()

if __name__ == '__main__':
    main()

