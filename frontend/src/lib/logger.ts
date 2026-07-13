const dev = process.env.NODE_ENV === 'development';

export const logger = {
    log:   (...args: any[]) => { if (dev) console.log(...args); },
    info:  (...args: any[]) => { if (dev) console.info(...args); },
    warn:  (...args: any[]) => { if (dev) console.warn(...args); },
    error: (...args: any[]) => console.error(...args),
};
