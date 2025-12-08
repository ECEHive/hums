declare const __APP_VERSION__: string;

declare global {
	interface ImportMetaEnv {
		readonly TZ: string;
		readonly VITE_AUTH_PROVIDER?: "CAS" | "CAS_PROXIED";
		readonly VITE_CAS_LOGIN_URL?: string;
		readonly VITE_CAS_PROXY_URL?: string;
	}

	interface ImportMeta {
		readonly env: ImportMetaEnv;
	}
}

export {};
