export function LogoMark({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#5B5FEF"/>
    <path d="M10 8.5V23.5M10 8.5H22M10 16H19M10 23.5H22" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
