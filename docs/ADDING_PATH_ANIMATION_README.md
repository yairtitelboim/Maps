# Adding a New Path Animation: Step-by-Step Guide

This guide walks you through adding a new Deck.gl path animation to your map project, similar to the blue Infrastructure Siting animation. This process works for any geographic location and can be adapted to your specific use case.

## Table of Contents

1. [Overview](#overview)
2. [Step 1: Define Your Locations](#step-1-define-your-locations)
3. [Step 2: Collect OSM Infrastructure Data](#step-2-collect-osm-infrastructure-data)
4. [Step 3: Generate Route GeoJSON Files](#step-3-generate-route-geojson-files)
5. [Step 4: Create the Animation Component](#step-4-create-the-animation-component)
6. [Step 5: Integrate with Navigator](#step-5-integrate-with-navigator)
7. [Step 6: Test and Customize](#step-6-test-and-customize)
8. [Troubleshooting](#troubleshooting)

---

## Overview

A path animation consists of:
- **Source Data**: Geographic locations (markers) and routes between them
- **OSM Data**: Infrastructure data from OpenStreetMap around your locations
- **Route Files**: GeoJSON files containing paths between locations
- **Animation Component**: React component using Deck.gl's `TripsLayer`
- **Trigger**: Workflow card in the navigator that starts the animation

**Time Estimate**: 2-3 hours for a complete implementation

---

## Step 1: Define Your Locations

First, identify the locations you want to connect with animated paths.

### 1.1 Create a Locations Configuration

Create a new file or add to your existing configuration:

```python
# scripts/locations_config.py

LOCATIONS = {
    'location_1': {
        'name': 'Location 1 Name',
        'lat': 36.1156,
        'lng': -97.0584,
        'category': 'Supply',  # or 'Demand', 'Hub', etc.
        'description': 'Description of this location'
    },
    'location_2': {
        'name': 'Location 2 Name',
        'lat': 35.4676,
        'lng': -97.5164,
        'category': 'Demand',
        'description': 'Description of this location'
    },
    # Add more locations...
}

# Define which locations should be connected
ROUTES = [
    ('location_1', 'location_2'),
    ('location_1', 'location_3'),
    ('location_2', 'location_3'),
    # Add more route pairs...
]
```

### 1.2 Example: Oklahoma Infrastructure

```python
LOCATIONS = {
    'pryor': {
        'name': 'Pryor (MidAmerica Industrial Park)',
        'lat': 36.2411,
        'lng': -95.3301,
        'category': 'Supply',
        'description': 'GRDA territory, largest hyperscale cluster'
    },
    'stillwater': {
        'name': 'Stillwater Campus',
        'lat': 36.1156,
        'lng': -97.0584,
        'category': 'Supply',
        'description': 'New Google data center, OG&E territory'
    },
    'okc_innovation': {
        'name': 'Oklahoma City Innovation District',
        'lat': 35.4676,
        'lng': -97.5164,
        'category': 'Demand',
        'description': 'Tech, software, large cloud computing clusters'
    }
}

ROUTES = [
    ('pryor', 'stillwater'),
    ('pryor', 'okc_innovation'),
    ('stillwater', 'okc_innovation')
]
```

---

## Step 2: Collect OSM Infrastructure Data

Use OpenStreetMap to collect infrastructure data around your locations.

### 2.1 Create OSM Data Collection Script

Create `scripts/osm-tools/collect_location_data.py`:

```python
#!/usr/bin/env python3
"""
Collect OpenStreetMap infrastructure data for defined locations.
Generates GeoJSON files for each location with infrastructure within a radius.
"""

import json
import time
from pathlib import Path
import requests

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = PROJECT_ROOT / "public" / "osm"
OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"
USER_AGENT = "location-infrastructure-cache/1.0"

# Import your locations
from locations_config import LOCATIONS

def build_osm_query(lat, lon, radius_m):
    """Build Overpass API query for infrastructure within radius."""
    return f"""[out:json][timeout:180];
    (
      // POWER INFRASTRUCTURE
      node["power"](around:{radius_m},{lat},{lon});
      way["power"](around:{radius_m},{lat},{lon});
      
      // WATER & UTILITY INFRASTRUCTURE
      node["man_made"~"^(water_tower|water_works|reservoir_covered|pipeline|plant)$"](around:{radius_m},{lat},{lon});
      way["man_made"~"^(water_tower|water_works|reservoir_covered|pipeline|plant)$"](around:{radius_m},{lat},{lon});
      
      // PIPELINES
      node["pipeline"](around:{radius_m},{lat},{lon});
      way["pipeline"](around:{radius_m},{lat},{lon});
      
      // TELECOM & DATA CENTER
      node["telecom"](around:{radius_m},{lat},{lon});
      way["telecom"](around:{radius_m},{lat},{lon});
      
      // INDUSTRIAL BUILDINGS
      node["landuse"="industrial"](around:{radius_m},{lat},{lon});
      way["landuse"="industrial"](around:{radius_m},{lat},{lon});
    );
    out body;
    >;
    out skel qt;
    """

def execute_overpass_query(query, retries=3):
    """Execute Overpass API query with retries."""
    for attempt in range(1, retries + 1):
        try:
            print(f"⏱️ Overpass request attempt {attempt}/{retries}")
            response = requests.post(
                OVERPASS_URL,
                data={"data": query},
                headers={"User-Agent": USER_AGENT},
                timeout=120
            )
            
            if response.status_code in {429, 502, 503}:
                print(f"⚠️ Overpass throttled ({response.status_code}); backing off.")
                if attempt < retries:
                    time.sleep(10 * attempt)
                    continue
                response.raise_for_status()
            
            response.raise_for_status()
            print("✅ Overpass request succeeded.")
            return response.json()
        except Exception as e:
            if attempt >= retries:
                raise RuntimeError(f"Overpass request failed after {attempt} attempts") from e
            print(f"⚠️ Request error: {e}. Retrying in {10 * attempt}s.")
            time.sleep(10 * attempt)

def categorize_feature(tags):
    """Categorize OSM feature based on tags."""
    if not tags:
        return "other"
    
    if any(key in tags for key in ["power", "generator:type"]):
        return "power"
    
    if tags.get("man_made") in ["water_tower", "water_works", "reservoir_covered"]:
        return "water"
    
    if tags.get("man_made") == "pipeline" or tags.get("pipeline"):
        return "pipeline"
    
    if tags.get("telecom"):
        return "telecom"
    
    if tags.get("landuse") == "industrial":
        return "industrial"
    
    return "other"

def process_osm_data(location_key, location_data, radius_m=8000):
    """Process OSM data for a single location."""
    print(f"🔍 Fetching OSM data for {location_data['name']} ({location_key})")
    
    lat = location_data['lat']
    lon = location_data['lng']
    
    query = build_osm_query(lat, lon, radius_m)
    raw_data = execute_overpass_query(query)
    
    # Convert OSM elements to GeoJSON features
    features = []
    node_lookup = {
        elem["id"]: elem
        for elem in raw_data.get("elements", [])
        if elem.get("type") == "node"
    }
    
    for element in raw_data.get("elements", []):
        elem_type = element.get("type")
        tags = element.get("tags", {}) or {}
        
        if elem_type == "node":
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(element["lon"]), float(element["lat"])]
                },
                "properties": {
                    "location_key": location_key,
                    "osm_type": "node",
                    "osm_id": element.get("id"),
                    "name": tags.get("name", "Unnamed"),
                    "category": categorize_feature(tags),
                    "tags": tags
                }
            }
            features.append(feature)
        
        elif elem_type == "way":
            node_ids = element.get("nodes", [])
            coordinates = []
            
            for node_id in node_ids:
                node = node_lookup.get(node_id)
                if node:
                    coordinates.append([float(node["lon"]), float(node["lat"])])
            
            if len(coordinates) >= 2:
                is_closed = coordinates[0] == coordinates[-1]
                
                if is_closed and len(coordinates) >= 4:
                    geometry_type = "Polygon"
                    geometry_coords = [coordinates]
                else:
                    geometry_type = "LineString"
                    geometry_coords = coordinates
                
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": geometry_type,
                        "coordinates": geometry_coords if geometry_type == "Polygon" else geometry_coords
                    },
                    "properties": {
                        "location_key": location_key,
                        "osm_type": "way",
                        "osm_id": element.get("id"),
                        "name": tags.get("name", "Unnamed"),
                        "category": categorize_feature(tags),
                        "tags": tags
                    }
                }
                features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "location_key": location_key,
            "location_name": location_data['name'],
            "center": {"lat": lat, "lng": lon},
            "radius_m": radius_m,
            "feature_count": len(features)
        }
    }

def main():
    """Main function to collect OSM data for all locations."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    for location_key, location_data in LOCATIONS.items():
        try:
            geojson_data = process_osm_data(location_key, location_data, radius_m=8000)
            
            output_file = OUTPUT_DIR / f"location_{location_key}.json"
            with output_file.open("w", encoding="utf-8") as f:
                json.dump(geojson_data, f, indent=2)
            
            print(f"💾 Saved {geojson_data['metadata']['feature_count']} features to {output_file.name}")
            print("⏳ Waiting 2s before next location to avoid rate limits...")
            time.sleep(2)
        except Exception as e:
            print(f"❌ Error processing {location_key}: {e}")
            continue
    
    print("🎉 OSM data collection complete.")

if __name__ == "__main__":
    main()
```

### 2.2 Run the OSM Collection Script

```bash
cd /path/to/your/project
python scripts/osm-tools/collect_location_data.py
```

This will create GeoJSON files in `public/osm/` for each location.

---

## Step 3: Generate Route GeoJSON Files

Create routes between your locations using OSRM (Open Source Routing Machine).

### 3.1 Create Route Generation Script

Create `scripts/create_location_routes.py`:

```python
#!/usr/bin/env python3
"""
Generate route GeoJSON files between defined locations using OSRM.
"""

import json
import requests
from pathlib import Path
from locations_config import LOCATIONS, ROUTES

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "public" / "data" / "location_routes"
OSRM_URL = "http://router.project-osrm.org/route/v1/driving"

def get_route(start_lat, start_lng, end_lat, end_lng):
    """Get route from OSRM API."""
    url = f"{OSRM_URL}/{start_lng},{start_lat};{end_lng},{end_lat}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false"
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if data.get("code") == "Ok" and data.get("routes"):
            route = data["routes"][0]
            geometry = route["geometry"]
            return geometry
        else:
            print(f"⚠️ No route found: {data.get('code')}")
            return None
    except Exception as e:
        print(f"❌ Error fetching route: {e}")
        return None

def create_route_geojson(start_key, end_key, geometry):
    """Create GeoJSON Feature for a route."""
    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": {
            "start": start_key,
            "end": end_key,
            "start_name": LOCATIONS[start_key]["name"],
            "end_name": LOCATIONS[end_key]["name"]
        }
    }

def main():
    """Generate route files for all route pairs."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    for start_key, end_key in ROUTES:
        if start_key not in LOCATIONS or end_key not in LOCATIONS:
            print(f"⚠️ Skipping invalid route: {start_key} -> {end_key}")
            continue
        
        start_loc = LOCATIONS[start_key]
        end_loc = LOCATIONS[end_key]
        
        print(f"🛣️ Generating route: {start_loc['name']} -> {end_loc['name']}")
        
        geometry = get_route(
            start_loc['lat'], start_loc['lng'],
            end_loc['lat'], end_loc['lng']
        )
        
        if geometry:
            feature = create_route_geojson(start_key, end_key, geometry)
            
            # Create filename (sanitize keys)
            filename = f"{start_key}_to_{end_key}.geojson"
            filepath = OUTPUT_DIR / filename
            
            # Save as FeatureCollection
            geojson = {
                "type": "FeatureCollection",
                "features": [feature]
            }
            
            with filepath.open("w", encoding="utf-8") as f:
                json.dump(geojson, f, indent=2)
            
            print(f"✅ Saved route to {filepath.name}")
        else:
            print(f"❌ Failed to generate route: {start_key} -> {end_key}")
        
        # Rate limiting
        import time
        time.sleep(1)
    
    print("🎉 Route generation complete.")

if __name__ == "__main__":
    main()
```

### 3.2 Run the Route Generation Script

```bash
python scripts/create_location_routes.py
```

This creates GeoJSON route files in `public/data/location_routes/`.

---

## Step 4: Create the Animation Component

Create a React component that uses Deck.gl's `TripsLayer` to animate particles along your routes.

### 4.1 Create the Animation Component

Create `src/components/Map/components/YourPathAnimation.jsx`:

```javascript
import React, { useCallback, useEffect, useRef, useState } from 'react';
import MapboxLayer from './MapboxLayerWrapper'; // v9 compatibility
import { TripsLayer } from '@deck.gl/geo-layers';

// Define your route files (relative to public folder)
const ROUTE_FILES = [
  '/data/location_routes/location_1_to_location_2.geojson',
  '/data/location_routes/location_1_to_location_3.geojson',
  '/data/location_routes/location_2_to_location_3.geojson',
  // Add all your route files...
];

const LAYER_ID = 'your-path-animation';
const PARTICLES_PER_ROUTE = 15; // Number of particles per route
const TRIP_DURATION = 10000; // milliseconds per particle trip
const LOOP_DURATION = TRIP_DURATION * PARTICLES_PER_ROUTE; // Total loop length
const ANIMATION_COLOR = [59, 130, 246, 200]; // Blue color [R, G, B, Alpha]

// Module-level cache to prevent reloading data on component remount
let cachedTrips = null;
let isLoadingTrips = false;

const resolveMapInstance = (map) => {
  if (!map) return null;
  if (typeof map.getStyle === 'function') return map;
  if (map.current && typeof map.current.getStyle === 'function') return map.current;
  return null;
};

const YourPathAnimation = React.memo(({ map, onCleanup }) => {
  const mapInstanceRef = useRef(null);
  const mapInstance = resolveMapInstance(map);
  
  // Update ref when map instance changes
  useEffect(() => {
    mapInstanceRef.current = mapInstance;
  }, [mapInstance]);
  
  const overlayRef = useRef(null);
  const animationRef = useRef(null);
  const [trips, setTrips] = useState(null);
  const cleanupNotifiedRef = useRef(false);
  const overlaySetupRef = useRef(false);
  const tripsLoadedRef = useRef(false);

  const notifyCleanup = useCallback((detail = { status: 'stopped' }) => {
    if (cleanupNotifiedRef.current) return;
    cleanupNotifiedRef.current = true;
    if (typeof onCleanup === 'function') {
      try {
        onCleanup(detail);
      } catch (error) {
        console.warn('⚠️ [YourPathAnimation] onCleanup error', error);
      }
    }
  }, [onCleanup]);

  // Load route data and convert to trips
  useEffect(() => {
    console.log('🔄 [YourPathAnimation] Load routes effect running', { 
      mapInstance: !!mapInstance, 
      cachedTrips: !!cachedTrips,
      trips: !!trips,
      isLoadingTrips 
    });
    
    if (!mapInstance) {
      console.log('🔄 [YourPathAnimation] No map instance, skipping');
      return undefined;
    }
    
    // Use cached trips if available
    if (cachedTrips) {
      console.log('🔄 [YourPathAnimation] Using cached trips');
      setTrips(cachedTrips);
      tripsLoadedRef.current = true;
      return undefined;
    }
    
    // Prevent reloading if trips are already in state
    if (trips) {
      console.log('🔄 [YourPathAnimation] Trips already in state, caching');
      cachedTrips = trips;
      tripsLoadedRef.current = true;
      return undefined;
    }
    
    // Prevent concurrent loads
    if (isLoadingTrips) {
      console.log('🔄 [YourPathAnimation] Already loading trips, skipping');
      return undefined;
    }
    
    isLoadingTrips = true;
    let canceled = false;

    const loadRoutes = async () => {
      try {
        console.log('🔄 [YourPathAnimation] Loading route data...', {
          routeFileCount: ROUTE_FILES.length
        });

        const collections = await Promise.all(
          ROUTE_FILES.map(async (path) => {
            try {
              const res = await fetch(path);
              if (!res.ok) {
                console.warn(`⚠️ [YourPathAnimation] Failed to load ${path}: ${res.status}`);
                return { features: [] };
              }
              return res.json();
            } catch (err) {
              console.warn(`⚠️ [YourPathAnimation] Error loading ${path}:`, err);
              return { features: [] };
            }
          })
        );

        if (canceled) return;

        const tripsData = [];
        let tripIndex = 0;

        collections.forEach((collection, fileIndex) => {
          const features = collection.features || [];

          features.forEach((feature) => {
            if (feature.geometry?.type === 'LineString' && feature.geometry.coordinates) {
              const path = feature.geometry.coordinates;

              if (path.length < 2) return;

              // Create multiple particles per route for flow effect
              for (let particleIndex = 0; particleIndex < PARTICLES_PER_ROUTE; particleIndex++) {
                // Stagger start times so particles are spread along the route
                const particleOffset = particleIndex * TRIP_DURATION;

                const timestamps = path.map((_, index) => {
                  const progress = index / (path.length - 1);
                  return particleOffset + (progress * TRIP_DURATION);
                });

                tripsData.push({
                  id: `trip-${fileIndex}-${tripIndex}-particle-${particleIndex}`,
                  path: path,
                  timestamps: timestamps,
                  color: ANIMATION_COLOR
                });
              }

              tripIndex++;
            } else if (feature.geometry?.type === 'MultiLineString') {
              feature.geometry.coordinates.forEach((line, lineIndex) => {
                if (line.length < 2) return;

                // Create multiple particles per line segment
                for (let particleIndex = 0; particleIndex < PARTICLES_PER_ROUTE; particleIndex++) {
                  const particleOffset = particleIndex * TRIP_DURATION;

                  const timestamps = line.map((_, index) => {
                    const progress = index / (line.length - 1);
                    return particleOffset + (progress * TRIP_DURATION);
                  });

                  tripsData.push({
                    id: `trip-${fileIndex}-${lineIndex}-${tripIndex}-particle-${particleIndex}`,
                    path: line,
                    timestamps: timestamps,
                    color: ANIMATION_COLOR
                  });
                }

                tripIndex++;
              });
            }
          });
        });

        if (!canceled && tripsData.length > 0) {
          console.log(`✅ [YourPathAnimation] Loaded ${tripsData.length} trips`, {
            tripCount: tripsData.length,
            particlesPerRoute: PARTICLES_PER_ROUTE,
            sampleTrip: tripsData[0] ? {
              id: tripsData[0].id,
              pathLength: tripsData[0].path.length,
              timestampsLength: tripsData[0].timestamps.length
            } : null
          });
          cachedTrips = tripsData; // Cache for future use
          setTrips(tripsData);
          tripsLoadedRef.current = true;
          isLoadingTrips = false;
        } else if (!canceled) {
          isLoadingTrips = false;
          console.warn('⚠️ [YourPathAnimation] No trips generated');
          notifyCleanup({
            status: 'failed',
            reason: 'no_trips_generated'
          });
        }
      } catch (error) {
        if (!canceled) {
          console.error('❌ [YourPathAnimation] Error loading routes:', error);
          isLoadingTrips = false;
          notifyCleanup({
            status: 'failed',
            reason: 'load_error',
            message: error?.message
          });
        }
      }
    };

    loadRoutes();

    return () => {
      canceled = true;
      isLoadingTrips = false;
    };
  }, [mapInstance, notifyCleanup]);

  // Animation loop and layer management
  useEffect(() => {
    const currentMapInstance = mapInstanceRef.current || mapInstance;
    
    console.log('🔄 [YourPathAnimation] Overlay effect running', { 
      mapInstance: !!currentMapInstance, 
      tripsLength: trips?.length,
      overlaySetup: overlaySetupRef.current 
    });
    
    if (!currentMapInstance || !trips?.length) {
      console.log('🔄 [YourPathAnimation] Missing mapInstance or trips, cleaning up', {
        hasMapInstance: !!currentMapInstance,
        tripsLength: trips?.length
      });
      // Clean up if trips are cleared
      if (overlayRef.current && currentMapInstance) {
        try {
          if (currentMapInstance.getLayer(LAYER_ID)) {
            currentMapInstance.removeLayer(LAYER_ID);
          }
        } catch (_) {}
        overlayRef.current = null;
        overlaySetupRef.current = false;
      }
      return undefined;
    }

    let removed = false;
    let loadHandlerRef = null;
    let styleLoadHandlerRef = null;
    let timeoutIdRef = null;
    let isAddingRef = false;

    const startAnimation = () => {
      const startTime = performance.now();
      let lastFrameTime = startTime;
      const frameInterval = 16; // ~60fps

      const step = (timestamp) => {
        if (removed || !overlayRef.current || !trips) return;
        if (timestamp - lastFrameTime < frameInterval) {
          animationRef.current = requestAnimationFrame(step);
          return;
        }
        lastFrameTime = timestamp;
        const elapsed = (timestamp - startTime);
        const currentTimeValue = elapsed % LOOP_DURATION; // Keep in milliseconds
        try {
          // Update MapboxLayer's currentTime directly
          overlayRef.current.setProps({ 
            currentTime: currentTimeValue
          });
        } catch (error) {
          console.warn('⚠️ [YourPathAnimation] Failed to update layer props', error);
          return;
        }
        try {
          currentMapInstance.triggerRepaint?.();
        } catch (_) {}
        animationRef.current = requestAnimationFrame(step);
      };

      animationRef.current = requestAnimationFrame(step);
    };

    const createLayer = () => {
      return new TripsLayer({
        id: LAYER_ID,
        data: trips,
        getPath: (d) => d?.path || [],
        getTimestamps: (d) => d?.timestamps || [],
        getColor: (d) => d?.color || ANIMATION_COLOR,
        getWidth: 8,
        widthMinPixels: 4,
        widthMaxPixels: 10,
        jointRounded: true,
        capRounded: true,
        trailLength: 6000,
        currentTime: 0,
        loopLength: LOOP_DURATION,
        fadeTrail: true,
        opacity: 0.9
      });
    };

    const addOverlay = () => {
      const currentMapInstance = mapInstanceRef.current || mapInstance;
      if (!currentMapInstance || removed) {
        console.log('🔄 [YourPathAnimation] addOverlay aborted - no map instance or removed');
        return;
      }

      // Check if layer already exists in map
      if (overlayRef.current) {
        try {
          const existingLayer = currentMapInstance.getLayer(LAYER_ID);
          if (existingLayer) {
            console.log('🔄 [YourPathAnimation] Layer already exists, updating props');
            // Layer exists, just update props
            overlayRef.current.setProps({
              data: trips,
              currentTime: 0
            });
            return;
          } else {
            console.log('🔄 [YourPathAnimation] Layer ref exists but not in map, resetting');
            overlayRef.current = null;
            overlaySetupRef.current = false;
          }
        } catch (error) {
          console.warn('⚠️ [YourPathAnimation] Error checking layer', error);
          overlayRef.current = null;
          overlaySetupRef.current = false;
        }
      }

      // Create new overlay
      if (isAddingRef) {
        console.log('🔄 [YourPathAnimation] Already adding overlay, skipping');
        return;
      }
      isAddingRef = true;
      console.log('🔄 [YourPathAnimation] Creating new overlay');

      const layer = createLayer();

      // Use MapboxLayer (Seattle pattern) - integrates directly into Mapbox rendering pipeline
      const mapboxLayer = new MapboxLayer({
        id: LAYER_ID,
        type: TripsLayer,
        data: trips,
        getPath: (d) => d?.path || [],
        getTimestamps: (d) => d?.timestamps || [],
        getColor: (d) => d?.color || ANIMATION_COLOR,
        getWidth: 8,
        widthMinPixels: 4,
        widthMaxPixels: 10,
        jointRounded: true,
        capRounded: true,
        trailLength: 6000,
        currentTime: 0,
        loopLength: LOOP_DURATION,
        fadeTrail: true,
        opacity: 0.9
      });

      try {
        currentMapInstance.addLayer(mapboxLayer);
        overlayRef.current = mapboxLayer;
        overlaySetupRef.current = true;
        isAddingRef = false;
        console.log('✅ [YourPathAnimation] MapboxLayer added (no drift)');
        startAnimation();
      } catch (error) {
        isAddingRef = false;
        console.warn('⚠️ [YourPathAnimation] Failed to add MapboxLayer', error);
        overlaySetupRef.current = false;
        notifyCleanup({
          status: 'failed',
          reason: 'layer_add_failed',
          message: error?.message
        });
      }
    };

    const attemptOverlayAdd = () => {
      const currentMapInstance = mapInstanceRef.current || mapInstance;
      console.log('🔄 [YourPathAnimation] attemptOverlayAdd called', {
        removed,
        mapInstance: !!currentMapInstance,
        tripsLength: trips?.length
      });
      
      if (removed || !currentMapInstance || !trips?.length) {
        console.log('🔄 [YourPathAnimation] attemptOverlayAdd aborted - conditions not met');
        return;
      }

      // Try to add overlay directly
      try {
        console.log('🔄 [YourPathAnimation] Attempting to add overlay directly');
        addOverlay();
      } catch (error) {
        console.warn('🔄 [YourPathAnimation] Failed to add overlay, will retry on map load', error);
        // Set up listeners as fallback
        if (!loadHandlerRef) {
          loadHandlerRef = () => {
            if (!overlaySetupRef.current && !removed) {
              console.log('🔄 [YourPathAnimation] Map loaded, retrying overlay add');
              addOverlay();
            }
          };
          currentMapInstance.on('load', loadHandlerRef);
        }
        if (!styleLoadHandlerRef) {
          styleLoadHandlerRef = () => {
            if (!overlaySetupRef.current && !removed) {
              console.log('🔄 [YourPathAnimation] Style loaded, retrying overlay add');
              addOverlay();
            }
          };
          currentMapInstance.on('style.load', styleLoadHandlerRef);
        }
        
        // Fallback timeout
        if (!timeoutIdRef) {
          timeoutIdRef = setTimeout(() => {
            if (!overlaySetupRef.current && !removed) {
              console.log('⏰ [YourPathAnimation] Timeout fallback - retrying overlay add');
              addOverlay();
            }
          }, 1000);
        }
      }
    };

    attemptOverlayAdd();

    return () => {
      removed = true;
      isAddingRef = false;
      
      const currentMapInstance = mapInstanceRef.current || mapInstance;
      if (loadHandlerRef && currentMapInstance) {
        currentMapInstance.off('load', loadHandlerRef);
      }
      if (styleLoadHandlerRef && currentMapInstance) {
        currentMapInstance.off('style.load', styleLoadHandlerRef);
      }
      if (timeoutIdRef) {
        clearTimeout(timeoutIdRef);
      }
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (overlayRef.current && currentMapInstance) {
        try {
          if (currentMapInstance.getLayer(LAYER_ID)) {
            currentMapInstance.removeLayer(LAYER_ID);
          }
        } catch (error) {
          console.warn('⚠️ [YourPathAnimation] Failed to remove MapboxLayer', error);
        }
        try {
          if (currentMapInstance.getSource(LAYER_ID)) {
            currentMapInstance.removeSource(LAYER_ID);
          }
        } catch (_) {}
        overlayRef.current = null;
        overlaySetupRef.current = false;
      }
      notifyCleanup({ status: 'stopped' });
    };
  }, [map, trips, notifyCleanup]);

  return null;
});

YourPathAnimation.displayName = 'YourPathAnimation';

export default YourPathAnimation;
```

### 4.2 Customize the Animation

Adjust these constants in your component:

```javascript
// Visual properties
const PARTICLES_PER_ROUTE = 15;        // More particles = denser flow
const TRIP_DURATION = 10000;           // Milliseconds per particle trip (lower = faster)
const ANIMATION_COLOR = [59, 130, 246, 200]; // [R, G, B, Alpha] - Blue

// Line properties (in createLayer function)
getWidth: 8,              // Base width
widthMinPixels: 4,        // Minimum width in pixels
widthMaxPixels: 10,       // Maximum width in pixels
trailLength: 6000,        // Trail persistence (milliseconds)
opacity: 0.9              // Overall opacity (0-1)
```

---

## Step 5: Integrate with Navigator

Add your animation to the workflow navigator so it can be triggered from a card.

### 5.1 Add State and Import

In `AITransmissionNav.jsx`, add:

```javascript
import YourPathAnimation from './YourPathAnimation';

// Add state
const [showYourPathAnimation, setShowYourPathAnimation] = useState(false);
const yourPathAnimationTimeoutRef = useRef(null);
```

### 5.2 Add Cleanup Handler

```javascript
// Memoize cleanup callback
const handleYourPathAnimationCleanup = useCallback((detail) => {
  console.log('✅ [YourPathAnimation] Animation cleanup:', detail);
}, []);
```

### 5.3 Trigger Animation from Workflow Card

In the `playWorkflow` function, add:

```javascript
const playWorkflow = useCallback((workflow) => {
  const workflowIndex = TRANSMISSION_CONFIG.aiPrompts.ANALYSIS_WORKFLOWS.findIndex(
    w => w.name === workflow.name
  );
  
  // Check if this is your target workflow (e.g., index 5)
  if (workflowIndex === 5) { // Adjust index to your workflow
    console.log('🎯 [Your Workflow Card] Clicked - Starting path animation mount');
    
    // Clear any existing timeout
    if (yourPathAnimationTimeoutRef.current) {
      clearTimeout(yourPathAnimationTimeoutRef.current);
      yourPathAnimationTimeoutRef.current = null;
    }
    
    // Show animation immediately
    setShowYourPathAnimation(true);
    console.log('✅ [Your Workflow Card] showYourPathAnimation set to true');
    
    // Keep animation visible for at least 20 seconds
    yourPathAnimationTimeoutRef.current = setTimeout(() => {
      console.log('🛑 [Your Workflow Card] Minimum duration elapsed - Hiding animation');
      setShowYourPathAnimation(false);
      yourPathAnimationTimeoutRef.current = null;
    }, 20000); // 20 seconds minimum visibility
    
    console.log('⏰ [Your Workflow Card] Timeout scheduled for 20 seconds');
  }
  
  // ... rest of playWorkflow logic
}, [/* dependencies */]);
```

### 5.4 Add Cleanup on Unmount

```javascript
// Cleanup animation timeouts on unmount
useEffect(() => {
  return () => {
    if (yourPathAnimationTimeoutRef.current) {
      clearTimeout(yourPathAnimationTimeoutRef.current);
      yourPathAnimationTimeoutRef.current = null;
    }
  };
}, []);
```

### 5.5 Render the Animation Component

At the end of the component's return statement:

```javascript
return (
  <>
    {/* ... existing JSX ... */}
    
    {/* Your path animation */}
    {map?.current && showYourPathAnimation && (
      <YourPathAnimation
        key="your-path-animation"
        map={map}
        onCleanup={handleYourPathAnimationCleanup}
      />
    )}
  </>
);
```

---

## Step 6: Test and Customize

### 6.1 Test the Animation

1. **Start your development server**
   ```bash
   npm start
   ```

2. **Click the workflow card** that triggers your animation

3. **Verify**:
   - Animation appears on the map
   - Particles flow along routes
   - Animation stays synced during zoom/pitch/pan (no drift)
   - Basemap remains visible
   - Animation auto-hides after timeout

### 6.2 Customize Visual Properties

Edit the constants in your animation component:

```javascript
// Speed: Lower TRIP_DURATION = faster particles
const TRIP_DURATION = 8000; // Faster (was 10000)

// Density: More particles = denser flow
const PARTICLES_PER_ROUTE = 20; // Denser (was 15)

// Color: Change RGB values
const ANIMATION_COLOR = [255, 0, 0, 200]; // Red instead of blue

// Width: Thicker lines
getWidth: 12,              // Thicker (was 8)
widthMaxPixels: 15,        // Wider max (was 10)

// Trail: Longer trails
trailLength: 8000,         // Longer trails (was 6000)
```

### 6.3 Performance Tuning

If animation is choppy:

1. **Reduce particle count**:
   ```javascript
   const PARTICLES_PER_ROUTE = 10; // Fewer particles
   ```

2. **Reduce trail length**:
   ```javascript
   trailLength: 4000, // Shorter trails
   ```

3. **Reduce route count**: Remove some route files from `ROUTE_FILES` array

---

## Troubleshooting

### Animation Doesn't Appear

**Check**:
- Route files exist in `public/data/location_routes/`
- Route file paths in `ROUTE_FILES` match actual files
- Browser console for errors
- Map is fully loaded before animation starts

**Debug**:
```javascript
// Add to your component
console.log('Route files:', ROUTE_FILES);
console.log('Trips loaded:', trips?.length);
console.log('Layer exists:', map.current?.getLayer(LAYER_ID));
```

### Animation Drifts During Pitch/Zoom

**Solution**: Ensure you're using `MapboxLayer` (via `MapboxLayerWrapper`) with `map.addLayer()`, not `MapboxOverlay` with `map.addControl()`.

```javascript
// ✅ CORRECT
const mapboxLayer = new MapboxLayer({ ... });
map.addLayer(mapboxLayer);

// ❌ WRONG (causes drift)
const overlay = new MapboxOverlay({ ... });
map.addControl(overlay);
```

### Basemap Disappears

**Solution**: `MapboxLayerWrapper` handles this automatically. If it still happens, check that `clearStack: false` and `clearCanvas: false` are set in the render method.

### Routes Not Loading

**Check**:
- Route files are in `public/` folder (accessible via HTTP)
- File paths are correct (case-sensitive)
- GeoJSON format is valid
- Network tab shows 200 responses

**Validate GeoJSON**:
```bash
# Use a GeoJSON validator
cat public/data/location_routes/route.geojson | python -m json.tool
```

### Animation Too Slow/Fast

**Adjust**:
```javascript
const TRIP_DURATION = 5000;  // Faster (lower value)
const TRIP_DURATION = 15000; // Slower (higher value)
```

### Too Many/Few Particles

**Adjust**:
```javascript
const PARTICLES_PER_ROUTE = 5;   // Fewer particles
const PARTICLES_PER_ROUTE = 25; // More particles
```

---

## Quick Reference Checklist

- [ ] Define locations in `locations_config.py`
- [ ] Run OSM data collection script
- [ ] Run route generation script
- [ ] Create animation component (`YourPathAnimation.jsx`)
- [ ] Update `ROUTE_FILES` array with your route paths
- [ ] Customize animation constants (color, speed, particles)
- [ ] Add state and handlers to `AITransmissionNav.jsx`
- [ ] Add trigger logic in `playWorkflow` function
- [ ] Render animation component conditionally
- [ ] Test animation appears and works correctly
- [ ] Test no drift during pitch/zoom
- [ ] Test basemap stays visible
- [ ] Adjust visual properties as needed

---

## Example: Complete Integration

Here's a complete example for a "Power Flow Analysis" workflow:

```javascript
// In AITransmissionNav.jsx

// 1. Import
import PowerFlowAnimation from './PowerFlowAnimation';

// 2. State
const [showPowerFlowAnimation, setShowPowerFlowAnimation] = useState(false);
const powerFlowAnimationTimeoutRef = useRef(null);

// 3. Cleanup handler
const handlePowerFlowCleanup = useCallback((detail) => {
  console.log('✅ [PowerFlow] Animation cleanup:', detail);
}, []);

// 4. Trigger in playWorkflow
if (workflowIndex === 5) { // "Power Flow Analysis" card
  setShowPowerFlowAnimation(true);
  powerFlowAnimationTimeoutRef.current = setTimeout(() => {
    setShowPowerFlowAnimation(false);
  }, 20000);
}

// 5. Render
{map?.current && showPowerFlowAnimation && (
  <PowerFlowAnimation
    key="power-flow-animation"
    map={map}
    onCleanup={handlePowerFlowCleanup}
  />
)}
```

---

## Additional Resources

- **MapboxLayerWrapper**: `src/components/Map/components/MapboxLayerWrapper.js`
- **Working Example**: `src/components/Map/components/InfrastructureSitingPathAnimation.jsx`
- **Deck.gl Documentation**: https://deck.gl/docs/
- **TripsLayer API**: https://deck.gl/docs/api-reference/geo-layers/trips-layer
- **OSRM Routing**: http://project-osrm.org/
- **Overpass API**: https://wiki.openstreetmap.org/wiki/Overpass_API

---

## Summary

Adding a new path animation involves:

1. **Data Collection**: OSM infrastructure data around your locations
2. **Route Generation**: GeoJSON routes between locations using OSRM
3. **Component Creation**: React component using Deck.gl `TripsLayer`
4. **Integration**: Connect to navigator workflow cards
5. **Customization**: Adjust visual properties to match your design

The key is using `MapboxLayer` (via `MapboxLayerWrapper`) with `map.addLayer()` to ensure no drift and proper basemap integration.

For questions or issues, refer to the working example in `InfrastructureSitingPathAnimation.jsx` or the Deck.gl documentation.

