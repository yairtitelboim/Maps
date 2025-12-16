import { useState, useCallback, useRef } from 'react';

const resolveFactory = (factoryRef) => {
  const factory = factoryRef.current;
  if (typeof factory === 'function') {
    return factory();
  }
  return { ...factory };
};

export const useLayerVisibility = (initialFactory) => {
  const factoryRef = useRef(initialFactory);
  const [visibility, setVisibility] = useState(() => resolveFactory(factoryRef));

  const toggle = useCallback((key) => {
    setVisibility(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  const setVisibilityForKey = useCallback((key, value) => {
    setVisibility(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const setAll = useCallback((value) => {
    setVisibility(prev => Object.keys(prev).reduce((acc, key) => {
      acc[key] = value;
      return acc;
    }, {}));
  }, []);

  const reset = useCallback(() => {
    setVisibility(resolveFactory(factoryRef));
  }, []);

  return {
    visibility,
    toggle,
    setVisibilityForKey,
    setAll,
    reset,
    setVisibility
  };
};
