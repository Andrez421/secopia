/**
 * Pure validation helpers for /api/buscar
 */

export interface SearchParamsRaw {
  limite: string | null;
  offset: string | null;
  valorMin: string | null;
  valorMax: string | null;
}

export interface SearchValidationError {
  error: string;
  status: 400;
}

export function validateSearchParams(params: SearchParamsRaw): SearchValidationError | null {
  // limite/offset are optional — the route applies defaults (50 / 0).
  // Only reject when present but not numeric.
  if (
    (params.limite !== null && Number.isNaN(Number(params.limite))) ||
    (params.offset !== null && Number.isNaN(Number(params.offset)))
  ) {
    return {
      error: "Los parámetros 'limite' y 'offset' deben ser números válidos.",
      status: 400,
    };
  }

  if (params.valorMin && params.valorMax) {
    const valorMin = Number(params.valorMin);
    const valorMax = Number(params.valorMax);
    if (!Number.isNaN(valorMin) && !Number.isNaN(valorMax) && valorMin > valorMax) {
      return {
        error: "El valor mínimo no puede ser mayor que el valor máximo.",
        status: 400,
      };
    }
  }

  return null;
}
