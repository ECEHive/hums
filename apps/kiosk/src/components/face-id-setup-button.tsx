/**
 * Face ID Setup Button - Shown on the ready view to start Face ID enrollment
 */

import { Scan } from "lucide-react";
import { Button } from "./ui/button";

interface FaceIdSetupButtonProps {
	onClick: () => void;
	disabled?: boolean;
}

export function FaceIdSetupButton({
	onClick,
	disabled,
}: FaceIdSetupButtonProps) {
	return (
		<Button
			variant="outline"
			size="lg"
			onClick={onClick}
			disabled={disabled}
			className="flex items-center gap-2 bg-background/50 hover:bg-background/80"
		>
			<Scan className="w-5 h-5" />
			<span>Set Up Face ID</span>
		</Button>
	);
}

export { FaceIdSetupButton as default };
