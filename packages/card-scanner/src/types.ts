/**
 * Card scan result emitted after successfully parsing serial data.
 */
export interface CardScan {
	id: string;
	data: string;
	timestamp: Date;
}

/**
 * Active serial connection state.
 */
export interface SerialSession {
	port: SerialPort;
	reader: ReadableStreamDefaultReader<string>;
	readableStreamClosed: Promise<void>;
	running: boolean;
}

/**
 * Options for establishing a serial connection.
 */
export interface ConnectSerialOptions {
	baudRate?: number;
	filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
	requestOnNoPorts?: boolean;
	pick?: (ports: SerialPort[]) => SerialPort | null;
	onInvalidScan?: (raw: string) => void;
	/** Card format parsers to try (in order). Falls back to builtins if omitted. */
	parsers?: CardFormatParser[];
}

/**
 * A pluggable parser that extracts a credential value from raw serial data.
 *
 * Return the parsed credential string on success, or `null` if the format
 * does not match.
 */
export interface CardFormatParser {
	/** Human-readable parser name (for logging). */
	name: string;
	/** Attempt to extract a credential value from `raw`. */
	parse(raw: string): string | null;
}

/**
 * Connection lifecycle states.
 */
export type ConnectionStatus =
	| "disconnected"
	| "connecting"
	| "connected"
	| "error";
