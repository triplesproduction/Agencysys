import React from 'react';
import './Separator.css';

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className = '', orientation = 'horizontal', ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={orientation}
        className={`ui-separator orientation-${orientation} ${className}`}
        {...props}
      />
    );
  }
);

Separator.displayName = 'Separator';
