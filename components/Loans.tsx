import React, { useState } from 'react';
import { Borrower, Loan, Payment } from '../types';
import { supabase } from '../lib/supabase';
import { analyzeStanding } from '../utils/analytics';
import { Banknote, ArrowLeft, User, Phone, MapPin, History, Filter, AlertTriangle, CheckCircle, AlertOctagon, Calendar, Calculator, Clock, Copy, StickyNote, Edit, Save, X } from 'lucide-react';

interface LoansProps {
  borrowers: Borrower[];
  loans: Loan[];
  payments: Payment[];
  onUpdate: () => void;
}

export const Loans: React.FC<LoansProps> = ({ borrowers, loans, payments, onUpdate }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paid' | 'defaulted'>('all');

  // Form State
  const [borrowerId, setBorrowerId] = useState('');
  const [principal, setPrincipal] = useState<number | string>('');
  const [interestRate, setInterestRate] = useState(20); // Default 5-6 (20%)
  const [daysToPay, setDaysToPay] = useState<number | string>(60);
  const [paymentFrequency, setPaymentFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'lump_sum'>('daily');
  const [createNotes, setCreateNotes] = useState('');
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().split('T')[0]);

  // Edit Notes State
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesBuffer, setNotesBuffer] = useState('');
  const [updatingNotes, setUpdatingNotes] = useState(false);

  // Computed for preview
  const principalNum = Number(principal) || 0;
  const totalPayable = principalNum + (principalNum * (interestRate / 100));
  
  // Calculate Due Date
  const calculatedDueDate = new Date(releaseDate);
  calculatedDueDate.setDate(calculatedDueDate.getDate() + (Number(daysToPay) || 0));

  // Installment Calculation Helper
  const getInstallmentInfo = (total: number, days: number, freq: string) => {
    if (total <= 0 || days <= 0) return { amount: 0, count: 0 };
    
    let divisor = 1;
    switch (freq) {
      case 'daily': 
        divisor = days; 
        break;
      case 'weekly': 
        divisor = Math.ceil(days / 7); 
        break;
      case 'monthly': 
        divisor = Math.ceil(days / 30); 
        break;
      case 'lump_sum': 
        divisor = 1; 
        break;
      default: 
        divisor = days;
    }
    
    // Safety check
    if (divisor < 1) divisor = 1;

    return {
      amount: total / divisor,
      count: divisor
    };
  };

  const installmentInfo = getInstallmentInfo(totalPayable, Number(daysToPay) || 0, paymentFrequency);

  // Computed Borrower Standing for Form
  const selectedBorrowerLoans = loans.filter(l => l.borrower_id === borrowerId);
  const borrowerStanding = borrowerId ? analyzeStanding(selectedBorrowerLoans) : null;

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowerId || !principalNum) return;
    
    setLoading(true);

    const startDate = new Date(releaseDate);
    // Use the calculated due date
    const dueDate = calculatedDueDate;

    const { error } = await supabase.from('loans').insert([{
      borrower_id: borrowerId,
      principal: principalNum,
      interest_rate: interestRate,
      total_payable: totalPayable,
      balance: totalPayable, // Initial balance is total payable
      start_date: startDate.toISOString(),
      due_date: dueDate.toISOString(),
      payment_frequency: paymentFrequency,
      status: 'active',
      notes: createNotes
    }]);

    if (error) {
      alert(error.message);
    } else {
      setShowCreate(false);
      setPrincipal('');
      setBorrowerId('');
      setPaymentFrequency('daily');
      setCreateNotes('');
      setDaysToPay(60);
      setReleaseDate(new Date().toISOString().split('T')[0]);
      onUpdate();
    }
    setLoading(false);
  };

  const handleMarkDefault = async (loanId: string) => {
    if (!confirm('Are you sure you want to mark this loan as DEFAULTED? This will affect the borrower\'s standing.')) return;
    
    const { error } = await supabase
      .from('loans')
      .update({ status: 'defaulted' })
      .eq('id', loanId);

    if (error) {
      alert('Error updating status: ' + error.message);
    } else {
      onUpdate();
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedLoanId) return;
    setUpdatingNotes(true);
    
    const { error } = await supabase
      .from('loans')
      .update({ notes: notesBuffer })
      .eq('id', selectedLoanId);

    if (error) {
      alert('Failed to save notes: ' + error.message);
    } else {
      setIsEditingNotes(false);
      onUpdate();
    }
    setUpdatingNotes(false);
  };

  const startEditing = (currentNotes: string) => {
    setNotesBuffer(currentNotes || '');
    setIsEditingNotes(true);
  };

  // Logic for Detailed View
  const selectedLoan = selectedLoanId ? loans.find(l => l.id === selectedLoanId) : null;
  const selectedBorrower = selectedLoan ? borrowers.find(b => b.id === selectedLoan.borrower_id) : null;
  const loanPayments = selectedLoan ? payments.filter(p => p.loan_id === selectedLoan.id) : [];

  if (selectedLoan && selectedBorrower) {
    const percentagePaid = selectedLoan.total_payable > 0 
      ? ((selectedLoan.total_payable - selectedLoan.balance) / selectedLoan.total_payable) * 100 
      : 0;
    
    const detailStanding = analyzeStanding(loans.filter(l => l.borrower_id === selectedBorrower.id));
    
    // Calculate effective installment info for display based on stored data
    // Approximation if we don't store daysToPay explicitly, we derive from dates
    const start = new Date(selectedLoan.start_date);
    const end = selectedLoan.due_date ? new Date(selectedLoan.due_date) : new Date();
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const currentInstallmentInfo = getInstallmentInfo(selectedLoan.total_payable, diffDays, selectedLoan.payment_frequency || 'daily');

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => { setSelectedLoanId(null); setIsEditingNotes(false); }} 
            className="p-2 hover:bg-slate-200 rounded-full transition group"
            title="Back to List"
          >
            <ArrowLeft size={24} className="text-slate-600 group-hover:text-slate-900"/>
          </button>
          <h2 className="text-2xl font-bold text-slate-800">Loan Details</h2>
        </div>
        
        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Loan Info */}
          <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Banknote className="text-emerald-600" size={20} />
                  Loan #{selectedLoan.id.slice(0, 8)}
                  <button 
                    onClick={() => { navigator.clipboard.writeText(selectedLoan.id); alert('Full Loan ID copied to clipboard!'); }}
                    className="text-slate-400 hover:text-emerald-600 transition p-1 rounded hover:bg-emerald-50"
                    title="Copy Full ID for Borrower"
                  >
                    <Copy size={16} />
                  </button>
                </h3>
                <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                   <Calendar size={14} /> Created {new Date(selectedLoan.start_date).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                 <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  selectedLoan.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 
                  selectedLoan.status === 'active' ? 'bg-blue-100 text-blue-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {selectedLoan.status.toUpperCase()}
                </span>
                <span className="text-xs font-semibold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded">
                   {selectedLoan.payment_frequency || 'Daily'} Payment
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Principal</p>
                <p className="text-lg font-mono text-slate-700">₱{selectedLoan.principal.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Interest</p>
                <p className="text-lg font-mono text-emerald-600">{selectedLoan.interest_rate}%</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Total Payable</p>
                <p className="text-lg font-mono text-slate-700">₱{selectedLoan.total_payable.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Due Date</p>
                <p className="text-lg text-slate-700">{selectedLoan.due_date ? new Date(selectedLoan.due_date).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>

             {/* Installment Guide */}
             <div className="mb-6 p-3 bg-indigo-50 rounded-lg border border-indigo-100 flex items-center gap-3">
               <div className="p-2 bg-indigo-100 rounded-full text-indigo-600">
                 <Calculator size={18} />
               </div>
               <div>
                 <p className="text-xs font-semibold text-indigo-800 uppercase">Target Installment</p>
                 <p className="text-indigo-900 text-sm font-medium">
                   ₱{Math.ceil(currentInstallmentInfo.amount).toLocaleString()} / {selectedLoan.payment_frequency?.replace('_', ' ') || 'day'} 
                   <span className="opacity-60 font-normal"> ({currentInstallmentInfo.count} gives)</span>
                 </p>
               </div>
             </div>

            <div className="bg-slate-50 p-4 rounded-xl mb-6">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Outstanding Balance</p>
                  <p className="text-3xl font-bold text-slate-800">₱{selectedLoan.balance.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-600">{Math.round(percentagePaid)}% Paid</p>
                </div>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div 
                  className="bg-emerald-500 h-3 rounded-full transition-all duration-500" 
                  style={{ width: `${percentagePaid}%` }}
                ></div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="border-t border-slate-100 pt-5">
              <div className="flex justify-between items-center mb-3">
                 <h4 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                   <StickyNote size={16} /> Notes & Conditions
                 </h4>
                 {!isEditingNotes && (
                   <button 
                     onClick={() => startEditing(selectedLoan.notes || '')}
                     className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                   >
                     <Edit size={12} /> Edit
                   </button>
                 )}
              </div>
              
              {isEditingNotes ? (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <textarea 
                    className="w-full bg-white border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none min-h-[100px]"
                    value={notesBuffer}
                    onChange={(e) => setNotesBuffer(e.target.value)}
                    placeholder="Enter notes about this loan..."
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button 
                      onClick={() => setIsEditingNotes(false)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded flex items-center gap-1"
                    >
                      <X size={12} /> Cancel
                    </button>
                    <button 
                      onClick={handleSaveNotes}
                      disabled={updatingNotes}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded flex items-center gap-1"
                    >
                      {updatingNotes ? 'Saving...' : <><Save size={12} /> Save Note</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100 text-sm text-slate-700 whitespace-pre-wrap">
                  {selectedLoan.notes ? selectedLoan.notes : <span className="text-slate-400 italic">No notes added.</span>}
                </div>
              )}
            </div>

            {selectedLoan.status === 'active' && (
              <div className="flex justify-end mt-6 pt-4 border-t border-slate-100">
                <button 
                  onClick={() => handleMarkDefault(selectedLoan.id)}
                  className="text-red-600 text-sm font-medium hover:underline flex items-center gap-1"
                >
                  <AlertOctagon size={14}/> Mark as Defaulted
                </button>
              </div>
            )}
          </div>

          {/* Borrower Info */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-full">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
              <User className="text-indigo-500" size={20} />
              Borrower Info
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Name</p>
                <p className="text-lg font-medium text-slate-800">{selectedBorrower.name}</p>
                
                {/* Borrower Standing */}
                <div className={`mt-2 p-2 rounded text-xs border flex items-start gap-2 ${detailStanding.color}`}>
                   {detailStanding.status === 'Good Payer' ? <CheckCircle size={14} className="shrink-0 mt-0.5"/> : <AlertTriangle size={14} className="shrink-0 mt-0.5"/>}
                   <div>
                     <span className="font-bold block uppercase">{detailStanding.status}</span>
                     <span className="opacity-90 leading-tight block">{detailStanding.reason}</span>
                   </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone size={18} className="text-slate-400 mt-1"/>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Phone</p>
                  <p className="text-slate-700">{selectedBorrower.phone || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={18} className="text-slate-400 mt-1"/>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Address</p>
                  <p className="text-slate-700">{selectedBorrower.address || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <History className="text-slate-400" size={20} />
              Payment History
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-sm">
                <tr>
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Payment ID</th>
                  <th className="p-4 font-medium text-right">Amount</th>
                  <th className="p-4 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loanPayments.length > 0 ? (
                  loanPayments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-4 text-slate-700">
                        {new Date(p.payment_date).toLocaleDateString()}
                        <div className="text-xs text-slate-400">{new Date(p.payment_date).toLocaleTimeString()}</div>
                      </td>
                      <td className="p-4 text-xs text-slate-400 font-mono">{p.id.slice(0, 8)}</td>
                      <td className="p-4 text-right font-bold text-emerald-600">+ ₱{p.amount.toLocaleString()}</td>
                      <td className="p-4 text-sm text-slate-500 italic">{p.notes || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">No payments recorded for this loan yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  const filteredLoans = loans.filter(loan => {
    if (filterStatus === 'all') return true;
    return loan.status === filterStatus;
  });

  // List View
  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Loans Management</h2>
        <button 
          onClick={() => setShowCreate(!showCreate)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition"
        >
          <Banknote size={18} /> New Loan
        </button>
      </div>

      {showCreate && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-emerald-100 animate-in fade-in slide-in-from-top-4">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Create New Loan (5-6 System)</h3>
          <form onSubmit={handleCreateLoan} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Borrower</label>
                <select 
                  required
                  className="w-full border p-2.5 rounded-lg bg-slate-50"
                  value={borrowerId}
                  onChange={e => setBorrowerId(e.target.value)}
                >
                  <option value="">Select a borrower...</option>
                  {borrowers.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>

                {/* Borrower Standing Alert in Form */}
                {borrowerStanding && (
                  <div className={`mt-3 p-3 rounded-lg border text-sm flex items-start gap-3 ${borrowerStanding.color}`}>
                    {borrowerStanding.status === 'Delinquent' ? (
                       <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                    ) : (
                       <CheckCircle className="shrink-0 mt-0.5" size={18} />
                    )}
                    <div>
                      <span className="font-bold block uppercase">{borrowerStanding.status}</span>
                      <p>{borrowerStanding.reason}</p>
                      {borrowerStanding.status === 'Delinquent' && (
                        <p className="font-bold mt-1 underline">Proceed with caution.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Principal (₱)</label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      className="w-full border p-2.5 rounded-lg text-lg font-semibold"
                      value={principal}
                      onChange={e => setPrincipal(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Interest (%)</label>
                    <input 
                        type="number" 
                        className="w-full border p-2.5 rounded-lg"
                        value={interestRate}
                        onChange={e => setInterestRate(Number(e.target.value))}
                    />
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Date Released</label>
                    <input 
                        type="date"
                        required
                        className="w-full border p-2.5 rounded-lg"
                        value={releaseDate}
                        onChange={e => setReleaseDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Days to Pay</label>
                    <input 
                        type="number" 
                        required
                        className="w-full border p-2.5 rounded-lg"
                        value={daysToPay}
                        onChange={e => setDaysToPay(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>
              </div>
              
              {/* Payment Frequency Dropdown */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Terms of Payment</label>
                <select 
                  className="w-full border p-2.5 rounded-lg bg-slate-50"
                  value={paymentFrequency}
                  onChange={e => setPaymentFrequency(e.target.value as any)}
                >
                  <option value="daily">Daily (Araw-araw)</option>
                  <option value="weekly">Weekly (Lingguhan)</option>
                  <option value="monthly">Monthly (Buwanan)</option>
                  <option value="lump_sum">Lump Sum (Isang Bagsakan)</option>
                </select>
              </div>

            </div>

            <div className="bg-slate-50 p-6 rounded-xl flex flex-col space-y-4">
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Summary</div>
              
              <div className="flex justify-between items-center text-slate-600">
                <span>Principal</span>
                <span className="font-mono">₱{principalNum.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Interest ({interestRate}%)</span>
                <span className="font-mono text-emerald-600">+ ₱{(principalNum * (interestRate/100)).toLocaleString()}</span>
              </div>
              
              <div className="h-px bg-slate-200 my-2"></div>
              
              <div className="flex justify-between items-center text-slate-600">
                 <span className="flex items-center gap-1"><Clock size={14}/> Due Date</span>
                 <span className="font-medium text-slate-800">{calculatedDueDate.toLocaleDateString()}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-slate-800">Total Payable</span>
                <span className="text-2xl font-bold text-emerald-600">₱{totalPayable.toLocaleString()}</span>
              </div>

              {/* Installment Preview */}
              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg mt-2">
                 <div className="text-xs text-indigo-800 font-semibold uppercase mb-1">Expected {paymentFrequency.replace('_', ' ')} Installment</div>
                 <div className="flex justify-between items-center">
                   <span className="text-lg font-bold text-indigo-700">₱{Math.ceil(installmentInfo.amount).toLocaleString()}</span>
                   <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full">{installmentInfo.count} gives</span>
                 </div>
              </div>

              {/* Notes Input in Create Form */}
              <div className="mt-2">
                <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <StickyNote size={14} /> Notes (Optional)
                </label>
                <textarea 
                  className="w-full border p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-100 outline-none"
                  rows={2}
                  placeholder="Additional conditions or remarks..."
                  value={createNotes}
                  onChange={e => setCreateNotes(e.target.value)}
                />
              </div>
              
              <button disabled={loading} className="w-full bg-slate-800 text-white py-3 rounded-lg font-medium mt-auto hover:bg-slate-900 transition">
                {loading ? 'Processing...' : 'Confirm Loan Release'}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Filter Buttons */}
      <div className="flex gap-2 pb-2">
        {['all', 'active', 'paid', 'defaulted'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              filterStatus === status 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-slate-500 text-sm border-b border-slate-200 bg-slate-50">
              <th className="font-medium p-4">Borrower</th>
              <th className="font-medium p-4">Date Released</th>
              <th className="font-medium p-4">Due Date</th>
              <th className="font-medium p-4">Term</th>
              <th className="font-medium p-4 text-right">Principal</th>
              <th className="font-medium p-4 text-right">Balance</th>
              <th className="font-medium p-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {filteredLoans.map(loan => {
               const borrower = borrowers.find(b => b.id === loan.borrower_id);
               return (
                 <tr 
                   key={loan.id} 
                   onClick={() => setSelectedLoanId(loan.id)}
                   className="border-b border-slate-100 hover:bg-slate-50 transition cursor-pointer group last:border-0"
                 >
                   <td className="p-4 font-medium group-hover:text-emerald-700 transition-colors">{borrower?.name || 'Unknown'}</td>
                   <td className="p-4 text-sm text-slate-500">{new Date(loan.start_date).toLocaleDateString()}</td>
                   <td className="p-4 text-sm text-slate-500">{loan.due_date ? new Date(loan.due_date).toLocaleDateString() : '-'}</td>
                   <td className="p-4 text-xs text-slate-500 uppercase font-semibold">{loan.payment_frequency || 'Daily'}</td>
                   <td className="p-4 text-right font-mono text-slate-600">₱{loan.principal.toLocaleString()}</td>
                   <td className="p-4 text-right font-bold text-slate-800">₱{loan.balance.toLocaleString()}</td>
                   <td className="p-4 text-center">
                     <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                       loan.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 
                       loan.status === 'active' ? 'bg-blue-100 text-blue-700' :
                       'bg-red-100 text-red-700'
                     }`}>
                       {loan.status.toUpperCase()}
                     </span>
                   </td>
                 </tr>
               )
            })}
            {filteredLoans.length === 0 && (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <Filter className="opacity-20" size={48} />
                    <p>No loans found with status "{filterStatus}".</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};