import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { ShoppingCart, Plus, Minus, Trash2, Users, Target, TrendingDown, Sparkles, Zap, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/Header";

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
    groupPurchases: Array<{
      id: number;
      currentPrice: string;
      currentParticipants: number;
      targetParticipants: number;
      endTime: string;
    }>;
  };
}

interface SimilarGroup {
  userGroup: {
    id: number;
    name: string;
    description: string;
    isPublic: boolean;
    shareToken: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
    };
    items: Array<{
      id: number;
      productId: number;
      quantity: number;
      product: {
        id: number;
        name: string;
        originalPrice: string;
        discountTiers: Array<{
          finalPrice: string;
          minQuantity: number;
        }>;
      };
    }>;
    participantCount?: number;
  };
  similarityScore: number;
  matchingProducts: number;
  totalCartProducts: number;
  potentialSavings: number;
  matchingItems: Array<{
    productId: number;
    productName: string;
    cartQuantity: number;
    groupQuantity: number;
    individualSavings: number;
  }>;
  isAlreadyMember: boolean;
  isFull: boolean;
}

interface OptimizationSuggestion {
  userGroups: Array<{
    id: number;
    name: string;
    description: string;
    isPublic: boolean;
    shareToken: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
    };
    items: Array<{
      id: number;
      productId: number;
      quantity: number;
      product: {
        id: number;
        name: string;
        originalPrice: string;
        discountTiers: Array<{
          finalPrice: string;
          minQuantity: number;
        }>;
      };
    }>;
    participantCount?: number;
  }>;
  totalSavings: number;
  coverage: number;
  uncoveredProducts: Array<{
    id: number;
    name: string;
    originalPrice: string;
  }>;
  recommendationType: 'single_best' | 'multi_group' | 'complete_coverage';
  description: string;
}

export default function Cart() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [optimizing, setOptimizing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expandedStrategies, setExpandedStrategies] = useState<Set<number>>(new Set());
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [collectionName, setCollectionName] = useState("");

  // Fetch cart items
  const { data: cartItems = [], isLoading: cartLoading } = useQuery<CartItem[]>({
    queryKey: ["/api/cart"],
    enabled: !!user,
  });

  // Fetch similar groups (only when user clicks show suggestions)
  const { data: similarGroups = [], isLoading: groupsLoading, refetch: refetchSimilarGroups } = useQuery<SimilarGroup[]>({
    queryKey: ["/api/cart/similar-groups"],
    enabled: false, // Disabled by default, only fetch when manually triggered
  });

  // Fetch optimization suggestions (only when user clicks show suggestions)
  const { data: optimizationSuggestions = [], isLoading: optimizationLoading, refetch: refetchOptimizationSuggestions } = useQuery<OptimizationSuggestion[]>({
    queryKey: ["/api/cart/optimization-suggestions"],
    enabled: false, // Disabled by default, only fetch when manually triggered
  });

  // Update cart item quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ cartItemId, quantity }: { cartItemId: number; quantity: number }) => {
      await apiRequest("PATCH", `/api/cart/${cartItemId}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart/similar-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart/optimization-suggestions"] });
      setShowSuggestions(false); // Reset suggestions when cart changes
      toast({
        title: "Cart Updated",
        description: "Item quantity updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update item quantity.",
        variant: "destructive",
      });
    },
  });

  // Remove from cart mutation
  const removeFromCartMutation = useMutation({
    mutationFn: async (cartItemId: number) => {
      await apiRequest("DELETE", `/api/cart/${cartItemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart/similar-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart/optimization-suggestions"] });
      setShowSuggestions(false); // Reset suggestions when cart changes
      toast({
        title: "Item Removed",
        description: "Item removed from cart successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove item from cart.",
        variant: "destructive",
      });
    },
  });

  // Clear cart mutation
  const clearCartMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/cart");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart/similar-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart/optimization-suggestions"] });
      setShowSuggestions(false); // Reset suggestions when cart changes
      toast({
        title: "Cart Cleared",
        description: "All items removed from cart.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear cart.",
        variant: "destructive",
      });
    },
  });

  const handleQuantityChange = (cartItemId: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateQuantityMutation.mutate({ cartItemId, quantity: newQuantity });
  };

  const handleRemoveItem = (cartItemId: number) => {
    removeFromCartMutation.mutate(cartItemId);
  };

  const handleClearCart = () => {
    clearCartMutation.mutate();
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Please add items to your cart before checkout.",
        variant: "destructive",
      });
      return;
    }

    // Redirect to multi-item cart checkout page
    setLocation("/cart-checkout");
  };

  const handleShowSuggestions = () => {
    if (cartItems.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Add some products to your cart first to see similar popular groups.",
        variant: "destructive",
      });
      return;
    }
    
    setOptimizing(true);
    setShowSuggestions(true);
    
    // Fetch similar groups and optimization suggestions
    Promise.all([
      refetchSimilarGroups(),
      refetchOptimizationSuggestions()
    ]).finally(() => {
      setOptimizing(false);
    });
  };

  // Apply Strategy - Join all collections in the optimization strategy
  const applyOptimizationStrategy = useMutation({
    mutationFn: async (userGroupIds: number[]) => {
      const joinPromises = userGroupIds.map(id => 
        apiRequest("POST", `/api/user-groups/${id}/join`)
      );
      await Promise.all(joinPromises);
    },
    onSuccess: () => {
      toast({
        title: "Strategy Applied!",
        description: "Successfully joined all recommended popular groups",
      });
      // Refresh all data
      Promise.all([
        refetchSimilarGroups(),
        refetchOptimizationSuggestions(),
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] })
      ]);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Apply Strategy",
        description: error.message || "Some popular groups couldn't be joined",
        variant: "destructive",
      });
    },
  });

  // Create popular group from cart items
  const createCollectionFromCart = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/user-groups/from-cart", { name });
      return await response.json();
    },
    onSuccess: async (data) => {
      const createdCollection = data as any;
      
      if (!createdCollection || !createdCollection.id) {
        toast({
          title: "Error",
          description: "Popular group was created but couldn't redirect properly",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Popular Group Created!",
        description: `"${collectionName}" popular group has been created with your cart items`,
      });
      setShowCreateCollection(false);
      setCollectionName("");
      
      // Refresh data and wait for completion
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] })
      ]);
      
      // Small delay to ensure data is refreshed, then navigate
      setTimeout(() => {
        setLocation(`/user-group/${createdCollection.id}`);
      }, 100);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Popular Group",
        description: error.message || "Could not create popular group",
        variant: "destructive",
      });
    },
  });

  const calculateCartTotal = () => {
    return cartItems.reduce((total, item) => {
      return total + (parseFloat(item.product.originalPrice) * item.quantity);
    }, 0);
  };

  const calculatePotentialSavings = () => {
    return similarGroups.reduce((total, group) => total + group.potentialSavings, 0);
  };

  if (cartLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-16">
            <ShoppingCart className="h-24 w-24 text-gray-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Your cart is empty</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Start shopping to find amazing group deals and save money!
            </p>
            <Link href="/browse">
              <Button size="lg" data-testid="button-browse-products">
                Browse Products
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Shopping Cart</h1>
            <p className="text-gray-600 dark:text-gray-400" data-testid="text-cart-items-count">
              {cartItems.length} item{cartItems.length !== 1 ? 's' : ''} in your cart
            </p>
          </div>
          <div className="flex space-x-3">
            <Button
              onClick={() => setShowCreateCollection(true)}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
              disabled={createCollectionFromCart.isPending}
              data-testid="button-create-own-collection"
            >
              <Plus className="h-4 w-4 mr-2" />
              Make This Your Own Popular Group
            </Button>
            <Button
              variant="outline"
              onClick={handleClearCart}
              disabled={clearCartMutation.isPending}
              data-testid="button-clear-cart"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Cart
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <Card key={item.id} data-testid={`card-cart-item-${item.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-20 h-20 object-cover rounded-lg"
                      data-testid={`img-product-${item.product.id}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900 dark:text-white" data-testid={`text-product-name-${item.product.id}`}>
                            {item.product.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            by {item.product.seller.firstName} {item.product.seller.lastName}
                          </p>
                          <Badge variant="secondary" className="mt-1">
                            {item.product.category.name}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={removeFromCartMutation.isPending}
                          data-testid={`button-remove-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center space-x-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1 || updateQuantityMutation.isPending}
                            data-testid={`button-decrease-${item.id}`}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="font-medium min-w-[2rem] text-center" data-testid={`text-quantity-${item.id}`}>
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                            disabled={updateQuantityMutation.isPending}
                            data-testid={`button-increase-${item.id}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid={`text-price-${item.id}`}>
                            ${(parseFloat(item.product.originalPrice) * item.quantity).toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            ${item.product.originalPrice} each
                          </p>
                        </div>
                      </div>

                      {/* Show active group purchases for this product */}
                      {item.product.groupPurchases?.length > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <Users className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                              Active Group Purchase
                            </span>
                          </div>
                          {item.product.groupPurchases?.map((group) => (
                            <div key={group.id} className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {group.currentParticipants}/{group.targetParticipants} participants
                                </p>
                                <p className="text-lg font-bold text-green-600">
                                  ${group.currentPrice} (group price)
                                </p>
                              </div>
                              <Link href={`/product/${item.product.id}`}>
                                <Button size="sm" data-testid={`button-view-group-${group.id}`}>
                                  View Group
                                </Button>
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Cart Summary & Group Suggestions */}
          <div className="space-y-6">
            {/* Cart Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Cart Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span data-testid="text-cart-subtotal">${calculateCartTotal().toFixed(2)}</span>
                  </div>
                  {showSuggestions && similarGroups.length > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Potential Savings</span>
                      <span data-testid="text-potential-savings">-${calculatePotentialSavings().toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span data-testid="text-cart-total">${calculateCartTotal().toFixed(2)}</span>
                  </div>
                  {showSuggestions && similarGroups.length > 0 && (
                    <div className="text-sm text-green-600 text-center">
                      Save ${calculatePotentialSavings().toFixed(2)} by joining popular groups!
                    </div>
                  )}
                  
                  {/* Show Similar Popular Groups Button */}
                  <div className="pt-2">
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={handleShowSuggestions}
                      disabled={optimizing || cartItems.length === 0}
                      data-testid="button-show-suggestions"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      {optimizing ? "Finding Popular Groups..." : "Show Similar Popular Groups"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Popular Group Matching Suggestions */}
            {showSuggestions && !groupsLoading && similarGroups.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                    <span>Similar Popular Groups</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {similarGroups.map((group, index) => {
                      const collectionProgress = Math.min(((group.userGroup.participantCount || 0) / 5) * 100, 100);
                      const discountsActive = (group.userGroup.participantCount || 0) >= 5;
                      
                      return (
                        <div key={group.userGroup.id} className={`p-4 border rounded-lg ${
                          group.isAlreadyMember 
                            ? 'bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-green-200 dark:border-green-700'
                            : group.isFull 
                            ? 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 border-gray-200 dark:border-gray-600'
                            : 'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20'
                        }`} data-testid={`card-collection-suggestion-${group.userGroup.id}`}>
                          {group.isAlreadyMember && (
                            <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                              <p className="text-sm font-medium text-red-600 dark:text-red-400 text-center">
                                You are already part of this popular group
                              </p>
                            </div>
                          )}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h4 className="font-semibold text-base" data-testid={`text-collection-name-${group.userGroup.id}`}>
                                  {group.userGroup.name}
                                </h4>
                                {group.isAlreadyMember && (
                                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200">
                                    ✓ Member
                                  </Badge>
                                )}
                                {group.isFull && !group.isAlreadyMember && (
                                  <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                    Full (5/5)
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                by {group.userGroup.user.firstName} {group.userGroup.user.lastName}
                              </p>
                            </div>
                            <Badge variant="secondary" className="font-medium">
                              {group.similarityScore.toFixed(0)}% match
                            </Badge>
                          </div>
                          
                          <div className="space-y-3">
                            {/* Popular Group Progress */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Progress</span>
                                <span className="font-medium">
                                  {group.userGroup.participantCount || 0} / 5 members
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${collectionProgress}%` }}
                                />
                              </div>
                              <p className="text-xs text-center">
                                {discountsActive 
                                  ? "🎉 Discounts Active!" 
                                  : `${5 - (group.userGroup.participantCount || 0)} more needed for discounts`}
                              </p>
                            </div>
                            
                            {/* Matching Products */}
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
                                Matching Products ({group.matchingProducts}):
                              </p>
                              <div className="space-y-1">
                                {group.matchingItems.slice(0, 3).map((item) => (
                                  <div key={item.productId} className="flex items-center justify-between text-xs bg-white dark:bg-gray-800 p-2 rounded">
                                    <span className="font-medium">{item.productName}</span>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-gray-600 dark:text-gray-400">
                                        Qty: {item.cartQuantity}
                                      </span>
                                      <span className="font-bold text-green-600">
                                        Save ${item.individualSavings.toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                                {group.matchingItems.length > 3 && (
                                  <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
                                    +{group.matchingItems.length - 3} more matching products
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between pt-2">
                              <div>
                                <p className="text-sm font-bold text-green-600">
                                  Total Savings: ${group.potentialSavings.toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {group.userGroup.items.length} items in popular group
                                </p>
                              </div>
                              <Link href={`/user-group/${group.userGroup.id}`}>
                                <Button 
                                  size="sm" 
                                  variant={group.isAlreadyMember ? "default" : "outline"} 
                                  className={group.isAlreadyMember ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                                  data-testid={`button-view-collection-${group.userGroup.id}`}
                                >
                                  {group.isAlreadyMember ? "View Your Popular Group" : "View Popular Group"}
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Optimization Strategies */}
            {showSuggestions && !optimizationLoading && optimizationSuggestions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="h-5 w-5 text-blue-500" />
                    <span>Smart Popular Group Strategies</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {optimizationSuggestions.map((suggestion, index) => (
                      <div key={index} className="p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20" data-testid={`card-optimization-${index}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <BarChart3 className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-sm">
                              {suggestion.description}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {suggestion.coverage.toFixed(0)}% coverage
                            </Badge>
                            <Badge variant="secondary" className="text-xs font-bold text-green-700">
                              ${suggestion.totalSavings.toFixed(2)} savings
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 gap-2">
                            {(expandedStrategies.has(index) ? suggestion.userGroups : suggestion.userGroups.slice(0, 2)).map((userGroup, groupIndex) => {
                              const collectionProgress = Math.min(((userGroup.participantCount || 0) / 5) * 100, 100);
                              const discountsActive = (userGroup.participantCount || 0) >= 5;
                              
                              return (
                                <div key={userGroup.id} className="flex items-center justify-between text-xs bg-white dark:bg-gray-800 p-3 rounded">
                                  <div className="flex-1">
                                    <span className="font-medium">{userGroup.name}</span>
                                    <div className="flex items-center space-x-3 mt-1">
                                      <span className="text-gray-600 dark:text-gray-400">
                                        {userGroup.participantCount || 0}/5 members
                                      </span>
                                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                                        <div 
                                          className="bg-gradient-to-r from-purple-500 to-pink-500 h-1 rounded-full"
                                          style={{ width: `${collectionProgress}%` }}
                                        />
                                      </div>
                                      <span className={`text-xs ${discountsActive ? 'text-green-600' : 'text-orange-600'}`}>
                                        {discountsActive ? 'Active' : 'Pending'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {suggestion.userGroups.length > 2 && !expandedStrategies.has(index) && (
                              <button 
                                onClick={() => setExpandedStrategies(prev => new Set([...Array.from(prev), index]))}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline text-center py-1"
                              >
                                +{suggestion.userGroups.length - 2} more popular groups
                              </button>
                            )}
                            {suggestion.userGroups.length > 2 && expandedStrategies.has(index) && (
                              <button 
                                onClick={() => setExpandedStrategies(prev => { const newSet = new Set(prev); newSet.delete(index); return newSet; })}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline text-center py-1"
                              >
                                Show less
                              </button>
                            )}
                          </div>
                          
                          {suggestion.uncoveredProducts.length > 0 && (
                            <div className="text-xs text-orange-600 dark:text-orange-400">
                              {suggestion.uncoveredProducts.length} item{suggestion.uncoveredProducts.length !== 1 ? 's' : ''} will remain individual purchases
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-3 flex justify-end">
                          <Button 
                            size="sm" 
                            className="text-xs" 
                            onClick={() => applyOptimizationStrategy.mutate(suggestion.userGroups.map(ug => ug.id))}
                            disabled={applyOptimizationStrategy.isPending}
                            data-testid={`button-apply-optimization-${index}`}
                          >
                            {applyOptimizationStrategy.isPending ? "Joining..." : "Apply Strategy"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No suggestions message */}
            {showSuggestions && !groupsLoading && !optimizationLoading && similarGroups.length === 0 && optimizationSuggestions.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Matching Popular Groups Found</h3>
                  <p className="text-muted-foreground text-sm mb-2">
                    No existing popular groups match the products in your cart. Create your own popular group to get others to join!
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Other users will be able to discover and join your popular group for group discounts.
                  </p>
                  <div className="mt-4 space-x-2">
                    <Link href="/browse">
                      <Button variant="outline" size="sm" data-testid="button-browse-collections">
                        Browse Popular Groups
                      </Button>
                    </Link>
                    <Link href="/my-groups">
                      <Button variant="outline" size="sm" data-testid="button-view-my-groups">
                        My Popular Groups
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <Link href="/browse">
                <Button variant="outline" className="w-full" data-testid="button-continue-shopping">
                  Continue Shopping
                </Button>
              </Link>
              <Button 
                className="w-full" 
                size="lg" 
                data-testid="button-checkout"
                onClick={handleCheckout}
                disabled={cartItems.length === 0}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Checkout Individual Items
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Popular Group Dialog */}
      <Dialog open={showCreateCollection} onOpenChange={setShowCreateCollection}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Your Popular Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="collection-name">Popular Group Name</Label>
              <Input
                id="collection-name"
                placeholder="e.g., My Wellness Bundle"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                data-testid="input-collection-name"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              This will create a public popular group with all {cartItems.length} items from your cart. 
              Other users can discover and join your popular group to get group discounts together.
            </div>
          </div>
          <DialogFooter className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setShowCreateCollection(false)}
              data-testid="button-cancel-collection"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => createCollectionFromCart.mutate(collectionName)}
              disabled={!collectionName.trim() || createCollectionFromCart.isPending}
              data-testid="button-confirm-create-collection"
            >
              {createCollectionFromCart.isPending ? "Creating..." : "Create Popular Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}