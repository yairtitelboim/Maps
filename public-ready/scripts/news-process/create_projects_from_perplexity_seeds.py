#!/usr/bin/env python3
"""
Create project cards directly from Perplexity seed data.

Since seed URLs are often directory pages (classified as "context"),
we create project cards directly from the structured seed data.
"""

import json
import sqlite3
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

from extract_project_cards import clean_location_name

BASE_DIR = Path(__file__).resolve().parents[2]
DB_PATH = BASE_DIR / "data" / "news" / "news_pipeline.db"
SEEDS_PATH = BASE_DIR / "data" / "analysis" / "perplexity_seeds.json"


def load_seeds(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        print(f"❌ Seeds file not found: {path}")
        return []
    with open(path, "r") as f:
        data = json.load(f)
    return data.get("seeds", [])


def create_project_card_from_seed(seed: Dict[str, Any], mention_id: str) -> Dict[str, Any]:
    """Create a project card dict from Perplexity seed data."""
    company = seed.get("company", "").strip()
    project_name = seed.get("project_name", "").strip()
    city = seed.get("city", "").strip()
    county = seed.get("county", "").strip()
    
    # Build location_text
    location_parts = []
    if city:
        location_parts.append(city)
    if county and county != city:
        location_parts.append(county)
    if not location_parts:
        location_parts.append("Texas")
    location_text = ", ".join(location_parts)
    
    # Generate project_name if missing
    if not project_name or project_name.lower() in ["unknown", "n/a", ""]:
        if company and city:
            cleaned_city = clean_location_name(city)
            project_name = f"{company} {cleaned_city}"
        elif company:
            project_name = f"{company} Data Center"
        else:
            project_name = "Unknown Project"
    
    # Generate project_id (simple hash-based)
    import hashlib
    key = f"{company}|{location_text}|{project_name}".lower()
    project_id = hashlib.md5(key.encode()).hexdigest()[:12]
    
    card = {
        "mention_id": mention_id,
        "project_id": project_id,
        "project_name": project_name,
        "company": company or "Unknown",
        "location_text": location_text,
        "site_hint": None,
        "size_mw": seed.get("approx_mw") if seed.get("approx_mw") else None,
        "size_sqft": seed.get("approx_sqft") if seed.get("approx_sqft") else None,
        "size_acres": None,
        "announced_date": f"{seed.get('announced_year')}-01-01" if seed.get("announced_year") else datetime.now().strftime("%Y-%m-%d"),
        "expected_completion_date": None,
        "probability_score": "medium" if seed.get("status") == "operational" else "unknown",
        "extraction_confidence": "medium",
        "location_geocode_confidence": "county" if county else "area",
    }
    
    return card


def get_or_create_mention_for_seed(cursor: sqlite3.Cursor, seed: Dict[str, Any]) -> Optional[str]:
    """Get existing mention_id for seed URL, or create a synthetic one."""
    url = seed.get("primary_source_url", "")
    if not url:
        return None
    
    import sys
    sys.path.insert(0, str(BASE_DIR / "scripts" / "news-ingest"))
    from utils import canonicalize_url, generate_mention_id
    canonical = canonicalize_url(url)
    mention_id = generate_mention_id(canonical)
    
    # Check if mention exists
    cursor.execute("SELECT mention_id FROM mentions WHERE mention_id = ?", (mention_id,))
    if cursor.fetchone():
        return mention_id
    
    # Create synthetic mention
    company = seed.get("company", "")
    project_name = seed.get("project_name", "")
    city = seed.get("city", "")
    county = seed.get("county", "")
    
    title = f"{company} {project_name}" if company and project_name else url
    snippet = f"{company} data center in {city}, {county} County, Texas" if city and county else f"{company} data center in Texas"
    
    cursor.execute("""
        INSERT INTO mentions (
            mention_id,
            url,
            canonical_url,
            title,
            snippet,
            query_matched,
            published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        mention_id,
        url,
        canonical,
        title,
        snippet,
        "perplexity_seed",
        f"{seed.get('announced_year')}-01-01" if seed.get("announced_year") else datetime.now().strftime("%Y-%m-%d")
    ))
    
    return mention_id


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Create project cards directly from Perplexity seeds"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of seeds to process",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print actions but do not write to database",
    )
    args = parser.parse_args()
    
    seeds = load_seeds(SEEDS_PATH)
    if args.limit:
        seeds = seeds[: args.limit]
    
    if not seeds:
        print("No seeds found to process.")
        return
    
    if not DB_PATH.exists():
        print(f"❌ Database not found at {DB_PATH}")
        return
    
    print(f"🔨 Creating project cards from {len(seeds)} Perplexity seeds")
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    created = 0
    skipped = 0
    
    try:
        for i, seed in enumerate(seeds, 1):
            company = seed.get("company", "")
            project_name = seed.get("project_name", "")
            print(f"[{i}/{len(seeds)}] {company} - {project_name}")
            
            # Get or create mention
            mention_id = get_or_create_mention_for_seed(cursor, seed)
            if not mention_id:
                print("  ⚠️ Could not create mention, skipping")
                skipped += 1
                continue
            
            # Check if project card already exists
            cursor.execute("SELECT id FROM project_cards WHERE mention_id = ?", (mention_id,))
            if cursor.fetchone():
                print("  ↪️ Project card already exists, skipping")
                skipped += 1
                continue
            
            # Create project card
            card = create_project_card_from_seed(seed, mention_id)
            
            if args.dry_run:
                print(f"  (dry-run) Would create project card: {card['project_name']} in {card['location_text']}")
                created += 1
                continue
            
            # Insert project card
            cursor.execute("""
                INSERT INTO project_cards (
                    mention_id, project_id, project_name, company, location_text,
                    site_hint, size_mw, size_sqft, size_acres,
                    announced_date, expected_completion_date, probability_score,
                    extraction_confidence, location_geocode_confidence
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                card["mention_id"],
                card["project_id"],
                card["project_name"],
                card["company"],
                card["location_text"],
                card["site_hint"],
                card["size_mw"],
                card["size_sqft"],
                card["size_acres"],
                card["announced_date"],
                card["expected_completion_date"],
                card["probability_score"],
                card["extraction_confidence"],
                card["location_geocode_confidence"],
            ))
            
            print(f"  ✅ Created project card: {card['project_name']} in {card['location_text']}")
            created += 1
        
        if not args.dry_run:
            conn.commit()
            print("💾 Changes committed to database")
    finally:
        conn.close()
    
    print()
    print("📊 Summary")
    print(f"  Seeds processed: {len(seeds)}")
    print(f"  Project cards created: {created}")
    print(f"  Skipped: {skipped}")
    print()
    print("Next steps:")
    print("  1) Run entity resolution: python3 scripts/news-process/entity_resolution.py")
    print("  2) Run geocoding: python3 scripts/news-output/enhanced_geocoding.py")
    print("  3) Export GeoJSON: python3 scripts/news-output/export_projects_geojson.py")


if __name__ == "__main__":
    main()

