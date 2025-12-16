#!/usr/bin/env python3
"""
GRDA System Test Script

This script tests the complete GRDA data extraction and Q&A pipeline
with sample queries to validate the system works correctly.

Usage:
    python test_grda_system.py [--vertical VERTICAL]
"""

import os
import sys
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scripts.grda.grda_qa_system import GRDAQASystem

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def test_queries():
    """Test queries for different verticals."""
    return {
        "permits": [
            "What are the requirements for obtaining a lake permit?",
            "How much does a permit cost?",
            "What is the process for applying for a permit?",
            "Where can I find permit application forms?",
        ],
        "financial_reports": [
            "What was GRDA's revenue last year?",
            "What are GRDA's main expenses?",
            "What is GRDA's financial status?",
        ],
        "shoreline_management": [
            "What are the shoreline construction regulations?",
            "What activities are prohibited on the shoreline?",
            "What is the setback requirement for shoreline construction?",
        ],
        "general": [
            "What is GRDA?",
            "What services does GRDA provide?",
            "How can I contact GRDA?",
        ]
    }


def run_tests(vertical=None, processed_dir="data/grda/processed"):
    """Run test queries against the Q&A system."""
    processed_path = Path(processed_dir)
    
    if not processed_path.exists():
        logger.error(f"Processed directory not found: {processed_path}")
        logger.error("Run the full pipeline first:")
        logger.error("  1. python scripts/grda/grda_website_mapper.py")
        logger.error("  2. python scripts/grda/grda_pdf_downloader.py")
        logger.error("  3. python scripts/grda/grda_pdf_processor.py")
        logger.error("  4. python scripts/grda/grda_llm_extraction.py")
        return False
    
    # Initialize Q&A system
    logger.info("Initializing Q&A system...")
    qa_system = GRDAQASystem(processed_dir)
    
    # Create/load vector store
    logger.info("Loading vector store...")
    qa_system.create_vector_store()
    
    if qa_system.vector_store is None:
        logger.error("Failed to create vector store")
        return False
    
    # Get test queries
    all_queries = test_queries()
    
    # Filter by vertical if specified
    if vertical:
        if vertical in all_queries:
            queries_to_test = {vertical: all_queries[vertical]}
        else:
            logger.warning(f"Vertical '{vertical}' not found. Testing all queries.")
            queries_to_test = all_queries
    else:
        queries_to_test = all_queries
    
    # Run tests
    print("\n" + "="*70)
    print("GRDA Q&A System Test")
    print("="*70)
    
    total_queries = 0
    successful = 0
    
    for vert, queries in queries_to_test.items():
        print(f"\n{'='*70}")
        print(f"Testing {vert.upper()} queries")
        print(f"{'='*70}\n")
        
        for i, query in enumerate(queries, 1):
            total_queries += 1
            print(f"Query {i}: {query}")
            print("-" * 70)
            
            try:
                result = qa_system.query(query, k=5, vertical=vert if vert != "general" else None)
                
                if "error" in result:
                    print(f"❌ Error: {result['error']}")
                else:
                    print(f"✓ Answer: {result.get('answer', 'No answer')[:200]}...")
                    print(f"  Sources: {result.get('num_sources', 0)} documents")
                    successful += 1
                
                print()
            
            except Exception as e:
                print(f"❌ Exception: {e}\n")
    
    # Summary
    print("="*70)
    print("Test Summary")
    print("="*70)
    print(f"Total queries: {total_queries}")
    print(f"Successful: {successful}")
    print(f"Failed: {total_queries - successful}")
    print(f"Success rate: {successful/total_queries*100:.1f}%")
    print("="*70)
    
    return successful > 0


def main():
    """Main execution function."""
    import argparse
    parser = argparse.ArgumentParser(description="Test GRDA Q&A system")
    parser.add_argument("--vertical", type=str, default=None,
                       help="Test specific vertical (permits, financial_reports, etc.)")
    parser.add_argument("--processed-dir", default="data/grda/processed",
                       help="Directory containing processed JSON files")
    
    args = parser.parse_args()
    
    success = run_tests(args.vertical, args.processed_dir)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

