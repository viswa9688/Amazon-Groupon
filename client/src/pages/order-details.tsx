import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Package, CreditCard, Truck, MapPin, Calendar, CheckCircle } from "lucide-react";
import Header from "@/components/Header";
import CustomerDeliveryTracker from "@/components/CustomerDeliveryTracker";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError, redirectToLogin } from "@/lib/authUtils";
import type { Order, Product } from "@shared/schema";

export default function OrderDetails() {
  const { orderId } = useParams();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
        setTimeout(() => {
          redirectToLogin();
        }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: order, isLoading: orderLoading, error } = useQuery<Order & { items: any[] }>({
    queryKey: ["/api/orders", orderId],
    enabled: !!orderId && !!isAuthenticated,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Refetch when component mounts
    retry: false,
  });

  // Handle unauthorized error
  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
        setTimeout(() => {
          redirectToLogin();
        }, 500);
    }
  }, [error, toast]);

  if (isLoading || orderLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Order Not Found</h1>
            <p className="text-muted-foreground mb-6">We couldn't find the order you're looking for.</p>
            <Button onClick={() => navigate("/orders")} data-testid="button-back-to-orders">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Orders
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate estimated delivery date (7-14 business days from order date)
  const orderDate = new Date(order.createdAt);
  const estimatedDelivery = new Date(orderDate);
  estimatedDelivery.setDate(orderDate.getDate() + 10); // 10 days average

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/orders")}
            data-testid="button-back-to-orders"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Button>
          <Badge className={getStatusColor(order.status)} data-testid="badge-order-status">
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="w-5 h-5 mr-2" />
                  Product Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                {order?.items && order.items.length > 0 ? (
                  <div className="space-y-4">
                    {order.items.map((item: any, index: number) => (
                      <div key={index} className="flex gap-4 p-4 border rounded-lg">
                        {item.product ? (
                          <>
                            <img
                              src={item.product?.imageUrl || `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop`}
                              alt={item.product?.name || 'Product'}
                              className="w-24 h-24 object-cover rounded-lg"
                              data-testid={`img-product-${index}`}
                            />
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-foreground" data-testid={`text-product-name-${index}`}>
                                {item.product?.name || 'Product Name'}
                              </h3>
                              <p className="text-muted-foreground mt-1" data-testid={`text-product-description-${index}`}>
                                {item.product?.description || 'Product description'}
                              </p>
                              <div className="mt-3 flex items-center justify-between">
                                <div>
                                  <span className="text-sm text-muted-foreground">Purchase Type: </span>
                                  <Badge variant="outline" data-testid={`badge-purchase-type-${index}`}>
                                    {order.type.charAt(0).toUpperCase() + order.type.slice(1)}
                                  </Badge>
                                </div>
                                <div>
                                  <span className="text-sm text-muted-foreground">Quantity: </span>
                                  <span className="font-medium" data-testid={`text-quantity-${index}`}>{item.quantity}</span>
                                </div>
                                <div>
                                  <span className="text-sm text-muted-foreground">Unit Price: </span>
                                  <span className="font-medium" data-testid={`text-unit-price-${index}`}>${item.unitPrice}</span>
                                </div>
                                <div>
                                  <span className="text-sm text-muted-foreground">Total: </span>
                                  <span className="font-medium" data-testid={`text-total-price-${index}`}>${item.totalPrice}</span>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          // Handle delivery fee or other non-product items
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-foreground">
                              Delivery Fee
                            </h3>
                            <p className="text-muted-foreground mt-1">
                              Shipping and handling charges
                            </p>
                            <div className="mt-3 flex items-center justify-between">
                              <div>
                                <span className="text-sm text-muted-foreground">Type: </span>
                                <Badge variant="outline">Delivery</Badge>
                              </div>
                              <div>
                                <span className="text-sm text-muted-foreground">Amount: </span>
                                <span className="font-medium">${item.totalPrice}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No product details available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order?.items && order.items.length > 0 ? (
                    <>
                      {order.items.map((item: any, index: number) => (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">{item.product?.name || 'Product'}</span>
                            <span className="text-sm text-muted-foreground">Qty: {item.quantity}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Unit Price:</span>
                            <span data-testid={`text-unit-price-${index}`}>${item.unitPrice}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Item Total:</span>
                            <span data-testid={`text-item-total-${index}`}>${item.totalPrice}</span>
                          </div>
                        </div>
                      ))}
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Order Total:</span>
                        <span data-testid="text-order-total">${order.totalPrice}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Final Price:</span>
                        <span data-testid="text-final-price">${order.finalPrice}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Total Paid:</span>
                        <span className="text-primary" data-testid="text-total-paid">${order.finalPrice}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Unit Price:</span>
                        <span className="font-medium" data-testid="text-unit-price">${order.unitPrice || '0.00'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Quantity:</span>
                        <span data-testid="text-payment-quantity">{order.quantity || 1}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span data-testid="text-subtotal">${order.totalPrice}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Final Price:</span>
                        <span data-testid="text-final-price">${order.finalPrice}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Total Paid:</span>
                        <span className="text-primary" data-testid="text-total-paid">${order.finalPrice}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Payment Status:</span>
                    <Badge className="bg-green-100 text-green-800" data-testid="badge-payment-status">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Paid
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground" data-testid="text-shipping-address">
                  {order.shippingAddress || "Standard International Shipping Address"}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  We'll ship to your provided address via our trusted international shipping partner.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Delivery Timeline */}
          <div className="space-y-6">
            <CustomerDeliveryTracker
              orderId={order.id!}
              status={order.status || 'pending'}
              expectedDeliveryDate={order.expectedDeliveryDate}
              actualDeliveryDate={order.actualDeliveryDate}
              orderTime={order.createdAt}
              showCutoffInfo={true}
            />

            {/* Order Information */}
            <Card>
              <CardHeader>
                <CardTitle>Order Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order ID:</span>
                    <span className="font-mono" data-testid="text-order-id">#{order.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Date:</span>
                    <span data-testid="text-order-date-short">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Updated:</span>
                    <span data-testid="text-last-updated">
                      {new Date(order.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
