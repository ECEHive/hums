import { BugIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
	error: Error;
}

export function ErrorPage({ error }: ErrorPageProps) {
	return (
		<div className="flex flex-col space-y-4 p-4">
			<Card>
				<CardHeader>
					<CardTitle>Ahh! It's a bug!</CardTitle>
					<CardDescription>
						Sorry, something went wrong. The error has been reported
						automatically. Please try reloading the page.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Alert variant="destructive">
						<BugIcon />
						<AlertTitle>{error.name}</AlertTitle>
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				</CardContent>
				<CardFooter>
					<Button onClick={() => window.location.reload()}>Reload Page</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
