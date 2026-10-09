import { vi } from "vitest";

// Polyfill ImageData for environments where jsdom omits it. Mirrors
// the real browser constructor overloads so tests that previously
// installed their own per-file polyfill (e.g. video-trails detectors)
// keep working when they share the same global:
//   new ImageData(width, height)
//   new ImageData(data, width, height?)
if (typeof (globalThis as { ImageData?: unknown }).ImageData === "undefined") {
	class ImageDataShim {
		readonly width: number;
		readonly height: number;
		readonly data: Uint8ClampedArray;
		constructor(
			dataOrWidth: Uint8ClampedArray | number,
			widthOrHeight: number,
			maybeHeight?: number,
		) {
			if (typeof dataOrWidth === "number") {
				// (width, height) - blank buffer.
				this.width = dataOrWidth;
				this.height = widthOrHeight;
				this.data = new Uint8ClampedArray(this.width * this.height * 4);
			} else {
				// (data, width, height?) - derive height when omitted.
				this.data = dataOrWidth;
				this.width = widthOrHeight;
				this.height = maybeHeight ?? dataOrWidth.length / 4 / widthOrHeight;
			}
		}
	}
	(globalThis as { ImageData?: unknown }).ImageData = ImageDataShim;
}
Object.defineProperty(document, "createElement", {
	writable: true,
	value: vi.fn().mockImplementation((tagName: string) => {
		if (tagName.toLowerCase() === "canvas") {
			const canvas = {
				tagName: "CANVAS",
				width: 0,
				height: 0,
				style: {},
				getContext: vi.fn().mockImplementation((kind: string) => {
					if (kind !== "2d") return null;
					return {
						fillStyle: "#000000",
						fillRect: vi.fn(),
						clearRect: vi.fn(),
						drawImage: vi.fn(),
						getImageData: vi
							.fn()
							.mockImplementation(
								(_x: number, _y: number, w: number, h: number) => new ImageData(w, h),
							),
					};
				}),
				toDataURL: vi.fn(() => "data:image/png;base64,"),
				toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(new Blob())),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			};
			return canvas;
		}

		const element = {
			tagName: tagName.toUpperCase(),
			style: {},
			href: "",
			download: "",
			click: vi.fn(),
			appendChild: vi.fn(),
			removeChild: vi.fn(),
			remove: vi.fn(),
			setAttribute: vi.fn(),
			removeAttribute: vi.fn(),
			getAttribute: vi.fn(() => null),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		};
		return element;
	}),
});
