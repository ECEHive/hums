import type { PluginClientManifest } from "@ecehive/core/ui";

function PlaceholderPage() {
	return null;
}

const clientManifest: PluginClientManifest = {
	pages: [
		{
			path: "/control/points",
			label: "Control Points",
			component: PlaceholderPage,
			navItem: { label: "Control Points", order: 1 },
		},
		{
			path: "/control/providers",
			label: "Control Providers",
			component: PlaceholderPage,
			navItem: { label: "Providers", order: 2 },
		},
		{
			path: "/control/gateways",
			label: "Control Gateways",
			component: PlaceholderPage,
			navItem: { label: "Gateways", order: 3 },
		},
		{
			path: "/control/logs",
			label: "Control Logs",
			component: PlaceholderPage,
			navItem: { label: "Logs", order: 4 },
		},
	],
};

export default clientManifest;
