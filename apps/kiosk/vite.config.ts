import * as child from "node:child_process";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import basicSSL from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import packageConfig from "./package.json";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), ["VITE_"]);

	const commitHash = child.execSync("git rev-parse --short HEAD").toString();

	return {
		publicDir: "public",
		base: "/kiosk/",
		define: {
			__APP_VERSION__: JSON.stringify(packageConfig.version) ?? "dev",
			__COMMIT_HASH__: JSON.stringify(commitHash) ?? "unknown",
		},
		server: {
			port: env.VITE_DEV_PORT ? parseInt(env.VITE_DEV_PORT, 10) : 44832,
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
