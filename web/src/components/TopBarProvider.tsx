import { AppBridgeProvider } from "@shopify/app-bridge-react";
import { ReactNode, useMemo } from "react";

export default function TopBarProvider({ children }: { children: ReactNode }) {
  const config = useMemo(() => {
    const host = new URLSearchParams(location.search).get("host") || window.__SHOPIFY_HOST;
    const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY as string;
    return { host, apiKey, forceRedirect: true };
  }, []);
  return <AppBridgeProvider config={config}>{children}</AppBridgeProvider>;
}
