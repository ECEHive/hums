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
		(async () => {
			while (session.running) {
				try {
					const { value, done } = await reader.read();
					if (done) break;
					if (value) {
						value
							.split(/\r?\n/)
							.map((s: string) => s.trim())
							.filter(Boolean)
							.forEach((line: string) => {
								onScan({
									id: crypto.randomUUID(),
									data: line,
									timestamp: new Date(),
								});
							});
					}
				} catch (err) {
					onError(
						"Serial read error: " +
							(err instanceof Error ? err.message : String(err)),
					);
					break;
				}
			}
			reader.releaseLock();
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
