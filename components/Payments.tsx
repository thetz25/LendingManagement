import React, { useState, useEffect } from 'react';
import { Borrower, Loan, Payment } from '../types';
import { supabase } from '../lib/supabase';
import { CheckCircle, History, Info, Calculator } from 'lucide-react';

interface PaymentsProps {
  borrowers: Borrower[];
  loans: Loan[];
  payments: Payment[];
  onUpdate: () => void;
  initialLoanId?: string | null;
}

export const Payments: React.FC<PaymentsProps> = ({ borrowers, loans, payments, onUpdate, initialLoanId }) => {
  const [amount, setAmount] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState(initialLoanId || '');
  const [loading, setLoading] = useState(false);

  // Sync prop to state when initialLoanId changes
  useEffect(() => {
    if (initialLoanId) {
      setSelectedLoanId(initialLoanId);
    }
  }, [initialLoanId]);

  // Filter only active loans for payment
  const activeLoans = loans.filter(l => l.balance > 0);

  // Derived state for the selected loan
  const selectedLoan = activeLoans.find(l => l.id === selectedLoanId);

  // Calculate Installment / Target Payment for the selected loan
  const getTargetPayment = (loan: Loan) => {
    const start = new Date(loan.start_date);
    const end = loan.due_date ? new Date(loan.due_date) : new Date();
    const diffDays = Math.max(1, Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    
    let divisor = 1;
    const freq = loan.payment_frequency || 'daily';
    
    switch (freq) {
      case 'daily': divisor = diffDays; break;
      case 'weekly': divisor = Math.max(1, Math.ceil(diffDays / 7)); break;
      case 'monthly': divisor = Math.max(1, Math.ceil(diffDays / 30)); break;
      case 'lump_sum': divisor = 1; break;
      default: divisor = diffDays;
    }
    
    return {
      amount: Math.ceil(loan.total_payable / divisor),
      frequency: freq
    };
  };

  const targetInfo = selectedLoan ? getTargetPayment(selectedLoan) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId || !amount) return;
    
    setLoading(true);
    const numAmount = Number(amount);
    
    // 1. Record Payment
    const { error: payError } = await supabase.from('payments').insert([{
      loan_id: selectedLoanId,
      amount: numAmount,
      payment_date: new Date().toISOString()
    }]);

    if (payError) {
      alert(payError.message);
      setLoading(false);
      return;
    }

    // 2. Update Loan Balance
    const loan = loans.find(l => l.id === selectedLoanId);
    if (loan) {
      const newBalance = Math.max(0, loan.balance - numAmount);
      const newStatus = newBalance === 0 ? 'paid' : 'active';
      
      const { error: updateError } = await supabase
        .from('loans')
        .update({ balance: newBalance, status: newStatus })
        .eq('id', selectedLoanId);

      if (updateError) console.error("Balance update failed", updateError);
    }

    setLoading(false);
    setAmount('');
    // Optionally keep the selected loan ID to allow multiple payments or clear it. 
    // Clearing it feels safer to avoid double entry mistakes.
    setSelectedLoanId(''); 
    onUpdate();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Payment Form */}
      <div className="lg:col-span-1">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 sticky top-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle className="text-emerald-500" />
            Record Collection
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Select Borrower / Loan</label>
              <select 
                required
                className="w-full border p-3 rounded-lg bg-slate-50"
                value={selectedLoanId}
                onChange={e => setSelectedLoanId(e.target.value)}
              >
                <option value="">Choose active loan...</option>
                {activeLoans.map(l => {
                  const b = borrowers.find(br => br.id === l.borrower_id);
                  return (
                    <option key={l.id} value={l.id}>
                      {b?.name}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Target Payment Info Box */}
            {selectedLoan && targetInfo && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-100 p-2 rounded-full text-indigo-600 shrink-0">
                    <Calculator size={18} />
                  </div>
                  <div className="w-full">
                     <p className="text-xs font-bold text-indigo-800 uppercase mb-1">Payment Details</p>
                     
                     <div className="flex justify-between items-center mb-1">
                       <span className="text-sm text-indigo-900 opacity-80">Current Balance:</span>
                       <span className="font-bold text-indigo-900">₱{selectedLoan.balance.toLocaleString()}</span>
                     </div>
                     
                     <div className="flex justify-between items-center border-t border-indigo-200 pt-2 mt-1">
                       <span className="text-sm font-semibold text-indigo-700">Target ({targetInfo.frequency}):</span>
                       <span className="text-lg font-bold text-indigo-700">₱{targetInfo.amount.toLocaleString()}</span>
                     </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Amount Collected (₱)</label>
              <input 
                type="number" 
                required
                min="1"
                className="w-full border p-3 rounded-lg text-2xl font-bold text-emerald-600"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>

            <button 
              disabled={loading || activeLoans.length === 0} 
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm Payment'}
            </button>
          </form>
        </div>
      </div>

      {/* History */}
      <div className="lg:col-span-2">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <History className="text-slate-400" />
            Recent Collections
          </h2>
          
          <div className="space-y-3">
            {payments.slice(0, 10).map(payment => {
              const loan = loans.find(l => l.id === payment.loan_id);
              const borrower = borrowers.find(b => b.id === loan?.borrower_id);
              
              return (
                <div key={payment.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg border-b border-slate-50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                      ₱
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{borrower?.name || 'Unknown'}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-600">+ ₱{payment.amount.toLocaleString()}</div>
                    <div className="text-xs text-slate-400">Payment ID: {payment.id.slice(0,4)}</div>
                  </div>
                </div>
              );
            })}
            {payments.length === 0 && <p className="text-slate-400 text-center py-4">No payments recorded yet.</p>}
          </div>
        </div>
      </div>

    </div>
  );
};