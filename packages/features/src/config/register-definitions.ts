/**
 * Configuration Definition Registration
 *
 * This file controls the order in which configuration definitions are registered.
 * The order matters because it determines the display order on the configuration page.
 */

import { brandingConfig } from "./definitions/branding";
import { emailConfig } from "./definitions/email";
import { sessionConfig } from "./definitions/sessions";
import { slackConfig } from "./definitions/slack";
import { ConfigRegistry } from "./registry";

// Register in the desired order - this controls the display order
ConfigRegistry.register("sessions", sessionConfig);
ConfigRegistry.register("emails", emailConfig);
ConfigRegistry.register("slack", slackConfig);
ConfigRegistry.register("branding", brandingConfig);
