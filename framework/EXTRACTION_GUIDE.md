# Framework Extraction Guide

This guide explains how to extract components from the main OKC project into the framework without modifying the original.

## Process

### Step 1: Copy File
```bash
# Copy from source
cp ../src/components/Map/components/Cards/BaseCard.jsx \
   src/components/Map/components/Cards/BaseCard.jsx
```

### Step 2: Clean Location-Specific Code

**Remove/Replace:**
- Location-specific imports (Taylor, Casa Grande, Pinal, NC, TX, AZ)
- Location-specific site configs
- Client-specific animations
- Real coordinates → Generic examples
- Real data paths → Mock/sample paths

**Keep:**
- Component structure and patterns
- State management logic
- UI rendering patterns
- Hook usage patterns
- Event handling patterns

### Step 3: Update Imports

Change import paths to match framework structure:
```javascript
// Before (OKC project)
import { getNcPowerSiteByKey } from '../../../../config/ncPowerSites';

// After (Framework)
// Location-specific import removed - use generic site config pattern
```

### Step 4: Create Generic Alternatives

Replace location-specific code with generic examples:
```javascript
// Before
const siteConfig = getNcPowerSiteByKey(siteKey);

// After  
const siteConfig = getGenericSiteConfig(siteKey); // Generic pattern
```

## File-by-File Checklist

### BaseCard.jsx
- [ ] Remove SamsungTaylorChangeAnimation import
- [ ] Remove RockdaleChangeAnimation import  
- [ ] Remove getNcPowerSiteByKey import
- [ ] Remove CUSTOM_ANIMATION_SITES (location-specific)
- [ ] Genericize getAnySiteConfigByKey
- [ ] Remove location-specific animation options
- [ ] Remove location-specific animation components from render
- [ ] Genericize Perplexity query (remove "Pinal County")

### CardManager.jsx
- [ ] Review for location-specific code
- [ ] Genericize any hardcoded locations

### Map Components
- [ ] Remove location-specific layers
- [ ] Keep generic layer patterns

### Hooks
- [ ] Review for location-specific logic
- [ ] Keep generic patterns

### Tools
- [ ] Create stubbed versions (mock data)
- [ ] Show structure, not real implementations

## Testing

After extraction:
1. Check imports resolve correctly
2. Verify no location-specific references remain
3. Test with generic example data
4. Ensure patterns are clear

## Safety

- ✅ Original files never modified
- ✅ All work in `framework/` directory
- ✅ Can delete `framework/` and start over anytime
- ✅ Original OKC project continues working normally

