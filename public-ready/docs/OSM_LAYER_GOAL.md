# OSM Layer Goal - Columbus/AEP Ohio

## Goal: Interconnection Request Analysis

The OSM layers for Columbus are designed to support **AEP Ohio interconnection request analysis** to test the hypothesis of data center speculation.

### Primary Objectives:

1. **Plot 90 sites where 30 GW was requested**
   - 50 customers at 90 sites
   - Show clustering around substations (<5 miles)

2. **Overlay: Sites that survived vs disappeared**
   - Sites that survived the tariff: 13 GW
   - Sites that disappeared: 17 GW

3. **Land transactions 2023-2024 near substations**
   - Use county assessor records
   - Filter for: industrial zoning, proximity to substations (<5 miles)
   - Show price premiums vs comparable parcels further from grid

4. **Transmission infrastructure: planned vs built**
   - Map existing substations in AEP Ohio territory
   - Overlay: where AEP planned upgrades (from PJM filings)
   - Show which upgrades proceeded vs stalled after tariff

5. **Multiple requests on same parcels (flipping behavior)**
   - Show sites with 2+ interconnection requests from different developers
   - Prove speculative "flipping" behavior

### Hypothesis to Test:

**If this was speculation, we should see:**
- ✅ Dense clustering of requests within 5 miles of major substations
- ✅ Land transaction spike 2023-2024 in those same corridors
- ✅ Price premiums for parcels near substations vs away
- ✅ After tariff: requests disappear, land sits idle, no construction activity

---

## Current Implementation

### Data Files Available:

1. **`public/osm/aep_ohio_substations.json`**
   - 20,249 substations in AEP Ohio territory
   - Includes voltage levels, coordinates, metadata
   - Used for: Clustering analysis, proximity calculations

2. **`public/osm/aep_ohio_transmission_lines.json`**
   - Transmission line segments
   - Used for: Infrastructure visualization, planned vs built comparison

3. **`public/osm/aep_ohio_substation_clusters.json`**
   - Clustered substations (DBSCAN-like algorithm)
   - 5-mile radius buffers around cluster centroids
   - Used for: Identifying high-density areas for interconnection requests

### OSM Button Functionality:

**When clicked for Columbus (default location):**

1. **Loads AEP Ohio Infrastructure:**
   - Substations (yellow/amber circles)
   - Transmission lines (blue lines)
   - Both layers added to map with proper z-ordering

2. **Console Logging:**
   - `🗺️ OSM Button Clicked` - Initial click event
   - `🗺️ OSM: Loading AEP Ohio substations...` - Data loading
   - `🗺️ OSM: Loaded X substations` - Success confirmation
   - `✅ OSM: AEP Ohio infrastructure layers added to map` - Completion

3. **Map Layers Created:**
   - `aep-ohio-substations-points` - Circle layer for substations
   - `aep-ohio-transmission-lines` - Line layer for transmission

4. **Legend Integration:**
   - Emits `osm:geographicContext` event
   - Legend can display substation/transmission counts

---

## Next Steps (Future Enhancements):

1. **Add Interconnection Request Data:**
   - Load `interconnection_requests.json` (when available)
   - Plot 90 sites on map
   - Color-code: survived (green) vs disappeared (red)

2. **Add Land Transaction Data:**
   - Load `land_transactions.json` (when available)
   - Show parcels that changed hands 2023-2024
   - Highlight price premiums near substations

3. **Add Clustering Visualization:**
   - Load `aep_ohio_substation_clusters.json`
   - Show 5-mile radius buffers around cluster centroids
   - Highlight high-density areas

4. **Add Transmission Analysis:**
   - Compare existing vs planned infrastructure
   - Show stalled projects (from PJM filings)

5. **Add Flipping Detection:**
   - Identify parcels with multiple requests
   - Visualize timeline of requests

---

## Testing Checklist:

- [ ] OSM button is enabled for Columbus
- [ ] Clicking button loads substations (check console logs)
- [ ] Substations appear on map (yellow circles)
- [ ] Transmission lines appear on map (blue lines)
- [ ] No console errors
- [ ] Legend shows substation/transmission counts
- [ ] Layers are toggleable in legend (if implemented)

---

## Console Log Reference:

When OSM button is clicked, you should see:
```
🗺️ OSM Button Clicked: { disabled: false, activeSite: null, locationKey: 'default', ... }
🗺️ OSM: No activeSite, checking location config: { locationKey: 'default', hasConfig: true, ... }
🗺️ OSM: Loading AEP Ohio infrastructure for Columbus
🗺️ OSM: Starting AEP Ohio infrastructure load...
🗺️ OSM: Loading AEP Ohio substations...
🗺️ OSM: Loaded 20249 substations
🗺️ OSM: Loading AEP Ohio transmission lines...
🗺️ OSM: Loaded X transmission line segments
✅ OSM: AEP Ohio infrastructure layers added to map
```


