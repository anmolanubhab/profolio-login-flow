import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';
import { sanitizeInput } from '@/lib/input-sanitizer';
import { useAuth } from '@/contexts/AuthContext';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, session } = useAuth();

  // Redirect if already authenticated - simple unified dashboard
  useEffect(() => {
    if (user && session) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Rate limiting
    const rateLimitKey = `login-${email}`;
    if (rateLimiter.isRateLimited(rateLimitKey, RATE_LIMITS.POST_CREATE)) {
      const resetTime = Math.ceil(rateLimiter.getTimeUntilReset(rateLimitKey) / 1000);
      toast({
        title: "Too Many Attempts",
        description: `Please wait ${resetTime} seconds before trying again.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    const sanitizedEmail = sanitizeInput(email.toLowerCase());
    
    // Validate email format
    if (!sanitizedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password,
      });

      if (error) {
        // Specific error handling
        if (error.message.includes('Email not confirmed')) {
          toast({
            title: "Email Not Verified",
            description: "Please check your email and click the verification link.",
            variant: "destructive",
          });
        } else if (error.message.includes('Invalid login credentials')) {
          toast({
            title: "Invalid Credentials",
            description: "The email or password you entered is incorrect.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Login Failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else if (data.user) {
        toast({
          title: "Welcome back!",
          description: "You have been logged in successfully.",
        });
        // Simple redirect to unified dashboard
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      toast({
        title: "Login Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'linkedin_oidc') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        toast({
          title: "OAuth Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "OAuth Error",
        description: "An unexpected error occurred during OAuth login.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-y-auto flex flex-col items-center justify-center p-4 relative">
      {/* Multi-layer Rainbow Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[hsl(200,90%,55%)] via-[hsl(280,80%,60%)] to-[hsl(330,85%,65%)] animate-gradient-shift" />
      <div className="fixed inset-0 bg-gradient-to-tr from-[hsl(45,100%,65%,0.4)] via-transparent to-[hsl(180,70%,50%,0.2)]" />
      <div className="fixed inset-0 bg-gradient-to-bl from-transparent via-[hsl(300,70%,55%,0.2)] to-[hsl(20,90%,60%,0.3)]" />
      
      {/* Animated floating orbs for premium depth */}
      <div className="fixed top-1/4 left-1/4 w-80 h-80 bg-[hsl(50,100%,70%,0.3)] rounded-full blur-3xl animate-float-slow" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-[hsl(280,90%,65%,0.25)] rounded-full blur-3xl animate-float-delayed" />
      <div className="fixed top-1/2 left-1/2 w-72 h-72 bg-[hsl(200,90%,60%,0.2)] rounded-full blur-3xl animate-float-reverse" />
      <div className="fixed bottom-1/3 left-1/3 w-64 h-64 bg-[hsl(330,90%,70%,0.25)] rounded-full blur-3xl animate-float-slow" />

      {/* Logo & Branding */}
      <div className="relative z-10 text-center mb-8 animate-fade-in-up">
        <h1 className="text-5xl sm:text-6xl font-bold text-white tracking-wide drop-shadow-2xl" style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '0.05em' }}>
          PROFOLIO
        </h1>
        <p className="text-base sm:text-lg text-white/90 mt-3 font-medium tracking-wide drop-shadow-lg">
          Your Career, Verified.
        </p>
      </div>

      {/* Login Card - Glassmorphism */}
      <div className="w-full max-w-md relative z-10 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <Card className="backdrop-blur-2xl bg-white/95 border-white/40 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="text-center pb-4 pt-6">
            <CardTitle className="text-2xl font-semibold text-gray-800">
              Welcome back
            </CardTitle>
            <CardDescription className="text-gray-500">
              Sign in to continue to Profolio
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-5 px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="h-4 w-4 text-gray-400" />}
                  className="h-12 bg-white border-gray-200 focus:border-[hsl(211,100%,50%)] focus:ring-2 focus:ring-[hsl(211,100%,50%,0.2)] rounded-xl"
                  required
                />
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    icon={<Lock className="h-4 w-4 text-gray-400" />}
                    className="h-12 bg-white border-gray-200 focus:border-[hsl(211,100%,50%)] focus:ring-2 focus:ring-[hsl(211,100%,50%,0.2)] pr-12 rounded-xl"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-all duration-200 w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Forgot Password */}
              <div className="text-right">
                <Link
                  to="/forgot-password"
                  className="text-sm text-[hsl(211,100%,45%)] hover:text-[hsl(211,100%,35%)] font-medium transition-all duration-200"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Login Button */}
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold bg-[hsl(211,100%,45%)] hover:bg-[hsl(211,100%,40%)] text-white shadow-lg shadow-[hsl(211,100%,45%,0.3)] transition-all duration-300 hover:shadow-xl hover:shadow-[hsl(211,100%,45%,0.4)] hover:-translate-y-0.5 rounded-xl" 
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            {/* Separator */}
            <div className="relative py-2">
              <Separator className="bg-gray-200" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-white px-4 text-xs text-gray-700 font-medium">
                  or
                </span>
              </div>
            </div>

            {/* Social Login */}
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full h-12 bg-white hover:bg-gray-50 border-gray-200 shadow-sm hover:shadow transition-all duration-200 rounded-xl flex items-center justify-center gap-3"
                onClick={() => handleOAuthLogin('google')}
                type="button"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-gray-700 font-medium">Sign in with Google</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full h-12 bg-white hover:bg-gray-50 border-gray-200 shadow-sm hover:shadow transition-all duration-200 rounded-xl flex items-center justify-center gap-3"
                onClick={() => handleOAuthLogin('linkedin_oidc')}
                type="button"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#0A66C2">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                <span className="text-gray-700 font-medium">Sign in with Profolio</span>
              </Button>
            </div>

            {/* Sign Up Link */}
            <div className="text-center text-sm text-gray-500 pt-4 border-t border-gray-100">
              New to Profolio?{' '}
              <Link 
                to="/register" 
                className="text-[hsl(211,100%,45%)] hover:text-[hsl(211,100%,35%)] font-semibold transition-all duration-200"
              >
                Join now
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
