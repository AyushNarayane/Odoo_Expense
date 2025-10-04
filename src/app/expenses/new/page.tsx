"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { createWorker } from 'tesseract.js';

export default function NewExpense() {
  const [user] = useAuthState(auth);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [flows, setFlows] = useState<any[]>([]);
  const [selectedFlow, setSelectedFlow] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const router = useRouter();

  const handleReceiptUpload = async (file: File) => {
    setReceipt(file);
    setOcrLoading(true);
    const worker = await createWorker('eng');
    const ret = await worker.recognize(file);
    const text = ret.data.text;
    
    // Basic parsing logic (can be improved)
    const amountMatch = text.match(/(\d+\.\d{2})/);
    if (amountMatch) setAmount(amountMatch[0]);

    const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) setExpenseDate(dateMatch[0]);

    // For description, we can take a snippet of the text
    setDescription(text.substring(0, 100));

    await worker.terminate();
    setOcrLoading(false);
  };

  useEffect(() => {
    const fetchFlows = async () => {
      const flowsCollection = collection(db, 'approval_flows');
      const flowsSnapshot = await getDocs(flowsCollection);
      setFlows(flowsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchFlows();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('You must be logged in to submit an expense.');
      return;
    }

    try {
      const expenseRef = await addDoc(collection(db, 'expenses'), {
        employee_id: user.uid,
        amount: parseFloat(amount),
        currency,
        category,
        description,
        expense_date: new Date(expenseDate),
        status: 'Pending',
        flow_id: selectedFlow,
        created_at: serverTimestamp(),
        // Receipt upload logic will be added later
      });

      // --- Start Approval Workflow ---
      const flowDoc = await getDoc(doc(db, 'approval_flows', selectedFlow));
      const flow = flowDoc.data();

      if (flow) {
        if (flow.is_manager_approver_first) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const managerId = userDoc.data()?.manager_id;
          if (managerId) {
            await addDoc(collection(db, 'expense_approvals'), {
              expense_id: expenseRef.id,
              approver_id: managerId,
              status: 'Pending',
              comments: 'Initial manager approval.',
            });
          }
        } else {
          // Find the first step in the sequence
          const stepsQuery = query(collection(db, 'approval_steps'), where('flow_id', '==', selectedFlow), where('sequence_order', '==', 1));
          const stepsSnapshot = await getDocs(stepsQuery);
          const firstStep = stepsSnapshot.docs[0]?.data();
          if (firstStep) {
            await addDoc(collection(db, 'expense_approvals'), {
              expense_id: expenseRef.id,
              approver_id: firstStep.approver_id,
              status: 'Pending',
              comments: 'First step in the flow.',
            });
          }
        }
      }

      router.push('/');
    } catch (error: any) {
      setError(error.message);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Submit New Expense</h1>
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto bg-white p-8 rounded-lg shadow-md">
        <div className="space-y-6">
          <div>
            <label htmlFor="amount" className="text-sm font-medium text-gray-700">Amount</label>
            <input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <div>
            <label htmlFor="currency" className="text-sm font-medium text-gray-700">Currency</label>
            <input
              id="currency"
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <div>
            <label htmlFor="category" className="text-sm font-medium text-gray-700">Category</label>
            <input
              id="category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <div>
            <label htmlFor="flow" className="text-sm font-medium text-gray-700">Approval Flow</label>
            <select
              id="flow"
              value={selectedFlow}
              onChange={(e) => setSelectedFlow(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm"
            >
              <option value="">Select a flow</option>
              {flows.map(flow => (
                <option key={flow.id} value={flow.id}>{flow.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="description" className="text-sm font-medium text-gray-700">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <div>
            <label htmlFor="expenseDate" className="text-sm font-medium text-gray-700">Date of Expense</label>
            <input
              id="expenseDate"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <div>
            <label htmlFor="receipt" className="text-sm font-medium text-gray-700">Receipt</label>
            <input
              id="receipt"
              type="file"
              onChange={(e) => e.target.files && handleReceiptUpload(e.target.files[0])}
              className="w-full px-3 py-2 mt-1"
            />
            {ocrLoading && <p>Scanning receipt...</p>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <button
              type="submit"
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm"
            >
              Submit Expense
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
