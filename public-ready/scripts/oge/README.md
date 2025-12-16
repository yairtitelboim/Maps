# OG&E Data Extraction

This directory contains scripts to extract OG&E (Oklahoma Gas & Electric) data using Firecrawl, focusing on understanding the redundancy dynamic between GRDA and OG&E for Google's data centers.

## Purpose

The goal is to understand this critical redundancy dynamic:

- **If GRDA hits capacity** → Google has OG&E
- **If OG&E rates spike** → Google has GRDA's public power
- **If drought hits Grand Lake** → Stillwater water is unaffected

## Scripts

### 1. `firecrawl_capacity_extractor.py`

Extracts comprehensive OG&E data including:
- **Power generation capacity** and facilities
- **Rate structures** (commercial, industrial, time-of-use)
- **Service territory** (cities served, overlap with GRDA)
- **Water sources** (critical for drought resilience analysis)
- **Redundancy analysis** (vs GRDA)

**To run:**
```bash
cd scripts/oge
python firecrawl_capacity_extractor.py
```

**Requirements:**
- `FIRECRAWL_API_KEY` environment variable must be set
- Python packages: `requests`, `python-dotenv`

**Output:**
- `data/oge/firecrawl_capacity_data.json` - Structured JSON data
- `data/oge/firecrawl_capacity_answer.txt` - Human-readable summary

### 2. `add_coordinates_to_capacity.py`

Adds latitude/longitude coordinates to OG&E generating units.

**To run:**
```bash
cd scripts/oge
python add_coordinates_to_capacity.py
```

**Requirements:**
- Python package: `geopy` (optional, uses known coordinates if not available)

**Process:**
1. Loads data from `firecrawl_capacity_extractor.py`
2. Uses known coordinates database for verified locations
3. Falls back to geocoding for facilities not in database
4. Updates the JSON file with coordinates

## Data Structure

The extracted JSON follows this structure:

```json
{
  "generating_units": [
    {
      "name": "Mustang Power Plant",
      "type": "Gas",
      "net_MW": 1200,
      "fuel": "Gas",
      "latitude": 35.3928,
      "longitude": -97.7247
    }
  ],
  "capacity_mix": {
    "Gas_MW": 4767,
    "Coal_MW": 1566,
    "Wind_MW": 498,
    "Solar_MW": 285
  },
  "rates": {
    "commercial_rate_per_kwh": 0.08,
    "industrial_rate_per_kwh": 0.065,
    "time_of_use_available": true
  },
  "service_territory": {
    "cities_served": ["stillwater", "oklahoma city", "tulsa"],
    "stillwater_served": true,
    "overlap_with_grda": false
  },
  "water_sources": {
    "stillwater_water_source": "Stillwater Aquifer",
    "independent_from_grand_lake": true,
    "drought_resilient": true
  },
  "redundancy_analysis": {
    "grda_capacity_backup": true,
    "rate_hedging_available": true,
    "water_independence": true,
    "stillwater_coverage": true
  }
}
```

## Key Data Points

### Capacity Analysis
- Total generation capacity (~7,116 MW based on public data)
- Fuel mix: Gas (67%), Coal (22%), Renewables (7%)
- Individual facility capacities

### Rate Analysis
- Commercial and industrial rates
- Time-of-use availability
- Demand charges
- Comparison with GRDA rates

### Service Territory
- Cities and counties served
- Stillwater coverage (critical for Google data center)
- Overlap analysis with GRDA territory

### Water Sources
- Stillwater water source identification
- Independence from Grand Lake
- Drought resilience assessment

### Redundancy Analysis
- **Capacity backup**: Can OG&E backup GRDA if capacity exceeded?
- **Rate hedging**: Can Google switch to GRDA if OG&E rates spike?
- **Water independence**: Is Stillwater water unaffected by Grand Lake drought?

## Workflow

1. **Extract data:**
   ```bash
   python firecrawl_capacity_extractor.py
   ```

2. **Add coordinates:**
   ```bash
   python add_coordinates_to_capacity.py
   ```

3. **Copy to public directory:**
   ```bash
   cp data/oge/firecrawl_capacity_data.json public/data/oge/firecrawl_capacity_data.json
   ```

4. **Use in frontend:**
   - Similar to GRDA markers, can be integrated into map visualization
   - Compare OG&E vs GRDA for redundancy analysis
   - Display rate comparisons
   - Show service territory overlap

## Integration with GRDA Data

This OG&E data complements the GRDA data extraction to provide:

1. **Dual-grid redundancy analysis**
   - Compare capacities side-by-side
   - Analyze rate structures for hedging opportunities
   - Map service territory boundaries

2. **Water resilience analysis**
   - GRDA: Grand Lake (drought vulnerable)
   - OG&E/Stillwater: Independent water sources (drought resilient)

3. **Strategic decision support**
   - When to use GRDA vs OG&E
   - Rate optimization strategies
   - Capacity planning

## Related Files

- **GRDA extraction:** `scripts/grda/firecrawl_capacity_extractor.py`
- **Documentation:** `docs/FIRECRAWL_TO_MARKERS_FLOW.md`
- **Frontend integration:** `src/components/Map/components/Cards/OSMCall.jsx` (for future OG&E marker integration)

## Notes

- OG&E website structure may differ from GRDA, so extraction patterns may need adjustment
- Rate data may require additional sources (regulatory filings, rate schedules)
- Service territory boundaries may need mapping data for precise visualization
- Water source data may require additional research beyond website scraping

