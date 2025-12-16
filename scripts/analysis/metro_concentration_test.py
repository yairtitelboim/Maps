#!/usr/bin/env python3
"""
Metro Concentration Test for Texas Data Centers

Implements the full set of queries described in the instructions:
  1. Verify total DC count from texas_data_centers.geojson
  2. Group DCs by county
  3. Count DCs in each major metro (DFW, Austin, Houston, San Antonio)
  4. Identify non-metro counties with DCs
  5. Test different metro groupings
  6. Reconcile 71 vs 120 discrepancy using the news pipeline DB (if present)
  7. Compute concentration metrics (50/75/80% thresholds and 80/20 rule)
"""

import json
from pathlib import Path
from collections import Counter

try:
  from shapely.geometry import Point, shape
  HAVE_SHAPELY = True
except ImportError:
  HAVE_SHAPELY = False


def load_texas_data_centers(base_path: Path):
  path = base_path / "public/data/texas_data_centers.geojson"
  if not path.exists():
    raise FileNotFoundError(f"texas_data_centers.geojson not found at {path}")
  with path.open("r") as f:
    return json.load(f)


def load_ercot_county_polygons(base_path: Path):
  """
  Load ERCOT county polygons and build a mapping:
    county_name -> shapely shape(geometry)

  Falls back between aggregated_fixed and aggregated if needed.
  """
  if not HAVE_SHAPELY:
    print("⚠️  shapely not installed - cannot run point-in-polygon county assignment.")
    return {}

  geo_path = base_path / "public/data/ercot/ercot_counties_aggregated_fixed.geojson"
  if not geo_path.exists():
    geo_path = base_path / "public/data/ercot/ercot_counties_aggregated.geojson"

  if not geo_path.exists():
    print(f"⚠️  ERCOT counties GeoJSON not found at {geo_path}, skipping county assignment.")
    return {}

  with geo_path.open("r") as f:
    geojson = json.load(f)

  county_polygons = {}
  for feature in geojson.get("features", []):
    props = feature.get("properties", {}) or {}
    county_name = props.get("NAME", "").strip()
    geom = feature.get("geometry")
    if not county_name or not geom:
      continue
    try:
      county_polygons[county_name] = shape(geom)
    except Exception:
      # Skip invalid geometries
      continue

  print(f"Loaded {len(county_polygons)} county polygons from {geo_path.name}")
  return county_polygons


def step1_verify_total_dcs(data):
  print("=" * 80)
  print("STEP 1: VERIFY YOUR DATA COUNT")
  print("=" * 80)
  print()

  features = data.get("features", [])
  total_dcs = len(features)
  print(f"Total DCs in dataset: {total_dcs}")
  print()

  # List all projects
  for i, feature in enumerate(features, 1):
    props = feature.get("properties", {}) or {}
    name = props.get("project_name", "Unknown")
    location = props.get("location", "Unknown")
    print(f"{i}. {name} - {location}")

  print()
  return total_dcs


def step2_count_by_county(data, county_polygons):
  print("=" * 80)
  print("STEP 2: COUNT DCS BY COUNTY")
  print("=" * 80)
  print()

  county_counts = Counter()

  if not HAVE_SHAPELY or not county_polygons:
    print("⚠️  shapely or county polygons missing - falling back to TEXT-based parsing (less reliable).")

  for feature in data.get("features", []):
    geom = feature.get("geometry") or {}
    coords = geom.get("coordinates") or []

    assigned_county = None

    # Preferred: point-in-polygon using coordinates
    if HAVE_SHAPELY and county_polygons and isinstance(coords, (list, tuple)) and len(coords) == 2:
      try:
        pt = Point(coords[0], coords[1])
        for cname, poly in county_polygons.items():
          try:
            if poly.contains(pt):
              assigned_county = cname
              break
          except Exception:
            continue
      except Exception:
        assigned_county = None

    # Fallback: extremely rough text-based parse if PIP failed
    if not assigned_county:
      props = feature.get("properties", {}) or {}
      location = props.get("location", "") or ""
      county = ""
      if "County" in location:
        before = location.split("County")[0]
        county = before.strip().split(",")[-1].strip()
      else:
        if "," in location:
          county = location.split(",")[-1].strip()
        else:
          county = location.strip()
      if county:
        assigned_county = county

    if assigned_county:
      county_counts[assigned_county] += 1

  print("Top 20 counties by DC count (after PIP county assignment):")
  for county, count in county_counts.most_common(20):
    print(f"{county}: {count} DCs")

  print(f"\nTotal unique counties: {len(county_counts)}")
  print()

  return county_counts


def step3_metro_counts(county_counts, total_dcs):
  print("=" * 80)
  print("STEP 3: METRO AREA COUNTS")
  print("=" * 80)
  print()

  METRO_DEFINITIONS = {
    "DFW": ["Dallas", "Tarrant", "Collin", "Denton", "Ellis", "Rockwall", "Kaufman", "Johnson"],
    "Austin": ["Travis", "Williamson", "Hays", "Bastrop", "Caldwell"],
    "Houston": ["Harris", "Fort Bend", "Montgomery", "Brazoria", "Galveston", "Liberty", "Chambers", "Waller"],
    "San Antonio": ["Bexar", "Guadalupe", "Comal", "Wilson", "Medina"],
  }

  metro_counts = {}

  for metro_name, counties in METRO_DEFINITIONS.items():
    count = sum(county_counts.get(county, 0) for county in counties)
    metro_counts[metro_name] = count

    print(f"{metro_name} Metro:")
    for county in counties:
      dc_count = county_counts.get(county, 0)
      if dc_count > 0:
        print(f"  {county}: {dc_count} DCs")
    print(f"  Total: {count} DCs")
    print()

  top4_total = sum(metro_counts.values())
  rest = total_dcs - top4_total
  pct_in_metros = (top4_total / total_dcs * 100) if total_dcs > 0 else 0

  print("=" * 50)
  print(f"Top 4 metros: {top4_total} DCs ({pct_in_metros:.1f}%)")
  print(f"Rest of state: {rest} DCs ({100 - pct_in_metros:.1f}%)")
  print("=" * 50)
  print()

  return metro_counts


def step4_non_metro(county_counts, metro_counts):
  print("=" * 80)
  print("STEP 4: NON-METRO COUNTIES WITH DCS")
  print("=" * 80)
  print()

  METRO_DEFINITIONS = {
    "DFW": ["Dallas", "Tarrant", "Collin", "Denton", "Ellis", "Rockwall", "Kaufman", "Johnson"],
    "Austin": ["Travis", "Williamson", "Hays", "Bastrop", "Caldwell"],
    "Houston": ["Harris", "Fort Bend", "Montgomery", "Brazoria", "Galveston", "Liberty", "Chambers", "Waller"],
    "San Antonio": ["Bexar", "Guadalupe", "Comal", "Wilson", "Medina"],
  }

  all_metro_counties = set()
  for counties in METRO_DEFINITIONS.values():
    all_metro_counties.update(counties)

  non_metro_dcs = {}
  for county, count in county_counts.items():
    if county not in all_metro_counties and count > 0:
      non_metro_dcs[county] = count

  print("Non-metro counties with DCs:")
  for county, count in sorted(non_metro_dcs.items(), key=lambda x: x[1], reverse=True):
    print(f"  {county}: {count} DCs")

  total_non_metro = sum(non_metro_dcs.values())
  print(f"\nTotal non-metro DCs: {total_non_metro}")
  print(f"Non-metro counties with DCs: {len(non_metro_dcs)}")
  print()


def step5_grouping_tests(county_counts, metro_counts, total_dcs):
  print("=" * 80)
  print("STEP 5: METRO GROUPING TESTS")
  print("=" * 80)
  print()

  # Test 1: Top 3 MSAs only (DFW, Houston, San Antonio)
  top3_msa = metro_counts.get("DFW", 0) + metro_counts.get("Houston", 0) + metro_counts.get("San Antonio", 0)
  top3_pct = (top3_msa / total_dcs * 100) if total_dcs > 0 else 0
  print(f"Top 3 MSAs (DFW, Houston, SA): {top3_msa} DCs ({top3_pct:.1f}%)")

  # Test 2: Include Austin as separate metro
  top4_msa = top3_msa + metro_counts.get("Austin", 0)
  top4_pct = (top4_msa / total_dcs * 100) if total_dcs > 0 else 0
  print(f"Top 4 MSAs (+ Austin): {top4_msa} DCs ({top4_pct:.1f}%)")

  # Test 3: Just the 3 core counties
  core_counties = ["Dallas", "Harris", "Bexar", "Travis"]
  core_count = sum(county_counts.get(c, 0) for c in core_counties)
  core_pct = (core_count / total_dcs * 100) if total_dcs > 0 else 0
  print(f"4 core metro counties: {core_count} DCs ({core_pct:.1f}%)")

  # Test 4: Top 10 counties (regardless of metro)
  sorted_counties = county_counts.most_common()
  top10_counties = sorted_counties[:10]
  top10_count = sum(count for _, count in top10_counties)
  top10_pct = (top10_count / total_dcs * 100) if total_dcs > 0 else 0
  print(f"Top 10 counties: {top10_count} DCs ({top10_pct:.1f}%)")
  print("Top 10 counties:")
  for county, count in top10_counties:
    print(f"  {county}: {count}")
  print()


def step6_reconcile_pipeline(base_path: Path):
  print("=" * 80)
  print("STEP 6: NEWS PIPELINE RECONCILIATION (IF AVAILABLE)")
  print("=" * 80)
  print()

  db_path = base_path / "data/news/news_pipeline.db"
  if not db_path.exists():
    print(f"news_pipeline.db not found at {db_path}, skipping pipeline reconciliation.")
    print()
    return

  try:
    import sqlite3
  except ImportError:
    print("sqlite3 not available in this environment, skipping pipeline reconciliation.")
    print()
    return

  conn = sqlite3.connect(str(db_path))
  cursor = conn.cursor()

  # Count total projects
  cursor.execute("SELECT COUNT(*) FROM projects")
  total_projects = cursor.fetchone()[0]
  print(f"Total projects in pipeline: {total_projects}")

  # Count projects with coordinates
  cursor.execute("SELECT COUNT(*) FROM projects WHERE lat IS NOT NULL AND lng IS NOT NULL")
  geocoded_projects = cursor.fetchone()[0]
  print(f"Projects with coordinates: {geocoded_projects}")

  # Count by status
  cursor.execute(
    """
    SELECT ps.status_current, COUNT(*) 
    FROM projects p
    LEFT JOIN project_status ps ON p.project_id = ps.project_id
    GROUP BY ps.status_current
    """
  )
  status_counts = cursor.fetchall()
  print("\nProjects by status:")
  for status, count in status_counts:
    label = status if status is not None else "Unknown"
    print(f"  {label}: {count}")

  conn.close()
  print()


def step7_concentration_metrics(county_counts, total_dcs):
  print("=" * 80)
  print("STEP 7: CONCENTRATION METRICS (50/75/80% + 80/20 TEST)")
  print("=" * 80)
  print()

  sorted_counties = county_counts.most_common()

  cumulative_dcs = 0
  fifty_reported = False

  for i, (county, count) in enumerate(sorted_counties, 1):
    cumulative_dcs += count
    pct = (cumulative_dcs / total_dcs * 100) if total_dcs > 0 else 0

    if not fifty_reported and pct >= 50:
      print(f"50% of DCs in top {i} counties ({cumulative_dcs} DCs)")
      fifty_reported = True
    if pct >= 75:
      print(f"75% of DCs in top {i} counties ({cumulative_dcs} DCs)")
      break
    if pct >= 80:
      print(f"80% of DCs in top {i} counties ({cumulative_dcs} DCs)")
      break

  # 80/20 rule test
  n_counties = len(sorted_counties)
  top20_n = max(1, int(n_counties * 0.2)) if n_counties > 0 else 0
  top20_total = sum(c for _, c in sorted_counties[:top20_n]) if top20_n > 0 else 0

  print("\n80/20 rule test:")
  print(f"Top {top20_n} counties (20% of {n_counties}): {top20_total} DCs")
  print()


def main():
  base_path = Path(__file__).parent.parent.parent
  data = load_texas_data_centers(base_path)
  county_polygons = load_ercot_county_polygons(base_path)

  # Step 1: Verify DC count and list
  total_dcs = step1_verify_total_dcs(data)

  # Step 2: Count by county
  county_counts = step2_count_by_county(data, county_polygons)

  # Step 3: Metro counts
  metro_counts = step3_metro_counts(county_counts, total_dcs)

  # Step 4: Non-metro counties
  step4_non_metro(county_counts, metro_counts)

  # Step 5: Grouping tests
  step5_grouping_tests(county_counts, metro_counts, total_dcs)

  # Step 6: Pipeline reconciliation (if DB exists)
  step6_reconcile_pipeline(base_path)

  # Step 7: Concentration metrics
  step7_concentration_metrics(county_counts, total_dcs)


if __name__ == "__main__":
  main()


