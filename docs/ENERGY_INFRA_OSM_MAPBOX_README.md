## Whitney / Thad Hill Energy & Gas Layers – Implementation Guide

This README explains how the Whitney / Thad Hill **power + gas** infrastructure stack works in this project, and how to copy the pattern into other Mapbox-based maps.

The goal: **click a trigger → mount OSM‑derived power & gas layers (lines + points) with good styling, animation, labels, and legend integration.**

---

## 1. High‑level architecture

- **Data source**: OpenStreetMap via **Overpass API**, queried by a Python script.
- **Static cache**: Results written to a single GeoJSON file:
  - `public/osm/tx_whitney_thad_hill_energy.json`
- **Frontend loader**: A Mapbox utility:
  - `src/components/Map/utils/loadWhitneyEnergyInfrastructure.js`
  - Exposes:
    - `toggleWhitneyEnergyInfrastructure(mapRef, locationKey, updateToolFeedback)`
    - `removeWhitneyEnergyInfrastructure(mapRef, locationKey)`
- **Trigger**: Firecrawl button in:
  - `src/components/Map/components/Cards/NestedCircleButton.jsx`
  - On click → calls `toggleWhitneyEnergyInfrastructure(...)`
- **Legend integration**:
  - `LegendContainer.jsx` (not shown here) listens to `window.mapEventBus` events:
    - `infrastructure:energyLoaded`
    - `infrastructure:energyCleared`
  - Uses the emitted `summary` object for counts + toggles.

To port this into another project, you need:

1. An **OSM extraction script** (Python) for your region.
2. A **GeoJSON cache** in `public/osm/…`.
3. A **loader utility** that:
   - Fetches the cache
   - Splits power vs gas
   - Adds Mapbox layers with consistent IDs and styling
4. A **UI trigger** that calls the loader’s toggle function.
5. Optional: **Legend + mapEventBus wiring**.

---

## 2. OSM extraction script pattern

Reference script (Whitney / Thad Hill):

- `scripts/osm-tools/tx_whitney_energy_osm.py`

### 2.1. Bounding box and query

Key ideas:

- Use a **bounding box** around your site (center lat/lon, +/- deltas).
- Query:
  - Power lines / cables
  - Power plants / substations / generators / transformers
  - Pipelines (potential gas lines)

In Whitney we do:

- Center: `31.8594, -97.3586` (Thad Hill / Bosque Power)
- Expanded bbox (~150 × 180 km) to capture regional pipelines:

```python
CENTER_LAT = 31.8594
CENTER_LON = -97.3586

# Significantly expanded bounding box (~150 x 180 km around Thad Hill)
LAT_MIN = CENTER_LAT - 0.7
LAT_MAX = CENTER_LAT + 0.7
LON_MIN = CENTER_LON - 0.9
LON_MAX = CENTER_LON + 0.9

BBOX = f"{LAT_MIN},{LON_MIN},{LAT_MAX},{LON_MAX}"
```

Overpass query (simplified):

```python
PIPELINE_QUERY = f"""
[out:json][timeout:300];
(
  // Power transmission + distribution
  way["power"~"line|minor_line|cable"]({BBOX});
  relation["power"~"line|minor_line|cable"]({BBOX});

  // Power plants / substations / generators / transformers
  node["power"~"plant|substation|generator|transformer"]({BBOX});
  way["power"~"plant|substation|generator|transformer"]({BBOX});
  relation["power"~"plant|substation|generator|transformer"]({BBOX});

  // Pipelines (man_made or pipeline tag) - may include gas
  way["man_made"="pipeline"]({BBOX});
  way["pipeline"]({BBOX});
  relation["man_made"="pipeline"]({BBOX});
  relation["pipeline"]({BBOX});
);
out body;
>;
out skel qt;
"""
```

### 2.2. Classifying power vs gas

We normalize OSM tags into a **simple `infra_type`**:

- `infra_type: "power"` or `"gas"`
- Everything else is discarded.

Core function:

```python
def classify_infra_type(tags: Dict[str, str]) -> str:
    """
    Decide infra_type = 'power' or 'gas' based on OSM tags.

    - Power: power=* or clearly power-related.
    - Gas: pipeline/substance/product tags including 'gas', 'natural_gas', etc.
    - If it's a pipeline (man_made=pipeline or pipeline tag) and not power,
      default to 'gas', skipping explicit oil pipelines.
    """
    if not tags:
        return ""

    # Power markers - check first
    if "power" in tags:
        return "power"

    # Check if it's a pipeline
    is_pipeline = (
        tags.get("man_made") == "pipeline" or
        "pipeline" in tags
    )

    if is_pipeline:
        pipeline_val = (tags.get("pipeline") or "").lower()
        substance_val = (tags.get("substance") or "").lower()
        product_val = (tags.get("product") or "").lower()
        usage_val = (tags.get("usage") or "").lower()

        gas_keywords = ("gas", "natural_gas", "lng", "cng", "methane")
        oil_keywords = ("oil", "petroleum", "crude")

        # If explicitly oil, skip
        if any(k in pipeline_val for k in oil_keywords) or any(
            k in substance_val for k in oil_keywords
        ) or any(k in product_val for k in oil_keywords):
            return ""

        # Explicit gas → gas
        if any(k in pipeline_val for k in gas_keywords) or any(
            k in substance_val for k in gas_keywords
        ) or any(k in product_val for k in gas_keywords) or any(
            k in usage_val for k in gas_keywords
        ):
            return "gas"

        # Default: generic pipeline → gas
        return "gas"

    return ""
```

### 2.3. GeoJSON schema

Each feature written to `tx_whitney_thad_hill_energy.json` looks like:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [[lng, lat], ...]
  },
  "properties": {
    "osm_id": 12345,
    "osm_type": "way",
    "name": "Some Transmission Line",
    "category": "power",
    "infra_type": "power",
    "voltage": "138000",
    "tags": {
      "power": "line",
      "voltage": "138000",
      "operator": "...",
      "...": "..."
    }
  }
}
```

For nodes (plants/substations):

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [lng, lat]
  },
  "properties": {
    "osm_id": 99999,
    "osm_type": "node",
    "name": "Bosque Energy Center",
    "category": "power",
    "infra_type": "power",
    "tags": { ... }
  }
}
```

**Key requirement for the frontend**:  
Every feature must have a **clean `infra_type`** field and standard GeoJSON geometry.

---

## 3. Mapbox loader: mounting power + gas layers

Primary loader:

- `src/components/Map/utils/loadWhitneyEnergyInfrastructure.js`

### 3.1. Entry point: toggle function

Used by the Firecrawl button:

- Input: `mapRef` (React ref to `mapboxgl.Map`), `locationKey`, `updateToolFeedback`.
- Behavior:
  - If Whitney layers are **already mounted** → remove them and emit `infrastructure:energyCleared`.
  - Else:
    - Fetch `/osm/tx_whitney_thad_hill_energy.json`
    - Call `addEnergyLayers(...)`
    - Emit `infrastructure:energyLoaded` with:
      - `summary` (counts per layer)
      - `features`

### 3.2. Layer IDs and sources

Layer and source IDs are namespaced by `siteKey`:

- **Power**
  - Lines: `tx_whitney_thad_hill_energy-power-lines`
  - Halo: `tx_whitney_thad_hill_energy-power-lines-halo`
  - Labels: `tx_whitney_thad_hill_energy-power-lines-labels`
  - Points: `tx_whitney_thad_hill_energy-power-points`
  - Flow animation: `tx_whitney_thad_hill_energy-power-flow-anim-layer`
- **Gas**
  - Lines: `tx_whitney_thad_hill_energy-gas-lines`
  - Labels: `tx_whitney_thad_hill_energy-gas-lines-labels`
  - Points: `tx_whitney_thad_hill_energy-gas-points`

When cloning this architecture, **keep ID patterns consistent** so cleanup and legend toggles are easy.

### 3.3. Power line styling

We compute a normalized voltage in kV:

```js
const voltageExpr = [
  'to-number',
  [
    'coalesce',
    ['get', 'voltage_kv'],
    [
      'round',
      [
        '/',
        ['to-number', ['get', 'voltage']],
        1000
      ]
    ],
    0
  ]
];
```

Then derive a **discrete blue → red gradient**:

```js
const voltageColorExpr = [
  'case',
  ['>=', voltageExpr, 500], '#dc2626', // deep red
  ['>=', voltageExpr, 345], '#ef4444', // red
  ['>=', voltageExpr, 230], '#f97316', // orange
  ['>=', voltageExpr, 138], '#fbbf24', // yellow
  ['>=', voltageExpr, 69],  '#22d3ee', // cyan
  '#3b82f6'                               // blue
];
```

Applied to:

- **Halo**:

```js
map.addLayer({
  id: `${siteKey}-power-lines-halo`,
  type: 'line',
  source: sourceId,
  paint: {
    'line-color': voltageColorExpr,
    'line-width': 5.0,
    'line-opacity': 0.35,
    'line-blur': 1.2
  },
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
    visibility: 'visible'
  }
});
```

- **Main line**:

```js
map.addLayer({
  id: `${siteKey}-power-lines`,
  type: 'line',
  source: sourceId,
  paint: {
    'line-color': voltageColorExpr,
    'line-width': 2.6,
    'line-opacity': 0.9
  },
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
    visibility: 'visible'
  }
});
```

### 3.4. Power line labels

Voltage labels riding along the lines, 2× size:

```js
map.addLayer({
  id: `${siteKey}-power-lines-labels`,
  type: 'symbol',
  source: sourceId,
  layout: {
    'symbol-placement': 'line',
    'symbol-spacing': 400,
    'text-field': [
      'case',
      // Prefer explicit kV
      ['has', 'voltage_kv'],
      ['concat', ['to-string', ['get', 'voltage_kv']], ' kV'],
      // Else derive from voltage in volts
      [
        '>',
        ['coalesce', ['to-number', ['get', 'voltage']], 0],
        0
      ],
      [
        'concat',
        [
          'to-string',
          [
            'round',
            [
              '/',
              ['to-number', ['get', 'voltage']],
              1000
            ]
          ]
        ],
        ' kV'
      ],
      // Fallback
      [
        'coalesce',
        ['get', 'name'],
        ['get', 'ref'],
        'Transmission Line'
      ]
    ],
    'text-size': 28,
    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
    'text-keep-upright': true,
    'text-offset': [0, -0.5],
    visibility: 'visible'
  },
  paint: {
    'text-color': voltageColorExpr,
    'text-halo-width': 0
  }
});
```

### 3.5. Gas line styling + labels

Gas lines: simple green dashed lines:

```js
map.addLayer({
  id: `${siteKey}-gas-lines`,
  type: 'line',
  source: sourceId,
  paint: {
    'line-color': '#22c55e',
    'line-width': 1.8,
    'line-dasharray': [3, 2],
    'line-opacity': 0.9
  },
  layout: {
    visibility: 'visible'
  }
});
```

Gas labels:

```js
map.addLayer({
  id: `${siteKey}-gas-lines-labels`,
  type: 'symbol',
  source: sourceId,
  layout: {
    'symbol-placement': 'line',
    'symbol-spacing': 400,
    'text-field': [
      'coalesce',
      ['get', 'name'],
      ['get', 'ref'],
      'Gas Pipeline'
    ],
    'text-size': 28,
    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
    'text-keep-upright': true,
    'text-offset': [0, -0.5],
    visibility: 'visible'
  },
  paint: {
    'text-color': '#22c55e',
    'text-halo-width': 0
  }
});
```

### 3.6. Particle + pulse animations (optional but recommended)

To emphasize major transmission backbones, we added:

1. **Halo pulse**: periodically increases halo width / blur.
2. **Particle flow**: small circles moving along the lines to indicate direction/flow.

These are both implemented via `requestAnimationFrame` in:

- `setupPowerPulseAnimation(...)`
- `setupPowerFlowAnimation(...)`

If you want a simpler implementation, you can **omit** these functions and only keep static layers.

---

## 4. Triggering from UI (Firecrawl example)

`NestedCircleButton.jsx` wires the orange Firecrawl circle to this loader:

```jsx
<FirecrawlCall 
  onClick={() => {
    try {
      console.log('🔥 NestedCircleButton: Firecrawl clicked', {
        location: currentLocation
      });

      toggleWhitneyEnergyInfrastructure(map, currentLocation, updateToolFeedback)
        .then(() => {
          console.log('🔥 NestedCircleButton: Whitney energy & gas toggle completed', {
            location: currentLocation
          });
        })
        .catch((err) => {
          console.warn('⚠️ NestedCircleButton: Whitney energy & gas toggle failed', err);
        });
    } catch (err) {
      console.warn('⚠️ Unable to toggle route layers from Firecrawl button:', err);
    }
  }}
  title="Web Crawling with Firecrawl"
  color="rgba(255, 165, 0, 0.8)"
  size="10px"
  position={{ top: '0px', left: '0px' }}
  aiState={aiState}
  map={map}
  onLoadingChange={onLoadingChange}
  disabled={aiState.isLoading}
  updateToolFeedback={updateToolFeedback}
/>
```

To adopt this pattern elsewhere:

1. Expose your own `toggleXxxEnergyInfrastructure(...)` in a utility file.
2. In your card / control component, call it from a button `onClick`.
3. Pass a `mapRef` and any feedback updater you use.

---

## 5. Legend wiring (optional but recommended)

The loader **emits events** on a global event bus:

- On load:

```js
window.mapEventBus.emit('infrastructure:energyLoaded', {
  location: locationKey,
  siteKey,
  summary,
  features: featureCollection.features || [],
  timestamp: Date.now()
});
```

- On clear:

```js
window.mapEventBus.emit('infrastructure:energyCleared', {
  location: locationKey,
  siteKey,
  timestamp: Date.now()
});
```

`LegendContainer.jsx` subscribes:

- Maintains `energyInfrastructureData` with:
  - counts
  - layer IDs
  - visibility state
- Renders a legend section like:
  - **Whitney Energy & Gas**
    - Transmission lines (N)
    - Plants & substations (M)
    - Gas pipelines (K)
    - Gas facilities (P)
- Clicking legend items toggles the corresponding layers’ `layout.visibility`.

If you have your own legend system, you can:

- Either adopt the event bus pattern, or
- Call Mapbox visibility toggles directly from your UI.

---

## 6. How to replicate this in another project

**Minimal checklist:**

1. **Copy & adapt the OSM script**
   - Duplicate `tx_whitney_energy_osm.py`.
   - Change center + bbox.
   - Change output filename(s), e.g. `my_region_energy.json`.

2. **Generate the cache**

```bash
python3 scripts/osm-tools/my_region_energy_osm.py
```

3. **Create a loader utility**
   - Copy `loadWhitneyEnergyInfrastructure.js` to something like `loadMyRegionEnergyInfrastructure.js`.
   - Update:
     - `WHITNEY_ENERGY_SITE_KEY` → `MY_REGION_ENERGY_SITE_KEY`.
     - Path from `/osm/tx_whitney_thad_hill_energy.json` → `/osm/my_region_energy.json`.
   - Keep:
     - `infra_type` logic.
     - Power/gas splits.
     - Layer IDs / patterns.

4. **Wire into your UI**
   - Import your loader:

```js
import { toggleMyRegionEnergyInfrastructure } from '../utils/loadMyRegionEnergyInfrastructure';
```

   - Call it from a button or card:

```jsx
onClick={() => toggleMyRegionEnergyInfrastructure(mapRef, currentLocation, updateToolFeedback)}
```

5. **Optional – Legend**
   - Either:
     - Listen to the `infrastructure:energyLoaded` / `Cleared` events as we do, or
     - Expose a simpler `getSummary()` from your loader and call it directly.

---

## 7. Design principles & style notes

- **Single cache file per region**: Easier versioning, no Overpass in production.
- **Minimal schema**:
  - `infra_type` drives everything.
  - Original OSM tags preserved under `properties.tags` for future analysis.
- **Strong visual encoding**:
  - Voltage mapped to **hue** (blue → cyan → yellow → orange → red).
  - Line width fixed; halo adds emphasis.
  - Labels large and legible at regional zooms.
- **Animations opt‑in**:
  - Easy to disable by removing the animation helpers.
- **No synthetic infrastructure**:
  - All lines/points come from OSM; we do not fabricate missing connections.

If you follow this pattern—clean extraction script, small normalized schema, and a dedicated Mapbox loader—you can drop in comparable energy/gas overlays for any region with OSM coverage and keep the UX consistent with this Whitney / Thad Hill implementation.


