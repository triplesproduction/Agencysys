import React, { ReactNode } from 'react';

export interface PageHeaderProps {
    title: ReactNode;
    subtitle?: ReactNode;
    icon?: ReactNode;
    actions?: ReactNode;
}

export const PageHeader = ({ title, subtitle, actions }: PageHeaderProps) => {
    return (
        <header className="page-header">
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title}
                </h1>
                {subtitle && (
                    <div className="page-subtitle-wrapper">
                        {subtitle}
                    </div>
                )}
            </div>
            {actions && (
                <div className="page-header-actions" style={{ flexShrink: 0 }}>
                    {actions}
                </div>
            )}
        </header>
    );
};
