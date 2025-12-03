import { formatLog, getLogger } from "./logging";

const log = getLogger("card-scanner");
const CARD_NUMBER_LENGTH = 9;
const IIN_LENGTH = 6;

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
	// Optional hook for card scans we cannot parse
	onInvalidScan?: (raw: string) => void;
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
		// - Traditional: "000788997\r"  => "000788997"
		// - Long-form: "...=...=...=6017700001234560\r" => extract the 9 account
		//   digits between the 6-digit IIN (601770) and trailing checksum (0).
		const bufferParts: { buf: string } = { buf: "" };

		const normalizeDigits = (raw: string): string | null => {
			const digits = raw.replace(/\D/g, "");
			if (!digits) return null;
			if (digits.length >= CARD_NUMBER_LENGTH + IIN_LENGTH + 1) {
				const accountPortion = digits.slice(IIN_LENGTH, -1);
				if (accountPortion.length >= CARD_NUMBER_LENGTH) {
					return accountPortion
						.slice(-CARD_NUMBER_LENGTH)
						.padStart(CARD_NUMBER_LENGTH, "0");
				}
			}
			if (digits.length >= CARD_NUMBER_LENGTH) {
				return digits.slice(-CARD_NUMBER_LENGTH);
			}
			return digits.padStart(CARD_NUMBER_LENGTH, "0");
		};

		const parseCardData = (raw: string): string | null => {
			const s = raw.trim();
			if (!s) return null;
			if (s.includes("=")) {
				const parts = s.split("=");
				const last = parts[parts.length - 1] ?? "";
				return normalizeDigits(last);
			}

			return normalizeDigits(s);
		};

		(async () => {
			while (session.running) {
				try {
					const { value, done } = await reader.read();
					if (done) break;
					if (!value) continue;

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
							log.info(formatLog("Card scanned", { cardId: parsed }));
							onScan({
								id: crypto.randomUUID(),
								data: parsed,
								timestamp: new Date(),
							});
						} else {
							log.warn(formatLog("Card parse failed", { raw: trimmed }));
							options?.onInvalidScan?.(trimmed);
						}
					}
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					log.error(formatLog("Serial read error", { error: msg }));
					onError(`Serial read error: ${msg}`);
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
