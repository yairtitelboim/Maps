#!/usr/bin/env python3
"""
GRDA LLM Extraction

This script uses LLMs to extract structured data from processed GRDA PDFs.
It creates enriched JSON files with extracted entities and structured information.

Requirements:
pip install openai anthropic python-dotenv
"""

import os
import json
import re
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
import time

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Global variables
EXTRACTION_MODEL = None
API_CALL_COUNT = 0
MAX_API_CALLS_PER_RUN = 100  # Higher limit for batch processing
MAX_TEXT_LENGTH = 8000  # Characters to send to LLM per document

# Try to import LLM libraries
try:
    from openai import OpenAI
    HAVE_OPENAI = True
except ImportError:
    HAVE_OPENAI = False
    logger.warning("OpenAI library not available")

try:
    import anthropic
    HAVE_ANTHROPIC = True
except ImportError:
    HAVE_ANTHROPIC = False
    logger.warning("Anthropic library not available")

HAVE_LLM = HAVE_OPENAI or HAVE_ANTHROPIC


def setup_extraction_model():
    """Set up the extraction model to use."""
    global EXTRACTION_MODEL
    
    if not HAVE_LLM:
        logger.warning("No LLM libraries available")
        return None
    
    if EXTRACTION_MODEL is not None:
        return EXTRACTION_MODEL
    
    # Try OpenAI first
    if HAVE_OPENAI:
        openai_key = os.environ.get("OPENAI_KEY", "").strip()
        if openai_key:
            try:
                EXTRACTION_MODEL = OpenAI(api_key=openai_key)
                logger.info("Using OpenAI for extraction")
                return EXTRACTION_MODEL
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI: {e}")
    
    # Try Anthropic
    if HAVE_ANTHROPIC:
        anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
        if anthropic_key:
            try:
                EXTRACTION_MODEL = anthropic.Anthropic(api_key=anthropic_key)
                logger.info("Using Anthropic for extraction")
                return EXTRACTION_MODEL
            except Exception as e:
                logger.error(f"Failed to initialize Anthropic: {e}")
    
    logger.warning("No LLM API keys found. Set OPENAI_KEY or ANTHROPIC_API_KEY")
    return None


def get_extraction_schema(doc_type):
    """Get extraction schema based on document type. Matches plan's site-selection schemas."""
    schemas = {
        "power_assets": {
            "description": "Extract power generation capacity and assets information",
            "schema": {
                "generating_units": [],
                "capacity_mix": {},
                "owned_vs_purchased": {},
                "planned_additions": [],
                "planned_retirements": []
            },
            "example": {
                "generating_units": [
                    {"name": "Pensacola Dam", "type": "Hydro", "net_MW": 120, "commissioned": 1940, "fuel": "Hydro"},
                    {"name": "Salina Pumped Storage", "type": "Hydro", "net_MW": 260, "commissioned": 1968, "fuel": "Hydro"}
                ],
                "capacity_mix": {"Hydro_MW": 380, "Gas_MW": 800, "Coal_MW": 0, "Purchase_Contracts_MW": 300},
                "owned_vs_purchased": {"owned_pct": 72, "purchased_pct": 28},
                "planned_additions": [
                    {"name": "New Gas Unit", "MW": 200, "in_service": "2026-12", "status": "planned"}
                ],
                "planned_retirements": [
                    {"name": "Old Coal Unit", "MW": 150, "retirement_date": "2025-06", "status": "announced"}
                ]
            }
        },
        "permits": {
            "description": "Extract permit-related information",
            "schema": {
                "permitNumbers": [],
                "permitTypes": [],
                "locations": [],
                "dates": [],
                "requirements": [],
                "fees": [],
                "contactInfo": []
            },
            "example": {
                "permitNumbers": ["PER-2024-001", "PER-2024-002"],
                "permitTypes": ["Lake Permitting", "Shoreline Construction"],
                "locations": ["Grand Lake", "Lake Hudson"],
                "dates": ["2024-01-15", "2024-03-20"],
                "requirements": ["Application form", "Site plan", "Environmental assessment"],
                "fees": ["$50 application fee", "$200 annual permit"],
                "contactInfo": ["GRDA Permitting Office: 918-256-5545"]
            }
        },
        "financial_reports": {
            "description": "Extract financial information",
            "schema": {
                "revenue": [],
                "expenses": [],
                "assets": [],
                "liabilities": [],
                "keyMetrics": [],
                "dates": [],
                "fiscalYear": None
            },
            "example": {
                "revenue": ["$50M in electricity sales", "$2M in recreation fees"],
                "expenses": ["$30M in operations", "$5M in maintenance"],
                "assets": ["$200M in infrastructure"],
                "liabilities": ["$50M in bonds"],
                "keyMetrics": ["Net income: $15M", "Debt ratio: 0.25"],
                "dates": ["2024-01-01 to 2024-12-31"],
                "fiscalYear": "2024"
            }
        },
        "shoreline_management": {
            "description": "Extract shoreline management information",
            "schema": {
                "regulations": [],
                "zones": [],
                "restrictions": [],
                "allowedActivities": [],
                "prohibitedActivities": [],
                "locations": []
            },
            "example": {
                "regulations": ["No construction within 50 feet of shoreline"],
                "zones": ["Recreation Zone", "Conservation Zone"],
                "restrictions": ["Height limit: 35 feet", "Setback: 50 feet"],
                "allowedActivities": ["Fishing", "Boating", "Swimming"],
                "prohibitedActivities": ["Dumping", "Unauthorized construction"],
                "locations": ["Grand Lake shoreline", "Lake Hudson"]
            }
        },
        "other": {
            "description": "Extract general information",
            "schema": {
                "keyTopics": [],
                "importantDates": [],
                "locations": [],
                "entities": [],
                "actions": []
            },
            "example": {
                "keyTopics": ["Electricity generation", "Water management"],
                "importantDates": ["2024-01-15"],
                "locations": ["Grand Lake"],
                "entities": ["GRDA", "Oklahoma"],
                "actions": ["Renewal", "Compliance"]
            }
        }
    }
    
    return schemas.get(doc_type, schemas["other"])


def extract_with_llm(text, doc_type, doc_id="unknown"):
    """Extract structured information from text using an LLM."""
    global API_CALL_COUNT, EXTRACTION_MODEL
    
    if not HAVE_LLM or EXTRACTION_MODEL is None:
        logger.warning("LLM extraction not available")
        return {}
    
    if API_CALL_COUNT >= MAX_API_CALLS_PER_RUN:
        logger.warning(f"API call limit reached ({MAX_API_CALLS_PER_RUN})")
        return {}
    
    # Truncate text to avoid excessive token usage
    text_for_prompt = text[:MAX_TEXT_LENGTH]
    if len(text) > MAX_TEXT_LENGTH:
        text_for_prompt += "\n\n[Document truncated...]"
    
    # Get schema for document type
    schema_info = get_extraction_schema(doc_type)
    schema = schema_info["schema"]
    example = schema_info["example"]
    
    # Create prompt
    prompt = f"""Extract structured information from this GRDA document (type: {doc_type}).

Document text:
{text_for_prompt}

Extract all relevant information and return it as JSON matching this structure:
{json.dumps(schema, indent=2)}

Example of expected format:
{json.dumps(example, indent=2)}

Return ONLY valid JSON matching the schema above. If information is not found, use empty arrays [] or null.
Do not include any explanatory text, only the JSON object."""

    try:
        API_CALL_COUNT += 1
        time.sleep(0.5)  # Rate limiting
        
        if isinstance(EXTRACTION_MODEL, OpenAI):
            logger.info(f"Extracting with OpenAI for {doc_id}")
            
            response = EXTRACTION_MODEL.chat.completions.create(
                model="gpt-4o-mini",  # Using cheaper model for extraction
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at extracting structured data from documents. Always return valid JSON matching the specified schema."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            logger.debug(f"OpenAI response: {content[:200]}...")
            
            try:
                result_json = json.loads(content)
                return result_json
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON from OpenAI: {e}")
                logger.error(f"Response: {content[:500]}")
                return {}
        
        elif isinstance(EXTRACTION_MODEL, anthropic.Anthropic):
            logger.info(f"Extracting with Anthropic for {doc_id}")
            
            response = EXTRACTION_MODEL.messages.create(
                model="claude-3-haiku-20240307",  # Using cheaper model
                max_tokens=2000,
                temperature=0.1,
                system="You are an expert at extracting structured data from documents. Always return valid JSON matching the specified schema.",
                messages=[{"role": "user", "content": prompt}]
            )
            
            content = response.content[0].text
            logger.debug(f"Anthropic response: {content[:200]}...")
            
            # Extract JSON from response (may have markdown code blocks)
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)
            if json_match:
                content = json_match.group(1)
            else:
                # Try to find JSON object directly
                json_match = re.search(r'(\{.*\})', content, re.DOTALL)
                if json_match:
                    content = json_match.group(1)
            
            try:
                result_json = json.loads(content)
                return result_json
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON from Anthropic: {e}")
                logger.error(f"Response: {content[:500]}")
                return {}
        
        return {}
    
    except Exception as e:
        logger.error(f"Error calling LLM API: {e}")
        return {}


class GRDALLExtractor:
    def __init__(self, processed_dir, output_dir):
        """
        Initialize the LLM extractor.
        
        Args:
            processed_dir: Directory containing processed JSON files
            output_dir: Directory to save enriched JSON files
        """
        self.processed_dir = Path(processed_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.stats = {
            "total_documents": 0,
            "processed": 0,
            "failed": 0,
            "api_calls": 0
        }
        
        # Setup LLM
        setup_extraction_model()
    
    def find_processed_documents(self):
        """Find all processed JSON documents."""
        documents = []
        
        for json_file in self.processed_dir.rglob("*.json"):
            # Skip summary files
            if json_file.name in ["processing_summary.json", "pdf_manifest.json", "website_structure.json"]:
                continue
            
            documents.append(json_file)
        
        return documents
    
    def enrich_document(self, doc_path):
        """Enrich a processed document with LLM-extracted structured data."""
        try:
            # Load processed document
            with open(doc_path, 'r', encoding='utf-8') as f:
                doc_data = json.load(f)
            
            doc_id = doc_data.get("document_id", "unknown")
            # Support both old format (document_type) and new format (vertical)
            doc_type = doc_data.get("vertical") or doc_data.get("document_type", "other")
            
            # Support both old format (content.raw_text) and new format (chunks)
            chunks = doc_data.get("chunks", [])
            if chunks:
                # For power_assets, prioritize chunks with power-related keywords
                if doc_type == "power_assets":
                    import re
                    power_keywords = r'(?i)(generating|capacity|MW|megawatt|hydro|gas|coal|power plant|generation|thermal|wind|solar)'
                    power_chunks = [c for c in chunks if re.search(power_keywords, c.get("text", ""))]
                    # Use power-related chunks first, then fill with others if needed
                    if power_chunks:
                        prioritized_chunks = power_chunks + [c for c in chunks if c not in power_chunks]
                        # Take up to MAX_TEXT_LENGTH, prioritizing power chunks
                        text_parts = []
                        char_count = 0
                        for chunk in prioritized_chunks:
                            chunk_text = chunk.get("text", "")
                            if char_count + len(chunk_text) <= MAX_TEXT_LENGTH:
                                text_parts.append(chunk_text)
                                char_count += len(chunk_text)
                            else:
                                # Add partial chunk if we have room
                                remaining = MAX_TEXT_LENGTH - char_count
                                if remaining > 100:  # Only if meaningful amount left
                                    text_parts.append(chunk_text[:remaining])
                                break
                        text = " ".join(text_parts)
                    else:
                        # Fallback: combine all chunks
                        text = " ".join([chunk.get("text", "") for chunk in chunks])
                else:
                    # Combine all chunks into text for LLM extraction
                    text = " ".join([chunk.get("text", "") for chunk in chunks])
            else:
                # Fallback to old format
                text = doc_data.get("content", {}).get("raw_text", "")
            
            if not text:
                logger.warning(f"No text found in {doc_id}")
                return None
            
            logger.info(f"Enriching {doc_id} (type: {doc_type})")
            logger.debug(f"Text length for extraction: {len(text):,} characters")
            
            # Extract structured data with LLM
            extracted_data = extract_with_llm(text, doc_type, doc_id)
            
            # Add extracted data to document
            if "entities" not in doc_data:
                doc_data["entities"] = {}
            
            doc_data["entities"] = extracted_data
            doc_data["llm_extraction_date"] = datetime.now().isoformat()
            doc_data["llm_extraction_status"] = "success" if extracted_data else "failed"
            
            # Save enriched document
            vertical = doc_data.get("vertical") or doc_data.get("document_type", "other")
            vertical_output_dir = self.output_dir / vertical
            vertical_output_dir.mkdir(parents=True, exist_ok=True)
            
            output_path = vertical_output_dir / f"{doc_id}_enriched.json"
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(doc_data, f, indent=2, ensure_ascii=False)
            
            self.stats["processed"] += 1
            logger.info(f"✓ Enriched {doc_id} -> {output_path}")
            
            return doc_data
        
        except Exception as e:
            logger.error(f"Error enriching {doc_path}: {e}")
            self.stats["failed"] += 1
            return None
    
    def process_all_documents(self):
        """Process all documents in the processed directory."""
        documents = self.find_processed_documents()
        self.stats["total_documents"] = len(documents)
        
        logger.info(f"Starting LLM extraction for {len(documents)} documents")
        
        for i, doc_path in enumerate(documents, 1):
            logger.info(f"Processing document {i}/{len(documents)}")
            self.enrich_document(doc_path)
        
        self.stats["api_calls"] = API_CALL_COUNT
        
        logger.info(f"\nExtraction complete!")
        logger.info(f"  Processed: {self.stats['processed']}")
        logger.info(f"  Failed: {self.stats['failed']}")
        logger.info(f"  API calls: {self.stats['api_calls']}")
        
        # Save summary
        summary = {
            "extraction_date": datetime.now().isoformat(),
            "stats": self.stats
        }
        
        summary_path = self.output_dir / "extraction_summary.json"
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        return self.stats


def main():
    """Main execution function."""
    global MAX_API_CALLS_PER_RUN
    
    if not HAVE_LLM:
        logger.error("No LLM libraries available. Install openai or anthropic.")
        return
    
    import argparse
    parser = argparse.ArgumentParser(description="Extract structured data from GRDA PDFs using LLM")
    parser.add_argument("--processed-dir", default="data/grda/processed",
                       help="Directory containing processed JSON files")
    parser.add_argument("--output-dir", default="data/grda/processed",
                       help="Output directory for enriched JSON files (can be same as processed-dir)")
    parser.add_argument("--max-calls", type=int, default=MAX_API_CALLS_PER_RUN,
                       help="Maximum API calls to make")
    
    args = parser.parse_args()
    
    MAX_API_CALLS_PER_RUN = args.max_calls
    
    if not Path(args.processed_dir).exists():
        logger.error(f"Processed directory not found: {args.processed_dir}")
        logger.error("Run grda_pdf_processor.py first to process PDFs.")
        return
    
    extractor = GRDALLExtractor(args.processed_dir, args.output_dir)
    stats = extractor.process_all_documents()
    
    print(f"\n✓ LLM extraction complete!")
    print(f"  Processed: {stats['processed']} documents")
    print(f"  Failed: {stats['failed']}")
    print(f"  API calls: {stats['api_calls']}")


if __name__ == "__main__":
    main()

