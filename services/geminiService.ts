import { GoogleGenAI } from "@google/genai";
import { Loan, Borrower, Payment } from "../types";

const getApiKey = () => {
  // Try different possible env variables used by Vercel/Vite
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY || '';
};

let ai: GoogleGenAI | null = null;
const getAI = () => {
  const key = getApiKey();
  if (!key) return null;
  if (!ai) ai = new GoogleGenAI({ apiKey: key });
  return ai;
};

export const generateCollectionMessage = async (
  borrowerName: string,
  amountDue: number,
  dueDate: string,
  tone: 'friendly' | 'firm' | 'urgent'
): Promise<string> => {
  const key = getApiKey();
  const ai = getAI();
  if (!key || !ai) return "Error: API Key missing.";

  const prompt = `
    Write a short SMS text message for a loan collection (5-6 lending style).
    Borrower: ${borrowerName}
    Balance Due: ${amountDue} PHP
    Due Date: ${dueDate}
    Tone: ${tone}
    Language: Tagalog-English (Taglish) mixed, natural for Filipinos.
    Keep it under 160 characters if possible.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text?.trim() || "Could not generate message.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating message.";
  }
};

export const analyzeBorrowerRisk = async (
  borrower: Borrower,
  loans: Loan[],
  payments: Payment[]
): Promise<{ riskLevel: string; analysis: string }> => {
  const key = getApiKey();
  const ai = getAI();
  if (!key || !ai) return { riskLevel: 'Unknown', analysis: 'API Key missing.' };

  const historySummary = loans.map(l => ({
    amount: l.total_payable,
    status: l.status,
    paid: l.total_payable - l.balance
  }));

  const prompt = `
    Analyze this borrower's risk profile for a micro-lending (5-6) business.
    Borrower: ${borrower.name}
    Loan History: ${JSON.stringify(historySummary)}
    Total Payments Count: ${payments.length}

    Return a JSON object with:
    - riskLevel: "Low", "Medium", or "High"
    - analysis: A 1-sentence explanation in Taglish.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response");

    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return { riskLevel: 'Error', analysis: 'Could not analyze data.' };
  }
};