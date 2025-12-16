import React, { useEffect, useRef, useState, useCallback } from 'react';
import { formatStartupData, formatTDLRData, formatPinalData } from '../PopupCards';
import { TypewriterPopupCard } from './TypewriterPopupCard';

const MarkerPopupCard = ({ 
  nodeData, 
  position, 
  isVisible = false,
  isManualClick = false,
  onClose,
  map // Add map prop for zoom functionality
}) => {
  const popupRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [popupPosition, setPopupPosition] = useState(position || { x: 0, y: 0 });
  const [isPulsing, setIsPulsing] = useState(false);

  // Update popup position when position prop changes (but not when dragging)
  useEffect(() => {
    if (position && !isDragging) {
      setPopupPosition(position);
    }
  }, [position, isDragging]);

  // Trigger pulse effect when popup becomes visible
  useEffect(() => {
    if (isVisible && nodeData && position) {
      setIsPulsing(true);
      
      // Stop pulse after 3 seconds
      const pulseTimer = setTimeout(() => {
        setIsPulsing(false);
      }, 3000);
      
      return () => clearTimeout(pulseTimer);
    }
  }, [isVisible, nodeData, position]);

  // Handle drag functionality
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    
    // Calculate offset from the popup's current position
    const rect = popupRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Keep popup within viewport bounds (use default width for bounds checking)
    const popupWidth = 240; // 20% thinner for Pinal/startup/TDLR markers
    const popupHeight = 250; // Reduced height by 50px
    
    const boundedX = Math.max(0, Math.min(newX, window.innerWidth - popupWidth));
    const boundedY = Math.max(0, Math.min(newY, window.innerHeight - popupHeight));

    setPopupPosition({ x: boundedX, y: boundedY });
  }, [isDragging, dragOffset.x, dragOffset.y]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []); // Remove popupPosition dependency to prevent recreation during drag

  // Add global mouse event listeners for dragging
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

  // Prevent text selection during drag
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none';
      return () => {
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging]);

  // Handle toggle functionality for collapsible sections
  useEffect(() => {
    if (!isVisible || !popupRef.current) return;

    const handleToggleClick = (event) => {
      // Check if the clicked element is a toggle header
      if (event.target.closest('.toggle-header')) {
        event.preventDefault();
        event.stopPropagation();
        
        const header = event.target.closest('.toggle-header');
        const sectionId = header.getAttribute('data-section-id');
        const section = document.getElementById(sectionId);
        const arrow = header.querySelector('.toggle-arrow');
        
        if (section && arrow) {
          if (section.style.display === 'none') {
            section.style.display = 'block';
            arrow.textContent = '▼';
            arrow.style.transform = 'rotate(0deg)';
          } else {
            section.style.display = 'none';
            arrow.textContent = '▶';
            arrow.style.transform = 'rotate(0deg)';
          }
        }
      }
    };

    // Add event listener to the popup container
    const popupElement = popupRef.current;
    if (popupElement) {
      popupElement.addEventListener('click', handleToggleClick);
    }

    // Cleanup
    return () => {
      if (popupElement) {
        popupElement.removeEventListener('click', handleToggleClick);
      }
    };
  }, [isVisible]);

  // Enhanced visibility check - popup should be visible if isVisible is true and we have nodeData
  if (!isVisible || !nodeData) {
    return null;
  }

  // Popup visibility check complete

  // Check if this is a Pinal marker that should use the Pinal formatter (check first)
  const isPinalMarker = Boolean(
    nodeData?.formatter === 'pinal' || 
    nodeData?.zonesAnalyzed ||
    nodeData?.category === 'Arizona Infrastructure Development'
  );
  
  // Check if this is a TDLR marker that should use the TDLR formatter (only if not Pinal)
  const isTDLRMarker = !isPinalMarker && Boolean(
    nodeData?.formatter === 'tdlr' || 
    nodeData?.type === 'tdlr' || 
    nodeData?.facility_name || 
    nodeData?.work_type ||
    nodeData?.project_name ||
    nodeData?.project_id
  );
  
  // Check if this is a startup marker that should use the rich formatter (only if not Pinal or TDLR)
  const isStartupMarker = !isPinalMarker && !isTDLRMarker && Boolean(
    nodeData?.formatter === 'startup' || 
    nodeData?.geographicIntelligence || 
    nodeData?.spatialInsights || 
    nodeData?.categoryColor
  );

  const isPowerMarker = !isPinalMarker && !isTDLRMarker && !isStartupMarker && Boolean(
    nodeData?.formatter === 'power'
  );
  
  // Debug logging removed - TDLR popup working correctly

  const rawX = popupPosition?.x || position?.x || 0;
  const rawY = popupPosition?.y || position?.y || 0;
  
  // Ensure position values are valid numbers and within reasonable bounds
  const currentX = isNaN(rawX) ? 0 : Math.max(0, Math.min(rawX, window.innerWidth - 50));
  const currentY = isNaN(rawY) ? 0 : Math.max(0, Math.min(rawY, window.innerHeight - 50));
  
  // Calculate final position with offsets, ensuring no negative values
  const finalLeft = (isPinalMarker || isStartupMarker || isTDLRMarker || isPowerMarker) ? Math.max(0, currentX - 120) : Math.max(0, currentX - 40);
  
  // Dynamic top offset based on marker type
  let topOffset = 270; // Default offset raised by 100px
  if (isPinalMarker && nodeData?.id === 'casa-grande-marker') {
    topOffset = 366; // Move Casa Grande popup up by 100px more
  }
  const finalTop = Math.max(0, currentY - topOffset);
  
  // Debug log to track position changes (only log significant changes)
  // Position calculation complete

  const popupStyle = {
    position: 'fixed',
    left: `${finalLeft}px`,
    top: `${finalTop}px`,
    width: (isPinalMarker || isStartupMarker || isTDLRMarker || isPowerMarker) ? '238px' : '80px', // Reduced by 15% for rich popups
    maxHeight: (isPinalMarker || isStartupMarker || isTDLRMarker || isPowerMarker) ? '250px' : 'auto', // Reduced height for rich data
    backgroundColor: 'transparent', // Remove background from main container
    border: 'none', // Remove border from main container
    borderRadius: '0', // Remove border radius from main container
    padding: '0', // Remove padding from main container
    color: '#ffffff',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', // Match BaseCard font
    fontSize: (isStartupMarker || isTDLRMarker || isPowerMarker) ? '11px' : '11px', // Match BaseCard font size
    lineHeight: '1.4',
    zIndex: 1000, // Match BaseCard z-index
    boxShadow: 'none', // Remove box shadow from main container
    backdropFilter: 'none', // Remove backdrop filter from main container
    pointerEvents: 'auto',
    animation: isPulsing ? 'fadeIn 0.2s ease-out, popupPulse 1.5s ease-in-out infinite' : 'fadeIn 0.2s ease-out',
    textAlign: 'left',
    overflowY: (isStartupMarker || isTDLRMarker || isPowerMarker) ? 'auto' : 'visible', // Allow scrolling for rich data
    userSelect: 'none' // Match BaseCard user select
  };

  const addressStyle = {
    fontSize: '11px',
    fontWeight: '600',
    color: '#60a5fa',
    margin: '0 0 6px 0',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
    lineHeight: '1.3',
    wordWrap: 'break-word'
  };

  const categoryStyle = {
    fontSize: '9px',
    color: '#9ca3af',
    margin: '0 0 4px 0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '500'
  };

  const nameStyle = {
    fontSize: '10px',
    color: '#d1d5db',
    margin: '0',
    fontWeight: '400'
  };

  const closeButtonStyle = {
    position: 'absolute',
    top: '4px',
    left: '213px', // Adjusted for smaller card (238px - 25px = 213px)
    background: 'rgba(0, 0, 0, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    color: 'rgba(255, 255, 255, 0.9)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px',
    borderRadius: '3px',
    transition: 'all 0.2s ease',
    lineHeight: '1',
    width: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1002
  };

  return (
    <>
      {/* Add CSS animations */}
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes popupPulse {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 20px rgba(59, 130, 246, 0.4), 0 8px 32px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2);
            }
            50% {
              transform: scale(1.02);
              box-shadow: 0 0 30px rgba(59, 130, 246, 0.6), 0 8px 32px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2);
            }
          }
        `}
      </style>
      
      <div ref={popupRef} style={popupStyle} data-marker-popup>
      {/* Drag Handle - Large invisible area for easier dragging */}
      <div
        style={{
          position: 'absolute',
          top: '0',
          right: '25px', // Adjusted to avoid the closer close button (was 40px)
          width: '60px',
          height: '40px',
          cursor: isDragging ? 'grabbing' : 'grab',
          zIndex: 1001,
          pointerEvents: 'auto',
          background: 'transparent' // Completely invisible
        }}
        onMouseDown={handleMouseDown}
        title="Drag to move popup"
      />
      
      <button
        style={closeButtonStyle}
        onClick={onClose}
        onMouseEnter={(e) => {
          e.target.style.color = 'rgba(255, 255, 255, 1)';
          e.target.style.background = 'rgba(220, 38, 38, 0.8)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.6)';
        }}
        onMouseLeave={(e) => {
          e.target.style.color = 'rgba(255, 255, 255, 0.9)';
          e.target.style.background = 'rgba(0, 0, 0, 0.6)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        }}
        title="Close popup"
      >
        ×
      </button>
      
      {isPinalMarker ? (
        // Check if this is a typewriter-enhanced popup
        (() => {
          const formattedData = formatPinalData(nodeData);
          if (formattedData.includes('__PINALTYPEWRITER__')) {
            // Extract the typewriter data
            const match = formattedData.match(/__PINALTYPEWRITER__(.*?)__PINALTYPEWRITER__/);
            if (match) {
              try {
                const typewriterData = JSON.parse(match[1]);
                return (
                  <TypewriterPopupCard
                    content={typewriterData.enhancedContent}
                    theme={typewriterData.theme}
                    header={
                      <div>
                        <div style={{
                          fontSize: '24px',
                          fontWeight: '700',
                          color: '#f9fafb',
                          marginBottom: '4px'
                        }}>
                          {typewriterData.name}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '500',
                          color: '#9ca3af'
                        }}>
                          {typewriterData.zone}
                        </div>
                      </div>
                    }
                    shouldStart={isVisible}
                    enableTypewriter={!isManualClick} // Disable typewriter for manual clicks
                    style={{
                      position: 'relative',
                      zIndex: 1000
                    }}
                  />
                );
              } catch (error) {
                console.warn('Failed to parse typewriter data:', error);
                // Fallback to regular HTML
                return <div dangerouslySetInnerHTML={{ __html: formattedData }} />;
              }
            }
          }
          // Fallback to regular HTML for non-typewriter popups
          return <div dangerouslySetInnerHTML={{ __html: formattedData }} />;
        })()
      ) : isStartupMarker ? (
        // Use rich startup data formatter
        <div dangerouslySetInnerHTML={{ __html: formatStartupData(nodeData) }} />
      ) : isTDLRMarker ? (
        // Use TDLR data formatter
        <div dangerouslySetInnerHTML={{ __html: formatTDLRData(nodeData) }} />
      ) : isPowerMarker && nodeData.content ? (
        <TypewriterPopupCard
          content={nodeData.content}
          theme={nodeData.theme || 'blue'}
          header={
            <div>
              <div style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#f9fafb',
                marginBottom: '4px'
              }}>
                {nodeData.name}
              </div>
              <div style={{
                fontSize: '11px',
                fontWeight: '500',
                color: '#9ca3af'
              }}>
                {nodeData.siteName ? `${nodeData.siteName}${nodeData.maxVoltageKv ? ` • ${nodeData.maxVoltageKv} kV` : ''}` : nodeData.maxVoltageKv ? `${nodeData.maxVoltageKv} kV tier` : 'Power infrastructure'}
              </div>
            </div>
          }
          shouldStart={isVisible}
          enableTypewriter={!isManualClick}
          style={{
            position: 'relative',
            zIndex: 1000
          }}
        />
      ) : (
        // Use simple formatter for other markers
        <>
          <div style={addressStyle}>
            {nodeData.address || nodeData.name || 'Infrastructure'}
          </div>
          
          <div style={categoryStyle}>
            {nodeData.type?.split(' ')[0] || 'INFRASTRUCTURE'}
          </div>
          
          <div style={nameStyle} title={nodeData.name}>
            {nodeData.name || 'Unknown'}
          </div>
        </>
      )}
      </div>
    </>
  );
};

export default MarkerPopupCard;
