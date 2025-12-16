import { getLocationUniversities } from '../legendConfig';

export const buildLegendSections = ({
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
  whitneyLayerVisibility = {}, // Default to empty object if not provided
  perplexityLayerVisibility,
  dukeLayerVisibility,
  okDataCenterCategoryVisibility,
  powerLegendVisibility = {},
  grdaExpanded = true,
  ogeExpanded = true,
  infrastructureExpanded = true,
  map = null,
  powerMarkersDetected = null
}) => {
  const sections = [];

  if (perplexityData.totalFeatures > 0 && perplexityData.legendItems.length > 0) {
    const perplexityItems = perplexityData.legendItems.map(item => ({
      label: item.label,
      color: item.color,
      count: item.count,
      type: item.type || 'circle',
      category: item.category,
      isVisible: item.isVisible !== undefined ? item.isVisible : true,
      description: item.description || `${item.label} from Perplexity analysis`
    }));

    sections.push({
      title: 'Perplexity AI Analysis',
      items: perplexityItems.map(item => ({
        ...item,
        isVisible: perplexityLayerVisibility[item.category] !== undefined ? perplexityLayerVisibility[item.category] : item.isVisible
      }))
    });
  }

  // NC Megasite Infrastructure section removed

  // Archived: Oklahoma Data Center Infrastructure section - removed for Columbus migration
  // TODO: Add Columbus/AEP Ohio infrastructure section if needed
  // Previous code handled Oklahoma data center sites (Stillwater, Pryor)
  // This section has been disabled as those sites are no longer active
  if (false && okDataCenterData.sites.length > 0) {
    // Archived code - Oklahoma data center infrastructure handling
  }

  if (gridData.nodes.length > 0) {
    const gridItems = gridData.nodes.map(node => ({
      label: node.name,
      color: node.color || '#22d3ee',
      count: 1,
      type: node.type || 'circle',
      description: node.description || 'Grid infrastructure node'
    }));

    sections.push({
      title: 'Grid Infrastructure',
      items: gridItems
    });
  }

  if (commuteData.overlapAreaKm2 !== null) {
    sections.push({
      title: 'Commute Overlay (30 min drive)',
      items: [{
        label: 'Dual-City Access',
        color: '#34d399',
        count: commuteData.overlapAreaKm2 ? Math.max(1, Math.round(commuteData.overlapAreaKm2)) : 1,
        type: 'polygon',
        description: `Approx. ${(commuteData.overlapAreaKm2 || 0).toFixed(1)} km² where 30-minute drives overlap`
      }]
    });
  }

  if (dukeData.totalFeatures > 0) {
    const dukeItems = Object.entries(dukeData.summary || {}).map(([serviceType, count]) => ({
      label: serviceType,
      color: serviceType.toLowerCase().includes('electric') ? '#fbbf24' : '#60a5fa',
      count,
      serviceType,
      type: 'line',
      description: `${serviceType} transmission easements`,
      isVisible: dukeLayerVisibility[serviceType.toLowerCase()] !== undefined
        ? dukeLayerVisibility[serviceType.toLowerCase()]
        : true
    }));

    if (dukeItems.length > 0) {
      sections.push({
        title: 'Duke Transmission Easements',
        items: dukeItems
      });
    }
  }

  if (legendData.totalFeatures > 0) {
    const serpItems = [];
    const categories = {
      startups: { label: 'Startups', color: '#ef4444' },
      investors: { label: 'Investors', color: '#fbbf24' },
      'co-working spaces': { label: 'Co-working Spaces', color: '#8b5cf6' },
      universities: { label: 'Universities', color: '#10b981' },
      'research institutions': { label: 'Research Institutions', color: '#3b82f6' },
      'other facilities': { label: 'Other Facilities', color: '#6b7280' }
    };

    Object.entries(categories).forEach(([categoryKey, categoryConfig]) => {
      const categoryCount = legendData.serpFeatures.filter(feature =>
        feature.properties?.category === categoryKey
      ).length;

      if (categoryCount > 0) {
        const isStartupCategory = startupCategoryVisibility[categoryConfig.label] !== undefined;

        serpItems.push({
          label: categoryConfig.label,
          color: categoryConfig.color,
          count: categoryCount,
          type: 'circle',
          description: `${categoryConfig.label} in the innovation ecosystem`,
          category: categoryConfig.label,
          isVisible: isStartupCategory
            ? startupCategoryVisibility[categoryConfig.label]
              : true
        });
      }
    });

    sections.push({
      title: 'AI Infrastructure (SERP)',
      items: serpItems
    });
  }

  if (whitneyData.totalFeatures > 0 || whitneyData.summary) {
    const whitneyItems = [];
    const whitneyCategories = {
      office_building: {
        label: 'Office Buildings',
        color: '#34d399',
        type: 'polygon',
        description: 'Office and commercial buildings',
        priority: 5
      },
      commercial_building: {
        label: 'Commercial Buildings',
        color: '#f97316',
        type: 'polygon',
        description: 'Retail and commercial spaces',
        priority: 4
      },
      retail_building: {
        label: 'Retail Buildings',
        color: '#a855f7',
        type: 'polygon',
        description: 'Retail-focused structures',
        priority: 3
      },
      government_facility: {
        label: 'Government Facilities',
        color: '#6366f1',
        type: 'polygon',
        description: 'Government and civic buildings',
        priority: 2
      },
      education: {
        label: 'Education Facilities',
        color: '#0ea5e9',
        type: 'polygon',
        description: 'Schools and universities',
        priority: 2
      },
      healthcare: {
        label: 'Healthcare Facilities',
        color: '#ef4444',
        type: 'polygon',
        description: 'Hospitals and medical centers',
        priority: 4
      },
      service_amenity: {
        label: 'Service Amenities',
        color: '#f59e0b',
        type: 'polygon',
        description: 'Support services and amenities',
        priority: 3
      },
      emergency_services: {
        label: 'Emergency Services',
        color: '#b91c1c',
        type: 'point',
        description: 'Police, fire, and emergency facilities',
        priority: 5
      },
      transit_hub: {
        label: 'Transit Hubs',
        color: '#7c3aed',
        type: 'point',
        description: 'Transit centers and hubs',
        priority: 4
      },
      highway_access: {
        label: 'Highway Access',
        color: '#fbbf24',
        type: 'line',
        description: 'Highway and major road access',
        priority: 3
      },
      recreation_area: {
        label: 'Recreation Areas',
        color: '#059669',
        type: 'polygon',
        description: 'Parks and recreational facilities',
        priority: 2
      },
      industrial: {
        label: 'Industrial',
        color: '#6b7280',
        type: 'polygon',
        description: 'Industrial and manufacturing facilities',
        priority: 1
      },
      county_boundary: {
        label: 'Bosque County Boundary',
        color: '#3b82f6',
        type: 'line',
        description: 'Bosque County administrative boundary',
        priority: 4
      }
    };

    Object.entries(whitneyCategories).forEach(([categoryKey, categoryConfig]) => {
      const count = whitneyData.summary?.[categoryKey] || 0;
      const shouldShow = count > 0 || (categoryKey === 'county_boundary' && whitneyData.totalFeatures > 0);

      if (shouldShow) {
        whitneyItems.push({
          label: categoryConfig.label,
          color: categoryConfig.color,
          count: categoryKey === 'county_boundary' ? 1 : count,
          type: categoryConfig.type,
          description: categoryConfig.description,
          category: categoryKey,
          priority: categoryConfig.priority,
          isVisible: whitneyLayerVisibility && whitneyLayerVisibility[categoryKey] !== undefined ? whitneyLayerVisibility[categoryKey] : true
        });
      }
    });

    if (whitneyData.zones_queried.length > 0) {
      const zoneColors = {
        data_center: '#dc2626',
        downtown: '#7c3aed',
        lake_whitney: '#0ea5e9'
      };

      const zoneNames = {
        data_center: 'Whitney Data Center Campus',
        downtown: 'Whitney Downtown Core',
        lake_whitney: 'Lake Whitney Gateway'
      };

      whitneyData.zones_queried.forEach(zoneKey => {
        whitneyItems.push({
          label: zoneNames[zoneKey] || zoneKey,
          color: zoneColors[zoneKey] || '#6b7280',
          count: 1,
          type: 'line',
          description: 'Whitney analysis zone',
          category: 'whitney_zone',
          priority: 3,
          isDashed: true,
          isVisible: whitneyLayerVisibility && whitneyLayerVisibility.whitney_zone !== undefined ? whitneyLayerVisibility.whitney_zone : true
        });
      });
    }

    if (whitneyItems.length > 0) {
      sections.push({
        title: 'Liberty Infrastructure Analysis',
        items: whitneyItems
      });
    }
  }

  if (osmData.totalFeatures > 0) {
    const osmItems = [];

    if (osmData.visualLayers.universities && osmData.visualLayers.universities.length > 0) {
      const universities = osmData.visualLayers.universities;
      const locationUniversities = getLocationUniversities(currentLocation);

      Object.entries(locationUniversities).forEach(([key, config]) => {
        const universityCount = universities.filter(u =>
          u.properties?.university_type === config.name ||
          u.properties?.name?.toLowerCase().includes(config.name.toLowerCase())
        ).length;

        if (universityCount > 0) {
          osmItems.push({
            label: config.name,
            color: config.color,
            count: universityCount,
            type: 'circle',
            description: config.description,
            layerName: key,
            isVisible: osmLayerVisibility[key] !== undefined ? osmLayerVisibility[key] : true
          });
        }
      });

      const configuredNames = Object.values(locationUniversities).map(u => u.name.toLowerCase());
      const otherCount = universities.filter(u => {
        const uniName = (u.properties?.university_type || u.properties?.name || '').toLowerCase();
        return !configuredNames.some(name => uniName.includes(name.toLowerCase())) && u.properties?.university_type === 'Other';
      }).length;

      if (otherCount > 0) {
        osmItems.push({
          label: 'Other Universities',
          color: '#ef4444',
          count: otherCount,
          type: 'circle',
          description: 'Other universities and colleges',
          layerName: 'otherUniversities',
          isVisible: osmLayerVisibility.otherUniversities
        });
      }
    }

    const pushLayerItem = (key, config) => {
      if (config.source && config.source.length > 0) {
        osmItems.push({
          label: config.label,
          color: config.color,
          count: config.source.length,
          type: config.type,
          description: config.description,
          layerName: key,
          isVisible: osmLayerVisibility[key]
        });
      }
    };

    const layerConfigs = {
      offices: {
        label: 'Office Buildings',
        color: '#3b82f6',
        type: 'circle',
        description: 'Office buildings and commercial spaces',
        source: osmData.visualLayers.offices || []
      },
      transportation: {
        label: 'Transportation',
        color: '#f59e0b',
        type: 'circle',
        description: 'Transit stops and stations',
        source: osmData.visualLayers.transportation || []
      },
      water: {
        label: 'Water Features',
        color: '#0ea5e9',
        type: 'polygon',
        description: 'Rivers, lakes, and waterways',
        source: osmData.visualLayers.water || []
      },
      parks: {
        label: 'Parks',
        color: '#10b981',
        type: 'polygon',
        description: 'Parks and public spaces',
        source: osmData.visualLayers.parks || []
      },
      commercial: {
        label: 'Commercial Zones',
        color: '#8b5cf6',
        type: 'polygon',
        description: 'Commercial and retail areas',
        source: osmData.visualLayers.commercial || []
      },
      highways: {
        label: 'Highways',
        color: '#dc2626',
        type: 'line',
        description: 'Major highways and interstates',
        source: osmData.visualLayers.highways || []
      },
      primaryRoads: {
        label: 'Primary Roads',
        color: '#ea580c',
        type: 'line',
        description: 'Primary roads and major arterials',
        source: osmData.visualLayers.primaryRoads || []
      },
      secondaryRoads: {
        label: 'Secondary Roads',
        color: '#f59e0b',
        type: 'line',
        description: 'Secondary roads and collectors',
        source: osmData.visualLayers.secondaryRoads || []
      },
      localRoads: {
        label: 'Local Roads',
        color: '#10b981',
        type: 'line',
        description: 'Local roads and streets',
        source: osmData.visualLayers.localRoads || []
      },
      residentialRoads: {
        label: 'Residential Roads',
        color: '#8b5cf6',
        type: 'line',
        description: 'Residential streets and neighborhoods',
        source: osmData.visualLayers.residentialRoads || []
      },
      roads: {
        label: 'Road Network',
        color: '#6b7280',
        type: 'line',
        description: 'Complete road network (motorway to residential)',
        source: osmData.visualLayers.roads || []
      },
      highway_junctions: {
        label: 'Highway Junctions',
        color: '#dc2626',
        type: 'circle',
        description: 'Major highway intersections and interchanges',
        source: osmData.visualLayers.highway_junction || []
      }
    };

    Object.entries(layerConfigs).forEach(([key, config]) => pushLayerItem(key, config));

    // AEP Ohio infrastructure layers - substations by voltage level
    if (osmData.visualLayers.substations && osmData.visualLayers.substations.length > 0) {
      const substationFeatures = osmData.visualLayers.substations || [];
      
      // Count substations by voltage level based on category
      const ultraHigh = substationFeatures.filter(f => {
        const cat = f.properties?.category || '';
        return cat.includes('substation_500000') || cat.includes('substation_765000');
      }).length;
      
      const high = substationFeatures.filter(f => {
        const cat = f.properties?.category || '';
        return cat === 'substation_345000' || cat.includes('substation_345000;');
      }).length;
      
      const medium = substationFeatures.filter(f => {
        const cat = f.properties?.category || '';
        return cat === 'substation_138000';
      }).length;
      
      const low = substationFeatures.length - ultraHigh - high - medium;

      // Ultra High Voltage (500kV+)
      if (ultraHigh > 0) {
        osmItems.push({
          label: 'Substations: 500kV+',
          color: '#ea580c', // Bright orange-red
          count: ultraHigh,
          type: 'circle',
          description: 'Ultra high voltage substations (500kV, 765kV)',
          layerName: 'aepOhioSubstationsUltraHigh',
          isVisible: osmLayerVisibility.aepOhioSubstationsUltraHigh !== undefined ? osmLayerVisibility.aepOhioSubstationsUltraHigh : true
        });
      }

      // High Voltage (345kV)
      if (high > 0) {
        osmItems.push({
          label: 'Substations: 345kV',
          color: '#f97316', // Orange
          count: high,
          type: 'circle',
          description: 'High voltage substations (345kV)',
          layerName: 'aepOhioSubstationsHigh',
          isVisible: osmLayerVisibility.aepOhioSubstationsHigh !== undefined ? osmLayerVisibility.aepOhioSubstationsHigh : true
        });
      }

      // Medium Voltage (138kV)
      if (medium > 0) {
        osmItems.push({
          label: 'Substations: 138kV',
          color: '#3b82f6', // Blue
          count: medium,
          type: 'circle',
          description: 'Medium voltage substations (138kV)',
          layerName: 'aepOhioSubstationsMedium',
          isVisible: osmLayerVisibility.aepOhioSubstationsMedium !== undefined ? osmLayerVisibility.aepOhioSubstationsMedium : true
        });
      }

      // Low Voltage (<138kV)
      if (low > 0) {
        osmItems.push({
          label: 'Substations: <138kV',
          color: '#60a5fa', // Light blue
          count: low,
          type: 'circle',
          description: 'Lower voltage substations (<138kV)',
          layerName: 'aepOhioSubstationsLow',
          isVisible: osmLayerVisibility.aepOhioSubstationsLow !== undefined ? osmLayerVisibility.aepOhioSubstationsLow : true
        });
      }
    }

    if (osmData.visualLayers.transmission && osmData.visualLayers.transmission.length > 0) {
      // Count transmission lines by voltage level
      const transmissionFeatures = osmData.visualLayers.transmission || [];
      const ultraHigh = transmissionFeatures.filter(f => {
        const v = f.properties?.voltage || '';
        return v.includes('500000') || v.includes('765000');
      }).length;
      const high = transmissionFeatures.filter(f => f.properties?.voltage === '345000').length;
      const medium = transmissionFeatures.filter(f => f.properties?.voltage === '138000').length;
      const low = transmissionFeatures.length - ultraHigh - high - medium;

      // Ultra High Voltage (500kV+)
      if (ultraHigh > 0) {
        osmItems.push({
          label: 'Transmission: 500kV+',
          color: '#ea580c', // Bright orange-red
          count: ultraHigh,
          type: 'line',
          description: 'Ultra high voltage transmission lines (500kV, 765kV)',
          layerName: 'aepOhioTransmissionUltraHigh',
          isVisible: osmLayerVisibility.aepOhioTransmissionUltraHigh !== undefined ? osmLayerVisibility.aepOhioTransmissionUltraHigh : true
        });
      }

      // High Voltage (345kV)
      if (high > 0) {
        osmItems.push({
          label: 'Transmission: 345kV',
          color: '#f97316', // Orange
          count: high,
          type: 'line',
          description: 'High voltage transmission lines (345kV)',
          layerName: 'aepOhioTransmissionHigh',
          isVisible: osmLayerVisibility.aepOhioTransmissionHigh !== undefined ? osmLayerVisibility.aepOhioTransmissionHigh : true
        });
      }

      // Medium Voltage (138kV)
      if (medium > 0) {
        osmItems.push({
          label: 'Transmission: 138kV',
          color: '#3b82f6', // Blue
          count: medium,
          type: 'line',
          description: 'Medium voltage transmission lines (138kV)',
          layerName: 'aepOhioTransmissionMedium',
          isVisible: osmLayerVisibility.aepOhioTransmissionMedium !== undefined ? osmLayerVisibility.aepOhioTransmissionMedium : true
        });
      }

      // Low Voltage (<138kV)
      if (low > 0) {
        osmItems.push({
          label: 'Transmission: <138kV',
          color: '#60a5fa', // Light blue
          count: low,
          type: 'line',
          description: 'Lower voltage transmission lines (<138kV)',
          layerName: 'aepOhioTransmissionLow',
          isVisible: osmLayerVisibility.aepOhioTransmissionLow !== undefined ? osmLayerVisibility.aepOhioTransmissionLow : true
        });
      }

      // AEP Ohio Interconnection Requests
      if (map.current && map.current.getLayer('aep-ohio-interconnection-points')) {
        const source = map.current.getSource('aep-ohio-interconnection-requests');
        const featureCount = source?._data?.features?.length || 0;
        
        if (featureCount > 0) {
          osmItems.push({
            label: 'Interconnection Requests',
            color: '#fbbf24', // Yellow (solar default)
            count: featureCount,
            type: 'circle',
            description: 'PJM interconnection queue requests (solar, wind, battery, gas)',
            layerName: 'aepOhioInterconnectionRequests',
            isVisible: osmLayerVisibility.aepOhioInterconnectionRequests !== undefined ? osmLayerVisibility.aepOhioInterconnectionRequests : true
          });
        }
      }
    }

    osmItems.push({
      label: 'Innovation Hub Center',
      color: '#ef4444',
      count: 1,
      type: 'line',
      description: '3-mile analysis radius around innovation hub',
      layerName: 'analysisRadius',
      isVisible: osmLayerVisibility.analysisRadius
    });

    if (osmItems.length > 0) {
      sections.push({
        title: 'Urban Infrastructure (OpenStreetMap)',
        items: osmItems
      });
    }
  }

  // Archived: Power Generation (GRDA/OG&E) section - Oklahoma-specific utilities removed
  // TODO: Add AEP Ohio power generation section if needed
  const hasGRDA = false; // Archived: Oklahoma-specific GRDA removed
  const hasOGE = false; // Archived: Oklahoma-specific OG&E removed
  const hasInfrastructure = false; // Archived: Oklahoma campus teardrop markers removed
  const hasStillwater = false; // Archived: Stillwater site removed
  
  // Disabled: Oklahoma power generation section
  if (false && (hasGRDA || hasOGE || hasInfrastructure || hasStillwater)) {
    const powerItems = [];
    
    if (hasGRDA) {
      const grdaItems = [
        { label: 'Hydro', color: '#06b6d4', utility: 'grda', fuelType: 'hydro' },
        { label: 'Wind', color: '#10b981', utility: 'grda', fuelType: 'wind' },
        { label: 'Gas', color: '#f97316', utility: 'grda', fuelType: 'gas' },
      ];
      
      powerItems.push({
        type: 'header',
        label: 'GRDA Power Generation',
        utility: 'grda',
        expanded: grdaExpanded
      });
      
      // Only add items when expanded
      if (grdaExpanded) {
        grdaItems.forEach(item => {
          const key = `grda${item.fuelType.charAt(0).toUpperCase() + item.fuelType.slice(1)}`;
          powerItems.push({
            ...item,
            utility: 'grda', // Ensure utility is set
            isVisible: powerLegendVisibility && powerLegendVisibility[key] !== false,
            category: key
          });
        });
      }
      // Items should NOT be added here when collapsed
    }
    
    if (hasOGE) {
      const ogeItems = [
        { label: 'Gas', color: '#f97316', utility: 'oge', fuelType: 'gas' },
        { label: 'Coal', color: '#fbbf24', utility: 'oge', fuelType: 'coal' },
        { label: 'Wind', color: '#10b981', utility: 'oge', fuelType: 'wind' },
        { label: 'Solar', color: '#f59e0b', utility: 'oge', fuelType: 'solar' },
      ];
      
      powerItems.push({
        type: 'header',
        label: 'OG&E Power Generation',
        utility: 'oge',
        expanded: ogeExpanded
      });
      
      // Only add items when expanded
      if (ogeExpanded) {
        ogeItems.forEach(item => {
          const key = `oge${item.fuelType.charAt(0).toUpperCase() + item.fuelType.slice(1)}`;
          powerItems.push({
            ...item,
            utility: 'oge', // Ensure utility is set
            isVisible: powerLegendVisibility && powerLegendVisibility[key] !== false,
            category: key
          });
        });
      }
      // Items should NOT be added here when collapsed
    }
    
    if (hasInfrastructure) {
      powerItems.push({
        type: 'header',
        label: 'Infrastructure Sites',
        utility: 'infrastructure',
        expanded: infrastructureExpanded
      });
      
      if (infrastructureExpanded) {
        powerItems.push({
          label: 'Campus Sites',
          color: '#ef4444',
          utility: 'infrastructure',
          fuelType: 'campus',
          category: 'infrastructureSites',
          isVisible: powerLegendVisibility && powerLegendVisibility.infrastructureSites !== false
        });
        
        // Add Stillwater toggle if it exists
        if (hasStillwater && stillwaterSite) {
          const stillwaterVisibility = okDataCenterCategoryVisibility[stillwaterSite.key];
          const stillwaterIsVisible = stillwaterVisibility ? 
            Object.values(stillwaterVisibility).some(v => v === true) : true;
          
          powerItems.push({
            label: 'Stillwater',
            color: stillwaterSite.highlightColor || stillwaterSite.color || '#4285f4',
            utility: 'infrastructure',
            fuelType: 'stillwater',
            category: 'stillwater',
            siteKey: stillwaterSite.key,
            isVisible: stillwaterIsVisible,
            isDataCenterSite: true
          });
        }
        
        // Archived: Oklahoma pipeline layer detection - removed for Columbus migration
        // TODO: Add Columbus/AEP Ohio pipeline detection if needed
        const hasPipelines = false; // Archived: Oklahoma pipeline markers removed
        /*
        const hasPipelines = typeof window !== 'undefined' && map?.current && (() => {
          // Archived: Oklahoma marker keys removed
          const markerKeys = [
            'pryor', 'stillwater', 'tulsa_suburbs', 'oge_substation_okc',
            'cimarron_link_tulsa', 'cimarron_link_panhandle', 'cushing',
            'tulsa_metro', 'okc_innovation_district', 'ardmore', 'inola', 'tinker_afb',
            'pensacola_dam', 'robert_s_kerr_dam', 'salina_pumped_storage',
            'wind_generation', 'redbud_power_plant'
          ];
          return markerKeys.some(key => {
            const lineLayerId = `marker-pipeline-${key}-line`;
            return map.current.getLayer(lineLayerId);
          });
        })();
        */
        
        if (hasPipelines) {
          powerItems.push({
            label: 'Pipelines',
            color: '#3b82f6',
            utility: 'infrastructure',
            fuelType: 'pipelines',
            category: 'pipelines',
            isVisible: powerLegendVisibility && powerLegendVisibility.pipelines !== false
          });
        }
        
        // Archived: Oklahoma transit path detection - removed for Columbus migration
        // TODO: Add Columbus/AEP Ohio transit path detection if needed
        const hasTransitPath = false; // Archived: okc-campuses-route removed
        /*
        const hasTransitPath = (typeof window !== 'undefined' && map?.current && (
          map.current.getLayer('okc-campuses-route-layer') ||
          map.current.getSource('okc-campuses-route-source')
        )) || (powerMarkersDetected && powerMarkersDetected.transitPath);
        */
        
        // Show Transit Path if layer exists OR if infrastructure sites are available (OSM was clicked)
        // This ensures it appears even if the layer hasn't been created yet
        if (hasTransitPath || hasInfrastructure) {
          powerItems.push({
            label: 'Transit Path',
            color: '#22c55e', // Green to match the route color
            utility: 'infrastructure',
            fuelType: 'transitPath',
            category: 'transitPath',
            isVisible: powerLegendVisibility && powerLegendVisibility.transitPath !== false
          });
        }
      }
    }
    
    // Safety check: Remove any power legend items that don't have proper nesting
    // (items should only exist when their parent header is expanded)
    const filteredPowerItems = powerItems.filter(item => {
      // Headers are always valid
      if (item.type === 'header') {
        return true;
      }
      // For items, check if their parent is expanded
      if (item.utility === 'grda' && !grdaExpanded) {
        return false; // Remove if GRDA is collapsed
      }
      if (item.utility === 'oge' && !ogeExpanded) {
        return false; // Remove if OG&E is collapsed
      }
      if (item.utility === 'infrastructure' && !infrastructureExpanded) {
        return false; // Remove if Infrastructure is collapsed
      }
      return true; // Keep item if parent is expanded
    });
    
    if (filteredPowerItems.length > 0) {
      sections.push({
        title: 'Power Generation & Infrastructure',
        items: filteredPowerItems,
        isPowerLegend: true
      });
    }
  }

  return sections;
};
