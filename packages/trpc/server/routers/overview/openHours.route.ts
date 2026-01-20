import { getOpenHours, type OpenHoursResponse } from "@ecehive/features";
import z from "zod";
import type { Context } from "../../context";

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
