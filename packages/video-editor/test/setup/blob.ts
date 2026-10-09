// Polyfill Blob.prototype.arrayBuffer: jsdom's Blob predates it, so any code
// or test that reads bytes back out of a generated Blob (PDF exports, image
// encoders, share intake) throws "blob.arrayBuffer is not a function" under
// jsdom while passing in a node environment. FileReader is what jsdom does
// implement, so route through it.
if (typeof Blob !== "undefined" && typeof Blob.prototype.arrayBuffer !== "function") {
	Object.defineProperty(Blob.prototype, "arrayBuffer", {
		configurable: true,
		writable: true,
		value: function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as ArrayBuffer);
				reader.onerror = () => reject(reader.error);
				reader.readAsArrayBuffer(this);
			});
		},
	});
}
