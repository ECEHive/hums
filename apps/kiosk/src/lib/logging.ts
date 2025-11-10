import { Logger } from "tslog";

export const logger = new Logger({
	name: "kiosk",
});

export function getLogger(name?: string) {
	if (name) return new Logger({ name: `kiosk:${name}` });
	return logger;
}
