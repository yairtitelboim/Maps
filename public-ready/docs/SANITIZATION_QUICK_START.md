# Quick Start: Sanitization for Public Release

## Step 1: Review What Needs Cleaning

```bash
# See summary of issues
python3 scripts/audit_summary.py

# View full audit
cat local_projects_audit.json | jq '.summary'
```

## Step 2: Run Sanitization (Dry Run First)

```bash
# Preview what will be done (safe - no changes)
python3 scripts/sanitize_for_public.py \
  --config scripts/sanitize_config.json \
  --dry-run

# If preview looks good, run for real
python3 scripts/sanitize_for_public.py \
  --config scripts/sanitize_config.json
```

## Step 3: Review the Output

```bash
# Check the sanitized output
ls -la public-ready/

# Review the report
cat public-ready/sanitization_report.json | jq '.summary'

# See what was sanitized
cat public-ready/sanitization_report.json | jq '.results[] | select(.action == "sanitized") | .source_path'
```

## Step 4: Manual Review

The script handles most things automatically, but you should manually check:

1. **Service account files** - Make sure `gentle-cinema-*.json` is excluded
2. **Large GeoJSON files** - Review if sampling is appropriate
3. **Documentation** - Check that API key mentions are properly redacted
4. **Test files** - Verify test fixtures don't contain real keys

## Step 5: Create Public Repo

```bash
# Initialize git repo in sanitized output
cd public-ready
git init
git add .
git commit -m "Initial public release"

# Or copy to your public repo location
cp -r public-ready/* /path/to/infrastructure-arbitrage/
```

## Customization

### Adjust Config for Your Needs

Edit `scripts/sanitize_config.json`:

```json
{
  "exclude_files": [
    "gentle-cinema-*.json",
    "Census_Block.*",
    "your-custom-file.*"
  ],
  "large_file_threshold_mb": 5,  // Lower threshold
  "large_file_action": "sample"  // Sample instead of exclude
}
```

### Add Custom Patterns

If you have project-specific secret patterns:

```json
{
  "patterns": {
    "api_keys": [
      "your-custom-api-key-pattern"
    ]
  }
}
```

## What the Script Does

✅ **Removes/Replaces:**
- API keys (Perplexity, OpenAI, Google)
- Hardcoded secrets
- Environment variable values

✅ **Excludes:**
- `.env` files
- Large files (>10MB)
- Service account JSON files
- Build artifacts

✅ **Creates:**
- `.env.example` template
- `.gitignore` with appropriate patterns
- Sanitization report

## Troubleshooting

### Too Many Files Excluded?

Adjust `exclude_patterns` in config to be more specific.

### Secrets Not Replaced?

Check if your secret pattern matches the regex in config. You may need to add custom patterns.

### Large Files Still Included?

Verify `large_file_action` is set to `"exclude"` and threshold is appropriate.

## Next Steps

After sanitization:

1. **Review** the sanitized codebase
2. **Test** that scripts still work (with placeholders)
3. **Update** `.env.example` with all required variables
4. **Create** public repo and push to GitHub
5. **Document** setup instructions in README

## Files Created

- `public-ready/` - Sanitized codebase
- `public-ready/.env.example` - Environment variable template
- `public-ready/.gitignore` - Git ignore patterns
- `public-ready/sanitization_report.json` - Detailed report

