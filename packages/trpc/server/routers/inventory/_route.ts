import {
	inventoryProtectedProcedure,
	permissionProtectedProcedure,
	protectedProcedure,
	publicProcedure,
	router,
} from "../../trpc";
import { createItemHandler, ZCreateItemSchema } from "./items/create.route";
import { deleteItemHandler, ZDeleteItemSchema } from "./items/delete.route";
import { getItemHandler, ZGetItemSchema } from "./items/get.route";
import {
	getBySkuItemHandler,
	ZGetBySkuItemSchema,
} from "./items/getBySku.route";
import { importCsvHandler, ZImportCsvSchema } from "./items/importCsv.route";
import { listItemsHandler, ZListItemsSchema } from "./items/list.route";
import { updateItemHandler, ZUpdateItemSchema } from "./items/update.route";
import { scanUserHandler, ZScanUserSchema } from "./scanUser.route";
import {
	createSnapshotHandler,
	ZCreateSnapshotSchema,
} from "./snapshots/createSnapshot.route";
import { checkInHandler, ZCheckInSchema } from "./transactions/checkIn.route";
import {
	checkOutHandler,
	ZCheckOutSchema,
} from "./transactions/checkOut.route";
import {
	checkUserBalanceHandler,
	ZCheckUserBalanceSchema,
} from "./transactions/checkUserBalance.route";
import {
	getMyNetBalanceHandler,
	ZGetMyNetBalanceSchema,
} from "./transactions/getMyNetBalance.route";
import {
	getNetBalanceHandler,
	ZGetNetBalanceSchema,
} from "./transactions/getNetBalance.route";
import {
	listHandler as listTransactionsHandler,
	ZListSchema as ZListTransactionsSchema,
} from "./transactions/list.route";
import { listMyHandler, ZListMySchema } from "./transactions/listMy.route";
import {
	verifyApproverHandler,
	ZVerifyApproverSchema,
} from "./verifyApprover.route";

export const inventoryRouter = router({
	// User Scanning (for inventory kiosks)
	scanUser: inventoryProtectedProcedure
		.input(ZScanUserSchema)
		.mutation(scanUserHandler),

	// Approval verification (for restricted item checkout/checkin)
	verifyApprover: inventoryProtectedProcedure
		.input(ZVerifyApproverSchema)
		.mutation(verifyApproverHandler),

	// Item Management
	items: router({
		list: publicProcedure.input(ZListItemsSchema).query(listItemsHandler),
		get: publicProcedure.input(ZGetItemSchema).query(getItemHandler),
		getBySku: publicProcedure
			.input(ZGetBySkuItemSchema)
			.query(getBySkuItemHandler),
		create: permissionProtectedProcedure("inventory.items.create")
			.input(ZCreateItemSchema)
			.mutation(createItemHandler),
		importCsv: permissionProtectedProcedure("inventory.items.create")
			.input(ZImportCsvSchema)
			.mutation(importCsvHandler),
		update: permissionProtectedProcedure("inventory.items.update")
			.input(ZUpdateItemSchema)
			.mutation(updateItemHandler),
		delete: permissionProtectedProcedure("inventory.items.delete")
			.input(ZDeleteItemSchema)
			.mutation(deleteItemHandler),
	}),

	// Transactions
	transactions: router({
		checkIn: inventoryProtectedProcedure
			.input(ZCheckInSchema)
			.mutation(checkInHandler),
		checkOut: inventoryProtectedProcedure
			.input(ZCheckOutSchema)
			.mutation(checkOutHandler),
		checkUserBalance: inventoryProtectedProcedure
			.input(ZCheckUserBalanceSchema)
			.query(checkUserBalanceHandler),
		list: permissionProtectedProcedure("inventory.transactions.list")
			.input(ZListTransactionsSchema)
			.query(listTransactionsHandler),
		listMy: protectedProcedure.input(ZListMySchema).query(listMyHandler),
		getNetBalance: permissionProtectedProcedure("inventory.transactions.list")
			.input(ZGetNetBalanceSchema)
			.query(getNetBalanceHandler),
		getMyNetBalance: protectedProcedure
			.input(ZGetMyNetBalanceSchema)
			.query(getMyNetBalanceHandler),
	}),

	// Snapshots
	snapshots: router({
		create: permissionProtectedProcedure("inventory.snapshots.create")
			.input(ZCreateSnapshotSchema)
			.mutation(createSnapshotHandler),
	}),
});
