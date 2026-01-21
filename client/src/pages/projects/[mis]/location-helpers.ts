type LocationInput = Record<string, any>;
type ClonedLocation<T extends LocationInput> = T & {
  isClone: true;
  _originalId: number | null;
};

// Basic deep clone for plain location payloads.
const deepCloneLocation = <T,>(value: T): T => {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
};

// Ensure the location field is always an array.
const ensureArray = <T,>(value: T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : [];

// Normalize location data for comparisons by stripping metadata and sorting arrays.
const normalizeLocationForCompare = (location: LocationInput): LocationInput => {
  const {
    id: _id,
    project_index_id: _projectIndexId,
    isClone: _isClone,
    _originalId,
    ...rest
  } =
    deepCloneLocation(location || {}) || {};

  return {
    ...rest,
    geographic_areas: ensureArray(rest.geographic_areas).slice().sort(),
    expenditure_types: ensureArray(rest.expenditure_types).slice().sort(),
  };
};

// Serialize normalized location data with stable key ordering.
const serializeLocationForCompare = (location: LocationInput): string => {
  const normalized = normalizeLocationForCompare(location);
  const ordered: LocationInput = {};
  Object.keys(normalized)
    .sort()
    .forEach((key) => {
      ordered[key] = normalized[key];
    });
  return JSON.stringify(ordered);
};

// Extract the persisted identifier for a location row.
const getPersistedLocationKey = (location: LocationInput): number | string | null => {
  const key = location?.id ?? location?.project_index_id;
  return key === undefined || key === null ? null : key;
};

// Clone a location row and strip backend identifiers.
export const cloneLocation = <T extends LocationInput>(
  location: T,
): ClonedLocation<T> => {
  const {
    id,
    project_index_id,
    ada: _ada,
    protocol_number: _protocolNumber,
    ...rest
  } = location || {};
  const cloned = (deepCloneLocation(rest) || {}) as T;

  return {
    ...cloned,
    geographic_areas: ensureArray(cloned.geographic_areas),
    expenditure_types: ensureArray(cloned.expenditure_types),
    isClone: true,
    _originalId: id ?? project_index_id ?? null,
  };
};

// Prepare a location payload for save, stripping clone metadata as needed.
export const prepareLocationForSave = <T extends LocationInput>(location: T): T => {
  const {
    id,
    project_index_id,
    ada,
    protocol_number,
    isClone,
    _originalId,
    ...rest
  } = location || {};
  const cleaned = (deepCloneLocation(rest) || {}) as T;

  (cleaned as any).geographic_areas = ensureArray((cleaned as any).geographic_areas);
  (cleaned as any).expenditure_types = ensureArray((cleaned as any).expenditure_types);

  if (isClone || _originalId) {
    return cleaned;
  }

  if (id !== undefined && id !== null) (cleaned as any).id = id;
  if (project_index_id !== undefined && project_index_id !== null) {
    (cleaned as any).project_index_id = project_index_id;
  }
  if (ada !== undefined && ada !== null) (cleaned as any).ada = ada;
  if (protocol_number !== undefined && protocol_number !== null) {
    (cleaned as any).protocol_number = protocol_number;
  }

  return cleaned;
};

// Check whether a location represents a persisted record.
export const isPersistedLocation = (location: LocationInput): boolean =>
  getPersistedLocationKey(location) !== null;

// Build a snapshot of persisted locations for later change detection.
export const buildPersistedLocationSnapshot = (
  locations: LocationInput[],
): Map<string, string> => {
  const snapshot = new Map<string, string>();

  (locations || []).forEach((location) => {
    const key = getPersistedLocationKey(location);
    if (key !== null) {
      snapshot.set(String(key), serializeLocationForCompare(location));
    }
  });

  return snapshot;
};

// Detect whether any persisted location has changed relative to the snapshot.
export const hasPersistedLocationChanges = (
  currentLocations: LocationInput[],
  initialSnapshot: Map<string, string>,
): boolean => {
  const currentSnapshot = buildPersistedLocationSnapshot(currentLocations);

  for (const [key, value] of Array.from(initialSnapshot.entries())) {
    const currentValue = currentSnapshot.get(key);
    if (!currentValue || currentValue !== value) {
      return true;
    }
  }

  return false;
};
