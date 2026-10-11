import type { PostProject } from "../../core/project/item-kinds.js";

const loadedFonts = new Map<string, Promise<void>>();

/** Wait for the actual recovered font before the first preview or export frame. */
export async function loadPostProjectFonts(
	project: PostProject,
	files: ReadonlyMap<string, File> = new Map(),
): Promise<void> {
	for (const font of project.fonts ?? []) {
		const ref = font.ref;
		if (ref.kind === "catalog") throw new Error("A project font needs a local file or a URL.");
		const key = `${font.family}:${ref.kind === "linked" ? ref.url : `${ref.name}:${ref.size}:${ref.lastModified}`}`;
		let pending = loadedFonts.get(key);
		if (!pending) {
			pending = (async () => {
				const file = ref.kind === "local" ? files.get(ref.name) : null;
				if (ref.kind === "local" && !file)
					throw new Error(`Relink the font ${ref.name} to show this post correctly.`);
				const source = file
					? await file.arrayBuffer()
					: `url(${JSON.stringify(ref.kind === "linked" ? ref.url : "")})`;
				const face = new FontFace(font.family, source);
				await face.load();
				document.fonts.add(face);
			})();
			loadedFonts.set(key, pending);
			pending.catch(() => loadedFonts.delete(key));
		}
		await pending;
	}
}
