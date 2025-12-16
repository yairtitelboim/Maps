# Seattle Waterfront Deck.GL Foot Traffic Animation

This document records the scope, implementation, issues, and follow-up work for the Seattle “Load Analysis” workflow card that must render a GPU-accelerated pedestrian animation with deck.gl. The narrative below is anchored in the project code base (`SEA2/src/components/Map`) and aligned with public deck.gl + Mapbox documentation.

---

## 1. Project Goal

| Requirement | Details |
|-------------|---------|
| Trigger | Third navigation card (“Load Analysis”) in `AITransmissionNav.jsx` via click handler (`AITransmissionNav.jsx:1481`). |
| Rendering Tech | **deck.gl** (GPU) – canvas-based animation is explicitly out of scope. Official docs: [deck.gl Overview](https://deck.gl/docs/). |
| Particle Budget | ≥ **10,000** pedestrians. Target performance derived from deck.gl docs on [Layer Performance](https://deck.gl/docs/developer-guide/performance). |
| Constraints | Particles must respect spatial layers: boardwalk corridor, road network, coastline (water mask), and building footprints. |
| Data | Waterfront datasets served from `/public/data/seattle_waterfront` (boardwalkTrafficSegments, nodes, developmentAreas, coastlineControl, etc.). |
| UX | Auto-pan and pitch the map to the waterfront and autoplay an animation loop (~120 s loop, `LOOP_DURATION`). |

---

## 2. Architecture Overview

1. **Card Triggering**  
   - `AITransmissionNav.jsx:1481` logs the click and dispatches `seattle:startDeckFootTraffic` through the existing `window.mapEventBus`.
   - `Map/index.jsx:441` listens for that event and calls `startDeckFootTrafficAnimation`, which:
     - Hides competing Seattle animations.
     - Recenters/tilts via `Map#easeTo`.
     - Tracks `isDeckFootTrafficAnimationVisible`.

2. **Animation Component**  
   - `DeckFootTrafficAnimation.jsx` is mounted from `Map/index.jsx:1918` when the new visibility flag is true.
   - Responsibilities:
    - Load GeoJSON data.
    - Generate 10 k TripsLayer paths (boardwalk corridor, jittered but constrained).
    - Install a **MapboxLayer** wrapper so deck.gl renders inside the Mapbox style graph.
    - Drive `currentTime` with `requestAnimationFrame` for smooth trails.

3. **Scene Data**  
- Boardwalk path + spawn metadata: `/public/data/seattle_waterfront/boardwalkTrafficSegments.geojson`.
   - Development areas, nodes, coastline: additional GeoJSON under same directory.
   - The TripsLayer uses jittered offsets perpendicular to the boardwalk line but snaps back if the candidate point falls outside the corridor polygon, keeping walkers off water and inside public space (leveraging `turf.booleanPointInPolygon`).

---

## 3. Implementation Timeline & Issues

### 3.1 Initial Wiring
- Added click logging, map event bus wiring, and map-state toggles (`Map/index.jsx:441` onwards).
- Implemented an overlay-based `DeckFootTrafficAnimation` using `MapboxOverlay` + `TripsLayer` (per deck.gl overlay docs: [Mapbox Overlay Integration](https://deck.gl/docs/api-reference/mapbox/mapbox-overlay)).

### 3.2 Overlay Failures
- In React 18 strict mode, the overlay was mounted/unmounted twice. During teardown, the overlay’s `Deck` instance was finalized; subsequent `overlay.setProps` calls threw `Cannot read properties of null (reading 'setProps')`.
- Even with readiness polling and cleanup guards, Mapbox style reloads could still null the deck instance mid-frame, preventing any visible animation.
- Symptoms: repeated console retries (`DeckFootTrafficAnimation.jsx` logging “Deck instance unavailable”) and absence of particles.

### 3.3 Decision to Switch
- To align with deck.gl’s guidance on Mapbox integration, we pivoted to `new MapboxLayer({ id, type: TripsLayer, ... })`. (Reference: [deck.gl MapboxLayer](https://deck.gl/docs/api-reference/mapbox/mapbox-layer).)
- **Rationale:** MapboxLayer embeds deck.gl inside Mapbox’s WebGL context and handles lifecycle via Mapbox’s style graph, eliminating the overlay’s deck finalization hazards.

### 3.4 MapboxLayer Implementation
- The current component (see `SEA2/src/components/Map/components/SeattleWaterfront/DeckFootTrafficAnimation.jsx`) does the following:
  1. Loads boardwalk data (trip paths).
  2. Creates a `MapboxLayer` instance with `TripsLayer`.
  3. Adds the layer when `map.isStyleLoaded()` returns true, or registers a `styledata` listener to retry when the style becomes ready.
  4. Stores a ref to the layer, runs an rAF loop that updates `currentTime` (`TripsLayer` takes `currentTime` and `trailLength` to animate particles; see [TripsLayer Docs](https://deck.gl/docs/api-reference/geo-layers/trips-layer)).
  5. Adds cleanup that cancels rAF, removes layer/source, and invokes `onCleanup` from `Map/index.jsx`.

### 3.5 Visual Specification
- **Palette:** Warm pedestrian-heat gradient, matching waterfront brand colors:
  - Primary hues: `#FDF2B3` (soft yellow), `#FACC15` (gold), `#FB923C` (orange), `#F97316` (amber-red). Configured in `buildTrips`.
  - Rationale: Cooler colors imply low activity; warm tones emphasize foot-traffic energy and contrast well against the dark Mapbox basemap.
- **Trail Behavior:** `trailLength: 12`, `fadeTrail: true`, `loopLength: 120`. This creates comet-like streaks that show directionality and intensity (longer trails = heavier flows). Reference: deck.gl docs on [TripsLayer animated trails](https://deck.gl/docs/api-reference/geo-layers/trips-layer#animation).
- **Density Cues:** 10 k trips ensure the diagonal boardwalk spine is visually saturated. Particle width (`getWidth`) scales with investment metadata so high-value development parcels glow brighter. 
- **Masking:** Spawn logic samples boardwalk corridor, development areas, and coastline masks. Walkers snap back inside polygons to ensure they remain on land/boardwalk (see `ensureInsideCorridor` + `turf.booleanPointInPolygon` usage).
- **Interaction:** The animation intentionally ignores click/hover to keep GPU overhead low; if UX later needs interactive tooltips, we can layer a separate deck.gl layer using binary attributes.

---

## 4. Technical Details

| Component | File & Line | Notes |
|-----------|-------------|-------|
| Card Trigger | `SEA2/src/components/Map/components/AITransmissionNav.jsx:1481` | Emits event, logs & schedules stop after ~32 s. |
| Map Entry Point | `SEA2/src/components/Map/index.jsx:395` | Holds `isDeckFootTrafficAnimationVisible` state and global start/stop functions (`window.startDeckFootTrafficAnimation`). |
| TripsLayer Integration | `SEA2/src/components/Map/components/SeattleWaterfront/DeckFootTrafficAnimation.jsx` | Primary logic for foot traffic animation. |
| Datasets | `/public/data/seattle_waterfront/*.geojson` | Boardwalk and support geometry. |
| Tools | [`@deck.gl/layers`](https://deck.gl/docs/api-reference/layers), [`@deck.gl/mapbox`](https://deck.gl/docs/api-reference/mapbox/mapbox-layer), [`turf.booleanPointInPolygon`](https://turfjs.org/docs/#booleanPointInPolygon). |

**TripsLayer Parameters:**  
- `trailLength: 12`, `loopLength: 120`, `getWidth` respects investment values, `jointRounded: true` (`deck.gl v8.9` changed the API as noted in warnings, hence the use of `jointRounded`).  
- `fadeTrail: true` keeps older frames translucent for a smoother stream.

**Collision Handling:**  
- Constrained to boardwalk corridor polygon; walkers are respawned if they stray.
- Additional filtering based on development areas, nodes, and coastline ensures they do not spawn on top of buildings or water (using `ensureInsideCorridor` and coordinates jitter logic).

**Performance Considerations:**  
- GPU layer count kept low (one TripsLayer).  
- 10k trips × 48 points = 480k vertices; deck.gl handles this, but `widthMaxPixels` and `trailLength` can be tuned if fps drops. Check deck.gl’s [Performance Guide](https://deck.gl/docs/developer-guide/performance#layer-optimization) for stratified sampling or binary data.

### 4.1 Dataset Contract
| Dataset | Fields Needed | Purpose |
|---------|---------------|---------|
| `boardwalkTrafficSegments.geojson` | `type` → `boardwalk_path`, `boardwalk_corridor`, `boardwalk_spawn_point` (optional spawn metadata) | Primary corridor geometry. Must include a polygon corridor for masking and a LineString for sampling. |
| `developmentAreas.geojson` | `properties.type` (e.g., `mixed_development`, `public_space`, `transit_infrastructure`), `foot_traffic_increase`, `investment_usd`, `is_boardwalk` | Determines spawn weighting & exclusion from private buildings. |
| `nodes.geojson` | `properties.type`, `investment_usd`, coordinates | Adds additional spawn clusters around significant nodes. |
| `coastlineControl.geojson` | `type` = `coastline_waterline` / `coastline_land_offset` | Supplies shoreline guard rails to keep particles on land. |

If these schemas change, update `buildTrips`, spawn strategies, and masking helpers accordingly to prevent walkers from spawning in invalid areas.

### 4.2 Spawn & Mask Algorithm (High Level)
1. **Sample Paths:** Sample each `boardwalk_path` feature independently (proportional to its length) so piers don’t bleed into each other; then project each sample to the `coastline_land_offset` guide path from `coastlineControl.geojson` so walkers stay glued to the landward edge.
2. **Spawn Strategies:** Weighted mix of boardwalk, development areas, foot-traffic hotspots, park locations, and node proximity. Each strategy:
   - Offsets points perpendicular to the corridor for density.
   - Checks `ensureInsideCorridor` + `turf.booleanPointInPolygon` for water/building collisions.
3. **Trip Creation:** For each particle, pick a start index along the boardwalk, define stride/random duration, and create `TRIP_POINTS` positions + timestamps. Large gaps between samples (>50 m) are treated as hard stops, so trips never teleport across water—each walker either ends at the corridor edge or fades out in place.
4. **Mask Enforcement:** During animation, respawn particles that drift outside the corridor or into water by sampling a new valid spawn.

Documented behavior ensures future devs can adjust spawn weights without accidentally putting pedestrians in Elliott Bay or inside structures.

### 4.3 Event API Reference
| API | Location | Use Case |
|-----|----------|----------|
| `window.startDeckFootTrafficAnimation()` | `Map/index.jsx` | Direct start hook (also triggered via nav card). |
| `window.stopDeckFootTrafficAnimation()` | `Map/index.jsx` | Manual stop hook. |
| `mapEventBus.emit('seattle:startDeckFootTraffic')` | `AITransmissionNav.jsx` | Primary trigger from UI cards or other systems. |
| `mapEventBus.emit('seattle:stopDeckFootTraffic')` | `AITransmissionNav.jsx` | Scheduled stop (~32 s). |
| Visibility flags (`window.isDeckFootTrafficAnimationVisible`) | `Map/index.jsx` | Secondary UIs can read to show status indicators. |

When adding new controllers (e.g., chat assistants), emit via `mapEventBus` to keep logic centralized.

---

## 5. Known Issues & Future Work

| Item | Description | Status / Notes |
|------|-------------|----------------|
| Layer Reactivity | If Mapbox style swaps (e.g., basemap change), the animation may need to re-add the layer. Current code listens for `styledata`, but further testing is needed. | Needs validation. |
| Dynamic Layer Respect | The foot-traffic layer assumes supporting layers (roads, coastline debug) are enabled. If the user toggles them, the trips logic should optionally pause or refresh. | Enhancement. |
| Data Refresh Strategy | Trips are built once from static GeoJSON. If we ever stream or update data, convert to binary attributes for incremental updates. | Future design. |
| Performance Profiling | Run Lighthouse + devtools to confirm 60 FPS on target hardware. Adjust `PARTICLE_COUNT`, `TRIP_POINTS`, `trailLength`. | Action item. |
| Visual Styling | Consider varying color/speed clusters (boardwalk vs park spawns) to better communicate hot spots. | Optional improvement. |
| Data Contracts | Document GeoJSON field requirements so contributors can regenerate datasets without breaking spawn logic. | Added below. |
| Spawn/Mask Docs | Provide algorithmic description for spawn/mask behavior to ease maintenance. | Added below. |
| Event API Table | Summarize start/stop functions and events for other teams. | Added below. |
| Testing Checklist | Provide manual QA steps beyond visual checks. | Added below. |
| Fallback Strategy | Define behavior if deck.gl fails to initialize (UX + logging). | Added below. |
| Route Wrapping | Long `boardwalk_path` segments still cause diagonal “wraps” over the bay once walkers reach the end of the polyline. | Documented below. |

### 5.1 Route Wrapping Notes

Despite multiple mitigation layers (safe-route projection, per-segment sampling, gap-aware strides, forward-only trips), the current GeoJSON still contains single `LineString`s that span the entire waterfront. When walkers exhaust a pier segment, deck.gl interpolates to the next vertex, which yields the diagonal “completion” stroke shown in testing.

**Why it still happens**
- `boardwalk_path` remains one long polyline. Even with gap flags, the TripsLayer interpolates between the final and first vertices because they belong to the same feature.
- The safe-route projection aligns points to the coastline but does not change the underlying vertex order, so the straight leg across Elliott Bay remains.
- We currently stop advancing when a gap is detected, but the last two vertices of the south leg sit on opposite corners of the polygon, so a single interpolation still draws the diagonal in the screenshot.

**Next steps (not yet implemented)**
1. Split the boardwalk dataset into discrete `LineString`s (one per pier/leg). Walkers spawned on a segment would never inherit coordinates from a different pier.
2. Provide an explicit “return route” dataset (or densify the coastline offset) so each leg has intermediate vertices; walkers could then fade out before the final diagonal.
3. As a fail-safe, track `end_of_route` markers in the GeoJSON and terminate the Trip instantly upon reaching the flag instead of relying on stride/gap heuristics.

Until the source geometry is re-authored, expect some diagonal wraps at the south edge.

---

## 6. Usage Checklist

1. **Run the App**: `npm start` (from repo root). Confirm Mapbox token & deck.gl dependencies are installed (`@deck.gl/layers`, `@deck.gl/mapbox`).
2. **Open Console**: Watch for logs with `🟡 [DeckFootTraffic]`. First messages should be “MapboxLayer added” followed by `Generated trips: 10000`.
3. **Trigger Animation**: Click “Load Analysis” (3rd card) in the navigation panel.
4. **Verify**:
   - Map flies to Seattle.
   - After data loads, walkers stream diagonally along the boardwalk corridor.
   - Visual impact: trails glow in a warm gradient (pale yellow → golden amber → orange-red) to evoke pedestrian heat, with brighter hues hugging the boardwalk spine and softer yellows fanning toward parks; trails persist for ~12 units, creating comet-like streaks that show both direction and intensity.
   - Collision check: scan the shoreline—no particles should drift into Elliott Bay or clip through buildings/roads, confirming that coastline masks and development polygons are respected.
   - No `setProps` errors appear; warnings about `rounded` should be absent (we replaced with `jointRounded`/`capRounded`).
5. **Stop**: Click away or wait for ~32s stop timer; confirm the layer is removed and cleanup log printed.

---

### 6.1 Testing Checklist (Detailed)
| Test | Steps | Expected Result |
|------|-------|-----------------|
| **Trigger** | Click “Load Analysis” | Console logs show trigger + “MapboxLayer added”. |
| **Visual** | Observe boardwalk corridor | Warm gradient trails along diagonal boardwalk, zero walkers over water/buildings. |
| **Performance** | Open Chrome FPS meter | ≥ 45–60 FPS on dev hardware; if lower, document and adjust particle budget. |
| **Style Reload** | Toggle basemap or force style reload | Layer re-attaches automatically; walkers reappear without manual refresh. |
| **Stop Flow** | Wait 32s or click “stop” | Layer removed, rAF cancelled, logs show cleanup. |
| **Error Handling** | Temporarily break data (e.g., remove corridor feature) | Component logs warning (“No samples generated”) and exits gracefully (no crash). |

Automating some of these checks (unit tests around spawn logic, integration tests for event bus) would further stabilize contributions.

See `docs/deck-foot-traffic-qa-checklist.md` for the current end-to-end QA workflow, telemetry hooks, and dataset validation script.

### 6.2 Fallback Strategy
- **Detection:** If `DeckFootTrafficAnimation` fails to add the MapboxLayer (e.g., no data, Mapbox errors), log a descriptive warning and keep `isDeckFootTrafficAnimationVisible` false so the UI can reflect failure.
- **User Feedback:** Surface an on-screen status banner (e.g., reuse the nav panel status bar) that reports “Deck.GL foot traffic animation failed: <reason>” whenever the component throws, so users aren’t forced to open dev tools. Log reasons include missing data, Mapbox layer add failures, or Mapbox style reload loops.
- **Telemetry:** Capture overlay/layer failures in `crashMonitor` for alerting.
- **Graceful Degradation:** As a last resort, fall back to the existing canvas-based animation (by re-triggering the earlier component) with a clear warning that GPU mode failed—only if UX requires a visual placeholder. Currently we simply skip rendering to avoid conflicting visuals.

---

## 7. References

- deck.gl Documentation  
  - Overview & Concepts: https://deck.gl/docs/  
  - MapboxLayer API: https://deck.gl/docs/api-reference/mapbox/mapbox-layer  
  - TripsLayer API: https://deck.gl/docs/api-reference/geo-layers/trips-layer  
  - Performance Guide: https://deck.gl/docs/developer-guide/performance
- Mapbox GL JS Docs  
  - Layer Lifecycle: https://docs.mapbox.com/mapbox-gl-js/api/map/#map#addlayer  
  - Custom Layers (conceptually similar to MapboxLayer): https://docs.mapbox.com/mapbox-gl-js/api/#customlayerinterface
- Turf.js booleanPointInPolygon: https://turfjs.org/docs/#booleanPointInPolygon

These references align with the integration decisions taken here—particularly the MapboxLayer choice to keep deck.gl in sync with Mapbox’s render loop.

---

## 8. Summary

### 8.1 Pier 62 / Viaduct Extension Notes

- **Boardwalk Path Splits**: The original `boardwalk_path` LineString spanned the entire waterfront, causing wrap gaps when walkers reached the south end. We now maintain multiple features in `boardwalkTrafficSegments.geojson` (“Pioneer Square Approach”, “Waterfront South Bridge”, “Belltown North Reach”) so trips can respect each segment independently. When extending the animation north, ensure you split the LineString at natural breakpoints rather than appending distant coordinates to the same feature; long gaps will be flagged by `buildGapFlags`.
- **Safe-Route Projection**: `projectSamplesToSafeRoute` snaps every sample to `coastlineControl.geojson`. Newly traced coordinates near Pier 62 must also exist in that coastline feature; otherwise the projection step pulls them back to the old route. For segments named in `NO_PROJECT_SEGMENTS` we skip projection and corridor clamping so the raw traced path is preserved.
- **Corridor Polygons**: Each `boardwalk_corridor` polygon acts as the mask for `ensureInsideCorridor`. If you add a new path segment (e.g., the Pier 62 spur), also add a matching corridor polygon (`segment_name` or `corridor_id`) so jittered coordinates remain inside the intended boardwalk space.
- **Spawn Distribution**: Extend `boardwalk_spawn_point` features near the new path (we added 45 near Pier 62). Without spawn weighting, almost all walkers originate near Waterfront Park even if geometry exists elsewhere.
- **Wrap Diagnostics**: Console logs now emit `Sample segments distribution`, `Wrap indicators detected`, and `Spawn point summary`. Use these to confirm new paths survive each filter. Persistent wrap messages mean the segment still has large coordinate jumps or is being snapped outside the corridor.
- **OSM Road Tracing**: The “Coastline (Debug)” layer in `LayerToggle.jsx` renders Mapbox vector water; it does not export geometry. To align the animation with the visual “roads” layer you must explicitly trace/export the path (e.g., via Mapbox Studio or Overpass/OSM tooling such as `scripts/osm-tools/generate_waterfront_flows.py`) and store the resulting GeoJSON under `public/data/seattle_waterfront`. The repo currently lacks an automated way to fetch that live geometry.

- We met the user’s requirement to animate 10 k pedestrians on deck.gl, triggered by the third nav card, honoring spatial constraints.
- Transitioning from `MapboxOverlay` to `MapboxLayer` delivered the necessary stability under React strict mode and Mapbox style changes.
- The animation is now GPU-accelerated, data-driven via the Seattle waterfront datasets, styled with an intentional warm heatmap palette, and controlled through the existing AI Transmission navigation framework.

### 8.2 Generalizing Deck.GL Animations (Other Locations/Projects)

1. **Inventory Spatial Layers**
   - Identify the “track” geometry (roads, boardwalks, transit lines) you want to animate. Obtain or trace it as LineStrings in a FeatureCollection (`boardwalkTrafficSegments.geojson` in this project).
   - Gather masks/corridors (polygons) to keep jittered particles inside legal space (waterfront corridor, bike lanes, sidewalks). For each segment, decide if you need a dedicated polygon.
   - Collect context layers that influence spawn weights (development nodes, hotspots, demographic indicators).

2. **Author the GeoJSON Contracts**
   - Use consistent `properties` across segments, e.g. `segment_name`, `segment_order`, `step_meters`, so the code can group and prioritize segments.
   - Add spawn points (`boardwalk_spawn_point`, `type: boardwalk_corridor`) near the segments you want to emphasize.
   - If extending multiple cities, keep each dataset isolated under `/public/data/<city>` with matching `constants.js` entries.

3. **Extend Safe Routes & Corridors**
   - Update the “safe route” (coastline/road centerline) whenever you trace a new segment so projection works.
   - Add per-segment corridors if the geometry deviates significantly from the default mask; wire them into `corridorBySegment`.

4. **Update `DeckFootTrafficAnimation.jsx`**
   - Register the new city/location in `DATA_SOURCES` and provide a hook to toggle it via the map event bus.
   - Add the new segment names to `BOARDWALK_SEGMENTS`, `PRIORITY_SEGMENTS`, `NO_PROJECT_SEGMENTS`, etc., depending on whether you need special handling (e.g., skipping projection).
   - If the new location requires a different projection or jitter strategy, gate it via per-segment props (`segment_name`, `allow_projection`, etc.).

5. **Tune Trip Generation**
   - Use priority weighting to seed walkers near the new segments (as we did with Pier 62) so you can see the new path immediately without waiting for random spawn selection.
   - Resample/densify the LineStrings to avoid wrap detections caused by large gaps. Tools: turf `along`, `lineSliceAlong`, or GIS editing.

6. **Validate with Diagnostics**
   - Watch `Sample segments distribution`, `Wrap indicators detected`, and `Spawn point summary` to ensure the new segments are sampled, free of huge wrap counts, and properly weighted.
   - If wrap counts persist, inspect the raw coordinates to find gaps or corridor mismatches.

7. **OSM/External Traces**
   - If you rely on external map layers (roads, promenades), export a static GeoJSON via Mapbox Studio or Overpass. The helper `scripts/osm-tools/generate_waterfront_flows.py` can batch-download footways (with built-in retry/backoff), merge them with your boardwalk data, generate building-to-boardwalk connector paths (`--road-bbox` uses osmnx to follow real walking links), and emit Flowmap/deck.gl-ready flows. Use `--include-all-buildings` or `--default-trigger-class` if your trigger dataset lacks the green/blue labels. The animation cannot “read” live tiles; it needs static coordinates checked into the repo.

### 8.3 Flowmap-Style Workflow (Reusable Checklist)

1. **Generate flows from existing datasets**
   ```bash
   python scripts/osm-tools/generate_waterfront_flows.py \
     --buildings SEA2/public/data/<city>/osm/buildings.geojson \
     --boardwalk SEA2/public/data/<city>/boardwalkTrafficSegments.geojson \
     --output-trips SEA2/public/data/<city>/waterfront_flow_paths.geojson \
     --output-od SEA2/public/data/<city>/waterfront_flow_od.csv \
     --flow-length-m 800 \
     --include-all-buildings \
     --osm-bbox "lat1,lon1,lat2,lon2" \
     --road-bbox "lat1,lon1,lat2,lon2"
   ```
   - `--osm-bbox` adds additional footways (Overpass).  
   - `--road-bbox` pulls a walking network via osmnx, computes building→boardwalk connectors, and appends them to each flow path.

2. **Verify the GeoJSON**
   - Inspect `waterfront_flow_paths.geojson` to confirm each feature starts at a building, follows the road grid, and then transitions to the boardwalk. If you only see two coordinates per feature, the connector step failed (usually due to osmnx API mismatch).

3. **Load the flows in deck.gl**
   - `DeckFootTrafficAnimation` now auto-detects `/data/<city>/waterfront_flow_paths.geojson`. When present, it skips the particle generator entirely and feeds those flows directly to `TripsLayer`.
   - Flow mode automatically bumps widths, trail length, additive blending, and per-class colors so the animation resembles Flowmap Blue.

4. **Expose only one trigger**
   - The “Load Analysis” (third nav card) now toggles only the deck.gl layer. If you copy this setup to another project, keep the entry point consistent so users always launch the animation from a single card/button.

5. **Style tuning**
   - If you need different aesthetics, adjust `FLOWMAP_WIDTH_MIN/MAX`, `FLOWMAP_TRAIL_LENGTH`, and camera pitch/bearing in `startDeckFootTrafficAnimation`. Because flow mode is data-driven, one change updates the entire animation.

Following this recipe lets you reproduce the Seattle Flowmap-style animation in any city: gather the building triggers, trace the track/corridor, run the generator script, and point the deck.gl layer at the new flow file. No additional code changes are required once the data contracts are respected.

- We met the user’s requirement to animate 10 k pedestrians on deck.gl, triggered by the third nav card, honoring spatial constraints.
- Transitioning from `MapboxOverlay` to `MapboxLayer` delivered the necessary stability under React strict mode and Mapbox style changes.
- The animation is now GPU-accelerated, data-driven via the Seattle waterfront datasets, styled with an intentional warm heatmap palette, and controlled through the existing AI Transmission navigation framework.

Please consult this document before modifying the animation so the architectural decisions remain consistent with the project’s goals. If further enhancements are needed (e.g., dynamic data feeds or additional collision checks), extend the MapboxLayer logic rather than reverting to canvas overlays.*** End Patch
