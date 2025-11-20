import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";

interface KioskClockProps {
	className?: string;
}

export function KioskClock({ className = "" }: KioskClockProps) {
	const [now, setNow] = useState<Dayjs>(dayjs());

	useEffect(() => {
		// Update the time immediately
		const updateTime = () => setNow(dayjs());
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

	return (
		<div
			className={`font-mono font-bold ${className} leading-none`}
			aria-live="polite"
		>
			<p className="leading-none w-full flex flex-row items-center justify-center">
				{now.format("HH")}:{now.format("mm")}
			</p>
		</div>
	);
}
