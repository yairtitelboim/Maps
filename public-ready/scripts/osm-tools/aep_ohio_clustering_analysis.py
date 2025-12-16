#!/usr/bin/env python3
"""
Substation Clustering Analysis for AEP Ohio Interconnection Requests.

Analyzes substation locations and creates clusters for interconnection request
analysis. Generates 5-mile radius buffers around substations for proximity analysis.

Output:
  - Clustered substations with 5-mile buffers
  - Clustering statistics
  - Analysis zones (1-mile, 5-mile, 10-mile)
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Set

import numpy as np
from scipy.spatial.distance import cdist


PROJECT_ROOT = Path(__file__).resolve().parents[2]
INPUT_DIR = PROJECT_ROOT / "public" / "osm"
OUTPUT_DIR = PROJECT_ROOT / "public" / "osm"

# Clustering Configuration
CLUSTER_RADIUS_M = 8047  # 5 miles in meters
MIN_SUBSTATIONS_PER_CLUSTER = 1  # Minimum substations to form a cluster

# Analysis zones around each substation
ANALYSIS_ZONES = {
    "immediate": 1609,      # 1 mile
    "proximity": 8047,     # 5 miles (primary analysis zone)
    "extended": 16093,     # 10 miles
}


def log(message: str) -> None:
    """Emit a timestamped log line."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"[{timestamp}] {message}", flush=True)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate great circle distance between two points in meters.
    
    Args:
        lat1, lon1: First point coordinates
        lat2, lon2: Second point coordinates
    
    Returns:
        Distance in meters
    """
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


def cluster_substations(
    substations: List[Dict],
    radius_m: float = CLUSTER_RADIUS_M
) -> List[Dict]:
    """
    Cluster substations within specified radius using distance-based clustering.
    
    Args:
        substations: List of substation feature dictionaries
        radius_m: Cluster radius in meters
    
    Returns:
        List of clusters with center, substations, and metadata
    """
    if not substations:
        return []
    
    # Extract coordinates
    coords = []
    substation_data = []
    
    for substation in substations:
        geometry = substation.get("geometry", {})
        if geometry.get("type") == "Point":
            coords_array = geometry.get("coordinates", [])
            if len(coords_array) >= 2:
                lon, lat = coords_array[0], coords_array[1]
                coords.append([lat, lon])
                substation_data.append({
                    "substation": substation,
                    "lat": lat,
                    "lon": lon
                })
    
    if not coords:
        log("⚠️ No valid substation coordinates found")
        return []
    
    coords_array = np.array(coords)
    
    # Calculate distance matrix using haversine
    # Using a simpler approach: for each substation, find all within radius
    clusters = []
    assigned = set()
    
    for i, sub_data in enumerate(substation_data):
        if i in assigned:
            continue
        
        # Start new cluster with this substation
        cluster = {
            "cluster_id": f"cluster_{len(clusters)}",
            "center": {"lat": sub_data["lat"], "lon": sub_data["lon"]},
            "substations": [sub_data["substation"]["properties"].get("osm_id")],
            "substation_details": [sub_data["substation"]],
            "radius_m": radius_m,
            "substation_count": 1
        }
        
        # Find all substations within radius
        for j, other_data in enumerate(substation_data):
            if i != j and j not in assigned:
                distance = haversine_distance(
                    sub_data["lat"], sub_data["lon"],
                    other_data["lat"], other_data["lon"]
                )
                if distance <= radius_m:
                    cluster["substations"].append(other_data["substation"]["properties"].get("osm_id"))
                    cluster["substation_details"].append(other_data["substation"])
                    cluster["substation_count"] += 1
                    assigned.add(j)
        
        clusters.append(cluster)
        assigned.add(i)
    
    return clusters


def create_analysis_zones(substation: Dict, zones: Dict[str, int]) -> Dict:
    """
    Create analysis zones (buffers) around a substation.
    
    Args:
        substation: Substation feature dictionary
        zones: Dictionary of zone names to radius in meters
    
    Returns:
        Dictionary of zone features
    """
    geometry = substation.get("geometry", {})
    if geometry.get("type") != "Point":
        return {}
    
    coords = geometry.get("coordinates", [])
    if len(coords) < 2:
        return {}
    
    lon, lat = coords[0], coords[1]
    osm_id = substation.get("properties", {}).get("osm_id", "unknown")
    
    zone_features = {}
    
    for zone_name, radius_m in zones.items():
        # Create a simple circle approximation (32 points)
        circle_coords = []
        for i in range(32):
            angle = (i / 32) * 2 * math.pi
            # Approximate lat/lon offset for radius
            lat_offset = (radius_m / 111320) * math.cos(angle)
            lon_offset = (radius_m / (111320 * math.cos(math.radians(lat)))) * math.sin(angle)
            circle_coords.append([lon + lon_offset, lat + lat_offset])
        # Close the circle
        circle_coords.append(circle_coords[0])
        
        zone_features[zone_name] = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [circle_coords]
            },
            "properties": {
                "substation_osm_id": osm_id,
                "zone_name": zone_name,
                "radius_m": radius_m,
                "radius_miles": radius_m / 1609.34
            }
        }
    
    return zone_features


def generate_cluster_buffers(clusters: List[Dict]) -> List[Dict]:
    """
    Generate 5-mile buffer polygons for each cluster.
    
    Args:
        clusters: List of cluster dictionaries
    
    Returns:
        List of buffer feature dictionaries
    """
    buffers = []
    
    for cluster in clusters:
        center = cluster["center"]
        radius_m = cluster["radius_m"]
        
        # Create circle polygon
        circle_coords = []
        for i in range(64):  # More points for smoother circle
            angle = (i / 64) * 2 * math.pi
            lat_offset = (radius_m / 111320) * math.cos(angle)
            lon_offset = (radius_m / (111320 * math.cos(math.radians(center["lat"])))) * math.sin(angle)
            circle_coords.append([center["lon"] + lon_offset, center["lat"] + lat_offset])
        circle_coords.append(circle_coords[0])  # Close circle
        
        buffer_feature = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [circle_coords]
            },
            "properties": {
                "cluster_id": cluster["cluster_id"],
                "substation_count": cluster["substation_count"],
                "radius_m": radius_m,
                "radius_miles": radius_m / 1609.34,
                "center": center
            }
        }
        
        buffers.append(buffer_feature)
    
    return buffers


def calculate_clustering_statistics(clusters: List[Dict]) -> Dict:
    """Calculate statistics about the clustering."""
    if not clusters:
        return {
            "total_clusters": 0,
            "total_substations": 0,
            "average_substations_per_cluster": 0,
            "max_substations_in_cluster": 0,
            "min_substations_in_cluster": 0
        }
    
    total_substations = sum(c["substation_count"] for c in clusters)
    
    return {
        "total_clusters": len(clusters),
        "total_substations": total_substations,
        "average_substations_per_cluster": total_substations / len(clusters),
        "max_substations_in_cluster": max(c["substation_count"] for c in clusters),
        "min_substations_in_cluster": min(c["substation_count"] for c in clusters),
        "clusters_with_multiple": len([c for c in clusters if c["substation_count"] > 1])
    }


def main() -> None:
    """Main execution function."""
    log("🚀 Starting AEP Ohio substation clustering analysis")
    
    # Load substations data
    input_file = INPUT_DIR / "aep_ohio_substations.json"
    if not input_file.exists():
        log(f"❌ Error: Input file not found: {input_file}")
        log("💡 Run aep_ohio_infrastructure_osm.py first to generate substation data")
        return
    
    log(f"📂 Loading substations from {input_file}")
    with input_file.open("r", encoding="utf-8") as f:
        substations_data = json.load(f)
    
    substations = substations_data.get("features", [])
    log(f"📊 Found {len(substations)} substations")
    
    if not substations:
        log("⚠️ No substations to cluster")
        return
    
    # Perform clustering
    log(f"\n🔍 Clustering substations (radius: {CLUSTER_RADIUS_M}m = {CLUSTER_RADIUS_M/1609.34:.1f} miles)")
    clusters = cluster_substations(substations, CLUSTER_RADIUS_M)
    log(f"✅ Created {len(clusters)} clusters")
    
    # Calculate statistics
    stats = calculate_clustering_statistics(clusters)
    log(f"📊 Clustering statistics:")
    log(f"   - Total clusters: {stats['total_clusters']}")
    log(f"   - Total substations: {stats['total_substations']}")
    log(f"   - Average per cluster: {stats['average_substations_per_cluster']:.2f}")
    log(f"   - Max in cluster: {stats['max_substations_in_cluster']}")
    log(f"   - Clusters with multiple: {stats['clusters_with_multiple']}")
    
    # Generate cluster buffers
    log("\n🗺️ Generating cluster buffers...")
    cluster_buffers = generate_cluster_buffers(clusters)
    
    # Create output structure
    output_data = {
        "type": "FeatureCollection",
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "cluster_radius_m": CLUSTER_RADIUS_M,
            "cluster_radius_miles": CLUSTER_RADIUS_M / 1609.34,
            "statistics": stats,
            "total_substations": len(substations)
        },
        "clusters": clusters,
        "features": cluster_buffers  # Buffer polygons for visualization
    }
    
    # Write output
    output_file = OUTPUT_DIR / "aep_ohio_substation_clusters.json"
    with output_file.open("w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
    
    log(f"💾 Saved cluster analysis to {output_file.relative_to(PROJECT_ROOT)}")
    log("🎉 Clustering analysis complete!")


if __name__ == "__main__":
    main()


