import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState, useRef } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation, useRoute } from "wouter";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const CheckoutForm = ({ amount, productId, type }: { amount: number; productId: number; type: string }) => {
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
          shippingAddress: "International Shipping Address"
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
        {isProcessing ? "Processing..." : `Pay $${amount}`}
      </Button>
    </form>
  );
};

export default function Checkout() {
  const [clientSecret, setClientSecret] = useState("");
  const [match, params] = useRoute("/checkout/:productId/:type");
  const [amount, setAmount] = useState(0);
  const [productName, setProductName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const initRef = useRef(false);

  useEffect(() => {
    if (!match || !params || initRef.current) return;

    const { productId, type } = params;
    initRef.current = true; // Prevent multiple initializations

    // Fetch product details and create payment intent
    const initializePayment = async () => {
      try {
        setIsLoading(true);
        
        // Get product details
        const productResponse = await apiRequest("GET", `/api/products/${productId}`);
        const product = await productResponse.json();
        setProductName(product.name);

        let paymentAmount = parseFloat(product.originalPrice);

        // Create PaymentIntent
        const response = await apiRequest("POST", "/api/create-payment-intent", {
          amount: paymentAmount,
          productId: parseInt(productId),
          type,
        });
        const data = await response.json();
        setClientSecret(data.clientSecret);
        setAmount(paymentAmount);
      } catch (error) {
        console.error("Error initializing payment:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializePayment();
  }, []); // Empty dependency array to run only once

  if (isLoading || !clientSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Complete Your Purchase</CardTitle>
            <CardDescription>
              {productName} - ${amount}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm 
                amount={amount} 
                productId={parseInt(params?.productId || "0")} 
                type={params?.type || "individual"} 
              />
            </Elements>
            
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