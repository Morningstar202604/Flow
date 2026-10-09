import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import BuyerLayout from './components/BuyerLayout';
import HomePage from './pages/Home/HomePage';
import ProductListPage from './pages/ProductList/ProductListPage';
import ProductDetailPage from './pages/ProductDetail/ProductDetailPage';
import CartPage from './pages/Cart/CartPage';
import CheckoutPage from './pages/Checkout/CheckoutPage';
import OrdersPage from './pages/Orders/OrdersPage';
import FavoritesPage from './pages/Favorites/FavoritesPage';
import AddressesPage from './pages/AddressesPage';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';
import SellerLayout from './components/SellerLayout';
import SellerRouteGuard from './components/SellerRouteGuard';
import DashboardPage from './pages/seller/DashboardPage';
import ProductManagePage from './pages/seller/ProductManagePage';
import OrderManagePage from './pages/seller/OrderManagePage';
import InquiryManagePage from './pages/seller/InquiryManagePage';
import AICenterPage from './pages/seller/AICenterPage';
import CouponsPage from './pages/seller/CouponsPage/CouponsPage';
import RefundsManagePage from './pages/seller/RefundsManagePage';
import ShippingTemplatesPage from './pages/seller/ShippingTemplatesPage';
import CollectionsPage from './pages/seller/CollectionsPage';
import CmsPagesPage from './pages/seller/CmsPagesPage';
import AuditLogPage from './pages/seller/AuditLogPage';
import CmsPageView from './pages/CmsPageView';
import NotFound from './pages/NotFound/NotFound';
import ChatWidget from './components/ChatWidget';

const RoutesComponent = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Public CMS pages */}
          <Route path="/page/:slug" element={<CmsPageView />} />
          <Route element={<BuyerLayout />}>
            <Route index element={<HomePage />} />
            <Route path="products" element={<ProductListPage />} />
            <Route path="products/:id" element={<ProductDetailPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="addresses" element={<AddressesPage />} />
          </Route>
          <Route
            path="seller"
            element={
              <SellerRouteGuard>
                <SellerLayout />
              </SellerRouteGuard>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="products" element={<ProductManagePage />} />
            <Route path="orders" element={<OrderManagePage />} />
            <Route path="inquiries" element={<InquiryManagePage />} />
            <Route path="ai-center" element={<AICenterPage />} />
            <Route path="coupons" element={<CouponsPage />} />
            <Route path="refunds" element={<RefundsManagePage />} />
            <Route path="shipping-templates" element={<ShippingTemplatesPage />} />
            <Route path="collections" element={<CollectionsPage />} />
            <Route path="cms-pages" element={<CmsPagesPage />} />
            <Route path="audit-logs" element={<AuditLogPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        <ChatWidget />
        <Toaster position="top-right" />
      </AuthProvider>
    </LanguageProvider>
  );
};

export default RoutesComponent;
