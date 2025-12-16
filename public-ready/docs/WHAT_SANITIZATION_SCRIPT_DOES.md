# What the Sanitization Script Does

## Overview

The `sanitize_for_public.py` script creates a **clean, public-ready copy** of your codebase by:
1. **Removing secrets** (API keys, passwords, tokens)
2. **Excluding sensitive/large files**
3. **Preserving directory structure**
4. **Generating helpful files** (.gitignore, .env.example)

## Step-by-Step Process

### 1. Scans Your Codebase
- Recursively walks through all directories
- Checks every file against exclusion rules
- Identifies files that need sanitization

### 2. Excludes Files (Doesn't Copy)

**Automatically excludes:**
- `.env` files (environment variables)
- `node_modules/` (dependencies)
- `__pycache__/` (Python cache)
- Build artifacts (`build/`, `dist/`)
- **Large files (>10MB by default)** - Automatically excluded to keep repo size manageable
- Service account JSON files (`gentle-cinema-*.json`)
- Shapefiles (`.shp`, `.shx`, `.dbf`, `.prj`)

**Large File Exclusion:**
- Files larger than the threshold (default: 10MB) are **completely excluded**
- This prevents huge data files from bloating your public repo
- You can adjust the threshold in `sanitize_config.json`
- In the last run, **84 large files were excluded** (including 450MB+ JSON files)

**Result:** These files are **not copied** to the output directory.

### 3. Sanitizes Files (Replaces Secrets)

For files that pass exclusion checks, the script:

**Finds patterns like:**
- API keys: `pplx-abc123...`, `sk-xyz789...`, `AIza...`
- Secrets: `password = "YOUR_PASSWORD_HERE"`, `secret: "YOUR_SECRET_HERE"`
- Environment variables: `process.env.API_KEY = "YOUR_API_KEY_HERE"`

**Replaces them with:**
- `YOUR_API_KEY_HERE`
- `YOUR_SECRET_HERE`
- `YOUR_PASSWORD_HERE`

**File types sanitized:**
- Python (`.py`)
- JavaScript/TypeScript (`.js`, `.jsx`, `.ts`, `.tsx`)
- JSON (`.json`)
- Markdown (`.md`)
- Text (`.txt`)

### 4. Copies Clean Files

Files that don't need sanitization are **copied as-is**:
- Images, fonts, other binary files
- Files without secrets
- Configuration files (if they don't match exclusion patterns)

### 5. Generates Helper Files

**Creates `.env.example`:**
```bash
PERPLEXITY_API_KEY=your_perplexity_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
# etc...
```

**Creates `.gitignore`:**
```gitignore
.env
.env.local
*.shp
node_modules/
# etc...
```

**Creates `sanitization_report.json`:**
- Lists every file processed
- Shows what action was taken (copied/sanitized/excluded)
- Records issues found

## Example Workflow

### Input (Your Code):
```python
# scripts/api.py
api_key = "YOUR_API_KEY_HERE"
password = "YOUR_PASSWORD_HERE"
```

### Output (Public-Ready):
```python
# public-ready/scripts/api.py
api_key = "YOUR_API_KEY_HERE"
password = "YOUR_PASSWORD_HERE"
```

## What Gets Created

```
public-ready/
├── .env.example          # Template for environment variables
├── .gitignore            # Git ignore patterns
├── sanitization_report.json  # Detailed report
├── scripts/              # Sanitized scripts
├── src/                  # Sanitized source code
├── docs/                 # Documentation (usually safe)
└── ...                   # All other files (copied or sanitized)
```

## Key Features

✅ **Non-destructive** - Original files are never modified
✅ **Pattern-based** - Uses regex patterns, not hardcoded paths
✅ **Configurable** - Adjust via JSON config file
✅ **Preserves structure** - Maintains directory hierarchy
✅ **Reports everything** - Detailed JSON report

## What It Does NOT Do

❌ **Doesn't modify originals** - Your source files stay untouched
❌ **Doesn't delete anything** - Only creates new sanitized copy
❌ **Doesn't commit to git** - You control when to commit
❌ **Doesn't upload anywhere** - Just creates local output directory

## Safety Features

1. **Dry-run mode** - Preview changes before applying
2. **Detailed reporting** - See exactly what changed
3. **Pattern matching** - Only replaces what matches patterns
4. **Preserves structure** - Easy to compare original vs sanitized

## Common Use Cases

1. **Preparing for GitHub** - Remove secrets before public release
2. **Sharing code** - Share without exposing credentials
3. **Documentation** - Create example code without real keys
4. **Compliance** - Remove sensitive data for audits

## Summary

The script is essentially a **smart copy machine** that:
- Copies your codebase
- Removes/replaces secrets as it copies
- Skips files you don't want public
- Creates helpful templates

Your original codebase remains **completely unchanged**.

