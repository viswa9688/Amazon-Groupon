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
import Profile from "@/pages/profile";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/browse" component={Browse} />
          <Route path="/seller" component={SellerDashboard} />
          <Route path="/my-groups" component={MyGroups} />
          <Route path="/profile" component={Profile} />
          <Route path="/product/:id" component={ProductDetails} />
          <Route path="/checkout/:productId/:type" component={Checkout} />
          <Route path="/orders" component={Orders} />
          <Route path="/order/:orderId" component={OrderDetails} />
        </>
      )}
      {/* Browse page accessible to all users */}
      <Route path="/browse" component={Browse} />
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
