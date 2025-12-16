-- SQLite schema for news ingestion pipeline
-- Phase A: Raw articles storage

CREATE TABLE IF NOT EXISTS raw_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mention_id TEXT UNIQUE,  -- Hash of canonical URL
    url TEXT NOT NULL,  -- Original URL
    canonical_url TEXT NOT NULL,  -- Canonicalized URL
    title TEXT,
    publisher TEXT,
    published_at TEXT,  -- ISO format
    query_matched TEXT,
    raw_text TEXT,  -- Fetched later, not at ingest time
    snippet TEXT,
    ingested_at TEXT DEFAULT CURRENT_TIMESTAMP,
    extraction_error TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mention_id ON raw_articles(mention_id);
CREATE INDEX IF NOT EXISTS idx_canonical_url ON raw_articles(canonical_url);
CREATE INDEX IF NOT EXISTS idx_published_at ON raw_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_query_matched ON raw_articles(query_matched);

-- Phase B: Normalized mentions (created after deduplication)
CREATE TABLE IF NOT EXISTS mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mention_id TEXT UNIQUE,
    url TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    title TEXT,
    publisher TEXT,
    published_at TEXT,
    query_matched TEXT,
    raw_text TEXT,
    snippet TEXT,
    source_urls TEXT,  -- JSON array of URLs (for merged duplicates)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mentions_mention_id ON mentions(mention_id);
CREATE INDEX IF NOT EXISTS idx_mentions_published_at ON mentions(published_at);

-- Phase C: Classification results
CREATE TABLE IF NOT EXISTS classified_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mention_id TEXT UNIQUE,
    classification TEXT,  -- 'project_announcement', 'context', 'noise'
    confidence TEXT,  -- 'low', 'medium', 'high'
    matched_signals TEXT,  -- JSON array
    reasoning TEXT,
    classified_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mention_id) REFERENCES mentions(mention_id)
);

CREATE INDEX IF NOT EXISTS idx_classification ON classified_mentions(classification);

-- Phase D: Project cards (extracted structured data)
CREATE TABLE IF NOT EXISTS project_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT UNIQUE,  -- Generated ID
    mention_id TEXT,  -- Link to mention
    project_name TEXT,
    company TEXT,
    location_text TEXT,
    site_hint TEXT,
    size_mw REAL,
    size_sqft INTEGER,
    size_acres REAL,
    announced_date TEXT,
    expected_completion_date TEXT,
    probability_score TEXT,  -- 'high', 'medium', 'low', 'unknown'
    extraction_confidence TEXT,
    location_geocode_confidence TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mention_id) REFERENCES mentions(mention_id)
);

CREATE INDEX IF NOT EXISTS idx_project_company ON project_cards(company);
CREATE INDEX IF NOT EXISTS idx_project_location ON project_cards(location_text);

-- Phase E: Entity resolution (projects merged from multiple mentions)
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT UNIQUE,
    project_name TEXT,
    company TEXT,
    location_text TEXT,
    site_hint TEXT,
    size_mw REAL,
    size_sqft INTEGER,
    size_acres REAL,
    announced_date TEXT,
    expected_completion_date TEXT,
    probability_score TEXT,  -- 'high', 'medium', 'low', 'unknown'
    extraction_confidence TEXT,
    mention_ids TEXT,  -- JSON array of mention IDs
    source_urls TEXT,  -- JSON array of source URLs
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company);
CREATE INDEX IF NOT EXISTS idx_projects_location ON projects(location_text);

CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company);
CREATE INDEX IF NOT EXISTS idx_projects_location ON projects(location_text);

-- Phase F: Status tracking
CREATE TABLE IF NOT EXISTS project_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT UNIQUE,
    status_current TEXT,  -- 'active', 'dead_candidate', 'uncertain', 'revived'
    status_confidence TEXT,
    status_history TEXT,  -- JSON array
    last_signal_at TEXT,
    status_updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

CREATE INDEX IF NOT EXISTS idx_status_current ON project_status(status_current);

