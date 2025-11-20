'use client';

interface SkeletonLoaderProps {
  type?: 'text' | 'card' | 'table' | 'circle';
  rows?: number;
  className?: string;
}

export default function SkeletonLoader({ type = 'text', rows = 3, className = '' }: SkeletonLoaderProps) {
  const baseClasses = 'animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%]';

  if (type === 'text') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`${baseClasses} h-4 rounded-lg`}
            style={{ width: `${Math.random() * 30 + 70}%` }}
          />
        ))}
      </div>
    );
  }

  if (type === 'circle') {
    return <div className={`${baseClasses} rounded-full ${className}`} style={{ width: '64px', height: '64px' }} />;
  }

  if (type === 'card') {
    return (
      <div className={`${baseClasses} rounded-2xl p-6 ${className}`}>
        <div className="space-y-4">
          <div className={`${baseClasses} h-6 rounded w-3/4`} />
          <div className={`${baseClasses} h-4 rounded w-full`} />
          <div className={`${baseClasses} h-4 rounded w-2/3`} />
        </div>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className={`${baseClasses} h-12 rounded-lg flex-1`} />
            <div className={`${baseClasses} h-12 rounded-lg flex-1`} />
            <div className={`${baseClasses} h-12 rounded-lg flex-1`} />
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-xl p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex gap-4 pb-4 border-b border-gray-200">
          <div className="animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 h-6 rounded w-1/4" />
          <div className="animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 h-6 rounded w-1/4" />
          <div className="animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 h-6 rounded w-1/4" />
          <div className="animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 h-6 rounded w-1/4" />
        </div>
        {/* Rows */}
        <SkeletonLoader type="table" rows={rows} />
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonLoader key={i} type="card" />
      ))}
    </div>
  );
}
