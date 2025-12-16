# Setting Up the Sanitized Codebase

This is a **sanitized version** of the codebase prepared for public release. All API keys and secrets have been replaced with placeholders.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

This will install all dependencies listed in `package.json`. Note: `node_modules/` was excluded from the sanitized version, so you need to install fresh.

### 2. Set Up Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your actual API keys
# You'll need:
# - PERPLEXITY_API_KEY (if using Perplexity API)
# - GOOGLE_API_KEY (if using Google APIs)
# - OPENAI_API_KEY (if using OpenAI)
# - Any other API keys your project needs
```

**Important:** The sanitized code uses placeholders like `YOUR_API_KEY_HERE`. You need to:
1. Create a `.env` file
2. Add your actual API keys
3. Update code that uses hardcoded placeholders (if any)

### 3. Run the Application

```bash
# Start development server
npm start

# Build for production
npm build

# Run tests
npm test
```

## What Was Sanitized

- **API Keys**: Replaced with placeholders (`YOUR_API_KEY_HERE`, etc.)
- **Secrets**: Passwords, tokens replaced with placeholders
- **Large Files**: Files >10MB excluded (see `sanitization_report.json`)
- **Sensitive Files**: `.env` files, service account JSONs excluded

## Files You Need to Provide

1. **`.env` file** - Create from `.env.example` with your actual keys
2. **Large data files** - If needed, download separately (they were excluded)
3. **Service account files** - If using Google Cloud, add your service account JSON

## Troubleshooting

### "Module not found" errors
- Run `npm install` to install dependencies

### "API key not found" errors
- Check that `.env` file exists and has correct variable names
- Verify API keys are set correctly
- Some code may need manual updates if placeholders weren't replaced

### Missing data files
- Large files (>10MB) were excluded
- Check `sanitization_report.json` for excluded files
- Download or generate these files separately if needed

## Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm run download-whitney` - Download Whitney data (if applicable)

## Notes

- This is a **read-only** sanitized version
- Original codebase remains unchanged
- Some functionality may require additional setup
- Review `sanitization_report.json` for details on what was changed


