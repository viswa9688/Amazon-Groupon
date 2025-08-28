import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
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
import { ArrowLeft, Users, Clock, Star } from "lucide-react";
import type { GroupPurchaseWithDetails } from "@shared/schema";

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [, navigate] = useLocation();

  const { data: groupPurchase, isLoading } = useQuery<GroupPurchaseWithDetails>({
    queryKey: ["/api/group-purchases", id],
    enabled: !!id,
  });

  const { data: participation } = useQuery<{ isParticipating: boolean; participation: any }>({
    queryKey: ["/api/group-purchases", id, "participation"],
    enabled: !!id && isAuthenticated,
  });

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

  if (!groupPurchase) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-foreground mb-4">Product Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The group purchase you're looking for doesn't exist or has ended.
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

  const { product } = groupPurchase;
  const isUserParticipant = participation?.isParticipating || false;
  
  // Show seller's intended discount price immediately if set, otherwise show current price
  const displayPrice = product.discountTiers && product.discountTiers.length > 0 
    ? product.discountTiers[0].finalPrice.toString()
    : groupPurchase.currentPrice.toString();
  
  const currentDiscount = parseFloat(product.originalPrice.toString()) - parseFloat(displayPrice);

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
                <Badge variant={groupPurchase.status === "active" ? "default" : "secondary"}>
                  {groupPurchase.status === "active" ? "Active" : "Ended"}
                </Badge>
              </div>
              
              <p className="text-muted-foreground text-lg mb-6" data-testid="text-product-description">
                {product.description || "Experience premium quality with this amazing product. Join the group purchase to unlock incredible savings!"}
              </p>

              {/* Pricing */}
              <div className="bg-muted/30 p-6 rounded-lg mb-6">
                <div>
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
                  <p className="text-sm text-muted-foreground">Group discount available! Join now to get this great price!</p>
                </div>
              </div>
            </div>

            {/* Group Progress */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Group Progress</h3>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span data-testid="text-participant-count">
                      {groupPurchase.currentParticipants || 0} of {groupPurchase.targetParticipants} people
                    </span>
                  </div>
                </div>
                
                <GroupProgress
                  current={groupPurchase.currentParticipants || 0}
                  target={groupPurchase.targetParticipants}
                />
                
                <div className="mt-4 text-sm text-muted-foreground">
                  {groupPurchase.targetParticipants - (groupPurchase.currentParticipants || 0) > 0 ? (
                    <span>
                      {groupPurchase.targetParticipants - (groupPurchase.currentParticipants || 0)} more people needed to reach the goal!
                    </span>
                  ) : (
                    <span className="text-accent font-medium">Goal reached! Maximum discount unlocked!</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Countdown Timer */}
            {groupPurchase.status === "active" && (
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

            {/* Action Buttons */}
            <div className="space-y-4">
              {!isAuthenticated ? (
                <div className="space-y-3">
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
                </div>
              ) : isUserParticipant ? (
                <div className="space-y-4">
                  <div className="text-center p-4 bg-accent/10 rounded-lg">
                    <p className="text-accent font-semibold">✓ You're part of this group!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Check your orders to track the purchase progress.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <Button 
                      size="lg" 
                      className="w-full bg-primary hover:bg-primary/90"
                      onClick={() => navigate(`/checkout/${groupPurchase.productId}/group`)}
                      data-testid="button-pay-group"
                    >
                      Pay for Group Purchase - ${displayPrice}
                    </Button>
                    
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
              ) : groupPurchase.status === "active" ? (
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
                  
                  <Button 
                    size="lg" 
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/checkout/${groupPurchase.productId}/individual`)}
                    disabled={false}
                    data-testid="button-buy-individual"
                  >
                    Buy Individual - ${product.originalPrice}
                  </Button>
                  
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
                    onClick={() => navigate(`/checkout/${groupPurchase.productId}/individual`)}
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
    </div>
  );
}
