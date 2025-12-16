# Archived Oklahoma Data Files

This directory contains Oklahoma-specific data files that were archived during the Columbus, Ohio metro area migration.

**Migration Date:** January 2025  
**Reason:** Application reconfigured to focus on Columbus, OH (AEP Ohio) instead of Oklahoma

## Directory Structure

### `okc_campuses/`
Contains GeoJSON route files connecting Oklahoma infrastructure sites:
- Routes between Pryor, Stillwater, Tulsa, OKC, and other infrastructure sites
- Routes to GRDA power facilities (Pensacola Dam, Robert S. Kerr Dam, etc.)
- Routes to OG&E power plants
- Total: 31 route files

### `pipelines/`
Contains pipeline data for Oklahoma infrastructure markers:
- 5-mile radius pipeline data around each marker location
- Files for Pryor, Stillwater, Tulsa, OG&E substations, GRDA facilities
- Total: 16 pipeline JSON files

### `oge/`
Oklahoma Gas & Electric (OG&E) power generation facility data:
- `firecrawl_capacity_data.json` - Generating unit capacity and location data

### `grda/`
Grand River Dam Authority (GRDA) power generation facility data:
- `firecrawl_capacity_data.json` - Generating unit capacity and location data

### `osm/`
Oklahoma OSM cache files:
- `ok_data_center_google_pryor_ok.json` - OSM data for Pryor Google data center area
- `ok_data_center_google_stillwater_ok.json` - OSM data for Stillwater Google data center area
- `ok_pipeline_expanded_google_pryor_ok.json` - Expanded pipeline data for Pryor area
- `ok_pipeline_expanded_google_stillwater_ok.json` - Expanded pipeline data for Stillwater area

## Restoration

If you need to restore these files for testing or reference:
1. Copy files back to their original locations in `public/data/`
2. Update component code to re-enable Oklahoma-specific features
3. See `docs/COLUMBUS_MIGRATION_PLAN.md` for details on what was changed

## Related Code Changes

The following components were updated to remove Oklahoma-specific functionality:
- `src/components/Map/components/Cards/OSMCall.jsx`
- `src/components/Map/components/Cards/FirecrawlCall.jsx`
- `src/components/Map/components/InfrastructureFlowAnimation.jsx`
- `src/components/Map/components/InfrastructureSitingPathAnimation.jsx`

See git history for full details of code changes.

