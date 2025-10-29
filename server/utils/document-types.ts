export interface UserDetails {
  name: string;
  email?: string;
  contact_number?: string;
  telephone?: string;
  department?: string;
  descr?: string;
  details?: {
    gender?: 'male' | 'female';
    specialty?: string;
  };
}

export interface UnitDetails {
  unit: string;
  name?: string;
  unit_name?: {
    name: string;
    prop: string;
    propgen?: string; // Genitive case (γενική πτώση) for ΕΚΤΟΣ ΕΔΡΑΣ documents
    namegen?: string; // Name in genitive case (γενική πτώση)
  };
  manager?: {
    name: string;
    order: string;
    title: string;
    degree: string;
    prepose?: string;
  };
  email?: string;
  address?: {
    address: string;
    tk: string;
    region: string;
  };
  parts?: {
    [key: string]: {
      tmima?: string;
      manager?: {
        name: string;
        order?: string;
        title?: string;
        degree?: string;
      };
      [key: string]: any;
    };
  };
}

export interface DocumentData {
  id: number;
  unit: string; // Mapped from unit_id for compatibility
  unit_id?: bigint | number; // Actual database field
  project_id?: string | number;
  project_index_id?: number; // Reference to project_index table
  projects?: {
    id: string | number;
    name?: string;
    title?: string;
    project_title?: string;
    event_description?: string;
    description?: string;
    na853?: string;
    budget_na853?: string;
    mis?: string | number;
    start_date?: string;
    end_date?: string;
    budget?: number;
    expenditure_types?: string[];
  }[];
  project_na853?: string;
  project_title?: string;
  expenditure_type: string;
  status?: string;
  total_amount?: number;
  protocol_number?: string;
  protocol_number_input?: string;
  protocol_date?: string;
  user_name?: string;
  user_id?: number;
  attachments?: string[];
  attachment_id?: number[]; // Array of attachment IDs from database
  esdian?: string[];
  contact_number?: string;
  department?: string;
  created_at?: string;
  updated_at?: string;
  is_correction?: boolean;
  original_protocol_number?: string;
  original_protocol_date?: string;
  comments?: string;
  generated_by?: UserDetails;
  beneficiary_payments_id?: number[]; // Array of beneficiary payment IDs
  director_signature?: {
    name: string;
    order: string;
    title: string;
    degree?: string;
    prepose?: string;
  };
  recipients?: Array<{
    id?: number;
    firstname: string;
    lastname: string;
    fathername: string;
    afm: string;
    amount: number;
    installment: number | string;
    installments?: string[];
    installmentAmounts?: Record<string, number>;
    secondary_text?: string;
    payment_type?: string;
    address?: string;
    phone?: string;
    email?: string;
  }>;
}