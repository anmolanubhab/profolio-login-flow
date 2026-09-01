import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import MfaChallenge from "./pages/MfaChallenge";
import Dashboard from "./pages/Dashboard";
import Certificates from "./pages/Certificates";
import Resume from "./pages/Resume";
import Connect from "./pages/Connect";
import Profile from "./pages/Profile";
import SettingsPage from "./pages/settings/SettingsPage";
import ChangePasswordPage from "./pages/settings/ChangePasswordPage";
import ActiveSessionsPage from "./pages/settings/ActiveSessionsPage";
import ChangeEmailPage from "./pages/settings/ChangeEmailPage";
import TwoStepVerificationPage from "./pages/settings/TwoStepVerificationPage";
import DownloadDataPage from "./pages/settings/DownloadDataPage";
import AccountStatusPage from "./pages/settings/AccountStatusPage";
import ConnectedServicesPage from "./pages/settings/ConnectedServicesPage";
import ManageDataPage from "./pages/settings/ManageDataPage";
import PhoneNumberPage from "./pages/settings/PhoneNumberPage";
import PublicProfile from "./pages/PublicProfile";
import Network from "./pages/Network";
import AddPost from "./pages/AddPost";
import Notifications from "./pages/Notifications";
import SavedPosts from "./pages/SavedPosts";
import FeedPreferences from "./pages/FeedPreferences";
import PostDetail from "./pages/PostDetail";
import Story from "./pages/Story";
import Jobs from "./pages/Jobs";
import Companies from "./pages/Companies";
import CreateCompany from "./pages/CreateCompany";
import CompanyProfile from "./pages/CompanyProfile";
import CandidateSearch from "./pages/CandidateSearch";
import RecruiterCandidateProfile from "./pages/RecruiterCandidateProfile";
import CompanyInviteAccept from "./pages/CompanyInviteAccept";
import Groups from "./pages/Groups";
import Events from "./pages/Events";
import InsightsPage from "./pages/insights/InsightsPage";
import InsightDetailPage from "./pages/insights/InsightDetailPage";
import InsightArticlePage from "./pages/insights/InsightArticlePage";
import InsightEditorPage from "./pages/insights/InsightEditorPage";
import NotFound from "./pages/NotFound";
import { RequireAal2 } from "./components/RequireAal2";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/mfa-challenge" element={<MfaChallenge />} />

            {/* Every route below requires a full session -- RequireAal2 blocks
                entry (redirecting to /mfa-challenge) whenever Supabase itself
                reports the session still needs an MFA step-up, re-checked on
                every navigation so it can't be bypassed via refresh, direct
                URL access, or back/forward. */}
            <Route element={<RequireAal2 />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/certificates" element={<Certificates />} />
              <Route path="/resume" element={<Resume />} />
              <Route path="/connect" element={<Connect />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/:category" element={<SettingsPage />} />
              <Route path="/settings/security/change-password" element={<ChangePasswordPage />} />
              <Route path="/settings/security/active-sessions" element={<ActiveSessionsPage />} />
              <Route path="/settings/security/change-email" element={<ChangeEmailPage />} />
              <Route path="/settings/security/two-step-verification" element={<TwoStepVerificationPage />} />
              <Route path="/settings/security/phone" element={<PhoneNumberPage />} />
              <Route path="/settings/privacy/download-data" element={<DownloadDataPage />} />
              <Route path="/settings/account/status" element={<AccountStatusPage />} />
              <Route path="/settings/privacy/connected-services" element={<ConnectedServicesPage />} />
              <Route path="/settings/privacy/manage-data" element={<ManageDataPage />} />
              <Route path="/profile/:userId" element={<PublicProfile />} />
              <Route path="/network" element={<Network />} />
              <Route path="/add-post" element={<AddPost />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/saved-posts" element={<SavedPosts />} />
              <Route path="/feed/preferences" element={<FeedPreferences />} />
              <Route path="/post/:postId" element={<PostDetail />} />
              <Route path="/story/:storyId" element={<Story />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/companies" element={<Companies />} />
              <Route path="/companies/new" element={<CreateCompany />} />
              <Route path="/company/:companyId" element={<CompanyProfile />} />
              <Route path="/company/:companyId/candidates" element={<CandidateSearch />} />
              <Route path="/company/:companyId/candidates/:candidateId" element={<RecruiterCandidateProfile />} />
              <Route path="/company-invite/:invitationId/:token" element={<CompanyInviteAccept />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/events" element={<Events />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/insights/:slug" element={<InsightDetailPage />} />
              <Route path="/insights/:slug/write" element={<InsightEditorPage />} />
              <Route path="/insights/:slug/:articleSlug" element={<InsightArticlePage />} />
              <Route path="/insights/:slug/:articleSlug/edit" element={<InsightEditorPage />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
