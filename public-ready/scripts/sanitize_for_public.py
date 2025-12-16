#!/usr/bin/env python3
"""
Generic sanitization script for preparing codebase for public release.
Removes secrets, handles large files, and creates clean public-ready versions.

This script is designed to be reusable across projects with minimal customization.
"""

import json
import re
import shutil
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
import argparse

# Default configuration - can be overridden via config file
DEFAULT_CONFIG = {
    "source_dir": ".",
    "output_dir": "./public-ready",
    "patterns": {
        "api_keys": [
            r'pplx-[A-Za-z0-9]{20,}',
            r'sk-[A-Za-z0-9]{20,}',
            r'AIza[0-9A-Za-z_-]{35}',
            r'[A-Za-z0-9]{32,}',  # Generic long alphanumeric (may be key)
        ],
        "secrets": [
            r'password\s*[:=]\s*["\']?[^"\'\s]+["\']?',
            r'secret\s*[:=]\s*["\']?[^"\'\s]+["\']?',
            r'token\s*[:=]\s*["\']?[^"\'\s]+["\']?',
        ],
        "replacements": {
            "API_KEY": "YOUR_API_KEY_HERE",
            "API_KEY_HERE": "YOUR_API_KEY_HERE",
            "SECRET": "YOUR_SECRET_HERE",
            "PASSWORD": "YOUR_PASSWORD_HERE",
            "TOKEN": "YOUR_TOKEN_HERE",
        }
    },
    "exclude_patterns": [
        r'\.env$',
        r'\.env\.local$',
        r'node_modules/',
        r'__pycache__/',
        r'\.git/',
        r'build/',
        r'dist/',
        r'\.venv/',
        r'venv/',
    ],
    "exclude_files": [
        "gentle-cinema-*.json",
        "*.shp",
        "*.shx",
        "*.dbf",
        "*.prj",
    ],
    "large_file_threshold_mb": 10,
    "large_file_action": "exclude",  # or "sample" or "compress"
    "file_extensions_to_sanitize": [".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".txt"],
    "preserve_structure": True,
    "create_env_example": True,
}

@dataclass
class SanitizationResult:
    """Result of sanitizing a file"""
    source_path: str
    output_path: str
    action: str  # "copied", "sanitized", "excluded", "sampled"
    issues_found: List[str]
    size_reduction_mb: float = 0.0

class Sanitizer:
    """Generic sanitizer for codebases"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.source_dir = Path(config["source_dir"]).resolve()
        self.output_dir = Path(config["output_dir"]).resolve()
        self.results: List[SanitizationResult] = []
        
    def should_exclude(self, file_path: Path) -> bool:
        """Check if file should be excluded"""
        rel_path = file_path.relative_to(self.source_dir)
        path_str = str(rel_path)
        
        # Check exclude patterns
        for pattern in self.config["exclude_patterns"]:
            if re.search(pattern, path_str, re.IGNORECASE):
                return True
        
        # Check exclude files
        for pattern in self.config["exclude_files"]:
            if file_path.match(pattern):
                return True
        
        return False
    
    def is_large_file(self, file_path: Path) -> bool:
        """Check if file exceeds size threshold"""
        try:
            size_mb = file_path.stat().st_size / (1024 * 1024)
            return size_mb > self.config["large_file_threshold_mb"]
        except:
            return False
    
    def find_secrets(self, content: str) -> List[Dict]:
        """Find potential secrets in content"""
        issues = []
        
        # Check for API key patterns
        for pattern in self.config["patterns"]["api_keys"]:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                issues.append({
                    "type": "api_key",
                    "pattern": pattern,
                    "position": match.start(),
                    "context": content[max(0, match.start()-20):min(len(content), match.end()+20)]
                })
        
        # Check for secret patterns
        for pattern in self.config["patterns"]["secrets"]:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                issues.append({
                    "type": "secret",
                    "pattern": pattern,
                    "position": match.start(),
                    "context": content[max(0, match.start()-20):min(len(content), match.end()+20)]
                })
        
        return issues
    
    def is_in_string_or_comment(self, content: str, pos: int) -> bool:
        """Check if position is inside a string literal or comment"""
        # Check for Python/JS comments
        line_start = content.rfind('\n', 0, pos) + 1
        line_content = content[line_start:pos]
        if '//' in line_content or line_content.strip().startswith('#'):
            return True
        
        # Check for string literals (simple check)
        before = content[max(0, pos-100):pos]
        after = content[pos:min(len(content), pos+100)]
        
        # Count unescaped quotes before position
        single_quotes = before.count("'") - before.count("\\'")
        double_quotes = before.count('"') - before.count('\\"')
        
        # If odd number of quotes, we're likely in a string
        if (single_quotes % 2 == 1) or (double_quotes % 2 == 1):
            return True
        
        return False
    
    def is_in_import_statement(self, content: str, pos: int) -> bool:
        """Check if position is part of an import statement"""
        line_start = content.rfind('\n', 0, pos) + 1
        line_end = content.find('\n', pos)
        if line_end == -1:
            line_end = len(content)
        line = content[line_start:line_end]
        
        # Check for import/from statements
        import_keywords = ['import', 'from', 'require', 'export']
        for keyword in import_keywords:
            if keyword in line.lower() and line.lower().index(keyword) < (pos - line_start):
                return True
        return False
    
    def sanitize_content(self, content: str, file_path: Path) -> tuple[str, List[str]]:
        """Sanitize file content by replacing secrets, avoiding syntax-breaking replacements"""
        sanitized = content
        issues = []
        
        # Replace specific API key patterns (more targeted) - only in string contexts
        specific_patterns = [
            (r'pplx-[A-Za-z0-9]{20,}', 'YOUR_PERPLEXITY_API_KEY'),
            (r'sk-[A-Za-z0-9]{20,}', 'YOUR_OPENAI_API_KEY'),
            (r'AIza[0-9A-Za-z_-]{35}', 'YOUR_GOOGLE_API_KEY'),
        ]
        
        for pattern, replacement in specific_patterns:
            matches = list(re.finditer(pattern, sanitized, re.IGNORECASE))
            for match in reversed(matches):
                # Only replace if it's in a string literal (not in import statements)
                if not self.is_in_import_statement(sanitized, match.start()):
                    # Check if it's in quotes (string literal)
                    before = sanitized[max(0, match.start()-50):match.start()]
                    after = sanitized[match.end():min(len(sanitized), match.end()+50)]
                    # Simple check: if there are quotes nearby, it's likely a string value
                    if '"' in before[-20:] or "'" in before[-20:] or '"' in after[:20] or "'" in after[:20]:
                        sanitized = sanitized[:match.start()] + replacement + sanitized[match.end():]
                        issues.append(f"Replaced API key pattern at position {match.start()}")
        
        # Replace common secret patterns (assignment patterns only)
        replacements = self.config["patterns"]["replacements"]
        for old, new in replacements.items():
            # Only replace if it's an assignment pattern: KEY = "value" or KEY: "value"
            # Match: API_KEY = "YOUR_API_KEY_HERE" or API_KEY: "YOUR_API_KEY_HERE"
            pattern = rf'(\b{re.escape(old)}\s*[:=]\s*["\'])([^"\']+)(["\'])'
            
            def replacer(match):
                # Check context - only replace if not in import/comment
                if not self.is_in_import_statement(sanitized, match.start()):
                    issues.append(f"Replaced {old} assignment")
                    return f'{match.group(1)}{new}{match.group(3)}'
                return match.group(0)
            
            sanitized = re.sub(pattern, replacer, sanitized, flags=re.IGNORECASE)
        
        # Replace environment variable patterns (more carefully)
        # process.env.KEY = "YOUR_KEY_HERE"
        pattern1 = r'(process\.env\.([A-Z_]+)\s*=\s*["\'])([^"\']+)(["\'])'
        def env_replacer1(match):
            if not self.is_in_import_statement(sanitized, match.start()):
                issues.append("Replaced process.env assignment")
                return f'{match.group(1)}YOUR_{match.group(2)}_HERE{match.group(4)}'
            return match.group(0)
        sanitized = re.sub(pattern1, env_replacer1, sanitized)
        
        # os.getenv("KEY", "YOUR_KEY_HERE")
        pattern2 = r'(os\.getenv\(["\']([^"\']+)["\']\s*,\s*["\'])([^"\']+)(["\']\))'
        def env_replacer2(match):
            if not self.is_in_import_statement(sanitized, match.start()):
                issues.append("Replaced os.getenv default")
                return f'{match.group(1)}YOUR_{match.group(2)}_HERE{match.group(4)}'
            return match.group(0)
        sanitized = re.sub(pattern2, env_replacer2, sanitized)
        
        # os.environ.get("KEY") or "YOUR_KEY_HERE"
        pattern3 = r'(os\.environ\.get\(["\']([^"\']+)["\']\)\s+or\s+["\'])([^"\']+)(["\'])'
        def env_replacer3(match):
            if not self.is_in_import_statement(sanitized, match.start()):
                issues.append("Replaced os.environ.get default")
                return f'{match.group(1)}YOUR_{match.group(2)}_HERE{match.group(4)}'
            return match.group(0)
        sanitized = re.sub(pattern3, env_replacer3, sanitized)
        
        return sanitized, issues
    
    def sample_large_json(self, file_path: Path, max_size_mb: float = 5.0) -> Optional[Dict]:
        """Sample a large JSON file to reduce size"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # If it's a list, take first N items
            if isinstance(data, list):
                max_items = int((max_size_mb * 1024 * 1024) / 1000)  # Rough estimate
                if len(data) > max_items:
                    sampled = data[:max_items]
                    return {
                        "data": sampled,
                        "note": f"Sampled to {max_items} items (original: {len(data)})"
                    }
            
            # If it's a dict, try to sample arrays within
            elif isinstance(data, dict):
                sampled = {}
                for key, value in data.items():
                    if isinstance(value, list) and len(value) > 100:
                        sampled[key] = value[:100]
                        sampled[f"{key}_note"] = f"Sampled to 100 items (original: {len(value)})"
                    else:
                        sampled[key] = value
                return {"data": sampled}
            
            return None
        except:
            return None
    
    def sanitize_file(self, file_path: Path) -> Optional[SanitizationResult]:
        """Sanitize a single file"""
        rel_path = file_path.relative_to(self.source_dir)
        output_path = self.output_dir / rel_path
        
        # Check if should exclude
        if self.should_exclude(file_path):
            return SanitizationResult(
                source_path=str(rel_path),
                output_path="",
                action="excluded",
                issues_found=["Matched exclude pattern"]
            )
        
        # Handle large files
        if self.is_large_file(file_path):
            action = self.config["large_file_action"]
            if action == "exclude":
                return SanitizationResult(
                    source_path=str(rel_path),
                    output_path="",
                    action="excluded",
                    issues_found=[f"File too large ({file_path.stat().st_size / (1024*1024):.1f}MB)"]
                )
            elif action == "sample" and file_path.suffix == ".json":
                sampled = self.sample_large_json(file_path)
                if sampled:
                    output_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(output_path, 'w', encoding='utf-8') as f:
                        json.dump(sampled["data"], f, indent=2)
                    return SanitizationResult(
                        source_path=str(rel_path),
                        output_path=str(output_path.relative_to(self.output_dir)),
                        action="sampled",
                        issues_found=[sampled.get("note", "File sampled")]
                    )
        
        # Check if file type should be sanitized
        if file_path.suffix.lower() not in self.config["file_extensions_to_sanitize"]:
            # Just copy as-is
            output_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file_path, output_path)
            return SanitizationResult(
                source_path=str(rel_path),
                output_path=str(output_path.relative_to(self.output_dir)),
                action="copied",
                issues_found=[]
            )
        
        # Read and sanitize content
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            sanitized, issues = self.sanitize_content(content, file_path)
            
            # Write sanitized version
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(sanitized, encoding='utf-8')
            
            return SanitizationResult(
                source_path=str(rel_path),
                output_path=str(output_path.relative_to(self.output_dir)),
                action="sanitized" if issues else "copied",
                issues_found=issues
            )
        except Exception as e:
            return SanitizationResult(
                source_path=str(rel_path),
                output_path="",
                action="error",
                issues_found=[f"Error processing: {str(e)}"]
            )
    
    def create_env_example(self):
        """Create .env.example file from common patterns"""
        if not self.config["create_env_example"]:
            return
        
        env_example_path = self.output_dir / ".env.example"
        env_example_content = """# Environment Variables Template
# Copy this file to .env and fill in your actual values

# API Keys
PERPLEXITY_API_KEY=your_perplexity_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Database
DATABASE_URL=your_database_url_here

# Other secrets
SECRET_KEY=your_secret_key_here
"""
        env_example_path.write_text(env_example_content)
        print(f"✅ Created .env.example at {env_example_path}")
    
    def create_gitignore(self):
        """Create/update .gitignore with common patterns"""
        gitignore_path = self.output_dir / ".gitignore"
        
        gitignore_content = """# Secrets
.env
.env.local
*.json  # Service account files (review individually)
**/gentle-cinema-*.json

# Large files
*.shp
*.shx
*.dbf
*.prj

# Build artifacts
node_modules/
build/
dist/
__pycache__/
*.pyc
*.pyo

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
"""
        gitignore_path.write_text(gitignore_content)
        print(f"✅ Created .gitignore at {gitignore_path}")
    
    def sanitize_directory(self, dir_path: Optional[Path] = None):
        """Recursively sanitize directory"""
        if dir_path is None:
            dir_path = self.source_dir
        
        print(f"🔍 Scanning: {dir_path.relative_to(self.source_dir)}")
        
        for item in dir_path.iterdir():
            if item.is_dir():
                # Skip excluded directories
                if not self.should_exclude(item):
                    self.sanitize_directory(item)
            elif item.is_file():
                result = self.sanitize_file(item)
                if result:
                    self.results.append(result)
                    if result.action == "sanitized":
                        print(f"  ✏️  Sanitized: {result.source_path} ({len(result.issues_found)} issues)")
                    elif result.action == "excluded":
                        print(f"  🚫 Excluded: {result.source_path}")
                    elif result.action == "sampled":
                        print(f"  📦 Sampled: {result.source_path}")
    
    def generate_report(self) -> Dict:
        """Generate sanitization report"""
        total = len(self.results)
        sanitized = sum(1 for r in self.results if r.action == "sanitized")
        excluded = sum(1 for r in self.results if r.action == "excluded")
        copied = sum(1 for r in self.results if r.action == "copied")
        sampled = sum(1 for r in self.results if r.action == "sampled")
        
        report = {
            "summary": {
                "total_files": total,
                "sanitized": sanitized,
                "excluded": excluded,
                "copied": copied,
                "sampled": sampled,
            },
            "results": [asdict(r) for r in self.results]
        }
        
        return report

def main():
    parser = argparse.ArgumentParser(description="Sanitize codebase for public release")
    parser.add_argument("--config", type=str, help="Path to config JSON file")
    parser.add_argument("--source", type=str, help="Source directory (overrides config)")
    parser.add_argument("--output", type=str, help="Output directory (overrides config)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without making changes")
    
    args = parser.parse_args()
    
    # Load config
    if args.config and Path(args.config).exists():
        with open(args.config) as f:
            config = json.load(f)
    else:
        config = DEFAULT_CONFIG.copy()
    
    # Override with CLI args
    if args.source:
        config["source_dir"] = args.source
    if args.output:
        config["output_dir"] = args.output
    
    if args.dry_run:
        print("🔍 DRY RUN MODE - No files will be modified")
        print(f"Source: {config['source_dir']}")
        print(f"Output: {config['output_dir']}")
        return
    
    # Create sanitizer
    sanitizer = Sanitizer(config)
    
    print("🧹 Starting sanitization...")
    print(f"Source: {sanitizer.source_dir}")
    print(f"Output: {sanitizer.output_dir}")
    print()
    
    # Create output directory
    sanitizer.output_dir.mkdir(parents=True, exist_ok=True)
    
    # Sanitize
    sanitizer.sanitize_directory()
    
    # Create additional files
    sanitizer.create_env_example()
    sanitizer.create_gitignore()
    
    # Generate report
    report = sanitizer.generate_report()
    report_path = sanitizer.output_dir / "sanitization_report.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    # Print summary
    print("\n" + "="*70)
    print("📊 SANITIZATION SUMMARY")
    print("="*70)
    print(f"Total files processed: {report['summary']['total_files']}")
    print(f"  ✅ Copied as-is: {report['summary']['copied']}")
    print(f"  ✏️  Sanitized: {report['summary']['sanitized']}")
    print(f"  📦 Sampled: {report['summary']['sampled']}")
    print(f"  🚫 Excluded: {report['summary']['excluded']}")
    print(f"\n✅ Sanitized codebase ready at: {sanitizer.output_dir}")
    print(f"📄 Report saved to: {report_path}")

if __name__ == "__main__":
    main()

