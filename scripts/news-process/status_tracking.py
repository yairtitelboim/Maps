#!/usr/bin/env python3
"""
Phase F: Status Tracking - Track "Alive vs Dead" signals from news.
Handles conflicts: newest "dead" beats "active" unless newer "construction started".
Timeout protection: <60 seconds
"""

import sys
import time
import signal
import re
from typing import Dict, List
from pathlib import Path
import sqlite3
import json
from datetime import datetime

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

STATUS_SIGNALS = {
    "dead_candidate": [
        r"\b(paused|shelved|canceled|cancelled|scrapped|withdrawn)\b",
        r"\b(permit expired|tax abatement rescinded)\b",
        r"\b(land sold|site listed|property sold)\b",
        r"\b(market conditions|reconsidering|delayed indefinitely)\b",
    ],
    "revived": [
        r"\b(resumed|restarted|back on track|moving forward)\b",
        r"\b(permit renewed|tax abatement restored)\b",
    ],
    "uncertain": [
        r"\b(delayed|postponed|under review|pending)\b",
        r"\b(uncertain|unclear|may not proceed)\b",
    ],
    "active": [
        r"\b(breaking ground|groundbreaking|construction started|under construction)\b",
        r"\b(approved|permit granted|zoning approved)\b",
        r"\b(operational|online|completed)\b",
    ]
}

def parse_date(date_str: str) -> datetime:
    """Parse ISO date string."""
    try:
        if "T" in date_str:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        else:
            return datetime.strptime(date_str[:10], "%Y-%m-%d")
    except:
        return datetime.now()

def update_project_status(project: Dict, mentions: List[Dict]) -> Dict:
    """
    Update project status based on latest mentions.
    Handles conflicts: newest "dead" beats "active" unless newer "construction started".
    
    Returns:
        Updated project with status fields and history
    """
    # Get latest mentions for this project
    project_mention_ids = project.get("mention_ids", [])
    project_mentions = [m for m in mentions if m.get("mention_id") in project_mention_ids]
    
    # Sort by date (newest first)
    project_mentions.sort(key=lambda x: x.get("published_at", ""), reverse=True)
    
    # Check for status signals
    status_evidence = {
        "dead_candidate": [],
        "revived": [],
        "uncertain": [],
        "active": []
    }
    
    for mention in project_mentions:
        text = (mention.get("snippet", "") or mention.get("title", "")).lower()
        
        for status, patterns in STATUS_SIGNALS.items():
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    status_evidence[status].append({
                        "url": mention.get("url", ""),
                        "published_at": mention.get("published_at", ""),
                        "signal": pattern
                    })
    
    # Determine status with conflict handling
    status_history = project.get("status_history", [])
    
    # Get most recent signals
    latest_dead = max(status_evidence["dead_candidate"], key=lambda x: x["published_at"]) if status_evidence["dead_candidate"] else None
    latest_active = max(status_evidence["active"], key=lambda x: x["published_at"]) if status_evidence["active"] else None
    latest_revived = max(status_evidence["revived"], key=lambda x: x["published_at"]) if status_evidence["revived"] else None
    
    # Conflict resolution
    if latest_revived:
        # Revival beats dead if revival is newer
        if latest_dead and latest_revived["published_at"] > latest_dead["published_at"]:
            status = "active"
            confidence = "high"
        else:
            status = "active"
            confidence = "medium"
    elif latest_active:
        # Active beats dead if active is newer
        if latest_dead and latest_active["published_at"] > latest_dead["published_at"]:
            status = "active"
            confidence = "high"
        elif latest_dead:
            status = "dead_candidate"
            confidence = "high"
        else:
            status = "active"
            confidence = "high"
    elif latest_dead:
        status = "dead_candidate"
        confidence = "high" if len(status_evidence["dead_candidate"]) >= 2 else "medium"
    elif status_evidence["uncertain"]:
        status = "uncertain"
        confidence = "medium"
    else:
        status = project.get("status_current", "active")  # Keep existing or default
        confidence = "low"
    
    # Update status history
    current_status = project.get("status_current")
    if status != current_status:
        status_history.append({
            "status": status,
            "confidence": confidence,
            "updated_at": datetime.utcnow().isoformat(),
            "evidence": status_evidence.get(status, [])
        })
    
    project["status_current"] = status
    project["status_confidence"] = confidence
    project["status_history"] = status_history
    project["status_evidence"] = status_evidence
    
    # Get last signal date
    all_signals = []
    for signals in status_evidence.values():
        all_signals.extend(signals)
    
    if all_signals:
        project["last_signal_at"] = max(s["published_at"] for s in all_signals)
    else:
        project["last_signal_at"] = project.get("last_signal_at")
    
    return project

def track_project_statuses(db_path: Path):
    """Track status for all projects."""
    start_time = time.time()
    
    # Set up timeout signal handler
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(MAX_RUNTIME_SECONDS)
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Fetch all projects
        cursor.execute("""
            SELECT project_id, mention_ids, source_urls
            FROM projects
        """)
        
        projects = []
        for row in cursor.fetchall():
            projects.append({
                "project_id": row[0],
                "mention_ids": json.loads(row[1]) if row[1] else [],
                "source_urls": json.loads(row[2]) if row[2] else []
            })
        
        if not projects:
            print("✅ No projects to track")
            conn.close()
            return
        
        # Fetch all mentions for these projects
        mention_ids = []
        for project in projects:
            mention_ids.extend(project["mention_ids"])
        
        if not mention_ids:
            print("✅ No mentions found for projects")
            conn.close()
            return
        
        # Get mentions
        placeholders = ",".join("?" * len(mention_ids))
        cursor.execute(f"""
            SELECT mention_id, title, snippet, published_at, url
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
                "url": row[4]
            })
        
        print(f"📊 Tracking status for {len(projects)} projects...")
        
        updated_count = 0
        
        for i, project in enumerate(projects):
            # Health check every 10 projects
            if i > 0 and i % 10 == 0:
                if not health_check(start_time):
                    print(f"⚠️  Stopping at {i} projects due to time limit")
                    break
            
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
                    json.dumps(updated_project["status_history"]),
                    updated_project["last_signal_at"]
                ))
                updated_count += 1
            except Exception as e:
                print(f"   ⚠️  Error updating {project['project_id']}: {e}")
        
        conn.commit()
        conn.close()
        
        elapsed = time.time() - start_time
        print(f"✅ Updated status for {updated_count} projects in {elapsed:.2f}s")
        
        if elapsed > 60:
            print(f"⚠️  WARNING: Script exceeded 60 seconds!")
        
    except TimeoutError:
        elapsed = time.time() - start_time
        print(f"⏱️  Timeout after {elapsed:.2f}s - partial status update complete")
    except Exception as e:
        signal.alarm(0)
        raise
    finally:
        signal.alarm(0)

def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Track project statuses')
    parser.add_argument('--db', type=str, 
                       default=str(Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"),
                       help='Database path')
    
    args = parser.parse_args()
    
    db_path = Path(args.db)
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        sys.exit(1)
    
    track_project_statuses(db_path)

if __name__ == "__main__":
    main()

