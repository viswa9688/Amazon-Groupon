import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ShoppingCart, Plus, Minus, Trash2, Users, Target, TrendingDown, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

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
  groupPurchase: {
    id: number;
    product: {
      id: number;
      name: string;
      originalPrice: string;
    };
    currentPrice: string;
    currentParticipants: number;
    targetParticipants: number;
    endTime: string;
  };
  similarityScore: number;
  matchingProducts: number;
  totalCartProducts: number;
  potentialSavings: number;
}

export default function Cart() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [optimizing, setOptimizing] = useState(false);

  // Fetch cart items
  const { data: cartItems = [], isLoading: cartLoading } = useQuery<CartItem[]>({
    queryKey: ["/api/cart"],
    enabled: !!user,
  });

  // Fetch similar groups
  const { data: similarGroups = [], isLoading: groupsLoading } = useQuery<SimilarGroup[]>({
    queryKey: ["/api/cart/similar-groups"],
    enabled: !!user && cartItems.length > 0,
  });

  // Update cart item quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ cartItemId, quantity }: { cartItemId: number; quantity: number }) => {
      await apiRequest("PATCH", `/api/cart/${cartItemId}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart/similar-groups"] });
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Shopping Cart</h1>
            <p className="text-gray-600 dark:text-gray-400" data-testid="text-cart-items-count">
              {cartItems.length} item{cartItems.length !== 1 ? 's' : ''} in your cart
            </p>
          </div>
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
                      {item.product.groupPurchases.length > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <Users className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                              Active Group Purchase
                            </span>
                          </div>
                          {item.product.groupPurchases.map((group) => (
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
                  {similarGroups.length > 0 && (
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
                  {similarGroups.length > 0 && (
                    <div className="text-sm text-green-600 text-center">
                      Save ${calculatePotentialSavings().toFixed(2)} by joining groups!
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Group Matching Suggestions */}
            {!groupsLoading && similarGroups.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                    <span>Smart Group Suggestions</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {similarGroups.slice(0, 3).map((group, index) => (
                      <div key={group.groupPurchase.id} className="p-3 border rounded-lg" data-testid={`card-group-suggestion-${group.groupPurchase.id}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm" data-testid={`text-suggestion-product-${group.groupPurchase.id}`}>
                            {group.groupPurchase.product.name}
                          </h4>
                          <Badge variant="secondary">
                            {group.similarityScore.toFixed(0)}% match
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">
                              {group.groupPurchase.currentParticipants}/{group.groupPurchase.targetParticipants} people
                            </p>
                            <p className="font-bold text-green-600">
                              Save ${group.potentialSavings.toFixed(2)}
                            </p>
                          </div>
                          <Link href={`/product/${group.groupPurchase.product.id}`}>
                            <Button size="sm" variant="outline" data-testid={`button-join-group-${group.groupPurchase.id}`}>
                              Join Group
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
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
              <Button className="w-full" size="lg" data-testid="button-checkout">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Checkout Individual Items
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}