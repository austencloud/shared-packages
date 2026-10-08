/**
 * Export codec helpers and the worker message protocol.
 *
 * These live apart from video-export.worker.ts so code that needs
 * selectCodec or the message types never imports the worker module, whose
 * top-level onmessage setup would run on the main thread.
 */

import type { CapturedFrame } from "./captured-frame.js";

// Mobile GPUs (Qualcomm/Mali/Apple) reliably silicon-accelerate H.264
// Constrained Baseline; many do NOT accelerate High and silently fall back to
// a software path, which on phones encodes at ~0.5fps. Desktop Windows Media
// Foundation is the opposite - it accelerates Main/High, not Baseline. So pick
// the profile by platform.
const IS_MOBILE = (() => {
	try {
		const nav = (
			self as unknown as {
				navigator?: Navigator & {
					userAgentData?: { mobile?: boolean; platform?: string };
				};
			}
		).navigator;
		const ua = nav?.userAgent ?? "";
		const platform = nav?.userAgentData?.platform ?? "";
		const isAndroid = /Android/i.test(ua) || platform === "Android";
		const isApple = /iPhone|iPad|iPod/i.test(ua) || platform === "iOS";
		return isAndroid || isApple || nav?.userAgentData?.mobile === true;
	} catch {
		return false;
	}
})();

// Message types -- IN (main thread -> worker)

interface ConfigMessage {
	type: "config";
	config: ExportConfig;
}

export interface FrameMessageLegacy {
	type: "frame";
	imageData: ImageData;
	frameIndex: number;
	timestampMicros: number;
	isKeyframe: boolean;
}

export interface FrameMessageCaptured {
	type: "frame-captured";
	frame: CapturedFrame;
	frameIndex: number;
	isKeyframe: boolean;
}

export type FrameMessage = FrameMessageLegacy | FrameMessageCaptured;

interface FinishMessage {
	type: "finish";
}

interface CancelMessage {
	type: "cancel";
}

export type ExportWorkerMessage = ConfigMessage | FrameMessage | FinishMessage | CancelMessage;

// Message types -- OUT (worker -> main thread)

interface ReadyResponse {
	type: "ready";
}

interface ProgressResponse {
	type: "progress";
	frameIndex: number;
}

interface DequeuedResponse {
	type: "dequeued";
	frameCount: number;
}

interface CompleteResponse {
	type: "complete";
	buffer: ArrayBuffer;
}

interface ErrorResponse {
	type: "error";
	error: string;
}

export type ExportWorkerResponse =
	| ReadyResponse
	| ProgressResponse
	| DequeuedResponse
	| CompleteResponse
	| ErrorResponse;

// Export configuration

export interface ExportConfig {
	width: number;
	height: number;
	fps: number;
	bitrate: number;
	totalFrames: number;
	/**
	 * Video codec. "h264" (default) = H.264 High profile, 4:2:0 - max
	 * compatibility but chroma-subsampled (fringes saturated edges on black).
	 * "av1" = AV1 High profile (4:4:4), no chroma subsampling - eliminates the
	 * edge/gradient fringe for near-exact parity with the on-screen render, at
	 * the cost of slower (often software) encode. WebCodecs path only.
	 */
	codec?: "h264" | "av1" | undefined;
	/**
	 * When true, mux fragmented MP4 (moof fragments) instead of progressive
	 * (moov+mdat). Fragmented MP4 is appendable to a MediaSource SourceBuffer,
	 * enabling gap-free MSE looping. Default false (progressive, max-compat).
	 */
	fragmented?: boolean | undefined;
	/** Preserve and normalize the source video's original audio in the MP4. */
	originalAudio?:
		| {
				url: string;
				startSeconds?: number;
				endSeconds?: number;
		  }
		| undefined;
}

/**
 * H.264 codec string. Profile prefix tracks the platform's HW path:
 * mobile GPUs accelerate Constrained Baseline (0x42e0), desktop Media
 * Foundation accelerates High (0x6400). Level byte tracks resolution.
 *   - Level 3.1 (0x1f): up to 921,600 px (e.g. 1280x720)
 *   - Level 4.0 (0x28): up to 2,073,600 px (e.g. 1920x1080)
 *   - Level 5.1 (0x33): up to 8,912,896 px (e.g. 4096x2160)
 *   - Level 6.0 (0x3c): up to 35,651,584 px (e.g. 8192x4320)
 */
export function selectCodec(width: number, height: number, isMobile: boolean = IS_MOBILE): string {
	const pixelArea = width * height;
	const level =
		pixelArea <= 921_600
			? "1f"
			: pixelArea <= 2_073_600
				? "28"
				: pixelArea <= 8_912_896
					? "33"
					: "3c";
	return isMobile ? `avc1.42e0${level}` : `avc1.6400${level}`;
}

/**
 * AV1 High profile (profile 1) = 4:4:4, no chroma subsampling, so saturated
 * red/blue edges and soft glow gradients survive intact - the lever for
 * near-exact parity. seq_level_idx scales with resolution (08=4.0 covers 1080p,
 * 13=5.1 covers 4K, 16=6.0 for 8K). `bitDepth` is "10" for max fidelity (10-bit
 * reconstruction kills the encoder-introduced banding/quantization noise on the
 * near-black background gradient) with "08" as the fallback for platforms whose
 * AV1 encoder can't do 10-bit.
 */
export function selectCodecAv1(
	width: number,
	height: number,
	bitDepth: "08" | "10" = "10",
): string {
	const pixelArea = width * height;
	if (pixelArea <= 2_073_600) return `av01.1.08M.${bitDepth}`;
	if (pixelArea <= 8_912_896) return `av01.1.13M.${bitDepth}`;
	return `av01.1.16M.${bitDepth}`;
}

export async function selectSupportedEncoderConfig(
	baseConfig: VideoEncoderConfig,
	useAv1: boolean,
	isSupported: (config: VideoEncoderConfig) => Promise<boolean>,
): Promise<VideoEncoderConfig> {
	const bitDepths = useAv1 ? (["10", "08"] as const) : (["10"] as const);
	for (const bitDepth of bitDepths) {
		for (const hardwareAcceleration of ["prefer-hardware", "no-preference"] as const) {
			const candidate = {
				...baseConfig,
				codec: useAv1
					? selectCodecAv1(baseConfig.width, baseConfig.height, bitDepth)
					: baseConfig.codec,
				hardwareAcceleration,
			};
			if (await isSupported(candidate).catch(() => false)) return candidate;
		}
	}
	return { ...baseConfig, hardwareAcceleration: "no-preference" };
}
