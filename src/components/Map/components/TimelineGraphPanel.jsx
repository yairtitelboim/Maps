import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine
} from 'recharts';
import {
  TimelineGraphContainer,
  TimelineGraphHeader,
  TimelineChartContainer,
  TimelineLegendContainer,
  TimelineLegendButton,
  TimelineLegendSwatch
} from './styles/TimelineGraphStyles';

const formatNumericValue = (value) => {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  if (abs >= 100) {
    return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  }
  return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const CustomTooltip = ({ active, payload, label, units }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: 'rgba(31, 41, 55, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '6px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
      }}>
        <p style={{ 
          margin: '0 0 8px 0', 
          color: '#e5e7eb', 
          fontWeight: '500',
          fontSize: '13px'
        }}>
          {label}
        </p>
        {payload.map((entry) => (
          <p key={entry.dataKey} style={{ 
            margin: '4px 0', 
            color: entry.color,
            fontSize: '12px'
          }}>
            {`${entry.name}: ${formatNumericValue(entry.value)}${units ? ` ${units}` : ''}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const TimelineGraphPanel = ({ visible }) => {
  const [timelineState, setTimelineState] = useState({
    siteKey: null,
    siteName: '',
    data: [],
    series: [],
    units: 'ha',
    generatedAt: null
  });
  const [focusedSeries, setFocusedSeries] = useState(null);
  const lastEmittedLegendFocus = useRef(null);

  useEffect(() => {
    lastEmittedLegendFocus.current = null;
  }, [timelineState.generatedAt, timelineState.siteKey]);

  useEffect(() => {
    if (!focusedSeries) return;
    const hasFocusedSeries = timelineState.series.some(
      (series) => series.key === focusedSeries
    );
    if (!hasFocusedSeries) {
      setFocusedSeries(null);
    }
  }, [focusedSeries, timelineState.series]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus?.on) return undefined;

    const handleUpdate = (payload) => {
      if (!payload) return;
      setTimelineState({
        siteKey: payload.siteKey || null,
        siteName: payload.siteName || '',
        data: Array.isArray(payload.data) ? payload.data : [],
        series: Array.isArray(payload.series) ? payload.series : [],
        units: payload.units || 'ha',
        generatedAt: payload.generatedAt || Date.now()
      });
    };

    const handleClear = (payload) => {
      setTimelineState((prev) => {
        if (!payload?.siteKey || !prev.siteKey || prev.siteKey === payload.siteKey) {
          return { ...prev, data: [] };
        }
        return prev;
      });
    };

    const unsubscribeUpdate = window.mapEventBus.on('timeline:update', handleUpdate);
    const unsubscribeClear = window.mapEventBus.on('timeline:clear', handleClear);

    return () => {
      unsubscribeUpdate?.();
      unsubscribeClear?.();
    };
  }, []);

  const hasData = timelineState.data.length > 0 && timelineState.series.length > 0;
  const heading = timelineState.siteName
    ? `${timelineState.siteName} Change Timeline`
    : 'Timeline Analysis';
  const subheading = hasData
    ? `Annual change area by category (${timelineState.units})`
    : 'Run a site animation to populate change metrics';

  const totals = useMemo(() => (
    timelineState.data.map(point => point.total || 0)
  ), [timelineState.data]);

  const maxTotal = useMemo(() => (
    totals.length ? Math.max(...totals) : 0
  ), [totals]);

  const highlightAnnotations = useMemo(() => {
    if (timelineState.data.length < 2) return [];

    const deltas = [];
    for (let idx = 1; idx < timelineState.data.length; idx += 1) {
      const currentTotal = totals[idx] || 0;
      const prevTotal = totals[idx - 1] || 0;
      deltas.push(Math.abs(currentTotal - prevTotal));
    }

    const maxDelta = deltas.length ? Math.max(...deltas) : 0;
    const threshold = Math.max(maxTotal * 0.15, maxDelta * 0.5, 10);

    const annotations = [];
    for (let idx = 1; idx < timelineState.data.length; idx += 1) {
      const current = timelineState.data[idx];
      const previous = timelineState.data[idx - 1];
      const currentTotal = totals[idx] || 0;
      const prevTotal = totals[idx - 1] || 0;
      const delta = currentTotal - prevTotal;

      if (Math.abs(delta) >= threshold) {
        annotations.push({
          id: `${previous.id || idx - 1}-${current.id || idx}`,
          start: previous.period,
          end: current.period,
          direction: delta >= 0 ? 'increase' : 'decrease',
          delta,
          peak: Math.max(currentTotal, prevTotal)
        });
      }
    }

    return annotations;
  }, [timelineState.data, totals, maxTotal]);

  const handleLegendToggle = (seriesKey) => {
    setFocusedSeries((prev) => (prev === seriesKey ? null : seriesKey));
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus?.emit) return;

    const activeSeries = timelineState.series.find((series) => series.key === focusedSeries) || null;
    const payload = {
      siteKey: timelineState.siteKey || null,
      seriesKey: activeSeries?.key || null,
      label: activeSeries?.label || null,
      color: activeSeries?.color || null,
      active: Boolean(activeSeries)
    };

    const signature = `${payload.siteKey ?? 'global'}:${payload.seriesKey ?? 'none'}`;
    if (lastEmittedLegendFocus.current === signature) {
      return;
    }

    lastEmittedLegendFocus.current = signature;
    window.mapEventBus.emit('timeline:legendFocus', payload);
  }, [focusedSeries, timelineState.siteKey, timelineState.series]);

  if (!visible) return null;

  return (
    <TimelineGraphContainer $visible={visible}>
      <TimelineGraphHeader>
        <h3>{heading}</h3>
        <p>{subheading}</p>
      </TimelineGraphHeader>

      {hasData ? (
        <TimelineLegendContainer role="list">
          {timelineState.series.map((series) => {
            const isFocused = focusedSeries === series.key;
            const isDimmed = Boolean(focusedSeries) && !isFocused;
            return (
              <TimelineLegendButton
                key={series.key}
                type="button"
                onClick={() => handleLegendToggle(series.key)}
                $active={isFocused}
                $dimmed={isDimmed}
                aria-pressed={isFocused}
                role="listitem"
              >
                <TimelineLegendSwatch $color={series.color} />
                {series.label}
              </TimelineLegendButton>
            );
          })}
        </TimelineLegendContainer>
      ) : null}
      
      <TimelineChartContainer>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={timelineState.data}
              margin={{ top: 5, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                {timelineState.series.map((series) => (
                  <linearGradient
                    key={series.key}
                    id={`timelineGradient-${series.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={series.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={series.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#374151"
                opacity={0.3}
              />

              <XAxis
                dataKey="period"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={{ stroke: '#374151' }}
              />

              <YAxis
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={{ stroke: '#374151' }}
                tickFormatter={(value) => formatNumericValue(value)}
                width={70}
              />

              {highlightAnnotations.map((annotation) => (
                <ReferenceArea
                  key={annotation.id}
                  x1={annotation.start}
                  x2={annotation.end}
                  y1={0}
                  y2={(maxTotal || 1) * 1.1}
                  strokeOpacity={0}
                  fill={annotation.direction === 'increase' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(248, 113, 113, 0.14)'}
                />
              ))}

              <Tooltip
                content={(props) => (
                  <CustomTooltip {...props} units={timelineState.units} />
                )}
              />

              {timelineState.series.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  stackId="change"
                  fill={series.color}
                  stroke={series.color}
                  fillOpacity={focusedSeries && focusedSeries !== series.key ? 0.25 : 0.92}
                  strokeOpacity={focusedSeries && focusedSeries !== series.key ? 0.25 : 1}
                  strokeWidth={focusedSeries === series.key ? 2 : 1}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                  animationDuration={450}
                />
              ))}

              {highlightAnnotations.map((annotation) => (
                <ReferenceLine
                  key={`${annotation.id}-line`}
                  x={annotation.end}
                  stroke={annotation.direction === 'increase' ? '#22c55e' : '#f87171'}
                  strokeDasharray="3 3"
                  ifOverflow="extendDomain"
                  label={{
                    value: `${annotation.direction === 'increase' ? '+' : ''}${formatNumericValue(annotation.delta)} ${timelineState.units}`,
                    position: 'top',
                    style: {
                      fill: annotation.direction === 'increase' ? '#22c55e' : '#f87171',
                      fontSize: 11
                    }
                  }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#9ca3af',
              fontSize: '13px'
            }}
          >
            Timeline data unavailable. Activate a site animation to populate the chart.
          </div>
        )}
      </TimelineChartContainer>
    </TimelineGraphContainer>
  );
};

export default TimelineGraphPanel;
