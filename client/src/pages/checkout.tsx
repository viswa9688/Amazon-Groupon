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
      // Payment succeeded  
      if (type === 'individual' && !userGroupId) {
        // For individual purchases only, create order record as backup
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
      }
      // For group payments, order creation is handled entirely by webhook using metadata

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
        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 text-lg"
        data-testid="button-checkout"
      >
        {isProcessing ? "Processing Payment..." : "Checkout"}
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
  const [productData, setProductData] = useState<any>(null);
  const [groupData, setGroupData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [isGroupPayment, setIsGroupPayment] = useState(false);
  const [userGroupId, setUserGroupId] = useState<number | null>(null);
  const [memberDetails, setMemberDetails] = useState<any>(null);
  const [totalMembers, setTotalMembers] = useState(1);
  const [originalAmount, setOriginalAmount] = useState(0);
  const initRef = useRef(false);

  // Parse URL and query parameters
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const queryType = urlParams.get('type');
  const queryUserGroupId = urlParams.get('userGroupId');
  const queryGroup = urlParams.get('group'); // Share token for group payments
  const queryMember = urlParams.get('member'); // Specific member ID for payment

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true; // Prevent multiple initializations

    const initializePayment = async () => {
      try {
        setIsLoading(true);
        
        // Check if this is a group payment via query params (either old or new format)
        if ((queryType === 'group' && queryUserGroupId) || queryGroup) {
          console.log("Detected group payment:", { queryType, queryUserGroupId, queryGroup, queryMember });
          setIsGroupPayment(true);
          
          if (queryGroup) {
            // New format: using share token and member ID
            console.log("Processing group payment with share token:", queryGroup);
            try {
              // Get group details by share token
              const groupResponse = await apiRequest("GET", `/api/shared/${queryGroup}`);
              const groupDataResponse = await groupResponse.json();
              console.log("Group data received:", groupDataResponse);
              setUserGroupId(groupDataResponse.id);
              setGroupData(groupDataResponse);
              
              // Get member details if specified
              if (queryMember) {
                try {
                  const memberResponse = await apiRequest("GET", `/api/auth/user`);
                  const member = await memberResponse.json();
                  setMemberDetails(member);
                  console.log("Member details:", member);
                } catch (error) {
                  console.log("Could not fetch member details");
                }
              }
              
              // Get participant count for pricing calculations
              const approvedResponse = await apiRequest("GET", `/api/user-groups/${groupDataResponse.id}/approved`);
              const approved = await approvedResponse.json();
              setTotalMembers(approved.length + 1); // +1 for owner
              console.log("Total members:", approved.length + 1);
              
              setProductName(`Group Purchase${queryMember ? ` for Member` : ""}`);
              
              // For group payments, we don't create PaymentIntent yet - wait for address selection
              setIsLoading(false);
              return; // Early return to prevent falling through
            } catch (error) {
              console.error("Error fetching group data:", error);
              setProductName("Group Purchase");
              // Still continue with group payment setup even if there are errors
              setIsLoading(false);
              return;
            }
          } else if (queryUserGroupId) {
            // Old format: direct userGroupId
            setUserGroupId(parseInt(queryUserGroupId));
            setProductName("Group Purchase");
            setIsLoading(false);
            return;
          }
        } 
        // Handle individual payment via URL params
        else if (match && params) {
          const { productId, type } = params;
          setIsGroupPayment(false);
          
          // Get product details
          const productResponse = await apiRequest("GET", `/api/products/${productId}`);
          const product = await productResponse.json();
          setProductName(product.name);
          setProductData(product);

          let paymentAmount = parseFloat(product.originalPrice);
          setOriginalAmount(paymentAmount);

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
        } else {
          // Neither group payment nor individual payment - this shouldn't happen
          console.error("Invalid checkout URL - no valid payment type detected");
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
        
        // Get selected address details
        const addressResponse = await apiRequest("GET", `/api/addresses`);
        const addresses = await addressResponse.json();
        const address = addresses.find((addr: any) => addr.id === selectedAddressId);
        setSelectedAddress(address);
        
        const response = await apiRequest("POST", "/api/group-payment-intent", {
          userGroupId,
          addressId: selectedAddressId,
          memberId: queryMember, // Pass the specific member ID for payment
        });
        const data = await response.json();
        setClientSecret(data.clientSecret);
        setAmount(data.amount);
        
        // Calculate original amount for display
        if (groupData && groupData.items) {
          let total = 0;
          for (const item of groupData.items) {
            total += parseFloat(item.product.originalPrice) * item.quantity;
          }
          setOriginalAmount(total);
        }
      } catch (error) {
        console.error("Error creating group payment intent:", error);
      } finally {
        setIsLoading(false);
      }
    };

    createGroupPaymentIntent();
  }, [isGroupPayment, userGroupId, selectedAddressId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Order Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Order Summary</CardTitle>
                <CardDescription>
                  {isGroupPayment ? "Group Purchase Details" : "Product Details"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Product Details */}
                {isGroupPayment && groupData ? (
                  <div>
                    <h3 className="font-semibold text-lg mb-4">Items in Group Purchase</h3>
                    {groupData.items?.map((item: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4 mb-4">
                        <div className="flex items-start space-x-4">
                          {item.product.imageUrl && (
                            <img 
                              src={item.product.imageUrl} 
                              alt={item.product.name}
                              className="w-20 h-20 object-cover rounded-lg"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-medium text-lg">{item.product.name}</h4>
                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">
                              {item.product.description}
                            </p>
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="text-sm text-gray-500">Quantity: {item.quantity}</span>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className="text-lg font-bold">${item.product.originalPrice}</span>
                                  {item.product.discountTiers && item.product.discountTiers.length > 0 && (
                                    <span className="text-sm text-green-600">Group discount available!</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Group Members Info */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <h4 className="font-medium mb-2">Group Details</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                        Total Members: {totalMembers}
                      </p>
                      {memberDetails && (
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                          Paying for: {memberDetails.name || 'Group Member'}
                        </p>
                      )}
                    </div>
                  </div>
                ) : productData ? (
                  <div>
                    <div className="flex items-start space-x-4">
                      {productData.imageUrl && (
                        <img 
                          src={productData.imageUrl} 
                          alt={productData.name}
                          className="w-32 h-32 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-xl mb-2">{productData.name}</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                          {productData.description}
                        </p>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Category:</span>
                            <span className="font-medium">{productData.category?.name || 'General'}</span>
                          </div>
                          {productData.brand && (
                            <div className="flex justify-between">
                              <span>Brand:</span>
                              <span className="font-medium">{productData.brand}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                    <p className="mt-2 text-gray-600">Loading product details...</p>
                  </div>
                )}
                
                {/* Pricing Breakdown */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Pricing Details</h4>
                  <div className="space-y-2">
                    {isGroupPayment ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span>Original Total:</span>
                          <span>${originalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Group Discount:</span>
                          <span>-${(originalAmount - amount * totalMembers).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Total for Group:</span>
                          <span>${(amount * totalMembers).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg border-t pt-2">
                          <span>Your Portion ({totalMembers} members):</span>
                          <span>${amount.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span>${amount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Shipping Address */}
                {selectedAddress && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Shipping Address</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-sm">
                      <div className="font-medium">{selectedAddress.fullName}</div>
                      <div>{selectedAddress.addressLine}</div>
                      <div>
                        {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}
                      </div>
                      <div>{selectedAddress.country || 'US'}</div>
                      {selectedAddress.phoneNumber && (
                        <div className="mt-1">Phone: {selectedAddress.phoneNumber}</div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column - Payment */}
          <div className="space-y-6">
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
                <CardTitle className="text-2xl">Payment Details</CardTitle>
                <CardDescription>
                  Complete your secure payment
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
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
                    <p className="text-blue-700 dark:text-blue-300">
                      Setting up secure payment...
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
                
                {/* Security Notice */}
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9-9a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Your payment is secured by Stripe with 256-bit SSL encryption
                    </p>
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