import { Component, type ErrorInfo, type ReactNode } from "react";
import { KioskCard } from "@/components/kiosk-ui";
import { Button } from "@/components/ui/button";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
	errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null, errorInfo: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error, errorInfo: null };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("ErrorBoundary caught an error:", error, errorInfo);
		this.setState({ error, errorInfo });
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null, errorInfo: null });
		window.location.reload();
	};

	render() {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen w-full flex items-center justify-center bg-background p-8">
					<KioskCard className="p-12 max-w-2xl">
						<div className="flex flex-col items-center gap-8 text-center">
							<div className="text-6xl">⚠️</div>
							<div className="space-y-2">
								<h1 className="text-4xl font-bold text-destructive">
									Something went wrong
								</h1>
								<p className="text-xl text-muted-foreground">
									The kiosk encountered an unexpected error
								</p>
							</div>

							{this.state.error && (
								<div className="w-full p-4 bg-muted rounded-lg text-left">
									<p className="font-mono text-sm text-destructive break-all">
										{this.state.error.toString()}
									</p>
								</div>
							)}

							<Button
								size="lg"
								onClick={this.handleReset}
								className="text-xl px-12 py-6 h-auto"
							>
								Reload Kiosk
							</Button>
						</div>
					</KioskCard>
				</div>
			);
		}

		return this.props.children;
	}
}
