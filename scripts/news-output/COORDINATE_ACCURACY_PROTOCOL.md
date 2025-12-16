# Coordinate Accuracy Check Protocol

## Overview

This protocol systematically checks all data center projects for coordinate accuracy by comparing their coordinates against expected city/county locations.

## Script

**File:** `scripts/news-output/check_coordinate_accuracy.py`

**Usage:**
```bash
python3 scripts/news-output/check_coordinate_accuracy.py
```

## How It Works

1. **Loads all projects** with coordinates from the database
2. **Extracts city/county** from location text
3. **Compares coordinates** against known city/county centers
4. **Categorizes issues:**
   - ❌ **Incorrect**: >20km from expected location
   - ⚠️ **Questionable**: 5-20km from expected (may be correct for specific addresses)
   - ❓ **No reference**: Can't verify (location doesn't match known cities)

## Results Categories

### ✅ Correct Coordinates
- Within 5km of expected city/county center
- Or matches specific address mentioned in article

### ⚠️ Questionable (5-20km)
- May be correct if article mentions specific address/road
- Check site_hint and article text for validation
- Example: "Lon Stephenson Road" in Fort Worth (13km from center) is correct

### ❌ Incorrect (>20km)
- Definitely wrong - needs manual correction
- Usually indicates geocoding error or wrong city match

## Current Status

From latest run:
- ✅ **Correct**: 2 projects
- ❌ **Incorrect**: 6 projects (needs fixing)
- ⚠️ **Questionable**: 6 projects (needs review)
- ❓ **No reference**: 59 projects (can't verify automatically)

## Known Issues Found

### Critical (Incorrect >20km)

1. **Jarrell Project** (`proj_2939ca7d3063`)
   - Current: (29.538411, -95.121910) - Houston area
   - Expected: (30.824900, -97.604500) - Jarrell, TX
   - Distance: **278.21 km** ❌
   - **Action**: Needs immediate fix

2. **Austin County Project** (`proj_2d0725b8705d`)
   - Current: (29.891649, -96.244347) - Wrong area
   - Expected: Austin County area
   - Distance: **150.13 km** ❌
   - **Action**: Needs fix

3. **Cedar Creek Project** (`proj_4f121e9109b0`)
   - Current: (30.217872, -97.667453)
   - Expected: (30.087200, -97.495000)
   - Distance: **22.05 km** ❌
   - **Action**: Needs review

4. **Grand Prairie/Ellis County** (`proj_a2cfea4a82ed`)
   - Current: (32.417524, -96.840287) - Waxahachie area
   - Expected: Grand Prairie or Ellis County
   - Distance: **39.38 km** ❌
   - **Action**: Needs fix

5. **Meta El Paso Projects** (2 projects)
   - Both >20km from El Paso center
   - Site hint: "Northeast El Paso" - may be correct for specific area
   - **Action**: Review with article context

### Questionable (5-20km)

These may be correct if they match specific addresses mentioned in articles:
- Fort Worth projects with "Stephenson Road" site hints
- Dallas project with "Reading Street" site hint
- Plano project (16.58km - may be in Plano suburbs)

## Protocol Steps

### 1. Run the Check
```bash
python3 scripts/news-output/check_coordinate_accuracy.py
```

### 2. Review Report
- Check `coordinate_accuracy_report.json` for full details
- Review "Incorrect" projects first (highest priority)
- Review "Questionable" projects with article context

### 3. Fix Incorrect Projects
For each incorrect project:
1. Check article text for specific address
2. Geocode the correct location
3. Update database coordinates
4. Update geocode_confidence if needed

### 4. Validate Questionable Projects
For questionable projects:
1. Check if site_hint matches coordinates
2. Verify article mentions specific address/road
3. If correct for specific location, mark as verified
4. If incorrect, fix coordinates

### 5. Re-run Check
After fixes, re-run to verify improvements

## Output Files

- **Console**: Summary of issues
- **JSON Report**: `scripts/news-output/coordinate_accuracy_report.json`
  - Full details of all issues
  - Can be used for batch fixing

## Integration with Location Extraction

This protocol complements `extract_locations_from_articles.py`:
- **Location extraction**: Improves coordinates using article text
- **Accuracy check**: Validates coordinates against location text
- **Together**: Ensures both precision and correctness

## Future Enhancements

1. **Automatic fixing**: Use article text to fix incorrect coordinates
2. **Address extraction**: Better address parsing for questionable cases
3. **City boundary checking**: Verify coordinates are within city limits
4. **Historical tracking**: Track coordinate changes over time

