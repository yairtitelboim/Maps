import React, { useState, useEffect, useRef } from 'react';

const SCENE_CONTENT = {
  stillwater: {
    title: "AI ANALYSIS",
    description: `**Stillwater campus:** OG&E territory. 98 miles west of Pryor. $3B planned investment. Different utility. Different grid. Kaw Lake water source. If GRDA hits capacity, Google has OG&E backup. This grid redundancy strategy optimizes for resilience, not just cost.`
  },
  pryor: {
    title: "AI ANALYSIS",
    description: `**Pryor campus:** GRDA territory. Hydropower and wind generation. Public utility model. $4.4B invested since 2007. Grand Lake water source. If OG&E rates spike, Google has GRDA's public power backup. Grid redundancy enables independent scaling without single utility dependency.`
  }
};

const SceneAIAgentCard = ({ isVisible, onClose, sceneType = 'stillwater', resetKey = 0 }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [shouldPulse, setShouldPulse] = useState(true);
  const cardRef = useRef(null);
  const timeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastResetKeyRef = useRef(resetKey);

  useEffect(() => {
    // Reset if resetKey changed (scene was clicked again)
    const shouldReset = lastResetKeyRef.current !== resetKey;
    if (shouldReset) {
      lastResetKeyRef.current = resetKey;
      // Clean up any existing timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }

    if (isVisible) {
      setShouldPulse(true);
      setDisplayedText('');
      setIsTyping(false);
      
      // Camera transition is 3 seconds, wait 1 second after (4 seconds total)
      // Then start typewriter effect
      const cameraTransitionDuration = 3000; // 3 seconds
      const delayAfterCamera = 1000; // 1 second after camera completes
      const totalDelay = cameraTransitionDuration + delayAfterCamera; // 4 seconds total
      
      timeoutRef.current = setTimeout(() => {
        setIsTyping(true);
        
        const content = SCENE_CONTENT[sceneType] || SCENE_CONTENT.stillwater;
        const fullText = content.description;
        const totalDuration = 500; // 0.5 seconds total (5x faster)
        const totalChars = fullText.length;
        
        let currentIndex = 0;
        const startTime = Date.now();
        
        const typeNextChar = () => {
          if (currentIndex < fullText.length) {
            setDisplayedText(fullText.slice(0, currentIndex + 1));
            currentIndex++;
            
            // Calculate remaining time and adjust delay to finish exactly at 0.5 seconds
            const elapsed = Date.now() - startTime;
            const remaining = totalDuration - elapsed;
            const remainingChars = totalChars - currentIndex;
            
            // Variable typing speed - faster for spaces, slightly slower for punctuation
            const char = fullText[currentIndex - 1];
            let delayMultiplier = 1;
            if (char === ' ') {
              delayMultiplier = 0.5; // Faster for spaces
            } else if (char === '.' || char === '\n') {
              delayMultiplier = 1.5; // Slightly slower for punctuation
            }
            
            // Ensure we finish on time by adjusting delay based on remaining time (5x faster)
            const delay = remainingChars > 0 
              ? Math.max(1, Math.min(remaining / remainingChars * delayMultiplier, 6))
              : 0;
            
            typingTimeoutRef.current = setTimeout(typeNextChar, delay);
          } else {
            setIsTyping(false);
            setShouldPulse(false); // Stop pulse animation when typing completes
            setDisplayedText(fullText); // Ensure full text is displayed
          }
        };
        
        typeNextChar();
      }, totalDelay);
    } else if (!isVisible) {
      // Reset when card is hidden
      setDisplayedText('');
      setIsTyping(false);
      setShouldPulse(true);
      
      // Clean up timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
    
    return () => {
      // Cleanup on unmount
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isVisible, resetKey, sceneType]);

  if (!isVisible) return null;

  // Parse text for markdown-style bold (**text**)
  const renderText = (text) => {
    const parts = [];
    let lastIndex = 0;
    const boldRegex = /\*\*(.*?)\*\*/g;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before bold
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {text.slice(lastIndex, match.index)}
          </span>
        );
      }
      // Add bold text
      parts.push(
        <strong key={`bold-${match.index}`} style={{ color: '#fbbf24', fontWeight: '600' }}>
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.slice(lastIndex)}
        </span>
      );
    }
    return parts;
  };

  return (
    <div
      ref={cardRef}
      style={{
        marginTop: '8px',
        padding: '10px 12px',
        background: 'rgba(0, 0, 0, 0.7)',
        border: shouldPulse 
          ? '1px solid rgba(251, 191, 36, 0.3)' 
          : '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: '6px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        animation: shouldPulse 
          ? 'fadeIn 0.3s ease-out, yellowPulse 1.5s ease-in-out infinite' 
          : 'fadeIn 0.3s ease-out',
        backdropFilter: 'blur(8px)',
        boxShadow: shouldPulse 
          ? '0 0 20px rgba(251, 191, 36, 0.4), 0 4px 12px rgba(0, 0, 0, 0.3)' 
          : '0 4px 12px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#fbbf24',
            boxShadow: '0 0 6px rgba(251, 191, 36, 0.6)',
            animation: shouldPulse ? 'pulse 2s ease-in-out infinite' : 'none'
          }} />
          <span style={{
            fontSize: '10px',
            fontWeight: '600',
            color: '#fbbf24',
            letterSpacing: '0.3px',
            textTransform: 'uppercase'
          }}>
            {SCENE_CONTENT[sceneType]?.title || SCENE_CONTENT.stillwater.title}
          </span>
        </div>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#fbbf24',
          boxShadow: '0 0 8px rgba(251, 191, 36, 0.6)',
          animation: 'yellowPulseCircle 1.5s ease-in-out infinite'
        }} />
      </div>

      {/* Content */}
      <div style={{
        color: '#d1d5db',
        fontSize: '10px',
        lineHeight: '1.5',
        letterSpacing: '0.1px'
      }}>
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {renderText(displayedText)}
          {isTyping && (
            <span style={{
              color: '#fbbf24',
              animation: 'blink 1s infinite',
              marginLeft: '2px'
            }}>
              |
            </span>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: translateY(-4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
          }
        }
        @keyframes yellowPulse {
          0%, 100% {
            border-color: rgba(251, 191, 36, 0.3);
            box-shadow: 0 0 20px rgba(251, 191, 36, 0.4), 0 4px 12px rgba(0, 0, 0, 0.3);
          }
          50% {
            border-color: rgba(251, 191, 36, 0.6);
            box-shadow: 0 0 30px rgba(251, 191, 36, 0.6), 0 4px 16px rgba(0, 0, 0, 0.3);
          }
        }
        @keyframes yellowPulseCircle {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
            box-shadow: 0 0 8px rgba(251, 191, 36, 0.6);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.2);
            box-shadow: 0 0 12px rgba(251, 191, 36, 0.8);
          }
        }
      `}</style>
    </div>
  );
};

export default SceneAIAgentCard;

