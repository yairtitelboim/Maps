import React, { useEffect, useState, useRef } from 'react';
import * as turf from '@turf/turf';

const OKC_NEIGHBORHOODS_SOURCE_ID = 'okc-neighborhoods-source';
const OKC_NEIGHBORHOODS_LAYER_ID = 'okc-neighborhoods-layer';
const OKC_NEIGHBORHOODS_HOVER_LAYER_ID = 'okc-neighborhoods-hover-layer';
const OKC_NEIGHBORHOODS_SELECTED_LAYER_ID = 'okc-neighborhoods-selected-layer';
const OKC_NEIGHBORHOOD_BUILDINGS_SOURCE_ID = 'okc-neighborhood-buildings-source';
const OKC_NEIGHBORHOOD_BUILDINGS_LAYER_ID = 'okc-neighborhood-buildings-layer';

const OKCNeighborhoodsLayer = ({ map, visible }) => {
  const [popup, setPopup] = useState(null);
  const [hoveredFeatureId, setHoveredFeatureId] = useState(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [neighborhoodBuildings, setNeighborhoodBuildings] = useState(null);
  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const hoveredFeatureIdRef = useRef(null);
  const neighborhoodIndexRef = useRef(null);

  // Load neighborhood index on component mount (if using pre-processed buildings)
  useEffect(() => {
    const loadNeighborhoodIndex = async () => {
      try {
        const response = await fetch('/neighborhood_buildings/neighborhood_index.json');
        if (response.ok) {
          const index = await response.json();
          neighborhoodIndexRef.current = index;
        }
      } catch (error) {
        // Index file is optional - only needed if using pre-processed buildings
      }
    };
    
    loadNeighborhoodIndex();
  }, []);

  // Clear neighborhood buildings
  const clearNeighborhoodBuildings = () => {
    if (!map?.current) return;
    
    if (map.current.getLayer(OKC_NEIGHBORHOOD_BUILDINGS_LAYER_ID)) {
      map.current.removeLayer(OKC_NEIGHBORHOOD_BUILDINGS_LAYER_ID);
    }
    if (map.current.getSource(OKC_NEIGHBORHOOD_BUILDINGS_SOURCE_ID)) {
      map.current.removeSource(OKC_NEIGHBORHOOD_BUILDINGS_SOURCE_ID);
    }
    
    setNeighborhoodBuildings(null);
  };

  // Load buildings for a specific tract
  const loadNeighborhoodBuildings = async (tractId, tractGeometry) => {
    if (!map?.current) return;
    
    // Clear any existing buildings first
    clearNeighborhoodBuildings();
    
    setBuildingsLoading(true);
    
    try {
      // First, try to use pre-processed building data if index exists
      if (neighborhoodIndexRef.current && neighborhoodIndexRef.current[tractId]) {
        const tractInfo = neighborhoodIndexRef.current[tractId];
        const response = await fetch(tractInfo.file_path);
        if (response.ok) {
          const buildingsData = await response.json();
          setNeighborhoodBuildings(buildingsData);
          
          // Remove existing buildings layer if it exists (should already be cleared, but double-check)
          if (map.current.getLayer(OKC_NEIGHBORHOOD_BUILDINGS_LAYER_ID)) {
            map.current.removeLayer(OKC_NEIGHBORHOOD_BUILDINGS_LAYER_ID);
          }
          if (map.current.getSource(OKC_NEIGHBORHOOD_BUILDINGS_SOURCE_ID)) {
            map.current.removeSource(OKC_NEIGHBORHOOD_BUILDINGS_SOURCE_ID);
          }
          
          // Add new buildings source and layer
          map.current.addSource(OKC_NEIGHBORHOOD_BUILDINGS_SOURCE_ID, {
            type: 'geojson',
            data: buildingsData
          });
          
          map.current.addLayer({
            id: OKC_NEIGHBORHOOD_BUILDINGS_LAYER_ID,
            type: 'fill-extrusion',
            source: OKC_NEIGHBORHOOD_BUILDINGS_SOURCE_ID,
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: {
              'fill-extrusion-color': '#3B82F6', // Blue color for OKC
              'fill-extrusion-opacity': 0.8,
              'fill-extrusion-height': [
                'case',
                ['has', 'height_m'],
                ['get', 'height_m'],
                ['has', 'height'],
                ['get', 'height'],
                ['has', 'levels'],
                ['*', ['get', 'levels'], 3],
                5
              ],
              'fill-extrusion-base': 0,
              'fill-extrusion-translate': [0, 0],
              'fill-extrusion-translate-anchor': 'map'
            },
            layout: {
              visibility: 'visible'
            }
          });
          
          setBuildingsLoading(false);
          return;
        }
      }
      
      // If no pre-processed data, show message that buildings can be added later
      setBuildingsLoading(false);
      
    } catch (error) {
      console.error('Failed to load neighborhood buildings:', error);
      setBuildingsLoading(false);
    }
  };

  useEffect(() => {
    if (!map?.current) return;
    
    if (!visible) {
      clearNeighborhoodBuildings();
      if (map.current.getLayer(OKC_NEIGHBORHOODS_SELECTED_LAYER_ID)) map.current.removeLayer(OKC_NEIGHBORHOODS_SELECTED_LAYER_ID);
      if (map.current.getLayer(OKC_NEIGHBORHOODS_HOVER_LAYER_ID)) map.current.removeLayer(OKC_NEIGHBORHOODS_HOVER_LAYER_ID);
      if (map.current.getLayer(OKC_NEIGHBORHOODS_LAYER_ID)) map.current.removeLayer(OKC_NEIGHBORHOODS_LAYER_ID);
      if (map.current.getSource(OKC_NEIGHBORHOODS_SOURCE_ID)) map.current.removeSource(OKC_NEIGHBORHOODS_SOURCE_ID);
      setPopup(null);
      setHoveredFeatureId(null);
      setSelectedFeatureId(null);
      setBuildingsLoading(false);
      return;
    }

    let cancelled = false;
    
    const addLayer = async () => {
      try {
        if (cancelled) return;
        
        // Remove existing layers/sources if they exist
        if (map.current.getLayer(OKC_NEIGHBORHOODS_SELECTED_LAYER_ID)) map.current.removeLayer(OKC_NEIGHBORHOODS_SELECTED_LAYER_ID);
        if (map.current.getLayer(OKC_NEIGHBORHOODS_HOVER_LAYER_ID)) map.current.removeLayer(OKC_NEIGHBORHOODS_HOVER_LAYER_ID);
        if (map.current.getLayer(OKC_NEIGHBORHOODS_LAYER_ID)) map.current.removeLayer(OKC_NEIGHBORHOODS_LAYER_ID);
        if (map.current.getSource(OKC_NEIGHBORHOODS_SOURCE_ID)) map.current.removeSource(OKC_NEIGHBORHOODS_SOURCE_ID);
        
        // Add the source from the GeoJSON file
        map.current.addSource(OKC_NEIGHBORHOODS_SOURCE_ID, { 
          type: 'geojson', 
          data: '/okc_census_tracts.geojson'
        });
        
        // Add invisible base layer for hit testing - using fill with very low opacity
        map.current.addLayer({
          id: OKC_NEIGHBORHOODS_LAYER_ID,
          type: 'fill',
          source: OKC_NEIGHBORHOODS_SOURCE_ID,
          paint: {
            'fill-color': '#000000',
            'fill-opacity': 0.01 // Very low but not zero opacity for mouse events
          },
          layout: {
            visibility: 'visible'
          }
        });
        
        // Add selected fill layer (shows 20% fill for clicked tract)
        map.current.addLayer({
          id: OKC_NEIGHBORHOODS_SELECTED_LAYER_ID,
          type: 'fill',
          source: OKC_NEIGHBORHOODS_SOURCE_ID,
          paint: {
            'fill-color': '#3B82F6', // Blue color for OKC
            'fill-opacity': 0.2 // 20% opacity
          },
          filter: ['==', ['get', 'GEOID'], ''], // Initially shows nothing
          layout: {
            visibility: 'visible'
          }
        });
        
        // Add hover highlight layer (only shows when hovered)
        map.current.addLayer({
          id: OKC_NEIGHBORHOODS_HOVER_LAYER_ID,
          type: 'line',
          source: OKC_NEIGHBORHOODS_SOURCE_ID,
          paint: {
            'line-color': '#3B82F6', // Blue color for OKC
            'line-width': 3,
            'line-opacity': 1
          },
          filter: ['==', ['get', 'GEOID'], ''], // Initially shows nothing
          layout: {
            visibility: 'visible'
          }
        });
        
      } catch (e) {
        console.error('Failed to load OKC neighborhoods layer', e);
      }
    };
    
    addLayer();
    
    // Mouse move handler for real-time hover tracking
    const handleMouseMove = (e) => {
      if (!map.current) return;
      
      const features = map.current.queryRenderedFeatures(e.point, { 
        layers: [OKC_NEIGHBORHOODS_LAYER_ID] 
      });
      
      if (features && features.length > 0) {
        const feature = features[0];
        const tractId = feature.properties.GEOID;
        
        // Only update if it's a different tract
        if (tractId !== hoveredFeatureIdRef.current) {
          hoveredFeatureIdRef.current = tractId;
          setHoveredFeatureId(tractId);
          
          // Update the hover layer filter to show only this tract
          map.current.setFilter(OKC_NEIGHBORHOODS_HOVER_LAYER_ID, [
            '==', ['get', 'GEOID'], tractId
          ]);
        }
        
        // Always set cursor to pointer when over any tract
        map.current.getCanvas().style.cursor = 'pointer';
      } else {
        // Mouse is not over any tract
        if (hoveredFeatureIdRef.current !== null) {
          hoveredFeatureIdRef.current = null;
          setHoveredFeatureId(null);
          
          // Hide the hover layer
          map.current.setFilter(OKC_NEIGHBORHOODS_HOVER_LAYER_ID, [
            '==', ['get', 'GEOID'], ''
          ]);
          
          // Reset cursor
          map.current.getCanvas().style.cursor = '';
        }
      }
    };
    
    // Click handler for selection and popups
    const handleClick = (e) => {
      if (!map.current) return;
      
      const features = map.current.queryRenderedFeatures(e.point, { 
        layers: [OKC_NEIGHBORHOODS_LAYER_ID] 
      });
      
      if (features && features.length > 0) {
        const f = features[0];
        const tractId = f.properties.GEOID;
        const coordinates = f.geometry.coordinates[0][0]; // Get first coordinate of the polygon
        
        // Toggle selection - if clicking same tract, deselect it
        if (selectedFeatureId === tractId) {
          setSelectedFeatureId(null);
          map.current.setFilter(OKC_NEIGHBORHOODS_SELECTED_LAYER_ID, [
            '==', ['get', 'GEOID'], ''
          ]);
          setPopup(null);
          clearNeighborhoodBuildings();
        } else {
          // Select new tract
          setSelectedFeatureId(tractId);
          map.current.setFilter(OKC_NEIGHBORHOODS_SELECTED_LAYER_ID, [
            '==', ['get', 'GEOID'], tractId
          ]);
          
          setPopup({
            lng: coordinates[0],
            lat: coordinates[1],
            properties: f.properties
          });
          
          // Load buildings for this tract
          const tractGeometry = turf.feature(f.geometry);
          loadNeighborhoodBuildings(tractId, tractGeometry);
        }
      } else {
        // Clicked on empty area - deselect all
        setSelectedFeatureId(null);
        map.current.setFilter(OKC_NEIGHBORHOODS_SELECTED_LAYER_ID, [
          '==', ['get', 'GEOID'], ''
        ]);
        setPopup(null);
        clearNeighborhoodBuildings();
      }
    };
    
    // Add event listeners
    map.current.on('mousemove', handleMouseMove);
    map.current.on('click', OKC_NEIGHBORHOODS_LAYER_ID, handleClick);
    
    return () => {
      cancelled = true;
      
      // Remove event listeners
      map.current?.off('mousemove', handleMouseMove);
      map.current?.off('click', OKC_NEIGHBORHOODS_LAYER_ID, handleClick);
      
      // Remove layers and sources
      clearNeighborhoodBuildings();
      if (map.current?.getLayer(OKC_NEIGHBORHOODS_HOVER_LAYER_ID)) map.current.removeLayer(OKC_NEIGHBORHOODS_HOVER_LAYER_ID);
      if (map.current?.getLayer(OKC_NEIGHBORHOODS_SELECTED_LAYER_ID)) map.current.removeLayer(OKC_NEIGHBORHOODS_SELECTED_LAYER_ID);
      if (map.current?.getLayer(OKC_NEIGHBORHOODS_LAYER_ID)) map.current.removeLayer(OKC_NEIGHBORHOODS_LAYER_ID);
      if (map.current?.getSource(OKC_NEIGHBORHOODS_SOURCE_ID)) map.current.removeSource(OKC_NEIGHBORHOODS_SOURCE_ID);
      
      // Reset cursor and state
      if (map.current?.getCanvas) map.current.getCanvas().style.cursor = '';
      setPopup(null);
      setHoveredFeatureId(null);
      setSelectedFeatureId(null);
      setBuildingsLoading(false);
      hoveredFeatureIdRef.current = null;
    };
  }, [map, visible]);

  return (
    <>
      {buildingsLoading && (
        <div style={{
          position: 'absolute',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(59, 130, 246, 0.9)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          🏗️ Loading tract buildings...
        </div>
      )}
      
      {popup && (
        <div style={{
          position: 'absolute',
          zIndex: 20,
          left: 0,
          right: 0,
          margin: '0 auto',
          top: 120,
          maxWidth: 340,
          background: '#23272A',
          color: '#fff',
          borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
          padding: 20,
          fontSize: 15,
          lineHeight: 1.6,
          border: '1.5px solid #333',
          opacity: 0.98
        }}>
          <button 
            style={{
              position: 'absolute',
              top: 10,
              right: 14,
              color: '#fff',
              background: 'none',
              border: 'none',
              fontSize: 22,
              cursor: 'pointer',
              opacity: 0.7
            }} 
            onClick={() => {
              setPopup(null);
              setSelectedFeatureId(null);
              if (map?.current) {
                map.current.setFilter(OKC_NEIGHBORHOODS_SELECTED_LAYER_ID, [
                  '==', ['get', 'GEOID'], ''
                ]);
              }
              clearNeighborhoodBuildings();
            }} 
            title="Close"
          >
            ×
          </button>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
            {popup.properties.NAME || popup.properties.NAMELSAD || 'Census Tract'}
          </div>
          <div style={{ 
            color: '#3B82F6', 
            fontWeight: 500, 
            marginBottom: 6 
          }}>
            Census Tract
          </div>
          <div style={{ marginBottom: 6 }}>
            GEOID: {popup.properties.GEOID}
          </div>
          {popup.properties.NAMELSAD && popup.properties.NAMELSAD !== popup.properties.NAME && (
            <div style={{ marginBottom: 6 }}>
              Full Name: {popup.properties.NAMELSAD}
            </div>
          )}
          {neighborhoodBuildings && (
            <div style={{ 
              marginTop: 12, 
              paddingTop: 12, 
              borderTop: '1px solid #333',
              color: '#3B82F6',
              fontSize: 13
            }}>
              🏗️ {neighborhoodBuildings.features.length.toLocaleString()} buildings loaded
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default OKCNeighborhoodsLayer;

