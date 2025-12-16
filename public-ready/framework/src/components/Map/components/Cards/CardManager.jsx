import React, { useState, useEffect, useCallback } from 'react';
import BaseCard from './BaseCard';

// Give the primary BaseCard a stable identity so scene switches don't reset its state
const deriveCardKey = (card, index) => {
  if (index === 0) {
    return 'base-card';
  }
  return card.id || `card-${index}`;
};

const CardManager = ({ 
  map, 
  activeCards, 
  onCardClose, 
  onSceneNavigate,
  autoPosition = true
}) => {
  const [visibleCards, setVisibleCards] = useState([]);
  const [cardPositions, setCardPositions] = useState({});

  // Update visible cards when activeCards change
  useEffect(() => {
    if (activeCards && activeCards.length > 0) {
      const timer = setTimeout(() => {
        setVisibleCards(activeCards);

        if (autoPosition && map?.current) {
          setCardPositions((prevPositions) => {
            const nextPositions = {};
            const mapContainer = map.current.getContainer();
            const containerRect = mapContainer.getBoundingClientRect();
            const cardWidth = 320;
            const cardHeight = 200;

            activeCards.forEach((card, index) => {
              const cardKey = deriveCardKey(card, index);
              nextPositions[cardKey] = prevPositions[cardKey] || {
                lng: (containerRect.width - cardWidth) / 2,
                lat: (containerRect.height - cardHeight) / 2
              };
            });

            return nextPositions;
          });
        }
      }, 2000);

      return () => clearTimeout(timer);
    }

    setVisibleCards([]);
    setCardPositions({});
  }, [activeCards, map, autoPosition]);

  const handleCardClose = useCallback((cardId, cardKey) => {
    setVisibleCards(prev => prev.filter(card => card.id !== cardId));
    setCardPositions(prev => {
      const newPositions = { ...prev };
      delete newPositions[cardKey];
      return newPositions;
    });
    onCardClose?.(cardId);
  }, [onCardClose]);

  const handleNavigate = useCallback((card) => {
    if (card.nextSceneId) {
      onSceneNavigate?.(card.nextSceneId);
    }
  }, [onSceneNavigate]);

  const handleCardPositionUpdate = useCallback((cardKey, newPosition) => {
    setCardPositions(prev => ({
      ...prev,
      [cardKey]: newPosition
    }));
  }, []);

  // If no cards, don't render anything
  if (visibleCards.length === 0) {
    return null;
  }

  return (
    <>
      {visibleCards.map((card, index) => {
        const cardKey = deriveCardKey(card, index);
        const position = cardPositions[cardKey] || card.position || { lng: 0, lat: 0 };
        
        return (
          <BaseCard
            key={cardKey}
            {...card}
            position={position}
            map={map}
            onClose={() => handleCardClose(card.id, cardKey)}
            onNavigate={() => handleNavigate(card)}
            onPositionUpdate={(newPos) => handleCardPositionUpdate(cardKey, newPos)}
          />
        );
      })}
    </>
  );
};

export default CardManager;
