Awesome. I tuned your plan so it’s directly useful for **site selection** and **power + water strategy** in GRDA territory. I kept your phases/files, but expanded **what we extract**, **how we index**, and **how answers are composed** for decisions like data centers/fabs.

---

# GRDA Website Data Extraction and Q&A System (Site-Selection Focus)

## Objective

Turn GRDA PDFs into a **reliable, cited Q&A** that answers site-selector questions about **power capacity & mix, transmission, rates & contracts, water availability & priorities, shoreline/intake permits, capital plans, and timelines**.

---

# Architecture (Revised)

## Phase 1: Website Mapping & Discovery

**Script:** `scripts/grda/grda_website_mapper.py`
**Additions for site selection**

* Start URLs: `https://grda.com/electricity/` plus About, Water, Shoreline, Governance, Financials, Economic Development, Board agendas/minutes.
* Classify link targets by **vertical** using rules/regex on URL/title:

  * `power_assets/`, `transmission/`, `rates_tariffs/`, `contracts_policies/`, `water_policy/`, `shoreline_permitting/`, `financials/`, `capital_plans/`, `board_minutes/`, `environmental/`, `economic_dev/`, `maps_figures/`
* Output: `data/grda/website_structure.json`

  * For each doc: `{url, anchor_text, discovered_on, vertical_guess, date_guess, filename_guess}`

> Tip: capture **page anchors** (e.g., #page=12) where present and keep a `suspected_pages` hint.

---

## Phase 2: PDF Download & Organization

**Script:** `scripts/grda/grda_pdf_downloader.py`

* Save to `data/grda/pdfs/{vertical}/YYYY/slug.pdf`
* Manifest `data/grda/pdf_manifest.json`:

  ```json
  {
    "document_id": "grda_financials_2024_acfr",
    "url": "...",
    "vertical": "financials",
    "filename": "2024_ACFR.pdf",
    "sha256": "...",
    "discovered_on": "2025-11-07",
    "downloaded_on": "2025-11-07",
    "filesize_bytes": 1234567,
    "http_status": 200
  }
  ```
* **De-duplication:** hash compare; keep most recent URL as canonical.

---

## Phase 3: PDF Processing & JSON Extraction

**Script:** `scripts/grda/grda_pdf_processor.py`
Re-use your PDF stack + add table extraction + figure detection:

* Text: `pdfplumber` (+OCR via `pytesseract` if low text density)
* Tables: `camelot` (lattice/stream) fallback to `tabula-py`
* Figures: save page images + captions; index alt-text if present

### Output per doc → `data/grda/processed/{vertical}/{document_id}.json`

**Common envelope**

```json
{
  "document_id": "...",
  "source_url": "...",
  "vertical": "power_assets",
  "extraction_date": "2025-11-07",
  "metadata": { "title": "...", "date": "YYYY-MM-DD", "pages": 87, "publisher": "GRDA" },
  "chunks": [
    { "chunk_id": "c001", "page": 3, "text": "..." },
    { "chunk_id": "c002", "page": 4, "text": "..." }
  ],
  "tables": [
    { "table_id": "t01", "page": 12, "csv_path": "..." }
  ],
  "figures": [
    { "figure_id": "f01", "page": 7, "caption": "..." }
  ],
  "entities": { /* type-specific schema below */ }
}
```

### **Entity schemas (by vertical)**

**Power assets (`power_assets/`)**

```json
{
  "generating_units": [
    { "name": "Pensacola Dam", "type": "Hydro", "net_MW": 120, "commissioned": 1940, "fuel": "Hydro" }
  ],
  "capacity_mix": { "Hydro_MW": 380, "Gas_MW": 800, "Coal_MW": 0, "Purchase_Contracts_MW": 300 },
  "owned_vs_purchased": { "owned_pct": 72, "purchased_pct": 28 }
}
```

**Transmission (`transmission/`)**

```json
{
  "substations": [
    { "name": "MAIP Substation", "kV": 345, "nearby_industrial": ["MidAmerica Industrial Park"] }
  ],
  "lines": [
    { "voltage_kV": 345, "from": "A", "to": "B", "status": "in-service" }
  ],
  "interconnections": [
    { "with_utility": "SPP/OG&E/PSO", "type": "tie", "notes": "capacity limits if any" }
  ]
}
```

**Rates & tariffs (`rates_tariffs/`)**

```json
{
  "rate_classes": [
    { "code": "Large-Industrial", "demand_charge_$per_kW": 12.5, "energy_charge_$per_MWh": 35, "rider": "fuel_adj" }
  ],
  "contract_policies": {
    "term_years": [5,10,15],
    "indexation": ["fuel_adj", "market"],
    "board_approval_required": true
  }
}
```

**Contracts & policies (`contracts_policies/`)**

```json
{
  "industrial_programs": [
    { "name": "Economic Development Rider", "eligibility_MW": ">=10", "incentive": "discounted demand for X years" }
  ],
  "board_actions": [
    { "date": "YYYY-MM-DD", "subject": "Capacity reservation", "result": "approved" }
  ]
}
```

**Water policy (`water_policy/`)**

```json
{
  "raw_water_rights": { "authority": "GRDA", "basins": ["Grand Lake","Lake Hudson"] },
  "allocations": [
    { "customer_type": "industrial", "unit": "MGD", "priority": "as_scheduled" }
  ],
  "drought_rules": [
    { "stage": "Stage 2", "trigger": "elev < X", "actions": ["reduce releases","curtail non-essential"] }
  ],
  "intake_discharge_permits": { "required": true, "docs": ["application_form","engineering_drawings"], "fees": { "application": 500 } }
}
```

**Shoreline/permitting (`shoreline_permitting/`)**

```json
{
  "activities": [
    { "type": "intake_structure", "allowed": true, "setbacks_ft": 50, "env_review": "if > X gpm" }
  ],
  "process": { "steps": ["pre-app","submission","public_notice","board_decision"], "typical_days": 90 },
  "fees": [{ "name": "Shoreline construction permit", "amount_usd": 750 }]
}
```

**Financials (`financials/`)**

```json
{
  "revenues_usd": { "fy2024": 552450000, "fy2023": 610000000 },
  "operating_income_usd": { "fy2024": 90000000 },
  "capex_usd": [{ "fy": 2024, "amount": 120000000, "projects": ["345kV upgrade"] }],
  "debt_outstanding_usd": { "fy2024": 1100000000 }
}
```

**Capital plans (`capital_plans/`)**

```json
{
  "projects": [
    { "name": "345kV MAIP Expansion", "status": "planned", "in_service": "2026-12", "benefit": "industrial load enablement" }
  ]
}
```

**Economic development (`economic_dev/`)**

```json
{
  "industrial_sites": [
    { "name": "MidAmerica Industrial Park", "served_by": "GRDA", "notes": "target for large loads" }
  ],
  "incentives": [{ "program": "Electric service incentives", "details": "..." }]
}
```

> All entities should carry **`evidence`** arrays linking to page-level chunk ids for traceability:

```json
"evidence": [{ "page": 12, "chunk_id": "c034", "quote": "..." }]
```

---

## Phase 4: Q&A System (RAG with “Site-Selector Mode”)

**Script:** `scripts/grda/grda_qa_system.py`

### Retrieval

* **Hybrid**: FAISS dense embeddings + BM25 keyword over `chunks.text`, `tables.csv_text`, and entity JSON.
* Re-rank with `LLM cross-encoder` or `text-embedding-3-large` cosine.
* **Filters** by vertical + year for precision (e.g., `vertical:rates_tariffs` AND `year>=2022`).

### Answering

* **Two-pass synthesis**:

  1. Compose facts **only from retrieved chunks/entities** (no outside priors).
  2. Generate a **decision-ready summary** for site selection (power, water, permitting, timeline), **then** list citations.
* **Citations**: `title / doc_id / page` and deep link if `#page` is resolvable.

### Guardrails

* If insufficient evidence → answer: *“Not found in GRDA docs. Here’s what we searched and why it might be in: {vertical}.”*
* Conflicts → show both, with dates and pages.

### API (optional)

* `api/grda-qa.js`: `POST /grda/qa { question, filters } → { answer, citations, retrieved }`

---

# Implementation Details

## Key Files (as you outlined, with site-selector adds)

* `scripts/grda/grda_website_mapper.py`
* `scripts/grda/grda_pdf_downloader.py`
* `scripts/grda/grda_pdf_processor.py`
* `scripts/grda/grda_qa_system.py`
* `api/grda-qa.js` (optional)

## Dependencies

* Existing: `pdfplumber`, `pytesseract`, `langchain`, `openai`, `anthropic`, `faiss-cpu`
* Add: `beautifulsoup4`, `requests`, `camelot-py` (and `ghostscript`), `rank_bm25`, `rapidfuzz`

---

# Data Layout (Expanded)

```
data/grda/
├── website_structure.json
├── pdf_manifest.json
├── pdfs/
│   ├── power_assets/
│   ├── transmission/
│   ├── rates_tariffs/
│   ├── contracts_policies/
│   ├── water_policy/
│   ├── shoreline_permitting/
│   ├── financials/
│   ├── capital_plans/
│   ├── board_minutes/
│   ├── environmental/
│   └── economic_dev/
└── processed/
    └── {vertical}/
        └── {document_id}.json
```

---

# Q&A “Site-Selector Mode” (built-in prompts)

### Prompt templates (examples)

**Power capacity & mix**

> “From GRDA PDFs only, list current **net MW** by fuel, owned vs purchased, and any **planned additions** with in-service dates. Cite page numbers.”

**Transmission near MAIP**

> “Summarize **345/138/69 kV** assets serving **MidAmerica Industrial Park** and any **interconnections**. Include nearest substations and planned upgrades. Cite.”

**Water availability & drought**

> “From GRDA docs, explain **who controls raw water**, **allocation rules**, and **drought priority stages**. Note any **industrial curtailment** policies. Cite.”

**Rates & contracting**

> “Show **large-industrial** rate components (demand/energy/riders), whether **long-term contracts** exist, and how rates are **approved/adjusted**. Cite.”

**Shoreline/intake permitting**

> “What permits are required for **water intake/discharge structures** on GRDA lakes, with **setbacks, reviews, fees, and typical timelines**? Cite.”

**Capital plans**

> “List **capital projects** that enable **industrial load growth** (lines, substations, generation) with **status** and **dates**. Cite.”

---

# Evaluation & QA

## Gold question sets (aligned to your thesis)

1. **Capacity & mix:** “What is GRDA’s current hydro MW and percent of total?”
2. **Interties:** “Does GRDA have transmission interconnections with other utilities/SPP?”
3. **Industrial readiness:** “What capital projects are planned to enable new large loads near Pryor/MAIP?”
4. **Rate stability:** “Are industrial rates board-approved or commission-regulated?”
5. **Water curtailment:** “How are industrial withdrawals prioritized during drought?”
6. **Permitting timeline:** “Typical days to permit an intake structure?”
7. **Contracting:** “Does GRDA offer fixed-price or index-linked long-term contracts?”

## Metrics

* **Exactness**: % answers with **explicit numbers** + **correct units**
* **Grounding**: % answers with ≥2 citations to **specific pages**
* **Latency**: p95 < 4s (cached embeddings)
* **Coverage**: % of gold questions answerable from current corpus

---

# Practical niceties for site-selectors

* **Answer shape**: always output a **decision block** up top:

  * **Power**: capacity headroom, planned upgrades (dates)
  * **Water**: authority, allocation, drought priority
  * **Permits**: required, timeline, fees
  * **Contracts/Rates**: term/adjustments, stability risks
* **Compare mode** (coming soon): flag differences across **years** (e.g., rate changes FY2023→FY2025).
* **Timeline extraction**: normalize dates to ISO; render Gantt-style in UI later.

---

# Future Enhancements (prioritized)

1. **Update watcher**: weekly diff on `grda.com` → re-ingest changed PDFs
2. **Board minutes miner**: detect approvals for capacity reservations/industrial agreements
3. **Figure-to-map**: capture substation/line names from map captions into a normalized **grid asset registry**
4. **Confidence scores**: show doc freshness + citation density
5. **Compare utilities** (later, external to GRDA): OG&E/PSO side-by-side for true **dual-grid hedging** narratives

---


