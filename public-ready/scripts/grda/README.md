# GRDA Website Data Extraction and Q&A System

This system extracts, processes, and enables Q&A over PDF documents from the GRDA (Grand River Dam Authority) website.

## Overview

The system consists of four main phases:

1. **Website Mapping** - Discovers and catalogs all PDFs on the GRDA website
2. **PDF Download** - Downloads PDFs organized by vertical/category
3. **PDF Processing** - Extracts text and structure from PDFs
4. **LLM Extraction** - Uses LLMs to extract structured data
5. **Q&A System** - Provides query interface with vector search

## Prerequisites

### Python Dependencies

```bash
pip install requests beautifulsoup4 lxml pdfplumber pytesseract pillow openai anthropic python-dotenv langchain langchain-openai langchain-community faiss-cpu
```

### Environment Variables

Create a `.env` file in the project root:

```bash
OPENAI_KEY=your_openai_api_key
# OR
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Usage

### Quick Start: Run Full Pipeline

Run all steps interactively with progress tracking:

```bash
./scripts/grda/run_pipeline.sh
```

The pipeline will:
- Show progress at each step
- Allow you to skip steps that are already complete
- Display summaries after each step
- Pause between steps for observation

### Run Individual Steps

For more control, run steps individually:

```bash
# Step 1: Map website
./scripts/grda/step1_map_website.sh

# Step 2: Download PDFs
./scripts/grda/step2_download_pdfs.sh

# Step 3: Process PDFs
./scripts/grda/step3_process_pdfs.sh

# Step 4: LLM Extraction (optional, requires API key)
./scripts/grda/step4_llm_extraction.sh

# Step 5: Create vector store
./scripts/grda/step5_create_vector_store.sh
```

### Run Specific Step in Pipeline

Run only a specific step:

```bash
./scripts/grda/run_pipeline.sh --step 2
```

### Direct Python Script Usage

You can also run the Python scripts directly:

#### Step 1: Map the Website

```bash
python scripts/grda/grda_website_mapper.py
```

Creates `data/grda/website_structure.json` with all discovered PDFs organized by vertical.

#### Step 2: Download PDFs

```bash
python scripts/grda/grda_pdf_downloader.py
```

PDFs are organized in `data/grda/pdfs/{vertical}/` and a manifest is created at `data/grda/pdf_manifest.json`.

#### Step 3: Process PDFs

```bash
python scripts/grda/grda_pdf_processor.py
```

Processed JSON files are saved to `data/grda/processed/{vertical}/`.

#### Step 4: LLM Extraction (Optional)

```bash
python scripts/grda/grda_llm_extraction.py
```

Creates enriched JSON files with extracted entities (permit numbers, dates, locations, etc.).

#### Step 5: Query the System

**Interactive Mode:**
```bash
python scripts/grda/grda_qa_system.py
```

**Single Query:**
```bash
python scripts/grda/grda_qa_system.py --query "What are the permit requirements?" --vertical permits
```

**Test the System:**
```bash
python scripts/grda/test_grda_system.py --vertical permits
```

## Document Verticals

The system categorizes documents into:

- **permits** - Lake permitting, shoreline permits
- **financial_reports** - Annual reports, budgets, audits
- **shoreline_management** - Shoreline management plans, regulations
- **recreation** - Recreation rules, boat safety
- **flood_control** - Flood control, water management
- **pensacola_relicensing** - Pensacola hydroelectric project
- **ccr_compliance** - CCR rule compliance data
- **other** - Miscellaneous documents

## API Endpoint

An optional Express.js API endpoint is available at `api/grda-qa.js`:

```javascript
POST /api/grda-qa
Body: {
  "query": "What are the permit requirements?",
  "vertical": "permits",  // optional
  "k": 5  // number of documents to retrieve
}
```

## Data Structure

```
data/grda/
├── website_structure.json      # Website mapping results
├── pdf_manifest.json           # PDF download manifest
├── processing_summary.json      # Processing statistics
├── extraction_summary.json     # LLM extraction statistics
├── pdfs/                       # Downloaded PDFs
│   ├── permits/
│   ├── financial_reports/
│   └── ...
├── processed/                  # Processed JSON files
│   ├── permits/
│   ├── financial_reports/
│   └── ...
└── vector_store/               # FAISS vector store index
    └── faiss_index/
```

## Example Queries

- "What are the requirements for obtaining a lake permit?"
- "How much does a permit cost?"
- "What was GRDA's revenue last year?"
- "What are the shoreline construction regulations?"
- "What activities are prohibited on the shoreline?"

## Troubleshooting

### No PDFs Found

- Check that the GRDA website is accessible
- Verify the starting URL in `grda_website_mapper.py`
- Increase `--max-depth` if needed

### PDF Processing Fails

- Ensure `pdfplumber` is installed
- For scanned PDFs, install `pytesseract` and Tesseract OCR
- Check PDF file integrity

### LLM Extraction Fails

- Verify API keys are set in `.env`
- Check API rate limits
- Reduce `MAX_API_CALLS_PER_RUN` if needed

### Q&A System Errors

- Ensure vector store is created (run steps 1-4 first)
- Check that processed documents exist
- Verify OpenAI API key is set

## Notes

- The system respects rate limits and includes delays between requests
- PDFs are only downloaded once (skipped if already exists)
- Vector store is cached and reused unless `--recreate` is used
- Processing can be resumed if interrupted

