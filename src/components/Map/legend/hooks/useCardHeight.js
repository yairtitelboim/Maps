import { useState, useEffect, useRef } from 'react';

const DEFAULT_SELECTORS = ['.base-card', '[data-perplexity-container]'];
const DEFAULT_FALLBACK_SELECTOR = 'div[style*="position: fixed"]';

const findLargestElement = (selector) => {
  const nodes = Array.from(document.querySelectorAll(selector));
  return nodes.reduce(
    (acc, node) => {
      const height = node?.offsetHeight || 0;
      if (height > acc.height && height > 100) {
        return { node, height };
      }
      return acc;
    },
    { node: null, height: 0 }
  ).node;
};

const findPrimaryElement = (selectors) => {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.offsetHeight > 100) {
      return element;
    }
  }
  return null;
};

export const useCardHeight = ({
  selectors = DEFAULT_SELECTORS,
  fallbackSelector = DEFAULT_FALLBACK_SELECTOR,
  minHeight = 200,
  defaultHeight = 400
} = {}) => {
  const [height, setHeight] = useState(defaultHeight);
  const previousHeightRef = useRef(defaultHeight);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let resizeObserver;

    const calculateHeight = () => {
      const primaryElement = findPrimaryElement(selectors);
      const targetElement = primaryElement || findLargestElement(fallbackSelector);

      if (targetElement) {
        const measured = Math.max(targetElement.offsetHeight, minHeight);
        previousHeightRef.current = measured;
        setHeight(measured);
      } else {
        setHeight(previousHeightRef.current || defaultHeight);
      }
    };

    calculateHeight();

    const handleResize = () => calculateHeight();
    window.addEventListener('resize', handleResize);

    const observerTarget = findPrimaryElement(selectors) || findLargestElement(fallbackSelector);
    if (observerTarget && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(calculateHeight);
      resizeObserver.observe(observerTarget);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [selectors, fallbackSelector, minHeight, defaultHeight]);

  return height;
};
