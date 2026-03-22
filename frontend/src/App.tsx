import { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { lazyWithPreload } from '@/lib/lazyWithPreload';

const Landing = lazyWithPreload(() => import('./pages/Landing'));
const Login = lazyWithPreload(() => import('./pages/Login'));
const Signup = lazyWithPreload(() => import('./pages/Signup'));
const ForgotPassword = lazyWithPreload(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyWithPreload(() => import('./pages/ResetPassword'));
const Dashboard = lazyWithPreload(() => import('./pages/Dashboard'));
const Voice = lazyWithPreload(() => import('./pages/Voice'));
const Insights = lazyWithPreload(() => import('./pages/Insights'));
const History = lazyWithPreload(() => import('./pages/History'));
const Profile = lazyWithPreload(() => import('./pages/Profile'));
const NotFound = lazyWithPreload(() => import('./pages/NotFound'));

const queryClient = new QueryClient();

const RouteLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-10 w-10 animate-breathe rounded-full bg-primary/40" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/voice" element={<ProtectedRoute><Voice /></ProtectedRoute>} />
              <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
