import { useEffect, useRef } from 'react';

/**
 * Pryor and Stillwater Circle Animation Component
 * Creates animated circles at 0.5 mile radius around Pryor and Stillwater markers
 */
const PryorStillwaterCircleAnimation = ({ map }) => {
  const rafRef = useRef(null);
  
  // Coordinates for Pryor and Stillwater markers
  const SITES = [
    { name: 'Pryor', lat: 36.2411, lng: -95.3301 },
    { name: 'Stillwater', lat: 36.150317, lng: -97.051131 }
  ];
  
  // Three circle sizes: 0.5 mile, 1.0 mile, and 2.2 miles
  const RADIUS_SMALL_MILES = 0.5;
  const RADIUS_LARGE_MILES = 1.0; // Twice as large
  const RADIUS_XLARGE_MILES = 2.2; // Third ring
  const METERS_PER_MILE = 1609.34;
  const RADIUS_SMALL_METERS = RADIUS_SMALL_MILES * METERS_PER_MILE;
  const RADIUS_LARGE_METERS = RADIUS_LARGE_MILES * METERS_PER_MILE;
  const RADIUS_XLARGE_METERS = RADIUS_XLARGE_MILES * METERS_PER_MILE;
  
  useEffect(() => {
    if (!map?.current) return;
    const m = map.current;
    
    const SOURCE_ID = 'pryor-stillwater-circles-source';
    const FILL_SMALL_LAYER_ID = 'pryor-stillwater-circles-fill-small';
    const LINE_SMALL_LAYER_ID = 'pryor-stillwater-circles-layer-small';
    const FILL_LARGE_LAYER_ID = 'pryor-stillwater-circles-fill-large';
    const LINE_LARGE_LAYER_ID = 'pryor-stillwater-circles-layer-large';
    const FILL_XLARGE_LAYER_ID = 'pryor-stillwater-circles-fill-xlarge';
    const LINE_XLARGE_LAYER_ID = 'pryor-stillwater-circles-layer-xlarge';
    
    // Create circle features for each site and radius
    const createCircleFeature = (site, radiusMeters, radiusMiles, circleType) => {
      // Create a circle using proper geographic calculations
      // We'll use a circle with radius in meters
      const steps = 64; // Number of points in the circle
      const circleCoordinates = [];
      
      // Earth's radius in meters
      const earthRadius = 6378137;
      
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * 360;
        const radians = (angle * Math.PI) / 180;
        
        // Convert site coordinates to radians
        const latRad = (site.lat * Math.PI) / 180;
        const lngRad = (site.lng * Math.PI) / 180;
        
        // Calculate point on circle using spherical geometry
        const angularDistance = radiusMeters / earthRadius;
        const newLatRad = Math.asin(
          Math.sin(latRad) * Math.cos(angularDistance) +
          Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(radians)
        );
        const newLngRad = lngRad + Math.atan2(
          Math.sin(radians) * Math.sin(angularDistance) * Math.cos(latRad),
          Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
        );
        
        circleCoordinates.push([
          (newLngRad * 180) / Math.PI,
          (newLatRad * 180) / Math.PI
        ]);
      }
      
      // Close the circle
      circleCoordinates.push(circleCoordinates[0]);
      
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [circleCoordinates]
        },
        properties: {
          name: site.name,
          radius: radiusMiles,
          circleType: circleType, // 'small' or 'large'
          pulse_t: 0
        }
      };
    };
    
    // Initialize source with circle features (small, large, and xlarge for each site)
    const initialFeatures = [];
    SITES.forEach(site => {
      // Small circle (0.5 mile)
      initialFeatures.push(createCircleFeature(site, RADIUS_SMALL_METERS, RADIUS_SMALL_MILES, 'small'));
      // Large circle (1.0 mile) - twice as large
      initialFeatures.push(createCircleFeature(site, RADIUS_LARGE_METERS, RADIUS_LARGE_MILES, 'large'));
      // XLarge circle (2.2 miles) - third ring
      initialFeatures.push(createCircleFeature(site, RADIUS_XLARGE_METERS, RADIUS_XLARGE_MILES, 'xlarge'));
    });
    const initialData = {
      type: 'FeatureCollection',
      features: initialFeatures
    };
    
    // Add or update source
    if (!m.getSource(SOURCE_ID)) {
      m.addSource(SOURCE_ID, {
        type: 'geojson',
        data: initialData
      });
    } else {
      m.getSource(SOURCE_ID).setData(initialData);
    }
    
    // Add small circle fill layer (14% red fill)
    if (!m.getLayer(FILL_SMALL_LAYER_ID)) {
      m.addLayer({
        id: FILL_SMALL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        filter: ['==', ['get', 'circleType'], 'small'],
        layout: {
          visibility: 'visible'
        },
        paint: {
          'fill-color': '#ef4444', // Red to match marker color
          'fill-opacity': 0.14 // 14% opacity
        }
      });
    }
    
    // Add small circle line layer (dashed stroke, original style)
    if (!m.getLayer(LINE_SMALL_LAYER_ID)) {
      m.addLayer({
        id: LINE_SMALL_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', ['get', 'circleType'], 'small'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          visibility: 'visible'
        },
        paint: {
          'line-color': '#ef4444', // Red to match marker color
          'line-width': [
            'interpolate',
            ['linear'],
            ['get', 'pulse_t'],
            0, 2,     // Start at 2px
            0.5, 3.5, // Peak at 3.5px
            1, 2      // Back to 2px
          ],
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['get', 'pulse_t'],
            0, 0.7,   // Start at 70% opacity
            0.5, 1.0, // Peak at 100% opacity
            1, 0.7    // Back to 70% opacity
          ],
          'line-dasharray': [2, 2] // Dashed pattern: 2px dash, 2px gap
        }
      });
    }
    
    // Add large circle fill layer (San Antonio style - light pink with lower opacity)
    if (!m.getLayer(FILL_LARGE_LAYER_ID)) {
      m.addLayer({
        id: FILL_LARGE_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        filter: ['==', ['get', 'circleType'], 'large'],
        layout: {
          visibility: 'visible'
        },
        paint: {
          'fill-color': '#ff69b4', // Light pink like San Antonio
          'fill-opacity': 0.12 // 12% opacity (like 15-mile circle in San Antonio)
        }
      });
    }
    
    // Add large circle line layer (San Antonio style - dark orange, animated)
    if (!m.getLayer(LINE_LARGE_LAYER_ID)) {
      m.addLayer({
        id: LINE_LARGE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', ['get', 'circleType'], 'large'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          visibility: 'visible'
        },
        paint: {
          'line-color': '#FF8C00', // Dark orange like San Antonio
          'line-width': 0.1, // Base width (will be animated)
          'line-opacity': 0.8, // Base opacity (will be animated)
          'line-dasharray': [1, 1] // Fine dashed pattern like San Antonio
        }
      });
    }
    
    // Add xlarge circle fill layer (San Antonio style - light pink with even lower opacity)
    if (!m.getLayer(FILL_XLARGE_LAYER_ID)) {
      m.addLayer({
        id: FILL_XLARGE_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        filter: ['==', ['get', 'circleType'], 'xlarge'],
        layout: {
          visibility: 'visible'
        },
        paint: {
          'fill-color': '#ff69b4', // Light pink like San Antonio
          'fill-opacity': 0.06 // 6% opacity (like 30-mile circle in San Antonio)
        }
      });
    }
    
    // Add xlarge circle line layer (San Antonio style - dark orange, animated)
    if (!m.getLayer(LINE_XLARGE_LAYER_ID)) {
      m.addLayer({
        id: LINE_XLARGE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', ['get', 'circleType'], 'xlarge'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          visibility: 'visible'
        },
        paint: {
          'line-color': '#FF8C00', // Dark orange like San Antonio
          'line-width': 0.1, // Base width (will be animated)
          'line-opacity': 0.8, // Base opacity (will be animated)
          'line-dasharray': [1, 1] // Fine dashed pattern like San Antonio
        }
      });
    }
    
    // Animation loop - two different animations
    const animate = () => {
      // Small circle animation (original style - uses pulse_t property)
      const t = ((Date.now() / 1000) % 2.0) / 2.0; // 0.0 to 1.0, 2 second period
      
      // Update all features with current pulse time for small circles
      const updatedFeatures = initialFeatures.map(feature => ({
        ...feature,
        properties: {
          ...feature.properties,
          pulse_t: t
        }
      }));
      
      const updatedData = {
        type: 'FeatureCollection',
        features: updatedFeatures
      };
      
      try {
        const source = m.getSource(SOURCE_ID);
        if (source) {
          source.setData(updatedData);
        }
      } catch (err) {
        // Silently handle errors
      }
      
      // Large and XLarge circle animation (San Antonio style - slower, different formula)
      const tSanAntonio = Date.now() * 0.001; // Slower pulse (0.001 multiplier)
      const opacity = 0.4 + 0.5 * Math.abs(Math.sin(tSanAntonio));
      const width = 0.1 + 0.9 * Math.abs(Math.sin(tSanAntonio));
      
      try {
        if (m.getLayer(LINE_LARGE_LAYER_ID)) {
          m.setPaintProperty(LINE_LARGE_LAYER_ID, 'line-opacity', opacity);
          m.setPaintProperty(LINE_LARGE_LAYER_ID, 'line-width', width);
        }
        if (m.getLayer(LINE_XLARGE_LAYER_ID)) {
          m.setPaintProperty(LINE_XLARGE_LAYER_ID, 'line-opacity', opacity);
          m.setPaintProperty(LINE_XLARGE_LAYER_ID, 'line-width', width);
        }
      } catch (err) {
        // Silently handle errors
      }
      
      rafRef.current = requestAnimationFrame(animate);
    };
    
    // Start animation
    rafRef.current = requestAnimationFrame(animate);
    
    // Cleanup
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [map]);
  
  return null;
};

export default PryorStillwaterCircleAnimation;

