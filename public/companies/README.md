# Companies Data - CSV to JSON Conversion

## Overview
This directory contains Houston-area company data converted from CSV to JSON format and prepared for geocoding.

## Files

### Source Data
- `companies-9-24-2025.csv` - Original CSV file with 1,000 companies
- `companies-9-24-2025.json` - Converted JSON file with structured data

### Scripts
- `convert_companies_csv_to_json.py` - Conversion script
- `geocode_companies.py` - Geocoding script (requires Google Maps API key)
- `validate_companies_json.py` - Data validation and analysis script

## Data Structure

The JSON file contains:

```json
{
  "metadata": {
    "total_companies": 1000,
    "conversion_date": "2025-01-27",
    "geocoding_ready": true,
    "geocoding_fields": ["headquarters_location.cleaned"]
  },
  "companies": [
    {
      "id": 1,
      "name": "Company Name",
      "url": "https://...",
      "employees": {
        "min": 1001,
        "max": 5000,
        "range": "1001-5000"
      },
      "heat_score_tier": "High",
      "operating_status": "Active",
      "ipo_status": "Private",
      "headquarters_location": {
        "raw": "Houston, Texas, United States",
        "cleaned": "Houston, Texas",
        "geocoded": false,
        "coordinates": null,
        "formatted_address": null
      },
      "industries": ["Energy", "Oil and Gas"],
      "description": "Company description...",
      "cb_rank_organization": "1,827",
      "stage": "",
      "cb_rank_company": "1,533",
      "geocoding_status": "pending",
      "geocoding_notes": null
    }
  ]
}
```

## Key Features

### Data Preparation
- ✅ All 1,000 companies successfully converted
- ✅ Location data cleaned and standardized
- ✅ Employee counts parsed into structured format
- ✅ Industries split into arrays
- ✅ Geocoding-ready structure

### Location Data
- **Raw location**: Original location string from CSV
- **Cleaned location**: Standardized for geocoding (removed "United States" suffix)
- **Geocoding fields**: Ready for coordinate lookup

### Company Statistics
- **Total**: 1,000 companies
- **Location**: All Houston, Texas based
- **Status**: All active companies
- **IPO Status**: 983 private, 17 public
- **Size**: Mostly small-medium (101-500 employees)

## Geocoding

To geocode the locations:

1. Set your Google Maps API key:
   ```bash
   export GOOGLE_MAPS_API_KEY='your_api_key_here'
   ```

2. Run the geocoding script:
   ```bash
   python geocode_companies.py
   ```

This will create `companies-9-24-2025-geocoded.json` with coordinates and formatted addresses.

## Usage

### Load in JavaScript
```javascript
fetch('/companies/companies-9-24-2025.json')
  .then(response => response.json())
  .then(data => {
    console.log(`Loaded ${data.metadata.total_companies} companies`);
    data.companies.forEach(company => {
      console.log(company.name, company.headquarters_location.cleaned);
    });
  });
```

### Filter by Industry
```javascript
const energyCompanies = data.companies.filter(company => 
  company.industries.includes('Energy')
);
```

### Filter by Size
```javascript
const largeCompanies = data.companies.filter(company => 
  company.employees.min >= 1000
);
```

## Next Steps

1. **Geocode locations** using the provided script
2. **Integrate with map visualization** using coordinates
3. **Add filtering capabilities** by industry, size, etc.
4. **Implement search functionality** across company data
