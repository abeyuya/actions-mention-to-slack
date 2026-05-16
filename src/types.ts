import type { context } from "@actions/github";

export type WebhookPayload = typeof context.payload;
