/**
 * Geographic Configuration System
 * Enables location flexibility for production deployment
 * 
 * This configuration allows the system to work with any geographic location
 * with Columbus, OH metro area as the default.
 */

export const GEOGRAPHIC_CONFIG = {
  // Default configuration (Columbus, Ohio Metro Area)
  default: {
    coordinates: { lat: 39.9612, lng: -82.9988 },
    city: 'Columbus',
    state: 'OH',
    county: 'Franklin County',
    region: 'Columbus Metro Area',
    gridOperator: 'AEP Ohio',
    timezone: 'America/New_York',
    searchRadius: 10000,
    businessContext: 'Columbus metro area infrastructure and development analysis',
    dataCenterCompany: null, // Update if applicable
    facilityName: 'Columbus Metro Area'
  },

  // Columbus metro area (explicit entry, optional)
  columbus_metro: {
    coordinates: { lat: 39.9612, lng: -82.9988 },
    city: 'Columbus',
    state: 'OH',
    county: 'Franklin County',
    region: 'Columbus Metro Area',
    gridOperator: 'AEP Ohio',
    timezone: 'America/New_York',
    searchRadius: 10000,
    businessContext: 'Columbus metro area infrastructure and development analysis',
    dataCenterCompany: null,
    facilityName: 'Columbus Metro Area'
  },

  samsung_taylor_wastewater: {
    coordinates: { lat: 30.5706, lng: -97.3514 },
    city: 'Taylor',
    state: 'TX',
    county: 'Williamson County',
    region: 'Central Texas',
    gridOperator: 'ERCOT',
    timezone: 'America/Chicago',
    searchRadius: 6000,
    businessContext: 'Samsung Taylor semiconductor wastewater and reclaimed water infrastructure',
    dataCenterCompany: 'Samsung',
    facilityName: 'Samsung Taylor Wastewater System'
  },

  whitney_power_grid: {
    coordinates: { lat: 31.9315, lng: -97.347 },
    city: 'Whitney',
    state: 'TX',
    county: 'Bosque County',
    region: 'Central Texas',
    gridOperator: 'ERCOT',
    timezone: 'America/Chicago',
    searchRadius: 8000,
    businessContext: 'Whitney, TX Regional Data Center Analysis',
    dataCenterCompany: 'CyrusOne',
    facilityName: 'CyrusOne DFW7 Data Center'
  },

  lake_whitney_dam_aoi: {
    coordinates: { lat: 31.867, lng: -97.367 },
    city: 'Lake Whitney Dam',
    state: 'TX',
    county: 'Hill County',
    region: 'Brazos Hydropower Corridor',
    gridOperator: 'ERCOT',
    timezone: 'America/Chicago',
    searchRadius: 4500,
    businessContext: 'Lake Whitney Dam hydropower, recreation, and tailrace monitoring',
    dataCenterCompany: 'USACE',
    facilityName: 'Lake Whitney Dam AOI'
  },

  lake_whitney_lakeside: {
    coordinates: { lat: 31.98, lng: -97.405 },
    city: 'Lakeside Village',
    state: 'TX',
    county: 'Hill County',
    region: 'Lake Whitney North Shore',
    gridOperator: 'ERCOT',
    timezone: 'America/Chicago',
    searchRadius: 4500,
    businessContext: 'Lakeside Village shoreline and marina monitoring',
    dataCenterCompany: 'N/A',
    facilityName: 'Lakeside Village Circular AOI'
  },

  // Legacy configuration (Pinal County, AZ - Regional Development)
  pinal_county: {
    coordinates: { lat: 32.9043, lng: -111.3447 },
    city: 'Pinal County',
    state: 'AZ',
    county: 'Pinal County',
    region: 'Central Arizona',
    gridOperator: 'APS',
    timezone: 'America/Phoenix',
    searchRadius: 10000,
    businessContext: 'Pinal County Regional Development Analysis',
    dataCenterCompany: 'Generic',
    facilityName: 'Pinal County Innovation Hub'
  },

  seattle: {
    coordinates: { lat: 47.6062, lng: -122.3321 },
    city: 'Seattle',
    state: 'WA',
    county: 'King County',
    region: 'Pacific Northwest',
    gridOperator: 'BPA',
    timezone: 'America/Los_Angeles',
    searchRadius: 5000, // 5km for dense urban startup mapping
    businessContext: 'Seattle Startup Ecosystem Analysis',
    dataCenterCompany: 'Generic',
    facilityName: 'Seattle Innovation Hub'
  },

  boston: {
    coordinates: { lat: 42.3601, lng: -71.0589 },
    city: 'Boston',
    state: 'MA',
    county: 'Suffolk County',
    region: 'New England',
    gridOperator: 'ISO-NE',
    timezone: 'America/New_York',
    searchRadius: 5000,
    businessContext: 'Boston Startup Ecosystem Analysis',
    dataCenterCompany: 'Generic',
    facilityName: 'Boston Innovation Hub'
  },

  toyota_battery_nc: {
    coordinates: { lat: 35.88, lng: -79.57 },
    city: 'Liberty',
    state: 'NC',
    county: 'Randolph County',
    region: 'Greensboro-Randolph Megasite',
    gridOperator: 'Duke Energy',
    timezone: 'America/New_York',
    searchRadius: 12000,
    businessContext: 'Toyota Battery Manufacturing NC utility infrastructure analysis',
    dataCenterCompany: 'Toyota / Panasonic',
    facilityName: 'Toyota Battery Manufacturing North Carolina'
  },

  vinfast_nc: {
    coordinates: { lat: 35.62, lng: -79.08 },
    city: 'Moncure',
    state: 'NC',
    county: 'Chatham County',
    region: 'Triangle Innovation Point',
    gridOperator: 'Duke Energy',
    timezone: 'America/New_York',
    searchRadius: 11000,
    businessContext: 'VinFast EV campus utility infrastructure analysis',
    dataCenterCompany: 'VinFast',
    facilityName: 'VinFast EV Manufacturing Campus'
  },

  wolfspeed_nc: {
    coordinates: { lat: 35.72, lng: -79.49 },
    city: 'Siler City',
    state: 'NC',
    county: 'Chatham County',
    region: 'Chatham-Siler City Advanced Manufacturing Site',
    gridOperator: 'Duke Energy',
    timezone: 'America/New_York',
    searchRadius: 10000,
    businessContext: 'Wolfspeed silicon carbide fab utility infrastructure analysis',
    dataCenterCompany: 'Wolfspeed',
    facilityName: 'Wolfspeed Siler City Campus'
  },

  harris_nc: {
    coordinates: { lat: 35.6506, lng: -78.9531 },
    city: 'New Hill',
    state: 'NC',
    county: 'Wake & Chatham Counties',
    region: 'Shearon Harris Nuclear Energy Complex',
    gridOperator: 'Duke Energy Progress',
    timezone: 'America/New_York',
    searchRadius: 12000,
    businessContext: 'Shearon Harris Nuclear Power Plant grid and cooling infrastructure analysis',
    dataCenterCompany: 'Duke Energy',
    facilityName: 'Shearon Harris Nuclear Power Plant'
  },

  // Archived: Oklahoma locations - migrated to Columbus, OH
  // google_stillwater_ok: {
  //   coordinates: { lat: 36.1156, lng: -97.0584 },
  //   city: 'Stillwater',
  //   state: 'OK',
  //   county: 'Payne County',
  //   region: 'Stillwater Data Center Campus',
  //   gridOperator: 'OG&E',
  //   timezone: 'America/Chicago',
  //   searchRadius: 8000,
  //   businessContext: 'Google Stillwater data center campus and OG&E infrastructure',
  //   dataCenterCompany: 'Google',
  //   facilityName: 'Google Stillwater Data Center Campus'
  // },

  // google_pryor_ok: {
  //   coordinates: { lat: 36.3086, lng: -95.3167 },
  //   city: 'Pryor',
  //   state: 'OK',
  //   county: 'Mayes County',
  //   region: 'MidAmerica Industrial Park',
  //   gridOperator: 'OG&E',
  //   timezone: 'America/Chicago',
  //   searchRadius: 10000,
  //   businessContext: 'Google Pryor data center expansion and MidAmerica Industrial Park infrastructure',
  //   dataCenterCompany: 'Google',
  //   facilityName: 'Google Pryor Data Center Expansion'
  // }
};

/**
 * Get geographic configuration for a specific location
 * @param {string} locationKey - The location key (default, austin, dallas, etc.)
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
 * @returns {string} Display name (e.g., "Whitney, TX")
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
