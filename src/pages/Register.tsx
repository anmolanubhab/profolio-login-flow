import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, User, Mail, Phone, Lock } from 'lucide-react';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';
import { sanitizeInput } from '@/lib/input-sanitizer';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const validateForm = () => {
    const sanitizedName = sanitizeInput(formData.name);
    const sanitizedEmail = sanitizeInput(formData.email.toLowerCase());
    const sanitizedMobile = sanitizeInput(formData.mobile);

    if (!sanitizedName || sanitizedName.length < 2) {
      toast({
        title: "Invalid Name",
        description: "Please enter a valid name (at least 2 characters)",
        variant: "destructive"
      });
      return false;
    }

    if (!sanitizedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast({
        title: "Invalid Email", 
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return false;
    }

    if (!sanitizedMobile.match(/^[0-9+\-() ]{10,}$/)) {
      toast({
        title: "Invalid Mobile",
        description: "Please enter a valid mobile number (at least 10 digits)", 
        variant: "destructive"
      });
      return false;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters long",
        variant: "destructive"
      });
      return false;
    }

    if (!formData.password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)) {
      toast({
        title: "Weak Password",
        description: "Password must contain uppercase, lowercase, and numbers",
        variant: "destructive"
      });
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please ensure both passwords are identical",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const getPasswordStrength = (pwd: string) => {
    if (pwd.length === 0) return { strength: 0, label: '', color: '' };
    if (pwd.length < 6) return { strength: 25, label: 'Weak', color: 'bg-destructive' };
    if (pwd.length < 8) return { strength: 50, label: 'Fair', color: 'bg-yellow-500' };
    if (pwd.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/) && pwd.length >= 8) {
      return { strength: 100, label: 'Strong', color: 'bg-green-500' };
    }
    return { strength: 75, label: 'Good', color: 'bg-[hsl(211,100%,45%)]' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    // Rate limiting
    const rateLimitKey = `register-${formData.email}`;
    if (rateLimiter.isRateLimited(rateLimitKey, RATE_LIMITS.PROFILE_UPDATE)) {
      const resetTime = Math.ceil(rateLimiter.getTimeUntilReset(rateLimitKey) / 1000);
      toast({
        title: "Too Many Attempts",
        description: `Please wait ${resetTime} seconds before trying again.`,
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;
      const sanitizedEmail = sanitizeInput(formData.email.toLowerCase());
      
      const { data, error } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password: formData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: sanitizeInput(formData.name),
            mobile: sanitizeInput(formData.mobile)
          }
        }
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          toast({
            title: "Account Exists",
            description: "An account with this email already exists. Please log in.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Registration Failed",
            description: error.message,
            variant: "destructive"
          });
        }
        return;
      }

      if (data.user) {
        toast({
          title: "Registration Successful!",
          description: "Please check your email to verify your account before logging in.",
        });
        navigate('/');
      }
    } catch (error) {
      toast({
        title: "Registration Failed", 
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignup = async (provider: 'google' | 'linkedin_oidc') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`,
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
        description: "An unexpected error occurred during OAuth signup.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-hidden flex flex-col items-center justify-center p-4 relative">
      {/* Multi-layer Rainbow Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[hsl(200,90%,55%)] via-[hsl(280,80%,60%)] to-[hsl(330,85%,65%)] animate-gradient-shift" />
      <div className="fixed inset-0 bg-gradient-to-tr from-[hsl(45,100%,65%,0.4)] via-transparent to-[hsl(180,70%,50%,0.2)]" />
      <div className="fixed inset-0 bg-gradient-to-bl from-transparent via-[hsl(300,70%,55%,0.2)] to-[hsl(20,90%,60%,0.3)]" />
      
      {/* Animated floating orbs */}
      <div className="fixed top-1/4 left-1/4 w-80 h-80 bg-[hsl(50,100%,70%,0.3)] rounded-full blur-3xl animate-float-slow" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-[hsl(280,90%,65%,0.25)] rounded-full blur-3xl animate-float-delayed" />
      <div className="fixed top-1/2 left-1/2 w-72 h-72 bg-[hsl(200,90%,60%,0.2)] rounded-full blur-3xl animate-float-reverse" />

      {/* Logo & Branding */}
      <div className="relative z-10 text-center mb-6 animate-fade-in-up">
        <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-wide drop-shadow-2xl" style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '0.05em' }}>
          PROFOLIO
        </h1>
        <p className="text-sm sm:text-base text-white/90 mt-2 font-medium tracking-wide drop-shadow-lg">
          Your Career, Verified.
        </p>
      </div>

      {/* Register Card - Glassmorphism */}
      <div className="w-full max-w-md relative z-10 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <Card className="backdrop-blur-2xl bg-white/95 border-white/40 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="text-center pb-4 pt-6">
            <CardTitle className="text-2xl font-semibold text-gray-800">Create Account</CardTitle>
            <CardDescription className="text-gray-500">
              Join Profolio to build your professional profile
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleInputChange}
                  icon={<User className="h-4 w-4 text-gray-400" />}
                  className="h-12 bg-white border-gray-200 focus:border-[hsl(211,100%,50%)] focus:ring-2 focus:ring-[hsl(211,100%,50%,0.2)] rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange}
                  icon={<Mail className="h-4 w-4 text-gray-400" />}
                  className="h-12 bg-white border-gray-200 focus:border-[hsl(211,100%,50%)] focus:ring-2 focus:ring-[hsl(211,100%,50%,0.2)] rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile" className="text-gray-700">Mobile Number</Label>
                <Input
                  id="mobile"
                  name="mobile"
                  type="tel"
                  placeholder="Enter your mobile number"
                  value={formData.mobile}
                  onChange={handleInputChange}
                  icon={<Phone className="h-4 w-4 text-gray-400" />}
                  className="h-12 bg-white border-gray-200 focus:border-[hsl(211,100%,50%)] focus:ring-2 focus:ring-[hsl(211,100%,50%,0.2)] rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password (min. 8 chars)"
                    value={formData.password}
                    onChange={handleInputChange}
                    icon={<Lock className="h-4 w-4 text-gray-400" />}
                    className="h-12 bg-white border-gray-200 focus:border-[hsl(211,100%,50%)] focus:ring-2 focus:ring-[hsl(211,100%,50%,0.2)] pr-12 rounded-xl"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {formData.password && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Password Strength</span>
                      <span className={`font-medium ${
                        passwordStrength.strength === 100 ? 'text-green-600' :
                        passwordStrength.strength >= 75 ? 'text-blue-600' :
                        passwordStrength.strength >= 50 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${passwordStrength.color} transition-all duration-300`}
                        style={{ width: `${passwordStrength.strength}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-gray-700">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    icon={<Lock className="h-4 w-4 text-gray-400" />}
                    className="h-12 bg-white border-gray-200 focus:border-[hsl(211,100%,50%)] focus:ring-2 focus:ring-[hsl(211,100%,50%,0.2)] pr-12 rounded-xl"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold bg-[hsl(211,100%,45%)] hover:bg-[hsl(211,100%,40%)] text-white shadow-lg shadow-[hsl(211,100%,45%,0.3)] transition-all duration-300 hover:shadow-xl hover:shadow-[hsl(211,100%,45%,0.4)] hover:-translate-y-0.5 rounded-xl" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Creating Account...
                  </span>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>

            <div className="relative my-5">
              <Separator className="bg-gray-200" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-white px-4 text-xs text-gray-400 font-medium">
                  or continue with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="h-12 bg-white hover:bg-gray-50 border-gray-200 shadow-sm hover:shadow transition-all duration-200 rounded-xl"
                onClick={() => handleOAuthSignup('google')}
                type="button"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-12 bg-white hover:bg-gray-50 border-gray-200 shadow-sm hover:shadow transition-all duration-200 rounded-xl"
                onClick={() => handleOAuthSignup('linkedin_oidc')}
                type="button"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#0A66C2">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </Button>
            </div>

            <div className="mt-5 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{' '}
                <Link 
                  to="/" 
                  className="font-semibold text-[hsl(211,100%,45%)] hover:text-[hsl(211,100%,35%)] transition-colors"
                >
                  Sign In
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
