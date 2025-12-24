import { useMemo } from "react";
import { useFaceRecognition } from "@/hooks/use-face-recognition";

const statusCopy: Record<string, { label: string; tone: string }> = {
	idle: { label: "Idle", tone: "text-white/70" },
	"requesting-permission": {
		label: "Requesting camera",
		tone: "text-amber-200",
	},
	streaming: { label: "Camera ready", tone: "text-emerald-200" },
	"loading-models": { label: "Loading models", tone: "text-blue-200" },
	running: { label: "Detecting faces", tone: "text-emerald-200" },
	error: { label: "Error", tone: "text-red-300" },
};

export function FaceRecognitionPanel() {
	const { faces, gallery, status, error, videoRef } = useFaceRecognition();

	const statusLabel = useMemo(() => statusCopy[status]?.label ?? "", [status]);
	const statusTone = useMemo(
		() => statusCopy[status]?.tone ?? "text-white/70",
		[status],
	);

	return (
		<div className="pointer-events-none absolute bottom-4 right-4 z-30 w-[512px] max-w-full rounded-xl border border-white/15 bg-black/50 p-4 text-white shadow-xl backdrop-blur-lg">
			<div className="flex items-center justify-between gap-2">
				<div>
					<p className="text-sm font-semibold">Facial Recognition (beta)</p>
					<p className="text-xs text-white/60">
						Camera access is required to detect and label faces in view.
					</p>
				</div>
				<div className={`text-xs font-semibold ${statusTone}`}>
					{statusLabel}
				</div>
			</div>

			<div className="mt-3 flex gap-3">
				<video
					ref={videoRef}
					className="h-24 w-32 rounded-lg border border-white/10 bg-black/30 object-cover"
					muted
					playsInline
					autoPlay
				/>
				<div className="pointer-events-auto flex-1 overflow-hidden">
					<p className="text-xs font-semibold text-white/80">Visible faces</p>
					<div className="mt-1 max-h-24 overflow-y-auto rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/80">
						{faces.length === 0 ? (
							<p className="py-2 text-white/60">No faces detected yet.</p>
						) : (
							<ul className="space-y-1">
								{faces.map((face) => {
									const descriptor: string[] = [];
									if (typeof face.age === "number")
										descriptor.push(`~${Math.round(face.age)}y`);
									if (face.gender) descriptor.push(face.gender);
									const confidence = `${Math.round(face.confidence * 100)}%`;
									return (
										<li
											key={face.id}
											className="flex items-center justify-between gap-2 rounded-md bg-white/5 px-2 py-1"
										>
											<div className="truncate font-mono text-[11px] uppercase tracking-tight text-white">
												{face.id}
											</div>
											<div className="flex items-center gap-2 text-[11px] text-white/70">
												{descriptor.length > 0 && (
													<span>{descriptor.join(" · ")}</span>
												)}
												<span className="rounded bg-white/10 px-1 py-[1px] text-white/80">
													{confidence}
												</span>
											</div>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				</div>
			</div>

			<div className="pointer-events-auto mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/80">
				<div className="flex items-center justify-between gap-2">
					<p className="text-xs font-semibold text-white/80">
						Gallery (session)
					</p>
					<p className="text-[11px] text-white/60">Sorted by last seen</p>
				</div>
				<div className="mt-2 max-h-32 overflow-y-auto space-y-1">
					{gallery.length === 0 ? (
						<p className="py-1 text-white/60">No tracked faces yet.</p>
					) : (
						gallery.map((item) => (
							<div
								key={item.id}
								className="flex items-center justify-between gap-2 rounded-md border border-white/5 bg-black/20 px-2 py-1"
							>
								<span className="font-mono text-[11px] uppercase tracking-tight text-white">
									{item.id}
								</span>
								<div className="flex items-center gap-2 text-[11px] text-white/70">
									<span className="rounded bg-white/10 px-1 py-[1px]">
										{item.seenCount}× seen
									</span>
									<span className="text-white/60">
										{Math.round(item.lastSeenMsAgo / 1000)}s ago
									</span>
								</div>
							</div>
						))
					)}
				</div>
			</div>

			{error ? (
				<p className="mt-2 text-xs text-red-300">{error}</p>
			) : (
				<p className="mt-2 text-[11px] text-white/50">
					Identifiers stay stable for the same face during this session and
					refresh automatically as faces move.
				</p>
			)}
		</div>
	);
}
