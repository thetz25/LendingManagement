import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Borrower, Loan, Payment } from './types';
import { Dashboard } from './components/Dashboard';
import { Borrowers } from './components/Borrowers';
import { Loans } from './components/Loans';
import { Payments } from './components/Payments';
import { BorrowerPortal } from './components/BorrowerPortal';
import { LayoutDashboard, Users, CreditCard, Banknote, ShieldCheck, LogOut, Menu } from 'lucide-react';

enum Tab {
  DASHBOARD = 'dashboard',
  BORROWERS = 'borrowers',
  LOANS = 'loans',
  PAYMENTS = 'payments',
  PORTAL = 'portal'
}

const App: React.FC = () => {
  // Initialize state based on current URL Hash
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const hash = window.location.hash;
    return hash === '#/check' ? Tab.PORTAL : Tab.DASHBOARD;
  });

  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation state for redirecting to specific loans
  const [targetLoanId, setTargetLoanId] = useState<string | null>(null);

  const fetchData = async () => {
    // If in Portal mode, we don't need to fetch the admin dashboard data
    if (activeTab === Tab.PORTAL) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Parallel fetch
      const [resBorrowers, resLoans, resPayments] = await Promise.all([
        supabase.from('borrowers').select('*').order('created_at', { ascending: false }),
        supabase.from('loans').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('payment_date', { ascending: false })
      ]);

      if (resBorrowers.error) throw resBorrowers.error;
      if (resLoans.error) throw resLoans.error;
      if (resPayments.error) throw resPayments.error;

      setBorrowers(resBorrowers.data || []);
      setLoans(resLoans.data || []);
      setPayments(resPayments.data || []);
    } catch (err: any) {
      console.error("Data fetch error:", err);
      // If table not found error, alert user
      if (err.message?.includes('does not exist') || err.code === '42P01') {
        setError("Tables not found. Please contact administrator to initialize the database.");
      } else {
        setError("Failed to load data. Please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Handle URL Hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#/check') {
        setActiveTab(Tab.PORTAL);
      } else {
        // If coming back from portal to root, default to dashboard
        setActiveTab(Tab.DASHBOARD);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigateToPayment = (loanId: string) => {
    setTargetLoanId(loanId);
    setActiveTab(Tab.PAYMENTS);
  };

  // ----------------------------------------------------------------------
  // RENDER: Standalone Borrower Portal Page ( /#/check )
  // ----------------------------------------------------------------------
  if (activeTab === Tab.PORTAL) {
    return (
      <div className="min-h-screen bg-slate-100 font-sans selection:bg-emerald-100 selection:text-emerald-900">
        <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
           <div className="max-w-4xl mx-auto px-4 h-16 flex justify-between items-center">
              <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-xl tracking-tight">
                 <ShieldCheck className="text-emerald-500" /> 
                 <span>PautangPal<span className="text-slate-400 font-normal ml-1 text-sm hidden sm:inline">Viewer</span></span>
              </div>
              <a 
                href="/" 
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200"
              >
                Admin Access
              </a>
           </div>
        </header>
        
        <main className="p-4 pb-12">
          <BorrowerPortal />
        </main>

        <footer className="text-center text-slate-400 text-xs pb-8">
           &copy; {new Date().getFullYear()} Lending Management System
        </footer>
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // RENDER: Admin Dashboard Layout
  // ----------------------------------------------------------------------
  return (
    <div className="h-screen flex flex-col md:flex-row bg-slate-50 font-sans overflow-hidden">
      
      {/* MOBILE HEADER */}
      <header className="md:hidden flex-shrink-0 bg-slate-900 text-white h-14 flex items-center justify-between px-4 z-40 shadow-md">
        <div className="flex items-center gap-2 font-bold text-lg">
           <span className="bg-emerald-500/20 p-1 rounded text-lg">💰</span> PautangPal
        </div>
        <a 
           href="/#/check"
           target="_blank"
           rel="noopener noreferrer" 
           className="text-xs font-medium text-emerald-400 bg-emerald-950/50 px-3 py-1.5 rounded-full flex items-center gap-1"
        >
          Check ID <ArrowOutIcon />
        </a>
      </header>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-shrink-0 flex-col shadow-xl z-20">
        <div className="p-6 border-b border-slate-800 bg-slate-950">
          <h1 className="text-xl font-bold tracking-tight text-emerald-400 flex items-center gap-2">
            <span className="bg-emerald-500/10 p-1 rounded">💰</span> PautangPal
          </h1>
          <p className="text-xs text-slate-400 mt-2 ml-1">Admin Dashboard</p>
        </div>
        
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          <button 
            onClick={() => setActiveTab(Tab.DASHBOARD)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${activeTab === Tab.DASHBOARD ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab(Tab.BORROWERS)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${activeTab === Tab.BORROWERS ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Users size={20} /> Borrowers
          </button>
          <button 
            onClick={() => setActiveTab(Tab.LOANS)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${activeTab === Tab.LOANS ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Banknote size={20} /> Loans (5-6)
          </button>
          <button 
            onClick={() => setActiveTab(Tab.PAYMENTS)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${activeTab === Tab.PAYMENTS ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <CreditCard size={20} /> Collections
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Public Links</p>
          <a 
            href="/#/check"
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition text-slate-400 hover:bg-slate-800 hover:text-indigo-300 group`}
          >
            <ShieldCheck size={20} className="group-hover:scale-110 transition-transform"/> 
            <span>Check Loan Status</span>
            <ArrowOutIcon />
          </a>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto bg-slate-50/50 relative">
        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl mb-6 flex items-center gap-3 shadow-sm">
              <LogOut size={20} className="text-rose-500"/>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
              <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
              <div className="text-slate-400 font-medium animate-pulse">Syncing data...</div>
            </div>
          ) : (
            <div className="animate-in fade-in duration-500">
               {activeTab === Tab.DASHBOARD && (
                 <Dashboard 
                   loans={loans} 
                   payments={payments} 
                   borrowers={borrowers} 
                   onNavigateToPayment={handleNavigateToPayment}
                 />
               )}
               {activeTab === Tab.BORROWERS && (
                 <Borrowers borrowers={borrowers} loans={loans} payments={payments} onUpdate={fetchData} />
               )}
               {activeTab === Tab.LOANS && (
                 <Loans borrowers={borrowers} loans={loans} payments={payments} onUpdate={fetchData} />
               )}
               {activeTab === Tab.PAYMENTS && (
                 <Payments 
                    borrowers={borrowers} 
                    loans={loans} 
                    payments={payments} 
                    onUpdate={fetchData} 
                    initialLoanId={targetLoanId}
                  />
               )}
            </div>
          )}
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 flex justify-around items-center px-1 py-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe">
        <button 
          onClick={() => setActiveTab(Tab.DASHBOARD)}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition w-full ${activeTab === Tab.DASHBOARD ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <div className={`${activeTab === Tab.DASHBOARD ? 'bg-emerald-100 p-1.5 rounded-full' : ''}`}>
             <LayoutDashboard size={20} strokeWidth={activeTab === Tab.DASHBOARD ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-bold">Dashboard</span>
        </button>
        <button 
          onClick={() => setActiveTab(Tab.BORROWERS)}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition w-full ${activeTab === Tab.BORROWERS ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <div className={`${activeTab === Tab.BORROWERS ? 'bg-emerald-100 p-1.5 rounded-full' : ''}`}>
            <Users size={20} strokeWidth={activeTab === Tab.BORROWERS ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-bold">People</span>
        </button>
        <button 
          onClick={() => setActiveTab(Tab.LOANS)}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition w-full ${activeTab === Tab.LOANS ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <div className={`${activeTab === Tab.LOANS ? 'bg-emerald-100 p-1.5 rounded-full' : ''}`}>
             <Banknote size={20} strokeWidth={activeTab === Tab.LOANS ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-bold">Loans</span>
        </button>
        <button 
          onClick={() => setActiveTab(Tab.PAYMENTS)}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition w-full ${activeTab === Tab.PAYMENTS ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <div className={`${activeTab === Tab.PAYMENTS ? 'bg-emerald-100 p-1.5 rounded-full' : ''}`}>
             <CreditCard size={20} strokeWidth={activeTab === Tab.PAYMENTS ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-bold">Collect</span>
        </button>
      </nav>

    </div>
  );
};

// Simple Icon component for the external link
const ArrowOutIcon = () => (
  <svg className="w-3 h-3 ml-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

export default App;