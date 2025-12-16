# Quick Start: Answering the GRDA Capacity Question

This guide walks through answering the specific question:

> "How much generating capacity does GRDA control today, broken down by resource type (hydro, gas, coal, purchased power), and what planned additions or retirements are noted?"

## Prerequisites

1. **Python dependencies:**
   ```bash
   pip install pdfplumber pytesseract pillow openai python-dotenv
   # Optional but recommended for better table extraction:
   pip install 'camelot-py[cv]' tabula-py
   ```

2. **API Key (for LLM extraction):**
   - Set `OPENAI_KEY` or `ANTHROPIC_API_KEY` in your `.env` file

3. **Existing PDFs:**
   - PDFs should be in `data/grda/pdfs/` (you already have 186 PDFs)

## Step-by-Step Process

### Step 1: Create Manifest from Existing PDFs

Since PDFs are already downloaded, create a manifest:

```bash
python scripts/grda/create_manifest_from_pdfs.py
```

This creates `data/grda/pdf_manifest.json` from your existing PDFs.

### Step 2: Process PDFs (Extract Text, Tables, Figures)

Process all PDFs to extract structured content:

```bash
python scripts/grda/grda_pdf_processor.py
```

This will:
- Extract text and chunk it by page
- Extract tables (if camelot/tabula installed)
- Extract figures with captions
- Save processed JSON files to `data/grda/processed/{vertical}/`

**Note:** This may take a while for 186 PDFs. You can test with a single PDF first by modifying the script.

### Step 3: Extract Power Asset Data with LLM

Run LLM extraction to pull structured power capacity data:

```bash
python scripts/grda/grda_llm_extraction.py
```

This will:
- Use the `power_assets` schema to extract:
  - Generating units (name, type, MW, commissioned date)
  - Capacity mix (Hydro, Gas, Coal, Purchased)
  - Owned vs purchased percentages
  - Planned additions and retirements
- Save enriched files as `*_enriched.json`

**Note:** This requires an API key and will make API calls. Set `MAX_API_CALLS_PER_RUN` if you want to limit costs.

### Step 4: Answer the Question

Run the answer script:

```bash
python scripts/grda/answer_capacity_question.py
```

This will:
- Load all enriched documents with power asset data
- Aggregate capacity by resource type
- List generating units
- Show planned additions/retirements
- Display the answer and save to `data/grda/capacity_answer.txt`

## Testing with a Single PDF

To test the pipeline with just one PDF:

1. **Manually create a test manifest:**
   ```python
   # Edit create_manifest_from_pdfs.py to filter for one PDF
   # Or manually create data/grda/pdf_manifest.json with one entry
   ```

2. **Process that one PDF:**
   ```bash
   python scripts/grda/grda_pdf_processor.py
   ```

3. **Extract with LLM:**
   ```bash
   python scripts/grda/grda_llm_extraction.py --max-calls 1
   ```

4. **Get answer:**
   ```bash
   python scripts/grda/answer_capacity_question.py
   ```

## Expected Output

The answer script will produce output like:

```
================================================================================
GRDA GENERATING CAPACITY SUMMARY
================================================================================

CURRENT CAPACITY BY RESOURCE TYPE:
--------------------------------------------------------------------------------
  Hydro: 380 MW (27.1%)
  Gas: 800 MW (57.1%)
  Purchase Contracts: 300 MW (21.4%)

  TOTAL: 1,480 MW

GENERATING UNITS:
--------------------------------------------------------------------------------
  • Pensacola Dam: 120 MW (Hydro) - Commissioned: 1940
  • Salina Pumped Storage: 260 MW (Hydro) - Commissioned: 1968
  ...

PLANNED ADDITIONS:
--------------------------------------------------------------------------------
  • New Gas Unit: 200 MW - In Service: 2026-12 (planned)

PLANNED RETIREMENTS:
--------------------------------------------------------------------------------
  • Old Coal Unit: 150 MW - Retirement: 2025-06 (announced)

SOURCES:
--------------------------------------------------------------------------------
  • grda_power_assets_2024
    https://grda.com/...
```

## Troubleshooting

### No Power Asset Data Found

If the answer shows "No capacity data found", it means:
1. No PDFs were processed with `power_assets` vertical, OR
2. LLM extraction didn't find power capacity information in the PDFs

**Solutions:**
- Check which PDFs might contain power asset info (annual reports, financial reports, etc.)
- Manually set vertical to `power_assets` for relevant PDFs
- Check LLM extraction logs to see what was extracted

### Processing Errors

- **PDF processing fails:** Check that `pdfplumber` is installed
- **Table extraction fails:** Install `camelot-py` or `tabula-py` (optional)
- **LLM extraction fails:** Check API key is set in `.env`

## Next Steps

Once this works, you can:
1. Process more PDFs to get better coverage
2. Enhance the Q&A system to answer other questions
3. Add more vertical schemas (transmission, rates, water, etc.)

