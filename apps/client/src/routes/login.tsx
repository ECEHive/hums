import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
	const { setToken, status, token } = useAuth();
	const router = useRouter();
	const params = useMemo(() => {
		if (typeof window === "undefined") return new URLSearchParams("");
		return new URLSearchParams(window.location.search);
	}, []);

	const ticket = params.get("ticket") ?? "";
	const service = params.get("service") ?? "";
	const returnTo = params.get("returnTo") ?? "/app";

	// If we're already logged in, go to the app
	useEffect(() => {
		if (status === "authenticated") {
			void router.navigate({ to: returnTo });
			return;
		}

		// If unauthenticated but we have a token, it must be invalid
		if (status === "unauthenticated" && token) {
			setToken(null);
		}
	}, [status, router, returnTo, token, setToken]);

	const { data, isLoading, error } = useQuery({
		queryKey: ["login", ticket, service],
		queryFn: async () => {
			return await trpc.auth.login.query({ ticket, service });
		},
		enabled: Boolean(ticket && service),
		retry: false,
	});

	useEffect(() => {
		if (data?.token) {
			setToken(data.token);
			void router.navigate({ to: returnTo });
		}
	}, [data?.token, setToken, router, returnTo]);

	// Start CAS login on demand
	const startCasLogin = () => {
		if (typeof window === "undefined") return;
		const current = new URL(window.location.href);

		// Remove old params we don't need to propagate
		current.searchParams.delete("ticket");
		current.searchParams.delete("service");
		if (!current.searchParams.get("returnTo"))
			current.searchParams.set("returnTo", returnTo);
		const redirect = encodeURIComponent(current.toString());
		const casUrl = `${import.meta.env.VITE_CAS_PROXY_URL}?redirect=${redirect}`;
		window.location.href = casUrl;
	};

	return (
		<div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<div className="flex items-center gap-2 self-center font-medium">
					<Logo className="h-16" />
				</div>
				<div className="flex flex-col gap-6">
					<Card>
						<CardHeader className="text-center">
							<CardTitle className="text-xl">Welcome back</CardTitle>
							<CardDescription>
								Sign in with your Georgia Tech Account
							</CardDescription>
						</CardHeader>
						<CardContent>
							{ticket && service ? (
								<div>
									{isLoading && (
										<div className="flex flex-row items-center justify-center gap-2 text-muted-foreground">
											<Spinner />
											<div>Validating your ticket…</div>
										</div>
									)}
									{error && (
										<div className="flex flex-col gap-4">
											<div className="font-medium rounded p-4 bg-destructive/10 text-destructive">
												An unexpected error occurred while logging you in.
											</div>
											<Button onClick={startCasLogin} className="w-full">
												Try Again
											</Button>
										</div>
									)}
								</div>
							) : (
								<div className="grid gap-6">
									<Button onClick={startCasLogin} className="w-full">
										Login with GT SSO
									</Button>
								</div>
							)}
						</CardContent>
					</Card>
					<div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
						Use of this application is for authorized users with Georgia Tech
						accounts only.
					</div>
					<div className="text-muted-foreground text-center text-xs text-balance">
						HUMS v{__APP_VERSION__}
					</div>
				</div>
			</div>
		</div>
	);
}
