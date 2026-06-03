type LogCategory = 'Query' | 'Mutation' | 'Realtime' | 'Perf' | 'Error' | 'System' | string;

const colors: Record<LogCategory, string> = {
    Query: '#3B82F6',    // Blue
    Mutation: '#10B981', // Green
    Realtime: '#8B5CF6', // Purple
    Perf: '#F59E0B',     // Yellow
    Error: '#EF4444',    // Red
    System: '#6B7280'    // Gray
};

const formatPrefix = (category: LogCategory) => {
    return [
        `%c[${category}]`,
        `color: ${colors[category]}; font-weight: bold;`
    ];
};

export const logger = {
    log: (...args: any[]) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(...args);
        }
    },
    info: (category: LogCategory, ...args: any[]) => {
        if (process.env.NODE_ENV === 'development') {
            const [prefix, style] = formatPrefix(category);
            console.log(prefix, style, ...args);
        }
    },
    warn: (category: LogCategory, ...args: any[]) => {
        if (process.env.NODE_ENV === 'development') {
            const [prefix, style] = formatPrefix(category);
            console.warn(prefix, style, ...args);
        }
    },
    error: (category: LogCategory, ...args: any[]) => {
        const [prefix, style] = formatPrefix(category);
        if (process.env.NODE_ENV === 'development') {
            console.error(prefix, style, ...args);
        } else {
            console.error(`[${category}]`, ...args); // Without colors for standard prod logs
        }
    }
};
