#!/usr/bin/env python3
"""
Quick summary of audit results - shows what needs attention
"""

import json
from pathlib import Path

AUDIT_FILE = Path(__file__).parent.parent / "local_projects_audit.json"

def main():
    with open(AUDIT_FILE) as f:
        data = json.load(f)
    
    print("="*70)
    print("🔍 QUICK AUDIT SUMMARY")
    print("="*70)
    
    summary = data['summary']
    print(f"\n✅ Public Ready: {summary['public_ready_files']:,} files ({summary['public_ready_percentage']}%)")
    print(f"⚠️  Needs Cleaning: {summary['needs_cleaning_files']:,} files")
    print(f"🔐 Has Secrets: {summary['files_with_secrets']:,} files")
    print(f"📦 Large Files: {summary['large_files']:,} files (>10MB)")
    
    print("\n" + "="*70)
    print("🔐 FILES WITH SECRETS (Top 20)")
    print("="*70)
    
    secret_files = []
    for subdir in data['detailed_audit']['subdirectories']:
        for file_info in subdir.get('files', []):
            if file_info.get('has_secrets'):
                secret_count = len(file_info.get('secrets_found', []))
                secret_files.append((file_info['path'], secret_count, file_info.get('category', 'unknown')))
    
    secret_files.sort(key=lambda x: -x[1])
    for i, (path, count, category) in enumerate(secret_files[:20], 1):
        print(f"{i:2}. {path}")
        print(f"    └─ {count} potential secrets ({category})")
    
    print("\n" + "="*70)
    print("📦 LARGE FILES (>10MB)")
    print("="*70)
    
    large_files = []
    for subdir in data['detailed_audit']['subdirectories']:
        for file_info in subdir.get('files', []):
            if file_info.get('is_large'):
                large_files.append((file_info['path'], file_info['size_mb'], file_info.get('category', 'unknown')))
    
    large_files.sort(key=lambda x: -x[1])
    for path, size, category in large_files:
        print(f"  {path}: {size:.1f} MB ({category})")
    
    print("\n" + "="*70)
    print("📋 RECOMMENDATIONS")
    print("="*70)
    print("\n1. Remove/redact API keys from files with secrets")
    print("2. Exclude large files (>10MB) or move to external hosting")
    print("3. Review service account JSON files (gentle-cinema-*.json)")
    print("4. Update .gitignore to exclude secrets and large files")
    print("\nSee: docs/PUBLIC_REPO_AUDIT_REPORT.md for full details")

if __name__ == "__main__":
    main()

