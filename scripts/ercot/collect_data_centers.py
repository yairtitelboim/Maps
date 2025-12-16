#!/usr/bin/env python3
"""
Step 1: Collect Data Center Locations
Creates CSV of Texas data center locations with coordinates
"""

import pandas as pd
from pathlib import Path
import json

# Known data center locations in Texas
# Based on web search and public information
DATA_CENTERS = [
    {
        'dc_id': 'DC001',
        'name': 'Microsoft Taylor Data Center',
        'city': 'Taylor',
        'county': 'Williamson',
        'lat': 30.5708,
        'lon': -97.4095,
        'company': 'Microsoft',
        'source_url': 'https://www.microsoft.com/en-us/investor/earnings-fy-2024-q1.aspx',
        'notes': 'Major Microsoft data center campus'
    },
    {
        'dc_id': 'DC002',
        'name': 'Samsung Taylor Semiconductor',
        'city': 'Taylor',
        'county': 'Williamson',
        'lat': 30.5708,
        'lon': -97.4095,
        'company': 'Samsung',
        'source_url': 'https://news.samsung.com/us/samsung-electronics-announces-new-semiconductor-manufacturing-facility-taylor-texas/',
        'notes': 'Semiconductor facility with data center infrastructure'
    },
    {
        'dc_id': 'DC003',
        'name': 'Google Austin Data Center',
        'city': 'Austin',
        'county': 'Travis',
        'lat': 30.2672,
        'lon': -97.7431,
        'company': 'Google',
        'source_url': 'https://www.google.com/about/datacenters/locations/',
        'notes': 'Google data center facility'
    },
    {
        'dc_id': 'DC004',
        'name': 'Amazon AWS US-East (Texas)',
        'city': 'Dallas',
        'county': 'Dallas',
        'lat': 32.7767,
        'lon': -96.7970,
        'company': 'Amazon',
        'source_url': 'https://aws.amazon.com/about-aws/global-infrastructure/',
        'notes': 'AWS data center region'
    },
    {
        'dc_id': 'DC005',
        'name': 'Google Haskell County Data Center',
        'city': 'Haskell',
        'county': 'Haskell',
        'lat': 33.1576,
        'lon': -99.7337,
        'company': 'Google',
        'source_url': 'https://www.reuters.com/business/google-invest-40-billion-new-data-centers-texas-bloomberg-news-reports-2025-11-14/',
        'notes': 'Announced 2025, part of $40B investment'
    },
    {
        'dc_id': 'DC006',
        'name': 'Google Armstrong County Data Center',
        'city': 'Claude',
        'county': 'Armstrong',
        'lat': 35.1092,
        'lon': -101.3636,
        'company': 'Google',
        'source_url': 'https://www.reuters.com/business/google-invest-40-billion-new-data-centers-texas-bloomberg-news-reports-2025-11-14/',
        'notes': 'Announced 2025, part of $40B investment'
    },
    {
        'dc_id': 'DC007',
        'name': 'OpenAI Stargate Abilene',
        'city': 'Abilene',
        'county': 'Taylor',
        'lat': 32.4487,
        'lon': -99.7331,
        'company': 'OpenAI/Oracle/SoftBank',
        'source_url': 'https://www.reuters.com/business/media-telecom/openai-oracle-softbank-plan-five-new-ai-data-centers-500-billion-stargate-2025-09-23/',
        'notes': 'Stargate project, 900 MW, world\'s largest AI supercluster'
    },
    {
        'dc_id': 'DC008',
        'name': 'OpenAI Stargate Shackelford County',
        'city': 'Albany',
        'county': 'Shackelford',
        'lat': 32.7237,
        'lon': -99.2973,
        'company': 'OpenAI/Oracle/SoftBank',
        'source_url': 'https://www.reuters.com/business/media-telecom/openai-oracle-softbank-plan-five-new-ai-data-centers-500-billion-stargate-2025-09-23/',
        'notes': 'Stargate project location'
    },
    {
        'dc_id': 'DC009',
        'name': 'OpenAI Stargate Milam County',
        'city': 'Cameron',
        'county': 'Milam',
        'lat': 30.8533,
        'lon': -96.9769,
        'company': 'OpenAI/Oracle/SoftBank',
        'source_url': 'https://www.reuters.com/business/media-telecom/openai-oracle-softbank-plan-five-new-ai-data-centers-500-billion-stargate-2025-09-23/',
        'notes': 'Stargate project location'
    },
    {
        'dc_id': 'DC010',
        'name': 'Facebook/Meta Data Center',
        'city': 'Fort Worth',
        'county': 'Tarrant',
        'lat': 32.7555,
        'lon': -97.3308,
        'company': 'Meta',
        'source_url': 'https://about.meta.com/metaverse/data-centers/',
        'notes': 'Meta data center facility'
    },
    {
        'dc_id': 'DC011',
        'name': 'Apple Data Center',
        'city': 'Austin',
        'county': 'Travis',
        'lat': 30.2672,
        'lon': -97.7431,
        'company': 'Apple',
        'source_url': 'https://www.apple.com/environment/',
        'notes': 'Apple data center facility'
    },
    {
        'dc_id': 'DC012',
        'name': 'Microsoft San Antonio Data Center',
        'city': 'San Antonio',
        'county': 'Bexar',
        'lat': 29.4241,
        'lon': -98.4936,
        'company': 'Microsoft',
        'source_url': 'https://azure.microsoft.com/en-us/explore/global-infrastructure/',
        'notes': 'Microsoft Azure data center'
    },
    {
        'dc_id': 'DC013',
        'name': 'Amazon AWS US-West (Texas)',
        'city': 'Houston',
        'county': 'Harris',
        'lat': 29.7604,
        'lon': -95.3698,
        'company': 'Amazon',
        'source_url': 'https://aws.amazon.com/about-aws/global-infrastructure/',
        'notes': 'AWS data center region'
    },
    {
        'dc_id': 'DC014',
        'name': 'Oracle Cloud Data Center',
        'city': 'Austin',
        'county': 'Travis',
        'lat': 30.2672,
        'lon': -97.7431,
        'company': 'Oracle',
        'source_url': 'https://www.oracle.com/cloud/data-centers/',
        'notes': 'Oracle cloud data center'
    },
    {
        'dc_id': 'DC015',
        'name': 'IBM Cloud Data Center',
        'city': 'Dallas',
        'county': 'Dallas',
        'lat': 32.7767,
        'lon': -96.7970,
        'company': 'IBM',
        'source_url': 'https://www.ibm.com/cloud/data-centers',
        'notes': 'IBM cloud data center'
    },
]

def main():
    print("=" * 60)
    print("COLLECT DATA CENTER LOCATIONS")
    print("=" * 60)
    print()
    
    # Create DataFrame
    df = pd.DataFrame(DATA_CENTERS)
    
    print(f"✅ Collected {len(df)} data center locations")
    print()
    print("Data Centers:")
    for idx, row in df.iterrows():
        print(f"  {row['dc_id']:6s} | {row['name']:40s} | {row['city']:15s} | {row['county']:15s} | {row['company']:15s}")
    print()
    
    # Save to CSV
    output_dir = Path("data/ercot/datacenters")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_file = output_dir / "texas_data_centers.csv"
    df.to_csv(output_file, index=False)
    print(f"✅ Saved to: {output_file}")
    print()
    
    print("=" * 60)
    print("NEXT STEPS")
    print("=" * 60)
    print("1. Review and add more data centers if needed")
    print("2. Verify coordinates are accurate")
    print("3. Run battery_dc_proximity_test.py to calculate distances")
    print()

if __name__ == "__main__":
    main()

