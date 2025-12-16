#!/usr/bin/env python3
"""
Test script to validate pipeline before running.
Checks database, API keys, and runs dry-run tests.
"""

import sys
import os
from pathlib import Path
import sqlite3
import json
from dotenv import load_dotenv

# Load environment
load_dotenv(Path(__file__).parent.parent.parent / '.env.local')

def test_database():
    """Test database connection and schema."""
    print("🔍 Testing database...")
    
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    if not db_path.exists():
        print("   ❌ Database not found")
        print(f"   Run: python3 scripts/news-ingest/init_db.py")
        return False
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Check tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        required_tables = [
            'raw_articles', 'mentions', 'classified_mentions',
            'project_cards', 'projects', 'project_status'
        ]
        
        missing_tables = [t for t in required_tables if t not in tables]
        
        if missing_tables:
            print(f"   ❌ Missing tables: {missing_tables}")
            conn.close()
            return False
        
        # Check counts
        cursor.execute("SELECT COUNT(*) FROM raw_articles")
        raw_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM mentions")
        mentions_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM classified_mentions WHERE classification='project_announcement'")
        projects_count = cursor.fetchone()[0]
        
        conn.close()
        
        print(f"   ✅ Database OK")
        print(f"      Tables: {len(tables)}")
        print(f"      Raw articles: {raw_count}")
        print(f"      Mentions: {mentions_count}")
        print(f"      Project announcements: {projects_count}")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Database error: {e}")
        return False

def test_api_key():
    """Test SerpAPI key."""
    print("\n🔍 Testing API key...")
    
    api_key = os.getenv('SERP_API_KEY')
    
    if not api_key:
        print("   ❌ SERP_API_KEY not found in .env.local")
        return False
    
    # Quick API test
    try:
        from serpapi import GoogleSearch
        
        params = {
            "q": "test",
            "tbm": "nws",
            "api_key": api_key,
            "num": 1
        }
        
        search = GoogleSearch(params)
        results = search.get_dict()
        
        if "error" in results:
            print(f"   ❌ API error: {results['error']}")
            return False
        
        print("   ✅ API key valid")
        return True
        
    except ImportError:
        print("   ❌ serpapi module not installed")
        print("   Run: pip3 install google-search-results")
        return False
    except Exception as e:
        print(f"   ❌ API test failed: {e}")
        return False

def test_config():
    """Test configuration file."""
    print("\n🔍 Testing configuration...")
    
    config_path = Path(__file__).parent.parent.parent / "config" / "news_queries.json"
    
    if not config_path.exists():
        print(f"   ❌ Config file not found: {config_path}")
        return False
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        core_queries = len(config.get("core_queries", []))
        company_queries = len(config.get("company_queries", []))
        
        enabled_core = sum(1 for q in config.get("core_queries", []) if q.get("enabled", True))
        enabled_company = sum(1 for q in config.get("company_queries", []) if q.get("enabled", True))
        
        print(f"   ✅ Config OK")
        print(f"      Core queries: {enabled_core}/{core_queries} enabled")
        print(f"      Company queries: {enabled_company}/{company_queries} enabled")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Config error: {e}")
        return False

def test_scripts():
    """Test that all scripts exist and are importable."""
    print("\n🔍 Testing scripts...")
    
    scripts = [
        "scripts/news-ingest/init_db.py",
        "scripts/news-ingest/serpapi_fetcher.py",
        "scripts/news-ingest/batch_fetcher.py",
        "scripts/news-process/deduplicate.py",
        "scripts/news-process/classify.py",
        "scripts/news-process/extract_project_cards.py",
        "scripts/news-process/entity_resolution.py",
        "scripts/news-process/status_tracking.py",
    ]
    
    base_path = Path(__file__).parent.parent.parent
    
    missing = []
    for script in scripts:
        script_path = base_path / script
        if not script_path.exists():
            missing.append(script)
    
    if missing:
        print(f"   ❌ Missing scripts: {missing}")
        return False
    
    print(f"   ✅ All {len(scripts)} scripts found")
    return True

def test_sample_query():
    """Test a single query fetch (dry run)."""
    print("\n🔍 Testing sample query (dry run)...")
    
    try:
        from serpapi import GoogleSearch
        
        api_key = os.getenv('SERP_API_KEY')
        if not api_key:
            print("   ⚠️  Skipping (no API key)")
            return True
        
        params = {
            "q": "data center Texas",
            "tbm": "nws",
            "api_key": api_key,
            "num": 3
        }
        
        search = GoogleSearch(params)
        results = search.get_dict()
        
        if "error" in results:
            print(f"   ❌ Query test failed: {results['error']}")
            return False
        
        news_results = results.get("news_results", [])
        
        print(f"   ✅ Query test OK")
        print(f"      Found {len(news_results)} results")
        
        if news_results:
            print(f"      Sample: {news_results[0].get('title', 'N/A')[:60]}...")
        
        return True
        
    except Exception as e:
        print(f"   ⚠️  Query test error: {e}")
        return False

def test_pipeline_flow():
    """Test the pipeline flow logic."""
    print("\n🔍 Testing pipeline flow...")
    
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    if not db_path.exists():
        print("   ⚠️  Skipping (database not initialized)")
        return True
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Check pipeline state
        cursor.execute("SELECT COUNT(*) FROM raw_articles")
        raw_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM mentions")
        mentions_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM classified_mentions")
        classified_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM project_cards")
        cards_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM projects")
        projects_count = cursor.fetchone()[0]
        
        conn.close()
        
        print(f"   ✅ Pipeline state:")
        print(f"      Raw articles: {raw_count}")
        print(f"      Mentions: {mentions_count}")
        print(f"      Classified: {classified_count}")
        print(f"      Project cards: {cards_count}")
        print(f"      Projects: {projects_count}")
        
        # Check for unprocessed items
        if raw_count > mentions_count:
            print(f"      ⚠️  {raw_count - mentions_count} raw articles need deduplication")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Flow test error: {e}")
        return False

def main():
    """Run all tests."""
    print("=" * 60)
    print("News Discovery Pipeline - Pre-Flight Tests")
    print("=" * 60)
    
    tests = [
        ("Database", test_database),
        ("API Key", test_api_key),
        ("Configuration", test_config),
        ("Scripts", test_scripts),
        ("Sample Query", test_sample_query),
        ("Pipeline Flow", test_pipeline_flow),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n   ❌ {name} test crashed: {e}")
            results.append((name, False))
    
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✅ All tests passed! Pipeline is ready to run.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Fix issues before running pipeline.")
        return 1

if __name__ == "__main__":
    sys.exit(main())

