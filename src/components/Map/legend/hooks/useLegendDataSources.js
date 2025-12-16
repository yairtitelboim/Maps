import { useState, useEffect } from 'react';

const createLegendData = () => ({
  serpFeatures: [],
  featureCounts: {},
  totalFeatures: 0,
  lastUpdated: null
});

const createOsmData = () => ({
  visualLayers: {},
  totalFeatures: 0,
  lastUpdated: null
});

const createWhitneyData = () => ({
  features: [],
  summary: {},
  pinal_insights: {},
  zones_queried: [],
  totalFeatures: 0,
  lastUpdated: null
});

const createPerplexityData = () => ({
  geoJsonFeatures: [],
  legendItems: [],
  summary: {},
  insights: {},
  totalFeatures: 0,
  lastUpdated: null
});

const createNcPowerData = () => ({
  sites: [],
  activeSite: null,
  lastUpdated: null
});

// Archived: Oklahoma Data Center data - removed for Columbus migration
// TODO: Add Columbus/AEP Ohio data center data if needed
const createOkDataCenterData = () => ({
  sites: [],
  activeSite: null,
  lastUpdated: null
});

const createDukeData = () => ({
  features: [],
  summary: {},
  totalFeatures: 0,
  lastUpdated: null
});

const createGridData = () => ({
  nodes: [],
  lastUpdated: null
});

const createCommuteData = () => ({
  overlapAreaKm2: null,
  lastUpdated: null
});

export const useLegendDataSources = ({
  mapRef,
  okDataCenterCategoryVisibility = {}
}) => {
  const [legendData, setLegendData] = useState(() => createLegendData());
  const [osmData, setOsmData] = useState(() => createOsmData());
  const [whitneyData, setWhitneyData] = useState(() => createWhitneyData());
  const [perplexityData, setPerplexityData] = useState(() => createPerplexityData());
  const [ncPowerData, setNcPowerData] = useState(() => createNcPowerData());
  const [okDataCenterData, setOkDataCenterData] = useState(() => createOkDataCenterData());
  const [dukeData, setDukeData] = useState(() => createDukeData());
  const [gridData, setGridData] = useState(() => createGridData());
  const [commuteData, setCommuteData] = useState(() => createCommuteData());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus) {
      return undefined;
    }

    const handleSerpDataLoaded = (data) => {
      const features = data?.features || [];
      const featureCounts = {};

      features.forEach(feature => {
        const category = feature.properties?.category || 'other';
        featureCounts[category] = (featureCounts[category] || 0) + 1;
      });

      setLegendData({
        serpFeatures: features,
        featureCounts,
        totalFeatures: features.length,
        lastUpdated: data?.timestamp || Date.now()
      });
    };

    const handleOsmDataLoaded = (data) => {
      if (!data?.context?.visualLayers) return;

      const visualLayers = data.context.visualLayers;
      const totalFeatures = Object.values(visualLayers).reduce((sum, layer) => sum + layer.length, 0);

      setOsmData({
        visualLayers,
        totalFeatures,
        lastUpdated: data.timestamp || Date.now()
      });
    };

    const handleWhitneyAnalysisComplete = (data) => {
      const features = data?.features || [];
      const visualLayers = {};

      features.forEach(feature => {
        const category = feature.properties?.category;
        if (!category) return;
        if (!visualLayers[category]) {
          visualLayers[category] = [];
        }
        visualLayers[category].push(feature);
      });

      const roadFeatures = features.filter(f => f.properties?.category === 'highway_access');
      if (roadFeatures.length > 0) {
        visualLayers.roads = roadFeatures;
      }

      const timestamp = data?.timestamp || Date.now();

      setWhitneyData({
        features,
        summary: data?.summary || {},
        pinal_insights: data?.pinal_insights || {},
        zones_queried: data?.zones_queried || [],
        totalFeatures: features.length,
        lastUpdated: timestamp
      });

      setOsmData({
        visualLayers,
        totalFeatures: features.length,
        lastUpdated: timestamp
      });
    };

    const handleWhitneyAnalysisCleared = () => {
      setWhitneyData(createWhitneyData());
    };

    const handlePerplexityAnalysisComplete = (data) => {
      setPerplexityData({
        geoJsonFeatures: data?.geoJsonFeatures || [],
        legendItems: data?.legendItems || [],
        summary: data?.summary || {},
        insights: data?.insights || {},
        totalFeatures: data?.geoJsonFeatures?.length || 0,
        lastUpdated: data?.timestamp || Date.now()
      });
    };

    const handlePerplexityAnalysisCleared = () => {
      setPerplexityData(createPerplexityData());
    };

    const handleNcPowerLoaded = (data) => {
      if (!data || !Array.isArray(data.sites)) return;
      setNcPowerData({
        sites: data.sites,
        activeSite: data.activeSite || null,
        lastUpdated: data.generatedAt || Date.now()
      });
    };

    const handleNcPowerUnmounted = () => {
      setNcPowerData(createNcPowerData());
    };

    // Archived: Oklahoma Data Center event handlers - removed for Columbus migration
    // TODO: Add Columbus/AEP Ohio data center handlers if needed
    const handleOkDataCenterLoaded = (data) => {
      // Handler disabled - Oklahoma-specific feature removed
      console.log('⚠️ Oklahoma Data Center loaded event ignored - feature archived');
      return;
      /*
      // Archived code - Oklahoma data center loading logic
      */
    };

    const handleOkDataCenterUnmounted = (data) => {
      // Handler disabled - Oklahoma-specific feature removed
      console.log('⚠️ Oklahoma Data Center unmounted event ignored - feature archived');
      return;
      /*
      // Archived code - Oklahoma data center unmounting logic
      */
    };

    const handleDukeDataLoaded = (data) => {
      if (!data || !Array.isArray(data.features)) return;

      const serviceCounts = {};
      data.features.forEach(feature => {
        const service = feature.properties?.Service || 'Unknown';
        serviceCounts[service] = (serviceCounts[service] || 0) + 1;
      });

      setDukeData({
        features: data.features,
        summary: serviceCounts,
        totalFeatures: data.features.length,
        lastUpdated: data.timestamp || Date.now()
      });
    };

    const handleDukeDataCleared = () => {
      setDukeData(createDukeData());
    };

    const handleGridLoaded = (data) => {
      if (!data || !Array.isArray(data.nodes)) return;
      setGridData({
        nodes: data.nodes,
        lastUpdated: data.timestamp || Date.now()
      });
    };

    const handleGridUnmounted = () => {
      setGridData(createGridData());
    };

    const handleCommuteLoaded = (data) => {
      if (!data) return;
      setCommuteData({
        overlapAreaKm2: data.overlapAreaKm2 ?? null,
        lastUpdated: data.timestamp || Date.now()
      });
    };

    const handleCommuteUnmounted = () => {
      setCommuteData(createCommuteData());
    };

    const bus = window.mapEventBus;
    bus.on('serp:dataLoaded', handleSerpDataLoaded);
    bus.on('osm:geographicContext', handleOsmDataLoaded);
    bus.on('liberty:analysisComplete', handleWhitneyAnalysisComplete);
    bus.on('liberty:analysisCleared', handleWhitneyAnalysisCleared);
    bus.on('perplexity:analysisComplete', handlePerplexityAnalysisComplete);
    bus.on('perplexity:analysisCleared', handlePerplexityAnalysisCleared);
    bus.on('nc-power:loaded', handleNcPowerLoaded);
    bus.on('nc-power:unmounted', handleNcPowerUnmounted);
    // Archived: Oklahoma Data Center event listeners - removed for Columbus migration
    // bus.on('ok-data-center:mounted', handleOkDataCenterLoaded);
    // bus.on('ok-data-center:unmounted', handleOkDataCenterUnmounted);
    bus.on('duke:dataLoaded', handleDukeDataLoaded);
    bus.on('duke:dataCleared', handleDukeDataCleared);
    bus.on('grid:loaded', handleGridLoaded);
    bus.on('grid:unmounted', handleGridUnmounted);
    bus.on('commute:loaded', handleCommuteLoaded);
    bus.on('commute:unmounted', handleCommuteUnmounted);

    return () => {
      bus.off('serp:dataLoaded', handleSerpDataLoaded);
      bus.off('osm:geographicContext', handleOsmDataLoaded);
      bus.off('liberty:analysisComplete', handleWhitneyAnalysisComplete);
      bus.off('liberty:analysisCleared', handleWhitneyAnalysisCleared);
      bus.off('perplexity:analysisComplete', handlePerplexityAnalysisComplete);
      bus.off('perplexity:analysisCleared', handlePerplexityAnalysisCleared);
      bus.off('nc-power:loaded', handleNcPowerLoaded);
      bus.off('nc-power:unmounted', handleNcPowerUnmounted);
      // Archived: Oklahoma Data Center event listeners - removed for Columbus migration
      // bus.off('ok-data-center:mounted', handleOkDataCenterLoaded);
      // bus.off('ok-data-center:unmounted', handleOkDataCenterUnmounted);
      bus.off('duke:dataLoaded', handleDukeDataLoaded);
      bus.off('duke:dataCleared', handleDukeDataCleared);
      bus.off('grid:loaded', handleGridLoaded);
      bus.off('grid:unmounted', handleGridUnmounted);
      bus.off('commute:loaded', handleCommuteLoaded);
      bus.off('commute:unmounted', handleCommuteUnmounted);
    };
  }, [mapRef, okDataCenterCategoryVisibility]);

  return {
    legendData,
    osmData,
    whitneyData,
    perplexityData,
    ncPowerData,
    okDataCenterData,
    dukeData,
    gridData,
    commuteData
  };
};
