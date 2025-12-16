# OG&E Data Verification Notes

## ⚠️ IMPORTANT: Data Accuracy Status

The data in `firecrawl_capacity_data.json` is **PARTIALLY REAL but contains INACCURACIES**.

### What's Real:
- ✅ **Facility names** - These are actual OG&E power plants
- ✅ **Fuel types** - Correct (Gas, Coal, Wind, Solar)
- ✅ **General structure** - Matches expected format
- ✅ **Service territory** - Stillwater is served by OG&E
- ✅ **Water sources** - Stillwater aquifers are independent from Grand Lake
- ✅ **Redundancy concept** - OG&E and GRDA do provide redundancy

### What Needs Verification:
- ⚠️ **Capacity numbers** - Some are inaccurate:
  - **Mustang**: Listed as 1,200 MW, but may be ~462 MW (after modernization)
  - **Muskogee**: Listed as 1,046 MW, but may be ~1,700 MW
  - **Sooner**: Listed as 1,200 MW, but may be ~1,100 MW
  - **Total capacity**: Listed as 7,116 MW, but may be ~6,141 MW

- ⚠️ **Rates** - Approximate, not verified from current rate schedules
- ⚠️ **Some facility coordinates** - May need verification

## Verified Information from Web Search:

1. **Sooner Power Plant**: ~1,100 MW (not 1,200 MW)
2. **Muskogee Power Plant**: ~1,700 MW (not 1,046 MW)
3. **Mustang Energy Center**: ~462 MW after modernization (not 1,200 MW)
4. **Horseshoe Lake**: ~450 MW after upgrades (close to our 400 MW)
5. **Shady Point Plant**: 360 MW (not in our data)
6. **Oklahoma Cogeneration Facility**: 146 MW (not in our data)
7. **Total OG&E Capacity**: ~6,141 MW (not 7,116 MW)

## Recommended Actions:

### Option 1: Use EIA API (Most Reliable)
Create a script to pull data from EIA Form 860:
- Public, free API
- Official government data
- Updated regularly
- Accurate capacity numbers

### Option 2: Manual Verification
1. Check OG&E annual reports
2. Review Oklahoma Corporation Commission filings
3. Cross-reference with EIA database
4. Update the JSON file with verified numbers

### Option 3: Use Current Data with Disclaimer
- Keep current data structure
- Add clear disclaimers about accuracy
- Note that it's "approximate" or "estimated"
- Update as better data becomes available

## Current Data Status:

**Use for**: 
- ✅ Understanding the redundancy concept
- ✅ General capacity mix (Gas ~67%, Coal ~22%, Renewables ~11%)
- ✅ Service territory mapping
- ✅ Water source analysis

**Do NOT use for**:
- ❌ Exact capacity planning
- ❌ Precise rate calculations
- ❌ Financial analysis
- ❌ Regulatory filings

## Next Steps:

1. **Immediate**: Add disclaimer to data file (DONE)
2. **Short-term**: Create EIA API extractor for accurate data
3. **Long-term**: Set up automated verification process

## Sources to Verify Against:

1. **EIA Form 860**: https://www.eia.gov/electricity/data/eia860/
2. **OG&E Investor Relations**: https://ogeenergy.gcs-web.com/
3. **Oklahoma Corporation Commission**: https://www.occeweb.com/
4. **EIA API**: https://www.eia.gov/opendata/

