"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { createWorker } from 'tesseract.js';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingPage } from '@/components/ui/loading';
import { ProtectedRoute } from '@/components/auth/protected-route';

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
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleReceiptUpload = async (file: File) => {
    setReceipt(file);
    setOcrLoading(true);
    try {
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
    } catch (error) {
      console.error('OCR processing failed:', error);
    } finally {
      setOcrLoading(false);
    }
  };

  useEffect(() => {
    const fetchFlows = async () => {
      try {
        const flowsCollection = collection(db, 'approval_flows');
        const flowsSnapshot = await getDocs(flowsCollection);
        setFlows(flowsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error('Failed to fetch flows:', error);
      }
    };
    fetchFlows();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (!user) {
      setError('You must be logged in to submit an expense.');
      setSubmitting(false);
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

      router.push('/dashboard');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return <LoadingPage message="Loading..." />;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Submit New Expense"
          description="Create and submit a new expense report for approval"
        />

        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Expense Details</CardTitle>
            <CardDescription>
              Fill in the details of your expense. All fields are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  id="amount"
                  type="number"
                  label="Amount"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                
                <div className="space-y-2">
                  <label htmlFor="currency" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Currency
                  </label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="CAD">CAD</option>
                    <option value="AUD">AUD</option>
                  </select>
                </div>
              </div>

              <Input
                id="category"
                type="text"
                label="Category"
                placeholder="e.g., Travel, Meals, Office Supplies"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              />

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Describe the purpose of this expense..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  id="expenseDate"
                  type="date"
                  label="Date of Expense"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                />

                <div className="space-y-2">
                  <label htmlFor="flow" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Approval Flow
                  </label>
                  <select
                    id="flow"
                    value={selectedFlow}
                    onChange={(e) => setSelectedFlow(e.target.value)}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select a flow</option>
                    {flows.map(flow => (
                      <option key={flow.id} value={flow.id}>{flow.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="receipt" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Receipt (Optional)
                </label>
                <input
                  id="receipt"
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files && handleReceiptUpload(e.target.files[0])}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {ocrLoading && (
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                    <span>Scanning receipt...</span>
                  </div>
                )}
                {receipt && !ocrLoading && (
                  <p className="text-sm text-success">Receipt uploaded successfully</p>
                )}
              </div>

              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                  {error}
                </div>
              )}

              <div className="flex space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  loading={submitting}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Expense'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}
