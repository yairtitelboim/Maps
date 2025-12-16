#!/usr/bin/env python3
"""
Batch fetcher - runs multiple queries from config file.
Each query runs independently with timeout protection.
"""

import json
import time
import sys
from pathlib import Path
from serpapi_fetcher import fetch_serpapi_news, save_to_database

# Load environment
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / '.env.local')

def load_queries(config_path: Path):
    """Load queries from config file."""
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    queries = []
    
    # Core queries
    for query_config in config.get("core_queries", []):
        if query_config.get("enabled", True):
            queries.append({
                "query": query_config["query"],
                "type": "core"
            })
    
    # Company queries
    for query_config in config.get("company_queries", []):
        if query_config.get("enabled", True):
            queries.append({
                "query": query_config["query"],
                "type": "company",
                "company": query_config.get("company", "")
            })
    
    # Geographic queries
    for query_config in config.get("geographic_queries", []):
        if query_config.get("enabled", True):
            queries.append({
                "query": query_config["query"],
                "type": "geographic",
                "region": query_config.get("region", "")
            })
    
    return queries

def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Batch fetch news articles from config')
    parser.add_argument('--config', type=str,
                       default=str(Path(__file__).parent.parent.parent / "config" / "news_queries.json"),
                       help='Config file path')
    parser.add_argument('--max-results', type=int, default=50,
                       help='Max results per query')
    parser.add_argument('--db', type=str,
                       default=str(Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"),
                       help='Database path')
    parser.add_argument('--limit', type=int, default=None,
                       help='Limit number of queries to run (for testing)')
    
    args = parser.parse_args()
    
    config_path = Path(args.config)
    if not config_path.exists():
        print(f"❌ Config file not found at {config_path}")
        sys.exit(1)
    
    queries = load_queries(config_path)
    
    if args.limit:
        queries = queries[:args.limit]
    
    print(f"🚀 Running {len(queries)} queries...")
    
    db_path = Path(args.db)
    total_start = time.time()
    total_articles = 0
    
    for i, query_info in enumerate(queries, 1):
        query = query_info["query"]
        print(f"\n[{i}/{len(queries)}] Query: {query}")
        
        query_start = time.time()
        
        try:
            # Fetch articles (with built-in timeout)
            articles = fetch_serpapi_news(query, max_results=args.max_results)
            
            # Save to database
            if db_path.exists():
                save_to_database(articles, db_path)
                total_articles += len(articles)
            else:
                print(f"⚠️  Database not found - articles not saved")
            
            query_elapsed = time.time() - query_start
            print(f"   ✅ Completed in {query_elapsed:.2f}s")
            
            # Small delay between queries to be respectful
            if i < len(queries):
                time.sleep(1)
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
            continue
    
    total_elapsed = time.time() - total_start
    print(f"\n✅ Batch complete: {total_articles} articles in {total_elapsed:.2f}s")
    
    if total_elapsed > 60:
        print(f"⚠️  WARNING: Total time exceeded 60 seconds!")
        print(f"   Consider running fewer queries or reducing --max-results")

if __name__ == "__main__":
    main()

