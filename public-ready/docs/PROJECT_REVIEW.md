# OKC Project Review & GitHub Preparation

**Date:** January 2025  
**Project Path:** `/Users/yairtitelboim/Documents/Kernel/ALLAPPS/OKC`

---

## 1. PROJECT ORGANIZATION ASSESSMENT

### Overall Organization: **MODERATE** (6/10)

#### ✅ **Strengths:**
- **Good documentation**: 227 markdown files providing context and guides
- **Clear structure**: Separated `src/`, `scripts/`, `data/`, `public/` directories
- **Configuration management**: Centralized config files (`geographicConfig.js`, etc.)
- **Component organization**: React components well-structured in `src/components/Map/`

#### ❌ **Weaknesses:**
- **Excessive test files**: 77+ test files scattered in root directory
- **Duplicate files**: Multiple copies of tools (`OsmTool copy.js`, `OsmTool copy 2.js`, `PerplexityTool copy.mjs`)
- **Mixed concerns**: Root directory cluttered with scripts, test files, and documentation
- **Inconsistent naming**: Mix of snake_case, kebab-case, and camelCase
- **No clear separation**: Production code mixed with development/test artifacts

#### 📊 **Organization Breakdown:**
```
Root Directory Issues:
- 77+ test files (test_*.js, test_*.html, test_*.py)
- 5 video files (.mov) - should not be in repo
- Multiple duplicate/backup files
- Scripts scattered across root and scripts/ directory
- Documentation files mixed with code
```

**Recommendations:**
1. Move all test files to `tests/` or `__tests__/` directory
2. Remove duplicate/backup files (`.bak`, `copy.js`, etc.)
3. Organize scripts into subdirectories by purpose
4. Create `docs/` directory for all markdown documentation
5. Remove video files and other binary assets from repo

---

## 2. PROJECT SIZE ANALYSIS

### Total Project Size: **18 GB** ⚠️ **TOO LARGE FOR GITHUB**

#### Size Breakdown:
```
Total Size:           18 GB
├── node_modules:     1.4 GB  (should be in .gitignore ✅)
├── build:            4.9 GB  (should be in .gitignore ✅)
├── public:           4.9 GB  (⚠️ needs review - contains large data)
├── data:             3.4 GB  (⚠️ should be excluded or use Git LFS)
└── Other:            ~3.4 GB
```

#### File Counts:
- **Total files**: 66,830 files
- **JSON files**: 8,110 files (604 MB total)
- **Markdown files**: 227 files
- **Test files**: 77+ files

#### ⚠️ **Critical Size Issues:**
1. **`public/` directory (4.9 GB)**: Contains large GeoJSON files, neighborhood buildings (1,205+ files), and other data
2. **`data/` directory (3.4 GB)**: Contains PDFs, processed data, and large datasets
3. **`build/` directory (4.9 GB)**: Build artifacts (should be gitignored)
4. **Large JSON files**: 8,110 JSON files totaling 604 MB

**GitHub Limitations:**
- GitHub recommends repositories < 1 GB
- Individual files should be < 100 MB
- Large files cause slow clones and push/pull operations

**Recommendations:**
1. Use **Git LFS** for large binary files (.geojson, .pdf, .mov)
2. Move large datasets to external storage (S3, CDN, etc.)
3. Add data files to `.gitignore` and provide download scripts
4. Consider splitting into multiple repositories (core app vs. data)

---

## 3. NON-OKLAHOMA FILES IDENTIFIED

### Files NOT Related to Oklahoma: **76+ files**

#### 🗺️ **Texas Files (Majority):**
- **Houston-related** (20+ files):
  - `geocode_houston_companies.py`
  - `EADO_ANALYSIS_README.md` (EADO = Houston neighborhood)
  - `perplexity-eado-district-response.json`
  - `gentrification-analysis-geojson.json` (likely Houston)
  - `public/perplexity-houston-startup-analysis.json`
  - `public/Listings/houston_*.geojson` (3 files)
  - `scripts/HOUSTON_ENHANCEMENT_README.md`
  - `scripts/test_houston_*.py` (2 files)
  - `src/components/Map/components/Cards/config/TexasCardConfig.js`
  - `public/fifa-houston-cache.json`
  - `public/houston_commercial_properties_smart_enhanced.json`

- **Austin-related**:
  - `osm_demand_nw_austin.log`

- **Central Texas Highway Routes** (30+ files):
  - `castroville_circles.json`
  - `i10_ozona_sonora_raw.json`
  - `i10_ozona_sonora.geojson`
  - `i10_sonora_rocksprings_raw.json`
  - `us277_sonora_rocksprings_raw.json`
  - `us277_sonora_rocksprings.geojson`
  - `us277_55_sonora_rocksprings.geojson`
  - `scripts/create_continuous_junction_castroville_route.py`
  - `scripts/create_continuous_sonora_junction_route.py`
  - `scripts/create_continuous_i10_ozona_sonora_route.py`
  - `scripts/create_continuous_rocksprings_sonora_route.py`
  - `scripts/create_continuous_hondo_castroville_route.py`
  - `scripts/fetch_texas_highway_segments.py`
  - `scripts/osm-tools/OSM_277_Sonora_Rocksprings_requests.py`
  - `scripts/osm-tools/OSM_I10_Ozona_Sonora_requests.py`
  - `scripts/osm-tools/OSM_I10_Ozona_FortStockton_requests.py`
  - `src/components/Map/components/OzonaFortStocktonParticles.jsx`
  - And many more related scripts...

- **Bosque County, TX** (Whitney Lake area):
  - `generate_bosque_east_changes.py`
  - `public/bosque_landcover_*.geojson` (5 files)
  - `src/config/geographicConfig.js` (contains Whitney, TX config)

#### 🏜️ **Arizona Files:**
- **Pinal County/Casa Grande** (15+ files):
  - `CASA_GRANDE_POPUP_IMPLEMENTATION.md`
  - `test-casa-grande-popup.html`
  - `PINAL_REFACTOR_README.md`
  - `src/components/Map/components/CasaGrandeBoundaryLayer.jsx`
  - `src/components/Map/components/Cards/utils/pinalMarkers.js`
  - `src/utils/pinalMapUtils.js`
  - `src/components/Map/popups/pinalPopups.js`
  - `src/components/Map/layers/pinalLayers.js`
  - `src/config/pinalConfig.js`
  - `src/data/pinalSites.js`
  - `public/casa-grande-boundary.geojson`
  - `public/casa-grande-tax-zones.geojson`
  - `public/ARZ/` directory (multiple files)
  - `geoai_sites.py` (references Pinal)

#### 🌴 **Other Locations:**
- **Los Angeles, CA**:
  - `data/los_angeles_ca/` directory (4+ neighborhood files)

- **Washington DC**:
  - `data/washington_dc/` directory (Dupont Circle files)

#### 🎬 **Media Files (Not Location-Specific):**
- `v1.mov`, `v2.mov`, `v3.mov`, `v5.mov`, `v12.mov` (5 video files)

### Summary:
- **Texas files**: ~50+ files
- **Arizona files**: ~15+ files
- **Other states**: ~10+ files
- **Media files**: 5 files
- **Total non-OK files**: **76+ files**

**Recommendations:**
1. **Archive or remove** non-Oklahoma files before GitHub upload
2. **Create separate repos** for Texas/Arizona work if needed
3. **Move to `archive/` or `other-locations/`** if keeping for reference
4. **Update README** to clarify this is an Oklahoma-focused project

---

## 4. GITHUB UPLOAD CONSIDERATIONS

### ⚠️ **CRITICAL: Pre-Upload Checklist**

#### 🔒 **Security & Secrets:**
- ✅ `.env` is in `.gitignore` (good)
- ✅ `env.example` exists (good template)
- ⚠️ **Check for hardcoded API keys**: Found 20 files mentioning API keys - verify none contain actual keys
- ⚠️ **Review sensitive data**: Check JSON files for API keys, tokens, or credentials
- ⚠️ **Check server files**: `server.js`, `server.cjs` may contain sensitive configs

**Action Items:**
```bash
# Search for potential secrets before committing
grep -r "sk-[a-zA-Z0-9]" . --exclude-dir=node_modules
grep -r "AIza[0-9A-Za-z_-]" . --exclude-dir=node_modules
grep -r "xoxb-[0-9]" . --exclude-dir=node_modules
```

#### 📦 **File Size Management:**
1. **Use Git LFS** for:
   - Large GeoJSON files (>10 MB)
   - PDF files in `data/grda/pdfs/`
   - Video files (if keeping)
   - Large JSON datasets

2. **Add to `.gitignore`**:
   ```
   # Already in .gitignore (good):
   node_modules/
   build/
   *.log
   *.mov
   *.json (except package files)
   public/
   data/
   
   # Consider adding:
   __pycache__/
   *.pyc
   .env.local
   .DS_Store
   *.geojson (if using LFS)
   ```

3. **External Storage Options**:
   - Move `data/` to AWS S3 or similar
   - Host `public/` assets on CDN
   - Use GitHub Releases for large datasets

#### 🗂️ **Repository Structure:**
**Recommended structure:**
```
OKC/
├── .github/           # GitHub workflows, templates
├── docs/              # All markdown documentation
├── src/               # Source code (keep as is)
├── scripts/           # Scripts (organize by purpose)
├── tests/             # All test files
├── archive/           # Non-OK files (optional)
├── .gitignore         # Update with recommendations
├── README.md          # Main project README
├── LICENSE            # Add license
└── CONTRIBUTING.md    # Contribution guidelines
```

#### 📝 **Documentation:**
1. **Update main README.md**:
   - Project description
   - Installation instructions
   - Usage guide
   - Architecture overview
   - Current focus: Oklahoma City area

2. **Add LICENSE file** (choose appropriate license)

3. **Create CONTRIBUTING.md** for contributors

4. **Add .github/** directory:
   - `ISSUE_TEMPLATE.md`
   - `PULL_REQUEST_TEMPLATE.md`
   - `workflows/` for CI/CD

#### 🧹 **Cleanup Before Upload:**
1. **Remove files:**
   - All `.mov` video files
   - Duplicate files (`* copy.js`, `*.bak`)
   - Test files from root (move to `tests/`)
   - Non-Oklahoma data files (or move to `archive/`)

2. **Organize:**
   - Move all `test_*.js` to `tests/`
   - Move all `*.md` from root to `docs/`
   - Consolidate scripts into logical subdirectories

3. **Verify:**
   - No API keys in code
   - No passwords or secrets
   - No large binary files in git history

#### 🚀 **GitHub-Specific Recommendations:**
1. **Repository Settings:**
   - Set repository to Public/Private as needed
   - Enable GitHub Discussions (for Q&A)
   - Enable GitHub Pages (if hosting docs)
   - Set up branch protection rules

2. **Initial Commit Strategy:**
   ```bash
   # Option 1: Clean start (recommended)
   git init
   git add .gitignore README.md LICENSE
   git commit -m "Initial commit"
   # Then gradually add organized directories
   
   # Option 2: Preserve history (if needed)
   # Clean up first, then push
   ```

3. **Use GitHub LFS:**
   ```bash
   git lfs install
   git lfs track "*.geojson"
   git lfs track "*.pdf"
   git lfs track "data/**"
   git add .gitattributes
   ```

4. **Consider Multiple Repos:**
   - `okc-core` - Main application code
   - `okc-data` - Large datasets (separate repo or LFS)
   - `okc-docs` - Documentation site

---

## 5. SUMMARY & ACTION PLAN

### Priority 1 (Before GitHub Upload):
- [ ] Remove/archive 76+ non-Oklahoma files
- [ ] Remove 5 video files (.mov)
- [ ] Remove duplicate/backup files
- [ ] Verify no API keys/secrets in code
- [ ] Update `.gitignore` for large files
- [ ] Set up Git LFS for large files
- [ ] Move test files to `tests/` directory
- [ ] Organize documentation into `docs/`

### Priority 2 (Repository Setup):
- [ ] Create comprehensive README.md
- [ ] Add LICENSE file
- [ ] Create CONTRIBUTING.md
- [ ] Set up `.github/` templates
- [ ] Organize scripts into subdirectories
- [ ] Clean up root directory

### Priority 3 (Post-Upload):
- [ ] Set up CI/CD workflows
- [ ] Configure branch protection
- [ ] Set up issue templates
- [ ] Create project roadmap
- [ ] Document deployment process

### Estimated Cleanup Time: **4-6 hours**

---

## 6. QUICK STATS SUMMARY

| Metric | Value | Status |
|--------|-------|--------|
| **Total Size** | 18 GB | ⚠️ Too large |
| **Total Files** | 66,830 | ⚠️ Very large |
| **JSON Files** | 8,110 (604 MB) | ⚠️ Many large files |
| **Markdown Docs** | 227 | ✅ Well documented |
| **Test Files** | 77+ | ⚠️ Need organization |
| **Non-OK Files** | 76+ | ⚠️ Should remove/archive |
| **Organization Score** | 6/10 | ⚠️ Needs improvement |

---

**Next Steps:** Start with Priority 1 items before creating the GitHub repository. The project has good documentation but needs significant cleanup for a professional public repository.

