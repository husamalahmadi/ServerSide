/** Error when FMP returned incomplete data (user should retry). */
export class FmpIncompleteError extends Error {
  constructor(message, { issues = [] } = {}) {
    super(message);
    this.name = "FmpIncompleteError";
    this.code = "INCOMPLETE_DATA";
    this.retry = true;
    this.issues = issues;
  }
}

export function isFmpRetryError(err) {
  return Boolean(err?.retry || err?.code === "INCOMPLETE_DATA" || err?.name === "FmpIncompleteError");
}
