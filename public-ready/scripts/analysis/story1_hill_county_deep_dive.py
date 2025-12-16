#!/usr/bin/env python3
"""
Deep dive analysis of Hill County data center projects.
Checks mentions, project cards, and project status to understand the full picture.
"""
import sqlite3
import json
from pathlib import Path
from datetime import datetime

def analyze_hill_county():
    """Deep dive into Hill County data center projects."""
    base_path = Path(__file__).parent.parent.parent
    db_path = base_path / 'data/news/news_pipeline.db'
    
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        return
    
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    
    print("=" * 80)
    print("HILL COUNTY DEEP DIVE ANALYSIS")
    print("=" * 80)
    print()
    
    # 1. Check mentions/articles referencing Hill County
    print("1. ARTICLES/MENTIONS REFERENCING HILL COUNTY")
    print("-" * 80)
    
    # Filter for actual Hill County mentions (exclude false positives)
    cursor = conn.execute("""
        SELECT 
            m.mention_id,
            m.title,
            m.snippet,
            m.published_at,
            m.url,
            m.raw_text,
            c.classification
        FROM mentions m
        LEFT JOIN classified_mentions c ON m.mention_id = c.mention_id
        WHERE 
            (m.snippet LIKE '%Hill County%' OR
             m.title LIKE '%Hill County%' OR
             m.raw_text LIKE '%Hill County%')
            AND NOT (
                m.snippet LIKE '%Forest Hill%' OR
                m.title LIKE '%Forest Hill%' OR
                m.snippet LIKE '%New Hill%' OR
                m.title LIKE '%New Hill%' OR
                m.snippet LIKE '%Hillsboro%' OR
                m.title LIKE '%Hillsboro%'
            )
        ORDER BY m.published_at DESC
    """)
    
    hill_mentions = cursor.fetchall()
    print(f"Total articles/mentions mentioning Hill County: {len(hill_mentions)}")
    print()
    
    if hill_mentions:
        print("Articles:")
        for i, mention in enumerate(hill_mentions, 1):
            print(f"  {i}. {mention['title'][:70]}...")
            print(f"     Published: {mention['published_at']}")
            print(f"     Classification: {mention['classification'] or 'unclassified'}")
            if mention['snippet']:
                snippet = mention['snippet'][:100].replace('\n', ' ')
                print(f"     Snippet: {snippet}...")
            print()
    else:
        print("  No articles found mentioning Hill County")
    print()
    
    # 2. Check project cards for Hill County
    print("2. PROJECT CARDS FOR HILL COUNTY")
    print("-" * 80)
    
    cursor = conn.execute("""
        SELECT 
            pc.id,
            pc.project_id,
            pc.project_name,
            pc.company,
            pc.location_text,
            pc.size_mw,
            pc.size_acres,
            pc.announced_date,
            pc.expected_completion_date,
            pc.probability_score,
            pc.extraction_confidence,
            m.title as article_title,
            m.published_at,
            m.url
        FROM project_cards pc
        JOIN mentions m ON pc.mention_id = m.mention_id
        WHERE 
            pc.location_text LIKE '%Hill%' OR
            m.snippet LIKE '%Hill County%' OR
            m.snippet LIKE '%Hill%' OR
            m.title LIKE '%Hill County%' OR
            m.title LIKE '%Hill%'
        ORDER BY m.published_at DESC
    """)
    
    hill_cards = cursor.fetchall()
    print(f"Total project cards for Hill County: {len(hill_cards)}")
    print()
    
    if hill_cards:
        for i, card in enumerate(hill_cards, 1):
            print(f"Project Card {i}:")
            print(f"  Project Name: {card['project_name'] or 'Unknown'}")
            print(f"  Company: {card['company'] or 'Unknown'}")
            print(f"  Location Text: {card['location_text'] or 'N/A'}")
            print(f"  Size: {card['size_mw'] or 'N/A'} MW, {card['size_acres'] or 'N/A'} acres")
            print(f"  Announced: {card['announced_date'] or 'N/A'}")
            print(f"  Expected Completion: {card['expected_completion_date'] or 'N/A'}")
            print(f"  Probability: {card['probability_score'] or 'unknown'}")
            print(f"  Confidence: {card['extraction_confidence'] or 'low'}")
            print(f"  Source Article: {card['article_title'][:60]}...")
            print(f"  Article Date: {card['published_at'] or 'N/A'}")
            print()
    else:
        print("  No project cards found for Hill County")
    print()
    
    # 3. Check projects (aggregated) for Hill County
    print("3. DATA CENTER PROJECTS IN HILL COUNTY")
    print("-" * 80)
    print("(Checking both database and GeoJSON for complete picture)")
    print()
    
    # First, get projects from GeoJSON (this is the source of truth for geocoding)
    geojson_path = base_path / 'public/data/texas_data_centers.geojson'
    hill_projects_geojson = []
    hill_project_ids = []
    
    if geojson_path.exists():
        with open(geojson_path, 'r') as f:
            dc_data = json.load(f)
        
        # Use point-in-polygon to find Hill County projects
        try:
            from shapely.geometry import Point, shape
            counties_path = base_path / 'public/data/texas/texas_counties.geojson'
            
            if counties_path.exists():
                with open(counties_path, 'r') as f:
                    counties_data = json.load(f)
                
                # Find Hill County polygon
                hill_polygon = None
                for feature in counties_data['features']:
                    props = feature.get('properties', {})
                    if props.get('NAME', '').strip() == 'Hill':
                        geometry = feature.get('geometry', {})
                        if geometry:
                            hill_polygon = shape(geometry)
                            break
                
                if hill_polygon:
                    for feature in dc_data['features']:
                        coords = feature.get('geometry', {}).get('coordinates', [])
                        if coords and len(coords) == 2:
                            point = Point(coords[0], coords[1])
                            if hill_polygon.contains(point):
                                props = feature.get('properties', {})
                                project_id = props.get('project_id')
                                hill_projects_geojson.append({
                                    'project_id': project_id,
                                    'name': props.get('project_name', 'Unknown'),
                                    'company': props.get('company', 'Unknown'),
                                    'location': props.get('location', ''),
                                    'size_mw': props.get('size_mw'),
                                    'status': props.get('status', 'unknown')
                                })
                                if project_id:
                                    hill_project_ids.append(project_id)
        except ImportError:
            print("  ⚠️  shapely not available, using location text matching")
            # Fallback: check location text
            for feature in dc_data['features']:
                props = feature.get('properties', {})
                location = props.get('location', '').lower()
                if 'hill' in location:
                    project_id = props.get('project_id')
                    hill_projects_geojson.append({
                        'project_id': project_id,
                        'name': props.get('project_name', 'Unknown'),
                        'company': props.get('company', 'Unknown'),
                        'location': props.get('location', ''),
                        'size_mw': props.get('size_mw'),
                        'status': props.get('status', 'unknown')
                    })
                    if project_id:
                        hill_project_ids.append(project_id)
    
    print(f"Data center projects geocoded to Hill County (from GeoJSON): {len(hill_projects_geojson)}")
    print()
    
    if hill_projects_geojson:
        print("Projects in Hill County (by coordinates):")
        for i, p in enumerate(hill_projects_geojson, 1):
            print(f"  {i}. {p['name']} ({p['company']})")
            print(f"     Project ID: {p['project_id'] or 'N/A'}")
            print(f"     Location text: {p['location']}")
            print(f"     Size: {p['size_mw'] or 'Unknown'} MW")
            print(f"     Status: {p['status']}")
            print()
    print()
    
    # Query projects table for these project IDs (to get detailed info)
    print("4. PROJECTS IN DATABASE (from news pipeline)")
    print("-" * 80)
    print("(These are the projects that have been processed through the pipeline)")
    print()
    
    if hill_project_ids:
        placeholders = ','.join(['?' for _ in hill_project_ids])
        cursor = conn.execute(f"""
            SELECT 
                p.project_id,
                p.project_name,
                p.company,
                p.location_text,
                p.size_mw,
                p.size_acres,
                p.announced_date,
                p.expected_completion_date,
                p.probability_score,
                p.mention_ids,
                p.source_urls,
                ps.status_current,
                ps.status_confidence
            FROM projects p
            LEFT JOIN project_status ps ON p.project_id = ps.project_id
            WHERE p.project_id IN ({placeholders})
        """, hill_project_ids)
        
        hill_projects_db = cursor.fetchall()
        
        print(f"Projects in database (matching GeoJSON project IDs): {len(hill_projects_db)}")
        print()
        
        if hill_projects_db:
            for i, project in enumerate(hill_projects_db, 1):
                print(f"Database Project {i}:")
                print(f"  Project ID: {project['project_id']}")
                print(f"  Project Name: {project['project_name'] or 'Unknown'}")
                print(f"  Company: {project['company'] or 'Unknown'}")
                print(f"  Location: {project['location_text'] or 'N/A'}")
                print(f"  Size: {project['size_mw'] or 'N/A'} MW, {project['size_acres'] or 'N/A'} acres")
                print(f"  Announced: {project['announced_date'] or 'N/A'}")
                print(f"  Expected Completion: {project['expected_completion_date'] or 'N/A'}")
                print(f"  Probability: {project['probability_score'] or 'unknown'}")
                print(f"  Status: {project['status_current'] or 'unknown'} ({project['status_confidence'] or 'low'})")
                
                # Parse mention IDs and source URLs
                source_urls = []
                if project['source_urls']:
                    try:
                        source_urls = json.loads(project['source_urls'])
                    except:
                        pass
                
                print(f"  Source Articles: {len(source_urls)}")
                print()
        else:
            print("  ⚠️  No matching projects found in database")
            print("  (GeoJSON projects may not have been processed through pipeline yet)")
    else:
        print("  No project IDs found (cannot query database)")
    print()
    
    # Compare GeoJSON vs Database
    print("5. GEOJSON vs DATABASE COMPARISON")
    print("-" * 80)
    geojson_ids = {p['project_id'] for p in hill_projects_geojson if p['project_id']}
    db_ids = {p['project_id'] for p in hill_projects_db} if hill_project_ids else set()
    
    print(f"Projects in GeoJSON: {len(hill_projects_geojson)}")
    print(f"Projects in Database: {len(hill_projects_db)}")
    print(f"Overlap (in both): {len(geojson_ids & db_ids)}")
    print(f"Only in GeoJSON: {len(geojson_ids - db_ids)}")
    print(f"Only in Database: {len(db_ids - geojson_ids)}")
    print()
    
    if geojson_ids - db_ids:
        print("Projects in GeoJSON but NOT in database:")
        for p in hill_projects_geojson:
            if p['project_id'] and p['project_id'] not in db_ids:
                print(f"  - {p['name']} ({p['company']}) - ID: {p['project_id']}")
        print()
    
    # 6. Status breakdown
    print("6. STATUS BREAKDOWN")
    print("-" * 80)
    
    # Use GeoJSON projects for status (most complete)
    if hill_projects_geojson:
        status_counts = {}
        for project in hill_projects_geojson:
            status = project.get('status', 'unknown')
            status_counts[status] = status_counts.get(status, 0) + 1
        
        print("Status distribution (from GeoJSON):")
        for status, count in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  {status}: {count}")
    else:
        print("  No projects to analyze")
    print()
    
    # 7. Timeline analysis
    print("7. TIMELINE ANALYSIS")
    print("-" * 80)
    
    if hill_mentions:
        print("Article timeline:")
        years = {}
        for mention in hill_mentions:
            if mention['published_at']:
                try:
                    year = mention['published_at'][:4]
                    years[year] = years.get(year, 0) + 1
                except:
                    pass
        
        for year in sorted(years.keys()):
            print(f"  {year}: {years[year]} articles")
    
    if hill_projects_db:
        print("\nProject announcement timeline (from database):")
        for project in hill_projects_db:
            if project['announced_date']:
                print(f"  {project['announced_date']}: {project['project_name'] or 'Unknown'} ({project['company'] or 'Unknown'})")
    print()
    
    # 8. Summary and scenarios
    print("=" * 80)
    print("SUMMARY & SCENARIO ANALYSIS")
    print("=" * 80)
    print()
    
    # Clarify the numbers
    geojson_count = len(hill_projects_geojson)
    db_count = len(hill_projects_db) if hill_project_ids else 0
    total_cards = len(hill_cards)
    total_mentions = len(hill_mentions)
    
    print("CLARIFICATION:")
    print(f"  Data center projects in Hill County (by coordinates): {geojson_count}")
    print(f"  - These are DATA CENTER projects from the news pipeline")
    print(f"  - Geocoded to Hill County using point-in-polygon")
    print()
    print(f"  Projects in database (processed through pipeline): {db_count}")
    print(f"  - These are the same projects, but with full pipeline processing")
    print(f"  - Some GeoJSON projects may not be in database yet")
    print()
    print(f"  Project cards (extracted from articles): {total_cards}")
    print(f"  Articles mentioning Hill County: {total_mentions}")
    print()
    
    # Calculate total capacity
    total_capacity = sum(p.get('size_mw', 0) or 0 for p in hill_projects_geojson)
    print(f"Total potential capacity (from GeoJSON): {total_capacity:.0f} MW")
    print()
    
    # Determine scenario
    if geojson_count == 2 and db_count == 2:
        print("📊 SCENARIO A: Hill has 2 data center projects, both in database")
        print("   → Both projects have been processed through the pipeline")
        print("   → Status: Both uncertain")
    elif geojson_count > db_count:
        print(f"📊 SCENARIO B: Hill has {geojson_count} data center projects, but only {db_count} in database")
        print(f"   → {geojson_count - db_count} projects in GeoJSON but not yet processed")
        print("   → May be duplicates, or projects not yet through entity resolution")
    elif geojson_count == 0:
        print("📊 SCENARIO C: No data center projects found in Hill County")
        print("   → Previous analysis may have been incorrect")
    else:
        print(f"📊 SCENARIO D: Complex situation")
        print(f"   → {geojson_count} projects in GeoJSON, {db_count} in database")
        print("   → Need to investigate duplicates/merges")
    
    conn.close()
    
    print()
    print("=" * 80)
    print("✅ Analysis complete!")
    print("=" * 80)

if __name__ == '__main__':
    analyze_hill_county()

