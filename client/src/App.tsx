import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Browse from "@/pages/browse";
import SellerDashboard from "@/pages/seller-dashboard";
import ProductDetails from "@/pages/product-details";
import Checkout from "@/pages/checkout";
import Orders from "@/pages/orders";
import OrderDetails from "@/pages/order-details";
import MyGroups from "@/pages/my-groups";
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
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/browse" component={Browse} />
          <Route path="/admin-super" component={AdminSuper} />
          <Route component={NotFound} />
        </>
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/browse" component={Browse} />
          <Route path="/cart" component={Cart} />
          <Route path="/seller" component={SellerDashboard} />
          <Route path="/seller/analytics" component={SellerAnalytics} />
          <Route path="/my-groups" component={MyGroups} />
          <Route path="/address" component={Address} />
          <Route path="/personal-info" component={PersonalInfo} />
          <Route path="/product/:id" component={ProductDetails} />
          <Route path="/checkout/:productId/:type" component={Checkout} />
          <Route path="/orders" component={Orders} />
          <Route path="/order/:orderId" component={OrderDetails} />
          <Route path="/admin-super" component={AdminSuper} />
          <Route component={NotFound} />
        </>
      )}
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
