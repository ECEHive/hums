import { getLogoDataUrl, useBranding } from "@/hooks/useBranding";
import { cn } from "@/lib/utils";

export function Logo({ className = "" }) {
	const { data: branding } = useBranding();

	if (!branding) {
		// Return placeholder while loading
		return <div className={cn("h-16 w-auto", className)} />;
	}

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
