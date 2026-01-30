import type { ReactNode } from "react";

interface EmailLayoutProps {
	title: string;
	preheader: string;
	children: ReactNode;
	logos?: {
		light: string;
		dark: string;
	};
}

export function EmailLayout({
	title,
	preheader,
	children,
	logos,
}: EmailLayoutProps) {
	const currentYear = new Date().getFullYear();

	// Use provided logos or empty strings as fallback
	const logoLight = logos?.light ?? "";
	const logoDark = logos?.dark ?? "";

	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width" />
				<meta httpEquiv="X-UA-Compatible" content="IE=edge" />
				<meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
				<meta name="color-scheme" content="light dark" />
				<meta name="supported-color-schemes" content="light dark" />
				<title>{title}</title>
				<style type="text/css">{`
					:root {
						color-scheme: light dark;
						supported-color-schemes: light dark;
					}
					
					html {
						box-sizing: border-box;
						font-size: 14px;
						margin: 0;
					}
					
					table {
						border-spacing: 0;
					}
					
					td {
						vertical-align: top;
						margin: 0;
					}
					
					img {
						max-width: 100%;
					}
					
					h1, h2, h3, h4, h5 {
						font-weight: 600;
						line-height: 1.4;
						color: #1a1a1a !important;
					}
					
					/* Link colors - consistent across modes */
					a:not(.colorOverride),
					a:visited:not(.colorOverride),
					a[href]:not(.colorOverride),
					a[href]:visited:not(.colorOverride) {
						color: #3276dc !important;
					}
					
					/* Light mode (default) */
					body {
						-webkit-font-smoothing: antialiased;
						-webkit-text-size-adjust: none;
						width: 100%;
						height: 100%;
						line-height: 1.6em;
						color: #333333 !important;
						background-color: #fafafa !important;
						font-weight: 400;
						margin: 0;
						padding: 0;
					}
					
					.container {
						margin: 0 auto;
						clear: both;
						font-size: 16px;
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
						padding: 20px;
						width: 720px;
					}
					
					.content {
						background-color: #ffffff !important;
						font-size: 16px;
						line-height: 24px;
						word-wrap: break-word;
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
						padding: 40px;
						border-radius: 6px;
						color: #333333 !important;
					}
					
					.footer {
						font-size: 12px;
						color: #888888 !important;
						margin: 0;
						vertical-align: baseline;
						padding: 20px 40px;
					}
					
					.footer p,
					.footer strong,
					.footer a {
						color: #888888 !important;
					}
					
					.footer a[href] {
						color: #3276dc !important;
					}
					
					/* Info boxes */
					.info-box {
						background-color: #f9fafb !important;
						border: 1px solid #e5e7eb !important;
						padding: 16px;
						margin: 20px 0;
						border-radius: 6px;
					}
					
					.info-box p {
						margin: 0;
						color: #1f2937 !important;
						line-height: 1.6em;
						font-size: 14px;
					}
					
					/* Warning boxes */
					.warning-box {
						background-color: #fef3c7 !important;
						border: 1px solid #fde68a !important;
						padding: 16px;
						margin: 20px 0;
						border-radius: 6px;
					}
					
					.warning-box p {
						margin: 0;
						color: #92400e !important;
						line-height: 1.6em;
						font-size: 14px;
					}
					
					/* Success boxes */
					.success-box {
						background-color: #d1fae5 !important;
						border: 1px solid #a7f3d0 !important;
						padding: 16px;
						margin: 20px 0;
						border-radius: 6px;
					}
					
					.success-box p {
						margin: 0;
						color: #065f46 !important;
						line-height: 1.6em;
						font-size: 14px;
					}
					
					/* Destructive boxes */
					.destructive-box {
						background-color: #fee2e2 !important;
						border: 1px solid #fecaca !important;
						padding: 16px;
						margin: 20px 0;
						border-radius: 6px;
					}
					
					.destructive-box p {
						margin: 0;
						color: #dc2626 !important;
						line-height: 1.6em;
						font-size: 14px;
					}
					
					/* Button */
					.button {
						display: inline-block;
						padding: 12px 24px;
						background-color: #ffe600 !important;
						color: #000000 !important;
						text-decoration: none !important;
						border-radius: 6px;
						font-weight: 600;
						margin: 16px 0;
						font-size: 16px;
						line-height: 1.5;
					}
					
					.button:hover {
						background-color: #f5dc00 !important;
					}
					
					/* Logo switching for dark mode */
					.logo-light {
						display: block !important;
						max-width: 100%;
						height: auto;
					}
					
					.logo-dark {
						display: none !important;
						max-width: 100%;
						height: auto;
					}
					
					/* Dark mode support */
					@media (prefers-color-scheme: dark) {
						body {
							background-color: #1a1a1a !important;
							color: #e5e5e5 !important;
						}
						
						.content {
							background-color: #2d2d2d !important;
							color: #e5e5e5 !important;
						}
						
						h1, h2, h3, h4, h5 {
							color: #f5f5f5 !important;
						}
						
						/* Switch logos in dark mode */
						.logo-light {
							display: none !important;
						}
						
						.logo-dark {
							display: block !important;
						}
						
						.footer {
							color: #a8a8a8 !important;
						}
						
						.footer p,
						.footer strong {
							color: #a8a8a8 !important;
						}
						
						.footer a[href] {
							color: #5b9eff !important;
						}
						
						/* Dark mode info boxes */
						.info-box {
							background-color: #374151 !important;
							border: 1px solid #4b5563 !important;
						}
						
						.info-box p {
							color: #e5e7eb !important;
						}
						
						/* Dark mode warning boxes */
						.warning-box {
							background-color: #78350f !important;
							border: 1px solid #92400e !important;
						}
						
						.warning-box p {
							color: #fef3c7 !important;
						}
						
						/* Dark mode success boxes */
						.success-box {
							background-color: #064e3b !important;
							border: 1px solid #065f46 !important;
						}
						
						.success-box p {
							color: #d1fae5 !important;
						}
						
						/* Dark mode destructive boxes */
						.destructive-box {
							background-color: #7f1d1d !important;
							border: 1px solid #991b1b !important;
						}
						
						.destructive-box p {
							color: #fecaca !important;
						}
						
						/* Dark mode links - brighter blue */
						a:not(.colorOverride),
						a:visited:not(.colorOverride),
						a[href]:not(.colorOverride),
						a[href]:visited:not(.colorOverride) {
							color: #5b9eff !important;
						}
						
						/* Button remains bright yellow for visibility */
						.button {
							background-color: #ffe600 !important;
							color: #000000 !important;
						}
						
						.button:hover {
							background-color: #f5dc00 !important;
						}
					}
					
					/* Mobile responsive */
					@media only screen and (max-width:640px) {
						body { 
							padding: 10px !important; 
						}
						.container { 
							padding: 10px !important; 
							width: 100% !important; 
						}
						.content { 
							padding: 20px !important; 
						}
						.footer { 
							padding: 10px !important; 
						}
					}
					
					/* Prevent Outlook from adding extra spacing */
					table {
						mso-table-lspace: 0pt;
						mso-table-rspace: 0pt;
					}
					
					/* Force Outlook to provide a "view in browser" link */
					#outlook a {
						padding: 0;
					}
				`}</style>
			</head>
			<body itemScope itemType="http://schema.org/EmailMessage">
				{/* Screen reader preheader */}
				<div
					style={{ display: "none", maxHeight: 0, overflow: "hidden" }}
					aria-hidden="true"
				>
					{preheader}
				</div>

				<table
					className="container"
					style={{
						borderSpacing: 0,
						margin: "0 auto",
						clear: "both",
						fontSize: "16px",
						fontFamily:
							'-apple-system,BlinkMacSystemFont,"Segoe UI","Roboto","Oxygen","Ubuntu","Cantarell","Fira Sans","Droid Sans","Helvetica Neue",sans-serif',
						padding: "20px",
						width: "720px",
					}}
				>
					<tbody>
						<tr>
							<td
								colSpan={2}
								className="content"
								style={{
									verticalAlign: "top",
									margin: 0,
									fontSize: "16px",
									lineHeight: "24px",
									wordWrap: "break-word",
									fontFamily:
										'-apple-system,BlinkMacSystemFont,"Segoe UI","Roboto","Oxygen","Ubuntu","Cantarell","Fira Sans","Droid Sans","Helvetica Neue",sans-serif',
									padding: "40px",
									borderRadius: "6px",
								}}
							>
								{/* Logo - Light mode */}
								<img
									src={logoLight}
									alt="HUMS Logo"
									width="206"
									height="44"
									className="logo-light"
									style={{ marginBottom: "20px" }}
								/>

								{/* Logo - Dark mode */}
								<img
									src={logoDark}
									alt="HUMS Logo"
									width="206"
									height="44"
									className="logo-dark"
									style={{ marginBottom: "20px" }}
								/>

								{/* Title */}
								<h1
									style={{
										fontWeight: 600,
										lineHeight: 1.4,
										margin: "0 0 20px 0",
										fontSize: "28px",
									}}
								>
									{title}
								</h1>

								{/* Email content */}
								{children}
							</td>
						</tr>
						<tr>
							<td
								colSpan={2}
								className="footer"
								style={{
									fontSize: "12px",
									margin: 0,
									verticalAlign: "baseline",
									padding: "20px 40px",
								}}
							>
								<p
									style={{ margin: "8px 0", fontSize: "12px", lineHeight: 1.5 }}
								>
									<strong style={{ fontWeight: 600 }}>HUMS</strong> - Hive User
									Management System
								</p>
								<p
									style={{ margin: "8px 0", fontSize: "12px", lineHeight: 1.5 }}
								>
									<strong style={{ fontWeight: 600 }}>
										The Hive Makerspace
									</strong>
									<br />
									School of Electrical and Computer Engineering
									<br />
									Georgia Institute of Technology
								</p>
								<p
									style={{ margin: "8px 0", fontSize: "12px", lineHeight: 1.5 }}
								>
									© {currentYear} The Hive Makerspace
								</p>
							</td>
						</tr>
					</tbody>
				</table>
			</body>
		</html>
	);
}
