import { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { MAP_CONFIG } from '../constants';
import { handlePanelCollapse } from '../hooks/mapAnimations';

export const useMapInitialization = (map, mapContainer) => {
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_CONFIG.style,
      center: MAP_CONFIG.center,
      zoom: MAP_CONFIG.zoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      dragRotate: MAP_CONFIG.dragRotate,
      touchZoomRotate: MAP_CONFIG.touchZoomRotate,
      doubleClickZoom: MAP_CONFIG.doubleClickZoom,
      touchPitch: MAP_CONFIG.touchPitch,
      pitch: 0
    });
    
    // Force panel to be collapsed on initial map load
    map.current.once('load', () => {
      // Ensure chat panel is initially collapsed
      setTimeout(() => {
        handlePanelCollapse(true, map.current);
      }, 100);
    });

    // Add water styling when the style loads
    map.current.on('style.load', async () => {
      // Wait for style to be fully loaded
      await new Promise(resolve => {
        if (map.current.isStyleLoaded()) {
          resolve();
        } else {
          map.current.once('styledata', resolve);
        }
      });

      // Style water in the base map layers
      const waterLayers = [
        'water',
        'water-shadow',
        'waterway',
        'water-depth',
        'water-pattern'
      ];

      waterLayers.forEach(layerId => {
        if (!map.current.getLayer(layerId)) return;

        try {
          const layer = map.current.getLayer(layerId);
          if (!layer) return;

          // Handle fill layers
          if (layer.type === 'fill') {
            map.current.setPaintProperty(layerId, 'fill-color', '#000414');
            map.current.setPaintProperty(layerId, 'fill-opacity', 0.8);
          }
          
          // Handle line layers
          if (layer.type === 'line') {
            map.current.setPaintProperty(layerId, 'line-color', '#001f3d');
            map.current.setPaintProperty(layerId, 'line-opacity', 0.8);
          }
        } catch (error) {
          console.warn(`Could not style water layer ${layerId}:`, error);
        }
      });

      // Style parks and green areas
      const parkLayers = [
        'landuse',
        'park',
        'park-label',
        'national-park',
        'natural',
        'golf-course',
        'pitch',
        'grass'
      ];

      parkLayers.forEach(layerId => {
        if (!map.current.getLayer(layerId)) return;

        try {
          const layer = map.current.getLayer(layerId);
          if (!layer) return;

          if (layer.type === 'fill') {
            map.current.setPaintProperty(layerId, 'fill-color', '#050f08');
            map.current.setPaintProperty(layerId, 'fill-opacity', 0.3);
          }
          if (layer.type === 'symbol' && map.current.getPaintProperty(layerId, 'background-color') !== undefined) {
            map.current.setPaintProperty(layerId, 'background-color', '#050f08');
          }
        } catch (error) {
          console.warn(`Could not style park layer ${layerId}:`, error);
        }
      });
    });

    const initializeMapLayers = async () => {
      try {
        // MEMORY LEAK FIX: Removed all large GeoJSON preloading
        // Only add lightweight layers that use vector tiles
        
        // Add Mapbox 3D buildings layer (lightweight, uses vector tiles)
        map.current.addLayer({
          'id': 'mapbox-buildings',
          'source': 'composite',
          'source-layer': 'building',
          'filter': ['==', 'extrude', 'true'],
          'type': 'fill-extrusion',
          'minzoom': 12,
          'paint': {
            'fill-extrusion-color': '#1c1c1c',
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15, 0,
              15.05, ['get', 'height']
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15, 0,
              15.05, ['get', 'min_height']
            ],
            'fill-extrusion-opacity': 1
          }
        });

        // REMOVED TO FIX 4.4GB MEMORY LEAK:
        // - houston-census-blocks.geojson (large)
        // - houston_buildings.geojson (large) 
        // - Surface_Water.geojson (50MB)
        // - PWS_Reservoir.geojson (16MB)
        // - MUD.geojson (7.2MB)  
        // - COH_ZIPCODES.geojson (2MB)
        // - Surface_Water_Intake.geojson 
        // - small_tribal_areas.geojson
        // - small_areas.geojson
        // - Waterwell_Grid.geojson
        // - Wastewater_Outfalls.geojson
        // - All associated layers, popups, and event handlers
        
        // These datasets will now load on-demand when layer toggles are enabled

      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    // Wait for both map load and style load before initializing layers
    const initializeWhenReady = async () => {
      // Ensure style is fully loaded before adding sources
      if (!map.current.isStyleLoaded()) {
        await new Promise(resolve => {
          if (map.current.isStyleLoaded()) {
            resolve();
          } else {
            map.current.once('style.load', resolve);
          }
        });
      }
      
      // Add a small delay to ensure everything is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await initializeMapLayers();
    };
    
    map.current.on('load', initializeWhenReady);
  }, []);
}; 