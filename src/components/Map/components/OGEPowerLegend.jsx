import React, { useState, useEffect } from 'react';

const legendItems = [
  { label: 'Gas', color: '#f97316' },
  { label: 'Coal', color: '#fbbf24' },
  { label: 'Wind', color: '#10b981' },
  { label: 'Solar', color: '#f59e0b' },
];

// Legend styling for bottom right positioning (above "Show Graph" button)
// Positioned similar to GRDA legend but offset to avoid overlap
const legendStyle = {
  position: 'fixed',
  right: 4,
  left: 'auto',
  top: 'auto',
  zIndex: 2002,
  background: '#181A1B',
  color: '#fff',
  borderRadius: 8,
  padding: '12px 18px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
  fontSize: 14,
  minWidth: 180,
  maxWidth: 260,
  opacity: 0.97,
  transition: 'bottom 0.3s ease'
};

const legendItemStyle = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: 6
};

const colorDotStyle = (color) => ({
  width: 16,
  height: 16,
  borderRadius: 8,
  background: color,
  marginRight: 10,
  border: '2px solid #222'
});

const OGEPowerLegend = ({ visible }) => {
  const [graphVisible, setGraphVisible] = useState(false);

  // Listen for graph visibility changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.showTimelineGraph !== undefined) {
      setGraphVisible(window.showTimelineGraph);
    }

    const checkGraphState = () => {
      if (window.showTimelineGraph !== undefined) {
        setGraphVisible(window.showTimelineGraph);
      }
    };

    const interval = setInterval(checkGraphState, 100);
    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  // Position legend above "Show Graph" button
  // If GRDA legend is also visible, stack OG&E legend above it
  const grdaLegendVisible = typeof window !== 'undefined' && window.okGRDAPowerMarkers && window.okGRDAPowerMarkers.length > 0;
  const legendHeight = 120; // Approximate height of legend
  
  // Position: above GRDA legend if both visible, otherwise same position as GRDA
  const dynamicLegendStyle = {
    ...legendStyle,
    bottom: graphVisible 
      ? (grdaLegendVisible ? 345 : 225)  // Stack above GRDA if both visible
      : (grdaLegendVisible ? 160 : 40),  // Stack above GRDA if both visible
    left: -74,
  };

  return (
    <div style={dynamicLegendStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#E5E7EB' }}>
        OG&E Power Generation:
      </div>
      {legendItems.map((item, index) => (
        <div key={index} style={legendItemStyle}>
          <div style={colorDotStyle(item.color)}></div>
          <span style={{ color: '#D1D5DB' }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default OGEPowerLegend;

