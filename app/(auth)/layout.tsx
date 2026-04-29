import * as React from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="cq-shell">{children}</div>;
}
