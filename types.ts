export interface Borrower {
  id: string;
  name: string;
  phone: string;
  address: string;
  id_image_url?: string;
  created_at?: string;
}

export interface Loan {
  id: string;
  borrower_id: string;
  principal: number;
  interest_rate: number; // usually 20 for 5-6
  total_payable: number;
  balance: number;
  start_date: string;
  due_date: string;
  status: 'active' | 'paid' | 'defaulted';
  payment_frequency?: 'daily' | 'weekly' | 'monthly' | 'lump_sum';
  created_at?: string;
  borrowers?: Borrower; // joined data
  notes?: string;
}

export interface Payment {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  notes?: string;
  created_at?: string;
}

export interface DashboardStats {
  totalLent: number;
  totalCollected: number;
  outstandingBalance: number;
  activeLoansCount: number;
}