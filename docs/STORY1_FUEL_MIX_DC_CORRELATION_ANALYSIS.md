# Fuel Mix vs Data Center Correlation Analysis

**Date:** December 2025  
**Purpose:** Test hypothesis - Do counties with data centers have gas capacity?

---

## Executive Summary

**Key Finding:** ⚠️ **WEAK CORRELATION** between gas % and data center count

**But:** Gas % is **1.91x higher** in counties WITH data centers (6.6% vs 3.5%)

**Correlation Coefficient:** 0.011 (essentially no correlation)

---

## Top 10 DC Counties - Fuel Mix Analysis

### 1. Dallas (13 DCs)
- **Total capacity:** 247 MW (0.25 GW) ⚠️ **LOW**
- **Gas:** 0% (0 MW)
- **Solar:** 0%
- **Renewable:** 0%
- **Baseload:** 0%
- **Analysis:** ⚠️ **LOW CAPACITY - Importing power** (likely importing gas from elsewhere)

### 2. Williamson (8 DCs)
- **Total capacity:** 0 MW ⚠️ **NO LOCAL CAPACITY**
- **Gas:** 0%
- **Solar:** 0%
- **Analysis:** 📥 **IMPORTING ALL POWER** (no local generation)

### 3. Bosque (5 DCs)
- **Total capacity:** 734 MW (0.73 GW)
- **Gas:** 0%
- **Solar:** 91.6%
- **Renewable:** 91.6%
- **Baseload:** 0%
- **Analysis:** 🌱 **RENEWABLE-DOMINANT** (solar, but note: Thad Hill Energy Center is gas, may not be in ERCOT data)

### 4. Ellis (4 DCs)
- **Total capacity:** 820 MW (0.82 GW)
- **Gas:** 0%
- **Solar:** 48.5%
- **Renewable:** 48.5%
- **Baseload:** 0%
- **Analysis:** 🌱 **RENEWABLE-DOMINANT** (solar)

### 5. El Paso (4 DCs)
- **Total capacity:** 0 MW ⚠️ **NO ERCOT DATA**
- **Note:** El Paso is in WECC, not ERCOT
- **Analysis:** Different grid system

### 6. Tarrant (3 DCs)
- **Total capacity:** 356 MW (0.36 GW) ⚠️ **LOW**
- **Gas:** 0%
- **Solar:** 0%
- **Analysis:** ⚠️ **LOW CAPACITY - Importing power**

### 7. Harris (3 DCs)
- **Total capacity:** 3,361 MW (3.36 GW) ✅ **HIGH**
- **Gas:** 55.0% (1,848 MW)
- **Solar:** 3.3%
- **Renewable:** 3.3%
- **Baseload:** 55.0%
- **Analysis:** 🎯 **GAS-DOMINANT** (has local gas capacity)

### 8. Collin (3 DCs)
- **Total capacity:** 846 MW (0.85 GW)
- **Gas:** 0%
- **Solar:** 0%
- **Analysis:** ⚠️ **MIXED/LOW** (capacity exists but fuel type unclear)

### 9. Bexar (3 DCs)
- **Total capacity:** 1,997 MW (2.00 GW) ✅ **HIGH**
- **Gas:** 0%
- **Solar:** 7.6%
- **Renewable:** 7.6%
- **Baseload:** 0%
- **Analysis:** ⚠️ **MIXED** (high capacity but low gas %)

### 10. Travis (3 DCs)
- **Total capacity:** 301 MW (0.30 GW) ⚠️ **LOW**
- **Gas:** 0%
- **Solar:** 0%
- **Analysis:** ⚠️ **LOW CAPACITY - Importing power**

---

## Pattern Analysis

### Counties with Gas Capacity
**Only 1 of 10:** Harris County (55% gas)

**Others:**
- Dallas: 0% gas, but low capacity (importing)
- Tarrant: 0% gas, but low capacity (importing)
- Williamson: 0% gas, no capacity (importing)
- Travis: 0% gas, low capacity (importing)

### Counties with High Renewable
- **Bosque:** 91.6% renewable (solar)
- **Ellis:** 48.5% renewable (solar)

### Counties Importing Power
- **Dallas:** 247 MW (very low for 13 DCs)
- **Williamson:** 0 MW (no local capacity)
- **Tarrant:** 356 MW (low for 3 DCs)
- **Travis:** 301 MW (low for 3 DCs)

---

## Correlation Analysis

### Correlation Coefficients (Pearson)

| Metric | Correlation | Interpretation |
|--------|-------------|----------------|
| Gas % vs DC count | 0.011 | ⚠️ **Weak/no correlation** |
| Solar % vs DC count | -0.170 | ⚠️ **Weak negative correlation** |
| Renewable % vs DC count | -0.212 | ⚠️ **Weak negative correlation** |
| Baseload % vs DC count | 0.011 | ⚠️ **Weak/no correlation** |
| Total capacity vs DC count | 0.010 | ⚠️ **Weak/no correlation** |

**Conclusion:** No strong correlation between fuel mix and data center locations.

---

## Average Comparison

### Counties WITH Data Centers (18 counties)
- **Avg Gas %:** 6.6%
- **Avg Solar %:** 28.0%
- **Avg Renewable %:** 42.5%
- **Avg Baseload %:** 6.6%
- **Avg Total Capacity:** 1,113 MW

### Counties WITHOUT Data Centers (137 counties)
- **Avg Gas %:** 3.5%
- **Avg Solar %:** 51.9%
- **Avg Renewable %:** 65.5%
- **Avg Baseload %:** 3.5%
- **Avg Total Capacity:** 868 MW

### Ratios
- **Gas %:** 1.91x higher in DC counties (6.6% vs 3.5%)
- **Solar %:** 0.54x (lower in DC counties - 28% vs 52%)
- **Baseload %:** 1.91x higher in DC counties (6.6% vs 3.5%)

---

## Key Insights

### 1. Gas Capacity Pattern

**Finding:** Gas % is 1.91x higher in DC counties, but correlation is weak (0.011)

**Explanation:**
- Most DC counties have **low or zero local gas capacity**
- They're **importing gas power** from elsewhere
- Only Harris County has significant local gas (55%)
- Dallas, Tarrant, Travis, Williamson all have low/no local capacity

### 2. Import Pattern

**Finding:** Many high-DC counties have low total capacity

**Examples:**
- Dallas: 13 DCs, only 247 MW local capacity
- Williamson: 8 DCs, 0 MW local capacity
- Tarrant: 3 DCs, 356 MW local capacity
- Travis: 3 DCs, 301 MW local capacity

**Implication:** These counties are **importing power** (likely gas) from other counties.

### 3. Renewable Pattern

**Finding:** Solar % is LOWER in DC counties (28% vs 52%)

**Examples:**
- Bosque: 91.6% renewable (but has DCs)
- Ellis: 48.5% renewable (but has DCs)
- Most DC counties: Low renewable %

**Implication:** Data centers may prefer areas with **baseload capacity** (gas) over pure renewable areas.

### 4. The "Gas = DCs" Hypothesis

**Test Result:** ⚠️ **PARTIALLY SUPPORTED**

**Evidence FOR:**
- Gas % is 1.91x higher in DC counties
- Baseload % is 1.91x higher in DC counties
- Many DC counties import gas power (low local capacity)

**Evidence AGAINST:**
- Weak correlation (0.011)
- Most DC counties have 0% local gas
- Some DC counties are renewable-dominant (Bosque, Ellis)

**Conclusion:** Data centers need **baseload power** (gas), but they don't necessarily need it **locally**. They can import it from other counties via the ERCOT grid.

---

## Implications for Story

### The Real Pattern

**Not:** "Counties with gas capacity have data centers"

**But:** "Data centers locate where they can **access baseload power** (gas), either locally or via grid imports"

**Examples:**
- **Dallas:** 13 DCs, 0% local gas, but imports gas power
- **Harris:** 3 DCs, 55% local gas (self-sufficient)
- **Bosque:** 5 DCs, 0% local gas, but near Thad Hill Energy Center (gas)

### Story Angle

"Data centers cluster in counties with **access to baseload power**, not necessarily counties that **generate it locally**. Dallas has 13 data centers but only 247 MW of local capacity - it's importing gas power from elsewhere. This reveals a **grid-level coordination problem**, not just a county-level one."

---

## Files Generated

- `data/analysis/story1_fuel_mix_dc_correlation.json` - Complete analysis data
- `docs/STORY1_FUEL_MIX_DC_CORRELATION_ANALYSIS.md` - This report

