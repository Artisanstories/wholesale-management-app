import { BrowserRouter, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ShopifyAppWrapper from "./components/shopify-app-wrapper";
import ShopifyNavbar from "./components/layout/shopify-navbar";

function App() {
  return (
    <ShopifyAppWrapper>
      <BrowserRouter>
        <ShopifyNavbar />
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </ShopifyAppWrapper>
  );
}

export default App;