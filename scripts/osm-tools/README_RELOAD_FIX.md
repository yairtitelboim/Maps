# Fix for App Reloading Every 5 Seconds

## Problem
The development server's file watcher detects new building files being created in `public/neighborhood_buildings/` and triggers hot module reloads every time a new file is written.

## Solution

### Option 1: Restart Dev Server (Recommended)
1. Stop your dev server (Ctrl+C)
2. Restart it - the `.env` file changes should now ignore the building files directory
3. The building download can continue in the background

### Option 2: Temporarily Pause Building Download
If the reloads are too disruptive, you can temporarily pause the building download:

```bash
# Find and stop the process
ps aux | grep okc_tract_buildings_osm.py
kill <PID>

# Resume later
python3 scripts/osm-tools/okc_tract_buildings_osm.py
```

### Option 3: Move Building Files to Different Location
If the env vars don't work, you can modify the script to write to a different location temporarily, then move files after download completes.

## Current Status
- Added `WATCHPACK_POLLING=false` to `.env` to disable polling
- Added `CHOKIDAR_IGNORED=/neighborhood_buildings/**` to ignore that directory

**Note:** You need to restart the dev server for these changes to take effect.

