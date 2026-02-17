import { Logger } from "tslog";
import { builtinParsers, createCardParser } from "./parsers";
import type { CardScan, ConnectSerialOptions, SerialSession } from "./types";

const log = new Logger({
	name: "card-scanner",
	type: "pretty",
	prettyLogTemplate: "{{dateIsoStr}} {{logLevelName}} [{{name}}] ",
});

function formatLog(message: string, data?: Record<string, unknown>): string {
	if (!data || Object.keys(data).length === 0) return message;
	const parts = Object.entries(data)
		.map(([key, value]) => {
			if (value === null || value === undefined) return `${key}=null`;
			if (typeof value === "string") return `${key}=${value}`;
			if (typeof value === "number" || typeof value === "boolean")
				return `${key}=${value}`;
			if (typeof value === "object") {
				if (Array.isArray(value)) return `${key}=[${value.length} items]`;
				return `${key}={${Object.keys(value as object).join(",")}}`;
			}
			return `${key}=${String(value)}`;
		})
		.join(" ");
	return `${message} | ${parts}`;
}

/**
 * Connect to a serial card reader and begin scanning.
 *
 * Accepts optional {@link ConnectSerialOptions.parsers} to customise format
 * handling.  Falls back to the built-in magstripe + traditional parsers.
 */
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
		const parseCardData = createCardParser(options?.parsers ?? builtinParsers);

		const existingPorts: SerialPort[] = await (
			navigator as Navigator & { serial: Serial }
		).serial.getPorts();
		let matchingPorts = existingPorts;
		if (filters?.length) {
			matchingPorts = existingPorts.filter((p) => {
				try {
					const info = p.getInfo?.() ?? {};
					if (!info) return false;
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

		if (!port) {
			if (options?.requestOnNoPorts === false) {
				onError("No pre-authorized serial ports available.");
				return null;
			}
			port = await (
				navigator as Navigator & { serial: Serial }
			).serial.requestPort({ filters });
		}

		if (!port.readable) {
			await port.open({ baudRate });
		}

		if (!port.readable) {
			onError("Failed to open serial port.");
			return null;
		}

		const textDecoder = new TextDecoderStream();
		const readableStreamClosed: Promise<void> = port.readable.pipeTo(
			textDecoder.writable as WritableStream,
		);
		const reader = textDecoder.readable.getReader();
		const session: SerialSession = {
			port,
			reader,
			readableStreamClosed,
			running: true,
		};

		const bufferParts = { buf: "" };

		(async () => {
			while (session.running) {
				try {
					const { value, done } = await reader.read();
					if (done) break;
					if (!value) continue;

					bufferParts.buf += value;

					while (true) {
						const idxR = bufferParts.buf.indexOf("\r");
						const idxN = bufferParts.buf.indexOf("\n");
						if (idxR === -1 && idxN === -1) break;
						const idx =
							idxR === -1 ? idxN : idxN === -1 ? idxR : Math.min(idxR, idxN);
						const chunk = bufferParts.buf.slice(0, idx);
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

/**
 * Gracefully close a serial session.
 */
export async function disconnectSerial(
	session: SerialSession | null,
): Promise<void> {
	if (session) {
		session.running = false;
		try {
			await session.reader.cancel();
		} catch {
			/* ignore */
		}
		try {
			await session.readableStreamClosed;
		} catch {
			/* ignore */
		}
		try {
			await session.port.close();
		} catch {
			/* ignore */
		}
	}
}
