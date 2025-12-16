# Codebase Sanitization Script

Generic, reusable script for preparing codebases for public release. Removes secrets, handles large files, and creates clean public-ready versions.

## Features

- ✅ **Pattern-based secret detection** - Finds API keys, tokens, passwords
- ✅ **Automatic replacement** - Replaces secrets with placeholders
- ✅ **Large file handling** - Excludes or samples large files
- ✅ **Configurable** - Customize via JSON config file
- ✅ **Dry-run mode** - Preview changes before applying
- ✅ **Preserves structure** - Maintains directory structure
- ✅ **Generates .gitignore** - Creates appropriate .gitignore
- ✅ **Creates .env.example** - Template for environment variables

## Quick Start

### Basic Usage

```bash
# Run with default config
python3 scripts/sanitize_for_public.py

# Use custom config
python3 scripts/sanitize_for_public.py --config scripts/sanitize_config.json

# Dry run (preview only)
python3 scripts/sanitize_for_public.py --dry-run

# Custom source/output directories
python3 scripts/sanitize_for_public.py --source ./my-project --output ./public-ready
```

## Configuration

The script uses a JSON config file to define:
- Source and output directories
- Patterns to detect (API keys, secrets)
- Files/directories to exclude
- Large file handling strategy
- File types to sanitize

### Example Config

```json
{
  "source_dir": ".",
  "output_dir": "./public-ready",
  "patterns": {
    "api_keys": [
      "pplx-[A-Za-z0-9]{20,}",
      "sk-[A-Za-z0-9]{20,}"
    ],
    "replacements": {
      "API_KEY": "YOUR_API_KEY_HERE"
    }
  },
  "exclude_patterns": [
    "\\.env$",
    "node_modules/"
  ],
  "large_file_threshold_mb": 10,
  "large_file_action": "exclude"
}
```

## What Gets Sanitized

### Secrets Removed/Replaced

- **API Keys**: Perplexity, OpenAI, Google API keys
- **Environment Variables**: `process.env.*`, `os.getenv()`
- **Hardcoded Secrets**: Passwords, tokens, secrets in code

### Files Excluded

- `.env` files
- `node_modules/`
- Build artifacts (`build/`, `dist/`)
- Large files (>10MB by default)
- Service account JSON files

### Files Sanitized

- Python scripts (`.py`)
- JavaScript/TypeScript (`.js`, `.jsx`, `.ts`, `.tsx`)
- JSON files (`.json`)
- Markdown docs (`.md`)
- Text files (`.txt`)

## Output

After running, you'll get:

1. **Sanitized codebase** in `output_dir/`
2. **`.env.example`** - Template for environment variables
3. **`.gitignore`** - Appropriate ignore patterns
4. **`sanitization_report.json`** - Detailed report of what was done

## Report Structure

```json
{
  "summary": {
    "total_files": 100,
    "sanitized": 15,
    "excluded": 5,
    "copied": 80
  },
  "results": [
    {
      "source_path": "scripts/api.py",
      "output_path": "scripts/api.py",
      "action": "sanitized",
      "issues_found": ["Replaced API key at position 123"]
    }
  ]
}
```

## Customization

### Adding New Patterns

Edit `sanitize_config.json`:

```json
{
  "patterns": {
    "api_keys": [
      "your-custom-pattern-here"
    ]
  }
}
```

### Changing Large File Behavior

```json
{
  "large_file_action": "sample",  // or "exclude" or "compress"
  "large_file_threshold_mb": 5
}
```

### Excluding Additional Files

```json
{
  "exclude_files": [
    "*.log",
    "temp-*.json"
  ]
}
```

## Safety Features

- **Dry-run mode** - Preview before making changes
- **Preserves originals** - Source files are never modified
- **Detailed reporting** - See exactly what was changed
- **Pattern-based** - Uses regex patterns, not hardcoded paths

## Use Cases

1. **Preparing for GitHub** - Clean codebase before public release
2. **Code sharing** - Share code without exposing secrets
3. **Documentation** - Create example code without real credentials
4. **Compliance** - Remove sensitive data before audits

## Limitations

- Pattern matching may have false positives
- Large binary files are excluded (not sanitized)
- Complex nested structures may need manual review
- Some edge cases in regex patterns

## Best Practices

1. **Always dry-run first** - Preview changes before applying
2. **Review the report** - Check what was sanitized
3. **Test the output** - Verify sanitized code still works
4. **Update .env.example** - Add all required variables
5. **Manual review** - Some files may need manual cleanup

## Troubleshooting

### Too many false positives?

Adjust patterns in config to be more specific:

```json
{
  "patterns": {
    "api_keys": [
      "pplx-[A-Za-z0-9]{32}"  // More specific pattern
    ]
  }
}
```

### Files not being excluded?

Check regex patterns - they need to match the full path:

```json
{
  "exclude_patterns": [
    ".*\\.env$"  // Match .env at end of path
  ]
}
```

### Large files still included?

Check file size threshold and action:

```json
{
  "large_file_threshold_mb": 5,
  "large_file_action": "exclude"
}
```

## License

This script is generic and reusable. Feel free to adapt it for your projects.

