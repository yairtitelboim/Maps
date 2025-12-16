#!/usr/bin/env python3
"""
Initialize SQLite database for news ingestion pipeline.
Run this once to set up the database schema.
"""

import sqlite3
import os
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
SCHEMA_PATH = Path(__file__).parent / "schema.sql"

def init_database():
    """Initialize database with schema."""
    # Create data directory if it doesn't exist
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    # Read schema
    with open(SCHEMA_PATH, 'r') as f:
        schema = f.read()
    
    # Create database and tables
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # Execute schema
    cursor.executescript(schema)
    
    conn.commit()
    conn.close()
    
    print(f"✅ Database initialized at: {DB_PATH}")
    print(f"   Tables created: raw_articles, mentions, classified_mentions, project_cards, projects, project_status")

if __name__ == "__main__":
    init_database()

