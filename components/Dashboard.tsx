import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, Users, TrendingUp, AlertTriangle, Calendar, CheckCircle2, XCircle, Phone, ArrowRight } from 'lucide-react';
import { Loan, Payment, Borrower } from '../types';

interface DashboardProps {
  loans: Loan[];
  payments: Payment[];
  borrowers: Borrower[];
  onNavigateToPayment: (loanId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ loans, payments, borrowers, onNavigateToPayment }) => {
  // Date State for Collection Schedule
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const stats = useMemo(() => {
    const totalLent = loans.reduce((acc, curr) => acc + curr.principal, 0);
    const totalReceivable = loans.reduce((acc, curr) => acc + curr.total_payable, 0);
    const totalCollected = payments.reduce((acc, curr) => acc + curr.amount, 0);
    const outstanding = totalReceivable - totalCollected;
    const simpleProfit = totalCollected - totalLent; 

    return { totalLent, totalCollected, outstanding, simpleProfit };
  }, [loans, payments]);

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const dayPayments = payments.filter(p => p.payment_date.startsWith(date));
      const amount = dayPayments.reduce((sum, p) => sum + p.amount, 0);
      return { date, amount };
    });
  }, [payments]);

  // Collection Schedule Logic
  const scheduledCollections = useMemo(() => {
    const targetDate = new Date(selectedDate);
    const targetDayOfWeek = targetDate.getDay(); // 0-6
    const targetDayOfMonth = targetDate.getDate(); // 1-31

    return loans
      .filter(loan => {
        // Only active or defaulted loans need collection
        if (loan.status !== 'active' && loan.status !== 'defaulted') return false;
        
        // Check if loan started before or on selected date
        const startDate = new Date(loan.start_date);
        const selectedTime = new Date(selectedDate).setHours(0,0,0,0);
        const startTime = startDate.setHours(0,0,0,0);
        
        if (selectedTime < startTime) return false;

        // Check Frequency
        switch (loan.payment_frequency) {
          case 'weekly':
            // Match day of week (e.g., every Monday)
            return startDate.getDay() === targetDayOfWeek;
          case 'monthly':
            // Match day of month (e.g., every 15th)
            return startDate.getDate() === targetDayOfMonth;
          case 'lump_sum':
            // Only show on due date
            const dueDate = new Date(loan.due_date);
            return dueDate.toISOString().split('T')[0] === selectedDate;
          case 'daily':
          default:
            // Daily loans are always due if active
            return true;
        }
      })
      .map(loan => {
        const borrower = borrowers.find(b => b.id === loan.borrower_id);
        
        // Check if paid TODAY (on selected date)
        const paymentToday = payments.find(p => 
          p.loan_id === loan.id && 
          p.payment_date.startsWith(selectedDate)
        );

        // Estimate Daily/Target Installment
        const start = new Date(loan.start_date);
        const end = loan.due_date ? new Date(loan.due_date) : new Date();
        const diffDays = Math.max(1, Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        
        let divisor = 1;
        if (loan.payment_frequency === 'daily') divisor = diffDays;
        else if (loan.payment_frequency === 'weekly') divisor = Math.max(1, Math.ceil(diffDays / 7));
        else if (loan.payment_frequency === 'monthly') divisor = Math.max(1, Math.ceil(diffDays / 30));

        const targetAmount = loan.total_payable / divisor;

        return {
          loan,
          borrower,
          targetAmount,
          paidAmount: paymentToday ? paymentToday.amount : 0,
          isPaid: !!paymentToday
        };
      });
  }, [loans, borrowers, payments, selectedDate]);

  return (
    <div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
        
        {/* Date Picker */}
        <div className="w-full sm:w-auto flex items-center gap-2 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <Calendar size={18} className="text-slate-500" />
          <span className="text-sm text-slate-500 font-medium whitespace-nowrap">Schedule:</span>
          <input 
            type="date" 
            className="w-full sm:w-auto outline-none text-slate-700 font-semibold bg-transparent cursor-pointer"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-4 hover:shadow-md transition">
          <div className="p-2 md:p-3 bg-blue-100 rounded-full text-blue-600">
            <Users size={20} className="md:w-6 md:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 font-medium truncate">Borrowers</p>
            <p className="text-xl md:text-2xl font-bold text-slate-800">{borrowers.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-4 hover:shadow-md transition">
          <div className="p-2 md:p-3 bg-emerald-100 rounded-full text-emerald-600">
            <DollarSign size={20} className="md:w-6 md:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 font-medium truncate">Collected</p>
            <p className="text-xl md:text-2xl font-bold text-slate-800 truncate">₱{stats.totalCollected.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-4 hover:shadow-md transition">
          <div className="p-2 md:p-3 bg-amber-100 rounded-full text-amber-600">
            <AlertTriangle size={20} className="md:w-6 md:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 font-medium truncate">Receivable</p>
            <p className="text-xl md:text-2xl font-bold text-slate-800 truncate">₱{stats.outstanding.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-4 hover:shadow-md transition">
          <div className="p-2 md:p-3 bg-indigo-100 rounded-full text-indigo-600">
            <TrendingUp size={20} className="md:w-6 md:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 font-medium truncate">Net Profit</p>
            <p className={`text-xl md:text-2xl font-bold truncate ${stats.simpleProfit >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {stats.simpleProfit >= 0 ? '+' : ''}₱{stats.simpleProfit.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collection Schedule List */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="overflow-hidden">
               <h3 className="text-lg font-bold text-slate-800 truncate">Scheduled Collections</h3>
               <p className="text-sm text-slate-500 truncate">
                 {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
               </p>
            </div>
            <div className="text-xs md:text-sm font-medium px-3 py-1 bg-slate-200 rounded-full text-slate-600 whitespace-nowrap">
              {scheduledCollections.length} Due
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {scheduledCollections.length > 0 ? (
              scheduledCollections.map((item, idx) => (
                <div key={idx} className="p-4 hover:bg-slate-50 transition flex items-center justify-between group active:bg-slate-100">
                  <div className="flex items-center gap-3 overflow-hidden">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {item.isPaid ? <CheckCircle2 size={20} /> : <span className="font-bold text-sm">₱</span>}
                     </div>
                     <div className="min-w-0">
                       <div 
                         onClick={() => onNavigateToPayment(item.loan.id)}
                         className="font-semibold text-slate-800 cursor-pointer hover:text-emerald-600 flex items-center gap-1 truncate"
                         title="Go to Record Collection"
                       >
                         {item.borrower?.name || 'Unknown'}
                         {!item.isPaid && <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500 hidden sm:block"/>}
                       </div>
                       <div className="text-xs text-slate-500 flex items-center gap-1">
                          <span className="uppercase font-bold text-slate-400 text-[10px] bg-slate-100 px-1 rounded">{item.loan.payment_frequency || 'Daily'}</span>
                          {item.borrower?.phone && <span className="hidden sm:flex items-center gap-1 ml-1"><Phone size={10}/> {item.borrower.phone}</span>}
                       </div>
                     </div>
                  </div>
                  
                  <div className="text-right shrink-0">
                    {item.isPaid ? (
                      <div>
                        <div className="text-sm font-bold text-emerald-600">Paid ₱{item.paidAmount.toLocaleString()}</div>
                        <div className="text-xs text-slate-400">Target: ₱{Math.ceil(item.targetAmount).toLocaleString()}</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-bold text-slate-700">Due: ₱{Math.ceil(item.targetAmount).toLocaleString()}</div>
                        <div className="text-xs text-rose-500 font-medium">Not paid yet</div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                 <CheckCircle2 size={48} className="opacity-20 mb-2"/>
                 <p>No collections scheduled for this date.</p>
              </div>
            )}
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">7-Day Trend</h3>
          <div className="h-48 md:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{fontSize: 10}} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {month:'short', day:'numeric'})} />
                <YAxis tick={{fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`₱${value}`, 'Collected']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};