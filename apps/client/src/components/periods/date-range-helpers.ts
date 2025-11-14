export function normalizeRangeToDayBounds(
	start?: Date,
	end?: Date,
): [Date | null, Date | null] {
	const normalizedStart = start ? setBoundary(new Date(start), "start") : null;
	const normalizedEnd = end ? setBoundary(new Date(end), "end") : null;
	return [normalizedStart, normalizedEnd];
}

function setBoundary(date: Date, boundary: "start" | "end") {
	if (boundary === "start") {
		date.setHours(0, 0, 0, 0);
	} else {
		date.setHours(23, 59, 0, 0);
	}
	return date;
}
