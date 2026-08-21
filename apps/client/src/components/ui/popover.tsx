import * as PopoverPrimitive from "@radix-ui/react-popover";
import type * as React from "react";
import { createContext, useContext, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type PopoverContextValue = {
	triggerElement: HTMLElement | null;
	setTriggerElement: (element: HTMLElement | null) => void;
};

const PopoverContext = createContext<PopoverContextValue | null>(null);

function Popover({
	...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
	const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

	return (
		<PopoverContext.Provider value={{ triggerElement, setTriggerElement }}>
			<PopoverPrimitive.Root data-slot="popover" {...props} />
		</PopoverContext.Provider>
	);
}

function PopoverTrigger({
	onPointerDownCapture,
	onFocusCapture,
	...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
	const context = useContext(PopoverContext);

	return (
		<PopoverPrimitive.Trigger
			data-slot="popover-trigger"
			onPointerDownCapture={(event) => {
				context?.setTriggerElement(event.currentTarget as HTMLElement);
				onPointerDownCapture?.(event);
			}}
			onFocusCapture={(event) => {
				context?.setTriggerElement(event.currentTarget as HTMLElement);
				onFocusCapture?.(event);
			}}
			{...props}
		/>
	);
}

function PopoverContent({
	className,
	align = "center",
	sideOffset = 4,
	container,
	...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
	container?: HTMLElement | null;
}) {
	const context = useContext(PopoverContext);
	const resolvedContainer = useMemo(() => {
		if (container !== undefined) {
			return container ?? undefined;
		}

		const triggerElement = context?.triggerElement;
		if (!triggerElement) {
			return undefined;
		}

		return (
			(triggerElement.closest(
				"[data-slot='dialog-content'], [data-slot='sheet-content']",
			) as HTMLElement | null) ?? undefined
		);
	}, [container, context?.triggerElement]);

	return (
		<PopoverPrimitive.Portal container={resolvedContainer}>
			<PopoverPrimitive.Content
				data-slot="popover-content"
				align={align}
				sideOffset={sideOffset}
				className={cn(
					"bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
					className,
				)}
				{...props}
			/>
		</PopoverPrimitive.Portal>
	);
}

function PopoverAnchor({
	...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
	return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
