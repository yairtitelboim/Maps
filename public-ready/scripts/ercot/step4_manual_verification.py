#!/usr/bin/env python3
"""
ERCOT Queue Deep Dive - Step 4: Manual Verification
Verifies sample entries against ERCOT website
"""

import json
from pathlib import Path
from datetime import datetime

def load_sample_entries(file_path="data/ercot/processed/ercot_2023_100mw_samples.json"):
    """Load sample entries for verification."""
    with open(file_path, 'r') as f:
        return json.load(f)

def create_verification_template(samples):
    """Create verification template for manual checking."""
    
    print("=" * 60)
    print("ERCOT Queue Deep Dive - Step 4: Manual Verification")
    print("=" * 60)
    print()
    print("VERIFICATION TEMPLATE")
    print("=" * 60)
    print()
    print("For each sample entry, verify the following on ERCOT website:")
    print()
    
    for idx, entry in enumerate(samples, 1):
        print(f"Sample Entry #{idx}:")
        print(f"  Queue ID: {entry.get('q_id', 'N/A')}")
        print(f"  Status: {entry.get('q_status', 'N/A')}")
        print(f"  Capacity: {entry.get('capacity_mw', 'N/A')} MW")
        print(f"  Location: {entry.get('county', 'N/A')}, {entry.get('state', 'N/A')}")
        print(f"  Generation Type: {entry.get('generation_type', 'N/A')}")
        print(f"  Developer: {entry.get('developer', 'N/A')}")
        print()
        print("  Verification Checklist:")
        print("  [ ] Can you find this queue ID on ERCOT website? (Y/N)")
        print("  [ ] Does the status match? (Y/N)")
        print("  [ ] Does the capacity match? (Y/N)")
        print("  [ ] Does the location match? (Y/N)")
        print("  [ ] Does the generation type match? (Y/N)")
        print("  [ ] Does the developer match? (Y/N)")
        print("  [ ] Source URL: [___]")
        print("  [ ] Notes: [___]")
        print()
        print("-" * 60)
        print()
    
    return samples

def create_verification_report(samples, verification_results):
    """Create verification report."""
    
    report = {
        'verification_date': datetime.now().isoformat(),
        'samples_verified': len(samples),
        'verification_results': verification_results,
        'overall_confidence': 'pending'
    }
    
    # Calculate confidence
    if len(verification_results) == len(samples):
        verified_count = sum(1 for r in verification_results if r.get('verified', False))
        if verified_count == len(samples):
            report['overall_confidence'] = 'high'
        elif verified_count >= len(samples) * 0.67:
            report['overall_confidence'] = 'medium'
        else:
            report['overall_confidence'] = 'low'
    
    return report

if __name__ == "__main__":
    samples = load_sample_entries()
    create_verification_template(samples)
    
    print("\n" + "=" * 60)
    print("NEXT STEPS")
    print("=" * 60)
    print()
    print("1. Navigate to ERCOT website")
    print("2. Search for each queue ID")
    print("3. Verify data matches")
    print("4. Take screenshots for documentation")
    print("5. Fill out verification checklist")
    print()
    print("ERCOT Resources:")
    print("  - Interconnection Services: https://www.ercot.com/services/rq/integration")
    print("  - Queue Search: (Check ERCOT website for queue search tool)")
    print()

