import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Package, 
  Share2, 
  Edit, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingCart, 
  ArrowLeft, 
  Crown, 
  Users,
  TrendingUp,
  DollarSign,
  Link as LinkIcon,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Clock,
  AlertTriangle
} from "lucide-react";
import type { UserGroupWithDetails, ProductWithDetails } from "@shared/schema";

// Form schemas
const editGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(255, "Name too long"),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const addProductSchema = z.object({
  productId: z.number().min(1, "Product is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
});

export default function UserGroupPage() {
  const { id } = useParams();
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("products");

  const groupId = id ? parseInt(id) : null;

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

  // Get user group details
  const { data: userGroup, isLoading: groupLoading } = useQuery<UserGroupWithDetails>({
    queryKey: ["/api/user-groups", groupId],
    enabled: isAuthenticated && !!groupId,
  });

  // Get all products for the add product dialog
  const { data: allProducts, isLoading: productsLoading } = useQuery<ProductWithDetails[]>({
    queryKey: ["/api/products"],
    enabled: isAuthenticated && isAddProductDialogOpen,
  });

  // Get pending participants (owner only)
  const { data: pendingParticipants = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["/api/user-groups", groupId, "pending"],
    enabled: isAuthenticated && !!groupId && isOwner,
  });

  // Get approved participants (owner only)
  const { data: approvedParticipants = [], isLoading: approvedLoading } = useQuery({
    queryKey: ["/api/user-groups", groupId, "approved"],
    enabled: isAuthenticated && !!groupId && isOwner,
  });

  // Edit group form
  const editForm = useForm<z.infer<typeof editGroupSchema>>({
    resolver: zodResolver(editGroupSchema),
    defaultValues: {
      name: userGroup?.name || "",
      description: userGroup?.description || "",
      isPublic: userGroup?.isPublic || true,
    },
  });

  // Add product form
  const addProductForm = useForm<z.infer<typeof addProductSchema>>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      productId: 0,
      quantity: 1,
    },
  });

  // Check if user owns this group
  const isOwner = userGroup?.userId === user?.id;

  // Update form defaults when group data loads
  useEffect(() => {
    if (userGroup) {
      editForm.reset({
        name: userGroup.name,
        description: userGroup.description || "",
        isPublic: userGroup.isPublic || false,
      });
    }
  }, [userGroup, editForm]);

  // Edit group mutation
  const editGroupMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editGroupSchema>) => {
      return await apiRequest("PUT", `/api/user-groups/${groupId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] });
      setIsEditDialogOpen(false);
      toast({
        title: "Success",
        description: "Group updated successfully!",
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
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update group. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Add product mutation
  const addProductMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addProductSchema>) => {
      return await apiRequest("POST", `/api/user-groups/${groupId}/items`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", groupId] });
      setIsAddProductDialogOpen(false);
      addProductForm.reset();
      toast({
        title: "Success",
        description: "Product added to collection!",
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
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add product. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: number; quantity: number }) => {
      return await apiRequest("PUT", `/api/user-groups/${groupId}/items/${productId}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", groupId] });
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
        description: "Failed to update quantity.",
        variant: "destructive",
      });
    },
  });

  // Remove product mutation
  const removeProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      return await apiRequest("DELETE", `/api/user-groups/${groupId}/items/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", groupId] });
      toast({
        title: "Success",
        description: "Product removed from collection!",
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
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to remove product.",
        variant: "destructive",
      });
    },
  });

  // Approve participant mutation
  const approveParticipantMutation = useMutation({
    mutationFn: async (participantId: string) => {
      return await apiRequest("POST", `/api/user-groups/${groupId}/approve/${participantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", groupId, "pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", groupId, "approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", groupId] });
      toast({
        title: "Success",
        description: "Participant approved!",
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
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to approve participant.",
        variant: "destructive",
      });
    },
  });

  // Reject participant mutation
  const rejectParticipantMutation = useMutation({
    mutationFn: async (participantId: string) => {
      return await apiRequest("POST", `/api/user-groups/${groupId}/reject/${participantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", groupId, "pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", groupId] });
      toast({
        title: "Success",
        description: "Participant rejected.",
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
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to reject participant.",
        variant: "destructive",
      });
    },
  });

  // Remove participant mutation
  const removeParticipantMutation = useMutation({
    mutationFn: async (participantId: string) => {
      return await apiRequest("DELETE", `/api/user-groups/${groupId}/remove/${participantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", groupId, "approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", groupId] });
      toast({
        title: "Success",
        description: "Participant removed from collection.",
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
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to remove participant.",
        variant: "destructive",
      });
    },
  });

  const handleShare = async () => {
    if (!userGroup?.shareToken) return;
    
    const shareUrl = `${window.location.origin}/shared/${userGroup.shareToken}`;
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

  if (authLoading || groupLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
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

  if (!userGroup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-4">Collection Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The collection you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => setLocation("/my-groups")} data-testid="button-back-to-groups">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to My Groups
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const totalItems = userGroup.items?.length || 0;
  const totalValue = userGroup.items?.reduce((sum, item) => {
    return sum + (parseFloat(item.product.originalPrice.toString()) * item.quantity);
  }, 0) || 0;
  
  const potentialSavings = userGroup.items?.reduce((sum, item) => {
    const discountPrice = item.product.discountTiers?.[0]?.finalPrice || item.product.originalPrice;
    const savings = (parseFloat(item.product.originalPrice.toString()) - parseFloat(discountPrice.toString())) * item.quantity;
    return sum + savings;
  }, 0) || 0;

  // Use collection-level participant count
  const collectionParticipants = userGroup.participantCount || 0;
  
  // Collection-level progress - 5 people needed for discount activation
  const collectionProgress = Math.min((collectionParticipants / 5) * 100, 100);

  // Filter products not already in the group
  const availableProducts = allProducts?.filter(product => 
    !userGroup.items?.some(item => item.productId === product.id)
  ) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      <Header />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/my-groups")} 
          className="mb-6 hover:bg-purple-100 dark:hover:bg-purple-900/20"
          data-testid="button-back-to-groups"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to My Groups
        </Button>

        {/* Header Section */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl opacity-5"></div>
          <div className="relative p-8 rounded-3xl border border-purple-200/50 dark:border-purple-800/50 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-foreground" data-testid="text-group-name">
                      {userGroup.name}
                    </h1>
                    <div className="flex items-center space-x-3 mt-1">
                      <Badge variant={userGroup.isPublic ? "default" : "secondary"} className="flex items-center space-x-1">
                        {userGroup.isPublic ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{userGroup.isPublic ? "Public" : "Private"}</span>
                      </Badge>
                      {isOwner && (
                        <Badge variant="outline" className="text-purple-600 border-purple-300">
                          <Crown className="w-3 h-3 mr-1" />
                          Owner
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {userGroup.description && (
                  <p className="text-muted-foreground max-w-2xl" data-testid="text-group-description">
                    {userGroup.description}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleShare}
                  className="border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/20"
                  data-testid="button-share-group"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Collection
                </Button>
                {isOwner && (
                  <>
                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline"
                          className="border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/20"
                          data-testid="button-edit-group"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Edit Collection</DialogTitle>
                          <DialogDescription>
                            Update your collection's name, description, and visibility.
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...editForm}>
                          <form onSubmit={editForm.handleSubmit((data) => editGroupMutation.mutate(data))} className="space-y-4">
                            <FormField
                              control={editForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Collection Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-edit-group-name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={editForm.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Description</FormLabel>
                                  <FormControl>
                                    <Textarea {...field} data-testid="input-edit-group-description" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <DialogFooter>
                              <Button type="submit" disabled={editGroupMutation.isPending} data-testid="button-submit-edit-group">
                                {editGroupMutation.isPending ? "Updating..." : "Update Collection"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs for Products and Participants */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm mb-6">
                <TabsTrigger value="products" className="data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/50">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Collection Items ({totalItems})
                </TabsTrigger>
                {isOwner && (
                  <>
                    <TabsTrigger value="pending" className="data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/50">
                      <Clock className="w-4 h-4 mr-2" />
                      Pending ({pendingParticipants.length})
                    </TabsTrigger>
                    <TabsTrigger value="approved" className="data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/50">
                      <UserCheck className="w-4 h-4 mr-2" />
                      Approved ({approvedParticipants.length})
                    </TabsTrigger>
                  </>
                )}
              </TabsList>

              <TabsContent value="products">
                <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center space-x-2">
                    <ShoppingCart className="w-5 h-5 text-purple-600" />
                    <span>Collection Items ({totalItems})</span>
                  </CardTitle>
                  {isOwner && (
                    <Dialog open={isAddProductDialogOpen} onOpenChange={setIsAddProductDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm"
                          className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                          data-testid="button-add-product"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Product
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Add Product to Collection</DialogTitle>
                          <DialogDescription>
                            Select a product to add to your collection.
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...addProductForm}>
                          <form onSubmit={addProductForm.handleSubmit((data) => addProductMutation.mutate(data))} className="space-y-4">
                            <FormField
                              control={addProductForm.control}
                              name="productId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Product</FormLabel>
                                  <FormControl>
                                    <select 
                                      {...field} 
                                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                                      className="w-full p-2 border rounded-md bg-background"
                                      data-testid="select-product"
                                    >
                                      <option value={0}>Select a product...</option>
                                      {availableProducts?.map((product) => (
                                        <option key={product.id} value={product.id}>
                                          {product.name} - ${product.originalPrice}
                                        </option>
                                      ))}
                                    </select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={addProductForm.control}
                              name="quantity"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Quantity</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      min="1" 
                                      {...field} 
                                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                                      data-testid="input-product-quantity"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <DialogFooter>
                              <Button type="submit" disabled={addProductMutation.isPending || !addProductForm.watch('productId')} data-testid="button-submit-add-product">
                                {addProductMutation.isPending ? "Adding..." : "Add to Collection"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {totalItems === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Items Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      {isOwner ? "Add products to start building your collection." : "This collection is empty."}
                    </p>
                    {isOwner && (
                      <Button 
                        onClick={() => setIsAddProductDialogOpen(true)}
                        className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                        data-testid="button-add-first-product"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Product
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userGroup.items.map((item) => {
                      const originalPrice = parseFloat(item.product.originalPrice.toString());
                      const discountPrice = item.product.discountTiers?.[0]?.finalPrice 
                        ? parseFloat(item.product.discountTiers[0].finalPrice.toString())
                        : originalPrice;
                      const savings = (originalPrice - discountPrice) * item.quantity;
                      
                      return (
                        <div 
                          key={item.id} 
                          className="flex items-center space-x-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-md transition-shadow"
                          data-testid={`item-${item.id}`}
                        >
                          <img 
                            src={item.product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&h=80"} 
                            alt={item.product.name}
                            className="w-16 h-16 object-cover rounded-lg"
                            data-testid={`img-product-${item.product.id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground truncate" data-testid={`text-product-name-${item.product.id}`}>
                              {item.product.name}
                            </h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                ${discountPrice.toFixed(2)}
                              </span>
                              {savings > 0 && (
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
                          </div>
                          
                          {/* Quantity Controls */}
                          <div className="flex items-center space-x-2">
                            {isOwner && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => item.quantity > 1 && updateQuantityMutation.mutate({ productId: item.productId, quantity: item.quantity - 1 })}
                                disabled={item.quantity <= 1 || updateQuantityMutation.isPending}
                                data-testid={`button-decrease-quantity-${item.product.id}`}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                            )}
                            <span className="text-lg font-semibold w-8 text-center" data-testid={`text-quantity-${item.product.id}`}>
                              {item.quantity}
                            </span>
                            {isOwner && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => updateQuantityMutation.mutate({ productId: item.productId, quantity: item.quantity + 1 })}
                                  disabled={updateQuantityMutation.isPending}
                                  data-testid={`button-increase-quantity-${item.product.id}`}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => removeProductMutation.mutate(item.productId)}
                                  disabled={removeProductMutation.isPending}
                                  className="border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 text-red-600 hover:text-red-700"
                                  data-testid={`button-remove-product-${item.product.id}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
              </TabsContent>

          {/* Pending Participants Tab */}
          {isOwner && (
            <TabsContent value="pending">
              <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-orange-600" />
                    <span>Pending Participants ({pendingParticipants.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                          <Skeleton className="h-8 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : pendingParticipants.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No pending participant requests</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingParticipants.map((participant: any) => (
                        <div
                          key={participant.userId}
                          className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-orange-200 dark:bg-orange-800 rounded-full flex items-center justify-center">
                              <Users className="w-5 h-5 text-orange-700 dark:text-orange-300" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {participant.user.firstName || participant.user.email || participant.userId}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Waiting for approval
                              </p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => approveParticipantMutation.mutate(participant.userId)}
                              disabled={approveParticipantMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white"
                              data-testid={`button-approve-${participant.userId}`}
                            >
                              <UserCheck className="w-4 h-4 mr-1" />
                              {approveParticipantMutation.isPending ? "..." : "Approve"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectParticipantMutation.mutate(participant.userId)}
                              disabled={rejectParticipantMutation.isPending}
                              className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300"
                              data-testid={`button-reject-${participant.userId}`}
                            >
                              <UserX className="w-4 h-4 mr-1" />
                              {rejectParticipantMutation.isPending ? "..." : "Reject"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Approved Participants Tab */}
          {isOwner && (
            <TabsContent value="approved">
              <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <UserCheck className="w-5 h-5 text-green-600" />
                      <span>Approved Participants ({approvedParticipants.length}/5)</span>
                    </div>
                    {approvedParticipants.length >= 5 && (
                      <div className="flex items-center text-green-600">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        <span className="text-sm font-medium">Collection Full</span>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {approvedLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                          <Skeleton className="h-8 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : approvedParticipants.length === 0 ? (
                    <div className="text-center py-8">
                      <UserCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No approved participants yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {approvedParticipants.map((participant: any) => (
                        <div
                          key={participant.userId}
                          className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-200 dark:bg-green-800 rounded-full flex items-center justify-center">
                              {participant.userId === user?.id ? (
                                <Crown className="w-5 h-5 text-green-700 dark:text-green-300" />
                              ) : (
                                <Users className="w-5 h-5 text-green-700 dark:text-green-300" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {participant.user.firstName || participant.user.email || participant.userId}
                                {participant.userId === user?.id && (
                                  <span className="text-sm text-green-600 ml-2 font-medium">(Owner)</span>
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Approved member
                              </p>
                            </div>
                          </div>
                          {participant.userId !== user?.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeParticipantMutation.mutate(participant.userId)}
                              disabled={removeParticipantMutation.isPending}
                              className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300"
                              data-testid={`button-remove-${participant.userId}`}
                            >
                              <UserX className="w-4 h-4 mr-1" />
                              {removeParticipantMutation.isPending ? "..." : "Remove"}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
          </div>

          {/* Statistics Sidebar */}
          <div className="space-y-6">
            {/* Collection Stats */}
            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <span>Collection Stats</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
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
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${collectionProgress}%` }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400" data-testid="text-total-items">
                      {totalItems}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Items</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-total-value">
                      ${totalValue.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">Collection Value</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-potential-savings">
                      ${potentialSavings.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">Potential Savings</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Share Info */}
            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <LinkIcon className="w-5 h-5 text-purple-600" />
                  <span>Sharing</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Share Token:</p>
                  <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded font-mono" data-testid="text-share-token">
                    {userGroup.shareToken}
                  </code>
                </div>
                <p className="text-sm text-muted-foreground">
                  {userGroup.isPublic 
                    ? "Anyone with the link can view this collection." 
                    : "This collection is private and not shareable."}
                </p>
                <Button 
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                  onClick={handleShare}
                  disabled={!userGroup.isPublic}
                  data-testid="button-copy-share-link"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Copy Share Link
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}