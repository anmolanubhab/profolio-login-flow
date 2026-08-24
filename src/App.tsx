import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Certificates from "./pages/Certificates";
import Resume from "./pages/Resume";
import Connect from "./pages/Connect";
import Profile from "./pages/Profile";
import SettingsPage from "./pages/settings/SettingsPage";
import ChangePasswordPage from "./pages/settings/ChangePasswordPage";
import ActiveSessionsPage from "./pages/settings/ActiveSessionsPage";
import PublicProfile from "./pages/PublicProfile";
import Network from "./pages/Network";
import AddPost from "./pages/AddPost";
import Notifications from "./pages/Notifications";
import SavedPosts from "./pages/SavedPosts";
import PostDetail from "./pages/PostDetail";
import Story from "./pages/Story";
import Jobs from "./pages/Jobs";
import Companies from "./pages/Companies";
import CompanyProfile from "./pages/CompanyProfile";
import CompanyInviteAccept from "./pages/CompanyInviteAccept";
import Groups from "./pages/Groups";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
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
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/certificates" element={<Certificates />} />
          <Route path="/resume" element={<Resume />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:category" element={<SettingsPage />} />
          <Route path="/settings/security/change-password" element={<ChangePasswordPage />} />
          <Route path="/settings/security/active-sessions" element={<ActiveSessionsPage />} />
          <Route path="/profile/:userId" element={<PublicProfile />} />
          <Route path="/network" element={<Network />} />
          <Route path="/add-post" element={<AddPost />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/saved-posts" element={<SavedPosts />} />
          <Route path="/post/:postId" element={<PostDetail />} />
          <Route path="/story/:storyId" element={<Story />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/company/:companyId" element={<CompanyProfile />} />
          <Route path="/company-invite/:invitationId/:token" element={<CompanyInviteAccept />} />
          <Route path="/groups" element={<Groups />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
