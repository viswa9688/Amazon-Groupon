import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, TrendingUp } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import CategoryConflictDialog from "./CategoryConflictDialog";

interface SimpleProductCardProps {
  product: {
    id: number;
    name: string;
    description: string;
    originalPrice: string;
    imageUrl: string;
    discountTiers?: Array<{
      id: number;
      participantCount: number;
      finalPrice: string;
    }>;
    seller: {
      id: string;
      firstName: string;
      lastName: string;
    };
    category: {
      id: number;
      name: string;
    };
  };
  testId?: string;
}

export default function SimpleProductCard({ product, testId }: SimpleProductCardProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [categoryConflictOpen, setCategoryConflictOpen] = useState(false);
  const [conflictingCategory, setConflictingCategory] = useState<string>("");
  
  // Calculate discount if available
  const discountedPrice = product.discountTiers?.[0]?.finalPrice;
  const hasDiscount = discountedPrice && parseFloat(discountedPrice) < parseFloat(product.originalPrice);
  const discountPercentage = hasDiscount 
    ? Math.round((1 - parseFloat(discountedPrice) / parseFloat(product.originalPrice)) * 100)
    : 0;

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

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/cart", { 
        productId: product.id, 
        quantity: 1 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Added to Cart",
        description: `${product.name} has been added to your cart`,
      });
    },
    onError: (error: any) => {
      // Check if it's a category conflict error
      if (error?.categoryConflict) {
        const currentCartCategory = error.currentCategory || "unknown";
        setConflictingCategory(currentCartCategory);
        setCategoryConflictOpen(true);
        // Also show toast with the specific message
        toast({
          title: "Cannot Mix Categories",
          description: "We can't club services and groceries together. Please add them separately to cart.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error?.error || "Failed to add item to cart. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      // Preserve current page for post-login redirect
      const currentPath = window.location.pathname + window.location.search;
      const redirectUrl = `/api/login?redirect=${encodeURIComponent(currentPath)}`;
      window.location.href = redirectUrl;
      return;
    }
    addToCartMutation.mutate();
  };

  return (
    <>
    <Card 
      className="overflow-hidden hover:shadow-xl transition-all duration-300 group cursor-pointer" 
      data-testid={testId}
      onClick={() => window.location.href = `/product/${product.id}`}
    >
      <div className="relative overflow-hidden">
        <img 
          src={product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400"} 
          alt={product.name}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          data-testid={`img-product-${product.id}`}
        />
        {hasDiscount && (
          <Badge className="absolute top-2 right-2 bg-red-500 text-white">
            -{discountPercentage}%
          </Badge>
        )}
        <Badge className="absolute top-2 left-2 bg-white/90 text-gray-700">
          {product.category.name}
        </Badge>
      </div>
      
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg text-foreground line-clamp-2 mb-2" data-testid={`text-product-name-${product.id}`}>
          {product.name}
        </h3>
        
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {product.description}
        </p>
        
        {/* Pricing */}
        <div className="flex items-center justify-between mb-3">
          <div>
            {hasDiscount ? (
              <>
                <span className="text-xl font-bold text-green-600" data-testid={`text-discount-price-${product.id}`}>
                  ${discountedPrice}
                </span>
                <span className="text-sm text-muted-foreground line-through ml-2">
                  ${product.originalPrice}
                </span>
              </>
            ) : (
              <span className="text-xl font-bold text-foreground" data-testid={`text-price-${product.id}`}>
                ${product.originalPrice}
              </span>
            )}
          </div>
          {hasDiscount && (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              <TrendingUp className="w-3 h-3 mr-1" />
              Save ${(parseFloat(product.originalPrice) - parseFloat(discountedPrice)).toFixed(2)}
            </Badge>
          )}
        </div>
        
        {/* Seller info */}
        <p className="text-xs text-muted-foreground mb-3">
          Sold by {product.seller.firstName} {product.seller.lastName}
        </p>
        
        {/* Add to Cart Button */}
        <Button 
          className="w-full"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleAddToCart();
          }}
          disabled={addToCartMutation.isPending}
          data-testid={`button-add-to-cart-${product.id}`}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          {addToCartMutation.isPending ? "Adding..." : "Add to Cart"}
        </Button>
      </CardContent>
    </Card>
    
    <CategoryConflictDialog
      open={categoryConflictOpen}
      onOpenChange={setCategoryConflictOpen}
      currentCategory={conflictingCategory}
      attemptedCategory={product.category.name}
      onClearCart={() => clearCartMutation.mutate()}
    />
    </>
  );
}