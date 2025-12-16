#!/usr/bin/env python3
"""
Test enhanced extraction logic on existing project cards.
Compare before/after to measure improvement.
"""

import sys
import sqlite3
from pathlib import Path
from extract_project_cards import extract_project_card

# Paths
DB_PATH = Path(__file__).parent.parent.parent / 'data' / 'news' / 'news_pipeline.db'

def test_enhanced_extraction():
    """Test enhanced extraction on existing mentions."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    
    # Get all project cards with their source mentions
    query = """
        SELECT 
            pc.project_id,
            pc.project_name as old_project_name,
            pc.company as old_company,
            pc.location_text as old_location,
            m.mention_id,
            m.title,
            m.snippet,
            m.published_at
        FROM project_cards pc
        JOIN mentions m ON pc.mention_id = m.mention_id
        ORDER BY m.published_at DESC
        LIMIT 100
    """
    
    cursor = conn.execute(query)
    rows = cursor.fetchall()
    
    print(f"Testing enhanced extraction on {len(rows)} project cards...")
    print("=" * 80)
    
    stats = {
        'total': len(rows),
        'improved': 0,
        'worse': 0,
        'same': 0,
        'unknown_before': 0,
        'unknown_after': 0,
        'examples_improved': [],
        'examples_worse': [],
        'examples_same': []
    }
    
    for row in rows:
        mention = {
            'mention_id': row['mention_id'],
            'title': row['title'] or '',
            'snippet': row['snippet'] or '',
            'published_at': row['published_at']
        }
        
        old_name = row['old_project_name'] or 'Unknown Project'
        old_company = row['old_company'] or 'Unknown'
        old_location = row['old_location'] or ''
        
        # Run enhanced extraction
        new_card = extract_project_card(mention)
        new_name = new_card['project_name'] or 'Unknown Project'
        new_company = new_card['company'] or 'Unknown'
        new_location = new_card['location_text'] or ''
        
        # Track unknown projects
        if old_name == 'Unknown Project' or not old_name:
            stats['unknown_before'] += 1
        if new_name == 'Unknown Project' or not new_name:
            stats['unknown_after'] += 1
        
        # Compare results
        if old_name == 'Unknown Project' or not old_name:
            if new_name != 'Unknown Project' and new_name:
                stats['improved'] += 1
                if len(stats['examples_improved']) < 10:
                    stats['examples_improved'].append({
                        'title': row['title'][:80],
                        'old': old_name,
                        'new': new_name,
                        'company': new_company,
                        'location': new_location
                    })
        elif new_name == 'Unknown Project' or not new_name:
            if old_name != 'Unknown Project' and old_name:
                stats['worse'] += 1
                if len(stats['examples_worse']) < 5:
                    stats['examples_worse'].append({
                        'title': row['title'][:80],
                        'old': old_name,
                        'new': new_name
                    })
        elif old_name != new_name:
            # Changed but both are valid - check if improvement
            if len(new_name) > len(old_name) or 'Data Center' in new_name:
                stats['improved'] += 1
            else:
                stats['same'] += 1
        else:
            stats['same'] += 1
    
    conn.close()
    
    # Print results
    print(f"\n📊 Results Summary:")
    print(f"   Total tested: {stats['total']}")
    print(f"   Improved: {stats['improved']} ({stats['improved']/stats['total']*100:.1f}%)")
    print(f"   Same: {stats['same']} ({stats['same']/stats['total']*100:.1f}%)")
    print(f"   Worse: {stats['worse']} ({stats['worse']/stats['total']*100:.1f}%)")
    print(f"\n   Unknown before: {stats['unknown_before']} ({stats['unknown_before']/stats['total']*100:.1f}%)")
    print(f"   Unknown after: {stats['unknown_after']} ({stats['unknown_after']/stats['total']*100:.1f}%)")
    print(f"   Reduction: {stats['unknown_before'] - stats['unknown_after']} ({(stats['unknown_before'] - stats['unknown_after'])/stats['unknown_before']*100:.1f}% improvement)")
    
    if stats['examples_improved']:
        print(f"\n✅ Examples of Improvements ({len(stats['examples_improved'])} shown):")
        for i, ex in enumerate(stats['examples_improved'], 1):
            print(f"\n   {i}. Title: {ex['title']}...")
            print(f"      Old: {ex['old']}")
            print(f"      New: {ex['new']}")
            if ex['company'] != 'Unknown':
                print(f"      Company: {ex['company']}")
            if ex['location']:
                print(f"      Location: {ex['location']}")
    
    if stats['examples_worse']:
        print(f"\n⚠️  Examples of Regressions ({len(stats['examples_worse'])} shown):")
        for i, ex in enumerate(stats['examples_worse'], 1):
            print(f"\n   {i}. Title: {ex['title']}...")
            print(f"      Old: {ex['old']}")
            print(f"      New: {ex['new']}")
    
    # Calculate expected improvement on full dataset
    if stats['unknown_before'] > 0:
        improvement_rate = (stats['unknown_before'] - stats['unknown_after']) / stats['unknown_before']
        print(f"\n📈 Projected Impact on Full Dataset:")
        print(f"   Current 'Unknown Project' count: ~38")
        print(f"   Expected after enhancement: ~{38 * (1 - improvement_rate):.0f}")
        print(f"   Expected reduction: ~{38 * improvement_rate:.0f} projects")
        print(f"   Improvement rate: {improvement_rate*100:.1f}%")
    
    return stats

if __name__ == '__main__':
    test_enhanced_extraction()

