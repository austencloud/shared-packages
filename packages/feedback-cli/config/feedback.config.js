/**
 * Feedback System Configuration
 *
 * Deployment-specific values only. All shared constants (thresholds, transitions,
 * WIP limits, swim lanes, journal types, etc.) come from @austencloud/feedback-types.
 *
 * Usage:
 *   import config from '../config/feedback.config.js';
 *   const { ADMIN_USER_ID, MESSAGE_TEMPLATES } = config;
 */

import {
  STALE_THRESHOLDS,
  AGENT_SESSION_CONFIG,
  EMERGENCY_CONFIG,
  VALID_TRANSITIONS,
  JOURNAL_TYPES,
  WIP_LIMITS,
  SWIM_LANE_CONFIG,
  SWIM_LANE_ORDER,
  FEEDBACK_STATUSES,
  FEEDBACK_PRIORITIES,
  FEEDBACK_TYPES,
  ARCHIVE_REASONS,
  PRIORITY_ORDER,
} from '@austencloud/feedback-types';

// Re-export shared constants so consumers can `import { X } from './feedback.config.js'`
export {
  STALE_THRESHOLDS,
  AGENT_SESSION_CONFIG,
  EMERGENCY_CONFIG,
  VALID_TRANSITIONS,
  JOURNAL_TYPES,
  WIP_LIMITS,
  SWIM_LANE_CONFIG,
  SWIM_LANE_ORDER,
  FEEDBACK_STATUSES,
  FEEDBACK_PRIORITIES,
  FEEDBACK_TYPES,
  ARCHIVE_REASONS,
  PRIORITY_ORDER,
};

// ── Deployment-specific configuration ───────────────────────────────

const env = process.env;

/**
 * Admin Configuration
 *
 * Set via environment variables:
 * - FEEDBACK_ADMIN_UID
 * - FEEDBACK_ADMIN_NAME
 * - FEEDBACK_ADMIN_EMAIL
 * - FEEDBACK_ADMIN_PHOTO
 */
export const ADMIN_USER_ID =
  env.FEEDBACK_ADMIN_UID || "YOUR_FIREBASE_AUTH_UID";

export const ADMIN_USER = {
  userId: ADMIN_USER_ID,
  displayName: env.FEEDBACK_ADMIN_NAME || "Admin User",
  email: env.FEEDBACK_ADMIN_EMAIL || "admin@example.com",
  photoURL: env.FEEDBACK_ADMIN_PHOTO || null,
};

// Legacy alias for backward compatibility
export const STALE_CLAIM_MS = STALE_THRESHOLDS.ACTIVITY_TIMEOUT_MS;

/**
 * Project Configuration
 */
export const PROJECT_NAME = env.PROJECT_NAME || "the project";

/**
 * Message Templates
 */
export const MESSAGE_TEMPLATES = {
  completed: (notes) =>
    notes
      ? `Your feedback has been addressed: ${notes}`
      : "Your feedback has been addressed and is ready for the next release!",

  released: (version) =>
    `Your feedback was included in version ${version}! Thank you for helping improve ${PROJECT_NAME}.`,

  archived: (notes) =>
    notes
      ? `Your feedback has been resolved: ${notes}`
      : "Your feedback has been resolved. Thank you for your input!",
};

/**
 * Notification Types
 */
export const NOTIFICATION_TYPES = {
  FEEDBACK_RESOLVED: "feedback-resolved",
  FEEDBACK_RELEASED: "feedback-released",
  FEEDBACK_COMMENTED: "feedback-commented",
};

// Default export for convenience
export default {
  ADMIN_USER_ID,
  ADMIN_USER,
  STALE_CLAIM_MS,
  STALE_THRESHOLDS,
  AGENT_SESSION_CONFIG,
  EMERGENCY_CONFIG,
  VALID_TRANSITIONS,
  JOURNAL_TYPES,
  PRIORITY_ORDER,
  WIP_LIMITS,
  SWIM_LANE_CONFIG,
  SWIM_LANE_ORDER,
  FEEDBACK_STATUSES,
  FEEDBACK_PRIORITIES,
  FEEDBACK_TYPES,
  ARCHIVE_REASONS,
  MESSAGE_TEMPLATES,
  NOTIFICATION_TYPES,
};
