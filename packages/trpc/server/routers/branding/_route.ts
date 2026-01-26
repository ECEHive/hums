import { publicProcedure, router } from "../../trpc";
import { getAllHandler } from "./get-all.route";
import { getAssetHandler } from "./get-asset.route";
import { ZGetAssetSchema } from "./schemas";

/**
 * Branding Router
 *
 * Note: Setting and resetting branding assets is now done through the
 * standard config system (config.setValue, config.reset) since branding
 * logos are stored in the ConfigValue table with keys like "branding.logo-light".
 *
 * These routes provide read-only access to branding assets for display purposes.
 */
export const brandingRouter = router({
	// Public endpoint for fetching a specific logo
	getAsset: publicProcedure.input(ZGetAssetSchema).query(getAssetHandler),

	// Public endpoint for getting all branding info
	getAll: publicProcedure.query(getAllHandler),
});
