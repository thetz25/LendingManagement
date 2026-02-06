import React, { useState } from 'react';
import { Borrower, Loan, Payment } from '../types';
import { supabase } from '../lib/supabase';
import { analyzeBorrowerRisk, generateCollectionMessage } from '../services/geminiService';
import { analyzeStanding } from '../utils/analytics';
import { Plus, Search, MessageSquare, Shield, Activity, Phone, ThumbsUp, AlertCircle, Image as ImageIcon, X, UploadCloud } from 'lucide-react';

interface BorrowersProps {
  borrowers: Borrower[];
  loans: Loan[];
  payments: Payment[];
  onUpdate: () => void;
}

export const Borrowers: React.FC<BorrowersProps> = ({ borrowers, loans, payments, onUpdate }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // New Borrower Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);

  // AI Modal & ID Modal State
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState('');
  const [riskData, setRiskData] = useState<{riskLevel: string, analysis: string} | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleAddBorrower = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let idImageUrl = null;

    try {
      // 1. Upload ID Image if exists
      if (idFile) {
        const bucketName = 'borrower-ids';
        const fileExt = idFile.name.split('.').pop() || 'jpg';
        // Sanitize filename
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        
        console.log("Uploading file:", fileName);

        // Attempt 1: Upload
        let { data, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, idFile, {
            cacheControl: '3600',
            upsert: false
          });

        // Attempt 2: Auto-create bucket if missing and retry
        if (uploadError && (
          uploadError.message.includes('Bucket not found') || 
          uploadError.message.includes('The resource was not found') ||
          (uploadError as any).statusCode === '404'
        )) {
          console.warn(`Bucket '${bucketName}' missing. Attempting to auto-create...`);
          
          const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
            public: true
          });

          if (createBucketError) {
             console.error("Auto-create bucket failed:", createBucketError);
             throw new Error(`Storage bucket '${bucketName}' is missing. Please create it in Supabase Dashboard.`);
          }

          // Retry upload
          const retry = await supabase.storage
            .from(bucketName)
            .upload(fileName, idFile, {
              cacheControl: '3600',
              upsert: false
            });
            
          data = retry.data;
          uploadError = retry.error;
        }

        if (uploadError) {
          console.error('Upload Error:', uploadError);
          throw new Error(`ID Upload Failed: ${uploadError.message}`);
        }

        if (data) {
          const { data: { publicUrl } } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName);
          idImageUrl = publicUrl;
        }
      }

      // 2. Insert Borrower
      // We first try to insert with the ID URL.
      let { error: insertError } = await supabase.from('borrowers').insert([
        { 
          name: newName, 
          phone: newPhone, 
          address: newAddress,
          id_image_url: idImageUrl
        }
      ]);

      // FALLBACK: If the 'id_image_url' column is missing (PGRST204), retry without it.
      if (insertError && insertError.code === 'PGRST204') {
        console.warn('Schema mismatch: id_image_url column missing. Retrying insert without it.');
        
        const retry = await supabase.from('borrowers').insert([
          { 
            name: newName, 
            phone: newPhone, 
            address: newAddress
            // omitting id_image_url to bypass schema error
          }
        ]);

        if (!retry.error) {
          // If retry succeeded, we consider it a success but warn the user
          insertError = null; 
          alert("Borrower saved! \n\nNote: The ID image was uploaded but not linked because your database table is missing the 'id_image_url' column. \n\nPlease run the provided SQL script in Supabase to fix this fully.");
        } else {
          // If retry also failed, keep the error
          insertError = retry.error;
        }
      }

      if (insertError) {
        console.error('Database Error:', insertError);
        throw new Error(`Save Failed: ${insertError.message}`);
      }

      // Success
      setNewName(''); setNewPhone(''); setNewAddress(''); setIdFile(null);
      setShowAdd(false);
      onUpdate();

    } catch (err: any) {
      alert(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRiskAnalysis = async (borrower: Borrower) => {
    setGenerating(true);
    setSelectedBorrower(borrower);
    setAiMessage('');
    setRiskData(null);
    setViewingId(null);
    
    // Filter loans for this borrower
    const borrowerLoans = loans.filter(l => l.borrower_id === borrower.id);
    const borrowerPayments = payments.filter(p => borrowerLoans.some(l => l.id === p.loan_id));

    const result = await analyzeBorrowerRisk(borrower, borrowerLoans, borrowerPayments);
    setRiskData(result);
    setGenerating(false);
  };

  const handleGenerateMessage = async (borrower: Borrower) => {
    setGenerating(true);
    setSelectedBorrower(borrower);
    setRiskData(null);
    setViewingId(null);
    setAiMessage('');

    // Find active loan
    const activeLoan = loans.find(l => l.borrower_id === borrower.id && l.status === 'active');
    const amountDue = activeLoan ? activeLoan.balance : 0;
    
    const msg = await generateCollectionMessage(borrower.name, amountDue, activeLoan?.due_date || 'Today', 'friendly');
    setAiMessage(msg);
    setGenerating(false);
  };

  const filteredBorrowers = borrowers.filter(b => 
    b.name.toLowerCase().includes(search.toLowerCase()) || 
    b.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Borrowers List</h2>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-700 transition"
        >
          <Plus size={18} /> Add Borrower
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAddBorrower} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4">New Borrower</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input 
              required
              placeholder="Full Name"
              className="border p-2.5 rounded-lg w-full focus:ring-2 focus:ring-emerald-100 outline-none"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <input 
              placeholder="Phone (e.g. 0917...)"
              className="border p-2.5 rounded-lg w-full focus:ring-2 focus:ring-emerald-100 outline-none"
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
            />
            <input 
              placeholder="Address / Area"
              className="border p-2.5 rounded-lg w-full focus:ring-2 focus:ring-emerald-100 outline-none"
              value={newAddress}
              onChange={e => setNewAddress(e.target.value)}
            />
             <div className="border border-dashed border-slate-300 p-3 rounded-lg w-full bg-slate-50 relative hover:bg-slate-100 transition">
              <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                <UploadCloud size={14}/> Valid ID (Optional)
              </label>
              <input 
                type="file"
                accept="image/*"
                className="text-sm w-full text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                onChange={e => setIdFile(e.target.files ? e.target.files[0] : null)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="text-slate-500 px-4 py-2 font-medium">Cancel</button>
            <button disabled={loading} className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 font-medium transition flex items-center gap-2">
              {loading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                  Processing...
                </>
              ) : 'Save Borrower'}
            </button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
        <input 
          type="text"
          placeholder="Search by name or area..."
          className="pl-10 p-2.5 w-full border rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredBorrowers.map(borrower => {
          const borrowerLoans = loans.filter(l => l.borrower_id === borrower.id);
          const activeLoan = borrowerLoans.find(l => l.status === 'active');
          const standing = analyzeStanding(borrowerLoans);

          return (
            <div key={borrower.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{borrower.name}</h3>
                  <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                     <Phone size={14}/> {borrower.phone || 'No Phone'}
                  </div>
                </div>
                {activeLoan && (
                  <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-medium">
                    Active
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between text-sm text-slate-600 mb-2 bg-slate-50 p-2 rounded">
                 <span className="truncate max-w-[150px]">{borrower.address || 'No Address'}</span>
                 {borrower.id_image_url && (
                   <button 
                     onClick={() => setViewingId(borrower.id_image_url!)}
                     className="text-indigo-600 text-xs font-semibold flex items-center gap-1 hover:underline"
                   >
                     <ImageIcon size={14} /> View ID
                   </button>
                 )}
              </div>

              {/* Borrower Standing Badge */}
              <div className={`mb-4 flex items-start gap-2 p-2 rounded-lg text-xs border ${standing.color}`}>
                {standing.status === 'Good Payer' ? <ThumbsUp size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                <div>
                  <span className="font-bold uppercase block">{standing.status}</span>
                  <span className="opacity-90">{standing.reason}</span>
                </div>
              </div>

              {activeLoan && (
                 <div className="mb-4">
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Current Balance</div>
                    <div className="text-xl font-bold text-slate-800">₱{activeLoan.balance.toLocaleString()}</div>
                 </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button 
                  onClick={() => handleGenerateMessage(borrower)}
                  className="flex-1 bg-blue-50 text-blue-600 hover:bg-blue-100 py-2 rounded text-sm flex items-center justify-center gap-1 font-medium"
                >
                  <MessageSquare size={16} /> Remind
                </button>
                <button 
                  onClick={() => handleRiskAnalysis(borrower)}
                  className="flex-1 bg-purple-50 text-purple-600 hover:bg-purple-100 py-2 rounded text-sm flex items-center justify-center gap-1 font-medium"
                >
                  <Shield size={16} /> Check Risk
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ID Viewer Modal */}
      {viewingId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="relative max-w-2xl w-full">
            <button 
              onClick={() => setViewingId(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300"
            >
              <X size={24} />
            </button>
            <img src={viewingId} alt="Borrower ID" className="w-full h-auto rounded-lg shadow-2xl bg-white" />
          </div>
        </div>
      )}

      {/* AI Modal Overlay */}
      {(selectedBorrower && (aiMessage || riskData || generating) && !viewingId) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
            <button 
              onClick={() => { setSelectedBorrower(null); setAiMessage(''); setRiskData(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
            
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Activity className="text-indigo-500" />
              AI Assistant for {selectedBorrower.name}
            </h3>

            {generating ? (
              <div className="py-8 text-center text-slate-500 animate-pulse">
                Thinking... (Gemini AI)
              </div>
            ) : (
              <div className="space-y-4">
                {aiMessage && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Generated SMS</label>
                    <div className="bg-slate-100 p-3 rounded-lg text-slate-800 mt-1 text-sm whitespace-pre-wrap">
                      {aiMessage}
                    </div>
                    <button 
                      onClick={() => navigator.clipboard.writeText(aiMessage)}
                      className="mt-2 text-xs text-blue-600 font-medium hover:underline"
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                )}

                {riskData && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Risk Analysis</label>
                    <div className="mt-2 p-3 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                         <span className="text-sm font-medium">Risk Level</span>
                         <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                           riskData.riskLevel === 'Low' ? 'bg-green-100 text-green-700' :
                           riskData.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                           'bg-red-100 text-red-700'
                         }`}>
                           {riskData.riskLevel}
                         </span>
                      </div>
                      <p className="text-sm text-slate-600 italic">
                        "{riskData.analysis}"
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};