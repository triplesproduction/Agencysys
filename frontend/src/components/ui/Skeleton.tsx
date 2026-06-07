import React from 'react';
import './Skeleton.css';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`ui-skeleton ${className}`}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';
