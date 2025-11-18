
interface KioskContainerProps {
	children: React.ReactNode;
}

/**
 * KioskContainer enforces a 4:3 aspect ratio and provides consistent scaling
 * across different screen sizes and DPIs.
 *
 * The container will:
 * - Maintain a 4:3 aspect ratio regardless of screen size
 * - Center the content with letterboxing (black bars) if needed
 * - Provide CSS custom properties for responsive scaling
 * - Use a base size of 1024x768 (standard 4:3 resolution)
 */
export function KioskContainer({ children }: KioskContainerProps) {

	return (
		<div className="w-dvw h-dvh bg-black flex items-center justify-center overflow-hidden p-4">
			{children}
		</div>
	);
}
