# Project Name Extraction Improvement Plan

**Date:** 2025-12-12  
**Problem:** 38 out of 82 projects (46%) have "Unknown Project" as project_name  
**Root Cause:** Extraction only looks for quoted project names, missing most real-world patterns

---

## 📊 Current State Analysis

### Current Extraction Logic
- **Project Name Patterns:** Only 2 patterns
  1. Quoted names: `"Project Name"`
  2. "project called [Name]"
- **Company Extraction:** Works well (60+ companies detected)
- **Location Extraction:** Works reasonably well
- **Result:** 38 projects with NULL project_name → fallback to "Unknown Project"

### Sample Articles That Failed
1. "Meta to build $1.5 billion data center in Northeast El Paso" → No quoted name
2. "CyrusOne, Calpine to develop a $1.2B hyperscale data center campus in Central Texas" → No quoted name
3. "Nscale Plans to Build Massive Texas AI Data Center for Microsoft" → No quoted name

---

## 🎯 Improvement Strategy

### Phase 1: Expand Pattern-Based Extraction (IMMEDIATE - Low Risk)
**Goal:** Reduce "Unknown Project" from 38 to ~15-20 (60-70% improvement)  
**Timeline:** 1-2 hours  
**Risk:** Low (regex patterns, fast execution)

#### 1.1 Enhanced Project Name Patterns

```python
name_patterns = [
    # Existing patterns
    r'"([^"]+)"',  # Quoted project name
    r"project\s+called\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
    
    # NEW: Facility/Campus names
    r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:data center|campus|facility|site)",
    r"(?:data center|campus|facility)\s+(?:called|named|known as)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
    r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:AI|hyperscale)\s+(?:campus|data center)",
    
    # NEW: Company + Location combinations (if no explicit name)
    r"([A-Z][a-z]+)\s+(?:data center|campus)\s+(?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
    
    # NEW: Specific facility identifiers
    r"([A-Z][a-z]+)\s+(?:DFW|TX|TX\d+|Campus\s+\d+)",  # "CyrusOne DFW10", "Google TX1"
    r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Phase\s+\d+|Building\s+\d+)",
    
    # NEW: Investment announcements with names
    r"\$[\d.]+[BM]\s+(?:investment|project)\s+(?:in|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
]
```

#### 1.2 Title-Based Extraction
Many project names appear in article titles:
- "Meta El Paso" from "Meta to build $1.5 billion data center in Northeast El Paso"
- "CyrusOne Bosque County" from "CyrusOne, Calpine to develop a $1.2B hyperscale data center campus in Central Texas"

**Strategy:** Extract from title first, then snippet

#### 1.3 Fallback Project Name Generation
If no explicit name found, generate from available data:
```python
if not card["project_name"]:
    if card["company"] and card["location_text"]:
        # Clean location (remove common words)
        clean_location = clean_location_name(card["location_text"])
        card["project_name"] = f"{card['company']} {clean_location}"
    elif card["company"]:
        card["project_name"] = f"{card['company']} Data Center"
```

---

### Phase 2: Improve Company Extraction (IMMEDIATE - Low Risk)
**Goal:** Reduce "Unknown" companies from 38 to ~10-15  
**Timeline:** 1 hour  
**Risk:** Low

#### 2.1 Expand Company List
Add more variations and aliases:
```python
companies = {
    "Amazon": ["Amazon", "AWS", "Amazon Web Services"],
    "Google": ["Google", "Alphabet"],
    "Microsoft": ["Microsoft", "MSFT"],
    "Meta": ["Meta", "Facebook"],
    # Add more...
}
```

#### 2.2 Title-Based Company Detection
Companies often appear in titles even if not in snippet:
- Check title first (higher confidence)
- Then check snippet

#### 2.3 URL-Based Company Detection
Some URLs contain company names:
- `meta-el-paso-texas-data-center` → Meta
- `cyrusone-calpine-hyperscale` → CyrusOne

---

### Phase 3: Enhanced Location Extraction (MEDIUM PRIORITY)
**Goal:** Improve location quality for better project name generation  
**Timeline:** 2-3 hours  
**Risk:** Medium

#### 3.1 Better Location Patterns
Current patterns miss:
- "Northeast El Paso" → Should extract "El Paso"
- "Central Texas" → Should extract specific county/city
- "West Bexar County" → Should extract "Bexar County"

#### 3.2 Location Cleaning Function
```python
def clean_location_name(location: str) -> str:
    """Clean location text for use in project names."""
    # Remove directional prefixes
    location = re.sub(r'^(Northeast|Northwest|Southeast|Southwest|North|South|East|West|Central)\s+', '', location, flags=re.IGNORECASE)
    # Remove common suffixes
    location = re.sub(r'\s+(Texas|TX|County|City)$', '', location, flags=re.IGNORECASE)
    # Remove article words
    location = re.sub(r'^(the|a|an)\s+', '', location, flags=re.IGNORECASE)
    return location.strip()
```

---

### Phase 4: LLM-Based Extraction (OPTIONAL - Higher Risk)
**Goal:** Handle complex cases that regex can't catch  
**Timeline:** 4-6 hours  
**Risk:** High (timeout concerns, API costs)

#### 4.1 Hybrid Approach
- Use regex patterns first (fast, free)
- For articles with company but no project_name, use LLM as fallback
- Limit to 10-20 articles per run to stay under timeout

#### 4.2 LLM Prompt
```python
def extract_with_llm(title: str, snippet: str, company: str) -> Optional[str]:
    """Use LLM to extract project name from article."""
    prompt = f"""
    Extract the project name from this data center article.
    Title: {title}
    Snippet: {snippet}
    Company: {company}
    
    Return ONLY the project name, or "None" if no specific name is mentioned.
    Examples:
    - "Meta to build data center in El Paso" → "Meta El Paso"
    - "CyrusOne DFW10 campus" → "CyrusOne DFW10"
    - "Google's new AI facility" → "Google AI Data Center"
    """
    # Use OpenAI API or similar
    # Timeout: 2 seconds per call
    # Fallback: Return None if timeout
```

---

## 📋 Implementation Priority

### ✅ Phase 1: Pattern Expansion (DO FIRST)
**Impact:** High (60-70% improvement)  
**Effort:** Low (1-2 hours)  
**Risk:** Low  
**Dependencies:** None

**Tasks:**
1. Add new regex patterns for project names
2. Implement title-first extraction
3. Add fallback name generation (Company + Location)
4. Test on sample articles
5. Run on full dataset

### ✅ Phase 2: Company Extraction (DO SECOND)
**Impact:** Medium (30-40% improvement)  
**Effort:** Low (1 hour)  
**Risk:** Low  
**Dependencies:** None

**Tasks:**
1. Expand company list with aliases
2. Add title-based company detection
3. Add URL-based company detection
4. Test and validate

### ⚠️ Phase 3: Location Enhancement (DO IF TIME)
**Impact:** Medium (20-30% improvement)  
**Effort:** Medium (2-3 hours)  
**Risk:** Medium  
**Dependencies:** None

**Tasks:**
1. Improve location extraction patterns
2. Add location cleaning function
3. Test on edge cases

### ❌ Phase 4: LLM Extraction (OPTIONAL)
**Impact:** High (80-90% improvement)  
**Effort:** High (4-6 hours)  
**Risk:** High (timeout, costs)  
**Dependencies:** API key, timeout management

**Tasks:**
1. Implement LLM fallback
2. Add timeout protection
3. Test on sample articles
4. Monitor API costs

---

## 🎯 Expected Outcomes

### After Phase 1 (Pattern Expansion)
- **Before:** 38 "Unknown Project" (46%)
- **After:** ~12-15 "Unknown Project" (15-18%)
- **Improvement:** 60-70% reduction

### After Phase 2 (Company Extraction)
- **Before:** 38 "Unknown Project" (46%)
- **After:** ~8-12 "Unknown Project" (10-15%)
- **Improvement:** 70-80% reduction

### After Phase 3 (Location Enhancement)
- **Before:** 38 "Unknown Project" (46%)
- **After:** ~5-8 "Unknown Project" (6-10%)
- **Improvement:** 80-90% reduction

### After Phase 4 (LLM Fallback)
- **Before:** 38 "Unknown Project" (46%)
- **After:** ~2-5 "Unknown Project" (2-6%)
- **Improvement:** 90-95% reduction

---

## 🚀 Implementation Steps

### Step 1: Create Enhanced Extraction Function
1. Copy `extract_project_cards.py` to `extract_project_cards_v2.py`
2. Add new patterns incrementally
3. Test on sample articles
4. Compare results with original

### Step 2: Validation
1. Run on 10-20 sample articles
2. Manually verify extracted names
3. Check for false positives
4. Refine patterns

### Step 3: Full Run
1. Run on full dataset
2. Compare before/after statistics
3. Export new GeoJSON
4. Verify map display

### Step 4: Backfill Existing Projects
1. Create script to re-extract project names for existing projects
2. Update database with new names
3. Re-export GeoJSON

---

## ⚠️ Risks & Mitigation

### Risk 1: Pattern Over-Matching
**Mitigation:** 
- Use word boundaries (`\b`) in patterns
- Test on edge cases
- Prioritize high-confidence patterns

### Risk 2: Timeout Issues
**Mitigation:**
- Keep regex patterns fast
- Limit LLM calls (if implemented)
- Add health checks every 10 articles

### Risk 3: False Positives
**Mitigation:**
- Validate extracted names (length, format)
- Filter out common false matches
- Manual review of edge cases

---

## 📝 Code Structure

```python
def extract_project_card(mention: Dict) -> Dict:
    """Enhanced extraction with multiple strategies."""
    card = initialize_card()
    
    # Strategy 1: Extract from title first (highest confidence)
    card = extract_from_title(mention["title"], card)
    
    # Strategy 2: Extract from snippet
    card = extract_from_snippet(mention["snippet"], card)
    
    # Strategy 3: Extract company (improved)
    card["company"] = extract_company_enhanced(mention)
    
    # Strategy 4: Extract location (improved)
    card["location_text"] = extract_location_enhanced(mention)
    
    # Strategy 5: Generate fallback name if needed
    if not card["project_name"]:
        card["project_name"] = generate_fallback_name(card)
    
    return card
```

---

## ✅ Success Criteria

1. **Quantitative:**
   - Reduce "Unknown Project" from 38 to <10 (75%+ improvement)
   - Maintain extraction speed (<60 seconds for full run)
   - No increase in false positives

2. **Qualitative:**
   - Project names are meaningful (not just "Data Center")
   - Names include location when available
   - Names are consistent across related articles

---

## 🔄 Next Steps

1. **Immediate:** Implement Phase 1 (Pattern Expansion)
2. **Short-term:** Implement Phase 2 (Company Extraction)
3. **Medium-term:** Evaluate Phase 3 (Location Enhancement)
4. **Long-term:** Consider Phase 4 (LLM) if needed

