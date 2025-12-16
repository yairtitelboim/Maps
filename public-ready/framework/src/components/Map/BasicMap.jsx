import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { CardManager } from './components/Cards';
import { getExampleScene } from '../../config/exampleScenes';

// Minimal, generic Mapbox map for the framework examples.
// Replace MAPBOX TOKEN and coordinates in your own app.

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || 'YOUR_MAPBOX_ACCESS_TOKEN_HERE';

const DEFAULT_CENTER = [-97.0, 35.0]; // Example generic coordinates
const DEFAULT_ZOOM = 5;

// Example power & gas plant coordinates along the routes
// Shifted further south (gas) and north (power) to make the separation clearer.
const GAS_PLANT_COORD = [-97.7, 34.2];   // More southern position on Grid A route
const POWER_PLANT_COORD = [-96.3, 36.0]; // More northern position on Grid B route

// Example route coordinates reused for both line layers and particle animation
// Route A passes through the gas plant, Route B passes through the power plant.
const ROUTE_A_COORDS = [
  [-98.0, 34.5], // Site West
  GAS_PLANT_COORD,
  [-96.0, 35.5], // Site East
];

const ROUTE_B_COORDS = [
  [-98.0, 34.5], // Site West
  POWER_PLANT_COORD,
  [-96.0, 35.5], // Site East
];

export const BasicMap = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const [activeCards, setActiveCards] = useState([]);
  const [routesVisible, setRoutesVisible] = useState(false);
  const [scene] = useState(() => getExampleScene('scene-0'));
  const routeParticleAnimationRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    mapRef.current = map;

    map.on('load', () => {
      // Load two synthetic example sites from a small GeoJSON file
      map.addSource('example-sites', {
        type: 'geojson',
        data: '/sample-data/two-grids-example.geojson',
      });

      map.addLayer({
        id: 'example-sites-layer',
        type: 'circle',
        source: 'example-sites',
        paint: {
          'circle-radius': 8,
          'circle-color': [
            'match',
            ['get', 'grid'],
            'A', '#38bdf8',
            'B', '#f97316',
            /* other */ '#a3a3a3',
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      });

      map.on('click', 'example-sites-layer', (e) => {
        const feature = e.features && e.features[0];
        if (!feature) return;

        const { id, name, utility, description, grid } = feature.properties || {};
        const [lng, lat] = feature.geometry.coordinates;

        // Create a simple card config for CardManager/BaseCard
        const cardId = id || `site-${Date.now()}`;
        const card = {
          id: cardId,
          title: name || 'Example Site',
          content: {
            description:
              description ||
              'This is a synthetic example site used to demonstrate the card + map pattern.',
            meta: {
              utility: utility || 'Example Utility',
              grid: grid || 'Example Grid',
            },
            sceneDescription: scene?.description,
          },
          position: { lng, lat },
        };

        setActiveCards([card]);
      });

      // Change cursor on hover
      map.on('mouseenter', 'example-sites-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'example-sites-layer', () => {
        map.getCanvas().style.cursor = '';
      });

      // Pre-create an empty routes source; we'll toggle layers on/off via state
      map.addSource('example-routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { id: 'route-grid-a', grid: 'A' },
              geometry: {
                type: 'LineString',
                coordinates: ROUTE_A_COORDS,
              },
            },
            {
              type: 'Feature',
              properties: { id: 'route-grid-b', grid: 'B' },
              geometry: {
                type: 'LineString',
                coordinates: ROUTE_B_COORDS,
              },
            },
          ],
        },
      });

      // Example power & gas markers positioned along each route
      map.addSource('example-generation', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {
                id: 'gas-plant-grid-a',
                kind: 'gas',
                name: 'Example Gas Plant (Grid A)',
                grid: 'A',
              },
              geometry: {
                type: 'Point',
                coordinates: GAS_PLANT_COORD,
              },
            },
            {
              type: 'Feature',
              properties: {
                id: 'power-plant-grid-b',
                kind: 'power',
                name: 'Example Power Plant (Grid B)',
                grid: 'B',
              },
              geometry: {
                type: 'Point',
                coordinates: POWER_PLANT_COORD,
              },
            },
          ],
        },
      });

      map.addLayer({
        id: 'example-generation-layer',
        type: 'circle',
        source: 'example-generation',
        paint: {
          'circle-radius': 7,
          'circle-color': [
            'match',
            ['get', 'kind'],
            'gas',
            '#f97316', // orange for gas
            'power',
            '#22c55e', // green for power
            /* other */ '#e5e7eb',
          ],
          'circle-stroke-color': '#020617',
          'circle-stroke-width': 1.5,
        },
      });

      // Source + layer for route particles (animated points along routes)
      map.addSource('example-route-particles', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      map.addLayer({
        id: 'example-route-particles-layer',
        type: 'circle',
        source: 'example-route-particles',
        paint: {
          'circle-radius': 5,
          'circle-color': [
            'match',
            ['get', 'grid'],
            'A', '#38bdf8',
            'B', '#f97316',
            /* other */ '#f9fafb',
          ],
          'circle-opacity': 0.9,
        },
      });
    });

    // Clean up on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const handleCardClose = () => {
    setActiveCards([]);
  };

  // Simple particle animation along the example routes
  const startRouteParticles = () => {
    const map = mapRef.current;
    if (!map || routeParticleAnimationRef.current) return;

    const allRoutes = [
      // plantIndex points at the generation plant along the route
      { coords: ROUTE_A_COORDS, grid: 'A', plantIndex: 1 },
      { coords: ROUTE_B_COORDS, grid: 'B', plantIndex: 1 },
    ];

    const animate = () => {
      const now = Date.now();
      const features = [];

      allRoutes.forEach(({ coords, grid, plantIndex }) => {
        if (!coords || coords.length < 2) return;

        const lastIndex = coords.length - 1;
        const particlesPerRoute = 40;

        for (let i = 0; i < particlesPerRoute; i += 1) {
          // Alternate directions: half flow plant → east, half plant → west
          const direction = i % 2 === 0 ? 1 : -1;
          const targetIndex = direction > 0 ? lastIndex : 0;
          const stepCount = Math.abs(targetIndex - plantIndex);
          if (stepCount === 0) continue;

          // Slower progression away from plant toward each site
          const t = ((now * 0.00008) + i / particlesPerRoute) % 1;
          const scaled = t * stepCount;
          const step = Math.floor(scaled);
          const localT = scaled - step;

          const idxA = plantIndex + direction * step;
          const idxB = plantIndex + direction * Math.min(step + 1, stepCount);

          const a = coords[Math.max(0, Math.min(lastIndex, idxA))];
          const b = coords[Math.max(0, Math.min(lastIndex, idxB))];

          const lng = a[0] + (b[0] - a[0]) * localT;
          const lat = a[1] + (b[1] - a[1]) * localT;

          features.push({
            type: 'Feature',
            properties: { grid },
            geometry: {
              type: 'Point',
              coordinates: [lng, lat],
            },
          });
        }
      });

      const source = map.getSource('example-route-particles');
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features,
        });
      }

      routeParticleAnimationRef.current = requestAnimationFrame(animate);
    };

    routeParticleAnimationRef.current = requestAnimationFrame(animate);
  };

  const stopRouteParticles = () => {
    const map = mapRef.current;
    if (routeParticleAnimationRef.current) {
      cancelAnimationFrame(routeParticleAnimationRef.current);
      routeParticleAnimationRef.current = null;
    }
    const source = map?.getSource('example-route-particles');
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  };

  const toggleRoutes = () => {
    const map = mapRef.current;
    if (!map) return;

    const nextVisible = !routesVisible;
    setRoutesVisible(nextVisible);

    if (nextVisible) {
      // Add route layers if they don't exist
      if (!map.getLayer('example-route-grid-a')) {
        map.addLayer({
          id: 'example-route-grid-a',
          type: 'line',
          source: 'example-routes',
          filter: ['==', ['get', 'grid'], 'A'],
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#38bdf8',
            'line-width': 3,
            'line-opacity': 0.9,
          },
        });
      }
      if (!map.getLayer('example-route-grid-b')) {
        map.addLayer({
          id: 'example-route-grid-b',
          type: 'line',
          source: 'example-routes',
          filter: ['==', ['get', 'grid'], 'B'],
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#f97316',
            'line-width': 3,
            'line-opacity': 0.9,
          },
        });
      }
    } else {
      // Remove route layers if present
      if (map.getLayer('example-route-grid-a')) {
        map.removeLayer('example-route-grid-a');
      }
      if (map.getLayer('example-route-grid-b')) {
        map.removeLayer('example-route-grid-b');
      }
    }

    // Start or stop particle animation in sync with routes visibility
    if (nextVisible) {
      startRouteParticles();
    } else {
      stopRouteParticles();
    }
  };

  return (
    <div
      ref={mapContainerRef}
      style={{ width: '100vw', height: '100vh', position: 'relative' }}
    >
      {/* How-to-adapt panel */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 20,
          maxWidth: 280,
          padding: '10px 12px',
          borderRadius: 10,
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.5)',
          color: '#e5e7eb',
          fontSize: 11,
          lineHeight: 1.4,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>How to adapt this</div>
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li>Replace `/sample-data/two-grids-example.geojson` with your own sites.</li>
          <li>Swap the simple card for your own card component.</li>
          <li>Plug in real tools and a private AI hook in your app.</li>
        </ul>
      </div>

      {/* Overlay cards above the map (includes a Firecrawl-style routes toggle inside the card) */}
      {mapRef.current && (
        <CardManager
          map={mapRef}
          activeCards={activeCards}
          onCardClose={handleCardClose}
          onSceneNavigate={() => {}}
          routesVisible={routesVisible}
          onToggleRoutes={toggleRoutes}
        />
      )}
    </div>
  );
};

export default BasicMap;

