import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Package, Share2, Users, TrendingUp, DollarSign, Crown, ShoppingCart, UserPlus, UserMinus, LogIn } from "lucide-react";
import type { UserGroupWithDetails } from "@shared/schema";

export default function SharedGroupPage() {
  const { shareToken } = useParams();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get shared group details
  const { data: sharedGroup, isLoading, error } = useQuery<UserGroupWithDetails>({
    queryKey: ["/api/shared", shareToken],
    enabled: !!shareToken,
  });

  // Check if user is participating in this collection
  const { data: participationData } = useQuery({
    queryKey: ["/api/user-groups", sharedGroup?.id, "participation"],
    enabled: isAuthenticated && !!sharedGroup?.id,
  });

  const isParticipating = (participationData as any)?.isParticipating || false;

  // Mutation for joining collection
  const joinMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/user-groups/${sharedGroup?.id}/join`);
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "You've joined this collection. You're now part of all group purchases!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", sharedGroup?.id, "participation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shared", shareToken] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to join",
        description: error.message || "Unable to join this collection",
        variant: "destructive",
      });
    },
  });

  // Mutation for leaving collection
  const leaveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/user-groups/${sharedGroup?.id}/leave`);
    },
    onSuccess: () => {
      toast({
        title: "Left collection",
        description: "You've left this collection and all its group purchases",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", sharedGroup?.id, "participation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shared", shareToken] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to leave",
        description: error.message || "Unable to leave this collection",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-64 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
            <div className="space-y-4">
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !sharedGroup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-4">Collection Not Found</h2>
            <p className="text-muted-foreground mb-6">
              This collection doesn't exist, is private, or the link has expired.
            </p>
            <Button onClick={() => window.location.href = '/browse'} data-testid="button-browse-products">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Browse Products
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const totalItems = sharedGroup.items?.length || 0;
  const totalValue = sharedGroup.items?.reduce((sum, item) => {
    return sum + (parseFloat(item.product.originalPrice.toString()) * item.quantity);
  }, 0) || 0;
  
  const potentialSavings = sharedGroup.items?.reduce((sum, item) => {
    const discountPrice = item.product.discountTiers?.[0]?.finalPrice || item.product.originalPrice;
    const savings = (parseFloat(item.product.originalPrice.toString()) - parseFloat(discountPrice.toString())) * item.quantity;
    return sum + savings;
  }, 0) || 0;

  // Use collection-level participant count
  const collectionParticipants = sharedGroup.participantCount || 0;
  
  // Collection-level progress - 5 people needed for discount activation
  const collectionProgress = Math.min((collectionParticipants / 5) * 100, 100);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (err) {
      // Fallback for older browsers
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
      <Header />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl opacity-5"></div>
          <div className="relative p-8 rounded-3xl border border-blue-200/50 dark:border-blue-800/50 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                    <Share2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-foreground" data-testid="text-shared-group-name">
                      {sharedGroup.name}
                    </h1>
                    <div className="flex items-center space-x-3 mt-1">
                      <Badge variant="default" className="flex items-center space-x-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        <Users className="w-3 h-3" />
                        <span>Shared Collection</span>
                      </Badge>
                    </div>
                  </div>
                </div>
                {sharedGroup.description && (
                  <p className="text-muted-foreground max-w-2xl" data-testid="text-shared-group-description">
                    {sharedGroup.description}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Shared by someone in the OneAnt community • Created {sharedGroup.createdAt ? new Date(sharedGroup.createdAt).toLocaleDateString() : 'Unknown'}
                </p>
              </div>
              
              <div className="flex flex-col gap-3">
                {!isAuthenticated ? (
                  <Button 
                    onClick={() => window.location.href = '/api/login'}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    data-testid="button-login-to-join"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In to Join
                  </Button>
                ) : isParticipating ? (
                  <Button 
                    variant="outline" 
                    onClick={() => leaveMutation.mutate()}
                    disabled={leaveMutation.isPending}
                    className="border-red-200 hover:bg-red-50 text-red-600 dark:border-red-800 dark:hover:bg-red-900/20"
                    data-testid="button-leave-collection"
                  >
                    <UserMinus className="w-4 h-4 mr-2" />
                    {leaveMutation.isPending ? 'Leaving...' : 'Leave Collection'}
                  </Button>
                ) : (
                  <Button 
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending}
                    className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white"
                    data-testid="button-join-collection"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {joinMutation.isPending ? 'Joining...' : 'Join Collection'}
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={handleShare}
                  className="border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/20"
                  data-testid="button-share-collection"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share This Collection
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Items Section */}
            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  <span>Collection Items ({totalItems})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {totalItems === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">Empty Collection</h3>
                    <p className="text-muted-foreground">
                      This collection doesn't contain any items yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sharedGroup.items.map((item) => {
                      const originalPrice = parseFloat(item.product.originalPrice.toString());
                      const discountPrice = item.product.discountTiers?.[0]?.finalPrice 
                        ? parseFloat(item.product.discountTiers[0].finalPrice.toString())
                        : originalPrice;
                      const savings = (originalPrice - discountPrice) * item.quantity;
                      const isDiscounted = savings > 0;
                      
                      return (
                        <div 
                          key={item.id} 
                          className="flex items-center space-x-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => window.location.href = `/product/${item.product.groupPurchases?.[0]?.id || item.product.id}`}
                          data-testid={`shared-item-${item.id}`}
                        >
                          <img 
                            src={item.product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&h=80"} 
                            alt={item.product.name}
                            className="w-16 h-16 object-cover rounded-lg"
                            data-testid={`img-shared-product-${item.product.id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground truncate" data-testid={`text-shared-product-name-${item.product.id}`}>
                              {item.product.name}
                            </h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                ${discountPrice.toFixed(2)}
                              </span>
                              {isDiscounted && (
                                <>
                                  <span className="text-sm text-muted-foreground line-through">
                                    ${originalPrice.toFixed(2)}
                                  </span>
                                  <Badge variant="outline" className="text-green-600 border-green-300">
                                    Save ${savings.toFixed(2)}
                                  </Badge>
                                </>
                              )}
                            </div>
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground">
                                Bundle item #{sharedGroup.items.indexOf(item) + 1}
                              </p>
                            </div>
                          </div>
                          
                          {/* Quantity Display */}
                          <div className="text-center">
                            <span className="text-lg font-semibold text-blue-600 dark:text-blue-400" data-testid={`text-shared-quantity-${item.product.id}`}>
                              ×{item.quantity}
                            </span>
                            <p className="text-xs text-muted-foreground">Suggested qty</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Statistics Sidebar */}
          <div className="space-y-6">
            {/* Collection Stats */}
            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <span>Collection Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-shared-total-items">
                      {totalItems}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Items</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-shared-collection-participants">
                      {collectionParticipants}
                    </p>
                    <p className="text-sm text-muted-foreground">Collection Members</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400" data-testid="text-shared-total-value">
                      ${totalValue.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">Collection Value</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-shared-potential-savings">
                      ${potentialSavings.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">Potential Savings</p>
                  </div>
                  <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400" data-testid="text-shared-collection-progress">
                      {collectionProgress.toFixed(0)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Discount Progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Collection Progress */}
            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span>Collection Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">
                    {collectionParticipants} / 5 members
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {collectionParticipants >= 5 
                      ? "Discounts active! 🎉" 
                      : `${5 - collectionParticipants} more needed for discounts`}
                  </p>
                </div>
                
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${collectionProgress}%` }}
                  />
                </div>
                
                <div className="text-center text-xs text-muted-foreground">
                  {collectionProgress.toFixed(0)}% complete
                </div>
              </CardContent>
            </Card>

            {/* Call to Action */}
            <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0 shadow-lg">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold">Join OneAnt</h3>
                <p className="text-blue-100 text-sm">
                  Create your own collections and unlock group discounts with other members.
                </p>
                <Button 
                  className="w-full bg-white text-blue-600 hover:bg-blue-50"
                  onClick={() => window.location.href = '/browse'}
                  data-testid="button-join-oneant"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Start Shopping
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}