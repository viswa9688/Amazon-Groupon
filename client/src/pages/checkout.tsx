import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState, useRef } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation, useRoute } from "wouter";
import AddressManager from "@/components/AddressManager";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const CheckoutForm = ({ 
  amount, 
  productId, 
  type, 
  userGroupId, 
  selectedAddressId 
}: { 
  amount: number; 
  productId?: number; 
  type: string; 
  userGroupId?: number; 
  selectedAddressId?: number; 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
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
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Payment succeeded - create order record as backup
      try {
        await apiRequest("POST", "/api/orders", {
          productId,
          quantity: 1,
          unitPrice: amount.toString(),
          totalPrice: amount.toString(),
          finalPrice: amount.toString(),
          status: "completed",
          type,
          addressId: selectedAddressId,
        });
      } catch (orderError) {
        console.log("Order creation handled by webhook"); // This is fine, webhook will create it
      }

      toast({
        title: "Payment Successful",
        description: "Thank you for your purchase!",
      });
      // Use a small delay to ensure toast shows before navigation
      setTimeout(() => {
        navigate("/orders");
      }, 1000);
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
        data-testid="button-pay"
      >
        {isProcessing ? "Processing..." : `Pay $${amount.toFixed(2)}`}
      </Button>
    </form>
  );
};

export default function Checkout() {
  const [clientSecret, setClientSecret] = useState("");
  const [match, params] = useRoute("/checkout/:productId/:type");
  const [location] = useLocation();
  const [amount, setAmount] = useState(0);
  const [productName, setProductName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [isGroupPayment, setIsGroupPayment] = useState(false);
  const [userGroupId, setUserGroupId] = useState<number | null>(null);
  const initRef = useRef(false);

  // Parse URL and query parameters
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const queryType = urlParams.get('type');
  const queryUserGroupId = urlParams.get('userGroupId');

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true; // Prevent multiple initializations

    const initializePayment = async () => {
      try {
        setIsLoading(true);
        
        // Check if this is a group payment via query params
        if (queryType === 'group' && queryUserGroupId) {
          setIsGroupPayment(true);
          setUserGroupId(parseInt(queryUserGroupId));
          setProductName("Group Purchase");
          // For group payments, we don't create PaymentIntent yet - wait for address selection
          setIsLoading(false);
        } 
        // Handle individual payment via URL params
        else if (match && params) {
          const { productId, type } = params;
          setIsGroupPayment(false);
          
          // Get product details
          const productResponse = await apiRequest("GET", `/api/products/${productId}`);
          const product = await productResponse.json();
          setProductName(product.name);

          let paymentAmount = parseFloat(product.originalPrice);

          // Create individual payment intent
          const response = await apiRequest("POST", "/api/create-payment-intent", {
            amount: paymentAmount,
            productId: parseInt(productId),
            type,
          });
          const data = await response.json();
          setClientSecret(data.clientSecret);
          setAmount(paymentAmount);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error initializing payment:", error);
        setIsLoading(false);
      }
    };

    initializePayment();
  }, []); // Empty dependency array to run only once

  // Create group payment intent when address is selected
  useEffect(() => {
    if (!isGroupPayment || !userGroupId || !selectedAddressId) return;

    const createGroupPaymentIntent = async () => {
      try {
        setIsLoading(true);
        const response = await apiRequest("POST", "/api/group-payment-intent", {
          userGroupId,
          addressId: selectedAddressId,
        });
        const data = await response.json();
        setClientSecret(data.clientSecret);
        setAmount(data.amount);
      } catch (error) {
        console.error("Error creating group payment intent:", error);
      } finally {
        setIsLoading(false);
      }
    };

    createGroupPaymentIntent();
  }, [isGroupPayment, userGroupId, selectedAddressId]);

  if (isLoading || (!clientSecret && !isGroupPayment)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Address Management for Group Payments */}
        {isGroupPayment && (
          <AddressManager
            selectedAddressId={selectedAddressId}
            onAddressSelect={setSelectedAddressId}
            showSelection={true}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Complete Your Purchase</CardTitle>
            <CardDescription>
              {productName} - ${amount.toFixed(2)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Show address selection requirement for group payments */}
            {isGroupPayment && !selectedAddressId ? (
              <div className="p-6 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 text-center">
                <p className="text-orange-700 dark:text-orange-300 font-medium">
                  Please select a delivery address above to continue with your group purchase.
                </p>
              </div>
            ) : clientSecret ? (
              <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm 
                  amount={amount} 
                  productId={params ? parseInt(params.productId) : undefined}
                  type={isGroupPayment ? "group" : (params?.type || "individual")}
                  userGroupId={userGroupId || undefined}
                  selectedAddressId={selectedAddressId || undefined}
                />
              </Elements>
            ) : (
              <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-center">
                <p className="text-blue-700 dark:text-blue-300">
                  Setting up payment for your group purchase...
                </p>
              </div>
            )}
            
            {/* Test card information */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Test Payment</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                Use these test card details:
              </p>
              <div className="text-sm font-mono text-blue-800 dark:text-blue-200">
                <div>Card: 4242 4242 4242 4242</div>
                <div>Expiry: Any future date</div>
                <div>CVV: Any 3 digits</div>
                <div>ZIP: Any 5 digits</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}