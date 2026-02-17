import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Logger } from "tslog";
import { connectSerial, disconnectSerial } from "./scanner";
import type {
	CardFormatParser,
	ConnectionStatus,
	SerialSession,
} from "./types";

const SERIAL_CONNECTION_CHECK_INTERVAL_MS = 2000;

export type UseCardReaderOptions = {
	onScan: (cardNumber: string) => void | Promise<void>;
	onFatalError: (message: string) => void;
	onInvalidScan?: (raw: string) => void;
	/** Custom card format parsers. Falls back to built-in parsers if omitted. */
	parsers?: CardFormatParser[];
};

const isPromise = <T>(value: unknown): value is Promise<T> => {
	return (
		typeof value === "object" &&
		value !== null &&
		"then" in (value as Record<string, unknown>) &&
		typeof (value as Record<string, unknown>).then === "function"
	);
};

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
 * React hook wrapping the serial card reader.
 *
 * Manages connection lifecycle and invokes {@link UseCardReaderOptions.onScan}
 * for each successfully parsed scan.
 */
export function useCardReader({
	onScan,
	onFatalError,
	onInvalidScan,
	parsers,
}: UseCardReaderOptions) {
	const log = useMemo(
		() =>
			new Logger({
				name: "card-reader",
				type: "pretty",
				prettyLogTemplate: "{{dateIsoStr}} {{logLevelName}} [{{name}}] ",
			}),
		[],
	);

	const [connectionStatus, setConnectionStatus] =
		useState<ConnectionStatus>("disconnected");
	const serialRef = useRef<SerialSession | null>(null);

	const onScanRef = useRef(onScan);
	const onFatalErrorRef = useRef(onFatalError);
	const onInvalidScanRef = useRef(onInvalidScan);

	useEffect(() => {
		onScanRef.current = onScan;
	}, [onScan]);

	useEffect(() => {
		onFatalErrorRef.current = onFatalError;
	}, [onFatalError]);

	useEffect(() => {
		onInvalidScanRef.current = onInvalidScan;
	}, [onInvalidScan]);

	const disconnect = useCallback(async () => {
		if (!serialRef.current) {
			setConnectionStatus("disconnected");
			return;
		}
		await disconnectSerial(serialRef.current);
		serialRef.current = null;
		setConnectionStatus("disconnected");
		log.info("Card reader disconnected");
	}, [log]);

	const handleFatalError = useCallback(
		async (message: string) => {
			onFatalErrorRef.current(message);
			setConnectionStatus("error");
			await disconnect();
		},
		[disconnect],
	);

	const connect = useCallback(async () => {
		setConnectionStatus("connecting");
		log.info("Connecting to card reader");

		const session = await connectSerial(
			(scan) => {
				try {
					const maybePromise = onScanRef.current(scan.data);
					if (isPromise<void>(maybePromise)) {
						maybePromise.catch((error) => {
							log.error(
								formatLog("Card scan handler failed", {
									error: error instanceof Error ? error.message : String(error),
								}),
							);
						});
					}
				} catch (error) {
					log.error(
						formatLog("Card scan handler failed", {
							error: error instanceof Error ? error.message : String(error),
						}),
					);
				}
			},
			(err) => {
				log.error(formatLog("Serial connection error", { error: err }));
				void handleFatalError(err);
			},
			{
				parsers,
				onInvalidScan: (raw) => {
					onInvalidScanRef.current?.(raw);
				},
			},
		);

		if (session) {
			serialRef.current = session;
			setConnectionStatus("connected");
			log.info("Card reader connected successfully");
		} else {
			setConnectionStatus("error");
			log.error("Failed to connect to card reader");
		}
	}, [handleFatalError, log, parsers]);

	useEffect(() => {
		if (connectionStatus !== "connected" || !serialRef.current?.port) {
			return;
		}

		const checkConnection = setInterval(() => {
			if (!serialRef.current?.port.readable) {
				log.warn("Card reader disconnected - device unplugged");
				void handleFatalError("Kiosk disconnected - card reader was unplugged");
			}
		}, SERIAL_CONNECTION_CHECK_INTERVAL_MS);

		return () => clearInterval(checkConnection);
	}, [connectionStatus, handleFatalError, log]);

	useEffect(() => {
		return () => {
			void disconnect();
		};
	}, [disconnect]);

	return {
		connectionStatus,
		connect,
		disconnect,
	};
}
