# Firecrawl Integration for GRDA Data Extraction

## Status

✅ **API Key Valid**: The Firecrawl API key is authenticated and working  
⚠️  **Credits Required**: The account currently has insufficient credits to perform scrapes

## Benefits of Using Firecrawl

Firecrawl can significantly simplify the GRDA data extraction process:

1. **Automatic Link Discovery**: Automatically finds all PDF links on pages
2. **JavaScript Rendering**: Handles JavaScript-rendered content (our current scraper may miss some)
3. **Structured Data Extraction**: Can extract structured data directly from pages
4. **Better Link Following**: More reliable crawling than manual BeautifulSoup scraping
5. **Markdown/HTML Formats**: Returns content in multiple formats for easier processing

## Current Setup

The API key is configured in `.env`:
```
FIRECRAWL_API_KEY=fc-21ea30264b5e400188254217c1774aad
```

## Usage

Once credits are available, you can use Firecrawl to discover PDFs:

```bash
python scripts/grda/firecrawl_integration.py
```

This will:
1. Test the API key
2. Crawl GRDA website starting from key pages
3. Extract all PDF links automatically
4. Save results to `data/grda/firecrawl_pdfs.json`

## Integration with Existing Pipeline

Firecrawl can replace or supplement `grda_website_mapper.py`:

**Option 1: Use Firecrawl for Discovery Only**
- Use Firecrawl to find PDFs
- Convert Firecrawl results to `website_structure.json` format
- Continue with existing download/process pipeline

**Option 2: Use Firecrawl for Full Scraping**
- Use Firecrawl to scrape page content
- Extract structured data directly from scraped content
- Skip PDF download if content is available on pages

## API Endpoints

- **v2 Scrape**: `POST https://api.firecrawl.dev/v2/scrape`
- **v0 Crawl**: `POST https://api.firecrawl.dev/v0/crawl` (legacy)

The script uses v2 API which is more modern and reliable.

## Cost Considerations

Firecrawl charges per page scraped. For GRDA:
- Estimated pages to crawl: ~50-100 pages
- Cost: Check current pricing at https://firecrawl.dev/pricing

## Next Steps

1. **Add Credits**: Upgrade Firecrawl plan to get credits
2. **Test Discovery**: Run `firecrawl_integration.py` to discover PDFs
3. **Compare Results**: Compare Firecrawl-discovered PDFs with current `website_structure.json`
4. **Integrate**: Merge Firecrawl results into existing pipeline

## Example Output

Once working, Firecrawl will return:
```json
{
  "success": true,
  "data": {
    "markdown": "# Page content in markdown...",
    "html": "<html>...</html>",
    "links": ["https://grda.com/file1.pdf", ...],
    "metadata": {...}
  }
}
```

This makes it much easier to find and catalog PDFs than manual scraping.

