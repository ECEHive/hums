// Entry point for the control plugin
import type { HumsPlugin } from "@ecehive/core";
import { ControlKioskModeStub } from "./client/kiosk/control-kiosk-mode.stub";
import { controlRestRoutes } from "./server/rest";
import { registerControlRouters } from "./server/trpc";
import { autoTurnOffControlPointsWorker } from "./server/workers/auto-turn-off-control-points";

const controlPlugin: HumsPlugin = {
	name: "control",
	dependencies: [],
	optionalDependencies: ["sessions"],
	server: {
		async register(ctx) {
			if (ctx.trpc) {
				await registerControlRouters(ctx);
			}

			if (ctx.rest) {
				ctx.rest.register(controlRestRoutes);
			}
		},

		workers: [autoTurnOffControlPointsWorker],
	},

	kiosk: {
		modes: [{ id: "CONTROL", component: ControlKioskModeStub }],
	},
};

export default controlPlugin;
