# Quick Start: Download Remaining Buildings

## Simple Commands

### Download All Remaining Buildings
```bash
# From project root
python3 scripts/osm-tools/download_remaining_buildings.py

# Or use the shell script
./download_remaining_buildings.sh
```

### Test with a Few Tracts First
```bash
# Download only 10 remaining tracts (for testing)
python3 scripts/osm-tools/download_remaining_buildings.py --limit 10

# Or
./download_remaining_buildings.sh 10
```

### Resume from Specific Tract
```bash
# Start from a specific GEOID
python3 scripts/osm-tools/download_remaining_buildings.py --start-from 40143006703
```

## Check Progress

```bash
# See current status
python3 scripts/osm-tools/check_buildings_progress.py
```

## What It Does

1. **Checks what's already done** - Reads the index file to see processed tracts
2. **Finds remaining tracts** - Compares with all tracts to find what's missing
3. **Downloads buildings** - Only processes the missing tracts
4. **Updates index incrementally** - Saves progress after each tract
5. **Can be interrupted** - Press Ctrl+C anytime, progress is saved

## Features

- ✅ **Resumable** - Can stop and restart anytime
- ✅ **Incremental** - Updates index after each tract
- ✅ **Safe** - Uses atomic file operations (write to .tmp, then rename)
- ✅ **Progress tracking** - Shows real-time progress
- ✅ **Error handling** - Continues even if individual tracts fail

## Example Output

```
================================================================================
🏗️  OKC CENSUS TRACT BUILDINGS - DOWNLOAD REMAINING
================================================================================
📊 Analyzing current progress...
   Total tracts: 1205
   Already processed: 1198
   Remaining: 7
   Progress: 99.4%

🔍 Processing 7 remaining tracts...

[1/7] Processing tract 40027200700 (2007)...
  ✅ Found 49 buildings (Total: 49)

[2/7] Processing tract 40027200800 (2008)...
  ✅ Found 32 buildings (Total: 81)
...
```

## Tips

- **Run overnight** - Processing all remaining tracts can take time
- **Check progress** - Use `check_buildings_progress.py` to monitor
- **Interrupt safely** - Press Ctrl+C anytime, progress is saved
- **Resume later** - Just run the script again to continue

