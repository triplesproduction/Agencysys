import React from 'react';
import './DeadlineIndicator.css';

interface DeadlineIndicatorProps {
    deadline: string; // ISO date string
    status?: string;
}

export default function DeadlineIndicator({ deadline, status }: DeadlineIndicatorProps) {
    const isDone = status === 'DONE';
    const deadlineDate = new Date(deadline);
    const now = new Date();

    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let urgencyLevel = 'normal'; // green/neutral
    let displayText = '';

    if (status === 'APPROVED' || status === 'DONE') {
        urgencyLevel = 'done';
        displayText = 'Completed';
    } else if (status === 'SUBMITTED') {
        urgencyLevel = 'submitted';
        displayText = 'Under Review';
    } else if (status === 'MISSED_DEADLINE' || diffDays < 0) {
        urgencyLevel = 'overdue';
        displayText = `${Math.abs(diffDays)}d Overdue`;
    } else if (diffDays === 0) {
        urgencyLevel = 'critical';
        displayText = 'Due Today';
    } else if (diffDays <= 2) {
        urgencyLevel = 'warning';
        displayText = `${diffDays}d Left`;
    } else {
        urgencyLevel = 'normal';
        displayText = `${diffDays}d Left`;
    }

    return (
        <div className={`deadline-indicator ${urgencyLevel}`}>
            <div className="deadline-dot"></div>
            <span className="deadline-text">{displayText}</span>
        </div>
    );
}
