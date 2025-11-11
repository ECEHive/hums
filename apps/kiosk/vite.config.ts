import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import basicSSL from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), ["VITE_", "PROXY_"]);

	return {
		publicDir: "public",
		base: "/kiosk/",
		server: {
			port: 44832,
			host: "0.0.0.0",
			https: {},
			proxy: {
				"/api": {
					target: env.PROXY_PRIVATE_SERVER_URL,
					changeOrigin: true,
				},
				// If more server endpoints are added,
				// they can be proxied here.
			},
		},
		plugins: [
			devtools({
				eventBusConfig: {
					port: 42067,
				},
			}),
			tsConfigPaths(),
			react(),
			tailwindcss(),
			basicSSL(),
		],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
	};
});
