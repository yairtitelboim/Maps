# Perplexity API Production Script - Ready for Use

## ✅ Manual Review Complete

### Projects Reviewed (3 with >100km differences)

1. **Calpine - "Texas"**
   - **Current:** (32.962478, -96.826477) - Dallas area
   - **Perplexity:** (31.859400, -97.358600) - Bosque County
   - **Article mentions:** Bosque County, Texas
   - **Decision:** ✅ **Perplexity is CORRECT**
   - **Action:** ✅ Updated to Perplexity coordinates

2. **Vantage - "Texas"**
   - **Current:** (29.400294, -98.472914) - San Antonio area
   - **Perplexity:** (32.487500, -99.733300) - Shackelford County
   - **Article mentions:** Shackelford County, Texas (near Abilene)
   - **Decision:** ✅ **Perplexity is CORRECT**
   - **Action:** ✅ Updated to Perplexity coordinates

3. **None - "and Beyond"**
   - **Current:** (29.868835, -95.424841) - Houston area
   - **Perplexity:** (27.506748, -99.502914) - Near Laredo
   - **Article mentions:** Multiple locations (Laredo, Amarillo, Austin)
   - **Decision:** ⚠️ **General article about multiple projects**
   - **Action:** ⚠️ Kept current coordinates (needs manual review)

## 📁 Production Script Created

### `improve_locations_with_perplexity.py`

A production-ready script with comprehensive validation logic.

### Features

1. **Smart Project Selection**
   - Prioritizes projects with vague `location_text` ("Texas", "None", "ew", etc.)
   - Targets projects with low confidence (`area`, `county`)
   - Processes in priority order

2. **Perplexity API Integration**
   - Extracts coordinates from article text
   - Handles API errors gracefully
   - Fetches article text from URLs if needed

3. **Validation Logic**
   - Validates coordinates are within Texas bounds
   - Calculates distance between current and Perplexity coordinates
   - Makes intelligent update decisions based on:
     - Distance thresholds
     - Current confidence level
     - Location specificity

4. **Update Decision Logic**

   | Distance | Current Confidence | Action |
   |----------|-------------------|--------|
   | < 5km | Any | No update (already accurate) |
   | 5-20km | `area`/`county` | Update if Perplexity is more specific |
   | 20-50km | `area`/`county` | Update if Perplexity is more specific |
   | 50-100km | Any | Flag for manual review |
   | > 100km | Any | Flag for manual review |

5. **Safety Features**
   - **Dry run mode by default** - No database updates unless `--update` flag is used
   - Flags large differences for manual review
   - Comprehensive logging and error handling
   - Saves results to JSON file

6. **Rate Limiting**
   - 1 second delay between API calls
   - Prevents API rate limit issues

### Usage

```bash
# Dry run (test without updating database)
python3 scripts/news-output/improve_locations_with_perplexity.py --limit 10

# Actually update database
python3 scripts/news-output/improve_locations_with_perplexity.py --limit 10 --update

# Process all projects quietly
python3 scripts/news-output/improve_locations_with_perplexity.py --quiet --update

# Process specific number of projects
python3 scripts/news-output/improve_locations_with_perplexity.py --limit 25 --update
```

### Output

- **Console:** Detailed progress and decisions for each project
- **JSON File:** `scripts/news-output/perplexity_improvement_results.json`
  - Contains all results, decisions, and statistics
  - Useful for analysis and auditing

### Example Output

```
🔍 PROCESSING 3 PROJECTS WITH PERPLEXITY
================================================================================

[1/3] Microsoft - Microsoft Texas
  Current: (32.882063, -97.272441) - area
  Location text: Texas
  🔄 Calling Perplexity API...
  ✅ Perplexity: (32.910800, -96.968100)
  📏 Distance: 28.59km
  💡 Decision: Current confidence is low (area), Perplexity provides better location (28.59km difference)
  ✅ Updated database

📊 SUMMARY:
================================================================================
Total projects: 3
Processed: 3
Successful extractions: 3
Updated: 2
Flagged for review: 1
Failed: 0
Skipped: 0
```

## 🎯 Recommended Workflow

1. **Initial Test Run**
   ```bash
   python3 scripts/news-output/improve_locations_with_perplexity.py --limit 10
   ```
   - Review results
   - Check flagged projects
   - Verify update decisions

2. **Small Batch Update**
   ```bash
   python3 scripts/news-output/improve_locations_with_perplexity.py --limit 25 --update
   ```
   - Process a small batch
   - Monitor results
   - Verify database updates

3. **Full Production Run**
   ```bash
   python3 scripts/news-output/improve_locations_with_perplexity.py --update
   ```
   - Process all eligible projects
   - Review flagged projects manually
   - Export updated GeoJSON

4. **Export Updated Data**
   ```bash
   python3 scripts/news-output/export_projects_geojson.py
   ```

## 📊 Expected Results

Based on validation testing:
- **Success rate:** ~87.5% (when article text is available)
- **High accuracy (<5km):** ~21% of successful extractions
- **Moderate accuracy (5-20km):** ~14% of successful extractions
- **Significant differences (>20km):** ~71% of successful extractions
  - Most will be flagged for manual review if >50km
  - Some will be updated if current confidence is low

## ⚠️ Important Notes

1. **Cost Considerations**
   - Perplexity API costs ~$0.001-0.01 per query
   - Use selectively for projects that need improvement
   - Monitor API usage

2. **Rate Limits**
   - Script includes 1-second delay between calls
   - Adjust if needed based on API limits

3. **Manual Review**
   - Projects with >50km differences are flagged
   - Review these before updating
   - Use `review_large_differences.py` for detailed analysis

4. **Backup Database**
   - Always backup database before running with `--update`
   - Review results JSON before committing changes

## 🔄 Integration with Existing Workflow

The script can be integrated into the existing geocoding workflow:

1. **After `extract_locations_from_articles.py`**
   - Run Perplexity improvement on projects with vague locations
   - Catch cases where traditional geocoding failed

2. **After `check_coordinate_accuracy.py`**
   - Use Perplexity to improve "no reference" projects
   - Validate questionable coordinates

3. **Periodic Maintenance**
   - Run monthly to catch new projects with vague locations
   - Keep coordinate accuracy high

## 📁 Related Files

- `test_perplexity_extraction.py` - Test script for API connectivity
- `review_large_differences.py` - Manual review script
- `PERPLEXITY_LOCATION_PLAN.md` - Integration strategy
- `PERPLEXITY_VALIDATION_REPORT.md` - Validation test results
- `PERPLEXITY_TEST_SUMMARY.md` - Initial testing summary

## ✅ Status: Production Ready

The script has been tested and validated. It's ready for production use with appropriate caution:
- ✅ Dry run mode by default
- ✅ Comprehensive validation logic
- ✅ Error handling and logging
- ✅ Manual review flags
- ✅ Results saved to JSON

Proceed with small batches first, then scale up based on results.

