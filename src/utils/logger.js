/**
 * Logging that is disabled in production builds.
 * Use instead of console.log / console.warn in app code so production stays quiet.
 */

const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV === true;

export const logger = {
  log: (...args) => { if (isDev) console.log(...args); },
  warn: (...args) => { if (isDev) console.warn(...args); },
  info: (...args) => { if (isDev) console.info(...args); },
  debug: (...args) => { if (isDev) console.debug(...args); },
  error: (...args) => { if (isDev) console.error(...args); },
};
