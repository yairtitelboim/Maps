import React from 'react';
import VisibilityPresets from './VisibilityPresets';

const LegendPanel = ({
  isVisible,
  onToggle,
  cardHeight,
  legendSections,
  legendData,
  osmData,
  whitneyData,
  perplexityData,
  dukeData,
  okDataCenterData,
  ncPowerData,
  selectedMarker,
  startupCategoryVisibility,
  whitneyLayerOpacity,
  osmLayerOpacity,
  ncSiteCollapsed,
  okSiteCollapsed,
  perplexityLayerVisibility,
  dukeLayerVisibility,
  osmLayerVisibility,
  handleLegendItemClick,
  turnAllLayersOff,
  getSectionCollapseInfo,
  toggleNcSiteCollapse,
  toggleOkSiteCollapse,
  toggleOkDataCenterLayer,
  toggleWhitneyLayerOpacity,
  toggleOsmLayerOpacity,
  toggleAllWhitneyLayers,
  toggleAllStartupCategories,
  toggleAllPerplexityLayers,
  toggleAllDukeLayers,
  toggleAllOsmLayers,
  powerLegendVisibility,
  grdaExpanded,
  ogeExpanded,
  infrastructureExpanded,
  setGrdaExpanded,
  setOgeExpanded,
  setInfrastructureExpanded,
  togglePowerLegendCategory,
  captureVisibilityState,
  restoreVisibilityState,
  onSavePreset,
  onLoadPreset,
  onUpdatePreset,
  onDeletePreset
}) => (

    <>
      {/* Legend Toggle Button - Always visible when legend is closed */}
      {!isVisible && (
        <div style={{
          position: 'absolute', // Back to absolute positioning
          left: '340px', // 320px (BaseCard width) + 20px margin
          top: '20px',
          zIndex: 1001,
          pointerEvents: 'auto' // Ensure it's clickable
        }}>
          <button
            onClick={() => {
              if (onToggle) {
                onToggle();
              }
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.06)', /* Match SidePanel background */
              border: '1px solid rgba(255, 255, 255, 0.15)', /* Match SidePanel border */
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#f9fafb',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)' /* Match SidePanel shadow */
            }}
            onMouseEnter={(e) => {
              e.target.style.color = 'rgba(255, 255, 255, 0.9)';
              e.target.style.transform = 'scale(1.1)';
              e.target.style.background = 'rgba(255, 255, 255, 0.18)';
              e.target.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.color = '#f9fafb';
              e.target.style.transform = 'scale(1)';
              e.target.style.background = 'rgba(255, 255, 255, 0.06)';
              e.target.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
            }}
            title="Show Map Legend"
          >
            ≡
          </button>
        </div>
      )}

      {/* Legend Content - Similar to FollowUpQuestions but positioned to the right */}
      {isVisible && (
        <div style={{
          position: 'absolute', // Back to absolute positioning
          left: '340px', // 320px (BaseCard width) + 20px margin
          top: '0px',
          height: cardHeight > 0 ? `${cardHeight}px` : 'auto', // Match BaseCard height
          zIndex: 1001,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateX(0)' : 'translateX(20px)',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'auto' // Ensure it's clickable
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.06)', /* Match SidePanel background */
            border: '1px solid rgba(255, 255, 255, 0.15)', /* Match SidePanel border */
            borderRadius: '12px',
            padding: '16px',
            color: '#f9fafb',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '12px',
            backdropFilter: 'blur(20px)', /* Match SidePanel backdrop */
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)', /* Match SidePanel shadow */
            minWidth: '200px',
            maxWidth: '280px',
            animation: 'fadeIn 0.3s ease-in-out',
            paddingBottom: '35px' /* Align with BaseCard bottom like SidePanel */
          }}>
            {/* Legend Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1px',
              paddingBottom: '2px',
              borderBottom: '1px solid rgba(75, 85, 99, 0.3)'
            }}>
              <h3 
                onClick={turnAllLayersOff}
                style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: '600',
                color: '#f9fafb',
                flex: 1,
                  minWidth: 0, /* Allow flex item to shrink */
                    cursor: 'pointer',
                  transition: 'color 0.2s ease',
                  userSelect: 'none'
                  }}
                  onMouseEnter={(e) => {
                  e.target.style.color = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                  e.target.style.color = '#f9fafb';
                  }}
                title="Click to turn all layers off"
                >
                Map Layers
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={onToggle}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = '#f9fafb';
                    e.target.style.background = 'rgba(75, 85, 99, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = '#9ca3af';
                    e.target.style.background = 'none';
                  }}
                  title="Hide Legend"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Visibility Presets Section */}
            <VisibilityPresets
              captureVisibilityState={captureVisibilityState}
              onSavePreset={onSavePreset}
              onLoadPreset={onLoadPreset}
              onUpdatePreset={onUpdatePreset}
              onDeletePreset={onDeletePreset}
            />

            {/* Legend Sections - Show SERP, OSM, and Perplexity data */}
            {legendSections.length > 0 ? legendSections.map((section, sectionIndex) => (
              <div key={section.title} style={{
                marginBottom: '16px',
                animation: 'slideInFromRight 0.4s ease-out forwards',
                animationDelay: `${sectionIndex * 0.1}s`,
                opacity: 0,
                transform: 'translateX(20px)'
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  color: '#9ca3af',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  {(() => {
                    const collapseInfo = getSectionCollapseInfo(section.title);
                    const isCollapsible = collapseInfo.toggle !== null;
                    
                    return (
                      <span 
                        style={{
                          cursor: isCollapsible ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'color 0.2s ease'
                        }}
                        onClick={isCollapsible ? collapseInfo.toggle : undefined}
                        onMouseEnter={isCollapsible ? (e) => {
                          e.target.style.color = '#ffffff';
                        } : undefined}
                        onMouseLeave={isCollapsible ? (e) => {
                          e.target.style.color = '#9ca3af';
                        } : undefined}
                        title={isCollapsible ? 
                          (collapseInfo.isCollapsed ? `Expand ${section.title}` : `Collapse ${section.title}`) : 
                          undefined
                        }
                      >
                        {isCollapsible && (
                          <span style={{
                            fontSize: '10px',
                            transition: 'transform 0.2s ease',
                            transform: collapseInfo.isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                            display: 'inline-block'
                          }}>
                            ▼
                          </span>
                        )}
                        {section.title}
                      </span>
                    );
                  })()}
                  {section.title === 'Startup Categories' && section.items.some(item => item.category) && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllStartupCategories(true);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '3px',
                          color: '#9ca3af',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '9px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.color = '#ffffff';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.color = '#9ca3af';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }}
                        title="Show all startup categories"
                      >
                        All
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllStartupCategories(false);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '3px',
                          color: '#9ca3af',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '9px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.color = '#ffffff';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.color = '#9ca3af';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }}
                        title="Hide all startup categories"
                      >
                        None
                      </button>
                    </div>
                  )}
                  {section.title === 'Perplexity AI Analysis' && section.items.some(item => item.category) && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllPerplexityLayers(true);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '3px',
                          color: '#9ca3af',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '9px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.color = '#ffffff';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.color = '#9ca3af';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }}
                        title="Show all Perplexity categories"
                      >
                        All
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllPerplexityLayers(false);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '3px',
                          color: '#9ca3af',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '9px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.color = '#ffffff';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.color = '#9ca3af';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }}
                        title="Hide all Perplexity categories"
                      >
                        None
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Urban Infrastructure Controls - Below the title */}
                {section.title === 'Urban Infrastructure (OpenStreetMap)' && section.items.some(item => item.layerName) && !getSectionCollapseInfo(section.title).isCollapsed && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '4px', 
                    marginBottom: '8px',
                    justifyContent: 'flex-start'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllOsmLayers(true);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '3px',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = '#9ca3af';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      title="Show all OSM layers"
                    >
                      All
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllOsmLayers(false);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '3px',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = '#9ca3af';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      title="Hide all OSM layers"
                    >
                      None
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOsmLayerOpacity();
                      }}
                      style={{
                        background: osmLayerOpacity.isTranslucent ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                        border: `1px solid ${osmLayerOpacity.isTranslucent ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.2)'}`,
                        borderRadius: '3px',
                        color: osmLayerOpacity.isTranslucent ? '#60a5fa' : '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = osmLayerOpacity.isTranslucent ? '#60a5fa' : '#9ca3af';
                        e.target.style.borderColor = osmLayerOpacity.isTranslucent ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.2)';
                      }}
                      title={osmLayerOpacity.isTranslucent ? "Make OSM layers opaque" : "Make OSM layers translucent (65% more dim)"}
                    >
                      {osmLayerOpacity.isTranslucent ? 'Opaque' : 'Dim'}
                    </button>
                  </div>
                )}
                
                {/* Duke Transmission Easements Controls - Below the title */}
                {section.title === 'Duke Transmission Easements' && section.items.some(item => item.serviceType) && !getSectionCollapseInfo(section.title).isCollapsed && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '4px', 
                    marginBottom: '8px',
                    justifyContent: 'flex-start'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllDukeLayers(true);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '3px',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = '#9ca3af';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      title="Show all Duke transmission easements"
                    >
                      All
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllDukeLayers(false);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '3px',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = '#9ca3af';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      title="Hide all Duke transmission easements"
                    >
                      None
                    </button>
                  </div>
                )}
                
                {/* Liberty Infrastructure Analysis Controls - Below the title */}
                {section.title === 'Liberty Infrastructure Analysis' && section.items.some(item => item.category) && !getSectionCollapseInfo(section.title).isCollapsed && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '4px', 
                    marginBottom: '8px',
                    justifyContent: 'flex-start'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllWhitneyLayers(true);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '3px',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = '#9ca3af';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      title="Show all Pinal County layers"
                    >
                      All
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllWhitneyLayers(false);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '3px',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = '#9ca3af';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      title="Hide all Pinal County layers"
                    >
                      None
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWhitneyLayerOpacity();
                      }}
                      style={{
                        background: whitneyLayerOpacity.isTranslucent ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                        border: `1px solid ${whitneyLayerOpacity.isTranslucent ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.2)'}`,
                        borderRadius: '3px',
                        color: whitneyLayerOpacity.isTranslucent ? '#60a5fa' : '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = whitneyLayerOpacity.isTranslucent ? '#60a5fa' : '#9ca3af';
                        e.target.style.borderColor = whitneyLayerOpacity.isTranslucent ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.2)';
                      }}
                      title={whitneyLayerOpacity.isTranslucent ? "Make Whitney layers opaque" : "Make Whitney layers translucent (60% opacity)"}
                    >
                      {whitneyLayerOpacity.isTranslucent ? 'Opaque' : 'Dim'}
                    </button>
                  </div>
                )}
                
                {/* Only render items if section is not collapsed */}
                {!getSectionCollapseInfo(section.title).isCollapsed && section.items.map((item, itemIndex) => {
                  // For power legend sections, check if parent header is collapsed
                  if (section.isPowerLegend && item.utility && !item.type) {
                    // This is a power legend item (not a header)
                    // Check if its parent header is collapsed
                    let parentCollapsed = false;
                    if (item.utility === 'grda') {
                      parentCollapsed = !grdaExpanded;
                    } else if (item.utility === 'oge') {
                      parentCollapsed = !ogeExpanded;
                    } else if (item.utility === 'infrastructure') {
                      parentCollapsed = !infrastructureExpanded;
                    }
                    
                    if (parentCollapsed) {
                      return null; // Don't render collapsed items
                    }
                  }
                  // For NC Power and Oklahoma Data Center sites, check if site is collapsed
                  const isNcMainSite = item.siteKey && !item.isSubCategory && ncPowerData.sites.some(s => s.key === item.siteKey);
                  const isOkMainSite = item.siteKey && !item.isSubCategory && okDataCenterData.sites.some(s => s.key === item.siteKey);
                  const isNcSubCategory = item.siteKey && item.isSubCategory && ncPowerData.sites.some(s => s.key === item.siteKey);
                  const isOkSubCategory = item.siteKey && item.isSubCategory && okDataCenterData.sites.some(s => s.key === item.siteKey);
                  
                  // Check if the parent site is collapsed (for both NC and OK sites)
                  let parentSiteCollapsed = false;
                  if (isNcSubCategory && item.siteKey) {
                    parentSiteCollapsed = ncSiteCollapsed[item.siteKey] || false;
                  } else if (isOkSubCategory && item.siteKey) {
                    parentSiteCollapsed = okSiteCollapsed[item.siteKey] || false;
                  }
                  
                  // Hide subcategories if their parent site is collapsed
                  if ((isNcSubCategory || isOkSubCategory) && parentSiteCollapsed) {
                    return null;
                  }
                  
                  const isSiteCollapsed = isNcMainSite 
                    ? (ncSiteCollapsed[item.siteKey] || false) 
                    : (isOkMainSite ? (okSiteCollapsed[item.siteKey] || false) : false);
                  
                  // Check if this legend item corresponds to the selected marker
                  const isSelected = selectedMarker && 
                    selectedMarker.category && 
                    item.label.toLowerCase().includes(selectedMarker.category.toLowerCase());
                  
                  // Check if this is a startup category item
                  const isStartupCategory = item.category && startupCategoryVisibility && item.category in startupCategoryVisibility;
                  
                  // Check if this is an OSM layer item
                  const isOsmLayer = item.layerName && item.layerName in osmLayerVisibility;
                  
                  // Check if this is a Perplexity layer item
                  const isPerplexityLayer = item.category && item.category in perplexityLayerVisibility;
                  
                  // Check if this is a Duke layer item
                  const isDukeLayer = item.serviceType && item.serviceType in dukeLayerVisibility;
                  
                  // Check if this is a Whitney layer item (removed - no longer needed)
                  const isWhitneyLayer = false;
                  
                  // Check if this is a power legend item
                  const isPowerLegendItem = section.isPowerLegend && item.utility;
                  const isPowerLegendHeader = isPowerLegendItem && item.type === 'header';
                  
                  // Handle click for NC main site or OK main site/subcategory - toggle layer visibility
                  const handleItemClick = () => {
                    if (isPowerLegendHeader) {
                      // Toggle expansion for power legend headers
                      if (item.utility === 'grda' && setGrdaExpanded) {
                        setGrdaExpanded(!grdaExpanded);
                      } else if (item.utility === 'oge' && setOgeExpanded) {
                        setOgeExpanded(!ogeExpanded);
                      } else if (item.utility === 'infrastructure' && setInfrastructureExpanded) {
                        setInfrastructureExpanded(!infrastructureExpanded);
                      }
                    } else if (isPowerLegendItem && togglePowerLegendCategory) {
                      // Toggle power legend category visibility
                      togglePowerLegendCategory(item.utility, item.fuelType, item);
                    } else if (isNcMainSite) {
                      // For NC sites, toggle collapse (existing behavior)
                      toggleNcSiteCollapse(item.siteKey);
                    } else if (isOkMainSite) {
                      // For OK main sites, toggle collapse (like NC sites)
                      toggleOkSiteCollapse(item.siteKey);
                    } else if (isOkSubCategory) {
                      // For OK subcategories, toggle layer visibility on/off
                      const category = item.category;
                      toggleOkDataCenterLayer(item.siteKey, category);
                    } else {
                      handleLegendItemClick(item.label, item);
                    }
                  };
                  
                  // Generate unique key - combine utility and label for power items, or use category if available
                  const uniqueKey = item.category 
                    ? item.category 
                    : item.utility && item.fuelType 
                    ? `${item.utility}-${item.fuelType}`
                    : item.siteKey 
                    ? `${item.siteKey}${item.category ? `-${item.category}` : ''}`
                    : item.label;
                  
                  return (
                    <div 
                      key={uniqueKey} 
                      onClick={handleItemClick}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '6px',
                        fontSize: isPowerLegendHeader ? '12px' : item.isSubCategory ? '10px' : '11px',
                        fontWeight: isPowerLegendHeader ? 'bold' : 'normal',
                        animation: 'slideInFromRight 0.4s ease-out forwards',
                        animationDelay: `${(sectionIndex * 0.1) + (itemIndex * 0.05)}s`,
                        opacity: (item.isSubCategory ? 0.85 : 1) * (isOkSubCategory && item.isVisible === false ? 0.4 : 1),
                        transform: 'translateX(20px)',
                        cursor: 'pointer',
                        padding: isPowerLegendHeader ? '6px 8px' : item.isSubCategory ? '2px 8px 2px 24px' : '4px 8px',
                        borderRadius: '4px',
                        transition: 'all 0.2s ease',
                        background: isSelected ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                        border: isSelected ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent',
                        boxShadow: isSelected ? '0 0 8px rgba(239, 68, 68, 0.3)' : 'none',
                        color: isPowerLegendHeader ? '#E5E7EB' : undefined,
                        marginTop: isPowerLegendHeader && itemIndex > 0 ? '8px' : '0'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                      title={isPowerLegendHeader ? `Click to ${item.expanded ? 'collapse' : 'expand'} ${item.label}` : isPowerLegendItem ? `Click to toggle ${item.label} visibility` : isStartupCategory ? `Click to toggle ${item.label} category visibility` : isOsmLayer ? `Click to toggle ${item.label} layer visibility` : isPerplexityLayer ? `Click to toggle ${item.label} Perplexity layer visibility` : isDukeLayer ? `Click to toggle ${item.label} Duke layer visibility` : isWhitneyLayer ? `Click to toggle ${item.label} Whitney layer visibility` : `Click to highlight ${item.label} on map`}
                    >
                    {/* Collapse arrow for power legend headers */}
                    {isPowerLegendHeader ? (
                      <span 
                        style={{
                          fontSize: '10px',
                          color: '#6b7280',
                          cursor: 'pointer',
                          transition: 'transform 0.2s ease, color 0.2s ease',
                          transform: item.expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          display: 'inline-flex',
                          marginRight: '4px',
                          width: '12px',
                          height: '16px',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#9ca3af';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#6b7280';
                        }}
                      >
                        ▶
                      </span>
                    ) : null}
                    
                    {/* Collapse arrow for NC Power and OK Data Center site items */}
                    {(isNcMainSite || isOkMainSite) ? (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isNcMainSite) {
                          toggleNcSiteCollapse(item.siteKey);
                          } else if (isOkMainSite) {
                            toggleOkSiteCollapse(item.siteKey);
                          }
                        }}
                        style={{
                          fontSize: '10px',
                          color: '#6b7280',
                          cursor: 'pointer',
                          transition: 'transform 0.2s ease, color 0.2s ease',
                          transform: isSiteCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                          display: 'inline-flex',
                          marginRight: '4px',
                          width: '12px',
                          height: '16px',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#9ca3af';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#6b7280';
                        }}
                        title={isSiteCollapsed ? `Expand ${item.label}` : `Collapse ${item.label}`}
                      >
                        ▼
                      </span>
                    ) : null}
                    
                    {/* Visual indicator based on feature type */}
                    <div style={{
                      width: '16px',
                      height: '16px',
                      marginRight: '8px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {isPowerLegendHeader ? (
                        // Power legend header - no visual indicator, just text
                        null
                      ) : isPowerLegendItem ? (
                        // Power legend item - color dot with visibility toggle
                        <div style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: item.color || '#6b7280',
                          border: `2px solid ${item.isVisible !== false ? '#222' : '#6b7280'}`,
                          opacity: item.isVisible !== false ? 1 : 0.4,
                          transition: 'all 0.2s ease'
                        }} />
                      ) : isPerplexityLayer ? (
                        // Toggle checkbox for Perplexity categories
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: `2px solid ${item.isVisible ? item.color : '#6b7280'}`,
                          borderRadius: '3px',
                          backgroundColor: item.isVisible ? item.color : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}>
                          {item.isVisible && (
                            <div style={{
                              width: '6px',
                              height: '6px',
                              backgroundColor: '#ffffff',
                              borderRadius: '1px'
                            }} />
                          )}
                        </div>
                      ) : isStartupCategory ? (
                        // Toggle checkbox for startup categories
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: `2px solid ${item.isVisible ? item.color : '#6b7280'}`,
                          borderRadius: '3px',
                          backgroundColor: item.isVisible ? item.color : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}>
                          {item.isVisible && (
                            <div style={{
                              width: '6px',
                              height: '6px',
                              backgroundColor: '#ffffff',
                              borderRadius: '1px'
                            }} />
                          )}
                        </div>
                      ) : isOsmLayer ? (
                        // Toggle checkbox for OSM layers
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: `2px solid ${item.isVisible ? item.color : '#6b7280'}`,
                          borderRadius: '3px',
                          backgroundColor: item.isVisible ? item.color : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}>
                          {item.isVisible && (
                            <div style={{
                              width: '6px',
                              height: '6px',
                              backgroundColor: '#ffffff',
                              borderRadius: '1px'
                            }} />
                          )}
                        </div>
                      ) : isDukeLayer ? (
                        // Toggle checkbox for Duke layers
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: `2px solid ${item.isVisible ? item.color : '#6b7280'}`,
                          borderRadius: '3px',
                          backgroundColor: item.isVisible ? item.color : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}>
                          {item.isVisible && (
                            <div style={{
                              width: '6px',
                              height: '6px',
                              backgroundColor: '#ffffff',
                              borderRadius: '1px'
                            }} />
                          )}
                        </div>
                      ) : isWhitneyLayer ? (
                        // Toggle checkbox for Whitney layers
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: `2px solid ${item.isVisible ? item.color : '#6b7280'}`,
                          borderRadius: '3px',
                          backgroundColor: item.isVisible ? item.color : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}>
                          {item.isVisible && (
                            <div style={{
                              width: '6px',
                              height: '6px',
                              backgroundColor: '#ffffff',
                              borderRadius: '1px'
                            }} />
                          )}
                        </div>
                      ) : isOkSubCategory ? (
                        // Toggle checkbox for OK Data Center subcategories (Stillwater, Pryor, etc.)
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: `2px solid ${item.isVisible !== false ? item.color : '#6b7280'}`,
                          borderRadius: '3px',
                          backgroundColor: item.isVisible !== false ? item.color : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          opacity: item.isVisible !== false ? 1 : 0.4
                        }}>
                          {item.isVisible !== false && (
                            <div style={{
                              width: '6px',
                              height: '6px',
                              backgroundColor: '#ffffff',
                              borderRadius: '1px'
                            }} />
                          )}
                        </div>
                      ) : item.type === 'line' ? (
                        <div style={{
                          width: '14px',
                          height: '3px',
                          backgroundColor: item.color,
                          borderRadius: '1px',
                          // Special styling for dashed lines (analysis radius and Pinal County zones)
                          borderTop: (item.layerName === 'analysisRadius' || item.isDashed) ? `2px dashed ${item.color}` : 'none'
                        }} />
                      ) : item.type === 'polygon' ? (
                        <div style={{
                          width: '12px',
                          height: '12px',
                          backgroundColor: item.color,
                          border: `1px solid ${item.color}`,
                          opacity: 0.6
                        }} />
                      ) : (
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: item.color
                        }} />
                      )}
                    </div>
                    <span style={{
                      color: isPowerLegendHeader ? '#E5E7EB' : '#d1d5db',
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: isPowerLegendItem && item.isVisible === false ? 0.4 : 1
                      }}>
                        {item.label}
                        {isPowerLegendItem && item.isVisible === false && (
                          <span style={{ marginLeft: '8px', fontSize: '10px', color: '#9ca3af' }}>(hidden)</span>
                        )}
                        {isOkSubCategory && item.isVisible === false && (
                          <span style={{ marginLeft: '8px', fontSize: '10px', color: '#9ca3af' }}>(hidden)</span>
                        )}
                      </span>
                    {item.count !== undefined && !isPowerLegendHeader && (
                    <span style={{
                      color: '#6b7280',
                      fontSize: '10px',
                      marginLeft: '4px'
                    }}>
                      ({item.count})
                    </span>
                    )}
                    </div>
                  );
                })}
              </div>
            )) : (
              /* No data message */
              <div style={{
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '12px',
                fontStyle: 'italic',
                padding: '20px 0'
              }}>
                No map data available yet.
                <br />
                Run a Perplexity AI analysis, Startup Ecosystem search, or Pinal County Infrastructure analysis to see data.
              </div>
            )}

            {/* Analysis Area Section - Show if we have any data */}
            {(legendData.totalFeatures > 0 || osmData.totalFeatures > 0 || whitneyData.totalFeatures > 0 || perplexityData.totalFeatures > 0 || dukeData.totalFeatures > 0) && (
            <div style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(75, 85, 99, 0.3)',
              animation: 'slideInFromRight 0.4s ease-out forwards',
              animationDelay: '0.3s',
              opacity: 0,
              transform: 'translateX(20px)'
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: '500',
                color: '#9ca3af',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {whitneyData.totalFeatures > 0 ? 'Whitney Analysis Area' : 'Analysis Area'}
              </div>
              
              {/* Whitney-specific insights */}
              {whitneyData.totalFeatures > 0 && whitneyData.whitney_insights && (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '11px',
                    marginBottom: '6px'
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      marginRight: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#dc2626',
                      flexShrink: 0
                    }} />
                    <span style={{
                      color: '#d1d5db'
                    }}>
                      Data Center Proximity: {whitneyData.whitney_insights.data_center_proximity || 0} features
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '11px',
                    marginBottom: '6px'
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      marginRight: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#7c3aed',
                      flexShrink: 0
                    }} />
                    <span style={{
                      color: '#d1d5db'
                    }}>
                      Downtown Proximity: {whitneyData.whitney_insights.downtown_proximity || 0} features
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '11px',
                    marginBottom: '6px'
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      marginRight: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#f59e0b',
                      flexShrink: 0
                    }} />
                    <span style={{
                      color: '#d1d5db'
                    }}>
                      High Development Potential: {whitneyData.whitney_insights.high_development_potential || 0} buildings
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '11px',
                    marginBottom: '6px'
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      marginRight: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#06b6d4',
                      flexShrink: 0
                    }} />
                    <span style={{
                      color: '#d1d5db'
                    }}>
                      Commercial Development: {whitneyData.whitney_insights.total_commercial_development || 0} facilities
                    </span>
                  </div>
                </>
              )}
              
              {/* Standard analysis area indicators */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '11px',
                marginBottom: '6px'
              }}>
                <div style={{
                  width: '16px',
                  height: '2px',
                  marginRight: '8px',
                  backgroundColor: '#ef4444',
                  border: '1px dashed #ef4444',
                  opacity: 0.8,
                  flexShrink: 0
                }} />
                <span style={{
                  color: '#d1d5db'
                }}>
                  {whitneyData.totalFeatures > 0 ? 'Whitney Analysis Zones' : 'Innovation District Radius (6 miles)'}
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '11px'
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  marginRight: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  flexShrink: 0
                }} />
                <span style={{
                  color: '#d1d5db'
                }}>
                  {whitneyData.totalFeatures > 0 ? 'Whitney Data Center' : 'Innovation Hub Center'}
                </span>
              </div>
            </div>
            )}
          </div>
        </div>
      )}
    </>
);

export default LegendPanel;
