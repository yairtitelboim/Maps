#!/usr/bin/env python3
"""
AEP Ohio Interconnection Request Data Integration.

Integrates OSM substation data with external data sources:
  - Interconnection requests (90 sites, 30 GW)
  - Land transactions (2023-2024)
  - Enriches data with substation proximity

This script expects external data files in a specific format.
See the data schema documentation for required fields.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[2]
INPUT_DIR = PROJECT_ROOT / "public" / "osm"
DATA_DIR = PROJECT_ROOT / "public" / "data"
OUTPUT_DIR = PROJECT_ROOT / "public" / "data"

# Expected input file paths (user should provide these)
INTERCONNECTION_REQUESTS_FILE = DATA_DIR / "interconnection_requests.json"  # External data
LAND_TRANSACTIONS_FILE = DATA_DIR / "land_transactions.json"  # External data


def log(message: str) -> None:
    """Emit a timestamped log line."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"[{timestamp}] {message}", flush=True)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great circle distance between two points in meters."""
    R = 6371000  # Earth radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = (
        math.sin(delta_phi / 2) ** 2 +
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def find_nearest_substation(
    lat: float,
    lon: float,
    substations: List[Dict]
) -> Optional[Dict]:
    """
    Find nearest substation to given coordinates.
    
    Returns:
        Dictionary with substation data and distance, or None
    """
    if not substations:
        return None
    
    min_distance = float('inf')
    nearest = None
    
    for substation in substations:
        geometry = substation.get("geometry", {})
        if geometry.get("type") != "Point":
            continue
        
        coords = geometry.get("coordinates", [])
        if len(coords) < 2:
            continue
        
        sub_lon, sub_lat = coords[0], coords[1]
        distance = haversine_distance(lat, lon, sub_lat, sub_lon)
        
        if distance < min_distance:
            min_distance = distance
            nearest = {
                "substation": substation,
                "distance_m": distance,
                "distance_miles": distance / 1609.34,
                "id": substation.get("properties", {}).get("osm_id")
            }
    
    return nearest


def find_cluster_for_substation(
    substation_id: Any,
    clusters: List[Dict]
) -> Optional[str]:
    """Find which cluster contains a given substation."""
    for cluster in clusters:
        if substation_id in cluster.get("substations", []):
            return cluster.get("cluster_id")
    return None


def enrich_interconnection_requests(
    requests: List[Dict],
    substations: List[Dict],
    clusters: List[Dict]
) -> List[Dict]:
    """
    Enrich interconnection requests with substation proximity data.
    
    Args:
        requests: List of interconnection request dictionaries
        substations: List of substation feature dictionaries
        clusters: List of cluster dictionaries
    
    Returns:
        Enriched interconnection requests
    """
    enriched = []
    
    for request in requests:
        coords = request.get("coordinates", {})
        lat = coords.get("lat")
        lon = coords.get("lon")
        
        if lat is None or lon is None:
            log(f"⚠️ Request {request.get('site_id', 'unknown')} missing coordinates")
            enriched.append(request)
            continue
        
        # Find nearest substation
        nearest = find_nearest_substation(lat, lon, substations)
        
        if nearest:
            request["nearest_substation_id"] = nearest["id"]
            request["distance_to_substation_m"] = nearest["distance_m"]
            request["distance_to_substation_miles"] = nearest["distance_miles"]
            
            # Find cluster
            cluster_id = find_cluster_for_substation(nearest["id"], clusters)
            if cluster_id:
                request["cluster_id"] = cluster_id
            
            # Check if within 5 miles (proximity zone)
            request["within_5_miles"] = nearest["distance_m"] <= 8047
        else:
            request["nearest_substation_id"] = None
            request["distance_to_substation_m"] = None
            request["distance_to_substation_miles"] = None
            request["cluster_id"] = None
            request["within_5_miles"] = False
        
        enriched.append(request)
    
    return enriched


def enrich_land_transactions(
    transactions: List[Dict],
    substations: List[Dict],
    interconnection_requests: List[Dict]
) -> List[Dict]:
    """
    Enrich land transactions with substation proximity and interconnection requests.
    
    Args:
        transactions: List of land transaction dictionaries
        substations: List of substation feature dictionaries
        interconnection_requests: List of interconnection request dictionaries
    
    Returns:
        Enriched land transactions
    """
    enriched = []
    
    # Build parcel to requests lookup
    parcel_requests = {}
    for request in interconnection_requests:
        parcel_id = request.get("parcel_id")
        if parcel_id:
            if parcel_id not in parcel_requests:
                parcel_requests[parcel_id] = []
            parcel_requests[parcel_id].append(request.get("site_id"))
    
    for transaction in transactions:
        coords = transaction.get("coordinates", {})
        lat = coords.get("lat")
        lon = coords.get("lon")
        
        if lat is None or lon is None:
            log(f"⚠️ Transaction {transaction.get('parcel_id', 'unknown')} missing coordinates")
            enriched.append(transaction)
            continue
        
        # Find nearest substation
        nearest = find_nearest_substation(lat, lon, substations)
        
        if nearest:
            transaction["nearest_substation_id"] = nearest["id"]
            transaction["distance_to_substation_m"] = nearest["distance_m"]
            transaction["distance_to_substation_miles"] = nearest["distance_miles"]
            transaction["within_5_miles"] = nearest["distance_m"] <= 8047
        else:
            transaction["nearest_substation_id"] = None
            transaction["distance_to_substation_m"] = None
            transaction["distance_to_substation_miles"] = None
            transaction["within_5_miles"] = False
        
        # Link to interconnection requests
        parcel_id = transaction.get("parcel_id")
        if parcel_id and parcel_id in parcel_requests:
            transaction["interconnection_requests"] = parcel_requests[parcel_id]
            transaction["request_count"] = len(parcel_requests[parcel_id])
        else:
            transaction["interconnection_requests"] = []
            transaction["request_count"] = 0
        
        enriched.append(transaction)
    
    return enriched


def calculate_analysis_metrics(
    interconnection_requests: List[Dict],
    land_transactions: List[Dict],
    clusters: List[Dict]
) -> Dict:
    """Calculate analysis metrics for the integrated dataset."""
    total_requests = len(interconnection_requests)
    total_capacity = sum(
        req.get("requested_capacity_mw", 0) for req in interconnection_requests
    )
    
    survived = [r for r in interconnection_requests if r.get("survived_tariff", False)]
    survived_capacity = sum(
        req.get("requested_capacity_mw", 0) for req in survived
    )
    
    withdrawn = [r for r in interconnection_requests if not r.get("survived_tariff", True)]
    withdrawn_capacity = sum(
        req.get("requested_capacity_mw", 0) for req in withdrawn
    )
    
    within_5_miles = [r for r in interconnection_requests if r.get("within_5_miles", False)]
    
    # Land transaction analysis
    transactions_2023_2024 = [
        t for t in land_transactions
        if t.get("sale_date", "").startswith(("2023", "2024"))
    ]
    
    transactions_near_substations = [
        t for t in transactions_2023_2024
        if t.get("within_5_miles", False) and t.get("zoning") == "industrial"
    ]
    
    # Clusters with requests
    clusters_with_requests = set()
    for request in interconnection_requests:
        cluster_id = request.get("cluster_id")
        if cluster_id:
            clusters_with_requests.add(cluster_id)
    
    # Parcels with multiple requests
    parcels_with_multiple = [
        t for t in land_transactions
        if t.get("request_count", 0) >= 2
    ]
    
    return {
        "interconnection_requests": {
            "total_requests": total_requests,
            "total_capacity_mw": total_capacity,
            "survived_count": len(survived),
            "survived_capacity_mw": survived_capacity,
            "withdrawn_count": len(withdrawn),
            "withdrawn_capacity_mw": withdrawn_capacity,
            "within_5_miles_count": len(within_5_miles),
            "within_5_miles_percentage": (len(within_5_miles) / total_requests * 100) if total_requests > 0 else 0
        },
        "land_transactions": {
            "total_2023_2024": len(transactions_2023_2024),
            "near_substations_industrial": len(transactions_near_substations),
            "parcels_with_multiple_requests": len(parcels_with_multiple)
        },
        "clustering": {
            "total_clusters": len(clusters),
            "clusters_with_requests": len(clusters_with_requests),
            "clusters_with_requests_percentage": (len(clusters_with_requests) / len(clusters) * 100) if clusters else 0
        }
    }


def load_external_data() -> tuple[List[Dict], List[Dict]]:
    """
    Load external data files (interconnection requests and land transactions).
    
    Returns:
        Tuple of (interconnection_requests, land_transactions)
    """
    interconnection_requests = []
    land_transactions = []
    
    # Load interconnection requests
    if INTERCONNECTION_REQUESTS_FILE.exists():
        log(f"📂 Loading interconnection requests from {INTERCONNECTION_REQUESTS_FILE}")
        with INTERCONNECTION_REQUESTS_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                interconnection_requests = data
            elif isinstance(data, dict) and "requests" in data:
                interconnection_requests = data["requests"]
        log(f"✅ Loaded {len(interconnection_requests)} interconnection requests")
    else:
        log(f"⚠️ Interconnection requests file not found: {INTERCONNECTION_REQUESTS_FILE}")
        log("💡 Create this file with interconnection request data (see schema in docs)")
    
    # Load land transactions
    if LAND_TRANSACTIONS_FILE.exists():
        log(f"📂 Loading land transactions from {LAND_TRANSACTIONS_FILE}")
        with LAND_TRANSACTIONS_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                land_transactions = data
            elif isinstance(data, dict) and "transactions" in data:
                land_transactions = data["transactions"]
        log(f"✅ Loaded {len(land_transactions)} land transactions")
    else:
        log(f"⚠️ Land transactions file not found: {LAND_TRANSACTIONS_FILE}")
        log("💡 Create this file with land transaction data (see schema in docs)")
    
    return interconnection_requests, land_transactions


def main() -> None:
    """Main execution function."""
    log("🚀 Starting AEP Ohio interconnection request data integration")
    
    # Load OSM data
    substations_file = INPUT_DIR / "aep_ohio_substations.json"
    clusters_file = INPUT_DIR / "aep_ohio_substation_clusters.json"
    
    if not substations_file.exists():
        log(f"❌ Error: Substations file not found: {substations_file}")
        log("💡 Run aep_ohio_infrastructure_osm.py first")
        return
    
    log(f"📂 Loading substations from {substations_file}")
    with substations_file.open("r", encoding="utf-8") as f:
        substations_data = json.load(f)
    substations = substations_data.get("features", [])
    log(f"✅ Loaded {len(substations)} substations")
    
    clusters = []
    if clusters_file.exists():
        log(f"📂 Loading clusters from {clusters_file}")
        with clusters_file.open("r", encoding="utf-8") as f:
            clusters_data = json.load(f)
        clusters = clusters_data.get("clusters", [])
        log(f"✅ Loaded {len(clusters)} clusters")
    else:
        log("⚠️ Clusters file not found - run aep_ohio_clustering_analysis.py first")
    
    # Load external data
    interconnection_requests, land_transactions = load_external_data()
    
    if not interconnection_requests and not land_transactions:
        log("❌ No external data files found. Cannot proceed with integration.")
        log("💡 Please create the required data files (see documentation)")
        return
    
    # Enrich data
    log("\n🔍 Enriching interconnection requests with substation proximity...")
    enriched_requests = enrich_interconnection_requests(
        interconnection_requests,
        substations,
        clusters
    )
    
    log("🔍 Enriching land transactions with substation proximity...")
    enriched_transactions = enrich_land_transactions(
        land_transactions,
        substations,
        enriched_requests
    )
    
    # Calculate metrics
    log("\n📊 Calculating analysis metrics...")
    metrics = calculate_analysis_metrics(
        enriched_requests,
        enriched_transactions,
        clusters
    )
    
    # Create output
    output_data = {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "substation_count": len(substations),
            "cluster_count": len(clusters),
            "interconnection_request_count": len(enriched_requests),
            "land_transaction_count": len(enriched_transactions)
        },
        "substations": substations,
        "clusters": clusters,
        "interconnection_requests": enriched_requests,
        "land_transactions": enriched_transactions,
        "analysis": metrics
    }
    
    # Write output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUT_DIR / "aep_ohio_interconnection_analysis.json"
    with output_file.open("w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
    
    log(f"\n💾 Saved integrated analysis to {output_file.relative_to(PROJECT_ROOT)}")
    log("\n📊 Analysis Summary:")
    log(f"   Interconnection Requests: {metrics['interconnection_requests']['total_requests']} ({metrics['interconnection_requests']['total_capacity_mw']:.1f} MW)")
    log(f"   - Survived: {metrics['interconnection_requests']['survived_count']} ({metrics['interconnection_requests']['survived_capacity_mw']:.1f} MW)")
    log(f"   - Withdrawn: {metrics['interconnection_requests']['withdrawn_count']} ({metrics['interconnection_requests']['withdrawn_capacity_mw']:.1f} MW)")
    log(f"   - Within 5 miles: {metrics['interconnection_requests']['within_5_miles_count']} ({metrics['interconnection_requests']['within_5_miles_percentage']:.1f}%)")
    log(f"   Land Transactions (2023-2024): {metrics['land_transactions']['total_2023_2024']}")
    log(f"   - Near substations (industrial): {metrics['land_transactions']['near_substations_industrial']}")
    log(f"   - Parcels with multiple requests: {metrics['land_transactions']['parcels_with_multiple_requests']}")
    log(f"   Clusters with requests: {metrics['clustering']['clusters_with_requests']}/{metrics['clustering']['total_clusters']}")
    log("\n🎉 Data integration complete!")


if __name__ == "__main__":
    main()


