const IDENT_RE = /^[a-z_][a-z0-9_]*$/i;

export function assertSqlIdent(value: string, kind = "identifier"): string {
  if (!IDENT_RE.test(value) || value.length > 64) {
    throw new Error(`Invalid SQL ${kind}`);
  }
  return value;
}
