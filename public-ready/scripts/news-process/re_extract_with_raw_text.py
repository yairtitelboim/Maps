#!/usr/bin/env python3
"""
Re-extract project cards for articles that now have raw_text.
This allows us to take advantage of the full article content.
"""

import sys
import sqlite3
from pathlib import Path
from typing import Dict
import time

# Import the extraction function
sys.path.insert(0, str(Path(__file__).parent))
from extract_project_cards import extract_project_card

def re_extract_with_raw_text(db_path: Path):
    """Re-extract project cards for articles with raw_text."""
    
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Find articles with raw_text but missing company/location
    # Prioritize project_announcement articles
    cursor.execute("""
        SELECT 
            m.mention_id,
            m.title,
            m.snippet,
            m.published_at,
            m.url,
            m.canonical_url,
            m.raw_text,
            m.publisher,
            pc.id as card_id,
            pc.project_id,
            p.company as current_company,
            p.location_text as current_location,
            p.project_name as current_project_name,
            cm.classification
        FROM mentions m
        LEFT JOIN classified_mentions cm ON m.mention_id = cm.mention_id
        LEFT JOIN project_cards pc ON m.mention_id = pc.mention_id
        LEFT JOIN projects p ON pc.project_id = p.project_id
        WHERE m.raw_text IS NOT NULL 
          AND m.raw_text != ""
          AND LENGTH(m.raw_text) > 1000
          AND (
            (p.company IS NULL OR p.company = "Unknown")
            OR (p.location_text IS NULL OR p.location_text = "" OR p.location_text = "Texas")
          )
        ORDER BY 
            CASE WHEN cm.classification = "project_announcement" THEN 0 ELSE 1 END,
            LENGTH(m.raw_text) DESC
    """)
    
    articles = cursor.fetchall()
    
    if not articles:
        print("✅ No articles need re-extraction")
        conn.close()
        return
    
    print(f"📊 Re-extracting {len(articles)} articles with raw_text...")
    print("=" * 80)
    
    improved_count = 0
    updated_count = 0
    
    for i, article in enumerate(articles, 1):
        mention_id = article['mention_id']
        
        # Prepare mention dict for extraction
        mention = {
            'mention_id': mention_id,
            'title': article['title'] or '',
            'snippet': article['snippet'] or '',
            'published_at': article['published_at'],
            'url': article['url'] or article['canonical_url'] or '',
            'canonical_url': article['canonical_url'] or article['url'] or '',
            'raw_text': article['raw_text'] or '',
            'publisher': article['publisher'] or ''
        }
        
        # Extract using enhanced logic (now with raw_text)
        new_card = extract_project_card(mention)
        
        # Compare with current values
        old_company = article['current_company'] or 'Unknown'
        old_location = article['current_location'] or ''
        old_project_name = article['current_project_name'] or 'Unknown Project'
        
        new_company = new_card['company'] or 'Unknown'
        new_location = new_card['location_text'] or ''
        new_project_name = new_card['project_name'] or 'Unknown Project'
        
        # Check if improved
        company_improved = (old_company == 'Unknown' and new_company != 'Unknown')
        location_improved = ((old_location == '' or old_location == 'Texas') and 
                           new_location != '' and new_location != 'Texas')
        name_improved = (old_project_name == 'Unknown Project' and new_project_name != 'Unknown Project')
        
        if company_improved or location_improved or name_improved:
            improved_count += 1
            print(f"\n[{i}/{len(articles)}] ✅ Improved: {article['title'][:60]}...")
            
            if company_improved:
                print(f"   Company: {old_company} → {new_company}")
            if location_improved:
                print(f"   Location: {old_location or 'None'} → {new_location}")
            if name_improved:
                print(f"   Project Name: {old_project_name} → {new_project_name}")
            
            # Update project card
            cursor.execute("""
                UPDATE project_cards
                SET company = ?,
                    location_text = ?,
                    project_name = ?,
                    extraction_confidence = ?
                WHERE mention_id = ?
            """, (
                new_card['company'],
                new_card['location_text'],
                new_card['project_name'],
                new_card['extraction_confidence'],
                mention_id
            ))
            updated_count += 1
        else:
            print(f"[{i}/{len(articles)}] No improvement: {article['title'][:60]}...")
    
    conn.commit()
    
    # Update projects table from project_cards
    print(f"\n📊 Updating projects table from project_cards...")
    cursor.execute("""
        UPDATE projects
        SET company = (
            SELECT company FROM project_cards 
            WHERE project_cards.project_id = projects.project_id 
            ORDER BY id DESC LIMIT 1
        ),
        location_text = (
            SELECT location_text FROM project_cards 
            WHERE project_cards.project_id = projects.project_id 
            ORDER BY id DESC LIMIT 1
        ),
        project_name = (
            SELECT project_name FROM project_cards 
            WHERE project_cards.project_id = projects.project_id 
            ORDER BY id DESC LIMIT 1
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE project_id IN (
            SELECT DISTINCT project_id FROM project_cards WHERE mention_id IN (
                SELECT mention_id FROM mentions 
                WHERE raw_text IS NOT NULL AND raw_text != "" AND LENGTH(raw_text) > 1000
            )
        )
    """)
    conn.commit()
    
    print(f"\n✅ Re-extraction complete!")
    print(f"   Articles processed: {len(articles)}")
    print(f"   Improved: {improved_count}")
    print(f"   Updated: {updated_count}")
    
    conn.close()

def main():
    """Main entry point."""
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        sys.exit(1)
    
    re_extract_with_raw_text(db_path)

if __name__ == "__main__":
    main()

