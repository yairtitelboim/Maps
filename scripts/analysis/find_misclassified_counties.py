#!/usr/bin/env python3
"""
Find Misclassified Counties in Producer/Consumer Layer

This script analyzes counties to identify:
1. Counties that fall into the "default" (transparent) category but should be classified
2. Counties that might be better classified differently
3. Suggests improvements to the classification logic
"""

import json
from pathlib import Path
from collections import defaultdict

# Classification rules (matching ProducerConsumerCountiesLayer.jsx)
def classify_county(dc_count, energy_gw):
    """
    Classify a county based on DC count and energy capacity.
    Returns: ('category', 'reason')
    Matches ProducerConsumerCountiesLayer.jsx logic
    """
    dc_count = dc_count or 0
    energy_gw = energy_gw or 0
    
    # Pure Producer: high energy (>1GW) AND low DC count (<= 1)
    if energy_gw > 1 and dc_count <= 1:
        return ('producer', f'High energy ({energy_gw:.2f} GW) with low DC count ({dc_count})')
    
    # Hybrid: high energy (>=1GW) AND high DC count (>= 2)
    if energy_gw >= 1 and dc_count >= 2:
        composite_score = dc_count * energy_gw
        return ('hybrid', f'High energy ({energy_gw:.2f} GW) and DCs ({dc_count}), score: {composite_score:.2f}')
    
    # Hybrid-leaning: moderate energy (0.5-1GW) with multiple DCs (>= 2)
    if 0.5 <= energy_gw < 1 and dc_count >= 2:
        composite_score = dc_count * energy_gw
        return ('hybrid-leaning', f'Moderate energy ({energy_gw:.2f} GW) with multiple DCs ({dc_count}), score: {composite_score:.2f}')
    
    # Producer-leaning: moderate energy (0.3-1GW) with low DC count (<= 1)
    if 0.3 <= energy_gw <= 1 and dc_count <= 1:
        return ('producer-leaning', f'Moderate energy ({energy_gw:.2f} GW) with low DC count ({dc_count})')
    
    # Pure Consumer: low energy (<0.5GW) AND high DC count (>0)
    if energy_gw < 0.5 and dc_count > 0:
        return ('consumer', f'Low energy ({energy_gw:.2f} GW) with DCs ({dc_count})')
    
    # Default/unclassified
    return ('unclassified', f'Energy: {energy_gw:.2f} GW, DCs: {dc_count} - falls outside all categories')

def get_color_for_category(category, dc_count, energy_gw):
    """Get expected color for a category"""
    if category == 'producer':
        if energy_gw <= 1:
            return '#228B22'  # forest green
        elif energy_gw <= 2:
            return '#32CD32'  # lime green
        elif energy_gw <= 3:
            return '#50C878'  # emerald green
        elif energy_gw <= 5:
            return '#00FF7F'  # spring green
        elif energy_gw <= 7:
            return '#00FF00'  # bright green
        else:
            return '#00AA00'  # dark green
    elif category == 'consumer':
        if dc_count <= 1:
            return '#FFB6C1'  # light pink
        elif dc_count <= 2:
            return '#FF6B6B'  # light red
        elif dc_count <= 3:
            return '#FF4444'  # medium red
        elif dc_count <= 5:
            return '#DC143C'  # crimson
        elif dc_count <= 8:
            return '#B22222'  # fire brick
        elif dc_count <= 10:
            return '#8B0000'  # dark red
        else:
            return '#5C0000'  # very dark red
    elif category == 'hybrid':
        composite_score = dc_count * energy_gw
        if composite_score <= 2:
            return '#BA55D3'  # medium orchid
        elif composite_score <= 4:
            return '#9370DB'  # medium purple
        elif composite_score <= 6:
            return '#8B008B'  # dark magenta
        elif composite_score <= 10:
            return '#6A0DAD'  # indigo
        else:
            return '#4B0082'  # deep indigo
    elif category == 'hybrid-leaning':
        composite_score = dc_count * energy_gw
        if composite_score <= 1:
            return '#DDA0DD'  # plum
        elif composite_score <= 2:
            return '#BA55D3'  # medium orchid
        else:
            return '#9370DB'  # medium purple
    elif category == 'producer-leaning':
        if energy_gw <= 0.5:
            return '#90EE90'  # light green
        elif energy_gw <= 0.75:
            return '#7CFC00'  # lawn green
        else:
            return '#228B22'  # forest green
    else:
        return 'transparent'  # unclassified

def main():
    # Load GeoJSON data
    geojson_path = Path('public/data/ercot/ercot_counties_with_dc.geojson')
    
    if not geojson_path.exists():
        print(f"❌ Error: GeoJSON file not found at {geojson_path}")
        return
    
    with geojson_path.open() as f:
        data = json.load(f)
    
    counties = []
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        county_name = props.get('NAME', '').strip()
        dc_count = props.get('dc_count', 0) or 0
        total_capacity_mw = props.get('total_capacity_mw', 0) or 0
        energy_gw = total_capacity_mw / 1000
        
        if county_name:
            category, reason = classify_county(dc_count, energy_gw)
            color = get_color_for_category(category, dc_count, energy_gw)
            
            counties.append({
                'name': county_name,
                'dc_count': dc_count,
                'energy_gw': energy_gw,
                'total_capacity_mw': total_capacity_mw,
                'category': category,
                'reason': reason,
                'color': color
            })
    
    # Sort by energy GW (descending) for producers, by DC count (descending) for consumers
    counties.sort(key=lambda x: (
        x['category'] == 'unclassified',  # Unclassified last
        -x['energy_gw'] if x['category'] in ['producer', 'hybrid', 'producer-leaning'] else 0,
        -x['dc_count'] if x['category'] == 'consumer' else 0
    ))
    
    # Group by category
    by_category = defaultdict(list)
    for county in counties:
        by_category[county['category']].append(county)
    
    print("=" * 100)
    print("PRODUCER/CONSUMER COUNTY CLASSIFICATION ANALYSIS")
    print("=" * 100)
    print()
    
    # Summary
    print("SUMMARY:")
    print("-" * 100)
    for category in ['producer', 'producer-leaning', 'hybrid', 'hybrid-leaning', 'consumer', 'unclassified']:
        count = len(by_category[category])
        if count > 0:
            print(f"  {category.upper():20s}: {count:3d} counties")
    print()
    
    # Unclassified counties (these are the problem cases)
    unclassified = by_category['unclassified']
    if unclassified:
        print("=" * 100)
        print(f"⚠️  UNCLASSIFIED COUNTIES ({len(unclassified)} counties)")
        print("=" * 100)
        print("These counties fall into the 'default' category and appear transparent on the map.")
        print("They may need classification rule adjustments.\n")
        
        # Sort unclassified by energy and DC count to see patterns
        unclassified_sorted = sorted(unclassified, key=lambda x: (-x['energy_gw'], -x['dc_count']))
        
        print(f"{'County':<20} {'Energy (GW)':<15} {'DC Count':<12} {'Suggestion':<50}")
        print("-" * 100)
        
        for county in unclassified_sorted[:20]:  # Show top 20
            suggestion = ""
            if county['energy_gw'] > 0.3 and county['dc_count'] == 0:
                suggestion = "→ Should be Producer (has energy, no DCs)"
            elif county['energy_gw'] > 0.5 and county['dc_count'] == 1:
                suggestion = "→ Should be Producer (high energy, 1 DC)"
            elif county['energy_gw'] < 0.5 and county['dc_count'] > 0:
                suggestion = "→ Should be Consumer (low energy, has DCs)"
            elif county['energy_gw'] > 0.3 and county['dc_count'] > 1:
                suggestion = "→ Should be Hybrid (has both energy and DCs)"
            else:
                suggestion = "→ Low activity, may be correctly unclassified"
            
            print(f"{county['name']:<20} {county['energy_gw']:>12.2f}     {county['dc_count']:>8}     {suggestion}")
        
        if len(unclassified_sorted) > 20:
            print(f"\n... and {len(unclassified_sorted) - 20} more unclassified counties")
        print()
    
    # Producer counties
    producers = by_category['producer']
    if producers:
        print("=" * 100)
        print(f"🟢 PRODUCER COUNTIES ({len(producers)} counties)")
        print("=" * 100)
        print("High energy capacity (>1 GW) with low DC count (<= 1)\n")
        
        # Show top 10 producers
        top_producers = sorted(producers, key=lambda x: -x['energy_gw'])[:10]
        print(f"{'County':<20} {'Energy (GW)':<15} {'DC Count':<12} {'Color':<20}")
        print("-" * 100)
        for county in top_producers:
            print(f"{county['name']:<20} {county['energy_gw']:>12.2f}     {county['dc_count']:>8}     {county['color']:<20}")
        print()
    
    # Consumer counties
    consumers = by_category['consumer']
    if consumers:
        print("=" * 100)
        print(f"🔴 CONSUMER COUNTIES ({len(consumers)} counties)")
        print("=" * 100)
        print("Low energy capacity (<0.5 GW) with data centers\n")
        
        # Show top 10 consumers
        top_consumers = sorted(consumers, key=lambda x: -x['dc_count'])[:10]
        print(f"{'County':<20} {'Energy (GW)':<15} {'DC Count':<12} {'Color':<20}")
        print("-" * 100)
        for county in top_consumers:
            print(f"{county['name']:<20} {county['energy_gw']:>12.2f}     {county['dc_count']:>8}     {county['color']:<20}")
        print()
    
    # Hybrid counties
    hybrids = by_category['hybrid']
    if hybrids:
        print("=" * 100)
        print(f"🟣 HYBRID COUNTIES ({len(hybrids)} counties)")
        print("=" * 100)
        print("High energy capacity (>=1 GW) with multiple data centers (>= 2)\n")
        
        # Show top 10 hybrids
        top_hybrids = sorted(hybrids, key=lambda x: -(x['dc_count'] * x['energy_gw']))[:10]
        print(f"{'County':<20} {'Energy (GW)':<15} {'DC Count':<12} {'Score':<12} {'Color':<20}")
        print("-" * 100)
        for county in top_hybrids:
            score = county['dc_count'] * county['energy_gw']
            print(f"{county['name']:<20} {county['energy_gw']:>12.2f}     {county['dc_count']:>8}     {score:>10.2f}  {county['color']:<20}")
        print()
    
    # Hybrid-leaning counties
    hybrid_leaning = by_category['hybrid-leaning']
    if hybrid_leaning:
        print("=" * 100)
        print(f"🟣 HYBRID-LEANING COUNTIES ({len(hybrid_leaning)} counties)")
        print("=" * 100)
        print("Moderate energy capacity (0.5-1 GW) with multiple data centers (>= 2)\n")
        
        # Show top 10 hybrid-leaning
        top_hybrid_leaning = sorted(hybrid_leaning, key=lambda x: -(x['dc_count'] * x['energy_gw']))[:10]
        print(f"{'County':<20} {'Energy (GW)':<15} {'DC Count':<12} {'Score':<12} {'Color':<20}")
        print("-" * 100)
        for county in top_hybrid_leaning:
            score = county['dc_count'] * county['energy_gw']
            print(f"{county['name']:<20} {county['energy_gw']:>12.2f}     {county['dc_count']:>8}     {score:>10.2f}  {county['color']:<20}")
        print()
    
    # Edge cases that might need attention
    print("=" * 100)
    print("🔍 EDGE CASES TO REVIEW")
    print("=" * 100)
    print()
    
    edge_cases = []
    
    # Counties with significant energy but just outside producer threshold
    for county in counties:
        if county['category'] == 'unclassified':
            if 0.3 <= county['energy_gw'] <= 1.0 and county['dc_count'] <= 1:
                edge_cases.append({
                    'county': county,
                    'issue': f"Has {county['energy_gw']:.2f} GW energy but doesn't meet producer threshold (>1 GW)"
                })
            elif county['energy_gw'] > 1.0 and county['dc_count'] == 2:
                edge_cases.append({
                    'county': county,
                    'issue': f"Has {county['energy_gw']:.2f} GW energy and {county['dc_count']} DCs - just misses hybrid threshold"
                })
    
    if edge_cases:
        print(f"Found {len(edge_cases)} edge cases:\n")
        for case in edge_cases[:10]:
            c = case['county']
            print(f"  • {c['name']}: {case['issue']}")
            print(f"    Current: {c['category']} | Energy: {c['energy_gw']:.2f} GW | DCs: {c['dc_count']}")
        print()
    else:
        print("No significant edge cases found.\n")
    
    # Recommendations
    print("=" * 100)
    print("💡 RECOMMENDATIONS")
    print("=" * 100)
    print()
    
    if len(unclassified) > 10:
        print(f"1. ⚠️  {len(unclassified)} counties are unclassified. Consider:")
        print("   - Lowering producer threshold from 1 GW to 0.5 GW for counties with <= 1 DC")
        print("   - Adding a 'low-producer' category for 0.3-0.5 GW with 0 DCs")
        print()
    
    # Check if Pecos is now classified
    pecos = next((c for c in counties if c['name'] == 'Pecos'), None)
    if pecos:
        print(f"2. ✅ Pecos County is now classified as: {pecos['category']}")
        print(f"   Energy: {pecos['energy_gw']:.2f} GW | DCs: {pecos['dc_count']} | Color: {pecos['color']}")
        print()
    
    # Color gradient suggestions
    print("3. 🎨 Color Gradient Improvements:")
    print("   - Current: Discrete color stops")
    print("   - Suggested: More gradient stops for smoother transitions")
    print("   - Consider: Using HSL color space for better perceptual uniformity")
    print()
    
    # Save detailed report
    report_path = Path('data/analysis/producer_consumer_classification_report.json')
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    report = {
        'summary': {
            'total_counties': len(counties),
            'by_category': {cat: len(by_category[cat]) for cat in by_category}
        },
        'unclassified': unclassified,
        'top_producers': sorted(producers, key=lambda x: -x['energy_gw'])[:20] if producers else [],
        'top_consumers': sorted(consumers, key=lambda x: -x['dc_count'])[:20] if consumers else [],
        'top_hybrids': sorted(hybrids, key=lambda x: -(x['dc_count'] * x['energy_gw']))[:20] if hybrids else [],
        'edge_cases': edge_cases[:20]
    }
    
    with report_path.open('w') as f:
        json.dump(report, f, indent=2)
    
    print(f"4. 📊 Detailed report saved to: {report_path}")
    print()

if __name__ == '__main__':
    main()

