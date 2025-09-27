import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState, useRef } from 'react';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import AddressManager from "@/components/AddressManager";
import DeliveryFeeDisplay from "@/components/DeliveryFeeDisplay";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Package, DollarSign, CheckCircle, Truck, Info } from "lucide-react";
import { FullPageLoader } from "@/components/InfiniteLoader";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface CheckoutData {
  type: 'individual' | 'group';
  productId?: number;
  userGroupId?: number;
  memberId?: string;
  groupToken?: string;
}

interface UnifiedCheckoutProps {
  checkoutData: CheckoutData;
}

const PaymentForm = ({ 
  amount, 
  productId, 
  type, 
  userGroupId,
  selectedAddressId,
  groupData,
  selectedAddress,
  memberDetails,
  deliveryFee,
  originalAmount,
  potentialSavings,
  deliveryMethod
}: { 
  amount: number; 
  productId?: number; 
  type: string; 
  userGroupId?: number; 
  selectedAddressId?: number; 
  groupData?: any;
  selectedAddress?: any;
  memberDetails?: any;
  deliveryFee: number;
  originalAmount: number;
  potentialSavings: number;
  deliveryMethod?: "pickup" | "delivery";
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const { user } = useAuth();
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
            unitPrice: originalAmount.toString(),
            totalPrice: amount.toString(),
            finalPrice: amount.toString(),
            status: "completed",
            type,
            addressId: selectedAddressId,
          });
        } catch (orderError) {
          console.log("Order creation handled by webhook"); // This is fine, webhook will create it
        }
      } else if (type === 'group' && userGroupId && groupData) {
        // For group payments, create a single order with multiple items as backup (in case webhook fails)
        try {
          console.log("Creating backup order with multiple items for group payment...");
          
          // Calculate total price for all items
          let totalOrderPrice = 0;
          const orderItems = [];
          
          // Check minimum order value requirement ($50 excluding delivery)
          const MINIMUM_ORDER_VALUE = 50.00;
          const orderValueExcludingDelivery = groupData.items.reduce((sum, item) => {
            return sum + (parseFloat(item.product.originalPrice.toString()) * item.quantity);
          }, 0);
          
          for (const item of groupData.items) {
            // Calculate discounted price using the same method as user-group page
            let discountPrice = item.product.originalPrice;
            
            // Only apply discounts if minimum order value is met
            if (orderValueExcludingDelivery >= MINIMUM_ORDER_VALUE) {
              discountPrice = item.product.discountTiers?.[0]?.finalPrice || item.product.originalPrice;
            }
            
            const discountedPrice = parseFloat(discountPrice.toString());
            const itemTotal = discountedPrice * item.quantity;
            totalOrderPrice += itemTotal;
            
            orderItems.push({
              productId: item.product.id,
              quantity: item.quantity,
              unitPrice: discountedPrice.toFixed(2),
              totalPrice: itemTotal.toFixed(2)
            });
          }
          
          // Determine payer and beneficiary IDs
          const payerId = user?.id; // Current authenticated user (who is making the payment)
          const beneficiaryId = memberDetails?.userId; // Member being paid for
          
          // Validate that we have both IDs
          if (!payerId) {
            throw new Error("Payer ID is required");
          }
          
          if (!beneficiaryId) {
            throw new Error("Beneficiary ID is required");
          }
          
          // Ensure payer and beneficiary are different
          if (payerId === beneficiaryId) {
            console.warn("Payer and beneficiary are the same - this might be a self-payment");
          }
          
          console.log("Creating group order with payer/beneficiary:", {
            payerId,
            beneficiaryId,
            memberDetails,
            currentUser: user?.id,
            isSelfPayment: payerId === beneficiaryId
          });
          
          // Create single order with multiple items
          await apiRequest("POST", "/api/orders/group", {
            totalPrice: totalOrderPrice.toFixed(2),
            finalPrice: totalOrderPrice.toFixed(2),
            status: "completed",
            type: "group",
            addressId: selectedAddressId,
            payerId: payerId,
            beneficiaryId: beneficiaryId,
            userGroupId: userGroupId,
            deliveryMethod: deliveryMethod,
            items: orderItems
          });
          
          // Group payment records will be created by the Stripe webhook
          console.log("Payment successful - webhook will create group payment records");
        } catch (orderError) {
          console.log("Order creation handled by webhook or failed:", orderError); // This is fine, webhook will create it
        }
      }

      toast({
        title: "Payment Successful!",
        description: "Thank you for your purchase!",
      });
      
      // Invalidate payment status queries to refresh the UI
      if (userGroupId) {
        // Clear all payment-related caches first
        queryClient.removeQueries({ queryKey: [`/api/user-groups/${userGroupId}/payment-status`] });
        queryClient.removeQueries({ queryKey: ["/api/user-groups", userGroupId] });
        
        // Invalidate specific queries
        queryClient.invalidateQueries({ queryKey: [`/api/user-groups/${userGroupId}/payment-status`] });
        queryClient.invalidateQueries({ queryKey: ["/api/user-groups", userGroupId] });
        
        // Also invalidate all user-groups queries to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] });
        
        // Force refetch the payment status immediately
        queryClient.refetchQueries({ queryKey: [`/api/user-groups/${userGroupId}/payment-status`] });
        
        // Add a small delay to ensure the server has processed the payment
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: [`/api/user-groups/${userGroupId}/payment-status`] });
        }, 2000);
      }
      
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

export default function UnifiedCheckout({ checkoutData }: UnifiedCheckoutProps) {
  const { user } = useAuth();
  const [clientSecret, setClientSecret] = useState("");
  const [amount, setAmount] = useState(0);
  const [productName, setProductName] = useState("");
  const [productData, setProductData] = useState<any>(null);
  const [groupData, setGroupData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPayment, setIsLoadingPayment] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [memberDetails, setMemberDetails] = useState<any>(null);
  const [totalMembers, setTotalMembers] = useState(1);
  const [originalAmount, setOriginalAmount] = useState(0);
  const [potentialSavings, setPotentialSavings] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [amountLocked, setAmountLocked] = useState(false);
  const [userGroupId, setUserGroupId] = useState<number | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "delivery">("delivery");
  const initRef = useRef(false);

  // Safe setAmount function that respects the lock
  const setAmountSafe = (newAmount: number, forceUpdate: boolean = false) => {
    if (!amountLocked || forceUpdate) {
      console.log("Setting amount (unlocked or forced):", newAmount);
      setAmount(newAmount);
    } else {
      console.log("Amount change blocked - amount is locked. Current amount:", amount, "Attempted amount:", newAmount);
    }
  };

  // Handle delivery fee updates and recalculate total
  const handleDeliveryFeeUpdate = (fee: number) => {
    setDeliveryFee(fee);
    
    // Only recalculate if we have the base values
    if (originalAmount > 0) {
      // Recalculate total amount including delivery fee
      const baseAmount = originalAmount - potentialSavings;
      const totalWithDelivery = baseAmount + fee;
      
      // Force update to allow delivery fee changes even when amount is locked
      setAmountSafe(totalWithDelivery, true);
    }
  };

  // Reset delivery fee when address changes
  useEffect(() => {
    setDeliveryFee(0);
  }, [selectedAddressId]);

  // Create payment intent for individual payments with address and delivery fee
  const createIndividualPaymentIntent = async (addressId: number) => {
    try {
      setIsLoadingPayment(true);
      
      const response = await apiRequest("POST", "/api/create-individual-payment-intent", {
        productId: checkoutData.productId,
        addressId: addressId,
        quantity: 1
      });
      const data = await response.json();
      setClientSecret(data.clientSecret);
      
      // Update amounts with the calculated values from the server
      setOriginalAmount(data.productPrice);
      setDeliveryFee(data.deliveryFee);
      setAmountSafe(data.totalAmount, true);
      setAmountLocked(true); // Lock amount after payment intent creation
      setIsLoadingPayment(false);
    } catch (error) {
      console.error("Error creating individual payment intent:", error);
      setIsLoadingPayment(false);
    }
  };

  // Create payment intent for group payments
  const createGroupPaymentIntent = async (addressId: number) => {
    try {
      setIsLoadingPayment(true);
      
      // For group payments, we need to get the first product ID from the group items
      // or use a default product ID if none exists
      let productId = checkoutData.productId;
      if (!productId && groupData?.items?.length > 0) {
        productId = groupData.items[0].product.id;
      }
      
      // Validate required parameters
      if (!userGroupId) {
        throw new Error("userGroupId is required for group payments");
      }
      if (!productId) {
        throw new Error("productId is required for group payments");
      }
      if (!amount || amount <= 0) {
        throw new Error("Valid amount is required for group payments");
      }
      if (!addressId) {
        throw new Error("addressId is required for group payments");
      }
      
      console.log("Creating group payment intent with:", {
        userGroupId,
        productId,
        amount,
        addressId,
        memberId: checkoutData.memberId,
        payerId: user?.id,
        beneficiaryId: memberDetails?.userId
      });
      
      const response = await apiRequest("POST", "/api/create-group-payment-intent", {
        userGroupId: userGroupId,
        productId: productId,
        amount: amount,
        addressId: addressId,
        memberId: checkoutData.memberId,
        payerId: user?.id,
        beneficiaryId: memberDetails?.userId
      });
      const data = await response.json();
      setClientSecret(data.clientSecret);
      setAmountLocked(true);
      setIsLoadingPayment(false);
    } catch (error) {
      console.error("Error creating group payment intent:", error);
      setIsLoadingPayment(false);
    }
  };

  // Auto-create payment intent when address is selected
  useEffect(() => {
    if (selectedAddressId && !clientSecret) {
      if (checkoutData.type === 'individual') {
        createIndividualPaymentIntent(selectedAddressId);
      } else if (checkoutData.type === 'group') {
        createGroupPaymentIntent(selectedAddressId);
      }
    }
  }, [selectedAddressId, checkoutData.type, clientSecret]);

  // Initialize checkout data
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initializeCheckout = async () => {
      try {
        setIsLoading(true);
        
        if (checkoutData.type === 'group' && checkoutData.groupToken) {
          // Handle group payments
          try {
            // Get group details by share token
            const groupResponse = await apiRequest("GET", `/api/shared/${checkoutData.groupToken}`);
            const groupDataResponse = await groupResponse.json();
            setGroupData(groupDataResponse);
            setUserGroupId(groupDataResponse.id); // Set the userGroupId
            
            // Fetch the full user group details
            const userGroupResponse = await apiRequest("GET", `/api/user-groups/${groupDataResponse.id}`);
            const userGroupDetails = await userGroupResponse.json();
            
            // Set delivery method from group settings
            setDeliveryMethod(userGroupDetails.deliveryMethod || "delivery");
            
            // Get member details if specified
            if (checkoutData.memberId) {
              const member = userGroupDetails.participants?.find((p: any) => p.userId === checkoutData.memberId);
              if (member) {
                setMemberDetails(member);
              }
            }
            
            // Calculate group pricing
            const MINIMUM_ORDER_VALUE = 50.00;
            const totalOriginalAmount = userGroupDetails.items?.reduce((sum: number, item: any) => {
              return sum + (parseFloat(item.product.originalPrice.toString()) * item.quantity);
            }, 0) || 0;
            
            const orderValueExcludingDelivery = totalOriginalAmount;
            let potentialSavingsFromGroup = 0;
            
            if (orderValueExcludingDelivery >= MINIMUM_ORDER_VALUE) {
              potentialSavingsFromGroup = userGroupDetails.items?.reduce((sum: number, item: any) => {
                const discountPrice = item.product.discountTiers?.[0]?.finalPrice || item.product.originalPrice;
                const savings = (parseFloat(item.product.originalPrice.toString()) - parseFloat(discountPrice.toString())) * item.quantity;
                return sum + savings;
              }, 0) || 0;
            }
            
            const popularGroupValue = totalOriginalAmount;
            const finalAmount = popularGroupValue - potentialSavingsFromGroup;
            
            setPotentialSavings(potentialSavingsFromGroup);
            setAmountSafe(finalAmount);
            setOriginalAmount(popularGroupValue);
            setAmountLocked(true);
            setTotalMembers(userGroupDetails.participantCount || 0);
            
          } catch (error) {
            console.error("Error loading group data:", error);
          }
        } else if (checkoutData.type === 'group' && checkoutData.userGroupId) {
          // Handle direct group payments (with userGroupId already provided)
          setUserGroupId(checkoutData.userGroupId);
          // Load group data and calculate pricing
          try {
            const userGroupResponse = await apiRequest("GET", `/api/user-groups/${checkoutData.userGroupId}`);
            const userGroupDetails = await userGroupResponse.json();
            
            // Calculate group pricing
            const MINIMUM_ORDER_VALUE = 50.00;
            const totalOriginalAmount = userGroupDetails.items?.reduce((sum: number, item: any) => {
              return sum + (parseFloat(item.product.originalPrice.toString()) * item.quantity);
            }, 0) || 0;
            
            const orderValueExcludingDelivery = totalOriginalAmount;
            let potentialSavingsFromGroup = 0;
            
            if (orderValueExcludingDelivery >= MINIMUM_ORDER_VALUE) {
              potentialSavingsFromGroup = userGroupDetails.items?.reduce((sum: number, item: any) => {
                const discountPrice = item.product.discountTiers?.[0]?.finalPrice || item.product.originalPrice;
                const savings = (parseFloat(item.product.originalPrice.toString()) - parseFloat(discountPrice.toString())) * item.quantity;
                return sum + savings;
              }, 0) || 0;
            }
            
            const popularGroupValue = totalOriginalAmount;
            const finalAmount = popularGroupValue - potentialSavingsFromGroup;
            
            setPotentialSavings(potentialSavingsFromGroup);
            setAmountSafe(finalAmount);
            setOriginalAmount(popularGroupValue);
            setAmountLocked(true);
            setTotalMembers(userGroupDetails.participantCount || 0);
            setGroupData(userGroupDetails);
            
          } catch (error) {
            console.error("Error loading group data:", error);
          }
        } else if (checkoutData.type === 'individual' && checkoutData.productId) {
          // Handle individual payments
          const productResponse = await apiRequest("GET", `/api/products/${checkoutData.productId}`);
          const product = await productResponse.json();
          setProductName(product.name);
          setProductData(product);
          
          let paymentAmount = parseFloat(product.originalPrice);
          setOriginalAmount(paymentAmount);
          setAmountSafe(paymentAmount);
          setAmountLocked(false); // Don't lock amount yet - we need to add delivery fee
        }
        
        setIsLoading(false);
        setIsLoadingPayment(false);
      } catch (error) {
        console.error("Error initializing checkout:", error);
        setIsLoading(false);
        setIsLoadingPayment(false);
      }
    };

    initializeCheckout();
  }, [checkoutData]);

  if (isLoading) {
    return <FullPageLoader text="Preparing checkout..." variant="wave" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {checkoutData.type === 'group' ? 'Group Purchase Checkout' : 'Individual Purchase Checkout'}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              {checkoutData.type === 'group' 
                ? 'Complete your group purchase with secure payment'
                : 'Complete your individual purchase with secure payment'
              }
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Order Summary */}
            <div className="space-y-6">
              <Card className="bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b">
                  <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                    <Package className="w-6 h-6 text-blue-600 mr-2" />
                    Order Summary
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    {checkoutData.type === 'group' ? 'Group Purchase Details' : 'Product Details'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {checkoutData.type === 'group' && groupData ? (
                    <div className="space-y-4">
                      <h3 className="font-medium text-lg mb-2">Items in Group Purchase</h3>
                      {groupData.items?.map((item: any, index: number) => (
                        <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
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
                                ${parseFloat(item.product.originalPrice.toString()).toFixed(2)} each
                              </span>
                              {item.product.discountTiers && item.product.discountTiers.length > 0 && (
                                <Badge variant="secondary" className="bg-green-100 text-green-800">
                                  ✓ Group discount applied!
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Group Purchase Details */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border">
                        <div className="flex items-center space-x-2 mb-2">
                          <Users className="w-5 h-5 text-blue-600" />
                          <span className="font-medium text-gray-900 dark:text-white">Group Purchase Details</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">TOTAL MEMBERS:</span>
                            <span className="font-medium">{totalMembers}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">PAYMENT FOR:</span>
                            <span className="font-medium">Group Member</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h3 className="font-medium text-lg mb-2">Product Details</h3>
                      {productData && (
                        <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <img 
                            src={productData.imageUrl || '/placeholder-product.jpg'} 
                            alt={productData.name}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">{productData.name}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{productData.description}</p>
                            <div className="flex items-center space-x-4 mt-2">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Category: {productData.category?.name || 'Unknown'}</span>
                              <span className="text-sm font-medium text-green-600">
                                Unit Price: ${parseFloat(productData.originalPrice.toString()).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Pricing Breakdown */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h4 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">Pricing Breakdown</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      {checkoutData.type === 'group' ? (
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Popular Group Value:</span>
                            <span className="font-medium">${originalAmount.toFixed(2)}</span>
                          </div>
                          {potentialSavings > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                              <span>Potential Savings:</span>
                              <span className="font-medium">-${potentialSavings.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Delivery Fee:</span>
                            <span className="font-medium">${deliveryFee.toFixed(2)}</span>
                          </div>
                          <div className="border-t border-gray-300 dark:border-gray-600 pt-3 mt-3">
                            <div className="flex justify-between">
                              <span className="font-bold text-lg text-gray-900 dark:text-white">Total Amount:</span>
                              <span className="font-bold text-2xl text-green-600">${amount.toFixed(2)}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1 text-center">
                              {deliveryFee > 0 
                                ? "Formula: Popular Group Value - Potential Savings + Delivery Fee"
                                : "Formula: Popular Group Value - Potential Savings"
                              }
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Product Price:</span>
                            <span className="font-medium">${originalAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Delivery Fee:</span>
                            <span className="font-medium">${deliveryFee.toFixed(2)}</span>
                          </div>
                          <div className="border-t border-gray-300 dark:border-gray-600 pt-3 mt-3">
                            <div className="flex justify-between">
                              <span className="font-bold text-lg text-gray-900 dark:text-white">Total Amount:</span>
                              <span className="font-bold text-2xl text-green-600">${amount.toFixed(2)}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1 text-center">
                              {deliveryFee > 0 
                                ? "Formula: Product Price + Delivery Fee"
                                : "Formula: Product Price (Free Delivery)"
                              }
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Shipping Address */}
                  {selectedAddress && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                      <h4 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">Shipping Address</h4>
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 p-4 rounded-lg border">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-blue-600" />
                            <span className="font-medium text-gray-900 dark:text-white">{selectedAddress.fullName}</span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{selectedAddress.addressLine}</p>
                          <p className="text-gray-700 dark:text-gray-300">
                            {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300">{selectedAddress.country}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Right Column - Address & Payment */}
            <div className="space-y-6">
              {/* Delivery Method Display */}
              <Card className="bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Delivery Method
                  </CardTitle>
                  <CardDescription>
                    {checkoutData.type === 'group' 
                      ? "Delivery method set by group owner" 
                      : "Choose how you want to receive your order"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {checkoutData.type === 'group' ? (
                      // Group checkout - show selected method
                      <div className={`p-4 border-2 rounded-lg ${
                        deliveryMethod === "delivery" 
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                          : "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      }`}>
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            deliveryMethod === "delivery" 
                              ? "border-blue-500 bg-blue-500" 
                              : "border-purple-500 bg-purple-500"
                          }`}>
                            <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {deliveryMethod === "delivery" ? "Home Delivery" : "Group Pickup"}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {deliveryMethod === "delivery" 
                                ? "Delivered directly to your selected address"
                                : "Pick up from group owner's location"
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Individual checkout - allow selection
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div 
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            deliveryMethod === "delivery" 
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                          onClick={() => setDeliveryMethod("delivery")}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-4 h-4 rounded-full border-2 ${
                              deliveryMethod === "delivery" 
                                ? "border-blue-500 bg-blue-500" 
                                : "border-gray-300 dark:border-gray-600"
                            }`}>
                              {deliveryMethod === "delivery" && (
                                <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                              )}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white">Home Delivery</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Delivered directly to your selected address
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div 
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            deliveryMethod === "pickup" 
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                          onClick={() => setDeliveryMethod("pickup")}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-4 h-4 rounded-full border-2 ${
                              deliveryMethod === "pickup" 
                                ? "border-blue-500 bg-blue-500" 
                                : "border-gray-300 dark:border-gray-600"
                            }`}>
                              {deliveryMethod === "pickup" && (
                                <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                              )}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white">Group Pickup</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Pick up from group owner's location
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {deliveryMethod === "pickup" && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Info className="w-5 h-5 text-yellow-600" />
                          <span className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                            Pickup Information
                          </span>
                        </div>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          {checkoutData.type === 'group' 
                            ? "The group owner has set this group for pickup. Contact them to arrange pickup time and location."
                            : "When you select pickup, the order will be delivered to the group owner. All group members will be notified when the order is ready for pickup."
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Address Management - Show based on delivery method */}
              {deliveryMethod === "delivery" ? (
                <AddressManager
                  selectedAddressId={selectedAddressId}
                  onAddressSelect={setSelectedAddressId}
                  showSelection={true}
                  deliveryMethod={deliveryMethod}
                />
              ) : (
                // For pickup, show owner's address information
                <Card className="bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Pickup Location
                    </CardTitle>
                    <CardDescription>
                      Pickup address set by group owner
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {groupData && groupData.user ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-full">
                              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {groupData.user.firstName} {groupData.user.lastName}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Group Owner
                              </p>
                              {groupData.user.phoneNumber && (
                                <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                                  📞 {groupData.user.phoneNumber}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Info className="w-5 h-5 text-yellow-600" />
                            <span className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                              Pickup Instructions
                            </span>
                          </div>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            Contact the group owner to arrange pickup time and location. 
                            You'll be notified when your order is ready for collection.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Loading pickup information...
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}


              {/* Delivery Fee Display - Only show for delivery */}
              {deliveryMethod === "delivery" && (
                <DeliveryFeeDisplay
                  addressId={selectedAddressId}
                  className="bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700"
                  onDeliveryFeeChange={handleDeliveryFeeUpdate}
                />
              )}
              
              {/* Payment Form */}
              <Card className="bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b">
                  <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                    <DollarSign className="w-6 h-6 text-blue-600 mr-2" />
                    Secure Payment
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    Complete your purchase with our secure payment system
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {/* Show address selection requirement - only for delivery */}
                  {deliveryMethod === "delivery" && !selectedAddressId ? (
                    <div className="space-y-4">
                      <div className="p-6 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-lg border-2 border-orange-200 dark:border-orange-800 text-center">
                        <div className="w-16 h-16 bg-orange-100 dark:bg-orange-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <MapPin className="w-8 h-8 text-orange-600" />
                        </div>
                        <h3 className="font-semibold text-lg text-orange-800 dark:text-orange-200 mb-2">Address Required</h3>
                        <p className="text-orange-700 dark:text-orange-300 mb-4">
                          Please select a delivery address above to continue with your secure purchase.
                        </p>
                      </div>
                      
                      {/* Show checkout button with disabled state */}
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                        <div className="text-center">
                          <div className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Ready to Pay: ${amount > 0 ? amount.toFixed(2) : '0.00'}
                          </div>
                          <Button
                            disabled={true}
                            className="w-full bg-gray-400 text-white font-semibold py-3 text-lg cursor-not-allowed"
                          >
                            Select Address to Continue
                          </Button>
                          <p className="text-sm text-gray-500 mt-2">
                            Add and select a delivery address above to proceed with payment
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (deliveryMethod === "pickup" || (deliveryMethod === "delivery" && selectedAddressId)) && clientSecret && !isLoadingPayment ? (
                    <div className="space-y-6">
                      <Elements key={clientSecret} stripe={stripePromise} options={{ 
                        clientSecret,
                        appearance: {
                          theme: 'stripe',
                          variables: {
                            colorPrimary: '#3b82f6',
                            colorBackground: '#ffffff',
                            colorText: '#374151',
                            colorDanger: '#ef4444',
                            fontFamily: 'Inter, system-ui, sans-serif',
                            spacingUnit: '6px',
                            borderRadius: '8px'
                          }
                        }
                      }}>
                        <PaymentForm 
                          amount={amount}
                          productId={checkoutData.productId}
                          type={checkoutData.type}
                          userGroupId={userGroupId}
                          selectedAddressId={selectedAddressId}
                          groupData={groupData}
                          selectedAddress={selectedAddress}
                          memberDetails={memberDetails}
                          deliveryFee={deliveryFee}
                          originalAmount={originalAmount}
                          potentialSavings={potentialSavings}
                          deliveryMethod={deliveryMethod}
                        />
                      </Elements>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600 dark:text-gray-400">Preparing payment...</p>
                    </div>
                  )}
                  
                  {/* Security Notice */}
                  <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-green-800 dark:text-green-200 font-medium">
                        Secure & Protected
                      </span>
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Your payment is secured by Stripe with industry-standard 256-bit SSL encryption and PCI DSS compliance.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
