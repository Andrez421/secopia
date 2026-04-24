import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SoQLBuilder, SoQLValidationError } from "./soql.js";

describe("SoQLBuilder", () => {
  describe("basic query building", () => {
    it("builds a default SELECT * query with LIMIT and OFFSET", () => {
      const query = new SoQLBuilder().build();
      assert.equal(query, "SELECT * LIMIT 50 OFFSET 0");
    });

    it("builds a query with specific fields", () => {
      const query = new SoQLBuilder().select(["nombre_entidad", "valor_del_contrato"]).build();
      assert.equal(query, "SELECT nombre_entidad, valor_del_contrato LIMIT 50 OFFSET 0");
    });

    it("builds a query with limit and offset", () => {
      const query = new SoQLBuilder().limit(10).offset(20).build();
      assert.equal(query, "SELECT * LIMIT 10 OFFSET 20");
    });

    it("builds a query with order by", () => {
      const query = new SoQLBuilder().orderBy("fecha_de_firma", "ASC").build();
      assert.equal(query, "SELECT * ORDER BY fecha_de_firma ASC LIMIT 50 OFFSET 0");
    });
  });

  describe("sanitization", () => {
    it("strips dangerous characters from like values", () => {
      const query = new SoQLBuilder().like("nombre_entidad", "test'; DROP TABLE --").build();
      // Should strip everything except letters, numbers, spaces, hyphens, dots
      // The `--` is collapsed to a single `-` (safe), and `';` is stripped entirely
      assert.match(query, /upper\(nombre_entidad\) like '%TEST DROP TABLE -%'/);
    });

    it("strips SQL injection attempts from equals values", () => {
      const query = new SoQLBuilder().equals("departamento", "BOGOTA' OR '1'='1").build();
      assert.match(query, /departamento = 'BOGOTA OR 11'/);
    });

    it("rejects invalid field names", () => {
      assert.throws(
        () => new SoQLBuilder().like("nombre_entidad; DROP", "test"),
        SoQLValidationError,
      );
    });

    it("rejects field names with special characters", () => {
      assert.throws(() => new SoQLBuilder().equals("field-name", "value"), SoQLValidationError);
    });

    it("allows valid field names with underscores", () => {
      const query = new SoQLBuilder().like("proveedor_adjudicado", "test").build();
      assert.match(query, /proveedor_adjudicado/);
    });

    it("handles accented characters in values", () => {
      const query = new SoQLBuilder().like("nombre_entidad", "Bogotá").build();
      assert.match(query, /BOGOTÁ/);
    });

    it("returns this without adding condition when value sanitizes to empty", () => {
      const query = new SoQLBuilder().like("nombre_entidad", "!@#$%^&*()").build();
      assert.equal(query, "SELECT * LIMIT 50 OFFSET 0");
    });
  });

  describe("orLike", () => {
    it("generates OR conditions across multiple fields", () => {
      const query = new SoQLBuilder()
        .orLike(["nombre_entidad", "proveedor_adjudicado", "objeto_del_contrato"], "hospital")
        .build();

      assert.match(query, /WHERE \(/);
      assert.match(query, /upper\(nombre_entidad\) like '%HOSPITAL%'/);
      assert.match(query, /upper\(proveedor_adjudicado\) like '%HOSPITAL%'/);
      assert.match(query, /upper\(objeto_del_contrato\) like '%HOSPITAL%'/);
      assert.match(query, / OR /);
    });

    it("sanitizes the value for orLike", () => {
      const query = new SoQLBuilder().orLike(["nombre_entidad"], "test'; DROP--").build();
      assert.match(query, /TEST DROP/);
      assert.doesNotMatch(query, /;/);
      assert.doesNotMatch(query, /--/);
    });

    it("skips orLike when value sanitizes to empty", () => {
      const query = new SoQLBuilder()
        .orLike(["nombre_entidad", "proveedor_adjudicado"], "!@#$")
        .build();
      assert.equal(query, "SELECT * LIMIT 50 OFFSET 0");
    });
  });

  describe("comparison operators", () => {
    it("builds gte with number", () => {
      const query = new SoQLBuilder().gte("valor_del_contrato", 1_000_000).build();
      assert.match(query, /valor_del_contrato >= 1000000/);
    });

    it("builds lte with number", () => {
      const query = new SoQLBuilder().lte("valor_del_contrato", 5_000_000).build();
      assert.match(query, /valor_del_contrato <= 5000000/);
    });

    it("builds gte with date string", () => {
      const query = new SoQLBuilder().gte("fecha_de_firma", "2024-01-01").build();
      assert.match(query, /fecha_de_firma >= '2024-01-01'/);
    });

    it("combines multiple conditions with AND", () => {
      const query = new SoQLBuilder()
        .like("nombre_entidad", "hospital")
        .gte("valor_del_contrato", 1_000_000)
        .lte("valor_del_contrato", 10_000_000)
        .build();

      assert.match(query, /WHERE .+ AND .+ AND /);
    });
  });

  describe("limit clamping", () => {
    it("clamps limit to max 200", () => {
      const query = new SoQLBuilder().limit(500).build();
      assert.match(query, /LIMIT 200/);
    });

    it("clamps limit to min 1", () => {
      const query = new SoQLBuilder().limit(0).build();
      assert.match(query, /LIMIT 1/);
    });

    it("clamps negative limit to 1", () => {
      const query = new SoQLBuilder().limit(-10).build();
      assert.match(query, /LIMIT 1/);
    });

    it("floors fractional limits", () => {
      const query = new SoQLBuilder().limit(10.7).build();
      assert.match(query, /LIMIT 10/);
    });
  });

  describe("offset clamping", () => {
    it("clamps negative offset to 0", () => {
      const query = new SoQLBuilder().offset(-5).build();
      assert.match(query, /OFFSET 0/);
    });

    it("floors fractional offsets", () => {
      const query = new SoQLBuilder().offset(10.7).build();
      assert.match(query, /OFFSET 10/);
    });
  });
});
