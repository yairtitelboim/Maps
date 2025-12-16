#!/usr/bin/env python3
"""
Triage Unknown Projects: Re-extract from full text, then use Perplexity API.

This script:
1. Re-extracts project cards from full article text for "Unknown Project" entries
2. For projects still unknown, uses Perplexity API to extract company/project names
3. Updates the database with improved extraction results
"""

import os
import sys
import sqlite3
import requests
import json
import re
import time
import signal
from pathlib import Path
from typing import Dict, List, Optional
from dotenv import load_dotenv

# Load environment
load_dotenv(Path('.env.local'))
PERPLEXITY_API_KEY = os.getenv('PRP')

if not PERPLEXITY_API_KEY:
    print("⚠️  Warning: PERPLEXITY_API_KEY not found in .env.local")
    print("   Will skip Perplexity extraction, only re-extract from full text")

PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions'
PERPLEXITY_MODEL = 'sonar-pro'

# Timeout configuration
MAX_RUNTIME_SECONDS = 55
TIMEOUT_EXCEEDED = False

def timeout_handler(signum, frame):
    """Handle timeout signal."""
    global TIMEOUT_EXCEEDED
    TIMEOUT_EXCEEDED = True
    print("\n⚠️  Timeout approaching - stopping gracefully...")
    raise TimeoutError("Script exceeded maximum runtime")

def health_check(start_time: float) -> bool:
    """Check if script is still within time limit."""
    elapsed = time.time() - start_time
    if elapsed > MAX_RUNTIME_SECONDS:
        return False
    return True

# Import extraction function
sys.path.insert(0, str(Path(__file__).parent))
from extract_project_cards import extract_project_card


def call_perplexity_for_company(article_text: str, title: str, location: str = None) -> Dict:
    """
    Call Perplexity API to extract company and project name from article.
    
    Returns:
        {
            'success': bool,
            'company': str or None,
            'project_name': str or None,
            'response': str,
            'error': str or None
        }
    """
    if not PERPLEXITY_API_KEY:
        return {'success': False, 'error': 'No API key'}
    
    # Build prompt
    location_hint = f" The data center is located in {location}." if location else ""
    
    prompt = f"""Extract the company name and project name (if mentioned) for a data center project from this article.

Article Title: {title}
{location_hint}

Article Text:
{article_text[:4000]}  # Limit to 4000 chars to avoid token limits

Please extract:
1. Company name (the company building/operating the data center)
2. Project name (if a specific name is mentioned, e.g., "DFW10", "Campus 1", etc.)

Return ONLY a valid JSON object with this exact structure:
{{
    "company": "Company Name or null",
    "project_name": "Project Name or null"
}}

If information is not available, use null. Do not make up names."""

    try:
        response = requests.post(
            PERPLEXITY_URL,
            headers={
                'Authorization': f'Bearer {PERPLEXITY_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'model': PERPLEXITY_MODEL,
                'messages': [
                    {
                        'role': 'system',
                        'content': 'You are a data extraction assistant. Extract company and project names from articles. Return ONLY valid JSON, no other text.'
                    },
                    {
                        'role': 'user',
                        'content': prompt
                    }
                ],
                'temperature': 0.1,
                'max_tokens': 200
            },
            timeout=30
        )
        
        if response.status_code != 200:
            return {
                'success': False,
                'error': f'API error: {response.status_code}',
                'response': response.text
            }
        
        result = response.json()
        content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
        
        # Try to parse JSON from response
        try:
            # Extract JSON from response (might have markdown code blocks)
            json_text = None
            if '```json' in content:
                match = re.search(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)
                if match:
                    json_text = match.group(1)
            elif '```' in content:
                match = re.search(r'```\s*(\{.*?\})\s*```', content, re.DOTALL)
                if match:
                    json_text = match.group(1)
            else:
                # Try to find JSON object in content (more robust pattern)
                match = re.search(r'\{[^{}]*(?:"company"|"project_name")[^{}]*\}', content, re.DOTALL)
                if match:
                    json_text = match.group(0)
            
            if json_text:
                extracted = json.loads(json_text)
                return {
                    'success': True,
                    'company': extracted.get('company'),
                    'project_name': extracted.get('project_name'),
                    'response': content
                }
            else:
                # Try parsing the whole content as JSON
                extracted = json.loads(content)
                return {
                    'success': True,
                    'company': extracted.get('company'),
                    'project_name': extracted.get('project_name'),
                    'response': content
                }
        except (json.JSONDecodeError, AttributeError):
            # Fallback: try to extract company name from text
            company = None
            project_name = None
            
            # Look for common patterns
            if 'company' in content.lower():
                # Try to find quoted company name
                company_match = re.search(r'["\']([^"\']+)["\']', content)
                if company_match:
                    company = company_match.group(1)
            
            return {
                'success': False,
                'company': company,
                'project_name': project_name,
                'response': content,
                'error': 'Could not parse JSON from response'
            }
    
    except requests.exceptions.Timeout:
        return {'success': False, 'error': 'Request timeout'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def re_extract_unknown_projects(db_path: Path, use_perplexity: bool = True, dry_run: bool = False):
    """
    Re-extract project cards for "Unknown Project" entries.
    
    Steps:
    1. Find unknown projects with full text
    2. Re-extract using enhanced extraction (with raw_text)
    3. For still-unknown projects, use Perplexity API
    4. Update database
    """
    start_time = time.time()
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(MAX_RUNTIME_SECONDS)
    
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Step 1: Find unknown projects with full text
        cursor.execute("""
            SELECT DISTINCT
                p.project_id,
                p.project_name,
                p.company,
                p.location_text,
                p.size_mw,
                p.size_acres,
                p.announced_date,
                m.mention_id,
                m.title,
                m.snippet,
                m.url,
                m.raw_text,
                LENGTH(m.raw_text) as text_length
            FROM projects p
            JOIN project_cards pc ON p.project_id = pc.project_id
            JOIN mentions m ON pc.mention_id = m.mention_id
            WHERE (p.project_name LIKE '%Unknown%' OR p.project_name IS NULL OR p.project_name = '')
              AND m.raw_text IS NOT NULL 
              AND m.raw_text != ''
              AND LENGTH(m.raw_text) > 500
            ORDER BY p.announced_date DESC
        """)
        
        unknown_projects = cursor.fetchall()
        
        if not unknown_projects:
            print("✅ No unknown projects with full text found")
            conn.close()
            return
        
        print(f"📊 TRIAGING {len(unknown_projects)} UNKNOWN PROJECTS")
        print("=" * 80)
        print()
        
        improved_count = 0
        perplexity_count = 0
        perplexity_success = 0
        
        for i, row in enumerate(unknown_projects, 1):
            if not health_check(start_time):
                print(f"\n⚠️  Stopping at {i-1}/{len(unknown_projects)} due to time limit")
                break
            
            project_id = row['project_id']
            mention_id = row['mention_id']
            
            print(f"\n[{i}/{len(unknown_projects)}] {row['title'][:60]}...")
            
            # Step 2: Re-extract with full text
            mention = {
                'mention_id': mention_id,
                'title': row['title'] or '',
                'snippet': row['snippet'] or '',
                'published_at': row['announced_date'],
                'url': row['url'] or '',
                'canonical_url': row['url'] or '',
                'raw_text': row['raw_text'] or ''
            }
            
            new_card = extract_project_card(mention)
            
            old_company = row['company'] or 'Unknown'
            old_location = row['location_text'] or ''
            old_project_name = row['project_name'] or 'Unknown Project'
            
            new_company = new_card['company'] or 'Unknown'
            new_location = new_card['location_text'] or ''
            new_project_name = new_card['project_name'] or 'Unknown Project'
            
            # Check if improved by re-extraction
            company_improved = (old_company == 'Unknown' and new_company != 'Unknown')
            location_improved = ((old_location in ['', 'Texas', 'ew', 'ey', 'th', 'or', 'and Beyond']) and 
                               new_location not in ['', 'Texas', 'ew', 'ey', 'th', 'or', 'and Beyond'])
            name_improved = (old_project_name == 'Unknown Project' and new_project_name != 'Unknown Project')
            
            if company_improved or location_improved or name_improved:
                improved_count += 1
                print(f"   ✅ Improved by re-extraction:")
                if company_improved:
                    print(f"      Company: {old_company} → {new_company}")
                if location_improved:
                    print(f"      Location: {old_location or 'None'} → {new_location}")
                if name_improved:
                    print(f"      Project Name: {old_project_name} → {new_project_name}")
                
                if not dry_run:
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
                        'medium' if (company_improved or name_improved) else 'low',
                        mention_id
                    ))
            else:
                # Step 3: Still unknown - try Perplexity
                if use_perplexity and PERPLEXITY_API_KEY and row['raw_text']:
                    print(f"   🔍 Still unknown, trying Perplexity API...")
                    perplexity_count += 1
                    
                    # Small delay to avoid rate limits
                    time.sleep(1)
                    
                    result = call_perplexity_for_company(
                        row['raw_text'],
                        row['title'],
                        row['location_text']
                    )
                    
                    if result.get('success') and (result.get('company') or result.get('project_name')):
                        perplexity_success += 1
                        p_company = result.get('company')
                        p_project_name = result.get('project_name')
                        
                        print(f"   ✅ Perplexity extracted:")
                        if p_company:
                            print(f"      Company: {p_company}")
                        if p_project_name:
                            print(f"      Project Name: {p_project_name}")
                        
                        if not dry_run:
                            # Update with Perplexity results
                            # Use Perplexity company if we don't have one, or if it's better
                            final_company = p_company if (not new_company or new_company == 'Unknown') else new_company
                            final_project_name = p_project_name if (not new_project_name or new_project_name == 'Unknown Project') else new_project_name
                            
                            cursor.execute("""
                                UPDATE project_cards
                                SET company = ?,
                                    project_name = ?,
                                    extraction_confidence = 'high'
                                WHERE mention_id = ?
                            """, (
                                final_company,
                                final_project_name,
                                mention_id
                            ))
                    else:
                        error = result.get('error', 'Unknown error')
                        print(f"   ❌ Perplexity failed: {error}")
                else:
                    print(f"   ⚠️  Still unknown (no Perplexity or no full text)")
        
        # Update projects table from project_cards
        if not dry_run and (improved_count > 0 or perplexity_success > 0):
            print(f"\n📊 Updating projects table...")
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
                        WHERE raw_text IS NOT NULL AND raw_text != '' AND LENGTH(raw_text) > 500
                    )
                )
            """)
            conn.commit()
        
        print(f"\n✅ TRIAGE COMPLETE!")
        print(f"   Projects processed: {i}")
        print(f"   Improved by re-extraction: {improved_count}")
        print(f"   Tried Perplexity: {perplexity_count}")
        print(f"   Perplexity success: {perplexity_success}")
        
        conn.close()
        
    except TimeoutError:
        print("\n⚠️  Script timed out")
    finally:
        signal.alarm(0)


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Triage unknown projects using re-extraction and Perplexity API")
    parser.add_argument('--dry-run', action='store_true', help="Run without making database changes")
    parser.add_argument('--no-perplexity', action='store_true', help="Skip Perplexity API calls (only re-extract)")
    args = parser.parse_args()
    
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        sys.exit(1)
    
    re_extract_unknown_projects(
        db_path,
        use_perplexity=not args.no_perplexity,
        dry_run=args.dry_run
    )


if __name__ == "__main__":
    main()

