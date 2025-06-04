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
  project_id?: string | number;
  projects?: {
    id: string | number;
    name: string;
    title?: string;
    description?: string;
    na853?: string;
    mis?: string;
    start_date?: string;
    end_date?: string;
    budget?: number;
    expenditure_types?: string[];
  }[];
  project_na853?: string;
  expenditure_type: string;
  status?: string;
  total_amount?: number;
  protocol_number?: string;
  protocol_number_input?: string;
  protocol_date?: string;
  user_name?: string;
  user_id?: number;
  attachments?: string[];
  contact_number?: string;
  department?: string;
  created_at?: string;
  updated_at?: string;
  is_correction?: boolean;
  original_protocol_number?: string;
  original_protocol_date?: string;
  comments?: string;
  generated_by?: UserDetails;
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