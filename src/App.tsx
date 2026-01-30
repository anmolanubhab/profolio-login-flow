import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";

// Lazy load all page components for code splitting
const Index = lazy(() => import("./pages/Index"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const UnifiedDashboard = lazy(() => import("./pages/UnifiedDashboard"));
const Certificates = lazy(() => import("./pages/Certificates"));
const Resume = lazy(() => import("./pages/Resume"));
const Connect = lazy(() => import("./pages/Connect"));
const Profile = lazy(() => import("./pages/Profile"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Network = lazy(() => import("./pages/Network"));
const AddPost = lazy(() => import("./pages/AddPost"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Jobs = lazy(() => import("./pages/Jobs"));
const MyJobs = lazy(() => import("./pages/MyJobs"));
const Companies = lazy(() => import("./pages/Companies"));
const CompanyProfile = lazy(() => import("./pages/CompanyProfile"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Minimal loading fallback to avoid layout shift
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Unified Dashboard - Context-based UI for all users */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <UnifiedDashboard />
                </ProtectedRoute>
              } />
              
              {/* Legacy role-based routes redirect to unified dashboard */}
              <Route path="/dashboard/student" element={
                <ProtectedRoute>
                  <UnifiedDashboard />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/employer" element={
                <ProtectedRoute>
                  <UnifiedDashboard />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/company" element={
                <ProtectedRoute>
                  <UnifiedDashboard />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/employee" element={
                <ProtectedRoute>
                  <UnifiedDashboard />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/mentor" element={
                <ProtectedRoute>
                  <UnifiedDashboard />
                </ProtectedRoute>
              } />
              
              {/* Protected routes */}
              <Route path="/certificates" element={
                <ProtectedRoute><Certificates /></ProtectedRoute>
              } />
              <Route path="/resume" element={
                <ProtectedRoute><Resume /></ProtectedRoute>
              } />
              <Route path="/connect" element={
                <ProtectedRoute><Connect /></ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute><Profile /></ProtectedRoute>
              } />
              <Route path="/profile/:userId" element={<PublicProfile />} />
              <Route path="/network" element={
                <ProtectedRoute><Network /></ProtectedRoute>
              } />
              <Route path="/add-post" element={
                <ProtectedRoute><AddPost /></ProtectedRoute>
              } />
              <Route path="/notifications" element={
                <ProtectedRoute><Notifications /></ProtectedRoute>
              } />
              <Route path="/jobs" element={
                <ProtectedRoute><Jobs /></ProtectedRoute>
              } />
              <Route path="/jobs/my-jobs" element={
                <ProtectedRoute><MyJobs /></ProtectedRoute>
              } />
              <Route path="/companies" element={
                <ProtectedRoute><Companies /></ProtectedRoute>
              } />
              <Route path="/company/:companyId" element={
                <ProtectedRoute><CompanyProfile /></ProtectedRoute>
              } />
              <Route path="/company/:companyId/jobs" element={
                <ProtectedRoute><CompanyProfile /></ProtectedRoute>
              } />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
