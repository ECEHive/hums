import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd());

	return {
		publicDir: "public",
		base: env.VITE_PUBLIC_PATH ?? "/kiosk/",
		server: {
			port: 44832,
			host: "0.0.0.0",
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
		],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
	};
});
