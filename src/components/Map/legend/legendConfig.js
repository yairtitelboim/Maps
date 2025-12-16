import { getGeographicConfig } from '../../../config/geographicConfig';

const UNIVERSITY_CONFIG = {
  boston: {
    mit: { name: 'MIT', color: '#dc2626', description: 'Massachusetts Institute of Technology' },
    harvard: { name: 'Harvard', color: '#7c2d12', description: 'Harvard University' },
    northeastern: { name: 'Northeastern', color: '#ea580c', description: 'Northeastern University' },
    bu: { name: 'Boston University', color: '#0891b2', description: 'Boston University' },
    tufts: { name: 'Tufts', color: '#7c3aed', description: 'Tufts University' }
  },
  default: {
    // Updated for Columbus, OH - AEP Ohio analysis
    osu: { name: 'Ohio State University', color: '#dc2626', description: 'Ohio State University' },
    columbus_state: { name: 'Columbus State', color: '#7c2d12', description: 'Columbus State Community College' },
    capital: { name: 'Capital University', color: '#ea580c', description: 'Capital University' },
    otterbein: { name: 'Otterbein University', color: '#0891b2', description: 'Otterbein University' },
    franklin: { name: 'Franklin University', color: '#7c3aed', description: 'Franklin University' }
  },
  columbus_metro: {
    // Columbus metro area universities
    osu: { name: 'Ohio State University', color: '#dc2626', description: 'Ohio State University' },
    columbus_state: { name: 'Columbus State', color: '#7c2d12', description: 'Columbus State Community College' },
    capital: { name: 'Capital University', color: '#ea580c', description: 'Capital University' },
    otterbein: { name: 'Otterbein University', color: '#0891b2', description: 'Otterbein University' },
    franklin: { name: 'Franklin University', color: '#7c3aed', description: 'Franklin University' }
  },
  // Archived: Houston universities - kept for reference
  houston: {
    rice: { name: 'Rice University', color: '#dc2626', description: 'Rice University' },
    uh: { name: 'University of Houston', color: '#7c2d12', description: 'University of Houston' },
    tsu: { name: 'Texas Southern University', color: '#ea580c', description: 'Texas Southern University' },
    hbu: { name: 'Houston Baptist University', color: '#0891b2', description: 'Houston Baptist University' }
  },
  seattle: {
    uw: { name: 'University of Washington', color: '#dc2626', description: 'University of Washington' },
    seattle_u: { name: 'Seattle University', color: '#7c2d12', description: 'Seattle University' },
    spu: { name: 'Seattle Pacific University', color: '#ea580c', description: 'Seattle Pacific University' }
  }
};

const BASE_OSM_LAYERS = {
  otherUniversities: true,
  offices: true,
  transportation: true,
  water: true,
  parks: true,
  commercial: true,
  analysisRadius: true,
  highways: true,
  primaryRoads: true,
  secondaryRoads: true,
  localRoads: true,
  residentialRoads: true,
  roads: true,
  highway_junctions: true,
  // AEP Ohio infrastructure layers - substations by voltage level
  aepOhioSubstationsUltraHigh: true, // 500kV+
  aepOhioSubstationsHigh: true, // 345kV
  aepOhioSubstationsMedium: true, // 138kV
  aepOhioSubstationsLow: true, // <138kV
  // AEP Ohio transmission lines by voltage level
  aepOhioTransmissionUltraHigh: true, // 500kV+
  aepOhioTransmissionHigh: true, // 345kV
  aepOhioTransmissionMedium: true, // 138kV
  aepOhioTransmissionLow: true, // <138kV
  // AEP Ohio interconnection requests
  aepOhioInterconnectionRequests: true
};

const DEFAULT_WHITNEY_LAYER_VISIBILITY = {
  office_building: true,
  commercial_building: true,
  retail_building: true,
  government_facility: true,
  education: true,
  healthcare: true,
  service_amenity: true,
  emergency_services: true,
  transit_hub: true,
  highway_access: true,
  recreation_area: true,
  industrial: true,
  county_boundary: true,
  pinal_zone: true
};

const DEFAULT_WHITNEY_LAYER_OPACITY = { isTranslucent: false };
const DEFAULT_OSM_LAYER_OPACITY = { isTranslucent: false };

const DEFAULT_NC_SITE_COLLAPSED = {
  toyota_battery_nc: true,
  vinfast_nc: true,
  wolfspeed_nc: true
};

// Archived: Oklahoma site collapsed states - removed for Columbus migration
const DEFAULT_OK_SITE_COLLAPSED = {
  // google_stillwater_ok: true,
  // google_pryor_ok: true
};

// Archived: Oklahoma data center visibility - removed for Columbus migration
const OK_DATA_CENTER_VISIBILITY = {
  pipeline: true,
  power: true,
  water: true,
  university: true,
  office: true,
  transportation: true,
  park: true,
  commercial: true,
  road: true,
  industrial: true,
  critical: true,
  telecom: true,
  other: true
};

// Archived: Oklahoma data center category visibility - removed for Columbus migration
const DEFAULT_OK_DATA_CENTER_CATEGORY_VISIBILITY = {
  // google_stillwater_ok: { ...OK_DATA_CENTER_VISIBILITY, pipeline: false },
  // google_pryor_ok: { ...OK_DATA_CENTER_VISIBILITY }
};

const DEFAULT_PERPLEXITY_LAYER_VISIBILITY = {
  innovation_hub: true,
  startup_zone: true,
  funding_source: true
};

const DEFAULT_DUKE_LAYER_VISIBILITY = {
  electric: true,
  gas: true
};

const DEFAULT_STARTUP_CATEGORY_VISIBILITY = {
  'AI/ML': true,
  'Biotech/Health': true,
  'FinTech': true,
  'CleanTech': true,
  'Enterprise': true,
  'Hardware': true,
  'Other': true
};

const DEFAULT_REAL_ESTATE_CATEGORY_VISIBILITY = {
  'Residential Sale': true,
  'Residential Lease': true,
  'Commercial Sale': true,
  'Commercial Lease': true,
  'Luxury': true,
  'Budget': true,
  'Mid-Range': true,
  'Premium': true,
  'Other': true
};

const clone = (obj) => JSON.parse(JSON.stringify(obj));

export const getLocationUniversities = (locationKey = 'default') => {
  getGeographicConfig(locationKey);
  // Updated: Default location is now Columbus, so return Columbus universities
  if (locationKey === 'default' || locationKey === 'columbus_metro') {
    return UNIVERSITY_CONFIG.columbus_metro || UNIVERSITY_CONFIG.default;
  }
  return UNIVERSITY_CONFIG[locationKey] || UNIVERSITY_CONFIG.default;
};

export const getDefaultOsmLayerVisibility = (locationKey = 'default') => {
  const locationUniversities = getLocationUniversities(locationKey);
  const universityLayers = Object.keys(locationUniversities).reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});

  return {
    ...universityLayers,
    ...BASE_OSM_LAYERS
  };
};

export const getDefaultWhitneyLayerVisibility = () => clone(DEFAULT_WHITNEY_LAYER_VISIBILITY);
export const getDefaultWhitneyLayerOpacity = () => ({ ...DEFAULT_WHITNEY_LAYER_OPACITY });
export const getDefaultOsmLayerOpacity = () => ({ ...DEFAULT_OSM_LAYER_OPACITY });
export const getDefaultNcSiteCollapsed = () => ({ ...DEFAULT_NC_SITE_COLLAPSED });
// Archived: Oklahoma site collapsed - removed for Columbus migration
export const getDefaultOkSiteCollapsed = () => ({ ...DEFAULT_OK_SITE_COLLAPSED }); // Returns empty object
// Archived: Oklahoma data center category visibility - removed for Columbus migration
export const getDefaultOkDataCenterCategoryVisibility = () => clone(DEFAULT_OK_DATA_CENTER_CATEGORY_VISIBILITY); // Returns empty object
export const getDefaultPerplexityLayerVisibility = () => ({ ...DEFAULT_PERPLEXITY_LAYER_VISIBILITY });
export const getDefaultDukeLayerVisibility = () => ({ ...DEFAULT_DUKE_LAYER_VISIBILITY });
export const getDefaultStartupCategoryVisibility = () => ({ ...DEFAULT_STARTUP_CATEGORY_VISIBILITY });
export const getDefaultRealEstateCategoryVisibility = () => ({ ...DEFAULT_REAL_ESTATE_CATEGORY_VISIBILITY });
