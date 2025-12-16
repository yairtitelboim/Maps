import React, { useState, useEffect, useRef, useMemo } from 'react';
import OSMCall from './OSMCall';
// TaylorWastewaterCall removed - Texas-specific, not needed for Oklahoma
// import TaylorWastewaterCall from './TaylorWastewaterCall';
import GeoAI from './GeoAI';
import PerplexityCall from './PerplexityCall';
import FirecrawlCall from './FirecrawlCall';
import { getAvailableLocations, getLocationDisplayName, getGeographicConfig } from '../../../../config/geographicConfig.js';
import { getCacheStats } from '../../../../utils/HolisticCacheManager.js';
// TAYLOR_WASTEWATER_SITE_KEYS removed - Texas-specific, not needed for Oklahoma

const LOCATION_THEMES = {
  default: {
    baseBg: 'rgba(16, 185, 129, 0.85)',
    hoverBg: 'rgba(16, 185, 129, 0.35)',
    activeBg: 'rgba(16, 185, 129, 0.25)',
    border: '1px solid rgba(16, 185, 129, 0.35)',
    accent: '#10b981',
    shadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
    hoverShadow: '0 4px 16px rgba(16, 185, 129, 0.45)'
  },
  samsung_taylor_wastewater: {
    baseBg: 'rgba(14, 165, 233, 0.85)',
    hoverBg: 'rgba(14, 165, 233, 0.35)',
    activeBg: 'rgba(14, 165, 233, 0.22)',
    border: '1px solid rgba(14, 165, 233, 0.35)',
    accent: '#0ea5e9',
    shadow: '0 2px 8px rgba(14, 165, 233, 0.35)',
    hoverShadow: '0 4px 16px rgba(14, 165, 233, 0.45)'
  },
  lake_whitney_lakeside: {
    baseBg: 'rgba(59, 130, 246, 0.85)',
    hoverBg: 'rgba(59, 130, 246, 0.35)',
    activeBg: 'rgba(59, 130, 246, 0.25)',
    border: '1px solid rgba(59, 130, 246, 0.35)',
    accent: '#3b82f6',
    shadow: '0 2px 8px rgba(59, 130, 246, 0.35)',
    hoverShadow: '0 4px 16px rgba(59, 130, 246, 0.45)'
  },
  lake_whitney_dam_aoi: {
    baseBg: 'rgba(234, 179, 8, 0.85)',
    hoverBg: 'rgba(234, 179, 8, 0.35)',
    activeBg: 'rgba(234, 179, 8, 0.25)',
    border: '1px solid rgba(234, 179, 8, 0.35)',
    accent: '#f59e0b',
    shadow: '0 2px 8px rgba(234, 179, 8, 0.35)',
    hoverShadow: '0 4px 16px rgba(234, 179, 8, 0.45)'
  },
  lake_whitney_shoreline: {
    baseBg: 'rgba(20, 184, 166, 0.85)',
    hoverBg: 'rgba(20, 184, 166, 0.35)',
    activeBg: 'rgba(20, 184, 166, 0.25)',
    border: '1px solid rgba(20, 184, 166, 0.35)',
    accent: '#14b8a6',
    shadow: '0 2px 8px rgba(20, 184, 166, 0.35)',
    hoverShadow: '0 4px 16px rgba(20, 184, 166, 0.45)'
  },
  toyota_battery_nc: {
    baseBg: 'rgba(14, 165, 233, 0.85)',
    hoverBg: 'rgba(14, 165, 233, 0.35)',
    activeBg: 'rgba(14, 165, 233, 0.25)',
    border: '1px solid rgba(14, 165, 233, 0.35)',
    accent: '#0ea5e9',
    shadow: '0 2px 8px rgba(14, 165, 233, 0.35)',
    hoverShadow: '0 4px 16px rgba(14, 165, 233, 0.45)'
  },
  vinfast_nc: {
    baseBg: 'rgba(249, 115, 22, 0.85)',
    hoverBg: 'rgba(249, 115, 22, 0.35)',
    activeBg: 'rgba(249, 115, 22, 0.25)',
    border: '1px solid rgba(249, 115, 22, 0.35)',
    accent: '#f97316',
    shadow: '0 2px 8px rgba(249, 115, 22, 0.35)',
    hoverShadow: '0 4px 16px rgba(249, 115, 22, 0.45)'
  },
  wolfspeed_nc: {
    baseBg: 'rgba(168, 85, 247, 0.85)',
    hoverBg: 'rgba(168, 85, 247, 0.35)',
    activeBg: 'rgba(168, 85, 247, 0.25)',
    border: '1px solid rgba(168, 85, 247, 0.35)',
    accent: '#a855f7',
    shadow: '0 2px 8px rgba(168, 85, 247, 0.35)',
    hoverShadow: '0 4px 16px rgba(168, 85, 247, 0.45)'
  },
  harris_nc: {
    baseBg: 'rgba(13, 148, 136, 0.85)',
    hoverBg: 'rgba(13, 148, 136, 0.35)',
    activeBg: 'rgba(13, 148, 136, 0.25)',
    border: '1px solid rgba(13, 148, 136, 0.35)',
    accent: '#14b8a6',
    shadow: '0 2px 8px rgba(20, 184, 166, 0.35)',
    hoverShadow: '0 4px 16px rgba(20, 184, 166, 0.45)'
  }
};

const getLocationTheme = (locationKey) => {
  return LOCATION_THEMES[locationKey] || LOCATION_THEMES.default;
};

const NestedCircleButton = ({ 
  aiState, 
  map, 
  onLoadingChange, 
  setIsOSMButtonLoading, 
  setAiState, 
  updateToolFeedback, 
  onToggleCollapsedResponses,
  // Add drag handle props
  isDragging,
  handleMouseDown,
  // Location selector props
  currentLocation = 'default',
  onLocationChange = null,
  // Perplexity mode props
  onPerplexityModeToggle = null,
  isPerplexityMode = false,
  onGeoAIQuery = null,
  geoAiBusy = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCollapsedResponses, setShowCollapsedResponses] = useState(false);
  const [geoAiMounted, setGeoAiMounted] = useState(true);
  const [hoverStates, setHoverStates] = useState({
    clear: false,
    geoai: false,
    osm: false,
    firecrawl: false,
    space: false,
    location: false
  });
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [selectedLocationKey, setSelectedLocationKey] = useState(null);
  const lastResponseRef = useRef('');
  const locationTheme = useMemo(() => getLocationTheme(currentLocation), [currentLocation]);
  
  // Archived: isTaylorWastewaterLocation removed - Taylor, TX was location-specific
  // Function to toggle GeoAI overlays on/off
  const clearAllMapData = async () => {
    // Archived: Texas/NC-specific animation references removed
    // TODO: Add Columbus/AEP Ohio animation references if needed
    const hasLakeShore = Boolean(window.lakeWhitneyShoreAnimationRef);
    const hasWhitney = Boolean(window.whitneyAnimationRef);
    const hasVinFast = Boolean(window.vinFastAnimationRef);
    const hasToyota = Boolean(window.toyotaBatteryAnimationRef);
    const hasWolfspeed = Boolean(window.wolfspeedAnimationRef);

    if (geoAiMounted) {
      console.log('🧹 NestedCircleButton: Hiding GeoAI overlays');
      // Archived: Texas/NC-specific animation cleanup removed
      // TODO: Add Columbus/AEP Ohio animation cleanup if needed
      if (hasLakeShore && window.lakeWhitneyShoreAnimationRef?.handleCleanup) {
        window.lakeWhitneyShoreAnimationRef.handleCleanup();
      }
      if (hasWhitney && window.whitneyAnimationRef?.handleCleanup) {
        window.whitneyAnimationRef.handleCleanup();
      }
      if (hasVinFast && window.vinFastAnimationRef?.handleCleanup) {
        window.vinFastAnimationRef.handleCleanup();
      }
      if (hasToyota && window.toyotaBatteryAnimationRef?.handleCleanup) {
        window.toyotaBatteryAnimationRef.handleCleanup();
      }
      if (hasWolfspeed && window.wolfspeedAnimationRef?.handleCleanup) {
        window.wolfspeedAnimationRef.handleCleanup();
      }
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'geoai',
          status: 'GeoAI overlays hidden',
          progress: 100,
          details: 'Click again to restore shoreline & project change layers'
        });
        setTimeout(() => {
          updateToolFeedback({ isActive: false, tool: null, status: '', progress: 0, details: '' });
        }, 2000);
      }
      setGeoAiMounted(false);
      return;
    }

    console.log('🎛️ NestedCircleButton: Restoring GeoAI overlays');
    let restarted = false;

    // Archived: Texas/NC-specific animation restart removed
    // TODO: Add Columbus/AEP Ohio animation restart if needed
    if (window.lakeWhitneyShoreAnimationRef?.handleRestart) {
      window.lakeWhitneyShoreAnimationRef.handleRestart();
      restarted = true;
    }

    if (window.whitneyAnimationRef?.handleRestart) {
      window.whitneyAnimationRef.handleRestart();
      restarted = true;
    }

    if (window.vinFastAnimationRef?.handleRestart) {
      window.vinFastAnimationRef.handleRestart();
      restarted = true;
    }
    if (window.toyotaBatteryAnimationRef?.handleRestart) {
      window.toyotaBatteryAnimationRef.handleRestart();
      restarted = true;
    }
    if (window.wolfspeedAnimationRef?.handleRestart) {
      window.wolfspeedAnimationRef.handleRestart();
      restarted = true;
    }

    if (!restarted && typeof onGeoAIQuery === 'function') {
      try {
        await onGeoAIQuery();
        setTimeout(() => {
          // Archived: Texas/NC-specific animation restart removed
          if (window.lakeWhitneyShoreAnimationRef?.handleRestart) {
            window.lakeWhitneyShoreAnimationRef.handleRestart();
          } else if (window.whitneyAnimationRef?.handleRestart) {
            window.whitneyAnimationRef.handleRestart();
          } else if (window.vinFastAnimationRef?.handleRestart) {
            window.vinFastAnimationRef.handleRestart();
          } else if (window.wolfspeedAnimationRef?.handleRestart) {
            window.wolfspeedAnimationRef.handleRestart();
          }
        }, 200);
      } catch (error) {
        console.warn('⚠️ NestedCircleButton: Unable to restart GeoAI overlays automatically', error);
      }
    }

    if (updateToolFeedback) {
      updateToolFeedback({
        isActive: true,
        tool: 'geoai',
        status: 'GeoAI overlays restored',
        progress: 100,
        details: 'Lake shoreline, Whitney DFW7, and site animations reloaded'
      });
      setTimeout(() => {
        updateToolFeedback({ isActive: false, tool: null, status: '', progress: 0, details: '' });
      }, 2000);
    }

    setGeoAiMounted(true);
  };

  // Add CSS animations for smooth circle appearance and location selection
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const styles = `
        @keyframes fadeInScale {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes locationSelectPulse {
          0% {
            background: rgba(20, 184, 166, 0.2);
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.4);
          }
          50% {
            background: rgba(20, 184, 166, 0.6);
            transform: scale(1.02);
            box-shadow: 0 0 0 8px rgba(20, 184, 166, 0.2);
          }
          100% {
            background: rgba(20, 184, 166, 0.2);
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(20, 184, 166, 0);
          }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      const styleElement = document.createElement('style');
      styleElement.textContent = styles;
      if (!document.head.querySelector('style[data-fade-in-animations]')) {
        styleElement.setAttribute('data-fade-in-animations', 'true');
        document.head.appendChild(styleElement);
      }
    }
  }, []);

  // Initialize the response ref on first mount
  useEffect(() => {
    if (aiState.response && !lastResponseRef.current) {
      lastResponseRef.current = aiState.response;
    }
  }, [aiState.response]); // Include aiState.response in dependencies
  
  // Auto-close the expanded buttons ONLY when a completely new response comes in
  useEffect(() => {
    // console.log('🔄 Auto-close useEffect triggered:', {
    //   hasResponse: !!aiState.response,
    //   responseChanged: aiState.response !== lastResponseRef.current,
    //   isExpanded,
    //   isLoading: aiState.isLoading,
    //   hasLastResponse: !!lastResponseRef.current
    // });
    
    // Only auto-close if:
    // 1. There's a response
    // 2. It's different from the last one we've seen
    // 3. The buttons are currently expanded
    // 4. We're not in the middle of loading (which could cause false triggers)
    // 5. The response is actually a new one (not just a minor update)
    if (aiState.response && 
        aiState.response !== lastResponseRef.current && 
        isExpanded && 
        !aiState.isLoading &&
        lastResponseRef.current) { // Only auto-close if we have a previous response to compare
      
      // Additional check: only auto-close if this is a genuinely new response
      // Check if the response content is substantially different
      const currentResponse = aiState.response?.content || aiState.response;
      const lastResponse = lastResponseRef.current?.content || lastResponseRef.current;
      
      // Ensure we have valid string responses before proceeding
      if (!currentResponse || !lastResponse) {
        return;
      }
      
      // Only auto-close if the response is completely different (not just minor formatting changes)
      // Make this more conservative - only close on very substantial changes
      if (currentResponse && lastResponse && 
          typeof currentResponse === 'string' && typeof lastResponse === 'string' &&
          currentResponse.substring(0, 200) !== lastResponse.substring(0, 200) &&
          Math.abs(currentResponse.length - lastResponse.length) > 50) {
        
        lastResponseRef.current = aiState.response;
        setIsExpanded(false);
      } else {
        lastResponseRef.current = aiState.response; // Update ref but don't close
      }
    } else if (aiState.response && !lastResponseRef.current) {
      // First time seeing a response - just update the ref, don't auto-close
      lastResponseRef.current = aiState.response;
    }
  }, [aiState.response, aiState.isLoading, isExpanded]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    // Single container div for all buttons - positioned at original height
    <div style={{
      position: 'absolute',
      top: '-25px', // Back to original position
      left: '0',
      right: '0',
      zIndex: 1000,
      pointerEvents: 'none' // Container doesn't block clicks, only children do
    }}>
      {/* Drag Handle - Small White Circle - Fixed relative to card */}
      <div
        style={{
          position: 'absolute',
          top: isExpanded ? '-6px' : '0px', // Raised by 5px when expanded
          left: '99%',
          transform: 'translateX(-50%)',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          cursor: isDragging ? 'grabbing' : 'grab',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.2s ease',
          zIndex: 1001,
          padding: '10px',
          opacity: 0.99,
          pointerEvents: 'auto' // Re-enable pointer events for this element
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.target.style.background = 'rgba(255, 255, 255, 0.9)';
            e.target.style.transform = 'translateX(-50%) scale(1.3)';
            e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.target.style.background = 'rgba(255, 255, 255, 0.8)';
            e.target.style.transform = 'translateX(-50%) scale(1)';
            e.target.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.2)';
          }
        }}
        title={"Drag to move cards"}
      />

      {/* Main Nested Circle Button - moves to left when expanded for easy closing */}
      <div
        onClick={handleToggle}
        style={{
          position: 'absolute',
          top: isExpanded ? '-5px' : '0px', // Raised by 5px when expanded
          left: isExpanded ? 'calc(100% - 265px)' : 'calc(100% - 41px)', // To the left of the last button when expanded, right when collapsed
          width: '10px',
          height: '0px',
          borderRadius: '50%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          zIndex: 1000,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'none',
          padding: '8px',
          pointerEvents: 'auto' // Re-enable pointer events for this element
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
        }}
        title="Click to expand/collapse additional tools"
      >
        {/* Plus icon */}
        <span style={{
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold',
          lineHeight: '1',
          transition: 'all 0.3s ease'
        }}>
          +
        </span>
      </div>

      {/* Yellow Plus Button - Shows/hides older collapsed response cards */}
      {aiState.responses && aiState.responses.length > 1 && (
        <div
          onClick={() => {
            const newState = !showCollapsedResponses;
            setShowCollapsedResponses(newState);
            if (onToggleCollapsedResponses) {
              onToggleCollapsedResponses(newState);
            }
          }}
          style={{
            position: 'absolute',
            top: isExpanded ? '-6px' : '0px',
             // Relative to container now
            left: isExpanded ? 'calc(100% - 295px)' : 'calc(100% - 80px)', // To the left of the main + button when expanded
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'rgba(255, 193, 7, 0.8)', // Yellow background
            border: '1px solid rgba(255, 193, 7, 0.6)',
            cursor: 'pointer',
            zIndex: 1000,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(255, 193, 7, 0.3)',
            padding: '10px',
            animation: showCollapsedResponses ? 'fadeInScale 0.4s ease-out forwards' : 'none',
            pointerEvents: 'auto' // Re-enable pointer events for this element
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.1)';
            e.target.style.background = 'rgba(255, 193, 7, 1)';
            e.target.style.boxShadow = '0 4px 16px rgba(255, 193, 7, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.background = 'rgba(255, 193, 7, 0.8)';
            e.target.style.boxShadow = '0 2px 8px rgba(255, 193, 7, 0.3)';
          }}
          title={showCollapsedResponses ? "Click to hide older responses" : "Click to show older responses"}
        >
          {/* Plus icon */}
          <span style={{
            color: 'white',
            fontSize: '10px',
            fontWeight: 'bold',
            lineHeight: '1',
            transition: 'all 0.3s ease'
          }}>
            +
          </span>
        </div>
      )}
      


      {/* Expanded Buttons - shown when isExpanded is true */}
      {isExpanded && (
        <div style={{
          position: 'absolute',
          top: '-5px',
          left: 'calc(100% - 240px)', // Shift entire group 20px to the left
          display: 'flex',
          gap: '10px', // Reduced spacing between buttons
          alignItems: 'center'
        }}>
          {/* Location Selector Button */}
          <div style={{
            position: 'relative',
            top: '0px',
            left: '0px', // Now relative to the container div
            height: '16px',
            width: '77px',
            padding: '4px 10px',
            borderRadius: '6px',
            background: locationTheme.baseBg,
            border: locationTheme.border,
            borderLeft: `3px solid ${locationTheme.accent}`,
            cursor: 'pointer',
            zIndex: 1000,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: locationTheme.shadow,
            animation: 'fadeInScale 0.4s ease-out forwards',
            animationDelay: '0s',
            pointerEvents: 'auto', // Re-enable pointer events for this element
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          onClick={() => setLocationDropdownOpen(!locationDropdownOpen)}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.05)';
            e.target.style.background = locationTheme.hoverBg;
            e.target.style.boxShadow = locationTheme.hoverShadow;
            setHoverStates(prev => ({ ...prev, location: true }));
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.background = locationTheme.baseBg;
            e.target.style.boxShadow = locationTheme.shadow;
            setHoverStates(prev => ({ ...prev, location: false }));
          }}
          title="Select location"
        >
          {/* Location text */}
          <span style={{
            color: '#ffffff',
            fontSize: '8px',
            fontWeight: '600',
            lineHeight: '1',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.3s ease'
          }}>
            {getLocationDisplayName(currentLocation)}
          </span>
          
          {/* Hover Card - LOCATION */}
          {hoverStates.location && (
            <div style={{
              position: 'absolute',
              top: '-35px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              zIndex: 1002,
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              LOCATION
            </div>
          )}
        </div>


          {/* Clear Map Data Button - Gray Circle - Second position */}
          <div style={{
            position: 'relative',
            top: '0px',
            left: '0px', // Now relative to the container div
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'rgba(107, 114, 128, 0.8)', // Gray color for clear
            border: '1px solid rgba(107, 114, 128, 0.5)',
            cursor: 'pointer',
            zIndex: 1000,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(107, 114, 128, 0.3)',
            padding: '8px',
            animation: 'fadeInScale 0.4s ease-out forwards',
            animationDelay: '0s',
            pointerEvents: 'auto' // Re-enable pointer events for this element
          }}
          onClick={clearAllMapData}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.1)';
            e.target.style.background = 'rgba(107, 114, 128, 1)';
            e.target.style.boxShadow = '0 4px 16px rgba(107, 114, 128, 0.5)';
            setHoverStates(prev => ({ ...prev, clear: true }));
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.background = 'rgba(107, 114, 128, 0.8)';
            e.target.style.boxShadow = '0 2px 8px rgba(107, 114, 128, 0.3)';
            setHoverStates(prev => ({ ...prev, clear: false }));
          }}
          title="Clear all map data"
        >
          {/* Clear icon (X) */}
          <span style={{
            color: 'white',
            fontSize: '10px',
            fontWeight: 'bold',
            lineHeight: '1',
            transition: 'all 0.3s ease'
          }}>
            ×
          </span>
          
          {/* Hover Card - Gray: clear all */}
          {hoverStates.clear && (
            <div style={{
              position: 'absolute',
              top: '-35px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              zIndex: 1002,
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              clear all
            </div>
          )}
        </div>
          
          {/* GeoAI Button - Hot Pink Circle */}
          <div style={{
            position: 'relative',
            top: '0px',
            left: '0px', // Now relative to the container div
            animation: 'fadeInScale 0.4s ease-out forwards',
            animationDelay: '0.05s',
            pointerEvents: 'auto' // Re-enable pointer events for this element
          }}
          onMouseEnter={() => setHoverStates(prev => ({ ...prev, geoai: true }))}
          onMouseLeave={() => setHoverStates(prev => ({ ...prev, geoai: false }))}
          >
            <GeoAI 
              onTriggerGeoAI={onGeoAIQuery}
              title="GeoAI Spatial Intelligence"
              color="rgba(236, 72, 153, 0.8)"
              size="10px"
              position={{ top: '0px', left: '0px' }}
              aiState={aiState}
              map={map}
              onLoadingChange={onLoadingChange}
              disabled={geoAiBusy}
              updateToolFeedback={updateToolFeedback}
            />
            
            {/* Hover Card - Hot Pink: GeoAI */}
            {hoverStates.geoai && (
              <div style={{
                position: 'absolute',
                top: '-35px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0, 0, 0, 0.9)',
                color: 'white',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                zIndex: 1002,
                pointerEvents: 'none',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                GeoAI
              </div>
            )}
          </div>
          
          {/* OSM Button - Green Circle */}
          <div style={{
            position: 'relative',
            top: '0px',
            left: '0px', // Now relative to the container div
            animation: 'fadeInScale 0.4s ease-out forwards',
            animationDelay: '0.1s',
            pointerEvents: 'auto' // Re-enable pointer events for this element
          }}
          onMouseEnter={() => setHoverStates(prev => ({ ...prev, osm: true }))}
          onMouseLeave={() => setHoverStates(prev => ({ ...prev, osm: false }))}
          >
            {/* TaylorWastewaterCall removed - Texas-specific, not needed for Oklahoma */}
              <OSMCall 
                onClick={(response) => {
                  // For Oklahoma locations, OSMCall will handle loading Stillwater/Pryor OSM data
                }}
                title={`${getLocationDisplayName(currentLocation)} Infrastructure Analysis`}
                color="#34D399"
                size="10px"
                position={{ top: '0px', left: '0px' }}
                aiState={aiState}
                map={map}
                onLoadingChange={onLoadingChange}
                disabled={aiState.isLoading}
                updateToolFeedback={updateToolFeedback}
                locationKey={currentLocation}
              />
            
            {/* Hover Card - Green: OSM */}
            {hoverStates.osm && (
              <div style={{
                position: 'absolute',
                top: '-35px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0, 0, 0, 0.9)',
                color: 'white',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                zIndex: 1002,
                pointerEvents: 'none',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                OSM
              </div>
            )}
          </div>
          
          {/* Firecrawl Button - Orange Circle */}
          <div style={{
            position: 'relative',
            top: '0px',
            left: '0px', // Now relative to the container div
            animation: 'fadeInScale 0.4s ease-out forwards',
            animationDelay: '0.15s',
            pointerEvents: 'auto' // Re-enable pointer events for this element
          }}
          onMouseEnter={() => setHoverStates(prev => ({ ...prev, firecrawl: true }))}
          onMouseLeave={() => setHoverStates(prev => ({ ...prev, firecrawl: false }))}
          >
            <FirecrawlCall 
              onClick={(response) => {
                try {
                  const eventBus = typeof window !== 'undefined' ? window.mapEventBus : null;
                  if (eventBus && typeof eventBus.emit === 'function') {
                    // Archived: NC/Taylor-specific layer toggles removed
                    // TODO: Add Columbus/AEP Ohio layer toggles if needed
                    // Previous code toggled:
                    // - toyota-access-route
                    // - greensboro-durham-route
                    // - nc-power
                    // - population-isochrones
                    // - taylor-buildings
                    // - taylor-blocks
                  }
                } catch (err) {
                  console.warn('⚠️ Unable to toggle route layers from Firecrawl button:', err);
                }
              }}
              title="Web Crawling with Firecrawl"
              color="rgba(255, 165, 0, 0.8)"
              size="10px"
              position={{ top: '0px', left: '0px' }}
              aiState={aiState}
              map={map}
              onLoadingChange={onLoadingChange}
              disabled={aiState.isLoading}
              updateToolFeedback={updateToolFeedback}
            />
            
            {/* Hover Card - Orange: Firecrawl */}
            {hoverStates.firecrawl && (
              <div style={{
                position: 'absolute',
                top: '-35px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0, 0, 0, 0.9)',
                color: 'white',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                zIndex: 1002,
                pointerEvents: 'none',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                Firecrawl
              </div>
            )}
          </div>
          
          {/* Perplexity Button - Black Circle */}
          <div style={{
            position: 'relative',
            top: '0px',
            left: '0px', // Now relative to the container div
            animation: 'fadeInScale 0.4s ease-out forwards',
            animationDelay: '0.2s',
            pointerEvents: 'auto' // Re-enable pointer events for this element
          }}
          onMouseEnter={() => setHoverStates(prev => ({ ...prev, space: true }))}
          onMouseLeave={() => setHoverStates(prev => ({ ...prev, space: false }))}
          >
            <PerplexityCall 
              onClick={() => {
                console.log('🔄 NestedCircleButton: Ask Perplexity clicked - BEFORE mode toggle');
                console.log('🔄 NestedCircleButton: Current isPerplexityMode:', isPerplexityMode);
                console.log('🔄 NestedCircleButton: About to call onPerplexityModeToggle');
                console.log('🔄 NestedCircleButton: Click timestamp:', new Date().toISOString());
                
                // Toggle Perplexity mode instead of direct API call
                if (onPerplexityModeToggle) {
                  onPerplexityModeToggle();
                }
                
                console.log('🔄 NestedCircleButton: onPerplexityModeToggle called - AFTER mode toggle');
              }}
              title={isPerplexityMode ? "Exit Perplexity Mode" : "Ask Perplexity AI"}
              color={isPerplexityMode ? "rgba(59, 130, 246, 1)" : "rgba(59, 130, 246, 0.8)"}
              size="10px"
              position={{ top: '0px', left: '0px' }}
              aiState={aiState}
              map={map}
              onLoadingChange={onLoadingChange}
              disabled={aiState.isLoading}
              updateToolFeedback={updateToolFeedback}
            />
            
            {/* Hover Card - Blue: Perplexity */}
            {hoverStates.space && (
              <div style={{
                position: 'absolute',
                top: '-35px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0, 0, 0, 0.9)',
                color: 'white',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                zIndex: 1002,
                pointerEvents: 'none',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {isPerplexityMode ? 'Exit Perplexity' : 'Ask Perplexity'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Location Dropdown Menu */}
      {locationDropdownOpen && (
        <div style={{
          position: 'absolute',
          top: '25px',
          left: 'calc(100% - 200px)',
          background: 'rgba(0, 0, 0, 0.95)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '8px',
          padding: '8px 0px',
          minWidth: '220px',
          boxShadow: '0 8px 32px rgba(16, 185, 129, 0.2), 0 0 0 1px rgba(16, 185, 129, 0.1)',
          backdropFilter: 'blur(20px)',
          zIndex: 1003,
          animation: 'fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'auto',
          overflow: 'hidden'
        }}>
          {/* Header with current selection */}
          <div style={{
            padding: '8px 16px',
            borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
            background: 'rgba(16, 185, 129, 0.1)',
            fontSize: '10px',
            color: '#10b981',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Current: {getLocationDisplayName(currentLocation)}
          </div>
          
          {getAvailableLocations().map((location, index) => {
            const isSelected = location.key === currentLocation;
            const getLocationColor = (key) => {
              if (key === 'default') return { bg: '#10b981', rgba: 'rgba(16, 185, 129, 0.2)' };
              if (key === 'boston') return { bg: '#3b82f6', rgba: 'rgba(59, 130, 246, 0.2)' };
              if (key === 'houston') return { bg: '#ea580c', rgba: 'rgba(234, 88, 12, 0.2)' };
              if (key === 'toyota_battery_nc') return { bg: '#0ea5e9', rgba: 'rgba(14, 165, 233, 0.2)' };
              if (key === 'vinfast_nc') return { bg: '#f97316', rgba: 'rgba(249, 115, 22, 0.2)' };
              if (key === 'wolfspeed_nc') return { bg: '#a855f7', rgba: 'rgba(168, 85, 247, 0.2)' };
              if (key === 'harris_nc') return { bg: '#14b8a6', rgba: 'rgba(20, 184, 166, 0.2)' };
              return { bg: '#10b981', rgba: 'rgba(16, 185, 129, 0.2)' };
            };
            const colors = getLocationColor(location.key);
            
            return (
              <div
                key={location.key}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Trigger selection animation
                  setSelectedLocationKey(location.key);
                  
                  // Change location immediately
                  if (onLocationChange) {
                    onLocationChange(location.key);
                  }
                  
                  // Close menu after animation completes
                  setTimeout(() => {
                    setLocationDropdownOpen(false);
                    setSelectedLocationKey(null);
                  }, 800);
                }}
                style={{
                  padding: '12px 16px',
                  background: isSelected ? colors.rgba : 'transparent',
                  color: isSelected ? colors.bg : '#ffffff',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  borderLeft: isSelected ? `3px solid ${colors.bg}` : '3px solid transparent',
                  animation: selectedLocationKey === location.key ? 'locationSelectPulse 0.8s ease-out' : 'none',
                  transform: selectedLocationKey === location.key ? 'translateX(4px)' : 'translateX(0)',
                  opacity: selectedLocationKey === location.key ? 1 : 0.9
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.target.style.background = colors.rgba.replace('0.2', '0.1');
                    e.target.style.transform = 'translateX(2px)';
                    e.target.style.opacity = '1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.target.style.background = 'transparent';
                    e.target.style.transform = 'translateX(0)';
                    e.target.style.opacity = '0.9';
                  }
                }}
              >
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isSelected ? colors.bg : colors.rgba,
                  transition: 'all 0.3s ease',
                  boxShadow: isSelected ? `0 0 8px ${colors.rgba}` : 'none'
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontWeight: isSelected ? '600' : '500',
                    color: isSelected ? colors.bg : '#ffffff',
                    transition: 'all 0.3s ease'
                  }}>
                    {location.city}, {location.state}
                    {selectedLocationKey === location.key && (
                      <span style={{ 
                        marginLeft: '8px', 
                        fontSize: '10px', 
                        color: colors.bg,
                        fontWeight: 'bold',
                        animation: 'fadeIn 0.3s ease'
                      }}>
                        ✨ SELECTED
                      </span>
                    )}
                  </div>
                  <div style={{ 
                    fontSize: '10px', 
                    opacity: isSelected ? 0.8 : 0.6,
                    marginTop: '2px',
                    color: isSelected ? colors.bg : '#ffffff',
                    transition: 'all 0.3s ease'
                  }}>
                    {location.region} • {location.gridOperator}
                  </div>
                </div>
                {isSelected && (
                  <span style={{ 
                    fontSize: '12px', 
                    color: colors.bg,
                    fontWeight: 'bold',
                    animation: 'fadeIn 0.3s ease'
                  }}>
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Click outside to close location dropdown */}
      {locationDropdownOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9997,
            background: 'transparent'
          }}
          onClick={() => setLocationDropdownOpen(false)}
        />
      )}

    </div>
  );
};

export default NestedCircleButton;
