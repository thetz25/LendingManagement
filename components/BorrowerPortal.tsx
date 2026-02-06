import React, { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Loan, Borrower, Payment } from '../types';
import { Search, ShieldCheck, Banknote, Calendar, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, Smartphone, MapPin, Clock, CalendarDays, ChevronDown, ChevronUp, ScrollText } from 'lucide-react';

export const BorrowerPortal: React.FC = () => {
  const [loanId, setLoanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [loanData, setLoanData] = useState<Loan | null>(null);
  const [borrowerData, setBorrowerData] = useState<Borrower | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [showFullSchedule, setShowFullSchedule] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanId.trim()) return;

    setLoading(true);
    setError(null);
    setLoanData(null);

    try {
      const searchTerm = loanId.trim();
      let targetLoanId = searchTerm;

      // STEP 1: RESOLVE TARGET ID
      if (searchTerm.length !== 36) {
        const { data: allLoans, error: listError } = await supabase
          .from('loans')
          .select('id')
          .order('created_at', { ascending: false });

        if (listError) throw listError;

        const match = allLoans?.find((l: any) => l.id.toLowerCase().startsWith(searchTerm.toLowerCase()));
        
        if (!match) {
           throw new Error("No loan found with that ID reference.");
        }
        targetLoanId = match.id;
      }

      // STEP 2: FETCH FULL DETAILS
      const { data: loan, error: loanError } = await supabase
        .from('loans')
        .select('*')
        .eq('id', targetLoanId)
        .single();

      if (loanError || !loan) {
        throw new Error("Loan Record not found.");
      }

      // STEP 3: FETCH BORROWER
      const { data: borrower, error: borrowerError } = await supabase
        .from('borrowers')
        .select('*')
        .eq('id', loan.borrower_id)
        .single();

      if (borrowerError) throw borrowerError;

      // STEP 4: FETCH PAYMENTS
      const { data: payments, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('loan_id', loan.id)
        .order('payment_date', { ascending: false });

      if (paymentError) throw paymentError;

      setLoanData(loan);
      setBorrowerData(borrower);
      setPaymentHistory(payments || []);

    } catch (err: any) {
      console.error(err);
      if (err.code === '22P02') {
         setError("Invalid ID format. Please check the code provided.");
      } else {
         setError(err.message || "Unable to retrieve loan details.");
      }
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setLoanId('');
    setLoanData(null);
    setBorrowerData(null);
    setPaymentHistory([]);
    setError(null);
    setShowFullSchedule(false);
  };

  // --- SCHEDULE GENERATION ---
  const schedule = useMemo(() => {
    if (!loanData) return [];
    
    const dates: { date: Date, isPast: boolean, isToday: boolean }[] = [];
    const start = new Date(loanData.start_date);
    const end = loanData.due_date ? new Date(loanData.due_date) : new Date();
    const freq = loanData.payment_frequency || 'daily';
    
    // Normalize today for comparison
    const today = new Date();
    today.setHours(0,0,0,0);

    let current = new Date(start);

    // Function to increment date based on frequency
    const incrementDate = (d: Date) => {
      const next = new Date(d);
      if (freq === 'daily') next.setDate(next.getDate() + 1);
      else if (freq === 'weekly') next.setDate(next.getDate() + 7);
      else if (freq === 'monthly') next.setMonth(next.getMonth() + 1);
      else if (freq === 'lump_sum') return end; // Jump to end
      else next.setDate(next.getDate() + 1); // Default daily
      return next;
    };

    // If lump sum, just push due date
    if (freq === 'lump_sum') {
      dates.push({ 
        date: end, 
        isPast: end < today,
        isToday: end.getTime() === today.getTime()
      });
    } else {
      // Loop until due date
      current = incrementDate(current); // Start from first payment date (start + 1 period)
      
      // Safety break to prevent infinite loops on bad data
      let safetyCounter = 0;
      while (current <= end && safetyCounter < 1000) {
        // Compare dates without time
        const currentZero = new Date(current);
        currentZero.setHours(0,0,0,0);

        dates.push({
          date: new Date(current),
          isPast: currentZero < today,
          isToday: currentZero.getTime() === today.getTime()
        });
        
        current = incrementDate(current);
        safetyCounter++;
      }
    }

    const amountPerPayment = Math.ceil(loanData.total_payable / (dates.length || 1));

    return dates.map(d => ({ ...d, amount: amountPerPayment }));
  }, [loanData]);


  // --- CALCULATION LOGIC FOR DUE TODAY ---
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const isDueToday = loanData && loanData.status === 'active' && schedule.some(s => s.isToday);
  
  // Filter payments made TODAY in local time
  const paymentsToday = paymentHistory.filter(p => {
    const pDate = new Date(p.payment_date).toISOString().split('T')[0];
    return pDate === todayStr;
  });
  
  // Get installment amount from schedule
  const currentInstallmentAmount = schedule.length > 0 ? schedule[0].amount : 0;

  const amountPaidToday = paymentsToday.reduce((acc, curr) => acc + curr.amount, 0);
  const remainingDueToday = Math.max(0, currentInstallmentAmount - amountPaidToday);
  const isFullyPaidToday = amountPaidToday >= currentInstallmentAmount;

  // Render Search View
  if (!loanData || !borrowerData) {
    return (
      <div className="max-w-md mx-auto mt-12 animate-in fade-in slide-in-from-bottom-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 ring-4 ring-emerald-50/50">
            <ShieldCheck size={32} />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Check Loan Status</h2>
          <p className="text-slate-500 mb-8 text-sm leading-relaxed">
            Enter the Loan ID provided by your lending agent to securely view your current balance and history.
          </p>

          <form onSubmit={handleSearch} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">Loan ID Reference</label>
              <div className="relative group">
                <Search className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                <input 
                  type="text" 
                  required
                  placeholder="e.g. b7aa9a9d..."
                  className="w-full pl-10 p-3.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition font-mono text-sm shadow-sm"
                  value={loanId}
                  onChange={(e) => setLoanId(e.target.value)}
                />
              </div>
            </div>

            <button 
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 active:scale-95 transform duration-100"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Verifying...
                </>
              ) : (
                <>View Account <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-rose-50 text-rose-600 rounded-xl text-sm flex items-start gap-3 justify-start border border-rose-100 text-left">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const percentagePaid = loanData.total_payable > 0 
    ? ((loanData.total_payable - loanData.balance) / loanData.total_payable) * 100 
    : 0;

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 pb-12">
      <button 
        onClick={clearSearch}
        className="mb-6 text-slate-400 hover:text-slate-700 flex items-center gap-2 text-sm font-medium transition group"
      >
        <div className="p-1 rounded-full bg-slate-200 group-hover:bg-slate-300 transition">
          <ArrowRight className="rotate-180 text-slate-600" size={14} /> 
        </div>
        Back to Search
      </button>

      {/* Main Card */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 ring-1 ring-slate-900/5">
        <div className="bg-slate-900 p-8 text-white flex justify-between items-start relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

          <div className="relative z-10">
            <h1 className="text-2xl font-bold tracking-tight">Loan Details</h1>
            <p className="text-emerald-400 font-mono text-sm mt-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              ID: {loanData.id.slice(0, 13)}...
            </p>
          </div>
          <div className={`relative z-10 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg ${
             loanData.status === 'active' ? 'bg-emerald-500 text-white' : 
             loanData.status === 'paid' ? 'bg-blue-500 text-white' : 'bg-rose-500 text-white'
          }`}>
            {loanData.status}
          </div>
        </div>

        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-400 border border-slate-100">
               <ShieldCheck size={28} />
             </div>
             <div>
               <h3 className="font-bold text-slate-800 text-lg">{borrowerData.name}</h3>
               <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 mt-1">
                 {borrowerData.phone && <span className="flex items-center gap-1.5"><Smartphone size={14} className="text-slate-400"/> {borrowerData.phone}</span>}
                 {borrowerData.address && <span className="flex items-center gap-1.5"><MapPin size={14} className="text-slate-400"/> {borrowerData.address}</span>}
               </div>
             </div>
          </div>
        </div>

        {/* --- DUE TODAY ALERT SECTION --- */}
        {isDueToday && (
           <div className={`p-5 border-b border-slate-100 flex items-center gap-4 ${
             isFullyPaidToday 
               ? 'bg-emerald-50 text-emerald-800' 
               : amountPaidToday > 0 
                 ? 'bg-amber-50 text-amber-800'
                 : 'bg-rose-50 text-rose-800'
           }`}>
             <div className={`p-2.5 rounded-full shrink-0 ${
                isFullyPaidToday ? 'bg-emerald-100' : amountPaidToday > 0 ? 'bg-amber-100' : 'bg-rose-100'
             }`}>
                {isFullyPaidToday ? <CheckCircle2 size={24}/> : <Clock size={24}/>}
             </div>
             <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wide opacity-80 mb-0.5">
                   {isFullyPaidToday ? 'Status Update' : 'Payment Reminder'}
                </p>
                
                {isFullyPaidToday ? (
                  <p className="font-bold text-lg leading-tight">Great job! Payment received for today.</p>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                     <p className="font-bold text-lg leading-tight">
                        Payment Due Today
                     </p>
                     <p className="text-sm font-medium opacity-90">
                       Expected: <span className="font-bold text-lg">₱{remainingDueToday.toLocaleString()}</span>
                     </p>
                  </div>
                )}
                
                {amountPaidToday > 0 && !isFullyPaidToday && (
                  <p className="text-xs mt-1 font-medium">
                     You paid ₱{amountPaidToday.toLocaleString()} today. ₱{remainingDueToday.toLocaleString()} remaining.
                  </p>
                )}
             </div>
           </div>
        )}

        <div className="p-8">
           <div className="text-center mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Outstanding Balance</p>
             <div className="text-5xl font-black text-slate-900 tracking-tight">
               <span className="text-2xl font-bold text-slate-400 align-top mr-1">₱</span>
               {loanData.balance.toLocaleString()}
             </div>
             <p className="text-sm text-slate-500 mt-2">
               Original Loan: ₱{loanData.principal.toLocaleString()}
             </p>
           </div>

           {/* Progress Bar */}
           <div className="mb-10">
             <div className="flex justify-between text-sm font-bold mb-3">
               <span className="text-emerald-600">{Math.round(percentagePaid)}% Paid</span>
               <span className="text-slate-300">Goal: 100%</span>
             </div>
             <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
               <div 
                 className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-1000 ease-out shadow-lg shadow-emerald-200" 
                 style={{ width: `${percentagePaid}%` }}
               />
             </div>
           </div>

           {/* NEW SECTION: Loan Terms Details */}
           <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-8">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                 <ScrollText size={18} className="text-emerald-500"/>
                 <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Loan Terms & Conditions</h3>
              </div>
              
              <div className="space-y-3 text-sm">
                 <div className="flex justify-between">
                    <span className="text-slate-500">Principal Amount</span>
                    <span className="font-medium text-slate-900">₱{loanData.principal.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-slate-500">Interest Rate</span>
                    <span className="font-medium text-emerald-600">+{loanData.interest_rate}%</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-slate-500">Schedule</span>
                    <span className="font-medium text-slate-900 capitalize">{loanData.payment_frequency?.replace('_', ' ') || 'Daily'}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-slate-500">Start Date</span>
                    <span className="font-medium text-slate-900">{new Date(loanData.start_date).toLocaleDateString()}</span>
                 </div>
                 
                 <div className="pt-3 border-t border-slate-100 flex justify-between items-center mt-2">
                    <span className="text-slate-500 font-medium">Estimated Installment</span>
                    <span className="font-bold text-slate-900 text-lg">₱{currentInstallmentAmount.toLocaleString()}</span>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4 mb-10">
             <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
               <div className="flex items-center gap-2 text-slate-400 mb-2">
                 <Calendar size={18} />
                 <span className="text-xs font-bold uppercase tracking-wide">Due Date</span>
               </div>
               <p className="font-bold text-lg text-slate-800">
                 {loanData.due_date ? new Date(loanData.due_date).toLocaleDateString() : 'N/A'}
               </p>
               <p className="text-xs text-slate-400 mt-1">Term End</p>
             </div>
             <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
               <div className="flex items-center gap-2 text-slate-400 mb-2">
                 <Banknote size={18} />
                 <span className="text-xs font-bold uppercase tracking-wide">Total Payable</span>
               </div>
               <p className="font-bold text-lg text-slate-800">
                 ₱{loanData.total_payable.toLocaleString()}
               </p>
               <p className="text-xs text-slate-400 mt-1">Includes Interest</p>
             </div>
           </div>

           {/* Payment Schedule Section */}
           {schedule.length > 0 && (
             <div className="mb-10 bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
               <button 
                onClick={() => setShowFullSchedule(!showFullSchedule)}
                className="w-full p-4 flex justify-between items-center hover:bg-slate-100 transition"
               >
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                    <CalendarDays size={16} className="text-emerald-500"/> 
                    Payment Schedule <span className="text-xs font-normal text-slate-500 ml-1">({schedule.length} payments)</span>
                  </h3>
                  {showFullSchedule ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
               </button>
               
               {showFullSchedule && (
                  <div className="max-h-64 overflow-y-auto border-t border-slate-100">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 sticky top-0 text-xs font-semibold text-slate-500 uppercase">
                        <tr>
                          <th className="px-4 py-2">Date</th>
                          <th className="px-4 py-2 text-right">Target</th>
                          <th className="px-4 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {schedule.map((item, idx) => (
                          <tr key={idx} className={`${item.isToday ? 'bg-emerald-50' : 'hover:bg-white'} transition-colors`}>
                            <td className="px-4 py-3 text-slate-700">
                              <span className={item.isToday ? 'font-bold text-emerald-800' : ''}>
                                {item.date.toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                              </span>
                              <div className="text-[10px] text-slate-400">{item.date.toLocaleDateString(undefined, {weekday: 'short'})}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium text-slate-600">
                              ₱{item.amount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {item.isPast ? (
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Past</span>
                              ) : item.isToday ? (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full uppercase">Today</span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Upcoming</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               )}
               {!showFullSchedule && (
                 <div className="px-4 pb-4 text-xs text-slate-400 italic">
                   Tap to view full {loanData.payment_frequency} amortization schedule.
                 </div>
               )}
             </div>
           )}
           
           {/* Payment History */}
           <div>
             <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-5 flex items-center gap-2 border-b border-slate-100 pb-2">
               <RefreshCw size={16} className="text-emerald-500"/> Transaction History
             </h3>
             
             <div className="space-y-3">
               {paymentHistory.length > 0 ? (
                 paymentHistory.map((p) => (
                   <div key={p.id} className="flex justify-between items-center p-4 rounded-xl border border-slate-100 bg-white hover:border-emerald-100 hover:shadow-sm transition group">
                     <div className="flex items-center gap-4">
                       <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-full group-hover:bg-emerald-100 transition-colors">
                         <CheckCircle2 size={18} />
                       </div>
                       <div>
                         <p className="font-bold text-slate-700 text-sm">Payment Received</p>
                         <p className="text-xs text-slate-400 font-medium mt-0.5">{new Date(p.payment_date).toLocaleDateString()} • {new Date(p.payment_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                       </div>
                     </div>
                     <span className="font-bold text-emerald-600 font-mono text-lg">+₱{p.amount.toLocaleString()}</span>
                   </div>
                 ))
               ) : (
                 <div className="text-center py-12 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                   <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Banknote className="opacity-20" size={24}/>
                   </div>
                   <p className="text-sm">No payments recorded yet.</p>
                 </div>
               )}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};