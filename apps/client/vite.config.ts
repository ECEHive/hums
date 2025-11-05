import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import router from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd());

	return {
		publicDir: "public",
		base: env.VITE_PUBLIC_PATH ?? "/",
		server: {
			port: 44831,
			host: "0.0.0.0",
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
		],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
	};
});
