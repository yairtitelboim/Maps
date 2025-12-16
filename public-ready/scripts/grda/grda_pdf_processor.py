#!/usr/bin/env python3
"""
GRDA PDF Processor

This script processes downloaded PDFs, extracts text content, tables, figures,
and prepares them for LLM-based structured extraction. Matches the plan's
site-selection focused schema.

Requirements:
pip install pdfplumber pytesseract pillow camelot-py[cv] tabula-py
"""

import os
import json
import logging
import csv
from pathlib import Path
from datetime import datetime
from collections import defaultdict

try:
    import pdfplumber
    HAVE_PDFPLUMBER = True
except ImportError:
    HAVE_PDFPLUMBER = False
    print("Warning: pdfplumber not installed. Install with: pip install pdfplumber")

try:
    import pytesseract
    from PIL import Image
    HAVE_OCR = True
except ImportError:
    HAVE_OCR = False
    print("Warning: OCR libraries not installed. Install with: pip install pytesseract pillow")

try:
    import camelot
    HAVE_CAMELOT = True
except ImportError:
    HAVE_CAMELOT = False
    print("Warning: camelot-py not installed. Install with: pip install 'camelot-py[cv]'")

try:
    import tabula
    HAVE_TABULA = True
except ImportError:
    HAVE_TABULA = False
    print("Warning: tabula-py not installed. Install with: pip install tabula-py")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class GRDAPDFProcessor:
    def __init__(self, manifest_path, output_dir):
        """
        Initialize the PDF processor.
        
        Args:
            manifest_path: Path to pdf_manifest.json from downloader
            output_dir: Base directory for processed JSON output
        """
        self.manifest_path = Path(manifest_path)
        self.output_dir = Path(output_dir)
        self.processed_dir = self.output_dir / "processed"
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        
        # Load manifest
        with open(self.manifest_path, 'r', encoding='utf-8') as f:
            self.manifest = json.load(f)
        
        self.processing_stats = {
            "total_pdfs": 0,
            "processed": 0,
            "failed": 0,
            "total_pages": 0,
            "total_characters": 0,
            "total_chunks": 0,
            "total_tables": 0,
            "total_figures": 0
        }
        
        # Chunk counter for unique chunk IDs
        self.chunk_counter = 0
        self.table_counter = 0
        self.figure_counter = 0
    
    def extract_tables_from_page(self, pdf_path, page_num):
        """Extract tables from a specific page using camelot or tabula."""
        tables = []
        
        # Try camelot first (better for lattice tables)
        if HAVE_CAMELOT:
            try:
                camelot_tables = camelot.read_pdf(str(pdf_path), pages=str(page_num), flavor='lattice')
                if len(camelot_tables) == 0:
                    # Try stream mode
                    camelot_tables = camelot.read_pdf(str(pdf_path), pages=str(page_num), flavor='stream')
                
                for i, table in enumerate(camelot_tables):
                    table_id = f"t{self.table_counter:03d}"
                    self.table_counter += 1
                    
                    # Save table as CSV
                    table_dir = self.output_dir / "tables"
                    table_dir.mkdir(parents=True, exist_ok=True)
                    csv_path = table_dir / f"{table_id}.csv"
                    table.to_csv(str(csv_path), index=False)
                    
                    tables.append({
                        "table_id": table_id,
                        "page": page_num,
                        "csv_path": str(csv_path.relative_to(self.output_dir)),
                        "shape": table.shape,
                        "accuracy": float(table.accuracy) if hasattr(table, 'accuracy') else None
                    })
            except Exception as e:
                logger.debug(f"Camelot extraction failed for page {page_num}: {e}")
        
        # Fallback to tabula
        if len(tables) == 0 and HAVE_TABULA:
            try:
                tabula_tables = tabula.read_pdf(str(pdf_path), pages=page_num, multiple_tables=True)
                for i, df in enumerate(tabula_tables):
                    if df is not None and not df.empty:
                        table_id = f"t{self.table_counter:03d}"
                        self.table_counter += 1
                        
                        table_dir = self.output_dir / "tables"
                        table_dir.mkdir(parents=True, exist_ok=True)
                        csv_path = table_dir / f"{table_id}.csv"
                        df.to_csv(str(csv_path), index=False)
                        
                        tables.append({
                            "table_id": table_id,
                            "page": page_num,
                            "csv_path": str(csv_path.relative_to(self.output_dir)),
                            "shape": list(df.shape),
                            "accuracy": None
                        })
            except Exception as e:
                logger.debug(f"Tabula extraction failed for page {page_num}: {e}")
        
        return tables
    
    def extract_figures_from_page(self, pdf_path, page_num, page):
        """Extract figures/images from a page and detect captions."""
        figures = []
        
        try:
            # Get images from page
            images = page.images
            if images:
                for img_idx, img in enumerate(images):
                    figure_id = f"f{self.figure_counter:03d}"
                    self.figure_counter += 1
                    
                    # Try to find caption (text near the image)
                    caption = ""
                    # Look for text below or above the image
                    img_bbox = (img.get('x0', 0), img.get('top', 0), 
                               img.get('x1', page.width), img.get('bottom', page.height))
                    
                    # Extract nearby text as potential caption
                    nearby_text = page.within_bbox(img_bbox).extract_text()
                    if nearby_text:
                        # Take first few lines as caption
                        lines = nearby_text.split('\n')[:3]
                        caption = ' '.join(lines).strip()[:200]  # Limit caption length
                    
                    figures.append({
                        "figure_id": figure_id,
                        "page": page_num,
                        "caption": caption or None,
                        "bbox": {
                            "x0": img.get('x0'),
                            "y0": img.get('top'),
                            "x1": img.get('x1'),
                            "y1": img.get('bottom')
                        }
                    })
        except Exception as e:
            logger.debug(f"Figure extraction failed for page {page_num}: {e}")
        
        return figures
    
    def chunk_text(self, text, page_num, chunk_size=1000, overlap=200):
        """Split text into chunks with page references."""
        chunks = []
        words = text.split()
        current_chunk = []
        current_length = 0
        
        for word in words:
            current_chunk.append(word)
            current_length += len(word) + 1  # +1 for space
            
            if current_length >= chunk_size:
                chunk_text = ' '.join(current_chunk)
                chunk_id = f"c{self.chunk_counter:03d}"
                self.chunk_counter += 1
                
                chunks.append({
                    "chunk_id": chunk_id,
                    "page": page_num,
                    "text": chunk_text
                })
                
                # Overlap: keep last N words for next chunk
                overlap_words = current_chunk[-overlap//10:] if len(current_chunk) > overlap//10 else []
                current_chunk = overlap_words
                current_length = sum(len(w) + 1 for w in current_chunk)
        
        # Add remaining text as final chunk
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            chunk_id = f"c{self.chunk_counter:03d}"
            self.chunk_counter += 1
            
            chunks.append({
                "chunk_id": chunk_id,
                "page": page_num,
                "text": chunk_text
            })
        
        return chunks
    
    def extract_text_from_pdf(self, pdf_path):
        """Extract text, tables, and figures from a PDF document."""
        all_chunks = []
        all_tables = []
        all_figures = []
        document_metadata = {
            "filename": os.path.basename(pdf_path),
            "path": str(pdf_path),
            "total_pages": 0
        }
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                document_metadata["total_pages"] = len(pdf.pages)
                
                for i, page in enumerate(pdf.pages, 1):
                    # Extract text from the page
                    page_text = page.extract_text() or ""
                    
                    # If text extraction fails, try OCR
                    if not page_text.strip() and HAVE_OCR:
                        logger.info(f"Using OCR for page {i} of {pdf_path}")
                        try:
                            img = page.to_image(resolution=300)
                            img_pil = img.original
                            page_text = pytesseract.image_to_string(img_pil)
                        except Exception as ocr_error:
                            logger.warning(f"OCR failed for page {i}: {ocr_error}")
                            page_text = ""
                    
                    # Chunk the text by page
                    if page_text.strip():
                        page_chunks = self.chunk_text(page_text, i)
                        all_chunks.extend(page_chunks)
                    
                    # Extract tables
                    page_tables = self.extract_tables_from_page(pdf_path, i)
                    all_tables.extend(page_tables)
                    
                    # Extract figures
                    page_figures = self.extract_figures_from_page(pdf_path, i, page)
                    all_figures.extend(page_figures)
            
            logger.info(f"Extracted {len(all_chunks)} chunks, {len(all_tables)} tables, {len(all_figures)} figures from {pdf_path}")
            return all_chunks, all_tables, all_figures, document_metadata
            
        except Exception as e:
            logger.error(f"Error extracting from {pdf_path}: {e}")
            return [], [], [], document_metadata
    
    def process_pdf(self, pdf_info):
        """Process a single PDF and create structured JSON output."""
        if pdf_info["status"] != "success":
            logger.warning(f"Skipping {pdf_info['filename']} (status: {pdf_info['status']})")
            return None
        
        pdf_path = Path(pdf_info["filepath"])
        if not pdf_path.exists():
            logger.error(f"PDF file not found: {pdf_path}")
            return None
        
        vertical = pdf_info.get("vertical", "other")
        vertical_processed_dir = self.processed_dir / vertical
        vertical_processed_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Processing {pdf_info['filename']} (vertical: {vertical})")
        
        # Reset counters for this document
        self.chunk_counter = 0
        self.table_counter = 0
        self.figure_counter = 0
        
        # Extract text, tables, and figures
        chunks, tables, figures, metadata = self.extract_text_from_pdf(pdf_path)
        
        if not chunks and not tables:
            logger.warning(f"No content extracted from {pdf_info['filename']}")
            return None
        
        # Create document ID from filename
        doc_id = os.path.splitext(pdf_info['filename'])[0]
        doc_id = "".join(c for c in doc_id if c.isalnum() or c in "._-")
        
        # Combine all text for summary/section identification
        all_text = " ".join([chunk["text"] for chunk in chunks])
        
        # Create structured document data matching plan's schema
        document_data = {
            "document_id": doc_id,
            "source_url": pdf_info["url"],
            "vertical": vertical,
            "extraction_date": datetime.now().isoformat(),
            "metadata": {
                "title": pdf_info.get("link_text", ""),
                "date": pdf_info.get("download_date", ""),  # Will be enhanced with actual doc date if found
                "pages": metadata["total_pages"],
                "publisher": "GRDA",
                "filename": pdf_info["filename"]
            },
            "chunks": chunks,
            "tables": tables,
            "figures": figures,
            "entities": {}  # Will be populated by LLM extraction
        }
        
        # Update stats
        self.processing_stats["total_chunks"] += len(chunks)
        self.processing_stats["total_tables"] += len(tables)
        self.processing_stats["total_figures"] += len(figures)
        
        # Save processed document
        output_path = vertical_processed_dir / f"{doc_id}.json"
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(document_data, f, indent=2, ensure_ascii=False)
        
        # Update stats
        self.processing_stats["processed"] += 1
        self.processing_stats["total_pages"] += metadata["total_pages"]
        self.processing_stats["total_characters"] += len(all_text)
        
        logger.info(f"✓ Processed {pdf_info['filename']} -> {output_path}")
        return document_data
    
    
    def process_all_pdfs(self):
        """Process all PDFs from the manifest."""
        pdfs = self.manifest.get("pdfs", [])
        self.processing_stats["total_pdfs"] = len(pdfs)
        
        logger.info(f"Starting processing of {len(pdfs)} PDFs")
        
        processed_documents = []
        
        for i, pdf_info in enumerate(pdfs, 1):
            logger.info(f"Processing PDF {i}/{len(pdfs)}")
            
            try:
                doc_data = self.process_pdf(pdf_info)
                if doc_data:
                    processed_documents.append(doc_data)
            except Exception as e:
                logger.error(f"Error processing {pdf_info.get('filename', 'unknown')}: {e}")
                self.processing_stats["failed"] += 1
        
        logger.info(f"\nProcessing complete!")
        logger.info(f"  Processed: {self.processing_stats['processed']}")
        logger.info(f"  Failed: {self.processing_stats['failed']}")
        logger.info(f"  Total pages: {self.processing_stats['total_pages']}")
        logger.info(f"  Total chunks: {self.processing_stats['total_chunks']}")
        logger.info(f"  Total tables: {self.processing_stats['total_tables']}")
        logger.info(f"  Total figures: {self.processing_stats['total_figures']}")
        logger.info(f"  Total characters: {self.processing_stats['total_characters']:,}")
        
        # Save processing summary
        summary = {
            "processing_date": datetime.now().isoformat(),
            "stats": self.processing_stats,
            "processed_documents": len(processed_documents)
        }
        
        summary_path = self.output_dir / "processing_summary.json"
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        return processed_documents


def main():
    """Main execution function."""
    if not HAVE_PDFPLUMBER:
        logger.error("Required library not installed. Install with: pip install pdfplumber")
        return
    
    import argparse
    parser = argparse.ArgumentParser(description="Process GRDA PDFs and extract text")
    parser.add_argument("--manifest", default="data/grda/pdf_manifest.json",
                       help="Path to pdf_manifest.json")
    parser.add_argument("--output-dir", default="data/grda",
                       help="Output directory for processed JSON files")
    
    args = parser.parse_args()
    
    if not Path(args.manifest).exists():
        logger.error(f"Manifest file not found: {args.manifest}")
        logger.error("Run grda_pdf_downloader.py first to download PDFs.")
        return
    
    processor = GRDAPDFProcessor(args.manifest, args.output_dir)
    processor.process_all_pdfs()
    
    print(f"\n✓ Processing complete!")
    print(f"  Processed: {processor.processing_stats['processed']} PDFs")
    print(f"  Total pages: {processor.processing_stats['total_pages']}")
    print(f"  Total chunks: {processor.processing_stats['total_chunks']}")
    print(f"  Total tables: {processor.processing_stats['total_tables']}")
    print(f"  Total figures: {processor.processing_stats['total_figures']}")
    print(f"  Total characters: {processor.processing_stats['total_characters']:,}")


if __name__ == "__main__":
    main()

