/**
 * Card Configurations - Framework Pattern
 * 
 * Demonstrates the pattern for defining scene-based card configurations.
 * Replace with your own scene and card definitions.
 */

const CARD_CONFIGS = {
  // Example Scene 0: Overview
  'scene-0': [
    {
      id: 'overview-card',
      title: 'Overview Analysis',
      position: { lat: 35.0, lng: -97.0 },
      nextSceneId: 'scene-1',
      content: {
        description: 'Example overview card demonstrating the card configuration pattern.'
      },
      style: { 
        priority: 1,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#4caf50'
      }
    }
  ],

  // Example Scene 1: Detailed Analysis
  'scene-1': [
    {
      id: 'detailed-analysis-card',
      title: 'Detailed Analysis',
      position: { lat: 35.1, lng: -97.1 },
      nextSceneId: 'scene-2',
      content: {
        data: {
          'Metric 1': 'Value 1',
          'Metric 2': 'Value 2',
          'Metric 3': 'Value 3'
        },
        description: 'Example detailed analysis card with data fields.'
      },
      style: { 
        priority: 1,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#f59e0b'
      }
    }
  ],

  // Example Scene 2: Results
  'scene-2': [
    {
      id: 'results-card',
      title: 'Analysis Results',
      position: { lat: 35.2, lng: -97.2 },
      nextSceneId: 'scene-0',
      content: {
        data: {
          'Result Type': 'Example Result',
          'Status': 'Complete',
          'Confidence': 'High'
        },
        description: 'Example results card showing analysis outcomes.'
      },
      style: { 
        priority: 1,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#4caf50'
      }
    }
  ]
};

/**
 * Get cards for a specific scene
 * @param {string} sceneId - Scene identifier
 * @returns {Array} Array of card configurations
 */
export const getCardsForScene = (sceneId) => {
  return CARD_CONFIGS[sceneId] || [];
};

/**
 * Get all available scene IDs that have cards
 * @returns {Array} Array of scene IDs
 */
export const getAvailableSceneIds = () => {
  return Object.keys(CARD_CONFIGS);
};

/**
 * Add cards for a scene dynamically
 * @param {string} sceneId - Scene identifier
 * @param {Array} cards - Array of card configurations to add
 */
export const addCardsForScene = (sceneId, cards) => {
  if (!CARD_CONFIGS[sceneId]) {
    CARD_CONFIGS[sceneId] = [];
  }
  CARD_CONFIGS[sceneId].push(...cards);
};

/**
 * Update card configuration
 * @param {string} sceneId - Scene identifier
 * @param {string} cardId - Card identifier
 * @param {Object} updates - Updates to apply
 * @returns {boolean} True if update was successful
 */
export const updateCardConfig = (sceneId, cardId, updates) => {
  const sceneCards = CARD_CONFIGS[sceneId];
  if (sceneCards) {
    const cardIndex = sceneCards.findIndex(card => card.id === cardId);
    if (cardIndex !== -1) {
      CARD_CONFIGS[sceneId][cardIndex] = {
        ...sceneCards[cardIndex],
        ...updates
      };
      return true;
    }
  }
  return false;
};

export default CARD_CONFIGS;

