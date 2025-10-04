"use client";

import { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase';

export default function ManageApprovalFlows() {
  const [flows, setFlows] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [newFlowName, setNewFlowName] = useState('');
  const [isManagerFirst, setIsManagerFirst] = useState(false);
  const [steps, setSteps] = useState<{ approver_id: string }[]>([]);
  const [ruleType, setRuleType] = useState('');
  const [approvalPercentage, setApprovalPercentage] = useState(0);
  const [criticalApproverId, setCriticalApproverId] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
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
    };

    fetchInitialData();
  }, []);

  const handleAddStep = () => {
    setSteps([...steps, { approver_id: '' }]);
  };

  const handleStepChange = (index: number, approver_id: string) => {
    const newSteps = [...steps];
    newSteps[index] = { approver_id };
    setSteps(newSteps);
  };

  const handleCreateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const flowData: any = {
        name: newFlowName,
        is_manager_approver_first: isManagerFirst,
        rule_type: ruleType || null,
        approval_percentage: ruleType.includes('Percentage') ? approvalPercentage : null,
        critical_approver_id: ruleType.includes('SpecificApprover') ? criticalApproverId : null,
      };

      const flowRef = await addDoc(collection(db, 'approval_flows'), flowData);

      steps.forEach(async (step, index) => {
        await addDoc(collection(db, 'approval_steps'), {
          flow_id: flowRef.id,
          approver_id: step.approver_id,
          sequence_order: index + 1,
        });
      });

      setNewFlowName('');
      setIsManagerFirst(false);
      setSteps([]);
      setRuleType('');
      setApprovalPercentage(0);
      setCriticalApproverId('');
    } catch (error) {
      console.error('Failed to create flow:', error);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Manage Approval Flows</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Existing Flows</h2>
          <div className="space-y-4">
            {flows.map(flow => (
              <div key={flow.id} className="p-4 border rounded-md">
                <h3 className="font-bold">{flow.name}</h3>
                <p>Manager is first approver: {flow.is_manager_approver_first ? 'Yes' : 'No'}</p>
                <ul>
                  {flow.steps.map((step: any, index: number) => (
                    <li key={index}>
                      Step {index + 1}: {users.find(u => u.id === step.approver_id)?.name || 'Unknown'}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-4">Create New Flow</h2>
          <form onSubmit={handleCreateFlow} className="space-y-4">
            <input
              type="text"
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
              placeholder="Flow Name"
              required
              className="w-full px-3 py-2 border rounded-md"
            />
            <label>
              <input
                type="checkbox"
                checked={isManagerFirst}
                onChange={(e) => setIsManagerFirst(e.target.checked)}
              />
              Manager is first approver
            </label>

            <select value={ruleType} onChange={(e) => setRuleType(e.target.value)} className="w-full px-3 py-2 border rounded-md">
              <option value="">No Rule</option>
              <option value="Percentage">Percentage</option>
              <option value="SpecificApprover">Specific Approver</option>
              <option value="Hybrid">Hybrid</option>
            </select>

            {(ruleType === 'Percentage' || ruleType === 'Hybrid') && (
              <input
                type="number"
                value={approvalPercentage}
                onChange={(e) => setApprovalPercentage(parseInt(e.target.value, 10))}
                placeholder="Approval Percentage"
                className="w-full px-3 py-2 border rounded-md"
              />
            )}

            {(ruleType === 'SpecificApprover' || ruleType === 'Hybrid') && (
              <select
                value={criticalApproverId}
                onChange={(e) => setCriticalApproverId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select Critical Approver</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            )}

            {steps.map((step, index) => (
              <div key={index}>
                <select
                  value={step.approver_id}
                  onChange={(e) => handleStepChange(index, e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select Approver</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>
            ))}
            <button type="button" onClick={handleAddStep}>Add Step</button>
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-md">Create Flow</button>
          </form>
        </div>
      </div>
    </div>
  );
}
