import React, { useState, useEffect } from 'react';

// GRDA legend items
const grdaLegendItems = [
  { label: 'Hydro', color: '#06b6d4' },
  { label: 'Wind', color: '#10b981' },
  { label: 'Gas', color: '#f97316' },
];

// OG&E legend items
const ogeLegendItems = [
  { label: 'Gas', color: '#f97316' },
  { label: 'Coal', color: '#fbbf24' },
  { label: 'Wind', color: '#10b981' },
  { label: 'Solar', color: '#f59e0b' },
];

// Infrastructure/Campus legend items
const infrastructureLegendItems = [
  { label: 'Infrastructure Sites', color: '#ef4444', type: 'campus' },
];

// Legend styling for bottom right positioning (above "Show Graph" button)
// The "Show Graph" button (ToggleContainer) is at:
//   - bottom: 20px (when graph hidden) or 320px (when visible)
//   - right: 4px
//   - z-index: 2001
// Button has padding: 10px 16px, so height is ~45px
// Position legend above button with 20px spacing
const legendStyle = {
  position: 'fixed',
  right: 4, // Match the button's right position exactly
  left: 'auto',
  top: 'auto',
  zIndex: 2002, // Above the graph toggle button (which is z-index 2001)
  background: '#181A1B',
  color: '#fff',
  borderRadius: 8,
  padding: '12px 18px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
  fontSize: 14,
  minWidth: 180,
  maxWidth: 260,
  opacity: 0.97,
  transition: 'bottom 0.3s ease' // Match button's transition timing
};

const legendItemStyle = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: 6
};

const colorDotStyle = (color) => ({
  width: 16,
  height: 16,
  borderRadius: 8,
  background: color,
  marginRight: 10,
  border: '2px solid #222'
});

const GRDAPowerLegend = ({ visible, map }) => {
  const [graphVisible, setGraphVisible] = useState(false);
  const [grdaMarkersVisible, setGrdaMarkersVisible] = useState(false);
  const [ogeMarkersVisible, setOgeMarkersVisible] = useState(false);
  const [infrastructureMarkersVisible, setInfrastructureMarkersVisible] = useState(false);
  const [grdaExpanded, setGrdaExpanded] = useState(true); // Default to expanded
  const [ogeExpanded, setOgeExpanded] = useState(true); // Default to expanded
  const [infrastructureExpanded, setInfrastructureExpanded] = useState(true); // Default to expanded
  
  // Track visibility state for each category (GRDA off by default)
  const [categoryVisibility, setCategoryVisibility] = useState({
    grdaHydro: false,
    grdaWind: false,
    grdaGas: false,
    ogeGas: true,
    ogeCoal: true,
    ogeWind: true,
    ogeSolar: true,
    infrastructureSites: true,
  });

  // Listen for graph visibility changes via event bus or window state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check initial state
    if (window.showTimelineGraph !== undefined) {
      setGraphVisible(window.showTimelineGraph);
    }

    // Listen for state changes (if exposed via event bus or window)
    const checkGraphState = () => {
      if (window.showTimelineGraph !== undefined) {
        setGraphVisible(window.showTimelineGraph);
      }
    };

    // Poll for changes (since we don't have direct access to the state)
    const interval = setInterval(checkGraphState, 100);

    return () => clearInterval(interval);
  }, []);

  // Check for visible markers (GRDA, OG&E, and Infrastructure)
  useEffect(() => {
    const checkMarkers = () => {
      const hasGRDA = window.okGRDAPowerMarkers && window.okGRDAPowerMarkers.length > 0;
      const hasOGE = window.okOGEPowerMarkers && window.okOGEPowerMarkers.length > 0;
      const hasInfrastructure = window.okCampusTeardropMarkers && window.okCampusTeardropMarkers.length > 0;
      setGrdaMarkersVisible(hasGRDA);
      setOgeMarkersVisible(hasOGE);
      setInfrastructureMarkersVisible(hasInfrastructure);
      
      // Hide GRDA markers by default when first detected
      if (hasGRDA && window.okGRDAPowerMarkers) {
        window.okGRDAPowerMarkers.forEach(marker => {
          const markerElement = marker.getElement();
          if (markerElement) {
            const markerFuelType = markerElement.getAttribute('data-fuel-type');
            const markerUtility = markerElement.getAttribute('data-utility');
            // Only hide if not already initialized (check for data-original-opacity)
            if (markerFuelType && markerUtility === 'grda' && !markerElement.getAttribute('data-visibility-initialized')) {
              const currentOpacity = markerElement.style.opacity || 
                                     window.getComputedStyle(markerElement).opacity || 
                                     '1';
              markerElement.setAttribute('data-original-opacity', currentOpacity);
              markerElement.setAttribute('data-visibility-initialized', 'true');
              markerElement.style.setProperty('opacity', '0', 'important');
              markerElement.style.setProperty('visibility', 'hidden', 'important');
              markerElement.style.setProperty('pointer-events', 'none', 'important');
            }
          }
        });
        
        // Also hide GRDA pulse layers by default
        if (map?.current) {
          ['gas', 'hydro', 'wind'].forEach(fuelType => {
            const pulseLayerPrefix = `${fuelType}-power-pulse-layer-`;
            let index = 0;
            
            while (true) {
              const layerId = `${pulseLayerPrefix}${index}`;
              
              if (map.current.getLayer(layerId)) {
                map.current.setLayoutProperty(layerId, 'visibility', 'none');
                index++;
              } else {
                break;
              }
            }
          });
        }
      }
    };

    // Check immediately
    checkMarkers();

    // Poll for marker changes
    const interval = setInterval(checkMarkers, 200);

    return () => clearInterval(interval);
  }, []);

  // Helper function to toggle markers by fuel type and utility, or infrastructure sites
  const toggleMarkers = (utility, fuelType, isVisible) => {
    let markerArray;
    if (utility === 'grda') {
      markerArray = window.okGRDAPowerMarkers;
    } else if (utility === 'oge') {
      markerArray = window.okOGEPowerMarkers;
    } else if (utility === 'infrastructure') {
      markerArray = window.okCampusTeardropMarkers;
    }
    
    if (!markerArray) {
      console.warn(`No ${utility} markers found`);
      return;
    }
    
    console.log(`Toggling ${utility} ${fuelType} markers: ${isVisible ? 'show' : 'hide'}, found ${markerArray.length} markers`);

    // Color mapping for fuel types and infrastructure (must match colors used in marker creation)
    const fuelColors = {
      hydro: '#06b6d4',
      wind: '#10b981',
      gas: '#f97316',
      coal: '#fbbf24',
      solar: '#f59e0b',
      'infrastructure sites': '#ef4444',
      sites: '#ef4444',
    };

    const targetColor = fuelColors[fuelType.toLowerCase()];
    if (!targetColor && utility !== 'infrastructure') return;

    markerArray.forEach(marker => {
      const markerElement = marker.getElement();
      if (!markerElement) {
        console.warn('Marker element not found');
        return;
      }

      // First check data attributes (most reliable)
      const markerFuelType = markerElement.getAttribute('data-fuel-type');
      const markerUtility = markerElement.getAttribute('data-utility');
      const markerType = markerElement.getAttribute('data-marker-type');
      
      let matchesColor = false;
      
      // Check data attributes first (most reliable method)
      if (utility === 'infrastructure') {
        // For infrastructure markers, check data-marker-type
        if (markerType === 'campus') {
          matchesColor = true;
          console.log(`✓ Matched infrastructure marker by data attribute: ${markerType}`);
        }
      } else if (markerFuelType && markerFuelType.toLowerCase() === fuelType.toLowerCase() &&
          markerUtility && markerUtility.toLowerCase() === utility.toLowerCase()) {
        matchesColor = true;
        console.log(`✓ Matched marker by data attributes: ${markerFuelType} ${markerUtility}`);
      } else {
        // Fallback: Check marker color by looking at SVG elements
        const svg = markerElement.querySelector('svg');
        if (svg) {
          const allElements = svg.querySelectorAll('*');
          
          allElements.forEach(el => {
            const fill = el.getAttribute('fill');
            const stroke = el.getAttribute('stroke');
            // Also check computed style as fallback
            const computedFill = window.getComputedStyle(el).fill;
            const computedStroke = window.getComputedStyle(el).stroke;
            
            if (fill === targetColor || stroke === targetColor || 
                computedFill === targetColor || computedStroke === targetColor ||
                fill?.toLowerCase() === targetColor.toLowerCase() ||
                stroke?.toLowerCase() === targetColor.toLowerCase()) {
              matchesColor = true;
              console.log(`✓ Matched marker by color: ${fill || stroke}`);
            }
          });
        } else {
          // For infrastructure, also check if it's a red marker without SVG
          if (utility === 'infrastructure' && targetColor === '#ef4444') {
            // Check if marker has red color in any way
            const computedColor = window.getComputedStyle(markerElement).color;
            if (computedColor.includes('rgb(239, 68, 68)') || computedColor.includes('#ef4444')) {
              matchesColor = true;
            }
          } else {
            console.warn('No SVG found in marker element, skipping color match');
          }
        }
      }

      if (matchesColor) {
        if (isVisible) {
          // Restore original opacity (stored in data attribute)
          const originalOpacity = markerElement.getAttribute('data-original-opacity');
          if (originalOpacity) {
            markerElement.style.setProperty('opacity', originalOpacity, 'important');
            markerElement.style.setProperty('visibility', 'visible', 'important');
            markerElement.style.removeProperty('display'); // Remove display:none
            markerElement.style.setProperty('pointer-events', 'auto', 'important');
          } else {
            // If no stored opacity, restore to 1.0
            markerElement.style.setProperty('opacity', '1', 'important');
            markerElement.style.setProperty('visibility', 'visible', 'important');
            markerElement.style.removeProperty('display'); // Remove display:none
            markerElement.style.setProperty('pointer-events', 'auto', 'important');
          }
          
          console.log(`Shown marker: ${markerFuelType || 'unknown'}`, markerElement);
        } else {
          // Store current opacity before hiding
          const currentOpacity = markerElement.style.opacity || 
                                 markerElement.getAttribute('data-original-opacity') || 
                                 window.getComputedStyle(markerElement).opacity || 
                                 '1';
          markerElement.setAttribute('data-original-opacity', currentOpacity);
          
          // Hide marker using opacity and visibility only (don't use display:none as it can affect parent)
          markerElement.style.setProperty('opacity', '0', 'important');
          markerElement.style.setProperty('visibility', 'hidden', 'important');
          markerElement.style.setProperty('pointer-events', 'none', 'important');
          
          console.log(`Hidden marker: ${markerFuelType || 'unknown'}`, markerElement);
        }
      }
    });
    
    // Also toggle pulse layers for GRDA and OG&E markers
    if ((utility === 'grda' || utility === 'oge') && map?.current) {
      let pulseLayerPrefix;
      
      if (utility === 'grda') {
        // GRDA uses: gas-power-pulse-layer-0, hydro-power-pulse-layer-0, wind-power-pulse-layer-0
        pulseLayerPrefix = `${fuelType.toLowerCase()}-power-pulse-layer-`;
      } else if (utility === 'oge') {
        // OG&E uses: oge-gas-power-pulse-layer-0, oge-coal-power-pulse-layer-0, etc.
        pulseLayerPrefix = `oge-${fuelType.toLowerCase()}-power-pulse-layer-`;
      }
      
      let index = 0;
      
      while (true) {
        const layerId = `${pulseLayerPrefix}${index}`;
        
        if (map.current.getLayer(layerId)) {
          if (isVisible) {
            // Show pulse layer
            map.current.setLayoutProperty(layerId, 'visibility', 'visible');
          } else {
            // Hide pulse layer
            map.current.setLayoutProperty(layerId, 'visibility', 'none');
          }
          index++;
        } else {
          // No more layers found
          break;
        }
      }
      
      console.log(`Toggled ${index} pulse layers for ${utility} ${fuelType}: ${isVisible ? 'show' : 'hide'}`);
    }
  };

  // Toggle category visibility
  const handleCategoryToggle = (utility, fuelType) => {
    let key;
    if (utility === 'infrastructure') {
      key = 'infrastructureSites';
    } else {
      key = `${utility}${fuelType.charAt(0).toUpperCase() + fuelType.slice(1)}`;
    }
    const newVisibility = !categoryVisibility[key];
    
    setCategoryVisibility(prev => ({
      ...prev,
      [key]: newVisibility
    }));

    toggleMarkers(utility, fuelType, newVisibility);
  };

  // Only show if visible prop is true AND at least one marker group is visible
  if (!visible || (!grdaMarkersVisible && !ogeMarkersVisible && !infrastructureMarkersVisible)) return null;

  // Position legend above "Show Graph" button
  // Button (ToggleContainer) is at:
  //   - bottom: 20px (graph hidden) or 320px (graph visible)
  //   - right: 4px
  // Button height is ~45px (padding 10px top/bottom + content ~25px)
  // When hidden: button top = 20px + 45px = 65px from bottom
  // When visible: button top = 320px + 45px = 365px from bottom
  // Position legend 20px above button top, then moved down 100px
  const dynamicLegendStyle = {
    ...legendStyle,
    bottom: graphVisible ? 225 : 40, // Moved down 100px from original positions (385-100=285, 85-100=-15)
    left: -74,
  };

  // Build unified legend items based on visible markers
  const allLegendItems = [];
  
  if (grdaMarkersVisible) {
    allLegendItems.push(
      <div 
        key="grda-header" 
        onClick={() => setGrdaExpanded(!grdaExpanded)}
        style={{ 
          fontWeight: 'bold', 
          marginBottom: '8px', 
          color: '#E5E7EB', 
          marginTop: allLegendItems.length > 0 ? '12px' : '0',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          userSelect: 'none',
          transition: 'opacity 0.2s ease'
        }}
        onMouseEnter={(e) => e.target.style.opacity = '0.8'}
        onMouseLeave={(e) => e.target.style.opacity = '1'}
      >
        <span style={{ marginRight: '8px', fontSize: '12px', transition: 'transform 0.2s ease', transform: grdaExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
        GRDA Power Generation:
      </div>
    );
    if (grdaExpanded) {
      grdaLegendItems.forEach((item, index) => {
        const fuelType = item.label.toLowerCase();
        const key = `grda${fuelType.charAt(0).toUpperCase() + fuelType.slice(1)}`;
        const isVisible = categoryVisibility[key] !== false;
        
        allLegendItems.push(
          <div 
            key={`grda-${index}`} 
            onClick={(e) => {
              e.stopPropagation();
              handleCategoryToggle('grda', fuelType);
            }}
            style={{
              ...legendItemStyle,
              cursor: 'pointer',
              opacity: isVisible ? 1 : 0.4,
              userSelect: 'none',
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (isVisible) {
                e.currentTarget.style.opacity = '0.8';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = isVisible ? '1' : '0.4';
            }}
          >
            <div style={colorDotStyle(item.color)}></div>
            <span style={{ color: '#D1D5DB' }}>{item.label}</span>
            {!isVisible && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#9ca3af' }}>(hidden)</span>}
          </div>
        );
      });
    }
  }
  
  if (ogeMarkersVisible) {
    allLegendItems.push(
      <div 
        key="oge-header" 
        onClick={() => setOgeExpanded(!ogeExpanded)}
        style={{ 
          fontWeight: 'bold', 
          marginBottom: '8px', 
          color: '#E5E7EB', 
          marginTop: allLegendItems.length > 0 ? '12px' : '0',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          userSelect: 'none',
          transition: 'opacity 0.2s ease'
        }}
        onMouseEnter={(e) => e.target.style.opacity = '0.8'}
        onMouseLeave={(e) => e.target.style.opacity = '1'}
      >
        <span style={{ marginRight: '8px', fontSize: '12px', transition: 'transform 0.2s ease', transform: ogeExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
        OG&E Power Generation:
      </div>
    );
    if (ogeExpanded) {
      ogeLegendItems.forEach((item, index) => {
        const fuelType = item.label.toLowerCase();
        const key = `oge${fuelType.charAt(0).toUpperCase() + fuelType.slice(1)}`;
        const isVisible = categoryVisibility[key] !== false;
        
        allLegendItems.push(
          <div 
            key={`oge-${index}`} 
            onClick={(e) => {
              e.stopPropagation();
              handleCategoryToggle('oge', fuelType);
            }}
            style={{
              ...legendItemStyle,
              cursor: 'pointer',
              opacity: isVisible ? 1 : 0.4,
              userSelect: 'none',
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (isVisible) {
                e.currentTarget.style.opacity = '0.8';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = isVisible ? '1' : '0.4';
            }}
          >
          <div style={colorDotStyle(item.color)}></div>
          <span style={{ color: '#D1D5DB' }}>{item.label}</span>
            {!isVisible && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#9ca3af' }}>(hidden)</span>}
        </div>
        );
      });
    }
  }
  
  if (infrastructureMarkersVisible) {
    allLegendItems.push(
      <div 
        key="infrastructure-header" 
        onClick={() => setInfrastructureExpanded(!infrastructureExpanded)}
        style={{ 
          fontWeight: 'bold', 
          marginBottom: '8px', 
          color: '#E5E7EB', 
          marginTop: allLegendItems.length > 0 ? '12px' : '0',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          userSelect: 'none',
          transition: 'opacity 0.2s ease'
        }}
        onMouseEnter={(e) => e.target.style.opacity = '0.8'}
        onMouseLeave={(e) => e.target.style.opacity = '1'}
      >
        <span style={{ marginRight: '8px', fontSize: '12px', transition: 'transform 0.2s ease', transform: infrastructureExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
        Infrastructure Sites:
      </div>
    );
    if (infrastructureExpanded) {
      infrastructureLegendItems.forEach((item, index) => {
        const key = 'infrastructureSites';
        const isVisible = categoryVisibility[key] !== false;
        
        allLegendItems.push(
          <div 
            key={`infrastructure-${index}`} 
            onClick={(e) => {
              e.stopPropagation();
              handleCategoryToggle('infrastructure', item.type);
            }}
            style={{
              ...legendItemStyle,
              cursor: 'pointer',
              opacity: isVisible ? 1 : 0.4,
              userSelect: 'none',
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (isVisible) {
                e.currentTarget.style.opacity = '0.8';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = isVisible ? '1' : '0.4';
            }}
          >
            <div style={colorDotStyle(item.color)}></div>
            <span style={{ color: '#D1D5DB' }}>{item.label}</span>
            {!isVisible && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#9ca3af' }}>(hidden)</span>}
          </div>
        );
      });
    }
  }

  return (
    <div style={dynamicLegendStyle}>
      {allLegendItems}
    </div>
  );
};

export default GRDAPowerLegend;

