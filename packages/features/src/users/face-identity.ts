export type FaceEmbedding = number[];

export type FaceGalleryEntry = {
	userId: string;
	embedding: FaceEmbedding;
	sampleCount: number;
	updatedAt: number;
};

export type FaceMatchResult = {
	userId: string;
	similarity: number;
	effectiveThreshold: number;
};

const cosineSimilarity = (a: FaceEmbedding, b: FaceEmbedding) => {
	if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i += 1) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB);
	if (!Number.isFinite(denom) || denom === 0) return 0;
	return dot / denom;
};

const blendEmbedding = (
	existing: FaceEmbedding,
	incoming: FaceEmbedding,
	alpha = 0.3,
) => {
	if (existing.length === 0) return incoming;
	const len = Math.min(existing.length, incoming.length);
	const blended: FaceEmbedding = new Array(len);
	for (let i = 0; i < len; i += 1) {
		blended[i] = existing[i] * (1 - alpha) + incoming[i] * alpha;
	}
	return blended;
};

export type UpsertFaceEmbeddingParams = {
	gallery: FaceGalleryEntry[];
	userId: string;
	embedding: FaceEmbedding;
	blendAlpha?: number;
};

export function upsertFaceEmbedding({
	gallery,
	userId,
	embedding,
	blendAlpha = 0.3,
}: UpsertFaceEmbeddingParams): FaceGalleryEntry[] {
	const now = Date.now();
	const next = [...gallery];
	const existingIdx = next.findIndex((entry) => entry.userId === userId);

	if (existingIdx >= 0) {
		next[existingIdx] = {
			...next[existingIdx],
			embedding: blendEmbedding(
				next[existingIdx].embedding,
				embedding,
				blendAlpha,
			),
			sampleCount: next[existingIdx].sampleCount + 1,
			updatedAt: now,
		};
		return next;
	}

	next.push({
		userId,
		embedding: embedding.slice(),
		sampleCount: 1,
		updatedAt: now,
	});
	return next;
}

export type FindUserByFaceParams = {
	gallery: FaceGalleryEntry[];
	embedding: FaceEmbedding;
	minSimilarity?: number; // raise to tighten, lower to allow more leeway
	maxResults?: number;
};

export function findUserByFace({
	gallery,
	embedding,
	minSimilarity = 0.68,
	maxResults = 1,
}: FindUserByFaceParams): FaceMatchResult[] {
	const scored = gallery
		.map((entry) => ({
			entry,
			similarity: cosineSimilarity(entry.embedding, embedding),
		}))
		.filter((item) => item.similarity >= minSimilarity)
		.sort((a, b) => b.similarity - a.similarity)
		.slice(0, Math.max(1, maxResults));

	return scored.map((item) => ({
		userId: item.entry.userId,
		similarity: item.similarity,
		effectiveThreshold: minSimilarity,
	}));
}
