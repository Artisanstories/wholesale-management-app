import React from "react";
import {AppProvider, Frame, TopBar, Navigation} from "@shopify/polaris";
import {HomeIcon, ProductsIcon, CustomersIcon} from "@shopify/polaris-icons";
import Dashboard from "./pages/Dashboard";

const App: React.FC = () => {
  const [mobileNavActive, setMobileNavActive] = React.useState(false);
  const toggleMobileNav = React.useCallback(
    () => setMobileNavActive((m) => !m),
    []
  );

  const topBarMarkup = (
    <TopBar
      showNavigationToggle
      onNavigationToggle={toggleMobileNav}
    />
  );

  const navMarkup = (
    <Navigation location="/">
      <Navigation.Section
        items={[
          {label: "Dashboard", icon: HomeIcon, url: "/"},
          {label: "Products", icon: ProductsIcon, url: "/products"},
          {label: "Customers", icon: CustomersIcon, url: "/customers"},
        ]}
      />
    </Navigation>
  );

  return (
    <AppProvider i18n={{}}>
      <Frame
        topBar={topBarMarkup}
        navigation={navMarkup}
        showMobileNavigation={mobileNavActive}
        onNavigationDismiss={toggleMobileNav}
      >
        <Dashboard />
      </Frame>
    </AppProvider>
  );
};

export default App;
