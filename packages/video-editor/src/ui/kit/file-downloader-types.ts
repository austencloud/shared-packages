/**
 * File Download Service Contract
 *
 * Handles file download operations for the browser environment.
 * Provides cross-browser utilities for downloading files from Blob objects.
 */

export interface DownloadOptions {
	filename?: string;
	mimeType?: string;
	showSaveDialog?: boolean;
}

export interface BatchDownloadOptions extends DownloadOptions {
	delay?: number; // Delay between downloads to prevent browser blocking
	zipFiles?: boolean; // Future enhancement: zip multiple files
}

export interface DownloadResult {
	success: boolean;
	filename: string;
	method: "share" | "download";
	canceled?: boolean;
	error?: Error;
}
