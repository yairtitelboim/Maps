#!/usr/bin/env python3
"""
Improved Status Tracking - Better heuristics and pattern matching.
Uses announcement dates, better patterns, and scoring system.
"""

import sys
import time
import re
from typing import Dict, List
from pathlib import Path
import sqlite3
import json
from datetime import datetime, timedelta

# Paths
DB_PATH = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"

# Improved status signals with more flexible patterns
STATUS_SIGNALS = {
    "active": [
        # Construction signals
        r"\b(building|constructing|construction|under construction)\b",
        r"\b(breaking ground|groundbreaking|ground breaking)\b",
        r"\b(broke ground|broke ground)\b",
        r"\b(breaking ground|groundbreaking ceremony)\b",
        # Approval signals
        r"\b(approved|approval|permit granted|zoning approved)\b",
        r"\b(permit issued|permit approved|construction permit)\b",
        # Operational signals
        r"\b(operational|online|completed|opened|opening)\b",
        r"\b(fully operational|now operational|became operational)\b",
        # Investment/commitment signals
        r"\b(investing|investment|committed|announced|plans to build)\b",
        r"\b(will build|to build|building|developing)\b",
        r"\b(expanding|expansion|new facility|new campus)\b",
    ],
    "dead_candidate": [
        r"\b(paused|shelved|canceled|cancelled|scrapped|withdrawn|abandoned)\b",
        r"\b(permit expired|tax abatement rescinded|permit revoked)\b",
        r"\b(land sold|site listed|property sold|site for sale)\b",
        r"\b(market conditions|reconsidering|delayed indefinitely|on hold indefinitely)\b",
        r"\b(no longer proceeding|not proceeding|will not proceed)\b",
    ],
    "uncertain": [
        r"\b(delayed|postponed|under review|pending|on hold)\b",
        r"\b(uncertain|unclear|may not proceed|questionable)\b",
        r"\b(facing delays|experiencing delays|delayed due to)\b",
    ],
    "revived": [
        r"\b(resumed|restarted|back on track|moving forward)\b",
        r"\b(permit renewed|tax abatement restored|renewed)\b",
        r"\b(back in development|development resumed)\b",
    ]
}

def parse_date(date_str: str) -> datetime:
    """Parse ISO date string."""
    if not date_str:
        return None
    try:
        if "T" in date_str:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        else:
            return datetime.strptime(date_str[:10], "%Y-%m-%d")
    except:
        return None

def get_text_for_analysis(mention: Dict) -> str:
    """Get best available text for analysis."""
    # Prefer raw_text, then snippet, then title
    text = mention.get("raw_text") or mention.get("snippet") or mention.get("title") or ""
    return text.lower()

def score_status_signals(project: Dict, mentions: List[Dict]) -> Dict:
    """
    Score status signals with weights and recency.
    Returns scores for each status type.
    """
    project_mention_ids = project.get("mention_ids", [])
    project_mentions = [m for m in mentions if m.get("mention_id") in project_mention_ids]
    
    if not project_mentions:
        return {"active": 0, "dead_candidate": 0, "uncertain": 0, "revived": 0}
    
    # Sort by date (newest first)
    project_mentions.sort(key=lambda x: parse_date(x.get("published_at")) or datetime.min, reverse=True)
    
    scores = {"active": 0, "dead_candidate": 0, "uncertain": 0, "revived": 0}
    now = datetime.now()
    
    for mention in project_mentions:
        text = get_text_for_analysis(mention)
        if not text:
            continue
        
        published_at = parse_date(mention.get("published_at"))
        if published_at:
            # Recency weight: newer mentions count more
            days_ago = (now - published_at).days
            recency_weight = max(0.5, 1.0 - (days_ago / 365.0))  # Decay over 1 year
        else:
            recency_weight = 0.5
        
        # Check each status type
        for status, patterns in STATUS_SIGNALS.items():
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    # Weight by pattern type (construction > approval > investment)
                    if "construction" in pattern or "building" in pattern or "ground" in pattern:
                        pattern_weight = 2.0
                    elif "approved" in pattern or "permit" in pattern:
                        pattern_weight = 1.5
                    elif "operational" in pattern or "online" in pattern:
                        pattern_weight = 2.5  # Very strong signal
                    else:
                        pattern_weight = 1.0
                    
                    scores[status] += pattern_weight * recency_weight
    
    return scores

def determine_status_from_scores(scores: Dict, project: Dict) -> tuple:
    """
    Determine status from scores with heuristics.
    Returns (status, confidence)
    More conservative: requires explicit signals for active status.
    """
    # Get announcement date for age-based heuristics
    announced_date = parse_date(project.get("announced_date"))
    now = datetime.now()
    
    # If revived signals exist
    if scores["revived"] > 0:
        return ("active", "medium")
    
    # If dead signals exist (strong negative signal)
    if scores["dead_candidate"] >= 1.5:
        return ("dead_candidate", "high" if scores["dead_candidate"] >= 2.5 else "medium")
    
    # If uncertain signals exist
    if scores["uncertain"] >= 1.0:
        return ("uncertain", "medium")
    
    # Active requires explicit positive signals (construction, approval, operational)
    # Don't count generic "building" or "will build" as strong enough
    strong_active_signals = scores["active"] >= 2.0  # Need multiple signals
    
    if strong_active_signals:
        return ("active", "high" if scores["active"] >= 3.0 else "medium")
    
    # Weak active signals (just announcements) = uncertain
    if scores["active"] > 0:
        return ("uncertain", "low")
    
    # No signals at all - use heuristics based on age
    if announced_date:
        days_since = (now - announced_date).days
        
        # Very recent (< 3 months) = uncertain (too early to tell)
        if days_since < 90:
            return ("uncertain", "low")
        
        # Recent (< 1 year) = uncertain (announced but no progress signals)
        if days_since < 365:
            return ("uncertain", "low")
        
        # Old (> 2 years) with no signals = uncertain (stale)
        if days_since > 730:
            return ("uncertain", "low")
    
    # Default: uncertain (we don't know)
    return ("uncertain", "low")

def update_project_status(project: Dict, mentions: List[Dict]) -> Dict:
    """Update project status using improved scoring system."""
    # Score status signals
    scores = score_status_signals(project, mentions)
    
    # Determine status
    status, confidence = determine_status_from_scores(scores, project)
    
    # Update project
    project["status_current"] = status
    project["status_confidence"] = confidence
    project["status_scores"] = scores  # Store scores for debugging
    
    return project

def track_project_statuses(db_path: Path):
    """Track status for all projects."""
    start_time = time.time()
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Fetch all projects with announcement dates
    cursor.execute("""
        SELECT project_id, mention_ids, source_urls, announced_date
        FROM projects
    """)
    
    projects = []
    for row in cursor.fetchall():
        projects.append({
            "project_id": row[0],
            "mention_ids": json.loads(row[1]) if row[1] else [],
            "source_urls": json.loads(row[2]) if row[2] else [],
            "announced_date": row[3]
        })
    
    if not projects:
        print("✅ No projects to track")
        conn.close()
        return
    
    # Fetch all mentions
    mention_ids = []
    for project in projects:
        mention_ids.extend(project["mention_ids"])
    
    if not mention_ids:
        print("✅ No mentions found for projects")
        conn.close()
        return
    
    # Get mentions with all text fields
    placeholders = ",".join("?" * len(mention_ids))
    cursor.execute(f"""
        SELECT mention_id, title, snippet, published_at, url, raw_text
        FROM mentions
        WHERE mention_id IN ({placeholders})
    """, mention_ids)
    
    mentions = []
    for row in cursor.fetchall():
        mentions.append({
            "mention_id": row[0],
            "title": row[1],
            "snippet": row[2],
            "published_at": row[3],
            "url": row[4],
            "raw_text": row[5]
        })
    
    print(f"📊 Tracking status for {len(projects)} projects...")
    
    updated_count = 0
    status_counts = {"active": 0, "dead_candidate": 0, "uncertain": 0, "revived": 0, "unknown": 0}
    
    for project in projects:
        # Get existing status
        cursor.execute("""
            SELECT status_current, status_history, last_signal_at
            FROM project_status
            WHERE project_id = ?
        """, (project["project_id"],))
        
        result = cursor.fetchone()
        if result:
            project["status_current"] = result[0]
            project["status_history"] = json.loads(result[1]) if result[1] else []
            project["last_signal_at"] = result[2]
        else:
            project["status_current"] = None
            project["status_history"] = []
            project["last_signal_at"] = None
        
        # Update status
        updated_project = update_project_status(project, mentions)
        
        # Track status counts
        status = updated_project["status_current"]
        status_counts[status] = status_counts.get(status, 0) + 1
        
        # Save to database
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO project_status
                (project_id, status_current, status_confidence, status_history,
                 last_signal_at, status_updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                updated_project["project_id"],
                updated_project["status_current"],
                updated_project["status_confidence"],
                json.dumps(updated_project.get("status_history", [])),
                updated_project.get("last_signal_at")
            ))
            updated_count += 1
        except Exception as e:
            print(f"   ⚠️  Error updating {project['project_id']}: {e}")
    
    conn.commit()
    conn.close()
    
    elapsed = time.time() - start_time
    print(f"✅ Updated status for {updated_count} projects in {elapsed:.2f}s")
    print(f"📊 Status distribution:")
    for status, count in sorted(status_counts.items(), key=lambda x: -x[1]):
        print(f"   {status}: {count}")

def main():
    """Main function."""
    db_path = DB_PATH
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        sys.exit(1)
    
    track_project_statuses(db_path)

if __name__ == "__main__":
    main()

