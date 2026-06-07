import React from 'react';
import './Avatar.css';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: number;
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className = '', src, alt, fallback, size, style, ...props }, ref) => {
    const customStyle = size ? { width: size, height: size, ...style } : style;

    return (
      <div ref={ref} className={`ui-avatar ${className}`} style={customStyle} {...props}>
        {src ? (
          <img src={src} alt={alt || ''} className="ui-avatar-img" />
        ) : (
          <div className="ui-avatar-fallback">{fallback || '?'}</div>
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';
