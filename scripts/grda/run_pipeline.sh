#!/bin/bash
# GRDA Data Extraction Pipeline
# Modular pipeline with progress tracking and step-by-step execution

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print section headers
print_section() {
    echo ""
    echo -e "${BLUE}=========================================="
    echo -e "$1"
    echo -e "==========================================${NC}"
    echo ""
}

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to check if step is needed
check_step() {
    local step_name=$1
    local check_file=$2
    
    if [ -f "$check_file" ]; then
        print_warning "Step '$step_name' appears complete (found $check_file)"
        read -p "Skip this step? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            return 1  # Skip
        fi
    fi
    return 0  # Run
}

# Function to show summary
show_summary() {
    local step=$1
    print_section "Step $step Summary"
    
    case $step in
        1)
            if [ -f "data/grda/website_structure.json" ]; then
                python3 -c "
import json
try:
    d = json.load(open('data/grda/website_structure.json'))
    pages = len(d.get('pages', []))
    pdfs = len(d.get('all_pdfs', []))
    print(f'Pages crawled: {pages}')
    print(f'PDFs discovered: {pdfs}')
    print('\nPDFs by vertical:')
    for k, v in d.get('pdfs_by_vertical', {}).items():
        if v:
            print(f'  {k}: {len(v)} PDFs')
except Exception as e:
    print(f'Error reading summary: {e}')
"
            fi
            ;;
        2)
            if [ -f "data/grda/pdf_manifest.json" ]; then
                python3 -c "
import json
try:
    d = json.load(open('data/grda/pdf_manifest.json'))
    total = d.get('total_pdfs', 0)
    success = d.get('successful_downloads', 0)
    failed = d.get('failed_downloads', 0)
    print(f'Total PDFs: {total}')
    print(f'Successfully downloaded: {success}')
    print(f'Failed: {failed}')
    print(f'Downloaded to: data/grda/pdfs/')
except Exception as e:
    print(f'Error reading summary: {e}')
"
            else
                print_warning "Manifest not found. Checking downloaded files..."
                find data/grda/pdfs -name "*.pdf" 2>/dev/null | wc -l | xargs echo "PDFs found:"
            fi
            ;;
        3)
            if [ -f "data/grda/processing_summary.json" ]; then
                python3 -c "
import json
try:
    d = json.load(open('data/grda/processing_summary.json'))
    stats = d.get('stats', {})
    print(f'Processed: {stats.get(\"processed\", 0)} PDFs')
    print(f'Failed: {stats.get(\"failed\", 0)} PDFs')
    print(f'Total pages: {stats.get(\"total_pages\", 0)}')
    print(f'Total characters: {stats.get(\"total_characters\", 0):,}')
    print(f'Processed files in: data/grda/processed/')
except Exception as e:
    print(f'Error reading summary: {e}')
"
            else
                find data/grda/processed -name "*.json" 2>/dev/null | wc -l | xargs echo "Processed files found:"
            fi
            ;;
        4)
            if [ -f "data/grda/processed/extraction_summary.json" ]; then
                python3 -c "
import json
try:
    d = json.load(open('data/grda/processed/extraction_summary.json'))
    stats = d.get('stats', {})
    print(f'Documents processed: {stats.get(\"processed\", 0)}')
    print(f'Failed: {stats.get(\"failed\", 0)}')
    print(f'API calls: {stats.get(\"api_calls\", 0)}')
except Exception as e:
    print(f'Error reading summary: {e}')
"
            else
                find data/grda/processed -name "*_enriched.json" 2>/dev/null | wc -l | xargs echo "Enriched files found:"
            fi
            ;;
        5)
            if [ -d "data/grda/vector_store/faiss_index" ]; then
                print_status "Vector store exists at data/grda/vector_store/faiss_index"
                print_status "Q&A system is ready to use"
            else
                print_warning "Vector store not found"
            fi
            ;;
    esac
    echo ""
}

# Main pipeline
print_section "GRDA Data Extraction Pipeline"

# Parse arguments
SKIP_STEPS=""
if [ "$1" == "--step" ]; then
    SKIP_STEPS=$2
    echo "Running only step $SKIP_STEPS"
    echo ""
fi

# Step 1: Map website
if [ -z "$SKIP_STEPS" ] || [ "$SKIP_STEPS" == "1" ]; then
    print_section "Step 1/5: Mapping GRDA Website"
    
    if check_step "Website Mapping" "data/grda/website_structure.json"; then
        python3 scripts/grda/grda_website_mapper.py
        print_status "Website mapping complete"
    else
        print_status "Skipped website mapping"
    fi
    
    show_summary 1
    read -p "Press Enter to continue to next step (or Ctrl+C to exit)..."
fi

# Step 2: Download PDFs
if [ -z "$SKIP_STEPS" ] || [ "$SKIP_STEPS" == "2" ]; then
    print_section "Step 2/5: Downloading PDFs"
    
    if check_step "PDF Download" "data/grda/pdf_manifest.json"; then
        python3 scripts/grda/grda_pdf_downloader.py
        print_status "PDF download complete"
    else
        print_status "Skipped PDF download"
    fi
    
    show_summary 2
    read -p "Press Enter to continue to next step (or Ctrl+C to exit)..."
fi

# Step 3: Process PDFs
if [ -z "$SKIP_STEPS" ] || [ "$SKIP_STEPS" == "3" ]; then
    print_section "Step 3/5: Processing PDFs"
    
    if check_step "PDF Processing" "data/grda/processing_summary.json"; then
        python3 scripts/grda/grda_pdf_processor.py
        print_status "PDF processing complete"
    else
        print_status "Skipped PDF processing"
    fi
    
    show_summary 3
    read -p "Press Enter to continue to next step (or Ctrl+C to exit)..."
fi

# Step 4: LLM Extraction (optional)
if [ -z "$SKIP_STEPS" ] || [ "$SKIP_STEPS" == "4" ]; then
    print_section "Step 4/5: LLM Extraction (Optional)"
    
    if [ -z "$OPENAI_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
        print_warning "No LLM API key found (OPENAI_KEY or ANTHROPIC_API_KEY)"
        print_warning "Skipping LLM extraction step"
    else
        if check_step "LLM Extraction" "data/grda/processed/extraction_summary.json"; then
            python3 scripts/grda/grda_llm_extraction.py
            print_status "LLM extraction complete"
        else
            print_status "Skipped LLM extraction"
        fi
    fi
    
    show_summary 4
    read -p "Press Enter to continue to next step (or Ctrl+C to exit)..."
fi

# Step 5: Create vector store
if [ -z "$SKIP_STEPS" ] || [ "$SKIP_STEPS" == "5" ]; then
    print_section "Step 5/5: Creating Vector Store for Q&A"
    
    if [ -d "data/grda/vector_store/faiss_index" ]; then
        print_warning "Vector store already exists"
        read -p "Recreate vector store? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            python3 scripts/grda/grda_qa_system.py --recreate --query "test" --json > /dev/null 2>&1 || true
            print_status "Vector store recreated"
        else
            print_status "Using existing vector store"
        fi
    else
        python3 scripts/grda/grda_qa_system.py --query "test" --json > /dev/null 2>&1 || true
        print_status "Vector store created"
    fi
    
    show_summary 5
fi

# Final summary
print_section "Pipeline Complete!"
echo "You can now query the system:"
echo "  python3 scripts/grda/grda_qa_system.py"
echo ""
echo "Or test it:"
echo "  python3 scripts/grda/test_grda_system.py"
echo ""
echo "To run a specific step:"
echo "  ./scripts/grda/run_pipeline.sh --step 2"
