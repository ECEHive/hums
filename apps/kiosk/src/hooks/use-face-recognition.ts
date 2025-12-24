import Human, { type Config as HumanConfig } from "@vladmandic/human";
import { useEffect, useRef, useState } from "react";

export type FaceIdentifier = {
	id: string;
	confidence: number;
	age?: number;
	gender?: string;
};

export type GalleryItem = {
	id: string;
	seenCount: number;
	lastSeenMsAgo: number;
};

type RecognitionStatus =
	| "idle"
	| "requesting-permission"
	| "streaming"
	| "loading-models"
	| "running"
	| "error";

const humanConfig: Partial<HumanConfig> = {
	backend: "webgl",
	cacheModels: true,
	filter: { enabled: true, equalization: true },
	modelBasePath: "https://vladmandic.github.io/human/models/",
	warmup: "face",
	face: {
		enabled: true,
		detector: {
			model: "blazeface",
			maxDetected: 5,
			minConfidence: 0.35,
			iouThreshold: 0.2,
			rotation: true,
			return: true,
		},
		mesh: { enabled: true },
		iris: { enabled: false },
		age: { enabled: true },
		emotion: { enabled: true },
		description: { enabled: true },
	},
};

type GalleryEntry = {
	id: string;
	embedding: number[];
	seenCount: number;
	lastSeen: number;
};

const cosineSimilarity = (a: number[], b: number[]) => {
	if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i += 1) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-6);
};

const blendEmbedding = (
	existing: number[],
	incoming: number[],
	alpha = 0.3,
) => {
	if (existing.length === 0) return incoming;
	return existing.map(
		(value, idx) => value * (1 - alpha) + (incoming[idx] ?? 0) * alpha,
	);
};

const MATCH_THRESHOLD = 0.68;

export const useFaceRecognition = () => {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const [faces, setFaces] = useState<FaceIdentifier[]>([]);
	const [gallery, setGallery] = useState<GalleryItem[]>([]);
	const [status, setStatus] = useState<RecognitionStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const galleryRef = useRef<GalleryEntry[]>([]);
	const nextIdRef = useRef(1);

	useEffect(() => {
		let isActive = true;
		let rafId: number | null = null;
		let stream: MediaStream | null = null;
		const human = new Human(humanConfig);
		const lastUpdateRef = { value: 0 };

		const stopStream = () => {
			if (stream) {
				for (const track of stream.getTracks()) {
					track.stop();
				}
				stream = null;
			}
		};

		const detectLoop = async () => {
			if (!isActive) return;
			const video = videoRef.current;
			if (!video || video.readyState < 2) {
				rafId = window.requestAnimationFrame(detectLoop);
				return;
			}

			try {
				const result = await human.detect(video);
				const now = performance.now();

				// Soft prune stale gallery entries to reduce drift when users leave frame.
				galleryRef.current = galleryRef.current.filter(
					(entry) => now - entry.lastSeen < 45_000,
				);

				// Throttle UI updates to ~2 per second to reduce rerenders.
				if (now - lastUpdateRef.value > 450) {
					const detectedFaces = result.face ?? [];
					const usedGalleryIds = new Set<string>();
					const faceAssignments = new Map<number, GalleryEntry>();

					// Build candidate list (face index, gallery entry, similarity)
					const candidates: Array<{
						faceIndex: number;
						entry: GalleryEntry;
						similarity: number;
					}> = [];
					for (let i = 0; i < detectedFaces.length; i += 1) {
						const emb = detectedFaces[i].embedding ?? [];
						if (emb.length === 0) continue;
						for (const entry of galleryRef.current) {
							candidates.push({
								faceIndex: i,
								entry,
								similarity: cosineSimilarity(entry.embedding, emb),
							});
						}
					}

					// Greedy one-to-one matching: assign highest similarity pairs first.
					candidates.sort((a, b) => b.similarity - a.similarity);
					const assignedFaces = new Set<number>();
					for (const candidate of candidates) {
						if (candidate.similarity < MATCH_THRESHOLD) continue;
						if (assignedFaces.has(candidate.faceIndex)) continue;
						if (usedGalleryIds.has(candidate.entry.id)) continue;
						faceAssignments.set(candidate.faceIndex, candidate.entry);
						assignedFaces.add(candidate.faceIndex);
						usedGalleryIds.add(candidate.entry.id);
					}

					const identifiedFaces: FaceIdentifier[] = detectedFaces.map(
						(face, idx) => {
							const embedding = face.embedding ?? [];
							let assignedId = "face-untracked";
							const matched = faceAssignments.get(idx);

							if (matched && embedding.length > 0) {
								assignedId = matched.id;
								matched.embedding = blendEmbedding(
									matched.embedding,
									embedding,
								);
								matched.seenCount += 1;
								matched.lastSeen = now;
							} else if (embedding.length > 0) {
								assignedId = `face-${String(nextIdRef.current).padStart(3, "0")}`;
								nextIdRef.current += 1;
								galleryRef.current.push({
									id: assignedId,
									embedding: embedding.slice(),
									seenCount: 1,
									lastSeen: now,
								});
							}

							return {
								id: assignedId,
								confidence: face.boxScore ?? face.faceScore ?? 0,
								age: face.age,
								gender: face.gender,
							};
						},
					);

					setFaces(identifiedFaces);
					setGallery(
						[...galleryRef.current]
							.sort((a, b) => b.lastSeen - a.lastSeen)
							.map((entry) => ({
								id: entry.id,
								seenCount: entry.seenCount,
								lastSeenMsAgo: Math.max(0, now - entry.lastSeen),
							})),
					);
					lastUpdateRef.value = now;
				}
			} catch (err) {
				console.error("Face detection error", err);
				if (isActive) {
					setError("Facial recognition failed. Please refresh and try again.");
					setStatus("error");
				}
				return;
			}

			rafId = window.requestAnimationFrame(detectLoop);
		};

		const start = async () => {
			setStatus("requesting-permission");
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					video: {
						facingMode: "user",
						width: { ideal: 640 },
						height: { ideal: 360 },
					},
					audio: false,
				});

				if (!isActive) return;

				const video = videoRef.current;
				if (video) {
					video.srcObject = stream;
					video.onloadedmetadata = () => {
						setStatus("streaming");
						void video.play();
					};
				}

				setStatus("loading-models");
				await human.load();
				if (!isActive) return;
				setStatus("running");
				detectLoop();
			} catch (err) {
				console.error("Face recognition setup error", err);
				if (isActive) {
					setError(
						err instanceof Error
							? err.message
							: "Unable to access camera. Please allow permissions and refresh.",
					);
					setStatus("error");
				}
				stopStream();
			}
		};

		void start();

		return () => {
			isActive = false;
			if (rafId !== null) {
				window.cancelAnimationFrame(rafId);
			}
			stopStream();
			// tfjs cleanup varies by backend; attempt a safe dispose when available.
			if (human.tf && typeof (human.tf as never).dispose === "function") {
				// @ts-expect-error runtime guard for optional dispose
				human.tf.dispose();
			}
		};
	}, []);

	return {
		faces,
		gallery,
		status,
		error,
		videoRef,
	};
};
