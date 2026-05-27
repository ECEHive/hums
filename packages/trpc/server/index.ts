export { type Context, createContext } from "./context";
export { type AppRouter, appRouter } from "./router";
export {
	controlProtectedProcedure,
	dashboardProtectedProcedure,
	inventoryProtectedProcedure,
	kioskProtectedProcedure,
	permissionProtectedProcedure,
	protectedProcedure,
	publicProcedure,
	router,
	type TControlProtectedProcedureContext,
	type TDashboardProtectedProcedureContext,
	type TInventoryProtectedProcedureContext,
	type TKioskProtectedProcedureContext,
	type TPermissionProtectedProcedureContext,
	type TProtectedProcedureContext,
} from "./trpc";
