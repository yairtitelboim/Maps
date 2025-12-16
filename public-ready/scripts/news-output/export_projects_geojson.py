#!/usr/bin/env python3
"""
Export Texas data center projects to GeoJSON for frontend consumption.
"""
import sqlite3
import json
import os
from pathlib import Path

# Paths
DB_PATH = Path(__file__).parent.parent.parent / 'data' / 'news' / 'news_pipeline.db'
OUTPUT_PATH = Path(__file__).parent.parent.parent / 'public' / 'data' / 'texas_data_centers.geojson'

def export_projects_to_geojson():
    """Export projects with coordinates to GeoJSON format."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    
    # Query projects with valid Texas coordinates
    query = """
        SELECT 
            p.project_id,
            p.project_name,
            p.company,
            p.location_text,
            p.site_hint,
            p.size_mw,
            p.size_sqft,
            p.size_acres,
            p.announced_date,
            p.expected_completion_date,
            p.probability_score,
            p.source_urls,
            p.mention_ids,
            p.lat,
            p.lng,
            p.geocode_confidence,
            ps.status_current,
            ps.status_confidence
        FROM projects p
        LEFT JOIN project_status ps ON p.project_id = ps.project_id
        WHERE p.lat IS NOT NULL 
          AND p.lng IS NOT NULL
          AND p.lat BETWEEN 25 AND 37
          AND p.lng BETWEEN -107 AND -93
        ORDER BY p.company, p.announced_date DESC
    """
    
    cursor = conn.execute(query)
    rows = cursor.fetchall()
    
    # Build GeoJSON FeatureCollection
    features = []
    for row in rows:
        # Parse source URLs JSON
        source_urls = []
        if row['source_urls']:
            try:
                source_urls = json.loads(row['source_urls'])
            except:
                source_urls = [row['source_urls']] if row['source_urls'] else []
        
        # Get first URL as primary source
        primary_url = source_urls[0] if source_urls else None
        
        # Get article title from first mention
        article_title = None
        if row['mention_ids']:
            try:
                mention_ids = json.loads(row['mention_ids'])
                if mention_ids:
                    # Get title from first mention
                    cursor.execute("""
                        SELECT title FROM mentions WHERE mention_id = ? LIMIT 1
                    """, (mention_ids[0],))
                    title_result = cursor.fetchone()
                    if title_result and title_result[0]:
                        article_title = title_result[0]
            except:
                pass
        
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [row['lng'], row['lat']]
            },
            'properties': {
                'project_id': row['project_id'],
                'project_name': row['project_name'] or f"{row['company']} Data Center" if row['company'] else 'Unknown Project',
                'company': row['company'] or 'Unknown',
                'location': row['location_text'] or 'Unknown Location',
                'site_hint': row['site_hint'],
                'size_mw': row['size_mw'],
                'size_sqft': row['size_sqft'],
                'size_acres': row['size_acres'],
                'announced_date': row['announced_date'],
                'expected_completion_date': row['expected_completion_date'],
                'probability_score': row['probability_score'] or 'unknown',
                'status': row['status_current'] or 'unknown',
                'status_confidence': row['status_confidence'] or 'low',
                'geocode_confidence': row['geocode_confidence'] or 'low',
                'source_url': primary_url,
                'source_urls': source_urls,
                'source_count': len(source_urls),
                'article_title': article_title
            }
        }
        features.append(feature)
    
    geojson = {
        'type': 'FeatureCollection',
        'features': features
    }
    
    # Ensure output directory exists
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    # Write GeoJSON file
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(geojson, f, indent=2)
    
    conn.close()
    
    print(f"✅ Exported {len(features)} projects to {OUTPUT_PATH}")
    return len(features)

if __name__ == '__main__':
    count = export_projects_to_geojson()
    print(f"📊 Total projects exported: {count}")

