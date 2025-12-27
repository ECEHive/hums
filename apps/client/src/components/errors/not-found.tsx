import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const NotFound = () => (
	<div className="flex justify-center p-6">
		<Card className="max-w-lg w-full text-center">
			<h1 className="text-2xl font-semibold mb-2">Page not found</h1>
			<div className="flex items-center justify-center gap-3">
				<Button variant="ghost" onClick={() => window.history.back()}>
					Back
				</Button>
				<Link to="/app">
					<Button>Home</Button>
				</Link>
			</div>
		</Card>
	</div>
);
