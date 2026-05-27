import { getOpenHours, type OpenHoursResponse } from "@ecehive/features";
import type { Context } from "@ecehive/trpc/server";
import z from "zod";

export const ZOpenHoursSchema = z.object({});

export type TOpenHoursSchema = z.infer<typeof ZOpenHoursSchema>;

export type TOpenHoursOptions = {
	ctx: Context;
	input: TOpenHoursSchema;
};

/**
 * Public handler for open hours endpoint
 * Returns aggregated open hours for all visible periods
 */
export async function openHoursHandler(
	_options: TOpenHoursOptions,
): Promise<OpenHoursResponse> {
	return getOpenHours();
}
