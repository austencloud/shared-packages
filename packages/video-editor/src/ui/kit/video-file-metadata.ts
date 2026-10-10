/**
 * Get video metadata from a File object
 *
 * Extracts duration using video element.
 * Useful before calling createVideoFromUpload.
 */
export async function getVideoFileMetadata(
	file: File,
): Promise<{ duration: number; fileSize: number; mimeType: string }> {
	return new Promise((resolve, reject) => {
		const video = document.createElement("video");
		video.preload = "metadata";

		video.onloadedmetadata = () => {
			URL.revokeObjectURL(video.src);
			resolve({
				duration: video.duration,
				fileSize: file.size,
				mimeType: file.type || "video/mp4",
			});
		};

		video.onerror = () => {
			URL.revokeObjectURL(video.src);
			reject(new Error("Failed to load video metadata"));
		};

		video.src = URL.createObjectURL(file);
	});
}
