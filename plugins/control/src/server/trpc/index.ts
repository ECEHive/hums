// Register all control tRPC routers
import type { PluginServerContext } from "@ecehive/core";
import { gatewaysRouter } from "./gateways";
import { logsRouter } from "./logs";
import { pointsRouter } from "./points";
import { providersRouter } from "./providers";

export async function registerControlRouters(ctx: PluginServerContext) {
	ctx.trpc.register("control.points", pointsRouter);
	ctx.trpc.register("control.gateways", gatewaysRouter);
	ctx.trpc.register("control.logs", logsRouter);
	ctx.trpc.register("control.providers", providersRouter);
}
