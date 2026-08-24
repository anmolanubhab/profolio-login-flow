/**
 * Password rules shared by every password-entry flow (recovery reset,
 * authenticated change). Single source of truth so the requirement shown
 * to the user always matches what's actually enforced before calling
 * supabase.auth.updateUser.
 */
export const PASSWORD_MIN_LENGTH = 8;

export function getPasswordStrength(pwd: string) {
  if (pwd.length === 0) return { strength: 0, label: '', color: '' };
  if (pwd.length < 6) return { strength: 25, label: 'Weak', color: 'bg-destructive' };
  if (pwd.length < PASSWORD_MIN_LENGTH) return { strength: 50, label: 'Fair', color: 'bg-warning' };
  if (pwd.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/) && pwd.length >= PASSWORD_MIN_LENGTH) {
    return { strength: 100, label: 'Strong', color: 'bg-success' };
  }
  return { strength: 75, label: 'Good', color: 'bg-primary' };
}
