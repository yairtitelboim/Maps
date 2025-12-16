# Generating Energy Infrastructure Data

The Texas Energy Corridors layer requires power line and gas pipeline data from OpenStreetMap. This document explains how to generate this data.

## Quick Start (Sample Data)

A **sample dataset** (`tx_ercot_energy_sample.json`) is included in the repository. This contains ~5% of the full dataset and demonstrates the functionality.

The component will automatically use the sample file if the full dataset is not available.

## Generating the Full Dataset

For the complete Texas energy infrastructure visualization, you can generate the full dataset:

### Prerequisites

```bash
pip install requests
```

### Generate Full Dataset

```bash
python3 scripts/osm-tools/tx_ercot_energy_osm.py
```

This will:
- Query OpenStreetMap's Overpass API for Texas power lines and gas pipelines
- Extract ~200,000 features (power lines, substations, gas pipelines)
- Save to `public/osm/tx_ercot_energy.json` (~128MB)

**Note**: The full dataset is too large for GitHub (>10MB), so it's excluded from the repository. Users can generate it locally.

### What Gets Generated

The script extracts:
- **Power Infrastructure**:
  - High-voltage transmission lines (69kV+)
  - Power plants and substations
  - Voltage classification and styling data

- **Gas Infrastructure**:
  - Gas transmission pipelines
  - Gas processing facilities

### File Locations

- **Sample**: `public/osm/tx_ercot_energy_sample.json` (~6-7MB) ✅ Included in repo
- **Full**: `public/osm/tx_ercot_energy.json` (~128MB) ❌ Generate locally

### Creating Your Own Sample

To create a custom sample size:

```bash
python3 scripts/osm-tools/create_sample_tx_energy.py
```

Edit the `SAMPLE_PERCENTAGE` variable in the script to adjust the sample size.

## Component Configuration

The `TexasEnergyCorridorsLayer` component looks for data at:
- Primary: `/osm/tx_ercot_energy.json` (full dataset)
- Fallback: `/osm/tx_ercot_energy_sample.json` (sample)

If neither exists, the layer will show an error in the console but won't break the app.

## Data Source

- **Source**: OpenStreetMap (OSM)
- **API**: Overpass API (`https://overpass.kumi.systems/api/interpreter`)
- **Coverage**: Texas ERCOT region (25.5°N to 36.0°N, -103.5°W to -94.5°W)
- **Update Frequency**: OSM data is updated continuously; regenerate as needed

## Troubleshooting

### "File not found" error
- Make sure you've generated the data file
- Check that it's in `public/osm/` directory
- Restart the dev server after generating

### Large file size
- The full dataset is ~128MB
- Use the sample version for development
- Consider using Git LFS if you need to version the full file

### Overpass API timeout
- The query can take 2-3 minutes
- The script includes retry logic
- If it fails, try again later (OSM servers may be busy)

