import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useConfig } from "@/hooks/useConfig";

export const Route = createFileRoute("/login")({ component: Login });

type AuthProvider = "CAS" | "CAS_PROXIED";

const resolveAuthProvider = (value?: string): AuthProvider => {
	if (value === "CAS_PROXIED") return "CAS_PROXIED";
	return "CAS";
};

const sanitizeRedirect = (target: string | null) => {
	const fallback = "/app";
	const trimmed = (target ?? "").trim();
	if (!trimmed) return fallback;

	// Only allow same-origin or relative redirects
	if (trimmed.startsWith("/")) {
		return trimmed;
	}

	if (typeof window !== "undefined") {
		try {
			const url = new URL(trimmed, window.location.origin);
			if (url.origin === window.location.origin) {
				return `${url.pathname}${url.search}${url.hash}`;
			}
		} catch (error) {
			console.error("Invalid redirect provided", error);
		}
	}

	return fallback;
};

function Login() {
	const { setToken, status, token } = useAuth();
	const { data: config, isLoading: configLoading } = useConfig();
	const authProvider = resolveAuthProvider(config?.authProvider);

	// Track if we've already initiated a redirect to prevent loops
	const hasRedirected = useRef(false);

	// Parse URL parameters once on mount
	const { ticket, serviceFromUrl, redirectTo } = useMemo(() => {
		if (typeof window === "undefined") {
			return { ticket: "", serviceFromUrl: "", redirectTo: "/app" };
		}
		const params = new URLSearchParams(window.location.search);
		const ticketParam = params.get("ticket") ?? "";
		const serviceParam = params.get("service") ?? "";
		const redirectParam = params.get("redirect") ?? params.get("returnTo");
		return {
			ticket: ticketParam,
			serviceFromUrl: serviceParam,
			redirectTo: sanitizeRedirect(redirectParam),
		};
	}, []);

	// Build the service URL for CAS callback
	const service = useMemo(() => {
		if (serviceFromUrl) return serviceFromUrl;
		if (typeof window === "undefined") return "";
		const current = new URL(`${window.location.origin}/login`);
		current.searchParams.set("redirect", redirectTo);
		return current.toString();
	}, [serviceFromUrl, redirectTo]);

	// Perform redirect using window.location for a clean navigation
	const performRedirect = (destination: string) => {
		if (hasRedirected.current) return;
		hasRedirected.current = true;
		// Use replace to avoid adding to browser history
		window.location.replace(destination);
	};

	// If we're already logged in, go to the destination
	useEffect(() => {
		if (status === "authenticated") {
			performRedirect(redirectTo);
			return;
		}

		// If unauthenticated but we have a token, it must be invalid - clear it
		if (status === "unauthenticated" && token) {
			setToken(null);
		}
	}, [status, redirectTo, token, setToken]);

	const { data, isLoading, error } = useQuery({
		queryKey: ["login", ticket, service],
		queryFn: async () => {
			return await trpc.auth.login.query({ ticket, service });
		},
		enabled: Boolean(ticket && service),
		retry: false,
	});

	// Handle successful login - set token and redirect
	useEffect(() => {
		if (data?.token) {
			setToken(data.token);
			// Redirect immediately after setting token
			// The auth provider will verify the token on the next page
			performRedirect(redirectTo);
		}
	}, [data?.token, setToken, redirectTo]);

	// Start CAS login on demand
	const startCasLogin = () => {
		if (typeof window === "undefined") return;
		if (!service) return;
		if (!config) return;

		switch (authProvider) {
			case "CAS_PROXIED": {
				const proxyUrl = config.casProxyUrl;
				if (!proxyUrl) {
					console.error(
						"casProxyUrl must be configured for CAS_PROXIED login.",
					);
					return;
				}
				const casProxyLoginUrl = new URL(proxyUrl);
				casProxyLoginUrl.searchParams.set("service", service);
				window.location.href = casProxyLoginUrl.toString();
				break;
			}
			case "CAS": {
				const loginUrl = config.casLoginUrl;
				if (!loginUrl) {
					console.error("casLoginUrl must be configured for CAS login.");
					return;
				}
				const casLoginUrl = new URL(loginUrl);
				casLoginUrl.searchParams.set("service", service);
				window.location.href = casLoginUrl.toString();
				break;
			}
			default:
				console.error("Unsupported auth provider:", authProvider);
				return;
		}
	};

	return (
		<div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<div className="flex items-center gap-2 self-center font-medium">
					<Logo className="h-8" />
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
							{configLoading ? (
								<div className="flex flex-row items-center justify-center gap-2 text-muted-foreground">
									<Spinner />
									<div>Loading…</div>
								</div>
							) : ticket && service ? (
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
