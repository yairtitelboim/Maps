# Publishable Framework Plan: Geo-AI Mapping Architecture

**Purpose**: Create a clean, open-source framework repository showcasing architecture & patterns, separate from the full proprietary application.

**Target Audience**: Developers interested in building geo-AI mapping applications, understanding React + Mapbox patterns, AI orchestration, and scalable component architectures.

---

## 🎯 Core Philosophy

**What to Share (Public Framework)**:
- ✅ Architecture patterns (component structure, state management, event systems)
- ✅ Reusable UI components (cards, layers, animations)
- ✅ Tool integration patterns (AI orchestration, caching, tool executors)
- ✅ Map interaction patterns (markers, popups, layer toggles)
- ✅ Example implementations with **synthetic/minimal data**

**What to Keep Private (Full Application)**:
- ❌ Real client datasets and proprietary data
- ❌ Production API keys and secrets
- ❌ Location-specific business logic (Taylor, Casa Grande, etc.)
- ❌ Full feature set and polished UX details
- ❌ Large GeoJSON files and processed datasets
- ❌ Internal documentation and planning docs

---

## 📁 Repository Structure Plan

### New Repository: `geo-ai-mapping-framework`

```
geo-ai-mapping-framework/
├── README.md                          # Framework overview, architecture, examples
├── LICENSE                            # MIT or Apache 2.0
├── CONTRIBUTING.md                    # Contribution guidelines
├── .gitignore                         # Standard React + data exclusions
├── package.json                        # Dependencies (no private packages)
│
├── src/
│   ├── components/
│   │   └── Map/
│   │       ├── index.jsx              # Main map component
│   │       ├── components/
│   │       │   ├── Cards/             # ✅ Card system (BaseCard, CardManager)
│   │       │   │   ├── BaseCard.jsx
│   │       │   │   ├── CardManager.jsx
│   │       │   │   ├── factory/
│   │       │   │   └── config/        # Generic card configs only
│   │       │   ├── LayerToggle.jsx    # ✅ Layer management UI
│   │       │   └── SceneManager.jsx   # ✅ Scene management
│   │       ├── hooks/                 # ✅ Custom hooks (useAIQuery, useMapLogic)
│   │       ├── config/                # ✅ Generic config patterns
│   │       └── utils/                 # ✅ Utility functions
│   │
│   ├── utils/
│   │   ├── tools/                     # ✅ Tool executor patterns (abstracted)
│   │   │   ├── ToolExecutor.js        # Base class
│   │   │   ├── OsmTool.js             # Example OSM tool (stubbed/mock)
│   │   │   └── PerplexityTool.js      # Example Perplexity tool (stubbed)
│   │   ├── ResponseCache.js           # ✅ Caching patterns
│   │   └── nodeAnimation.js           # ✅ Animation utilities
│   │
│   ├── config/
│   │   └── geographicConfig.js        # ✅ Generic location config pattern
│   │
│   └── hooks/
│       └── useAIQuery.js              # ✅ AI orchestration hook
│
├── examples/
│   ├── basic-map/                     # Minimal working example
│   ├── with-cards/                    # Card system example
│   ├── with-ai-tools/                # AI tool integration example
│   └── with-layers/                   # Layer management example
│
├── docs/
│   ├── ARCHITECTURE.md                # System architecture overview
│   ├── COMPONENT_PATTERNS.md          # Component design patterns
│   ├── AI_ORCHESTRATION.md            # AI tool integration guide
│   ├── LAYER_SYSTEM.md                # Layer management patterns
│   └── ANIMATIONS.md                  # Animation system guide
│
├── public/
│   └── sample-data/                   # Tiny synthetic GeoJSON examples
│       ├── sample-buildings.geojson    # ~10 features only
│       └── sample-infrastructure.geojson
│
└── scripts/
    └── setup-example-data.js          # Script to generate sample data
```

---

## 🔄 Migration Checklist

### Phase 1: Core Architecture Extraction

#### ✅ **Include These Components** (Clean, Generic Versions)

1. **Card System** (`src/components/Map/components/Cards/`)
   - [x] `BaseCard.jsx` - Remove location-specific logic, keep generic patterns
   - [x] `CardManager.jsx` - Keep scene management logic
   - [x] `factory/CardFactory.js` - Keep factory pattern
   - [x] `config/cardConfigs.js` - Replace with generic example configs
   - [x] `AIQuestionsSection.jsx` - Keep UI patterns
   - [x] `SidePanel.jsx` - Keep UI structure
   - [x] `LegendContainer.jsx` - Keep legend patterns
   - [x] `NestedCircleButton.jsx` - Remove location-specific buttons, keep structure

2. **Map Core** (`src/components/Map/`)
   - [x] `index.jsx` - Main map component (simplified)
   - [x] `hooks/useMapInitialization.js` - Map setup patterns
   - [x] `hooks/useSceneManager.js` - Scene management
   - [x] `components/LayerToggle.jsx` - Layer UI (remove location-specific layers)
   - [x] `components/SceneManager.jsx` - Scene system

3. **AI Orchestration** (`src/hooks/`, `src/utils/tools/`)
   - [x] `useAIQuery.js` - AI query orchestration hook
   - [x] `utils/tools/ToolExecutor.js` - Base tool executor pattern
   - [x] `utils/tools/OsmTool.js` - Example tool (stubbed/mock implementation)
   - [x] `utils/ResponseCache.js` - Caching patterns

4. **Utilities**
   - [x] `utils/nodeAnimation.js` - Animation system
   - [x] `config/geographicConfig.js` - Config pattern (with generic examples only)

#### ❌ **Exclude These** (Proprietary/Client-Specific)

1. **Location-Specific Components**
   - [ ] `TaylorWastewaterCall.jsx` - Texas-specific
   - [ ] `CasaGrandeBoundaryLayer.jsx` - Arizona-specific
   - [ ] `SamsungTaylorChangeAnimation.jsx` - Client-specific
   - [ ] `RockdaleChangeAnimation.jsx` - Texas-specific
   - [ ] All `*NC*`, `*TX*`, `*AZ*`, `*Houston*`, `*CasaGrande*` components

2. **Proprietary Data & Configs**
   - [ ] `config/taylorWastewaterSites.js`
   - [ ] `config/pinalConfig.js`
   - [ ] `data/grda/`, `data/oge/` - Real client data
   - [ ] `public/Listings/` - Real property data
   - [ ] All large GeoJSON files (>1MB)

3. **Internal Tools & Scripts**
   - [ ] `scripts/osm-tools/` - Internal processing scripts
   - [ ] `scripts/grda/`, `scripts/oge/` - Client-specific scripts
   - [ ] All `*test_*.js`, `*test_*.html` files
   - [ ] Planning docs (`*_PLAN.md`, `*_README.md`)

4. **Full Feature Set**
   - [ ] Gentrification analysis (Houston-specific)
   - [ ] Startup intelligence layers
   - [ ] Complex animation sequences
   - [ ] Production-ready UI polish

---

## 🧹 Cleanup Tasks

### Step 1: Create New Repository Structure
```bash
# Create new repo
mkdir geo-ai-mapping-framework
cd geo-ai-mapping-framework
git init

# Copy core structure
cp -r ../OKC/src/components/Map ./src/components/
cp -r ../OKC/src/hooks ./src/
cp -r ../OKC/src/utils/tools ./src/utils/
cp -r ../OKC/src/config/geographicConfig.js ./src/config/
```

### Step 2: Remove Location-Specific Code

**Files to Delete:**
- All `*Taylor*`, `*CasaGrande*`, `*Pinal*`, `*Houston*`, `*EADO*`, `*Bosque*` files
- All `*NC*`, `*TX*`, `*AZ*` location-specific components
- `data/` directory (except tiny samples)
- `public/` large files (keep only minimal examples)

**Code to Strip from Kept Files:**
- Remove all `TAYLOR_WASTEWATER_SITES` references
- Remove all `CASA_GRANDE` references
- Remove all `gentrification*` utilities
- Remove location-specific conditionals
- Replace real coordinates with generic examples

### Step 3: Create Generic Examples

**Replace Real Data with Synthetic:**
```javascript
// src/config/geographicConfig.js
export const GEOGRAPHIC_CONFIG = {
  example_location: {
    coordinates: { lat: 35.0, lng: -97.0 },
    city: 'Example City',
    state: 'OK',
    region: 'Example Region',
    gridOperator: 'Example Utility',
    // ... generic example only
  }
};
```

**Create Sample Data:**
```bash
# Generate tiny synthetic GeoJSON
node scripts/generate-sample-data.js
# Creates: public/sample-data/sample-buildings.geojson (10 features)
```

### Step 4: Stub Out Proprietary Tools

**Tool Implementations:**
```javascript
// src/utils/tools/OsmTool.js
export class OsmTool {
  async execute(query, location) {
    // Return mock/synthetic data for examples
    return {
      features: generateMockOSMFeatures(),
      metadata: { source: 'mock' }
    };
  }
}

// src/utils/tools/PerplexityTool.js
export class PerplexityTool {
  async execute(query) {
    // Return example response structure
    return {
      analysis: 'Example analysis...',
      citations: [],
      // Show structure, not real data
    };
  }
}
```

### Step 5: Create Example Applications

**Basic Example** (`examples/basic-map/`):
- Minimal map with one layer
- Shows core setup pattern

**Cards Example** (`examples/with-cards/`):
- Map with card system
- Shows scene management

**AI Tools Example** (`examples/with-ai-tools/`):
- Map with AI tool integration
- Shows orchestration patterns

---

## 📝 Documentation Plan

### README.md Structure

```markdown
# Geo-AI Mapping Framework

A React-based framework for building interactive geo-AI mapping applications.

## Features
- 🗺️ Mapbox GL integration with Deck.gl overlays
- 🎴 Flexible card-based UI system
- 🤖 AI tool orchestration patterns
- 🎨 Layer management system
- ⚡ Caching and performance optimizations

## Quick Start
[Installation, basic setup]

## Architecture
[Link to ARCHITECTURE.md]

## Examples
[Link to examples/]

## License
MIT
```

### ARCHITECTURE.md Contents

1. **System Overview**
   - Component hierarchy
   - Data flow
   - Event system

2. **Core Patterns**
   - Card system architecture
   - AI orchestration flow
   - Layer management
   - Caching strategy

3. **Extension Points**
   - How to add new tools
   - How to add new layers
   - How to customize cards

### COMPONENT_PATTERNS.md

- BaseCard pattern
- CardManager pattern
- Tool executor pattern
- Hook patterns (useAIQuery, useMapLogic)

---

## 🔐 Security & Privacy Checklist

### Before Publishing

- [ ] **API Keys**: Remove all real API keys
  - Search for: `sk-`, `AIza`, `xoxb-`, `api_key`, `apiKey`
  - Replace with: `YOUR_API_KEY_HERE` placeholders

- [ ] **Secrets**: Remove all secrets
  - Check: `.env` files, config files, JSON files
  - Use: `env.example` with placeholders

- [ ] **Data**: Remove all real data
  - Remove: Real coordinates, addresses, property data
  - Replace: Synthetic/generic examples only

- [ ] **Comments**: Review code comments
  - Remove: Client names, internal references
  - Keep: Technical explanations

- [ ] **Git History**: Consider fresh start
  - Option: Start new repo (no history)
  - Option: Use `git filter-branch` to remove sensitive data

---

## 📦 Package.json Configuration

```json
{
  "name": "geo-ai-mapping-framework",
  "version": "1.0.0",
  "description": "A React framework for building geo-AI mapping applications",
  "keywords": [
    "react",
    "mapbox",
    "deck.gl",
    "geospatial",
    "ai",
    "mapping"
  ],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/geo-ai-mapping-framework.git"
  },
  "dependencies": {
    // Only public packages
  },
  "devDependencies": {
    // Development tools
  }
}
```

---

## 🎯 Success Criteria

The publishable framework should:

1. ✅ **Demonstrate Architecture**: Show clear patterns without exposing IP
2. ✅ **Be Runnable**: Examples work out of the box
3. ✅ **Be Learnable**: Documentation explains patterns clearly
4. ✅ **Be Extensible**: Easy to add new tools/layers/cards
5. ✅ **Be Small**: < 50MB total (excluding node_modules)
6. ✅ **Be Clean**: No proprietary data, no secrets, no client references

---

## 🚀 Publishing Strategy

### Option 1: New Clean Repository
- Create fresh `geo-ai-mapping-framework` repo
- Manually copy and clean files
- Start with clean git history
- **Pros**: Clean slate, no history issues
- **Cons**: Manual work

### Option 2: Git Subtree/Filter
- Use `git subtree` or `git filter-branch` to extract framework
- **Pros**: Preserves some history
- **Cons**: More complex, may miss cleanup

### Option 3: Monorepo Approach
- Keep current repo, add `framework/` subdirectory
- Publish only that subdirectory
- **Pros**: Single source of truth
- **Cons**: More complex setup

**Recommended**: **Option 1** - Clean new repository for maximum control and clarity.

---

## 📋 Implementation Checklist

### Week 1: Extraction
- [ ] Create new repository structure
- [ ] Copy core components
- [ ] Remove location-specific code
- [ ] Create generic configs

### Week 2: Cleanup
- [ ] Stub out proprietary tools
- [ ] Generate sample data
- [ ] Remove all secrets
- [ ] Clean up imports

### Week 3: Documentation
- [ ] Write README.md
- [ ] Write ARCHITECTURE.md
- [ ] Write component pattern docs
- [ ] Create example apps

### Week 4: Polish & Publish
- [ ] Test all examples
- [ ] Final security review
- [ ] Add LICENSE
- [ ] Publish to GitHub

---

## 🎨 Example: What Gets Shared vs. Kept Private

### ✅ Shared (Framework)
```javascript
// Generic card configuration pattern
const CARD_CONFIGS = {
  'scene-0': [{
    id: 'example-card',
    title: 'Example Analysis',
    content: { description: 'Generic example...' }
  }]
};
```

### ❌ Kept Private (Full App)
```javascript
// Real client data
const GRDA_CAPACITY_DATA = {
  // Real power plant data, coordinates, capacity numbers
  // Client-specific business logic
};
```

---

## 📞 Next Steps

1. **Review this plan** - Confirm what to include/exclude
2. **Create extraction script** - Automate file copying/cleaning
3. **Set up new repo** - Initialize clean repository
4. **Iterate on examples** - Build working examples
5. **Document patterns** - Write architecture docs
6. **Security audit** - Final check before publish

---

**Last Updated**: January 2025  
**Status**: Planning Phase  
**Target Publish Date**: TBD

