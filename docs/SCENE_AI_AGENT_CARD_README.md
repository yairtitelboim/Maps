# Scene AI Agent Card Documentation

## Overview

The `SceneAIAgentCard` component displays contextual AI analysis information when specific scenes (Stillwater or Pryor) are loaded. It features a typewriter animation, yellow pulse effects, and automatic reset functionality.

## Component Architecture

### Files Involved

1. **`src/components/Map/components/Cards/SceneAIAgentCard.jsx`**
   - Main component that displays the AI analysis card
   - Handles typewriter animation, pulse effects, and content rendering

2. **`src/components/Map/legend/components/VisibilityPresets.jsx`**
   - Manages visibility presets/scenes
   - Detects Stillwater and Pryor scenes
   - Controls when to show/hide the AI Agent card

## How Scene Detection Works

### Scene Identification

The system identifies scenes using two methods:

1. **Position-based detection:**
   - First scene in the presets array → Stillwater
   - Second scene in the presets array → Pryor

2. **Name-based detection:**
   - Scene name contains "stillwater" or "oklahoma" → Stillwater
   - Scene name contains "pryor" → Pryor

**Code Location:** `VisibilityPresets.jsx` lines 66-75

```javascript
const presetIndex = visibilityPresets.findIndex(p => p.id === presetId);
const isFirstScene = presetIndex === 0;
const isSecondScene = presetIndex === 1;

const nameLower = preset.name ? preset.name.toLowerCase() : '';
const nameMatchesStillwater = nameLower.includes('stillwater') || nameLower.includes('oklahoma');
const nameMatchesPryor = nameLower.includes('pryor');

const isStillwaterScene = isFirstScene || nameMatchesStillwater;
const isPryorScene = isSecondScene || nameMatchesPryor;
```

## Animation Sequence

### Timeline

1. **Scene Load (0s)**
   - Camera transition begins (3 seconds)
   - Card becomes visible
   - Yellow pulse border animation starts

2. **After Camera Transition (4s)**
   - Typewriter animation begins
   - Text types out character by character over 2.5 seconds

3. **Animation Complete (6.5s)**
   - Full text displayed
   - Yellow pulse border stops
   - Green dot pulse stops
   - Yellow pulsing circle continues

### Animation Reset Mechanism

When the same scene is clicked again:

1. **Detection** (`VisibilityPresets.jsx` line 78):
   ```javascript
   const isSameScene = activePresetId === presetId && (isStillwaterScene || isPryorScene);
   ```

2. **Reset Process**:
   - Card is hidden briefly (triggers cleanup)
   - `resetKey` is incremented (forces component reset)
   - Card is shown again after 100ms
   - Animation sequence restarts from the beginning

3. **Component Reset** (`SceneAIAgentCard.jsx` lines 24-37):
   - Detects `resetKey` change
   - Cleans up existing timeouts
   - Resets all state variables
   - Restarts animation sequence

## Content Configuration

### Scene Content

Content is defined in `SCENE_CONTENT` object:

```javascript
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
```

**Location:** `SceneAIAgentCard.jsx` lines 3-12

## Handling Placeholder Scenes

### Problem

When saved scenes are reset/removed, the system needs to display placeholder scenes that still trigger the AI Agent card.

### Solution: Placeholder Scene Structure

Create placeholder scenes with the following structure:

```javascript
const PLACEHOLDER_SCENES = {
  stillwater: {
    id: 'placeholder-stillwater',
    name: 'Stillwater',
    timestamp: new Date().toISOString(),
    visibilityState: {
      // Default visibility state for Stillwater scene
      mapState: {
        center: [-97.0586, 36.1156], // Stillwater coordinates
        zoom: 10,
        bearing: 0,
        pitch: 0
      },
      // ... other visibility states
    }
  },
  pryor: {
    id: 'placeholder-pryor',
    name: 'Pryor',
    timestamp: new Date().toISOString(),
    visibilityState: {
      // Default visibility state for Pryor scene
      mapState: {
        center: [-95.3167, 36.3081], // Pryor coordinates
        zoom: 10,
        bearing: 0,
        pitch: 0
      },
      // ... other visibility states
    }
  }
};
```

### Implementation Steps

1. **Create Placeholder Scene Loader**

   Add to `VisibilityPresets.jsx`:

   ```javascript
   // Function to load placeholder scene
   const loadPlaceholderScene = useCallback((sceneType) => {
     const placeholder = PLACEHOLDER_SCENES[sceneType];
     if (placeholder && onLoadPreset) {
       onLoadPreset(placeholder);
       setActivePresetId(placeholder.id);
       
       if (sceneType === 'stillwater') {
         setSceneType('stillwater');
         setTimeout(() => {
           setShowAIAgentCard(true);
         }, 800);
       } else if (sceneType === 'pryor') {
         setSceneType('pryor');
         setTimeout(() => {
           setShowAIAgentCard(true);
         }, 800);
       }
     }
   }, [onLoadPreset]);
   ```

2. **Initialize Placeholder Scenes on Mount**

   Add to `VisibilityPresets.jsx`:

   ```javascript
   useEffect(() => {
     // Check if presets are empty or don't contain Stillwater/Pryor
     const hasStillwater = visibilityPresets.some(p => 
       p.name?.toLowerCase().includes('stillwater') || 
       p.name?.toLowerCase().includes('oklahoma') ||
       visibilityPresets.indexOf(p) === 0
     );
     
     const hasPryor = visibilityPresets.some(p => 
       p.name?.toLowerCase().includes('pryor') ||
       visibilityPresets.indexOf(p) === 1
     );
     
     // If no scenes exist, create placeholders
     if (visibilityPresets.length === 0) {
       // Optionally auto-load Stillwater placeholder
       // loadPlaceholderScene('stillwater');
     }
   }, [visibilityPresets]);
   ```

3. **Add Placeholder Scene Button/Trigger**

   Add UI element to trigger placeholder scene loading:

   ```javascript
   <button onClick={() => loadPlaceholderScene('stillwater')}>
     Load Stillwater Placeholder
   </button>
   <button onClick={() => loadPlaceholderScene('pryor')}>
     Load Pryor Placeholder
   </button>
   ```

## Component Props

### SceneAIAgentCard Props

```typescript
interface SceneAIAgentCardProps {
  isVisible: boolean;           // Controls card visibility
  onClose: () => void;           // Close handler (currently unused, card can't be closed)
  sceneType: 'stillwater' | 'pryor';  // Which scene content to display
  resetKey: number;             // Increments to force animation reset
}
```

### VisibilityPresets Integration

The card is rendered conditionally:

```javascript
{isSupportedScene && isActive && (
  <SceneAIAgentCard
    isVisible={showAIAgentCard}
    onClose={() => setShowAIAgentCard(false)}
    sceneType={isStillwaterScene ? 'stillwater' : 'pryor'}
    resetKey={animationResetKey}
  />
)}
```

## Visual Features

### Yellow Theme

All elements use yellow (`#fbbf24` / `rgba(251, 191, 36, ...)`):

- **Header circle icon**: Yellow pulsing dot
- **Header text**: "AI ANALYSIS" in yellow
- **Bold text**: Markdown bold text in yellow
- **Typewriter cursor**: Yellow blinking cursor
- **Border**: Yellow pulsing border (when animating)
- **Right circle**: Yellow pulsing circle (always)

### Animations

1. **Yellow Pulse Border** (`yellowPulse`):
   - Duration: 1.5s
   - Border color pulses from 0.3 to 0.6 opacity
   - Box-shadow intensity increases

2. **Yellow Pulse Circle** (`yellowPulseCircle`):
   - Duration: 1.5s
   - Scale: 1.0 → 1.2
   - Opacity: 1.0 → 0.7
   - Continuous animation

3. **Green Dot Pulse** (`pulse`):
   - Duration: 2s
   - Only active during typing
   - Stops when animation completes

4. **Typewriter Effect**:
   - Starts 4 seconds after scene load (3s camera + 1s delay)
   - Types over 2.5 seconds
   - Variable speed (faster for spaces, slower for punctuation)

## State Management

### SceneAIAgentCard State

```javascript
const [displayedText, setDisplayedText] = useState('');      // Current text being displayed
const [isTyping, setIsTyping] = useState(false);             // Whether typewriter is active
const [shouldPulse, setShouldPulse] = useState(true);       // Controls pulse animations
```

### VisibilityPresets State

```javascript
const [showAIAgentCard, setShowAIAgentCard] = useState(false);  // Card visibility
const [activePresetId, setActivePresetId] = useState(null);    // Currently active scene
const [sceneType, setSceneType] = useState('stillwater');       // Scene type for content
const [animationResetKey, setAnimationResetKey] = useState(0);  // Forces animation reset
```

## Cleanup and Reset

### Timeout Cleanup

The component properly cleans up timeouts:

1. **On reset**: Clears existing timeouts before restarting
2. **On hide**: Clears all timeouts when card is hidden
3. **On unmount**: Clears timeouts in useEffect cleanup

### Reset Triggers

Animation resets when:
- `resetKey` prop changes (same scene clicked again)
- `isVisible` changes from false to true (new scene loaded)
- `sceneType` changes (switching between Stillwater and Pryor)

## Best Practices

1. **Always provide placeholder scenes** when saved scenes are reset
2. **Use descriptive scene names** that include "stillwater", "oklahoma", or "pryor" for reliable detection
3. **Maintain scene order** - first scene = Stillwater, second = Pryor (if names don't match)
4. **Test animation reset** by clicking the same scene multiple times
5. **Ensure proper cleanup** - timeouts must be cleared to prevent memory leaks

## Troubleshooting

### Card doesn't appear

- Check if scene is detected as Stillwater or Pryor
- Verify `showAIAgentCard` state is set to `true`
- Ensure `isActive` matches the clicked preset ID

### Animation doesn't reset

- Verify `resetKey` is being incremented
- Check that `isSameScene` detection is working
- Ensure timeouts are being cleared properly

### Wrong content displayed

- Check `sceneType` prop is correct
- Verify `SCENE_CONTENT` object has the correct scene type
- Ensure scene detection logic is working

## Future Enhancements

1. **Add more scene types** beyond Stillwater and Pryor
2. **Dynamic content loading** from API or data source
3. **Customizable animation timing** per scene
4. **Multiple cards** for scenes with multiple analysis points
5. **Interactive elements** within the card content

