# Red to Green Marker Color Change Plan

## Current Implementation Analysis

### Marker Creation (Lines 701-707)
```javascript
const marker = new mapboxgl.Marker({
  color: '#ef4444', // Red color for Pryor and Stillwater campuses
  scale: 1.2
})
.setLngLat([campus.lng, campus.lat])
.setPopup(popup)
.addTo(map.current);
```

### Popup Creation (Lines 669-675)
```javascript
const popup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: true,
  className: 'okc-campus-popup-transparent',
  anchor: 'bottom',
  offset: [0, -35]
}).setDOMContent(popupContainer);
```

## How It Works Currently

1. **Marker Mount**: Red teardrop marker is created with `color: '#ef4444'`
2. **Popup Attachment**: Popup is attached via `.setPopup(popup)`
3. **Click Behavior**: Mapbox automatically handles marker clicks to open/close popup
4. **No Color Change**: Currently, marker stays red when popup opens

## Implementation Plan

### Approach: Use Popup Events

**Key Insight**: Mapbox popups emit `open` and `close` events. We can listen to these without interfering with existing functionality.

### Step-by-Step Implementation

1. **Listen to Popup Open Event**
   - When popup opens, change marker from red to green
   - Access marker DOM element via `marker.getElement()`
   - Find SVG path element and change `fill` attribute

2. **Change Marker Color**
   - Mapbox markers use SVG internally
   - The marker element contains an SVG with a path
   - Change: `path.setAttribute('fill', '#22c55e')` (green)
   - Also change stroke if present

3. **Optional: Revert on Close**
   - Listen to `popup.on('close')` event
   - Revert color back to red when popup closes
   - OR keep it green permanently (user preference)

### Code Structure

```javascript
// After marker creation (line 707)
const marker = new mapboxgl.Marker({...})
  .setLngLat([campus.lng, campus.lat])
  .setPopup(popup)
  .addTo(map.current);

// Add color change handler
popup.on('open', () => {
  const markerElement = marker.getElement();
  if (markerElement) {
    const svg = markerElement.querySelector('svg');
    if (svg) {
      const path = svg.querySelector('path');
      if (path) {
        path.setAttribute('fill', '#22c55e'); // Green
        path.setAttribute('stroke', '#22c55e');
      }
    }
  }
});

// Optional: Revert on close
popup.on('close', () => {
  const markerElement = marker.getElement();
  if (markerElement) {
    const svg = markerElement.querySelector('svg');
    if (svg) {
      const path = svg.querySelector('path');
      if (path) {
        path.setAttribute('fill', '#ef4444'); // Red
        path.setAttribute('stroke', '#ef4444');
      }
    }
  }
});
```

## Benefits of This Approach

1. **Non-Intrusive**: Uses built-in Mapbox events, no custom click handlers
2. **Simple**: Minimal code, easy to understand
3. **Reliable**: Works with Mapbox's existing popup system
4. **No Side Effects**: Doesn't interfere with popup open/close behavior
5. **Clean**: No mutation observers or complex state management needed

## Implementation Location

- **File**: `src/components/Map/components/Cards/OSMCall.jsx`
- **Function**: `addCampusTeardropMarkers` (line 443)
- **Insert After**: Line 707 (after marker is added to map)

## Testing Checklist

- [ ] Marker starts as red
- [ ] Clicking marker opens popup
- [ ] Marker turns green when popup opens
- [ ] Popup displays correctly
- [ ] Clicking map closes popup
- [ ] (If implemented) Marker reverts to red when popup closes
- [ ] Multiple markers work independently
- [ ] No console errors

