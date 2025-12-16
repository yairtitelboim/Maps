import styled from 'styled-components';

export const TimelineGraphContainer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: ${props => props.$visible ? '300px' : '0'};
  background: rgba(0, 0, 0, 0.98);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 2000;
  transition: height 0.3s ease;
  overflow: hidden;
  backdrop-filter: blur(8px);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
`;

export const TimelineGraphHeader = styled.div`
  padding: 10px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 4px;
  
  h3 {
    margin: 0;
    color: #e5e7eb;
    font-size: 16px;
    font-weight: 500;
  }
  
  p {
    margin: 0;
    color: #9ca3af;
    font-size: 12px;
    font-weight: 400;
  }
`;

export const TimelineChartContainer = styled.div`
  flex: 1;
  width: 100%;
  padding: 8px 18px 12px;
`;

export const TimelineLegendContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 18px 4px;
  background: rgba(15, 23, 42, 0.18);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`;

export const TimelineLegendButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid transparent;
  background: rgba(15, 23, 42, 0.4);
  color: ${props => props.$active ? '#f9fafb' : '#cbd5f5'};
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: ${props => props.$dimmed ? 0.45 : 1};
  
  &:hover {
    background: rgba(37, 51, 84, 0.6);
    color: #f9fafb;
  }
  
  &:focus-visible {
    outline: 2px solid rgba(59, 130, 246, 0.6);
    outline-offset: 2px;
  }
`;

export const TimelineLegendSwatch = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: ${props => props.$color || '#ffffff'};
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25);
  flex-shrink: 0;
`;

export const ToggleContainer = styled.div`
  position: fixed;
  bottom: ${props => props.$visible ? '320px' : '20px'};
  right: 4px;
  z-index: 2001;
  transition: bottom 0.3s ease;
  
  @media (max-width: 768px) {
    bottom: ${props => props.$visible ? '330px' : '20px'};
    right: -6px;
  }
`;

export const ToggleButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #e5e7eb;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
  
  &:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

export const ToggleIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.$active ? '#ffffff' : '#9ca3af'};
  transition: color 0.2s ease;
  
  svg {
    stroke: currentColor;
  }
`;

export const ToggleLabel = styled.span`
  user-select: none;
`;
