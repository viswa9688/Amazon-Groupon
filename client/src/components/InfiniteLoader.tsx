import React from 'react';
import { cn } from '@/lib/utils';

interface InfiniteLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'dots' | 'pulse' | 'wave';
  className?: string;
  text?: string;
}

export default function InfiniteLoader({ 
  size = 'md', 
  variant = 'spinner',
  className,
  text = 'Loading...'
}: InfiniteLoaderProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const renderSpinner = () => (
    <div className={cn(
      'animate-spin rounded-full border-2 border-gray-300 border-t-blue-600',
      sizeClasses[size],
      className
    )} />
  );

  const renderDots = () => (
    <div className={cn('flex space-x-1', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            'rounded-full bg-blue-600 animate-pulse',
            size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'
          )}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1s'
          }}
        />
      ))}
    </div>
  );

  const renderPulse = () => (
    <div className={cn(
      'rounded-full bg-blue-600 animate-pulse',
      sizeClasses[size],
      className
    )} />
  );

  const renderWave = () => (
    <div className={cn('flex space-x-1', className)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn(
            'bg-blue-600 rounded-sm animate-pulse',
            size === 'sm' ? 'w-1 h-4' : size === 'md' ? 'w-1 h-6' : 'w-1 h-8'
          )}
          style={{
            animationDelay: `${i * 0.1}s`,
            animationDuration: '1.2s'
          }}
        />
      ))}
    </div>
  );

  const renderLoader = () => {
    switch (variant) {
      case 'dots':
        return renderDots();
      case 'pulse':
        return renderPulse();
      case 'wave':
        return renderWave();
      default:
        return renderSpinner();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-3 p-4">
      {renderLoader()}
      {text && (
        <p className={cn(
          'text-gray-600 dark:text-gray-400 font-medium',
          textSizeClasses[size]
        )}>
          {text}
        </p>
      )}
    </div>
  );
}

// Full page loader component
export function FullPageLoader({ 
  text = 'Loading...',
  variant = 'spinner'
}: Omit<InfiniteLoaderProps, 'size'>) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 flex items-center justify-center">
      <div className="text-center">
        <InfiniteLoader 
          size="lg" 
          variant={variant}
          text={text}
          className="mb-4"
        />
      </div>
    </div>
  );
}

// Skeleton loader for content
export function SkeletonLoader({ 
  lines = 3,
  className 
}: { 
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('animate-pulse space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'bg-gray-300 dark:bg-gray-700 rounded',
            i === lines - 1 ? 'w-3/4' : 'w-full',
            'h-4'
          )}
        />
      ))}
    </div>
  );
}

// Card skeleton loader
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse', className)}>
      <div className="bg-gray-300 dark:bg-gray-700 rounded-lg h-48 mb-4"></div>
      <div className="space-y-2">
        <div className="bg-gray-300 dark:bg-gray-700 rounded h-4 w-3/4"></div>
        <div className="bg-gray-300 dark:bg-gray-700 rounded h-4 w-1/2"></div>
        <div className="bg-gray-300 dark:bg-gray-700 rounded h-4 w-2/3"></div>
      </div>
    </div>
  );
}

// Grid skeleton loader
export function GridSkeleton({ 
  items = 6,
  className 
}: { 
  items?: number;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
