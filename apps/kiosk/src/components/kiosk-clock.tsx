import { useEffect, useState } from "react";

interface KioskClockProps {
	className?: string;
}

export function KioskClock({ className = "" }: KioskClockProps) {
	const [now, setNow] = useState<Date>(() => new Date());

	useEffect(() => {
		const t = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(t);
	}, []);

	const formatTime = (d: Date) =>
		d.toLocaleTimeString("en-GB", {
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
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
