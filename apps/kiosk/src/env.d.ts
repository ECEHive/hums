declare const __APP_VERSION__: string;

declare global {
	interface ImportMetaEnv {
		readonly TZ: string;
		readonly VITE_CLIENT_URL?: string;
	}

	interface ImportMeta {
		readonly env: ImportMetaEnv;
	}
}

export {};
