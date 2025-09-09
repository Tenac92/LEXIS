// Shared TypeScript interfaces for project forms

export interface KallikratisEntry {
  id: number;
  kodikos_neou_ota: number;
  eidos_neou_ota: string;
  onoma_neou_ota: string;
  kodikos_perifereiakis_enotitas: number;
  perifereiaki_enotita: string;
  kodikos_perifereias: number;
  perifereia: string;
}

export interface UnitData {
  id: number;
  name?: string;
  unit?: string;
  unit_name?: {
    name: string;
    prop: string;
  };
}

export interface EventTypeData {
  id: number;
  name: string;
}

export interface ExpenditureTypeData {
  id: number;
  expenditure_types?: string;
  expenditure_types_minor?: string;
  name?: string;
}

export interface ProjectData {
  id: number;
  mis: string;
  project_title?: string;
  event_description?: string;
  event_year?: string | number;
  status?: string;
  na853?: string;
  na271?: string;
  e069?: string;
  budget_na853?: number;
  budget_na271?: number;
  budget_e069?: number;
  enhanced_unit?: {
    name: string;
  };
}

export interface FekData {
  year: string;
  issue: string;
  number: string;
}

export interface DecisionData {
  protocol_number: string;
  fek: FekData;
  ada: string;
  implementing_agency: number[];
  decision_budget: string;
  expenses_covered: string;
  expenditure_type: number[];
  decision_type: "Έγκριση" | "Τροποποίηση" | "Παράταση";
  included: boolean;
  comments: string;
}

export interface EventDetails {
  event_name: string;
  event_year: string;
}

export interface LocationDetail {
  implementing_agency: string;
  event_type: string;
  expenditure_types: string[];
  geographic_areas: string[];
}

export interface ProjectDetails {
  mis: string;
  sa: string;
  inc_year: string;
  project_title: string;
  project_description: string;
  summary_description: string;
  expenses_executed: string;
  project_status: string;
}

export interface BudgetVersion {
  version_name: string;
  version_number: string;
  project_budget?: string;
  total_public_expense?: string;
  eligible_public_expense?: string;
  epa_version?: string;
  amount?: string;
  protocol_number: string;
  ada: string;
  decision_date: string;
  decision_type: "Έγκριση" | "Τροποποίηση" | "Κλείσιμο στο ύψος πληρωμών";
  status: "Ενεργή" | "Ανενεργή" | "Αναστολή";
  connected_decisions: number[];
  comments: string;
}

export interface FormulationDetail {
  sa: "ΝΑ853" | "ΝΑ271" | "E069";
  enumeration_code: string;
  decision_year: string;
  decision_status: "Ενεργή" | "Ανενεργή" | "Αναστολή";
  change_type: "Τροποποίηση" | "Παράταση" | "Έγκριση";
  comments: string;
  budget_versions: {
    pde: BudgetVersion[];
    epa: BudgetVersion[];
  };
}

export interface ChangeEntry {
  timestamp: string;
  user_id?: number;
  user_name: string;
  change_type: "Initial Creation" | "Budget Update" | "Status Change" | "Document Update" | "Other";
  description: string;
  notes: string;
}

export interface ComprehensiveFormData {
  decisions: DecisionData[];
  event_details: EventDetails;
  location_details: LocationDetail[];
  project_details: ProjectDetails;
  previous_entries: ProjectDetails[];
  formulation_details: FormulationDetail[];
  changes: ChangeEntry[];
}

// Decision origin information for auto-inheritance display
export interface DecisionOrigin {
  isInherited: boolean;
  inheritedFromVersion: number | null;
}

// SA validation state for real-time checks
export interface SAValidationState {
  isChecking: boolean;
  exists: boolean;
  existingProject?: {
    id: number;
    mis: number;
    project_title: string;
  };
}