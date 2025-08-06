import React from "react";
import { Link } from "react-router-dom";

export default function ShopifyNavbar() {
  return (
    <nav className="p-4 bg-white border-b shadow-sm flex justify-between">
      <h1 className="font-bold text-lg">Artisan Wholesale</h1>
      <div className="space-x-4">
        <Link to="/dashboard" className="hover:underline">Dashboard</Link>
      </div>
    </nav>
  );
}