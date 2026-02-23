import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
const Groups = lazy(() => import("./pages/Groups"));
const CreateGroup = lazy(() => import("./pages/CreateGroup"));
const Settings = lazy(() => import("./pages/Settings"));
const AccountPreferences = lazy(() => import("./pages/AccountPreferences"));
const MyApplications = lazy(() => import("./pages/MyApplications"));
const JobPreferences = lazy(() => import("./pages/JobPreferences"));
const SignInSecurity = lazy(() => import("./pages/SignInSecurity"));
const Visibility = lazy(() => import("./pages/Visibility"));
const DataPrivacy = lazy(() => import("./pages/DataPrivacy"));
const AdvertisingData = lazy(() => import("./pages/AdvertisingData"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const SavedPosts = lazy(() => import("./pages/SavedPosts"));
const SavedJobs = lazy(() => import("./pages/SavedJobs"));
const JobApplicants = lazy(() => import("./pages/JobApplicantsPage"));
const JobMessages = lazy(() => import("./pages/JobMessagesPage"));
const JobInsights = lazy(() => import("./pages/JobInsightsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const HelpCenter = lazy(() => import("./pages/resources/HelpCenter"));
const PrivacyPolicy = lazy(() => import("./pages/resources/PrivacyPolicy"));
const CommunityPolicies = lazy(() => import("./pages/resources/CommunityPolicies"));
const Accessibility = lazy(() => import("./pages/resources/Accessibility"));
const UserAgreement = lazy(() => import("./pages/resources/UserAgreement"));
const EULA = lazy(() => import("./pages/resources/EULA"));
const RecommendationTransparency = lazy(() => import("./pages/resources/RecommendationTransparency"));
const SettingsLayout = lazy(() => import("./layouts/SettingsLayout"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Minimal loading fallback to avoid layout shift
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="w-full min-h-screen overflow-x-hidden text-sm md:text-base text-foreground bg-background">
          <Toaster />
          <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/resources/help" element={<HelpCenter />} />
              <Route path="/resources/privacy" element={<PrivacyPolicy />} />
              <Route path="/resources/community-policies" element={<CommunityPolicies />} />
              <Route path="/resources/accessibility" element={<Accessibility />} />
              <Route path="/resources/user-agreement" element={<UserAgreement />} />
              <Route path="/resources/eula" element={<EULA />} />
              <Route path="/resources/recommendation-transparency" element={<RecommendationTransparency />} />
              
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
              <Route path="/jobs/applications" element={
                <ProtectedRoute><MyApplications /></ProtectedRoute>
              } />
              <Route path="/jobs/:jobId/applicants" element={
                <ProtectedRoute><JobApplicants /></ProtectedRoute>
              } />
              <Route path="/jobs/messages" element={
                <ProtectedRoute><JobMessages /></ProtectedRoute>
              } />
              <Route path="/jobs/:jobId/insights" element={
                <ProtectedRoute><JobInsights /></ProtectedRoute>
              } />
              <Route path="/jobs/preferences" element={
                <ProtectedRoute><JobPreferences /></ProtectedRoute>
              } />
              <Route path="/jobs/saved" element={
                <ProtectedRoute><SavedJobs /></ProtectedRoute>
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
              <Route path="/groups" element={
                <ProtectedRoute><Groups /></ProtectedRoute>
              } />
              <Route path="/groups/create" element={
                <ProtectedRoute><CreateGroup /></ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute><SettingsLayout /></ProtectedRoute>
              }>
                <Route index element={<Settings />} />
                <Route path="account" element={<AccountPreferences />} />
                <Route path="security" element={<SignInSecurity />} />
                <Route path="visibility" element={<Visibility />} />
                <Route path="privacy" element={<DataPrivacy />} />
                <Route path="advertising-data" element={<AdvertisingData />} />
                <Route path="notifications" element={<NotificationSettings />} />
              </Route>
              <Route path="/saved" element={
                <ProtectedRoute><SavedPosts /></ProtectedRoute>
              } />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
        </div>
      </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
