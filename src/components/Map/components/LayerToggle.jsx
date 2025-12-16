import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { LayerIcons } from './icons/LayerIcons';
import { useLayerToggles } from '../hooks/useLayerToggles';
import { NeighborhoodPopup } from './NeighborhoodPopup';
import { COLORS } from '../constants/layerConstants';
import { AUSTIN_COORDS, SAN_ANTONIO_COORDS } from '../constants/highwayConstants';
import {
  LayerToggleContainer,
  LayerHeader,
  Title,
  CollapseButton,
  ExpandButton,
  CategorySection,
  CategoryHeader,
  CategoryIcon,
  CategoryTitle,
  ToggleSwitch,
  SubLayer
} from './styles/LayerToggleStyles';
import SceneManager from './SceneManager';

import InfrastructureLayer from './InfrastructureLayer';
// DenverNeighborhoodsLayer import removed

// Denver strategy layer imports removed

import LandcoverLayer from './LandcoverLayer';
import StartupIntelligenceLayer from './StartupIntelligenceLayer';
import TDLRLayer from './TDLRLayer';
import IrrigationDistrictLayer from './IrrigationDistrictLayer';
import TWDBGroundwaterLayer from './TWDBGroundwaterLayer';
import PowerSupplyLayer from './PowerSupplyLayer';
import PowerDemandLayer from './PowerDemandLayer';
import WaterLayer from './WaterLayer';
// CasaGrandeBoundaryLayer removed - Arizona-specific, not needed for Oklahoma
// import CasaGrandeBoundaryLayer from './CasaGrandeBoundaryLayer';
import LucidLayer from './LucidLayer';
import R3DataLayer from './R3DataLayer';
import GridCapacityLayer from './GridCapacityLayer';
import CommuteIsochronesLayer from './CommuteIsochronesLayer';
import PopulationIsochronesLayer from './PopulationIsochronesLayer';
// Denver anchor layer imports removed
import DukeTransmissionEasementsLayer from './DukeTransmissionEasementsLayer';
import PowerInfrastructureLayer from './PowerInfrastructureLayer';
import OKCNeighborhoodsLayer from './OKCNeighborhoodsLayer';
import OKCCampusesRouteLayer from './OKCCampusesRouteLayer';
// Archived: Oklahoma route layers - removed for Columbus migration
// import StillwaterOGERouteLayer from './StillwaterOGERouteLayer';
// import PryorGRDARouteLayer from './PryorGRDARouteLayer';
import ERCOTGISReportsLayer from './ERCOTGISReportsLayer';
import ERCOTCountiesLayer from './ERCOTCountiesLayer';
import ProducerConsumerCountiesLayer from './ProducerConsumerCountiesLayer';
import TexasEnergyCorridorsLayer from './TexasEnergyCorridorsLayer';
import TexasDataCentersLayer from './TexasDataCentersLayer';




// Array of Mapbox green spaces layers
const parkLayers = [
  'national-park'
];

// More specific filter for natural areas that are actually parks
const naturalParkFilter = [
  'any',
  ['==', ['get', 'class'], 'park'],
  ['==', ['get', 'class'], 'garden'],
  ['==', ['get', 'class'], 'forest'],
  ['==', ['get', 'class'], 'wood']
];

// Array of Mapbox green spaces layers - moved highway constants to separate file

const LayerToggle = forwardRef(({
  map,
  isLayerMenuCollapsed,
  setIsLayerMenuCollapsed,
  showTransportation,
  setShowTransportation,
  showRoads,
  setShowRoads,
  showMainRoads,
  setShowMainRoads,
  showParks = false,
  setShowParks,
  showFortStocktonRadius,
  setShowFortStocktonRadius,
  showAdaptiveReuse,
  setShowAdaptiveReuse,
  showDevelopmentPotential,
  setShowDevelopmentPotential,
  showKeyInfrastructure,
  setShowKeyInfrastructure,
  showLandcover,
  setShowLandcover,
  // Denver-specific state variables removed
  // Startup Intelligence Layer State
  showStartupIntelligence,
  setShowStartupIntelligence,
  // TDLR Layer State
  showTDLR,
  setShowTDLR,
  // Power Supply Layer State
  showSupply,
  setShowSupply,
  // Power Demand Layer State
  showDemand,
  setShowDemand,
  // Perplexity Analysis Layer State
  showPerplexityAnalysis,
  setShowPerplexityAnalysis,
  // Irrigation District Layer State
  showIrrigationDistrict,
  setShowIrrigationDistrict,
  // TWDB Groundwater Layer State
  showTWDBGroundwater,
  setShowTWDBGroundwater,
  // Water Layer State
  showWater,
  setShowWater,
  // Casa Grande Boundary Layer State
  showCasaGrandeBoundary,
  setShowCasaGrandeBoundary,
  // Lucid Layer State
  showLucid,
  setShowLucid,
  // R3 Data Layer State
  showR3Data,
  setShowR3Data,
  // Grid Capacity Layer State
  showGridHeatmap,
  setShowGridHeatmap,
  // Commute Isochrones Layer State
  showCommuteIsochrones,
  setShowCommuteIsochrones,
  // Population Isochrones Layer State
  showPopulationIsochrones,
  setShowPopulationIsochrones,
  // NC Power Infrastructure Layer State
  showNcPower,
  setShowNcPower,
  // Duke Transmission Easements state
  showDukeTransmissionEasements,
  setShowDukeTransmissionEasements,
  // OKC Neighborhoods state
  showOKCNeighborhoods,
  setShowOKCNeighborhoods,
  // ERCOT GIS Reports state
  showERCOTGISReports,
  setShowERCOTGISReports,
  // ERCOT Counties state
  showERCOTCounties,
  setShowERCOTCounties,
  // Producer/Consumer Counties state
  showProducerConsumerCounties,
  setShowProducerConsumerCounties,
  // Texas Energy Corridors state
  showTexasEnergyCorridors,
  setShowTexasEnergyCorridors,
  // Texas Data Centers state
  showTexasDataCenters,
  setShowTexasDataCenters,
  onTransmissionLayerStateUpdate
}, ref) => {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [neighborhoodMarkers, setNeighborhoodMarkers] = useState(null);
  const [isSceneSidebarOpen, setIsSceneSidebarOpen] = useState(false);
  const [showCyrusOneMarker, setShowCyrusOneMarker] = useState(false); // New state for CyrusOne marker
  const markerRef = useRef(null); // Ref to store the marker instance
  const [showOKCCampusesRoute, setShowOKCCampusesRoute] = useState(false); // State for OKC Campuses Route layer
  const [showStillwaterOGERoutes, setShowStillwaterOGERoutes] = useState(true); // State for Stillwater to OG&E routes (visible by default when loaded)
  const [showPryorGRDARoutes, setShowPryorGRDARoutes] = useState(true); // State for Pryor to GRDA routes (visible by default when loaded)
  
  // Debounced state setters to prevent rapid changes
  const debouncedSetCasaGrandeBoundary = useCallback((value) => {
    setShowCasaGrandeBoundary(value);
  }, [setShowCasaGrandeBoundary]);
  
  const debouncedSetLucid = useCallback((value) => {
    setShowLucid(value);
  }, [setShowLucid]);


  // Main-level Road toggles (copies of nested ones for Scene manager tracking)
  // showMainRoads and setShowMainRoads are now props from parent Map component

  // Get layer toggle states from useLayerToggles hook
  const {
    expandedCategories,
    toggleCategory
  } = useLayerToggles(map);

  // Lightweight logging for Texas Energy Corridors mounting/visibility
  useEffect(() => {
    console.log('⚡ [LayerToggle] TexasEnergyCorridors visibility changed:', showTexasEnergyCorridors);
  }, [showTexasEnergyCorridors]);


  // Notify parent component of transmission layer state changes (debounced)
  useEffect(() => {
    if (!onTransmissionLayerStateUpdate) return;
    
    // Debounce state updates to prevent excessive re-renders
    const timeoutId = setTimeout(() => {
      const stateToSend = {
        // Transportation states
        showTransportation,
        // Road states
        showRoads,
        // Infrastructure and other layer states
        showParks,
        showFortStocktonRadius,
        showAdaptiveReuse,
        showDevelopmentPotential,
        showKeyInfrastructure,
        showLandcover,
        // Denver state variables removed
        // Startup Intelligence Layer State
        showStartupIntelligence,
        // TDLR Layer State
        showTDLR,
        // Power Supply Layer State
        showSupply,
        // Power Demand Layer State
        showDemand,
        // Perplexity Analysis Layer State
        showPerplexityAnalysis,
        // Irrigation District Layer State
        showIrrigationDistrict,
        // Water Layer State
        showWater,
        // TWDB Groundwater Layer State
        showTWDBGroundwater,
        // Casa Grande Boundary Layer State
        showCasaGrandeBoundary,
        // Lucid Layer State
        showLucid,
        // R3 Data Layer State
        showR3Data,
        // Grid Capacity Layer State
        showGridHeatmap,
        // Commute Isochrones Layer State
        showCommuteIsochrones,
        // Population Isochrones Layer State
        showPopulationIsochrones,
        // NC Power Infrastructure Layer State
        showNcPower,
        // Duke Transmission Easements Layer State
        showDukeTransmissionEasements,
        // Main-level Road states (for Scene manager tracking)
        showMainRoads,
        // OKC Neighborhoods Layer State
        showOKCNeighborhoods,
        // ERCOT GIS Reports Layer State
        showERCOTGISReports,
        // ERCOT Counties Layer State
        showERCOTCounties,
        // Producer/Consumer Counties Layer State
        showProducerConsumerCounties,
        // Texas Energy Corridors Layer State
        showTexasEnergyCorridors,
        // Texas Data Centers Layer State
        showTexasDataCenters,
      };
      
      onTransmissionLayerStateUpdate(stateToSend);
    }, 100); // 100ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [
    // Transportation dependencies
    showTransportation,
    // Road dependencies
    showRoads,
    // Infrastructure and other layer dependencies
    showParks,
    showFortStocktonRadius,
    showAdaptiveReuse,
    showDevelopmentPotential,
    showKeyInfrastructure,
    showLandcover,
            // Denver dependencies removed
    // Startup Intelligence Layer dependency
    showStartupIntelligence,
    // TDLR Layer dependency
    showTDLR,
    // Power Supply Layer dependency
    showSupply,
    // Power Demand Layer dependency
    showDemand,
    // Irrigation District Layer dependency
    showIrrigationDistrict,
    // Water Layer dependency
    showWater,
    // TWDB Groundwater Layer dependency
    showTWDBGroundwater,
    // Casa Grande Boundary Layer dependency
    showCasaGrandeBoundary,
    // Lucid Layer dependency
    showLucid,
    // R3 Data Layer dependency
    showR3Data,
    // Grid Capacity dependency
    showGridHeatmap,
    // Commute Isochrones dependency
    showCommuteIsochrones,
    // Population Isochrones dependency
    showPopulationIsochrones,
    // NC Power Infrastructure dependency
    showNcPower,
    // Duke Transmission Easements Layer dependency
    showDukeTransmissionEasements,
    // Main-level Road dependencies (for Scene manager tracking)
    showMainRoads,
    // OKC Neighborhoods dependency
    showOKCNeighborhoods,
    // ERCOT GIS Reports dependency
    showERCOTGISReports,
    // ERCOT Counties dependency
    showERCOTCounties,
    // Producer/Consumer Counties dependency
    showProducerConsumerCounties,
    // Texas Energy Corridors dependency
    showTexasEnergyCorridors,
    // Texas Data Centers dependency
    showTexasDataCenters,
    onTransmissionLayerStateUpdate
  ]);


  // Auto-enable OKC Neighborhoods layer 2 seconds after map initialization
  useEffect(() => {
    if (!map?.current) return;
    if (showOKCNeighborhoods) return; // Already enabled, don't run again

    let timeoutId = null;

    const enableOKCNeighborhoods = () => {
      setShowOKCNeighborhoods(true);
    };

    // Check if map is already loaded
    if (map.current.isStyleLoaded()) {
      timeoutId = setTimeout(enableOKCNeighborhoods, 2000);
    } else {
      // Wait for map to load, then set timeout
      const handleStyleLoad = () => {
        timeoutId = setTimeout(enableOKCNeighborhoods, 2000);
        if (map.current) {
          map.current.off('styledata', handleStyleLoad);
        }
      };
      
      map.current.on('styledata', handleStyleLoad);
      
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (map.current) {
          map.current.off('styledata', handleStyleLoad);
        }
      };
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [map, showOKCNeighborhoods]);

  // Always render OKC Campuses Route layer once map is ready (for OK data center sites)
  // The component will load layers asynchronously, and legend will retry if needed
  useEffect(() => {
    if (!map?.current) return;
    
    // Check if map is ready and always enable route layer component
    // This ensures the component mounts and starts loading layers immediately
    if (map.current.isStyleLoaded() && !showOKCCampusesRoute) {
      setShowOKCCampusesRoute(true);
    } else if (!map.current.isStyleLoaded()) {
      const handleStyleLoad = () => {
        setShowOKCCampusesRoute(true);
        if (map.current) {
          map.current.off('styledata', handleStyleLoad);
        }
      };
      map.current.on('styledata', handleStyleLoad);
      return () => {
        if (map.current) {
          map.current.off('styledata', handleStyleLoad);
        }
      };
    }
  }, [map, showOKCCampusesRoute]);

  // Listen for OKC Campuses Route load and toggle events
  useEffect(() => {
    if (!window.mapEventBus) return;

    const handleRouteLoad = () => {
      // Ensure component is enabled when load event is received
      setShowOKCCampusesRoute(true);
    };

    const handleRouteToggle = (isVisible) => {
      // Update visibility state when toggled from legend
      setShowOKCCampusesRoute(isVisible);
    };

    window.mapEventBus.on('okc-campuses-route:load', handleRouteLoad);
    window.mapEventBus.on('okc-campuses-route:toggle', handleRouteToggle);

    return () => {
      if (window.mapEventBus) {
        window.mapEventBus.off('okc-campuses-route:load', handleRouteLoad);
        window.mapEventBus.off('okc-campuses-route:toggle', handleRouteToggle);
      }
    };
  }, []);

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    updateLayerStates: (newStates) => {
      try {
        
        // Update Transportation states
        if (newStates.showTransportation !== undefined) setShowTransportation(newStates.showTransportation);
        // Update Road states
        if (newStates.showRoads !== undefined) setShowRoads(newStates.showRoads);
      // Update Infrastructure and other layer states
      if (newStates.showParks !== undefined) setShowParks(newStates.showParks);
      if (newStates.showFortStocktonRadius !== undefined) setShowFortStocktonRadius(newStates.showFortStocktonRadius);
      if (newStates.showAdaptiveReuse !== undefined) setShowAdaptiveReuse(newStates.showAdaptiveReuse);
      if (newStates.showDevelopmentPotential !== undefined) setShowDevelopmentPotential(newStates.showDevelopmentPotential);
      if (newStates.showLandcover !== undefined) setShowLandcover(newStates.showLandcover);
      if (newStates.showKeyInfrastructure !== undefined) setShowKeyInfrastructure(newStates.showKeyInfrastructure);
      // Denver state updates removed
      // Update Startup Intelligence Layer state
      if (newStates.showStartupIntelligence !== undefined) setShowStartupIntelligence(newStates.showStartupIntelligence);
      // Update TDLR Layer state
      if (newStates.showTDLR !== undefined) setShowTDLR(newStates.showTDLR);
      // Update Power Supply Layer state
      if (newStates.showSupply !== undefined) setShowSupply(newStates.showSupply);
      // Update Power Demand Layer state
      if (newStates.showDemand !== undefined) setShowDemand(newStates.showDemand);
      // Update Irrigation District Layer state
      if (newStates.showIrrigationDistrict !== undefined) setShowIrrigationDistrict(newStates.showIrrigationDistrict);
      // Update Water Layer state
      if (newStates.showWater !== undefined) setShowWater(newStates.showWater);
      // Update TWDB Groundwater Layer state
      if (newStates.showTWDBGroundwater !== undefined) setShowTWDBGroundwater(newStates.showTWDBGroundwater);
      // Update Casa Grande Boundary Layer state
      if (newStates.showCasaGrandeBoundary !== undefined) setShowCasaGrandeBoundary(newStates.showCasaGrandeBoundary);
      // Update Lucid Layer state
      if (newStates.showLucid !== undefined) setShowLucid(newStates.showLucid);
      // Update R3 Data Layer state
      if (newStates.showR3Data !== undefined) setShowR3Data(newStates.showR3Data);
      if (newStates.showCommuteIsochrones !== undefined) setShowCommuteIsochrones(newStates.showCommuteIsochrones);
      if (newStates.showPopulationIsochrones !== undefined) setShowPopulationIsochrones(newStates.showPopulationIsochrones);
      // Update NC Power Infrastructure Layer state
      if (newStates.showNcPower !== undefined) setShowNcPower(newStates.showNcPower);
      // Update Grid Capacity Layer state
      if (newStates.showGridHeatmap !== undefined) setShowGridHeatmap(newStates.showGridHeatmap);
      // Update Duke Transmission Easements Layer state
      if (newStates.showDukeTransmissionEasements !== undefined) setShowDukeTransmissionEasements(newStates.showDukeTransmissionEasements);
      // Update Main-level Road states (for Scene manager loading) with debugging
      if (newStates.showMainRoads !== undefined) {
        setShowMainRoads(newStates.showMainRoads);
      }
      // Update OKC Neighborhoods Layer state
      if (newStates.showOKCNeighborhoods !== undefined) setShowOKCNeighborhoods(newStates.showOKCNeighborhoods);
      // Update ERCOT GIS Reports Layer state
      if (newStates.showERCOTGISReports !== undefined) setShowERCOTGISReports(newStates.showERCOTGISReports);
      // Update ERCOT Counties Layer state
      if (newStates.showERCOTCounties !== undefined) setShowERCOTCounties(newStates.showERCOTCounties);
      // Update Producer/Consumer Counties Layer state
      if (newStates.showProducerConsumerCounties !== undefined) setShowProducerConsumerCounties(newStates.showProducerConsumerCounties);
      // Update Texas Energy Corridors Layer state
      if (newStates.showTexasEnergyCorridors !== undefined) setShowTexasEnergyCorridors(newStates.showTexasEnergyCorridors);
      // Update Texas Data Centers Layer state
      if (newStates.showTexasDataCenters !== undefined) setShowTexasDataCenters(newStates.showTexasDataCenters);
      // Update Perplexity Analysis Layer state
      if (newStates.showPerplexityAnalysis !== undefined) setShowPerplexityAnalysis(newStates.showPerplexityAnalysis);

      
      } catch (error) {
        console.error('🔄 Error restoring layer states:', error);
        // Continue execution to not break the scene loading entirely
      }
    }
      }), [setShowTransportation, setShowLandcover, setShowRoads, setShowParks, setShowFortStocktonRadius, setShowAdaptiveReuse, setShowDevelopmentPotential, setShowKeyInfrastructure, setShowStartupIntelligence, setShowTDLR, setShowSupply, setShowDemand, setShowPerplexityAnalysis, setShowIrrigationDistrict, setShowWater, setShowTWDBGroundwater, setShowCasaGrandeBoundary, setShowLucid, setShowR3Data, setShowGridHeatmap, setShowCommuteIsochrones, setShowPopulationIsochrones, setShowNcPower, setShowDukeTransmissionEasements, setShowMainRoads, setShowOKCNeighborhoods, setShowERCOTGISReports, setShowERCOTCounties, setShowProducerConsumerCounties, setShowTexasDataCenters]);

  // Function to toggle visibility and styling of park layers
  const toggleParkLayers = useCallback((visible) => {
    if (!map.current) return;
    
    // Check if style is loaded
    if (!map.current.isStyleLoaded()) {
      map.current.once('styledata', () => {
        toggleParkLayers(visible);
      });
      return;
    }
    
    parkLayers.forEach(layerId => {
      if (map.current.getLayer(layerId)) {
        try {
          // Set visibility
          map.current.setLayoutProperty(
            layerId,
            'visibility',
            visible ? 'visible' : 'none'
          );
          
          // Set color for fill layers
          const layer = map.current.getLayer(layerId);
          if (layer && layer.type === 'fill') {
            map.current.setPaintProperty(
              layerId, 
              'fill-color', 
              visible ? '#14532d' : '#050f08' // deep dark green when on
            );
            map.current.setPaintProperty(
              layerId, 
              'fill-opacity', 
              visible ? 0.6 : 0.3
            );
          }
          
          // Handle symbol layers with background color
          if (layer && layer.type === 'symbol' && 
              map.current.getPaintProperty(layerId, 'background-color') !== undefined) {
            map.current.setPaintProperty(
              layerId, 
              'background-color', 
              visible ? '#2a9d2a' : '#050f08'
            );
          }
          
        } catch (error) {
          console.warn(`Could not style park layer ${layerId}:`, error);
        }
      } else {
      }
    });
    
    // Apply filter to the 'natural' layer if it exists to only show park-like natural areas
    if (map.current.getLayer('natural')) {
      try {
        if (visible) {
          // Store the original filter if we haven't stored it yet
          if (!map.current._originalNaturalFilter) {
            map.current._originalNaturalFilter = map.current.getFilter('natural') || ['all'];
          }
          
          // Apply our custom filter for natural areas that are parks
          map.current.setFilter('natural', ['all', 
            map.current._originalNaturalFilter,
            naturalParkFilter
          ]);
          
          // Set visibility and style
          map.current.setLayoutProperty('natural', 'visibility', 'visible');
          map.current.setPaintProperty('natural', 'fill-color', '#2a9d2a');
          map.current.setPaintProperty('natural', 'fill-opacity', 0.45);
        } else {
          // Restore original filter and style
          if (map.current._originalNaturalFilter) {
            map.current.setFilter('natural', map.current._originalNaturalFilter);
          }
          map.current.setLayoutProperty('natural', 'visibility', 'none');
          map.current.setPaintProperty('natural', 'fill-color', '#050f08');
          map.current.setPaintProperty('natural', 'fill-opacity', 0.3);
        }
      } catch (error) {
        console.warn('Could not filter natural layer:', error);
      }
    }
  }, [map]);

  // Effect to handle park layers visibility when showParks changes
  useEffect(() => {
    if (!map.current) return;

    // Check if style is loaded before proceeding
    if (!map.current.isStyleLoaded()) {
      const handleStyleLoad = () => {
        toggleParkLayers(showParks);
        if (map.current) {
          map.current.off('styledata', handleStyleLoad);
        }
      };
      map.current.on('styledata', handleStyleLoad);
      return () => {
        if (map.current) {
          map.current.off('styledata', handleStyleLoad);
        }
      };
    }

    // Helper to apply park layer styles
    const applyParkLayerStyles = () => {
      toggleParkLayers(showParks);
    };

    // Use a small timeout to ensure all layers are ready
    const timeoutId = setTimeout(applyParkLayerStyles, 100);

    // Listen for style.load and re-apply park layer toggle
    const onStyleLoad = () => {
      toggleParkLayers(showParks);
    };
    const mapInstance = map.current;
    mapInstance.on('style.load', onStyleLoad);

    return () => {
      clearTimeout(timeoutId);
      mapInstance.off('style.load', onStyleLoad);
    };
  }, [showParks, map, toggleParkLayers]);

  // Hide park layers by default on mount unless showParks is true
  useEffect(() => {
    if (!map.current) return;
    parkLayers.forEach(layerId => {
      if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(
          layerId,
          'visibility',
          showParks ? 'visible' : 'none'
        );
        if (showParks) {
          map.current.setPaintProperty(layerId, 'fill-color', '#14532d');
          map.current.setPaintProperty(layerId, 'fill-opacity', 0.6);
          // Move park layer above Texas Blocks layers
          if (map.current.getLayer('texas-blocks-line-layer')) {
            map.current.moveLayer(layerId, 'texas-blocks-line-layer');
          } else if (map.current.getLayer('texas-blocks-fill-layer')) {
            map.current.moveLayer(layerId, 'texas-blocks-fill-layer');
          }
        }
      }
    });
    // Move the 'road' layer above Texas Blocks layers as well
    if (showParks && map.current.getLayer('road')) {
      if (map.current.getLayer('texas-blocks-line-layer')) {
        map.current.moveLayer('road', 'texas-blocks-line-layer');
      } else if (map.current.getLayer('texas-blocks-fill-layer')) {
        map.current.moveLayer('road', 'texas-blocks-fill-layer');
      }
    }
  }, [map, showParks]);

  // Always move road layer above Texas Blocks, regardless of Parks toggle
  useEffect(() => {
    if (!map.current) return;
    
    // Move the 'road' layer above Texas Blocks layers
    if (map.current.getLayer('road')) {
      if (map.current.getLayer('texas-blocks-line-layer')) {
        map.current.moveLayer('road', 'texas-blocks-line-layer');
      } else if (map.current.getLayer('texas-blocks-fill-layer')) {
        map.current.moveLayer('road', 'texas-blocks-fill-layer');
      }
    }
  }, [map]);

  // Move all road layers above everything else when showRoads is ON
  useEffect(() => {
    if (!map.current || !showRoads) return;
    
    const mapInstance = map.current;
    
    // Check if map is loaded and style is available
    if (!mapInstance.isStyleLoaded()) {
      // Wait for style to load
      const onStyleLoad = () => {
        // Retry the effect once style is loaded
        if (showRoads) {
          moveRoadLayersToTop();
        }
      };
      
      mapInstance.once('styledata', onStyleLoad);
      return () => {
        mapInstance.off('styledata', onStyleLoad);
      };
    }
    
    moveRoadLayersToTop();
    
    function moveRoadLayersToTop() {
      if (!mapInstance) return;
      
      // List of known road layer IDs
      const roadLayerIds = [
        'road-primary',
        'road-secondary', 
        'road-street',
        'road'
      ];
      
      try {
        // Safely get style
        if (!mapInstance.getStyle || typeof mapInstance.getStyle !== 'function') return;
        
        const style = mapInstance.getStyle();
        if (!style || !style.layers) return;
        
        roadLayerIds.forEach(layerId => {
          if (mapInstance.getLayer(layerId)) {
            // Move each road layer to top (no second parameter moves to top)
            mapInstance.moveLayer(layerId);
          }
        });
      } catch (error) {
        console.warn('Error moving road layers:', error);
      }
    }
  }, [map, showRoads]);

  // Blocks layer effect









    // Path B effect removed - focusing on Denver area

  // Path B pulse animations removed - focusing on Denver area

  // Path AA effect removed - focusing on Denver area

  // Main-level Roads effect (copies the nested functionality exactly)
  useEffect(() => {
    if (!map.current) {
      return;
    }
    
    const mapInstance = map.current;
    const ROAD_LAYER_IDS = ['road-primary', 'road-secondary', 'road-street', 'road'];
    const ROAD_COLOR = '#4A90E2'; // Blue
    const DEFAULT_COLOR = '#666666'; // Default gray
    
    // Check if map is loaded and style is available
    if (!mapInstance.isStyleLoaded()) {
      // Wait for style to load
      const onStyleLoad = () => {
        // Retry the effect once style is loaded
        toggleMainRoadLayers();
      };
      
      mapInstance.once('styledata', onStyleLoad);
      return () => {
        mapInstance.off('styledata', onStyleLoad);
      };
    }
    
    toggleMainRoadLayers();
    
    function toggleMainRoadLayers() {
      if (!mapInstance) {
        return;
      }
      
      try {
        // Safely get style
        if (!mapInstance.getStyle || typeof mapInstance.getStyle !== 'function') {
          return;
        }
        
        const style = mapInstance.getStyle();
        if (!style || !style.layers) return;
        
        const layers = style.layers;
        let foundAnyLayer = false;

        ROAD_LAYER_IDS.forEach(baseId => {
          const matchingLayers = layers.filter(l => 
            l.id.toLowerCase().includes(baseId.toLowerCase())
          );
          
          matchingLayers.forEach(layer => {
            try {
              foundAnyLayer = true;
              
              if (layer.type === 'line') {
                mapInstance.setPaintProperty(layer.id, 'line-width', showMainRoads ? 1 : 0.5);
                mapInstance.setPaintProperty(layer.id, 'line-color', showMainRoads ? ROAD_COLOR : DEFAULT_COLOR);
                mapInstance.setPaintProperty(layer.id, 'line-opacity', showMainRoads ? 0.5 : 0.3);
              } else if (layer.type === 'symbol' && layer.id.includes('label')) {
                mapInstance.setPaintProperty(layer.id, 'text-color', showMainRoads ? ROAD_COLOR : '#666666');
                mapInstance.setPaintProperty(layer.id, 'text-halo-width', showMainRoads ? 2 : 1);
                mapInstance.setPaintProperty(layer.id, 'text-opacity', showMainRoads ? 0.5 : 0.3);
              }
            } catch (error) {
              console.warn(`Failed to toggle main road layer ${layer.id}:`, error);
            }
          });
        });

        if (!foundAnyLayer) {
          // Try more generic road layer names
          const genericRoadLayers = layers.filter(l => 
            l.type === 'line' && (
              l.id.toLowerCase().includes('road') || 
              l.id.toLowerCase().includes('highway') ||
              l.id.toLowerCase().includes('street')
            )
          );
          
          genericRoadLayers.forEach(layer => {
            try {
              mapInstance.setPaintProperty(layer.id, 'line-width', showMainRoads ? 1 : 0.5);
              mapInstance.setPaintProperty(layer.id, 'line-color', showMainRoads ? ROAD_COLOR : DEFAULT_COLOR);
              mapInstance.setPaintProperty(layer.id, 'line-opacity', showMainRoads ? 0.5 : 0.3);
            } catch (error) {
              console.warn(`Failed to toggle generic road layer ${layer.id}:`, error);
            }
          });
        }
      } catch (error) {
        console.warn('Error toggling main road layers:', error);
      }
    }
  }, [map, showMainRoads]);

  // Turn on TDLR layer 1s after FIFA OSM analysis completes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let tdlrTimeoutId = null;

    const enableTDLRWithDelay = () => {
      if (showTDLR) return;
      if (tdlrTimeoutId) clearTimeout(tdlrTimeoutId);
      tdlrTimeoutId = setTimeout(() => {
        setShowTDLR(true);
      }, 3000);
    };

    const eventBus = window.mapEventBus;
    if (eventBus && typeof eventBus.on === 'function') {
      // Prefer FIFA analysis completion, also fall back to generic osm:dataLoaded
      eventBus.on('fifa:analysisComplete', enableTDLRWithDelay);
      eventBus.on('osm:dataLoaded', enableTDLRWithDelay);
      
      // Casa Grande boundary toggle event listener
      eventBus.on('casa-grande-boundary:toggle', (enabled) => {
        debouncedSetCasaGrandeBoundary(enabled);
      });
      
      // R3 Data layer toggle event listener
      eventBus.on('r3-data:toggle', (enabled) => {
        setShowR3Data(enabled);
      });

      // NC Power Infrastructure toggle event listener
      eventBus.on('nc-power:toggle', (enabled) => {
        setShowNcPower(!!enabled);
      });

      // Population Isochrones toggle event listener
      eventBus.on('population-isochrones:toggle', (enabled) => {
        setShowPopulationIsochrones(!!enabled);
      });
    }

    return () => {
      if (tdlrTimeoutId) clearTimeout(tdlrTimeoutId);
      if (eventBus && typeof eventBus.off === 'function') {
        eventBus.off('fifa:analysisComplete', enableTDLRWithDelay);
        eventBus.off('osm:dataLoaded', enableTDLRWithDelay);
        eventBus.off('casa-grande-boundary:toggle');
        eventBus.off('r3-data:toggle');
        eventBus.off('nc-power:toggle');
        eventBus.off('population-isochrones:toggle');
      }
    };
  }, [showTDLR, setShowTDLR]);

  // Effect to add CyrusOne data center marker
  useEffect(() => {
    if (!map.current) return;

    const mapInstance = map.current;

    const addCyrusOneMarker = () => {
      // Adding CyrusOne marker
      // Coordinates for CyrusOne DFW7 in Whitney, Bosque County, TX
      // Based on "557 County Rd 3610, Whitney, TX 76692" - the actual DFW7 site
      const cyrusOneCoords = [-97.320, 31.950]; 

      // Create a DOM element for the marker
      const el = document.createElement('div');
      el.className = 'cyrusone-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.backgroundColor = '#FF6B6B';
      el.style.borderRadius = '50%';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';

      // Add a popup to the marker
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML('<h3>CyrusOne DFW7 Data Center</h3><p>📍 Whitney, Bosque County, TX</p><p>🏗️ 557 County Rd 3610</p><p>🏗️ Under Construction</p><p>📊 Data Center Facility</p>');

      // Create the marker and add it to the map
      markerRef.current = new mapboxgl.Marker(el)
        .setLngLat(cyrusOneCoords)
        .setPopup(popup)
        .addTo(mapInstance);
      
      // CyrusOne marker added successfully
    };

    if (showCyrusOneMarker) {
      // Adding CyrusOne marker
      // Use a more reliable approach - try to add marker directly
      try {
        addCyrusOneMarker();
      } catch (error) {
        // Fallback: wait for map to be fully ready
        const checkMapReady = () => {
          if (mapInstance.isStyleLoaded() && mapInstance.getStyle()?.layers?.length > 0) {
            addCyrusOneMarker();
          } else {
            setTimeout(checkMapReady, 100);
          }
        };
        checkMapReady();
      }
    } else {
      // Removing CyrusOne marker
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null; // Clear the ref
      }
    }

    // Cleanup function to remove the marker when the component unmounts or toggle is off
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null; // Clear the ref
      }
    };
  }, [map, showCyrusOneMarker]);

  return (
    <>
      <LayerToggleContainer $isCollapsed={isLayerMenuCollapsed}>
        <LayerHeader>
          <Title>Map Layers</Title>
          <CollapseButton
            onClick={() => setIsLayerMenuCollapsed(!isLayerMenuCollapsed)}
            $isCollapsed={isLayerMenuCollapsed}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L10.83 12l4.58 4.59L14 18l-6-6 6-6 1.41 1.41z"/>
            </svg>
          </CollapseButton>
        </LayerHeader>
        
        {/* Scenes Section */}
        <CategorySection>
          <CategoryHeader 
            onClick={() => setIsSceneSidebarOpen(true)}
            style={{ background: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgba(59, 130, 246, 0.2)' }}
          >
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h-4.5m-9 0H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1.5m9 0h4.5a2 2 0 0 1 2 2v.5M9 7h1m5 0h1M9 11h1m5 0h1M9 15h1m5 0h1M9 19h1m5 0h1" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Saved Scenes</CategoryTitle>
            <div style={{ marginLeft: 'auto' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </CategoryHeader>
        </CategorySection>



        {/* Parks Section */}
        {/* Parks Section */}
        <CategorySection>
          <CategoryHeader onClick={() => setShowKeyInfrastructure(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon><LayerIcons.Business /></CategoryIcon>
            <CategoryTitle>Key Infrastructure</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showKeyInfrastructure}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowKeyInfrastructure(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <InfrastructureLayer
          map={map}
          visible={showKeyInfrastructure}
        />

        {/* Landcover Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            setShowLandcover(v => !v);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Land Cover 2020</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showLandcover}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  setShowLandcover(v => !v);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <LandcoverLayer
          map={map}
          visible={showLandcover}
        />

        {/* OKC Neighborhoods Section */}
        <CategorySection>
          <CategoryHeader onClick={() => setShowOKCNeighborhoods(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>OKC Neighborhoods</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showOKCNeighborhoods}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowOKCNeighborhoods(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        <OKCNeighborhoodsLayer
          map={map}
          visible={showOKCNeighborhoods}
        />

        {/* OKC Campuses Route Layer - always render once loaded, visibility controlled by prop */}
        <OKCCampusesRouteLayer
          map={map}
          visible={showOKCCampusesRoute}
        />

        {/* Archived: Stillwater to OG&E Route Layer - Oklahoma-specific, removed for Columbus migration */}
        {/* <StillwaterOGERouteLayer
          map={map}
          visible={showStillwaterOGERoutes}
        /> */}

        {/* Archived: Pryor to GRDA Route Layer - Oklahoma-specific, removed for Columbus migration */}
        {/* <PryorGRDARouteLayer
          map={map}
          visible={showPryorGRDARoutes}
        /> */}

        {/* Landcover Legend - only show when layer is visible */}
        {showLandcover && (
          <div style={{ 
            padding: '12px 16px', 
            backgroundColor: 'rgba(0, 0, 0, 0.1)', 
            margin: '0 8px 8px 8px',
            borderRadius: '6px',
            fontSize: '12px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#E5E7EB' }}>
              Land Cover Classes:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#8B4513', borderRadius: '2px' }}></div>
                <span style={{ color: '#D1D5DB' }}>Bare soil/rock</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#228B22', borderRadius: '2px' }}></div>
                <span style={{ color: '#D1D5DB' }}>Forest</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#32CD32', borderRadius: '2px' }}></div>
                <span style={{ color: '#D1D5DB' }}>Grassland</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#FFD700', borderRadius: '2px' }}></div>
                <span style={{ color: '#D1D5DB' }}>Cropland</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#87CEEB', borderRadius: '2px' }}></div>
                <span style={{ color: '#D1D5DB' }}>Water/wetland</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#D2B48C', borderRadius: '2px' }}></div>
                <span style={{ color: '#D1D5DB' }}>Shrubland</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#F5F5DC', borderRadius: '2px' }}></div>
                <span style={{ color: '#D1D5DB' }}>Urban</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#FF6347', borderRadius: '2px' }}></div>
                <span style={{ color: '#D1D5DB' }}>Other</span>
              </div>
            </div>
          </div>
        )}

        {/* DenverNeighborhoodsLayer removed */}

        {/* Denver sections removed */}

        {/* Denver strategy sections removed */}

        {/* Denver strategy sections removed */}

        {/* Denver Strategy Layer Components removed */}
        <StartupIntelligenceLayer
          map={map}
          visible={showStartupIntelligence}
        />

        <TDLRLayer
          map={map}
          visible={showTDLR}
        />

        <IrrigationDistrictLayer
          map={map}
          visible={showIrrigationDistrict}
        />

        <WaterLayer
          map={map}
          visible={showWater}
        />

        <PowerSupplyLayer
          map={map}
          visible={showSupply}
        />

        <PowerDemandLayer
          map={map}
          visible={showDemand}
        />

        <TWDBGroundwaterLayer
          map={map}
          visible={showTWDBGroundwater}
        />


        {/* CasaGrandeBoundaryLayer removed - Arizona-specific, not needed for Oklahoma */}
        {/* <CasaGrandeBoundaryLayer
          map={map}
          visible={showCasaGrandeBoundary}
        /> */}

        <LucidLayer
          map={map}
          visible={showLucid}
        />

        <R3DataLayer
          map={map}
          visible={showR3Data}
        />

        <GridCapacityLayer
          map={map}
          visible={!!showGridHeatmap}
        />

        <CommuteIsochronesLayer
          map={map}
          visible={!!showCommuteIsochrones}
        />

        <PopulationIsochronesLayer
          map={map}
          visible={!!showPopulationIsochrones}
        />

        <PowerInfrastructureLayer
          map={map}
          visible={!!showNcPower}
        />

        <DukeTransmissionEasementsLayer
          map={map}
          visible={showDukeTransmissionEasements}
        />

        <ERCOTGISReportsLayer
          map={map}
          visible={showERCOTGISReports}
        />
        <ERCOTCountiesLayer
          map={map}
          visible={showERCOTCounties}
        />

        <TexasEnergyCorridorsLayer
          map={map}
          visible={showTexasEnergyCorridors}
        />

        <ProducerConsumerCountiesLayer
          map={map}
          visible={showProducerConsumerCounties}
        />

        <TexasDataCentersLayer
          map={map}
          visible={showTexasDataCenters}
        />

        {/* Denver anchor layer components removed */}

        {/* Main Roads Section */}
        <CategorySection>
          <CategoryHeader onClick={() => setShowMainRoads(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Roads</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showMainRoads}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowMainRoads(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* CyrusOne Data Center Marker Section */}
        <CategorySection>
          <CategoryHeader>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>CyrusOne DFW7</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showCyrusOneMarker}
                onChange={() => setShowCyrusOneMarker(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* Startup Geographic Intelligence Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('🎯 LayerToggle: Houston Companies toggle clicked');
            setShowStartupIntelligence(v => !v);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Houston Companies</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showStartupIntelligence}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('🎯 LayerToggle: Houston Companies checkbox changed');
                  setShowStartupIntelligence(v => !v);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* TDLR Section */}
        <CategorySection>
          <CategoryHeader onClick={() => setShowTDLR(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h-4.5m-9 0H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1.5m9 0h4.5a2 2 0 0 1 2 2v.5M9 7h1m5 0h1M9 11h1m5 0h1M9 15h1m5 0h1M9 19h1m5 0h1" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>TDLR Construction Projects</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showTDLR}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowTDLR(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* Perplexity Analysis Section */}
        <CategorySection>
          <CategoryHeader onClick={() => setShowPerplexityAnalysis(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Perplexity AI Analysis</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showPerplexityAnalysis}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowPerplexityAnalysis(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* Irrigation District Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('🌊 LayerToggle: Irrigation District toggle clicked! Current state:', showIrrigationDistrict);
            setShowIrrigationDistrict(v => !v);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M3 12h18m-9-9l9 9-9 9" />
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                <path d="M8 12h8" />
                <path d="M12 8v8" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Irrigation Districts</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showIrrigationDistrict}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('🌊 LayerToggle: Irrigation District checkbox changed! Current state:', showIrrigationDistrict);
                  setShowIrrigationDistrict(v => !v);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* Power Supply Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('⚡ LayerToggle: Power Supply toggle clicked. Current state:', showSupply);
            setShowSupply(v => !v);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Power Supply</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showSupply}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('⚡ LayerToggle: Power Supply checkbox changed. New state:', !showSupply);
                  setShowSupply(v => !v);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* Power Demand Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('🏭 LayerToggle: Power Demand toggle clicked. Current state:', showDemand);
            setShowDemand(v => !v);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M4 22h16" />
                <path d="M7 22V7l5-5 5 5v15" />
                <path d="M10 12h4" />
                <path d="M10 16h4" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Power Demand</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showDemand}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('🏭 LayerToggle: Power Demand checkbox changed. New state:', !showDemand);
                  setShowDemand(v => !v);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* Water Layer Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('💦 LayerToggle: Water layer toggle clicked. Current state:', showWater);
            setShowWater(v => !v);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M12 3.5C12 3.5 6 11 6 15a6 6 0 0 0 12 0c0-4-6-11.5-6-11.5z" />
                <path d="M9 15a3 3 0 0 0 6 0" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Water</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showWater}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('💦 LayerToggle: Water checkbox changed. New state:', !showWater);
                  setShowWater(v => !v);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* TWDB Groundwater Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('💧 LayerToggle: TWDB Groundwater header clicked. Toggling layer.', !showTWDBGroundwater);
            setShowTWDBGroundwater(v => !v);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon><LayerIcons.Nature /></CategoryIcon>
            <CategoryTitle>TWDB Groundwater</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showTWDBGroundwater}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('💧 LayerToggle: TWDB Groundwater checkbox changed.', !showTWDBGroundwater);
                  setShowTWDBGroundwater(v => !v);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>


        {/* Casa Grande Boundary Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('🏙️ LayerToggle: Casa Grande Boundary toggle clicked! Current state:', showCasaGrandeBoundary);
            debouncedSetCasaGrandeBoundary(!showCasaGrandeBoundary);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M3 12h18m-9-9l9 9-9 9" />
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Casa Grande Tax Zones</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showCasaGrandeBoundary}
                onClick={e => e.stopPropagation()}
                onChange={() => {}}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* Lucid Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('🚗 LayerToggle: Lucid toggle clicked! Current state:', showLucid);
            debouncedSetLucid(!showLucid);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M19 17h2l.64-2.54A2 2 0 0 0 19.65 12H4.35a2 2 0 0 0-1.99 2.46L3 17h2m0 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0zm12 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0z" />
                <path d="M7 7h10l1-4H6l1 4z" />
                <path d="M12 2v4" />
                <path d="M8 2v4" />
                <path d="M16 2v4" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Lucid Motors</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showLucid}
                onClick={e => e.stopPropagation()}
                onChange={() => {}}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* R3 Data Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('📊 LayerToggle: R3 Data toggle clicked! Current state:', showR3Data);
            setShowR3Data(!showR3Data);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M9 19c-5 0-7-3-7-7s2-7 7-7 7 3 7 7-2 7-7 7z" />
                <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                <path d="M12 1v6m0 6v6" />
                <path d="M21 12h-6m-6 0H3" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>R3 Data Facilities</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showR3Data}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('📊 LayerToggle: R3 Data checkbox changed! Current state:', showR3Data);
                  setShowR3Data(!showR3Data);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* Grid Capacity Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('🌐 LayerToggle: Grid Capacity toggle clicked! Current state:', showGridHeatmap);
            setShowGridHeatmap(!showGridHeatmap);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M3 3h18v18H3z" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
                <path d="M15 21V9" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Grid Heatmap</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showGridHeatmap}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('🌐 LayerToggle: Grid Capacity checkbox changed! Current state:', showGridHeatmap);
                  setShowGridHeatmap(!showGridHeatmap);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* Commute Isochrones Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('🚘 LayerToggle: Commute Isochrones toggle clicked! Current state:', showCommuteIsochrones);
            setShowCommuteIsochrones(!showCommuteIsochrones);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M4 11h16" />
                <path d="M4 7h16" />
                <path d="M4 15h16" />
                <path d="M8 19h8" />
                <path d="M12 3v18" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Commute Isochrones</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showCommuteIsochrones}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('🚘 LayerToggle: Commute Isochrones checkbox changed! Current state:', showCommuteIsochrones);
                  setShowCommuteIsochrones(!showCommuteIsochrones);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* Population Isochrones Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('👥 LayerToggle: Population Isochrones toggle clicked! Current state:', showPopulationIsochrones);
            setShowPopulationIsochrones(!showPopulationIsochrones);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M16 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M8 21v-2a4 4 0 0 1 3-3.87" />
                <circle cx="12" cy="7" r="4" />
                <path d="M5.5 21v-2a4 4 0 0 1 2.5-3.7" />
                <path d="M18.5 21v-2a4 4 0 0 0-2.5-3.7" />
                <circle cx="5.5" cy="11.5" r="2.5" />
                <circle cx="18.5" cy="11.5" r="2.5" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Population</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showPopulationIsochrones}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('👥 LayerToggle: Population Isochrones checkbox changed! Current state:', showPopulationIsochrones);
                  setShowPopulationIsochrones(!showPopulationIsochrones);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* Power Infrastructure Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('⚡ LayerToggle: NC Power Infrastructure toggle clicked! Current state:', showNcPower);
            setShowNcPower(!showNcPower);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M13 2L3 14h6l-1 8 9-12h-6l2-8z" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Power</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showNcPower}
                onClick={e => {
                  e.stopPropagation();
                  console.log('⚡ Power toggle checkbox click detected');
                }}
                onChange={() => {
                  console.log('⚡ LayerToggle: NC Power Infrastructure checkbox changed! Current state:', showNcPower);
                  setShowNcPower(!showNcPower);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* Duke Transmission Easements Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('⚡ LayerToggle: Duke Transmission Easements toggle clicked! Current state:', showDukeTransmissionEasements);
            setShowDukeTransmissionEasements(!showDukeTransmissionEasements);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Duke Transmission Easements</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showDukeTransmissionEasements}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('⚡ LayerToggle: Duke Transmission Easements checkbox changed! Current state:', showDukeTransmissionEasements);
                  setShowDukeTransmissionEasements(!showDukeTransmissionEasements);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* ERCOT GIS Reports Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('⚡ LayerToggle: ERCOT GIS Reports toggle clicked! Current state:', showERCOTGISReports);
            setShowERCOTGISReports(!showERCOTGISReports);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>ERCOT GIS Reports</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showERCOTGISReports}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('⚡ LayerToggle: ERCOT GIS Reports checkbox changed! Current state:', showERCOTGISReports);
                  setShowERCOTGISReports(!showERCOTGISReports);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* ERCOT Counties Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('🗺️ LayerToggle: ERCOT Counties toggle clicked! Current state:', showERCOTCounties);
            setShowERCOTCounties(!showERCOTCounties);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M3 3h18v18H3z" />
                <path d="M3 9h18M9 3v18" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>ERCOT Counties</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showERCOTCounties}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('🗺️ LayerToggle: ERCOT Counties checkbox changed! Current state:', showERCOTCounties);
                  setShowERCOTCounties(!showERCOTCounties);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* Texas Energy Corridors Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('⚡ LayerToggle: Texas Energy Corridors toggle clicked! Current state:', showTexasEnergyCorridors);
            setShowTexasEnergyCorridors(!showTexasEnergyCorridors);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M3 3h18v18H3z" />
                <path d="M3 9h18M9 3v18" />
                <path d="M4 20l4-8 4 4 4-8 4 12" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Texas Energy Corridors</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showTexasEnergyCorridors}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('⚡ LayerToggle: Texas Energy Corridors checkbox changed! Current state:', showTexasEnergyCorridors);
                  setShowTexasEnergyCorridors(!showTexasEnergyCorridors);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* Producer/Consumer Counties Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('🔄 LayerToggle: Producer/Consumer Counties toggle clicked! Current state:', showProducerConsumerCounties);
            setShowProducerConsumerCounties(!showProducerConsumerCounties);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Producer/Consumer Counties</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showProducerConsumerCounties}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('🔄 LayerToggle: Producer/Consumer Counties checkbox changed! Current state:', showProducerConsumerCounties);
                  setShowProducerConsumerCounties(!showProducerConsumerCounties);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {/* Texas Data Centers Section */}
        <CategorySection>
          <CategoryHeader onClick={() => {
            console.log('🏢 LayerToggle: Texas Data Centers toggle clicked! Current state:', showTexasDataCenters);
            setShowTexasDataCenters(!showTexasDataCenters);
          }} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <rect x="2" y="3" width="20" height="18" rx="2" />
                <path d="M8 21h8" />
                <path d="M12 3v18" />
                <path d="M2 9h20" />
                <path d="M2 15h20" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Texas Data Centers</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showTexasDataCenters}
                onClick={e => e.stopPropagation()}
                onChange={() => {
                  console.log('🏢 LayerToggle: Texas Data Centers checkbox changed! Current state:', showTexasDataCenters);
                  setShowTexasDataCenters(!showTexasDataCenters);
                }}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>





      </LayerToggleContainer>

      <ExpandButton
        onClick={() => setIsLayerMenuCollapsed(false)}
        $isCollapsed={isLayerMenuCollapsed}
        title="Expand layer menu"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.41 7.41L10.83 12l4.58 4.59L14 18l-6-6 6-6 1.41 1.41z"/>
        </svg>
      </ExpandButton>

              <SceneManager
          map={map.current}
          layerStates={{
            showRoads,
            showParks,
            showLandcover,
            // Denver state variables removed
            // Startup Intelligence Layer State
            showStartupIntelligence,
            // TDLR Layer State
            showTDLR,
            // Power Supply Layer State
            showSupply,
            // Power Demand Layer State
            showDemand,
            // Irrigation District Layer State
            showIrrigationDistrict,
            // Water Layer State
            showWater,
            // TWDB Groundwater Layer State
            showTWDBGroundwater,
            // Casa Grande Boundary Layer State
            showCasaGrandeBoundary,
            // Lucid Layer State
            showLucid,
            // R3 Data Layer State
            showR3Data,
            // Grid Capacity Layer State
            showGridHeatmap,
            // Commute Isochrones Layer State
            showCommuteIsochrones,
            // Population Isochrones Layer State
            showPopulationIsochrones,
            // NC Power Infrastructure Layer State
            showNcPower,
            // Duke Transmission Easements Layer State
            showDukeTransmissionEasements,
            // OKC Neighborhoods Layer State
            showOKCNeighborhoods,
            // ERCOT GIS Reports Layer State
            showERCOTGISReports,
            // ERCOT Counties Layer State
            showERCOTCounties,
            // Producer/Consumer Counties Layer State
            showProducerConsumerCounties,
            // Texas Data Centers Layer State
            showTexasDataCenters,
            // Denver anchor layer states removed
          }}
        onLoadScene={(sceneLayerStates) => {
          // Handle loading scene layer states
          if (sceneLayerStates.showRoads !== undefined) setShowRoads(sceneLayerStates.showRoads);
          if (sceneLayerStates.showParks !== undefined) setShowParks(sceneLayerStates.showParks);
          if (sceneLayerStates.showLandcover !== undefined) setShowLandcover(sceneLayerStates.showLandcover);
          // Denver scene loading logic removed
          // Startup Intelligence Layer State
          if (sceneLayerStates.showStartupIntelligence !== undefined) setShowStartupIntelligence(sceneLayerStates.showStartupIntelligence);
          // TDLR Layer State
          if (sceneLayerStates.showTDLR !== undefined) setShowTDLR(sceneLayerStates.showTDLR);
          // Power Supply Layer State
          if (sceneLayerStates.showSupply !== undefined) setShowSupply(sceneLayerStates.showSupply);
          // Power Demand Layer State
          if (sceneLayerStates.showDemand !== undefined) setShowDemand(sceneLayerStates.showDemand);
          // Irrigation District Layer State
          if (sceneLayerStates.showIrrigationDistrict !== undefined) setShowIrrigationDistrict(sceneLayerStates.showIrrigationDistrict);
          // Water Layer State
          if (sceneLayerStates.showWater !== undefined) setShowWater(sceneLayerStates.showWater);
          // TWDB Groundwater Layer State
          if (sceneLayerStates.showTWDBGroundwater !== undefined) setShowTWDBGroundwater(sceneLayerStates.showTWDBGroundwater);
          // Casa Grande Boundary Layer State
          if (sceneLayerStates.showCasaGrandeBoundary !== undefined) setShowCasaGrandeBoundary(sceneLayerStates.showCasaGrandeBoundary);
          // Lucid Layer State
          if (sceneLayerStates.showLucid !== undefined) setShowLucid(sceneLayerStates.showLucid);
          // R3 Data Layer State
          if (sceneLayerStates.showR3Data !== undefined) setShowR3Data(sceneLayerStates.showR3Data);
          // Grid Capacity Layer State
          if (sceneLayerStates.showGridHeatmap !== undefined) setShowGridHeatmap(sceneLayerStates.showGridHeatmap);
          // Commute Isochrones Layer State
          if (sceneLayerStates.showCommuteIsochrones !== undefined) setShowCommuteIsochrones(sceneLayerStates.showCommuteIsochrones);
          // Population Isochrones Layer State
          if (sceneLayerStates.showPopulationIsochrones !== undefined) setShowPopulationIsochrones(sceneLayerStates.showPopulationIsochrones);
          // NC Power Infrastructure Layer State
          if (sceneLayerStates.showNcPower !== undefined) setShowNcPower(sceneLayerStates.showNcPower);
          // Duke Transmission Easements Layer State
          if (sceneLayerStates.showDukeTransmissionEasements !== undefined) setShowDukeTransmissionEasements(sceneLayerStates.showDukeTransmissionEasements);
          // OKC Neighborhoods Layer State
          if (sceneLayerStates.showOKCNeighborhoods !== undefined) setShowOKCNeighborhoods(sceneLayerStates.showOKCNeighborhoods);
          // ERCOT GIS Reports Layer State
          if (sceneLayerStates.showERCOTGISReports !== undefined) setShowERCOTGISReports(sceneLayerStates.showERCOTGISReports);
          // ERCOT Counties Layer State
          if (sceneLayerStates.showERCOTCounties !== undefined) setShowERCOTCounties(sceneLayerStates.showERCOTCounties);
          // Producer/Consumer Counties Layer State
          if (sceneLayerStates.showProducerConsumerCounties !== undefined) setShowProducerConsumerCounties(sceneLayerStates.showProducerConsumerCounties);
          // Texas Data Centers Layer State
          if (sceneLayerStates.showTexasDataCenters !== undefined) setShowTexasDataCenters(sceneLayerStates.showTexasDataCenters);
          
          // Denver anchor layer scene loading removed
        }}
        isOpen={isSceneSidebarOpen}
        onClose={() => setIsSceneSidebarOpen(false)}
      />

      {/* Only show the popup if AIChatPanel integration failed */}
      {selectedNeighborhood && neighborhoodMarkers && (
        <NeighborhoodPopup
          selectedNeighborhood={selectedNeighborhood}
          neighborhoodMarkers={neighborhoodMarkers}
          onClose={() => {
            setSelectedNeighborhood(null);
            setNeighborhoodMarkers(null);
          }}
        />
      )}
    </>
  );
});

export default LayerToggle; 
