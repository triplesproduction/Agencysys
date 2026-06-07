import React from 'react';
import './Badge.css';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className = '', variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`ui-badge variant-${variant} ${className}`}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';
