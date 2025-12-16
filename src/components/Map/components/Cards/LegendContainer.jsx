import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  getLocationUniversities,
  getDefaultOsmLayerVisibility,
  getDefaultWhitneyLayerVisibility,
  getDefaultWhitneyLayerOpacity,
  getDefaultOsmLayerOpacity,
  getDefaultNcSiteCollapsed,
  getDefaultOkSiteCollapsed,
  getDefaultOkDataCenterCategoryVisibility,
  getDefaultPerplexityLayerVisibility,
  getDefaultDukeLayerVisibility,
  getDefaultStartupCategoryVisibility
} from '../../legend/legendConfig';
import { useLegendDataSources } from '../../legend/hooks/useLegendDataSources';
import { useLayerVisibility } from '../../legend/hooks/useLayerVisibility';
import { useCardHeight } from '../../legend/hooks/useCardHeight';
import LegendPanel from '../../legend/components/LegendPanel';
import { buildLegendSections } from '../../legend/utils/buildLegendSections';
import VisibilityPresets from '../../legend/components/VisibilityPresets';
import {
  highlightMarker as highlightMarkerInteraction,
  zoomToMarker as zoomToMarkerInteraction,
  focusSiteOnMap,
  emitSiteSelection
} from '../../legend/utils/mapInteractions';

const LegendContainer = memo(({ 
  aiState, 
  isVisible = false,
  onToggle = null,
  map = null,
  handleMarkerClick = null,
  currentLocation = 'default' // Add currentLocation prop
}) => {
  const cardHeight = useCardHeight();
  
  // Track selected marker for legend highlighting
  const [selectedMarker, setSelectedMarker] = useState(null);
  
  
  // Track OSM layer visibility states - dynamically based on location
  const [osmLayerVisibility, setOsmLayerVisibility] = useState(() => 
    getDefaultOsmLayerVisibility(currentLocation)
  );

  // Track Whitney layer visibility states
  const [whitneyLayerVisibility, setWhitneyLayerVisibility] = useState(() => 
    getDefaultWhitneyLayerVisibility()
  );

  // Track Whitney layer opacity state
  const [whitneyLayerOpacity, setWhitneyLayerOpacity] = useState(() => 
    getDefaultWhitneyLayerOpacity()
  );

  // Track OSM layer opacity state
  const [osmLayerOpacity, setOsmLayerOpacity] = useState(() => 
    getDefaultOsmLayerOpacity()
  );

  // Track section collapse states
  const [whitneySectionCollapsed, setWhitneySectionCollapsed] = useState(false);
  const [urbanInfrastructureSectionCollapsed, setUrbanInfrastructureSectionCollapsed] = useState(false);
  const [whitneyAnalysisAreaSectionCollapsed, setWhitneyAnalysisAreaSectionCollapsed] = useState(false);
  
  // Track NC Power site collapse states - default to all collapsed
  const [ncSiteCollapsed, setNcSiteCollapsed] = useState(() => 
    getDefaultNcSiteCollapsed()
  );

  // Archived: Oklahoma Data Center site collapse states - removed for Columbus migration
  const [okSiteCollapsed, setOkSiteCollapsed] = useState(() => 
    getDefaultOkSiteCollapsed() // Returns empty object
  );

  // Archived: Oklahoma Data Center category visibility states - removed for Columbus migration
  const [okDataCenterCategoryVisibility, setOkDataCenterCategoryVisibility] = useState(() => 
    getDefaultOkDataCenterCategoryVisibility() // Returns empty object
  );

  // Track Perplexity layer visibility states
  const [perplexityLayerVisibility, setPerplexityLayerVisibility] = useState(() => 
    getDefaultPerplexityLayerVisibility()
  );

  // Track Duke Transmission Easements layer visibility states
  const [dukeLayerVisibility, setDukeLayerVisibility] = useState(() => 
    getDefaultDukeLayerVisibility()
  );
  
  // Archived: Power Generation (GRDA/OG&E) visibility states - Oklahoma-specific utilities removed
  // TODO: Add AEP Ohio power generation visibility states if needed
  const [powerLegendVisibility, setPowerLegendVisibility] = useState({
    // Archived: GRDA/OG&E states removed
    // grdaHydro: false,
    // grdaWind: false,
    // grdaGas: false,
    // ogeGas: false,
    // ogeCoal: false,
    // ogeWind: false,
    // ogeSolar: false,
    infrastructureSites: true,
    // stillwater: true, // Archived: Stillwater removed
    pipelines: false, // Hidden by default, must be toggled on in legend
    transitPath: false, // Hidden by default, must be toggled on in legend
  });
  
  // Archived: GRDA/OG&E expansion states - removed for Columbus migration
  const [grdaExpanded, setGrdaExpanded] = useState(true); // Kept for compatibility, but not used
  const [ogeExpanded, setOgeExpanded] = useState(true); // Kept for compatibility, but not used
  const [infrastructureExpanded, setInfrastructureExpanded] = useState(true);
  
  // Reset layer visibility when location changes
  useEffect(() => {
    setOsmLayerVisibility(getDefaultOsmLayerVisibility(currentLocation));
  }, [currentLocation]);

  // Track startup category visibility states
  const {
    visibility: startupCategoryVisibility,
    setVisibility: setStartupCategoryVisibilityState
  } = useLayerVisibility(getDefaultStartupCategoryVisibility);

  const {
    legendData,
    osmData,
    whitneyData,
    perplexityData,
    ncPowerData,
    okDataCenterData,
    dukeData,
    gridData,
    commuteData
  } = useLegendDataSources({
    mapRef: map,
    okDataCenterCategoryVisibility
  });
  

  // Listen for infrastructure data from Google Places API
  // Listen for marker click events to highlight corresponding legend item
  useEffect(() => {
    if (!window.mapEventBus) return;

    const handleMarkerSelected = (markerData) => {
      setSelectedMarker(markerData);
    };

    // Listen for marker selection events
    window.mapEventBus.on('marker:selected', handleMarkerSelected);
    
    // Also listen for when markers are deselected
    window.mapEventBus.on('marker:deselected', () => {
      setSelectedMarker(null);
    });

    return () => {
      window.mapEventBus.off('marker:selected', handleMarkerSelected);
      window.mapEventBus.off('marker:deselected', () => {});
    };
  }, []);


  // Function to handle legend item clicks
  const handleLegendItemClick = (displayLabel, item = null) => {
    if (item && item.siteKey) {
      // Check NC Power sites first
      let site = ncPowerData.sites.find(s => s.key === item.siteKey);
      let siteType = 'NC Power';
      let categoryName = 'North Carolina Megasite';
      let idPrefix = 'nc-site-';
      let typeName = 'Power & Utility Infrastructure';
      
      // If not found in NC Power, check Oklahoma data centers
      if (!site) {
        site = okDataCenterData.sites.find(s => s.key === item.siteKey);
        if (site) {
          siteType = 'OK Data Center';
          categoryName = 'Oklahoma Data Center';
          idPrefix = 'ok-data-center-';
          typeName = 'Data Center Infrastructure';
        }
      }
      
      if (site) {
        focusSiteOnMap(map, site);
        emitSiteSelection({
          site,
          idPrefix,
          typeName,
          categoryName,
          siteType
        });
      }
      return;
    }

    // Check if this is a startup category toggle
    if (item && item.category && item.category in startupCategoryVisibility) {
      toggleStartupCategory(item.category);
      return;
    }

    // Check if this is a Whitney layer toggle
    if (item && item.category && item.category in whitneyLayerVisibility) {
      toggleWhitneyLayer(item.category);
      return;
    }

    // Check if this is a Perplexity layer toggle
    if (item && item.category && item.category in perplexityLayerVisibility) {
      togglePerplexityLayer(item.category);
      return;
    }

    // Check if this is a Duke layer toggle
    if (item && item.serviceType && item.serviceType in dukeLayerVisibility) {
      toggleDukeLayer(item.serviceType);
      return;
    }

    // Check if this is an Oklahoma Data Center layer toggle
    if (item && item.siteKey && okDataCenterData.sites.some(s => s.key === item.siteKey)) {
      // If it's a subcategory, toggle only that category; otherwise toggle all layers for the site
      const category = item.isSubCategory ? item.category : null;
      toggleOkDataCenterLayer(item.siteKey, category);
      return;
    }

    // Check if this is an OSM layer toggle
    if (item && item.layerName && item.layerName in osmLayerVisibility) {
      toggleOsmLayer(item.layerName);
      return;
    }

    // Check if this is the Transit Path (in Infrastructure Sites section)
    if (item && item.layerName === 'transitPath' && item.utility === 'infrastructure') {
      togglePowerLegendCategory('infrastructure', 'transitPath', item);
      return;
    }

    // Handle SERP marker clicks (existing functionality)
    if (!map?.current || !handleMarkerClick || !legendData.serpFeatures.length) {
      return;
    }

    // Map display labels back to actual category names
    const categoryMap = {
      'Startups': 'startups',
      'Investors': 'investors', 
      'Co-working Spaces': 'co-working spaces',
      'Universities': 'universities',
      'Research Institutions': 'research institutions',
      'Other Facilities': 'other facilities'
    };

    const actualCategory = categoryMap[displayLabel] || displayLabel.toLowerCase();

    // Find the first marker of this category
    const markerFeature = legendData.serpFeatures.find(feature => 
      feature.properties?.category === actualCategory
    );

    if (!markerFeature) {
      return;
    }

    const coordinates = markerFeature.geometry.coordinates;
    const properties = markerFeature.properties;
    
    // Calculate distance from Boston center (-71.0589, 42.3601)
    const bostonCoords = [-71.0589, 42.3601];
    const distance = calculateDistance(coordinates, bostonCoords);
    
    // Prepare marker data (same format as SerpTool)
    const markerData = {
      title: properties.title || properties.name || 'Infrastructure',
      category: properties.category || 'Unknown',
      address: properties.address || 'No address available',
      rating: properties.rating || null,
      phone: properties.phone || null,
      website: properties.website || null,
      coordinates: coordinates,
      distance: distance,
      description: properties.description || null,
      hours: properties.hours || null,
      serp_id: properties.serp_id || null
    };
    
    // Emit event to notify table system about legend selection
    if (window.mapEventBus) {
      const legendBridgeData = {
        markerData: markerData,
        displayLabel: displayLabel,
        actualCategory: actualCategory,
        coordinates: coordinates,
        timestamp: Date.now()
      };
      
      window.mapEventBus.emit('legend:itemSelected', legendBridgeData);
    }
    
    // Trigger the same behavior as clicking the marker on the map
    handleMarkerClick(markerData);
    
    // Also handle map interactions: highlight marker and zoom to it
    highlightMarkerOnMap(markerData);
    zoomToMarker(markerData);
    
    // Trigger animation when legend item is clicked
    if (window.nodeAnimation) {
      const animationType = markerData.category === 'power plants' ? 'pulse' :
                           markerData.category === 'electric utilities' ? 'ripple' :
                           markerData.category === 'water facilities' ? 'glow' :
                           markerData.category === 'data centers' ? 'heartbeat' : 'pulse';
      
      window.nodeAnimation.triggerNodeAnimation(markerData.coordinates, {
        type: animationType,
        intensity: 0.8,
        duration: 3.0,
        nodeData: markerData,
        category: markerData.category
      });
    }
  };

  // Helper function to calculate distance between two coordinates
  const calculateDistance = (coord1, coord2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10; // Round to 1 decimal place
  };

  // Find matching legend item based on table node data
  const findMatchingLegendItem = useCallback((bridgeData) => {
    if (!legendData.serpFeatures || legendData.serpFeatures.length === 0) {
      return null;
    }

    const { tableNode, coordinates, searchTerms } = bridgeData;
    let bestMatch = null;
    let bestScore = 0;

    // Search through all available features
    legendData.serpFeatures.forEach((feature, index) => {
      let score = 0;

      // 1. Coordinate matching (highest priority)
      if (coordinates && feature.geometry?.coordinates) {
        const distance = calculateDistance(coordinates, feature.geometry.coordinates);
        
        if (distance < 0.5) { // Within 0.5 miles
          score += 50;
        } else if (distance < 2) { // Within 2 miles
          score += 25;
        }
      }

      // 2. Name matching
      const featureName = (feature.properties?.title || feature.properties?.name || '').toLowerCase();
      const tableName = tableNode.name.toLowerCase();
      
      // Direct name matching
      if (featureName.includes(tableName.split(' ')[0]) || tableName.includes(featureName.split(' ')[0])) {
        score += 30;
      }

      // 3. Search terms matching
      searchTerms.forEach(term => {
        if (featureName.includes(term)) {
          score += 5;
        }
        if (feature.properties?.category?.includes(term)) {
          score += 10;
        }
      });

      // 4. Type-based category matching
      const nodeType = (tableNode.type || '').toLowerCase();
      const featureCategory = feature.properties?.category || '';
      
      if ((nodeType.includes('startup') || nodeType.includes('company')) && featureCategory.includes('startup')) {
        score += 20;
      }
      if ((nodeType.includes('investor') || nodeType.includes('venture')) && featureCategory.includes('investor')) {
        score += 20;
      }
      if (nodeType.includes('university') && featureCategory.includes('university')) {
        score += 20;
      }
      if (nodeType.includes('research') && featureCategory.includes('research')) {
        score += 20;
      }
      if (nodeType.includes('co-working') && featureCategory.includes('co-working')) {
        score += 20;
      }

      // Update best match if this score is higher
      if (score > bestScore) {
        bestScore = score;
        bestMatch = feature;
      }
    });

    if (bestMatch && bestScore >= 20) { // Minimum threshold for a valid match
      // Convert to marker data format
      const coordinates = bestMatch.geometry.coordinates;
      const properties = bestMatch.properties;
      const bostonCoords = [-71.0589, 42.3601];
      const distance = calculateDistance(coordinates, bostonCoords);
      
      return {
        title: properties.title || properties.name || 'Infrastructure',
        category: properties.category || 'Unknown',
        address: properties.address || 'No address available',
        rating: properties.rating || null,
        phone: properties.phone || null,
        website: properties.website || null,
        coordinates: coordinates,
        distance: distance,
        description: properties.description || null,
        hours: properties.hours || null,
        serp_id: properties.serp_id || null
      };
    }

    return null;
  }, [legendData]);

  // Function to highlight the selected marker on the map
  const highlightMarkerOnMap = useCallback((markerData) => {
    highlightMarkerInteraction(map, markerData);
  }, [map]);

  // Function to zoom to the selected marker
  const zoomToMarker = useCallback((markerData) => {
    zoomToMarkerInteraction(map, markerData);
  }, [map]);

  // Function to toggle startup category visibility
  const toggleStartupCategory = useCallback((category) => {
    if (!map?.current) {
      return;
    }

    const currentVisibility = startupCategoryVisibility[category];
    const newVisibility = !currentVisibility;
    const updatedVisibility = {
      ...startupCategoryVisibility,
      [category]: newVisibility
    };

    try {
      // Check if the startup ecosystem layer exists
      if (map.current.getLayer('serp-startup-ecosystem-markers')) {
        // Create a new opacity expression that respects category visibility
        const newOpacityExpression = [
          'case',
            ['==', ['get', 'category'], category], newVisibility ? 0.2 : 0, // Hide/show specific category
          // Keep other categories at their current visibility
          ['==', ['get', 'category'], 'AI/ML'], updatedVisibility['AI/ML'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Biotech/Health'], updatedVisibility['Biotech/Health'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'FinTech'], updatedVisibility['FinTech'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'CleanTech'], updatedVisibility['CleanTech'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Enterprise'], updatedVisibility['Enterprise'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Hardware'], updatedVisibility['Hardware'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Other'], updatedVisibility['Other'] ? 0.2 : 0,
          0.2 // Default opacity for any other categories
        ];

        map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-opacity', newOpacityExpression);
        map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-stroke-opacity', newOpacityExpression);
        
        // Also toggle the radius particles visibility
        if (window.serpRadiusParticlesVisibility) {
          Object.keys(updatedVisibility).forEach(cat => {
            window.serpRadiusParticlesVisibility[cat] = updatedVisibility[cat];
          });
        }
        
        // Update state
        setStartupCategoryVisibilityState(updatedVisibility);
      }
    } catch (error) {
      // Error handling
    }
  }, [map, startupCategoryVisibility, setStartupCategoryVisibilityState]);

  // Function to toggle OSM layer visibility
  const toggleOsmLayer = useCallback((layerName) => {
    if (!map?.current) {
      return;
    }

    const currentVisibility = osmLayerVisibility[layerName];
    const newVisibility = !currentVisibility;

    // Map layer names to actual map layer names - location-aware
    const locationUniversities = getLocationUniversities(currentLocation);
    const layerMap = {
      // Dynamic university layers based on location
      ...Object.keys(locationUniversities).reduce((acc, key) => {
        acc[key] = `osm-${key}`;
        return acc;
      }, {}),
      // Common layers
      otherUniversities: 'osm-other-universities',
      offices: 'osm-offices', 
      transportation: 'osm-transportation-stations',
      water: 'osm-water',
      parks: 'osm-parks',
      commercial: 'osm-commercial',
      analysisRadius: 'osm-radius',
      // Road layers
      highways: 'osm-highways',
      primaryRoads: 'osm-primary-roads',
      secondaryRoads: 'osm-secondary-roads',
      localRoads: 'osm-local-roads',
      residentialRoads: 'osm-residential-roads',
      roads: 'osm-roads',
      highway_junctions: 'osm-highway-junctions',
      // AEP Ohio infrastructure layers - substations by voltage level
      aepOhioSubstationsUltraHigh: 'aep-ohio-substations-ultra-high',
      aepOhioSubstationsHigh: 'aep-ohio-substations-high',
      aepOhioSubstationsMedium: 'aep-ohio-substations-medium',
      aepOhioSubstationsLow: 'aep-ohio-substations-low',
      // AEP Ohio transmission lines by voltage level
      aepOhioTransmissionUltraHigh: 'aep-ohio-transmission-ultra-high',
      aepOhioTransmissionHigh: 'aep-ohio-transmission-high',
      aepOhioTransmissionMedium: 'aep-ohio-transmission-medium',
      aepOhioTransmissionLow: 'aep-ohio-transmission-low',
      // AEP Ohio interconnection requests
      aepOhioInterconnectionRequests: 'aep-ohio-interconnection-points'
    };

    const mapLayerName = layerMap[layerName];
    
    if (!mapLayerName) {
      return;
    }

    try {
      // Special handling for water layer - toggle both water lines and water fill
      if (layerName === 'water') {
        // Get all water layers (OSM and OK Data Center sites)
        const waterLayers = ['osm-water-lines', 'osm-water-fill'];
        
        // Also find all OK Data Center water layers
        const allLayers = map.current.getStyle().layers || [];
        const okWaterLayers = allLayers
          .filter(layer => {
            const layerId = layer.id;
            return layerId.includes('-water-') && (
              layerId.includes('ok-data-center-') || 
              layerId.includes('nc-power-')
            );
          })
          .map(layer => layer.id);
        
        const allWaterLayers = [...waterLayers, ...okWaterLayers];
        let allLayersExist = true;
        
        allWaterLayers.forEach(waterLayerName => {
          if (map.current.getLayer(waterLayerName)) {
            map.current.setLayoutProperty(waterLayerName, 'visibility', newVisibility ? 'visible' : 'none');
          } else {
            allLayersExist = false;
          }
        });
        
        if (allLayersExist || okWaterLayers.length > 0) {
          setOsmLayerVisibility(prev => ({
            ...prev,
            [layerName]: newVisibility
          }));
        }
      } else {
        // Check if layer exists before trying to toggle it
        if (map.current.getLayer(mapLayerName)) {
          // Toggle layer visibility
          map.current.setLayoutProperty(mapLayerName, 'visibility', newVisibility ? 'visible' : 'none');
          
          // Also toggle associated marker layer if it exists
          const markerLayerName = `${mapLayerName}-markers`;
          if (map.current.getLayer(markerLayerName)) {
            map.current.setLayoutProperty(markerLayerName, 'visibility', newVisibility ? 'visible' : 'none');
          }
          
          // Special handling for AEP Ohio transmission - also toggle halo layer
          const transmissionVoltageMap = {
            'aepOhioTransmissionUltraHigh': 'ultra-high',
            'aepOhioTransmissionHigh': 'high',
            'aepOhioTransmissionMedium': 'medium',
            'aepOhioTransmissionLow': 'low'
          };
          
          if (layerName in transmissionVoltageMap) {
            const voltageLevel = transmissionVoltageMap[layerName];
            const haloLayerName = `aep-ohio-transmission-${voltageLevel}-halo`;
            if (map.current.getLayer(haloLayerName)) {
              map.current.setLayoutProperty(haloLayerName, 'visibility', newVisibility ? 'visible' : 'none');
            }
          }
          
          // Update state
          setOsmLayerVisibility(prev => ({
            ...prev,
            [layerName]: newVisibility
          }));
        }
      }
    } catch (error) {
      // Error handling
    }
  }, [map, osmLayerVisibility]);

  // Function to toggle all startup categories
  const toggleAllStartupCategories = useCallback((visible) => {
    if (!map?.current) {
      return;
    }

    try {
      // Check if the startup ecosystem layer exists
      if (map.current.getLayer('serp-startup-ecosystem-markers')) {
        // Set all categories to the same visibility
        const newVisibility = {};
        Object.keys(startupCategoryVisibility).forEach(category => {
          newVisibility[category] = visible;
        });

        // Update the circle-opacity to show/hide all categories
        const opacityExpression = [
          'case',
          ['==', ['get', 'category'], 'AI/ML'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Biotech/Health'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'FinTech'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'CleanTech'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Enterprise'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Hardware'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Other'], visible ? 0.2 : 0,
          visible ? 0.2 : 0 // Default for any other categories
        ];

        map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-opacity', opacityExpression);
        map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-stroke-opacity', opacityExpression);
        
        // Also toggle the radius particles visibility
        if (window.serpRadiusParticlesVisibility) {
          // Update all startup categories in the visibility state
          Object.keys(newVisibility).forEach(cat => {
            window.serpRadiusParticlesVisibility[cat] = newVisibility[cat];
          });
        }
        
        // Update state
        setStartupCategoryVisibilityState(newVisibility);
      }
    } catch (error) {
      // Error handling
    }
  }, [map, startupCategoryVisibility, setStartupCategoryVisibilityState]);

  // Archived: Function to toggle Oklahoma Data Center layer visibility - removed for Columbus migration
  // TODO: Add Columbus/AEP Ohio data center layer toggle if needed
  const toggleOkDataCenterLayer = useCallback((siteKey, category = null) => {
    // Function disabled - Oklahoma-specific feature removed
    console.log('⚠️ toggleOkDataCenterLayer called but disabled - Oklahoma feature archived');
    return;
    /*
    if (!map?.current) {
      return;
    }

    const baseId = `ok-data-center-${siteKey}`;
    
    // First check if the source exists - this indicates the site is mounted
    const source = map.current.getSource(baseId);
    if (!source) {
      console.warn(`⚠️ Source ${baseId} not found - site may not be mounted yet`);
      return;
    }
    
    // Map category names to layer suffixes
    const categoryToLayers = {
      power: [`${baseId}-power-point`, `${baseId}-power-point-halo`, `${baseId}-power-line`],
      water: [`${baseId}-water-fill`, `${baseId}-water-line`, `${baseId}-water-point`],
      university: [`${baseId}-university`],
      office: [`${baseId}-office`],
      transportation: [`${baseId}-transportation`, `${baseId}-transportation-lines`, `${baseId}-transportation-particles-layer`],
      park: [`${baseId}-park`],
      commercial: [`${baseId}-commercial`],
      road: [`${baseId}-road`],
      industrial: [`${baseId}-industrial-fill`, `${baseId}-industrial-point`],
      critical: [`${baseId}-critical`],
      pipeline: [`${baseId}-pipeline`, `${baseId}-pipeline-point`, `${baseId}-pipeline-particles-layer`], // Include pipeline line, points, and particles
      telecom: [`${baseId}-telecom`], // Telecom layer (if it exists)
      other: [`${baseId}-other`]
    };

    // If a specific category is provided, only toggle that category's layers
    let layersToToggle = [];
    if (category && categoryToLayers[category]) {
      layersToToggle = categoryToLayers[category];
    } else if (category) {
      // Category provided but not in mapping - try to find layers dynamically
      // or warn that the category doesn't have a layer mapping
      console.warn(`⚠️ Category "${category}" not found in categoryToLayers mapping. Checking for layers dynamically...`);
      // Try to find any layers that might match this category
      const allLayers = map.current.getStyle().layers || [];
      const categoryLayers = allLayers
        .filter(layer => {
          // Check if layer ID contains the category name
          return layer.id && (
            layer.id.startsWith(`${baseId}-${category}`) ||
            layer.id.includes(`-${category}`)
          );
        })
        .map(layer => layer.id);
      
      if (categoryLayers.length > 0) {
        layersToToggle = categoryLayers;
        console.log(`✅ Found ${categoryLayers.length} layers for category "${category}":`, categoryLayers);
      } else {
        console.warn(`⚠️ No layers found for category "${category}". Toggling all layers for site.`);
        // Fall through to toggle all layers
      }
    }
    
    // If no specific category layers found, toggle all layers for the site
    if (layersToToggle.length === 0) {
      // Toggle all layers for the site - get all layers that use this source
      // First, try to get all layers from the map that use this source
      const allLayers = map.current.getStyle().layers || [];
      const sourceLayers = allLayers
        .filter(layer => {
          // Check if layer uses our source
          const layerSource = layer.source;
          // Also check if layer ID starts with our baseId
          return layerSource === baseId || 
                 layerSource === `${baseId}-radius` ||
                 (layer.id && layer.id.startsWith(baseId));
        })
        .map(layer => layer.id);
      
      // Also include known layer IDs as fallback
      const knownLayers = [
        `${baseId}-power-point`, `${baseId}-power-point-halo`, `${baseId}-power-line`,
        `${baseId}-water-fill`, `${baseId}-water-line`, `${baseId}-water-point`,
        `${baseId}-university`,
        `${baseId}-office`,
        `${baseId}-transportation`,
        `${baseId}-transportation-lines`,
        `${baseId}-transportation-particles-layer`,
        `${baseId}-park`,
        `${baseId}-commercial`,
        `${baseId}-road`,
        `${baseId}-industrial-fill`, `${baseId}-industrial-point`,
        `${baseId}-critical`,
        `${baseId}-pipeline`,
        `${baseId}-pipeline-point`, // Pipeline point markers
        `${baseId}-pipeline-particles-layer`, // Include pipeline particles layer
        `${baseId}-other`,
        `${baseId}-radius`,
        `${baseId}-polygon`, `${baseId}-line`, `${baseId}-point`, `${baseId}-labels`
      ];
      
      // Combine and deduplicate
      layersToToggle = [...new Set([...sourceLayers, ...knownLayers])];
    }

    // Check if any layer exists and determine current visibility state
    let hasVisibleLayer = false;
    let hasAnyLayer = false;
    const existingLayers = [];
    
    // If a specific category is provided, check the visibility state first
    let currentVisibilityState = null;
    if (category && okDataCenterCategoryVisibility[siteKey]) {
      currentVisibilityState = okDataCenterCategoryVisibility[siteKey][category];
      hasVisibleLayer = currentVisibilityState === true;
    }
    
    // If we don't have state info, check the map layers
    if (currentVisibilityState === null) {
      layersToToggle.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          existingLayers.push(layerId);
          hasAnyLayer = true;
          try {
            const visibility = map.current.getLayoutProperty(layerId, 'visibility');
            if (visibility === 'visible' || visibility === undefined) {
              // undefined means visible by default
              hasVisibleLayer = true;
            }
          } catch (e) {
            // If we can't read visibility, assume it's visible
            hasVisibleLayer = true;
          }
        }
      });
    } else {
      // We have state info, but still need to find existing layers
      layersToToggle.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          existingLayers.push(layerId);
          hasAnyLayer = true;
        }
      });
    }

    if (!hasAnyLayer) {
      console.warn(`⚠️ No layers found for ${baseId}${category ? ` (${category})` : ''}`);
      return; // No layers to toggle
    }

    // Determine new visibility state - toggle off if any layer is visible
    const newVisibility = !hasVisibleLayer;

    try {
      // Toggle only the existing layers
      existingLayers.forEach(layerId => {
        try {
          map.current.setLayoutProperty(layerId, 'visibility', newVisibility ? 'visible' : 'none');
        } catch (e) {
          console.warn(`⚠️ Could not toggle layer ${layerId}:`, e);
        }
      });
      
      // Update visibility state if a specific category was toggled
      if (category && okDataCenterCategoryVisibility[siteKey]) {
        setOkDataCenterCategoryVisibility(prev => ({
          ...prev,
          [siteKey]: {
            ...prev[siteKey],
            [category]: newVisibility
          }
        }));
      }
      
      const categoryText = category ? ` (${category})` : '';
      console.log(`🟢 Toggled OK Data Center layer ${siteKey}${categoryText}: ${newVisibility ? 'visible' : 'hidden'} (${existingLayers.length} layers)`);
    } catch (error) {
      console.error(`Error toggling OK Data Center layer ${siteKey}:`, error);
    }
    */
  }, [map, okDataCenterCategoryVisibility]);

  // Function to toggle Whitney layer visibility
  const toggleWhitneyLayer = useCallback((layerName) => {
    if (!map?.current) {
      return;
    }

    const currentVisibility = whitneyLayerVisibility[layerName];
    const newVisibility = !currentVisibility;

    try {
      // Map Whitney categories to map layer names
      const layerMap = {
        office_building: 'osm-features',
        commercial_building: 'osm-features',
        retail_building: 'osm-features',
        government_facility: 'osm-features',
        education: 'osm-features',
        healthcare: 'osm-features',
        service_amenity: 'osm-features',
        emergency_services: 'osm-features',
        transit_hub: 'osm-features',
        highway_access: 'osm-features',
        recreation_area: 'osm-features',
        industrial: 'osm-features',
        county_boundary: 'pinal-county-boundary', // Special handling for county boundary
        pinal_zone: 'pinal-zone' // Special handling for zone layers
      };

      const mapLayerName = layerMap[layerName];
      
      if (layerName === 'pinal_zone') {
        // Toggle all Whitney zone layers
        const zoneKeys = ['data_center', 'downtown', 'lake_whitney'];
        zoneKeys.forEach(zoneKey => {
          const zoneLayers = [`pinal-zone-${zoneKey}-circle`, `pinal-zone-${zoneKey}-fill`];
          zoneLayers.forEach(zoneLayerName => {
            if (map.current.getLayer(zoneLayerName)) {
              map.current.setLayoutProperty(zoneLayerName, 'visibility', newVisibility ? 'visible' : 'none');
            }
          });
        });
      } else if (layerName === 'county_boundary') {
        // Toggle county boundary layers
        const boundaryLayers = ['pinal-county-boundary-fill', 'pinal-county-boundary-line'];
        boundaryLayers.forEach(boundaryLayerName => {
          if (map.current.getLayer(boundaryLayerName)) {
            map.current.setLayoutProperty(boundaryLayerName, 'visibility', newVisibility ? 'visible' : 'none');
          }
        });
      } else if (mapLayerName === 'osm-features') {
        // Toggle Pinal County features by updating the filter
        if (map.current.getLayer('osm-features-lines')) {
          const currentFilter = map.current.getFilter('osm-features-lines');
          // Update filter to hide/show specific category
          const newFilter = newVisibility ? 
            ['any', currentFilter, ['==', ['get', 'category'], layerName]] :
            ['all', currentFilter, ['!=', ['get', 'category'], layerName]];
          map.current.setFilter('osm-features-lines', newFilter);
        }
        
        if (map.current.getLayer('osm-features-fill')) {
          const currentFilter = map.current.getFilter('osm-features-fill');
          const newFilter = newVisibility ? 
            ['any', currentFilter, ['==', ['get', 'category'], layerName]] :
            ['all', currentFilter, ['!=', ['get', 'category'], layerName]];
          map.current.setFilter('osm-features-fill', newFilter);
        }
        
        if (map.current.getLayer('osm-pois')) {
          const currentFilter = map.current.getFilter('osm-pois');
          const newFilter = newVisibility ? 
            ['any', currentFilter, ['==', ['get', 'category'], layerName]] :
            ['all', currentFilter, ['!=', ['get', 'category'], layerName]];
          map.current.setFilter('osm-pois', newFilter);
        }
      }
      
      // Update state
      setWhitneyLayerVisibility(prev => ({
        ...prev,
        [layerName]: newVisibility
      }));
    } catch (error) {
      // Error handling
    }
  }, [map, whitneyLayerVisibility]);

  // Function to toggle Perplexity layer visibility (simplified)
  const togglePerplexityLayer = useCallback((category) => {
    if (!map?.current) {
      return;
    }

    const currentVisibility = perplexityLayerVisibility[category];
    const newVisibility = !currentVisibility;
    const layerId = `perplexity-analysis-${category}`;

    try {
      // Check if the specific category layer exists
      if (map.current.getLayer(layerId)) {
        // Toggle layer visibility using layout property
        map.current.setLayoutProperty(layerId, 'visibility', newVisibility ? 'visible' : 'none');
        
        // Update state
        setPerplexityLayerVisibility(prev => ({
          ...prev,
          [category]: newVisibility
        }));
      }
    } catch (error) {
      // Error handling
    }
  }, [map, perplexityLayerVisibility]);

  // Function to toggle all Perplexity layers (simplified)
  const toggleAllPerplexityLayers = useCallback((visible) => {
    if (!map?.current) {
      return;
    }

    try {
      // Set all categories to the same visibility
      const newVisibility = {};
      Object.keys(perplexityLayerVisibility).forEach(category => {
        newVisibility[category] = visible;
        
        // Toggle individual layer visibility
        const layerId = `perplexity-analysis-${category}`;
        if (map.current.getLayer(layerId)) {
          map.current.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        }
      });
      
      // Update state
      setPerplexityLayerVisibility(newVisibility);
    } catch (error) {
      // Error handling
    }
  }, [map, perplexityLayerVisibility]);

  // Function to toggle Duke Transmission Easements layer visibility
  const toggleDukeLayer = useCallback((serviceType) => {
    if (!map?.current) {
      return;
    }

    const currentVisibility = dukeLayerVisibility[serviceType];
    const newVisibility = !currentVisibility;

    try {
      // Duke layers use paint properties to filter by service type
      const dukeLayerId = 'duke-transmission-easements-layer';
      const dukeOutlineLayerId = 'duke-transmission-easements-layer-outline';
      
      if (map.current.getLayer(dukeLayerId)) {
        // Update fill layer opacity based on service type
        const currentOpacity = map.current.getPaintProperty(dukeLayerId, 'fill-opacity');
        const newOpacity = newVisibility ? 0.5 : 0;
        
        // Use expression to control opacity by service type
        map.current.setPaintProperty(dukeLayerId, 'fill-opacity', [
          'case',
          ['==', ['get', 'Service'], serviceType], newVisibility ? 0.5 : 0,
          currentOpacity
        ]);
      }
      
      if (map.current.getLayer(dukeOutlineLayerId)) {
        // Update outline layer opacity based on service type
        const currentLineOpacity = map.current.getPaintProperty(dukeOutlineLayerId, 'line-opacity');
        const newLineOpacity = newVisibility ? 0.2 : 0;
        
        map.current.setPaintProperty(dukeOutlineLayerId, 'line-opacity', [
          'case',
          ['==', ['get', 'Service'], serviceType], newLineOpacity,
          currentLineOpacity
        ]);
      }
      
      // Update state
      setDukeLayerVisibility(prev => ({
        ...prev,
        [serviceType]: newVisibility
      }));
    } catch (error) {
      // Error handling
    }
  }, [map, dukeLayerVisibility]);

  // Function to toggle all Duke layers
  const toggleAllDukeLayers = useCallback((visible) => {
    if (!map?.current) {
      return;
    }

    try {
      // Set all service types to the same visibility
      const newVisibility = {};
      Object.keys(dukeLayerVisibility).forEach(serviceType => {
        newVisibility[serviceType] = visible;
      });

      // Update Duke layer opacity for all service types
      const dukeLayerId = 'duke-transmission-easements-layer';
      const dukeOutlineLayerId = 'duke-transmission-easements-layer-outline';
      
      if (map.current.getLayer(dukeLayerId)) {
        map.current.setPaintProperty(dukeLayerId, 'fill-opacity', visible ? 0.5 : 0);
      }
      
      if (map.current.getLayer(dukeOutlineLayerId)) {
        map.current.setPaintProperty(dukeOutlineLayerId, 'line-opacity', visible ? 0.2 : 0);
      }
      
      // Update state
      setDukeLayerVisibility(newVisibility);
    } catch (error) {
      // Error handling
    }
  }, [map, dukeLayerVisibility]);

  // Helper function to toggle power markers by fuel type and utility
  const togglePowerMarkers = useCallback((utility, fuelType, isVisible) => {
    // Console log for Hydro marker toggling
    if (utility === 'grda' && fuelType === 'hydro') {
      console.log('🔵 [GRDA Hydro] togglePowerMarkers called:', {
        utility,
        fuelType,
        isVisible,
        timestamp: new Date().toISOString()
      });
    }
    // Archived: Oklahoma transit path handling - removed for Columbus migration
    // TODO: Add Columbus/AEP Ohio transit path handling if needed
    if (false && utility === 'infrastructure' && fuelType === 'transitPath' && map?.current) {
      // Archived: okc-campuses-route removed
      const layerId = 'okc-campuses-route-layer';
      const particleLayerId = 'okc-campuses-route-particles-layer';
      
      let layerFound = false;
      let particleLayerFound = false;
      
      // Try to toggle the main route layer
      if (map.current.getLayer(layerId)) {
        try {
          map.current.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
          layerFound = true;
        } catch (error) {
          console.warn('⚠️ [Transit Path] Error toggling route layer:', error);
        }
      }
      
      // Try to toggle the particle layer
      if (map.current.getLayer(particleLayerId)) {
        try {
          map.current.setLayoutProperty(particleLayerId, 'visibility', isVisible ? 'visible' : 'none');
          particleLayerFound = true;
        } catch (error) {
          console.warn('⚠️ [Transit Path] Error toggling particle layer:', error);
        }
      }
      
      // If either layer is missing, trigger load and retry
      if (!layerFound || !particleLayerFound) {
        // Trigger load event if layers don't exist
        if (typeof window !== 'undefined' && window.mapEventBus) {
          window.mapEventBus.emit('okc-campuses-route:load', true);
          
          // Retry with longer intervals to allow async loading
          let retryCount = 0;
          const maxRetries = 20; // Increased retries
          const retryInterval = 500; // Increased interval to 500ms
          
          const retryToggle = () => {
            if (retryCount >= maxRetries) {
              return; // Silently fail after max retries
            }
            
            const routeLayerExists = map.current.getLayer(layerId);
            const particleLayerExists = map.current.getLayer(particleLayerId);
            
            if (routeLayerExists && particleLayerExists) {
              // Both layers exist, toggle them
              try {
                map.current.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
                map.current.setLayoutProperty(particleLayerId, 'visibility', isVisible ? 'visible' : 'none');
              } catch (error) {
                console.warn('⚠️ [Transit Path] Error toggling layers after retry:', error);
              }
            } else {
              retryCount++;
              setTimeout(retryToggle, retryInterval);
            }
          };
          
          setTimeout(retryToggle, retryInterval);
        }
      }
      
      // Also trigger the event bus to update LayerToggle state
      if (typeof window !== 'undefined' && window.mapEventBus) {
        window.mapEventBus.emit('okc-campuses-route:toggle', isVisible);
      }
      
      return;
    }
    
    // Archived: Oklahoma pipeline layers handling - removed for Columbus migration
    // TODO: Add Columbus/AEP Ohio pipeline handling if needed
    if (false && utility === 'infrastructure' && fuelType === 'pipelines' && map?.current) {
      // Archived: Oklahoma pipeline marker keys removed
      const markerKeys = [
        // 'pryor', 'stillwater', 'tulsa_suburbs', 'oge_substation_okc',
        // 'cimarron_link_tulsa', 'cimarron_link_panhandle', 'cushing',
        // 'tulsa_metro', 'okc_innovation_district', 'ardmore', 'inola', 'tinker_afb',
        // 'pensacola_dam', 'robert_s_kerr_dam', 'salina_pumped_storage',
        // 'wind_generation', 'redbud_power_plant'
      ];
      
      markerKeys.forEach(key => {
        const lineLayerId = `marker-pipeline-${key}-line`;
        const pointLayerId = `marker-pipeline-${key}-point`;
        
        if (map.current.getLayer(lineLayerId)) {
          map.current.setLayoutProperty(lineLayerId, 'visibility', isVisible ? 'visible' : 'none');
        }
        if (map.current.getLayer(pointLayerId)) {
          map.current.setLayoutProperty(pointLayerId, 'visibility', isVisible ? 'visible' : 'none');
        }
      });
      
      // Toggle pipeline endpoint markers
      if (window.pipelineEndpointMarkers) {
        Object.keys(window.pipelineEndpointMarkers).forEach(key => {
          const markers = window.pipelineEndpointMarkers[key];
          if (markers && Array.isArray(markers)) {
            markers.forEach(marker => {
              const markerElement = marker.getElement();
              if (markerElement) {
                if (isVisible) {
                  markerElement.style.setProperty('opacity', '0.5', 'important');
                  markerElement.style.setProperty('visibility', 'visible', 'important');
                  markerElement.style.setProperty('pointer-events', 'auto', 'important');
                } else {
                  markerElement.style.setProperty('opacity', '0', 'important');
                  markerElement.style.setProperty('visibility', 'hidden', 'important');
                  markerElement.style.setProperty('pointer-events', 'none', 'important');
                }
              }
            });
          }
        });
      }
      
      console.log(`Toggled pipeline layers: ${isVisible ? 'show' : 'hide'}`);
      return;
    }
    
    // Archived: Oklahoma power marker arrays - removed for Columbus migration
    // TODO: Add AEP Ohio power marker arrays if needed
    let markerArray;
    if (false && utility === 'grda') {
      markerArray = window.okGRDAPowerMarkers; // Archived: GRDA removed
    } else if (false && utility === 'oge') {
      markerArray = window.okOGEPowerMarkers; // Archived: OG&E removed
    } else if (utility === 'infrastructure') {
      markerArray = window.okCampusTeardropMarkers; // Archived: Oklahoma campuses removed
    }
    
    if (!markerArray) {
      console.warn(`No ${utility} markers found`);
      return;
    }
    
    console.log(`Toggling ${utility} ${fuelType} markers: ${isVisible ? 'show' : 'hide'}, found ${markerArray.length} markers`);

    const fuelColors = {
      hydro: '#06b6d4',
      wind: '#10b981',
      gas: '#f97316',
      coal: '#fbbf24',
      solar: '#f59e0b',
      'infrastructure sites': '#ef4444',
      sites: '#ef4444',
    };

    const targetColor = fuelColors[fuelType.toLowerCase()];
    if (!targetColor && utility !== 'infrastructure') return;

    markerArray.forEach(marker => {
      const markerElement = marker.getElement();
      if (!markerElement) {
        console.warn('Marker element not found');
        return;
      }

      const markerFuelType = markerElement.getAttribute('data-fuel-type');
      const markerUtility = markerElement.getAttribute('data-utility');
      const markerType = markerElement.getAttribute('data-marker-type');
      
      let matchesColor = false;
      
      if (utility === 'infrastructure') {
        if (markerType === 'campus') {
          matchesColor = true;
        }
      } else if (markerFuelType && markerFuelType.toLowerCase() === fuelType.toLowerCase() &&
          markerUtility && markerUtility.toLowerCase() === utility.toLowerCase()) {
        matchesColor = true;
      } else {
        const svg = markerElement.querySelector('svg');
        if (svg) {
          const allElements = svg.querySelectorAll('*');
          allElements.forEach(el => {
            const fill = el.getAttribute('fill');
            const stroke = el.getAttribute('stroke');
            const computedFill = window.getComputedStyle(el).fill;
            const computedStroke = window.getComputedStyle(el).stroke;
            
            if (fill === targetColor || stroke === targetColor || 
                computedFill === targetColor || computedStroke === targetColor ||
                fill?.toLowerCase() === targetColor.toLowerCase() ||
                stroke?.toLowerCase() === targetColor.toLowerCase()) {
              matchesColor = true;
            }
          });
        } else {
          if (utility === 'infrastructure' && targetColor === '#ef4444') {
            const computedColor = window.getComputedStyle(markerElement).color;
            if (computedColor.includes('rgb(239, 68, 68)') || computedColor.includes('#ef4444')) {
              matchesColor = true;
            }
          }
        }
      }

      if (matchesColor) {
        if (isVisible) {
          const originalOpacity = markerElement.getAttribute('data-original-opacity');
          if (originalOpacity) {
            markerElement.style.setProperty('opacity', originalOpacity, 'important');
            markerElement.style.setProperty('visibility', 'visible', 'important');
            markerElement.style.removeProperty('display');
            markerElement.style.setProperty('pointer-events', 'auto', 'important');
          } else {
            markerElement.style.setProperty('opacity', '1', 'important');
            markerElement.style.setProperty('visibility', 'visible', 'important');
            markerElement.style.removeProperty('display');
            markerElement.style.setProperty('pointer-events', 'auto', 'important');
          }
        } else {
          const currentOpacity = markerElement.style.opacity || 
                                 markerElement.getAttribute('data-original-opacity') || 
                                 window.getComputedStyle(markerElement).opacity || 
                                 '1';
          markerElement.setAttribute('data-original-opacity', currentOpacity);
          markerElement.style.setProperty('opacity', '0', 'important');
          markerElement.style.setProperty('visibility', 'hidden', 'important');
          markerElement.style.setProperty('pointer-events', 'none', 'important');
        }
      }
    });
    
    // Also toggle pulse layers for GRDA and OG&E markers
    if ((utility === 'grda' || utility === 'oge') && map?.current) {
      let pulseLayerPrefix;
      
      if (utility === 'grda') {
        pulseLayerPrefix = `${fuelType.toLowerCase()}-power-pulse-layer-`;
      } else if (utility === 'oge') {
        pulseLayerPrefix = `oge-${fuelType.toLowerCase()}-power-pulse-layer-`;
      }
      
      // Console log for Hydro pulse layers
      if (utility === 'grda' && fuelType === 'hydro') {
        console.log('🔵 [GRDA Hydro] Toggling pulse layers:', {
          utility,
          fuelType,
          isVisible,
          pulseLayerPrefix,
          timestamp: new Date().toISOString()
        });
      }
      
      let index = 0;
      let layerCount = 0;
      while (true) {
        const layerId = `${pulseLayerPrefix}${index}`;
        if (map.current.getLayer(layerId)) {
          const currentVisibility = map.current.getLayoutProperty(layerId, 'visibility');
          map.current.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
          layerCount++;
          
          // Console log for Hydro pulse layer visibility changes
          if (utility === 'grda' && fuelType === 'hydro') {
            console.log(`🔵 [GRDA Hydro] Pulse layer ${index}:`, {
              layerId,
              previousVisibility: currentVisibility,
              newVisibility: isVisible ? 'visible' : 'none',
              timestamp: new Date().toISOString()
            });
          }
          
          index++;
        } else {
          break;
        }
      }
      
      // Console log summary for Hydro
      if (utility === 'grda' && fuelType === 'hydro') {
        console.log('🔵 [GRDA Hydro] Pulse layer toggle complete:', {
          totalLayersFound: layerCount,
          isVisible,
          timestamp: new Date().toISOString()
        });
      }
    }
  }, [map]);

  // Function to toggle power legend category visibility
  const togglePowerLegendCategory = useCallback((utility, fuelType, item = null) => {
    // Check if this is Stillwater (data center site) - handle it specially
    if (item && item.isDataCenterSite && item.siteKey) {
      // Toggle Stillwater data center layers
      toggleOkDataCenterLayer(item.siteKey, null);
      return;
    }
    
    let key;
    if (utility === 'infrastructure') {
      if (fuelType === 'pipelines') {
        key = 'pipelines';
      } else if (fuelType === 'transitPath') {
        key = 'transitPath';
      } else if (fuelType === 'stillwater') {
        key = 'stillwater';
      } else {
        key = 'infrastructureSites';
      }
    } else {
      key = `${utility}${fuelType.charAt(0).toUpperCase() + fuelType.slice(1)}`;
    }
    const newVisibility = !powerLegendVisibility[key];
    
    // Console log for Hydro category clicks
    if (utility === 'grda' && fuelType === 'hydro') {
      console.log('🔵 [GRDA Hydro] Legend clicked:', {
        utility,
        fuelType,
        key,
        currentVisibility: powerLegendVisibility[key],
        newVisibility,
        timestamp: new Date().toISOString()
      });
    }
    
    setPowerLegendVisibility(prev => ({
      ...prev,
      [key]: newVisibility
    }));

    togglePowerMarkers(utility, fuelType, newVisibility);
  }, [map, powerLegendVisibility, togglePowerMarkers, toggleOkDataCenterLayer]);

  // Archived: GRDA markers loaded event listener - Oklahoma-specific, removed for Columbus migration
  // TODO: Add AEP Ohio markers loaded event listener if needed
  useEffect(() => {
    // Event listener disabled - GRDA removed
    return undefined;
    /*
    if (!window.mapEventBus) return;
    
    const handleGRDAMarkersLoaded = (data) => {
      // Update legend visibility state to show all GRDA fuel types
      setPowerLegendVisibility(prev => ({
        ...prev,
        grdaHydro: data.showHydro !== false,
        grdaWind: data.showWind !== false,
        grdaGas: data.showGas !== false
      }));
      
      // Show all GRDA markers
      if (window.okGRDAPowerMarkers && window.okGRDAPowerMarkers.length > 0) {
        window.okGRDAPowerMarkers.forEach(marker => {
          const markerElement = marker.getElement();
          if (markerElement) {
            const originalOpacity = markerElement.getAttribute('data-original-opacity') || 
                                   markerElement.style.opacity || 
                                   window.getComputedStyle(markerElement).opacity || 
                                   '1';
            markerElement.setAttribute('data-original-opacity', originalOpacity);
            markerElement.style.setProperty('opacity', originalOpacity, 'important');
            markerElement.style.setProperty('visibility', 'visible', 'important');
            markerElement.style.setProperty('pointer-events', 'auto', 'important');
            markerElement.setAttribute('data-visibility-initialized', 'true');
          }
        });
      }
      
      // Show all GRDA pulse layers
      if (map?.current) {
        ['gas', 'hydro', 'wind'].forEach(fuelType => {
          const pulseLayerPrefix = `${fuelType}-power-pulse-layer-`;
          let index = 0;
          while (true) {
            const layerId = `${pulseLayerPrefix}${index}`;
            if (map.current.getLayer(layerId)) {
              map.current.setLayoutProperty(layerId, 'visibility', 'visible');
              index++;
            } else {
              break;
            }
          }
        });
      }
    };
    
    window.mapEventBus.on('grda-markers-loaded', handleGRDAMarkersLoaded);
    
    return () => {
      if (window.mapEventBus) {
        window.mapEventBus.off('grda-markers-loaded', handleGRDAMarkersLoaded);
      }
    };
    */
  }, [map]);

  // Archived: Initialize GRDA markers visibility - Oklahoma-specific, removed for Columbus migration
  // TODO: Add AEP Ohio markers initialization if needed
  useEffect(() => {
    // Initialization disabled - GRDA removed
    return undefined;
    /*
    if (!map?.current) return;
    
    const checkMarkers = () => {
      const hasGRDA = false; // Archived: window.okGRDAPowerMarkers removed
      
      if (hasGRDA && window.okGRDAPowerMarkers) {
        window.okGRDAPowerMarkers.forEach(marker => {
          const markerElement = marker.getElement();
          if (markerElement) {
            const markerFuelType = markerElement.getAttribute('data-fuel-type');
            const markerUtility = markerElement.getAttribute('data-utility');
            
            // Only initialize visibility once per marker, and only if not already initialized by PerplexityCall
            if (markerFuelType && markerUtility === 'grda' && !markerElement.getAttribute('data-visibility-initialized')) {
              // Check if this fuel type should be visible based on legend state
              const fuelTypeKey = `grda${markerFuelType.charAt(0).toUpperCase() + markerFuelType.slice(1)}`;
              const shouldBeVisible = powerLegendVisibility[fuelTypeKey] || false;
              
              const currentOpacity = markerElement.style.opacity || 
                                     window.getComputedStyle(markerElement).opacity || 
                                     '1';
              markerElement.setAttribute('data-original-opacity', currentOpacity);
              markerElement.setAttribute('data-visibility-initialized', 'true');
              
              // Only hide if legend says it should be hidden
              if (!shouldBeVisible) {
              markerElement.style.setProperty('opacity', '0', 'important');
              markerElement.style.setProperty('visibility', 'hidden', 'important');
              markerElement.style.setProperty('pointer-events', 'none', 'important');
              } else {
                // Show marker if legend says it should be visible
                markerElement.style.setProperty('opacity', currentOpacity, 'important');
                markerElement.style.setProperty('visibility', 'visible', 'important');
                markerElement.style.setProperty('pointer-events', 'auto', 'important');
              }
            }
          }
        });
        
        // Only hide pulse layers if the corresponding fuel type is hidden in legend
        if (map.current) {
          ['gas', 'hydro', 'wind'].forEach(fuelType => {
            const fuelTypeKey = `grda${fuelType.charAt(0).toUpperCase() + fuelType.slice(1)}`;
            const shouldBeVisible = powerLegendVisibility[fuelTypeKey] || false;
            
            const pulseLayerPrefix = `${fuelType}-power-pulse-layer-`;
            let index = 0;
            while (true) {
              const layerId = `${pulseLayerPrefix}${index}`;
              if (map.current.getLayer(layerId)) {
                map.current.setLayoutProperty(layerId, 'visibility', shouldBeVisible ? 'visible' : 'none');
                index++;
              } else {
                break;
              }
            }
          });
        }
      }
    };
    
    checkMarkers();
    // Check less frequently - only every 2 seconds
    const interval = setInterval(checkMarkers, 2000);
    return () => clearInterval(interval);
    */
  }, [map, powerLegendVisibility]);

  // Function to toggle Whitney layer opacity (translucent mode)
  const toggleWhitneyLayerOpacity = useCallback(() => {
    if (!map?.current) {
      return;
    }

    const newTranslucentState = !whitneyLayerOpacity.isTranslucent;
    const opacityValue = newTranslucentState ? 0.4 : 0.8; // 60% more translucent when enabled
    const fillOpacityValue = newTranslucentState ? 0.12 : 0.3; // 60% more translucent for fills
    const circleOpacityValue = newTranslucentState ? 0.4 : 1; // 60% more translucent for circles

    try {
      // Update line layer opacity
      if (map.current.getLayer('osm-features-lines')) {
        map.current.setPaintProperty('osm-features-lines', 'line-opacity', opacityValue);
      }
      
      // Update fill layer opacity
      if (map.current.getLayer('osm-features-fill')) {
        map.current.setPaintProperty('osm-features-fill', 'fill-opacity', fillOpacityValue);
      }
      
      // Update POI circles opacity
      if (map.current.getLayer('osm-pois')) {
        map.current.setPaintProperty('osm-pois', 'circle-opacity', circleOpacityValue);
      }
      
      // Update Pinal County zone circles opacity
      const zoneKeys = ['casa_grande', 'florence', 'lake_whitney_dam'];
      zoneKeys.forEach(zoneKey => {
        if (map.current.getLayer(`pinal-zone-${zoneKey}-circle`)) {
          map.current.setPaintProperty(`pinal-zone-${zoneKey}-circle`, 'line-opacity', opacityValue);
        }
        if (map.current.getLayer(`pinal-zone-${zoneKey}-fill`)) {
          map.current.setPaintProperty(`pinal-zone-${zoneKey}-fill`, 'fill-opacity', fillOpacityValue);
        }
      });
      
      // Update state
      setWhitneyLayerOpacity(prev => ({
        ...prev,
        isTranslucent: newTranslucentState
      }));
    } catch (error) {
      // Error handling
    }
  }, [map, whitneyLayerOpacity.isTranslucent]);

  // Function to toggle OSM layer opacity (translucent mode)
  const toggleOsmLayerOpacity = useCallback(() => {
    if (!map?.current) {
      return;
    }

    const newTranslucentState = !osmLayerOpacity.isTranslucent;
    const opacityValue = newTranslucentState ? 0.35 : 1.0; // 35% opacity when dimmed (65% more dim)

    try {
      // Use the same layer mapping logic as toggleAllOsmLayers
      const locationUniversities = getLocationUniversities(currentLocation);
      const layerMap = {
        // Dynamic university layers based on location
        ...Object.keys(locationUniversities).reduce((acc, key) => {
          acc[key] = `osm-${key}`;
          return acc;
        }, {}),
        // Common layers
        otherUniversities: 'osm-other-universities',
        offices: 'osm-offices', 
        transportation: 'osm-transportation-stations',
        water: 'osm-water',
        parks: 'osm-parks',
        commercial: 'osm-commercial',
        analysisRadius: 'osm-radius',
        // AEP Ohio infrastructure layers - substations by voltage level
        aepOhioSubstationsUltraHigh: 'aep-ohio-substations-ultra-high',
        aepOhioSubstationsHigh: 'aep-ohio-substations-high',
        aepOhioSubstationsMedium: 'aep-ohio-substations-medium',
        aepOhioSubstationsLow: 'aep-ohio-substations-low',
        // AEP Ohio transmission lines by voltage level
        aepOhioTransmissionUltraHigh: 'aep-ohio-transmission-ultra-high',
        aepOhioTransmissionHigh: 'aep-ohio-transmission-high',
        aepOhioTransmissionMedium: 'aep-ohio-transmission-medium',
        aepOhioTransmissionLow: 'aep-ohio-transmission-low'
      };

      // Update each OSM layer's opacity
      Object.values(layerMap).forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          // Try different paint properties based on layer type with error handling
          try {
            const lineOpacity = map.current.getPaintProperty(layerId, 'line-opacity');
            if (lineOpacity !== undefined) {
              map.current.setPaintProperty(layerId, 'line-opacity', opacityValue);
            }
          } catch (e) {
            // Property doesn't exist for this layer type
          }

          try {
            const fillOpacity = map.current.getPaintProperty(layerId, 'fill-opacity');
            if (fillOpacity !== undefined) {
              map.current.setPaintProperty(layerId, 'fill-opacity', opacityValue);
            }
          } catch (e) {
            // Property doesn't exist for this layer type
          }

          try {
            const circleOpacity = map.current.getPaintProperty(layerId, 'circle-opacity');
            if (circleOpacity !== undefined) {
              map.current.setPaintProperty(layerId, 'circle-opacity', opacityValue);
            }
          } catch (e) {
            // Property doesn't exist for this layer type
          }

          try {
            const symbolOpacity = map.current.getPaintProperty(layerId, 'symbol-opacity');
            if (symbolOpacity !== undefined) {
              map.current.setPaintProperty(layerId, 'symbol-opacity', opacityValue);
            }
          } catch (e) {
            // Property doesn't exist for this layer type
          }
        }
      });

      // Also handle water layers specifically (they have separate line and fill layers)
      const waterLayers = ['osm-water-lines', 'osm-water-fill'];
      waterLayers.forEach(waterLayerId => {
        if (map.current.getLayer(waterLayerId)) {
          try {
            const lineOpacity = map.current.getPaintProperty(waterLayerId, 'line-opacity');
            if (lineOpacity !== undefined) {
              map.current.setPaintProperty(waterLayerId, 'line-opacity', opacityValue);
            }
          } catch (e) {
            // Property doesn't exist for this layer type
          }

          try {
            const fillOpacity = map.current.getPaintProperty(waterLayerId, 'fill-opacity');
            if (fillOpacity !== undefined) {
              map.current.setPaintProperty(waterLayerId, 'fill-opacity', opacityValue);
            }
          } catch (e) {
            // Property doesn't exist for this layer type
          }
        }
      });

      // Update state
      setOsmLayerOpacity(prev => ({
        ...prev,
        isTranslucent: newTranslucentState
      }));
    } catch (error) {
      // Error handling
    }
  }, [map, osmLayerOpacity.isTranslucent, currentLocation]);

  // Functions to toggle section collapse
  const toggleWhitneySectionCollapse = useCallback(() => {
    setWhitneySectionCollapsed(prev => !prev);
  }, []);


  const toggleUrbanInfrastructureSectionCollapse = useCallback(() => {
    setUrbanInfrastructureSectionCollapsed(prev => !prev);
  }, []);

  const toggleWhitneyAnalysisAreaSectionCollapse = useCallback(() => {
    setWhitneyAnalysisAreaSectionCollapsed(prev => !prev);
  }, []);
  
  const toggleNcSiteCollapse = useCallback((siteKey) => {
    setNcSiteCollapsed(prev => ({
      ...prev,
      [siteKey]: !prev[siteKey]
    }));
  }, []);

  const toggleOkSiteCollapse = useCallback((siteKey) => {
    setOkSiteCollapsed(prev => ({
      ...prev,
      [siteKey]: !prev[siteKey]
    }));
  }, []);

  // Helper function to get section collapse state and toggle function
  const getSectionCollapseInfo = useCallback((sectionTitle) => {
    const collapsibleSections = {
      'Liberty Infrastructure Analysis': {
        isCollapsed: whitneySectionCollapsed,
        toggle: toggleWhitneySectionCollapse
      },
      'Urban Infrastructure (OpenStreetMap)': {
        isCollapsed: urbanInfrastructureSectionCollapsed,
        toggle: toggleUrbanInfrastructureSectionCollapse
      },
      'Whitney Analysis Area': {
        isCollapsed: whitneyAnalysisAreaSectionCollapsed,
        toggle: toggleWhitneyAnalysisAreaSectionCollapse
      }
    };
    
    return collapsibleSections[sectionTitle] || { isCollapsed: false, toggle: null };
  }, [whitneySectionCollapsed, urbanInfrastructureSectionCollapsed, whitneyAnalysisAreaSectionCollapsed, toggleWhitneySectionCollapse, toggleUrbanInfrastructureSectionCollapse, toggleWhitneyAnalysisAreaSectionCollapse]);

  // Function to toggle all Whitney layers
  const toggleAllWhitneyLayers = useCallback((visible) => {
    if (!map?.current) {
      return;
    }

    try {
      // Toggle all Whitney zone layers
      const zoneKeys = ['casa_grande', 'florence', 'lake_whitney_dam'];
      zoneKeys.forEach(zoneKey => {
        const zoneLayers = [`pinal-zone-${zoneKey}-circle`, `pinal-zone-${zoneKey}-fill`];
        zoneLayers.forEach(zoneLayerName => {
          if (map.current.getLayer(zoneLayerName)) {
            map.current.setLayoutProperty(zoneLayerName, 'visibility', visible ? 'visible' : 'none');
          }
        });
      });

      // Toggle Pinal County features by updating opacity
      if (map.current.getLayer('osm-features-lines')) {
        map.current.setPaintProperty('osm-features-lines', 'line-opacity', visible ? 0.8 : 0);
      }
      if (map.current.getLayer('osm-features-fill')) {
        map.current.setPaintProperty('osm-features-fill', 'fill-opacity', visible ? 0.3 : 0);
      }
      if (map.current.getLayer('osm-pois')) {
        map.current.setPaintProperty('osm-pois', 'circle-opacity', visible ? 1 : 0);
      }
      
      // Toggle county boundary layers
      const boundaryLayers = ['pinal-county-boundary-fill', 'pinal-county-boundary-line'];
      boundaryLayers.forEach(boundaryLayerName => {
        if (map.current.getLayer(boundaryLayerName)) {
          map.current.setLayoutProperty(boundaryLayerName, 'visibility', visible ? 'visible' : 'none');
        }
      });
      
      // Update all Whitney layer visibility states
      const newVisibility = {};
      Object.keys(whitneyLayerVisibility).forEach(layerName => {
        newVisibility[layerName] = visible;
      });
      
      setWhitneyLayerVisibility(newVisibility);
    } catch (error) {
      // Error handling
    }
  }, [map, whitneyLayerVisibility]);

  // Function to toggle all OSM layers
  const toggleAllOsmLayers = useCallback((visible) => {
    if (!map?.current) {
      return;
    }

    const locationUniversities = getLocationUniversities(currentLocation);
    const layerMap = {
      // Dynamic university layers based on location
      ...Object.keys(locationUniversities).reduce((acc, key) => {
        acc[key] = `osm-${key}`;
        return acc;
      }, {}),
      // Common layers
      otherUniversities: 'osm-other-universities',
      offices: 'osm-offices', 
      transportation: 'osm-transportation-stations',
      water: 'osm-water',
      parks: 'osm-parks',
      commercial: 'osm-commercial',
      analysisRadius: 'osm-radius',
      // Road layers
      highways: 'osm-highways',
      primaryRoads: 'osm-primary-roads',
      secondaryRoads: 'osm-secondary-roads',
      localRoads: 'osm-local-roads',
      residentialRoads: 'osm-residential-roads',
      roads: 'osm-roads',
      highway_junctions: 'osm-highway-junctions',
      // AEP Ohio infrastructure layers - substations by voltage level
      aepOhioSubstationsUltraHigh: 'aep-ohio-substations-ultra-high',
      aepOhioSubstationsHigh: 'aep-ohio-substations-high',
      aepOhioSubstationsMedium: 'aep-ohio-substations-medium',
      aepOhioSubstationsLow: 'aep-ohio-substations-low',
      // AEP Ohio transmission lines by voltage level
      aepOhioTransmissionUltraHigh: 'aep-ohio-transmission-ultra-high',
      aepOhioTransmissionHigh: 'aep-ohio-transmission-high',
      aepOhioTransmissionMedium: 'aep-ohio-transmission-medium',
      aepOhioTransmissionLow: 'aep-ohio-transmission-low',
      // AEP Ohio interconnection requests
      aepOhioInterconnectionRequests: 'aep-ohio-interconnection-points'
    };

    const newVisibility = {};
    
    Object.entries(layerMap).forEach(([layerName, mapLayerName]) => {
      try {
        // Special handling for water layer - toggle both water lines and water fill
        if (layerName === 'water') {
          const waterLayers = ['osm-water-lines', 'osm-water-fill'];
          let allLayersExist = true;
          
          waterLayers.forEach(waterLayerName => {
            if (map.current.getLayer(waterLayerName)) {
              map.current.setLayoutProperty(waterLayerName, 'visibility', visible ? 'visible' : 'none');
            } else {
              allLayersExist = false;
            }
          });
          
          if (allLayersExist) {
            newVisibility[layerName] = visible;
          }
        } else {
          if (map.current.getLayer(mapLayerName)) {
            map.current.setLayoutProperty(mapLayerName, 'visibility', visible ? 'visible' : 'none');
            
            // Also toggle associated marker layer if it exists
            const markerLayerName = `${mapLayerName}-markers`;
            if (map.current.getLayer(markerLayerName)) {
              map.current.setLayoutProperty(markerLayerName, 'visibility', visible ? 'visible' : 'none');
            }
            
            newVisibility[layerName] = visible;
          }
        }
      } catch (error) {
        // Error handling
      }
    });

    setOsmLayerVisibility(newVisibility);
  }, [map, currentLocation]);

  // Function to capture current visibility state
  const captureVisibilityState = useCallback(() => {
    // Capture map position and zoom
    let mapState = null;
    if (map?.current) {
      const center = map.current.getCenter();
      const zoom = map.current.getZoom();
      const bearing = map.current.getBearing();
      const pitch = map.current.getPitch();
      
      mapState = {
        center: [center.lng, center.lat],
        zoom: zoom,
        bearing: bearing || 0,
        pitch: pitch || 0
      };
    }

    return {
      osmLayerVisibility: { ...osmLayerVisibility },
      whitneyLayerVisibility: { ...whitneyLayerVisibility },
      perplexityLayerVisibility: { ...perplexityLayerVisibility },
      dukeLayerVisibility: { ...dukeLayerVisibility },
      okDataCenterCategoryVisibility: JSON.parse(JSON.stringify(okDataCenterCategoryVisibility)),
      powerLegendVisibility: { ...powerLegendVisibility },
      startupCategoryVisibility: { ...startupCategoryVisibility },
      whitneyLayerOpacity: { ...whitneyLayerOpacity },
      osmLayerOpacity: { ...osmLayerOpacity },
      ncSiteCollapsed: { ...ncSiteCollapsed },
      okSiteCollapsed: { ...okSiteCollapsed },
      grdaExpanded,
      ogeExpanded,
      infrastructureExpanded,
      whitneySectionCollapsed,
      urbanInfrastructureSectionCollapsed,
      whitneyAnalysisAreaSectionCollapsed,
      mapState // Include map position and zoom
    };
  }, [
    map,
    osmLayerVisibility,
    whitneyLayerVisibility,
    perplexityLayerVisibility,
    dukeLayerVisibility,
    okDataCenterCategoryVisibility,
    powerLegendVisibility,
    startupCategoryVisibility,
    whitneyLayerOpacity,
    osmLayerOpacity,
    ncSiteCollapsed,
    okSiteCollapsed,
    grdaExpanded,
    ogeExpanded,
    infrastructureExpanded,
    whitneySectionCollapsed,
    urbanInfrastructureSectionCollapsed,
    whitneyAnalysisAreaSectionCollapsed
  ]);

  // Function to restore visibility state from preset
  const restoreVisibilityState = useCallback((preset) => {
    if (!preset || !preset.visibilityState) return;

    const state = preset.visibilityState;

    // Restore map position and zoom if available
    if (state.mapState && map?.current) {
      try {
        const { center, zoom, bearing, pitch } = state.mapState;
        if (center && zoom !== undefined) {
          map.current.flyTo({
            center: center,
            zoom: zoom,
            bearing: bearing || 0,
            pitch: pitch || 0,
            duration: 3000, // Slower, more cinematic transition over 3 seconds
            essential: true,
            easing: (t) => {
              // Custom easing function for smoother acceleration/deceleration
              return t * (2 - t);
            }
          });
        }
      } catch (error) {
        console.warn('Error restoring map state:', error);
      }
    }

    // Restore all visibility states with staggered delays for smoother transition
    if (state.osmLayerVisibility) {
      setOsmLayerVisibility(state.osmLayerVisibility);
      // Apply to map layers with staggered delays
      const layerEntries = Object.entries(state.osmLayerVisibility);
      layerEntries.forEach(([layerName, isVisible], index) => {
        const delay = index * 50; // Stagger each layer by 50ms
        setTimeout(() => {
          const locationUniversities = getLocationUniversities(currentLocation);
          const layerMap = {
            ...Object.keys(locationUniversities).reduce((acc, key) => {
              acc[key] = `osm-${key}`;
              return acc;
            }, {}),
            otherUniversities: 'osm-other-universities',
            offices: 'osm-offices',
            transportation: 'osm-transportation-stations',
            water: 'osm-water',
            parks: 'osm-parks',
            commercial: 'osm-commercial',
            analysisRadius: 'osm-radius',
            highways: 'osm-highways',
            primaryRoads: 'osm-primary-roads',
            secondaryRoads: 'osm-secondary-roads',
            localRoads: 'osm-local-roads',
            residentialRoads: 'osm-residential-roads',
            roads: 'osm-roads',
            highway_junctions: 'osm-highway-junctions',
            // AEP Ohio infrastructure layers
            aepOhioSubstations: 'aep-ohio-substations-points',
            // AEP Ohio transmission lines by voltage level
            aepOhioTransmissionUltraHigh: 'aep-ohio-transmission-ultra-high',
            aepOhioTransmissionHigh: 'aep-ohio-transmission-high',
            aepOhioTransmissionMedium: 'aep-ohio-transmission-medium',
            aepOhioTransmissionLow: 'aep-ohio-transmission-low'
          };
          const mapLayerName = layerMap[layerName];
          if (mapLayerName && map?.current) {
            try {
              if (layerName === 'water') {
                const waterLayers = ['osm-water-lines', 'osm-water-fill'];
                waterLayers.forEach(waterLayerName => {
                  if (map.current.getLayer(waterLayerName)) {
                    map.current.setLayoutProperty(waterLayerName, 'visibility', isVisible ? 'visible' : 'none');
                  }
                });
              } else if (map.current.getLayer(mapLayerName)) {
                map.current.setLayoutProperty(mapLayerName, 'visibility', isVisible ? 'visible' : 'none');
                const markerLayerName = `${mapLayerName}-markers`;
                if (map.current.getLayer(markerLayerName)) {
                  map.current.setLayoutProperty(markerLayerName, 'visibility', isVisible ? 'visible' : 'none');
                }
              }
            } catch (error) {
              // Silently handle errors
            }
          }
        }, delay);
      });
    }

    if (state.whitneyLayerVisibility) {
      setWhitneyLayerVisibility(state.whitneyLayerVisibility);
      // Apply to map layers with delay
      const whitneyEntries = Object.entries(state.whitneyLayerVisibility);
      whitneyEntries.forEach(([layerName, isVisible], index) => {
        const delay = 200 + (index * 50); // Start after OSM layers, stagger by 50ms
        setTimeout(() => {
          if (map?.current) {
            try {
              if (layerName === 'pinal_zone') {
                const zoneKeys = ['data_center', 'downtown', 'lake_whitney'];
                zoneKeys.forEach(zoneKey => {
                  const zoneLayers = [`pinal-zone-${zoneKey}-circle`, `pinal-zone-${zoneKey}-fill`];
                  zoneLayers.forEach(zoneLayerName => {
                    if (map.current.getLayer(zoneLayerName)) {
                      map.current.setLayoutProperty(zoneLayerName, 'visibility', isVisible ? 'visible' : 'none');
                    }
                  });
                });
              } else if (layerName === 'county_boundary') {
                const boundaryLayers = ['pinal-county-boundary-fill', 'pinal-county-boundary-line'];
                boundaryLayers.forEach(boundaryLayerName => {
                  if (map.current.getLayer(boundaryLayerName)) {
                    map.current.setLayoutProperty(boundaryLayerName, 'visibility', isVisible ? 'visible' : 'none');
                  }
                });
              }
            } catch (error) {
              // Silently handle errors
            }
          }
        }, delay);
      });
    }

    if (state.perplexityLayerVisibility) {
      setPerplexityLayerVisibility(state.perplexityLayerVisibility);
      // Apply to map layers with delay
      const perplexityEntries = Object.entries(state.perplexityLayerVisibility);
      perplexityEntries.forEach(([category, isVisible], index) => {
        const delay = 400 + (index * 50); // Start after Whitney layers, stagger by 50ms
        setTimeout(() => {
          if (map?.current) {
            try {
              const layerId = `perplexity-analysis-${category}`;
              if (map.current.getLayer(layerId)) {
                map.current.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
              }
            } catch (error) {
              // Silently handle errors
            }
          }
        }, delay);
      });
    }

    if (state.dukeLayerVisibility) {
      setDukeLayerVisibility(state.dukeLayerVisibility);
      // Apply to map layers using paint properties with delay
      setTimeout(() => {
        if (map?.current) {
          try {
            const dukeLayerId = 'duke-transmission-easements-layer';
            const dukeOutlineLayerId = 'duke-transmission-easements-layer-outline';
            
            if (map.current.getLayer(dukeLayerId)) {
              Object.entries(state.dukeLayerVisibility).forEach(([serviceType, isVisible]) => {
                const currentOpacity = map.current.getPaintProperty(dukeLayerId, 'fill-opacity');
                map.current.setPaintProperty(dukeLayerId, 'fill-opacity', [
                  'case',
                  ['==', ['get', 'Service'], serviceType], isVisible ? 0.5 : 0,
                  currentOpacity
                ]);
              });
            }
            
            if (map.current.getLayer(dukeOutlineLayerId)) {
              Object.entries(state.dukeLayerVisibility).forEach(([serviceType, isVisible]) => {
                const currentLineOpacity = map.current.getPaintProperty(dukeOutlineLayerId, 'line-opacity');
                map.current.setPaintProperty(dukeOutlineLayerId, 'line-opacity', [
                  'case',
                  ['==', ['get', 'Service'], serviceType], isVisible ? 0.2 : 0,
                  currentLineOpacity
                ]);
              });
            }
          } catch (error) {
            // Silently handle errors
          }
        }
      }, 500); // Start after Perplexity layers
    }

    if (state.okDataCenterCategoryVisibility) {
      setOkDataCenterCategoryVisibility(JSON.parse(JSON.stringify(state.okDataCenterCategoryVisibility)));
      // Apply to map layers with delay
      let categoryIndex = 0;
      Object.entries(state.okDataCenterCategoryVisibility).forEach(([siteKey, categories]) => {
        if (categories && typeof categories === 'object') {
          Object.entries(categories).forEach(([category, isVisible]) => {
            if (isVisible !== undefined) {
              const delay = 1000 + (categoryIndex * 30); // Start after other layers, stagger by 30ms
              setTimeout(() => {
                const baseId = `ok-data-center-${siteKey}`;
                const categoryToLayers = {
                  power: [`${baseId}-power-point`, `${baseId}-power-point-halo`, `${baseId}-power-line`],
                  water: [`${baseId}-water-fill`, `${baseId}-water-line`, `${baseId}-water-point`],
                  university: [`${baseId}-university`],
                  office: [`${baseId}-office`],
                  transportation: [`${baseId}-transportation`, `${baseId}-transportation-lines`, `${baseId}-transportation-particles-layer`],
                  park: [`${baseId}-park`],
                  commercial: [`${baseId}-commercial`],
                  road: [`${baseId}-road`],
                  industrial: [`${baseId}-industrial-fill`, `${baseId}-industrial-point`],
                  critical: [`${baseId}-critical`],
                  pipeline: [`${baseId}-pipeline`, `${baseId}-pipeline-point`, `${baseId}-pipeline-particles-layer`],
                  telecom: [`${baseId}-telecom`],
                  other: [`${baseId}-other`]
                };
                
                const layersToToggle = categoryToLayers[category] || [];
                layersToToggle.forEach(layerId => {
                  if (map?.current && map.current.getLayer(layerId)) {
                    try {
                      map.current.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
                    } catch (error) {
                      // Silently handle errors
                    }
                  }
                });
              }, delay);
              categoryIndex++;
            }
          });
        }
      });
    }

    if (state.powerLegendVisibility) {
      setPowerLegendVisibility(state.powerLegendVisibility);
      // Apply power marker visibility with delay
      const powerEntries = Object.entries(state.powerLegendVisibility);
      powerEntries.forEach(([key, isVisible], index) => {
        const delay = 600 + (index * 50); // Start after Perplexity layers, stagger by 50ms
        setTimeout(() => {
          // Use togglePowerMarkers directly to set visibility
          if (key === 'grdaHydro') togglePowerMarkers('grda', 'hydro', isVisible);
          else if (key === 'grdaWind') togglePowerMarkers('grda', 'wind', isVisible);
          else if (key === 'grdaGas') togglePowerMarkers('grda', 'gas', isVisible);
          else if (key === 'ogeGas') togglePowerMarkers('oge', 'gas', isVisible);
          else if (key === 'ogeCoal') togglePowerMarkers('oge', 'coal', isVisible);
          else if (key === 'ogeWind') togglePowerMarkers('oge', 'wind', isVisible);
          else if (key === 'ogeSolar') togglePowerMarkers('oge', 'solar', isVisible);
          else if (key === 'infrastructureSites') togglePowerMarkers('infrastructure', 'sites', isVisible);
          else if (key === 'stillwater') togglePowerMarkers('infrastructure', 'stillwater', isVisible);
          else if (key === 'pipelines') togglePowerMarkers('infrastructure', 'pipelines', isVisible);
          else if (key === 'transitPath') togglePowerMarkers('infrastructure', 'transitPath', isVisible);
        }, delay);
      });
    }

    if (state.startupCategoryVisibility) {
      setStartupCategoryVisibilityState(state.startupCategoryVisibility);
      // Apply to map layer with delay
      setTimeout(() => {
        if (map?.current && map.current.getLayer('serp-startup-ecosystem-markers')) {
          try {
            const opacityExpression = [
              'case',
              ['==', ['get', 'category'], 'AI/ML'], state.startupCategoryVisibility['AI/ML'] ? 0.2 : 0,
              ['==', ['get', 'category'], 'Biotech/Health'], state.startupCategoryVisibility['Biotech/Health'] ? 0.2 : 0,
              ['==', ['get', 'category'], 'FinTech'], state.startupCategoryVisibility['FinTech'] ? 0.2 : 0,
              ['==', ['get', 'category'], 'CleanTech'], state.startupCategoryVisibility['CleanTech'] ? 0.2 : 0,
              ['==', ['get', 'category'], 'Enterprise'], state.startupCategoryVisibility['Enterprise'] ? 0.2 : 0,
              ['==', ['get', 'category'], 'Hardware'], state.startupCategoryVisibility['Hardware'] ? 0.2 : 0,
              ['==', ['get', 'category'], 'Other'], state.startupCategoryVisibility['Other'] ? 0.2 : 0,
              0.2
            ];
            map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-opacity', opacityExpression);
            map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-stroke-opacity', opacityExpression);
          } catch (error) {
            // Silently handle errors
          }
        }
      }, 800); // Start after power layers
    }

    if (state.whitneyLayerOpacity) {
      setWhitneyLayerOpacity(state.whitneyLayerOpacity);
      if (map?.current && state.whitneyLayerOpacity.isTranslucent !== whitneyLayerOpacity.isTranslucent) {
        // Apply opacity with delay for smoother transition
        setTimeout(() => {
          const opacityValue = state.whitneyLayerOpacity.isTranslucent ? 0.4 : 0.8;
          const fillOpacityValue = state.whitneyLayerOpacity.isTranslucent ? 0.12 : 0.3;
          const circleOpacityValue = state.whitneyLayerOpacity.isTranslucent ? 0.4 : 1;
          
          try {
            if (map.current.getLayer('osm-features-lines')) {
              map.current.setPaintProperty('osm-features-lines', 'line-opacity', opacityValue);
            }
            if (map.current.getLayer('osm-features-fill')) {
              map.current.setPaintProperty('osm-features-fill', 'fill-opacity', fillOpacityValue);
            }
            if (map.current.getLayer('osm-pois')) {
              map.current.setPaintProperty('osm-pois', 'circle-opacity', circleOpacityValue);
            }
          } catch (error) {
            // Silently handle errors
          }
        }, 1200); // Start after other layer changes
      }
    }

    if (state.osmLayerOpacity) {
      setOsmLayerOpacity(state.osmLayerOpacity);
      if (map?.current && state.osmLayerOpacity.isTranslucent !== osmLayerOpacity.isTranslucent) {
        // Apply opacity with delay for smoother transition
        setTimeout(() => {
          const opacityValue = state.osmLayerOpacity.isTranslucent ? 0.35 : 1.0;
          // Apply to all OSM layers
          const locationUniversities = getLocationUniversities(currentLocation);
          const layerMap = {
            ...Object.keys(locationUniversities).reduce((acc, key) => {
              acc[key] = `osm-${key}`;
              return acc;
            }, {}),
            otherUniversities: 'osm-other-universities',
            offices: 'osm-offices',
            transportation: 'osm-transportation-stations',
            water: 'osm-water',
            parks: 'osm-parks',
            commercial: 'osm-commercial',
            analysisRadius: 'osm-radius',
            // AEP Ohio infrastructure layers
            aepOhioSubstations: 'aep-ohio-substations-points',
            // AEP Ohio transmission lines by voltage level
            aepOhioTransmissionUltraHigh: 'aep-ohio-transmission-ultra-high',
            aepOhioTransmissionHigh: 'aep-ohio-transmission-high',
            aepOhioTransmissionMedium: 'aep-ohio-transmission-medium',
            aepOhioTransmissionLow: 'aep-ohio-transmission-low'
          };
          
          Object.values(layerMap).forEach(layerId => {
            if (map.current.getLayer(layerId)) {
              try {
                ['line-opacity', 'fill-opacity', 'circle-opacity', 'symbol-opacity'].forEach(prop => {
                  const currentValue = map.current.getPaintProperty(layerId, prop);
                  if (currentValue !== undefined) {
                    map.current.setPaintProperty(layerId, prop, opacityValue);
                  }
                });
              } catch (error) {
                // Silently handle errors
              }
            }
          });
        }, 1200); // Start after other layer changes
      }
    }

    if (state.ncSiteCollapsed) {
      setNcSiteCollapsed(state.ncSiteCollapsed);
    }

    if (state.okSiteCollapsed) {
      setOkSiteCollapsed(state.okSiteCollapsed);
    }

    // Don't restore expanded states for GRDA, OG&E, and Infrastructure sections
    // Keep them in their current collapsed/expanded state when loading scenes
    // if (state.grdaExpanded !== undefined) {
    //   setGrdaExpanded(state.grdaExpanded);
    // }

    // if (state.ogeExpanded !== undefined) {
    //   setOgeExpanded(state.ogeExpanded);
    // }

    // if (state.infrastructureExpanded !== undefined) {
    //   setInfrastructureExpanded(state.infrastructureExpanded);
    // }

    if (state.whitneySectionCollapsed !== undefined) {
      setWhitneySectionCollapsed(state.whitneySectionCollapsed);
    }

    if (state.urbanInfrastructureSectionCollapsed !== undefined) {
      setUrbanInfrastructureSectionCollapsed(state.urbanInfrastructureSectionCollapsed);
    }

    if (state.whitneyAnalysisAreaSectionCollapsed !== undefined) {
      setWhitneyAnalysisAreaSectionCollapsed(state.whitneyAnalysisAreaSectionCollapsed);
    }
  }, [
    map,
    currentLocation,
    whitneyLayerOpacity,
    osmLayerOpacity,
    togglePowerMarkers,
    setStartupCategoryVisibilityState
  ]);

  // Visibility preset handlers
  const handleSavePreset = useCallback((preset) => {
    // Preset is already saved by VisibilityPresets component
    // This callback can be used for additional logic if needed
  }, []);

  const handleLoadPreset = useCallback((preset) => {
    restoreVisibilityState(preset);
  }, [restoreVisibilityState]);

  const handleUpdatePreset = useCallback((preset) => {
    // Preset is already updated by VisibilityPresets component
    // This callback can be used for additional logic if needed
  }, []);

  const handleDeletePreset = useCallback((presetId) => {
    // Preset is already deleted by VisibilityPresets component
    // This callback can be used for additional logic if needed
  }, []);

  // Function to turn all layers off and reset everything
  const turnAllLayersOff = useCallback(() => {
    if (!map?.current) {
      return;
    }

    try {
      // Turn off all OSM layers
      toggleAllOsmLayers(false);
      
      // Turn off all Whitney layers
      toggleAllWhitneyLayers(false);
      
      // Turn off all Perplexity layers
      toggleAllPerplexityLayers(false);
      
      // Turn off all Duke layers
      toggleAllDukeLayers(false);
      
      // Turn off all startup categories
      toggleAllStartupCategories(false);
      
      // Turn off all power legend items (GRDA, OG&E, Infrastructure, Stillwater)
      setPowerLegendVisibility({
        grdaHydro: false,
        grdaWind: false,
        grdaGas: false,
        ogeGas: false,
        ogeCoal: false,
        ogeWind: false,
        ogeSolar: false,
        infrastructureSites: false,
        stillwater: false,
        pipelines: false,
        transitPath: false,
      });
      
      // Hide all GRDA power markers
      if (window.okGRDAPowerMarkers && Array.isArray(window.okGRDAPowerMarkers)) {
        window.okGRDAPowerMarkers.forEach(marker => {
          const markerElement = marker.getElement();
          if (markerElement) {
            markerElement.style.setProperty('opacity', '0', 'important');
            markerElement.style.setProperty('visibility', 'hidden', 'important');
            markerElement.style.setProperty('pointer-events', 'none', 'important');
          }
        });
      }
      
      // Hide all OG&E power markers
      if (window.okOGEPowerMarkers && Array.isArray(window.okOGEPowerMarkers)) {
        window.okOGEPowerMarkers.forEach(marker => {
          const markerElement = marker.getElement();
          if (markerElement) {
            markerElement.style.setProperty('opacity', '0', 'important');
            markerElement.style.setProperty('visibility', 'hidden', 'important');
            markerElement.style.setProperty('pointer-events', 'none', 'important');
          }
        });
      }
      
      // Hide all infrastructure (campus) markers
      if (window.okCampusTeardropMarkers && Array.isArray(window.okCampusTeardropMarkers)) {
        window.okCampusTeardropMarkers.forEach(marker => {
          const markerElement = marker.getElement();
          if (markerElement) {
            markerElement.style.setProperty('opacity', '0', 'important');
            markerElement.style.setProperty('visibility', 'hidden', 'important');
            markerElement.style.setProperty('pointer-events', 'none', 'important');
          }
        });
      }
      
      // Hide all GRDA pulse animation layers
      ['gas', 'hydro', 'wind'].forEach(fuelType => {
        const pulseLayerPrefix = `${fuelType}-power-pulse-layer-`;
        let index = 0;
        while (true) {
          const layerId = `${pulseLayerPrefix}${index}`;
          if (map.current.getLayer(layerId)) {
            map.current.setLayoutProperty(layerId, 'visibility', 'none');
            index++;
          } else {
            break;
          }
        }
      });
      
      // Hide all OG&E pulse animation layers
      ['gas', 'coal', 'wind', 'solar'].forEach(fuelType => {
        const pulseLayerPrefix = `oge-${fuelType}-power-pulse-layer-`;
        let index = 0;
        while (true) {
          const layerId = `${pulseLayerPrefix}${index}`;
          if (map.current.getLayer(layerId)) {
            map.current.setLayoutProperty(layerId, 'visibility', 'none');
            index++;
          } else {
            break;
          }
        }
      });
      
      // Hide pipeline layers
      const markerKeys = [
        'pryor', 'stillwater', 'tulsa_suburbs', 'oge_substation_okc',
        'cimarron_link_tulsa', 'cimarron_link_panhandle', 'cushing',
        'tulsa_metro', 'okc_innovation_district', 'ardmore', 'inola', 'tinker_afb',
        'pensacola_dam', 'robert_s_kerr_dam', 'salina_pumped_storage',
        'wind_generation', 'redbud_power_plant'
      ];
      
      markerKeys.forEach(key => {
        const lineLayerId = `marker-pipeline-${key}-line`;
        const pointLayerId = `marker-pipeline-${key}-point`;
        
        if (map.current.getLayer(lineLayerId)) {
          map.current.setLayoutProperty(lineLayerId, 'visibility', 'none');
        }
        if (map.current.getLayer(pointLayerId)) {
          map.current.setLayoutProperty(pointLayerId, 'visibility', 'none');
        }
      });
      
      // Hide pipeline endpoint markers
      if (window.pipelineEndpointMarkers) {
        Object.keys(window.pipelineEndpointMarkers).forEach(key => {
          const markers = window.pipelineEndpointMarkers[key];
          if (markers && Array.isArray(markers)) {
            markers.forEach(marker => {
              const markerElement = marker.getElement();
              if (markerElement) {
                markerElement.style.setProperty('opacity', '0', 'important');
                markerElement.style.setProperty('visibility', 'hidden', 'important');
                markerElement.style.setProperty('pointer-events', 'none', 'important');
              }
            });
          }
        });
      }
      
      // Hide transit path (green route) layers
      const transitPathLayerId = 'okc-campuses-route-layer';
      const transitPathParticleLayerId = 'okc-campuses-route-particles-layer';
      
      if (map.current.getLayer(transitPathLayerId)) {
        map.current.setLayoutProperty(transitPathLayerId, 'visibility', 'none');
      }
      if (map.current.getLayer(transitPathParticleLayerId)) {
        map.current.setLayoutProperty(transitPathParticleLayerId, 'visibility', 'none');
      }
      
      // Notify event bus about transit path toggle
      if (typeof window !== 'undefined' && window.mapEventBus) {
        window.mapEventBus.emit('okc-campuses-route:toggle', false);
      }
      
      // Close all open popups
      if (window.okGRDAPowerMarkers && Array.isArray(window.okGRDAPowerMarkers)) {
        window.okGRDAPowerMarkers.forEach(marker => {
          if (marker.getPopup && marker.getPopup()) {
            marker.getPopup().remove();
          }
        });
      }
      
      if (window.okOGEPowerMarkers && Array.isArray(window.okOGEPowerMarkers)) {
        window.okOGEPowerMarkers.forEach(marker => {
          if (marker.getPopup && marker.getPopup()) {
            marker.getPopup().remove();
          }
        });
      }
      
      if (window.okCampusTeardropMarkers && Array.isArray(window.okCampusTeardropMarkers)) {
        window.okCampusTeardropMarkers.forEach(marker => {
          if (marker.getPopup && marker.getPopup()) {
            marker.getPopup().remove();
          }
        });
      }
      
      // Turn off all OK Data Center site layers
      okDataCenterData.sites.forEach(site => {
        const baseId = `ok-data-center-${site.key}`;
        const allLayers = map.current.getStyle().layers || [];
        const siteLayers = allLayers
          .filter(layer => layer.id && layer.id.startsWith(baseId))
          .map(layer => layer.id);
        
        siteLayers.forEach(layerId => {
          if (map.current.getLayer(layerId)) {
            map.current.setLayoutProperty(layerId, 'visibility', 'none');
          }
        });
        
        // Update visibility state to false for all categories
        if (okDataCenterCategoryVisibility[site.key]) {
          const updatedVisibility = {};
          Object.keys(okDataCenterCategoryVisibility[site.key]).forEach(category => {
            updatedVisibility[category] = false;
          });
          setOkDataCenterCategoryVisibility(prev => ({
            ...prev,
            [site.key]: updatedVisibility
          }));
        }
      });
      
      // Turn off all NC Power site layers
      ncPowerData.sites.forEach(site => {
        // Get all layers for this site and turn them off
        const baseId = `nc-power-${site.key}`;
        const allLayers = map.current.getStyle().layers || [];
        const siteLayers = allLayers
          .filter(layer => layer.id && layer.id.startsWith(baseId))
          .map(layer => layer.id);
        
        siteLayers.forEach(layerId => {
          if (map.current.getLayer(layerId)) {
            map.current.setLayoutProperty(layerId, 'visibility', 'none');
          }
        });
      });
      
      // Clean up Perplexity route layers (Pryor to GRDA)
      const perplexityRouteLayers = [
        'pryor-grda-route-layer',
        'pryor-grda-route-particles-layer'
      ];
      const perplexityRouteSources = [
        'pryor-grda-route-source',
        'pryor-grda-route-particles'
      ];
      
      perplexityRouteLayers.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });
      
      perplexityRouteSources.forEach(sourceId => {
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      
      // Clean up Firecrawl route layers (Stillwater to OG&E, Toyota Access, Greensboro-Durham)
      const firecrawlRouteLayers = [
        'stillwater-oge-route-layer',
        'stillwater-oge-route-particles-layer',
        'toyota-access-route-layer',
        'toyota-access-route-particles-layer',
        'greensboro-durham-route-layer',
        'greensboro-durham-route-particles-layer'
      ];
      const firecrawlRouteSources = [
        'stillwater-oge-route-source',
        'stillwater-oge-route-particles',
        'toyota-access-route-source',
        'toyota-access-route-particles',
        'greensboro-durham-route-source',
        'greensboro-durham-route-particles'
      ];
      
      firecrawlRouteLayers.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });
      
      firecrawlRouteSources.forEach(sourceId => {
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      
      // Cancel Firecrawl route animation frames
      if (window.toyotaAccessRouteAnimationFrame) {
        cancelAnimationFrame(window.toyotaAccessRouteAnimationFrame);
        window.toyotaAccessRouteAnimationFrame = null;
      }
      
      if (window.greensboroDurhamRouteAnimationFrame) {
        cancelAnimationFrame(window.greensboroDurhamRouteAnimationFrame);
        window.greensboroDurhamRouteAnimationFrame = null;
      }
      
      // Clean up OSM route layers (OKC Campuses)
      const osmRouteLayers = [
        'okc-campuses-route-layer',
        'okc-campuses-route-particles-layer'
      ];
      const osmRouteSources = [
        'okc-campuses-route-source',
        'okc-campuses-route-particles'
      ];
      
      osmRouteLayers.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });
      
      osmRouteSources.forEach(sourceId => {
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      
      // Clean up any animation frames for route particles
      if (window.pryorGRDARouteAnimationFrame) {
        cancelAnimationFrame(window.pryorGRDARouteAnimationFrame);
        window.pryorGRDARouteAnimationFrame = null;
      }
      
      if (window.stillwaterOGERouteAnimationFrame) {
        cancelAnimationFrame(window.stillwaterOGERouteAnimationFrame);
        window.stillwaterOGERouteAnimationFrame = null;
      }
      
      if (window.okcCampusesRouteAnimationFrame) {
        cancelAnimationFrame(window.okcCampusesRouteAnimationFrame);
        window.okcCampusesRouteAnimationFrame = null;
      }
      
      // Clean up Perplexity gentrification layers if they exist
      if (typeof window !== 'undefined' && window.cleanupGentrificationLayers) {
        try {
          window.cleanupGentrificationLayers(map);
        } catch (e) {
          console.warn('⚠️ Error cleaning up gentrification layers:', e);
        }
      }
      
      // Clean up SERP radius particles (Google sites circle animations)
      const serpRadiusLayers = [
        'serp-radius-particles-layer',
        'startup-intelligence-radius-particles-layer'
      ];
      const serpRadiusSources = [
        'serp-radius-particles',
        'startup-intelligence-radius-particles'
      ];
      
      serpRadiusLayers.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });
      
      serpRadiusSources.forEach(sourceId => {
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      
      // Cancel SERP radius particle animation frames
      if (window.serpRadiusAnimationFrame) {
        cancelAnimationFrame(window.serpRadiusAnimationFrame);
        window.serpRadiusAnimationFrame = null;
      }
      
      if (window.startupIntelligenceRadiusAnimationFrame) {
        cancelAnimationFrame(window.startupIntelligenceRadiusAnimationFrame);
        window.startupIntelligenceRadiusAnimationFrame = null;
      }
      
      // Clean up Pryor/Stillwater circle animations (from OSM)
      const pryorStillwaterLayers = [
        'pryor-stillwater-circles-fill-small',
        'pryor-stillwater-circles-layer-small',
        'pryor-stillwater-circles-fill-large',
        'pryor-stillwater-circles-layer-large',
        'pryor-stillwater-circles-fill-xlarge',
        'pryor-stillwater-circles-layer-xlarge'
      ];
      const pryorStillwaterSource = 'pryor-stillwater-circles-source';
      
      pryorStillwaterLayers.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });
      
      if (map.current.getSource(pryorStillwaterSource)) {
        map.current.removeSource(pryorStillwaterSource);
      }
      
      // Clean up Stillwater circle animation (DeckGL overlay)
      if (window.stillwaterCircleAnimationRef) {
        try {
          if (window.stillwaterCircleAnimationRef.animationRef?.current) {
            cancelAnimationFrame(window.stillwaterCircleAnimationRef.animationRef.current);
          }
          if (window.stillwaterCircleAnimationRef.overlayRef?.current) {
            window.stillwaterCircleAnimationRef.overlayRef.current.remove();
          }
          window.stillwaterCircleAnimationRef = null;
        } catch (e) {
          console.warn('⚠️ Error cleaning up Stillwater circle animation:', e);
        }
      }
      
      // Reset SERP radius particles visibility state
      if (window.serpRadiusParticlesVisibility) {
        window.serpRadiusParticlesVisibility = {};
      }
      
      // Reset component states to allow remounting
      // Emit events to reset Perplexity, Firecrawl, and OSM states
      if (typeof window !== 'undefined' && window.mapEventBus) {
        window.mapEventBus.emit('perplexity-route:cleanup', true);
        window.mapEventBus.emit('firecrawl-route:cleanup', true);
        window.mapEventBus.emit('osm-route:cleanup', true);
      }
      
      console.log('🔴 All layers turned off and reset');
    } catch (error) {
      console.error('Error turning off all layers:', error);
    }
  }, [map, toggleAllOsmLayers, toggleAllWhitneyLayers, toggleAllPerplexityLayers, toggleAllDukeLayers, toggleAllStartupCategories, okDataCenterData, okDataCenterCategoryVisibility, ncPowerData, setPowerLegendVisibility]);

  // Listen for table row clicks to find matching legend items
  useEffect(() => {
    if (!window.mapEventBus) return;

    const handleTableNodeSelected = (bridgeData) => {
      // Find matching legend item
      const matchingMarker = findMatchingLegendItem(bridgeData);
      
      if (matchingMarker) {
        // Highlight the matching marker
        setSelectedMarker(matchingMarker);
        
        // Trigger map interactions
        highlightMarkerOnMap(matchingMarker);
        zoomToMarker(matchingMarker);
        
        // Emit event for popup system to get coordinates
        if (window.mapEventBus) {
          window.mapEventBus.emit('legend:matchFound', matchingMarker);
        }
        
        // Note: We don't call handleMarkerClick here because we only want to show the popup,
        // not switch to node mode which would close the popup
      }
    };

    window.mapEventBus.on('table:nodeSelected', handleTableNodeSelected);

    return () => {
      window.mapEventBus.off('table:nodeSelected', handleTableNodeSelected);
    };
  }, [legendData, handleMarkerClick, findMatchingLegendItem, highlightMarkerOnMap, zoomToMarker]);

  // Track power legend marker visibility for dynamic updates
  const [powerMarkersDetected, setPowerMarkersDetected] = useState({
    grda: false,
    oge: false,
    infrastructure: false,
    pipelines: false
  });
  
  // Poll for power marker visibility and pipeline layers
  useEffect(() => {
    const checkPowerMarkers = () => {
      const hasGRDA = typeof window !== 'undefined' && window.okGRDAPowerMarkers && window.okGRDAPowerMarkers.length > 0;
      const hasOGE = typeof window !== 'undefined' && window.okOGEPowerMarkers && window.okOGEPowerMarkers.length > 0;
      const hasInfrastructure = typeof window !== 'undefined' && window.okCampusTeardropMarkers && window.okCampusTeardropMarkers.length > 0;
      
      // Check for pipeline layers
      let hasPipelines = false;
      let hasTransitPath = false;
      if (map?.current) {
        const markerKeys = [
          'pryor', 'stillwater', 'tulsa_suburbs', 'oge_substation_okc',
          'cimarron_link_tulsa', 'cimarron_link_panhandle', 'cushing',
          'tulsa_metro', 'okc_innovation_district', 'ardmore', 'inola', 'tinker_afb',
          'pensacola_dam', 'robert_s_kerr_dam', 'salina_pumped_storage',
          'wind_generation', 'redbud_power_plant'
        ];
        hasPipelines = markerKeys.some(key => {
          const lineLayerId = `marker-pipeline-${key}-line`;
          return map.current.getLayer(lineLayerId);
        });
        
        // Check for transit path layer
        hasTransitPath = map.current.getLayer('okc-campuses-route-layer') !== undefined;
      }
      
      setPowerMarkersDetected({
        grda: hasGRDA,
        oge: hasOGE,
        infrastructure: hasInfrastructure,
        pipelines: hasPipelines,
        transitPath: hasTransitPath
      });
    };
    
    checkPowerMarkers();
    const interval = setInterval(checkPowerMarkers, 500);
    return () => clearInterval(interval);
  }, [map]);

  // Create legend sections from real data (SERP + OSM + Perplexity)
  const legendSections = buildLegendSections({
    currentLocation,
    legendData,
    osmData,
    whitneyData,
    perplexityData,
    dukeData,
    ncPowerData,
    okDataCenterData,
    gridData,
    commuteData,
    startupCategoryVisibility,
    osmLayerVisibility,
    whitneyLayerVisibility,
    perplexityLayerVisibility,
    dukeLayerVisibility,
    okDataCenterCategoryVisibility,
    powerLegendVisibility,
    grdaExpanded,
    ogeExpanded,
    infrastructureExpanded,
    map,
    powerMarkersDetected
  });

  return (
    <>
      <LegendPanel
        isVisible={isVisible}
        onToggle={onToggle}
        cardHeight={cardHeight}
        legendSections={legendSections}
        legendData={legendData}
        osmData={osmData}
        whitneyData={whitneyData}
        perplexityData={perplexityData}
        dukeData={dukeData}
        okDataCenterData={okDataCenterData}
        ncPowerData={ncPowerData}
        selectedMarker={selectedMarker}
        startupCategoryVisibility={startupCategoryVisibility}
        whitneyLayerOpacity={whitneyLayerOpacity}
        osmLayerOpacity={osmLayerOpacity}
        ncSiteCollapsed={ncSiteCollapsed}
        okSiteCollapsed={okSiteCollapsed}
        perplexityLayerVisibility={perplexityLayerVisibility}
        dukeLayerVisibility={dukeLayerVisibility}
        osmLayerVisibility={osmLayerVisibility}
        handleLegendItemClick={handleLegendItemClick}
        turnAllLayersOff={turnAllLayersOff}
        getSectionCollapseInfo={getSectionCollapseInfo}
        toggleNcSiteCollapse={toggleNcSiteCollapse}
        toggleOkSiteCollapse={toggleOkSiteCollapse}
        toggleOkDataCenterLayer={toggleOkDataCenterLayer}
        toggleWhitneyLayerOpacity={toggleWhitneyLayerOpacity}
        toggleOsmLayerOpacity={toggleOsmLayerOpacity}
        toggleAllWhitneyLayers={toggleAllWhitneyLayers}
        toggleAllStartupCategories={toggleAllStartupCategories}
        toggleAllPerplexityLayers={toggleAllPerplexityLayers}
        toggleAllDukeLayers={toggleAllDukeLayers}
        toggleAllOsmLayers={toggleAllOsmLayers}
        powerLegendVisibility={powerLegendVisibility}
        grdaExpanded={grdaExpanded}
        ogeExpanded={ogeExpanded}
        infrastructureExpanded={infrastructureExpanded}
        setGrdaExpanded={setGrdaExpanded}
        setOgeExpanded={setOgeExpanded}
        setInfrastructureExpanded={setInfrastructureExpanded}
        togglePowerLegendCategory={togglePowerLegendCategory}
        captureVisibilityState={captureVisibilityState}
        onSavePreset={handleSavePreset}
        onLoadPreset={handleLoadPreset}
        onUpdatePreset={handleUpdatePreset}
        onDeletePreset={handleDeletePreset}
      />
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  const propsToCompare = ['isVisible', 'currentLocation']; // Removed onToggle and handleMarkerClick as they are memoized
  
  for (const prop of propsToCompare) {
    if (prevProps[prop] !== nextProps[prop]) {
      return false; // Re-render needed
    }
  }
  
  // Compare aiState and map by reference (they should be stable)
  if (prevProps.aiState !== nextProps.aiState) {
    return false;
  }
  
  if (prevProps.map !== nextProps.map) {
    return false;
  }
  
  // Compare function references (should be stable due to useCallback)
  if (prevProps.onToggle !== nextProps.onToggle) {
    return false;
  }
  if (prevProps.handleMarkerClick !== nextProps.handleMarkerClick) {
    return false;
  }
  
  return true; // No re-render needed
});

LegendContainer.displayName = 'LegendContainer';

export default LegendContainer;
