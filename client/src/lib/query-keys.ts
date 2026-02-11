export const API_QUERY_KEYS = {
  authMe: ["/api/auth/me"] as const,
  publicUnits: ["/api/public/units"] as const,
  geographicData: ["/api/geographic-data"] as const,
  documentsRoot: ["/api/documents"] as const,
  documents: <TFilters>(filters: TFilters) =>
    ["/api/documents", filters] as const,
  beneficiaries: ["/api/beneficiaries"] as const,
  beneficiaryPayments: ["/api/beneficiary-payments"] as const,
  users: ["/api/users"] as const,
  publicEventTypes: ["/api/public/event-types"] as const,
  publicExpenditureTypes: ["/api/public/expenditure-types"] as const,
};
