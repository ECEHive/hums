import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import router from "@tanstack/router-plugin/vite";
import basicSSL from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), ["VITE_", "PROXY_"]);

	return {
		server: {
			port: 4483,
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
			tsConfigPaths(),
			router({
				target: "react",
				autoCodeSplitting: true,
			}),
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
