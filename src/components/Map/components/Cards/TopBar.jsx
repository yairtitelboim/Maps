import React, { useState } from 'react';
import { getLocationDisplayName } from '../../../../config/geographicConfig.js';

const TopBar = ({ 
  selectedAIProvider, 
  aiProviderDropdownOpen, 
  setAiState, 
  responseIndex,
  responseId, // Add responseId prop to show the unique ID
  isOpen = false, // New prop to control positioning
  onCollapseClick = null, // New prop for collapse functionality
  onExpandClick = null, // New prop for expand functionality
  showMarkerDetails = false, // New prop to show POI mode
  currentLocation = 'default' // Add current location prop
}) => {
  // Local state for dropdown menu - prevents interference between cards
  const [localDropdownOpen, setLocalDropdownOpen] = useState(false);
  
  // State for view mode and cache mode toggles
  // const [viewMode] = useState('node'); // 'node' | 'site' - unused
  // const [cacheMode, setCacheMode] = useState('cache'); // 'cache' | 'live' - unused
  const [locationExpanded, setLocationExpanded] = useState(false); // State for location label expansion

  // Handle view mode toggle
  const handleViewModeToggle = () => {
    // SITE mode disabled - only NODE analysis supported
  };

  // Handle cache mode toggle - unused
  // const handleCacheToggle = () => {
  //   const newMode = cacheMode === 'cache' ? 'live' : 'cache';
  //   setCacheMode(newMode);
  //   
  //   // Call the global functions to control Perplexity cache
  //   if (typeof window !== 'undefined') {
  //     if (newMode === 'cache') {
  //       window.enablePerplexityCache?.();
  //     } else {
  //       window.disablePerplexityCache?.();
  //     }
  //   }
  // };

  // When card is open, only show the AI Provider Dropdown
  if (isOpen) {
    return (
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '30px',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        background: 'transparent'
      }}>
        {/* AI Provider Dropdown or POI Label - Always visible */}
        <div 
          data-ai-provider-dropdown
          style={{
            position: 'relative',
            display: 'inline-block'
          }}
        >
          <span 
            style={{
              background: showMarkerDetails ? 'rgba(139, 92, 246, 0.9)' : 'rgba(55, 65, 81, 0.9)', // Purple for POI, gray for AI provider
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '7px',
              padding: '2px 6px',
              borderRadius: '0px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              fontFamily: 'Inter, monospace',
              fontWeight: '400',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              cursor: showMarkerDetails ? 'default' : 'pointer', // No cursor change for POI
              userSelect: 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              width: 'auto',
              minWidth: '60px',
              height: '20px',
              justifyContent: 'center',
              boxSizing: 'border-box'
            }}
            onClick={() => {
              if (!showMarkerDetails) {
                setLocalDropdownOpen(!localDropdownOpen);
              }
            }}
            onMouseEnter={(e) => {
              if (!showMarkerDetails) {
                e.target.style.background = 'rgba(75, 85, 99, 0.9)'; // Slightly lighter on hover
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (!showMarkerDetails) {
                e.target.style.background = 'rgba(55, 65, 81, 0.9)'; // Return to Ask Anything bar background
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }
            }}
            title={showMarkerDetails ? "Point of Interest Details" : "Click to change AI provider"}
          >
            {showMarkerDetails ? 'POI' : (selectedAIProvider || 'claude')}
          </span>
          
          {/* Dropdown Menu - Only show when not in POI mode */}
          {localDropdownOpen && !showMarkerDetails && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: '0px',
              background: 'rgba(55, 65, 81, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              padding: '4px 0px',
              minWidth: '120px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(20px)',
              zIndex: 20,
              animation: 'fadeIn 0.2s ease',
              marginBottom: '4px'
            }}>
              {[
                { id: 'claude', name: 'Claude', color: '#ff6b35' },
                { id: 'openai', name: 'OpenAI', color: '#10a37f' },
                { id: 'perplexity', name: 'Perplexity', color: '#6366f1' }
              ].map((provider) => (
                <div
                  key={provider.id}
                  style={{
                    padding: '6px 12px',
                    fontSize: '7px',
                    color: 'rgba(255, 255, 255, 0.9)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: selectedAIProvider === provider.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    borderLeft: selectedAIProvider === provider.id ? `3px solid ${provider.color}` : '3px solid transparent'
                  }}
                  onClick={() => {
                    setAiState('selectedAIProvider', provider.id);
                    setLocalDropdownOpen(false);
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = selectedAIProvider === provider.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent';
                  }}
                >
                  {provider.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Location Display - Toggleable */}
        <div 
          onClick={() => setLocationExpanded(!locationExpanded)}
          style={{
            background: 'rgba(55, 65, 81, 0.9)',
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '7px',
            padding: '2px 6px',
            borderRadius: '0px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            fontFamily: 'Inter, monospace',
            fontWeight: '400',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            width: locationExpanded ? 'auto' : '20px',
            minWidth: locationExpanded ? '80px' : '20px',
            height: '20px',
            justifyContent: 'center',
            boxSizing: 'border-box',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(75, 85, 99, 0.9)';
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(55, 65, 81, 0.9)';
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          }}
          title={locationExpanded ? `Current location: ${getLocationDisplayName(currentLocation)}` : 'Click to show location'}
        >
          {locationExpanded ? getLocationDisplayName(currentLocation) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="rgba(255, 255, 255, 0.9)"/>
            </svg>
          )}
        </div>

        {/* NODE and CACHE Toggle Buttons */}
        <div style={{
          display: 'flex',
          gap: '6px', // Increased gap to move COLLAPSE button further right
          alignItems: 'center',
          background: 'transparent'
        }}>
          {/* NODE Toggle */}
          <span 
            onClick={handleViewModeToggle}
            style={{
              background: 'rgba(55, 65, 81, 0.9)',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '7px',
              padding: '2px 6px',
              borderRadius: '0px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              fontFamily: 'Inter, monospace',
              fontWeight: '400',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              cursor: 'not-allowed',
              userSelect: 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              width: '40px',
              height: '20px',
              justifyContent: 'center',
              boxSizing: 'border-box'
            }}
            title="Currently in NODE mode"
          >
            NODE
          </span>

          {/* Collapse Button */}
          <span 
            onClick={() => {
              if (onCollapseClick) {
                onCollapseClick(responseIndex);
              }
            }}
            style={{
              background: 'rgba(55, 65, 81, 0.3)', // Much lighter background
              color: 'rgba(255, 255, 255, 0.5)', // Lighter text color
              fontSize: '7px',
              padding: '2px 6px',
              borderRadius: '0px',
              border: '1px solid rgba(255, 255, 255, 0.15)', // Lighter border
              fontFamily: 'Inter, monospace',
              fontWeight: '400',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              width: '50px',
              height: '20px',
              justifyContent: 'center',
              boxSizing: 'border-box'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(55, 65, 81, 0.5)';
              e.target.style.color = 'rgba(255, 255, 255, 0.7)';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(55, 65, 81, 0.3)';
              e.target.style.color = 'rgba(255, 255, 255, 0.5)';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }}
            title="Click to collapse response"
          >
            COLLAPSE
          </span>

        </div>
      </div>
    );
  }

  // When card is collapsed, show only the RESPONSE #X button (clickable)
  return (
    <div style={{
      position: 'absolute',
      top: '10px', // Always at top when collapsed
      left: '12px',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'row', // Stack horizontally to show ID to the right
      alignItems: 'center',
      gap: '8px' // Space between response number and ID
    }}>
      {/* Response Number Tag - Now clickable to expand */}
      <span 
        style={{
          background: 'transparent',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '9px',
          padding: '2px 6px',
          borderRadius: '0px',
          border: 'none',
          fontFamily: 'Inter, monospace',
          fontWeight: '400',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          userSelect: 'none',
          cursor: 'pointer', // Make it clickable
          transition: 'all 0.2s ease', // Add hover effects
          width: '90px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={() => {
          if (onExpandClick) {
            onExpandClick(responseIndex);
          }
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.05)';
          e.target.style.color = 'rgba(255, 255, 255, 0.8)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'transparent';
          e.target.style.color = 'rgba(255, 255, 255, 0.6)';
        }}
        title="Click to expand response"
      >
        RESPONSE #{responseIndex + 1}
      </span>
      
      {/* Response ID Tag - Show the unique ID to the right */}
      {responseId && (
        <span 
          style={{
            background: 'transparent', // Removed the background
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '6px', // Made smaller for more compact display
            padding: '1px 4px',
            borderRadius: '2px',
            border: 'none', // Removed the stroke line
            fontFamily: 'monospace',
            fontWeight: '400',
            letterSpacing: '0.3px',
            userSelect: 'none',
            cursor: 'default',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '120px' // Limit width to prevent overflow
          }}
          title={`Response ID: ${responseId}`}
        >
          {responseId}
        </span>
      )}
    </div>
  );
};

export default TopBar;
