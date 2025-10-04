"use client";

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, doc, updateDoc, getDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '@/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

export default function ManagerDashboard() {
  const [user] = useAuthState(auth);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingExpenses = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Find expense approvals assigned to the current manager that are pending
      const approvalsCollection = collection(db, 'expense_approvals');
      const approvalsQuery = query(
        approvalsCollection,
        where('approver_id', '==', user.uid),
        where('status', '==', 'Pending')
      );
      const approvalsSnapshot = await getDocs(approvalsQuery);

      if (approvalsSnapshot.empty) {
        setExpenses([]);
        setLoading(false);
        return;
      }

      const expenseIds = approvalsSnapshot.docs.map(doc => doc.data().expense_id);

      // Fetch the details for each of those expenses
      const expensesCollection = collection(db, 'expenses');
      const expensesQuery = query(expensesCollection, where('__name__', 'in', expenseIds));
      const expensesSnapshot = await getDocs(expensesQuery);

      const usersCollection = collection(db, 'users');
      const expensesList = await Promise.all(expensesSnapshot.docs.map(async (expenseDoc) => {
        const expenseData = expenseDoc.data();
        // Fetch the employee's name
        const userDoc = await getDoc(doc(db, 'users', expenseData.employee_id));
        const employee = userDoc.data();
        return { id: expenseDoc.id, ...expenseData, employee_name: employee?.name || 'Unknown' };
      }));

      setExpenses(expensesList);
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingExpenses();
  }, [user]);

  const handleApproval = async (expenseId: string, newStatus: 'Approved' | 'Rejected') => {
    try {
      const expenseDocRef = doc(db, 'expenses', expenseId);
      const expenseDoc = await getDoc(expenseDocRef);
      const expense = expenseDoc.data();

      if (!expense) return;

      // Update the current approval record
      const approvalQuery = query(
        collection(db, 'expense_approvals'),
        where('expense_id', '==', expenseId),
        where('approver_id', '==', user?.uid),
        where('status', '==', 'Pending')
      );
      const approvalSnapshot = await getDocs(approvalQuery);
      const approvalDoc = approvalSnapshot.docs[0];
      if (approvalDoc) {
        await updateDoc(approvalDoc.ref, { status: newStatus });
      }

      if (newStatus === 'Rejected') {
        await updateDoc(expenseDocRef, { status: 'Rejected' });
      } else {
        // Find the current step
        const stepsQuery = query(collection(db, 'approval_steps'), where('flow_id', '==', expense.flow_id));
        const stepsSnapshot = await getDocs(stepsQuery);
        const steps = stepsSnapshot.docs.map(d => d.data()).sort((a, b) => a.sequence_order - b.sequence_order);
        
        const currentStepIndex = steps.findIndex(step => step.approver_id === user?.uid);

        // --- Conditional Approval Logic ---
        const flowDoc = await getDoc(doc(db, 'approval_flows', expense.flow_id));
        const flow = flowDoc.data();
        let isAutoApproved = false;

        if (flow?.rule_type) {
          const approvalsQuery = query(collection(db, 'expense_approvals'), where('expense_id', '==', expenseId));
          const approvalsSnapshot = await getDocs(approvalsQuery);
          const approvals = approvalsSnapshot.docs.map(d => d.data());
          let approvedCount = approvals.filter(a => a.status === 'Approved').length;
          if (newStatus === 'Approved') {
            approvedCount++;
          }

          if (flow.rule_type === 'SpecificApprover' && user?.uid === flow.critical_approver_id) {
            isAutoApproved = true;
          }
          if (flow.rule_type === 'Percentage' && (approvedCount / steps.length) * 100 >= flow.approval_percentage) {
            isAutoApproved = true;
          }
          if (flow.rule_type === 'Hybrid') {
            const isCritialApprover = user?.uid === flow.critical_approver_id;
            const isPercentageMet = (approvedCount / steps.length) * 100 >= flow.approval_percentage;
            if (isCritialApprover || isPercentageMet) {
              isAutoApproved = true;
            }
          }
        }

        if (isAutoApproved) {
          await updateDoc(expenseDocRef, { status: 'Approved' });
        } else if (currentStepIndex < steps.length - 1) {
          // There is a next step
          const nextStep = steps[currentStepIndex + 1];
          await addDoc(collection(db, 'expense_approvals'), {
            expense_id: expenseId,
            approver_id: nextStep.approver_id,
            status: 'Pending',
          });
        } else {
          // This was the last step
          await updateDoc(expenseDocRef, { status: 'Approved' });
        }
      }

      fetchPendingExpenses(); // Refresh the list
    } catch (error) {
      console.error('Failed to update expense status:', error);
    }
  };

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Manager Dashboard: Pending Approvals</h1>
      <div className="bg-white rounded-lg shadow-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {expenses.map(expense => (
              <tr key={expense.id}>
                <td className="px-6 py-4 whitespace-nowrap">{expense.employee_name || '...'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{new Date(expense.expense_date.seconds * 1000).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">{expense.description}</td>
                <td className="px-6 py-4 whitespace-nowrap">{expense.amount} {expense.currency}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleApproval(expense.id, 'Approved')}
                    className="px-3 py-1 text-sm text-white bg-green-600 rounded-md mr-2"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleApproval(expense.id, 'Rejected')}
                    className="px-3 py-1 text-sm text-white bg-red-600 rounded-md"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
