// Minimal MapboxLayer implementation for deck.gl v9 compatibility
// Since MapboxLayer is not exported in v9, we create a custom layer that integrates
// directly into Mapbox's rendering pipeline (like Seattle's v8.9.0 MapboxLayer)

import { Deck, MapView } from '@deck.gl/core';
import { lngLatToWorld } from '@math.gl/web-mercator';

const MAPBOX_VIEW_ID = 'mapbox';
const TILE_SIZE = 512;

// Get or create a shared Deck instance for this map
function getDeckInstance(map, gl, LayerType, layerProps) {
  // Use map's internal deck instance if it exists (from MapboxOverlay or other layers)
  if (map.__deck) {
    // Add this layer to the existing deck
    const existingLayers = map.__deck.props.layers || [];
    const newLayer = new LayerType(layerProps);
    map.__deck.setProps({
      layers: [...existingLayers, newLayer]
    });
    return map.__deck;
  }

  // Create a new Deck instance for this map
  // Use the SAME WebGL context that Mapbox uses
  const deck = new Deck({
    gl, // Share Mapbox's WebGL context
    width: null, // Let Mapbox control size
    height: null, // Let Mapbox control size
    touchAction: 'unset', // Don't interfere with Mapbox controls
    views: new MapView({ id: MAPBOX_VIEW_ID }),
    viewState: getViewState(map),
    layers: [new LayerType(layerProps)],
    // Critical: Don't clear canvas, let Mapbox handle it
    parameters: {
      depthWriteEnabled: true,
      depthCompare: 'less-equal',
      blend: true,
      blendColorSrcFactor: 'src-alpha',
      blendColorDstFactor: 'one-minus-src-alpha'
    },
    // Prevent Deck from managing canvas size
    _customRender: () => {
      // Don't trigger repaints - Mapbox controls that
    }
  });

  // Store on map for reuse
  map.__deck = deck;

  // Update viewState when map moves (but don't trigger repaint - Mapbox will)
  const handleMapMove = () => {
    if (deck.isInitialized) {
      deck.setProps({
        viewState: getViewState(map)
      });
      // Clear redraw flags so we don't request a second repaint
      deck.needsRedraw({ clearRedrawFlags: true });
    }
  };
  map.on('move', handleMapMove);

  // Cleanup on map remove
  const handleMapRemove = () => {
    map.off('move', handleMapMove);
    map.off('remove', handleMapRemove);
    if (map.__deck) {
      map.__deck.finalize();
      map.__deck = null;
    }
  };
  map.on('remove', handleMapRemove);

  return deck;
}

function getViewState(map) {
  const { lng, lat } = map.getCenter();
  return {
    longitude: ((lng + 540) % 360) - 180,
    latitude: lat,
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
    padding: map.getPadding(),
    repeat: map.getRenderWorldCopies()
  };
}

function getViewport(deck, map, renderParameters) {
  const viewState = getViewState(map);
  const view = deck.props.views || new MapView({ id: MAPBOX_VIEW_ID });
  
  // Get near/far planes from map transform
  const nearZ = renderParameters?.nearZ ?? map.transform._nearZ;
  const farZ = renderParameters?.farZ ?? map.transform._farZ;
  
  if (Number.isFinite(nearZ)) {
    viewState.nearZ = nearZ / map.transform.height;
    viewState.farZ = farZ / map.transform.height;
  }

  return view.makeViewport({
    width: deck.width || map.getContainer().clientWidth,
    height: deck.height || map.getContainer().clientHeight,
    viewState
  });
}

/**
 * MapboxLayer - Custom Mapbox GL JS layer that integrates Deck.gl layers
 * This provides the same API as deck.gl v8.9.0's MapboxLayer
 */
export default class MapboxLayer {
  constructor(props) {
    if (!props.id) {
      throw new Error('Layer must have an unique id');
    }
    if (!props.type) {
      throw new Error('Layer must have a type (Deck.gl layer class)');
    }

    this.id = props.id;
    this.type = 'custom';
    this.renderingMode = props.renderingMode || '3d';
    this.slot = props.slot;
    this.map = null;
    this.deck = null;
    this.props = props;
    
    // Extract layer type and props
    this._layerType = props.type;
    this._layerProps = { ...props };
    delete this._layerProps.id;
    delete this._layerProps.type;
    delete this._layerProps.renderingMode;
    delete this._layerProps.slot;
    delete this._layerProps.deck;
  }

  onAdd(map, gl) {
    this.map = map;
    this.deck = getDeckInstance(this.map, gl, this._layerType, {
      id: this.id,
      ...this._layerProps
    });
  }

  onRemove() {
    // Don't finalize deck here - it might be used by other layers
    // The map's remove handler will clean it up
    this.deck = null;
  }

  setProps(props) {
    // Merge new props
    Object.assign(this.props, props, { id: this.id });
    
    // Update layer props
    const layerProps = { ...props };
    delete layerProps.id;
    delete layerProps.type;
    delete layerProps.renderingMode;
    delete layerProps.slot;
    delete layerProps.deck;
    
    Object.assign(this._layerProps, layerProps);
    
    // Update deck layers if it exists
    // Important: Update only this layer, preserve others
    if (this.deck) {
      const existingLayers = this.deck.props.layers || [];
      // Find and replace this layer, or add it if it doesn't exist
      const layerIndex = existingLayers.findIndex(l => l && l.id === this.id);
      const newLayer = new this._layerType({
        id: this.id,
        ...this._layerProps
      });
      
      const updatedLayers = [...existingLayers];
      if (layerIndex >= 0) {
        updatedLayers[layerIndex] = newLayer;
      } else {
        updatedLayers.push(newLayer);
      }
      
      this.deck.setProps({
        layers: updatedLayers
      });
    }
  }

  render(gl, matrix) {
    if (!this.deck || !this.deck.isInitialized) {
      return;
    }

    // Update deck size to match map canvas (but don't let it control rendering)
    const container = this.map.getContainer();
    if (container) {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (this.deck.width !== width || this.deck.height !== height) {
        // Update size without triggering a full redraw
        this.deck.width = width;
        this.deck.height = height;
      }
    }

    // Get viewport from current map state
    const viewport = getViewport(this.deck, this.map, {
      nearZ: this.map.transform._nearZ,
      farZ: this.map.transform._farZ
    });

    // Draw the layer WITHOUT clearing canvas or stack
    // This ensures Mapbox's basemap continues to render
    // Use clearStack: false to preserve Mapbox's depth buffer
    try {
      this.deck._drawLayers('mapbox-repaint', {
        viewports: [viewport],
        layerFilter: (params) => {
          // Only draw this layer
          return params.layer.id === this.id;
        },
        clearStack: false, // CRITICAL: Don't clear the depth/stencil stack (preserves basemap)
        clearCanvas: false // CRITICAL: Don't clear the canvas (preserves basemap)
      });
    } catch (error) {
      // Silently fail if deck isn't ready - don't break Mapbox rendering
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [MapboxLayer] Render error (non-fatal):', error);
      }
    }
  }
}
