import { useEffect, useState } from "react";

const SCALE = 0.1;
const ROTATE = 1;
const SKEW = 1;

let clickTimes: number[] = [];
let isEffectActive = false;

const randomColor = () => {
	const hue = Math.floor(Math.random() * 360);
	const saturation = Math.floor(Math.random() * 50) + 50; // 50% to 100%
	const lightness = Math.floor(Math.random() * 40) + 30; // 30% to 70%
	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/**
 * Parse any CSS color to HSL values
 */
const parseColorToHSL = (
	color: string,
): { h: number; s: number; l: number } | null => {
	// Skip transparent/empty colors
	if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") {
		return null;
	}

	// Create a temporary element to let the browser parse the color
	const temp = document.createElement("div");
	temp.style.color = color;
	document.body.appendChild(temp);
	const computed = window.getComputedStyle(temp).color;
	document.body.removeChild(temp);

	// Parse rgb(r, g, b) or rgba(r, g, b, a)
	const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
	if (!match) return null;

	const r = parseInt(match[1], 10) / 255;
	const g = parseInt(match[2], 10) / 255;
	const b = parseInt(match[3], 10) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;

	let h = 0;
	let s = 0;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

		switch (max) {
			case r:
				h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
				break;
			case g:
				h = ((b - r) / d + 2) / 6;
				break;
			case b:
				h = ((r - g) / d + 4) / 6;
				break;
		}
	}

	return { h: h * 360, s, l };
};

/**
 * Determine if a color should be randomized based on its properties and theme
 */
const shouldRandomizeColor = (
	hsl: { h: number; s: number; l: number } | null,
): boolean => {
	if (!hsl) return false;

	const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const { s, l } = hsl;

	const isLight = l > 0.6;
	const isDark = l < 0.4;
	const isGray = s < 0.15; // Low saturation = gray
	const isColorful = s > 0.25;

	if (isDarkMode) {
		// In dark mode: randomize light colors and colorful colors, but keep dark/gray text
		return (isLight || isColorful) && !isGray;
	} else {
		// In light mode: randomize dark colors and colorful colors, but keep light/gray backgrounds
		return (isDark || isColorful) && !isGray;
	}
};

const glitchElement = (e: HTMLElement) => {
	if (!e.style) return;
	if (e.getAttribute("data-is-glitched") === "yes lol") return;

	// Get computed styles to read actual colors
	const computedStyle = window.getComputedStyle(e);

	// Process background color
	const bgColorHSL = parseColorToHSL(computedStyle.backgroundColor);
	if (shouldRandomizeColor(bgColorHSL)) {
		e.style.setProperty("background-color", randomColor(), "important");
	}

	// Randomize other color properties
	e.style.setProperty("color", randomColor(), "important");
	e.style.setProperty("border-color", randomColor(), "important");
	e.style.setProperty("outline-color", randomColor(), "important");
	e.style.setProperty("stroke", randomColor(), "important");
	e.style.setProperty("fill", randomColor(), "important");

	// Set random border type
	const borderStyles = [
		"solid",
		"dashed",
		"dotted",
		"double",
		"groove",
		"ridge",
	];
	const randomBorderStyle =
		borderStyles[Math.floor(Math.random() * borderStyles.length)];
	e.style.setProperty("border-style", randomBorderStyle, "important");

	// Apply random transformations
	e.style.rotate = `${Math.random() * ROTATE - ROTATE / 2}deg`;
	e.style.scale = `${1 + (Math.random() * SCALE - SCALE / 2) / 10}`;
	e.style.transform = `skew(${Math.random() * SKEW - SKEW / 2}deg, ${Math.random() * SKEW - SKEW / 2}deg)`;
	e.setAttribute("data-is-glitched", "yes lol");
};

const activateEffect = () => {
	// Prevent multiple instances
	if (isEffectActive) {
		return;
	}

	isEffectActive = true;

	// Glitch every initial element
	const allElements = document.querySelectorAll<HTMLElement>("*");
	allElements.forEach((target) => {
		glitchElement(target);
	});

	// Also glitch on page updates
	const observer = new MutationObserver(() => {
		const allElements = document.querySelectorAll<HTMLElement>("*");
		allElements.forEach((target) => {
			glitchElement(target);
		});
	});

	observer.observe(document.body, { childList: true, subtree: true });
};

/**
 * Easter egg: Glitches the page when triggered.
 * Once activated, the effect persists until page reload.
 */
export function useGlitchEgg() {
	const [isActive, setIsActive] = useState(isEffectActive);

	const handleClick = () => {
		const now = Date.now();
		const tenSecondsAgo = now - 10000;

		// Filter out clicks older than 10 seconds
		clickTimes = clickTimes.filter((time) => time > tenSecondsAgo);
		clickTimes.push(now);

		// Check if we've reached 10 clicks
		if (clickTimes.length >= 10) {
			clickTimes = []; // Reset clicks
			activateEffect();
			setIsActive(true);
		}
	};

	// Sync local state with module-level state on mount
	useEffect(() => {
		if (isEffectActive && !isActive) {
			setIsActive(true);
		}
	}, [isActive]);

	return { handleClick, isActive };
}
