#!/usr/bin/env python3
"""
Audit all local infrastructure projects and generate documentation.
Identifies what's public-ready vs what stays private.
"""

import os
import json
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Define project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_FILE = PROJECT_ROOT / "local_projects_audit.json"

# Directories to scan
SCAN_DIRS = [
    "scripts",
    "data",
    "docs",
    "src",
    "public",
    "config",
    "tests",
]

# Directories to skip
SKIP_DIRS = {
    "node_modules",
    "__pycache__",
    ".git",
    ".next",
    "build",
    "dist",
    ".venv",
    "venv",
    "env",
}

# File patterns that might contain secrets
SECRET_PATTERNS = [
    r'API[_\s]?KEY',
    r'SECRET',
    r'PASSWORD',
    r'TOKEN',
    r'PRIVATE[_\s]?KEY',
    r'AUTH',
    r'CREDENTIAL',
    r'pplx-[A-Za-z0-9]+',  # Perplexity API key pattern
    r'sk-[A-Za-z0-9]+',    # OpenAI API key pattern
    r'AIza[0-9A-Za-z_-]+', # Google API key pattern
]

# File extensions to check for secrets
SECRET_CHECK_EXTENSIONS = {'.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.env', '.txt', '.md'}

# Large file threshold (MB)
LARGE_FILE_THRESHOLD_MB = 10

def check_for_secrets(file_path: Path) -> list:
    """Check if file contains potential secrets"""
    issues = []
    
    if file_path.suffix.lower() not in SECRET_CHECK_EXTENSIONS:
        return issues
    
    try:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
        
        for pattern in SECRET_PATTERNS:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                # Get context (50 chars before and after)
                start = max(0, match.start() - 50)
                end = min(len(content), match.end() + 50)
                context = content[start:end].replace('\n', ' ')
                
                issues.append({
                    "pattern": pattern,
                    "context": context,
                    "line": content[:match.start()].count('\n') + 1
                })
    except Exception as e:
        issues.append({
            "error": f"Could not read file: {str(e)}"
        })
    
    return issues

def get_file_category(file_path: Path) -> str:
    """Categorize file by type and location"""
    ext = file_path.suffix.lower()
    path_str = str(file_path)
    
    # Data files
    if ext in ['.json', '.geojson', '.csv', '.parquet', '.db', '.sqlite', '.sqlite3']:
        if 'data' in path_str.lower():
            return 'data_file'
        return 'data_file'
    
    # Scripts
    if ext in ['.py', '.js', '.jsx', '.ts', '.tsx', '.sh', '.sql']:
        if 'script' in path_str.lower() or 'scripts' in path_str.lower():
            return 'script'
        return 'script'
    
    # Documentation
    if ext in ['.md', '.txt', '.pdf']:
        return 'documentation'
    
    # Config
    if ext in ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf']:
        if 'config' in path_str.lower():
            return 'config'
        return 'config'
    
    # Environment files
    if '.env' in file_path.name.lower() or file_path.name.startswith('.'):
        return 'environment'
    
    # Maps/Visualizations
    if ext in ['.html', '.htm']:
        return 'map_visualization'
    
    return 'other'

def audit_file(file_path: Path, project_root: Path) -> dict:
    """Audit a single file"""
    rel_path = file_path.relative_to(project_root)
    file_size = file_path.stat().st_size
    file_size_mb = file_size / (1024 * 1024)
    file_size_kb = file_size / 1024
    
    file_info = {
        "path": str(rel_path),
        "size_kb": round(file_size_kb, 2),
        "size_mb": round(file_size_mb, 2),
        "extension": file_path.suffix.lower(),
        "category": get_file_category(file_path),
    }
    
    # Check for secrets
    secrets = check_for_secrets(file_path)
    if secrets:
        file_info["secrets_found"] = secrets
        file_info["has_secrets"] = True
    else:
        file_info["has_secrets"] = False
    
    # Check if large
    if file_size_mb > LARGE_FILE_THRESHOLD_MB:
        file_info["is_large"] = True
        file_info["needs_sampling"] = True
    else:
        file_info["is_large"] = False
        file_info["needs_sampling"] = False
    
    # Determine public readiness
    if file_info["has_secrets"]:
        file_info["public_ready"] = False
        file_info["public_ready_reason"] = "Contains potential secrets/API keys"
    elif file_info["is_large"] and file_info["category"] == "data_file":
        file_info["public_ready"] = False
        file_info["public_ready_reason"] = f"Large data file ({file_info['size_mb']:.1f}MB) - may need sampling"
    elif file_info["category"] == "environment":
        file_info["public_ready"] = False
        file_info["public_ready_reason"] = "Environment/config file - may contain secrets"
    elif file_info["category"] in ["documentation", "script", "map_visualization"]:
        file_info["public_ready"] = True
        file_info["public_ready_reason"] = "Safe for public release"
    else:
        file_info["public_ready"] = True
        file_info["public_ready_reason"] = "Appears safe"
    
    return file_info

def audit_directory(dir_path: Path, project_root: Path) -> dict:
    """Audit a directory and all its files"""
    dir_info = {
        "path": str(dir_path.relative_to(project_root)),
        "files": [],
        "subdirectories": [],
        "total_size_mb": 0,
        "file_count": 0,
        "public_ready_count": 0,
        "needs_cleaning_count": 0,
        "secrets_count": 0,
    }
    
    try:
        for item in dir_path.iterdir():
            # Skip certain directories
            if item.name in SKIP_DIRS or item.name.startswith('.'):
                continue
            
            if item.is_dir():
                subdir_info = audit_directory(item, project_root)
                dir_info["subdirectories"].append(subdir_info)
                dir_info["total_size_mb"] += subdir_info["total_size_mb"]
                dir_info["file_count"] += subdir_info["file_count"]
                dir_info["public_ready_count"] += subdir_info["public_ready_count"]
                dir_info["needs_cleaning_count"] += subdir_info["needs_cleaning_count"]
                dir_info["secrets_count"] += subdir_info["secrets_count"]
            elif item.is_file():
                file_info = audit_file(item, project_root)
                dir_info["files"].append(file_info)
                dir_info["total_size_mb"] += file_info["size_mb"]
                dir_info["file_count"] += 1
                
                if file_info["public_ready"]:
                    dir_info["public_ready_count"] += 1
                else:
                    dir_info["needs_cleaning_count"] += 1
                
                if file_info["has_secrets"]:
                    dir_info["secrets_count"] += 1
    except PermissionError:
        dir_info["error"] = "Permission denied"
    except Exception as e:
        dir_info["error"] = str(e)
    
    return dir_info

def generate_summary(audit_results: dict) -> dict:
    """Generate summary statistics"""
    def count_files(dir_info: dict) -> dict:
        stats = {
            "total": 0,
            "public_ready": 0,
            "needs_cleaning": 0,
            "has_secrets": 0,
            "large_files": 0,
            "by_category": defaultdict(int),
        }
        
        for file_info in dir_info.get("files", []):
            stats["total"] += 1
            if file_info.get("public_ready"):
                stats["public_ready"] += 1
            else:
                stats["needs_cleaning"] += 1
            if file_info.get("has_secrets"):
                stats["has_secrets"] += 1
            if file_info.get("is_large"):
                stats["large_files"] += 1
            stats["by_category"][file_info.get("category", "unknown")] += 1
        
        for subdir in dir_info.get("subdirectories", []):
            sub_stats = count_files(subdir)
            for key in stats:
                if key == "by_category":
                    for cat, count in sub_stats["by_category"].items():
                        stats["by_category"][cat] += count
                else:
                    stats[key] += sub_stats[key]
        
        return stats
    
    stats = count_files(audit_results)
    
    summary = {
        "audit_date": datetime.now().isoformat(),
        "project_root": str(PROJECT_ROOT),
        "total_files": stats["total"],
        "total_size_mb": round(audit_results.get("total_size_mb", 0), 2),
        "public_ready_files": stats["public_ready"],
        "needs_cleaning_files": stats["needs_cleaning"],
        "files_with_secrets": stats["has_secrets"],
        "large_files": stats["large_files"],
        "files_by_category": dict(stats["by_category"]),
        "public_ready_percentage": round((stats["public_ready"] / stats["total"] * 100) if stats["total"] > 0 else 0, 1),
    }
    
    return summary

def main():
    """Run audit on project"""
    print(f"🔍 Auditing project: {PROJECT_ROOT}\n")
    
    audit_results = {
        "path": ".",
        "files": [],
        "subdirectories": [],
        "total_size_mb": 0,
        "file_count": 0,
        "public_ready_count": 0,
        "needs_cleaning_count": 0,
        "secrets_count": 0,
    }
    
    # Scan root level files
    print("📄 Scanning root directory files...")
    for item in PROJECT_ROOT.iterdir():
        if item.is_file() and item.name not in ['.gitignore', '.git', '.env']:
            if not any(item.name.startswith(skip) for skip in ['.', '__']):
                file_info = audit_file(item, PROJECT_ROOT)
                audit_results["files"].append(file_info)
                audit_results["total_size_mb"] += file_info["size_mb"]
                audit_results["file_count"] += 1
                if file_info["public_ready"]:
                    audit_results["public_ready_count"] += 1
                else:
                    audit_results["needs_cleaning_count"] += 1
                if file_info["has_secrets"]:
                    audit_results["secrets_count"] += 1
    
    # Scan specified directories
    for dir_name in SCAN_DIRS:
        dir_path = PROJECT_ROOT / dir_name
        if dir_path.exists() and dir_path.is_dir():
            print(f"📁 Scanning directory: {dir_name}...")
            dir_info = audit_directory(dir_path, PROJECT_ROOT)
            audit_results["subdirectories"].append(dir_info)
            audit_results["total_size_mb"] += dir_info["total_size_mb"]
            audit_results["file_count"] += dir_info["file_count"]
            audit_results["public_ready_count"] += dir_info["public_ready_count"]
            audit_results["needs_cleaning_count"] += dir_info["needs_cleaning_count"]
            audit_results["secrets_count"] += dir_info["secrets_count"]
        else:
            print(f"⚠️  Directory not found: {dir_name}")
    
    # Generate summary
    summary = generate_summary(audit_results)
    
    # Combine results
    full_audit = {
        "summary": summary,
        "detailed_audit": audit_results,
    }
    
    # Save to JSON
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(full_audit, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print("\n" + "="*60)
    print("📊 AUDIT SUMMARY")
    print("="*60)
    print(f"Total files scanned: {summary['total_files']}")
    print(f"Total size: {summary['total_size_mb']:.1f} MB")
    print(f"Public ready: {summary['public_ready_files']} ({summary['public_ready_percentage']}%)")
    print(f"Needs cleaning: {summary['needs_cleaning_files']}")
    print(f"Files with secrets: {summary['files_with_secrets']}")
    print(f"Large files (>10MB): {summary['large_files']}")
    print("\nFiles by category:")
    for category, count in sorted(summary['files_by_category'].items()):
        print(f"  {category}: {count}")
    print(f"\n✅ Full audit saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()

