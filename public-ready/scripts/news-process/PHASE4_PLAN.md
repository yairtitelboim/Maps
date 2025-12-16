# Phase 4: Advanced Extraction & Data Enrichment Plan

**Status:** Planning  
**Goal:** Reduce unknown projects from 33 to <15 (55%+ improvement)  
**Timeline:** 4-6 hours  
**Risk:** Medium-High (LLM costs, timeout management)  
**Dependencies:** API keys (OpenAI/Anthropic), full-text article access

---

## 📊 Current State Analysis

### Remaining Unknown Projects: 33 (35.9%)

**Categorization:**
- **No company, no location:** 21 projects (63.6%)
- **No company, has location:** 12 projects (36.4%)
- **Has company, no location:** 0 projects (0%)
- **Has company, has location:** 0 projects (0%) ✅

**Key Insights:**
1. ✅ Fallback name generation is working perfectly (0 projects with company+location but no name)
2. ⚠️ Main blocker: Missing company information (33/33 = 100%)
3. 📝 Many articles mention companies in snippets but not in titles
4. 🔍 Some articles have full-text that might contain more information

### Sample Articles Analysis

**Companies mentioned but not extracted:**
- "Sabey Data Centers" (appears in snippet, not title)
- "Cielo Digital Infrastructure" (appears in snippet)
- "EdgeConneX Inc." (appears in snippet)
- "TRG Datacenters" (appears in snippet)
- "Skybox Datacenters LLC" (appears in snippet)
- "KDC" (appears in title: "KDC Proposes...")

**Locations mentioned but not extracted:**
- "Hays County" (appears in snippet)
- "Whitney" (appears in title)
- "Cedar Creek" (appears in snippet)
- "Taylor" (appears in title/snippet)
- "Round Rock" (appears in snippet)
- "Bastrop County" (appears in snippet)

---

## 🎯 Phase 4 Strategy: Multi-Pronged Approach

### Phase 4.1: Expand Company List (Low Risk, High Impact)
**Goal:** Extract 10-15 more companies from existing articles  
**Timeline:** 1 hour  
**Risk:** Low

#### 4.1.1 Add Missing Companies
```python
company_dict = {
    # ... existing companies ...
    "Sabey Data Centers": ["Sabey", "Sabey Data Centers", "sabey"],
    "Cielo Digital Infrastructure": ["Cielo Digital Infrastructure", "Cielo", "cielo"],
    "EdgeConneX": ["EdgeConneX", "EdgeConneX Inc.", "edgeconnex"],
    "TRG Datacenters": ["TRG Datacenters", "TRG", "trg"],
    "Skybox Datacenters": ["Skybox Datacenters", "Skybox", "skybox"],
    "KDC": ["KDC", "kdc"],
    # Add more as discovered...
}
```

#### 4.1.2 Enhanced Snippet-Based Company Detection
- Current: Only checks title, URL, then full_text
- Enhancement: Prioritize snippet checking (companies often appear in snippets even if not in titles)

#### 4.1.3 Full-Text Company Extraction
- For articles with `raw_text` available, extract companies from full article content
- Use more lenient matching (partial word matches for company names in full text)

**Expected Impact:** +10-15 companies extracted → +10-15 project names generated

---

### Phase 4.2: Enhanced Location Extraction from Full Text (Medium Risk, Medium Impact)
**Goal:** Extract 5-10 more specific locations  
**Timeline:** 1-2 hours  
**Risk:** Medium

#### 4.2.1 Full-Text Location Patterns
- Extract locations from `raw_text` when available
- Look for location mentions in article body, not just title/snippet
- Better handling of "near [City]", "outside [City]", "in [City] area"

#### 4.2.2 Context-Aware Location Extraction
- When "Central Texas" is mentioned, search full text for specific county/city
- When "DFW area" is mentioned, search for specific cities (Dallas, Fort Worth, Plano, etc.)

#### 4.2.3 Location Disambiguation
- Handle cases where multiple locations are mentioned
- Prioritize locations that appear with data center keywords nearby

**Expected Impact:** +5-10 better locations → +5-10 better project names

---

### Phase 4.3: LLM-Based Extraction (High Risk, High Impact)
**Goal:** Extract company/location/project_name from complex articles  
**Timeline:** 2-3 hours  
**Risk:** High (API costs, timeout)

#### 4.3.1 Hybrid Approach
```python
def extract_with_llm_fallback(mention: Dict, card: Dict) -> Dict:
    """
    Use LLM as fallback for articles where regex extraction failed.
    Only called for articles with:
    - No company extracted, OR
    - No location extracted (beyond "Texas")
    """
    # Only process if we have raw_text or sufficient snippet
    if not mention.get("raw_text") and len(mention.get("snippet", "")) < 200:
        return card  # Skip if insufficient text
    
    # Check if we should use LLM (cost/time tradeoff)
    if should_use_llm(mention, card):
        return extract_with_llm(mention, card)
    return card
```

#### 4.3.2 LLM Prompt Design
```python
def extract_with_llm(mention: Dict, card: Dict) -> Dict:
    """Extract company, location, and project name using LLM."""
    
    prompt = f"""
Extract structured information about a data center project from this article.

Title: {mention.get("title", "")}
Snippet: {mention.get("snippet", "")}
Full Text: {mention.get("raw_text", "")[:2000]}  # Limit to avoid token limits

Extract the following information:
1. Company/Developer: The company building or developing the data center (e.g., "Meta", "CyrusOne", "Sabey Data Centers")
2. Location: Specific city, county, or area in Texas (e.g., "El Paso", "Bexar County", "Taylor")
3. Project Name: Specific project name if mentioned (e.g., "DFW10", "Cinco", "Meta El Paso")

Return ONLY a JSON object with this structure:
{{
    "company": "Company name or null",
    "location": "Specific location in Texas or null",
    "project_name": "Project name or null"
}}

If information is not found, use null. Do not make up information.
"""

    # Use OpenAI/Anthropic API with timeout
    # Timeout: 3 seconds per call
    # Fallback: Return original card if timeout/error
```

#### 4.3.3 LLM Implementation Details

**Model Selection:**
- Primary: `gpt-4o-mini` (cheaper, fast, good enough for extraction)
- Fallback: `gpt-3.5-turbo` (if gpt-4o-mini unavailable)
- Alternative: Anthropic Claude (if OpenAI unavailable)

**Rate Limiting:**
- Max 20 articles per run (to stay under 1-minute timeout)
- 0.5-1 second delay between calls
- Batch processing for larger datasets

**Cost Estimation:**
- ~500 tokens per article (title + snippet + prompt)
- ~100 tokens per response
- gpt-4o-mini: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Estimated cost:** ~$0.01-0.02 per article
- **For 33 articles:** ~$0.33-0.66 total

**Timeout Protection:**
```python
import signal
import time

def extract_with_timeout(mention, card, timeout_seconds=3):
    """Extract with LLM, enforcing timeout."""
    def timeout_handler(signum, frame):
        raise TimeoutError("LLM extraction timed out")
    
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(timeout_seconds)
    
    try:
        result = extract_with_llm(mention, card)
        signal.alarm(0)  # Cancel alarm
        return result
    except (TimeoutError, Exception) as e:
        signal.alarm(0)  # Cancel alarm
        logger.warning(f"LLM extraction failed: {e}")
        return card  # Return original card
```

#### 4.3.4 Selective LLM Usage
Only use LLM for articles that:
1. Have no company extracted (highest priority)
2. Have no location beyond "Texas" (medium priority)
3. Have sufficient text (snippet > 200 chars OR raw_text available)
4. Haven't been processed by LLM before (avoid re-processing)

**Expected Impact:** +10-15 companies/locations extracted → +10-15 project names

---

### Phase 4.4: Full-Text Article Fetching (Optional, Low Risk)
**Goal:** Get full article text for better extraction  
**Timeline:** 1-2 hours  
**Risk:** Low

#### 4.4.1 Fetch Full Text for Missing Articles
- For articles without `raw_text`, fetch full article content
- Use `readability-lxml` or `newspaper3k` (already in pipeline)
- Store in `mentions.raw_text` for future extraction

#### 4.4.2 Incremental Fetching
- Only fetch articles that need it (no company or no location)
- Batch fetch with timeout protection
- Cache results to avoid re-fetching

**Expected Impact:** Better extraction for 10-20 articles

---

## 📋 Implementation Priority

### ✅ Phase 4.1: Expand Company List (DO FIRST)
**Impact:** High (30-45% improvement)  
**Effort:** Low (1 hour)  
**Risk:** Low  
**Dependencies:** None

**Tasks:**
1. Add missing companies to company_dict
2. Enhance snippet-based company detection
3. Add full-text company extraction
4. Test on sample articles
5. Run backfill

### ⚠️ Phase 4.2: Enhanced Location Extraction (DO SECOND)
**Impact:** Medium (15-30% improvement)  
**Effort:** Medium (1-2 hours)  
**Risk:** Medium  
**Dependencies:** Full-text access

**Tasks:**
1. Implement full-text location patterns
2. Add context-aware location extraction
3. Test on sample articles
4. Run backfill

### ⚠️ Phase 4.3: LLM-Based Extraction (DO IF NEEDED)
**Impact:** High (30-45% improvement)  
**Effort:** High (2-3 hours)  
**Risk:** High (costs, timeout)  
**Dependencies:** API keys, timeout management

**Tasks:**
1. Implement LLM extraction function
2. Add timeout protection
3. Add selective usage logic
4. Test on 5-10 sample articles
5. Monitor costs and performance
6. Run on remaining unknown articles

### ❌ Phase 4.4: Full-Text Fetching (OPTIONAL)
**Impact:** Medium (15-30% improvement)  
**Effort:** Medium (1-2 hours)  
**Risk:** Low  
**Dependencies:** Article fetching libraries

**Tasks:**
1. Implement full-text fetching for missing articles
2. Add timeout protection
3. Store in database
4. Re-run extraction on fetched articles

---

## 🎯 Expected Outcomes

### After Phase 4.1 (Company Expansion)
- **Unknown projects:** 33 → 18-23 (30-45% reduction)
- **Companies extracted:** +10-15
- **Project names generated:** +10-15

### After Phase 4.2 (Location Enhancement)
- **Unknown projects:** 18-23 → 13-18 (15-30% additional reduction)
- **Better locations:** +5-10
- **Better project names:** +5-10

### After Phase 4.3 (LLM Extraction)
- **Unknown projects:** 13-18 → 8-13 (30-45% additional reduction)
- **Total improvement:** 33 → 8-13 (60-75% reduction)
- **Companies extracted:** +10-15
- **Locations extracted:** +5-10

### Final State (After All Phases)
- **Unknown projects:** 8-13 (9-14% of total)
- **Named projects:** 79-84 (86-91% of total)
- **Companies extracted:** 68-73 (74-79% of total)
- **Specific locations:** 20-25 (22-27% of total)

---

## 🔧 Implementation Details

### File Structure
```
scripts/news-process/
├── extract_project_cards.py (enhance with Phase 4.1, 4.2)
├── llm_extraction.py (new file for Phase 4.3)
├── fetch_full_text.py (new file for Phase 4.4)
└── PHASE4_PLAN.md (this file)
```

### Database Schema
No schema changes needed. All enhancements work with existing tables.

### Configuration
Add to `.env.local`:
```
OPENAI_API_KEY=your_key_here
# OR
ANTHROPIC_API_KEY=your_key_here
```

### Testing Strategy
1. **Phase 4.1:** Test on 10-20 sample articles with missing companies
2. **Phase 4.2:** Test on 10-20 sample articles with missing locations
3. **Phase 4.3:** Test on 5-10 sample articles with LLM (monitor costs)
4. **Full backfill:** Run on all 33 unknown projects

---

## ⚠️ Risks & Mitigation

### Risk 1: LLM API Costs
- **Mitigation:** Use `gpt-4o-mini` (cheaper), limit to 20 articles per run, monitor costs

### Risk 2: Timeout Issues
- **Mitigation:** 3-second timeout per LLM call, max 20 articles per run, graceful fallback

### Risk 3: LLM Hallucination
- **Mitigation:** Strict JSON schema, "null if not found" instruction, validation of results

### Risk 4: Rate Limiting
- **Mitigation:** 0.5-1 second delay between calls, exponential backoff on errors

---

## 📊 Success Criteria

1. **Quantitative:**
   - Reduce unknown projects from 33 to <15 (55%+ improvement)
   - Extract 20+ additional companies
   - Extract 10+ additional specific locations
   - Maintain extraction speed (<60 seconds for full run)

2. **Qualitative:**
   - Project names are meaningful and accurate
   - No false positives from LLM extraction
   - Cost per article < $0.05
   - Timeout rate < 5%

---

## 🔄 Next Steps

1. **Immediate:** Implement Phase 4.1 (Company Expansion) - 1 hour
2. **Short-term:** Implement Phase 4.2 (Location Enhancement) - 1-2 hours
3. **Medium-term:** Evaluate Phase 4.3 (LLM) based on results from 4.1 and 4.2
4. **Long-term:** Consider Phase 4.4 (Full-Text Fetching) if needed

---

## 📝 Notes

- Phase 4.1 and 4.2 are low-risk and should be implemented first
- Phase 4.3 (LLM) should only be used if 4.1 and 4.2 don't achieve target reduction
- Monitor API costs carefully - may need to limit LLM usage to highest-value articles
- Consider manual review queue for remaining unknown projects after Phase 4

