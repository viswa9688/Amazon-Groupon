import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import CategoryConflictDialog from "@/components/CategoryConflictDialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import PhoneAuthModal from "@/components/PhoneAuthModal";
import Header from "@/components/Header";
import GroupProgress from "@/components/GroupProgress";
import CountdownTimer from "@/components/CountdownTimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Users, Clock, Star, ShoppingCart } from "lucide-react";
import type { GroupPurchaseWithDetails } from "@shared/schema";

interface Product {
  id: number;
  name: string;
  description: string;
  originalPrice: string;
  imageUrl: string;
  minimumParticipants?: number;
  discountTiers?: Array<{
    id: number;
    participantCount: number;
    finalPrice: string;
  }>;
  seller: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  };
  category: {
    id: number;
    name: string;
  };
}

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [categoryConflictOpen, setCategoryConflictOpen] = useState(false);
  const [conflictingCategory, setConflictingCategory] = useState<string>("");
  const [, navigate] = useLocation();

  // Try to fetch as individual product first
  const { data: individualProduct, isLoading: productLoading } = useQuery<Product>({
    queryKey: ["/api/products", id],
    enabled: !!id,
    retry: false,
  });

  // If not an individual product, try to fetch as group purchase
  const { data: groupPurchase, isLoading: groupLoading } = useQuery<GroupPurchaseWithDetails>({
    queryKey: ["/api/group-purchases", id],
    enabled: !!id && !individualProduct,
    retry: false,
  });

  const { data: participation } = useQuery<{ isParticipating: boolean; participation: any }>({
    queryKey: ["/api/group-purchases", id, "participation"],
    enabled: !!id && isAuthenticated && !!groupPurchase,
  });

  // Get payment status for the group (if it's a group purchase)
  const { data: paymentStatus } = useQuery<any[]>({
    queryKey: [`/api/user-groups/${groupPurchase?.userGroupId}/payment-status`],
    enabled: !!groupPurchase?.userGroupId && isAuthenticated,
    retry: false,
  });

  const isLoading = productLoading || groupLoading;

  // Check user addresses before joining
  const { data: userAddresses } = useQuery({
    queryKey: ["/api/addresses"],
    enabled: isAuthenticated,
  });

  const joinGroupMutation = useMutation({
    mutationFn: async () => {
      if (!id || !isAuthenticated) throw new Error("Not authenticated");
      
      // Check if user has addresses first
      if (!userAddresses || (Array.isArray(userAddresses) && userAddresses.length === 0)) {
        throw new Error("PROFILE_INCOMPLETE");
      }
      
      return apiRequest("POST", `/api/group-purchases/${id}/join`, { quantity: 1 });
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "You've joined the group purchase. Check your orders to track progress.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/group-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/group-purchases", id] });
    },
    onError: (error) => {
      if (error.message === "PROFILE_INCOMPLETE") {
        toast({
          title: "Complete Your Profile",
          description: "Please add your delivery address before joining a group purchase.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/address";
        }, 1500);
        return;
      }
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to join group purchase. Please try again.",
        variant: "destructive",
      });
    },
  });

  const leaveGroupMutation = useMutation({
    mutationFn: async () => {
      if (!id || !isAuthenticated) throw new Error("Not authenticated");
      return apiRequest("DELETE", `/api/group-purchases/${id}/leave`);
    },
    onSuccess: () => {
      toast({
        title: "Left Group",
        description: "You've left the group purchase successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/group-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/group-purchases", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/group-purchases", id, "participation"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to leave group purchase. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Get current cart to check category
  const { data: cartItems } = useQuery<any[]>({
    queryKey: ["/api/cart"],
    enabled: isAuthenticated,
  });

  // Clear cart mutation
  const clearCartMutation = useMutation({
    mutationFn: async () => {
      if (!cartItems) return;
      for (const item of cartItems) {
        await apiRequest("DELETE", `/api/cart/${item.id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      // After clearing, add the new item
      addToCartMutation.mutate();
    },
  });

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const productId = individualProduct?.id || groupPurchase?.product.id;
      if (!productId) throw new Error("Product not found");
      return apiRequest("POST", "/api/cart", {
        productId: productId,
        quantity: 1,
      });
    },
    onSuccess: () => {
      toast({
        title: "Added to Cart",
        description: "Product added to your cart successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
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
      // Check if it's a category conflict error
      if (error?.categoryConflict) {
        const currentCartCategory = error.currentCategory || "unknown";
        setConflictingCategory(currentCartCategory);
        setCategoryConflictOpen(true);
        // Also show toast with the specific message
        toast({
          title: "Cannot Mix Categories",
          description: error?.error || "We can't club services and groceries together. Please add them separately to cart.",
          variant: "destructive",
        });
      } else if (error?.shopConflict) {
        // Handle different shop conflict error
        toast({
          title: "Different Shop Conflict",
          description: error?.error || "You have products from a different shop in your cart. Please clear your cart before adding products from this shop.",
          variant: "destructive",
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Navigate to cart page where user can clear cart
                window.location.href = "/cart";
              }}
            >
              Go to Cart
            </Button>
          ),
        });
      } else if (error?.sameItemConflict) {
        // Handle same item from different shop error
        toast({
          title: "Same Item from Different Shop",
          description: error?.error || "You already have this item from a different seller. Cannot add the same item from multiple shops.",
          variant: "destructive",
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Navigate to cart page where user can clear cart
                window.location.href = "/cart";
              }}
            >
              Go to Cart
            </Button>
          ),
        });
      } else {
        toast({
          title: "Error",
          description: error?.error || "Failed to add product to cart. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <Skeleton className="h-96 w-full rounded-xl mb-4" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!individualProduct && !groupPurchase) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-foreground mb-4">Product Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The product you're looking for doesn't exist.
            </p>
            <Button onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Get the product data from either individual product or group purchase
  const product = individualProduct || groupPurchase?.product;
  const isUserParticipant = participation?.isParticipating || false;
  
  // Check if the current user has already paid for this product
  const userPaymentStatus = paymentStatus?.find(p => p.userId === user?.id);
  const hasUserPaid = userPaymentStatus?.hasPaid || false;
  const isGroupPurchase = !!groupPurchase;

  // Early return if no product found
  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-foreground mb-4">Product Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The product you're looking for doesn't exist.
            </p>
            <Button onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Calculate pricing based on product type  
  const displayPrice = (() => {
    if (individualProduct) {
      // For individual products, show original price (no discount until group forms)
      return individualProduct.originalPrice;
    } else if (groupPurchase) {
      // For group purchases, show current price based on participants
      return product.discountTiers && product.discountTiers.length > 0 
        ? product.discountTiers[0].finalPrice.toString()
        : groupPurchase.currentPrice.toString();
    }
    return product?.originalPrice || "0";
  })();
  
  const currentDiscount = individualProduct ? 0 : parseFloat(product?.originalPrice?.toString() || "0") - parseFloat(displayPrice);
  
  // For individual products, use 5 as the minimum participants for the single discount tier
  const minParticipants = individualProduct ? 5 : groupPurchase?.targetParticipants || 5;
  const currentParticipants = individualProduct ? 0 : groupPurchase?.currentParticipants || 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button 
          variant="ghost" 
          onClick={() => window.history.back()}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Products
        </Button>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Product Image */}
          <div>
            <img 
              src={product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=600"} 
              alt={product.name}
              className="w-full h-96 object-cover rounded-xl shadow-lg"
              data-testid="img-product-main"
            />
            
            {/* Seller Info */}
            <Card className="mt-6">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <img 
                    src={product.seller.profileImageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${product.seller.firstName}`}
                    alt={`${product.seller.firstName}'s profile`}
                    className="w-12 h-12 rounded-full object-cover"
                    data-testid="img-seller-avatar"
                  />
                  <div>
                    <h4 className="font-semibold text-foreground" data-testid="text-seller-name">
                      {product.seller.firstName} {product.seller.lastName}
                    </h4>
                    <p className="text-sm text-muted-foreground">Seller</p>
                    <div className="flex items-center space-x-1 mt-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className="text-sm">4.8 (124 reviews)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold text-foreground" data-testid="text-product-name">
                  {product.name}
                </h1>
                <Badge variant={isGroupPurchase && groupPurchase?.status === "active" ? "default" : "secondary"}>
                  {individualProduct ? "Individual Product" : (groupPurchase?.status === "active" ? "Active Group" : "Ended")}
                </Badge>
              </div>
              
              <p className="text-muted-foreground text-lg mb-6" data-testid="text-product-description">
                {product.description || "Experience premium quality with this amazing product. Join the group purchase to unlock incredible savings!"}
              </p>

              {/* Pricing */}
              <div className="bg-muted/30 p-6 rounded-lg mb-6">
                <div>
                  {individualProduct && individualProduct.discountTiers && individualProduct.discountTiers.length > 0 ? (
                    // Individual product with discount tier display
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="text-3xl font-bold text-accent" data-testid="text-current-price">
                          ${individualProduct.discountTiers[0].finalPrice}
                        </span>
                        <span className="text-xl text-muted-foreground line-through">
                          ${product.originalPrice}
                        </span>
                      </div>
                      <span className="text-lg font-semibold text-accent">
                        Save ${(parseFloat(product.originalPrice.toString()) - parseFloat(individualProduct.discountTiers[0].finalPrice)).toFixed(2)}
                      </span>
                    </div>
                  ) : individualProduct ? (
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="text-3xl font-bold text-foreground" data-testid="text-current-price">
                          ${displayPrice}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Individual price
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="text-3xl font-bold text-accent" data-testid="text-current-price">
                          ${displayPrice}
                        </span>
                        <span className="text-xl text-muted-foreground line-through">
                          ${product.originalPrice}
                        </span>
                      </div>
                      <span className="text-lg font-semibold text-accent">
                        Save ${currentDiscount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {individualProduct && individualProduct.discountTiers && individualProduct.discountTiers.length > 0
                      ? "Group discount available! Start a group purchase to get this great price!"
                      : individualProduct 
                      ? "Start a group purchase to unlock bulk discounts!"
                      : "Group discount available! Join now to get this great price!"
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Group Progress */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    {individualProduct ? "Group Buying Potential" : "Group Progress"}
                  </h3>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span data-testid="text-participant-count">
                      {currentParticipants} of {minParticipants} people
                    </span>
                  </div>
                </div>
                
                <GroupProgress
                  current={currentParticipants}
                  target={minParticipants}
                />
                
                <div className="mt-4 text-sm text-muted-foreground">
                  {individualProduct ? (
                    <span>
                      Start a group purchase for this product to unlock bulk discounts! Need {minParticipants - currentParticipants} more people.
                    </span>
                  ) : (
                    minParticipants - currentParticipants > 0 ? (
                      <span>
                        {minParticipants - currentParticipants} more people needed to reach the goal!
                      </span>
                    ) : (
                      <span className="text-accent font-medium">Goal reached! Maximum discount unlocked!</span>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Countdown Timer */}
            {isGroupPurchase && groupPurchase.status === "active" && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <Clock className="w-5 h-5 text-destructive" />
                    <h3 className="text-lg font-semibold text-foreground">Time Remaining</h3>
                  </div>
                  <CountdownTimer endTime={new Date(groupPurchase.endTime || new Date())} />
                </CardContent>
              </Card>
            )}

            {/* Group Buying Opportunity for Individual Products */}
            {individualProduct && individualProduct.discountTiers && individualProduct.discountTiers.length > 0 && (
              <Card className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <Users className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-foreground">Start a Group Purchase</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Be the first to start a group purchase for this product and get others to join for bulk discounts!
                  </p>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>5+ people:</span>
                      <span className="font-semibold text-green-600">15% off (${(parseFloat(individualProduct.originalPrice) * 0.85).toFixed(2)})</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="space-y-4">
              {!isAuthenticated ? (
                <div className="space-y-3">
                  {isGroupPurchase ? (
                    <>
                      <Button 
                        size="lg" 
                        className="w-full bg-primary hover:bg-primary/90"
                        onClick={() => setAuthModalOpen(true)}
                        data-testid="button-login-to-join"
                      >
                        Login to Join Group Purchase
                      </Button>
                      <Button 
                        size="lg" 
                        variant="outline"
                        className="w-full"
                        onClick={() => setAuthModalOpen(true)}
                        data-testid="button-login-to-buy"
                      >
                        Login to Buy Individual
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        size="lg" 
                        className="w-full bg-primary hover:bg-primary/90"
                        onClick={() => setAuthModalOpen(true)}
                        data-testid="button-login-to-buy"
                      >
                        Login to Buy Now
                      </Button>
                      <Button 
                        size="lg" 
                        variant="outline"
                        className="w-full"
                        onClick={() => setAuthModalOpen(true)}
                        data-testid="button-login-to-start-group"
                      >
                        Login to Start Group Purchase
                      </Button>
                    </>
                  )}
                </div>
              ) : isGroupPurchase && isUserParticipant ? (
                <div className="space-y-4">
                  {hasUserPaid ? (
                    <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-700 font-semibold">✓ Payment Complete!</p>
                      <p className="text-sm text-green-600 mt-1">
                        You've already paid for this group purchase. Check your orders to track progress.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center p-4 bg-accent/10 rounded-lg">
                      <p className="text-accent font-semibold">✓ You're part of this group!</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Complete your payment to secure your spot in this group purchase.
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    {hasUserPaid ? (
                      <Button 
                        size="lg" 
                        variant="outline"
                        className="w-full border-green-200 text-green-600 hover:bg-green-50"
                        onClick={() => navigate("/orders")}
                        data-testid="button-view-orders"
                      >
                        View Your Orders
                      </Button>
                    ) : (
                      <Button 
                        size="lg" 
                        className="w-full bg-primary hover:bg-primary/90"
                        onClick={() => navigate(`/checkout/${groupPurchase?.productId}/group`)}
                        data-testid="button-pay-group"
                      >
                        Pay for Group Purchase - ${displayPrice}
                      </Button>
                    )}
                    
                    <Button 
                      size="lg" 
                      variant="outline"
                      className="w-full border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => leaveGroupMutation.mutate()}
                      disabled={leaveGroupMutation.isPending}
                      data-testid="button-leave-group"
                    >
                      {leaveGroupMutation.isPending ? "Leaving..." : "Leave Group"}
                    </Button>
                  </div>
                </div>
              ) : individualProduct ? (
                <div className="space-y-3">
                  <Button 
                    size="lg" 
                    className="w-full bg-primary hover:bg-primary/90"
                    onClick={() => navigate(`/checkout/${individualProduct.id}/individual`)}
                    data-testid="button-buy-now"
                  >
                    Buy Now - ${displayPrice}
                  </Button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      size="lg" 
                      variant="outline"
                      onClick={() => addToCartMutation.mutate()}
                      disabled={addToCartMutation.isPending}
                      data-testid="button-add-to-cart"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {addToCartMutation.isPending ? "Adding..." : "Add to Cart"}
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline"
                      onClick={() => {
                        toast({
                          title: "Coming Soon",
                          description: "Group purchase creation is coming soon!",
                        });
                      }}
                      data-testid="button-start-group"
                    >
                      Start Group
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    Ships immediately • Free returns within 30 days
                  </p>
                </div>
              ) : isGroupPurchase && groupPurchase.status === "active" ? (
                <div className="space-y-3">
                  <Button 
                    size="lg" 
                    className="w-full bg-primary hover:bg-primary/90"
                    onClick={() => joinGroupMutation.mutate()}
                    disabled={joinGroupMutation.isPending}
                    data-testid="button-join-group"
                  >
                    {joinGroupMutation.isPending ? "Joining..." : `Join Group - $${displayPrice}`}
                  </Button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      size="lg" 
                      variant="outline"
                      onClick={() => addToCartMutation.mutate()}
                      disabled={addToCartMutation.isPending}
                      data-testid="button-add-to-cart"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {addToCartMutation.isPending ? "Adding..." : "Add to Cart"}
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline"
                      onClick={() => navigate(`/checkout/${groupPurchase.productId}/individual`)}
                      disabled={false}
                      data-testid="button-buy-individual"
                    >
                      Buy Now - ${product.originalPrice}
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    Individual purchase ships immediately • Group purchase ships when goal is reached
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-muted-foreground font-semibold">This group purchase has ended</p>
                  </div>
                  <Button 
                    size="lg" 
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/checkout/${groupPurchase?.productId}/individual`)}
                    disabled={false}
                    data-testid="button-buy-individual-ended"
                  >
                    Buy Individual - ${product.originalPrice}
                  </Button>
                </div>
              )}

              <div className="text-center text-sm text-muted-foreground">
                <p>Free shipping • 30-day money back guarantee • Secure payments</p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <Card>
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 text-primary mx-auto mb-3" />
              <h4 className="font-semibold text-foreground mb-2">Group Buying</h4>
              <p className="text-sm text-muted-foreground">
                The more people join, the lower the price gets for everyone.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 text-primary mx-auto mb-3" />
              <h4 className="font-semibold text-foreground mb-2">Limited Time</h4>
              <p className="text-sm text-muted-foreground">
                Group purchases have time limits to create urgency and excitement.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Star className="w-8 h-8 text-primary mx-auto mb-3" />
              <h4 className="font-semibold text-foreground mb-2">Quality Guaranteed</h4>
              <p className="text-sm text-muted-foreground">
                All products are verified by our team for quality and authenticity.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <PhoneAuthModal 
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
      
      <CategoryConflictDialog
        open={categoryConflictOpen}
        onOpenChange={setCategoryConflictOpen}
        currentCategory={conflictingCategory}
        attemptedCategory={product?.category?.name || ""}
        onClearCart={() => clearCartMutation.mutate()}
      />
    </div>
  );
}
