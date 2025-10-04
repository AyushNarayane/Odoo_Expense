"use client";

import { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingPage } from '@/components/ui/loading';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function ManageApprovalFlows() {
  const [flows, setFlows] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [newFlowName, setNewFlowName] = useState('');
  const [isManagerFirst, setIsManagerFirst] = useState(false);
  const [steps, setSteps] = useState<{ approver_id: string }[]>([]);
  const [ruleType, setRuleType] = useState('');
  const [approvalPercentage, setApprovalPercentage] = useState(0);
  const [criticalApproverId, setCriticalApproverId] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);
        setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const flowsCollection = collection(db, 'approval_flows');
        const flowsSnapshot = await getDocs(flowsCollection);
        const flowsList = await Promise.all(flowsSnapshot.docs.map(async (doc) => {
          const flow = { id: doc.id, ...doc.data() };
          const stepsCollection = collection(db, 'approval_steps');
          const q = query(stepsCollection, where('flow_id', '==', flow.id));
          const stepsSnapshot = await getDocs(q);
          const stepsList = stepsSnapshot.docs.map(stepDoc => stepDoc.data());
          return { ...flow, steps: stepsList };
        }));
        setFlows(flowsList);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const handleAddStep = () => {
    setSteps([...steps, { approver_id: '' }]);
  };

  const handleRemoveStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(newSteps);
  };

  const handleStepChange = (index: number, approver_id: string) => {
    const newSteps = [...steps];
    newSteps[index] = { approver_id };
    setSteps(newSteps);
  };

  const handleCreateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const flowData: any = {
        name: newFlowName,
        is_manager_approver_first: isManagerFirst,
        rule_type: ruleType || null,
        approval_percentage: ruleType.includes('Percentage') ? approvalPercentage : null,
        critical_approver_id: ruleType.includes('SpecificApprover') ? criticalApproverId : null,
      };

      const flowRef = await addDoc(collection(db, 'approval_flows'), flowData);

      for (const [index, step] of steps.entries()) {
        await addDoc(collection(db, 'approval_steps'), {
          flow_id: flowRef.id,
          approver_id: step.approver_id,
          sequence_order: index + 1,
        });
      }

      // Reset form
      setNewFlowName('');
      setIsManagerFirst(false);
      setSteps([]);
      setRuleType('');
      setApprovalPercentage(0);
      setCriticalApproverId('');

      // Refresh flows
      const flowsCollection = collection(db, 'approval_flows');
      const flowsSnapshot = await getDocs(flowsCollection);
      const flowsList = await Promise.all(flowsSnapshot.docs.map(async (doc) => {
        const flow = { id: doc.id, ...doc.data() };
        const stepsCollection = collection(db, 'approval_steps');
        const q = query(stepsCollection, where('flow_id', '==', flow.id));
        const stepsSnapshot = await getDocs(q);
        const stepsList = stepsSnapshot.docs.map(stepDoc => stepDoc.data());
        return { ...flow, steps: stepsList };
      }));
      setFlows(flowsList);
    } catch (error) {
      console.error('Failed to create flow:', error);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <LoadingPage message="Loading approval flows..." />;
  }

  return (
    <ProtectedRoute requiredRole="Admin">
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Manage Approval Flows"
          description="Create and configure expense approval workflows"
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Existing Flows */}
          <Card>
            <CardHeader>
              <CardTitle>Existing Flows</CardTitle>
              <CardDescription>
                Current approval workflows in your system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {flows.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">⚙️</div>
                    <h3 className="text-lg font-medium text-muted-foreground mb-2">No flows yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Create your first approval workflow
                    </p>
                  </div>
                ) : (
                  flows.map(flow => (
                    <div key={flow.id} className="p-4 border rounded-lg bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{flow.name}</h3>
                        <Badge variant="outline">
                          {flow.is_manager_approver_first ? 'Manager First' : 'Custom Flow'}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {flow.rule_type && (
                          <div className="text-sm text-muted-foreground">
                            Rule: {flow.rule_type}
                            {flow.approval_percentage && ` (${flow.approval_percentage}%)`}
                          </div>
                        )}
                        <div className="text-sm">
                          <strong>Approval Steps:</strong>
                          <ul className="mt-1 space-y-1">
                            {flow.steps.map((step: any, index: number) => (
                              <li key={index} className="flex items-center space-x-2">
                                <Badge variant="secondary" className="text-xs">
                                  Step {index + 1}
                                </Badge>
                                <span>{users.find(u => u.id === step.approver_id)?.name || 'Unknown'}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Create New Flow */}
          <Card>
            <CardHeader>
              <CardTitle>Create New Flow</CardTitle>
              <CardDescription>
                Set up a new approval workflow for expenses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateFlow} className="space-y-6">
                <Input
                  type="text"
                  label="Flow Name"
                  placeholder="e.g., Standard Approval, High Value Approval"
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                  required
                />

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="managerFirst"
                    checked={isManagerFirst}
                    onChange={(e) => setIsManagerFirst(e.target.checked)}
                    className="rounded border-input"
                  />
                  <label htmlFor="managerFirst" className="text-sm font-medium">
                    Manager is first approver
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Approval Rule (Optional)</label>
                  <select 
                    value={ruleType} 
                    onChange={(e) => setRuleType(e.target.value)} 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">No Rule</option>
                    <option value="Percentage">Percentage Based</option>
                    <option value="SpecificApprover">Specific Approver</option>
                    <option value="Hybrid">Hybrid (Percentage + Specific)</option>
                  </select>
                </div>

                {(ruleType === 'Percentage' || ruleType === 'Hybrid') && (
                  <Input
                    type="number"
                    label="Approval Percentage"
                    placeholder="e.g., 50"
                    value={approvalPercentage}
                    onChange={(e) => setApprovalPercentage(parseInt(e.target.value, 10))}
                    min="0"
                    max="100"
                  />
                )}

                {(ruleType === 'SpecificApprover' || ruleType === 'Hybrid') && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Critical Approver</label>
                    <select
                      value={criticalApproverId}
                      onChange={(e) => setCriticalApproverId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">Select Critical Approver</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Approval Steps</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddStep}
                    >
                      Add Step
                    </Button>
                  </div>
                  
                  {steps.map((step, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        Step {index + 1}
                      </Badge>
                      <select
                        value={step.approver_id}
                        onChange={(e) => handleStepChange(index, e.target.value)}
                        required
                        className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="">Select Approver</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveStep(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  loading={creating}
                  disabled={creating}
                >
                  {creating ? 'Creating Flow...' : 'Create Flow'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
