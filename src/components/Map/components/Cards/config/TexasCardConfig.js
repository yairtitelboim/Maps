// Texas Card Configuration - Backward Compatibility Stub
// NOTE: This file is maintained for backward compatibility.
// The actual card configurations are in ../../config/cardConfigs.js
// This file should be refactored to use Oklahoma-specific configurations.

import { getCardsForScene as getCardsForSceneFromConfig, getAvailableSceneIds as getAvailableSceneIdsFromConfig } from '../../../config/cardConfigs';
import cardFactory from '../factory/CardFactory';

// Re-export functions with Texas-specific naming for backward compatibility
export const getTexasCardsForScene = (sceneId) => {
  // Use the existing card configs (currently still Texas-focused)
  // TODO: Replace with Oklahoma-specific card configurations
  return getCardsForSceneFromConfig(sceneId) || [];
};

export const getTexasSceneIds = () => {
  return getAvailableSceneIdsFromConfig();
};

export const createTexasCard = (templateName, overrides = {}) => {
  // For now, use generic card factory
  // TODO: Create Oklahoma-specific card templates
  return cardFactory.createFromTemplate(`oklahoma-${templateName}`, overrides);
};

// Backward compatibility exports
export const getCardsForScene = getTexasCardsForScene;
export const getAvailableSceneIds = getTexasSceneIds;

// Register Oklahoma-specific templates (replacing Texas templates)
cardFactory.registerTemplate('oklahoma-overview', {
  type: 'scene',
  style: {
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderColor: '#4caf50' // Green for Oklahoma
  }
});

cardFactory.registerTemplate('oklahoma-energy', {
  type: 'scene',
  style: {
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderColor: '#f59e0b' // Amber for energy
  }
});

cardFactory.registerTemplate('oklahoma-infrastructure', {
  type: 'scene',
  style: {
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderColor: '#10b981' // Green for infrastructure
  }
});

export default {
  getTexasCardsForScene,
  getTexasSceneIds,
  createTexasCard,
  getCardsForScene,
  getAvailableSceneIds
};

