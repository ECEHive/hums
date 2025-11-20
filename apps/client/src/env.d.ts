declare const __APP_VERSION__: string;

declare global {
	interface ImportMetaEnv {
		readonly TZ: string;
	}

	interface ImportMeta {
		readonly env: ImportMetaEnv;
	}
}

export {};
