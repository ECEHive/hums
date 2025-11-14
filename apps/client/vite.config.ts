import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import router from "@tanstack/router-plugin/vite";
import basicSSL from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import packageConfig from "./package.json";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), ["VITE_"]);

	return {
		publicDir: "public",
		base: "/",
		define: {
			__APP_VERSION__: JSON.stringify(packageConfig.version ?? "dev"),
		},
		server: {
			port: env.VITE_DEV_PORT ? parseInt(env.VITE_DEV_PORT, 10) : 44831,
			host: "0.0.0.0",
			https: {},
			proxy: {
				"/api": {
					target: env.VITE_DEV_SERVER_URL,
					changeOrigin: true,
				},
				// If more server endpoints are added,
				// they can be proxied here.
			},
		},
		plugins: [
			devtools({
				eventBusConfig: {
					port: 42069,
				},
			}),
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
