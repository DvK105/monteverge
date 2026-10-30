import type { ReactNode } from "react";

// Remounts on every navigation, giving each route a soft fade-in via .page-view.
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-view min-h-svh w-full flex flex-col">{children}</div>;
}
