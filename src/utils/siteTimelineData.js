import SITE_TIMELINE_CONFIG from '../config/siteTimelineConfig';

const timelineCache = new Map();
const timelinePromises = new Map();

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const roundTo = (value, precision = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const factor = 10 ** precision;
  return Math.round(numeric * factor) / factor;
};

const formatPeriodLabel = (frame, stats) => {
  if (frame?.label) return frame.label;
  const yearPair = stats?.year_pair;
  if (typeof yearPair === 'string' && yearPair.includes('-')) {
    const [start, end] = yearPair.split('-');
    if (start && end) {
      return `${start} \u2192 ${end}`;
    }
  }
  if (typeof yearPair === 'string' && yearPair.length > 0) {
    return yearPair;
  }
  return frame?.id || 'Period';
};

const parseTargetYear = (frame) => {
  const yearPair = frame?.stats?.year_pair;
  if (typeof yearPair === 'string') {
    const parts = yearPair.split('-').map(part => parseInt(part, 10));
    const candidate = parts.find(year => Number.isFinite(year));
    const endYear = parts.length > 1 ? parts[1] : null;
    if (Number.isFinite(endYear)) return endYear;
    if (Number.isFinite(candidate)) return candidate;
  }

  if (frame?.stats?.generated_at) {
    const generatedDate = new Date(frame.stats.generated_at);
    if (!Number.isNaN(generatedDate.getTime())) {
      return generatedDate.getUTCFullYear();
    }
  }

  const numericId = parseInt(frame?.id, 10);
  if (Number.isFinite(numericId)) {
    return numericId;
  }

  return null;
};

const createMonthlyPoints = (frame, series) => {
  if (!frame?.stats?.groups || !Array.isArray(series) || series.length === 0) {
    return [];
  }

  const targetYear = parseTargetYear(frame);
  const annualLabel = formatPeriodLabel(frame, frame.stats);
  const yearPair = frame.stats?.year_pair || frame.label || frame.id || '';
  const baseId = frame.id || yearPair || `period-${Math.random().toString(36).slice(2)}`;

  const monthlyValues = {};
  let monthlyTotal = 0;

  series.forEach(({ key }) => {
    const match = frame.stats.groups.find(group => group?.change_label === key);
    const annualArea = match?.area_ha ?? 0;
    const perMonth = roundTo(annualArea / 12, 2);
    monthlyValues[key] = perMonth;
    monthlyTotal += perMonth;
  });

  const annualTotal = roundTo(monthlyTotal * 12, 2);
  const points = [];

  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const periodLabel = targetYear != null
      ? `${MONTH_LABELS[monthIndex]} ${targetYear}`
      : `${MONTH_LABELS[monthIndex]} ${annualLabel}`;

    const point = {
      id: `${baseId}-${targetYear || 'xxxx'}-${String(monthIndex + 1).padStart(2, '0')}`,
      period: periodLabel,
      monthIndex,
      year: targetYear,
      yearPair,
      annualLabel,
      annualTotal,
      total: roundTo(monthlyTotal, 2),
      hasChange: monthlyTotal > 0,
      radiusMeters: frame.stats?.radius_m ?? null,
      generatedAt: frame.stats?.generated_at || null,
      sortKey: targetYear != null
        ? targetYear * 100 + (monthIndex + 1)
        : monthIndex
    };

    series.forEach(({ key }) => {
      point[key] = monthlyValues[key] || 0;
    });

    points.push(point);
  }

  return points;
};

const buildTimelinePayload = (siteKey, config, frames) => {
  const series = Array.isArray(config.series)
    ? config.series.map((item) => ({ ...item }))
    : [];

  const data = frames
    .flatMap((frame) => createMonthlyPoints(frame, series))
    .sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0))
    .map(({ sortKey, ...rest }) => rest);

  return {
    siteKey,
    siteName: config.siteName || siteKey,
    units: config.units || 'ha',
    series,
    data,
    generatedAt: Date.now(),
    rawFrames: frames
  };
};

export const clearSiteTimelineCache = (siteKey) => {
  if (siteKey) {
    timelineCache.delete(siteKey);
    timelinePromises.delete(siteKey);
  } else {
    timelineCache.clear();
    timelinePromises.clear();
  }
};

export const loadSiteTimelineData = async (siteKey, { forceRefresh = false } = {}) => {
  const config = SITE_TIMELINE_CONFIG?.[siteKey];
  if (!config) {
    console.warn(`[timeline] No configuration found for site ${siteKey}`);
    return null;
  }

  if (!forceRefresh && timelineCache.has(siteKey)) {
    return timelineCache.get(siteKey);
  }

  if (!forceRefresh && timelinePromises.has(siteKey)) {
    return timelinePromises.get(siteKey);
  }

  if (typeof fetch === 'undefined') {
    console.warn('[timeline] fetch API is unavailable in the current environment');
    return null;
  }

  const loadPromise = (async () => {
    const framePromises = (config.periods || []).map(async (period) => {
      const statsUrl = `${config.basePath}/${config.filePrefix}_${period.id}_stats.json`;
      try {
        const response = await fetch(statsUrl, { cache: 'no-cache' });
        if (!response.ok) {
          console.warn(`[timeline] Failed to fetch stats for ${siteKey} period ${period.id} (${response.status})`);
          return null;
        }
        const stats = await response.json();
        return { ...period, stats };
      } catch (error) {
        console.warn(`[timeline] Error loading stats for ${siteKey} period ${period.id}`, error);
        return null;
      }
    });

    const results = await Promise.all(framePromises);
    const frames = results.filter(Boolean);

    const payload = buildTimelinePayload(siteKey, config, frames);
    timelineCache.set(siteKey, payload);
    timelinePromises.delete(siteKey);
    return payload;
  })().catch((error) => {
    timelinePromises.delete(siteKey);
    console.warn(`[timeline] Unexpected error loading timeline for ${siteKey}`, error);
    return null;
  });

  timelinePromises.set(siteKey, loadPromise);
  const result = await loadPromise;
  return result;
};

export const publishSiteTimelineData = async (siteKey, options = {}) => {
  try {
    const payload = await loadSiteTimelineData(siteKey, options);
    if (typeof window !== 'undefined' && window.mapEventBus?.emit) {
      if (payload?.data?.length) {
        window.mapEventBus.emit('timeline:update', payload);
      } else {
        window.mapEventBus.emit('timeline:clear', { siteKey });
      }
    }
    return payload;
  } catch (error) {
    console.warn(`[timeline] Failed to publish timeline data for ${siteKey}`, error);
    return null;
  }
};

export default {
  loadSiteTimelineData,
  publishSiteTimelineData,
  clearSiteTimelineCache
};
