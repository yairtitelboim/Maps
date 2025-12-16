#!/usr/bin/env python3
"""
Phase C: Classify articles into buckets (Project Announcement / Context / Noise).
Uses rules-based classification (LLM upgrade later).
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

# Expand keywords - data center not always mentioned explicitly
DATA_CENTER_KEYWORDS = [
    r"\b(data center|datacenter|hyperscale|campus)\b",
    r"\b(cloud facility|cloud campus)\b",
    r"\b(AI compute|AI campus|AI facility)\b",
    r"\b(server farm|server facility)\b",
    r"\b(compute facility|compute campus)\b",
]

CLASSIFICATION_RULES = {
    "project_announcement": {
        "required_keywords": DATA_CENTER_KEYWORDS,  # At least one must match
        "required_signals": 2,  # Need at least 2 of:
        "signals": [
            r"\b(city|county|site|location|address|parcel|industrial park)\b",
            r"\b(MW|megawatt|square feet|sqft|acre|acres|campus|multi-building)\b",
            r"\b(Amazon|Google|Microsoft|Meta|Oracle|CoreWeave|Digital Realty|QTS|Switch|Aligned)\b",
            r"\b(by 20\d{2}|breaking ground|groundbreaking|construction|permit|zoning|tax abatement)\b",
            r"\b(permit|zoning|tax abatement|approval|filing)\b",
        ]
    },
    "noise": {
        "keywords": [
            r"\b(jobs|hiring|careers|now hiring)\b",
            r"\b(colocation pricing|colocation rates)\b",
            r"\b(bitcoin|crypto mining|cryptocurrency)\b",
            r"\b(edge data center|edge computing)\b",
        ]
    }
}

def classify_article(mention: Dict) -> Dict:
    """
    Classify article into bucket: project_announcement, context, or noise.
    
    Returns:
        {
            "classification": "project_announcement" | "context" | "noise",
            "confidence": "low" | "medium" | "high",
            "matched_signals": List[str],
            "reasoning": str
        }
    """
    text = (mention.get("snippet", "") or "").lower()
    title = (mention.get("title", "") or "").lower()
    full_text = f"{title} {text}"
    
    # Check for noise first
    for keyword in CLASSIFICATION_RULES["noise"]["keywords"]:
        if re.search(keyword, full_text, re.IGNORECASE):
            return {
                "classification": "noise",
                "confidence": "high",
                "matched_signals": [keyword],
                "reasoning": f"Matched noise keyword: {keyword}"
            }
    
    # Check for project announcement signals
    matched_signals = []
    for signal_pattern in CLASSIFICATION_RULES["project_announcement"]["signals"]:
        if re.search(signal_pattern, full_text, re.IGNORECASE):
            matched_signals.append(signal_pattern)
    
    # Check required keywords (at least one must match)
    has_required = any(
        re.search(pattern, full_text, re.IGNORECASE)
        for pattern in CLASSIFICATION_RULES["project_announcement"]["required_keywords"]
    )
    
    required_signals = CLASSIFICATION_RULES["project_announcement"]["required_signals"]
    
    if has_required and len(matched_signals) >= required_signals:
        confidence = "high" if len(matched_signals) >= 3 else "medium"
        return {
            "classification": "project_announcement",
            "confidence": confidence,
            "matched_signals": matched_signals,
            "reasoning": f"Matched {len(matched_signals)} signals"
        }
    
    # Default to context/news
    return {
        "classification": "context",
        "confidence": "low",
        "matched_signals": matched_signals,
        "reasoning": "General news, not specific project announcement"
    }

def classify_mentions(db_path: Path):
    """Classify all unclassified mentions."""
    start_time = time.time()
    
    # Set up timeout signal handler
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(MAX_RUNTIME_SECONDS)
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Fetch unclassified mentions
        cursor.execute("""
            SELECT mention_id, title, publisher, snippet, published_at
            FROM mentions
            WHERE mention_id NOT IN (SELECT mention_id FROM classified_mentions)
            ORDER BY published_at
        """)
        
        mentions = []
        for row in cursor.fetchall():
            mentions.append({
                "mention_id": row[0],
                "title": row[1],
                "publisher": row[2],
                "snippet": row[3],
                "published_at": row[4]
            })
        
        if not mentions:
            print("✅ No new mentions to classify")
            conn.close()
            return
        
        print(f"📊 Classifying {len(mentions)} mentions...")
        
        classified_count = 0
        project_announcements = 0
        
        for i, mention in enumerate(mentions):
            # Health check every 50 mentions
            if i > 0 and i % 50 == 0:
                if not health_check(start_time):
                    print(f"⚠️  Stopping at {i} mentions due to time limit")
                    break
            
            classification = classify_article(mention)
            
            if classification["classification"] == "project_announcement":
                project_announcements += 1
            
            try:
                cursor.execute("""
                    INSERT INTO classified_mentions
                    (mention_id, classification, confidence, matched_signals, reasoning, classified_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    mention["mention_id"],
                    classification["classification"],
                    classification["confidence"],
                    json.dumps(classification["matched_signals"]),
                    classification["reasoning"]
                ))
                classified_count += 1
            except sqlite3.IntegrityError:
                pass
        
        conn.commit()
        conn.close()
        
        elapsed = time.time() - start_time
        print(f"✅ Classified {classified_count} mentions in {elapsed:.2f}s")
        print(f"   📢 Project announcements: {project_announcements}")
        print(f"   📰 Context/news: {classified_count - project_announcements}")
        
        if elapsed > 60:
            print(f"⚠️  WARNING: Script exceeded 60 seconds!")
        
    except TimeoutError:
        elapsed = time.time() - start_time
        print(f"⏱️  Timeout after {elapsed:.2f}s - partial classification complete")
    except Exception as e:
        signal.alarm(0)
        raise
    finally:
        signal.alarm(0)

def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Classify mentions')
    parser.add_argument('--db', type=str, 
                       default=str(Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"),
                       help='Database path')
    
    args = parser.parse_args()
    
    db_path = Path(args.db)
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        sys.exit(1)
    
    classify_mentions(db_path)

if __name__ == "__main__":
    main()

