# UI Testing Guide - Columbus Migration

## Quick Start

### 1. Start the Development Server

```bash
npm start
```

The app should open at `http://localhost:3000` (or the next available port).

### 2. Check Console for Errors

Open browser DevTools (F12) and check the Console tab for:
- ✅ No import errors
- ✅ No undefined variable errors
- ✅ No missing file errors (especially Oklahoma data files)
- ✅ No React component errors

---

## Phase 8: Testing Checklist

### 8.1 Map Initialization Testing ✅

**Test Cases:**
- [ ] **Map centers on Columbus on load**
  - Expected: Map should center on `[-82.9988, 39.9612]` (Columbus, OH)
  - Check: Map view should show Columbus metro area, not Oklahoma
  
- [ ] **Zoom level is appropriate for metro area**
  - Expected: Zoom level ~11 (metro area view)
  - Check: Should see Columbus city area, not too zoomed in/out

- [ ] **Map loads without errors**
  - Check: No red errors in console
  - Check: Map renders correctly with Mapbox style

- [ ] **Geographic config loads correctly**
  - Check: Console should show Columbus location config
  - Check: No references to Stillwater/Pryor in initial load

**How to Test:**
1. Open `http://localhost:3000`
2. Check browser console (F12 → Console)
3. Verify map center coordinates in console logs
4. Visually verify map shows Columbus area

---

### 8.2 OSM Button Testing ✅

**Test Cases:**
- [ ] **OSM button appears and is clickable**
  - Expected: OSM button visible in NestedCircleButton component
  - Check: Button should be clickable, no disabled state

- [ ] **OSM queries return Columbus-area data**
  - Expected: OSM queries should use Columbus coordinates
  - Check: Console logs should show Columbus lat/lng in queries
  - Check: No references to Oklahoma coordinates

- [ ] **No Oklahoma route files are loaded**
  - Expected: No errors about missing `/data/okc_campuses/*.geojson` files
  - Check: Console should not show 404 errors for Oklahoma files
  - Check: No references to `pryor_to_stillwater.geojson` etc.

- [ ] **OSM layers render correctly**
  - Expected: OSM data layers appear on map
  - Check: Buildings, roads, POIs should render
  - Check: No broken layer errors

- [ ] **No console errors related to missing files**
  - Check: No 404 errors for archived Oklahoma files
  - Check: No undefined marker array errors

**How to Test:**
1. Click the OSM button (blue circle in NestedCircleButton)
2. Watch console for OSM query logs
3. Verify map shows Columbus-area OSM data
4. Check for any 404 errors in Network tab

---

### 8.3 Location Selector Testing ✅

**Test Cases:**
- [ ] **Columbus appears in location dropdown**
  - Expected: "Columbus Metro Area" or "Columbus, OH" in dropdown
  - Check: Location selector should show Columbus option

- [ ] **Location selection works correctly**
  - Expected: Selecting Columbus updates map center
  - Check: Map should pan to Columbus when selected

- [ ] **Map updates when location changes**
  - Expected: Map center and zoom update
  - Check: Smooth transition to new location

- [ ] **Location theme applies correctly**
  - Expected: UI theme matches Columbus location
  - Check: Colors/styles update appropriately

**How to Test:**
1. Find location selector/dropdown in UI
2. Select Columbus from dropdown
3. Verify map updates to Columbus
4. Check console for location change logs

---

### 8.4 Tool Integration Testing ✅

**Test Cases:**
- [ ] **NestedCircleButton renders correctly**
  - Expected: All tool buttons visible (OSM, GeoAI, Perplexity, Firecrawl)
  - Check: No missing buttons, all clickable

- [ ] **OSM tool works**
  - Expected: OSM button triggers Columbus-area queries
  - Check: Data loads, markers appear, no errors

- [ ] **GeoAI tool works**
  - Expected: GeoAI queries use Columbus coordinates
  - Check: No Oklahoma-specific animations trigger
  - Check: No errors about missing animation refs

- [ ] **Perplexity tool works**
  - Expected: Perplexity queries work with Columbus context
  - Check: No GRDA marker loading errors
  - Check: No Pryor-to-GRDA route errors

- [ ] **Firecrawl tool works**
  - Expected: Firecrawl queries work
  - Check: No Oklahoma-specific layer toggles
  - Check: No errors about missing route layers

**How to Test:**
1. Click each tool button in NestedCircleButton
2. Verify each tool loads data correctly
3. Check console for errors
4. Verify no Oklahoma-specific features trigger

---

### 8.5 Legend Testing ✅

**Test Cases:**
- [ ] **Legend panel opens/closes**
  - Expected: Legend toggle button works
  - Check: Legend panel appears/disappears correctly

- [ ] **No Oklahoma sections appear**
  - Expected: No "Oklahoma Data Center Infrastructure" section
  - Expected: No GRDA/OG&E power generation sections
  - Check: Legend should not show Oklahoma-specific items

- [ ] **Columbus universities appear (if applicable)**
  - Expected: OSU, Columbus State, etc. in legend
  - Check: University layers should be Columbus-specific

- [ ] **Legend toggles work**
  - Expected: Toggling legend items shows/hides layers
  - Check: No errors when toggling items

**How to Test:**
1. Open legend panel
2. Verify no Oklahoma-specific sections
3. Toggle various legend items
4. Check console for errors

---

### 8.6 Animation Testing ✅

**Test Cases:**
- [ ] **No Oklahoma animations trigger**
  - Expected: No Stillwater circle animations
  - Expected: No Pryor-Stillwater route animations
  - Check: No errors about missing animation refs

- [ ] **Deck.gl animations work (if applicable)**
  - Expected: Infrastructure animations work with Columbus data
  - Check: No errors about missing route files

**How to Test:**
1. Trigger animations via tool buttons
2. Check console for animation errors
3. Verify animations use Columbus data

---

### 8.7 Error Handling Testing ✅

**Test Cases:**
- [ ] **No 404 errors for archived files**
  - Expected: No network errors for Oklahoma data files
  - Check: Network tab should not show 404s for:
    - `/data/okc_campuses/*.geojson`
    - `/data/pipelines/*.json`
    - `/data/grda/*.json`
    - `/data/oge/*.json`

- [ ] **No undefined variable errors**
  - Expected: No `isOkLocation is not defined` errors
  - Expected: No `window.okGRDAPowerMarkers` errors
  - Check: Console should be clean

- [ ] **Graceful degradation**
  - Expected: App works even if some features are disabled
  - Check: App doesn't crash when Oklahoma features are referenced

**How to Test:**
1. Open Network tab in DevTools
2. Filter for 404 errors
3. Verify no Oklahoma file requests
4. Check Console for undefined variable errors

---

## Common Issues & Fixes

### Issue: Map still shows Oklahoma
**Fix:** Check `src/config/geographicConfig.js` - ensure `default` is Columbus

### Issue: OSM button tries to load Oklahoma files
**Fix:** Check `src/components/Map/components/Cards/OSMCall.jsx` - verify Oklahoma functions are disabled

### Issue: Legend shows Oklahoma sections
**Fix:** Check `src/components/Map/legend/utils/buildLegendSections.js` - verify Oklahoma sections are archived

### Issue: Console errors about missing markers
**Fix:** Check `src/components/Map/components/Cards/LegendContainer.jsx` - verify marker array checks are disabled

---

## Automated Testing Commands

### Check for Oklahoma References
```bash
# Search for remaining Oklahoma references in source files
grep -r "stillwater\|pryor\|Oklahoma\|ok_data_center" src/ --include="*.js" --include="*.jsx" | grep -v "Archived\|archived\|TODO" | head -20
```

### Check for Import Errors
```bash
# Start dev server and check for build errors
npm start
# Watch console output for import/module errors
```

### Check for Missing Files
```bash
# Verify archived files are not being requested
# Open Network tab in DevTools and filter for 404 errors
```

---

## Success Criteria

✅ **Migration is successful if:**
1. Map loads and centers on Columbus
2. No console errors (except expected warnings)
3. All tool buttons work
4. No 404 errors for Oklahoma files
5. Legend shows Columbus-specific content (or no Oklahoma content)
6. OSM queries use Columbus coordinates
7. No undefined variable errors

---

## Next Steps After Testing

Once UI testing is complete:
1. **Phase 7:** Archive remaining Oklahoma scripts (optional)
2. **Phase 9:** Final cleanup and documentation
3. **Data Collection:** Run AEP Ohio preprocessing scripts (from Phase 2.5)
4. **Integration:** Add Columbus-specific data and features

---

## Testing Report Template

```markdown
## Testing Report - [Date]

### Map Initialization
- [ ] Map centers on Columbus
- [ ] Zoom level correct
- [ ] No load errors

### OSM Button
- [ ] Button clickable
- [ ] Columbus data loads
- [ ] No Oklahoma file errors

### Location Selector
- [ ] Columbus in dropdown
- [ ] Selection works

### Tool Integration
- [ ] All buttons work
- [ ] No Oklahoma features trigger

### Legend
- [ ] No Oklahoma sections
- [ ] Toggles work

### Errors
- [ ] No 404 errors
- [ ] No undefined variables
- [ ] Console clean

### Notes:
[Any issues found, screenshots, etc.]
```


