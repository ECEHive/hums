import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";

export function MissingPermissions() {
	return (
		<div className="flex items-center justify-center p-6">
			<div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-md">
                <h1 className="text-xl font-semibold">Access denied</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    You don't currently have the permissions required to view this
                    page.
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                    If you believe this is an error, contact a staff member or try
                    reloading to refresh your session.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Link to="/app">
                        <Button>Return Home</Button>
                    </Link>
                    <Button variant="outline" onClick={() => location.reload()}>
                        Retry
                    </Button>
                </div>
            </div>
		</div>
	);
}
