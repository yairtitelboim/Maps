# Perplexity API Integration Plan for Location Extraction

## Overview

Use Perplexity API to extract precise location coordinates (lat/lng) from article text when traditional geocoding fails or location_text is vague.

## API Details

- **Model**: `sonar-pro` (web-grounded, real-time data)
- **API Key**: Stored in `.env.local` as `PRP`
- **Endpoint**: `https://api.perplexity.ai/chat/completions`
- **Use Case**: Extract coordinates from article text when:
  - Location text is vague ("Texas", "ew", "ey", "None")
  - Traditional geocoding fails
  - Article contains specific address but location_text doesn't

## Integration Strategy

### Phase 1: Targeted Use Cases

**Priority 1: Projects with vague location_text**
- `location_text` in: ["Texas", "None", "ew", "ey", "th", "or", "and Beyond"]
- Article text contains location clues
- Current coordinates are wrong or missing

**Priority 2: Projects with failed geocoding**
- Traditional geocoding returned no results
- Article mentions specific address/neighborhood
- Site hint available but coordinates don't match

**Priority 3: Validation for questionable coordinates**
- Coordinates are 5-20km from expected
- Article text might have more specific location
- Use Perplexity to verify or find better coordinates

### Phase 2: Implementation Approach

#### Option A: Standalone Script (Recommended for Testing)
- Create `extract_locations_with_perplexity.py`
- Process projects matching Priority 1 criteria
- Compare Perplexity results with existing coordinates
- Log improvements and accuracy

#### Option B: Integration into Existing Script
- Add Perplexity as fallback in `extract_locations_from_articles.py`
- Use when:
  - No location candidates found in article
  - Geocoding fails for all candidates
  - Location text is too vague

#### Option C: Hybrid Approach
- Use Perplexity for validation/verification
- Run on projects flagged by `check_coordinate_accuracy.py`
- Compare Perplexity results with current coordinates
- Update if Perplexity provides better match

## API Usage Pattern

```python
def extract_coordinates_with_perplexity(article_text: str, location_hint: str = None) -> dict:
    """
    Use Perplexity API to extract coordinates from article text.
    
    Returns:
        {
            'lat': float,
            'lng': float,
            'confidence': 'high'|'medium'|'low',
            'source': 'perplexity',
            'reasoning': str
        } or None
    """
    query = f'Extract the exact latitude and longitude coordinates (in decimal degrees) for the data center location mentioned in this text: "{article_text}". Respond with ONLY the coordinates in format: latitude, longitude'
    
    # Call Perplexity API
    # Parse response
    # Validate coordinates (Texas bounds)
    # Return structured result
```

## Cost Considerations

- **Model**: `sonar-pro` (web-grounded, real-time)
- **Estimated cost**: ~$0.001-0.01 per query (depends on tokens)
- **Rate limits**: Check Perplexity documentation
- **Strategy**: 
  - Use selectively (only when needed)
  - Cache results
  - Batch process with delays

## Testing Plan

1. **Test API connectivity** ✅
2. **Test coordinate extraction** (in progress)
3. **Test with vague locations**
4. **Test with specific addresses**
5. **Compare with existing geocoding**
6. **Measure accuracy improvement**

## Integration Points

### 1. `extract_locations_from_articles.py`
- Add Perplexity as fallback when:
  - `extract_locations_from_text()` returns empty
  - All geocoding attempts fail
  - Location text is vague

### 2. `check_coordinate_accuracy.py`
- Use Perplexity to verify questionable coordinates
- Re-geocode projects with "no reference" city

### 3. New Script: `improve_locations_with_perplexity.py`
- Process projects with vague location_text
- Use Perplexity to extract coordinates from article text
- Update database with improved coordinates

## Expected Benefits

1. **Better handling of vague locations**
   - "Texas" → Extract from article → Get specific city/address
   - "ew", "ey" → Extract from article → Get actual location

2. **Improved accuracy**
   - Perplexity can search web for address validation
   - Real-time data ensures current information

3. **Reduced manual review**
   - Automatically handle cases that need manual intervention
   - Focus manual review on edge cases only

## Risks & Mitigation

1. **Cost**: Use selectively, cache results
2. **Rate limits**: Implement delays, batch processing
3. **Accuracy**: Validate all coordinates (Texas bounds, distance checks)
4. **API changes**: Abstract API calls, handle errors gracefully

## Next Steps

1. ✅ Test API connectivity
2. ⏳ Test coordinate extraction accuracy
3. ⏳ Create extraction function
4. ⏳ Integrate into existing workflow
5. ⏳ Test on sample projects
6. ⏳ Deploy to production

