import { getLogoDataUrl, useBranding } from "@/hooks/useBranding";
import { cn } from "@/lib/utils";

interface LogoProps {
	className?: string;
	/** Force a specific logo variant instead of following the system theme. */
	variant?: "auto" | "light" | "dark";
}

export function Logo({ className = "", variant = "auto" }: LogoProps) {
	const { data: branding } = useBranding();

	if (!branding) {
		// Return placeholder while loading
		return <div className={cn("h-16 w-auto", className)} />;
	}

	// When a specific variant is requested, render only that logo
	if (variant === "dark") {
		return (
			<img
				src={getLogoDataUrl(branding.logos.dark)}
				alt="Logo"
				className={cn("h-16 w-auto", className)}
			/>
		);
	}

	if (variant === "light") {
		return (
			<img
				src={getLogoDataUrl(branding.logos.light)}
				alt="Logo"
				className={cn("h-16 w-auto", className)}
			/>
		);
	}

	// Auto: follow system theme via dark: variant
	return (
		<>
			<img
				src={getLogoDataUrl(branding.logos.light)}
				alt="Logo"
				className={cn("h-16 w-auto dark:hidden", className)}
			/>
			<img
				src={getLogoDataUrl(branding.logos.dark)}
				alt="Logo"
				className={cn("h-16 w-auto hidden dark:block", className)}
			/>
		</>
	);
}
