import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/Header";
import AddressManager from "@/components/AddressManager";
import DeliveryFeeDisplay from "@/components/DeliveryFeeDisplay";
import { ShoppingCart, MapPin, Package, CreditCard } from "lucide-react";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface CartItem {
  id: number;
  productId: number;
  quantity: number;
  addedAt: string;
  product: {
    id: number;
    name: string;
    description: string;
    originalPrice: string;
    imageUrl: string;
    seller: {
      id: string;
      firstName: string;
      lastName: string;
    };
    category: {
      name: string;
    };
  };
}

const PaymentForm = ({ 
  amount, 
  cartItems,
  selectedAddressId,
  deliveryFee,
  productPrice,
  clientSecret
}: { 
  amount: number; 
  cartItems: CartItem[];
  selectedAddressId: number | null;
  deliveryFee: number;
  productPrice: number;
  clientSecret: string;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    if (!selectedAddressId) {
      toast({
        title: "Address Required",
        description: "Please select a delivery address before proceeding with payment.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required", // Only redirect if 3D Secure authentication is needed
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message || "An error occurred during payment processing.",
        variant: "destructive",
      });
    } else {
      // Payment successful - now create the order
      try {
        // In development, manually create the order since webhook won't be called
        if (import.meta.env.DEV) {
          // Get the payment intent from the confirmPayment result
          const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
          
          if (paymentIntent) {
            const response = await apiRequest("POST", "/api/create-order-from-payment", {
              paymentIntentId: paymentIntent.id
            });
            
            if (response.ok) {
              const result = await response.json();
              console.log("Order created successfully:", result);
            } else {
              console.error("Failed to create order:", await response.text());
            }
          }
        }
        
        toast({
          title: "Payment Successful!",
          description: "Your order has been placed successfully.",
        });
        
        // Invalidate cart and orders queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        
        // Use a small delay to ensure toast shows before navigation
        setTimeout(() => {
          navigate("/orders");
        }, 1000);
      } catch (orderError) {
        console.error("Error creating order:", orderError);
        toast({
          title: "Payment Successful",
          description: "Payment completed but there was an issue creating the order. Please contact support.",
          variant: "destructive",
        });
      }
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || isProcessing || !selectedAddressId}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 text-lg"
        data-testid="button-checkout"
      >
        {isProcessing ? "Processing Payment..." : "Complete Purchase"}
      </Button>
    </form>
  );
};

export default function CartCheckout() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [clientSecret, setClientSecret] = useState("");
  const [amount, setAmount] = useState(0);
  const [productPrice, setProductPrice] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);

  // Fetch cart items
  const { data: cartItemsData = [], isLoading: cartLoading } = useQuery<CartItem[]>({
    queryKey: ["/api/cart"],
    enabled: !!user,
  });

  useEffect(() => {
    setCartItems(cartItemsData);
    
    // Calculate total product price
    const total = cartItemsData.reduce((sum, item) => {
      return sum + (parseFloat(item.product.originalPrice) * item.quantity);
    }, 0);
    setProductPrice(total);
  }, [cartItemsData]);

  // Update total amount when product price or delivery fee changes
  useEffect(() => {
    setAmount(productPrice + deliveryFee);
  }, [productPrice, deliveryFee]);

  // Create multi-item payment intent when address is selected
  const createMultiItemPaymentIntent = async (addressId: number) => {
    try {
      setIsLoadingPayment(true);
      
      const response = await apiRequest("POST", "/api/create-multi-item-payment-intent", {
        addressId: addressId
      });
      const data = await response.json();
      setClientSecret(data.clientSecret);
      // Delivery fee is already set by the DeliveryFeeDisplay component
      setIsLoadingPayment(false);
    } catch (error) {
      console.error("Error creating multi-item payment intent:", error);
      setIsLoadingPayment(false);
    }
  };

  // Auto-create payment intent when address is selected
  useEffect(() => {
    if (selectedAddressId && !clientSecret && cartItems.length > 0) {
      createMultiItemPaymentIntent(selectedAddressId);
    }
  }, [selectedAddressId, clientSecret, cartItems.length]);

  const handleAddressSelect = (addressId: number, address: any) => {
    setSelectedAddressId(addressId);
    setSelectedAddress(address);
  };

  if (cartLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading cart items...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="p-8 text-center">
                <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Your Cart is Empty</h2>
                <p className="text-muted-foreground mb-6">
                  Add some items to your cart before proceeding to checkout.
                </p>
                <Button onClick={() => window.location.href = "/browse"}>
                  Continue Shopping
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Multi-Item Checkout
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Complete your purchase for {cartItems.length} item{cartItems.length > 1 ? 's' : ''} in your cart
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Cart Items and Address */}
            <div className="space-y-6">
              {/* Cart Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Items in Your Cart
                  </CardTitle>
                  <CardDescription>
                    {cartItems.length} item{cartItems.length > 1 ? 's' : ''} ready for checkout
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <img 
                        src={item.product.imageUrl || '/placeholder-product.jpg'} 
                        alt={item.product.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">{item.product.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{item.product.description}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Qty: {item.quantity}</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            ${parseFloat(item.product.originalPrice).toFixed(2)} each
                          </span>
                          <Badge variant="secondary">
                            {item.product.category.name}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Address Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Delivery Address
                  </CardTitle>
                  <CardDescription>
                    Select a delivery address for your order
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AddressManager onAddressSelect={handleAddressSelect} />
                </CardContent>
              </Card>

              {/* Delivery Fee Display */}
              <DeliveryFeeDisplay 
                addressId={selectedAddressId}
                onDeliveryFeeChange={setDeliveryFee}
              />
            </div>

            {/* Right Column - Payment */}
            <div className="space-y-6">
              {/* Pricing Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Subtotal ({cartItems.length} items):</span>
                      <span className="font-medium">${productPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Delivery Fee:</span>
                      <span className="font-medium">${deliveryFee.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="font-bold text-lg text-gray-900 dark:text-white">Total:</span>
                      <span className="font-bold text-2xl text-green-600">${amount.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Secure Payment
                  </CardTitle>
                  <CardDescription>
                    Complete your purchase with our secure payment system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedAddressId ? (
                    <div className="text-center p-6">
                      <div className="text-yellow-600 mb-2">
                        <MapPin className="h-8 w-8 mx-auto" />
                      </div>
                      <h3 className="font-medium text-lg mb-2">Address Required</h3>
                      <p className="text-muted-foreground">
                        Please select a delivery address above to proceed with payment.
                      </p>
                    </div>
                  ) : isLoadingPayment ? (
                    <div className="text-center p-6">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Preparing payment...</p>
                    </div>
                  ) : clientSecret ? (
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <PaymentForm 
                        amount={amount}
                        cartItems={cartItems}
                        selectedAddressId={selectedAddressId}
                        deliveryFee={deliveryFee}
                        productPrice={productPrice}
                        clientSecret={clientSecret}
                      />
                    </Elements>
                  ) : (
                    <div className="text-center p-6">
                      <p className="text-muted-foreground">Loading payment form...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
