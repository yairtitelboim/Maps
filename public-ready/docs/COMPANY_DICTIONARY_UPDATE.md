# Company Dictionary Update

## Summary

**Date:** 2025-01-XX  
**File:** `scripts/news-process/extract_project_cards.py`  
**Action:** Added 5 new companies discovered during unknown project triage

---

## New Companies Added

### 1. CleanSpark
- **Canonical Name:** `CleanSpark`
- **Aliases:** `CleanSpark`, `CleanSpark Inc.`, `CleanSpark, Inc.`, `CLSK`, `cleanspark`
- **Why:** Found in Austin County project (285 MW, 271 acres) - was missed because article used ticker symbol "CLSK"
- **Projects:** 1 project (Austin County, 285 MW)

### 2. Black Mountain Power
- **Canonical Name:** `Black Mountain Power`
- **Aliases:** `Black Mountain Power`, `Black Mountain Power LLC`, `black-mountain-power`, `blackmountainpower`
- **Why:** Discovered via Perplexity API for Fort Worth zoning project
- **Projects:** 1 project (Fort Worth)

### 3. Black Mountain Energy
- **Canonical Name:** `Black Mountain Energy`
- **Aliases:** `Black Mountain Energy`, `black-mountain-energy`, `blackmountainenergy`
- **Why:** Discovered via Perplexity API for South Fort Worth project
- **Projects:** 1 project (South Fort Worth)

### 4. PowerHouse Data Centers
- **Canonical Name:** `PowerHouse Data Centers`
- **Aliases:** `PowerHouse Data Centers`, `PowerHouse`, `Powerhouse Data Centers`, `powerhouse`, `powerhouse-data-centers`
- **Why:** Discovered via Perplexity API for Ellis County project (768 acres)
- **Projects:** 1 project (Ellis County, 768 acres)

### 5. Provident Data Centers
- **Canonical Name:** `Provident Data Centers`
- **Aliases:** `Provident Data Centers`, `Provident`, `provident`, `provident-data-centers`
- **Why:** Discovered via Perplexity API for Ellis County project (joint project with PowerHouse)
- **Projects:** 1 project (Ellis County, joint with PowerHouse)

---

## Impact

### Before Update:
- These companies would not be detected in future articles
- Projects would default to "Unknown" company
- Ticker symbols (CLSK) would not map to company names

### After Update:
- ✅ All 5 companies will be automatically detected in future articles
- ✅ Ticker symbol "CLSK" will map to "CleanSpark"
- ✅ Variations like "Black Mountain Power LLC" will normalize to "Black Mountain Power"
- ✅ Future articles mentioning these companies will be properly categorized

---

## Testing

Verified dictionary entries work correctly:
- ✅ CleanSpark detection (including CLSK ticker)
- ✅ Black Mountain Power detection (including LLC variant)
- ✅ All aliases properly configured

---

## Future Articles

These companies will now be automatically extracted from:
- Article titles
- URLs
- Snippets
- Full article text (when available)

---

## Related Projects

Current projects using these companies:
- **CleanSpark:** Austin County (285 MW, 271 acres)
- **Black Mountain Power:** Fort Worth (zoning approved)
- **Black Mountain Energy:** South Fort Worth
- **PowerHouse Data Centers:** Ellis County (768 acres)
- **Provident Data Centers:** Ellis County (joint project)

---

## Notes

1. **Ticker Symbol Support:** CleanSpark entry includes "CLSK" to handle articles that only mention the ticker symbol
2. **LLC Variations:** Both "Black Mountain Power" and "Black Mountain Power LLC" map to the same canonical name
3. **Joint Projects:** PowerHouse and Provident are separate entries but may appear together in articles (Ellis County project)

---

## Next Steps

1. ✅ Dictionary updated
2. ⏳ Consider re-running extraction on existing articles that might mention these companies
3. ⏳ Monitor for any additional variations or aliases
4. ⏳ Add to company list in query configuration if needed

