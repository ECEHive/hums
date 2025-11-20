import type { ReactNode } from "react";

/**
 * Custom Kiosk UI Components
 * Simple, accessible components designed specifically for the kiosk interface
 * with proper scaling support
 */

// ============================================================================
// Card Component
// ============================================================================

interface KioskCardProps {
	children: ReactNode;
	className?: string;
	style?: React.CSSProperties;
	onClick?: () => void;
}

export function KioskCard({
	children,
	className = "",
	onClick,
}: KioskCardProps) {
	const Component = onClick ? "button" : "div";

	return (
		<Component
			type={onClick ? "button" : undefined}
			className={`w-full bg-card text-card-foreground rounded-xl shadow-lg ${onClick ? "cursor-pointer transition-transform hover:scale-[1.02]" : ""} ${className}`}
			onClick={onClick}
		>
			{children}
		</Component>
	);
}
