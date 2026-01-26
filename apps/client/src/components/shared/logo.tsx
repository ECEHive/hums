import { cn } from "@/lib/utils";

/**
 * Logo component that fetches logos from the branding API
 * Supports both light and dark themes with automatic switching
 */
export function Logo({ className = "" }: { className?: string }) {
	return (
		<>
			<img
				src="/api/branding/logo-light.svg"
				alt="Logo"
				className={cn("h-16 w-auto dark:hidden", className)}
			/>
			<img
				src="/api/branding/logo-dark.svg"
				alt="Logo"
				className={cn("h-16 w-auto hidden dark:block", className)}
			/>
		</>
	);
}

/**
 * Logo component that only shows the light version
 */
export function LogoLight({ className = "" }: { className?: string }) {
	return (
		<img
			src="/api/branding/logo-light.svg"
			alt="Logo"
			className={cn("h-16 w-auto", className)}
		/>
	);
}

/**
 * Logo component that only shows the dark version
 */
export function LogoDark({ className = "" }: { className?: string }) {
	return (
		<img
			src="/api/branding/logo-dark.svg"
			alt="Logo"
			className={cn("h-16 w-auto", className)}
		/>
	);
}
