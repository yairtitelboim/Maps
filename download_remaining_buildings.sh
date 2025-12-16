#!/bin/bash
# Simple wrapper script to download remaining OKC tract buildings

cd "$(dirname "$0")"

echo "🏗️  Downloading remaining OKC census tract buildings..."
echo ""

# Check if limit argument provided
if [ "$1" != "" ]; then
    python3 scripts/osm-tools/download_remaining_buildings.py --limit "$1"
else
    python3 scripts/osm-tools/download_remaining_buildings.py
fi

