// Official four-square Microsoft mark, used for the "Continue with Microsoft"
// OAuth option. Shared between Login, Register, and Connected Services since
// lucide-react doesn't ship brand logos.
export const MicrosoftIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
  </svg>
);
