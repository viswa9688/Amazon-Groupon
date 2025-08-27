import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Users, Clock, CheckCircle, Package } from "lucide-react";
import GroupProgress from "@/components/GroupProgress";
import CountdownTimer from "@/components/CountdownTimer";
import type { GroupPurchaseWithDetails } from "@shared/schema";

export default function MyGroups() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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
  }, [isAuthenticated, authLoading, toast]);

  // Get all group purchases
  const { data: allGroupPurchases, isLoading: groupsLoading } = useQuery<GroupPurchaseWithDetails[]>({
    queryKey: ["/api/group-purchases"],
    enabled: isAuthenticated,
  });

  // Filter group purchases where user is participating
  const myGroupPurchases = allGroupPurchases?.filter(gp => {
    return gp.participants?.some(participant => participant.userId === user?.id);
  }) || [];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-my-groups-title">
              My Groups
            </h1>
            <p className="text-muted-foreground">
              Track all the group purchases you've joined
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground" data-testid="text-total-groups">
                {myGroupPurchases.length}
              </p>
              <p className="text-sm text-muted-foreground">Groups Joined</p>
            </div>
          </div>
        </div>

        {groupsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : myGroupPurchases.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-4">No Groups Joined Yet</h2>
            <p className="text-muted-foreground mb-6">
              You haven't joined any group purchases yet. Browse products and join groups to get better prices!
            </p>
            <Button onClick={() => window.location.href = '/browse'} data-testid="button-browse-products">
              Browse Products
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myGroupPurchases.map((groupPurchase) => {
              const { product } = groupPurchase;
              const isComplete = (groupPurchase.currentParticipants || 0) >= groupPurchase.targetParticipants;
              
              // Show seller's intended discount price immediately if set
              const displayPrice = product.discountTiers && product.discountTiers.length > 0 
                ? product.discountTiers[0].finalPrice.toString()
                : groupPurchase.currentPrice.toString();
              
              const savingsAmount = parseFloat(product.originalPrice.toString()) - parseFloat(displayPrice);

              return (
                <Card key={groupPurchase.id} className="overflow-hidden hover:shadow-xl transition-shadow" data-testid={`card-my-group-${groupPurchase.id}`}>
                  <img 
                    src={product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"} 
                    alt={product.name}
                    className="w-full h-48 object-cover cursor-pointer"
                    onClick={() => window.location.href = `/product/${groupPurchase.id}`}
                    data-testid={`img-group-product-${groupPurchase.id}`}
                  />
                  
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-lg text-card-foreground line-clamp-2" data-testid={`text-group-product-name-${groupPurchase.id}`}>
                        {product.name}
                      </h3>
                      {groupPurchase.status === "active" && !isComplete ? (
                        <div className="countdown-timer text-white px-2 py-1 rounded text-sm font-medium whitespace-nowrap">
                          <CountdownTimer endTime={new Date(groupPurchase.endTime)} compact />
                        </div>
                      ) : isComplete ? (
                        <Badge variant="default" className="bg-accent text-accent-foreground">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Goal Reached
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Ended
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-4">
                      {/* Pricing */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-2xl font-bold text-accent" data-testid={`text-group-current-price-${groupPurchase.id}`}>
                            ${displayPrice}
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
                          <span className="text-muted-foreground" data-testid={`text-group-progress-${groupPurchase.id}`}>
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
                              {groupPurchase.targetParticipants - (groupPurchase.currentParticipants || 0)} more people needed
                            </span>
                          )}
                        </p>
                      </div>
                      
                      {/* Participation Status */}
                      <div className="text-center p-3 bg-accent/10 rounded-lg border border-accent/20">
                        <div className="flex items-center justify-center space-x-2 text-accent font-medium">
                          <CheckCircle className="w-5 h-5" />
                          <span>You're in this group!</span>
                        </div>
                      </div>
                      
                      {/* Action Button */}
                      <Button 
                        className="w-full"
                        onClick={() => window.location.href = `/product/${groupPurchase.id}`}
                        data-testid={`button-view-group-${groupPurchase.id}`}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}