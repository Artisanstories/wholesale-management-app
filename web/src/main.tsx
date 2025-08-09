import React from "react";
import ReactDOM from "react-dom/client";
import "@shopify/polaris/build/esm/styles.css";
import "./app.css";
import App from "./App";
import TopBarProvider from "./components/TopBarProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TopBarProvider>
      <App />
    </TopBarProvider>
  </React.StrictMode>
);
