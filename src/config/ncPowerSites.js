/**
 * North Carolina Power & Utility Infrastructure Sites
 * Defines metadata for local OSM cache files that describe
 * power, water, and utility infrastructure around the state's
 * strategic megaproject locations.
 */

export const NC_POWER_SITES = [
  {
    key: 'toyota_battery_nc',
    name: 'Toyota Battery Manufacturing North Carolina',
    shortName: 'Toyota Battery NC',
    dataPath: '/osm/nc_power_toyota_battery_nc.json',
    coordinates: { lat: 35.85347, lng: -79.57169 },
    radiusMeters: 12000,
    color: '#0ea5e9',
    highlightColor: '#38bdf8',
    description: 'Liberty, NC Greensboro-Randolph Megasite – EV battery manufacturing campus.'
  },
  {
    key: 'vinfast_nc',
    name: 'VinFast EV Manufacturing Campus',
    shortName: 'VinFast NC',
    dataPath: '/osm/nc_power_vinfast_nc.json',
    coordinates: { lat: 35.62, lng: -79.08 },
    radiusMeters: 11000,
    color: '#f97316',
    highlightColor: '#fb923c',
    description: 'Triangle Innovation Point, Moncure, NC – VinFast EV assembly facility.'
  },
  {
    key: 'wolfspeed_nc',
    name: 'Wolfspeed Silicon Carbide Fab',
    shortName: 'Wolfspeed NC',
    dataPath: '/osm/nc_power_wolfspeed_nc.json',
    coordinates: { lat: 35.72, lng: -79.49 },
    radiusMeters: 10000,
    color: '#a855f7',
    highlightColor: '#c084fc',
    description: 'Chatham-Siler City Advanced Manufacturing Site – $5B semiconductor fab.'
  },
  {
    key: 'raleigh_grid',
    name: 'Raleigh Grid Resiliency Hub',
    shortName: 'Raleigh Grid',
    dataPath: '/osm/nc_power_raleigh_grid.json',
    coordinates: { lat: 35.7796, lng: -78.6382 },
    radiusMeters: 9000,
    color: '#3b82f6',
    highlightColor: '#60a5fa',
    description: 'Downtown Raleigh government & utility coordination district.'
  },
  {
    key: 'greensboro_grid',
    name: 'Greensboro Infrastructure Core',
    shortName: 'Greensboro Core',
    dataPath: '/osm/nc_power_greensboro_grid.json',
    coordinates: { lat: 36.0726, lng: -79.792 },
    radiusMeters: 9000,
    color: '#22d3ee',
    highlightColor: '#38e1ff',
    description: 'Downtown Greensboro civic, utility, and grid resiliency hub.'
  },
  {
    key: 'harris_nc',
    name: 'Shearon Harris Nuclear Power Plant',
    shortName: 'Harris Nuclear',
    dataPath: '/osm/nc_power_harris_nc.json',
    coordinates: { lat: 35.6506, lng: -78.9531 },
    radiusMeters: 12000,
    color: '#14b8a6',
    highlightColor: '#2dd4bf',
    description: 'New Hill, NC – Nuclear plant, switchyard, and cooling reservoir infrastructure.'
  }
];

export const NC_POWER_SITE_KEYS = new Set(NC_POWER_SITES.map(site => site.key));

export const getNcPowerSiteByKey = (key) => {
  return NC_POWER_SITES.find(site => site.key === key) || null;
};

export const isNcPowerLocation = (locationKey) => NC_POWER_SITE_KEYS.has(locationKey);
