# OG&E and GRDA Redundancy Analysis

This document explains how OG&E (Oklahoma Gas & Electric) data extraction complements GRDA data to understand the critical redundancy dynamic for Google's data centers in Oklahoma.

## The Redundancy Dynamic

Google's data center strategy in Oklahoma leverages **two separate utilities that barely overlap**:

### 1. **Capacity Redundancy**
- **If GRDA hits capacity** → Google has OG&E
- **If OG&E hits capacity** → Google has GRDA
- Two independent power sources provide backup

### 2. **Rate Hedging**
- **If OG&E rates spike** → Google can switch to GRDA's public power
- **If GRDA rates spike** → Google can switch to OG&E
- Rate comparison enables cost optimization

### 3. **Water Resilience**
- **If drought hits Grand Lake** (GRDA's water source) → Stillwater water is unaffected
- **Stillwater** (OG&E territory) has independent water sources
- Geographic separation provides drought protection

## Data Sources

### GRDA Data
**Script:** `scripts/grda/firecrawl_capacity_extractor.py`

Extracts:
- Power generation capacity (Hydro, Gas, Wind)
- Facility locations
- Service territory (Pryor, OK area)
- Water dependency (Grand Lake)

**Output:** `data/grda/firecrawl_capacity_data.json`

### OG&E Data
**Script:** `scripts/oge/firecrawl_capacity_extractor.py`

Extracts:
- Power generation capacity (Gas, Coal, Wind, Solar)
- Rate structures (commercial, industrial, time-of-use)
- Service territory (Stillwater, OKC, Tulsa)
- Water sources (Stillwater-specific, independent from Grand Lake)

**Output:** `data/oge/firecrawl_capacity_data.json`

## Key Comparisons

### Capacity Comparison

| Utility | Total Capacity | Primary Fuel | Secondary Fuel |
|---------|---------------|--------------|----------------|
| **GRDA** | ~1,356 MW | Hydro (514 MW) | Gas (457 MW), Wind (385 MW) |
| **OG&E** | ~7,116 MW | Gas (67%) | Coal (22%), Renewables (7%) |

**Analysis:**
- OG&E has **5x more capacity** than GRDA
- OG&E is primarily **gas-fired** (reliable, dispatchable)
- GRDA is primarily **hydro** (renewable, but drought-vulnerable)
- **Complementary fuel mixes** provide diversification

### Service Territory

| Utility | Primary Territory | Key Cities | Overlap |
|---------|------------------|------------|---------|
| **GRDA** | Northeast OK | Pryor, Inola | Minimal |
| **OG&E** | Central/Western OK | Stillwater, OKC, Tulsa | Minimal |

**Analysis:**
- **Minimal overlap** = true redundancy
- **Geographic separation** = reduced shared risk
- **Stillwater** (Google data center) = OG&E territory
- **Pryor** (Google data center) = GRDA territory

### Rate Structures

| Utility | Commercial Rate | Industrial Rate | Time-of-Use |
|---------|----------------|-----------------|-------------|
| **GRDA** | Public power rates | Competitive | Available |
| **OG&E** | Market rates | Negotiated | Available |

**Analysis:**
- **Rate hedging opportunity**: Switch based on market conditions
- **Time-of-use** available from both = load shifting optimization
- **Public power** (GRDA) may offer lower rates during peak demand

### Water Sources

| Utility | Primary Water Source | Drought Vulnerability | Stillwater Impact |
|---------|---------------------|----------------------|-------------------|
| **GRDA** | Grand Lake | High (drought affects lake levels) | None (different location) |
| **OG&E** | Stillwater Aquifer | Low (groundwater, more resilient) | Direct (serves Stillwater) |

**Analysis:**
- **Stillwater water independent** from Grand Lake
- **Drought at Grand Lake** doesn't affect Stillwater operations
- **Geographic separation** = water resilience

## Redundancy Analysis Output

Both scripts generate a `redundancy_analysis` section:

### GRDA Redundancy Analysis
```json
{
  "redundancy_analysis": {
    "oge_capacity_backup": true,
    "rate_hedging_available": true,
    "water_dependent_on_grand_lake": true,
    "pryor_coverage": true
  }
}
```

### OG&E Redundancy Analysis
```json
{
  "redundancy_analysis": {
    "grda_capacity_backup": true,
    "rate_hedging_available": true,
    "water_independence": true,
    "stillwater_coverage": true
  }
}
```

## Strategic Insights

### 1. **Capacity Planning**
- **Total available capacity**: GRDA (1,356 MW) + OG&E (7,116 MW) = **8,472 MW**
- **Redundancy ratio**: 5.2:1 (OG&E can fully backup GRDA)
- **Risk mitigation**: If one utility fails, the other has sufficient capacity

### 2. **Rate Optimization**
- **Monitor both rate structures** for hedging opportunities
- **Time-of-use** available from both = load shifting
- **Public power** (GRDA) may offer cost advantages during peak periods

### 3. **Water Resilience**
- **Stillwater operations** unaffected by Grand Lake drought
- **Geographic separation** provides natural disaster protection
- **Dual water sources** = reduced single-point-of-failure risk

### 4. **Geographic Redundancy**
- **Pryor** (GRDA) and **Stillwater** (OG&E) are separate locations
- **Minimal service territory overlap** = true redundancy
- **Independent infrastructure** = reduced shared risk

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ GRDA Data Extraction                                        │
│ scripts/grda/firecrawl_capacity_extractor.py                │
│ → data/grda/firecrawl_capacity_data.json                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ OG&E Data Extraction                                        │
│ scripts/oge/firecrawl_capacity_extractor.py                │
│ → data/oge/firecrawl_capacity_data.json                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ Redundancy Analysis                                         │
│ Compare capacities, rates, territories, water sources      │
│ Generate strategic insights                                │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### Running Both Extractions

1. **Extract GRDA data:**
   ```bash
   cd scripts/grda
   python firecrawl_capacity_extractor.py
   python add_coordinates_to_capacity.py
   ```

2. **Extract OG&E data:**
   ```bash
   cd scripts/oge
   python firecrawl_capacity_extractor.py
   python add_coordinates_to_capacity.py
   ```

3. **Compare data:**
   - Load both JSON files
   - Compare `capacity_mix` totals
   - Compare `rates` structures
   - Analyze `service_territory` overlap
   - Evaluate `water_sources` independence

### Integration with Frontend

Both datasets can be integrated into the map visualization:

1. **GRDA markers** (already implemented):
   - Colored teardrops for GRDA facilities
   - Triggered by green OSM button
   - Shows capacity, fuel type, location

2. **OG&E markers** (future implementation):
   - Similar colored teardrops for OG&E facilities
   - Can be toggled alongside GRDA markers
   - Compare side-by-side for redundancy analysis

3. **Redundancy visualization**:
   - Show service territory boundaries
   - Highlight overlap areas (minimal)
   - Display rate comparisons
   - Map water source locations

## Key Takeaways

1. **True Redundancy**: Two utilities with minimal overlap provide genuine backup
2. **Capacity Safety**: OG&E's 5x larger capacity can fully backup GRDA
3. **Rate Flexibility**: Ability to switch utilities based on market conditions
4. **Water Resilience**: Stillwater's independence from Grand Lake provides drought protection
5. **Geographic Separation**: Different service territories reduce shared risk

## Related Documentation

- **GRDA extraction:** `scripts/grda/README.md`
- **OG&E extraction:** `scripts/oge/README.md`
- **Firecrawl flow:** `docs/FIRECRAWL_TO_MARKERS_FLOW.md`
- **GRDA markers:** `docs/GRDA_MARKER_GENERATION_README.md`

## Future Enhancements

1. **Rate comparison dashboard**: Real-time rate comparison between utilities
2. **Capacity monitoring**: Track available capacity from both utilities
3. **Water level tracking**: Monitor Grand Lake levels vs Stillwater aquifer
4. **Redundancy scoring**: Automated redundancy health score
5. **Cost optimization**: Algorithm to recommend utility switching based on rates

