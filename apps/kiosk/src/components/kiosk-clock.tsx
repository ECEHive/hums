import { useEffect, useState } from "react";

interface KioskClockProps {
	className?: string;
}

export function KioskClock({ className = "" }: KioskClockProps) {
	const [now, setNow] = useState<Date>(() => new Date());

	useEffect(() => {
		// Update the time immediately
		const updateTime = () => setNow(new Date());
		updateTime();

		// Calculate milliseconds until the next minute boundary
		const msUntilNextMinute = 60000 - (Date.now() % 60000);

		let interval: NodeJS.Timeout;

		// Set a timeout to sync to the next minute boundary
		const syncTimeout = setTimeout(() => {
			updateTime();
			// Then set an interval to update every minute, on the minute
			interval = setInterval(updateTime, 60000);
		}, msUntilNextMinute);

		return () => {
			clearTimeout(syncTimeout);
			if (interval) clearInterval(interval);
		};
	}, []);

	const formatTime = (d: Date) =>
		d.toLocaleTimeString("en-GB", {
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
		});

	return (
		<div
			className={`font-mono font-bold tabular-nums ${className}`}
			aria-live="polite"
		>
			{formatTime(now)}
		</div>
	);
}
