/**
 * AIResponseDisplayRefactored - Simplified main component with extracted table logic
 * 
 * This is the refactored version of AIResponseDisplay with separated concerns
 * and animation integration support.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import InfrastructureSummaryTable from './Tables/InfrastructureSummaryTable';
import PowerTable from './Tables/PowerTable';
import TransmissionTable from './Tables/TransmissionTable';
import UtilitiesTable from './Tables/UtilitiesTable';
import RiskTable from './Tables/RiskTable';
import TableAnimationManager from './Tables/TableAnimationManager';
import { 
  renderTruncatedView, 
  renderFullView
} from '../../../../utils/responseUtils/responseTextProcessor';
import { parseTableData, filterNodesByCategory } from '../../../../utils/tableUtils/tableDataParser';

const AIResponseDisplay = ({ 
  response, 
  citations = [], 
  maxHeight = 300,
  showTruncation = true,
  truncationLength = 200,
  onResponseExpandedChange = null,
  onSourcesExpandedChange = null,
  isLoading = false,
  onCollapseClick = null,
  showCollapseButton = false,
  selectedMarker = null,
  showMarkerDetails = false,
  onBackToAnalysis = null,
  // NEW PROPS FOR TABLE RENDERING
  renderMode = 'text',
  tableData = null,
  category = 'all',
  // ANIMATION PROPS
  nodeAnimation = null,
  onTableRowClick = null,
  onDetailToggle = null // New prop for detail toggle callback
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showSummaryTable, setShowSummaryTable] = useState(false); // New state to control summary visibility
  const scrollContainerRef = useRef(null);

  // Handle response expansion state change
  const handleExpansionChange = (expanded) => {
    setIsExpanded(expanded);
    if (onResponseExpandedChange) {
      onResponseExpandedChange(expanded);
    }
  };

  // Handle table row click with animation
  const handleTableRowClick = useCallback((node) => {
    if (onTableRowClick) {
      onTableRowClick(node);
    }
  }, [onTableRowClick]);

  // Handle detail toggle
  const handleDetailToggle = useCallback((nodeId, isExpanded, nodeData) => {
    if (onDetailToggle) {
      onDetailToggle(nodeId, isExpanded, nodeData);
    }
  }, [onDetailToggle]);

  // Handle summary table toggle
  const handleSummaryToggle = useCallback(() => {
    setShowSummaryTable(prev => !prev);
  }, []);

  // Auto-scroll to highlighted row
  const scrollToHighlightedRow = useCallback((nodeId) => {
    if (!nodeId || !scrollContainerRef.current) return;
    
    // Find the table row element by data attribute or ID
    let rowElement = scrollContainerRef.current.querySelector(`[data-node-id="${nodeId}"]`);
    
    // Fallback: try to find by text content if data attribute doesn't work
    if (!rowElement) {
      const allRows = scrollContainerRef.current.querySelectorAll('tr');
      rowElement = Array.from(allRows).find(row => {
        const textContent = row.textContent || '';
        return textContent.includes(nodeId) || textContent.includes(nodeId.split('-')[0]);
      });
    }
    
    if (rowElement) {
      console.log('🎯 Found row element, scrolling to it:', nodeId);
      
      // Calculate the position to scroll to (center the row in the viewport)
      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      const rowRect = rowElement.getBoundingClientRect();
      const scrollTop = scrollContainerRef.current.scrollTop;
      
      // Calculate the target scroll position to center the row
      const targetScrollTop = scrollTop + rowRect.top - containerRect.top - (containerRect.height / 2) + (rowRect.height / 2);
      
      // Smooth scroll to the target position
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    } else {
      console.warn('🎯 Could not find row element for nodeId:', nodeId);
    }
  }, []);

  // Handle scroll detection
  const handleScroll = useCallback((e) => {
    const scrollTop = e.target.scrollTop;
    const isScrolledNow = scrollTop > 5; // Lowered threshold from 10px to 5px
    setIsScrolled(isScrolledNow); // Trigger when scrolled more than 5px
  }, []);

  // Add scroll listener
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll, renderMode, category]);


  // Emit scroll state to CategoryToggle
  useEffect(() => {
    if (window.mapEventBus) {
      window.mapEventBus.emit('response:scrolled', { isScrolled });
    }
  }, [isScrolled, renderMode]);

  // Listen for marker clicks to auto-scroll to highlighted row
  useEffect(() => {
    if (!window.mapEventBus || renderMode !== 'table') return;

    const handleMarkerClicked = (markerData) => {
      console.log('🎯 AIResponseDisplay: Received marker click, auto-scrolling to row:', markerData.id);
      // Add a small delay to allow the table to update first
      setTimeout(() => {
        scrollToHighlightedRow(markerData.id);
      }, 100);
    };

    const unsubscribe = window.mapEventBus.on('marker:clicked', handleMarkerClicked);
    
    return () => {
      unsubscribe();
    };
  }, [renderMode, scrollToHighlightedRow]);

  // Show skeleton loading when isLoading is true
  if (isLoading) {
    return (
      <div style={{
        maxHeight: `${maxHeight}px`,
        overflow: 'hidden',
        padding: '16px',
        borderRadius: '12px',
        marginBottom: '2px',
        width: '100%',
        maxWidth: '320px',
        position: 'relative',
        background: 'rgba(30, 41, 59, 0.8)', // Darker blue background
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        {/* Skeleton Loading Animation */}
        <div style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {[1, 2, 3, 4, 5].map((line) => (
            <div
              key={line}
              style={{
                height: '16px',
                background: 'rgba(51, 65, 85, 0.6)', // Darker blue for skeleton bars
                borderRadius: '4px',
                marginBottom: line === 5 ? '0' : '12px',
                width: line === 1 ? '90%' : line === 2 ? '85%' : line === 3 ? '70%' : line === 4 ? '60%' : '40%',
                animation: 'skeletonPulse 1.5s ease-in-out infinite',
                animationDelay: `${line * 0.1}s`
              }}
            />
          ))}
          
          <div style={{
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            animation: 'skeletonShimmer 2s ease-in-out infinite',
            pointerEvents: 'none'
          }} />
        </div>
      </div>
    );
  }

  if (!response) return null;

  // Handle case where response might be React elements
  if (typeof response !== 'string') {
    return (
      <div style={{
        maxHeight: `${maxHeight}px`,
        overflow: 'auto',
        padding: '16px',
        borderRadius: '12px',
        marginBottom: '2px',
        width: '100%',
        maxWidth: '320px',
        position: 'relative'
      }}>
        {response}
      </div>
    );
  }

  // Check if response needs truncation
  const needsTruncation = response.length > truncationLength && showTruncation;


  // Handle table rendering mode
  if (renderMode === 'table' && tableData) {
    
    let filteredData = [];
    
    if (tableData && Array.isArray(tableData)) {
      filteredData = tableData; // Already filtered by CategoryToggle
    } else {
      const parsedData = parseTableData(response);
      filteredData = filterNodesByCategory(parsedData, category);
    }
    
    // For startup companies, check multiple data sources
    if (category === 'all' && filteredData.length > 0) {
      // Check if we have Perplexity analysis data first (highest priority)
      const perplexityAnalysisData = window.lastPerplexityAnalysisData;
      
      if (perplexityAnalysisData?.geoJsonFeatures?.length > 0) {
        // Use Perplexity analysis data - transform to table format
        filteredData = perplexityAnalysisData.geoJsonFeatures.map((feature, index) => ({
          id: feature.properties.id || `perplexity-${index}`,
          name: feature.properties.name || 'Innovation Node',
          category: feature.properties.category || 'Startup Analysis',
          innovation_score: feature.properties.innovation_score || null,
          funding_access: feature.properties.funding_access || null,
          talent_access: feature.properties.talent_access || null,
          network_effects: feature.properties.network_effects || null,
          market_opportunity: feature.properties.market_opportunity || null,
          startup_impact: feature.properties.startup_impact || null,
          zone: feature.properties.zone || 'unknown',
          zone_name: feature.properties.zone_name || 'Unknown Zone',
          analysis_type: feature.properties.analysis_type || 'startup_catalyst',
          confidence_score: feature.properties.confidence_score || 0.8,
          color: '#3b82f6', // Blue for Perplexity analysis
          description: `${feature.properties.name || 'Innovation Node'} - ${feature.properties.analysis_type || 'startup analysis'}`,
          geometry: feature.geometry,
          coordinates: feature.geometry?.coordinates ? {
            lng: feature.geometry.coordinates[0],
            lat: feature.geometry.coordinates[1]
          } : { lng: -95.3698, lat: 29.7604 }
        }));
        console.log('🧠 Using Perplexity analysis data for table:', filteredData.length);
      } else {
        // Fallback to SERP data
        const startupEcosystemData = window.lastStartupEcosystemData;
        const serpFeatures = startupEcosystemData?.serp?.features || [];
      
      if (serpFeatures.length > 0) {
        // Use real Houston real estate data from SERP tool
        filteredData = serpFeatures.map((property, index) => ({
          id: property.properties.id || `property-${index}`,
          name: property.properties.name || 'Property',
          address: property.properties.address || 'Property Address',
          category: property.properties.category || 'Property', // Use only the clean mapped category
          price: property.properties.price || property.properties.price_value || null,
          squareFootage: property.properties.squareFootage || property.properties.square_footage || null,
          bedrooms: property.properties.bedrooms || null,
          zipCode: property.properties.zipCode || property.properties.zip_code || null,
          scrapedAt: property.properties.scrapedAt || property.properties.scraped_at || null,
          color: property.properties.categoryColor || property.properties.color || '#6b7280',
          description: property.properties.description || '',
          // Use real coordinates from the GeoJSON
          geometry: property.geometry || {
            type: 'Point',
            coordinates: [-95.3698, 29.7604] // Default to Houston
          },
          coordinates: property.geometry?.coordinates ? {
            lng: property.geometry.coordinates[0],
            lat: property.geometry.coordinates[1]
          } : { lng: -95.3698, lat: 29.7604 }
        }));
        } else {
          // Fallback to parsed response data (if any)
          filteredData = filteredData.map((property, index) => ({
            id: property.id || `property-${index}`,
            name: property.name || property.title || 'Property',
            address: property.address || 'Property Address',
            category: property.category || 'Property',
            price: property.price || null,
            squareFootage: property.squareFootage || null,
            bedrooms: property.bedrooms || null,
            zipCode: property.zipCode || null,
            scrapedAt: property.scrapedAt || null,
            color: property.color || '#6b7280',
            description: property.description || '',
            geometry: property.geometry || {
              type: 'Point',
              coordinates: property.coordinates ? [property.coordinates.lng, property.coordinates.lat] : [-95.3698, 29.7604]
            },
            coordinates: property.coordinates || { lng: -95.3698, lat: 29.7604 }
          }));
        }
      }
    }
    
    return (
      <>
        {/* Table Animation Manager */}
        <TableAnimationManager 
          tableData={filteredData}
          nodeAnimation={nodeAnimation}
          onTableRowClick={handleTableRowClick}
        />
        
        <div 
          ref={scrollContainerRef}
          style={{
            maxHeight: `${maxHeight}px`,
            overflow: 'auto',
            padding: '12px 16px 16px 16px',
            borderRadius: '12px',
            marginBottom: '2px',
            marginTop: category === 'all' ? '8px' : '5px',
            width: '100%',
            maxWidth: category === 'risk' ? '280px' : '320px',
            position: 'relative',
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            backdropFilter: 'none',
            animation: 'fadeInUp 0.6s ease-out'
          }}>
          <style>
            {`
              @keyframes fadeInUp {
                from {
                  opacity: 0;
                  transform: translateY(20px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              
              @keyframes slideInFromLeft {
                from {
                  opacity: 0;
                  transform: translateX(-20px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }
              
              @keyframes pulse {
                0%, 100% {
                  opacity: 1;
                }
                50% {
                  opacity: 0.7;
                }
              }
              
              .table-row-hover {
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              }
              
              .table-row-hover:hover {
                background: rgba(255, 255, 255, 0.08) !important;
                transform: translateX(4px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
              }
              
              .table-header-gradient {
                background: linear-gradient(135deg, #1e40af, #7c3aed);
                position: relative;
                overflow: hidden;
              }
              
              .table-header-gradient::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                animation: shimmer 2s infinite;
              }
              
              @keyframes shimmer {
                0% {
                  left: -100%;
                }
                100% {
                  left: 100%;
                }
              }
              
              .insight-card {
                background: transparent;
                border: none;
                border-radius: 8px;
                padding: 12px;
                margin-top: 16px;
                position: relative;
                overflow: hidden;
              }
              
              .insight-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6);
                background-size: 200% 100%;
                animation: gradientShift 3s ease-in-out infinite;
              }
              
              @keyframes gradientShift {
                0%, 100% {
                  background-position: 0% 50%;
                }
                50% {
                  background-position: 100% 50%;
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
            `}
          </style>
          
          {/* Render appropriate table based on category */}
          {category === 'all' && (
            <>
              {/* Clickable header to toggle summary */}
              <div 
                onClick={handleSummaryToggle}
                style={{
                  background: 'linear-gradient(135deg, #1e40af, #7c3aed)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '12px',
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 8px 25px rgba(30, 64, 175, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  <span>Infrastructure Summary</span>
                  <span style={{
                    fontSize: '12px',
                    opacity: 0.8,
                    transform: showSummaryTable ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease'
                  }}>
                    ▼
                  </span>
                </div>
                <div style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '11px',
                  marginTop: '4px',
                  fontWeight: '400'
                }}>
                  Click to {showSummaryTable ? 'hide' : 'show'} detailed analysis
                </div>
                
                {/* Shimmer effect */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                  animation: 'shimmer 2s infinite',
                  pointerEvents: 'none'
                }} />
              </div>
              
              {/* Summary table - only show when toggled */}
              {showSummaryTable && (
                <div style={{
                  animation: 'slideDown 0.5s ease'
                }}>
                  <InfrastructureSummaryTable
                    nodes={filteredData}
                    onTableRowClick={handleTableRowClick}
                    nodeAnimation={nodeAnimation}
                    animationConfig={{
                      hoverEffect: true,
                      clickAnimation: true,
                      pulseOnHover: false
                    }}
                    onDetailToggle={handleDetailToggle}
                  />
                </div>
              )}
            </>
          )}
          
          {/* Startup Ecosystem Categories */}
          {category === 'inn' && (
            <PowerTable
              nodes={filteredData}
              onTableRowClick={handleTableRowClick}
              nodeAnimation={nodeAnimation}
              animationConfig={{
                hoverEffect: true,
                clickAnimation: true,
                pulseOnHover: false
              }}
            />
          )}
          
          {category === 'fnd' && (
            <TransmissionTable
              nodes={filteredData}
              onTableRowClick={handleTableRowClick}
              nodeAnimation={nodeAnimation}
              animationConfig={{
                hoverEffect: true,
                clickAnimation: true,
                pulseOnHover: false
              }}
            />
          )}
          
          {category === 'tlt' && (
            <UtilitiesTable
              nodes={filteredData}
              onTableRowClick={handleTableRowClick}
              nodeAnimation={nodeAnimation}
              animationConfig={{
                hoverEffect: true,
                clickAnimation: true,
                pulseOnHover: false
              }}
            />
          )}
          
          {category === 'net' && (
            <RiskTable
              nodes={filteredData}
              onTableRowClick={handleTableRowClick}
              nodeAnimation={nodeAnimation}
              animationConfig={{
                hoverEffect: true,
                clickAnimation: true,
                pulseOnHover: false
              }}
            />
          )}
          
          {category === 'mkt' && (
            <RiskTable
              nodes={filteredData}
              onTableRowClick={handleTableRowClick}
              nodeAnimation={nodeAnimation}
              animationConfig={{
                hoverEffect: true,
                clickAnimation: true,
                pulseOnHover: false
              }}
            />
          )}
          
          {category === 'imp' && (
            <RiskTable
              nodes={filteredData}
              onTableRowClick={handleTableRowClick}
              nodeAnimation={nodeAnimation}
              animationConfig={{
                hoverEffect: true,
                clickAnimation: true,
                pulseOnHover: false
              }}
            />
          )}
        </div>
      </>
    );
  }

  // Default text rendering mode
  return (
    <div 
      ref={scrollContainerRef}
      style={{
        maxHeight: isExpanded ? `${maxHeight + 30}px` : `${maxHeight}px`,
        overflow: 'auto',
        padding: '16px',
        borderRadius: '12px',
        marginBottom: '2px',
        marginTop: isExpanded ? '5px' : '0px',
        width: '100%',
        maxWidth: '320px',
        position: 'relative'
      }}>
      {/* Response Content */}
      <div style={{
        lineHeight: '1.6',
        color: '#e5e7eb',
        fontSize: '14px'
      }}>
        {isExpanded ? renderFullView(response, citations) : renderTruncatedView(response, truncationLength, handleExpansionChange)}
      </div>

      {/* Controls */}
      {needsTruncation && (
        <div style={{
          marginTop: isExpanded ? '28px' : '28px',
          marginBottom: '0px',
          marginLeft: '2px',
          opacity: '0.5',
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-start',
          alignItems: 'center'
        }}>
          {isExpanded ? (
            <button
              onClick={() => handleExpansionChange(false)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.8)',
                padding: '6px 12px',
                fontSize: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'Inter, monospace',
                fontWeight: '400',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              Show Less
            </button>
          ) : (
            <button
              onClick={() => handleExpansionChange(true)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.8)',
                padding: '6px 12px',
                fontSize: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'Inter, monospace',
                fontWeight: '400',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              Show More
            </button>
          )}
          
          {/* Collapse Button */}
          {showCollapseButton && onCollapseClick && (
            <button
              onClick={onCollapseClick}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.8)',
                padding: '6px 12px',
                fontSize: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'Inter, monospace',
                fontWeight: '400',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              title="Click to collapse response"
            >
              Collapse
            </button>
          )}
          
          {/* Sources Toggle Button */}
          {citations && citations.length > 0 && (
            <button
              onClick={() => {
                const newState = !sourcesExpanded;
                setSourcesExpanded(newState);
                if (onSourcesExpandedChange) {
                  onSourcesExpandedChange(newState);
                }
              }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.8)',
                padding: '6px 12px',
                fontSize: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              title={sourcesExpanded ? 'Click to hide sources' : 'Click to show sources'}
            >
              Sources ({citations.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AIResponseDisplay;
