/**
 * ============================================================
 * SECURITY UTILITIES - AUConnect
 * ============================================================
 * OWASP-aligned security layer for client-side hardening.
 * Covers: Input sanitization, validation schemas, rate limiting,
 *         graceful 429 handling, and type-safe field allowlists.
 *
 * IMPORTANT: Client-side security is a DEFENSE-IN-DEPTH layer.
 * Real enforcement MUST happen server-side via Supabase RLS,
 * Edge Functions, and PostgREST configuration.
 * ============================================================
 */

import { toast } from 'sonner';

// ============================================================
// 1. INPUT SANITIZATION (XSS Prevention — OWASP A7:2017)
// ============================================================

/**
 * Strips HTML entities from user input to prevent XSS.
 * Use on all user-facing text before storing or rendering.
 */
export function sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize input for use in Supabase .ilike() / .or() filters.
 * Prevents SQL injection via PostgREST filter manipulation.
 * Removes characters that could break out of the filter context.
 */
export function sanitizeSearchQuery(query: string): string {
    if (!query || typeof query !== 'string') return '';
    return query
        .replace(/[%_\\(),.'"/;`]/g, '')   // Remove SQL wildcards & PostgREST operators
        .replace(/[^\w\s@.\-]/g, '')        // Allow only word chars, spaces, @, dots, hyphens
        .trim()
        .slice(0, 100); // Hard length limit
}

/**
 * Strips script tags and event handlers from any string.
 * Lighter than full sanitization — good for display-only text.
 */
export function stripDangerousHTML(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/on\w+\s*=\s*'[^']*'/gi, '')
        .replace(/javascript:/gi, '');
}

/**
 * Generic text sanitizer: trims, enforces max length, and strips dangerous chars.
 * Use for any free-text field before database insert.
 */
export function sanitizeField(input: string, maxLength: number = 2000): string {
    if (!input || typeof input !== 'string') return '';
    return stripDangerousHTML(input.trim()).slice(0, maxLength);
}

// ============================================================
// 2. INPUT VALIDATION (Schema-based — OWASP A1:2017)
// ============================================================

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/** Validates a username: 3-30 chars, alphanumeric + underscores only */
export function validateUsername(username: string): ValidationResult {
    if (!username || typeof username !== 'string') return { valid: false, error: 'Username is required' };
    const trimmed = username.trim();
    if (trimmed.length < 3) return { valid: false, error: 'Username must be at least 3 characters' };
    if (trimmed.length > 30) return { valid: false, error: 'Username must be 30 characters or fewer' };
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
    return { valid: true };
}

/** Validates a full name: 2-60 chars, letters and spaces */
export function validateFullName(name: string): ValidationResult {
    if (!name || typeof name !== 'string') return { valid: false, error: 'Name is required' };
    const trimmed = name.trim();
    if (trimmed.length < 2) return { valid: false, error: 'Name must be at least 2 characters' };
    if (trimmed.length > 60) return { valid: false, error: 'Name must be 60 characters or fewer' };
    return { valid: true };
}

/** Validates bio: max 300 chars */
export function validateBio(bio: string): ValidationResult {
    if (!bio || typeof bio !== 'string') return { valid: true }; // Bio is optional
    if (bio.trim().length > 300) return { valid: false, error: 'Bio must be 300 characters or fewer' };
    return { valid: true };
}

/** Validates post content: max 2000 chars */
export function validatePostContent(content: string): ValidationResult {
    if (!content || typeof content !== 'string') return { valid: true }; // Can be image-only
    if (content.trim().length > 2000) return { valid: false, error: 'Post content must be 2000 characters or fewer' };
    return { valid: true };
}

/** Validates comment content: 1-500 chars */
export function validateComment(content: string): ValidationResult {
    if (!content || typeof content !== 'string') return { valid: false, error: 'Comment cannot be empty' };
    const trimmed = content.trim();
    if (trimmed.length < 1) return { valid: false, error: 'Comment cannot be empty' };
    if (trimmed.length > 500) return { valid: false, error: 'Comment must be 500 characters or fewer' };
    return { valid: true };
}

/** Validates a message: 1-2000 chars */
export function validateMessage(content: string): ValidationResult {
    if (!content || typeof content !== 'string') return { valid: false, error: 'Message cannot be empty' };
    const trimmed = content.trim();
    if (trimmed.length < 1) return { valid: false, error: 'Message cannot be empty' };
    if (trimmed.length > 2000) return { valid: false, error: 'Message must be 2000 characters or fewer' };
    return { valid: true };
}

/** Validates email format */
export function validateEmail(email: string): ValidationResult {
    if (!email || typeof email !== 'string') return { valid: false, error: 'Email is required' };
    const trimmed = email.trim().toLowerCase();
    if (trimmed.length > 254) return { valid: false, error: 'Email is too long' };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return { valid: false, error: 'Invalid email format' };
    return { valid: true };
}

/** Validates password: min 8 chars, max 128 */
export function validatePassword(password: string): ValidationResult {
    if (!password || typeof password !== 'string') return { valid: false, error: 'Password is required' };
    if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters' };
    if (password.length > 128) return { valid: false, error: 'Password is too long' };
    return { valid: true };
}

/** Validates a URL */
export function validateUrl(url: string): ValidationResult {
    if (!url || typeof url !== 'string') return { valid: true }; // URLs are often optional
    if (url.length > 2048) return { valid: false, error: 'URL is too long' };
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { valid: false, error: 'URL must use http or https' };
        }
        return { valid: true };
    } catch {
        return { valid: false, error: 'Invalid URL format' };
    }
}

/** Validates a UUID */
export function validateUUID(id: string): ValidationResult {
    if (!id || typeof id !== 'string') return { valid: false, error: 'ID is required' };
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) return { valid: false, error: 'Invalid ID format' };
    return { valid: true };
}

/** Validates a generic short text field: 1-{max} chars */
export function validateShortText(text: string, fieldName: string, max: number = 150): ValidationResult {
    if (!text || typeof text !== 'string') return { valid: false, error: `${fieldName} is required` };
    const trimmed = text.trim();
    if (trimmed.length < 1) return { valid: false, error: `${fieldName} cannot be empty` };
    if (trimmed.length > max) return { valid: false, error: `${fieldName} must be ${max} characters or fewer` };
    return { valid: true };
}

/** Validates a generic long text field: optional, max chars */
export function validateLongText(text: string, fieldName: string, max: number = 2000): ValidationResult {
    if (!text || typeof text !== 'string') return { valid: true }; // optional
    if (text.trim().length > max) return { valid: false, error: `${fieldName} must be ${max} characters or fewer` };
    return { valid: true };
}

/** Validates a price/number: must be positive, max 10 million */
export function validatePrice(price: number | string, fieldName: string = 'Price'): ValidationResult {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(num) || !isFinite(num)) return { valid: false, error: `${fieldName} must be a valid number` };
    if (num < 0) return { valid: false, error: `${fieldName} cannot be negative` };
    if (num > 10_000_000) return { valid: false, error: `${fieldName} exceeds maximum allowed` };
    return { valid: true };
}

/** Validates an integer within bounds */
export function validateInt(value: number | string, fieldName: string, min: number = 1, max: number = 1000): ValidationResult {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (isNaN(num) || !isFinite(num)) return { valid: false, error: `${fieldName} must be a valid number` };
    if (num < min) return { valid: false, error: `${fieldName} must be at least ${min}` };
    if (num > max) return { valid: false, error: `${fieldName} must be at most ${max}` };
    return { valid: true };
}

/**
 * Validates a profile update object.
 * Rejects unexpected fields and validates each known field.
 */
export function validateProfileUpdate(updates: Record<string, any>): ValidationResult {
    const allowedFields = new Set([
        'username', 'full_name', 'department', 'year', 'bio', 'bio_link',
        'avatar_url', 'banner_url', 'cover_url', 'skills', 'website',
        'is_private', 'show_activity', 'theme_config', 'role',
        'verification_status', 'verification_date', 'verified_title',
        'verification_expiry', 'is_verified'
    ]);

    for (const key of Object.keys(updates)) {
        if (!allowedFields.has(key)) {
            return { valid: false, error: `Unexpected field: ${key}` };
        }
    }

    if (updates.username) {
        const v = validateUsername(updates.username);
        if (!v.valid) return v;
    }
    if (updates.full_name) {
        const v = validateFullName(updates.full_name);
        if (!v.valid) return v;
    }
    if (updates.bio) {
        const v = validateBio(updates.bio);
        if (!v.valid) return v;
    }
    if (updates.bio_link) {
        const v = validateUrl(updates.bio_link);
        if (!v.valid) return v;
    }
    if (updates.website) {
        const v = validateUrl(updates.website);
        if (!v.valid) return v;
    }

    return { valid: true };
}

// ============================================================
// 3. ENTITY VALIDATION SCHEMAS
//    Each function validates the entire insert payload for a
//    specific table, rejecting unexpected fields and enforcing
//    type/length/format constraints.
// ============================================================

/** Validates a Poll creation payload */
export function validatePollCreate(question: string, options: string[]): ValidationResult {
    const q = validateShortText(question, 'Question', 300);
    if (!q.valid) return q;

    const validOptions = options.filter(o => o.trim() !== '');
    if (validOptions.length < 2) return { valid: false, error: 'At least 2 options are required' };
    if (validOptions.length > 10) return { valid: false, error: 'Maximum 10 options allowed' };

    for (const opt of validOptions) {
        if (opt.trim().length > 200) return { valid: false, error: 'Each option must be 200 characters or fewer' };
    }
    return { valid: true };
}

/** Validates a Lost & Found item */
export function validateLostFoundItem(data: { title: string; description?: string; type: string; location?: string; contact_info?: string }): ValidationResult {
    const t = validateShortText(data.title, 'Title', 150);
    if (!t.valid) return t;

    if (data.description) {
        const d = validateLongText(data.description, 'Description', 1000);
        if (!d.valid) return d;
    }

    if (!['lost', 'found'].includes(data.type)) return { valid: false, error: 'Type must be "lost" or "found"' };

    if (data.location && data.location.length > 200) return { valid: false, error: 'Location must be 200 characters or fewer' };
    if (data.contact_info && data.contact_info.length > 200) return { valid: false, error: 'Contact info must be 200 characters or fewer' };

    return { valid: true };
}

/** Validates a Marketplace listing */
export function validateMarketplaceListing(data: { title: string; description?: string; price: string | number; category: string }): ValidationResult {
    const t = validateShortText(data.title, 'Title', 150);
    if (!t.valid) return t;

    if (data.description) {
        const d = validateLongText(data.description, 'Description', 2000);
        if (!d.valid) return d;
    }

    const p = validatePrice(data.price);
    if (!p.valid) return p;

    const allowedCategories = ['books', 'electronics', 'clothing', 'furniture', 'services', 'other'];
    if (!allowedCategories.includes(data.category)) return { valid: false, error: 'Invalid category' };

    return { valid: true };
}

/** Validates an Event creation */
export function validateEventCreate(data: { title: string; description?: string; location?: string; event_date: string }): ValidationResult {
    const t = validateShortText(data.title, 'Event title', 200);
    if (!t.valid) return t;

    if (data.description) {
        const d = validateLongText(data.description, 'Description', 2000);
        if (!d.valid) return d;
    }

    if (data.location && data.location.length > 200) return { valid: false, error: 'Location must be 200 characters or fewer' };

    if (!data.event_date) return { valid: false, error: 'Event date is required' };
    const parsedDate = new Date(data.event_date);
    if (isNaN(parsedDate.getTime())) return { valid: false, error: 'Invalid event date' };

    return { valid: true };
}

/** Validates an Internship posting */
export function validateInternshipCreate(data: { title: string; company: string; description?: string; location?: string; stipend?: string; duration?: string; apply_link?: string }): ValidationResult {
    const t = validateShortText(data.title, 'Title', 200);
    if (!t.valid) return t;

    const c = validateShortText(data.company, 'Company', 150);
    if (!c.valid) return c;

    if (data.description) {
        const d = validateLongText(data.description, 'Description', 2000);
        if (!d.valid) return d;
    }

    if (data.location && data.location.length > 200) return { valid: false, error: 'Location must be 200 characters or fewer' };
    if (data.stipend && data.stipend.length > 100) return { valid: false, error: 'Stipend must be 100 characters or fewer' };
    if (data.duration && data.duration.length > 100) return { valid: false, error: 'Duration must be 100 characters or fewer' };
    if (data.apply_link) {
        const l = validateUrl(data.apply_link);
        if (!l.valid) return l;
    }

    return { valid: true };
}

/** Validates a Study Group creation */
export function validateStudyGroupCreate(data: { subject: string; description?: string; max_members: string | number; meeting_time?: string; location?: string }): ValidationResult {
    const s = validateShortText(data.subject, 'Subject', 200);
    if (!s.valid) return s;

    if (data.description) {
        const d = validateLongText(data.description, 'Description', 1000);
        if (!d.valid) return d;
    }

    const m = validateInt(data.max_members, 'Max members', 2, 50);
    if (!m.valid) return m;

    if (data.meeting_time && data.meeting_time.length > 100) return { valid: false, error: 'Meeting time must be 100 characters or fewer' };
    if (data.location && data.location.length > 200) return { valid: false, error: 'Location must be 200 characters or fewer' };

    return { valid: true };
}

/** Validates a Confession (Secret Room) */
export function validateConfession(content: string): ValidationResult {
    if (!content || typeof content !== 'string') return { valid: false, error: 'Confession cannot be empty' };
    const trimmed = content.trim();
    if (trimmed.length < 1) return { valid: false, error: 'Confession cannot be empty' };
    if (trimmed.length > 1000) return { valid: false, error: 'Confession must be 1000 characters or fewer' };
    return { valid: true };
}

/** Validates a Circle creation */
export function validateCircleCreate(data: { name: string; description?: string }): ValidationResult {
    const n = validateShortText(data.name, 'Circle name', 100);
    if (!n.valid) return n;

    if (data.description) {
        const d = validateLongText(data.description, 'Description', 500);
        if (!d.valid) return d;
    }

    return { valid: true };
}

/** Validates a Circle message */
export function validateCircleMessage(content: string): ValidationResult {
    return validateMessage(content); // Same rules as DM
}

/** Validates a report/support ticket */
export function validateReport(message: string): ValidationResult {
    if (!message || typeof message !== 'string') return { valid: false, error: 'Please provide details' };
    const trimmed = message.trim();
    if (trimmed.length < 10) return { valid: false, error: 'Please provide more detail (at least 10 characters)' };
    if (trimmed.length > 2000) return { valid: false, error: 'Report is too long (max 2000 characters)' };
    return { valid: true };
}


// ============================================================
// 4. CLIENT-SIDE RATE LIMITER
// ============================================================

/**
 * In-memory rate limiter for client-side throttling.
 * Tracks action counts per time window.
 *
 * IMPORTANT: This is a client-side convenience guard. Real rate
 * limiting MUST happen server-side (Supabase Edge Functions or
 * PostgREST rate limiting). This prevents accidental abuse and
 * double-clicks from the UI.
 *
 * Usage:
 *   const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60000 });
 *   if (!limiter.canProceed('signup')) return showRateLimitToast(limiter, 'signup');
 */
export class RateLimiter {
    private timestamps: Map<string, number[]> = new Map();
    private maxRequests: number;
    private windowMs: number;

    constructor({ maxRequests = 10, windowMs = 60_000 }: { maxRequests?: number; windowMs?: number } = {}) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }

    /**
     * Check if an action is within rate limits.
     * @param action - Identifier for the action (e.g., 'login', 'createPost')
     * @returns true if allowed, false if rate limited
     */
    canProceed(action: string): boolean {
        const now = Date.now();
        const timestamps = this.timestamps.get(action) || [];

        // Remove expired timestamps
        const validTimestamps = timestamps.filter(t => now - t < this.windowMs);

        if (validTimestamps.length >= this.maxRequests) {
            this.timestamps.set(action, validTimestamps);
            return false;
        }

        validTimestamps.push(now);
        this.timestamps.set(action, validTimestamps);
        return true;
    }

    /** Get remaining requests for an action */
    remaining(action: string): number {
        const now = Date.now();
        const timestamps = (this.timestamps.get(action) || []).filter(t => now - t < this.windowMs);
        return Math.max(0, this.maxRequests - timestamps.length);
    }

    /** Get milliseconds until the rate limit resets for an action */
    retryAfter(action: string): number {
        const timestamps = this.timestamps.get(action) || [];
        if (timestamps.length === 0) return 0;
        const oldest = Math.min(...timestamps);
        return Math.max(0, this.windowMs - (Date.now() - oldest));
    }
}

// ============================================================
// 5. PRE-CONFIGURED RATE LIMITERS (sensible defaults)
// ============================================================

/** Auth actions: 5 attempts per 60 seconds */
export const authLimiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });

/** Post creation: 10 posts per 5 minutes */
export const postLimiter = new RateLimiter({ maxRequests: 10, windowMs: 300_000 });

/** Comment creation: 20 comments per minute */
export const commentLimiter = new RateLimiter({ maxRequests: 20, windowMs: 60_000 });

/** Search queries: 30 per minute */
export const searchLimiter = new RateLimiter({ maxRequests: 30, windowMs: 60_000 });

/** Profile updates: 10 per minute */
export const profileLimiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 });

/** Follow actions: 30 per minute */
export const followLimiter = new RateLimiter({ maxRequests: 30, windowMs: 60_000 });

/** Message sending: 60 per minute */
export const messageLimiter = new RateLimiter({ maxRequests: 60, windowMs: 60_000 });

/** Story creation: 5 per 10 minutes */
export const storyLimiter = new RateLimiter({ maxRequests: 5, windowMs: 600_000 });

/** Support tickets: 3 per 10 minutes */
export const supportLimiter = new RateLimiter({ maxRequests: 3, windowMs: 600_000 });

/** Poll creation: 5 per 10 minutes */
export const pollLimiter = new RateLimiter({ maxRequests: 5, windowMs: 600_000 });

/** Poll voting: 30 per minute */
export const voteLimiter = new RateLimiter({ maxRequests: 30, windowMs: 60_000 });

/** Lost & Found posting: 5 per 10 minutes */
export const lostFoundLimiter = new RateLimiter({ maxRequests: 5, windowMs: 600_000 });

/** Marketplace listing: 10 per 10 minutes */
export const marketplaceLimiter = new RateLimiter({ maxRequests: 10, windowMs: 600_000 });

/** Event creation: 5 per 10 minutes */
export const eventLimiter = new RateLimiter({ maxRequests: 5, windowMs: 600_000 });

/** Internship posting: 5 per 10 minutes */
export const internshipLimiter = new RateLimiter({ maxRequests: 5, windowMs: 600_000 });

/** Study group creation: 5 per 10 minutes */
export const studyGroupLimiter = new RateLimiter({ maxRequests: 5, windowMs: 600_000 });

/** Circle creation: 3 per 10 minutes */
export const circleLimiter = new RateLimiter({ maxRequests: 3, windowMs: 600_000 });

/** Confession posting: 5 per 10 minutes */
export const confessionLimiter = new RateLimiter({ maxRequests: 5, windowMs: 600_000 });

/** Report submission: 3 per 10 minutes */
export const reportLimiter = new RateLimiter({ maxRequests: 3, windowMs: 600_000 });

/** Generic action limiter: 20 per minute (joins, toggles, etc.) */
export const genericLimiter = new RateLimiter({ maxRequests: 20, windowMs: 60_000 });

/** File upload limiter: 10 per 5 minutes */
export const uploadLimiter = new RateLimiter({ maxRequests: 10, windowMs: 300_000 });


// ============================================================
// 6. GRACEFUL 429 TOAST HELPER
// ============================================================

/**
 * Shows a user-friendly "too many requests" toast with retry timer.
 * Call this when a rate limiter blocks an action.
 *
 * @param limiter - The RateLimiter instance that blocked the action
 * @param action  - The action key used in canProceed()
 * @param customMessage - Optional custom message (default: generic 429)
 * @returns An error result object compatible with Supabase return shapes
 */
export function showRateLimitToast(
    limiter: RateLimiter,
    action: string,
    customMessage?: string
): { data: null; error: { message: string } } {
    const retryMs = limiter.retryAfter(action);
    const retrySec = Math.ceil(retryMs / 1000);

    const message = customMessage
        || `Too many requests. Please wait ${retrySec > 60 ? `${Math.ceil(retrySec / 60)} minute(s)` : `${retrySec} second(s)`}.`;

    toast.error(message, {
        duration: 4000,
        id: `rate-limit-${action}`, // Prevents duplicate toasts for same action
    });

    return { data: null, error: { message } };
}

/**
 * Convenience: check limiter + auto-show toast. Returns true if BLOCKED.
 * Usage: if (isRateLimited(pollLimiter, 'create_poll')) return;
 */
export function isRateLimited(limiter: RateLimiter, action: string, customMessage?: string): boolean {
    if (!limiter.canProceed(action)) {
        showRateLimitToast(limiter, action, customMessage);
        return true;
    }
    return false;
}
