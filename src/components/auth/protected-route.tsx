'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { UserRole, canAccessRoute } from '@/lib/auth';
import { LoadingPage } from '@/components/ui/loading';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole,
  requiredPermission 
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const role = userData.role as UserRole;
            setUserRole(role);
            
            // Check if user has required role
            if (requiredRole && role !== requiredRole) {
              router.push('/');
              return;
            }
          } else {
            router.push('/login');
            return;
          }
        } catch (error) {
          console.error('Failed to fetch user role:', error);
          router.push('/login');
          return;
        }
      } else {
        router.push('/login');
        return;
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, requiredRole]);

  if (loading) {
    return <LoadingPage message="Verifying access..." />;
  }

  if (!user || !userRole) {
    return <LoadingPage message="Access denied..." />;
  }

  return <>{children}</>;
};
