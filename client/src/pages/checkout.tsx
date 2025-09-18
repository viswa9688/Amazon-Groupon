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
  selectedAddressId,
  groupData,
  selectedAddress
}: { 
  amount: number; 
  productId?: number; 
  type: string; 
  userGroupId?: number; 
  selectedAddressId?: number;
  groupData?: any;
  selectedAddress?: any;
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
      } else if (type === 'group' && userGroupId && groupData) {
        // For group payments, create order records as backup (in case webhook fails)
        try {
          console.log("Creating backup orders for group payment...");
          
          // Create order for each item in the group
          for (const item of groupData.items) {
            // Calculate discounted price using the same method as user-group page
            const discountPrice = item.product.discountTiers?.[0]?.finalPrice || item.product.originalPrice;
            const discountedPrice = parseFloat(discountPrice.toString());
            
            await apiRequest("POST", "/api/orders", {
              productId: item.product.id,
              quantity: item.quantity,
              unitPrice: discountedPrice.toFixed(2),
              totalPrice: (discountedPrice * item.quantity).toFixed(2),
              finalPrice: (discountedPrice * item.quantity).toFixed(2),
              status: "completed",
              type: "group",
              shippingAddress: selectedAddress ? 
                `${selectedAddress.fullName}, ${selectedAddress.addressLine}, ${selectedAddress.city}, ${selectedAddress.state || ''} ${selectedAddress.pincode}, ${selectedAddress.country || 'US'}` :
                "International Shipping Address"
            });
          }
          console.log("Backup orders created successfully for group payment");
        } catch (orderError) {
          console.log("Order creation handled by webhook or failed:", orderError); // This is fine, webhook will create it
        }
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
  const [isLoadingPayment, setIsLoadingPayment] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [isGroupPayment, setIsGroupPayment] = useState(false);
  const [userGroupId, setUserGroupId] = useState<number | null>(null);
  const [memberDetails, setMemberDetails] = useState<any>(null);
  const [totalMembers, setTotalMembers] = useState(1);
  const [originalAmount, setOriginalAmount] = useState(0);
  const [potentialSavings, setPotentialSavings] = useState(0);
  const initRef = useRef(false);

  // Parse URL and query parameters - use a function to ensure we get fresh values
  const getUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      queryType: urlParams.get('type'),
      queryUserGroupId: urlParams.get('userGroupId'),
      queryGroup: urlParams.get('group'), // Share token for group payments
      queryMember: urlParams.get('member'), // Specific member ID for payment
    };
  };
  
  const { queryType, queryUserGroupId, queryGroup, queryMember } = getUrlParams();
  
  // Debug logging
  console.log("URL Debug Info:", {
    fullUrl: window.location.href,
    search: window.location.search,
    queryType,
    queryUserGroupId,
    queryGroup,
    queryMember
  });

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true; // Prevent multiple initializations

    const initializePayment = async () => {
      try {
        setIsLoading(true);
        
        // Get fresh URL parameters
        const urlParams = getUrlParams();
        console.log("Fresh URL params in initializePayment:", urlParams);
        
        // If no parameters are detected, wait a bit and try again
        if (!urlParams.queryType && !urlParams.queryUserGroupId && !urlParams.queryGroup && !match) {
          console.log("No URL parameters detected, waiting for URL to be ready...");
          setTimeout(() => {
            const retryParams = getUrlParams();
            console.log("Retry URL params:", retryParams);
            if (retryParams.queryGroup || retryParams.queryType || retryParams.queryUserGroupId || match) {
              initializePayment();
            }
          }, 100);
          return;
        }
        
        // Check if this is a group payment via query params (either old or new format)
        // Also check window.location.search directly as a fallback
        const hasGroupParam = urlParams.queryGroup || window.location.search.includes('group=');
        const hasUserGroupIdParam = urlParams.queryUserGroupId || window.location.search.includes('userGroupId=');
        const hasTypeParam = urlParams.queryType === 'group' || window.location.search.includes('type=group');
        
        if ((hasTypeParam && hasUserGroupIdParam) || hasGroupParam) {
          console.log("Detected group payment:", urlParams);
          setIsGroupPayment(true);
          
          // Extract group token from URL directly
          const groupToken = urlParams.queryGroup || (() => {
            const match = window.location.search.match(/group=([^&]+)/);
            return match ? match[1] : null;
          })();
          
          if (groupToken) {
            // New format: using share token and member ID
            console.log("Processing group payment with share token:", groupToken);
            try {
              // Get group details by share token
              const groupResponse = await apiRequest("GET", `/api/shared/${groupToken}`);
              const groupDataResponse = await groupResponse.json();
              console.log("Group data received:", groupDataResponse);
              
              // Debug discount tiers for each item
              if (groupDataResponse.items) {
                groupDataResponse.items.forEach((item: any) => {
                  console.log(`Item: ${item.product.name}, Discount Tiers:`, item.product.discountTiers);
                });
              }
              setUserGroupId(groupDataResponse.id);
              setGroupData(groupDataResponse);
              
              // Fetch the full user group details to get the correct potential savings
              const userGroupResponse = await apiRequest("GET", `/api/user-groups/${groupDataResponse.id}`);
              const userGroupDetails = await userGroupResponse.json();
              console.log("User group details received:", userGroupDetails);
              
              // Extract member ID from URL directly
              const memberId = urlParams.queryMember || (() => {
                const match = window.location.search.match(/member=([^&]+)/);
                return match ? match[1] : null;
              })();
              
              // Get member details if specified
              if (memberId) {
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
              const totalMembersCount = approved.length + 1; // +1 for owner
              setTotalMembers(totalMembersCount);
              console.log("Total members:", totalMembersCount);
              
              // Calculate pricing using the EXACT same method as user-group page
              let totalOriginalAmount = 0;
              let totalDiscountedAmount = 0;
              
              if (userGroupDetails.items && userGroupDetails.items.length > 0) {
                for (const item of userGroupDetails.items) {
                  const originalPrice = parseFloat(item.product.originalPrice);
                  totalOriginalAmount += originalPrice * item.quantity;
                  
                  // Use the EXACT same calculation as user-group page: first discount tier
                  const discountPrice = item.product.discountTiers?.[0]?.finalPrice || item.product.originalPrice;
                  const discountedPrice = parseFloat(discountPrice.toString());
                  totalDiscountedAmount += discountedPrice * item.quantity;
                  
                  console.log(`Item: ${item.product.name}, Original: $${originalPrice}, Discounted: $${discountedPrice}, Using first tier: ${item.product.discountTiers?.[0]?.finalPrice || 'none'}`);
                }
              }
              
              // Calculate potential savings using the EXACT same method as user-group page
              const potentialSavingsFromGroup = userGroupDetails.items?.reduce((sum, item) => {
                const discountPrice = item.product.discountTiers?.[0]?.finalPrice || item.product.originalPrice;
                const savings = (parseFloat(item.product.originalPrice.toString()) - parseFloat(discountPrice.toString())) * item.quantity;
                return sum + savings;
              }, 0) || 0;
              
              // Calculate amounts based on the formula: Popular Group Value - Potential Savings
              const popularGroupValue = totalOriginalAmount; // This is the "Popular Group Value"
              const finalAmount = popularGroupValue - potentialSavingsFromGroup; // This equals totalDiscountedAmount
              
              // Set the potential savings from the user-group page calculation
              setPotentialSavings(potentialSavingsFromGroup);
              
              // Each user pays the final amount (Popular Group Value - Potential Savings)
              const memberAmount = finalAmount;
              setAmount(memberAmount);
              setOriginalAmount(popularGroupValue);
              
              console.log("Client - Final calculations:", {
                popularGroupValue: totalOriginalAmount.toFixed(2),
                totalDiscountedAmount: totalDiscountedAmount.toFixed(2),
                potentialSavings: potentialSavingsFromGroup.toFixed(2),
                finalAmount: memberAmount.toFixed(2),
                totalMembersCount
              });
              
              setProductName(`Group Purchase${memberId ? ` for Member` : ""}`);
              
              // For group payments, we don't create PaymentIntent yet - wait for address selection
              // Show product details but keep payment loading until address is selected
              setIsLoading(false);
              setIsLoadingPayment(true);
              return; // Early return to prevent falling through
            } catch (error) {
              console.error("Error fetching group data:", error);
              setProductName("Group Purchase");
              // Still continue with group payment setup even if there are errors
              setIsLoading(false);
              setIsLoadingPayment(true);
              return;
            }
          } else if (urlParams.queryUserGroupId) {
            // Old format: direct userGroupId
            setUserGroupId(parseInt(urlParams.queryUserGroupId));
            setProductName("Group Purchase");
            setIsLoading(false);
            setIsLoadingPayment(true);
            return;
          }
        } 
        // Handle individual payment via URL params (path-based routes)
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
            productId: productId,
            type,
          });
          const data = await response.json();
          setClientSecret(data.clientSecret);
          setAmount(paymentAmount);
          setIsLoading(false);
          setIsLoadingPayment(false);
        } 
        // Handle individual payment via query params (fallback)
        else if (urlParams.queryType || window.location.search.includes('productId')) {
          const urlParamsObj = new URLSearchParams(window.location.search);
          const productIdParam = urlParamsObj.get('productId');
          if (!productIdParam) return;
          const productId = parseInt(productIdParam);
          const type = urlParamsObj.get('type') || 'individual';
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
            productId: productId,
            type,
          });
          const data = await response.json();
          setClientSecret(data.clientSecret);
          setAmount(paymentAmount);
          setIsLoading(false);
          setIsLoadingPayment(false);
        } 
        else {
          // No valid payment type detected - show error
          console.error("Invalid checkout URL - no valid payment type detected");
          console.log("URL parameters:", {
            queryType: urlParams.queryType,
            queryUserGroupId: urlParams.queryUserGroupId,
            queryGroup: urlParams.queryGroup,
            queryMember: urlParams.queryMember,
            productId: new URLSearchParams(window.location.search).get('productId'),
            match,
            params
          });
          setIsLoading(false);
          setIsLoadingPayment(false);
        }
      } catch (error) {
        console.error("Error initializing payment:", error);
        setIsLoading(false);
        setIsLoadingPayment(false);
      }
    };

    initializePayment();
  }, [queryType, queryUserGroupId, queryGroup, queryMember, match, params]); // Include dependencies for re-initialization if URL changes

  // Create group payment intent when address is selected
  useEffect(() => {
    if (!isGroupPayment || !userGroupId || !selectedAddressId) return;

    const createGroupPaymentIntent = async () => {
      try {
        console.log("Creating group payment intent with:", {
          isGroupPayment,
          userGroupId,
          selectedAddressId
        });
        setIsLoadingPayment(true);
        
        // Get selected address details
        const addressResponse = await apiRequest("GET", `/api/addresses`);
        const addresses = await addressResponse.json();
        const address = addresses.find((addr: any) => addr.id === selectedAddressId);
        setSelectedAddress(address);
        
        // Extract member ID from URL for payment intent
        const memberId = (() => {
          const match = window.location.search.match(/member=([^&]+)/);
          return match ? match[1] : null;
        })();
        
        const response = await apiRequest("POST", "/api/group-payment-intent", {
          userGroupId,
          addressId: selectedAddressId,
          memberId: memberId, // Pass the specific member ID for payment
        });
        const data = await response.json();
        console.log("Group payment intent created:", data);
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
        setIsLoadingPayment(false);
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
                {isGroupPayment && groupData && groupData.items && groupData.items.length > 0 ? (
                  <div>
                    <h3 className="font-semibold text-lg mb-4">Items in Group Purchase</h3>
                    {groupData.items.map((item: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4 mb-4 bg-white dark:bg-gray-800">
                        <div className="flex items-start space-x-4">
                          <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                            {item.product.imageUrl ? (
                              <img 
                                src={item.product.imageUrl} 
                                alt={item.product.name}
                                className="w-20 h-20 object-cover rounded-lg"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`text-xs text-gray-500 text-center p-2 ${item.product.imageUrl ? 'hidden' : ''}`}>
                              No Image
                            </div>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-lg text-gray-900 dark:text-white">{item.product.name}</h4>
                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-3 line-clamp-2">
                              {item.product.description || 'High-quality product for group purchase'}
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-xs text-gray-500 uppercase tracking-wide">Quantity</span>
                                <div className="text-sm font-medium">{item.quantity || 1}</div>
                              </div>
                              <div>
                                <span className="text-xs text-gray-500 uppercase tracking-wide">Price Each</span>
                                <div className="text-lg font-bold text-green-600">
                                  ${parseFloat(item.product.originalPrice || '0').toFixed(2)}
                                </div>
                              </div>
                            </div>
                            {item.product.discountTiers && item.product.discountTiers.length > 0 && (
                              <div className="mt-2 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                                ✓ Group discount applied!
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Group Members Info */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                      <h4 className="font-semibold mb-3 text-blue-900 dark:text-blue-100">Group Purchase Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide">Total Members</span>
                          <div className="text-lg font-bold text-blue-900 dark:text-blue-100">{totalMembers}</div>
                        </div>
                        <div>
                          <span className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide">Payment For</span>
                          <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            {memberDetails ? (memberDetails.name || memberDetails.email || 'Group Member') : 'Current User'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : productData ? (
                  <div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border">
                      <div className="flex items-start space-x-6">
                        <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                          {productData.imageUrl ? (
                            <img 
                              src={productData.imageUrl} 
                              alt={productData.name}
                              className="w-32 h-32 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="text-xs text-gray-500 text-center p-2">No Image</div>
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-2xl mb-3 text-gray-900 dark:text-white">{productData.name}</h3>
                          <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                            {productData.description || 'Premium quality product'}
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="flex justify-between py-1">
                                <span className="text-sm text-gray-500">Category:</span>
                                <span className="text-sm font-medium">{productData.category?.name || 'General'}</span>
                              </div>
                              {productData.brand && (
                                <div className="flex justify-between py-1">
                                  <span className="text-sm text-gray-500">Brand:</span>
                                  <span className="text-sm font-medium">{productData.brand}</span>
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="text-sm text-gray-500">Unit Price:</span>
                              <div className="text-2xl font-bold text-green-600">
                                ${parseFloat(productData.originalPrice || '0').toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-8 border text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <h3 className="font-medium text-lg mb-2">Loading Product Details</h3>
                    <p className="text-gray-600 dark:text-gray-400">Please wait while we fetch your product information...</p>
                  </div>
                )}
                
                {/* Pricing Breakdown */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h4 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">Pricing Breakdown</h4>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    {isGroupPayment ? (
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
                        <div className="border-t border-gray-300 dark:border-gray-600 pt-3 mt-3">
                          <div className="flex justify-between">
                            <span className="font-bold text-lg text-gray-900 dark:text-white">Total Amount:</span>
                            <span className="font-bold text-2xl text-green-600">${amount.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1 text-center">
                            Formula: Popular Group Value - Potential Savings
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between">
                        <span className="font-bold text-lg text-gray-900 dark:text-white">Total Amount:</span>
                        <span className="font-bold text-2xl text-green-600">${amount.toFixed(2)}</span>
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
                        <div className="font-semibold text-lg text-gray-900 dark:text-white">{selectedAddress.fullName}</div>
                        <div className="text-gray-700 dark:text-gray-300">{selectedAddress.addressLine}</div>
                        <div className="text-gray-700 dark:text-gray-300">
                          {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}
                        </div>
                        <div className="text-gray-700 dark:text-gray-300">{selectedAddress.country || 'United States'}</div>
                        {selectedAddress.phoneNumber && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <span className="font-medium">Phone:</span> {selectedAddress.phoneNumber}
                          </div>
                        )}
                      </div>
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
            
            <Card className="bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b">
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                  <svg className="w-6 h-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Secure Payment
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Complete your purchase with our secure payment system
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {/* Show address selection requirement for group payments */}
                {isGroupPayment && !selectedAddressId ? (
                  <div className="space-y-4">
                    <div className="p-6 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-lg border-2 border-orange-200 dark:border-orange-800 text-center">
                      <div className="w-16 h-16 bg-orange-100 dark:bg-orange-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <h3 className="font-semibold text-lg text-orange-800 dark:text-orange-200 mb-2">Address Required</h3>
                      <p className="text-orange-700 dark:text-orange-300 mb-4">
                        Please select a delivery address above to continue with your secure group purchase.
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
                ) : clientSecret && !isLoadingPayment ? (
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
                      <CheckoutForm 
                        amount={amount} 
                        productId={params ? parseInt(params.productId) : undefined}
                        type={isGroupPayment ? "group" : (params?.type || "individual")}
                        userGroupId={userGroupId || undefined}
                        selectedAddressId={selectedAddressId || undefined}
                        groupData={groupData}
                        selectedAddress={selectedAddress}
                      />
                    </Elements>
                  </div>
                ) : isLoadingPayment ? (
                  <div className="p-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-center">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                    </div>
                    <h3 className="font-semibold text-lg text-blue-800 dark:text-blue-200 mb-2">Setting Up Payment</h3>
                    <p className="text-blue-700 dark:text-blue-300">
                      Preparing your secure payment experience...
                    </p>
                  </div>
                ) : (
                  <div className="p-8 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-lg border border-red-200 dark:border-red-800 text-center">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-lg text-red-800 dark:text-red-200 mb-2">Payment Setup Failed</h3>
                    <p className="text-red-700 dark:text-red-300">
                      Unable to initialize payment. Please try again.
                    </p>
                  </div>
                )}
                
                {/* Test card information */}
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Test Payment Information
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                    Use these test card details to complete your purchase:
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border">
                      <span className="text-xs text-gray-500 block">Card Number</span>
                      <span className="font-mono text-blue-800 dark:text-blue-200">4242 4242 4242 4242</span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border">
                      <span className="text-xs text-gray-500 block">Expiry</span>
                      <span className="font-mono text-blue-800 dark:text-blue-200">12/34</span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border">
                      <span className="text-xs text-gray-500 block">CVV</span>
                      <span className="font-mono text-blue-800 dark:text-blue-200">123</span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border">
                      <span className="text-xs text-gray-500 block">ZIP Code</span>
                      <span className="font-mono text-blue-800 dark:text-blue-200">12345</span>
                    </div>
                  </div>
                </div>
                
                {/* Security Notice */}
                <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-800/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-medium text-green-800 dark:text-green-200 mb-1">Secure & Protected</h5>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Your payment is secured by Stripe with industry-standard 256-bit SSL encryption and PCI DSS compliance.
                      </p>
                    </div>
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