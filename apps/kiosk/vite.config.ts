import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import basicSSL from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tsConfigPaths from "vite-tsconfig-paths";
import packageConfig from "./package.json";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), ["VITE_"]);

	return {
		publicDir: "public",
		base: "/kiosk/",
		define: {
			__APP_VERSION__: JSON.stringify(packageConfig.version ?? "dev"),
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
				// Proxy favicon to branding endpoint
				"/kiosk/favicon.svg": {
					target: env.VITE_DEV_SERVER_URL,
					changeOrigin: true,
					rewrite: () => "/api/branding/favicon.svg",
				},
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
			VitePWA({
				registerType: "autoUpdate",
				workbox: {
					globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,glb,gltf}"],
					cleanupOutdatedCaches: true,
				},
				manifest: {
					name: "HUMS Kiosk",
					short_name: "HUMS Kiosk",
					description: "HUMS Kiosk - Check in and out of the makerspace",
					theme_color: "#171717",
					background_color: "#171717",
					display: "standalone",
					icons: [
						{
							src: "pwa-192x192.png",
							sizes: "192x192",
							type: "image/png",
						},
						{
							src: "pwa-512x512.png",
							sizes: "512x512",
							type: "image/png",
						},
						{
							src: "pwa-512x512.png",
							sizes: "512x512",
							type: "image/png",
							purpose: "maskable",
						},
					],
				},
				devOptions: {
					enabled: false,
				},
			}),
		],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
	};
});
