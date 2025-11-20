import React from 'react';

interface MetricBadgeProps {
  label: string;
  value: string | number;
  color?: 'purple' | 'pink' | 'blue' | 'green' | 'orange';
}

const colorClasses = {
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  pink: 'bg-pink-50 text-pink-700 border-pink-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
};

export default function MetricBadge({ label, value, color = 'purple' }: MetricBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${colorClasses[color]}`}>
      <span className="text-xs font-medium">{label}:</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}
