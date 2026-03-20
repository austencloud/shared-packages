/**
 * Connection Quality Detection
 *
 * Uses the Network Information API to detect connection quality and adapt
 * loading strategies accordingly. Provides fallbacks for browsers without support.
 */

export type ConnectionType = 'slow' | 'medium' | 'fast' | 'unknown';

export interface ConnectionInfo {
	type: ConnectionType;
	effectiveType: string;
	downlink: number;
	rtt: number;
	saveData: boolean;
}

export interface LoadingStrategy {
	maxConcurrent: number;
	timeout: number;
	useThumbOnSlow: boolean;
	preloadAhead: number;
}

// Navigator with Network Information API extension
interface NavigatorWithConnection extends Navigator {
	connection?: {
		effectiveType: string;
		downlink: number;
		rtt: number;
		saveData: boolean;
		addEventListener: (type: string, listener: () => void) => void;
		removeEventListener: (type: string, listener: () => void) => void;
	};
}

let cachedInfo: ConnectionInfo | null = null;
let listeners: Set<(info: ConnectionInfo) => void> = new Set();

function detectConnection(): ConnectionInfo {
	const nav = navigator as NavigatorWithConnection;
	const conn = nav.connection;

	if (!conn) {
		return {
			type: 'unknown',
			effectiveType: 'unknown',
			downlink: 10,
			rtt: 50,
			saveData: false
		};
	}

	const effectiveType = conn.effectiveType || '4g';
	const saveData = conn.saveData || false;

	let type: ConnectionType;
	if (saveData || effectiveType === '2g' || effectiveType === 'slow-2g') {
		type = 'slow';
	} else if (effectiveType === '3g') {
		type = 'medium';
	} else {
		type = 'fast';
	}

	return {
		type,
		effectiveType,
		downlink: conn.downlink || 10,
		rtt: conn.rtt || 50,
		saveData
	};
}

function notifyListeners(): void {
	cachedInfo = detectConnection();
	for (const listener of listeners) {
		listener(cachedInfo);
	}
}

/**
 * Get current connection quality info
 */
export function getConnectionInfo(): ConnectionInfo {
	if (!cachedInfo) {
		cachedInfo = detectConnection();

		// Set up change listener if available
		const nav = navigator as NavigatorWithConnection;
		if (nav.connection) {
			nav.connection.addEventListener('change', notifyListeners);
		}
	}
	return cachedInfo;
}

/**
 * Subscribe to connection quality changes
 */
export function onConnectionChange(callback: (info: ConnectionInfo) => void): () => void {
	listeners.add(callback);

	// Initialize if needed
	if (!cachedInfo) {
		getConnectionInfo();
	}

	return () => {
		listeners.delete(callback);
	};
}

/**
 * Get loading strategy based on connection quality
 */
export function getLoadingStrategy(): LoadingStrategy {
	const info = getConnectionInfo();

	// Localhost detection for development
	const isLocalhost =
		typeof window !== 'undefined' &&
		(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

	if (isLocalhost) {
		return {
			maxConcurrent: 20,
			timeout: 10000,
			useThumbOnSlow: false,
			preloadAhead: 10
		};
	}

	switch (info.type) {
		case 'slow':
			return {
				maxConcurrent: 2,
				timeout: 45000,
				useThumbOnSlow: true,
				preloadAhead: 2
			};
		case 'medium':
			return {
				maxConcurrent: 6,
				timeout: 30000,
				useThumbOnSlow: false,
				preloadAhead: 5
			};
		case 'fast':
		case 'unknown':
		default:
			return {
				maxConcurrent: 12,
				timeout: 20000,
				useThumbOnSlow: false,
				preloadAhead: 8
			};
	}
}

/**
 * Check if we should use reduced quality images
 */
export function shouldUseReducedQuality(): boolean {
	const info = getConnectionInfo();
	return info.saveData || info.type === 'slow';
}
