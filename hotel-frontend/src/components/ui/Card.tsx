import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-slate-200/70 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-slate-200/70 flex items-center justify-between gap-2">
      {children}
    </div>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="px-4 py-4">{children}</div>;
}

export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-3 border-t border-slate-200/70 flex justify-end gap-2">
      {children}
    </div>
  );
}
