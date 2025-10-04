"use client";

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, doc, updateDoc, getDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '@/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingPage } from '@/components/ui/loading';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function ManagerDashboard() {
  const [user] = useAuthState(auth);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

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
    setProcessing(expenseId);
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
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return <LoadingPage message="Loading pending approvals..." />;
  }

  return (
    <ProtectedRoute requiredRole="Manager">
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Manager Dashboard"
          description="Review and approve pending expense reports"
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <span className="text-2xl">⏳</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{expenses.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting your approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <span className="text-2xl">💰</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Pending approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Employees</CardTitle>
              <span className="text-2xl">👥</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(expenses.map(expense => expense.employee_id)).size}
              </div>
              <p className="text-xs text-muted-foreground">Different employees</p>
            </CardContent>
          </Card>
        </div>

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>
              Review and approve expense reports from your team members
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">✅</div>
                <h3 className="text-lg font-medium text-muted-foreground mb-2">All caught up!</h3>
                <p className="text-sm text-muted-foreground">
                  No pending expense approvals at the moment
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">
                        {expense.employee_name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {new Date(expense.expense_date.seconds * 1000).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {expense.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.category}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {expense.currency} {expense.amount}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="default"
                    onClick={() => handleApproval(expense.id, 'Approved')}
                            disabled={processing === expense.id}
                            className="bg-success hover:bg-success/90"
                          >
                            {processing === expense.id ? 'Processing...' : 'Approve'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                    onClick={() => handleApproval(expense.id, 'Rejected')}
                            disabled={processing === expense.id}
                          >
                            {processing === expense.id ? 'Processing...' : 'Reject'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}
