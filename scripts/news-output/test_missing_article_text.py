#!/usr/bin/env python3
"""
Test script to find projects with missing raw_text but addresses likely in articles.
Identifies projects that need URL fetching to extract precise locations.
"""

import sys
import json
import sqlite3
from pathlib import Path
import re

def find_projects_with_missing_text():
    """Find projects where raw_text is missing but address might be in article."""
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    print("🔍 FINDING PROJECTS WITH MISSING ARTICLE TEXT")
    print("=" * 80)
    print()
    
    # Find projects where:
    # 1. raw_text is missing or very short (< 200 chars)
    # 2. But snippet/title suggests address might be in article
    # 3. Has URL available for fetching
    
    cursor.execute("""
        SELECT 
            p.project_id,
            p.company,
            p.project_name,
            p.location_text,
            p.lat,
            p.lng,
            p.geocode_confidence,
            p.mention_ids,
            m.url,
            m.canonical_url,
            m.raw_text,
            m.snippet,
            m.title
        FROM projects p
        LEFT JOIN mentions m ON m.mention_id IN (
            SELECT value FROM json_each(p.mention_ids)
        )
        WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
        AND p.lat BETWEEN 25 AND 37 AND p.lng BETWEEN -107 AND -93
        AND (
            -- Low confidence suggests missing info
            p.geocode_confidence IN ('area', 'county')
            OR
            -- Vague location suggests missing info
            p.location_text IN ('Texas', 'Dallas-area', 'Austin-area', 'Houston-area')
            OR
            -- Coordinates don't match location text
            (
                p.location_text IS NOT NULL
                AND p.location_text != ''
                AND (
                    (p.location_text LIKE '%Dallas%' AND NOT (p.lat BETWEEN 32.5 AND 33.0 AND p.lng BETWEEN -97.2 AND -96.5))
                    OR (p.location_text LIKE '%Austin%' AND NOT (p.lat BETWEEN 30.0 AND 30.5 AND p.lng BETWEEN -98.0 AND -97.5))
                    OR (p.location_text LIKE '%Houston%' AND NOT (p.lat BETWEEN 29.5 AND 30.0 AND p.lng BETWEEN -95.8 AND -95.0))
                )
            )
        )
        AND (
            -- raw_text is missing or very short
            (m.raw_text IS NULL OR LENGTH(m.raw_text) < 200)
            AND
            -- But we have a URL to fetch from
            (m.url IS NOT NULL OR m.canonical_url IS NOT NULL)
        )
        GROUP BY p.project_id
        ORDER BY 
            CASE WHEN p.geocode_confidence = 'area' THEN 1 ELSE 2 END,
            p.company
    """)
    
    projects = cursor.fetchall()
    
    if not projects:
        print("✅ No projects found with missing article text")
        conn.close()
        return
    
    print(f"📊 Found {len(projects)} projects with missing article text")
    print()
    
    # Analyze each project
    address_keywords = ['address', 'street', 'road', 'avenue', 'drive', 'parkway', 'boulevard', 'at', 'in']
    city_keywords = ['midlothian', 'plano', 'frisco', 'richardson', 'round rock', 'cedar park', 'taylor', 'jarrell']
    
    high_priority = []
    medium_priority = []
    
    for project in projects:
        (project_id, company, project_name, location_text, lat, lng, confidence, 
         mention_ids, url, canonical_url, raw_text, snippet, title) = project
        
        # Check if snippet/title suggests address might be in article
        combined_text = f"{title or ''} {snippet or ''}".lower()
        
        has_address_hint = any(keyword in combined_text for keyword in address_keywords)
        has_city_hint = any(keyword in combined_text for keyword in city_keywords)
        has_dallas_area = 'dallas' in combined_text or 'dfw' in combined_text
        
        priority = 'low'
        if has_address_hint or (has_city_hint and has_dallas_area):
            priority = 'high'
            high_priority.append(project)
        elif has_city_hint or has_dallas_area:
            priority = 'medium'
            medium_priority.append(project)
        
        print(f"[{priority.upper()}] {company or 'Unknown'}: {project_name or project_id}")
        print(f"   Location: {location_text or 'None'}")
        print(f"   Confidence: {confidence}")
        print(f"   Raw text: {len(raw_text) if raw_text else 0} chars")
        print(f"   Snippet: {snippet[:100] if snippet else 'None'}...")
        print(f"   URL: {canonical_url or url or 'None'}")
        print(f"   Hints: address={has_address_hint}, city={has_city_hint}, dallas_area={has_dallas_area}")
        print()
    
    print("=" * 80)
    print(f"📊 SUMMARY:")
    print(f"   High priority (address/city hints): {len(high_priority)}")
    print(f"   Medium priority (city hints): {len(medium_priority)}")
    print(f"   Total: {len(projects)}")
    print()
    print("💡 RECOMMENDATION:")
    print("   Run extract_locations_from_articles.py with URL fetching enabled")
    print("   to fetch full articles for these projects and extract addresses.")
    
    conn.close()
    
    return {
        'high_priority': high_priority,
        'medium_priority': medium_priority,
        'total': projects
    }

if __name__ == "__main__":
    find_projects_with_missing_text()

