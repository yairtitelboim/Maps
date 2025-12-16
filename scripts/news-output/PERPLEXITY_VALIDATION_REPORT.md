# Perplexity API Validation Report - 16 Projects Tested

## Test Summary

**Date:** 2025-01-XX  
**Projects Tested:** 16 (all projects with vague `location_text`)  
**Successful Extractions:** 14 (87.5%)  
**Failed:** 2 (insufficient article text)

## Results Analysis

### Overall Statistics

- **Average Distance:** 88.90km
- **Median Distance:** 25.48km
- **Max Distance:** 476.63km
- **Min Distance:** 1.35km
- **Significant Differences (>20km):** 10 out of 14 (71.4%)

### Distance Distribution

| Distance Range | Count | Percentage |
|----------------|-------|------------|
| < 5km | 3 | 21.4% |
| 5-20km | 1 | 7.1% |
| 20-50km | 5 | 35.7% |
| 50-100km | 1 | 7.1% |
| > 100km | 4 | 28.6% |

### Detailed Results

#### ✅ High Accuracy (< 5km) - 3 projects

1. **None - "ew"**
   - Current: `31.667074, -97.103243`
   - Perplexity: `31.664000, -97.117000`
   - **Distance: 1.35km** ✅ Excellent

2. **Digital Realty - "Texas"**
   - Current: `32.948179, -96.729721`
   - Perplexity: `32.964768, -96.711471`
   - **Distance: 2.51km** ✅ Good

3. **None - "ey"**
   - Current: `31.951823, -97.321401`
   - Perplexity: `31.863300, -97.366700`
   - **Distance: 10.73km** ✅ Acceptable

#### ⚠️ Moderate Accuracy (5-20km) - 1 project

4. **Oracle - "Texas"**
   - Current: `30.321975, -97.765669`
   - Perplexity: `30.267200, -97.743100`
   - **Distance: 6.46km** ⚠️ Moderate

#### ❌ Significant Differences (>20km) - 10 projects

5. **Vantage - "Texas"**
   - Current: `32.708875, -99.330762`
   - Perplexity: `32.541700, -99.575000`
   - **Distance: 29.47km** ⚠️ Significant

6. **Blueprint Projects - "or"**
   - Current: `30.602355, -97.624036`
   - Perplexity: `30.562500, -97.418200`
   - **Distance: 20.20km** ⚠️ Significant (borderline)

7. **QTS - "Texas"**
   - Current: `31.756851, -106.272570`
   - Perplexity: `31.954000, -106.605300`
   - **Distance: 38.32km** ❌ Large difference

8. **Sabey Data Centers - "Texas"**
   - Current: `30.254608, -97.737466`
   - Perplexity: `30.473700, -97.659800`
   - **Distance: 25.48km** ⚠️ Significant

9. **Calpine - "Texas"**
   - Current: `32.962478, -96.826477`
   - Perplexity: `31.859400, -97.358600`
   - **Distance: 132.44km** ❌ Very large difference

10. **None - "and Beyond"**
    - Current: `29.868835, -95.424841`
    - Perplexity: `27.506748, -99.502914`
    - **Distance: 476.63km** ❌ Extremely large (likely wrong)

11. **KDC - "or"**
    - Current: `30.444129, -97.778572`
    - Perplexity: `30.628500, -97.344200`
    - **Distance: 46.38km** ❌ Large difference

12. **Aligned - "th"**
    - Current: `33.009455, -96.693498`
    - Perplexity: `32.583000, -97.126200`
    - **Distance: 62.32km** ❌ Large difference

13. **Microsoft - "Texas"**
    - Current: `32.882063, -97.272441`
    - Perplexity: `32.924600, -97.017000`
    - **Distance: 24.31km** ⚠️ Significant

14. **Vantage - "Texas" (second instance)**
    - Current: `29.400294, -98.472914`
    - Perplexity: `32.585000, -99.523000`
    - **Distance: 367.99km** ❌ Very large difference

## Key Findings

### 1. Accuracy is Highly Variable

- **Best case:** 1.35km accuracy (excellent)
- **Worst case:** 476.63km difference (likely incorrect extraction)
- **Median:** 25.48km (moderate)

### 2. Success Rate is High

- 87.5% of projects with sufficient article text successfully extracted coordinates
- Only 2 projects failed due to insufficient article text

### 3. Large Differences Suggest Multiple Issues

**Possible explanations for large differences:**

1. **Multiple locations in article**
   - Article mentions multiple data centers
   - Perplexity extracts wrong location
   - Example: "None - and Beyond" (476km difference)

2. **Current coordinates are wrong**
   - Existing geocoding may have errors
   - Perplexity finds correct location
   - Example: "Calpine" (132km difference)

3. **Vague article text**
   - Article doesn't specify exact location
   - Perplexity makes best guess
   - Example: "Vantage - Texas" (367km difference)

4. **Company has multiple facilities**
   - Article mentions different facility than current coordinates
   - Both may be correct but different projects
   - Example: "Microsoft - Texas" (24km difference)

### 4. Best Use Cases

**Perplexity works best when:**
- ✅ Article contains specific address
- ✅ Location text is vague but article has details
- ✅ Single, clear location mentioned

**Perplexity struggles when:**
- ❌ Article mentions multiple locations
- ❌ Article text is vague or incomplete
- ❌ Company has multiple facilities in Texas

## Recommendations

### 1. Use Perplexity Selectively

**Priority 1: High-Value Cases**
- Projects with vague `location_text` but detailed article text
- Projects where current coordinates are clearly wrong (>100km from expected)
- Projects with specific addresses in article text

**Priority 2: Validation Only**
- Use Perplexity to validate questionable coordinates
- Compare with existing coordinates
- Only update if difference is significant AND Perplexity result is more specific

**Priority 3: Manual Review Required**
- Large differences (>50km) should trigger manual review
- Check article text for multiple locations
- Verify which location is correct

### 2. Improve Article Text Quality

- Ensure full article text is available
- Fetch from URL if `raw_text` is missing
- Use longer article snippets (2000+ characters)

### 3. Add Validation Logic

**Before updating coordinates:**
1. Check if Perplexity result is within Texas bounds
2. Compare with existing coordinates
3. If difference > 50km, flag for manual review
4. If difference 20-50km, check article for multiple locations
5. If difference < 20km, consider updating if Perplexity is more specific

### 4. Cost Optimization

- Only use Perplexity for projects with vague location_text
- Cache results to avoid duplicate API calls
- Batch process with delays (1-2 seconds between requests)

## Next Steps

1. **Manual Review of Large Differences**
   - Review 4 projects with >100km differences
   - Determine if Perplexity or current coordinates are correct
   - Update database accordingly

2. **Test on More Projects**
   - Test on projects with "no reference" city (49 projects)
   - Test on projects with questionable coordinates (4 projects)
   - Compare results with existing validation

3. **Create Production Script**
   - Implement validation logic
   - Add manual review flags
   - Integrate with existing workflow

4. **Monitor Accuracy**
   - Track accuracy over time
   - Refine prompts based on results
   - Adjust thresholds based on validation

