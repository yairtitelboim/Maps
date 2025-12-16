#!/usr/bin/env node

/**
 * Framework Extraction Script
 * 
 * This script helps extract framework components from the main OKC project
 * while removing location-specific and proprietary code.
 * 
 * Usage: node scripts/extract-framework.js [component-name]
 */

const fs = require('fs');
const path = require('path');

const FRAMEWORK_DIR = path.join(__dirname, '..');
const SOURCE_DIR = path.join(__dirname, '../../src');

// Files to copy (relative to src/)
const FILES_TO_COPY = {
  // Core components
  'components/Map/components/Cards/BaseCard.jsx': 'src/components/Map/components/Cards/BaseCard.jsx',
  'components/Map/components/Cards/CardManager.jsx': 'src/components/Map/components/Cards/CardManager.jsx',
  'components/Map/components/Cards/factory/CardFactory.js': 'src/components/Map/components/Cards/factory/CardFactory.js',
  
  // Hooks
  'hooks/useAIQuery.js': 'src/hooks/useAIQuery.js',
  
  // Utils
  'utils/ResponseCache.js': 'src/utils/ResponseCache.js',
  'utils/nodeAnimation.js': 'src/utils/nodeAnimation.js',
  
  // Config (will be cleaned)
  'config/geographicConfig.js': 'src/config/geographicConfig.js',
};

// Patterns to remove from files
const CLEANUP_PATTERNS = [
  // Location-specific imports
  { pattern: /import.*taylorWastewaterSites.*/gi, replacement: '// Location-specific import removed' },
  { pattern: /import.*pinalConfig.*/gi, replacement: '// Location-specific import removed' },
  { pattern: /import.*ncPowerSites.*/gi, replacement: '// Location-specific import removed' },
  { pattern: /import.*SamsungTaylorChangeAnimation.*/gi, replacement: '// Location-specific animation removed' },
  { pattern: /import.*RockdaleChangeAnimation.*/gi, replacement: '// Location-specific animation removed' },
  
  // Location-specific code blocks
  { pattern: /TAYLOR_WASTEWATER_SITES\.find\(/g, replacement: 'null // Location-specific lookup removed' },
  { pattern: /getNcPowerSiteByKey\(/g, replacement: 'getGenericSiteByKey(' },
];

function copyFile(sourcePath, destPath) {
  const fullSource = path.join(SOURCE_DIR, sourcePath);
  const fullDest = path.join(FRAMEWORK_DIR, destPath);
  
  if (!fs.existsSync(fullSource)) {
    console.warn(`⚠️  Source file not found: ${fullSource}`);
    return false;
  }
  
  // Create destination directory
  const destDir = path.dirname(fullDest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Read, clean, and write
  let content = fs.readFileSync(fullSource, 'utf8');
  
  // Apply cleanup patterns
  CLEANUP_PATTERNS.forEach(({ pattern, replacement }) => {
    content = content.replace(pattern, replacement);
  });
  
  // Write cleaned file
  fs.writeFileSync(fullDest, content, 'utf8');
  console.log(`✅ Copied: ${destPath}`);
  
  return true;
}

// Main execution
console.log('🚀 Starting framework extraction...\n');

Object.entries(FILES_TO_COPY).forEach(([source, dest]) => {
  copyFile(source, dest);
});

console.log('\n✨ Framework extraction complete!');
console.log('📝 Next: Review and manually clean location-specific logic in copied files.');

