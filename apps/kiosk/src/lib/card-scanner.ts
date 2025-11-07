import { getLogger } from "./logging";

const log = getLogger("card-scanner");

export interface CardScan {
	id: string;
	data: string;
	timestamp: Date;
}

export interface SerialSession {
	port: SerialPort;
	reader: ReadableStreamDefaultReader<string>;
	readableStreamClosed: Promise<void>;
	running: boolean;
}

export interface ConnectSerialOptions {
	baudRate?: number;
	// Web Serial filter shape
	filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
	// If no pre-authorized ports exist, whether to prompt the user
	requestOnNoPorts?: boolean;
	// Custom port picker if multiple are available
	pick?: (ports: SerialPort[]) => SerialPort | null;
}

export async function connectSerial(
	onScan: (scan: CardScan) => void,
	onError: (err: string) => void,
	options?: ConnectSerialOptions,
): Promise<SerialSession | null> {
	if (!("serial" in navigator)) {
		onError("Web Serial API not available in this browser.");
		return null;
	}
	try {
		const defaultVendorId = 0x09d8;
		const baudRate = options?.baudRate ?? 9600;
		const filters = options?.filters ?? [{ usbVendorId: defaultVendorId }];

		const existingPorts: SerialPort[] = await (
			navigator as Navigator & { serial: Serial }
		).serial.getPorts();
		let matchingPorts = existingPorts;
		if (filters?.length) {
			matchingPorts = existingPorts.filter((p) => {
				try {
					// Some environments may not expose getInfo
					const info = p.getInfo?.() ?? {};
					if (!info) return false;
					// If any filter matches, keep the port
					return filters.some(
						(f) =>
							(f.usbVendorId == null || info.usbVendorId === f.usbVendorId) &&
							(f.usbProductId == null || info.usbProductId === f.usbProductId),
					);
				} catch {
					return false;
				}
			});
		}

		let port: SerialPort | null = null;
		if (matchingPorts.length === 1) {
			port = matchingPorts[0];
		} else if (matchingPorts.length > 1) {
			port = options?.pick ? options.pick(matchingPorts) : matchingPorts[0];
		}

		// If no pre-authorized port selected, request one from the user
		if (!port) {
			if (options?.requestOnNoPorts === false) {
				onError("No pre-authorized serial ports available.");
				return null;
			}

			port = await (
				navigator as Navigator & { serial: Serial }
			).serial.requestPort({ filters });
		}

		// Open the port if needed
		if (!port.readable) {
			await port.open({ baudRate });
		}

		if (!port.readable) {
			onError("Failed to open serial port.");
			return null;
		}

		const textDecoder = new TextDecoderStream();
		const readableStreamClosed: Promise<void> = port.readable.pipeTo(
			// biome-ignore lint/suspicious/noExplicitAny: TextDecoderStream types don't perfectly match SerialPort types
			textDecoder.writable as any,
		);
		const reader = textDecoder.readable.getReader();
		const session: SerialSession = {
			port,
			reader,
			readableStreamClosed,
			running: true,
		};

		// Buffer partial incoming chunks until a carriage return is received.
		// Supports two formats:
		// - Traditional: "732276\r"  => "732276"
		// - Long-form: "...=...=...=6017700008173200\r" => take last '=' segment and
		//   return characters 10..15 (1-based) which yields "817320" in the example.
		const bufferParts: { buf: string } = { buf: "" };

		const parseCardData = (raw: string): string | null => {
			const s = raw.trim();
			if (!s) return null;
			// If contains '=', treat as long form
			if (s.includes("=")) {
				const parts = s.split("=");
				const last = parts[parts.length - 1] ?? "";
				// Extract characters 10..15 (1-based) => substring(9, 6)
				if (last.length >= 15) {
					const extracted = last.substring(9, 9 + 6);
					const digits = extracted.replace(/\D/g, "");
					return digits || null;
				}
				// Fallback: return continuous digits from last segment if it's shorter
				const fallback = last.replace(/\D/g, "");
				return fallback || null;
			}

			// Traditional: just return contiguous digits in the string
			const digits = s.replace(/\D/g, "");
			return digits || null;
		};

		(async () => {
			while (session.running) {
				try {
					const { value, done } = await reader.read();
					if (done) break;
					if (!value) continue;

					// Log raw incoming chunk
					try {
						log.debug("raw-chunk-received", { chunk: value });
					} catch {
						/* no-op if logger serialization fails */
					}

					// Append incoming chunk to buffer
					bufferParts.buf += value;

					// Process all complete records in buffer (terminated by '\r' or '\n')
					while (true) {
						const idxR = bufferParts.buf.indexOf("\r");
						const idxN = bufferParts.buf.indexOf("\n");
						if (idxR === -1 && idxN === -1) break;
						const idx =
							idxR === -1 ? idxN : idxN === -1 ? idxR : Math.min(idxR, idxN);
						const chunk = bufferParts.buf.slice(0, idx);
						// Remove processed chunk and its terminator
						bufferParts.buf = bufferParts.buf.slice(idx + 1);

						const trimmed = chunk.trim();
						if (!trimmed) continue;

						const parsed = parseCardData(trimmed);
						if (parsed) {
							try {
								log.info("card-parsed", { raw: trimmed, cardId: parsed });
							} catch {}
							onScan({
								id: crypto.randomUUID(),
								data: parsed,
								timestamp: new Date(),
							});
						} else {
							try {
								log.warn("card-parse-failed", { raw: trimmed });
							} catch {}
							// If parsing failed, ignore the record
						}
					}
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					try {
						log.error("serial-read-error", { message: msg });
					} catch {}
					onError("Serial read error: " + msg);
					break;
				}
			}
			try {
				reader.releaseLock();
			} catch {
				/* ignore */
			}
		})();
		return session;
	} catch (e) {
		onError(
			"connectReaderSerial error: " +
				(e instanceof Error ? e.message : String(e)),
		);
		return null;
	}
}

export async function disconnectSerial(session: SerialSession | null) {
	if (session) {
		session.running = false;
		try {
			await session.reader.cancel();
		} catch {
			/* ignore errors during cleanup */
		}
		try {
			await session.readableStreamClosed;
		} catch {
			/* ignore errors during cleanup */
		}
		try {
			await session.port.close();
		} catch {
			/* ignore errors during cleanup */
		}
	}
}
