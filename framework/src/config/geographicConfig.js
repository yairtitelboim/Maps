/**
 * Geographic Configuration System - Framework Version
 * 
 * Demonstrates the pattern for location-based configuration.
 * Replace with your own location configurations.
 */

export const GEOGRAPHIC_CONFIG = {
  // Example default configuration
  default: {
    coordinates: { lat: 35.0, lng: -97.0 },
    city: 'Example City',
    state: 'OK',
    county: 'Example County',
    region: 'Example Region',
    gridOperator: 'Example Utility',
    timezone: 'America/Chicago',
    searchRadius: 8000,
    businessContext: 'Example business context for analysis',
    dataCenterCompany: 'Example Company',
    facilityName: 'Example Facility'
  },

  // Example location 1
  example_location_1: {
    coordinates: { lat: 36.0, lng: -98.0 },
    city: 'Example City 1',
    state: 'OK',
    county: 'Example County 1',
    region: 'Example Region 1',
    gridOperator: 'Example Utility 1',
    timezone: 'America/Chicago',
    searchRadius: 8000,
    businessContext: 'Example business context for location 1',
    dataCenterCompany: 'Example Company 1',
    facilityName: 'Example Facility 1'
  },

  // Example location 2
  example_location_2: {
    coordinates: { lat: 37.0, lng: -99.0 },
    city: 'Example City 2',
    state: 'OK',
    county: 'Example County 2',
    region: 'Example Region 2',
    gridOperator: 'Example Utility 2',
    timezone: 'America/Chicago',
    searchRadius: 10000,
    businessContext: 'Example business context for location 2',
    dataCenterCompany: 'Example Company 2',
    facilityName: 'Example Facility 2'
  }
};

/**
 * Get geographic configuration for a specific location
 * @param {string} locationKey - The location key
 * @returns {Object} Geographic configuration object
 */
export const getGeographicConfig = (locationKey = 'default') => {
  return GEOGRAPHIC_CONFIG[locationKey] || GEOGRAPHIC_CONFIG.default;
};

/**
 * Get all available locations
 * @returns {Array} Array of location objects with key, city, state
 */
export const getAvailableLocations = () => {
  return Object.entries(GEOGRAPHIC_CONFIG).map(([key, config]) => ({
    key,
    city: config.city,
    state: config.state,
    region: config.region,
    gridOperator: config.gridOperator
  }));
};

/**
 * Validate if a location key exists
 * @param {string} locationKey - The location key to validate
 * @returns {boolean} True if location exists
 */
export const isValidLocation = (locationKey) => {
  return locationKey in GEOGRAPHIC_CONFIG;
};

/**
 * Get location display name
 * @param {string} locationKey - The location key
 * @returns {string} Display name (e.g., "Example City, OK")
 */
export const getLocationDisplayName = (locationKey) => {
  const config = getGeographicConfig(locationKey);
  return `${config.city}, ${config.state}`;
};

/**
 * Get location-specific search queries
 * @param {string} locationKey - The location key
 * @returns {Array} Array of search queries for the location
 */
export const getLocationQueries = (locationKey) => {
  const config = getGeographicConfig(locationKey);
  const { city, state, county, region } = config;
  
  return [
    `startups ${city} ${state}`,
    `venture capital ${city} ${state}`,
    `tech companies ${county} ${state}`,
    `innovation hubs ${city} ${state}`,
    `startup ecosystem ${region}`,
    `coworking spaces ${city} ${state}`
  ];
};

