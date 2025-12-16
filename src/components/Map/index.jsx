import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import { MapContainer, ToggleButton } from './styles/MapStyles';
import { RotateButton } from './StyledComponents';

import { useAIConsensusAnimation } from './hooks/useAIConsensusAnimation';
import { useMapInitialization } from './hooks/useMapInitialization';
import { PopupManager } from './components/PopupManager';
import { CardManager, getTexasCardsForScene } from './components/Cards';
import DetailExpandedModal from './components/DetailExpandedModal';
import { 
    highlightPOIBuildings,
    initializeRoadGrid,
    loadHarveyData
} from './utils';
import LayerToggle from './components/LayerToggle';
import DukeTransmissionEasementsLegend from './components/DukeTransmissionEasementsLegend';
import { mockDisagreementData } from './constants/mockData';
import { ErcotManager } from './components/ErcotManager';
import { 
    initializeRoadParticles,
    animateRoadParticles,
    stopRoadParticles,
    setRoadParticleThrottle
} from './hooks/mapAnimations';
import PlanningDocsLayer from './components/PlanningDocsLayer';
import PlanningAnalysisLayer from './components/PlanningAnalysisLayer';
// DenverDowntownCircle import removed - component deleted
import SceneManager from './components/SceneManager';
import AITransmissionNav from './components/AITransmissionNav';
import InfrastructureSitingPathAnimation from './components/InfrastructureSitingPathAnimation';
// import OSMLegend from './components/OSMLegend'; // Disabled - using new LegendContainer instead
import * as turf from '@turf/turf';
import { OZONA_COORDS, SONORA_COORDS, ROCKSPRINGS_COORDS, LEAKEY_COORDS, HONDO_COORDS, CASTROVILLE_COORDS, JUNCTION_COORDS, BALMORHEA_COORDS, MONAHANS_COORDS, PECOS_COORDS, TOYAH_COORDS } from './constants/highwayConstants';
import FortStocktonRadiusToggle from './components/FortStocktonRadiusToggle';
import LayerManager from './LayerManager';
import { debugLog, debugWarn, debugError, DEBUG } from './debug';
import crashMonitor from './utils/crashMonitor';
import CrashAnalyticsDashboard from './components/CrashAnalyticsDashboard';
import TimelineGraphPanel from './components/TimelineGraphPanel';
import TimelineGraphToggle from './components/TimelineGraphToggle';



// Global error handler
if (DEBUG) {
  window.addEventListener('error', (event) => {
    debugError('Global error caught:', {
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
  });
}

// Set mapbox access token
mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

// Define window level event bus for communication if it doesn't exist
if (!window.mapEventBus) {
  window.mapEventBus = {
    listeners: {},
    emit: function(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in mapEventBus listener for ${event}:`, error);
          }
        });
      }
    },
    on: function(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
      
      // Return an unsubscribe function
      return () => {
        if (this.listeners[event]) {
          this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
      };
    },
    off: function(event, callback) {
      if (this.listeners[event] && callback) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      } else if (this.listeners[event]) {
        // If no callback specified, remove all listeners for this event
        this.listeners[event] = [];
      }
    }
  };
}

const MapComponent = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const roadAnimationFrame = useRef(null);

  const [isErcotMode, setIsErcotMode] = useState(false);
  const [showRoadGrid, setShowRoadGrid] = useState(false);
  const [showMUDLayer, setShowMUDLayer] = useState(false);
  const [showHarveyData, setShowHarveyData] = useState(false);
  const [showSurfaceWater, setShowSurfaceWater] = useState(false);
  const [showWastewaterOutfalls, setShowWastewaterOutfalls] = useState(false);
  const [showZipCodes, setShowZipCodes] = useState(false);
  const [showZipFloodAnalysis, setShowZipFloodAnalysis] = useState(false);
  const [isLayerMenuCollapsed, setIsLayerMenuCollapsed] = useState(true);
  const [showAIConsensus, setShowAIConsensus] = useState(false);
  const [showCrashAnalytics, setShowCrashAnalytics] = useState(false);
  const [showRoadParticles, setShowRoadParticles] = useState(true); // Restore default to true
  const [is3DActive, setIs3DActive] = useState(false);
  const [currentRotation, setCurrentRotation] = useState(0);
  const roadParticleAnimation = useRef(null);
  const [showPlanningDocsLayer, setShowPlanningDocsLayer] = useState(false);
  
  // Planning analysis states
  const [showPlanningAnalysis, setShowPlanningAnalysis] = useState(false);
  const [showAdaptiveReuse, setShowAdaptiveReuse] = useState(false);
  const [showDevelopmentPotential, setShowDevelopmentPotential] = useState(false);
  const [showTransportation, setShowTransportation] = useState(false);
  const [showInfrastructureSitingAnimation, setShowInfrastructureSitingAnimation] = useState(false);
  const infrastructureSitingAnimationTimeoutRef = useRef(null);

  // Add these refs for drag functionality
  const isDraggingRef = useRef(false);
  const currentXRef = useRef(0);
  const currentYRef = useRef(0);
  const initialXRef = useRef(0);
  const initialYRef = useRef(0);
  const xOffsetRef = useRef(0);
  const yOffsetRef = useRef(0);
  const popupRef = useRef(null);
  
  // Debug tracking refs
  const requestAnimationFrameIds = useRef([]);
  const timeoutIds = useRef([]);
  const intervalIds = useRef([]);
  const layerLoadErrors = useRef([]);
  const crashWarnings = useRef(false);
  
  // Start performance monitoring
  useEffect(() => {
    // debugLog('Map component mounted');
    // const cleanup = monitorPerformance();
    
    return () => {
      // debugLog('Map component unmounted');
      // if (cleanup) cleanup();
    };
  }, []);
  
  // Track layer operations
  const trackLayerOperation = (operation, layerId, error = null) => {
    if (!DEBUG) return;
    
    const entry = {
      timestamp: new Date().toISOString(),
      operation,
      layerId
    };
    
    if (error) {
      entry.error = error.message;
      layerLoadErrors.current.push(entry);
      debugError(`Layer ${operation} error for ${layerId}:`, error);
    } else {
      debugLog(`Layer ${operation}:`, layerId);
    }
  };
  
  // Safe layer operation wrapper
  const safeLayerOperation = (operation, layerId, callback) => {
    if (!map.current) {
      debugWarn(`Can't ${operation} layer ${layerId} - map not initialized`);
      return false;
    }
    
    try {
      callback();
      trackLayerOperation(operation, layerId);
      return true;
    } catch (error) {
      trackLayerOperation(operation, layerId, error);
      return false;
    }
  };
  
  // Safe animation frame request
  const safeRequestAnimationFrame = (callback, name = 'unnamed') => {
    const id = requestAnimationFrame((time) => {
      try {
        callback(time);
        // Remove from tracking array once completed
        requestAnimationFrameIds.current = requestAnimationFrameIds.current.filter(item => item.id !== id);
      } catch (error) {
        debugError(`Animation frame error (${name}):`, error);
      }
    });
    
    // Track this animation frame request
    requestAnimationFrameIds.current.push({ id, name });
    return id;
  };
  
  // Monitor for potential memory leaks
  useEffect(() => {
    if (!DEBUG) return;
    
    const checkResourceUsage = () => {
      // Check for excessive animation frames
      if (requestAnimationFrameIds.current.length > 10) {
        debugWarn('Possible animation frame leak!', 
          requestAnimationFrameIds.current.map(item => item.name));
        crashWarnings.current = true;
      }
      
      // Report layer errors
      if (layerLoadErrors.current.length > 0) {
        debugWarn('Layer errors detected:', layerLoadErrors.current);
      }
    };
    
    const intervalId = setInterval(checkResourceUsage, 5000);
    intervalIds.current.push(intervalId);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);
  
  // Override animation functions with safe versions - FIX RECURSION ISSUE
  useEffect(() => {
    if (!DEBUG) return;
    
    // Store the original function
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    
    // Create a wrapper that uses the original
    const safeFn = (callback) => {
      return originalRequestAnimationFrame((time) => {
        try {
          // Track this request
          const id = Math.random().toString(36).substr(2, 9);
          requestAnimationFrameIds.current.push({ id, name: 'wrapped-raf' });
          
          // Call the callback
          callback(time);
          
          // Remove from tracking once done
          requestAnimationFrameIds.current = 
            requestAnimationFrameIds.current.filter(item => item.id !== id);
        } catch (error) {
          debugError('Error in requestAnimationFrame callback:', error);
        }
      });
    };
    
    // Replace the global function with our safe version
    window.requestAnimationFrame = safeFn;
    
    // Cleanup on unmount
    return () => {
      debugLog('Restoring original requestAnimationFrame');
      window.requestAnimationFrame = originalRequestAnimationFrame;
    };
  }, []);
  
  // Cleanup all resources on unmount
  useEffect(() => {
    return () => {
      if (DEBUG) {
        debugLog('Cleaning up resources on unmount');
      }
      
      // Cancel all animation frames
      requestAnimationFrameIds.current.forEach(item => {
        cancelAnimationFrame(item.id);
      });
      
      // Clear all timeouts
      timeoutIds.current.forEach(id => {
        clearTimeout(id);
      });
      
      // Clear all intervals
      intervalIds.current.forEach(id => {
        clearInterval(id);
      });
    };
  }, []);

  const { initializeParticleLayer, generateParticles } = useAIConsensusAnimation(map, showAIConsensus, mockDisagreementData);
  useMapInitialization(map, mapContainer);

  const ercotManagerRef = useRef(null);

  // Add loading state for 3D buildings
  const [is3DLoading, setIs3DLoading] = useState(false);

  // Add missing state declarations for essential layers only
  const [showRoads, setShowRoads] = useState(true);
  const [showMainRoads, setShowMainRoads] = useState(false);
  const [showParks, setShowParks] = useState(true);
  
  // Add state for Fort Stockton radius toggle
  const [showFortStocktonRadius, setShowFortStocktonRadius] = useState(false);
  const [showKeyInfrastructure, setShowKeyInfrastructure] = useState(false);
  
  // Add missing landcover state
  const [showLandcover, setShowLandcover] = useState(false);
  // Denver-specific state variables removed
  
  // Denver Strategy Layer States
  const [showLightRailStrategy, setShowLightRailStrategy] = useState(false);
  const [showUtilityCorridorStrategy, setShowUtilityCorridorStrategy] = useState(false);
  const [showPedestrianBridgesStrategy, setShowPedestrianBridgesStrategy] = useState(false);
  
  // Additional Denver Strategy Layer States
  const [showParkingLotsStrategy, setShowParkingLotsStrategy] = useState(false);
  const [showSportsAnchorStrategy, setShowSportsAnchorStrategy] = useState(false);
  const [showDevelopmentZonesStrategy, setShowDevelopmentZonesStrategy] = useState(false);
  
  // Downtown Denver Comparison Layer States
  const [showDowntownOfficeStrategy, setShowDowntownOfficeStrategy] = useState(false);
  const [showDowntownRetailStrategy, setShowDowntownRetailStrategy] = useState(false);
  const [showDowntownTransportStrategy, setShowDowntownTransportStrategy] = useState(false);
  const [showDowntownLargerStrategy, setShowDowntownLargerStrategy] = useState(false);
  
  // UPS Facilities Layer State
  const [showUPSFacilities, setShowUPSFacilities] = useState(false);
  
  // Amazon Fulfillment Layer State
  const [showAmazonFulfillment, setShowAmazonFulfillment] = useState(false);

  // 3D Buildings Layer State
  const [show3DBuildings, setShow3DBuildings] = useState(false);

  // Commercial Permits Layer State
  const [showCommercialPermits, setShowCommercialPermits] = useState(false);
  const [showMajorPermits, setShowMajorPermits] = useState(false);
  
  

  // Union Station Anchor Layer State
  const [showUnionStationAnchor, setShowUnionStationAnchor] = useState(false);

  // River Mile Anchor Layer State
  const [showRiverMileAnchor, setShowRiverMileAnchor] = useState(false);

  // Civic Center Anchor Layer State
  const [showCivicCenterAnchor, setShowCivicCenterAnchor] = useState(false);

  // Startup Intelligence Layer State
  const [showStartupIntelligence, setShowStartupIntelligence] = useState(false);

  // TDLR Layer State
  const [showTDLR, setShowTDLR] = useState(false);

  // Perplexity Analysis Layer State
  const [showPerplexityAnalysis, setShowPerplexityAnalysis] = useState(true); // Default to true for testing
  const [perplexityAnalysisData, setPerplexityAnalysisData] = useState(null);

  // Irrigation District Layer State
  const [showIrrigationDistrict, setShowIrrigationDistrict] = useState(false);
  const [showTWDBGroundwater, setShowTWDBGroundwater] = useState(false);
  const [showWater, setShowWater] = useState(false);
  const [showSupply, setShowSupply] = useState(false);
  const [showDemand, setShowDemand] = useState(false);
  
  // OKC Neighborhoods Layer State
  // TODO (Phase 3): Update or remove this Oklahoma-specific layer for Columbus migration
  const [showOKCNeighborhoods, setShowOKCNeighborhoods] = useState(false);

  // ERCOT GIS Reports Layer State
  const [showERCOTGISReports, setShowERCOTGISReports] = useState(false);
  // ERCOT Counties Layer State
  const [showERCOTCounties, setShowERCOTCounties] = useState(false);
  // Producer/Consumer Counties Layer State
  const [showProducerConsumerCounties, setShowProducerConsumerCounties] = useState(false);
  // Texas Energy Corridors Layer State (OSM power + gas lines)
  const [showTexasEnergyCorridors, setShowTexasEnergyCorridors] = useState(false);
  const [showTexasDataCenters, setShowTexasDataCenters] = useState(false);

  // Well Registry Layer State
  const [showWellRegistry, setShowWellRegistry] = useState(false);
  const [showCasaGrandeBoundary, setShowCasaGrandeBoundary] = useState(false);
  const [showLucid, setShowLucid] = useState(false);
  const [showR3Data, setShowR3Data] = useState(false);
  const [showGridHeatmap, setShowGridHeatmap] = useState(false);
  const [showCommuteIsochrones, setShowCommuteIsochrones] = useState(false);
  const [showPopulationIsochrones, setShowPopulationIsochrones] = useState(false);
  const [showNcPower, setShowNcPower] = useState(false);
  // Duke Transmission Easements Layer State
  const [showDukeTransmissionEasements, setShowDukeTransmissionEasements] = useState(false);
  // Toyota access route state
  const [showToyotaAccessRoute, setShowToyotaAccessRoute] = useState(false);
  
  // Timeline Graph state
  const [showTimelineGraph, setShowTimelineGraph] = useState(false);

  // DIA Anchor Layer State
  const [showDIAAnchor, setShowDIAAnchor] = useState(false);

  // Cherry Creek Anchor Layer State
  const [showCherryCreekAnchor, setShowCherryCreekAnchor] = useState(false);

  // Denver Sports Facilities Layer State
  const [showSportsFacilities, setShowSportsFacilities] = useState(false);
  
  // Add state for AI Transmission Navigator
  const [isAITransmissionNavOpen, setIsAITransmissionNavOpen] = useState(false);
  const [transmissionLayerStates, setTransmissionLayerStates] = useState({});
  
  // Add state for card system
  const [activeCards, setActiveCards] = useState([]);
  const [showCards, setShowCards] = useState(true);
  
  // Add state for detail expanded modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedNodeData, setSelectedNodeData] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedToolData, setSelectedToolData] = useState(null);

  // Load default cards for scene-0 when component mounts
  useEffect(() => {
    if (showCards && activeCards.length === 0) {
      const defaultCards = getTexasCardsForScene('scene-0');
      setActiveCards(defaultCards);
    }
  }, [showCards, activeCards.length]);
  
      // Add state for scene management - only essential layers
  const [layerStates, setLayerStates] = useState({
    showTransportation,
    showRoads,
    showParks,
    showFortStocktonRadius,
    showKeyInfrastructure,
    showLandcover,
    // Denver-specific state variables removed
    // Denver Strategy Layer States removed
    // UPS Facilities Layer State
    showUPSFacilities,
    // Amazon Fulfillment Layer State
    showAmazonFulfillment,
    // 3D Buildings Layer State
    show3DBuildings,
    // Commercial Permits Layer State
    showCommercialPermits,
    // Major Permits Layer State
    showMajorPermits,
    
    // Union Station Anchor Layer State
    showUnionStationAnchor,
    // River Mile Anchor Layer State
    showRiverMileAnchor,
    // Civic Center Anchor Layer State
    showCivicCenterAnchor,
    // DIA Anchor Layer State
    showDIAAnchor,
    // Cherry Creek Anchor Layer State
    showCherryCreekAnchor,
    // Water Layer State
    showWater,
    // Power Supply Layer State
    showSupply,
    // Power Demand Layer State
    showDemand,
    // TWDB Groundwater Layer State
    showTWDBGroundwater,
    // OKC Neighborhoods Layer State
    showOKCNeighborhoods,
    // Merge with transmission layer states from LayerToggle
    ...transmissionLayerStates
  });

  // Update layerStates whenever any layer state changes
  useEffect(() => {
    setLayerStates(prev => ({
      ...prev,
      showTransportation,
      showRoads,
      showParks,
      showFortStocktonRadius,
      showKeyInfrastructure,
      showLandcover,
      // Denver state variables removed
      // UPS Facilities Layer State
      showUPSFacilities,
      // Amazon Fulfillment Layer State
      showAmazonFulfillment,
      // Power Supply Layer State
      showSupply,
      // Power Demand Layer State
      showDemand,
      // Water Layer State
      showWater,
      // TWDB Groundwater Layer State
      showTWDBGroundwater,
      // OKC Neighborhoods Layer State
      showOKCNeighborhoods,
      // ERCOT GIS Reports Layer State
      showERCOTGISReports,
      showERCOTCounties,
      showProducerConsumerCounties,
      showTexasEnergyCorridors,
      // Merge with transmission layer states
      ...transmissionLayerStates
    }));
  }, [
    showTransportation,
    showRoads,
    showParks,
    showFortStocktonRadius,
    showKeyInfrastructure,
    showLandcover,
    // Denver dependencies removed
    // UPS Facilities Layer dependency
    showUPSFacilities,
    // Amazon Fulfillment Layer dependency
    showAmazonFulfillment,
    // 3D Buildings Layer dependency
    show3DBuildings,
    // Commercial Permits Layer dependency
    showCommercialPermits,
    // Major Permits Layer dependency
    showMajorPermits,
    
    // Union Station Anchor Layer dependency
    showUnionStationAnchor,
    // River Mile Anchor Layer dependency
    showRiverMileAnchor,
    // Civic Center Anchor Layer dependency
    showCivicCenterAnchor,
    // DIA Anchor Layer dependency
    showDIAAnchor,
    // Cherry Creek Anchor Layer dependency
    showCherryCreekAnchor,
    // Power Supply Layer dependency
    showSupply,
    // Power Demand Layer dependency
    showDemand,
    // Water Layer dependency
    showWater,
    // TWDB Groundwater dependency
    showTWDBGroundwater,
    // OKC Neighborhoods Layer dependency
    showOKCNeighborhoods,
    // ERCOT GIS Reports Layer dependency
    showERCOTGISReports,
    // Denver Strategy Layer dependencies removed
    showDowntownTransportStrategy
    // Removed transmissionLayerStates to prevent infinite loop
  ]);

  // Separate effect for transmission layer states to avoid infinite loop
  useEffect(() => {
    setLayerStates(prev => ({
      ...prev,
      ...transmissionLayerStates
    }));
  }, [transmissionLayerStates]);

  // Handler to receive layer states from LayerToggle component
  const handleTransmissionLayerStateUpdate = useCallback((newStates) => {
    setTransmissionLayerStates(prev => ({
      ...prev,
      ...newStates
    }));
  }, []);
  
  // Handler for card events from AI Transmission Nav
  useEffect(() => {
    const handleShowCards = (event) => {
      setActiveCards(event.cards);
      setShowCards(true);
    };
    
    const handleHideCards = () => {
      setActiveCards([]);
      setShowCards(false);
    };
    
    // Use the unsubscribe functions returned by mapEventBus.on
    const unsubscribeShow = window.mapEventBus.on('cards:show', handleShowCards);
    const unsubscribeHide = window.mapEventBus.on('cards:hide', handleHideCards);
    
    return () => {
      unsubscribeShow();
      unsubscribeHide();
    };
  }, []);

  // Event listener for Lucid layer toggle from OSMCall
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleLucidToggle = (show) => {
      setShowLucid(show);
    };
    
    if (window.mapEventBus) {
      window.mapEventBus.on('lucid:toggle', handleLucidToggle);
    }
    
    return () => {
      if (window.mapEventBus) {
        window.mapEventBus.off('lucid:toggle', handleLucidToggle);
      }
    };
  }, [setShowLucid]);

  // Event listener for Irrigation Districts layer toggle from OSMCall
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleIrrigationToggle = (show) => {
      setShowIrrigationDistrict(show);
    };
    
    if (window.mapEventBus) {
      window.mapEventBus.on('irrigation:toggle', handleIrrigationToggle);
    }
    
    return () => {
      if (window.mapEventBus) {
        window.mapEventBus.off('irrigation:toggle', handleIrrigationToggle);
      }
    };
  }, [setShowIrrigationDistrict]);

  // Event listener for Well Registry layer toggle from OSMCall
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleWellRegistryToggle = (show) => {
      setShowWellRegistry(show);
    };
    
    if (window.mapEventBus) {
      window.mapEventBus.on('well-registry:toggle', handleWellRegistryToggle);
    }
    
    return () => {
      if (window.mapEventBus) {
        window.mapEventBus.off('well-registry:toggle', handleWellRegistryToggle);
      }
    };
  }, [setShowWellRegistry]);

  // Event listener for Main Roads layer toggle from OSMCall
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleMainRoadsToggle = (show) => {
      setShowMainRoads(show);
    };
    
    if (window.mapEventBus) {
      window.mapEventBus.on('main-roads:toggle', handleMainRoadsToggle);
    }
    
    return () => {
      if (window.mapEventBus) {
        window.mapEventBus.off('main-roads:toggle', handleMainRoadsToggle);
      }
    };
  }, [setShowMainRoads]);

  // Event listener for Duke Transmission Easements layer toggle from OSMCall
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleDukeShow = (show) => {
      setShowDukeTransmissionEasements(show);
    };
    
    if (window.mapEventBus) {
      window.mapEventBus.on('duke:show', handleDukeShow);
    }
    
    return () => {
      if (window.mapEventBus) {
        window.mapEventBus.off('duke:show', handleDukeShow);
      }
    };
  }, [setShowDukeTransmissionEasements]);


  // Helper functions to generate realistic infrastructure data based on node properties
  const generateInfrastructureCount = (nodeData, type) => {
    const powerScore = nodeData.powerScore || 0;
    const risk = nodeData.risk?.toLowerCase() || 'medium';
    
    if (type === 'powerPlants') {
      // Higher power score = more power plants nearby
      if (powerScore >= 8) return '8-12';
      if (powerScore >= 6) return '5-8';
      if (powerScore >= 4) return '3-5';
      return '1-3';
    } else if (type === 'substations') {
      // More substations for higher power scores
      if (powerScore >= 8) return '6-10';
      if (powerScore >= 6) return '4-6';
      if (powerScore >= 4) return '2-4';
      return '1-2';
    }
    return 'N/A';
  };

  const generateWaterAccess = (nodeData) => {
    const powerScore = nodeData.powerScore || 0;
    const risk = nodeData.risk?.toLowerCase() || 'medium';
    
    if (powerScore >= 8) return 'Multiple water sources available';
    if (powerScore >= 6) return 'Municipal + groundwater access';
    if (powerScore >= 4) return 'Limited water access';
    return 'Water access uncertain';
  };

  const generateFiberConnectivity = (nodeData) => {
    const powerScore = nodeData.powerScore || 0;
    const type = nodeData.type?.toLowerCase() || '';
    
    if (type.includes('utility') || type.includes('electric')) {
      return 'Multiple carriers available';
    }
    if (powerScore >= 6) return 'Good fiber connectivity';
    if (powerScore >= 4) return 'Limited fiber options';
    return 'Fiber connectivity uncertain';
  };

  const generateLandUse = (nodeData) => {
    const powerScore = nodeData.powerScore || 0;
    const type = nodeData.type?.toLowerCase() || '';
    
    if (type.includes('utility') || type.includes('electric')) {
      return 'Industrial zones present';
    }
    if (powerScore >= 6) return 'Mixed industrial/residential';
    return 'Mixed land use';
  };

  const generateTransportationAccess = (nodeData) => {
    const powerScore = nodeData.powerScore || 0;
    const type = nodeData.type?.toLowerCase() || '';
    
    if (type.includes('utility') || type.includes('electric')) {
      return 'Major transportation nearby';
    }
    if (powerScore >= 6) return 'Good transportation access';
    if (powerScore >= 4) return 'Limited transportation';
    return 'Transportation access uncertain';
  };

  const generateCriticalInfrastructure = (nodeData) => {
    const powerScore = nodeData.powerScore || 0;
    const type = nodeData.type?.toLowerCase() || '';
    
    if (type.includes('utility') || type.includes('electric')) {
      return 'Critical facilities nearby';
    }
    if (powerScore >= 6) return 'Some critical facilities';
    return 'No critical facilities';
  };

  // Handler for detail expand events
  useEffect(() => {
    const handleDetailExpand = (event) => {
      const { nodeId, nodeData, category } = event;
      
      if (nodeData) {
        // Use the actual node data from the table
        setSelectedNodeData(nodeData);
        setSelectedCategory(category || 'all');
        
        // Create mock toolData for now - this would come from actual tool execution
        // Calculate dynamic values based on nodeData properties
        // Use actual nodeData properties instead of calculated values
        const getNodeType = (nodeData) => {
          return nodeData.type || 'Unknown';
        };

        // Use actual nodeData properties instead of calculated values
        const getRedundancyValue = (nodeData) => {
          return nodeData.redundancy || 'Standard';
        };

        // Use actual nodeData properties instead of calculated values
        const getResilienceValue = (nodeData) => {
          return nodeData.resilience || 'Standard';
        };

        // Use nodeData as-is since it now contains real infrastructure data from tools
        const enhancedNodeData = {
          ...nodeData
        };

        const mockToolData = {
          powerGridAnalysis: {
            reliabilityScore: nodeData.powerScore || 8,
            stabilityScore: Math.min(10, (nodeData.powerScore || 8) + 2),
            transmissionCapacity: nodeData.powerScore >= 8 ? '400-500MW' : nodeData.powerScore >= 6 ? '200-300MW' : '100-200MW',
            ercotIntegration: nodeData.powerScore >= 8 ? 'Excellent' : nodeData.powerScore >= 6 ? 'Good' : 'Fair',
            riskFactors: nodeData.risk || 'Medium',
            redundancyValue: nodeData.powerScore >= 8 ? 'High' : nodeData.powerScore >= 6 ? 'Medium' : 'Low'
          },
          siteAssessment: {
            availableCapacity: nodeData.capacity || '500 MW',
            redundancy: getRedundancyValue(nodeData),
            queueTimeline: nodeData.queueDepth || '2.1 years',
            resilience: getResilienceValue(nodeData),
            nodeType: getNodeType(nodeData)
          },
          environmentalAnalysis: {
            waterAccess: 'Municipal + Groundwater',
            fiberConnectivity: 'Multiple carriers within 5 miles',
            environmentalConcerns: 'Phase I ESA completed, no major concerns',
            climateEfficiency: 'Favorable for cooling'
          }
        };
        
        setSelectedToolData(mockToolData);
        setSelectedNodeData(enhancedNodeData);
        setShowDetailModal(true);
      } else {
        // Fallback to mock data if no node data provided
        const mockNodeData = {
          id: nodeId,
          name: `Node ${nodeId}`,
          type: 'Infrastructure Node',
          powerScore: Math.floor(Math.random() * 10) + 1,
          risk: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)],
          capacity: 'N/A',
          queueDepth: 'N/A',
          resilience: 'Weather resilient design',
          redundancy: 'Multiple transmission paths',
          content: `Detailed analysis for Node ${nodeId}. This is a comprehensive overview of the infrastructure node including its capabilities, risks, and operational characteristics. The node represents a critical component in the power grid infrastructure with specific performance metrics and operational requirements.`,
          // Generate realistic infrastructure data for mock nodes too
          powerPlantsCount: generateInfrastructureCount({ powerScore: Math.floor(Math.random() * 10) + 1 }, 'powerPlants'),
          substationsCount: generateInfrastructureCount({ powerScore: Math.floor(Math.random() * 10) + 1 }, 'substations'),
          waterAccess: generateWaterAccess({ powerScore: Math.floor(Math.random() * 10) + 1 }),
          fiberConnectivity: generateFiberConnectivity({ powerScore: Math.floor(Math.random() * 10) + 1, type: 'Infrastructure Node' }),
          landUse: generateLandUse({ powerScore: Math.floor(Math.random() * 10) + 1, type: 'Infrastructure Node' }),
          transportationAccess: generateTransportationAccess({ powerScore: Math.floor(Math.random() * 10) + 1, type: 'Infrastructure Node' }),
          criticalInfrastructure: generateCriticalInfrastructure({ powerScore: Math.floor(Math.random() * 10) + 1, type: 'Infrastructure Node' })
        };
        
        setSelectedNodeData(mockNodeData);
        setSelectedCategory(category || 'all');
        setSelectedToolData(null);
        setShowDetailModal(true);
      }
    };
    
    const unsubscribeDetailExpand = window.mapEventBus.on('detail:expand', handleDetailExpand);
    
    return () => {
      unsubscribeDetailExpand();
    };
  }, []);

  // Listen for infrastructure data from tools
  useEffect(() => {
    const handleSerpInfrastructureCounts = (data) => {
      setSelectedNodeData(prev => ({
        ...prev,
        powerPlantsCount: data.powerPlantsCount,
        fiberConnectivity: data.fiberConnectivity
      }));
    };

    const handleOsmInfrastructureData = (data) => {
      setSelectedNodeData(prev => ({
        ...prev,
        substationsCount: data.substationsCount,
        waterAccess: data.waterAccess,
        landUse: data.landUse,
        transportationAccess: data.transportationAccess,
        criticalInfrastructure: data.criticalInfrastructure
      }));
    };

    if (window.mapEventBus) {
      const unsubscribeSerp = window.mapEventBus.on('serp:infrastructureCounts', handleSerpInfrastructureCounts);
      const unsubscribeOsm = window.mapEventBus.on('osm:infrastructureData', handleOsmInfrastructureData);
      
      return () => {
        unsubscribeSerp();
        unsubscribeOsm();
      };
    }
  }, []);

  // Reference to LayerToggle component for direct state updates
  const layerToggleRef = useRef(null);

  // Handler to update individual layer states (for AI Navigation)
  const handleLoadTransmissionScene = (sceneLayerState) => {
    // Use LayerToggle's updateLayerStates method to update ALL toggles at once
    // This ensures all layer toggles in LayerToggle.jsx are properly restored
    if (layerToggleRef.current && layerToggleRef.current.updateLayerStates) {
      try {
        layerToggleRef.current.updateLayerStates(sceneLayerState);
      } catch (error) {
        console.error('Error updating layer states via LayerToggle ref:', error);
        // Fallback to manual updates if ref method fails
      }
    }
    
    // Also update main map states directly (for states not in LayerToggle)
    // Update main map states
    if (sceneLayerState.showTransportation !== undefined) setShowTransportation(sceneLayerState.showTransportation);
    if (sceneLayerState.showRoads !== undefined) setShowRoads(sceneLayerState.showRoads);
    if (sceneLayerState.showParks !== undefined) setShowParks(sceneLayerState.showParks);
    if (sceneLayerState.showKeyInfrastructure !== undefined) setShowKeyInfrastructure(sceneLayerState.showKeyInfrastructure);
    if (sceneLayerState.showLandcover !== undefined) setShowLandcover(sceneLayerState.showLandcover);
    // Denver scene loading logic removed
    
    // UPS Facilities Layer State
    if (sceneLayerState.showUPSFacilities !== undefined) setShowUPSFacilities(sceneLayerState.showUPSFacilities);
    // Amazon Fulfillment Layer State
    if (sceneLayerState.showAmazonFulfillment !== undefined) setShowAmazonFulfillment(sceneLayerState.showAmazonFulfillment);
    // 3D Buildings Layer State
    if (sceneLayerState.show3DBuildings !== undefined) setShow3DBuildings(sceneLayerState.show3DBuildings);
    // Commercial Permits Layer State
    if (sceneLayerState.showCommercialPermits !== undefined) setShowCommercialPermits(sceneLayerState.showCommercialPermits);
    // Major Permits Layer State
    if (sceneLayerState.showMajorPermits !== undefined) setShowMajorPermits(sceneLayerState.showMajorPermits);
    
    // Union Station Anchor Layer State
    if (sceneLayerState.showUnionStationAnchor !== undefined) setShowUnionStationAnchor(sceneLayerState.showUnionStationAnchor);
    // River Mile Anchor Layer State
    if (sceneLayerState.showRiverMileAnchor !== undefined) setShowRiverMileAnchor(sceneLayerState.showRiverMileAnchor);
    // Civic Center Anchor Layer State
    if (sceneLayerState.showCivicCenterAnchor !== undefined) setShowCivicCenterAnchor(sceneLayerState.showCivicCenterAnchor);
    // DIA Anchor Layer State
    if (sceneLayerState.showDIAAnchor !== undefined) setShowDIAAnchor(sceneLayerState.showDIAAnchor);
    // Cherry Creek Anchor Layer State
    if (sceneLayerState.showCherryCreekAnchor !== undefined) setShowCherryCreekAnchor(sceneLayerState.showCherryCreekAnchor);
    
    // R3 Data Layer State
    if (sceneLayerState.showR3Data !== undefined) setShowR3Data(sceneLayerState.showR3Data);
    // Duke Transmission Easements Layer State
    if (sceneLayerState.showDukeTransmissionEasements !== undefined) setShowDukeTransmissionEasements(sceneLayerState.showDukeTransmissionEasements);

    // Update transmission layer states
    setTransmissionLayerStates(prev => ({
      ...prev,
      ...sceneLayerState
    }));

    // Directly update LayerToggle states if possible
    if (layerToggleRef.current && layerToggleRef.current.updateLayerStates) {
      layerToggleRef.current.updateLayerStates(sceneLayerState);
    }
  };

  // Function to handle all click events and throttle animations
  const setupMapInteractionHandlers = (map) => {
    if (!map) return;
    
    // Handle any click on the map - we throttle the animation temporarily
    map.on('click', (e) => {
      debugLog('Map click detected, temporarily throttling animations');
      setRoadParticleThrottle(2, 1500); // medium throttle for 1.5 seconds
    });
    
    // Also throttle during drag operations
    map.on('dragstart', () => {
      debugLog('Map drag started, throttling animations');
      setRoadParticleThrottle(2, 500); // medium throttle, shorter duration
    });
    
    // Heavy throttle during zoom operations which are more intensive
    map.on('zoomstart', () => {
      debugLog('Map zoom started, heavily throttling animations');
      setRoadParticleThrottle(3, 1000); // high throttle for 1 second
    });
    
    // Handle the end of these operations
    map.on('zoomend', () => {
      debugLog('Map zoom ended, restoring animations');
      setTimeout(() => setRoadParticleThrottle(1), 300);
    });
    
    // Listen for custom events from AIChatPanel or SceneManager
    window.mapEventBus.on('scene:loading', () => {
      debugLog('Scene loading detected, heavily throttling animations');
      setRoadParticleThrottle(3, 2000); // heavy throttle during scene changes
    });
    
    window.mapEventBus.on('scene:loaded', () => {
      debugLog('Scene loaded, restoring animations');
      setTimeout(() => setRoadParticleThrottle(1), 500);
    });
    
    window.mapEventBus.on('ai:processing', () => {
      debugLog('AI processing detected, throttling animations');
      setRoadParticleThrottle(2, 3000); // medium throttle during AI operations
    });
    
    // Event listener for Infrastructure Siting animation from energy marker popups
    const handleInfrastructureSitingAnimation = () => {
      console.log('🎯 [Map] Infrastructure Siting animation triggered from energy marker');
      
      // Clear any existing timeout
      if (infrastructureSitingAnimationTimeoutRef.current) {
        clearTimeout(infrastructureSitingAnimationTimeoutRef.current);
        infrastructureSitingAnimationTimeoutRef.current = null;
      }
      
      // Emit start event for badge pulsing
      if (window.mapEventBus) {
        window.mapEventBus.emit('infrastructure-siting:start');
      }
      
      // Show animation immediately
      setShowInfrastructureSitingAnimation(true);
      
      // Keep animation visible for at least 20 seconds
      infrastructureSitingAnimationTimeoutRef.current = setTimeout(() => {
        console.log('🛑 [Map] Infrastructure Siting animation timeout - hiding');
        setShowInfrastructureSitingAnimation(false);
        
        // Emit stop event for badge pulsing
        if (window.mapEventBus) {
          window.mapEventBus.emit('infrastructure-siting:stop');
        }
        
        infrastructureSitingAnimationTimeoutRef.current = null;
      }, 20000); // 20 seconds minimum visibility
    };
    
    if (window.mapEventBus) {
      window.mapEventBus.on('infrastructure-siting:play', handleInfrastructureSitingAnimation);
    }
    
    // Clean up when component unmounts
    return () => {
      if (window.mapEventBus) {
        window.mapEventBus.off('infrastructure-siting:play', handleInfrastructureSitingAnimation);
      }
      if (infrastructureSitingAnimationTimeoutRef.current) {
        clearTimeout(infrastructureSitingAnimationTimeoutRef.current);
      }
      map.off('click');
      map.off('dragstart');
      map.off('zoomstart');
      map.off('zoomend');
    };
  };


  
  // Handler for loading scenes
  // Add effect to expose handleLoadScene on the map object and window.mapComponent
  useEffect(() => {
    
    // Create window.mapComponent if it doesn't exist
    if (!window.mapComponent) {
      window.mapComponent = {};
    }
    
    // First make sure handleLoadScene is exposed globally
    // window.mapComponent.handleLoadScene = handleLoadScene; // Removed
    
    // Then attach to map.current when available
    if (map.current) {
      // Expose handleLoadScene function directly on the map object
      // map.current.handleLoadScene = handleLoadScene; // Removed
      
      // Update global reference with map object
      // window.mapComponent.map = map.current; // Removed
      
      // Expose map instance globally for table navigation
      window.mapInstance = map.current;
    }
    
    // Return cleanup function
    return () => {
      // Keep the global reference available even after component unmounts
    };
  }, [map.current]);

  useEffect(() => {
    if (map.current) {
      if (showRoadGrid) {
        initializeRoadGrid(map.current, {
          minzoom: 5,
          maxzoom: 22
        });
      } else {
        if (map.current.getLayer('road-grid')) {
          map.current.removeLayer('road-grid');
        }
      }
    }
  }, [showRoadGrid]);

  // Add this effect for road particles
  useEffect(() => {
    if (!map.current) return;

    const initializeParticles = async () => {
      try {
        // Wait for style to fully load
        if (!map.current.isStyleLoaded()) {
          await new Promise(resolve => {
            map.current.once('style.load', resolve);
          });
        }

        if (showRoadParticles) {
          debugLog('Starting road particles animation...');
          initializeRoadParticles(map.current);
          
          // Set up interaction handlers for the map
          const cleanupHandlers = setupMapInteractionHandlers(map.current);
          
          // Use the original requestAnimationFrame for the animation loop
          // to avoid potential issues with our wrapped version
          const originalRequestAnimationFrame = window._originalRAF || window.requestAnimationFrame;
          
          const animate = (timestamp) => {
            try {
              if (!map.current) return;
              
              animateRoadParticles({ map: map.current, timestamp });
              roadParticleAnimation.current = originalRequestAnimationFrame(animate);
            } catch (error) {
              debugError('Error in road particles animation:', error);
              if (roadParticleAnimation.current) {
                cancelAnimationFrame(roadParticleAnimation.current);
                roadParticleAnimation.current = null;
              }
            }
          };
          
          // Start the animation loop
          roadParticleAnimation.current = originalRequestAnimationFrame(animate);
          debugLog('Road particles animation started');
          
          // Return cleanup function that also removes event handlers
          return () => {
            if (cleanupHandlers) cleanupHandlers();
          };
        } else {
          if (roadParticleAnimation.current) {
            debugLog('Stopping road particles animation');
            stopRoadParticles(map.current);
            cancelAnimationFrame(roadParticleAnimation.current);
            roadParticleAnimation.current = null;
          }
        }
      } catch (error) {
        debugError('Failed to initialize road particles:', error);
      }
    };

    // Store original requestAnimationFrame if not already stored
    if (!window._originalRAF) {
      window._originalRAF = window.requestAnimationFrame;
    }

    // Initialize when map is ready
    if (map.current && map.current.loaded()) {
      debugLog('Map already loaded, initializing particles immediately');
      initializeParticles();
    } else {
      debugLog('Waiting for map to load before initializing particles');
      map.current.once('load', initializeParticles);
    }

    // Cleanup function
    return () => {
      if (roadParticleAnimation.current) {
        debugLog('Cleaning up road particle animation on effect cleanup');
        cancelAnimationFrame(roadParticleAnimation.current);
        roadParticleAnimation.current = null;
      }
    };
  }, [showRoadParticles]);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      if (roadParticleAnimation.current) {
        cancelAnimationFrame(roadParticleAnimation.current);
        roadParticleAnimation.current = null;
      }
    };
  }, []);

  // Add a Layer Manager utility to better control layer loading and unloading
  // const LayerManager = (() => {
  //   const loadedLayers = new Set();
  //   const layerLoadTimes = {};
  //   const pendingLayers = [];
  //   const layerTypes = {};
  //   let processingQueue = false;
    
  //   // Process the layer queue gradually to avoid overwhelming the GPU
  //   const processLayerQueue = () => {
  //     if (pendingLayers.length === 0 || processingQueue || !map.current) {
  //       return;
  //     }
      
  //     processingQueue = true;
      
  //     // Process just a few layers at a time
  //     const batchSize = 2;
  //     const layersToProcess = pendingLayers.splice(0, batchSize);
      
  //     debugLog(`Processing ${layersToProcess.length} layers from queue. ${pendingLayers.length} remaining.`);
      
  //     layersToProcess.forEach(({ layerId, setupFunction, type }) => {
  //       const startTime = performance.now();
        
  //       try {
  //         debugLog(`Loading layer: ${layerId} (${type})`);
  //         setupFunction();
  //         loadedLayers.add(layerId);
  //         layerTypes[layerId] = type;
  //         const loadTime = performance.now() - startTime;
  //         layerLoadTimes[layerId] = loadTime;
  //         debugLog(`Loaded layer ${layerId} in ${loadTime.toFixed(2)}ms`);
  //       } catch (error) {
  //         debugError(`Failed to load layer ${layerId}:`, error);
  //         trackLayerOperation('load', layerId, error);
  //       }
  //     });
      
  //     processingQueue = false;
      
  //     // Continue processing queue after a short delay
  //     if (pendingLayers.length > 0) {
  //       const timeoutId = setTimeout(processLayerQueue, 100);
  //       timeoutIds.current.push(timeoutId);
  //     } else {
  //       debugLog('All layers processed successfully');
  //     }
  //   };
    
  //   return {
  //     queueLayer: (layerId, setupFunction, type = 'unknown') => {
  //       if (loadedLayers.has(layerId)) {
  //         debugLog(`Layer ${layerId} already loaded, skipping`);
  //         return;
  //       }
        
  //       pendingLayers.push({ layerId, setupFunction, type });
  //       debugLog(`Queued layer: ${layerId} (${type})`);
        
  //       if (!processingQueue) {
  //         processLayerQueue();
  //       }
  //     },
        
  //     removeLayer: (layerId) => {
  //       if (!map.current || !loadedLayers.has(layerId)) {
  //         return;
  //       }
        
  //       try {
  //         if (map.current.getLayer(layerId)) {
  //           map.current.removeLayer(layerId);
  //         }
          
  //         // If this layer has a source with the same ID, remove it too
  //         if (map.current.getSource(layerId)) {
  //           map.current.removeSource(layerId);
  //         }
          
  //         loadedLayers.delete(layerId);
  //         debugLog(`Removed layer: ${layerId}`);
  //       } catch (error) {
  //         debugError(`Failed to remove layer ${layerId}:`, error);
  //       }
  //     },
        
  //     getLayerStats: () => {
  //       return {
  //         totalLayers: loadedLayers.size,
  //         loadedLayers: Array.from(loadedLayers),
  //         pendingLayers: pendingLayers.map(l => l.layerId),
  //         layerLoadTimes,
  //         layerTypeBreakdown: Object.entries(
  //           Array.from(loadedLayers).reduce((acc, layerId) => {
  //             const type = layerTypes[layerId] || 'unknown';
  //             acc[type] = (acc[type] || 0) + 1;
  //             return acc;
  //           }, {})
  //         )
  //       };
  //     }
  //   };
  // })();
  
  // Add effect to periodically check layer health
  useEffect(() => {
    if (!DEBUG) return;
    
    const checkLayerHealth = () => {
      const stats = LayerManager.getLayerStats();
      debugLog('Layer stats:', stats);
      
      // Check if we have too many layers which could cause memory issues
      if (stats.totalLayers > 50) {
        debugWarn('High number of layers detected:', stats.totalLayers);
      }
      
      // Identify slow-loading layers
      const slowLayers = Object.entries(stats.layerLoadTimes)
        .filter(([_, time]) => time > 500)
        .sort((a, b) => b[1] - a[1]);
        
      if (slowLayers.length > 0) {
        debugWarn('Slow-loading layers detected:', 
          slowLayers.map(([id, time]) => `${id}: ${time.toFixed(2)}ms`));
      }
      
      // Check memory usage in Chrome
      if (window.performance && window.performance.memory) {
        const memoryInfo = window.performance.memory;
        const memoryUsagePercent = 
          (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
          
        if (memoryUsagePercent > 70) {
          debugWarn('High memory usage detected:', 
            `${memoryUsagePercent.toFixed(2)}% of available JS heap`);
        }
      }
    };
    
    const intervalId = setInterval(checkLayerHealth, 10000);
    intervalIds.current.push(intervalId);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);



  useEffect(() => {
    if (map.current) return;

    // Remove duplicate initialization since it's handled in useMapInitialization
    const handleMapLoad = async () => {
      if (!map.current || !map.current.isStyleLoaded()) {
        await new Promise(resolve => map.current?.once('style.load', resolve));
      }
      
      // Expose map instance globally for table navigation
      window.mapInstance = map.current;

      // Add debug logging to inspect available layers
      if (!map.current || !map.current.getStyle) return;
      const style = map.current.getStyle();
      if (!style || !style.layers) return;
      const layers = style.layers;
      const transportationLayers = layers.filter(layer => {
        const layerId = layer.id.toLowerCase();
        return layerId.includes('road') || 
               layerId.includes('transit') || 
               layerId.includes('railway') ||
               layerId.includes('highway') ||
               layerId.includes('bridge') ||
               layerId.includes('tunnel') ||
               layerId.includes('traffic') ||
               layerId.includes('transportation');
      });

      // Style water in the base map layers
      const waterLayers = [
        'water',
        'water-shadow',
        'waterway',
        'water-depth',
        'water-pattern'
      ];

      waterLayers.forEach(layerId => {
        if (!map.current.getLayer(layerId)) return;

        try {
          const layer = map.current.getLayer(layerId);
          if (!layer) return;

          // Handle fill layers
          if (layer.type === 'fill') {
            map.current.setPaintProperty(layerId, 'fill-color', '#001f3d');
            map.current.setPaintProperty(layerId, 'fill-opacity', 0.8);
          }
          
          // Handle line layers
          if (layer.type === 'line') {
            map.current.setPaintProperty(layerId, 'line-color', '#001f3d');
            map.current.setPaintProperty(layerId, 'line-opacity', 0.8);
          }
        } catch (error) {
          console.warn(`Could not style water layer ${layerId}:`, error);
        }
      });

      // Style parks and green areas
      const parkLayers = [
        'landuse',
        'park',
        'park-label',
        'national-park',
        'natural',
        'golf-course',
        'pitch',
        'grass'
      ];

      parkLayers.forEach(layerId => {
        if (!map.current.getLayer(layerId)) return;

        try {
          const layer = map.current.getLayer(layerId);
          if (!layer) return;

          if (layer.type === 'fill') {
            map.current.setPaintProperty(layerId, 'fill-color', '#092407');
            map.current.setPaintProperty(layerId, 'fill-opacity', 0.3);
          }
          if (layer.type === 'symbol' && map.current.getPaintProperty(layerId, 'background-color') !== undefined) {
            map.current.setPaintProperty(layerId, 'background-color', '#092407');
          }
        } catch (error) {
          console.warn(`Could not style park layer ${layerId}:`, error);
        }
      });
    };

    if (map.current) {
      handleMapLoad();
    } else {
      map.current.once('load', handleMapLoad);
    }
  }, [isErcotMode]);

  // Add cleanup effect for AI consensus animation
  useEffect(() => {
    if (!map.current) return;

    return () => {
      // Clean up AI consensus particles layer
      if (map.current.getLayer('ai-consensus-particles')) {
        map.current.removeLayer('ai-consensus-particles');
      }
      if (map.current.getSource('ai-consensus-particles')) {
        map.current.removeSource('ai-consensus-particles');
      }
    };
  }, []);



  const dragStart = (e) => {
    if (e.type === "mousedown") {
      isDraggingRef.current = true;
      initialXRef.current = e.clientX - xOffsetRef.current;
      initialYRef.current = e.clientY - yOffsetRef.current;
    } else if (e.type === "touchstart") {
      isDraggingRef.current = true;
      initialXRef.current = e.touches[0].clientX - xOffsetRef.current;
      initialYRef.current = e.touches[0].clientY - yOffsetRef.current;
    }
  };

  const dragEnd = () => {
    isDraggingRef.current = false;
    initialXRef.current = currentXRef.current;
    initialYRef.current = currentYRef.current;
  };

  const drag = (e) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      
      if (e.type === "mousemove") {
        currentXRef.current = e.clientX - initialXRef.current;
        currentYRef.current = e.clientY - initialYRef.current;
      } else if (e.type === "touchmove") {
        currentXRef.current = e.touches[0].clientX - initialXRef.current;
        currentYRef.current = e.touches[0].clientY - initialYRef.current;
      }

      xOffsetRef.current = currentXRef.current;
      yOffsetRef.current = currentYRef.current;
      
      if (popupRef.current) {
        popupRef.current.style.transform = 
          `translate3d(${currentXRef.current}px, ${currentYRef.current}px, 0)`;
      }
    }
  };

  useEffect(() => {
    if (!map.current) return;

    // Update bounds whenever the map moves
    const updateBounds = () => {
      const bounds = map.current.getBounds();
    };

    map.current.on('moveend', updateBounds);
    // Get initial bounds
    updateBounds();

    return () => {
      if (map.current) {
        map.current.off('moveend', updateBounds);
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;

    // Add touch event handlers
    const handleTouchStart = (e) => {
      if (!e || !e.touches) return;
      
      if (e.touches.length === 2) {
        e.preventDefault(); // Prevent default zoom behavior
      }
    };

    const handleTouchMove = (e) => {
      if (!e || !e.touches) return;
      
      if (e.touches.length === 2) {
        e.preventDefault();
      }
    };

    // Add the event listeners to the canvas container
    const mapCanvas = map.current.getCanvas();
    if (mapCanvas) {
      mapCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      mapCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });

      return () => {
        mapCanvas.removeEventListener('touchstart', handleTouchStart);
        mapCanvas.removeEventListener('touchmove', handleTouchMove);
      };
    }
  }, []);

  // Add the rotate function
  const rotateMap = () => {
    if (!map.current) return;
    
    const newRotation = (currentRotation + 90) % 360;
    
    map.current.easeTo({
      bearing: newRotation,
      duration: 1000
    });
    
    setCurrentRotation(newRotation);
  };
  
  // Add cleanup effect for 3D buildings
  useEffect(() => {
    return () => {
      if (map.current) {
        debugLog('Cleaning up 3D building layers');
        
        // Use LayerManager to safely remove 3D layers
        LayerManager.removeLayer('buildings-3d-layer');
        LayerManager.removeLayer('osm-buildings-3d');
        
        // Remove the source last
        if (map.current.getSource('osm-buildings')) {
          try {
            map.current.removeSource('osm-buildings');
            debugLog('Removed osm-buildings source');
          } catch (error) {
            debugError('Error removing osm-buildings source:', error);
          }
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const allKeys = [
      'fort-stockton', 'ozona', 'sonora', 'rocksprings', 'leakey', 'hondo', 'castroville',
      'junction', 'balmorhea', 'monahans', 'pecos', 'toyah'
    ];

    const removeAll = () => {
      allKeys.forEach(key => {
        // Remove circle layers
        const layerId = `${key}-radius-layer`;
        const sourceId = `${key}-radius`;
        if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
        if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
        
        // Remove label layers
        const labelLayerId = `${key}-label-layer`;
        const labelSourceId = `${key}-label`;
        if (map.current.getLayer(labelLayerId)) map.current.removeLayer(labelLayerId);
        if (map.current.getSource(labelSourceId)) map.current.removeSource(labelSourceId);
      });
    };

    if (!showFortStocktonRadius) {
      removeAll();
      return;
    }

    // Add circles and labels
    const FORT_STOCKTON_COORDS = [-102.879996, 30.894348];
    const radiusMiles = 5;
    const radiusKm = radiusMiles * 1.60934;
    const cityDefs = [
      { key: 'fort-stockton', coords: FORT_STOCKTON_COORDS, color: '#FFD600', name: 'Fort Stockton' },
      { key: 'ozona', coords: OZONA_COORDS, color: '#FFD600', name: 'Ozona' },
      { key: 'sonora', coords: SONORA_COORDS, color: '#FFD600', name: 'Sonora' },
      { key: 'rocksprings', coords: ROCKSPRINGS_COORDS, color: '#FFD600', name: 'Rocksprings' },
      { key: 'leakey', coords: LEAKEY_COORDS, color: '#FFD600', name: 'Leakey' },
      { key: 'hondo', coords: HONDO_COORDS, color: '#FFD600', name: 'Hondo' },
      { key: 'castroville', coords: CASTROVILLE_COORDS, color: '#FFD600', name: 'Castroville' },
      { key: 'junction', coords: JUNCTION_COORDS, color: '#2196F3', name: 'Junction' },
      { key: 'balmorhea', coords: BALMORHEA_COORDS, color: '#FFA500', name: 'Balmorhea' },
      { key: 'monahans', coords: MONAHANS_COORDS, color: '#FFA500', name: 'Monahans' },
      { key: 'pecos', coords: PECOS_COORDS, color: '#FFA500', name: 'Pecos' },
      { key: 'toyah', coords: TOYAH_COORDS, color: '#FFA500', name: 'Toyah' }
    ];
    
    cityDefs.forEach(({ key, coords, color, name }) => {
      // Add circle
      const geojson = turf.circle(coords, radiusKm, { steps: 128, units: 'kilometers', properties: { name: key + ' 5mi Radius' } });
      const sourceId = `${key}-radius`;
      const layerId = `${key}-radius-layer`;
      if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      map.current.addSource(sourceId, { type: 'geojson', data: geojson });
      map.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {},
        paint: {
          'line-color': color,
          'line-width': 3,
          'line-dasharray': [2, 2],
          'line-opacity': 0.9
        }
      });
      
      // Add label
      const labelSourceId = `${key}-label`;
      const labelLayerId = `${key}-label-layer`;
      const labelFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [coords[0], coords[1] + 0.07] // slightly north of center
        },
        properties: { name: name }
      };
      
      if (map.current.getLayer(labelLayerId)) map.current.removeLayer(labelLayerId);
      if (map.current.getSource(labelSourceId)) map.current.removeSource(labelSourceId);
      
      map.current.addSource(labelSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [labelFeature] }
      });
      map.current.addLayer({
        id: labelLayerId,
        type: 'symbol',
        source: labelSourceId,
        layout: {
          'text-field': name,
          'text-font': ['Arial Unicode MS Regular'],
          'text-size': 12,
          'text-anchor': 'bottom',
          'text-offset': [0, -1.0],
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#fff',
          'text-halo-color': '#000',
          'text-halo-width': 8,
          'text-halo-blur': 1
        }
      });
    });

    return removeAll;
  }, [showFortStocktonRadius, map.current]);



  useEffect(() => {
    if (map.current) {
      map.current.on('styledata', () => {
        if (!map.current || !map.current.getStyle) return;
        const style = map.current.getStyle();
        if (!style || !style.layers) return;
        const layers = style.layers;
        const openSpaceLayers = layers.filter(l =>
          /park|green|open|grass|recreation|natural|play|golf|field|garden/i.test(l.id)
        );
      });
    }
  }, [isErcotMode]);

  // Effect to resize map when timeline graph visibility changes
  useEffect(() => {
    if (map.current) {
      // Delay to allow CSS transition to complete
      const timeoutId = setTimeout(() => {
        map.current.resize();
      }, 350);
      return () => clearTimeout(timeoutId);
    }
  }, [showTimelineGraph]);

  // Expose graph state to window for legend positioning
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.showTimelineGraph = showTimelineGraph;
    }
  }, [showTimelineGraph]);

  return (
    <MapContainer>
      <div 
        ref={mapContainer} 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: showTimelineGraph ? '300px' : '0',
          transition: 'bottom 0.3s ease'
        }} 
      />
      <PopupManager map={map} />
      <ErcotManager ref={ercotManagerRef} map={map} isErcotMode={isErcotMode} setIsErcotMode={setIsErcotMode} />
      
      {/* Add SceneManager component */}
      <SceneManager 
        map={map.current}
        layerStates={layerStates}
        // onLoadScene={handleLoadScene} // Removed
        onSaveScene={() => {}}
        isOpen={false}
        onClose={() => {}}
      />
      
      {showPlanningDocsLayer && (
        <PlanningDocsLayer map={map} visible={showPlanningDocsLayer} />
      )}
      
      {showPlanningAnalysis && (
        <PlanningAnalysisLayer
          map={map}
          showAdaptiveReuse={showAdaptiveReuse}
          showDevelopmentPotential={showDevelopmentPotential}
        />
      )}
      
              {/* DenverDowntownCircle component removed */}
      

      <LayerToggle
        ref={layerToggleRef}
        map={map}
        isLayerMenuCollapsed={isLayerMenuCollapsed}
        setIsLayerMenuCollapsed={setIsLayerMenuCollapsed}
        showTransportation={showTransportation}
        setShowTransportation={setShowTransportation}
        showRoads={showRoads}
        setShowRoads={setShowRoads}
        showMainRoads={showMainRoads}
        setShowMainRoads={setShowMainRoads}
        showParks={showParks}
        setShowParks={setShowParks}
        showFortStocktonRadius={showFortStocktonRadius}
        setShowFortStocktonRadius={setShowFortStocktonRadius}
        showKeyInfrastructure={showKeyInfrastructure}
        setShowKeyInfrastructure={setShowKeyInfrastructure}
        showLandcover={showLandcover}
        setShowLandcover={setShowLandcover}
        showAdaptiveReuse={showAdaptiveReuse}
        setShowAdaptiveReuse={setShowAdaptiveReuse}
        showDevelopmentPotential={showDevelopmentPotential}
        setShowDevelopmentPotential={setShowDevelopmentPotential}
        // Denver props removed
        showUPSFacilities={showUPSFacilities}
        setShowUPSFacilities={setShowUPSFacilities}
        showAmazonFulfillment={showAmazonFulfillment}
        setShowAmazonFulfillment={setShowAmazonFulfillment}
        show3DBuildings={show3DBuildings}
        setShow3DBuildings={setShow3DBuildings}
        showCommercialPermits={showCommercialPermits}
        setShowCommercialPermits={setShowCommercialPermits}
        showMajorPermits={showMajorPermits}
        setShowMajorPermits={setShowMajorPermits}
        
        // Startup Intelligence Layer State
        showStartupIntelligence={showStartupIntelligence}
        setShowStartupIntelligence={setShowStartupIntelligence}
        
        // TDLR Layer State
        showTDLR={showTDLR}
        setShowTDLR={setShowTDLR}

        // Power Supply Layer State
        showSupply={showSupply}
        setShowSupply={setShowSupply}

        // Power Demand Layer State
        showDemand={showDemand}
        setShowDemand={setShowDemand}
        
        // Perplexity Analysis Layer State
        showPerplexityAnalysis={showPerplexityAnalysis}
        setShowPerplexityAnalysis={setShowPerplexityAnalysis}
        
        // Irrigation District Layer State
        showIrrigationDistrict={showIrrigationDistrict}
        setShowIrrigationDistrict={setShowIrrigationDistrict}

        // TWDB Groundwater Layer State
        showTWDBGroundwater={showTWDBGroundwater}
        setShowTWDBGroundwater={setShowTWDBGroundwater}

        // Water Layer State
        showWater={showWater}
        setShowWater={setShowWater}
        
        // Well Registry Layer State
        showWellRegistry={showWellRegistry}
        setShowWellRegistry={setShowWellRegistry}
        
        // Casa Grande Boundary Layer State
        showCasaGrandeBoundary={showCasaGrandeBoundary}
        setShowCasaGrandeBoundary={setShowCasaGrandeBoundary}
        
        // Lucid Layer State
        showLucid={showLucid}
        setShowLucid={setShowLucid}
        // R3 Data Layer State
        showR3Data={showR3Data}
        setShowR3Data={setShowR3Data}
        // Grid Capacity Layer State
        showGridHeatmap={showGridHeatmap}
        setShowGridHeatmap={setShowGridHeatmap}
        // Commute Isochrones Layer State
        showCommuteIsochrones={showCommuteIsochrones}
        setShowCommuteIsochrones={setShowCommuteIsochrones}
        // Population Isochrones Layer State
        showPopulationIsochrones={showPopulationIsochrones}
        setShowPopulationIsochrones={setShowPopulationIsochrones}
        // NC Power Infrastructure Layer State
        showNcPower={showNcPower}
        setShowNcPower={setShowNcPower}
        // Duke Transmission Easements Layer State
        showDukeTransmissionEasements={showDukeTransmissionEasements}
        setShowDukeTransmissionEasements={setShowDukeTransmissionEasements}
        showToyotaAccessRoute={showToyotaAccessRoute}
        setShowToyotaAccessRoute={setShowToyotaAccessRoute}
        showOKCNeighborhoods={showOKCNeighborhoods}
        setShowOKCNeighborhoods={setShowOKCNeighborhoods}
        // ERCOT GIS Reports Layer State
        showERCOTGISReports={showERCOTGISReports}
        setShowERCOTGISReports={setShowERCOTGISReports}
        // ERCOT Counties Layer State
        showERCOTCounties={showERCOTCounties}
        setShowERCOTCounties={setShowERCOTCounties}
        // Producer/Consumer Counties Layer State
        showProducerConsumerCounties={showProducerConsumerCounties}
        setShowProducerConsumerCounties={setShowProducerConsumerCounties}
        // Texas Energy Corridors Layer State
        showTexasEnergyCorridors={showTexasEnergyCorridors}
        setShowTexasEnergyCorridors={setShowTexasEnergyCorridors}
        // Texas Data Centers Layer State
        showTexasDataCenters={showTexasDataCenters}
        setShowTexasDataCenters={setShowTexasDataCenters}
        
        // Denver anchor layer props removed
        onTransmissionLayerStateUpdate={handleTransmissionLayerStateUpdate}
      />

      {/* Duke Transmission Easements Legend */}
      <DukeTransmissionEasementsLegend visible={showDukeTransmissionEasements} />

      {/* AI Transmission Navigator */}
      <AITransmissionNav
        map={map}
        layerState={layerStates}
        onLoadScene={handleLoadTransmissionScene}
        isOpen={isAITransmissionNavOpen}
        onClose={() => setIsAITransmissionNavOpen(false)}
        onToggle={() => setIsAITransmissionNavOpen(!isAITransmissionNavOpen)}
      />

        <ToggleButton 
          $active={showRoadParticles}
          onClick={() => setShowRoadParticles(!showRoadParticles)}
          style={{ height: '32px', padding: '0 12px', fontSize: '14px', marginBottom: '8px' }}
        >
          {showRoadParticles ? 'Hide Flow' : 'Show Flow'}
        </ToggleButton>

        {/* Rotation Button */}
        <RotateButton 
          onClick={rotateMap}
          aria-label="Rotate map"
        >
          ↻
        </RotateButton>

        {/* Debug Button for Crash Analytics */}
        <button
          onClick={() => setShowCrashAnalytics(!showCrashAnalytics)}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            background: '#ff4444',
            border: 'none',
            borderRadius: '50%',
            color: 'white',
            width: 25,
            height: 25,
            cursor: 'pointer',
            fontSize: 10,
            zIndex: 1500,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
          }}
          title="Open Crash Analytics Dashboard"
        >
        </button>



        {/* Crash Analytics Dashboard */}
        <CrashAnalyticsDashboard 
          isOpen={showCrashAnalytics}
          onClose={() => setShowCrashAnalytics(false)}
        />

        {/* Timeline Graph Toggle */}
        <TimelineGraphToggle 
          visible={showTimelineGraph}
          onToggle={() => {
            const newValue = !showTimelineGraph;
            setShowTimelineGraph(newValue);
            // Expose state to window for legend positioning
            if (typeof window !== 'undefined') {
              window.showTimelineGraph = newValue;
            }
          }}
        />

        {/* Timeline Graph Panel */}
        <TimelineGraphPanel visible={showTimelineGraph} />

        {/* Card Manager */}
        <CardManager
          map={map}
          activeCards={activeCards}
          onCardClose={(cardId) => setActiveCards(prev => prev.filter(c => c.id !== cardId))}
          onSceneNavigate={(sceneId) => {
            // Trigger scene loading via AI Transmission Nav
            if (window.mapComponent?.transmissionNav?.loadScene) {
              window.mapComponent.transmissionNav.loadScene(sceneId);
            }
          }}
        />

        {/* OSM Legend - disabled, using new LegendContainer in BaseCard instead */}
        {/* <OSMLegend /> */}

        {/* Detail Expanded Modal */}
        <DetailExpandedModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          nodeData={selectedNodeData}
          category={selectedCategory}
          toolData={selectedToolData}
        />

      {/* Infrastructure Siting Path Animation - triggered from energy marker popups */}
      {map?.current && showInfrastructureSitingAnimation && (
        <InfrastructureSitingPathAnimation
          key="infrastructure-siting-animation-popup"
          map={map}
          onCleanup={(detail) => {
            console.log('✅ [Map] Infrastructure Siting animation cleanup:', detail);
          }}
        />
      )}

    </MapContainer>
  );
};

export default MapComponent;
