#!/usr/bin/env python3
"""
Simple script to answer the capacity question using processed GRDA documents.

Question: "How much generating capacity does GRDA control today, broken down by 
resource type (hydro, gas, coal, purchased power), and what planned additions or 
retirements are noted?"
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Any

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def load_enriched_documents(processed_dir: Path) -> List[Dict]:
    """Load all enriched documents that might contain power asset information."""
    documents = []
    
    # Look for enriched files
    for json_file in processed_dir.rglob("*_enriched.json"):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                doc = json.load(f)
            
            # Check if it has power asset entities or is power_assets vertical
            vertical = doc.get("vertical") or doc.get("document_type", "")
            entities = doc.get("entities", {})
            
            # Include if it's power_assets or has power-related entities
            if vertical == "power_assets" or "generating_units" in entities or "capacity_mix" in entities:
                documents.append(doc)
        except Exception as e:
            logger.warning(f"Error loading {json_file}: {e}")
    
    return documents


def aggregate_power_data(documents: List[Dict]) -> Dict:
    """Aggregate power capacity data from all documents."""
    aggregated = {
        "generating_units": [],
        "capacity_mix": {
            "Hydro_MW": 0,
            "Gas_MW": 0,
            "Coal_MW": 0,
            "Purchase_Contracts_MW": 0,
            "Other_MW": 0
        },
        "owned_vs_purchased": {"owned_pct": None, "purchased_pct": None},
        "planned_additions": [],
        "planned_retirements": [],
        "sources": []
    }
    
    seen_units = set()
    
    for doc in documents:
        entities = doc.get("entities", {})
        doc_id = doc.get("document_id", "unknown")
        source_url = doc.get("source_url", "")
        
        # Collect generating units (deduplicate by name)
        units = entities.get("generating_units", [])
        for unit in units:
            unit_name = unit.get("name", "")
            if unit_name and unit_name not in seen_units:
                aggregated["generating_units"].append(unit)
                seen_units.add(unit_name)
        
        # Aggregate capacity mix
        capacity_mix = entities.get("capacity_mix", {})
        for fuel_type, mw in capacity_mix.items():
            if isinstance(mw, (int, float)):
                if "Hydro" in fuel_type:
                    aggregated["capacity_mix"]["Hydro_MW"] += mw
                elif "Gas" in fuel_type:
                    aggregated["capacity_mix"]["Gas_MW"] += mw
                elif "Coal" in fuel_type:
                    aggregated["capacity_mix"]["Coal_MW"] += mw
                elif "Purchase" in fuel_type:
                    aggregated["capacity_mix"]["Purchase_Contracts_MW"] += mw
                else:
                    aggregated["capacity_mix"]["Other_MW"] += mw
        
        # Collect planned additions
        additions = entities.get("planned_additions", [])
        aggregated["planned_additions"].extend(additions)
        
        # Collect planned retirements
        retirements = entities.get("planned_retirements", [])
        aggregated["planned_retirements"].extend(retirements)
        
        # Track sources
        if entities:
            aggregated["sources"].append({
                "document_id": doc_id,
                "source_url": source_url,
                "has_data": True
            })
    
    # Calculate owned vs purchased if available
    owned_vs_purchased = {}
    for doc in documents:
        ovp = doc.get("entities", {}).get("owned_vs_purchased", {})
        if ovp:
            owned_vs_purchased = ovp
            break
    aggregated["owned_vs_purchased"] = owned_vs_purchased
    
    return aggregated


def format_answer(data: Dict) -> str:
    """Format the aggregated data as a readable answer."""
    answer_parts = []
    
    answer_parts.append("=" * 80)
    answer_parts.append("GRDA GENERATING CAPACITY SUMMARY")
    answer_parts.append("=" * 80)
    answer_parts.append("")
    
    # Current capacity by resource type
    answer_parts.append("CURRENT CAPACITY BY RESOURCE TYPE:")
    answer_parts.append("-" * 80)
    capacity_mix = data["capacity_mix"]
    total_mw = sum(capacity_mix.values())
    
    if total_mw > 0:
        for fuel_type, mw in capacity_mix.items():
            if mw > 0:
                pct = (mw / total_mw * 100) if total_mw > 0 else 0
                answer_parts.append(f"  {fuel_type.replace('_MW', '')}: {mw:,.0f} MW ({pct:.1f}%)")
        answer_parts.append(f"\n  TOTAL: {total_mw:,.0f} MW")
    else:
        answer_parts.append("  No capacity data found in processed documents.")
    
    answer_parts.append("")
    
    # Generating units
    if data["generating_units"]:
        answer_parts.append("GENERATING UNITS:")
        answer_parts.append("-" * 80)
        for unit in data["generating_units"]:
            name = unit.get("name", "Unknown")
            unit_type = unit.get("type", "Unknown")
            mw = unit.get("net_MW", "N/A")
            commissioned = unit.get("commissioned", "N/A")
            fuel = unit.get("fuel", unit_type)
            answer_parts.append(f"  • {name}: {mw} MW ({fuel}) - Commissioned: {commissioned}")
        answer_parts.append("")
    
    # Owned vs purchased
    ovp = data["owned_vs_purchased"]
    if ovp.get("owned_pct") is not None:
        answer_parts.append("OWNERSHIP:")
        answer_parts.append("-" * 80)
        answer_parts.append(f"  Owned: {ovp.get('owned_pct', 0)}%")
        answer_parts.append(f"  Purchased: {ovp.get('purchased_pct', 0)}%")
        answer_parts.append("")
    
    # Planned additions
    if data["planned_additions"]:
        answer_parts.append("PLANNED ADDITIONS:")
        answer_parts.append("-" * 80)
        for addition in data["planned_additions"]:
            name = addition.get("name", "Unknown")
            mw = addition.get("MW", "N/A")
            in_service = addition.get("in_service", "TBD")
            status = addition.get("status", "planned")
            answer_parts.append(f"  • {name}: {mw} MW - In Service: {in_service} ({status})")
        answer_parts.append("")
    else:
        answer_parts.append("PLANNED ADDITIONS: None found in documents.")
        answer_parts.append("")
    
    # Planned retirements
    if data["planned_retirements"]:
        answer_parts.append("PLANNED RETIREMENTS:")
        answer_parts.append("-" * 80)
        for retirement in data["planned_retirements"]:
            name = retirement.get("name", "Unknown")
            mw = retirement.get("MW", "N/A")
            date = retirement.get("retirement_date", "TBD")
            status = retirement.get("status", "announced")
            answer_parts.append(f"  • {name}: {mw} MW - Retirement: {date} ({status})")
        answer_parts.append("")
    else:
        answer_parts.append("PLANNED RETIREMENTS: None found in documents.")
        answer_parts.append("")
    
    # Sources
    if data["sources"]:
        answer_parts.append("SOURCES:")
        answer_parts.append("-" * 80)
        for source in data["sources"]:
            answer_parts.append(f"  • {source['document_id']}")
            if source.get("source_url"):
                answer_parts.append(f"    {source['source_url']}")
        answer_parts.append("")
    
    answer_parts.append("=" * 80)
    
    return "\n".join(answer_parts)


def main():
    """Main execution."""
    import argparse
    parser = argparse.ArgumentParser(description="Answer GRDA capacity question")
    parser.add_argument("--processed-dir", default="data/grda/processed",
                       help="Directory containing processed/enriched JSON files")
    
    args = parser.parse_args()
    processed_dir = Path(args.processed_dir)
    
    if not processed_dir.exists():
        logger.error(f"Processed directory not found: {processed_dir}")
        logger.error("Run grda_pdf_processor.py and grda_llm_extraction.py first.")
        return
    
    logger.info("Loading enriched documents...")
    documents = load_enriched_documents(processed_dir)
    
    if not documents:
        logger.warning("No enriched documents found. Processing may be needed.")
        logger.info("To process documents:")
        logger.info("  1. python scripts/grda/grda_pdf_processor.py")
        logger.info("  2. python scripts/grda/grda_llm_extraction.py")
        return
    
    logger.info(f"Found {len(documents)} relevant documents")
    
    logger.info("Aggregating power capacity data...")
    aggregated_data = aggregate_power_data(documents)
    
    logger.info("Formatting answer...")
    answer = format_answer(aggregated_data)
    
    print("\n" + answer + "\n")
    
    # Also save to file
    output_file = processed_dir.parent / "capacity_answer.txt"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(answer)
    
    logger.info(f"Answer saved to {output_file}")


if __name__ == "__main__":
    main()

