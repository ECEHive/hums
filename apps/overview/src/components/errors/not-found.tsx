import { Home, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function NotFound() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
						<SearchX className="h-6 w-6 text-muted-foreground" />
					</div>
					<CardTitle>Page Not Found</CardTitle>
					<CardDescription>
						The page you're looking for doesn't exist or has been moved.
					</CardDescription>
				</CardHeader>
				<CardFooter className="flex justify-center">
					<Button asChild>
						<a href="/overview">
							<Home className="mr-2 h-4 w-4" />
							Go to Overview
						</a>
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
