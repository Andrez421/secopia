/**
 * @secopia/types — Dataset configuration interfaces
 *
 * Defines the structure for dataset metadata used by
 * the SocrataClient and MCP tools.
 */

/** Maps logical field names to actual Socrata column names */
export interface DatasetFieldMap {
  entidad: string;
  proveedor: string;
  departamento: string;
  descripcion: string;
  valor: string;
  fecha_firma: string;
  modalidad: string;
  referencia?: string;
  /** Additional fields specific to each dataset */
  [key: string]: string | undefined;
}

/** Configuration for a single Socrata dataset */
export interface DatasetConfig {
  /** Socrata dataset identifier (e.g., "jbjy-vk9h") */
  id: string;
  /** Human-readable dataset name */
  nombre: string;
  /** Description for MCP resource discovery */
  descripcion: string;
  /** Field name mapping for this dataset */
  campos: DatasetFieldMap;
}

/** Registry of all available datasets, keyed by logical name */
export type DatasetRegistry = Record<string, DatasetConfig>;
