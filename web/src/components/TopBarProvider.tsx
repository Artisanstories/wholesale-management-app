import { ReactNode } from "react";

/** Temporary pass-through until we wire App Bridge v4 */
export default function TopBarProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
