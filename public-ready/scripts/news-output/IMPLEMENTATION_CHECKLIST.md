# Database Expansion Implementation Checklist

**Based on:** `EXPANSION_PLAN.md`  
**Current State:** 44 geocoded projects  
**Target:** 75-100 projects

---

## ✅ Phase 1: Missing Major Companies (HIGH PRIORITY)

### Step 1: Update Query Configuration
- [ ] Backup current `config/news_queries.json`
- [ ] Review `config/news_queries_expanded.json` (already created)
- [ ] Merge Phase 1 company queries into main config
- [ ] Verify all Equinix queries (6 queries)
- [ ] Verify all Vantage queries (4 queries)
- [ ] Verify STACK, Switch, CoreWeave queries
- [ ] Add regional operators (TierPoint, Flexential, DataBank, Cologix)

### Step 2: Run Batch Ingestion
- [ ] Run `scripts/news-ingest/batch_fetcher.py` with new queries
- [ ] Monitor API rate limits
- [ ] Verify articles are being saved to database
- [ ] Check for errors in ingestion logs

### Step 3: Process Pipeline
- [ ] Run `scripts/news-process/deduplicate.py`
- [ ] Run `scripts/news-process/classify.py`
- [ ] Run `scripts/news-process/extract_project_cards.py`
- [ ] Run `scripts/news-process/entity_resolution.py`
- [ ] Run `scripts/news-process/status_tracking.py`

### Step 4: Validate Phase 1 Results
- [ ] Count new projects discovered
- [ ] Verify at least 5 Equinix projects
- [ ] Verify at least 3 Vantage projects
- [ ] Verify at least 2 STACK projects
- [ ] Check for duplicates
- [ ] Review data quality

**Expected Result:** +20-30 projects → **64-74 total projects**

---

## ✅ Phase 2: Geographic Expansion (HIGH PRIORITY)

### Step 1: Add Geographic Queries
- [ ] Add Dallas Metro queries (7 queries)
- [ ] Add Austin Metro queries (6 queries)
- [ ] Add San Antonio Metro queries (2 queries)
- [ ] Add Houston Metro queries (3 queries)
- [ ] Update `config/news_queries.json`

### Step 2: Run Batch Ingestion
- [ ] Run batch fetcher for geographic queries
- [ ] Monitor for geographic-specific results

### Step 3: Process and Validate
- [ ] Run full pipeline
- [ ] Verify projects in Dallas metro (target: 5+)
- [ ] Verify projects in Austin metro (target: 3+)
- [ ] Verify projects in San Antonio metro (target: 2+)
- [ ] Verify projects in Houston metro (target: 2+)

**Expected Result:** +15-25 projects → **79-99 total projects**

---

## ✅ Phase 3: Query Type Expansion (MEDIUM PRIORITY)

### Step 1: Add Specialized Queries
- [ ] Add size-based queries (already in expanded config)
- [ ] Add phase-based queries (already in expanded config)
- [ ] Add regulatory queries (already in expanded config)
- [ ] Add infrastructure queries
- [ ] Add economic development queries

### Step 2: Run and Validate
- [ ] Run batch ingestion
- [ ] Process pipeline
- [ ] Verify diverse query types returning results

**Expected Result:** +10-20 projects → **89-119 total projects**

---

## ✅ Phase 4: Geocoding and Quality Assurance

### Step 1: Geocode New Projects
- [ ] Run `scripts/news-output/clean_and_geocode.py`
- [ ] Verify geocoding success rate
- [ ] Check for projects outside Texas bounds
- [ ] Run `scripts/news-output/fix_geocoding.py` if needed

### Step 2: Export and Validate
- [ ] Run `scripts/news-output/export_projects_geojson.py`
- [ ] Verify GeoJSON file updated
- [ ] Check marker count matches database
- [ ] Test markers on map

### Step 3: Quality Review
- [ ] Review all new projects manually
- [ ] Verify company names are correct
- [ ] Verify locations are accurate
- [ ] Check for duplicate projects
- [ ] Update status tracking where needed

---

## ✅ Phase 5: Continuous Improvement

### Weekly Maintenance
- [ ] Run batch fetcher for all queries (catch new announcements)
- [ ] Process new articles through pipeline
- [ ] Update geocoding for projects without coordinates
- [ ] Review and merge duplicates
- [ ] Update status tracking

### Monthly Review
- [ ] Analyze query performance
- [ ] Remove low-performing queries
- [ ] Add new queries based on industry trends
- [ ] Update company list

---

## 📊 Success Metrics Tracking

### Current State
- [ ] Document: 44 geocoded projects
- [ ] Document: 52 total projects
- [ ] Document: 276 articles ingested

### Phase 1 Targets
- [ ] Target: +20-30 projects
- [ ] Minimum: 5 Equinix projects
- [ ] Minimum: 3 Vantage projects
- [ ] Minimum: 2 STACK projects

### Phase 2 Targets
- [ ] Target: +15-25 projects
- [ ] Minimum: 5 projects in Dallas metro
- [ ] Minimum: 3 projects in Austin metro

### Overall Targets
- [ ] Short-term: 75 projects
- [ ] Medium-term: 90-100 projects
- [ ] Long-term: 100-120 projects

---

## 🚨 Risk Mitigation Checklist

### Duplicate Detection
- [ ] Verify deduplication logic working
- [ ] Check duplicate rate after Phase 1
- [ ] Review merge suggestions

### Geocoding Quality
- [ ] Monitor geocoding confidence scores
- [ ] Review projects with low confidence
- [ ] Manually fix critical geocoding errors

### API Rate Limits
- [ ] Monitor SerpAPI usage
- [ ] Add delays between batches if needed
- [ ] Track API costs

### Data Quality
- [ ] Review classification accuracy
- [ ] Check for false positives
- [ ] Verify company name extraction

---

## 📝 Notes and Observations

### Phase 1 Notes
- Date started: ___________
- Date completed: ___________
- New projects found: ___________
- Issues encountered: ___________

### Phase 2 Notes
- Date started: ___________
- Date completed: ___________
- New projects found: ___________
- Issues encountered: ___________

### Overall Notes
- Total time invested: ___________
- Most effective queries: ___________
- Least effective queries: ___________
- Recommendations: ___________

---

## 🎯 Next Steps After Completion

1. [ ] Review all projects for accuracy
2. [ ] Update status tracking for all projects
3. [ ] Export final comprehensive dataset
4. [ ] Create visualization/dashboard
5. [ ] Document lessons learned
6. [ ] Plan next expansion phase

