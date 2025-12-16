# Fuel Mix Correlation Analysis - Gas % → DC Count

## Executive Summary

**Weak correlation found: Counties with gas are 1.7x more likely to have DCs, but most top DC counties have NO gas.**

This suggests **metro characteristics matter more than local energy fuel mix** for DC location decisions.

---

## 1. Top 10 DC Counties - Fuel Mix

| County   | DC Count | Energy GW | Gas % | Solar % | Baseload % | Has Gas? |
|----------|----------|-----------|-------|---------|------------|----------|
| Dallas   | 13       | 0.25      | 0.0%  | 0.0%    | 0.0%       | ❌ No    |
| Bosque   | 5        | 0.73      | 0.0%  | 91.6%   | 0.0%       | ❌ No    |
| Ellis    | 4        | 0.82      | 0.0%  | 48.5%   | 0.0%       | ❌ No    |
| Bexar    | 3        | 2.00      | 0.0%  | 7.6%    | 0.0%       | ❌ No    |
| Harris   | 3        | 3.36      | 55.0% | 3.3%    | 55.0%      | ✅ Yes   |
| Tarrant  | 3        | 0.36      | 0.0%  | 0.0%    | 0.0%       | ❌ No    |
| Collin   | 3        | 0.30      | 0.0%  | 0.0%    | 0.0%       | ❌ No    |
| Travis   | 3        | 0.30      | 0.0%  | 0.0%    | 0.0%       | ❌ No    |
| McLennan | 2        | 1.62      | 0.0%  | 62.2%   | 0.0%       | ❌ No    |
| Bastrop  | 2        | 0.61      | 3.4%  | 66.1%   | 3.4%       | ✅ Yes   |

**Key Finding: Only 2/10 (20%) of top DC counties have gas.**

**Notable:**
- **Dallas (13 DCs):** NO gas, NO solar, NO wind (0% generation). Only 247 MW battery storage (doesn't generate power). 2.18 GW shortfall (imports power).
- **Harris (3 DCs):** 55% gas, 55% baseload (only major metro with gas)
- **Most top DC counties:** Renewable-only or minimal energy

---

## 2. Top 10 Energy Counties - Fuel Mix vs DC Count

| County     | Energy GW | Gas % | Solar % | DC Count | Has DCs? |
|------------|-----------|-------|---------|----------|----------|
| Brazoria   | 9.54      | 4.8%  | 37.6%   | 0        | ❌ No    |
| Wharton    | 4.65      | 2.0%  | 62.7%   | 0        | ❌ No    |
| Lamar      | 3.66      | 0.0%  | 74.6%   | 0        | ❌ No    |
| **Harris** | **3.36**  | **55.0%** | **3.3%** | **3** | **✅ Yes** |
| **Hill**   | **3.23**  | **0.0%** | **66.4%** | **2** | **✅ Yes** |
| Navarro    | 3.12      | 0.0%  | 63.5%   | 0        | ❌ No    |
| Haskell    | 3.00      | 0.0%  | 56.0%   | 0        | ❌ No    |
| Fort Bend  | 2.90      | 14.1% | 30.6%   | 0        | ❌ No    |
| Borden     | 2.86      | 0.0%  | 63.1%   | 0        | ❌ No    |
| Deaf Smith | 2.67      | 0.0%  | 76.7%   | 0        | ❌ No    |

**Key Finding: Only 2/10 (20%) of top energy counties have DCs.**

**Notable:**
- **Brazoria (9.54 GW):** Massive energy, minimal gas (4.8%), NO DCs
- **Harris (3.36 GW):** 55% gas, 3 DCs (only hybrid in top 10)
- **Hill (3.23 GW):** 0% gas, 76% solar, 2 DCs (renewable-only, but has DCs)

---

## 3. Correlation: Gas % → DC Count

### By Gas Percentage Range

| Gas % Range    | Counties | Avg DC Count | Counties w/ DCs | % w/ DCs |
|----------------|----------|--------------|-----------------|----------|
| 0% (No Gas)    | 139      | 0.32         | 15              | 10.8%    |
| 1-25% Gas      | 9        | 0.22         | 1               | 11.1%    |
| 26-50% Gas     | 1        | 0.00         | 0               | 0.0%     |
| **51-75% Gas** | **3**    | **1.33**     | **2**           | **66.7%** |
| 76-100% Gas    | 3        | 0.00         | 0               | 0.0%     |

**Key Finding: Counties with 51-75% gas have highest DC rate (66.7%).**

**But:**
- Only 3 counties in this range (small sample)
- Counties with 76-100% gas have 0% DC rate (0/3)

---

## 4. Detailed Correlation Analysis

### Counties WITH Gas
- **Total counties:** 16
- **Counties with DCs:** 3 (18.8%)
- **Avg DC count:** 0.38
- **Avg gas %:** 37.2%

### Counties WITHOUT Gas
- **Total counties:** 139
- **Counties with DCs:** 15 (10.8%)
- **Avg DC count:** 0.32

**Correlation: Counties with gas are 1.7x more likely to have DCs (18.8% vs 10.8%)**

---

## 5. Hypothesis B Test

**Hypothesis B: Counties with baseload (gas) power are more likely to have DCs.**

**Result: ✅ WEAKLY SUPPORTED**

- Counties WITH gas: 18.8% have DCs
- Counties WITHOUT gas: 10.8% have DCs
- **Ratio: 1.7x more likely**

**But:**
- Most top DC counties (8/10) have NO gas
- Dallas (13 DCs) has NO energy infrastructure at all
- Metro characteristics appear to matter more

---

## 6. Key Insights

### 1. Gas Helps, But Not Required
- Counties with gas are 1.7x more likely to have DCs
- But 8/10 top DC counties have NO gas
- Suggests gas is helpful but not necessary

### 2. Metro Characteristics Matter More
- **Dallas (13 DCs):** NO gas, NO solar, NO wind (0% generation). Only 247 MW battery storage. 2.18 GW shortfall (imports all power).
- **Tarrant, Collin, Travis:** Metro counties with DCs, minimal energy
- **Conclusion:** Metro characteristics (talent, customers, fiber) matter more than local energy fuel mix. Metro counties can import power.

### 3. Energy Counties Don't Attract DCs
- Only 2/10 top energy counties have DCs
- Most energy counties are rural (no metro characteristics)
- **Conclusion:** Energy alone is not enough; metro characteristics are required

### 4. Harris is Exception
- **Harris:** 55% gas, 3 DCs (only major metro with significant gas)
- **Other metros:** Dallas, Tarrant, Collin, Travis have NO gas
- **Conclusion:** Harris is unique (metro + energy hub)

### 5. Hill is Anomaly
- **Hill:** 0% gas, 76% solar, 2 DCs
- **Most renewable-only counties:** 0 DCs
- **Conclusion:** Hill may have other factors (proximity to Dallas, specific projects)

---

## 7. Revised Understanding

### Original Hypothesis B
**"Counties with baseload (gas) power are more likely to have DCs."**

### Findings
1. ✅ **Weak correlation:** Gas counties are 1.7x more likely to have DCs
2. ❌ **But most top DC counties have NO gas** (8/10)
3. ✅ **Metro characteristics matter more** (Dallas has 0% generation, imports all power)
4. ✅ **Energy alone is not enough** (most energy counties have 0 DCs)

### Revised Hypothesis
**"Metro characteristics (talent, customers, fiber) are the primary driver of DC location decisions. Local energy fuel mix (gas vs renewable) is secondary. Counties with gas are slightly more likely to have DCs, but most DCs are in metro counties that can import power."**

---

## 8. What This Means for Hypothesis B

### Hypothesis B (Original)
**"Counties specialize into producers OR consumers. Coordination = transmission between specialized counties."**

### Fuel Mix Correlation
- **Weak support:** Gas counties are 1.7x more likely to have DCs
- **But:** Most top DC counties have NO gas (metro counties import power)
- **Conclusion:** Metro counties can be consumers even without local baseload power

### Updated Understanding
**"Metro counties (consumers) can import power from producer counties via transmission. Local baseload (gas) helps but is not required. The key is metro characteristics (talent, customers, fiber), not local energy fuel mix."**

**This supports Hypothesis B:**
- Metro counties (consumers) don't need local baseload power
- They can import from producer counties (specialization)
- Transmission enables this coordination

---

## 9. Key Takeaways

1. **Gas helps but not required:** Counties with gas are 1.7x more likely to have DCs, but most top DC counties have NO gas

2. **Metro characteristics matter more:** Dallas (13 DCs) has NO energy infrastructure; metro characteristics drive DC location

3. **Energy alone is not enough:** Most top energy counties have 0 DCs (rural, no metro characteristics)

4. **Harris is exception:** Only major metro with significant gas (55%); unique hybrid

5. **Transmission enables specialization:** Metro counties can import power from producer counties

---

## Conclusion

**The fuel mix correlation is weak but present. Metro characteristics are the primary driver of DC location decisions. Local baseload (gas) power helps but is not required, as metro counties can import power via transmission.**

**This supports Hypothesis B: Counties specialize, and transmission enables coordination between specialized counties.**

