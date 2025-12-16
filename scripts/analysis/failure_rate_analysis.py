#!/usr/bin/env python3
"""
Failure Rate Analysis for Texas Data Center Projects

Implements the 6-step test:
  1. Status breakdown from project_status
  2. Time-based reclassification (dead / stalled / active / never_updated)
  3. County-level failure rates
  4. Death signal patterns from status_evidence
  5. Timeline from announcement to death
  6. Company-level failure rates

Outputs human-readable results to stdout.
"""

import json
import sqlite3
from pathlib import Path
from datetime import datetime


DB_PATH = Path("data/news/news_pipeline.db")


def connect_db():
  if not DB_PATH.exists():
    raise FileNotFoundError(f"news_pipeline.db not found at {DB_PATH}")
  return sqlite3.connect(str(DB_PATH))


def step1_status_breakdown(conn):
  print("=" * 80)
  print("STEP 1: STATUS BREAKDOWN (RAW project_status TABLE)")
  print("=" * 80)
  print()

  cursor = conn.cursor()
  cursor.execute(
    """
    SELECT 
        ps.status_current,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM project_status), 1) as pct
    FROM project_status ps
    GROUP BY ps.status_current
    ORDER BY count DESC
    """
  )

  status_breakdown = cursor.fetchall()
  print("Status Breakdown:")
  for status, count, pct in status_breakdown:
    label = status if status is not None else "Unknown"
    print(f"  {label}: {count} projects ({pct}%)")
  print()


def step2_time_reclassification(conn):
  print("=" * 80)
  print("STEP 2: RECLASSIFY BY TIME SINCE LAST SIGNAL")
  print("=" * 80)
  print()

  cursor = conn.cursor()
  cursor.execute(
    """
    SELECT 
        p.project_id,
        p.project_name,
        p.company,
        p.location_text,
        p.announced_date,
        ps.status_current,
        ps.last_signal_at,
        julianday('now') - julianday(ps.last_signal_at) as days_since_signal
    FROM projects p
    LEFT JOIN project_status ps ON p.project_id = ps.project_id
    """
  )

  projects = cursor.fetchall()

  dead_count = 0
  stalled_count = 0
  active_count = 0
  never_updated = 0

  for proj in projects:
    days_since = proj[7]
    if days_since is None:
      never_updated += 1
    elif days_since > 365:
      dead_count += 1
    elif days_since > 180:
      stalled_count += 1
    else:
      active_count += 1

  print("Reclassified by time since last signal:")
  print(f"  Dead (12+ months no updates): {dead_count}")
  print(f"  Stalled (6-12 months no updates): {stalled_count}")
  print(f"  Active (updates < 6 months): {active_count}")
  print(f"  Never updated: {never_updated}")
  print()


def step3_geographic_failure(conn):
  print("=" * 80)
  print("STEP 3: GEOGRAPHIC FAILURE PATTERN (BY COUNTY)")
  print("=" * 80)
  print()

  cursor = conn.cursor()
  cursor.execute(
    """
    SELECT 
        p.location_text,
        COUNT(*) as total_projects,
        SUM(
          CASE 
            WHEN ps.last_signal_at IS NOT NULL 
                 AND julianday('now') - julianday(ps.last_signal_at) > 365 
            THEN 1 
            ELSE 0 
          END
        ) as dead_projects,
        ROUND(
          SUM(
            CASE 
              WHEN ps.last_signal_at IS NOT NULL 
                   AND julianday('now') - julianday(ps.last_signal_at) > 365 
              THEN 1 
              ELSE 0 
            END
          ) * 100.0 / COUNT(*),
          1
        ) as failure_rate
    FROM projects p
    LEFT JOIN project_status ps ON p.project_id = ps.project_id
    WHERE p.location_text IS NOT NULL
    GROUP BY p.location_text
    HAVING total_projects >= 2
    ORDER BY failure_rate DESC, total_projects DESC
    """
  )

  county_failures = cursor.fetchall()

  print("Locations with highest failure rates (min 2 projects, by location_text):")
  if not county_failures:
    print("  (No locations meet the min 2 projects threshold)")
  else:
    for loc, total, dead, rate in county_failures[:10]:
      print(f"  {loc}: {dead}/{total} failed ({rate}%)")
  print()


def step4_death_signals(conn):
  print("=" * 80)
  print("STEP 4: DEATH SIGNALS FOR DEAD / STALLED PROJECTS")
  print("=" * 80)
  print()

  cursor = conn.cursor()
  cursor.execute(
    """
    SELECT 
        p.project_name,
        p.company,
        p.location_text,
        ps.status_history,
        ps.status_current,
        ps.last_signal_at
    FROM projects p
    JOIN project_status ps ON p.project_id = ps.project_id
    WHERE 
      (ps.last_signal_at IS NOT NULL 
       AND julianday('now') - julianday(ps.last_signal_at) > 365)
      OR ps.status_current = 'dead_candidate'
    """
  )

  dead_projects = cursor.fetchall()

  if not dead_projects:
    print("No projects classified as dead/stalled by these rules.")
    print()
    return

  for name, company, location_text, status_history, status_current, last_signal_at in dead_projects:
    print(f"{name or 'Unknown Project'} ({company or 'Unknown Company'}, {location_text or 'Unknown Location'})")
    print(f"  status_current: {status_current}, last_signal_at: {last_signal_at}")
    if not status_history:
      print("  (no status_history JSON)")
      print()
      continue

    try:
      history_data = json.loads(status_history)
    except Exception:
      print("  (invalid status_history JSON)")
      print()
      continue

    # status_history is typically a list of entries (status, timestamp, signals/notes)
    # Print a couple of most recent entries
    if isinstance(history_data, list):
      recent = sorted(
        history_data,
        key=lambda h: h.get("updated_at") or h.get("timestamp") or "",
        reverse=True,
      )[:2]
      for entry in recent:
        st = entry.get("status") or entry.get("status_current")
        ts = entry.get("updated_at") or entry.get("timestamp")
        note = entry.get("note") or entry.get("reason") or ""
        print(f"  - {ts}: {st} ({note})")
    else:
      print("  (status_history not in expected list format)")
    print()


def parse_date_safe(d):
  if not d:
    return None
  try:
    # Try common formats
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%fZ"):
      try:
        return datetime.strptime(d, fmt)
      except ValueError:
        continue
  except Exception:
    return None
  return None


def step5_timeline_to_death(conn):
  print("=" * 80)
  print("STEP 5: TIMELINE FROM ANNOUNCEMENT TO DEATH")
  print("=" * 80)
  print()

  cursor = conn.cursor()
  cursor.execute(
    """
    SELECT 
        p.project_name,
        p.announced_date,
        ps.last_signal_at,
        julianday(ps.last_signal_at) - julianday(p.announced_date) as days_to_death
    FROM projects p
    JOIN project_status ps ON p.project_id = ps.project_id
    WHERE 
      (ps.last_signal_at IS NOT NULL 
       AND julianday('now') - julianday(ps.last_signal_at) > 365)
      AND p.announced_date IS NOT NULL
    ORDER BY days_to_death
    """
  )

  rows = cursor.fetchall()
  valid = [r for r in rows if r[3] is not None]

  if not valid:
    print("No projects meet the 'dead' criteria with both announced_date and last_signal_at.")
    print()
    return

  days_values = [r[3] for r in valid]
  avg_days = sum(days_values) / len(days_values)
  fastest = min(days_values)
  slowest = max(days_values)

  print("Time from announcement to death (for projects with 12+ months silence):")
  print(f"  Sample size: {len(valid)} projects")
  print(f"  Average: {avg_days / 365:.1f} years")
  print(f"  Fastest: {fastest / 30:.1f} months")
  print(f"  Slowest: {slowest / 365:.1f} years")
  print()


def step6_company_failure_rates(conn):
  print("=" * 80)
  print("STEP 6: FAILURE RATE BY COMPANY")
  print("=" * 80)
  print()

  cursor = conn.cursor()
  cursor.execute(
    """
    SELECT 
        p.company,
        COUNT(*) as total_projects,
        SUM(
          CASE 
            WHEN ps.last_signal_at IS NOT NULL 
                 AND julianday('now') - julianday(ps.last_signal_at) > 365 
            THEN 1 
            ELSE 0 
          END
        ) as dead_projects,
        ROUND(
          SUM(
            CASE 
              WHEN ps.last_signal_at IS NOT NULL 
                   AND julianday('now') - julianday(ps.last_signal_at) > 365 
              THEN 1 
              ELSE 0 
            END
          ) * 100.0 / COUNT(*),
          1
        ) as failure_rate
    FROM projects p
    LEFT JOIN project_status ps ON p.project_id = ps.project_id
    WHERE p.company IS NOT NULL
    GROUP BY p.company
    HAVING total_projects >= 2
    ORDER BY failure_rate DESC, total_projects DESC
    """
  )

  company_failures = cursor.fetchall()

  print("Failure rate by company (min 2 projects):")
  if not company_failures:
    print("  (No companies meet the min 2 projects threshold)")
  else:
    for company, total, dead, rate in company_failures:
      print(f"  {company}: {dead}/{total} failed ({rate}%)")
  print()


def main():
  conn = connect_db()
  try:
    step1_status_breakdown(conn)
    step2_time_reclassification(conn)
    step3_geographic_failure(conn)
    step4_death_signals(conn)
    step5_timeline_to_death(conn)
    step6_company_failure_rates(conn)
  finally:
    conn.close()


if __name__ == "__main__":
  main()


