#!/usr/bin/env python3
"""
Collect candidate Texas data center / AI infrastructure projects from Perplexity.

This script:
- Calls Perplexity with a small set of discovery prompts (regions/companies)
- Parses JSON responses into a unified seed list
- De-duplicates against existing projects in news_pipeline.db
- Writes candidates to data/analysis/perplexity_seeds.json
"""

import os
import json
import sqlite3
import requests
from pathlib import Path
from typing import List, Dict, Any

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
DB_PATH = BASE_DIR / "data" / "news" / "news_pipeline.db"
SEEDS_PATH = BASE_DIR / "data" / "analysis" / "perplexity_seeds.json"

load_dotenv(BASE_DIR / ".env.local")
PERPLEXITY_API_KEY = os.getenv("PRP")
PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"
MODEL = "sonar-pro"


DISCOVERY_PROMPTS = [
    # One final targeted search
    (
        "Find a news article announcing a data center project in Texas from companies "
        "like CyrusOne, Digital Realty Trust, or other major colocation providers "
        "that was announced in 2022-2025. Must have specific city and county. "
        "Provide the actual news article URL."
    ),
]


SYSTEM_MESSAGE = (
    "You are a research assistant building a structured dataset of large data centers "
    "and AI infrastructure in Texas. Only include real, physical facilities "
    "(existing, under construction, or firmly announced). Exclude generic commentary, "
    "purely speculative ideas, and vague 'plans' with no specific site. "
    "Always respond with VALID JSON only, using this schema:\n"
    '{ \"projects\": [ { \"project_name\": \"...\", \"company\": \"...\", \"city\": \"...\", '
    '\"county\": \"...\", \"approx_mw\": 0, \"approx_sqft\": 0, \"status\": \"operational\", '
    '\"primary_source_url\": \"...\", \"announced_year\": 2024 } ] }'
)


def call_perplexity(prompt: str) -> Dict[str, Any]:
    """Call Perplexity API with a discovery prompt and return parsed JSON.

    If JSON parsing fails, dump the raw content to a debug file and return {}.
    """
    if not PERPLEXITY_API_KEY:
        raise RuntimeError("PRP (Perplexity API key) not set in .env.local")

    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_MESSAGE},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 800,
    }

    resp = requests.post(PERPLEXITY_URL, headers=headers, json=payload, timeout=45)
    resp.raise_for_status()
    data = resp.json()
    content = data["choices"][0]["message"]["content"]

    # Try to parse as JSON; if it fails, try to extract JSON substring,
    # and if that still fails, write raw content to disk for inspection.
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(content[start : end + 1])
            except json.JSONDecodeError:
                pass

        # Fallback: write raw content so we can inspect what Perplexity sent
        debug_dir = BASE_DIR / "data" / "analysis" / "perplexity_raw"
        debug_dir.mkdir(parents=True, exist_ok=True)
        idx = len(list(debug_dir.glob("response_*.txt"))) + 1
        debug_path = debug_dir / f"response_{idx}.txt"
        with open(debug_path, "w") as f:
            f.write(content)
        print(f"  ⚠️ Saved unparsable Perplexity response to {debug_path}")
        return {}


def load_existing_projects() -> List[Dict[str, Any]]:
    """Load existing Texas projects from the DB for de-duplication."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        """
        SELECT project_name, company, location_text, announced_date
        FROM projects
        WHERE lat BETWEEN 25 AND 37 AND lng BETWEEN -107 AND -93
        """
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def is_duplicate(seed: Dict[str, Any], existing: List[Dict[str, Any]]) -> bool:
    """Crude duplicate check: company + (city/county) + rough year vs existing."""
    s_company = (seed.get("company") or "").lower().strip()
    s_city = (seed.get("city") or "").lower().strip()
    s_county = (seed.get("county") or "").lower().strip()
    s_year = seed.get("announced_year")

    for row in existing:
        r_company = (row.get("company") or "").lower().strip()
        r_loc = (row.get("location_text") or "").lower()

        if s_company and r_company and s_company != r_company:
            continue

        # crude location match: city or county substring match in location_text
        city_match = s_city and s_city in r_loc
        county_match = s_county and s_county in r_loc
        if not (city_match or county_match):
            continue

        # loose year check
        if not s_year or not row.get("announced_date"):
            return True
        try:
            r_year = int(str(row["announced_date"])[:4])
            if abs(r_year - int(s_year)) <= 2:
                return True
        except Exception:
            return True

    return False


def main() -> None:
    if not PERPLEXITY_API_KEY:
        raise RuntimeError("PRP (Perplexity API key) not set in .env.local")

    if not DB_PATH.exists():
        raise FileNotFoundError(f"Database not found at {DB_PATH}")

    existing = load_existing_projects()
    all_seeds: List[Dict[str, Any]] = []

    for i, prompt in enumerate(DISCOVERY_PROMPTS, 1):
        print(f"[{i}/{len(DISCOVERY_PROMPTS)}] Calling Perplexity…")
        try:
            result = call_perplexity(prompt)
        except Exception as e:
            print(f"  ⚠️ Perplexity error: {e}")
            continue

        # Handle both dict with "projects" key and direct list
        if isinstance(result, list):
            projects = result
        elif isinstance(result, dict):
            projects = result.get("projects") or []
        else:
            projects = []
        
        print(f"  Got {len(projects)} candidates")
        for p in projects:
            if not isinstance(p, dict):
                continue
            if is_duplicate(p, existing):
                continue
            p["source_prompt"] = f"discovery_{i}"
            all_seeds.append(p)

    # De-dup seeds themselves (by company+city+project_name)
    seen = set()
    unique_seeds: List[Dict[str, Any]] = []
    for p in all_seeds:
        key = (
            (p.get("company") or "").lower().strip(),
            (p.get("city") or "").lower().strip(),
            (p.get("project_name") or "").lower().strip(),
        )
        if key in seen:
            continue
        seen.add(key)
        unique_seeds.append(p)

    SEEDS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(SEEDS_PATH, "w") as f:
        json.dump({"seeds": unique_seeds}, f, indent=2)

    print(f"✅ Saved {len(unique_seeds)} non-duplicate seed projects to {SEEDS_PATH}")


if __name__ == "__main__":
    main()


