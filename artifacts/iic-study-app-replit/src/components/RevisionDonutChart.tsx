// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface Props {
  activeFilter: 'WEAK' | 'AVERAGE' | 'STRONG' | 'EXCELLENT' | null;
  data: {
    name: string;
    value: number;
    color: string;
    filterId: 'WEAK' | 'AVERAGE' | 'STRONG' | 'EXCELLENT';
  }[];
  onSegmentClick: (filterId: 'WEAK' | 'AVERAGE' | 'STRONG' | 'EXCELLENT') => void;
}

const COLORS: Record<string, string> = {
  WEAK: '#ef4444',
  AVERAGE: '#f97316',
  STRONG: '#22c55e',
  EXCELLENT: '#3b82f6',
};

const LABELS: Record<string, string> = {
  WEAK: 'Weak',
  AVERAGE: 'Average',
  STRONG: 'Strong',
  EXCELLENT: 'Mastery',
};

const EMOJIS: Record<string, string> = {
  WEAK: '😟',
  AVERAGE: '😐',
  STRONG: '💪',
  EXCELLENT: '🏆',
};

const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, filterId, value }: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central">
      <tspan x={x} dy="-8" fontSize="15" fontWeight="900">
        {`${Math.round(percent * 100)}%`}
      </tspan>
      <tspan x={x} dy="18" fontSize="11" fontWeight="600" opacity="0.9">
        {value} topics
      </tspan>
    </text>
  );
};

export const RevisionDonutChart: React.FC<Props> = ({ data, activeFilter, onSegmentClick }) => {
  const [activeSegment, setActiveSegment] = useState<string | null>(activeFilter);

  useEffect(() => {
    setActiveSegment(activeFilter);
  }, [activeFilter]);

  const totalTopics = data.reduce((sum, item) => sum + item.value, 0);
  const filteredData = data.filter(d => d.value > 0);
  const emptyData = [{ name: 'Empty', value: 1, filterId: 'NONE', color: '#e2e8f0' }];
  const chartData = totalTopics > 0 ? filteredData : emptyData;

  const selectedData = data.find(d => d.filterId === activeSegment);
  const selectedPct = totalTopics > 0 && selectedData
    ? Math.round((selectedData.value / totalTopics) * 100)
    : 0;

  return (
    <div className="w-full mb-4">
      {/* Pie Chart */}
      <div className="w-full" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={110}
              dataKey="value"
              paddingAngle={totalTopics > 0 ? 3 : 0}
              cornerRadius={6}
              labelLine={false}
              label={totalTopics > 0 ? (props) => (
                <CustomLabel {...props} filterId={props.filterId} />
              ) : undefined}
              onClick={(entry) => {
                if (totalTopics > 0 && entry?.payload?.filterId) {
                  const id = entry.payload.filterId;
                  setActiveSegment(id);
                  onSegmentClick(id);
                }
              }}
              isAnimationActive={true}
              stroke="none"
            >
              {chartData.map((entry, index) => {
                const color = COLORS[entry.filterId] || entry.color || '#e2e8f0';
                const isSelected = activeSegment === entry.filterId;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={color}
                    style={{
                      cursor: totalTopics > 0 ? 'pointer' : 'default',
                      opacity: totalTopics === 0 ? 1 : isSelected ? 1 : 0.65,
                      filter: isSelected && totalTopics > 0 ? `drop-shadow(0 4px 12px ${color}80)` : 'none',
                      outline: 'none',
                    }}
                  />
                );
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Color Legend with tap-to-filter */}
      <div className="grid grid-cols-2 gap-2 mt-1 px-1">
        {data.map((item) => {
          const color = COLORS[item.filterId];
          const isSelected = activeSegment === item.filterId;
          const pct = totalTopics > 0 ? Math.round((item.value / totalTopics) * 100) : 0;
          return (
            <button
              key={item.filterId}
              onClick={() => {
                if (totalTopics > 0) {
                  setActiveSegment(item.filterId);
                  onSegmentClick(item.filterId);
                }
              }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all active:scale-95"
              style={{
                background: isSelected ? `${color}18` : '#f8fafc',
                border: `2px solid ${isSelected ? color : '#e2e8f0'}`,
              }}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: color }}
              />
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-black text-slate-700 truncate">
                  {EMOJIS[item.filterId]} {LABELS[item.filterId]}
                </p>
                <p className="text-[10px] text-slate-500 font-semibold">
                  {item.value} topics · {pct}%
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* No data message */}
      {totalTopics === 0 && (
        <p className="text-center text-xs text-slate-400 font-semibold mt-3">
          MCQ complete karo — topics yahan dikhenge 📊
        </p>
      )}
    </div>
  );
};
