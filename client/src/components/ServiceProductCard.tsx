import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart, TrendingUp, MapPin, Clock, Shield, Star, 
  Users, Calendar, Briefcase, CheckCircle, Globe, User
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import CategoryConflictDialog from "./CategoryConflictDialog";
import PhoneAuthModal from "@/components/PhoneAuthModal";

interface ServiceProductCardProps {
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
    serviceProvider?: {
      id: number;
      displayName?: string;
      serviceCategory?: string;
      serviceMode?: string;
      locality?: string;
      region?: string;
      durationMinutes?: number;
      pricingModel?: string;
      materialsIncluded?: boolean;
      avgRating?: string;
      reviewCount?: number;
      yearsInBusiness?: number;
      rescheduleAllowed?: boolean;
    };
  };
  testId?: string;
}

export default function ServiceProductCard({ product, testId }: ServiceProductCardProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [categoryConflictOpen, setCategoryConflictOpen] = useState(false);
  const [conflictingCategory, setConflictingCategory] = useState<string>("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  
  // Calculate discount if available
  const discountedPrice = product.discountTiers?.[0]?.finalPrice;
  const hasDiscount = discountedPrice && parseFloat(discountedPrice) < parseFloat(product.originalPrice);
  const discountPercentage = hasDiscount 
    ? Math.round((1 - parseFloat(discountedPrice) / parseFloat(product.originalPrice)) * 100)
    : 0;

  const isService = product.category.id === 2;
  const sp = product.serviceProvider;

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
        title: isService ? "Service Added" : "Added to Cart",
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
      setAuthModalOpen(true);
      return;
    }
    addToCartMutation.mutate();
  };

  // Get pricing label based on pricing model
  const getPricingLabel = () => {
    if (!isService || !sp?.pricingModel) return "";
    switch (sp.pricingModel) {
      case "hourly": return "/hour";
      case "per_session": return "/session";
      case "subscription": return "/month";
      default: return "";
    }
  };

  // Get service mode icon and label
  const getServiceModeDisplay = () => {
    if (!sp?.serviceMode) return null;
    switch (sp.serviceMode) {
      case "online": 
        return { icon: Globe, label: "Online", color: "text-blue-600" };
      case "in_person": 
        return { icon: MapPin, label: "In-Person", color: "text-green-600" };
      case "hybrid": 
        return { icon: Users, label: "Hybrid", color: "text-purple-600" };
      default: 
        return null;
    }
  };

  const serviceModeDisplay = getServiceModeDisplay();

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
        
        {/* Service-specific badges */}
        {isService && sp && (
          <>
            {sp.avgRating && parseFloat(sp.avgRating) > 0 && (
              <Badge className="absolute bottom-2 left-2 bg-yellow-500 text-white">
                <Star className="w-3 h-3 mr-1 fill-current" />
                {parseFloat(sp.avgRating).toFixed(1)}
                {sp.reviewCount && sp.reviewCount > 0 && (
                  <span className="ml-1">({sp.reviewCount})</span>
                )}
              </Badge>
            )}
            {sp.yearsInBusiness && sp.yearsInBusiness > 0 && (
              <Badge className="absolute bottom-2 right-2 bg-gray-700 text-white">
                {sp.yearsInBusiness}+ years
              </Badge>
            )}
          </>
        )}
      </div>
      
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg text-foreground line-clamp-2 mb-2" data-testid={`text-product-name-${product.id}`}>
          {product.name}
        </h3>
        
        {/* Service Provider Name */}
        {isService && sp?.displayName && (
          <p className="text-sm font-medium text-primary mb-1">
            <Briefcase className="inline w-3 h-3 mr-1" />
            {sp.displayName}
          </p>
        )}
        
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {product.description}
        </p>
        
        {/* Service-specific info */}
        {isService && sp && (
          <div className="space-y-2 mb-3">
            {/* Service Mode */}
            {serviceModeDisplay && (
              <div className="flex items-center gap-2">
                <serviceModeDisplay.icon className={`w-4 h-4 ${serviceModeDisplay.color}`} />
                <span className="text-xs text-muted-foreground">{serviceModeDisplay.label}</span>
              </div>
            )}
            
            {/* Location */}
            {sp.locality && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-muted-foreground">
                  {sp.locality}{sp.region && `, ${sp.region}`}
                </span>
              </div>
            )}
            
            {/* Duration */}
            {sp.durationMinutes && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-muted-foreground">
                  {sp.durationMinutes < 60 
                    ? `${sp.durationMinutes} min` 
                    : `${Math.floor(sp.durationMinutes / 60)}h ${sp.durationMinutes % 60 > 0 ? `${sp.durationMinutes % 60}min` : ''}`}
                </span>
              </div>
            )}
            
            {/* Features */}
            <div className="flex flex-wrap gap-2">
              {sp.materialsIncluded && (
                <Badge variant="outline" className="text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Materials Included
                </Badge>
              )}
              {sp.rescheduleAllowed && (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="w-3 h-3 mr-1" />
                  Flexible Scheduling
                </Badge>
              )}
            </div>
          </div>
        )}
        
        {/* Pricing */}
        <div className="flex items-center justify-between mb-3">
          <div>
            {hasDiscount ? (
              <>
                <span className="text-xl font-bold text-green-600" data-testid={`text-discount-price-${product.id}`}>
                  ${discountedPrice}{getPricingLabel()}
                </span>
                <span className="text-sm text-muted-foreground line-through ml-2">
                  ${product.originalPrice}{getPricingLabel()}
                </span>
              </>
            ) : (
              <span className="text-xl font-bold text-foreground" data-testid={`text-price-${product.id}`}>
                ${product.originalPrice}{getPricingLabel()}
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
        
        {/* Seller/Provider info */}
        <p className="text-xs text-muted-foreground mb-3">
          {isService ? "Service by" : "Sold by"} {product.seller.firstName} {product.seller.lastName}
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
          {addToCartMutation.isPending 
            ? "Adding..." 
            : isService ? "Book Service" : "Add to Cart"}
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
    
    <PhoneAuthModal 
      open={authModalOpen}
      onClose={() => setAuthModalOpen(false)}
      onSuccess={() => {
        // After successful authentication, complete the add-to-cart action
        addToCartMutation.mutate();
      }}
    />
    </>
  );
}