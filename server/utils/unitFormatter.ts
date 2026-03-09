type MonadaUnitName = {
  name?: string;
};

type MonadaRow = {
  id: number | string;
  unit?: string | null;
  unit_name?: MonadaUnitName | string | null;
};

export type UnitDto = {
  id: number;
  code: string;
  unit: string;
  name: string;
  unit_name: MonadaUnitName | string | null;
};

export function formatMonadaUnit(row: MonadaRow): UnitDto {
  const numericId = Number(row.id);
  const code = typeof row.unit === "string" ? row.unit.trim() : "";
  const objectName =
    row.unit_name && typeof row.unit_name === "object"
      ? row.unit_name.name
      : undefined;
  const stringName =
    typeof row.unit_name === "string" ? row.unit_name.trim() : "";
  const name = objectName?.trim() || stringName || code || `Unit ${numericId}`;

  return {
    id: numericId,
    code,
    unit: code,
    name,
    unit_name: row.unit_name ?? null,
  };
}

export function formatMonadaUnits(rows: MonadaRow[] | null | undefined): UnitDto[] {
  return (rows || []).map(formatMonadaUnit);
}
