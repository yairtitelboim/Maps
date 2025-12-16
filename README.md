# Infrastructure Mapping & Analysis Platform

An interactive geo-AI mapping application for visualizing and analyzing infrastructure data, with a focus on energy infrastructure, data centers, and regional planning. Built with React, Mapbox GL, and Deck.gl.

## 🎯 Features

- 🗺️ **Interactive Maps** - Mapbox GL integration with Deck.gl overlays
- ⚡ **Energy Infrastructure Visualization** - ERCOT energy projects, transmission lines, and county-level analysis
- 🏢 **Data Center Tracking** - Texas data center locations and capacity analysis
- 📊 **Producer/Consumer Analysis** - County-level energy production and consumption patterns
- 🔌 **Energy Corridors** - Power lines and gas pipelines from OpenStreetMap
- 🤖 **AI Integration** - AI-powered analysis and query capabilities
- 📈 **Interactive Tables** - Detailed county-level capacity breakdowns
- 🎨 **Layer Management** - Dynamic layer toggling and visualization

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**
- **Mapbox Access Token** (get one at [mapbox.com](https://www.mapbox.com))

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yairtitelboim/Maps.git
   cd Maps
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   # Copy the example file
   cp .env.example .env
   
   # Edit .env and add your API keys:
   # - REACT_APP_MAPBOX_TOKEN=your_mapbox_token_here
   # - PERPLEXITY_API_KEY=your_perplexity_key_here (optional)
   # - OPENAI_API_KEY=your_openai_key_here (optional)
   # - GOOGLE_API_KEY=your_google_key_here (optional)
   ```

4. **Start the development server:**
   ```bash
   npm start
   ```

   The app will open at `http://localhost:3000`

## 📦 Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm run download-whitney` - Download Whitney Lake data (if applicable)

## 🗂️ Project Structure

```
├── src/
│   ├── components/
│   │   └── Map/              # Main map components
│   │       ├── components/   # Layer components
│   │       ├── Cards/        # UI card system
│   │       └── hooks/        # Custom React hooks
│   ├── services/             # API services
│   └── utils/                # Utility functions
├── public/
│   └── data/                 # GeoJSON data files
├── scripts/                  # Data processing scripts
└── docs/                     # Documentation
```

## 🗺️ Map Layers

### ERCOT Counties
- Interactive county boundaries with energy project data
- Click counties to see detailed capacity breakdowns
- Color-coded by dominant energy category (Baseload, Renewable, Storage, Other)

### Producer/Consumer Counties
- Green: Energy producers (high capacity, low data center count)
- Red: Energy consumers (low capacity, high data center count)
- Purple: Hybrid counties (both production and consumption)

### Texas Energy Corridors
- Power transmission lines (color-coded by voltage)
- Gas pipelines
- Infrastructure from OpenStreetMap
- **Note**: A sample dataset (~6MB) is included. For the full dataset (~128MB), see [Generating Energy Data](./docs/GENERATING_ENERGY_DATA.md)

### Data Centers
- Texas data center locations
- Project status and capacity information

## 🔧 Configuration

### Mapbox Token

The app requires a Mapbox access token. Add it to your `.env` file:

```env
REACT_APP_MAPBOX_TOKEN=your_mapbox_token_here
```

Get your token at: https://account.mapbox.com/access-tokens/

### Optional API Keys

Some features require additional API keys:

- **Perplexity API** - For AI-powered location analysis
- **OpenAI API** - For AI query capabilities
- **Google API** - For geocoding and places data

Add these to your `.env` file if you want to use those features.

## 📊 Data Sources

- **ERCOT GIS Reports** - Energy project interconnection data
- **OpenStreetMap** - Energy infrastructure (power lines, pipelines)
- **News Articles** - Data center project announcements
- **County Boundaries** - Texas county GeoJSON data

## 🛠️ Development

### Adding New Layers

1. Create a new component in `src/components/Map/components/`
2. Add layer toggle in `src/components/Map/components/LayerToggle.jsx`
3. Register in `src/components/Map/index.jsx`

### Data Processing

Scripts for processing and aggregating data are in the `scripts/` directory:

- `scripts/ercot/` - ERCOT data aggregation
- `scripts/news-output/` - News article processing
- `scripts/osm-tools/` - OpenStreetMap data extraction

## 📚 Documentation

- [Data Architecture](./docs/DATA_ARCHITECTURE_README.md) - Data pipeline and sources
- [ERCOT Analysis](./docs/ERCOT_GIS_CONSOLIDATION_README.md) - ERCOT data processing
- [News Pipeline](./docs/NEWS_FIRST_DISCOVERY_PIPELINE.md) - Data center discovery process

## 🚢 Deployment

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `build/` directory.

### Deploy to Vercel

The project includes Vercel configuration. Deploy with:

```bash
vercel
```

Or connect your GitHub repository to Vercel for automatic deployments.

## 🤝 Contributing

This is a public repository. Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

ISC

## 🙏 Acknowledgments

- Mapbox for mapping infrastructure
- ERCOT for energy data
- OpenStreetMap contributors for infrastructure data
- React and Deck.gl communities

## ⚠️ Note

This is a sanitized public version. Some features may require:
- API keys for full functionality
- Large data files (excluded from repo, download separately if needed)
- Service account files (for Google Cloud features)

See `README_SETUP.md` for additional setup details.

## 🐛 Troubleshooting

### "Mapbox token not found"
- Make sure `.env` file exists with `REACT_APP_MAPBOX_TOKEN`
- Restart the dev server after adding the token

### "Module not found" errors
- Run `npm install` to ensure all dependencies are installed
- Check that you're using Node.js v18+

### API features not working
- Verify API keys are set in `.env` file
- Check that the feature doesn't require additional setup
- Some features may need manual code updates if placeholders weren't replaced

### Large files missing
- Files >10MB were excluded from the repository
- Check `sanitization_report.json` for excluded files
- Download or generate these files separately if needed

## 📧 Contact

For questions or issues, please open an issue on GitHub.
