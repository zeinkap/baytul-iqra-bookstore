/** Where a customer book request stands, set by the admin in Admin → Requests. */
export const FEEDBACK_STATUSES = ['new', 'in-progress', 'fulfilled'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
