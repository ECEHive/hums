/// <reference types="vite-plugin-pwa/client" />

declare global {
	interface ImportMetaEnv {
		// Development-only variables used by Vite dev server
		readonly VITE_DEV_PORT?: string;
		readonly VITE_DEV_SERVER_URL?: string;
	}

	interface ImportMeta {
		readonly env: ImportMetaEnv;
	}

	const __APP_VERSION__: string;
}

export {};
