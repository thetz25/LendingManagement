import { Loan } from '../types';

export interface BorrowerStanding {
  status: 'Good Payer' | 'Delinquent' | 'Neutral' | 'New';
  color: string;
  reason: string;
}

export const analyzeStanding = (loans: Loan[]): BorrowerStanding => {
  if (!loans || loans.length === 0) {
    return { status: 'New', color: 'text-slate-500 bg-slate-100 border-slate-200', reason: 'No history yet.' };
  }

  const total = loans.length;
  const paid = loans.filter(l => l.status === 'paid').length;
  const defaulted = loans.filter(l => l.status === 'defaulted').length;
  
  const today = new Date();
  // Check for active loans that are past due date (Overdue)
  // We use a simple date comparison.
  const overdue = loans.filter(l => 
    l.status === 'active' && 
    l.due_date && 
    new Date(l.due_date) < today
  ).length;

  // DELINQUENT RULES
  if (defaulted > 0) {
    return { 
      status: 'Delinquent', 
      color: 'text-red-700 bg-red-50 border-red-200', 
      reason: `Has ${defaulted} defaulted loan(s). High risk.` 
    };
  }

  if (overdue > 0) {
    return { 
      status: 'Delinquent', 
      color: 'text-rose-700 bg-rose-50 border-rose-200', 
      reason: `Has ${overdue} overdue active loan(s).` 
    };
  }

  // GOOD PAYER RULES
  if (paid > 0 && paid === total) {
    return { 
      status: 'Good Payer', 
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200', 
      reason: 'Perfect payment history. All loans paid.' 
    };
  }

  if (paid > 0) {
     return { 
      status: 'Good Payer', 
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200', 
      reason: `Has successfully paid ${paid} loan(s).` 
    };
  }

  // NEUTRAL
  return { 
    status: 'Neutral', 
    color: 'text-blue-700 bg-blue-50 border-blue-200', 
    reason: 'Active loans exist but no full payment history yet.' 
  };
};