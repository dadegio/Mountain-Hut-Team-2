import type { ReactNode } from "react";

export default function Step({ number, title, actions, children }: {
  number: number;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-6 h-6 rounded-full bg-green-700 text-white text-xs font-semibold flex items-center justify-center">
          {number}
        </span>
        <h3 className="font-semibold">{title}</h3>
        {actions && <div className="ml-auto flex flex-wrap gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
