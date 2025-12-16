# Marker Popup Micro Animation

## Overview

The marker popup micro animation provides a subtle, polished visual feedback when popups appear on the map. It consists of two coordinated animations: a fade-in entrance and a pulsing glow effect.

## Location

**Component**: `src/components/Map/components/Cards/MarkerPopupCard.jsx`

## Animation Details

### 1. Fade-In Animation (`fadeIn`)

**Duration**: 0.2 seconds  
**Easing**: `ease-out`  
**Effect**: 
- Opacity transitions from `0` to `1`
- Element translates upward by `10px` to `0px`

**Keyframes**:
```css
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
```

### 2. Pulse Animation (`popupPulse`)

**Duration**: 1.5 seconds  
**Easing**: `ease-in-out`  
**Repeat**: Infinite (while active)  
**Effect**:
- Scale transitions from `1` to `1.02` (2% growth)
- Blue glow intensifies from `rgba(59, 130, 246, 0.4)` to `rgba(59, 130, 246, 0.6)`
- Box shadow expands from `0 0 20px` to `0 0 30px`

**Keyframes**:
```css
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
```

## Trigger Logic

The animation is controlled by the `isPulsing` state in `MarkerPopupCard.jsx`:

```javascript
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
```

**Conditions for activation**:
- Popup is visible (`isVisible === true`)
- Node data exists (`nodeData` is present)
- Position is available (`position` is present)

**Auto-stop**: The pulse animation automatically stops after **3 seconds**.

## Animation Application

The animations are applied to the popup container via inline styles:

```javascript
const popupStyle = {
  // ... other styles ...
  animation: isPulsing 
    ? 'fadeIn 0.2s ease-out, popupPulse 1.5s ease-in-out infinite' 
    : 'fadeIn 0.2s ease-out',
  // ... other styles ...
};
```

**When pulsing is active**:
- Both `fadeIn` and `popupPulse` animations run
- `fadeIn` completes in 0.2s
- `popupPulse` continues infinitely until `isPulsing` becomes `false`

**When pulsing is inactive**:
- Only `fadeIn` animation runs (one-time entrance)

## Visual Effect

1. **Initial appearance**: Popup fades in smoothly with a slight upward motion
2. **Active pulse**: For 3 seconds, the popup gently pulses with a blue glow, drawing attention
3. **Static state**: After 3 seconds, the popup remains visible but stops pulsing

## Color Scheme

- **Primary glow color**: `rgba(59, 130, 246, 0.4)` → `rgba(59, 130, 246, 0.6)` (blue)
- **Shadow layers**: Multiple shadow layers create depth
  - Blue glow: `0 0 20px` → `0 0 30px`
  - Dark shadow: `0 8px 32px rgba(0, 0, 0, 0.3)`
  - Subtle shadow: `0 4px 16px rgba(0, 0, 0, 0.2)`

## Performance Considerations

- Animations use CSS transforms and opacity (GPU-accelerated)
- Pulse animation stops after 3 seconds to avoid continuous rendering
- Cleanup function ensures timers are cleared on unmount

## Usage in Other Components

To apply similar animation to other popup components:

1. Copy the keyframe definitions:
```css
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
```

2. Add state management:
```javascript
const [isPulsing, setIsPulsing] = useState(false);

useEffect(() => {
  if (isVisible) {
    setIsPulsing(true);
    const timer = setTimeout(() => setIsPulsing(false), 3000);
    return () => clearTimeout(timer);
  }
}, [isVisible]);
```

3. Apply to element:
```javascript
style={{
  animation: isPulsing 
    ? 'fadeIn 0.2s ease-out, popupPulse 1.5s ease-in-out infinite' 
    : 'fadeIn 0.2s ease-out'
}}
```

## Related Components

- **MarkerPopupManager.jsx**: Manages popup visibility and positioning
- **TypewriterPopupCard.jsx**: Enhanced popup with typewriter effect (uses similar fade-in)
- **BaseCard.jsx**: Base card component that may use similar animations

## Notes

- The animation is designed to be subtle and non-intrusive
- The 3-second pulse duration provides enough time to draw attention without being distracting
- The blue glow color (`rgba(59, 130, 246, ...)`) matches the application's primary blue theme
- The scale increase (1.02) is minimal to avoid layout shifts

