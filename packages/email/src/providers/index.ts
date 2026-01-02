import { env } from "@ecehive/env";
import type { EmailProvider } from "../types";
import { NoneEmailProvider } from "./none";
import { SESEmailProvider } from "./ses";
import { SMTPEmailProvider } from "./smtp";

let providerInstance: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
	if (!providerInstance) {
		if (env.EMAIL_PROVIDER === "SES") {
			providerInstance = new SESEmailProvider();
		} else if (env.EMAIL_PROVIDER === "NONE") {
			providerInstance = new NoneEmailProvider();
		} else {
			providerInstance = new SMTPEmailProvider();
		}
	}
	return providerInstance;
}
