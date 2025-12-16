/**
 * ToolExecutor - Framework Pattern
 * 
 * Demonstrates the pattern for orchestrating multiple tools (OSM, SERP, Perplexity, etc.)
 * This is a simplified version showing the architecture pattern.
 * 
 * In production, implement with your own tool integrations.
 */

import OsmTool from './tools/OsmTool.js';
import PerplexityTool from './tools/PerplexityTool.js';

// Global cache shared across all ToolExecutor instances
let globalOsmCache = new Map();

if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('osmCache');
    if (stored) {
      const parsed = JSON.parse(stored);
      globalOsmCache = new Map(parsed);
    }
  } catch (error) {
    console.warn('🔧 Failed to restore OSM cache from localStorage:', error.message);
    globalOsmCache = new Map();
  }
}

export class ToolExecutor {
  constructor(map, updateToolFeedback, handleMarkerClick = null) {
    this.map = map;
    this.updateToolFeedback = updateToolFeedback;
    this.handleMarkerClick = handleMarkerClick;
    this.strategy = null; // Will be set by specific executors
    
    // Initialize tool instances with shared cache
    this.osmTool = new OsmTool(globalOsmCache, this.updateToolFeedback);
    this.perplexityTool = new PerplexityTool(this.updateToolFeedback);
    
    // Framework pattern: Add your own tools here
    // this.serpTool = new SerpTool();
    // this.firecrawlTool = new FirecrawlTool();
  }

  /**
   * Set the strategy for this executor
   * Framework pattern: Strategy pattern for different analysis types
   */
  setStrategy(strategy) {
    this.strategy = strategy;
    this.cacheExpiration = strategy.getCacheExpiration ? strategy.getCacheExpiration() : 3600000;
  }

  /**
   * Execute a single tool based on request
   * Framework pattern: Tool routing
   */
  async executeTool(toolAction) {
    if (!this.strategy) {
      throw new Error('No strategy set. Call setStrategy() before executing tools.');
    }

    switch(toolAction.tool) {
      case 'OSM':
        return await this.executeOSM(toolAction);
      case 'PERPLEXITY':
        return await this.executePerplexity(toolAction);
      // Framework pattern: Add your own tools
      // case 'SERP':
      //   return await this.executeSERP(toolAction);
      // case 'FIRECRAWL':
      //   return await this.executeFirecrawl(toolAction);
      default:
        throw new Error(`Unknown tool: ${toolAction.tool}`);
    }
  }

  /**
   * Execute multiple tools in sequence
   * Framework pattern: Tool orchestration
   */
  async executeMultipleTools(toolActions) {
    const results = [];
    const errors = [];
    const toolData = {}; // Store data from each tool for passing to subsequent tools
    
    if (!Array.isArray(toolActions) || toolActions.length === 0) {
      console.warn('⚠️ Invalid toolActions provided');
      return { results: [], errors: [], hasFailures: false };
    }
    
    // Framework pattern: Sort tools by execution order
    const sortedActions = this.sortToolsByExecutionOrder(toolActions);
    
    for (const action of sortedActions) {
      try {
        if (!action || !action.tool) {
          console.warn('⚠️ Invalid tool action:', action?.tool || 'unknown');
          errors.push({ 
            tool: action?.tool || 'unknown', 
            error: 'Invalid tool action object'
          });
          continue;
        }

        // Execute tool with data from previous tools
        let result;
        if (action.tool === 'PERPLEXITY' && Object.keys(toolData).length > 0) {
          result = await this.executeToolWithPreviousData(action, toolData);
        } else {
          result = await this.executeTool(action);
        }
        
        // Store tool result for subsequent tools
        toolData[action.tool.toLowerCase()] = result.data || result;
        
        results.push({ 
          tool: action.tool, 
          success: true, 
          data: result
        });

        // Brief pause between tools
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ ${action.tool} tool failed:`, error.message);
        errors.push({ 
          tool: action.tool, 
          error: error.message || 'Unknown error'
        });
        
        this.updateToolFeedback({
          isActive: true,
          tool: action.tool.toLowerCase(),
          status: `${action.tool} execution failed`,
          progress: 100,
          details: `Error: ${error.message || 'Unknown error'}. Continuing with other tools...`
        });
      }
    }
    
    setTimeout(() => {
      try {
        this.updateToolFeedback({
          isActive: false,
          tool: null,
          status: '',
          progress: 0,
          details: ''
        });
      } catch (feedbackError) {
        console.warn('⚠️ Tool feedback error:', feedbackError.message);
      }
    }, 2000);
    
    // Save cache to localStorage
    saveCacheToStorage();
    
    return { results, errors, hasFailures: errors.length > 0, toolData };
  }

  /**
   * Execute OSM tool
   * Framework pattern: Tool execution with strategy
   */
  async executeOSM(toolAction, previousToolData = null) {
    if (!this.strategy) {
      throw new Error('No strategy set for OSM execution');
    }

    const coordinates = this.strategy.getCoordinates();
    const locationConfig = this.strategy.getLocationConfig ? this.strategy.getLocationConfig() : null;
    const serpData = previousToolData?.serp || null;
    
    try {
      const result = await this.osmTool.execute(
        toolAction.queries, 
        coordinates, 
        this.map, 
        locationConfig,
        serpData
      );
      
      return result;
    } catch (error) {
      console.warn('⚠️ OSM execution failed:', error.message);
      return {
        success: false,
        tool: 'OSM',
        error: error.message,
        fallback: true,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Execute Perplexity tool
   * Framework pattern: Tool execution with strategy
   */
  async executePerplexity(toolAction, previousResults = null) {
    if (!this.strategy) {
      throw new Error('No strategy set for Perplexity execution');
    }

    const coordinates = this.strategy.getCoordinates();
    const locationConfig = this.strategy.getLocationConfig ? this.strategy.getLocationConfig() : null;
    
    try {
      const result = await this.perplexityTool.execute(
        toolAction.queries, 
        coordinates, 
        locationConfig,
        previousResults?.serp || null,
        previousResults?.osm || null
      );
      
      return result;
    } catch (error) {
      console.warn('⚠️ Perplexity execution failed:', error.message);
      return {
        success: false,
        tool: 'PERPLEXITY',
        error: error.message,
        fallback: true,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Sort tools by execution order
   * Framework pattern: Tool orchestration order
   */
  sortToolsByExecutionOrder(toolActions) {
    const executionOrder = ['OSM', 'SERP', 'PERPLEXITY', 'FIRECRAWL'];
    
    return toolActions.sort((a, b) => {
      const aIndex = executionOrder.indexOf(a.tool);
      const bIndex = executionOrder.indexOf(b.tool);
      
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      
      return aIndex - bIndex;
    });
  }

  /**
   * Execute tool with previous data
   * Framework pattern: Tool data chaining
   */
  async executeToolWithPreviousData(toolAction, previousToolData) {
    if (!this.strategy) {
      throw new Error('No strategy set for tool execution');
    }

    const coordinates = this.strategy.getCoordinates();
    const locationConfig = this.strategy.getLocationConfig ? this.strategy.getLocationConfig() : null;
    
    const previousResults = {
      serpData: previousToolData.serp,
      osmData: previousToolData.osm
    };
    
    try {
      const result = await this.perplexityTool.execute(
        toolAction.queries, 
        coordinates, 
        locationConfig,
        previousResults.serpData,
        previousResults.osmData
      );
      
      return result;
    } catch (error) {
      console.error('❌ Tool execution with previous data failed:', error.message);
      throw error;
    }
  }
}

/**
 * Factory function to create ToolExecutor instance
 * Framework pattern: Factory pattern
 */
export const createToolExecutor = (map, updateToolFeedback, handleMarkerClick = null) => {
  return new ToolExecutor(map, updateToolFeedback, handleMarkerClick);
};

/**
 * Global cache management
 */
let globalToolExecutorInstance = null;

export const setGlobalToolExecutor = (instance) => {
  globalToolExecutorInstance = instance;
};

const saveCacheToStorage = () => {
  if (typeof window !== 'undefined') {
    try {
      const serialized = JSON.stringify(Array.from(globalOsmCache.entries()));
      localStorage.setItem('osmCache', serialized);
    } catch (error) {
      console.warn('💾 Failed to save OSM cache to localStorage:', error.message);
    }
  }
};

export const clearGlobalOsmCache = () => {
  globalOsmCache.clear();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('osmCache');
  }
  return true;
};

export default ToolExecutor;

