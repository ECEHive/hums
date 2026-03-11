import {
	CatIcon,
	Flower2Icon,
	HatGlassesIcon,
	SproutIcon,
	SunMoonIcon,
	LogIn,
	LogOut,
	type LucideIcon,
	RefreshCw,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import type { TapEvent } from "@/types";

interface TapNotificationProps {
	event: TapEvent;
	isExiting: boolean;
}

type AnimatedIconProps = {
	icon: LucideIcon;
	colorClass: string;
	isExiting: boolean;
};

const iconTransition = { duration: 0.6, ease: "easeOut" } as const;
const pingLoopTransition = {
	duration: 1.2,
	repeat: Infinity,
	repeatDelay: 0.6,
	ease: "easeOut",
} as const;

const welcomeOverrides: Record<
	string,
	{ text: string; icon: LucideIcon | null; color: string | null}
> = {
	alemons8: {
		text: "Meow",
		icon: CatIcon,
		color: null,
	},
	banderson336: {
		text: Math.ceil((new Date(Date.UTC(2069, 8, 6)).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)).toString() + " Days left",
		icon: Flower2Icon,
		color: "text-yellow-500",
	},
	wcastro8: {
		text: "Goodbye",
		icon: null,
		color: null,
	},
	chartigan6: {
		text: "buh card found thx",
		icon: null,
		color: null,
	},
	jdudik6: {
		text: `${Math.floor(Math.random() * 100)} attendance issues`,
		icon: null,
		color: null,
	},
	awang409: {
		text: "You came back?!",
		icon: null,
		color: null,
	},
	etracy8: {
		text: "Photo Taken",
		icon: null,
		color: null,
	},
};

const switchToStaffOverrides: Record<
	string,
	{ text: string; icon: LucideIcon | null; color: string | null }
> = {
	banderson336: {
		text: "Welcome to the Bright-side",
		icon: SunMoonIcon,
		color: "text-yellow-500",
	},
};

const switchToRegularOverrides: Record<
	string,
	{ text: string; icon: LucideIcon | null; color: string | null }
> = {
	banderson336: {
		text: "Onto greener pastures",
		icon: SproutIcon,
		color: "text-green-500",
	},
};

const goodbyeOverrides: Record<
	string,
	{ text: string; icon: LucideIcon | null; color: string | null }
> = {
	alemons8: {
		text: "Good Boy",
		icon: null,
		color: null,
	},
	banderson336: {
		text: "Cya, Slime",
		icon: HatGlassesIcon,
		color: "text-orange-500",
	},
	wcastro8: {
		text: "Welcome",
		icon: null,
		color: null,
	},
	chartigan6: {
		text: "buh bye",
		icon: null,
		color: null,
	},
	jdudik6: {
		text: "SLACKER ALERT",
		icon: null,
		color: null,
	},
	awang409: {
		text: "Graduating?",
		icon: null,
		color: null,
	},
	etracy8: {
		text: "Photo Taken",
		icon: null,
		color: null,
	},
};

function AnimatedIcon({
	icon: Icon,
	colorClass,
	isExiting,
}: AnimatedIconProps) {
	return (
		<motion.div
			className="relative flex items-center justify-center"
			initial={{ scale: 0.85, opacity: 0 }}
			animate={{ scale: isExiting ? 0.85 : 1, opacity: isExiting ? 0 : 1 }}
			transition={iconTransition}
		>
			<Icon className={`w-36 h-36 ${colorClass}`} />
			<motion.div
				className="absolute inset-0"
				initial={{ scale: 0.9, opacity: 0.4 }}
				animate={
					isExiting
						? { scale: 0.9, opacity: 0 }
						: { scale: [0.9, 1.4], opacity: [0.4, 0] }
				}
				transition={
					isExiting ? { duration: 0.3, ease: "easeInOut" } : pingLoopTransition
				}
			>
				<Icon className={`w-36 h-36 ${colorClass} opacity-40`} />
			</motion.div>
		</motion.div>
	);
}

export function TapNotification({ event, isExiting }: TapNotificationProps) {
	const isTapIn = event.status === "tapped_in";
	const isSwitchToStaffing = event.status === "switched_to_staffing";
	const isSwitchToRegular = event.status === "switched_to_regular";

	const notificationContent = useMemo(() => {
		if (isTapIn) {
			return {
				icon: welcomeOverrides[event.user.username]?.icon || LogIn,
				title: welcomeOverrides[event.user.username]?.text || "Welcome",
				color: welcomeOverrides[event.user.username]?.color || "text-green-500",
				subtitle: event.user.name,
			};
		}

		if (isSwitchToStaffing) {
			return {
				icon: switchToStaffOverrides[event.user.username]?.icon || RefreshCw,
				title: switchToStaffOverrides[event.user.username]?.text || "Switched to Staffing",
				color: switchToStaffOverrides[event.user.username]?.color || "text-purple-500",
				subtitle: event.user.name,
			};
		}

		if (isSwitchToRegular) {
			return {
				icon: switchToRegularOverrides[event.user.username]?.icon || RefreshCw,
				title: switchToRegularOverrides[event.user.username]?.text || "Switched to Regular",
				color: switchToRegularOverrides[event.user.username]?.color || "text-orange-500",
				subtitle: event.user.name,
			};
		}

		return {
			icon: goodbyeOverrides[event.user.username]?.icon || LogOut,
			title: goodbyeOverrides[event.user.username]?.text || "Goodbye",
			color: goodbyeOverrides[event.user.username]?.color || "text-blue-500",
			subtitle: event.user.name,
		};
	}, [event.user.name, isTapIn, isSwitchToRegular, isSwitchToStaffing]);

	return (
			<motion.div
				className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md"
				initial={{ opacity: 0 }}
				animate={{ opacity: isExiting ? 0 : 1 }}
				transition={{ duration: 0.3 }}
			>
				<motion.div
					key={event.id}
					className="max-w-2xl mx-auto"
					initial={{ opacity: 0, scale: 0.95, y: 16 }}
					animate={{
						opacity: isExiting ? 0 : 1,
						scale: isExiting ? 0.95 : 1,
						y: isExiting ? 16 : 0,
					}}
					transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
				>
					<div className="flex flex-col items-center gap-8">
						<AnimatedIcon
							icon={notificationContent.icon}
							colorClass={notificationContent.color}
							isExiting={isExiting}
						/>
						<motion.div
							className="text-center gap-3 flex flex-col"
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: isExiting ? 0 : 1, y: isExiting ? 12 : 0 }}
							transition={{ duration: 0.5, delay: 0.2 }}
						>
							<h2 className={`text-6xl font-bold ${notificationContent.color}`}>
								{notificationContent.title}
							</h2>
							<p className={`text-4xl font-semibold`}>
								{notificationContent.subtitle}
							</p>
						</motion.div>
					</div>
				</motion.div>
			</motion.div>
		);
	}
