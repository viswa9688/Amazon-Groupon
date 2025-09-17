import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import SellerGuard from "@/components/SellerGuard";
import AuthGuard from "@/components/AuthGuard";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Browse from "@/pages/browse";
import BrowseCategory from "@/pages/browse-category";
import SellerDashboard from "@/pages/seller-dashboard";
import ProductDetails from "@/pages/product-details";
import Checkout from "@/pages/checkout";
import Orders from "@/pages/orders";
import OrderDetails from "@/pages/order-details";
import MyGroups from "@/pages/my-groups";
import UserGroup from "@/pages/user-group";
import SharedGroup from "@/pages/shared-group";
import Address from "@/pages/profile";
import PersonalInfo from "@/pages/personal-info.tsx";
import AdminSuper from "@/pages/admin-super";
import SellerAnalytics from "@/pages/seller-analytics";
import Cart from "@/pages/cart.tsx";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Browse} />
      <Route path="/browse" component={Browse} />
      <Route path="/browse/:category" component={BrowseCategory} />
      <Route path="/shared/:shareToken" component={SharedGroup} />
      <Route path="/seller">
        {() => <SellerGuard><SellerDashboard /></SellerGuard>}
      </Route>
      <Route path="/seller/analytics">
        {() => <SellerGuard><SellerAnalytics /></SellerGuard>}
      </Route>
      <Route path="/admin-super" component={AdminSuper} />
      
      <Route path="/cart">
        {() => <AuthGuard><Cart /></AuthGuard>}
      </Route>
      <Route path="/my-groups">
        {() => <AuthGuard><MyGroups /></AuthGuard>}
      </Route>
      <Route path="/user-group/:id">
        {(params) => <AuthGuard><UserGroup {...params} /></AuthGuard>}
      </Route>
      <Route path="/address">
        {() => <AuthGuard><Address /></AuthGuard>}
      </Route>
      <Route path="/personal-info">
        {() => <AuthGuard><PersonalInfo /></AuthGuard>}
      </Route>
      <Route path="/product/:id" component={ProductDetails} />
      <Route path="/checkout/:productId/:type">
        {(params) => <AuthGuard><Checkout {...params} /></AuthGuard>}
      </Route>
      <Route path="/orders">
        {() => <AuthGuard><Orders /></AuthGuard>}
      </Route>
      <Route path="/order/:orderId">
        {(params) => <AuthGuard><OrderDetails {...params} /></AuthGuard>}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
