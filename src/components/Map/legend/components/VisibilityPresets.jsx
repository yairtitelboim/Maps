import React, { useState, useEffect, useCallback } from 'react';
import SceneAIAgentCard from '../../components/Cards/SceneAIAgentCard';
import {
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
} from '../legendConfig';

// Archived: Placeholder scenes - Oklahoma-specific scenes removed for Columbus migration
// TODO: Add Columbus/AEP Ohio placeholder scenes if needed
const PLACEHOLDER_SCENES = {
  // Archived: Stillwater and Pryor placeholder scenes removed
  // stillwater: { ... },
  // pryor: { ... }
};

const VisibilityPresets = ({
  onSavePreset,
  onLoadPreset,
  onUpdatePreset,
  onDeletePreset,
  captureVisibilityState
}) => {
  const [showAIAgentCard, setShowAIAgentCard] = useState(false);
  const [activePresetId, setActivePresetId] = useState(null);
  // Archived: Default scene type changed from 'stillwater' - Oklahoma-specific
  const [sceneType, setSceneType] = useState('default'); // Updated for Columbus
  const [animationResetKey, setAnimationResetKey] = useState(0);
  // Visibility Presets Management (similar to Saved Scenes)
  const [visibilityPresets, setVisibilityPresets] = useState(() => {
    const savedPresets = localStorage.getItem('legendVisibilityPresets');
    return savedPresets ? JSON.parse(savedPresets) : [];
  });
  const [newPresetName, setNewPresetName] = useState('');
  const [editingPresetId, setEditingPresetId] = useState(null);
  const [editPresetName, setEditPresetName] = useState('');

  // Save visibility presets to localStorage whenever presets change
  useEffect(() => {
    localStorage.setItem('legendVisibilityPresets', JSON.stringify(visibilityPresets));
  }, [visibilityPresets]);

  // Load placeholder scenes when no saved scenes exist
  useEffect(() => {
    // Only load placeholders if there are no saved scenes
    // Check both state and localStorage to avoid overwriting user's saved scenes
    const savedPresets = localStorage.getItem('legendVisibilityPresets');
    const hasSavedScenes = savedPresets && JSON.parse(savedPresets).length > 0;
    
    // Archived: Oklahoma placeholder scene loading - removed for Columbus migration
    // TODO: Add Columbus/AEP Ohio placeholder scenes if needed
    // Check if placeholders already exist
    const hasStillwaterPlaceholder = false; // Archived: Oklahoma placeholder removed
    const hasPryorPlaceholder = false; // Archived: Oklahoma placeholder removed
    const hasPlaceholders = false; // Archived: No placeholders for now
    
    // Only load placeholders if:
    // 1. No saved scenes in localStorage
    // 2. No presets currently, OR placeholders are missing
    if (false && !hasSavedScenes && visibilityPresets.length === 0) {
      // Archived: Oklahoma placeholder scenes removed
      // const placeholderScenes = [
      //   { ...PLACEHOLDER_SCENES.stillwater },
      //   { ...PLACEHOLDER_SCENES.pryor }
      // ];
      // setVisibilityPresets(placeholderScenes);
      
      // Note: We don't auto-load a scene, just make placeholders available
      // User can click on them to load
    } else if (!hasSavedScenes && !hasPlaceholders && visibilityPresets.length > 0) {
      // If placeholders are missing but we have other presets, add them
      // This handles the case where user deleted placeholders but has no saved scenes
      const placeholderScenes = [
        ...visibilityPresets,
        // Archived: { ...PLACEHOLDER_SCENES.stillwater },
        { ...PLACEHOLDER_SCENES.pryor }
      ];
      setVisibilityPresets(placeholderScenes);
    }
  }, [visibilityPresets.length]); // Run when preset count changes

  // Function to save visibility preset
  const saveVisibilityPreset = useCallback(() => {
    if (!newPresetName.trim()) {
      console.warn('Preset name is required');
      return;
    }

    try {
      const visibilityState = captureVisibilityState();
      
      const newPreset = {
        id: Date.now(),
        name: newPresetName.trim(),
        timestamp: new Date().toISOString(),
        visibilityState
      };

      const updatedPresets = [...visibilityPresets, newPreset];
      setVisibilityPresets(updatedPresets);
      setNewPresetName('');
      
      if (onSavePreset) {
        onSavePreset(newPreset);
      }
    } catch (error) {
      console.error('Error saving visibility preset:', error);
    }
  }, [newPresetName, visibilityPresets, captureVisibilityState, onSavePreset]);

  // Function to load visibility preset
  const loadVisibilityPreset = useCallback((presetId) => {
    const preset = visibilityPresets.find(p => p.id === presetId);
    if (preset && onLoadPreset) {
      onLoadPreset(preset);
      
      // Check if this is STILLWATER or PRYOR scene
      try {
        const presetIndex = visibilityPresets.findIndex(p => p.id === presetId);
        const isFirstScene = presetIndex === 0;
        const isSecondScene = presetIndex === 1;
        
        const nameLower = preset.name ? preset.name.toLowerCase() : '';
        const nameMatchesStillwater = nameLower.includes('stillwater') || nameLower.includes('oklahoma');
        const nameMatchesPryor = nameLower.includes('pryor');
        
        const isStillwaterScene = isFirstScene || nameMatchesStillwater;
        const isPryorScene = isSecondScene || nameMatchesPryor;
        
        // If clicking the same scene again, reset the animation
        const isSameScene = activePresetId === presetId && (isStillwaterScene || isPryorScene);
        if (isSameScene) {
          // Ensure active preset is set
          setActivePresetId(presetId);
          // Hide card first to trigger cleanup
          setShowAIAgentCard(false);
          // Increment reset key to force animation reset
          setAnimationResetKey(prev => prev + 1);
          // Then show card again after a brief delay
          setTimeout(() => {
            setShowAIAgentCard(true);
          }, 100);
        } else {
          // New scene - set active and show card
          setActivePresetId(presetId);
          
          if (isStillwaterScene) {
            setSceneType('stillwater');
            // Show AI Agent card after a short delay
            setTimeout(() => {
              setShowAIAgentCard(true);
            }, 800);
          } else if (isPryorScene) {
            setSceneType('pryor');
            // Show AI Agent card after a short delay
            setTimeout(() => {
              setShowAIAgentCard(true);
            }, 800);
          } else {
            setActivePresetId(presetId); // Still set active even if not supported scene
            setShowAIAgentCard(false);
          }
        }
      } catch (error) {
        console.warn('Error checking scene type:', error);
        setShowAIAgentCard(false);
      }
    }
  }, [visibilityPresets, onLoadPreset, activePresetId]);

  // Function to update visibility preset
  const updateVisibilityPreset = useCallback((presetId, newName) => {
    if (!newName || !newName.trim()) {
      return;
    }

    try {
      const presetToUpdate = visibilityPresets.find(p => p.id === presetId);
      if (!presetToUpdate) {
        return;
      }

      // Capture current state
      const visibilityState = captureVisibilityState();

      const updatedPreset = {
        ...presetToUpdate,
        name: newName.trim(),
        timestamp: new Date().toISOString(),
        visibilityState
      };

      const updatedPresets = visibilityPresets.map(p => 
        p.id === presetId ? updatedPreset : p
      );
      
      setVisibilityPresets(updatedPresets);
      setEditingPresetId(null);
      setEditPresetName('');
      
      if (onUpdatePreset) {
        onUpdatePreset(updatedPreset);
      }
    } catch (error) {
      console.error('Error updating visibility preset:', error);
    }
  }, [visibilityPresets, captureVisibilityState, onUpdatePreset]);

  // Function to delete visibility preset
  const deleteVisibilityPreset = useCallback((presetId) => {
    try {
      const updatedPresets = visibilityPresets.filter(p => p.id !== presetId);
      setVisibilityPresets(updatedPresets);
      
      if (onDeletePreset) {
        onDeletePreset(presetId);
      }
    } catch (error) {
      console.error('Error deleting visibility preset:', error);
    }
  }, [visibilityPresets, onDeletePreset]);

  return (
    <div style={{
      marginBottom: '16px',
      padding: '12px',
      background: 'rgba(255, 255, 255, 0.03)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div style={{
        fontSize: '11px',
        fontWeight: '600',
        color: '#9ca3af',
        marginBottom: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        Visibility Presets
      </div>
      
      {/* New preset input */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <input
          value={newPresetName}
          onChange={(e) => setNewPresetName(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && newPresetName.trim()) {
              saveVisibilityPreset();
            }
          }}
          placeholder="Preset name..."
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '4px',
            color: '#f9fafb',
            fontSize: '11px',
            padding: '6px 10px',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            outline: 'none',
            transition: 'border-color 0.2s ease'
          }}
          onFocus={(e) => e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
        />
        <button
          onClick={saveVisibilityPreset}
          disabled={!newPresetName.trim()}
          style={{
            background: newPresetName.trim() ? 'rgba(59, 130, 246, 0.8)' : 'rgba(75, 85, 99, 0.5)',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: newPresetName.trim() ? 'pointer' : 'not-allowed',
            fontSize: '11px',
            padding: '6px 12px',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            fontWeight: '500',
            transition: 'background-color 0.2s ease',
            opacity: newPresetName.trim() ? 1 : 0.6
          }}
          onMouseEnter={(e) => {
            if (newPresetName.trim()) {
              e.target.style.background = 'rgba(59, 130, 246, 1)';
            }
          }}
          onMouseLeave={(e) => {
            if (newPresetName.trim()) {
              e.target.style.background = 'rgba(59, 130, 246, 0.8)';
            }
          }}
        >
          Save
        </button>
      </div>
      
      {/* Presets list */}
      {visibilityPresets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {visibilityPresets.map((preset, index) => {
            // Check if this is STILLWATER or PRYOR scene
            const isFirstScene = index === 0;
            const isSecondScene = index === 1;
            const nameLower = preset.name ? preset.name.toLowerCase() : '';
            const nameMatchesStillwater = nameLower.includes('stillwater') || nameLower.includes('oklahoma');
            const nameMatchesPryor = nameLower.includes('pryor');
            
            const isStillwaterScene = isFirstScene || nameMatchesStillwater;
            const isPryorScene = isSecondScene || nameMatchesPryor;
            const isSupportedScene = isStillwaterScene || isPryorScene;
            const isActive = activePresetId === preset.id;
            
            return (
              <div key={preset.id}>
                <div
                  onClick={() => {
                    // Only trigger load if not editing
                    if (editingPresetId !== preset.id) {
                      loadVisibilityPreset(preset.id);
                    }
                  }}
                  style={{
                    padding: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background-color 0.2s ease',
                    cursor: editingPresetId === preset.id ? 'default' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (editingPresetId !== preset.id) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (editingPresetId !== preset.id) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                >
                  {editingPresetId === preset.id ? (
                    <input
                      value={editPresetName}
                      onChange={(e) => setEditPresetName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          updateVisibilityPreset(preset.id, editPresetName);
                        }
                      }}
                      onBlur={() => {
                        updateVisibilityPreset(preset.id, editPresetName);
                      }}
                      style={{
                        flex: 1,
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.5)',
                        borderRadius: '4px',
                        color: '#f9fafb',
                        fontSize: '11px',
                        padding: '4px 8px',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                        outline: 'none'
                      }}
                      autoFocus
                    />
                  ) : (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          color: '#f9fafb',
                          fontSize: '11px',
                          fontWeight: '500',
                          marginBottom: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {preset.name}
                        </div>
                        <div style={{
                          color: '#9ca3af',
                          fontSize: '9px',
                          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
                        }}>
                          {new Date(preset.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadVisibilityPreset(preset.id);
                          }}
                          style={{
                            background: 'rgba(59, 130, 246, 0.8)',
                            border: 'none',
                            borderRadius: '50%',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '9px',
                            padding: '4px',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.target.style.background = 'rgba(59, 130, 246, 1)'}
                          onMouseLeave={(e) => e.target.style.background = 'rgba(59, 130, 246, 0.8)'}
                          title="Load preset"
                        >
                          ▶
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPresetId(preset.id);
                            setEditPresetName(preset.name);
                          }}
                          style={{
                            background: 'rgba(34, 197, 94, 0.8)',
                            border: 'none',
                            borderRadius: '50%',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '9px',
                            padding: '4px',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.target.style.background = 'rgba(34, 197, 94, 1)'}
                          onMouseLeave={(e) => e.target.style.background = 'rgba(34, 197, 94, 0.8)'}
                          title="Update preset"
                        >
                          ↻
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteVisibilityPreset(preset.id);
                          }}
                          style={{
                            background: 'rgba(239, 68, 68, 0.8)',
                            border: 'none',
                            borderRadius: '50%',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '9px',
                            padding: '4px',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 1)'}
                          onMouseLeave={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.8)'}
                          title="Delete preset"
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {/* Show AI Agent card below Stillwater or Pryor scene when active */}
                {isSupportedScene && isActive && (
                  <SceneAIAgentCard
                    isVisible={showAIAgentCard}
                    onClose={() => setShowAIAgentCard(false)}
                    sceneType={isStillwaterScene ? 'stillwater' : 'pryor'}
                    resetKey={animationResetKey}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VisibilityPresets;

