import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * TYPEWRITER ANIMATION IMPLEMENTATION
 * 
 * Creates realistic typing effect with blinking cursor on dark-themed popup cards
 * Enhanced for Pinal County infrastructure analysis popups
 */

// ==========================================
// 1. ANIMATION CONFIGURATION
// ==========================================

const TYPEWRITER_CONFIG = {
  // Speed & Timing
  typingSpeed: 0.3,            // Faster typing speed (reduced from 1ms to 0.3ms)
  blinkDuration: '1s',          // Cursor blink cycle
  
  // Visual Elements
  cursorChar: '|',              // Pipe character for cursor
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: '10px',             // 20% smaller than 12px
  lineHeight: '1.4',            // Comfortable line spacing
  
  // Colors by Theme
  themes: {
    green: {
      background: 'rgba(17, 24, 39, 0.96)',  // Dark background matching existing
      border: '#10b981',                      // Green border (emerald-500)
      textColor: '#d1d5db',                   // Light gray text
      boldColor: '#10b981',                   // Bright green for bold
      cursorColor: '#10b981'                  // Green cursor
    },
    blue: {
      background: 'rgba(17, 24, 39, 0.96)',  // Same dark background
      border: '#3b82f6',                      // Blue border (blue-500)
      textColor: '#d1d5db',                   // Light gray text
      boldColor: '#3b82f6',                   // Bright blue for bold
      cursorColor: '#3b82f6'                  // Blue cursor
    },
    purple: {
      background: 'rgba(17, 24, 39, 0.96)',  // Same dark background
      border: '#7c3aed',                      // Purple border (violet-500)
      textColor: '#d1d5db',                   // Light gray text
      boldColor: '#7c3aed',                   // Bright purple for bold
      cursorColor: '#7c3aed'                  // Purple cursor
    },
    red: {
      background: 'rgba(17, 24, 39, 0.96)',  // Same dark background
      border: '#ef4444',                      // Red border (red-500)
      textColor: '#d1d5db',                   // Light gray text
      boldColor: '#ef4444',                   // Bright red for bold
      cursorColor: '#ef4444'                  // Red cursor
    },
    cyan: {
      background: 'rgba(17, 24, 39, 0.96)',  // Same dark background
      border: '#06b6d4',                      // Cyan border (cyan-500)
      textColor: '#d1d5db',                   // Light gray text
      boldColor: '#06b6d4',                   // Bright cyan for bold
      cursorColor: '#06b6d4'                  // Cyan cursor
    },
    orange: {
      background: 'rgba(17, 24, 39, 0.96)',  // Same dark background
      border: '#f97316',                      // Orange border (orange-500)
      textColor: '#d1d5db',                   // Light gray text
      boldColor: '#f97316',                   // Bright orange for bold
      cursorColor: '#f97316'                  // Orange cursor
    },
    yellow: {
      background: 'rgba(17, 24, 39, 0.96)',  // Same dark background
      border: '#fbbf24',                      // Yellow border (amber-400)
      textColor: '#d1d5db',                   // Light gray text
      boldColor: '#fbbf24',                   // Bright yellow for bold
      cursorColor: '#fbbf24'                  // Yellow cursor
    },
    amber: {
      background: 'rgba(17, 24, 39, 0.96)',  // Same dark background
      border: '#f59e0b',                      // Amber border (amber-500)
      textColor: '#d1d5db',                   // Light gray text
      boldColor: '#f59e0b',                   // Bright amber for bold
      cursorColor: '#f59e0b'                  // Amber cursor
    }
  }
};

// ==========================================
// 2. TYPEWRITER ANIMATION LOGIC
// ==========================================

// Utility to reduce description length by ~50% while preserving sentence boundaries when possible
const reduceDescriptionByHalf = (text) => {
  if (!text || typeof text !== 'string') return text;
  // Split on sentence boundaries
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length <= 1) {
    // Fallback: truncate words by half
    const words = text.split(/\s+/);
    const halfWordCount = Math.max(1, Math.ceil(words.length / 2));
    return words.slice(0, halfWordCount).join(' ');
  }
  const halfCount = Math.max(1, Math.ceil(sentences.length / 2));
  return sentences.slice(0, halfCount).join(' ');
};

const useTypewriterAnimation = (content, shouldStart = true, enableTypewriter = true) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showToggleBall, setShowToggleBall] = useState(false);

  // Main typewriter effect
  useEffect(() => {
    if (content?.description && shouldStart && !isTyping) {
      const reduced = reduceDescriptionByHalf(content.description);
      if (enableTypewriter) {
        // Delay typewriter start: 0.8s (popup animation) + 0.5s (hold) = 1.3s total
        const typewriterDelay = 1300;
        
        setTimeout(() => {
          // Typewriter animation
          setIsTyping(true);
          setDisplayedText('');
          
          const fullText = reduced;
          let currentIndex = 0;
          
          const typeNextChar = () => {
            if (currentIndex < fullText.length) {
              // Add one character at a time
              setDisplayedText(fullText.slice(0, currentIndex + 1));
              currentIndex++;
              
              // Schedule next character
              setTimeout(typeNextChar, TYPEWRITER_CONFIG.typingSpeed);
            } else {
              // Animation complete
              setIsTyping(false);
              
              // Show interactive toggle ball if data exists
              if (content?.data && Object.keys(content.data).length > 0) {
                setTimeout(() => setShowToggleBall(true), 500); // Delay for effect
              }
            }
          };
          
          typeNextChar(); // Start the animation
        }, typewriterDelay);
      } else {
        // Show text immediately without animation
        setDisplayedText(reduced);
        setIsTyping(false);
        
        // Show interactive toggle ball if data exists
        if (content?.data && Object.keys(content.data).length > 0) {
          setTimeout(() => setShowToggleBall(true), 100); // Shorter delay for immediate display
        }
      }
    }
  }, [content?.description, shouldStart, enableTypewriter]);

  return { displayedText, isTyping, showToggleBall };
};

// ==========================================
// 3. CSS ANIMATIONS (Injected Dynamically)
// ==========================================

const TYPEWRITER_CSS = `
  /* Blinking cursor animation */
  @keyframes blink {
    0%, 50% { opacity: 1; }      /* Visible for first half */
    51%, 100% { opacity: 0; }    /* Hidden for second half */
  }
  
  /* Hectic popup entrance animation - pulse effect */
  @keyframes popupHecticEntrance {
    0% {
      opacity: 0;
      transform: scale(0.7);
    }
    40% {
      opacity: 1;
      transform: scale(1.15);
    }
    60% {
      transform: scale(0.95);
    }
    80% {
      transform: scale(1.05);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  /* Pulsing toggle ball (appears after typing) */
  @keyframes toggleBallPulse {
    0%, 100% { 
      opacity: 0.7;
      transform: scale(1);
    }
    50% { 
      opacity: 1;
      transform: scale(1.1);       /* 10% size increase */
    }
  }
  
  /* Data expansion animations */
  @keyframes dataRowsSlideIn {
    0% {
      max-height: 0;
      opacity: 0;
      transform: translateY(-10px);
    }
    100% {
      max-height: 200px;
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes dataRowFadeIn {
    0% {
      opacity: 0;
      transform: translateX(-5px);
    }
    100% {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  /* Power type icon micro animations */
  @keyframes windPulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.15);
    }
  }
  
  @keyframes hydroFlow {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.12);
      opacity: 0.9;
    }
  }
  
  @keyframes gasFlicker {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    25% {
      opacity: 0.7;
      transform: scale(0.95);
    }
    50% {
      opacity: 0.9;
      transform: scale(1.05);
    }
    75% {
      opacity: 0.8;
      transform: scale(0.98);
    }
  }
  
  .power-icon-wind svg {
    animation: windPulse 1.5s ease-in-out infinite;
    transform-origin: center;
  }
  
  .power-icon-hydro svg {
    animation: hydroFlow 2s ease-in-out infinite;
    transform-origin: center;
  }
  
  .power-icon-gas svg {
    animation: gasFlicker 1.5s ease-in-out infinite;
  }
`;

// ==========================================
// 4. TEXT RENDERING WITH MARKDOWN SUPPORT
// ==========================================

const renderTypewriterText = (displayedText, isTyping, theme) => {
  return (
    <p style={{
      margin: '0 0 8px 0',
      fontSize: TYPEWRITER_CONFIG.fontSize,
      color: TYPEWRITER_CONFIG.themes[theme].textColor,
      lineHeight: TYPEWRITER_CONFIG.lineHeight,
      fontFamily: TYPEWRITER_CONFIG.fontFamily,
      position: 'relative'
    }}>
      {/* Parse **bold** markdown syntax */}
      {displayedText.split('**').map((part, index) => {
        if (index % 2 === 1) {
          // Bold text (between ** markers)
          return (
            <span key={index} style={{
              fontWeight: 'bold',
              color: TYPEWRITER_CONFIG.themes[theme].boldColor
            }}>
              {part}
            </span>
          );
        }
        return part; // Regular text
      })}
      
      {/* Blinking cursor (only shown while typing) */}
      {isTyping && (
        <span style={{
          color: TYPEWRITER_CONFIG.themes[theme].cursorColor,
          animation: `blink ${TYPEWRITER_CONFIG.blinkDuration} infinite`
        }}>
          {TYPEWRITER_CONFIG.cursorChar}
        </span>
      )}
    </p>
  );
};

// ==========================================
// 5. INTERACTIVE TOGGLE BALL
// ==========================================

const ToggleBall = ({ theme, onClick }) => {
  return (
    <span 
      onClick={onClick}
      style={{
        display: 'inline-block',
        width: '6px', // 20% smaller than 8px
        height: '6px', // 20% smaller than 8px
        backgroundColor: TYPEWRITER_CONFIG.themes[theme].boldColor,
        borderRadius: '50%',
        marginLeft: '3px', // 20% smaller margin
        cursor: 'pointer',
        animation: 'toggleBallPulse 2s ease-in-out infinite',
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={(e) => {
        e.target.style.transform = 'scale(1.2)'; // 20% larger on hover
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = 'scale(1)';   // Return to normal
      }}
      title="More information"
    />
  );
};

// ==========================================
// 6. MAIN COMPONENT
// ==========================================

const TypewriterPopupCard = ({ 
  content, 
  theme = 'green',
  header = null,
  shouldStart = true,
  enableTypewriter = true,
  style = {},
  showDescription = true // Show description by default (for campus markers), hide for GRDA/OG&E
}) => {
  const { displayedText, isTyping, showToggleBall } = useTypewriterAnimation(content, shouldStart, enableTypewriter);
  const [isDataExpanded, setIsDataExpanded] = useState(false);
  const [showDataRows, setShowDataRows] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const cardRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const popupElementRef = useRef(null);
  const savedPositionRef = useRef({ left: null, top: null });
  const mapboxPopupRef = useRef(null);

  // Inject CSS animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = TYPEWRITER_CSS;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Ensure theme exists, fallback to green if not found
  const themeConfig = TYPEWRITER_CONFIG.themes[theme] || TYPEWRITER_CONFIG.themes.green;
  const themeColor = themeConfig.border;
  
  // Convert hex color to rgba for halo effect
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  const haloColor1 = hexToRgba(themeColor, 0.25); // 25% opacity for inner glow
  const haloColor2 = hexToRgba(themeColor, 0.15); // 15% opacity for outer glow
  
  // Find the parent Mapbox popup element and its map instance
  const findMapboxPopup = useCallback(() => {
    if (!cardRef.current) return { element: null, mapInstance: null };
    let element = cardRef.current.parentElement;
    while (element) {
      if (element.classList.contains('mapboxgl-popup')) {
        // Try to get map instance from popup
        let mapInstance = null;
        // Check if popup has _mapboxPopup property (internal Mapbox reference)
        if (element._mapboxPopup?.getMap) {
          mapInstance = element._mapboxPopup.getMap();
        }
        // Try window.map.current
        else if (window.map?.current) {
          mapInstance = window.map.current;
        }
        // Try window.mapboxMap
        else if (window.mapboxMap) {
          mapInstance = window.mapboxMap;
        }
        return { element, mapInstance };
      }
      element = element.parentElement;
    }
    return { element: null, mapInstance: null };
  }, []);

  // Drag handling
  const handleMouseDown = useCallback((e) => {
    // Don't drag if clicking on toggle ball or capacity badge
    if (e.target.closest('.capacity-badge') || e.target.closest('[title="More information"]')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const { element: popupElement, mapInstance } = findMapboxPopup();
    if (!popupElement) return;
    
    popupElementRef.current = popupElement;
    
    // Store map instance for later use
    if (mapInstance) {
      popupElementRef.current._mapInstance = mapInstance;
    }
    
    // Get current popup position BEFORE converting to fixed
    // Use getBoundingClientRect to get the actual screen position
    const rect = popupElement.getBoundingClientRect();
    const currentLeft = rect.left;
    const currentTop = rect.top;
    
    // Calculate offset between mouse and popup position FIRST (before any changes)
    // This is the key - calculate offset using the current position
    dragStartRef.current = {
      x: e.clientX - currentLeft,
      y: e.clientY - currentTop
    };
    
    // NOW convert to fixed positioning (after calculating offset)
    // This prevents Mapbox from repositioning it
    popupElement.style.position = 'fixed';
    popupElement.style.left = `${currentLeft}px`;
    popupElement.style.top = `${currentTop}px`;
    popupElement.style.transform = 'none';
    popupElement.style.margin = '0';
    popupElement.setAttribute('data-manually-positioned', 'true');
    
    // Save position to ref
    savedPositionRef.current = {
      left: `${currentLeft}px`,
      top: `${currentTop}px`
    };
    
    // Disable Mapbox's automatic repositioning
    const mapboxPopup = popupElement._mapboxPopup || popupElement.closest('.mapboxgl-popup')?._mapboxPopup;
    if (mapboxPopup) {
      mapboxPopupRef.current = mapboxPopup;
      mapboxPopup.options.closeOnMove = false;
      mapboxPopup.options.closeOnClick = false;
      // Prevent Mapbox from updating position
      if (mapboxPopup._update) {
        const originalUpdate = mapboxPopup._update;
        mapboxPopup._update = function() {
          // Don't update if manually positioned
          if (popupElement.getAttribute('data-manually-positioned') === 'true') {
            return;
          }
          return originalUpdate.apply(this, arguments);
        };
      }
      if (mapboxPopup._marker) {
        mapboxPopup._marker._popup = null;
      }
    }
    
    setIsDragging(true);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    
    // Define mouse move handler (inside mouseDown for closure access)
    const handleGlobalMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      
      if (!popupElementRef.current) return;
      
      // Calculate new position using offset (like Texas project)
      // This formula ensures the popup follows the mouse smoothly
      const newX = moveEvent.clientX - dragStartRef.current.x;
      const newY = moveEvent.clientY - dragStartRef.current.y;
      
      // Keep popup within viewport bounds
      const popupWidth = 197;
      const popupHeight = 200;
      
      const boundedX = Math.max(0, Math.min(newX, window.innerWidth - popupWidth));
      const boundedY = Math.max(0, Math.min(newY, window.innerHeight - popupHeight));
      
      popupElementRef.current.style.left = `${boundedX}px`;
      popupElementRef.current.style.top = `${boundedY}px`;
      
      // Update saved position
      savedPositionRef.current = {
        left: `${boundedX}px`,
        top: `${boundedY}px`
      };
    };
    
    // Define mouse up handler
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setIsPinned(true); // Auto-pin when dragged (like Texas project)
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Clean up global event listeners
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
    
    // Add global mouse event listeners (works even if cursor leaves card)
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  }, [findMapboxPopup]);

  // Prevent text selection during drag
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none';
      return () => {
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging]);

  // Prevent Mapbox from repositioning manually positioned popups (only when pinned and not dragging)
  useEffect(() => {
    if (!isPinned || isDragging) return; // Only prevent repositioning when pinned AND not dragging
    
    const { element: popupElement, mapInstance } = findMapboxPopup();
    if (!popupElement) return;

    // Use stored map instance or try to find it
    const map = popupElement._mapInstance || mapInstance || window.map?.current || window.mapboxMap;
    if (!map || typeof map.on !== 'function') return;

    // Function to enforce position - call this aggressively
    const enforcePosition = () => {
      // Don't enforce during drag
      if (!isPinned || isDragging) return;
      
      const currentPopup = popupElementRef.current || popupElement;
      if (!currentPopup) return;
      
      if (currentPopup.getAttribute('data-manually-positioned') === 'true') {
        const savedLeft = savedPositionRef.current.left;
        const savedTop = savedPositionRef.current.top;
        
        if (savedLeft && savedTop) {
          // Force restore position immediately - use !important via setProperty
          currentPopup.style.setProperty('position', 'fixed', 'important');
          currentPopup.style.setProperty('left', savedLeft, 'important');
          currentPopup.style.setProperty('top', savedTop, 'important');
          currentPopup.style.setProperty('transform', 'none', 'important');
          currentPopup.style.setProperty('margin', '0', 'important');
          currentPopup.style.setProperty('pointer-events', 'auto', 'important');
          
          // Also update the Mapbox popup container if it exists
          if (mapboxPopupRef.current && mapboxPopupRef.current._container) {
            mapboxPopupRef.current._container.style.setProperty('position', 'fixed', 'important');
            mapboxPopupRef.current._container.style.setProperty('transform', 'none', 'important');
          }
        }
      }
    };

    // Use MutationObserver to catch when Mapbox changes the position
    const observer = new MutationObserver(() => {
      enforcePosition();
    });

    // Observe the popup element for style changes
    observer.observe(popupElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: false,
      subtree: false
    });

    // Use requestAnimationFrame to continuously enforce position (very aggressive)
    let rafId = null;
    const rafEnforce = () => {
      if (!isPinned || isDragging) {
        if (rafId) cancelAnimationFrame(rafId);
        return;
      }
      enforcePosition();
      rafId = requestAnimationFrame(rafEnforce);
    };
    
    rafId = requestAnimationFrame(rafEnforce);

    // Listen to map events - use immediate execution, not delayed
    const preventRepositioning = () => {
      // Use double RAF to ensure we run after Mapbox's positioning
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          enforcePosition();
        });
      });
    };

    // Listen to all events that could cause repositioning
    map.on('move', preventRepositioning);
    map.on('moveend', preventRepositioning);
    map.on('zoom', preventRepositioning);
    map.on('zoomstart', preventRepositioning); // Also listen to zoomstart
    map.on('zoomend', preventRepositioning);
    map.on('rotate', preventRepositioning);
    map.on('pitch', preventRepositioning);
    map.on('resize', preventRepositioning);

    // Also use an interval as a last resort backup (every 50ms)
    const intervalId = setInterval(() => {
      if (isPinned && !isDragging) {
        enforcePosition();
      }
    }, 50);

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      clearInterval(intervalId);
      if (map && typeof map.off === 'function') {
        map.off('move', preventRepositioning);
        map.off('moveend', preventRepositioning);
        map.off('zoom', preventRepositioning);
        map.off('zoomstart', preventRepositioning);
        map.off('zoomend', preventRepositioning);
        map.off('rotate', preventRepositioning);
        map.off('pitch', preventRepositioning);
        map.off('resize', preventRepositioning);
      }
    };
  }, [findMapboxPopup, isPinned, isDragging]);
  
  return (
    <div 
      ref={cardRef}
      style={{
        width: '197px', // 15% wider than 171px (171 * 1.15 = 196.65)
        minHeight: '96px', // 20% smaller than 120px
        backgroundColor: TYPEWRITER_CONFIG.themes[theme].background,
        border: `1px solid ${themeColor}`,
        borderRadius: '8px', // 20% smaller than 10px
        padding: '0',
        backdropFilter: 'blur(10px)',
        boxShadow: `0 10px 30px rgba(0, 0, 0, 0.35), 0 0 20px ${haloColor1}, 0 0 40px ${haloColor2}`, // Added theme-colored halo
        fontFamily: TYPEWRITER_CONFIG.fontFamily,
        overflow: 'hidden',
        animationName: 'popupHecticEntrance',
        animationDuration: '0.8s',
        animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        animationDelay: '0s',
        animationFillMode: 'forwards',
        ...style
      }}
    >
      {/* Header (if provided) - draggable */}
      {header && (
        <div 
          onMouseDown={handleMouseDown}
          style={{
            padding: '10px 12px', // 20% smaller padding
            background: isDragging ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            borderBottom: `1px solid ${hexToRgba(themeColor, 0.25)}`, // Subtle theme-colored border
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '8px',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            transition: 'background-color 0.2s ease'
          }}
          title="Drag to move popup"
        >
          <div style={{ flex: 1 }}>
          {/* Clone header and apply theme color to text elements */}
          {React.cloneElement(header, {
            children: React.Children.map(header.props.children, (child) => {
              if (React.isValidElement(child) && child.props.style) {
                const fontSize = child.props.style.fontSize;
                  // Apply theme color to the main header text (fontSize 20px -> 16px, 20% smaller)
                if (fontSize === '20px' || fontSize === 20) {
                  return React.cloneElement(child, {
                    style: {
                      ...child.props.style,
                        fontSize: '16px', // 20% smaller
                      color: TYPEWRITER_CONFIG.themes[theme].boldColor // Theme color for header
                    }
                  });
                }
                  // Apply theme color to subtitle (fontSize 11px -> 9px, 20% smaller)
                  if (fontSize === '11px' || fontSize === 11) {
                    return React.cloneElement(child, {
                      style: {
                        ...child.props.style,
                        fontSize: '9px', // 20% smaller
                      }
                    });
                  }
                  // Apply theme color to Capacity indicator (fontSize 13px -> 10px, 20% smaller)
                if (fontSize === '13px' || fontSize === 13) {
                  return React.cloneElement(child, {
                    style: {
                      ...child.props.style,
                        fontSize: '10px', // 20% smaller
                        padding: '3px 6px', // 20% smaller padding
                      color: TYPEWRITER_CONFIG.themes[theme].boldColor, // Theme color for capacity text
                      backgroundColor: hexToRgba(themeColor, 0.15), // Subtle theme-colored background
                      border: `1px solid ${hexToRgba(themeColor, 0.3)}` // Subtle theme-colored border
                    }
                  });
                }
              }
              return child;
            })
          })}
        </div>
          {/* Interactive toggle ball moved to header (appears after typing) */}
        {showToggleBall && !isTyping && (
            <div style={{ flexShrink: 0, marginTop: '2px' }}>
          <ToggleBall 
            theme={theme} 
            onClick={() => {
              setIsDataExpanded(!isDataExpanded);
              if (!isDataExpanded) {
                setShowDataRows(true);
              }
            }} 
          />
          </div>
        )}
      </div>
      )}
      
      {/* Content area - only show for campus markers (red "Site" popups) */}
      {showDescription && content?.description && (
        <div style={{ padding: '10px 12px' }}> {/* 20% smaller padding */}
          {/* Typewriter text with cursor */}
          {renderTypewriterText(displayedText, isTyping, theme)}
        </div>
      )}
      
      {/* Data section - expandable/collapsible (for power markers) */}
      {content?.data && isDataExpanded && showDataRows && (
        <div style={{
          padding: '8px 12px',
          borderTop: `1px solid ${hexToRgba(themeColor, 0.25)}`,
          animation: 'dataRowsSlideIn 0.5s ease-out'
        }}>
          {Object.entries(content.data).map(([key, value], index) => (
            <div
              key={key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                padding: '4px 0',
                fontSize: '9px',
                color: TYPEWRITER_CONFIG.themes[theme].textColor,
                animation: `dataRowFadeIn 0.3s ease-out ${index * 0.1}s both`,
                borderBottom: index < Object.keys(content.data).length - 1 
                  ? `1px solid ${hexToRgba(themeColor, 0.1)}` 
                  : 'none'
              }}
            >
              <span style={{
                fontWeight: '600',
                color: TYPEWRITER_CONFIG.themes[theme].boldColor,
                marginRight: '8px',
                flexShrink: 0
              }}>
                {key}:
              </span>
              <span style={{
                textAlign: 'right',
                flex: 1,
                wordBreak: 'break-word'
              }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export { TypewriterPopupCard, TYPEWRITER_CONFIG };
