'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { api } from '@/lib/api';
import { useNotifications } from '../notifications/NotificationProvider';
import './TaskQualityRater.css';

interface TaskQualityRaterProps {
    taskId: string;
    initialRating?: number;
    disabled?: boolean;
    onRate?: (newRating: number) => void;
}

export default function TaskQualityRater({ taskId, initialRating, disabled, onRate }: TaskQualityRaterProps) {
    const [rating, setRating] = useState(initialRating || 0);
    const [hoverRating, setHoverRating] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const { addNotification } = useNotifications();

    const handleRate = async (value: number) => {
        if (disabled || submitting) return;
        setSubmitting(true);
        try {
            await api.updateTask(taskId, { quality_rating: value });
            setRating(value);
            addNotification({
                title: 'Rating Submitted',
                message: `Task rated ${value} stars. KPI score updated.`,
                type: 'success'
            });
            if (onRate) onRate(value);
        } catch (err: any) {
            addNotification({
                title: 'Rating Failed',
                message: err.message || 'Could not save rating.',
                type: 'error'
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={`task-quality-rater ${disabled ? 'disabled' : ''}`}>
            <span className="rater-label">Quality Rating</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                <div className="stars-container">
                    {[1, 2, 3, 4, 5].map((value) => (
                        <button
                            key={value}
                            className={`star-btn ${(hoverRating || rating) >= value ? 'filled' : ''}`}
                            onClick={() => handleRate(value)}
                            onMouseEnter={() => !disabled && setHoverRating(value)}
                            onMouseLeave={() => !disabled && setHoverRating(0)}
                            disabled={disabled || submitting}
                            title={`Rate ${value} star${value !== 1 ? 's' : ''}`}
                        >
                            <Star size={26} className="star-icon" fill={(hoverRating || rating) >= value ? '#ffd700' : 'none'} />
                        </button>
                    ))}
                </div>
                {rating > 0 && (
                    <span className="rater-score">
                        {rating}/5
                    </span>
                )}
                {submitting && <span className="rater-loader">Saving...</span>}
            </div>
        </div>
    );
}
