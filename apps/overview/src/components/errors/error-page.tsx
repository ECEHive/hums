import { AlertCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface ErrorPageProps {
	error?: Error;
}

export function ErrorPage({ error }: ErrorPageProps) {
	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
						<AlertCircle className="h-6 w-6 text-destructive" />
					</div>
					<CardTitle>Something went wrong</CardTitle>
					<CardDescription>
						An unexpected error occurred. Please try again later.
					</CardDescription>
				</CardHeader>
				{error && (
					<CardContent>
						<div className="rounded-md bg-muted p-3">
							<code className="text-sm text-muted-foreground break-all">
								{error.message}
							</code>
						</div>
					</CardContent>
				)}
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
