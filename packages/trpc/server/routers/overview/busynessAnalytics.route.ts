import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { Context } from "../../context";

export const ZBusynessAnalyticsSchema = z.object({
	dayOfWeek: z.number().min(0).max(6).optional(), // 0 = Sunday, 6 = Saturday
	weeksBack: z.number().min(1).max(12).optional().default(2), // How many weeks of historical data
});

export type TBusynessAnalyticsSchema = z.infer<typeof ZBusynessAnalyticsSchema>;

export type TBusynessAnalyticsOptions = {
	ctx: Context;
	input: TBusynessAnalyticsSchema;
};

interface HourlyData {
	hour: number;
	averageCount: number;
	maxCount: number;
}

interface DayAnalytics {
	dayOfWeek: number;
	dayName: string;
	hourlyData: HourlyData[];
}

export async function busynessAnalyticsHandler(
	options: TBusynessAnalyticsOptions,
) {
	const { dayOfWeek, weeksBack } = options.input;
	const now = new Date();

	// Calculate date range for historical data (last N weeks)
	const startDate = new Date(now);
	startDate.setDate(startDate.getDate() - weeksBack * 7);
	startDate.setHours(0, 0, 0, 0);

	// Get all sessions in the date range that started before now
	const sessions = await prisma.session.findMany({
		where: {
			startedAt: {
				gte: startDate,
				lte: now, // Only include sessions that have started
			},
		},
		select: {
			startedAt: true,
			endedAt: true,
			sessionType: true,
		},
	});

	// Day names for display
	const dayNames = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	];

	// Initialize data structure for all days or specific day
	const daysToProcess =
		dayOfWeek !== undefined ? [dayOfWeek] : [0, 1, 2, 3, 4, 5, 6];

	const analytics: DayAnalytics[] = daysToProcess.map((dow) => {
		// For each hour of the day, calculate how many sessions were active
		const hourlyData: HourlyData[] = [];

		for (let hour = 0; hour < 24; hour++) {
			const countsPerWeek: number[] = [];

			// Go through each week in our date range, working backwards from today
			for (let weekOffset = 0; weekOffset < weeksBack; weekOffset++) {
				// Start from today and go back week by week
				const targetDate = new Date(
					now.getFullYear(),
					now.getMonth(),
					now.getDate(),
				);

				// Go back to the start of the week range we're looking at
				targetDate.setDate(targetDate.getDate() - weekOffset * 7);

				// Adjust to the target day of week within this week
				const currentDow = targetDate.getDay();
				const daysToAdjust = dow - currentDow;
				targetDate.setDate(targetDate.getDate() + daysToAdjust);

				// Skip if this date is in the future or before our start date
				if (targetDate > now || targetDate < startDate) continue;

				// Set the hour we're interested in (use :30 to get mid-hour count)
				targetDate.setHours(hour, 30, 0, 0);

				// Count sessions active at this time
				const count = sessions.filter((session) => {
					const sessionStart = new Date(session.startedAt);
					const sessionEnd = session.endedAt ? new Date(session.endedAt) : now;
					return sessionStart <= targetDate && sessionEnd > targetDate;
				}).length;

				countsPerWeek.push(count);
			}

			// Calculate average and max for this hour
			const avg =
				countsPerWeek.length > 0
					? countsPerWeek.reduce((a, b) => a + b, 0) / countsPerWeek.length
					: 0;
			const max = countsPerWeek.length > 0 ? Math.max(...countsPerWeek) : 0;

			hourlyData.push({
				hour,
				averageCount: Math.round(avg * 10) / 10,
				maxCount: max,
			});
		}

		return {
			dayOfWeek: dow,
			dayName: dayNames[dow],
			hourlyData,
		};
	});

	// Calculate current busyness
	const currentDow = now.getDay();
	const currentHour = now.getHours();
	const currentCount = await prisma.session.count({
		where: { endedAt: null },
	});

	// Find typical busyness for current time
	const todayAnalytics = analytics.find((a) => a.dayOfWeek === currentDow);
	const currentHourTypical = todayAnalytics?.hourlyData.find(
		(h) => h.hour === currentHour,
	);

	let busynessComparison: "quieter" | "typical" | "busier" = "typical";
	if (currentHourTypical && currentHourTypical.averageCount > 0) {
		const ratio = currentCount / currentHourTypical.averageCount;
		if (ratio < 0.7) busynessComparison = "quieter";
		else if (ratio > 1.3) busynessComparison = "busier";
	}

	return {
		analytics,
		current: {
			count: currentCount,
			dayOfWeek: currentDow,
			hour: currentHour,
			typicalCount: currentHourTypical?.averageCount ?? 0,
			comparison: busynessComparison,
		},
	};
}
