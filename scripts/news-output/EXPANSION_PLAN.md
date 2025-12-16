# Texas Data Centers Discovery Pipeline - Expansion Plan

**Date:** 2025-12-12  
**Current State:** 44 geocoded projects  
**Target:** 75-100 projects (50-70% market coverage)  
**Stretch Goal:** 100-150 projects (70-100% market coverage)

---

## 📋 Executive Summary

This plan outlines a systematic approach to expand the Texas data centers database from **44 projects** to **75-100+ projects** by:
1. Adding missing major company queries
2. Expanding geographic coverage
3. Adding specialized query types
4. Implementing phased rollout with validation

---

## 🎯 Phase 1: Missing Major Companies (HIGH PRIORITY)

**Goal:** Add 20-30 projects from major operators we're currently missing  
**Timeline:** 1-2 days  
**Expected Impact:** +20-30 projects

### Companies to Add

#### 1. Equinix (Priority: CRITICAL)
- **Why:** Largest colocation provider globally, likely 10+ facilities in Texas
- **Queries:**
  ```json
  {
    "company": "Equinix",
    "queries": [
      "Equinix data center Texas",
      "Equinix IBX Texas",
      "Equinix colocation Texas",
      "Equinix Dallas",
      "Equinix Austin",
      "Equinix Houston"
    ]
  }
  ```

#### 2. Vantage Data Centers (Priority: HIGH)
- **Why:** Rapidly growing AI-focused operator, announced major Texas projects
- **Queries:**
  ```json
  {
    "company": "Vantage",
    "queries": [
      "Vantage Data Centers Texas",
      "Vantage AI campus Texas",
      "Vantage Frontier Texas",
      "Vantage Shackelford County"
    ]
  }
  ```

#### 3. STACK Infrastructure (Priority: HIGH)
- **Why:** Major hyperscale operator, expanding in Texas
- **Queries:**
  ```json
  {
    "company": "STACK",
    "queries": [
      "STACK Infrastructure Texas",
      "STACK data center Texas",
      "STACK hyperscale Texas"
    ]
  }
  ```

#### 4. Switch (Priority: MEDIUM)
- **Why:** Enterprise-focused operator with Texas presence
- **Queries:**
  ```json
  {
    "company": "Switch",
    "queries": [
      "Switch data center Texas",
      "Switch Las Vegas Texas expansion"
    ]
  }
  ```

#### 5. CoreWeave (Priority: HIGH)
- **Why:** AI/ML focused, rapid expansion, likely Texas projects
- **Queries:**
  ```json
  {
    "company": "CoreWeave",
    "queries": [
      "CoreWeave data center Texas",
      "CoreWeave AI Texas",
      "CoreWeave GPU cluster Texas"
    ]
  }
  ```

#### 6. Additional Regional Operators (Priority: MEDIUM)
- **TierPoint:** "TierPoint data center Texas"
- **Flexential:** "Flexential data center Texas"
- **DataBank:** "DataBank data center Texas"
- **Cologix:** "Cologix data center Texas"

**Total Phase 1 Queries:** ~25-30 new queries  
**Expected Results:** +20-30 projects

---

## 🗺️ Phase 2: Geographic Expansion (HIGH PRIORITY)

**Goal:** Add 15-25 projects from geographic-specific searches  
**Timeline:** 1-2 days  
**Expected Impact:** +15-25 projects

### Major Cities (Priority: HIGH)

#### Dallas Metro Area
```json
{
  "region": "Dallas Metro",
  "queries": [
    "data center Dallas",
    "data center Fort Worth",
    "data center Plano",
    "data center Frisco",
    "data center Richardson",
    "data center Irving",
    "hyperscale Dallas",
    "data center Collin County"
  ]
}
```

#### Austin Metro Area
```json
{
  "region": "Austin Metro",
  "queries": [
    "data center Austin",
    "data center Round Rock",
    "data center Cedar Park",
    "data center Pflugerville",
    "data center Williamson County",
    "hyperscale Austin"
  ]
}
```

#### San Antonio Metro Area
```json
{
  "region": "San Antonio Metro",
  "queries": [
    "data center San Antonio",
    "data center New Braunfels",
    "data center Bexar County",
    "hyperscale San Antonio"
  ]
}
```

#### Houston Metro Area
```json
{
  "region": "Houston Metro",
  "queries": [
    "data center Houston",
    "data center Sugar Land",
    "data center Katy",
    "data center Harris County",
    "hyperscale Houston"
  ]
}
```

### Key Counties (Priority: MEDIUM)
- **Collin County:** Major data center hub
- **Denton County:** Growing tech corridor
- **Tarrant County:** Fort Worth area
- **Williamson County:** Austin suburbs
- **Travis County:** Austin core
- **Bexar County:** San Antonio

### Secondary Cities (Priority: LOW)
- El Paso, Lubbock, Amarillo
- Midland, Odessa (oil & gas data centers)
- Temple, Killeen (Central Texas)

**Total Phase 2 Queries:** ~30-40 new queries  
**Expected Results:** +15-25 projects

---

## 🔍 Phase 3: Query Type Expansion (MEDIUM PRIORITY)

**Goal:** Add 10-20 projects from specialized query types  
**Timeline:** 1 day  
**Expected Impact:** +10-20 projects

### Size-Based Queries
```json
{
  "type": "size_based",
  "queries": [
    "500 MW data center Texas",
    "1 GW data center Texas",
    "hyperscale campus Texas",
    "megawatt data center Texas",
    "gigawatt campus Texas"
  ]
}
```

### Phase-Based Queries
```json
{
  "type": "phase_based",
  "queries": [
    "data center breaking ground Texas",
    "data center groundbreaking Texas",
    "data center construction start Texas",
    "data center ground breaking Texas"
  ]
}
```

### Regulatory Queries
```json
{
  "type": "regulatory",
  "queries": [
    "ERCOT interconnection data center",
    "data center power purchase agreement Texas",
    "data center PPA Texas",
    "data center interconnection queue Texas"
  ]
}
```

### Infrastructure Queries
```json
{
  "type": "infrastructure",
  "queries": [
    "data center substation Texas",
    "data center transmission line Texas",
    "data center power infrastructure Texas",
    "data center electrical infrastructure Texas"
  ]
}
```

### Economic Development Queries
```json
{
  "type": "economic",
  "queries": [
    "$1 billion data center Texas",
    "data center tax incentive Texas",
    "data center economic development Texas",
    "data center investment Texas"
  ]
}
```

**Total Phase 3 Queries:** ~20-25 new queries  
**Expected Results:** +10-20 projects

---

## 📅 Phase 4: Time-Based Expansion (LOW PRIORITY)

**Goal:** Add 5-15 projects from historical and future searches  
**Timeline:** 1 day  
**Expected Impact:** +5-15 projects

### Historical Queries
```json
{
  "type": "historical",
  "queries": [
    "data center Texas 2023",
    "data center Texas 2022",
    "data center Texas 2021",
    "data center announcement Texas 2020"
  ]
}
```

### Future Queries
```json
{
  "type": "future",
  "queries": [
    "data center Texas 2026",
    "data center Texas 2027",
    "planned data center Texas"
  ]
}
```

**Total Phase 4 Queries:** ~10-15 new queries  
**Expected Results:** +5-15 projects

---

## 🎯 Phase 5: Specialized Searches (LOW PRIORITY)

**Goal:** Add 5-10 projects from niche categories  
**Timeline:** 1 day  
**Expected Impact:** +5-10 projects

### AI/ML Specific
```json
{
  "type": "ai_ml",
  "queries": [
    "AI training facility Texas",
    "GPU cluster Texas",
    "NVIDIA data center Texas",
    "machine learning data center Texas",
    "AI data center campus Texas"
  ]
}
```

### Edge Computing
```json
{
  "type": "edge",
  "queries": [
    "edge data center Texas",
    "5G edge Texas",
    "edge computing facility Texas"
  ]
}
```

### Renewable Energy
```json
{
  "type": "renewable",
  "queries": [
    "solar-powered data center Texas",
    "renewable energy data center Texas",
    "green data center Texas"
  ]
}
```

**Total Phase 5 Queries:** ~10-15 new queries  
**Expected Results:** +5-10 projects

---

## 📊 Implementation Plan

### Step 1: Update Query Configuration
**File:** `config/news_queries.json`  
**Action:** Add all Phase 1-2 queries (highest priority)  
**Time:** 30 minutes

### Step 2: Run Batch Ingestion
**Script:** `scripts/news-ingest/batch_fetcher.py`  
**Action:** Fetch articles for all new queries  
**Time:** 2-4 hours (with rate limiting)

### Step 3: Process Pipeline
**Scripts:**
1. `scripts/news-process/deduplicate.py`
2. `scripts/news-process/classify.py`
3. `scripts/news-process/extract_project_cards.py`
4. `scripts/news-process/entity_resolution.py`
5. `scripts/news-process/status_tracking.py`

**Time:** 30-60 minutes

### Step 4: Geocode New Projects
**Script:** `scripts/news-output/clean_and_geocode.py`  
**Action:** Geocode all new projects  
**Time:** 30-60 minutes

### Step 5: Export and Validate
**Script:** `scripts/news-output/export_projects_geojson.py`  
**Action:** Export updated GeoJSON  
**Time:** 5 minutes

### Step 6: Quality Check
**Action:** Review new projects, verify coordinates, check for duplicates  
**Time:** 1-2 hours

---

## 🎯 Success Metrics

### Phase 1 (Missing Companies)
- **Target:** +20-30 projects
- **Success Criteria:** 
  - At least 5 Equinix projects
  - At least 3 Vantage projects
  - At least 2 STACK projects
  - At least 1 CoreWeave project

### Phase 2 (Geographic Expansion)
- **Target:** +15-25 projects
- **Success Criteria:**
  - Projects in Dallas metro (5+)
  - Projects in Austin metro (3+)
  - Projects in San Antonio metro (2+)
  - Projects in Houston metro (2+)

### Phase 3-5 (Specialized Queries)
- **Target:** +20-45 projects total
- **Success Criteria:**
  - Diverse query types returning results
  - No significant duplicate rate increase

### Overall Goals
- **Short-term (1 week):** 75 projects (Phase 1 + Phase 2)
- **Medium-term (2 weeks):** 90-100 projects (All phases)
- **Long-term (1 month):** 100-150 projects (with refinement)

---

## ⚠️ Risk Mitigation

### Duplicate Detection
- **Risk:** New queries may return articles we already have
- **Mitigation:** Existing deduplication logic should handle this
- **Validation:** Check duplicate rate after Phase 1

### Geocoding Quality
- **Risk:** New projects may have poor location data
- **Mitigation:** Use `clean_and_geocode.py` with fallback strategies
- **Validation:** Manual review of geocoding confidence scores

### API Rate Limits
- **Risk:** SerpAPI may throttle requests
- **Mitigation:** 
  - Batch queries in groups of 10
  - Add delays between batches
  - Monitor API usage

### Data Quality
- **Risk:** Lower quality articles from new queries
- **Mitigation:** 
  - Classification rules should filter noise
  - Manual review of Phase 1 results before Phase 2

---

## 📝 Recommended Rollout Schedule

### Week 1: Phase 1 + Phase 2 (HIGH PRIORITY)
- **Day 1:** Add Phase 1 queries (missing companies)
- **Day 2:** Run ingestion and processing
- **Day 3:** Add Phase 2 queries (geographic expansion)
- **Day 4:** Run ingestion and processing
- **Day 5:** Quality check and validation

**Expected Result:** 75-85 projects

### Week 2: Phase 3-5 (MEDIUM/LOW PRIORITY)
- **Day 1:** Add Phase 3 queries (query type expansion)
- **Day 2:** Run ingestion and processing
- **Day 3:** Add Phase 4-5 queries (time-based + specialized)
- **Day 4:** Run ingestion and processing
- **Day 5:** Quality check and validation

**Expected Result:** 90-110 projects

### Week 3: Refinement
- Review all projects
- Fix geocoding issues
- Merge duplicates
- Update status tracking
- Export final dataset

**Expected Result:** 100-120 projects (high quality)

---

## 🔄 Continuous Improvement

### Weekly Maintenance
- Run batch fetcher for all queries (catch new announcements)
- Process new articles through pipeline
- Update geocoding for projects without coordinates
- Review and merge duplicates

### Monthly Review
- Analyze query performance (which queries return most results)
- Remove low-performing queries
- Add new queries based on industry trends
- Update company list based on market changes

### Quarterly Audit
- Review all projects for accuracy
- Update status tracking
- Verify coordinates
- Export comprehensive dataset

---

## 📈 Expected Outcomes

### Conservative Estimate
- **Phase 1:** +20 projects → **64 total**
- **Phase 2:** +15 projects → **79 total**
- **Phase 3-5:** +15 projects → **94 total**

### Optimistic Estimate
- **Phase 1:** +30 projects → **74 total**
- **Phase 2:** +25 projects → **99 total**
- **Phase 3-5:** +30 projects → **129 total**

### Realistic Target
- **After Week 1:** 75-85 projects
- **After Week 2:** 90-110 projects
- **After Week 3:** 100-120 projects (refined)

---

## ✅ Next Steps

1. **Immediate:** Update `config/news_queries.json` with Phase 1 queries
2. **Today:** Run batch ingestion for Phase 1
3. **Tomorrow:** Process and validate Phase 1 results
4. **This Week:** Complete Phase 1 + Phase 2
5. **Next Week:** Complete Phase 3-5

**Ready to proceed?** Start with Phase 1 (missing companies) for highest impact.

