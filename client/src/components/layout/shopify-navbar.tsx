import React from "react";
import { Frame, TopBar } from "@shopify/polaris";

export default function TopNav() {
  return (
    <Frame
      topBar={
        <TopBar
          showNavigationToggle={false}
          userMenu={<div />}
        />
      }
    />
  );
}
