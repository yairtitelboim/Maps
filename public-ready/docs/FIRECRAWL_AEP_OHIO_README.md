## Firecrawl Plan – AEP Ohio / PJM Filings (Columbus Metro)

### 1. Objective

**Goal:** Use Firecrawl *surgically* (fewest possible credits) to extract structured signals from PJM / AEP / county records about:

- **Transmission upgrades** planned within ~10 miles of the Columbus, OH metro area.
- **Interconnection requests** (e.g., “50 customers at 90 sites / 30 GW” → which sites survived vs disappeared after tariff).
- **Land transactions 2023–2024** near key substations, especially:
  - Industrial‑zoned parcels within \<5 miles of those substations.
  - Price premiums vs comparable parcels further from the grid.

Output should be small, structured JSONs we can join against:

- `public/osm/aep_ohio_substations.json`
- `public/osm/aep_ohio_transmission_lines.json`
- Future interconnection / land‑transaction datasets (`public/data/aep_ohio_*`).

We **do not** want to “crawl the web”; we want **surgical, high‑value scrapes**.

---

### 2. Key Questions to Answer

1. **Transmission Upgrades:**
   - Where did PJM / AEP plan upgrades (new lines, uprates, substations) in AEP Ohio territory?
   - Which of those are **within 10 miles of Columbus metro**?
   - Of those, which:
     - Proceeded (in service / under construction)?
     - Stalled / canceled (withdrawn, indefinitely delayed)?

2. **Interconnection Requests:**
   - Where were the **90 sites (≈30 GW)** of AEP interconnection requests in/near AEP Ohio?
   - Which sites:
     - Survived the tariff (≈13 GW)?
     - Disappeared (≈17 GW)?
   - How tightly are they **clustered around substations and 345/500/765 kV lines**?

3. **Land Transactions 2023–2024 Near Substations:**
   - For counties in and around Columbus:
     - Which parcels **changed hands in 2023–2024**?
     - Of those, which are:
       - Zoned industrial / employment / heavy commercial.
       - Within **\<5 miles** of high‑value substations (500/345/138 kV).
   - Do those parcels show **price premiums** vs similar parcels further from the grid?

4. **Speculation Hypothesis:**
   - If this was speculation:
     - Dense clustering of interconnection requests within 5 miles of major substations.
     - 2023–2024 land‑transaction spike in those corridors.
     - Price premiums near grid vs away.
     - After tariff: requests vanish, land sits idle, little/no build‑out.

Firecrawl’s job is **not** to do the spatial math; it’s to extract:

- Tabular interconnection rows (site, MW, status, dates, queue IDs).
- Descriptions of planned vs in‑service upgrades.
- County assessor table views (parcel IDs, prices, dates, zoning classes).

---

### 3. Data Sources & Target URLs (High-Value Only)

We want a **short, curated URL list**, not a crawl of whole sites.

#### 3.1 PJM Interconnection Queue / Filings

- PJM queue / interconnection detail pages for AEP Ohio zone:
  - Target: URLs that show **site name, county, MW, status, withdrawn date, associated upgrades**.
  - Examples (to be refined by manual search):
    - Queue search filtered by **Transmission Zone = AEP** and **State = OH**.
    - Individual queue project pages for large data‑center‑scale requests.

**Firecrawl use:** `v1/scrape` or `v1/extract` with:

- `formats: ["markdown"]` or `"format": "json"` (for table heavy pages).
- Prompt to extract:
  - Project ID / queue ID
  - County, state
  - MW requested
  - Substation / station name
  - Voltage level of interconnection
  - Status (active, withdrawn, in‑service)
  - Dates (submitted, withdrawn, in‑service)

#### 3.2 AEP / PJM Transmission Planning Docs

Likely sources:

- **PJM Transmission Expansion Advisory Committee (TEAC)** materials.
- **RTEP / supplemental projects** PDFs where AEP Ohio upgrades are listed.
- AEP Ohio or PJM “planned upgrades” tables.

**Firecrawl use:** `v1/extract` against:

- Specific AEP/PJM planning PDFs or HTML tables.
- Prompted to extract:
  - Upgrade name / project ID.
  - Substation(s) affected.
  - Voltage level(s).
  - Approximate location (county, state, textual description).
  - Status (planned, under construction, cancelled, in service).

#### 3.3 County Assessor / Auditor Sites (Land Transactions)

Focus on **few counties** first (highest yield):

- Franklin County (Columbus core).
- Delaware, Licking, Madison, Pickaway, Union (as needed).

Each county often has:

- “Sales search” / “Transfer search” pages.
- Ability to filter by **sale/transfer date** and sometimes **land use / zoning**.

**Firecrawl use:** only on:

- Paginated **search result tables** for 2023–2024 sales, filtered as much as the UI allows.
- Extract:
  - Parcel ID.
  - Sale date.
  - Sale price.
  - Property class / land use / zoning code.
  - Address / coordinates (if present; otherwise we geocode via a separate pipeline).

We **should not** crawl entire assessor sites; just:

- 1–3 curated result pages per county.
- Possibly a small number of detail pages for parcels we pick as exemplars.

---

### 4. Firecrawl Usage Strategy (Minimize Credits)

Constraints: **credits are limited**. Strategy:

- **No broad crawls**. Prefer **single `scrape` / `extract` calls** to known URLs.
- **Cache everything**:
  - Save raw responses to `data/firecrawl/raw/*.json`.
  - Save cleaned, structured tables to `public/data/aep_ohio_firecrawl_*.json`.
  - Never re‑scrape the same URL unless the underlying data clearly changed.
- **Narrow prompts**:
  - Only ask for the columns we actually use in spatial analysis:
    - `project_id`, `mw`, `status`, `county`, `substation_name`, `voltage_kv`, `lat`, `lng` (if present).
    - `parcel_id`, `sale_date`, `sale_price`, `zoning_code`, `use_code`, `address`.
- **Batch within a call** when possible:
  - If a page lists **multiple projects or parcels**, we get many rows for one credit.

#### 4.1 Concrete Call Patterns

**Interconnection queue example:**

```bash
curl -s -X POST https://api.firecrawl.dev/v1/scrape \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://pjm-queue-url-for-aep-ohio.html",
    "formats": ["markdown"]
  }'
```

Then run a local parser (Python/Node) to extract a table from markdown into JSON rows.

**Planning PDF example:**

```bash
curl -s -X POST https://api.firecrawl.dev/v1/extract \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://pjm.com/path/to/aep-ohio-planning-doc.pdf",
    "prompt": "Extract a JSON array of transmission upgrades in AEP Ohio territory with fields: project_name, project_id, substation_names, counties, voltage_kv, status, notes."
  }'
```

**County sales search example:**

```bash
curl -s -X POST https://api.firecrawl.dev/v1/scrape \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://franklincountyohio.gov/auditor/sales-search?year=2023&class=industrial\",
    \"formats\": [\"markdown\"]
  }"
```

---

### 5. Pipeline Outline (End-to-End)

1. **Manual URL curation (no Firecrawl yet):**
   - Identify:
     - 3–5 **PJM queue / project list** pages for AEP Ohio.
     - 3–5 **PJM/AEP planning docs** (PDF/HTML) with upgrade tables.
     - 1–3 **sales search URLs per county** for 2023–2024, filtered by industrial/commercial class where possible.

2. **Batch Firecrawl calls (Phase 1):**
   - For each curated URL:
     - Call `v1/scrape` (tables) or `v1/extract` (PDFs) **once**.
     - Save raw responses to `data/firecrawl/raw/<short_name>.json`.

3. **Local parsing & normalization (Phase 2):**
   - Write Python/Node scripts to convert raw Firecrawl output into:
   - `public/data/aep_ohio_interconnection_requests.json`
   - `public/data/aep_ohio_land_transactions_2023_2024.json`
   - **Note:** `data/pjm/processed/aep_ohio_transmission_upgrades.json` is now generated from PJM’s official XML feed by `scripts/pjm/aep_ohio_transmission_upgrades_from_xml.py` (no Firecrawl credits required) and should be treated as the primary “planned vs built” upgrades source.
   - Normalize:
     - County names, project IDs.
     - Voltage categories (`138`, `345`, `500/765` kV buckets).
     - Parcel IDs, sale dates, sale prices.

4. **Spatial joining & enrichment (Phase 3 – non-Firecrawl):**
   - Join these tables against:
     - `aep_ohio_substations.json` (distance to nearest substation).
     - `aep_ohio_transmission_lines.json` (distance to nearest 345/500/765 kV lines).
   - Compute:
     - Indicators: `within_5_miles_substation`, `within_10_miles_columbus`, `voltage_band`.
     - Price premiums by distance band and zoning.

5. **Front-end integration (Phase 4):**
   - Expose new JSONs as map layers:
     - Points for interconnection sites (styled by survived vs disappeared).
     - Points/polygons for land transactions (styled by premium vs control).
     - Annotations for planned vs stalled upgrades.

---

### 6. Credit Budgeting & Safety Rails

- **Start with 10–20 calls max**:
  - 5–8 PJM queue / project/summary pages.
  - 3–5 planning docs.
  - 3–5 county sales search result pages.
- **Log and track usage:**
  - Add a tiny `scripts/firecrawl/log_usage.json` that records:
    - URL, timestamp, endpoint (`scrape`/`extract`), and response status.
  - Never re‑call a URL without checking this log.
- **Fallback behavior:**
  - In the app, keep `FirecrawlTool` tolerant:
    - If Firecrawl fails or is disabled, show a “data unavailable / using last cached” state, not a hard error.

---

### 7. Implementation Checklist (Firecrawl Scope Only)

- [ ] Curate target PJM / AEP / county URLs into `docs/FIRECRAWL_AEP_OHIO_URLS.md` (new file).
- [ ] Implement minimal Node/Python scripts to:
  - [ ] Call `v1/scrape` / `v1/extract` for each curated URL.
  - [ ] Write raw responses into `data/firecrawl/raw/`.
- [ ] Implement parsers to produce:
  - [ ] `public/data/aep_ohio_interconnection_requests.json`
  - [ ] `public/data/aep_ohio_land_transactions_2023_2024.json`
- [ ] Wire in PJM XML upgrades feed:
  - [ ] Run `scripts/pjm/aep_ohio_transmission_upgrades_from_xml.py` to refresh `data/pjm/processed/aep_ohio_transmission_upgrades.json`
  - [ ] Use that JSON as the input “planned upgrades” table for transmission analysis
- [ ] Join against OSM outputs and compute distance/zoning metrics (non-Firecrawl).
- [ ] Wire minimal front-end layers to visualize:
  - [ ] Interconnection sites (survived vs disappeared).
  - [ ] Land transactions (premium vs control, near vs far from grid).
  - [ ] Planned vs stalled upgrades.
- [ ] Monitor Firecrawl credit usage and stop before hitting limits.

This README is intentionally **Firecrawl-focused** and assumes the OSM + spatial analysis stack from `docs/COLUMBUS_PREPROCESSING_ANALYSIS.md` is already in place. Use it as the playbook for **when and how** to spend Firecrawl credits on the highest‑yield URLs for the AEP Ohio / Columbus investigation.


