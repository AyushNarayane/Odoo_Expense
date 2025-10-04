const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // You need to provide this file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedDatabase() {
  try {
    // --- Create Company ---
    const companyRef = await db.collection('companies').add({
      name: 'Demo Company',
      default_currency: 'USD',
    });
    console.log('Created company with ID:', companyRef.id);

    // --- Create Users ---
    const adminUser = await admin.auth().createUser({
      email: 'admin@demo.com',
      password: 'password',
      displayName: 'Admin User',
    });
    await db.collection('users').doc(adminUser.uid).set({
      name: 'Admin User',
      email: 'admin@demo.com',
      role: 'Admin',
      company_id: companyRef.id,
    });
    console.log('Created Admin user');

    const managerUser = await admin.auth().createUser({
      email: 'manager@demo.com',
      password: 'password',
      displayName: 'Manager User',
    });
    await db.collection('users').doc(managerUser.uid).set({
      name: 'Manager User',
      email: 'manager@demo.com',
      role: 'Manager',
      company_id: companyRef.id,
    });
    console.log('Created Manager user');

    const employeeUser = await admin.auth().createUser({
      email: 'employee@demo.com',
      password: 'password',
      displayName: 'Employee User',
    });
    await db.collection('users').doc(employeeUser.uid).set({
      name: 'Employee User',
      email: 'employee@demo.com',
      role: 'Employee',
      company_id: companyRef.id,
      manager_id: managerUser.uid,
    });
    console.log('Created Employee user');

    // --- Create Approval Flow ---
    const flowRef = await db.collection('approval_flows').add({
      name: 'Standard Flow',
      company_id: companyRef.id,
      is_manager_approver_first: true,
    });
    console.log('Created approval flow with ID:', flowRef.id);

    await db.collection('approval_steps').add({
      flow_id: flowRef.id,
      approver_id: adminUser.uid,
      sequence_order: 1,
    });
    console.log('Added step to approval flow');

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

seedDatabase();
