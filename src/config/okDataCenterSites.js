/**
 * Data Center Sites Configuration
 * 
 * MIGRATION NOTE: This file has been stubbed for Columbus, OH migration.
 * Original Oklahoma data center sites have been archived.
 * 
 * TODO: If Columbus has data center sites, add them here following the same structure.
 * Otherwise, this stub prevents import errors while components are migrated.
 * 
 * Original Oklahoma sites archived:
 * - google_stillwater_ok (Stillwater, OK)
 * - google_pryor_ok (Pryor, OK)
 */

// Stub: Empty array for Columbus migration
// TODO: Add Columbus data center sites if applicable
export const OK_DATA_CENTER_SITES = [];

// Stub: Empty Set for Columbus migration
export const OK_DATA_CENTER_SITE_KEYS = new Set();

/**
 * Get data center site by key
 * @param {string} key - Site key
 * @returns {Object|null} Site object or null
 */
export const getOkDataCenterSiteByKey = (key) => {
  return OK_DATA_CENTER_SITES.find(site => site.key === key) || null;
};

/**
 * Check if location is a data center location
 * @param {string} locationKey - Location key to check
 * @returns {boolean} True if location is a data center site
 */
export const isOkDataCenterLocation = (locationKey) => {
  return OK_DATA_CENTER_SITE_KEYS.has(locationKey);
};

