#!/usr/bin/env python3
"""
AEP Ohio Flipping Behavior Analysis.

Identifies parcels with multiple interconnection requests from different developers,
proving "flipping" behavior in the interconnection request process.

This script analyzes the integrated interconnection analysis data.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any
from collections import defaultdict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "public" / "data"
OUTPUT_DIR = PROJECT_ROOT / "public" / "data"

INTERCONNECTION_ANALYSIS_FILE = DATA_DIR / "aep_ohio_interconnection_analysis.json"


def log(message: str) -> None:
    """Emit a timestamped log line."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"[{timestamp}] {message}", flush=True)


def detect_flipping_behavior(
    interconnection_requests: List[Dict],
    land_transactions: List[Dict]
) -> Dict:
    """
    Identify parcels with multiple requests from different developers.
    
    Returns:
        Dictionary with flipped parcels and statistics
    """
    # Group requests by parcel
    requests_by_parcel = defaultdict(list)
    for request in interconnection_requests:
        parcel_id = request.get("parcel_id")
        if parcel_id:
            requests_by_parcel[parcel_id].append(request)
    
    # Find parcels with multiple requests
    flipped_parcels = []
    for parcel_id, requests in requests_by_parcel.items():
        if len(requests) >= 2:
            # Check if requests are from different developers
            developers = set(
                req.get("customer_name") or req.get("developer") or "Unknown"
                for req in requests
            )
            
            if len(developers) > 1:
                # Calculate total capacity
                total_capacity = sum(
                    req.get("requested_capacity_mw", 0) for req in requests
                )
                
                # Get request dates
                request_dates = [
                    req.get("request_date") for req in requests
                    if req.get("request_date")
                ]
                request_dates.sort()
                
                flipped_parcels.append({
                    "parcel_id": parcel_id,
                    "requests": requests,
                    "developers": list(developers),
                    "request_count": len(requests),
                    "developer_count": len(developers),
                    "total_capacity_mw": total_capacity,
                    "first_request_date": request_dates[0] if request_dates else None,
                    "last_request_date": request_dates[-1] if request_dates else None,
                    "request_span_days": None
                })
                
                # Calculate request span
                if len(request_dates) >= 2:
                    try:
                        from datetime import datetime as dt
                        first = dt.fromisoformat(request_dates[0].replace('Z', '+00:00'))
                        last = dt.fromisoformat(request_dates[-1].replace('Z', '+00:00'))
                        flipped_parcels[-1]["request_span_days"] = (last - first).days
                    except (ValueError, AttributeError):
                        pass
    
    # Calculate statistics
    total_requests_on_flipped = sum(len(p["requests"]) for p in flipped_parcels)
    all_developers = set()
    for p in flipped_parcels:
        all_developers.update(p["developers"])
    
    stats = {
        "total_flipped_parcels": len(flipped_parcels),
        "total_requests_on_flipped": total_requests_on_flipped,
        "unique_developers": len(all_developers),
        "average_requests_per_parcel": (
            total_requests_on_flipped / len(flipped_parcels)
            if flipped_parcels else 0
        ),
        "average_developers_per_parcel": (
            sum(p["developer_count"] for p in flipped_parcels) / len(flipped_parcels)
            if flipped_parcels else 0
        ),
        "total_capacity_on_flipped_mw": sum(
            p["total_capacity_mw"] for p in flipped_parcels
        )
    }
    
    # Build timeline
    all_request_dates = []
    for request in interconnection_requests:
        date = request.get("request_date")
        if date:
            all_request_dates.append(date)
    
    all_request_dates.sort()
    
    # Count requests per month
    request_frequency = defaultdict(int)
    for date_str in all_request_dates:
        try:
            # Extract year-month
            if 'T' in date_str:
                year_month = date_str[:7]  # YYYY-MM
            else:
                year_month = date_str[:7]
            request_frequency[year_month] += 1
        except (IndexError, AttributeError):
            pass
    
    timeline = {
        "first_request_date": all_request_dates[0] if all_request_dates else None,
        "last_request_date": all_request_dates[-1] if all_request_dates else None,
        "request_frequency": dict(request_frequency),
        "total_requests": len(all_request_dates)
    }
    
    return {
        "flipped_parcels": flipped_parcels,
        "flipping_statistics": stats,
        "timeline": timeline
    }


def enrich_with_land_transactions(
    flipped_parcels: List[Dict],
    land_transactions: List[Dict]
) -> List[Dict]:
    """Enrich flipped parcels with land transaction data."""
    # Build transaction lookup
    transactions_by_parcel = {}
    for transaction in land_transactions:
        parcel_id = transaction.get("parcel_id")
        if parcel_id:
            if parcel_id not in transactions_by_parcel:
                transactions_by_parcel[parcel_id] = []
            transactions_by_parcel[parcel_id].append(transaction)
    
    # Enrich flipped parcels
    enriched = []
    for parcel in flipped_parcels:
        parcel_id = parcel["parcel_id"]
        if parcel_id in transactions_by_parcel:
            parcel["land_transactions"] = transactions_by_parcel[parcel_id]
            parcel["transaction_count"] = len(transactions_by_parcel[parcel_id])
            
            # Get most recent transaction
            transactions = transactions_by_parcel[parcel_id]
            transactions_with_dates = [
                t for t in transactions if t.get("sale_date")
            ]
            if transactions_with_dates:
                transactions_with_dates.sort(key=lambda x: x.get("sale_date", ""), reverse=True)
                parcel["most_recent_transaction"] = transactions_with_dates[0]
        else:
            parcel["land_transactions"] = []
            parcel["transaction_count"] = 0
        
        enriched.append(parcel)
    
    return enriched


def main() -> None:
    """Main execution function."""
    log("🚀 Starting AEP Ohio flipping behavior analysis")
    
    # Load interconnection analysis data
    if not INTERCONNECTION_ANALYSIS_FILE.exists():
        log(f"❌ Error: Interconnection analysis file not found: {INTERCONNECTION_ANALYSIS_FILE}")
        log("💡 Run aep_ohio_interconnection_analysis.py first")
        return
    
    log(f"📂 Loading interconnection analysis from {INTERCONNECTION_ANALYSIS_FILE}")
    with INTERCONNECTION_ANALYSIS_FILE.open("r", encoding="utf-8") as f:
        analysis_data = json.load(f)
    
    interconnection_requests = analysis_data.get("interconnection_requests", [])
    land_transactions = analysis_data.get("land_transactions", [])
    
    log(f"✅ Loaded {len(interconnection_requests)} interconnection requests")
    log(f"✅ Loaded {len(land_transactions)} land transactions")
    
    if not interconnection_requests:
        log("❌ No interconnection requests found. Cannot perform flipping analysis.")
        return
    
    # Detect flipping behavior
    log("\n🔍 Detecting flipping behavior...")
    flipping_analysis = detect_flipping_behavior(
        interconnection_requests,
        land_transactions
    )
    
    # Enrich with land transactions
    log("🔍 Enriching with land transaction data...")
    enriched_flipped = enrich_with_land_transactions(
        flipping_analysis["flipped_parcels"],
        land_transactions
    )
    flipping_analysis["flipped_parcels"] = enriched_flipped
    
    # Create output
    output_data = {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_interconnection_requests": len(interconnection_requests),
            "total_land_transactions": len(land_transactions)
        },
        **flipping_analysis
    }
    
    # Write output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUT_DIR / "aep_ohio_flipping_analysis.json"
    with output_file.open("w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
    
    log(f"\n💾 Saved flipping analysis to {output_file.relative_to(PROJECT_ROOT)}")
    log("\n📊 Flipping Analysis Summary:")
    stats = flipping_analysis["flipping_statistics"]
    log(f"   Flipped Parcels: {stats['total_flipped_parcels']}")
    log(f"   Total Requests on Flipped: {stats['total_requests_on_flipped']}")
    log(f"   Unique Developers: {stats['unique_developers']}")
    log(f"   Average Requests per Parcel: {stats['average_requests_per_parcel']:.2f}")
    log(f"   Average Developers per Parcel: {stats['average_developers_per_parcel']:.2f}")
    log(f"   Total Capacity on Flipped: {stats['total_capacity_on_flipped_mw']:.1f} MW")
    
    timeline = flipping_analysis["timeline"]
    if timeline.get("first_request_date") and timeline.get("last_request_date"):
        log(f"\n   Timeline:")
        log(f"   - First Request: {timeline['first_request_date']}")
        log(f"   - Last Request: {timeline['last_request_date']}")
        log(f"   - Total Requests: {timeline['total_requests']}")
    
    log("\n🎉 Flipping analysis complete!")


if __name__ == "__main__":
    main()


