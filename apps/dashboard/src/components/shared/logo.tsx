import LogoDark from "@/assets/logo_dark.svg";
import LogoLight from "@/assets/logo_light.svg";
import { cn } from "@/lib/utils";

export function Logo({ className = "" }) {
	return (
		<>
			<img
				src={LogoLight}
				alt="HUMS Logo"
				className={cn("h-10 w-auto dark:hidden", className)}
			/>
			<img
				src={LogoDark}
				alt="HUMS Logo"
				className={cn("h-10 w-auto hidden dark:block", className)}
			/>
		</>
	);
}
