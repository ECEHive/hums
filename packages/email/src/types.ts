export interface EmailProvider {
	sendEmail(params: SendEmailParams): Promise<void>;
}

export interface SendEmailParams {
	to: string | string[];
	subject: string;
	html: string;
	text?: string;
	from?: {
		name: string;
		address: string;
	};
}
