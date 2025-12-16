# Overlap Analysis: Markers and Labels

**Date:** 2025-12-12  
**Issue:** Overlapping markers and text labels

---

## 🔍 Findings

### **Exact Coordinate Overlaps (Same Lat/Lng)**

| Location | Count | Coordinates | Projects |
|----------|-------|-------------|----------|
| **Taylor/Austin Area** | 7 | (30.2711, -97.7437) | Multiple projects |
| **Dallas Area** | 7 | (32.7763, -96.7969) | Multiple projects |
| **San Antonio** | 5 | (29.4246, -98.4951) | Microsoft, CyrusOne, Unknown |
| **Fort Worth** | 5 | (32.7532, -97.3327) | Multiple projects |
| **El Paso** | 4 | (31.7601, -106.4870) | Meta, Oracle projects |
| **Bosque County** | 4 | (31.8778, -97.6561) | CyrusOne, Unknown |
| **Shackelford County** | 4 | (32.7089, -99.3308) | Vantage, Oracle |

**Total:** 36 projects share exact coordinates with at least one other project

### **Very Close Markers (< 0.01 degrees)**

- **98 pairs** of markers are within 0.01 degrees (~1km) of each other
- Many are exact duplicates (0.000000 degrees apart)

### **Geographic Clustering**

- **12 clusters** with multiple projects in the same geographic bin (0.1 degree = ~11km)
- Top cluster: **8 projects** in Dallas area (32.8, -96.8)
- Second: **7 projects** in Taylor/Austin area (30.3, -97.7)

---

## 🎯 Root Causes

### 1. **Imprecise Geocoding**
- Many projects geocoded to **city center** instead of specific address
- Examples:
  - All San Antonio projects → same coordinates
  - All Dallas projects → same coordinates
  - All El Paso projects → same coordinates

### 2. **Entity Resolution Issues**
- Multiple articles about the same project may have been treated as separate projects
- Example: Multiple Microsoft San Antonio projects at same location

### 3. **Label Overlap**
- With `text-allow-overlap: true` and `text-ignore-placement: true`, labels stack on top of each other
- No spacing or offset logic for overlapping labels

---

## 🔧 Solutions

### **Immediate Fixes:**

1. **Add Small Random Offsets for Overlapping Markers**
   - Detect exact coordinate matches
   - Apply small random offset (0.001-0.005 degrees) to separate markers
   - Preserve original coordinates in properties

2. **Improve Label Placement**
   - Use `text-variable-anchor` to try multiple positions
   - Add `text-radial-offset` for better spacing
   - Consider showing labels only at higher zoom levels

3. **Marker Clustering**
   - Use Mapbox clustering for very close markers
   - Show cluster count when zoomed out
   - Expand clusters when zoomed in

### **Long-Term Fixes:**

1. **Improve Geocoding Precision**
   - Extract specific addresses from articles
   - Use site hints more effectively
   - Cross-reference with permit/zoning data

2. **Better Entity Resolution**
   - Merge projects at same location with same company
   - Review duplicate projects manually

3. **Smart Label Display**
   - Only show labels at zoom > 10
   - Use priority system (recent = higher priority)
   - Implement label collision detection

---

## 📊 Impact

- **36 projects** (44% of total) have exact coordinate overlaps
- **98 pairs** of very close markers causing visual clutter
- **Labels stacking** on top of each other, making them unreadable

---

**Priority:** HIGH - Affects map usability and data accuracy

