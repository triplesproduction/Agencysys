import React, { forwardRef } from 'react';
import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: any;
    onIconClick?: () => void;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className = '', id, icon: Icon, onIconClick, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;

    return (
        <div className={`input-wrapper ${className}`}>
            {label && <label htmlFor={inputId} className="input-label">{label}</label>}
            <div style={{ position: 'relative', width: '100%' }}>
                <input
                    id={inputId}
                    ref={ref}
                    className={`glass-input ${error ? 'has-error' : ''} ${Icon ? 'with-icon' : ''}`}
                    style={{ width: '100%' }}
                    {...props}
                />
                {Icon && (
                    <div
                        className="input-icon-wrapper"
                        onClick={onIconClick}
                        style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            cursor: onIconClick ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: 0.5,
                            transition: 'opacity 0.2s',
                            zIndex: 2
                        }}
                    >
                        <Icon size={18} />
                    </div>
                )}
            </div>
            {error && <span className="input-error">{error}</span>}
        </div>
    );
});

Input.displayName = 'Input';
export default Input;
