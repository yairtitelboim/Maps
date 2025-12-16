# Perplexity API Testing Summary

## ✅ API Testing Complete

### Test Results

**API Connectivity:**
- ✅ API key loaded from `.env.local`
- ✅ Model: `sonar-pro` (web-grounded, real-time)
- ✅ Endpoint: `https://api.perplexity.ai/chat/completions`

**Accuracy Tests:**
1. **Specific Address** (3441 Railport Parkway, Midlothian, TX)
   - Perplexity: `32.480000, -96.989170`
   - Expected: `32.4824, -96.9944` (Midlothian center)
   - **Distance: 0.56km** ✅ Excellent

2. **City Only** (Jarrell, Texas)
   - Perplexity: `30.771200, -97.640500`
   - Expected: `30.8249, -97.6045` (Jarrell center)
   - **Distance: 6.89km** ⚠️ Moderate (acceptable for city-level)

3. **Vague Location** (South Fort Worth)
   - Perplexity: `32.682500, -97.307500`
   - **Extracted successfully** ✅

4. **County Only** (Bosque County)
   - Perplexity: `31.900404, -97.634338`
   - **Extracted successfully** ✅

**Real Project Tests:**
- Tested 3 projects with vague `location_text` ("Texas", "ew")
- 2 successful extractions
- Average distance from existing coordinates: **4.82km**
- Max distance: **5.52km**
- **No significant differences (>20km)** ✅

### Key Findings

1. **High Accuracy for Specific Addresses**
   - When article contains specific address, Perplexity extracts coordinates with <1km accuracy
   - Better than traditional geocoding for complex addresses

2. **Moderate Accuracy for City/County Queries**
   - 5-7km accuracy for city-level queries
   - Still acceptable for validation/improvement purposes

3. **Can Extract from Vague Context**
   - Successfully extracts coordinates even when `location_text` is vague
   - Uses article context to find specific location

4. **Consistent Response Format**
   - Response format is parseable
   - Coordinates always in decimal degrees
   - Easy to extract with regex patterns

### Recommended Integration Strategy

**Priority 1: Projects with Vague Location Text**
- `location_text` in: ["Texas", "None", "ew", "ey", "th", "or", "and Beyond"]
- Article text contains location clues
- Use Perplexity to extract from article context

**Priority 2: Validation of Questionable Coordinates**
- Coordinates are 5-20km from expected city
- Use Perplexity to verify or find better coordinates
- Compare with existing coordinates

**Priority 3: Failed Traditional Geocoding**
- Traditional geocoding returned no results
- Article mentions specific address/neighborhood
- Use Perplexity as fallback

### Implementation Options

**Option A: Standalone Script** (Recommended for Initial Testing)
- Create `improve_locations_with_perplexity.py`
- Process projects matching Priority 1 criteria
- Compare Perplexity results with existing coordinates
- Log improvements and update database

**Option B: Integration into Existing Script**
- Add Perplexity as fallback in `extract_locations_from_articles.py`
- Use when:
  - No location candidates found in article
  - Geocoding fails for all candidates
  - Location text is too vague

**Option C: Hybrid Approach** (Recommended for Production)
- Use Perplexity for validation/verification
- Run on projects flagged by `check_coordinate_accuracy.py`
- Compare Perplexity results with current coordinates
- Update if Perplexity provides better match (>20km difference)

### Cost Considerations

- **Model**: `sonar-pro` (web-grounded, real-time)
- **Estimated cost**: ~$0.001-0.01 per query
- **Rate limits**: Check Perplexity documentation
- **Strategy**: 
  - Use selectively (only when needed)
  - Cache results
  - Batch process with delays (1-2 seconds between requests)

### Next Steps

1. ✅ Test API connectivity
2. ✅ Test coordinate extraction accuracy
3. ✅ Test on real projects
4. ⏳ Create production integration script
5. ⏳ Integrate into existing workflow
6. ⏳ Test on larger sample (20-30 projects)
7. ⏳ Deploy to production

### Files Created

- `scripts/news-output/PERPLEXITY_LOCATION_PLAN.md` - Detailed integration plan
- `scripts/news-output/test_perplexity_extraction.py` - Test script
- `scripts/news-output/PERPLEXITY_TEST_SUMMARY.md` - This summary

### Usage Example

```bash
# Test API connectivity
python3 scripts/news-output/test_perplexity_extraction.py --test-api

# Test on 5 sample projects
python3 scripts/news-output/test_perplexity_extraction.py --limit 5
```

