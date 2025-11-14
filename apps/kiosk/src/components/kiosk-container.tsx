import { useEffect, useRef } from "react";

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
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const updateScale = () => {
			if (!containerRef.current) return;

			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			// Base resolution: 1024x768 (4:3 aspect ratio)
			const baseWidth = 1024;
			const baseHeight = 768;
			const targetAspectRatio = 4 / 3;

			// Calculate the maximum size that fits in the viewport while maintaining 4:3
			let containerWidth: number;
			let containerHeight: number;

			const viewportAspectRatio = viewportWidth / viewportHeight;

			if (viewportAspectRatio > targetAspectRatio) {
				// Viewport is wider than 4:3 - constrain by height
				containerHeight = viewportHeight;
				containerWidth = containerHeight * targetAspectRatio;
			} else {
				// Viewport is taller than or equal to 4:3 - constrain by width
				containerWidth = viewportWidth;
				containerHeight = containerWidth / targetAspectRatio;
			}

			// Calculate scale factor based on base resolution
			const scaleX = containerWidth / baseWidth;
			const scaleY = containerHeight / baseHeight;
			const newScale = Math.min(scaleX, scaleY);

			// Set CSS custom properties for use in child components
			containerRef.current.style.setProperty(
				"--kiosk-width",
				`${containerWidth}px`,
			);
			containerRef.current.style.setProperty(
				"--kiosk-height",
				`${containerHeight}px`,
			);
			containerRef.current.style.setProperty(
				"--kiosk-scale",
				newScale.toString(),
			);
			containerRef.current.style.setProperty(
				"--kiosk-base-width",
				`${baseWidth}px`,
			);
			containerRef.current.style.setProperty(
				"--kiosk-base-height",
				`${baseHeight}px`,
			);
		};

		updateScale();
		window.addEventListener("resize", updateScale);
		window.addEventListener("orientationchange", updateScale);

		return () => {
			window.removeEventListener("resize", updateScale);
			window.removeEventListener("orientationchange", updateScale);
		};
	}, []);

	return (
		<div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
			<div
				ref={containerRef}
				className="kiosk-viewport relative"
				style={{
					width: "var(--kiosk-width, 100vw)",
					height: "var(--kiosk-height, 100vh)",
					aspectRatio: "4 / 3",
				}}
			>
				{children}
			</div>
		</div>
	);
}
