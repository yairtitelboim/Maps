## Geo-AI Mapping Framework Architecture

This framework is a **reference implementation** for building geo-AI mapping applications.
It focuses on **architecture & patterns**, not on real data or proprietary logic.

---

### 1. High-Level Structure

- **`src/index.js`**: React entrypoint (creates the root and renders `App`).
- **`src/App.js`**: Minimal app shell that renders the map.
- **`src/components/Map/BasicMap.jsx`**: Core map component used in examples.
- **`src/components/Map/components/Cards/`**: Card system primitives for overlays.
- **`src/utils/ToolExecutor.js` + `src/utils/tools/*`**: Patterns for external tool orchestration (OSM, Perplexity, etc.).
- **`src/hooks/useAIQuery.js`**: Example AI hook stub (real orchestration lives in private app).
- **`src/config/*`**: Config patterns (locations, scenes, cards) using generic examples.

---

### 2. Map Architecture (`BasicMap`)

`BasicMap.jsx` demonstrates a minimal but realistic pattern:

- **Mapbox GL initialization**
  - Uses `mapbox-gl` to create a map instance with a dark style.
  - Reads the Mapbox token from `REACT_APP_MAPBOX_ACCESS_TOKEN`.

- **Data sources & layers**
  - Adds a small GeoJSON source (`example-sites`) with two synthetic sites:
    - `Grid A East Campus`
    - `Grid B West Campus`
  - Renders them as a **circle layer** (`example-sites-layer`).

- **Interactions**
  - Click on a site → builds a **card config** and passes it into `CardManager`.
  - Hover on a site → changes the cursor to a pointer.

- **Example routes (Firecrawl-style)**
  - Adds a second source (`example-routes`) with two synthetic line strings between the sites.
  - A **Firecrawl-style button** toggles two line layers on/off:
    - `example-route-grid-a` (blue)
    - `example-route-grid-b` (orange)
  - This mirrors the idea of “revealing routes” via a tool, without using real data.

This pattern can be adapted by replacing the example GeoJSON with your own:

```js
// BasicMap.jsx (conceptual)
map.addSource('your-sites', { type: 'geojson', data: '/your-data.geojson' });
map.addLayer({ id: 'your-sites-layer', source: 'your-sites', /* ... */ });
```

---

### 3. Card System Architecture

The full application uses a richer `BaseCard` component with nested controls.
For the public framework example, we expose a **minimal card system** so the
pattern is clear while keeping proprietary implementations private.

- **`CardManager` (framework version)**
  - Accepts `activeCards` (array of configs) and renders a single `SimpleCard`.
  - In a full app, this can manage multiple cards, positions, and scenes.

- **`SimpleCard`**
  - Displays:
    - Title (site name)
    - Description
    - Simple metadata (Utility, Grid)
  - Styled as an overlay panel in the top-left corner.

**Pattern**:

1. **Map interaction** (click) builds a **card config**:
   - `id`, `title`, `content`, `position`, `nextSceneId`, etc.
2. Card config is pushed into `activeCards` state.
3. `CardManager` renders cards using a card component (`SimpleCard` or `BaseCard`).

This separation means you can swap `SimpleCard` out for your own rich `BaseCard`
without changing the map or interaction wiring.

---

### 4. Tool Executor Pattern

The framework includes simplified versions of tool executors in `src/utils`:

- **`ToolExecutor`**
  - Orchestrates multiple tools (OSM, Perplexity, etc.).
  - Manages shared cache (e.g., OSM results) and execution order.
  - In the framework, this is simplified and documented as a **pattern only**.

- **`OsmTool` (stub)**
  - Shows how you might:
    - Accept queries + coordinates.
    - Hit an API (e.g., Overpass) or use cached data.
    - Emit layers / features back to the map.

- **`PerplexityTool` (stub)**
  - Shows the shape of a Perplexity integration:
    - Accepts queries + context.
    - Optionally reads/writes cache.
    - Returns `analysis`, `citations`, and optional GeoJSON.

These tools are stubs; real apps should provide their own implementations,
API keys, and error handling.

---

### 5. AI Orchestration (`useAIQuery` stub)

- **`useAIQuery` in the framework is intentionally minimal**:
  - Manages `isLoading` and `responses` state.
  - Exposes a `handleAIQuery(questionData)` function.
  - Simulates an async response explaining where your real orchestration would go.

- **Real orchestration lives in your app**, not in this repo:
  - Prompt construction (Claude, Perplexity, etc.).
  - Tool calling strategies (SERP → OSM → Perplexity).
  - Workflow / cache management.

This separation lets you:
- Publish the **shape** of the AI hook API.
- Keep the real logic, prompts, and integrations private.

---

### 6. Config Patterns

- **`src/config/geographicConfig.js`**
  - Shows how to describe locations with:
    - `coordinates`, `city`, `state`, `region`, `gridOperator`, etc.
  - Uses **generic example locations only**.

- **`src/config/cardConfigs.js`**
  - Demonstrates scene → card configuration mapping.
  - Example scenes like `scene-0`, `scene-1`, with simple cards.

These configs illustrate how to **structure configuration**, not what
real projects or clients you are using.

---

### 7. How to Adapt This Framework

To use this framework for your own project:

1. **Replace example GeoJSON**
   - Create your own small `public/sample-data/*.geojson` files.
   - Update `BasicMap` to point to your data sources.

2. **Swap in your card implementation**
   - Replace `SimpleCard` with your own `BaseCard` and richer layout.
   - Expand `CardManager` to handle multiple cards / scenes.

3. **Plug in real tools**
   - Implement `OsmTool` with Overpass / your own OSM service.
   - Implement `PerplexityTool` or other AI tools with real APIs.

4. **Wire your own `useAIQuery`**
   - Keep the public stub, but in your app, import a private version
     that does full orchestration.

This keeps the **architecture and patterns public**, while your **data,
AI logic, and business-specific code remain private**.

