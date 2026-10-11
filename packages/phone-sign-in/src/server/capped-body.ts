// Reading a small request body without trusting its size. Shared by the
// phone sign-in routes whose bodies are a few hundred bytes at most.

/**
 * The request body as text, or null when it is over maxBytes or cannot be
 * read. The size is counted as the bytes arrive, because a missing
 * content-length (HTTP/2 may omit it) or a false one would otherwise let a
 * large body be buffered whole. Reading stops at the first chunk past the cap.
 */
export async function readCappedBody(request: Request, maxBytes: number): Promise<string | null> {
	if (Number(request.headers.get('content-length')) > maxBytes) return null;
	if (!request.body) return '';

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > maxBytes) {
				await reader.cancel().catch(() => {});
				return null;
			}
			chunks.push(value);
		}
	} catch {
		return null;
	}

	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(bytes);
}

/** The body parsed as a JSON object, or null when it is too big, unreadable, not JSON or not an object. */
export async function readCappedJsonObject(
	request: Request,
	maxBytes: number
): Promise<Record<string, unknown> | null> {
	const text = await readCappedBody(request, maxBytes);
	if (text === null) return null;
	try {
		const value: unknown = JSON.parse(text);
		return typeof value === 'object' && value !== null && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}
