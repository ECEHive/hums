import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	connectSerial,
	disconnectSerial,
	type SerialSession,
} from "@/lib/card-scanner";
import { formatLog, getLogger } from "@/lib/logging";
import type { ConnectionStatus } from "@/types";

const SERIAL_CONNECTION_CHECK_INTERVAL_MS = 2000;

type UseCardReaderOptions = {
	onScan: (cardNumber: string) => void | Promise<void>;
	onFatalError: (message: string) => void;
	onInvalidScan?: (raw: string) => void;
};

const isPromise = <T>(value: unknown): value is Promise<T> => {
	return (
		typeof value === "object" &&
		value !== null &&
		"then" in (value as Record<string, unknown>) &&
		typeof (value as Record<string, unknown>).then === "function"
	);
};

export function useCardReader({
	onScan,
	onFatalError,
	onInvalidScan,
}: UseCardReaderOptions) {
	const log = useMemo(() => getLogger("card-reader"), []);
	const [connectionStatus, setConnectionStatus] =
		useState<ConnectionStatus>("disconnected");
	const serialRef = useRef<SerialSession | null>(null);

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
			onFatalError(message);
			setConnectionStatus("error");
			await disconnect();
		},
		[disconnect, onFatalError],
	);

	const connect = useCallback(async () => {
		setConnectionStatus("connecting");
		log.info("Connecting to card reader");

		const session = await connectSerial(
			(scan) => {
				try {
					const maybePromise = onScan(scan.data);
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
				onInvalidScan: (raw) => {
					onInvalidScan?.(raw);
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
	}, [handleFatalError, log, onInvalidScan, onScan]);

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
