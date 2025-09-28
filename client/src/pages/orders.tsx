import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError, redirectToLogin } from "@/lib/authUtils";
import Header from "@/components/Header";
import CustomerDeliveryTracker from "@/components/CustomerDeliveryTracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Clock, CheckCircle, XCircle, Eye } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import type { Order } from "@shared/schema";

export default function Orders() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, toast]);

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Refetch when component mounts
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error)) {
        return false; // Don't retry on auth errors
      }
      return failureCount < 3;
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          redirectToLogin();
        }, 500);
      }
    },
  });

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "processing":
        return <Package className="w-5 h-5 text-blue-500" />;
      default:
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      completed: "default",
      pending: "secondary",
      processing: "outline",
      shipped: "outline",
      delivered: "default",
    };

    return (
      <Badge variant={variants[status] || "secondary"} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    return type === "group" ? "👥" : "🛒";
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-page-title">
            Your Orders
          </h1>
          <p className="text-muted-foreground">
            Track your individual and group purchases
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !orders || orders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Orders Yet</h3>
              <p className="text-muted-foreground mb-6">
                You haven't placed any orders yet. Start shopping to see your orders here.
              </p>
              <Button onClick={() => window.location.href = "/browse"} data-testid="button-start-shopping">
                Start Shopping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} data-testid={`card-order-${order.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span className="text-lg">{getTypeIcon(order.type || "individual")}</span>
                        Order #{order.id}
                        <Badge variant="outline" className="text-xs">
                          {order.type === "group" ? "Group Purchase" : "Individual"}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Placed on {new Date(order.createdAt || "").toLocaleDateString()}
                      </CardDescription>
                    </div>
                    {getStatusBadge(order.status || "pending")}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(order.status || "pending")}
                      <div className="flex-1">
                        {order.items && order.items.length > 0 ? (
                          <div className="space-y-2">
                            <p className="font-medium text-foreground">
                              {order.items.length} item{order.items.length > 1 ? 's' : ''} in this order
                            </p>
                            <div className="space-y-1">
                              {order.items.map((item: any, index: number) => (
                                <div key={index} className="text-sm text-muted-foreground">
                                  <span className="font-medium">{item.product?.name || `Product ${item.productId}`}</span>
                                  <span className="ml-2">Qty: {item.quantity} × ${item.unitPrice}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium text-foreground">
                              Quantity: {order.quantity || 1}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Unit Price: ${order.unitPrice || '0.00'} • Total: ${order.totalPrice || '0.00'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right space-y-2 ml-4">
                      <p className="text-lg font-semibold text-foreground" data-testid={`text-total-${order.id}`}>
                        ${order.finalPrice || order.totalPrice}
                      </p>
                      {order.type === "group" && order.status === "pending" && (
                        <p className="text-xs text-muted-foreground">
                          Waiting for group to complete
                        </p>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/order/${order.id}`)}
                        data-testid={`button-view-details-${order.id}`}
                        className="w-full"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </div>
                  
                  {order.shippingAddress && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        <strong>Shipping to:</strong> {order.shippingAddress}
                      </p>
                    </div>
                  )}
                  
                  {/* Delivery Status Tracker */}
                  <div className="mt-4 pt-4 border-t">
                    <CustomerDeliveryTracker
                      orderId={order.id!}
                      status={order.status || 'pending'}
                      expectedDeliveryDate={order.expectedDeliveryDate}
                      actualDeliveryDate={order.actualDeliveryDate}
                      orderTime={order.createdAt}
                      showCutoffInfo={true}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}