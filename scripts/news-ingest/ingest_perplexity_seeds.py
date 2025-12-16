#!/usr/bin/env python3
"""
Ingest Perplexity seed projects into the news pipeline.

Takes seeds from data/analysis/perplexity_seeds.json, fetches each primary_source_url,
creates raw_articles + mentions rows, and lets the existing pipeline
(deduplicate -> classify -> extract -> entity_resolution -> geocode)
promote them into full projects.
"""

import json
import sqlite3
import requests
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from bs4 import BeautifulSoup

from utils import canonicalize_url, generate_mention_id


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


def fetch_article_metadata(url: str) -> Tuple[str, str]:
    """
    Fetch article title and a short snippet from the URL.

    Falls back to using the URL as title if fetch fails.
    """
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0 Safari/537.36"
            )
        }
        resp = requests.get(url, headers=headers, timeout=20)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        title_tag = soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else url

        # crude snippet from first <p>
        snippet = ""
        for p in soup.find_all("p"):
            text = p.get_text(separator=" ", strip=True)
            if len(text) > 80:
                snippet = text[:280]
                break

        return title, snippet or title
    except Exception as e:
        print(f"  ⚠️ Failed to fetch {url[:80]}...: {e}")
        return url, ""


def article_exists(cursor: sqlite3.Cursor, canonical_url: str) -> bool:
    cursor.execute(
        """
        SELECT 1 FROM raw_articles
        WHERE canonical_url = ? OR url = ?
        LIMIT 1
        """,
        (canonical_url, canonical_url),
    )
    return cursor.fetchone() is not None


def insert_article_and_mention(
    cursor: sqlite3.Cursor,
    url: str,
    company: Optional[str],
    seed: Dict[str, Any],
) -> Optional[str]:
    """Insert into raw_articles + mentions. Returns mention_id or None."""
    canonical = canonicalize_url(url)
    if article_exists(cursor, canonical):
        print(f"  ↪️ Article already exists for {canonical}, skipping insert")
        # we still might want to create a mention bound to existing article later
        return None

    title, snippet = fetch_article_metadata(url)

    # Insert raw_articles row (schema-aligned: no `source` column)
    cursor.execute(
        """
        INSERT INTO raw_articles (
            mention_id,
            url,
            canonical_url,
            title,
            publisher,
            published_at,
            query_matched,
            raw_text,
            snippet
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            None,  # mention_id (not linked yet)
            url,
            canonical,
            title,
            company or None,
            None,
            "perplexity_seed",
            None,
            snippet,
        ),
    )

    mention_id = generate_mention_id(canonical)
    cursor.execute(
        """
        INSERT INTO mentions (
            mention_id,
            url,
            canonical_url,
            title,
            publisher,
            published_at,
            query_matched,
            raw_text,
            snippet,
            source_urls
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            mention_id,
            url,
            canonical,
            title,
            company or None,
            None,
            "perplexity_seed",
            None,
            snippet,
            json.dumps([url]),
        ),
    )

    print(f"  ✅ Inserted article + mention for {url}")
    return mention_id


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Ingest Perplexity seed projects into the news pipeline."
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
        help="Print actions but do not write to the database",
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

    print(f"🧵 Processing {len(seeds)} Perplexity seeds")

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    inserted = 0
    skipped = 0

    try:
        for i, seed in enumerate(seeds, 1):
            url = seed.get("primary_source_url")
            company = seed.get("company")
            if not url:
                print(f"[{i}/{len(seeds)}] ⚠️ Seed has no primary_source_url, skipping")
                skipped += 1
                continue

            print(f"[{i}/{len(seeds)}] {company or 'Unknown company'} - {seed.get('project_name', 'Unknown project')}")
            print(f"  URL: {url}")

            canonical = canonicalize_url(url)
            if article_exists(cursor, canonical):
                print("  ↪️ Article already exists in DB, skipping")
                skipped += 1
                continue

            if args.dry_run:
                print("  (dry-run) Would fetch and insert article + mention")
                inserted += 1
                continue

            mention_id = insert_article_and_mention(cursor, url, company, seed)
            if mention_id:
                inserted += 1

        if not args.dry_run:
            conn.commit()
            print("💾 Changes committed to database")
    finally:
        conn.close()

    print()
    print("📊 Ingestion summary")
    print(f"  Seeds processed : {len(seeds)}")
    print(f"  Inserted new    : {inserted}")
    print(f"  Skipped existing: {skipped}")
    print()
    print("Next steps:")
    print("  1) Run dedup/classify/extract pipeline:")
    print("     - python3 scripts/news-process/deduplicate.py")
    print("     - python3 scripts/news-process/classify.py")
    print("     - python3 scripts/news-process/extract_project_cards.py")
    print("     - python3 scripts/news-process/entity_resolution.py")
    print("  2) Run status + geocoding + export as usual.")


if __name__ == "__main__":
    main()


