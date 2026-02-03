import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "@/lib/utils";

interface MarkdownProps {
	children: string;
	className?: string;
}

/**
 * Renders Markdown content safely with HTML sanitization.
 * Uses rehype-sanitize to filter out potentially malicious HTML.
 */
export function Markdown({ children, className }: MarkdownProps) {
	return (
		<div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
			<ReactMarkdown rehypePlugins={[rehypeSanitize]}>
				{children}
			</ReactMarkdown>
		</div>
	);
}
