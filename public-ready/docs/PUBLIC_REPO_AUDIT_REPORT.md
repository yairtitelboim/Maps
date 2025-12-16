# Public Repository Audit Report

**Date:** December 15, 2025  
**Project:** Infrastructure Arbitrage / Texas Energy & Data Center Analysis  
**Total Files Scanned:** 2,421  
**Total Size:** 7.7 GB

---

## Executive Summary

✅ **93.1% of files are public-ready** (2,253 files)  
⚠️ **168 files need cleaning** before public release  
🔐 **154 files contain potential secrets** (API keys, tokens, etc.)  
📦 **78 large files** (>10MB) that may need sampling or exclusion

---

## Key Findings

### 1. Files with Secrets (154 files)

**Most Common Issues:**
- API key patterns found in scripts and documentation
- Perplexity API keys (`pplx-*`) mentioned in docs
- Google API keys mentioned in test files
- Service account credentials in JSON files

**Top Offenders:**
- `scripts/audit_local_projects.py` - 45 potential secrets (mostly false positives from pattern matching)
- `docs/NEWS_FIRST_DISCOVERY_PIPELINE.md` - 31 potential secrets (mentions API keys in documentation)
- `docs/PRODUCTION_READINESS_PLAN.md` - 24 potential secrets
- `scripts/test-geocoding.js` - 17 potential secrets
- `public/gentle-cinema-458613-f3-b3edbc79c9a8.json` - 12 potential secrets (likely service account file)

**Action Required:**
1. **Remove or redact API keys** from all scripts and documentation
2. **Move service account JSON files** to `.env` or exclude from repo
3. **Replace actual keys** with placeholders like `YOUR_API_KEY_HERE` in docs
4. **Add `.env` files** to `.gitignore` if not already present

---

### 2. Large Files (78 files >10MB)

**Largest Files:**
- `public/Census_Block.shp` - **932.1 MB** ⚠️ (Should be excluded or hosted separately)
- `public/DukeTransmissionEasements.geojson` - **58.9 MB** (Consider sampling or compression)
- `docs/projectCostUpgrades.xml` - **19.5 MB** (Review if needed in public repo)
- `public/okc_census_tracts.geojson` - **19.1 MB** (May be acceptable if compressed)

**Action Required:**
1. **Exclude large shapefiles** (`.shp` files) - use GitHub LFS or host externally
2. **Sample or compress large GeoJSON files** - create smaller representative samples
3. **Move large data files** to external hosting (S3, GitHub Releases, etc.)
4. **Add large file patterns** to `.gitignore`

---

### 3. File Categories

| Category | Count | Public Ready | Notes |
|----------|-------|--------------|-------|
| Data Files | 1,348 | ~1,200 | Some contain secrets, some are large |
| Scripts | 555 | ~500 | Most safe, but some have API keys |
| Documentation | 365 | ~330 | Some docs mention API keys |
| Other | 144 | ~120 | Mixed - needs review |
| Map Visualizations | 9 | 9 | All safe |

---

## Recommended Public Repository Structure

```
infrastructure-arbitrage/          # PUBLIC REPO
├── README.md
├── LICENSE
├── .gitignore                     # Updated with secrets, large files
├── docs/
│   ├── methodology.md
│   ├── data-sources.md
│   ├── texas-datacenter-analysis/
│   │   ├── README.md
│   │   ├── findings.md
│   │   └── methodology.md
│   └── ercot-energy-analysis/
│       ├── README.md
│       └── findings.md
├── scripts/
│   ├── ercot/
│   │   ├── aggregate_by_county.py
│   │   └── merge_county_data.py
│   ├── news-output/
│   │   ├── extract_locations_from_articles.py  # Sanitized (no API keys)
│   │   └── check_coordinate_accuracy.py
│   └── osm-tools/
│       └── tx_ercot_energy_osm.py
├── data/
│   ├── ercot/
│   │   └── ercot_counties_aggregated.geojson   # Sample if large
│   └── analysis/
│       └── *.json                               # Analysis results only
├── public/
│   ├── data/
│   │   ├── texas_data_centers.geojson           # Public-ready
│   │   └── ercot/
│   │       └── ercot_counties_with_dc.geojson   # Public-ready
│   └── osm/
│       └── tx_ercot_energy.json                 # Public-ready
└── src/                                         # Frontend code (sanitized)
    └── components/
        └── Map/
            └── ...
```

---

## Cleaning Checklist

### Phase 1: Remove Secrets

- [ ] **Scan and redact API keys** from all scripts
  - Replace `pplx-*` with `YOUR_PERPLEXITY_API_KEY`
  - Replace Google API keys with `YOUR_GOOGLE_API_KEY`
  - Remove service account JSON files or move to `.env`

- [ ] **Update documentation** to use placeholders
  - Replace actual API keys in markdown files
  - Add instructions for setting up API keys in README

- [ ] **Remove sensitive files**
  - `public/gentle-cinema-458613-f3-b3edbc79c9a8.json` (service account)
  - Any `.env` files
  - Any files with actual credentials

### Phase 2: Handle Large Files

- [ ] **Exclude large shapefiles**
  - Add `*.shp`, `*.shx`, `*.dbf` to `.gitignore`
  - Document where to download these files separately

- [ ] **Sample or compress large GeoJSON**
  - Create representative samples (<10MB)
  - Use compression (gzip) for large files
  - Document full dataset location

- [ ] **Move to external hosting** (if needed)
  - GitHub Releases for large datasets
  - S3 or similar for very large files
  - Document download links

### Phase 3: Sanitize Scripts

- [ ] **Create sanitized versions** of scripts with API keys
  - Remove hardcoded keys
  - Use environment variables
  - Add `.env.example` template

- [ ] **Update test files**
  - Remove actual API keys
  - Use mock data or test fixtures
  - Document test setup

### Phase 4: Organize Structure

- [ ] **Move files to appropriate directories**
  - Consolidate scripts by purpose
  - Organize documentation by topic
  - Create clear README files

- [ ] **Update .gitignore**
  ```
  # Secrets
  .env
  .env.local
  *.json (service account files)
  **/gentle-cinema-*.json
  
  # Large files
  *.shp
  *.shx
  *.dbf
  *.prj
  **/Census_Block.*
  
  # Build artifacts
  node_modules/
  build/
  dist/
  __pycache__/
  ```

---

## Next Steps

1. **Review the audit file:** `local_projects_audit.json`
   ```bash
   # See files with secrets
   cat local_projects_audit.json | jq '.detailed_audit.subdirectories[].files[] | select(.has_secrets) | .path'
   
   # See large files
   cat local_projects_audit.json | jq '.detailed_audit.subdirectories[].files[] | select(.is_large) | {path, size_mb}'
   ```

2. **Create sanitization script** to automatically:
   - Replace API keys with placeholders
   - Sample large data files
   - Generate `.env.example` templates

3. **Set up public repo structure** based on recommendations above

4. **Test public repo** by cloning to a fresh directory and verifying:
   - No secrets are exposed
   - Large files are excluded
   - Documentation is clear
   - Scripts work with environment variables

---

## Files to Definitely Exclude

These files should **never** be in the public repo:

1. **Service Account Files:**
   - `public/gentle-cinema-458613-f3-b3edbc79c9a8.json`

2. **Large Shapefiles:**
   - `public/Census_Block.shp` (932 MB)
   - Any other `.shp` files

3. **Environment Files:**
   - `.env`
   - `.env.local`
   - Any file with actual API keys

4. **Build Artifacts:**
   - `node_modules/`
   - `build/`
   - `dist/`
   - `__pycache__/`

---

## Files Safe for Public Release

These categories are generally safe:

✅ **Documentation** (after redacting API keys)
✅ **Analysis scripts** (after removing hardcoded keys)
✅ **Public GeoJSON files** (if <10MB or sampled)
✅ **Frontend source code** (React components, etc.)
✅ **Configuration templates** (`.env.example`, etc.)

---

## Questions to Consider

1. **Do you want to include the full news pipeline database?**
   - Option A: Include sample (first 100 articles)
   - Option B: Exclude entirely, document schema
   - Option C: Host separately

2. **How to handle large GeoJSON files?**
   - Option A: Sample to representative subset
   - Option B: Compress and host on GitHub Releases
   - Option C: External hosting (S3, etc.)

3. **What about proprietary data sources?**
   - Clearly mark what's public vs. what requires access
   - Document data sources and licensing

---

## Summary

Your project is **93% public-ready**, which is excellent! The main work is:

1. **Remove/redact 154 files with secrets** (mostly API keys in docs/scripts)
2. **Handle 78 large files** (exclude or sample)
3. **Organize structure** for clarity
4. **Create sanitization workflow** for future updates

Once these are done, you'll have a clean, professional public repository ready for GitHub! 🚀

