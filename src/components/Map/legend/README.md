# Legend Module

This folder collects all reusable pieces that power `LegendContainer` so we can reuse the same legend framework for any new location without cloning the monolith.

## Key Pieces

- `legendConfig.js` — central place for static data (universities, default visibility/opacity, collapse defaults). Add or override location-specific entries here instead of editing the React component.
- `hooks/useLegendDataSources.js` — subscribes to `window.mapEventBus`, normalises payloads, and exposes `{legendData, osmData, ...}`. Any component can render a legend by consuming this hook.
- `hooks/useLayerVisibility.js` — tiny helper that manages boolean maps (`visibility`, `toggle`, `setAll`, `reset`). Use it whenever a section needs per-category toggles.
- `hooks/useCardHeight.js` — replicates the responsive height logic from `SidePanel` so cards stay aligned across modes.
- `utils/mapInteractions.js` — shared map helpers (highlighting markers, zooming, focusing sites, emitting selection events) to keep React components declarative.

## Using The Module

1. Import the hooks/config needed by your legend view:
   ```js
   const legendData = useLegendDataSources({ mapRef, okDataCenterCategoryVisibility });
   const osmVisibility = useLayerVisibility(() => getDefaultOsmLayerVisibility(location));
   ```
2. Drive your UI directly from the hook outputs. Because the shapes match the previous internal state, the existing JSX continues to work unchanged.
3. Call the utilities for interactions instead of reaching into `map.current` from every component:
   ```js
   highlightMarker(mapRef, markerData);
   focusSiteOnMap(mapRef, site);
   ```

## Extending To New Locations

- Add new university / layer defaults inside `legendConfig.js` and pass the location key via `currentLocation`.
- If a location needs additional data feeds, extend `useLegendDataSources` to subscribe to the new event(s) and return the extra state.
- Reuse the hooks + utils in other map shells (for example, a compact legend panel) without importing `LegendContainer`.
