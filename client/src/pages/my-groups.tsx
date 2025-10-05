import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError, redirectToLogin } from "@/lib/authUtils";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Users, Clock, CheckCircle, Package, Plus, Share2, Edit, Trash2, ShoppingCart, Crown, Zap, Eye, AlertCircle } from "lucide-react";
import GroupProgress from "@/components/GroupProgress";
import CountdownTimer from "@/components/CountdownTimer";
import type { GroupPurchaseWithDetails, UserGroupWithDetails, InsertUserGroup } from "@shared/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Form schema for creating user groups
const createGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(255, "Name too long"),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export default function MyGroups() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showMinimumOrderError, setShowMinimumOrderError] = useState(false);

  const MINIMUM_ORDER_VALUE = 50;

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

  // Get user-created groups (owned groups)
  const { data: userGroups, isLoading: userGroupsLoading } = useQuery<UserGroupWithDetails[]>({
    queryKey: ["/api/user-groups"],
    enabled: isAuthenticated,
  });

  // Get user-joined groups (participant groups)
  const { data: joinedGroups, isLoading: joinedGroupsLoading } = useQuery<UserGroupWithDetails[]>({
    queryKey: ["/api/user-groups/joined"],
    enabled: isAuthenticated,
  });

  // Get cart items to check minimum order value
  const { data: cartItems = [] } = useQuery<any[]>({
    queryKey: ["/api/cart"],
    enabled: isAuthenticated,
  });

  // Calculate cart total
  const cartTotal = cartItems.reduce((sum, item) => {
    const price = parseFloat(item.product?.originalPrice || 0);
    return sum + (price * item.quantity);
  }, 0);

  // Filter group purchases where user is participating
  const myGroupPurchases = allGroupPurchases?.filter(gp => {
    return gp.participants?.some(participant => participant.userId === user?.id);
  }) || [];

  // Form for creating new groups
  const form = useForm<z.infer<typeof createGroupSchema>>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: "",
      description: "",
      isPublic: true,
    },
  });

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createGroupSchema>) => {
      return await apiRequest("POST", "/api/user-groups", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Group created successfully!",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          redirectToLogin();
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create group. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: number) => {
      return await apiRequest("DELETE", `/api/user-groups/${groupId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] });
      toast({
        title: "Success",
        description: "Group deleted successfully!",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          redirectToLogin();
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete group. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleShare = async (shareToken: string) => {
    const shareUrl = `${window.location.origin}/shared/${shareToken}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link Copied!",
        description: "Share link has been copied to your clipboard.",
      });
    } catch (err) {
      toast({
        title: "Share Link",
        description: shareUrl,
      });
    }
  };

  const handleCreateGroupClick = () => {
    if (cartTotal < MINIMUM_ORDER_VALUE) {
      setShowMinimumOrderError(true);
    } else {
      setIsCreateDialogOpen(true);
    }
  };

  // Auto-hide error when cart total reaches minimum
  useEffect(() => {
    if (showMinimumOrderError && cartTotal >= MINIMUM_ORDER_VALUE) {
      setShowMinimumOrderError(false);
    }
  }, [cartTotal, showMinimumOrderError]);

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
      <Header />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Premium Header */}
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl opacity-5"></div>
          <div className="relative p-8 rounded-3xl border border-blue-200/50 dark:border-blue-800/50 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6">
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent" data-testid="text-my-groups-title">
                    My Groups
                  </h1>
                </div>
                <p className="text-lg text-muted-foreground max-w-2xl">
                  Manage your group purchases and create custom popular groups to share with others
                </p>
              </div>
              
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-joined-groups-count">
                    {myGroupPurchases.length + (joinedGroups?.length || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Joined Groups</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400" data-testid="text-created-groups-count">
                    {userGroups?.length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Created Groups</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Minimum Order Error Alert */}
        {showMinimumOrderError && (
          <Alert variant="destructive" className="mb-6 border-red-500 bg-red-50 dark:bg-red-950/50" data-testid="alert-minimum-order-error">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="text-lg font-semibold">Minimum Order Value Required</AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <p className="text-base">
                To create a group, your cart must have a minimum value of <span className="font-bold">${MINIMUM_ORDER_VALUE.toFixed(2)}</span>.
              </p>
              <p className="text-sm">
                Current cart total: <span className="font-semibold">${cartTotal.toFixed(2)}</span>
              </p>
              <p className="text-sm">
                Please add <span className="font-bold text-red-700 dark:text-red-400">${(MINIMUM_ORDER_VALUE - cartTotal).toFixed(2)}</span> more to your cart to create a group.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-red-500 text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950"
                onClick={() => window.location.href = '/browse'}
                data-testid="button-browse-products"
              >
                Browse Products
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Premium Tabs */}
        <Tabs defaultValue="joined" className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <TabsList className="grid w-full sm:w-auto grid-cols-2 p-1 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
              <TabsTrigger value="joined" className="flex items-center space-x-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                <Users className="w-4 h-4" />
                <span>Joined Groups</span>
              </TabsTrigger>
              <TabsTrigger value="created" className="flex items-center space-x-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white">
                <Package className="w-4 h-4" />
                <span>My Groups</span>
              </TabsTrigger>
            </TabsList>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center space-x-2">
                    <Package className="w-5 h-5 text-purple-600" />
                    <span>Create New Group</span>
                  </DialogTitle>
                  <DialogDescription>
                    Create a custom group of products to share with others and track potential savings.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => createGroupMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Group Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Tech Essentials, Home Setup..." {...field} data-testid="input-group-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Describe your group..." {...field} data-testid="input-group-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={createGroupMutation.isPending} data-testid="button-submit-create-group">
                        {createGroupMutation.isPending ? "Creating..." : "Create Group"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Joined Groups Tab */}
          <TabsContent value="joined" className="space-y-6">
            {groupsLoading || joinedGroupsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-80 w-full rounded-2xl" />
                ))}
              </div>
            ) : myGroupPurchases.length === 0 && (!joinedGroups || joinedGroups.length === 0) ? (
              <div className="text-center py-20">
                <div className="mb-6">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-12 h-12 text-white" />
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-foreground mb-4">No Groups Joined Yet</h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
                  You haven't joined any group purchases yet. Browse products and join groups to unlock amazing discounts!
                </p>
                <Button 
                  size="lg" 
                  onClick={() => window.location.href = '/browse'} 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                  data-testid="button-browse-products"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Start Shopping
                </Button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Group Purchases Section */}
                {myGroupPurchases.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center space-x-2">
                      <Package className="w-5 h-5 text-blue-600" />
                      <span>Group Purchases</span>
                    </h3>
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
                    <Card key={groupPurchase.id} className="overflow-hidden hover:shadow-2xl transition-all duration-300 hover:scale-105 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg" data-testid={`card-my-group-${groupPurchase.id}`}>
                      <div className="relative">
                        <img 
                          src={product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"} 
                          alt={product.name}
                          className="w-full h-48 object-cover cursor-pointer"
                          onClick={() => window.location.href = `/product/${groupPurchase.id}`}
                          data-testid={`img-group-product-${groupPurchase.id}`}
                        />
                        {isComplete && (
                          <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center space-x-1">
                            <Crown className="w-4 h-4" />
                            <span>Max Discount!</span>
                          </div>
                        )}
                        {groupPurchase.status === "active" && !isComplete && (
                          <div className="absolute top-4 right-4 countdown-timer text-white px-3 py-1 rounded-full text-sm font-medium">
                            <CountdownTimer endTime={new Date(groupPurchase.endTime)} compact />
                          </div>
                        )}
                      </div>
                      
                      <CardContent className="p-6 space-y-4">
                        <h3 className="font-semibold text-xl text-card-foreground line-clamp-2" data-testid={`text-group-product-name-${groupPurchase.id}`}>
                          {product.name}
                        </h3>

                        {/* Pricing with premium styling */}
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl">
                          <div>
                            <span className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid={`text-group-current-price-${groupPurchase.id}`}>
                              ${displayPrice}
                            </span>
                            <span className="text-muted-foreground line-through ml-2 text-sm">
                              ${product.originalPrice}
                            </span>
                          </div>
                          <div className="text-green-600 dark:text-green-400 font-semibold bg-white dark:bg-gray-800 px-3 py-1 rounded-lg">
                            Save ${savingsAmount.toFixed(2)}
                          </div>
                        </div>
                        
                        {/* Group Progress with premium styling */}
                        <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground flex items-center space-x-1" data-testid={`text-group-progress-${groupPurchase.id}`}>
                              <Users className="w-4 h-4" />
                              <span>{groupPurchase.currentParticipants}/{groupPurchase.targetParticipants} people</span>
                            </span>
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                              {Math.round(((groupPurchase.currentParticipants || 0) / groupPurchase.targetParticipants) * 100)}%
                            </span>
                          </div>
                          <GroupProgress
                            current={groupPurchase.currentParticipants || 0}
                            target={groupPurchase.targetParticipants}
                          />
                        </div>
                        
                        {/* Status badge */}
                        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
                          <div className="flex items-center justify-center space-x-2 text-blue-600 dark:text-blue-400 font-medium">
                            <CheckCircle className="w-5 h-5" />
                            <span>You're participating!</span>
                          </div>
                        </div>
                        
                        {/* Action Button */}
                        <Button 
                          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                          onClick={() => window.location.href = `/product/${groupPurchase.id}`}
                          data-testid={`button-view-group-${groupPurchase.id}`}
                        >
                          <Package className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </CardContent>
                    </Card>
                  );
                      })}
                    </div>
                  </div>
                )}

                {/* Joined User Groups Section */}
                {joinedGroups && joinedGroups.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center space-x-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      <span>Joined Popular Groups</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {joinedGroups.map((userGroup) => {
                        const totalItems = userGroup.items?.length || 0;
                        const totalValue = userGroup.items?.reduce((sum, item) => {
                          return sum + (parseFloat(item.product.originalPrice.toString()) * item.quantity);
                        }, 0) || 0;
                        
                        // Check minimum order value requirement ($50 excluding delivery)
                        const MINIMUM_ORDER_VALUE = 50.00;
                        const orderValueExcludingDelivery = totalValue;
                        
                        const potentialSavings = (orderValueExcludingDelivery >= MINIMUM_ORDER_VALUE) 
                          ? userGroup.items?.reduce((sum, item) => {
                              const discountPrice = item.product.discountTiers?.[0]?.finalPrice || item.product.originalPrice;
                              const savings = (parseFloat(item.product.originalPrice.toString()) - parseFloat(discountPrice.toString())) * item.quantity;
                              return sum + savings;
                            }, 0) || 0
                          : 0;
                        
                        // Use collection-level participant count
                        const collectionParticipants = userGroup.participantCount || 0;
                        
                        // Popular group-level progress - 5 people needed for discount activation
                        const collectionProgress = Math.min((collectionParticipants / 5) * 100, 100);

                        return (
                          <Card key={userGroup.id} className="overflow-hidden hover:shadow-2xl transition-all duration-300 hover:scale-105 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg" data-testid={`card-joined-group-${userGroup.id}`}>
                            <CardHeader className="pb-3">
                              <div className="space-y-1">
                                <CardTitle className="text-xl font-bold text-card-foreground line-clamp-2" data-testid={`text-joined-group-name-${userGroup.id}`}>
                                  {userGroup.name}
                                </CardTitle>
                                {userGroup.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-joined-group-description-${userGroup.id}`}>
                                    {userGroup.description}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  Created by {userGroup.user?.firstName || 'Unknown'}
                                </p>
                              </div>
                            </CardHeader>
                            
                            <CardContent className="space-y-4">
                              {/* Popular Group Stats */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400" data-testid={`text-joined-group-items-count-${userGroup.id}`}>
                                    {totalItems}
                                  </p>
                                  <p className="text-sm text-muted-foreground">Items</p>
                                </div>
                                <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid={`text-joined-group-participants-count-${userGroup.id}`}>
                                    {collectionParticipants}
                                  </p>
                                  <p className="text-sm text-muted-foreground">Members</p>
                                </div>
                                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                  <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid={`text-joined-group-potential-savings-${userGroup.id}`}>
                                    ${potentialSavings.toFixed(0)}
                                  </p>
                                  <p className="text-sm text-muted-foreground">Potential Savings</p>
                                </div>
                                <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400" data-testid={`text-joined-group-collection-progress-${userGroup.id}`}>
                                    {collectionProgress.toFixed(0)}%
                                  </p>
                                  <p className="text-sm text-muted-foreground">Discount Progress</p>
                                </div>
                              </div>

                              {/* Popular Group Status */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                  <span>{collectionParticipants} / 5 members</span>
                                  <span>{collectionProgress.toFixed(0)}% complete</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                  <div 
                                    className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${collectionProgress}%` }}
                                  />
                                </div>
                                {collectionParticipants >= 5 ? (
                                  <p className="text-sm text-green-600 dark:text-green-400 font-medium text-center">
                                    Discounts active! 🎉
                                  </p>
                                ) : (
                                  <p className="text-sm text-muted-foreground text-center">
                                    {5 - collectionParticipants} more members needed for discounts
                                  </p>
                                )}
                              </div>

                              {/* Item Preview */}
                              {totalItems > 0 && (
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm text-muted-foreground">Items in collection:</h4>
                                  <div className="space-y-2">
                                    {userGroup.items.slice(0, 3).map((item) => (
                                      <div key={item.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg" data-testid={`joined-item-preview-${item.id}`}>
                                        <span className="text-card-foreground font-medium truncate">{item.product.name}</span>
                                        <span className="text-muted-foreground">×{item.quantity}</span>
                                      </div>
                                    ))}
                                    {totalItems > 3 && (
                                      <div className="text-center text-sm text-muted-foreground py-1">
                                        +{totalItems - 3} more items
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Action Button */}
                              <Button 
                                className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                                onClick={() => window.location.href = `/user-group/${userGroup.id}`}
                                data-testid={`button-view-joined-group-${userGroup.id}`}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Popular Group
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Created Groups Tab */}
          <TabsContent value="created" className="space-y-6">
            {userGroupsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-80 w-full rounded-2xl" />
                ))}
              </div>
            ) : !userGroups || userGroups.length === 0 ? (
              <div className="text-center py-20">
                <div className="mb-6">
                  <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package className="w-12 h-12 text-white" />
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-foreground mb-4">No Popular Groups Yet</h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
                  Create custom popular groups of products to share with friends and track potential group discounts.
                </p>
                <Button 
                  size="lg" 
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                  data-testid="button-create-first-group"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Your First Popular Group
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userGroups.map((userGroup) => {
                  const totalItems = userGroup.items?.length || 0;
                  const totalValue = userGroup.items?.reduce((sum, item) => {
                    return sum + (parseFloat(item.product.originalPrice.toString()) * item.quantity);
                  }, 0) || 0;
                  
                  // Check minimum order value requirement ($50 excluding delivery)
                  const MINIMUM_ORDER_VALUE = 50.00;
                  const orderValueExcludingDelivery = totalValue;
                  
                  const potentialSavings = (orderValueExcludingDelivery >= MINIMUM_ORDER_VALUE) 
                    ? userGroup.items?.reduce((sum, item) => {
                        const discountPrice = item.product.discountTiers?.[0]?.finalPrice || item.product.originalPrice;
                        const savings = (parseFloat(item.product.originalPrice.toString()) - parseFloat(discountPrice.toString())) * item.quantity;
                        return sum + savings;
                      }, 0) || 0
                    : 0;
                  
                  // Use collection-level participant count
                  const collectionParticipants = userGroup.participantCount || 0;
                  
                  // Popular group-level progress - 5 people needed for discount activation
                  const collectionProgress = Math.min((collectionParticipants / 5) * 100, 100);

                  return (
                    <Card key={userGroup.id} className="overflow-hidden hover:shadow-2xl transition-all duration-300 hover:scale-105 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg" data-testid={`card-user-group-${userGroup.id}`}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <CardTitle className="text-xl font-bold text-card-foreground line-clamp-2" data-testid={`text-user-group-name-${userGroup.id}`}>
                              {userGroup.name}
                            </CardTitle>
                            {userGroup.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-user-group-description-${userGroup.id}`}>
                                {userGroup.description}
                              </p>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleShare(userGroup.shareToken)}
                              className="border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/20"
                              data-testid={`button-share-group-${userGroup.id}`}
                            >
                              <Share2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => deleteGroupMutation.mutate(userGroup.id)}
                              disabled={deleteGroupMutation.isPending}
                              className="border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 text-red-600 hover:text-red-700"
                              data-testid={`button-delete-group-${userGroup.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        {/* Popular Group Stats */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400" data-testid={`text-group-items-count-${userGroup.id}`}>
                              {totalItems}
                            </p>
                            <p className="text-sm text-muted-foreground">Items</p>
                          </div>
                          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid={`text-group-participants-count-${userGroup.id}`}>
                              {collectionParticipants}
                            </p>
                            <p className="text-sm text-muted-foreground">Members</p>
                          </div>
                          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid={`text-group-potential-savings-${userGroup.id}`}>
                              ${potentialSavings.toFixed(0)}
                            </p>
                            <p className="text-sm text-muted-foreground">Potential Savings</p>
                          </div>
                          <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400" data-testid={`text-group-collection-progress-${userGroup.id}`}>
                              {collectionProgress.toFixed(0)}%
                            </p>
                            <p className="text-sm text-muted-foreground">Discount Progress</p>
                          </div>
                        </div>

                        {/* Popular Group Status */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{collectionParticipants} / 5 members</span>
                            <span>{collectionProgress.toFixed(0)}% complete</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${collectionProgress}%` }}
                            />
                          </div>
                          {collectionParticipants >= 5 ? (
                            <p className="text-sm text-green-600 dark:text-green-400 font-medium text-center">
                              Discounts active! 🎉
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center">
                              {5 - collectionParticipants} more members needed for discounts
                            </p>
                          )}
                        </div>

                        {/* Item Preview */}
                        {totalItems > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm text-muted-foreground">Items in collection:</h4>
                            <div className="space-y-2">
                              {userGroup.items.slice(0, 3).map((item) => (
                                <div key={item.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg" data-testid={`item-preview-${item.id}`}>
                                  <span className="text-card-foreground font-medium truncate">{item.product.name}</span>
                                  <span className="text-muted-foreground">×{item.quantity}</span>
                                </div>
                              ))}
                              {totalItems > 3 && (
                                <div className="text-center text-sm text-muted-foreground py-1">
                                  +{totalItems - 3} more items
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-2">
                          <Button 
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                            onClick={() => window.location.href = `/user-group/${userGroup.id}`}
                            data-testid={`button-manage-group-${userGroup.id}`}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Manage Popular Group
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}