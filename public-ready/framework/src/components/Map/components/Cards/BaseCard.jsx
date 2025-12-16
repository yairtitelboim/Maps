/**
 * BaseCard Component - Framework Version
 * 
 * This is a cleaned version for the framework, with location-specific code removed.
 * Demonstrates the card system architecture pattern.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import AIQuestionsSection from './AIQuestionsSection';
import SidePanel from './SidePanel';
import NestedCircleButton from './NestedCircleButton';
import LegendContainer from './LegendContainer';
import MarkerPopupManager from './MarkerPopupManager';
// Location-specific animations removed for framework
// import SamsungTaylorChangeAnimation from '../SamsungTaylorChangeAnimation';
// import RockdaleChangeAnimation from '../RockdaleChangeAnimation';

import { useAIQuery } from '../../../../hooks/useAIQuery';
import { getGeographicConfig } from '../../../../config/geographicConfig.js';
// Location-specific imports removed - use generic site config pattern
import { resetGlobalMarkerStyling, updateGlobalToolExecutorLocation, setGlobalToolExecutor, getGlobalToolExecutor } from '../../../../utils/PowerGridToolExecutor';
import { clearResponseCache, getResponseCacheStats } from '../../../../utils/ResponseCache';
import { publishSiteTimelineData } from '../../../../utils/siteTimelineData';
import { 
  createClickableTruncation
} from './textUtils';
import NodeAnimation from '../../../../utils/nodeAnimation';

// Add CSS animations for card effects
const cardStyles = `
  @keyframes cardSlideIn {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  @keyframes cardPulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.02);
    }
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  @keyframes shimmer {
    0% {
      left: -100%;
    }
    100% {
      left: 100%;
    }
  }

  @keyframes questionCardShimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  
  @keyframes buttonSlideIn {
    0% {
      opacity: 0;
      transform: translateY(20px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes fadeIn {
    0% {
      opacity: 0;
      transform: translateY(-5px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes cacheCountdownPulse {
    0% { opacity: 0.3; }
    50% { opacity: 1; }
    100% { opacity: 0.3; }
  }
  
  @keyframes buttonShimmer {
    0% {
      transform: translateX(-100%);
      opacity: 0;
    }
    20% {
      opacity: 0.3;
    }
    80% {
      opacity: 0.3;
    }
    100% {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
  
  @keyframes skeletonPulse {
    0%, 100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }
  
  @keyframes skeletonShimmer {
    0% {
      left: -100%;
    }
    100% {
      left: 100%;
    }
  }
  
  @keyframes slideInFromRight {
    0% {
      opacity: 0;
      transform: translateX(20px);
    }
    100% {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  /* Custom scrollbar styling */
  .sources-scroll::-webkit-scrollbar {
    width: 6px;
  }
  
  .sources-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .sources-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
  
  .sources-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

// Inject styles into document head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = cardStyles;
  if (!document.head.querySelector('style[data-card-animations]')) {
    styleElement.setAttribute('data-card-animations', 'true');
    document.head.appendChild(styleElement);
  }
}

// Generic site configuration pattern (framework example)
// In production, implement your own site lookup logic
const getAnySiteConfigByKey = (siteKey) => {
  if (!siteKey) {
    return null;
  }
  
  // Framework pattern: Generic site config lookup
  // Replace this with your own site configuration system
  const genericConfig = getGeographicConfig(siteKey);
  if (genericConfig) {
    return {
      key: siteKey,
      name: genericConfig.region || genericConfig.city,
      shortName: genericConfig.city,
      description: genericConfig.businessContext || 'Generic site description',
      dataPath: null, // Set to your data path if needed
      coordinates: genericConfig.coordinates,
      radiusMeters: genericConfig.searchRadius || 8000
    };
  }
  
  return null;
};

const BaseCard = ({
  id,
  title,
  content,
  style,
  position,
  onClose,
  onNavigate,
  children,
  draggable = true,
  pinnable = true,
  closable = true,
  map
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const perplexityContainerRef = useRef(null);
  const siteAnimationDataRef = useRef({});
  const [, forceSiteAnimationUpdate] = useState(0);
  
  // UI state variables (non-AI related)
  const [currentQuestions, setCurrentQuestions] = useState('initial');
  const [selectedCard, setSelectedCard] = useState(null);
  const [showFollowupButtons, setShowFollowupButtons] = useState(false);
  const [showFollowupContent, setShowFollowupContent] = useState(false);
  const [hasShownFollowup, setHasShownFollowup] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [responseExpanded, setResponseExpanded] = useState(false);
  const [selectedAIProvider, setSelectedAIProvider] = useState('claude');
  const [aiProviderDropdownOpen, setAiProviderDropdownOpen] = useState(false);
  
  // Location state
  const [currentLocation, setCurrentLocation] = useState('default');
  const [availableAnimations, setAvailableAnimations] = useState([]);
  const [activeSiteAnimations, setActiveSiteAnimations] = useState([]);
  
  // Generic site animation options (framework pattern)
  // Replace with your own site-specific animations
  const siteAnimationOptions = useMemo(() => ([
    {
      key: 'example_site',
      label: 'Example Site Animation',
      description: 'Generic site animation example for framework demonstration'
    }
  ]), []);
  
  const animationEnabledSites = useMemo(() => new Set([]), []); // Empty for framework
  const animationSequence = useMemo(() => [], []); // Empty for framework
  const timelineEnabledSites = useMemo(() => new Set([]), []); // Empty for framework

  useEffect(() => {
    setAvailableAnimations(siteAnimationOptions);
  }, [siteAnimationOptions]);
  
  // Location change handler
  const handleLocationChange = (newLocationKey) => {
    console.log('🔄 BaseCard: Location changing to', newLocationKey);
    setCurrentLocation(newLocationKey);
    setAvailableAnimations(siteAnimationOptions);
    setActiveSiteAnimations([]);
    // Update the global tool executor location for location-aware analysis
    updateGlobalToolExecutorLocation(newLocationKey);
  };

  // Ensure global tool executor is available for location changes
  useEffect(() => {
    if (map?.current && !getGlobalToolExecutor()) {
      // Create a global tool executor instance for location management
      const { createPowerGridToolExecutor } = require('../../../../utils/PowerGridToolExecutor');
      const toolExecutor = createPowerGridToolExecutor(map, () => {}, null);
      setGlobalToolExecutor(toolExecutor);
    }
  }, [map]);
  
  const [collapsedResponses, setCollapsedResponses] = useState(new Set());
  const [showCollapsedResponses, setShowCollapsedResponses] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Tool feedback state
  const [toolFeedback, setToolFeedback] = useState({
    isActive: false,
    tool: null,
    status: '',
    progress: 0,
    details: '',
    timestamp: null
  });

  // Marker details state
  const [selectedMarker, setSelectedMarker] = useState(null);

  // Legend state
  const [showLegend, setShowLegend] = useState(false);

  // View mode state for dual analysis
  const [viewMode, setViewMode] = useState('node');
  
  // Perplexity mode state
  const [isPerplexityMode, setIsPerplexityMode] = useState(false);
  
  // Animation system state
  const [nodeAnimation, setNodeAnimation] = useState(null);

  // Function to update tool feedback from nested circle tools
  const updateToolFeedback = useCallback((feedback) => {
    setToolFeedback({
      ...feedback,
      timestamp: Date.now()
    });
  }, []);

  // Function to handle marker clicks - memoized to prevent unnecessary re-renders
  const handleMarkerClick = useCallback((markerData) => {
    setSelectedMarker(markerData);
    setViewMode('node');
    setSelectedAIProvider('perplexity');
    
    // Emit marker selection event for legend highlighting
    if (window.mapEventBus) {
      window.mapEventBus.emit('marker:selected', markerData);
    }
    
    // Emit marker clicked event for popup display
    if (window.mapEventBus) {
      window.mapEventBus.emit('marker:clicked', markerData);
    }
    
    // Trigger animation when marker is clicked
    if (window.nodeAnimation && markerData.coordinates) {
      const animationType = markerData.category === 'power plants' ? 'pulse' :
                           markerData.category === 'electric utilities' ? 'ripple' :
                           markerData.category === 'water facilities' ? 'glow' :
                           markerData.category === 'data centers' ? 'heartbeat' : 'pulse';
      
      window.nodeAnimation.triggerNodeAnimation(markerData.coordinates, {
        type: animationType,
        intensity: 0.8,
        duration: 3.0,
        nodeData: markerData,
        category: markerData.category
      });
    }
  }, []);

  // Function to return to Claude response
  const handleBackToAnalysis = () => {
    setSelectedMarker(null);
    setViewMode('site');
    setSelectedAIProvider('claude');
    resetGlobalMarkerStyling();
    
    if (window.mapEventBus) {
      window.mapEventBus.emit('marker:deselected');
    }
  };

  // Function to toggle legend
  const toggleLegend = useCallback(() => {
    setShowLegend(prev => !prev);
  }, []);

  // Function to handle view mode changes
  const handleViewModeChange = (newViewMode) => {
    setViewMode(newViewMode);
    
    if (newViewMode === 'node') {
      setSelectedAIProvider('perplexity');
    } else {
      setSelectedAIProvider('claude');
    }
    
    if (newViewMode === 'node' && !selectedMarker) {
      setViewMode('site');
      setSelectedAIProvider('claude');
      return;
    }
  };

  // Function to handle Perplexity mode toggle
  const handlePerplexityModeToggle = useCallback(() => {
    setIsPerplexityMode(prev => !prev);
    
    if (!isPerplexityMode) {
      setSelectedMarker(null);
      setViewMode('site');
      setSelectedAIProvider('perplexity');
    }
  }, [isPerplexityMode]);

  // Use AI Query hook for all AI-related functionality
  const {
    isLoading,
    responses,
    citations,
    pendingRequests,
    handleAIQuery
  } = useAIQuery(map, updateToolFeedback, handleMarkerClick, currentLocation);

  const ensureSiteAnimationData = useCallback(async (siteKey) => {
    if (!siteKey) return null;
    if (siteAnimationDataRef.current[siteKey]) {
      return siteAnimationDataRef.current[siteKey].featureCollection || null;
    }

    const siteConfig = getAnySiteConfigByKey(siteKey);
    if (!siteConfig?.dataPath) {
      return null;
    }

    try {
      const response = await fetch(siteConfig.dataPath, { cache: 'default' });
      if (!response.ok) {
        throw new Error(`Failed to load ${siteConfig.dataPath} (${response.status})`);
      }

      const dataset = await response.json();
      const featureCollection = Array.isArray(dataset?.features)
        ? { type: 'FeatureCollection', features: dataset.features }
        : null;

      siteAnimationDataRef.current[siteKey] = {
        dataset,
        featureCollection
      };

      forceSiteAnimationUpdate(value => value + 1);
      return featureCollection;
    } catch (error) {
      console.warn(`⚠️ Site animation dataset unavailable for ${siteKey}:`, error);
      return null;
    }
  }, [forceSiteAnimationUpdate]);

  const startSiteAnimation = useCallback(async (siteKey, { suppressFeedback = false, suppressLocationChange = false } = {}) => {
    if (!siteKey) return;

    const site = getAnySiteConfigByKey(siteKey);
    if (!site) return;

    await ensureSiteAnimationData(siteKey);
    if (timelineEnabledSites.has(siteKey)) {
      publishSiteTimelineData(siteKey);
    }

    if (!suppressLocationChange && currentLocation !== siteKey) {
      setCurrentLocation(siteKey);
    }

    if (animationEnabledSites.has(siteKey)) {
      if (suppressLocationChange) {
        setActiveSiteAnimations(prev => (prev.includes(siteKey) ? prev : [...prev, siteKey]));
      } else {
        setActiveSiteAnimations([siteKey]);
      }
    }

    // Framework pattern: Generic animation controller
    // Replace with your own animation controllers
    if (window[`${siteKey}AnimationRef`]?.handleRestart) {
      window[`${siteKey}AnimationRef`].handleRestart();
    }

    if (!suppressFeedback) {
      updateToolFeedback({
        isActive: true,
        tool: 'geoai',
        status: `${site.shortName || site.name} briefing ready`,
        progress: 100,
        details: 'Overlay activated. Click the map marker to view the briefing card.'
      });

      setTimeout(() => {
        updateToolFeedback({
          isActive: false,
          tool: null,
          status: '',
          progress: 0,
          details: ''
        });
      }, 2500);
    }
  }, [animationEnabledSites, currentLocation, ensureSiteAnimationData, timelineEnabledSites, updateToolFeedback]);

  const handleAnimationSelect = useCallback(async (animation) => {
    if (!animation?.key) return;

    setAvailableAnimations(siteAnimationOptions);

    if (animation.key === 'run_all_sites') {
      setActiveSiteAnimations([]);
      await Promise.all(
        animationSequence.map(siteKey =>
          startSiteAnimation(siteKey, { suppressFeedback: true, suppressLocationChange: true })
        )
      );

      updateToolFeedback({
        isActive: true,
        tool: 'geoai',
        status: 'Site overlays active',
        progress: 100,
        details: 'All site overlays are running in parallel.'
      });

      setTimeout(() => {
        updateToolFeedback({
          isActive: false,
          tool: null,
          status: '',
          progress: 0,
          details: ''
        });
      }, 2500);
      return;
    }

    await startSiteAnimation(animation.key);
  }, [animationSequence, siteAnimationOptions, startSiteAnimation, updateToolFeedback]);

  useEffect(() => {
    if (!activeSiteAnimations.length) {
      return;
    }

    activeSiteAnimations.forEach((siteKey) => {
      if (!siteAnimationDataRef.current[siteKey]) {
        ensureSiteAnimationData(siteKey);
      }
    });
  }, [activeSiteAnimations, ensureSiteAnimationData]);

  const handleGeoAIQuery = useCallback(() => {
    setAvailableAnimations(siteAnimationOptions);
    setActiveSiteAnimations([]);

    updateToolFeedback({
      isActive: true,
      tool: 'geoai',
      status: 'Site overlays ready',
      progress: 100,
      details: 'Select a site below to load its change overlays.'
    });
  }, [siteAnimationOptions, updateToolFeedback]);
  
  const toggleCollapsedResponses = (show) => {
    setShowCollapsedResponses(show);
  };

  const handleClearResponseCache = useCallback(() => {
    clearResponseCache();
  }, []);

  // Create a memoized aiState object
  const aiState = useMemo(() => ({
    isLoading,
    response: responses.length > 0 ? responses[responses.length - 1] : null,
    responses,
    citations,
    currentQuestions,
    selectedCard,
    showFollowupButtons,
    showFollowupContent,
    hasShownFollowup,
    sourcesExpanded,
    responseExpanded,
    selectedAIProvider,
    aiProviderDropdownOpen,
    collapsedResponses,
    showCollapsedResponses,
    pendingRequests,
    selectedMarker
  }), [
    isLoading, responses, citations, currentQuestions, selectedCard,
    showFollowupButtons, showFollowupContent, hasShownFollowup,
    sourcesExpanded, responseExpanded, selectedAIProvider, aiProviderDropdownOpen, 
    collapsedResponses, showCollapsedResponses, pendingRequests, selectedMarker
  ]);
  
  const setAiStateProperty = useCallback((property, value) => {
    switch (property) {
      case 'currentQuestions':
        setCurrentQuestions(value);
        break;
      case 'selectedCard':
        setSelectedCard(value);
        break;
      case 'showFollowupButtons':
        setShowFollowupButtons(value);
        break;
      case 'showFollowupContent':
        setShowFollowupContent(value);
        break;
      case 'hasShownFollowup':
        setHasShownFollowup(value);
        break;
      case 'sourcesExpanded':
        setSourcesExpanded(value);
        break;
      case 'responseExpanded':
        setResponseExpanded(value);
        break;
      case 'selectedAIProvider':
        setSelectedAIProvider(value);
        break;
      case 'aiProviderDropdownOpen':
        setAiProviderDropdownOpen(value);
        break;
      case 'collapsedResponses':
        setCollapsedResponses(value);
        break;
      default:
        console.warn(`Unknown AI state property: ${property}`);
    }
  }, []);
  
  const [cacheCountdown, setCacheCountdown] = useState(10);
  const [isOSMButtonLoading, setIsOSMButtonLoading] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentQuestions('initial');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const [hasShimmered, setHasShimmered] = useState(false);
  
  useEffect(() => {
    if (currentQuestions === 'initial' && !hasShimmered) {
      const timer = setTimeout(() => {
        setHasShimmered(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentQuestions, hasShimmered]);

  // Handle drag functionality
  const handleMouseDown = (e) => {
    if (!draggable) return;
    
    const currentRef = isPerplexityMode ? perplexityContainerRef.current : cardRef.current;
    if (!currentRef) return;
    
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    
    const rect = currentRef.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !draggable) return;

    const currentRef = isPerplexityMode ? perplexityContainerRef.current : cardRef.current;
    if (!currentRef) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    currentRef.style.left = `${newX}px`;
    currentRef.style.top = `${newY}px`;
  }, [isDragging, draggable, dragOffset.x, dragOffset.y, isPerplexityMode]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none';
      return () => {
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging]);

  const [cacheStats, setCacheStats] = useState({ totalEntries: 0 });
  
  useEffect(() => {
    const updateCacheStats = () => {
      const stats = getResponseCacheStats();
      setCacheStats(stats);
    };
    
    updateCacheStats();
    const interval = setInterval(updateCacheStats, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    if (cacheStats.totalEntries > 8) {
      setCacheCountdown(10);
      
      const countdownTimer = setInterval(() => {
        setCacheCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownTimer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      const clearTimer = setTimeout(() => {
        handleClearResponseCache();
        setCacheCountdown(10);
      }, 10000);
      
      return () => {
        clearTimeout(clearTimer);
        clearInterval(countdownTimer);
      };
    }
  }, [cacheStats.totalEntries, handleClearResponseCache]);

  const toggleFollowupContent = () => {
    setShowFollowupContent(prev => !prev);
    setShowFollowupButtons(prev => !prev);
  };
  
  const toggleResponseCollapse = (responseIndex) => {
    setCollapsedResponses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(responseIndex)) {
        newSet.delete(responseIndex);
      } else {
        newSet.add(responseIndex);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (responses.length > 1) {
      const previousResponseIndices = Array.from({ length: responses.length - 1 }, (_, i) => i);
      
      setCollapsedResponses(prev => {
        const newSet = new Set(prev);
        previousResponseIndices.forEach(index => {
          newSet.add(index);
        });
        return newSet;
      });
    }
  }, [responses.length]);

  const [responseReadyAnimation, setResponseReadyAnimation] = useState(false);
  
  useEffect(() => {
    if (responses.length > 0 && !isLoading && isInitialLoad) {
      setResponseReadyAnimation(true);
      setIsInitialLoad(false);
      
      setTimeout(() => {
        setResponseReadyAnimation(false);
      }, 3000);
    }
  }, [responses.length, isLoading, isInitialLoad]);
  
  useEffect(() => {
    if (map && updateToolFeedback) {
      const animation = new NodeAnimation(map, updateToolFeedback);
      setNodeAnimation(animation);
      window.nodeAnimation = animation;
      
      return () => {
        if (animation) {
          animation.stopAnimations();
          window.nodeAnimation = null;
        }
      };
    }
  }, [map, updateToolFeedback]);

  const handlePerplexityMode = useCallback(() => {
    // Generic Perplexity query for framework
    const perplexityQuery = {
      id: 'perplexity_analysis',
      query: 'Analyze regional development with comprehensive innovation potential assessment',
      isPerplexityMode: true,
      isCustom: false
    };
    
    handleAIQuery(perplexityQuery);
  }, [handleAIQuery]);

  useEffect(() => {
    if (!window.mapEventBus) return;

    const handlePerplexityAnalysisComplete = (data) => {
      window.lastPerplexityAnalysisData = {
        geoJsonFeatures: data.geoJsonFeatures || [],
        analysis: data.analysis || '',
        citations: data.citations || [],
        summary: data.summary || {},
        insights: data.insights || {},
        legendItems: data.legendItems || [],
        timestamp: data.timestamp || Date.now()
      };
    };

    window.mapEventBus.on('perplexity:analysisComplete', handlePerplexityAnalysisComplete);

    return () => {
      window.mapEventBus.off('perplexity:analysisComplete', handlePerplexityAnalysisComplete);
    };
  }, []);

  // If in Perplexity mode, render only the AskAnythingInput without BaseCard wrapper
  if (isPerplexityMode) {
    return (
      <>
        <div 
          ref={perplexityContainerRef}
          data-perplexity-container="true"
          style={{
            position: 'fixed',
            left: position.lng || 0,
            top: position.lat || 0,
            zIndex: 1000,
            userSelect: 'none',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
          }}
        >
          <NestedCircleButton 
            aiState={aiState}
            map={map}
            onLoadingChange={setIsOSMButtonLoading}
            setIsOSMButtonLoading={setIsOSMButtonLoading}
            setAiState={setAiStateProperty}
            updateToolFeedback={updateToolFeedback}
            onToggleCollapsedResponses={toggleCollapsedResponses}
            isDragging={isDragging}
            handleMouseDown={handleMouseDown}
            currentLocation={currentLocation}
            onLocationChange={handleLocationChange}
            onPerplexityModeToggle={handlePerplexityModeToggle}
            isPerplexityMode={isPerplexityMode}
            onGeoAIQuery={handleGeoAIQuery}
          />
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '320px',
            borderRadius: '12px',
            transition: 'all 0.3s ease'
          }}>
            <AIQuestionsSection 
              aiState={aiState}
              hasShimmered={hasShimmered}
              handleAIQuery={handleAIQuery}
              createClickableTruncation={createClickableTruncation}
              setAiState={setAiStateProperty}
              map={map}
              isOSMButtonLoading={isOSMButtonLoading}
              toggleFollowupContent={toggleFollowupContent}
              toolFeedback={toolFeedback}
              toggleResponseCollapse={toggleResponseCollapse}
              handleMarkerClick={handleMarkerClick}
              handleBackToAnalysis={handleBackToAnalysis}
              viewMode={viewMode}
              currentLocation={currentLocation}
              onViewModeChange={handleViewModeChange}
              selectedMarker={selectedMarker}
              nodeAnimation={nodeAnimation}
              responseReadyAnimation={responseReadyAnimation}
              isPerplexityMode={isPerplexityMode}
              onPerplexityModeToggle={handlePerplexityModeToggle}
              siteAnimationsActive={activeSiteAnimations.length > 0}
              availableAnimations={availableAnimations}
              onAnimationSelect={handleAnimationSelect}
            />
          </div>
          
          <LegendContainer 
            key="legend-container"
            aiState={aiState}
            isVisible={showLegend}
            onToggle={toggleLegend}
            map={map}
            handleMarkerClick={handleMarkerClick}
            currentLocation={currentLocation}
          />
        </div>

        <MarkerPopupManager map={map} />
      </>
    );
  }

  // Normal BaseCard rendering when not in Perplexity mode
  return (
    <>
      <div 
        ref={cardRef}
        className="base-card"
        style={{
          position: 'fixed',
          left: position.lng || 0,
          top: position.lat || 0,
          zIndex: 1000,
          userSelect: 'none',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
        }}
      >
        <NestedCircleButton 
          aiState={aiState}
          map={map}
          onLoadingChange={setIsOSMButtonLoading}
          setIsOSMButtonLoading={setIsOSMButtonLoading}
          setAiState={setAiStateProperty}
          updateToolFeedback={updateToolFeedback}
          onToggleCollapsedResponses={toggleCollapsedResponses}
          isDragging={isDragging}
          handleMouseDown={handleMouseDown}
          currentLocation={currentLocation}
          onLocationChange={handleLocationChange}
          onPerplexityModeToggle={handlePerplexityModeToggle}
          isPerplexityMode={isPerplexityMode}
          onGeoAIQuery={handleGeoAIQuery}
        />
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '320px',
          borderRadius: '12px',
          transition: 'all 0.3s ease'
        }}>
          <AIQuestionsSection 
            aiState={aiState}
            hasShimmered={hasShimmered}
            handleAIQuery={handleAIQuery}
            createClickableTruncation={createClickableTruncation}
            setAiState={setAiStateProperty}
            map={map}
            isOSMButtonLoading={isOSMButtonLoading}
            toggleFollowupContent={toggleFollowupContent}
            toolFeedback={toolFeedback}
            toggleResponseCollapse={toggleResponseCollapse}
            handleMarkerClick={handleMarkerClick}
            handleBackToAnalysis={handleBackToAnalysis}
            viewMode={viewMode}
            currentLocation={currentLocation}
            onViewModeChange={handleViewModeChange}
            selectedMarker={selectedMarker}
            nodeAnimation={nodeAnimation}
            responseReadyAnimation={responseReadyAnimation}
            isPerplexityMode={isPerplexityMode}
            onPerplexityModeToggle={handlePerplexityModeToggle}
            siteAnimationsActive={activeSiteAnimations.length > 0}
            availableAnimations={availableAnimations}
            onAnimationSelect={handleAnimationSelect}
          />
          
          <SidePanel aiState={aiState} />

          {cacheStats.totalEntries > 0 && (
            <div style={{
              marginTop: sourcesExpanded ? '20px' : '22px',
              marginBottom: '-16px',
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.5)',
              textAlign: 'center'
            }}>
              <span>{cacheStats.totalEntries} cached responses</span>
              <span style={{ 
                marginLeft: '8px', 
                color: cacheCountdown > 1 ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 193, 7, 0.7)',
                fontWeight: cacheCountdown <= 1 ? '600' : '400',
                transition: 'all 0.3s ease',
                animation: cacheCountdown <= 1 ? 'cacheCountdownPulse 1s ease-in-out infinite' : 'none'
              }}>
                {cacheCountdown > 0 ? `(auto-clear in ${cacheCountdown}s)` : '(clearing now...)'}
              </span>
              <button
                onClick={handleClearResponseCache}
                style={{
                  background: 'none',
                  border: 'none',
                  color: cacheCountdown <= 1 ? 'rgba(255, 193, 7, 0.8)' : 'rgba(255, 255, 255, 0.4)',
                  fontSize: '10px',
                  cursor: 'pointer',
                  marginLeft: '8px',
                  textDecoration: 'underline',
                  fontWeight: cacheCountdown <= 1 ? '600' : '400',
                  transition: 'all 0.3s ease'
                }}
                title="Clear all cached responses now"
              >
                Clear now
              </button>
            </div>
          )}
        </div>

        <LegendContainer 
          key="legend-container"
          aiState={aiState}
          isVisible={showLegend}
          onToggle={toggleLegend}
          map={map}
          handleMarkerClick={handleMarkerClick}
          currentLocation={currentLocation}
        />
      </div>

      <MarkerPopupManager map={map} />
      
      {/* Framework pattern: Add your own animation components here */}
      {/* Location-specific animations removed for framework */}
    </>
  );
};

export default BaseCard;

