# Backfill Enhanced Extraction - Usage Guide

**Date:** 2025-12-12  
**Script:** `backfill_enhanced_extraction.py`  
**Purpose:** Apply Phase 1 enhanced extraction logic to all existing projects

---

## 📋 Overview

This script re-extracts project names from all existing project cards using the enhanced extraction logic and updates both the `project_cards` and `projects` tables.

### What It Does

1. **Re-extracts project names** from all existing `project_cards` using enhanced patterns
2. **Updates `project_cards` table** with new project names, companies, and locations
3. **Updates `projects` table** by aggregating the best data from updated project_cards
4. **Re-exports GeoJSON** file for frontend consumption

---

## 🚀 Usage

### Dry Run (Recommended First)

Test the script without making any changes:

```bash
python scripts/news-process/backfill_enhanced_extraction.py --dry-run
```

### Full Backfill

Run the actual backfill:

```bash
python scripts/news-process/backfill_enhanced_extraction.py
```

### Options

```bash
# Skip updating projects table (only update project_cards)
python scripts/news-process/backfill_enhanced_extraction.py --skip-projects

# Skip GeoJSON export (update database only)
python scripts/news-process/backfill_enhanced_extraction.py --skip-export

# Custom database path
python scripts/news-process/backfill_enhanced_extraction.py --db /path/to/database.db

# Combine options
python scripts/news-process/backfill_enhanced_extraction.py --dry-run --skip-export
```

---

## 📊 Expected Results

Based on test results:

- **Total project_cards:** ~101
- **Updated:** ~93 (92%)
- **Improved (Unknown → Named):** ~57 (56%)
- **Unchanged:** ~8 (8%)

### Projected Impact

- **Before:** 38 "Unknown Project" (46% of 82 projects)
- **After:** ~16-17 "Unknown Project" (20% of 82 projects)
- **Reduction:** ~21-22 projects (57-58% improvement)

---

## ⚠️ Important Notes

### Before Running

1. **Backup the database** (recommended):
   ```bash
   cp data/news/news_pipeline.db data/news/news_pipeline.db.backup
   ```

2. **Test with dry-run first** to see what will change

3. **Check current state**:
   ```bash
   python scripts/news-process/test_enhanced_extraction.py
   ```

### After Running

1. **Verify results**:
   - Check the database for updated project names
   - Verify GeoJSON file is updated
   - Check the map to see improved project names

2. **Monitor for issues**:
   - Check for any unexpected changes
   - Verify project names are meaningful
   - Ensure no data loss occurred

---

## 🔍 What Gets Updated

### project_cards Table
- `project_name` - Enhanced extraction or fallback generation
- `company` - Improved extraction (if changed)
- `location_text` - Improved extraction (if changed)
- `extraction_confidence` - Updated based on filled fields

### projects Table
- Aggregated from all project_cards for each project
- Uses best/most recent data from cards
- Prefers non-null, non-"Unknown" values

### GeoJSON File
- Re-exported with updated project names
- Location: `public/data/texas_data_centers.geojson`

---

## 📈 Example Output

```
🔄 Starting backfill of enhanced extraction...
================================================================================
📊 Backfilling 101 project cards with enhanced extraction...
================================================================================
   Processed 50/101 cards (0.1s)...
   Processed 100/101 cards (0.1s)...

✅ Backfill complete in 0.08s
   Updated: 93
   Improved (Unknown → Named): 57
   Unchanged: 8

📊 Updating projects table from project_cards...
✅ Updated 92 projects in 0.00s

📤 Re-exporting GeoJSON...
✅ Exported 73 projects to GeoJSON

================================================================================
✅ Backfill complete!

📊 Summary:
   Total processed: 101
   Updated: 93
   Improved (Unknown → Named): 57
   Unchanged: 8
```

---

## 🐛 Troubleshooting

### Import Errors

If you get import errors for `export_projects_geojson`:
- The script will skip export and show a message
- Manually run: `python scripts/news-output/export_projects_geojson.py`

### Timeout Issues

The script has a 5-minute timeout. If it times out:
- It will save partial progress
- Re-run to continue from where it stopped

### Database Locked

If you get "database is locked" errors:
- Close any other processes using the database
- Wait a few seconds and retry

---

## ✅ Verification

After running, verify the results:

```bash
# Check how many projects still have "Unknown Project"
python3 -c "
import sqlite3
from pathlib import Path
db = Path('data/news/news_pipeline.db')
conn = sqlite3.connect(str(db))
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM projects WHERE project_name IS NULL OR project_name = \"Unknown Project\"')
count = cursor.fetchone()[0]
print(f'Projects with Unknown Project: {count}')
conn.close()
"

# Check GeoJSON file
python3 -c "
import json
with open('public/data/texas_data_centers.geojson') as f:
    data = json.load(f)
    unknown = sum(1 for f in data['features'] if f['properties'].get('project_name') == 'Unknown Project')
    print(f'GeoJSON features with Unknown Project: {unknown}')
"
```

---

## 🔄 Rollback

If you need to rollback:

1. **Restore database backup**:
   ```bash
   cp data/news/news_pipeline.db.backup data/news/news_pipeline.db
   ```

2. **Re-export GeoJSON**:
   ```bash
   python scripts/news-output/export_projects_geojson.py
   ```

---

## 📝 Next Steps

After successful backfill:

1. **Verify map display** - Check that project names appear correctly
2. **Monitor user feedback** - See if names are meaningful
3. **Consider Phase 2** - Company extraction improvements for additional gains
4. **Refine patterns** - Based on real-world results, adjust extraction patterns

---

## 🎯 Success Criteria

✅ **Quantitative:**
- Reduce "Unknown Project" from ~38 to <20
- 50%+ improvement rate
- No data loss

✅ **Qualitative:**
- Project names are meaningful
- Names include location when available
- Names are consistent across related articles

