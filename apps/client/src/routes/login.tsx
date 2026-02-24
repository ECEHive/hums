import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/shared/logo";
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

	// Controls the entrance animation
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		// Trigger entrance animation after initial render
		const raf = requestAnimationFrame(() => setMounted(true));
		return () => cancelAnimationFrame(raf);
	}, []);

	// Mouse-reactive shimmer on the glass card — use native listeners so no
	// React event props land on a static div (satisfies a11y lint rules).
	const glassRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const card = glassRef.current;
		if (!card) return;

		const onMove = (e: MouseEvent) => {
			const rect = card.getBoundingClientRect();
			const x = ((e.clientX - rect.left) / rect.width) * 100;
			const y = ((e.clientY - rect.top) / rect.height) * 100;
			card.style.setProperty("--mouse-x", `${x}%`);
			card.style.setProperty("--mouse-y", `${y}%`);
			card.style.setProperty("--shimmer-opacity", "1");
		};
		const onLeave = () => {
			card.style.setProperty("--shimmer-opacity", "0");
		};

		card.addEventListener("mousemove", onMove);
		card.addEventListener("mouseleave", onLeave);
		return () => {
			card.removeEventListener("mousemove", onMove);
			card.removeEventListener("mouseleave", onLeave);
		};
	}, []);

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
		<div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden">
			{/* Background image — scaled up slightly so the blur doesn't reveal edges */}
			<div
				className="absolute inset-0 scale-110 bg-cover bg-center bg-no-repeat blur-[6px]"
				style={{ backgroundImage: "url('/background.jpg')" }}
			/>

			{/* Gradient overlay for depth and legibility */}
			<div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/50" />

			{/* Content wrapper — opacity only so no transform reaches the glass card.
			     Transforms on any ancestor disable backdrop-filter in all browsers. */}
			<div
				className={`relative z-10 flex w-full max-w-sm flex-col gap-6 p-6 transition-opacity duration-700 ease-out ${
					mounted ? "opacity-100" : "opacity-0"
				}`}
			>
				{/* Logo */}
				<div
					className={`flex items-center gap-2 self-center transition-all duration-700 delay-100 ease-out ${
						mounted ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
					}`}
				>
					<Logo className="h-10 drop-shadow-lg" variant="dark" />
				</div>

				{/* ── Glassy card ── */}
				{/* Only opacity is animated — transforms break backdrop-filter in most browsers */}
				<div
					ref={glassRef}
					className={`login-glass relative overflow-hidden rounded-3xl border border-white/25 p-8 shadow-2xl shadow-black/20 transition-opacity duration-700 delay-200 ease-out ${
						mounted ? "opacity-100" : "opacity-0"
					}`}
				>
					{/* Glass shimmer highlight along the top edge */}
					<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

					{/* Header */}
					<div className="mb-6 text-center">
						<h1 className="text-2xl font-semibold tracking-tight text-white drop-shadow-sm">
							Welcome back
						</h1>
						<p className="mt-1.5 text-sm text-white/60">
							Sign in with your Georgia Tech Account
						</p>
					</div>

					{/* Card body */}
					<div>
						{configLoading ? (
							<div className="flex flex-row items-center justify-center gap-2 text-white/60">
								<Spinner className="text-white/60" />
								<div>Loading…</div>
							</div>
						) : ticket && service ? (
							<div>
								{isLoading && (
									<div className="flex flex-row items-center justify-center gap-2 text-white/60">
										<Spinner className="text-white/60" />
										<div>Validating your ticket…</div>
									</div>
								)}
								{error && (
									<div className="flex flex-col gap-4">
										<div className="rounded-2xl border border-red-400/20 bg-red-500/15 p-4 text-sm font-medium text-white backdrop-blur-sm">
											An unexpected error occurred while logging you in.
										</div>
										<button
											type="button"
											onClick={startCasLogin}
											className="login-btn w-full cursor-pointer rounded-2xl border border-white/25 bg-white/15 px-6 py-3 font-medium text-white backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:bg-white/25 hover:shadow-lg hover:shadow-white/5 active:scale-[0.98]"
										>
											Try Again
										</button>
									</div>
								)}
							</div>
						) : (
							<div className="grid gap-6">
								<button
									type="button"
									onClick={startCasLogin}
									className="login-btn w-full cursor-pointer rounded-2xl border border-white/25 bg-white/15 px-6 py-3 font-medium text-white transition-all duration-300 hover:scale-[1.02] hover:bg-white/25 hover:shadow-lg hover:shadow-white/5 active:scale-[0.98]"
								>
									Login with GT SSO
								</button>
							</div>
						)}
					</div>
				</div>

				{/* Footer notices */}
				<div
					className={`text-center text-xs text-balance text-white/40 transition-all duration-700 delay-300 ease-out ${
						mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
					}`}
				>
					Use of this application is for authorized users with Georgia Tech
					accounts only.
				</div>
				<div
					className={`text-center text-xs text-balance text-white/30 transition-all duration-700 delay-[400ms] ease-out ${
						mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
					}`}
				>
					HUMS v{__APP_VERSION__}
				</div>
			</div>
		</div>
	);
}
