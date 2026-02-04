import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

function LiveClock({ className = "" }: { className?: string }) {
	const [time, setTime] = useState(new Date());

	useEffect(() => {
		const interval = setInterval(() => setTime(new Date()), 1000);
		return () => clearInterval(interval);
	}, []);

	return (
		<span className={`tabular-nums ${className}`}>
			{time.toLocaleTimeString("en-US", {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			})}
		</span>
	);
}

interface KioskHeaderProps {
	logo?: string | null;
	getLogoDataUrl: (logo: string) => string;
	centerContent?: React.ReactNode;
	rightContent?: React.ReactNode;
	onCancel?: () => void;
	showCancel?: boolean;
}

/**
 * Shared header component for kiosk pages.
 * Consistent h-14 height matching the main app shell header.
 */
export function KioskHeader({
	logo,
	getLogoDataUrl,
	centerContent,
	rightContent,
	onCancel,
	showCancel = false,
}: KioskHeaderProps) {
	return (
		<header className="relative flex h-14 shrink-0 items-center border-b px-8">
			{/* Left side - Logo */}
			<div className="flex items-center gap-3 z-10">
				{logo && (
					<img src={getLogoDataUrl(logo)} alt="Logo" className="h-8 w-auto" />
				)}
			</div>

			{/* Center content - absolutely positioned for true centering */}
			{centerContent && (
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<div className="pointer-events-auto">{centerContent}</div>
				</div>
			)}

			{/* Spacer */}
			<div className="flex-1" />

			{/* Right side - Cancel button, custom content, or spacer */}
			<div className="flex items-center z-10">
				{rightContent ? (
					rightContent
				) : showCancel && onCancel ? (
					<Button
						variant="ghost"
						size="sm"
						onClick={onCancel}
						className="gap-2"
					>
						<LogOut className="w-4 h-4" />
						Cancel
					</Button>
				) : null}
			</div>
		</header>
	);
}

interface AuthenticatedHeaderProps {
	logo?: string | null;
	getLogoDataUrl: (logo: string) => string;
	userName: string;
	onCancel: () => void;
}

/**
 * Header for authenticated view with user name and time centered.
 */
export function AuthenticatedHeader({
	logo,
	getLogoDataUrl,
	userName,
	onCancel,
}: AuthenticatedHeaderProps) {
	return (
		<KioskHeader
			logo={logo}
			getLogoDataUrl={getLogoDataUrl}
			showCancel
			onCancel={onCancel}
			centerContent={
				<div className="flex items-center gap-2">
					<span className="font-medium">{userName}</span>
					<Separator orientation="vertical" className="h-4" />
					<LiveClock />
				</div>
			}
		/>
	);
}

interface IdleHeaderProps {
	logo?: string | null;
	getLogoDataUrl: (logo: string) => string;
}

/**
 * Header for idle view with logo on left and time on right.
 */
export function IdleHeader({ logo, getLogoDataUrl }: IdleHeaderProps) {
	return (
		<KioskHeader
			logo={logo}
			getLogoDataUrl={getLogoDataUrl}
			rightContent={<LiveClock className="text-xl" />}
		/>
	);
}

export { LiveClock };
