"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import Link from 'next/link';
import { Navigation } from '@/components/layout/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingPage } from '@/components/ui/loading';
import { UserRole, getDefaultRoute, getNavigationItems } from '@/lib/auth';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        
        // Fetch user role
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const role = userData.role as UserRole;
            setUserRole(role);
          }
        } catch (error) {
          console.error('Failed to fetch user role:', error);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserRole(null);
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  if (loading) {
    return <LoadingPage message="Loading..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-primary">💰</span>
                <span className="text-xl font-semibold">Expense Tracker</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <div className="hidden sm:block">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">
                        Welcome, {user?.displayName || user?.email}
                      </span>
                      {userRole && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                          {userRole}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/signup">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {user ? (
          // Show dashboard for authenticated users
          <>
            <div className="mb-8">
              <h1 className="text-4xl font-bold tracking-tight text-foreground">
                Welcome back, {user?.displayName || user?.email?.split('@')[0]}!
              </h1>
              <p className="text-xl text-muted-foreground mt-2">
                Manage your expenses efficiently with our modern platform
              </p>
              <div className="mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {userRole}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {userRole && getNavigationItems(userRole).map((action) => (
                <Card key={action.href} className="group hover:shadow-lg transition-all duration-200 cursor-pointer">
                  <Link href={action.href}>
                    <CardHeader className="pb-3">
                      <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-white text-xl mb-3">
                        {action.icon}
                      </div>
                      <CardTitle className="text-lg">{action.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm">
                        {action.href === '/dashboard' && 'View and manage your expense reports'}
                        {action.href === '/expenses/new' && 'Submit a new expense for approval'}
                        {action.href === '/manager/dashboard' && 'Review and approve pending expenses'}
                        {action.href === '/admin/users' && 'Manage users and organizational structure'}
                        {action.href === '/admin/flows' && 'Create and configure approval workflows'}
                      </CardDescription>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          </>
        ) : (
          // Show landing page for non-authenticated users
          <>
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
                Expense Management
                <span className="text-primary"> Made Simple</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
                Streamline your expense tracking and approval workflows with our modern, 
                role-based expense management platform.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Button size="lg" asChild>
                  <Link href="/signup">Get Started</Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
              </div>
            </div>
            
            <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white text-xl mb-4">
                    📊
                  </div>
                  <CardTitle>Track Expenses</CardTitle>
                  <CardDescription>
                    Easily submit and track your business expenses with detailed categorization.
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white text-xl mb-4">
                    ✅
                  </div>
                  <CardTitle>Approval Workflows</CardTitle>
                  <CardDescription>
                    Streamlined approval processes with role-based permissions and notifications.
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center text-white text-xl mb-4">
                    📱
                  </div>
                  <CardTitle>Mobile Friendly</CardTitle>
                  <CardDescription>
                    Access your expense data anywhere with our responsive design.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
