# Geo-AI Mapping Framework

A React-based framework for building interactive geo-AI mapping applications with Mapbox GL and Deck.gl.

This repo is **architecture-first**: it shows how to structure a geo-AI map (cards, tools, layers, AI hooks) using tiny synthetic data, while keeping any real project data and proprietary logic private.

## 🎯 Features

- 🗺️ **Mapbox GL Integration** - Interactive map with Deck.gl overlays
- 🎴 **Card System** - Flexible, scene-based UI card architecture
- 🤖 **AI Orchestration** - Pattern for integrating multiple AI tools
- 🎨 **Layer Management** - Dynamic layer toggling and state management
- ⚡ **Performance** - Caching, optimization, and animation systems
- 🎬 **Scene Management** - Multi-scene workflow support

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## 📚 Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Component Patterns](./docs/COMPONENT_PATTERNS.md)
- [AI Orchestration Guide](./docs/AI_ORCHESTRATION.md)
- [Layer System](./docs/LAYER_SYSTEM.md)

## 🎨 Examples

- [Basic Map](./examples/basic-map/) - Minimal map setup using the `BasicMap` component
  - Two synthetic sites: “Grid A East Campus” and “Grid B West Campus”
  - Click a site → opens an overlay card with example metadata (utility / grid)
  - Firecrawl-style button → toggles two example routes between the sites
  - Tiny legend → explains the two example grids and routes at a glance

## 🏗️ Architecture

This framework provides:

1. **Component System** - Reusable React components for map UIs
2. **Tool Executors** - Pattern for integrating external APIs (OSM, AI services)
3. **State Management** - Hooks and utilities for managing map state
4. **Caching Layer** - Response caching for performance
5. **Animation System** - Utilities for map animations

## 📦 Core Concepts

### Cards
The card system provides a flexible UI layer for displaying information, questions, and responses on the map.

### Tools
Tool executors abstract API integrations, allowing you to add new data sources easily.

### Scenes
Scene management enables multi-step workflows and state preservation.

### How This Relates to Real Projects

The BasicMap example encodes a simplified pattern behind scenarios like **“two independent grids / two campuses within ~100 miles to avoid a single-grid bottleneck”**:

- Two synthetic sites on two synthetic grids
- Example routes between them
- A card overlay and legend that explain the relationship

To adapt this to your own work:
- Replace the sample GeoJSON in `public/sample-data/` with your own sites and routes
- Swap `SimpleCard` for your own richer card component
- Plug in real tool implementations and a private `useAIQuery` orchestration hook

## 🤝 Contributing

This is a framework showcasing architecture patterns. Contributions welcome!

## 📄 License

MIT

## 🔗 Links

- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)
- [Deck.gl](https://deck.gl/)
- [React](https://react.dev/)

---

**Note**: This is a framework demonstrating architecture patterns. For production use, you'll need to:
- Add your own API keys
- Implement your own data sources
- Customize for your specific use case


