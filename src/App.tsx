import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import UnifiedDashboard from "./pages/UnifiedDashboard";
import Certificates from "./pages/Certificates";
import Resume from "./pages/Resume";
import Connect from "./pages/Connect";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import Network from "./pages/Network";
import AddPost from "./pages/AddPost";
import Notifications from "./pages/Notifications";
import Jobs from "./pages/Jobs";
import Companies from "./pages/Companies";
import CompanyProfile from "./pages/CompanyProfile";
import CompanyJobs from "./pages/CompanyJobs";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            <Route path="/jobs/create" element={
              <ProtectedRoute><Jobs createMode={true} /></ProtectedRoute>
            } />
            <Route path="/jobs" element={
              <ProtectedRoute><Jobs /></ProtectedRoute>
            } />
            <Route path="/companies" element={
              <ProtectedRoute><Companies /></ProtectedRoute>
            } />
            <Route path="/company/:companyId" element={
              <ProtectedRoute><CompanyProfile /></ProtectedRoute>
            } />
            <Route path="/companies/:companyId/jobs" element={
              <ProtectedRoute><CompanyJobs /></ProtectedRoute>
            } />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
