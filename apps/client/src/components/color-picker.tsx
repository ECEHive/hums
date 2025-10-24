import { XIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type HSL, hslToRgb, type RGB, rgbToHex, rgbToHsl } from "@/lib/color";
import { clamp } from "@/lib/math";
import { cn } from "@/lib/utils";

export function ColorPicker({
	initial = { r: 255, g: 230, b: 0 },
	className,
	onChange,
	optional = false,
	onClear,
	value,
}: {
	initial?: RGB;
	className?: string;
	onChange?: (rgb: RGB, hsl: HSL, hex: string) => void;
	optional?: boolean;
	onClear?: () => void;
	value?: string | null;
}) {
	const [rgb, setRgb] = React.useState<RGB>(initial);
	const [hsl, setHsl] = React.useState<HSL>(() => rgbToHsl(initial));
	const hasValue = value !== null && value !== undefined;

	// Use a ref to track if onChange callback should be called
	const onChangeRef = React.useRef(onChange);
	React.useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	const updateFromRgb = (next: Partial<RGB>) => {
		const nextRgb = {
			r: clamp(Math.round(next.r ?? rgb.r), 0, 255),
			g: clamp(Math.round(next.g ?? rgb.g), 0, 255),
			b: clamp(Math.round(next.b ?? rgb.b), 0, 255),
		};
		const nextHsl = rgbToHsl(nextRgb);
		setRgb(nextRgb);
		setHsl(nextHsl);
		// Call onChange after state update
		onChangeRef.current?.(nextRgb, nextHsl, rgbToHex(nextRgb));
	};

	const updateFromHsl = (next: Partial<HSL>) => {
		const nextHsl = {
			h: Math.round(next.h ?? hsl.h),
			s: Math.round(next.s ?? hsl.s),
			l: Math.round(next.l ?? hsl.l),
		};
		const nextRgb = hslToRgb(nextHsl);
		setHsl(nextHsl);
		setRgb(nextRgb);
		// Call onChange after state update
		onChangeRef.current?.(nextRgb, nextHsl, rgbToHex(nextRgb));
	};

	const hex = rgbToHex(rgb);

	return (
		<div className={cn("flex gap-2", className)}>
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						className={cn("flex-1 justify-start gap-2")}
					>
						{hasValue ? (
							<>
								<div
									className="h-6 w-6 rounded border"
									style={{ background: hex }}
									role="img"
									aria-label={`Color preview ${hex}`}
								/>
								<span className="font-mono text-sm">{hex.toUpperCase()}</span>
							</>
						) : (
							<>
								<div
									className="h-6 w-6 rounded border bg-muted"
									role="img"
									aria-label="No color selected"
								/>
								<span className="text-sm text-muted-foreground">
									No color selected
								</span>
							</>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-80" align="start">
					<div className="space-y-4">
						<div className="flex items-center gap-3">
							<div
								className="h-12 w-12 rounded border flex-shrink-0"
								style={{ background: hex }}
								role="img"
								aria-label={`Color preview ${hex}`}
							/>
							<div className="flex-1 min-w-0">
								<div className="text-sm font-medium">{hex.toUpperCase()}</div>
								<div className="text-xs text-muted-foreground truncate">
									rgb({rgb.r}, {rgb.g}, {rgb.b})
								</div>
								<div className="text-xs text-muted-foreground truncate">
									hsl({hsl.h}°, {hsl.s}%, {hsl.l}%)
								</div>
							</div>
						</div>

						<Tabs defaultValue="hsl" className="w-full">
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="hsl">HSL</TabsTrigger>
								<TabsTrigger value="rgb">RGB</TabsTrigger>
							</TabsList>

							<TabsContent value="hsl" className="space-y-3 mt-4">
								<div>
									<div className="flex justify-between text-xs mb-1.5">
										<span className="font-medium">Hue</span>
										<span className="font-mono text-muted-foreground">
											{hsl.h}°
										</span>
									</div>
									<Slider
										min={0}
										max={360}
										value={[hsl.h]}
										onValueChange={(v) => updateFromHsl({ h: v[0] })}
									/>
								</div>

								<div>
									<div className="flex justify-between text-xs mb-1.5">
										<span className="font-medium">Saturation</span>
										<span className="font-mono text-muted-foreground">
											{hsl.s}%
										</span>
									</div>
									<Slider
										min={0}
										max={100}
										value={[hsl.s]}
										onValueChange={(v) => updateFromHsl({ s: v[0] })}
									/>
								</div>

								<div>
									<div className="flex justify-between text-xs mb-1.5">
										<span className="font-medium">Lightness</span>
										<span className="font-mono text-muted-foreground">
											{hsl.l}%
										</span>
									</div>
									<Slider
										min={0}
										max={100}
										value={[hsl.l]}
										onValueChange={(v) => updateFromHsl({ l: v[0] })}
									/>
								</div>
							</TabsContent>

							<TabsContent value="rgb" className="space-y-3 mt-4">
								<div>
									<div className="flex justify-between text-xs mb-1.5">
										<span className="font-medium">Red</span>
										<span className="font-mono text-muted-foreground">
											{rgb.r}
										</span>
									</div>
									<Slider
										min={0}
										max={255}
										value={[rgb.r]}
										onValueChange={(v) => updateFromRgb({ r: v[0] })}
									/>
								</div>

								<div>
									<div className="flex justify-between text-xs mb-1.5">
										<span className="font-medium">Green</span>
										<span className="font-mono text-muted-foreground">
											{rgb.g}
										</span>
									</div>
									<Slider
										min={0}
										max={255}
										value={[rgb.g]}
										onValueChange={(v) => updateFromRgb({ g: v[0] })}
									/>
								</div>

								<div>
									<div className="flex justify-between text-xs mb-1.5">
										<span className="font-medium">Blue</span>
										<span className="font-mono text-muted-foreground">
											{rgb.b}
										</span>
									</div>
									<Slider
										min={0}
										max={255}
										value={[rgb.b]}
										onValueChange={(v) => updateFromRgb({ b: v[0] })}
									/>
								</div>
							</TabsContent>
						</Tabs>
					</div>
				</PopoverContent>
			</Popover>
			{optional && hasValue && (
				<Button
					type="button"
					variant="outline"
					size="icon"
					onClick={() => onClear?.()}
					title="Clear color"
				>
					<XIcon className="h-4 w-4" />
				</Button>
			)}
		</div>
	);
}

export default ColorPicker;
