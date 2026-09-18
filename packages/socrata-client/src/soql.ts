/**
 * SoQL Query Builder — Safe, sanitized query construction
 *
 * EVERY user input MUST go through the sanitize() method.
 * NEVER use string interpolation with raw user input for SoQL.
 *
 * @example
 * ```ts
 * const query = new SoQLBuilder()
 *   .orLike(["nombre_entidad", "proveedor_adjudicado"], "hospital")
 *   .gte("valor_del_contrato", 1_000_000)
 *   .orderBy("fecha_de_firma")
 *   .limit(20)
 *   .build();
 * ```
 */

import type { SortDirection } from "@secopia/types";

/** Valid SoQL field name pattern: starts with letter/underscore, alphanumeric + underscore */
const FIELD_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/i;

/** Allowed characters in user input values after sanitization */
const SAFE_VALUE_PATTERN = /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\-\.,]/g;

/** Maximum rows Socrata will return per request */
const SOCRATA_MAX_LIMIT = 200;

/** An aggregate expression for SoQLBuilder.groupBy(). */
export interface SoQLAggregate {
  /** Aggregate function — count, sum, avg, min, max. */
  fn: "count" | "sum" | "avg" | "min" | "max";
  /** Field the function applies to; omit for count(*). */
  field?: string;
  /** Output column name (validated as an identifier). */
  alias: string;
}

export class SoQLBuilder {
  private conditions: string[] = [];
  private selectFields: string[] = ["*"];
  private orderByField?: string;
  private groupByFields?: string[];
  private limitVal = 50;
  private offsetVal = 0;

  // ─── Sanitization ────────────────────────────────────────

  /**
   * Sanitizes a user-provided value for safe use in SoQL.
   * Strips all characters except letters (with accents), numbers, spaces, hyphens,
   * dots, and commas (needed for names like "San Andrés, Providencia y Santa Catalina").
   * Collapses consecutive hyphens (--) to prevent SQL comment syntax.
   */
  private sanitize(value: string): string {
    return value.replace(SAFE_VALUE_PATTERN, "").replace(/-{2,}/g, "-").trim();
  }

  /**
   * Validates a field name to prevent injection through dynamic field names.
   * Only allows lowercase letters, numbers, and underscores.
   *
   * @throws {Error} If the field name contains invalid characters
   */
  private sanitizeField(field: string): string {
    if (!FIELD_NAME_PATTERN.test(field)) {
      throw new SoQLValidationError(`Invalid SoQL field name: "${field}"`);
    }
    return field;
  }

  /**
   * Escapes single quotes in a string value for SoQL.
   * SoQL uses doubled single quotes for escaping (like SQL).
   */
  private escapeQuotes(value: string): string {
    return value.replace(/'/g, "''");
  }

  // ─── Query Building Methods ──────────────────────────────

  /**
   * Set specific fields to select. Each field name is validated.
   * Default is `*` (all fields).
   */
  select(fields: string[]): this {
    this.selectFields = fields.map((f) => this.sanitizeField(f));
    return this;
  }

  /**
   * Add a raw WHERE condition. Use only for internally-generated conditions.
   * For user input, ALWAYS use like(), orLike(), equals(), gte(), lte().
   *
   * @internal
   */
  where(condition: string): this {
    if (condition) this.conditions.push(condition);
    return this;
  }

  /**
   * Case-insensitive partial match on a single field.
   * Sanitizes the value automatically.
   */
  like(field: string, value: string): this {
    const sanitized = this.escapeQuotes(this.sanitize(value)).toUpperCase();
    if (!sanitized) return this;
    const safeField = this.sanitizeField(field);
    return this.where(`upper(${safeField}) like '%${sanitized}%'`);
  }

  /**
   * Case-insensitive partial match across MULTIPLE fields with OR.
   * Searches for the same value in all specified fields.
   * Sanitizes the value once and applies to all fields.
   *
   * @example
   * ```ts
   * builder.orLike(["nombre_entidad", "proveedor_adjudicado", "objeto_del_contrato"], "hospital");
   * // Generates: (upper(nombre_entidad) like '%HOSPITAL%' OR upper(proveedor_adjudicado) like '%HOSPITAL%' OR ...)
   * ```
   */
  orLike(fields: string[], value: string): this {
    const sanitized = this.escapeQuotes(this.sanitize(value)).toUpperCase();
    if (!sanitized) return this;
    const clauses = fields.map((f) => {
      const safeField = this.sanitizeField(f);
      return `upper(${safeField}) like '%${sanitized}%'`;
    });
    return this.where(`(${clauses.join(" OR ")})`);
  }

  /**
   * Exact match on a field. Strings are sanitized, numbers pass through.
   */
  equals(field: string, value: string | number): this {
    const safeField = this.sanitizeField(field);
    if (typeof value === "string") {
      const sanitized = this.escapeQuotes(this.sanitize(value));
      return this.where(`${safeField} = '${sanitized}'`);
    }
    return this.where(`${safeField} = ${value}`);
  }

  /**
   * Greater than or equal. For dates, use ISO 8601 format (YYYY-MM-DD).
   */
  gte(field: string, value: string | number): this {
    const safeField = this.sanitizeField(field);
    if (typeof value === "string") {
      const sanitized = this.sanitize(value);
      return this.where(`${safeField} >= '${sanitized}'`);
    }
    return this.where(`${safeField} >= ${value}`);
  }

  /**
   * Less than or equal. For dates, use ISO 8601 format (YYYY-MM-DD).
   */
  lte(field: string, value: string | number): this {
    const safeField = this.sanitizeField(field);
    if (typeof value === "string") {
      const sanitized = this.sanitize(value);
      return this.where(`${safeField} <= '${sanitized}'`);
    }
    return this.where(`${safeField} <= ${value}`);
  }

  /**
   * Set ORDER BY field and direction. Default direction is DESC.
   * Accepts a select alias when grouping (e.g. ORDER BY the aggregate alias).
   */
  orderBy(field: string, dir: SortDirection = "DESC"): this {
    const safeField = this.sanitizeField(field);
    this.orderByField = `${safeField} ${dir}`;
    return this;
  }

  /**
   * Aggregate query: `SELECT <groupFields>, <fn>(<field>) AS <alias>, ...`
   * plus `GROUP BY <groupFields>`. Aggregating server-side is what makes
   * "top N by total" and per-entity statistics exact instead of asking a
   * downstream consumer to sum a capped page of raw rows.
   *
   * All field names and aliases are validated as identifiers; a `count`
   * aggregate with no field emits `count(*)`.
   */
  groupBy(groupFields: string[], aggregates: SoQLAggregate[]): this {
    const safeGroups = groupFields.map((f) => this.sanitizeField(f));
    const safeAggs = aggregates.map((a) => {
      const safeAlias = this.sanitizeField(a.alias);
      if (a.fn === "count" && a.field === undefined) return `count(*) AS ${safeAlias}`;
      return `${a.fn}(${this.sanitizeField(a.field ?? "")}) AS ${safeAlias}`;
    });
    this.selectFields = [...safeGroups, ...safeAggs];
    this.groupByFields = safeGroups;
    return this;
  }

  /**
   * Set result limit. Clamped between 1 and 200 (Socrata maximum).
   */
  limit(n: number): this {
    this.limitVal = Math.min(Math.max(1, Math.floor(n)), SOCRATA_MAX_LIMIT);
    return this;
  }

  /**
   * Set pagination offset. Minimum 0.
   */
  offset(n: number): this {
    this.offsetVal = Math.max(0, Math.floor(n));
    return this;
  }

  /**
   * Build the final SoQL query string.
   * This is the ONLY way to get a query out of the builder.
   */
  build(): string {
    const parts: string[] = [`SELECT ${this.selectFields.join(", ")}`];
    if (this.conditions.length > 0) {
      parts.push(`WHERE ${this.conditions.join(" AND ")}`);
    }
    if (this.groupByFields?.length) {
      parts.push(`GROUP BY ${this.groupByFields.join(", ")}`);
    }
    if (this.orderByField) {
      parts.push(`ORDER BY ${this.orderByField}`);
    }
    parts.push(`LIMIT ${this.limitVal}`);
    parts.push(`OFFSET ${this.offsetVal}`);
    return parts.join(" ");
  }
}

/**
 * Error thrown when SoQL query construction fails due to invalid input.
 */
export class SoQLValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SoQLValidationError";
  }
}
