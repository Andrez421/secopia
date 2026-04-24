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
  const limite = params.limite !== null ? Number(params.limite) : Number.NaN;
  const offset = params.offset !== null ? Number(params.offset) : Number.NaN;

  if (Number.isNaN(limite) || Number.isNaN(offset)) {
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
