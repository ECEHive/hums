# @ecehive/email

Modern, type-safe email service for HUMS with queue-based delivery, React TSX templates, and multi-provider support.

## Features

- 📧 **Multiple Providers**: Amazon SES, SMTP support
- ⚡ **In-Memory Queue**: Lightning-fast async processing
- 🔄 **Auto-Processing**: Background processor starts automatically
- ⚛️ **React Templates**: TSX-based email templates with full type safety
- 🎨 **Modern Design**: Responsive layouts with dark mode support
- 🔐 **Type-Safe**: Full TypeScript support with strict typing
- 🚀 **Non-Blocking**: All operations are async and don't block

## Quick Start

```typescript
import { queueEmail } from '@ecehive/email';

// Queue an email (non-blocking, returns immediately)
// Email is processed in the background automatically
const emailId = queueEmail({
  to: 'user@example.com',
  template: 'welcome',
  data: {
    userName: 'John Doe',
    username: 'jdoe3',
    email: 'user@example.com',
    createdVia: 'online',
  },
});

console.log(`Email queued: ${emailId}`);
```

## Available Templates

### Welcome Email (`welcome`)

Sent when a new user account is created.

```typescript
import { queueEmail, type WelcomeEmailProps } from '@ecehive/email';

await queueEmail({
  to: 'user@example.com',
  template: 'welcome',
  data: {
    userName: 'John Doe',
    username: 'jdoe3',
    email: 'user@example.com',
    createdVia: 'online', // or 'tap'
  },
});
```

### Session Auto-Logout Email (`session-auto-logout`)

Sent when a user's session is automatically ended due to inactivity.

```typescript
import { queueEmail, type SessionAutoLogoutEmailProps } from '@ecehive/email';

await queueEmail({
  to: 'user@example.com',
  template: 'session-auto-logout',
  data: {
    userName: 'John Doe',
    sessionType: 'regular', // or 'staffing'
    startedAt: new Date('2024-01-01T10:00:00Z'),
    endedAt: new Date('2024-01-01T22:00:00Z'),
    timeoutHours: 12,
  },
});
```

## Creating New Templates

1. Create a new TSX file in `src/templates/`:

```tsx
// src/templates/YourTemplate.tsx
import { EmailLayout } from "./EmailLayout";

export interface YourTemplateProps {
  userName: string;
  actionUrl: string;
}

export const YourTemplateSubject = "Your Email Subject";

export function YourTemplate({ userName, actionUrl }: YourTemplateProps) {
  return (
    <EmailLayout
      title="Email Title"
      preheader="Preview text shown in email clients"
    >
      <p>Hello <strong>{userName}</strong>,</p>
      
      <div className="info-box">
        <p><strong>📌 Important Info</strong></p>
        <p>Your message here...</p>
      </div>
      
      <div style={{ textAlign: "center", margin: "24px 0" }}>
        <a href={actionUrl} className="button">
          Take Action
        </a>
      </div>
    </EmailLayout>
  );
}
```

2. Register the template in `src/template-renderer.tsx`:

```tsx
import { YourTemplate, YourTemplateSubject, type YourTemplateProps } from "./templates/YourTemplate";

// Add to RenderEmailOptions type
export type RenderEmailOptions =
  | { template: "welcome"; data: WelcomeEmailProps }
  | { template: "session-auto-logout"; data: SessionAutoLogoutEmailProps }
  | { template: "your-template"; data: YourTemplateProps }; // Add this

// Add to switch statement in renderEmail()
case "your-template": {
  html = renderToStaticMarkup(<YourTemplate {...options.data} />);
  subject = YourTemplateSubject;
  break;
}
```

3. Export types from `src/index.ts`:

```tsx
export type { YourTemplateProps } from "./templates/YourTemplate";
```

## Available Styles

The `EmailLayout` component provides these pre-styled classes:

### Boxes

```tsx
{/* Blue informational box */}
<div className="info-box">
  <p><strong>ℹ️ Information</strong></p>
  <p>Your message...</p>
</div>

{/* Yellow/orange warning box */}
<div className="warning-box">
  <p><strong>⚠️ Warning</strong></p>
  <p>Your warning...</p>
</div>

{/* Green success box */}
<div className="success-box">
  <p><strong>✓ Success</strong></p>
  <p>Your success message...</p>
</div>

{/* Red error/alert box */}
<div className="destructive-box">
  <p><strong>✗ Error</strong></p>
  <p>Your error message...</p>
</div>
```

### Buttons

```tsx
{/* Primary action button (bright yellow) */}
<a href="https://example.com" className="button">
  Click Here
</a>
```

### Typography

```tsx
<h1>Main Title</h1>
<h2>Section Title</h2>
<h3>Subsection Title</h3>
<p>Regular paragraph text</p>
<strong>Bold text</strong>
```

## API Reference

### `queueEmail(params: QueueEmailParams)`

Queue a single email for immediate background delivery.

**Parameters:**
- `to` (string): Recipient email address
- `template` (string): Template name ('welcome', 'session-auto-logout', etc.)
- `data` (object): Template-specific data (type-safe based on template)

**Returns:** `string` - Unique email ID for tracking

**Note:** This function is synchronous and non-blocking. The email is processed in the background.

### `queueEmails(emails: QueueEmailParams[])`

Queue multiple emails at once.

**Parameters:**
- `emails` (array): Array of email parameters

**Returns:** `string[]` - Array of email IDs

### `getQueueStatus()`

Get current status of the email queue.

**Returns:** Object with:
- `pending` (number): Number of emails waiting to be sent
- `processing` (boolean): Whether processor is currently running
- `oldestEmail` (Date | undefined): Timestamp of oldest queued email

### `clearQueue()`

Clear all pending emails from the queue. Use with caution.

**Returns:** `void`

### `renderEmail(options: RenderEmailOptions)`

Render an email template to HTML (used internally by worker).

**Parameters:**
- `template` (string): Template name
- `data` (object): Template data

**Returns:** `Promise<RenderedEmail>` - Object with `html` and `subject` properties

### `getEmailProvider()`

Get the configured email provider instance (SES, SMTP, or NONE).

**Returns:** `EmailProvider` - Provider instance

## Configuration

See [docs/EMAIL_SYSTEM.md](../../docs/EMAIL_SYSTEM.md) for full configuration documentation.

### Environment Variables

```bash
# Provider selection
EMAIL_PROVIDER=SMTP  # or SES, or NONE

# From address
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME=HUMS

# SMTP Configuration
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_USER=your_email@gmail.com
EMAIL_SMTP_PASSWORD=your_app_password

# SES Configuration
EMAIL_SES_REGION=us-east-1
EMAIL_SES_ACCESS_KEY_ID=your_key
EMAIL_SES_SECRET_ACCESS_KEY=your_secret

# NONE Configuration (no additional config needed)
# EMAIL_PROVIDER=NONE  # Logs emails without sending
```

## Testing

### Test Scripts

```bash
# Test welcome email
bun scripts/test-welcome-email.ts user@example.com online

# Test session auto-logout email
bun scripts/test-email.ts user@example.com

# Check email queue health
bun scripts/check-email-queue.ts
```

### Local Development

Use [Mailpit](https://github.com/axllent/mailpit) for local email testing:

```bash
# Start Mailpit
docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit

# Configure environment
EMAIL_PROVIDER=SMTP
EMAIL_SMTP_HOST=localhost
EMAIL_SMTP_PORT=1025
EMAIL_SMTP_SECURE=false
```

View emails at http://localhost:8025

## Architecture

```
Application (queueEmail)
    ↓ (non-blocking)
In-Memory Queue
    ↓ (setTimeout)
Background Processor
    ↓
renderEmail() → TSX Template
    ↓
EmailProvider (SES/SMTP/NONE)
    ↓
Recipient (or Console for NONE)
```

### How It Works

1. **Queueing**: `queueEmail()` adds email to in-memory array and returns immediately
2. **Scheduling**: Processor is scheduled with `setTimeout(0)` for next tick
3. **Processing**: Single processor handles all emails sequentially
4. **Retry**: Failed emails retry up to 3 times
5. **Logging**: All activity is logged to console

## Best Practices

1. **Always queue emails** - Never send synchronously
2. **Use type-safe templates** - Leverage TypeScript for template props
3. **Test thoroughly** - Use test scripts before deploying
4. **Monitor the queue** - Check queue health regularly
5. **Keep templates simple** - Email clients have limited CSS support
6. **Use semantic HTML** - Better accessibility and deliverability

## Troubleshooting

### Emails not sending

1. Check environment variables
2. Verify email provider credentials
3. Check application console for errors
4. Run `bun scripts/check-email-queue.ts` to see queue status
5. Check if emails are stuck (look for retries in logs)

### Template errors

1. Ensure all required props are provided
2. Check TypeScript compilation errors
3. Test template with test scripts
4. Verify template is registered in `template-renderer.tsx`

### Queue issues

Check status programmatically:

```typescript
import { getQueueStatus } from '@ecehive/email';

const status = getQueueStatus();
console.log(`Pending: ${status.pending}`);
console.log(`Processing: ${status.processing}`);
```

**Note:** Queue is cleared on application restart. Emails in queue during restart will be lost.

## Related Documentation

- [EMAIL_SYSTEM.md](../../docs/EMAIL_SYSTEM.md) - Complete email system documentation
- [EMAIL_IMPLEMENTATION.md](../../docs/EMAIL_IMPLEMENTATION.md) - Implementation details
- [EMAIL_QUICK_REFERENCE.md](../../docs/EMAIL_QUICK_REFERENCE.md) - Quick reference guide

## License

MIT
