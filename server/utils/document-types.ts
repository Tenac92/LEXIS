export interface UserDetails {
  name: string;
  email?: string;
  contact_number?: string;
  telephone?: string;
  department?: string;
  descr?: string;
}

export interface UnitDetails {
  unit: string;
  name?: string;
  unit_name?: {
    name: string;
    prop: string;
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
}

export interface DocumentData {
  id: number;
  unit: string;
  project_id?: string;
  project_na853?: string;
  expenditure_type: string;
  status?: string;
  total_amount?: number;
  protocol_number?: string;
  protocol_number_input?: string;
  protocol_date?: string;
  user_name?: string;
  attachments?: string[];
  contact_number?: string;
  department?: string;
  generated_by?: UserDetails;
  recipients?: Array<{
    firstname: string;
    lastname: string;
    fathername: string;
    afm: string;
    amount: number;
    installment: number | string;
    installments?: string[];
    installmentAmounts?: Record<string, number>;
    secondary_text?: string;
  }>;
}