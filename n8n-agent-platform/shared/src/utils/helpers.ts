export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function retry<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries: number;
        delay: number;
        backoff?: number;
        onRetry?: (error: Error, attempt: number) => void;
    }
): Promise<T> {
    return new Promise(async (resolve, reject) => {
        let lastError: Error;
        let delay = options.delay;

        for (let i = 0; i <= options.maxRetries; i++) {
            try {
                const result = await fn();
                return resolve(result);
            } catch (error: any) {
                lastError = error;
                
                if (i < options.maxRetries) {
                    if (options.onRetry) {
                        options.onRetry(error, i + 1);
                    }
                    
                    await sleep(delay);
                    
                    if (options.backoff) {
                        delay *= options.backoff;
                    }
                }
            }
        }

        reject(lastError!);
    });
}

export function chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;

    return function (...args: Parameters<T>) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            func(...args);
            timeoutId = null;
        }, wait);
    };
}

export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return function (...args: Parameters<T>) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as any;
    }

    if (obj instanceof Array) {
        const cloneArr: any[] = [];
        for (let i = 0; i < obj.length; i++) {
            cloneArr[i] = deepClone(obj[i]);
        }
        return cloneArr as any;
    }

    if (obj instanceof Object) {
        const cloneObj: any = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloneObj[key] = deepClone(obj[key]);
            }
        }
        return cloneObj;
    }

    return obj;
}

export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

export function generateId(prefix?: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

export function parseJSON<T>(json: string, fallback: T): T {
    try {
        return JSON.parse(json);
    } catch {
        return fallback;
    }
}

export function flattenObject(obj: any, prefix: string = ''): Record<string, any> {
    const flattened: Record<string, any> = {};

    Object.keys(obj).forEach(key => {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            Object.assign(flattened, flattenObject(value, newKey));
        } else {
            flattened[newKey] = value;
        }
    });

    return flattened;
}

export function unflattenObject(obj: Record<string, any>): any {
    const result: any = {};

    Object.keys(obj).forEach(key => {
        const keys = key.split('.');
        let current = result;

        keys.forEach((k, i) => {
            if (i === keys.length - 1) {
                current[k] = obj[key];
            } else {
                current[k] = current[k] || {};
                current = current[k];
            }
        });
    });

    return result;
}