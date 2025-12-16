# Hill County Data Discrepancy - Clarification

## The Issue

**Question:** Does Hill County have 2 DCs or 0 DCs?

**Answer:** Hill County has **2 DCs** (confirmed by point-in-polygon geocoding).

## Why the Confusion?

### Mismatch Analysis (Top 10 vs Top 10)
- **Scope:** Only compares **top 10 DC counties** vs **top 10 energy counties**
- **Hill's Ranking:**
  - DC counties: Hill is ranked #14 (2 DCs) - **NOT in top 10**
  - Energy counties: Hill is ranked #5 (3.2 GW) - **IS in top 10**
- **Result:** Hill classified as "energy-only" because it's not in the DC top 10
- **Note:** This is correct for the top-10 comparison, but misleading

### Winner Analysis (All Counties)
- **Scope:** Looks at **ALL counties** with DCs >= 1 AND surplus > 0
- **Result:** Hill correctly identified as a winner (2 DCs, 2.95 GW surplus)
- **Ranking:** Hill is #2 winner by composite score (5.90)

## The Data

**Hill County:**
- **DC Count:** 2 (confirmed by point-in-polygon)
- **DC Demand:** 0.28 GW
- **ERCOT Capacity:** 3.23 GW
- **Surplus:** 2.95 GW
- **Status:** Winner (has both DCs and surplus)

**DC Projects in Hill:**
1. "CyrusOne co: co" (location text incorrect, but coordinates in Hill)
2. "CyrusOne bosque county: bosque county" (location text says Bosque, but coordinates in Hill)

**Note:** The location text for these projects is incorrect/misleading, which is why point-in-polygon geocoding is essential.

## Resolution

The mismatch analysis has been updated to:
1. Note when a county in the "energy-only" list actually has DCs (just not in top 10)
2. Mark these counties with a warning: "⚠️ (has DCs but not in top 10)"

**Updated Output:**
```
⚠️  Energy-Only Counties (Energy but not in DC top 10):
   • Hill: 3,232 MW energy (17 projects), 2 DCs ⚠️ (has DCs but not in top 10)
```

## Key Takeaway

- **Mismatch Analysis:** Answers "Do top 10 DC counties overlap with top 10 energy counties?" → Hill not in DC top 10, so classified as energy-only
- **Winner Analysis:** Answers "Which counties have both DCs AND surplus?" → Hill is a winner

Both analyses are correct, but they answer different questions. Hill County is a **winner** (has both DCs and surplus), but it's not in the **top 10 DC counties** by count.

