export const MAX_FAILED_ATTEMPTS = 5
export const LOCK_DURATION_MS = 15 * 60 * 1000
export const INACTIVITY_WINDOW_MS = 30 * 60 * 1000
export const EXPIRES_IN_SECONDS = INACTIVITY_WINDOW_MS / 1000
export const TOKEN_MAX_AGE = '8h'

// Valid bcrypt hash (cost 10) of a random value; compared when the e-mail does not exist
// so an unknown e-mail costs the same time as a wrong password.
export const DUMMY_PASSWORD_HASH = '$2b$10$gCLtLyXPdlbjIGxR8Ad3.OhvWvkqzYb1pRaAXmlqV9rflfAxUKDpe'
