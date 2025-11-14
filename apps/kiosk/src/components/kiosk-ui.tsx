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
	style,
	onClick,
}: KioskCardProps) {
	const Component = onClick ? "button" : "div";

	return (
		<Component
			type={onClick ? "button" : undefined}
			className={`bg-card text-card-foreground kiosk-rounded-xl shadow-lg ${onClick ? "cursor-pointer transition-transform hover:scale-[1.02]" : ""} ${className}`}
			style={{
				border: `calc(1px * var(--kiosk-scale)) solid hsl(var(--border))`,
				width: "100%",
				textAlign: "inherit",
				...style,
			}}
			onClick={onClick}
		>
			{children}
		</Component>
	);
}

// ============================================================================
// Button Component
// ============================================================================

interface KioskButtonProps {
	children: ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	variant?: "default" | "destructive" | "outline" | "ghost";
	className?: string;
	style?: React.CSSProperties;
	title?: string;
}

export function KioskButton({
	children,
	onClick,
	disabled = false,
	variant = "default",
	className = "",
	style,
	title,
}: KioskButtonProps) {
	const getVariantStyles = () => {
		switch (variant) {
			case "destructive":
				return "bg-destructive text-destructive-foreground hover:bg-destructive/90";
			case "outline":
				return "bg-transparent border-input hover:bg-accent hover:text-accent-foreground";
			case "ghost":
				return "bg-transparent hover:bg-accent hover:text-accent-foreground";
			default:
				return "bg-primary text-primary-foreground hover:bg-primary/90";
		}
	};

	const borderStyle =
		variant === "outline" || variant === "ghost"
			? { border: `calc(1px * var(--kiosk-scale)) solid hsl(var(--border))` }
			: {};

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			title={title}
			className={`
				kiosk-rounded-lg
				inline-flex items-center justify-center
				font-medium
				transition-colors
				focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
				disabled:pointer-events-none disabled:opacity-50
				${getVariantStyles()}
				${className}
			`}
			style={{
				padding:
					"calc(0.625rem * var(--kiosk-scale)) calc(1.25rem * var(--kiosk-scale))",
				fontSize: "calc(0.875rem * var(--kiosk-scale))",
				...borderStyle,
				...style,
			}}
		>
			{children}
		</button>
	);
}

// ============================================================================
// Badge Component
// ============================================================================

interface KioskBadgeProps {
	children: ReactNode;
	variant?: "default" | "secondary" | "destructive" | "outline";
	className?: string;
	style?: React.CSSProperties;
}

export function KioskBadge({
	children,
	variant = "default",
	className = "",
	style,
}: KioskBadgeProps) {
	const getVariantStyles = () => {
		switch (variant) {
			case "destructive":
				return "bg-destructive text-destructive-foreground hover:bg-destructive/80";
			case "secondary":
				return "bg-secondary text-secondary-foreground hover:bg-secondary/80";
			case "outline":
				return "bg-transparent text-foreground";
			default:
				return "bg-primary text-primary-foreground hover:bg-primary/80";
		}
	};

	const borderStyle =
		variant === "outline"
			? { border: `calc(1px * var(--kiosk-scale)) solid hsl(var(--border))` }
			: {};

	return (
		<div
			className={`
				kiosk-rounded-lg
				inline-flex items-center
				font-semibold
				transition-colors
				${getVariantStyles()}
				${className}
			`}
			style={{
				padding:
					"calc(0.25rem * var(--kiosk-scale)) calc(0.625rem * var(--kiosk-scale))",
				fontSize: "calc(0.75rem * var(--kiosk-scale))",
				...borderStyle,
				...style,
			}}
		>
			{children}
		</div>
	);
}
