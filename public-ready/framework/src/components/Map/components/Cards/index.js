// Framework Cards index
// For the public framework example, we provide a very small, self-contained
// card implementation so we don't pull in proprietary BaseCard dependencies.

import React from 'react';

// Minimal, generic card used only in the framework example
const SimpleCard = ({ title, content, onClose, routesVisible, onToggleRoutes }) => {
  const description =
    typeof content === 'string'
      ? content
      : content?.description || 'Example card content.';

  const sceneDescription = content?.sceneDescription;

  const utility = content?.meta?.utility || 'Example Utility';
  const grid = content?.meta?.grid || 'Example Grid';

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 20,
        maxWidth: 360,
        background: 'rgba(15, 23, 42, 0.96)',
        color: '#e5e7eb',
        padding: '16px 20px',
        borderRadius: 12,
        border: '1px solid rgba(148, 163, 184, 0.4)',
        boxShadow: '0 18px 45px rgba(0,0,0,0.55)',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 0.12,
              color: '#9ca3af',
              marginBottom: 4,
            }}
          >
            Example Site
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: '#f9fafb',
            }}
          >
            {title || 'Example Campus'}
          </h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 13,
          lineHeight: 1.5,
          color: '#d1d5db',
        }}
      >
        {description}
      </div>

      {sceneDescription && (
        <div
          style={{
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(55, 65, 81, 0.8)',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.2,
              color: '#9ca3af',
              marginBottom: 4,
              fontWeight: 600,
            }}
          >
            Pattern
          </div>
          <div>{sceneDescription}</div>
          <ul
            style={{
              margin: '8px 0 0 16px',
              padding: 0,
              color: '#d1d5db',
            }}
          >
            <li>Two synthetic campuses on separate example grids (A/B)</li>
            <li>Simple example of grid redundancy vs single-grid exposure</li>
          </ul>
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: '1px solid rgba(55, 65, 81, 0.8)',
          fontSize: 12,
          color: '#9ca3af',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>
            <span style={{ color: '#6b7280' }}>Utility:</span>{' '}
            <span style={{ color: '#e5e7eb' }}>{utility}</span>
          </span>
          <span>
            <span style={{ color: '#6b7280' }}>Grid:</span>{' '}
            <span style={{ color: '#e5e7eb' }}>{grid}</span>
          </span>
        </div>

        {onToggleRoutes && (
          <button
            type="button"
            onClick={onToggleRoutes}
            style={{
              marginLeft: 'auto',
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid rgba(148, 163, 184, 0.6)',
              background: routesVisible
                ? 'rgba(248, 250, 252, 0.08)'
                : 'rgba(15, 23, 42, 0.9)',
              color: '#e5e7eb',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
            }}
            title={
              routesVisible
                ? 'Hide example grid routes'
                : 'Show example grid routes (Firecrawl-style)'
            }
          >
            {routesVisible ? 'Hide routes' : 'Show routes'}
          </button>
        )}
      </div>
    </div>
  );
};

// Minimal CardManager used by BasicMap to render a single example card
export const CardManager = ({ activeCards, onCardClose, routesVisible, onToggleRoutes }) => {
  if (!activeCards || activeCards.length === 0) return null;

  // For the example, just render the first card
  const card = activeCards[0];

  return (
    <SimpleCard
      title={card.title}
      content={card.content}
      onClose={onCardClose}
      routesVisible={routesVisible}
      onToggleRoutes={onToggleRoutes}
    />
  );
};

export default CardManager;


