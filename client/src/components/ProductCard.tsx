import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import GroupProgress from "./GroupProgress";
import CountdownTimer from "./CountdownTimer";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle } from "lucide-react";
import type { GroupPurchaseWithDetails } from "@shared/schema";

interface ProductCardProps {
  groupPurchase: GroupPurchaseWithDetails;
}

export default function ProductCard({ groupPurchase }: ProductCardProps) {
  const { product } = groupPurchase;
  const { isAuthenticated } = useAuth();
  const isComplete = (groupPurchase.currentParticipants || 0) >= groupPurchase.targetParticipants;
  
  // Check if user is participating in this group purchase
  const { data: participation } = useQuery<{ isParticipating: boolean; participation: any }>({
    queryKey: ["/api/group-purchases", groupPurchase.id, "participation"],
    enabled: !!groupPurchase.id && isAuthenticated,
  });
  
  const isUserParticipant = participation?.isParticipating || false;
  
  // Show seller's intended discount price immediately if set, otherwise show current price
  const displayPrice = product.discountTiers && product.discountTiers.length > 0 
    ? product.discountTiers[0].finalPrice.toString()
    : groupPurchase.currentPrice.toString();
  
  const savingsAmount = parseFloat(product.originalPrice.toString()) - parseFloat(displayPrice);

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group" data-testid={`card-group-${groupPurchase.id}`}>
      <div className="relative overflow-hidden">
        <img 
          src={product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"} 
          alt={product.name}
          className="w-full h-48 sm:h-52 object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
          onClick={() => window.location.href = `/product/${groupPurchase.id}`}
          data-testid={`img-product-${groupPurchase.id}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
          <h3 className="font-semibold text-lg sm:text-xl text-card-foreground line-clamp-2 flex-1" data-testid={`text-product-name-${groupPurchase.id}`}>
            {product.name}
          </h3>
          {groupPurchase.status === "active" && !isComplete ? (
            <div className="countdown-timer text-white px-3 py-1 rounded-lg text-sm font-medium whitespace-nowrap self-start">
              <CountdownTimer endTime={new Date(groupPurchase.endTime)} compact />
            </div>
          ) : isComplete ? (
            <div className="bg-gradient-to-r from-accent to-accent/80 text-accent-foreground px-3 py-1 rounded-lg text-sm font-medium whitespace-nowrap self-start shadow-sm">
              GOAL REACHED!
            </div>
          ) : (
            <div className="bg-muted text-muted-foreground px-3 py-1 rounded-lg text-sm font-medium whitespace-nowrap self-start">
              ENDED
            </div>
          )}
        </div>
        
        <div className="space-y-4">
          {/* Pricing */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-accent" data-testid={`text-current-price-${groupPurchase.id}`}>
                ${displayPrice}
              </span>
              <span className="text-muted-foreground line-through text-lg">
                ${product.originalPrice}
              </span>
            </div>
            <div className="text-accent font-semibold text-sm sm:text-base">
              Save ${savingsAmount.toFixed(2)}
            </div>
          </div>
          
          {/* Group Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground" data-testid={`text-progress-${groupPurchase.id}`}>
                Progress: {groupPurchase.currentParticipants}/{groupPurchase.targetParticipants} people
              </span>
              <span className="text-accent font-medium">
                {Math.round(((groupPurchase.currentParticipants || 0) / groupPurchase.targetParticipants) * 100)}%
              </span>
            </div>
            <GroupProgress
              current={groupPurchase.currentParticipants || 0}
              target={groupPurchase.targetParticipants}
            />
            <p className="text-sm text-muted-foreground">
              {isComplete ? (
                <span className="text-accent font-medium">Maximum discount unlocked!</span>
              ) : (
                <span>
                  {groupPurchase.targetParticipants - (groupPurchase.currentParticipants || 0)} more people for next discount tier!
                </span>
              )}
            </p>
          </div>
          
          {/* Action Button */}
          {isUserParticipant ? (
            <div className="text-center p-4 bg-gradient-to-r from-accent/10 to-accent/5 rounded-xl border border-accent/20">
              <div className="flex items-center justify-center space-x-2 text-accent font-medium">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm sm:text-base">You're in this group! 🎉</span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                Check your orders for updates
              </p>
            </div>
          ) : (
            <Button 
              className={`w-full h-12 sm:h-11 ${isComplete 
                ? "bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-accent-foreground shadow-lg" 
                : "bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-primary-foreground shadow-lg"
              }`}
              onClick={() => window.location.href = `/product/${groupPurchase.id}`}
              data-testid={`button-view-product-${groupPurchase.id}`}
            >
              <span className="text-sm sm:text-base font-medium">
                {isComplete ? "Get Maximum Discount" : "Join Group Purchase"}
              </span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
