import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import GroupProgress from "./GroupProgress";
import CountdownTimer from "./CountdownTimer";
import type { GroupPurchaseWithDetails } from "@shared/schema";

interface ProductCardProps {
  groupPurchase: GroupPurchaseWithDetails;
}

export default function ProductCard({ groupPurchase }: ProductCardProps) {
  const { product } = groupPurchase;
  const isComplete = (groupPurchase.currentParticipants || 0) >= groupPurchase.targetParticipants;
  const savingsAmount = parseFloat(product.originalPrice.toString()) - parseFloat(groupPurchase.currentPrice.toString());

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-shadow" data-testid={`card-group-${groupPurchase.id}`}>
      <img 
        src={product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"} 
        alt={product.name}
        className="w-full h-48 object-cover cursor-pointer"
        onClick={() => window.location.href = `/product/${groupPurchase.id}`}
        data-testid={`img-product-${groupPurchase.id}`}
      />
      
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-lg text-card-foreground line-clamp-2" data-testid={`text-product-name-${groupPurchase.id}`}>
            {product.name}
          </h3>
          {groupPurchase.status === "active" && !isComplete ? (
            <div className="countdown-timer text-white px-2 py-1 rounded text-sm font-medium whitespace-nowrap">
              <CountdownTimer endTime={new Date(groupPurchase.endTime)} compact />
            </div>
          ) : isComplete ? (
            <div className="bg-accent text-accent-foreground px-2 py-1 rounded text-sm font-medium whitespace-nowrap">
              GOAL REACHED!
            </div>
          ) : (
            <div className="bg-muted text-muted-foreground px-2 py-1 rounded text-sm font-medium whitespace-nowrap">
              ENDED
            </div>
          )}
        </div>
        
        <div className="space-y-4">
          {/* Pricing */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-accent" data-testid={`text-current-price-${groupPurchase.id}`}>
                ${groupPurchase.currentPrice}
              </span>
              <span className="text-muted-foreground line-through ml-2">
                ${product.originalPrice}
              </span>
            </div>
            <div className="text-accent font-semibold">
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
          <Button 
            className={`w-full ${isComplete 
              ? "bg-accent hover:bg-accent/90 text-accent-foreground" 
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
            onClick={() => window.location.href = `/product/${groupPurchase.id}`}
            data-testid={`button-view-product-${groupPurchase.id}`}
          >
            {isComplete ? "Get Maximum Discount" : "Join Group Purchase"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
