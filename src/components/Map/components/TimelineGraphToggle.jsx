import React from 'react';
import {
  ToggleContainer,
  ToggleButton,
  ToggleIcon,
  ToggleLabel
} from './styles/TimelineGraphStyles';

const TimelineGraphToggle = ({ visible, onToggle }) => {
  return (
    <ToggleContainer $visible={visible}>
      <ToggleButton 
        onClick={onToggle}
        $active={visible}
        title={visible ? 'Hide Timeline Graph' : 'Show Timeline Graph'}
      >
        <ToggleIcon $active={visible}>
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            width="18" 
            height="18"
          >
            <path d="M3 3v18h18M7 12l4-4 4 4 6-6" />
          </svg>
        </ToggleIcon>
        <ToggleLabel>{visible ? 'Hide Graph' : 'Show Graph'}</ToggleLabel>
      </ToggleButton>
    </ToggleContainer>
  );
};

export default TimelineGraphToggle;

