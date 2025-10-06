import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError, redirectToLogin } from "@/lib/authUtils";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  AlertTriangle,
  CreditCard,
  CheckCircle,
  RefreshCw,
  Truck,
  MapPin
} from "lucide-react";
import type { UserGroupWithDetails, ProductWithDetails, UserGroupParticipant, User } from "@shared/schema";
import AddressManager from "@/components/AddressManager";

// Form schemas
const editGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(255, "Name too long"),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const deliveryMethodSchema = z.object({
  deliveryMethod: z.enum(["delivery", "pickup"]),
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [isPickupAddressDialogOpen, setIsPickupAddressDialogOpen] = useState(false);
  const [selectedPickupAddressId, setSelectedPickupAddressId] = useState<number | null>(null);

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

  // Get payment status for all members
  const { data: paymentStatus, isLoading: paymentStatusLoading, refetch: refetchPaymentStatus } = useQuery<any[]>({
    queryKey: [`/api/user-groups/${groupId}/payment-status`],
    enabled: isAuthenticated && !!groupId,
    retry: false,
    refetchInterval: 3000, // Refetch every 3 seconds to keep payment status updated
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch when component mounts
    staleTime: 0, // Always consider data stale to ensure fresh fetches
    cacheTime: 0, // Don't cache the data to ensure fresh fetches
    onSuccess: (data) => {
      // Payment status updated successfully
    },
    onError: (error) => {
      console.log("Payment status query error:", error);
    }
  });

  // Get all products for the add product dialog
  const { data: allProducts, isLoading: productsLoading } = useQuery<ProductWithDetails[]>({
    queryKey: ["/api/products"],
    enabled: isAuthenticated && isAddProductDialogOpen,
  });

  // Check if user owns this group
  const isOwner = userGroup?.userId === user?.id;

  // Check user participation status
  const { data: participationStatus, isLoading: participationLoading } = useQuery<{
    isParticipating: boolean;
    status: string | null;
    isPending: boolean;
    isApproved: boolean;
  }>({
    queryKey: ["/api/user-groups", groupId, "participation"],
    enabled: isAuthenticated && !!groupId,
  });

  // Get pending participants (owner only)
  const { data: pendingParticipants = [], isLoading: pendingLoading } = useQuery<(UserGroupParticipant & { user: User })[]>({
    queryKey: ["/api/user-groups", groupId, "pending"],
    enabled: isAuthenticated && !!groupId && isOwner,
  });

  // Get approved participants (visible to approved group members only)
  const { data: approvedParticipants = [], isLoading: approvedLoading } = useQuery<(UserGroupParticipant & { user: User })[]>({
    queryKey: ["/api/user-groups", groupId, "approved"],
    enabled: isAuthenticated && !!groupId && (isOwner || participationStatus?.isApproved),
  });

  // Check if group is locked (at max capacity)
  const { data: lockedStatus, isLoading: lockedLoading } = useQuery<{ isLocked: boolean }>({
    queryKey: [`/api/user-groups/${groupId}/locked`],
    enabled: isAuthenticated && !!groupId,
  });

  const isLocked = lockedStatus?.isLocked || false;

  // Check if group is payment-locked (has any payments)
  const { data: paymentLockedStatus, isLoading: paymentLockedLoading } = useQuery<{ isPaymentLocked: boolean }>({
    queryKey: [`/api/user-groups/${groupId}/payment-locked`],
    enabled: isAuthenticated && !!groupId,
  });

  const isPaymentLocked = paymentLockedStatus?.isPaymentLocked || false;

  const isApprovedParticipant = participationStatus?.isApproved || false;

  // Force refetch payment status when component mounts or groupId changes
  useEffect(() => {
    if (groupId && isAuthenticated) {
      console.log("Component mounted, refetching payment status for group:", groupId);
      // Clear cache first, then refetch
      queryClient.removeQueries({ queryKey: [`/api/user-groups/${groupId}/payment-status`] });
      refetchPaymentStatus();
    }
  }, [groupId, isAuthenticated, refetchPaymentStatus, queryClient]);

  // Create combined members list (owner + approved participants)
  const allMembers = useMemo(() => {
    if (!userGroup || !user) return [];
    
    // Filter out the owner from approved participants to avoid double counting
    const members = approvedParticipants.filter(p => p.userId !== userGroup.userId);
    
    // Always add owner first (owner should never be in approved participants)
    if (userGroup.userId) {
      // Create owner participant object with proper typing
      const ownerParticipant = {
        id: -1, // Placeholder ID for owner
        userId: userGroup.userId,
        userGroupId: userGroup.id,
        status: 'approved' as string | null,
        joinedAt: userGroup.createdAt ? new Date(userGroup.createdAt) : new Date(),
        user: {
          status: 'approved' as string | null,
          id: userGroup.userId,
          phoneNumber: null as string | null,
          email: 'Owner' as string | null, // Placeholder - will be updated with actual user data
          firstName: 'Owner' as string | null,
          lastName: null as string | null,
          profileImageUrl: null as string | null,
          isSeller: false as boolean | null,
          storeId: null as string | null,
          legalName: null as string | null,
          businessAddress: null as string | null,
          taxId: null as string | null,
          isVerified: false,
          isActive: true,
          lastLogin: null as Date | null,
          timezone: null as string | null,
          language: null as string | null,
          twoFactorEnabled: false,
          emailNotifications: true,
          pushNotifications: true,
          marketingEmails: false,
          theme: null as string | null,
          dateFormat: null as string | null,
          timeFormat: null as string | null,
          currency: null as string | null,
          profileCompleteness: 0,
          socialLinks: null as any,
          skills: null as string[] | null,
          interests: null as string[] | null,
          occupation: null as string | null,
          company: null as string | null,
          education: null as string | null,
          bio: null as string | null,
          location: null as string | null,
          website: null as string | null,
          username: null as string | null,
          profilePicture: null as string | null,
          createdAt: new Date(),
          updatedAt: null as Date | null
        }
      };
      members.unshift(ownerParticipant as any); // Add owner first
    }
    
    return members;
  }, [userGroup, approvedParticipants, user]);

  // Edit group form
  const editForm = useForm<z.infer<typeof editGroupSchema>>({
    resolver: zodResolver(editGroupSchema),
    defaultValues: {
      name: userGroup?.name || "",
      description: userGroup?.description || "",
      isPublic: userGroup?.isPublic || true,
    },
  });

  // Delivery method form
  const deliveryMethodForm = useForm<z.infer<typeof deliveryMethodSchema>>({
    resolver: zodResolver(deliveryMethodSchema),
    defaultValues: {
      deliveryMethod: userGroup?.deliveryMethod || "delivery",
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

  // Update form defaults when group data loads
  useEffect(() => {
    if (userGroup) {
      editForm.reset({
        name: userGroup.name,
        description: userGroup.description || "",
        isPublic: userGroup.isPublic || false,
      });
      deliveryMethodForm.reset({
        deliveryMethod: userGroup.deliveryMethod || "delivery",
      });
    }
  }, [userGroup, editForm, deliveryMethodForm]);

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
          redirectToLogin();
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

  // Delivery method mutation
  const deliveryMethodMutation = useMutation({
    mutationFn: async (data: z.infer<typeof deliveryMethodSchema>) => {
      return await apiRequest("PUT", `/api/user-groups/${groupId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] });
      toast({
        title: "Success",
        description: "Delivery method updated successfully!",
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
        description: "Failed to update delivery method. Please try again.",
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
        description: "Product added to popular group!",
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
          redirectToLogin();
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
        description: "Product removed from popular group!",
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
        description: "Failed to remove product.",
        variant: "destructive",
      });
    },
  });

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/user-groups/${groupId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Group deleted successfully!",
      });
      // Invalidate user groups cache
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] });
      setLocation("/my-groups");
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

  const handleDeleteGroup = () => {
    setIsDeleteDialogOpen(false);
    setIsDeleteConfirmDialogOpen(true);
  };

  const confirmDeleteGroup = () => {
    deleteGroupMutation.mutate();
    setIsDeleteConfirmDialogOpen(false);
  };

  // Approve participant mutation
  const approveParticipantMutation = useMutation({
    mutationFn: async (participantId: string) => {
      return await apiRequest("POST", `/api/user-groups/${groupId}/approve/${participantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", groupId, "pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", groupId, "approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups", groupId] });
      queryClient.invalidateQueries({ queryKey: [`/api/user-groups/${groupId}/locked`] });
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
          redirectToLogin();
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
          redirectToLogin();
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
        description: "Participant removed from popular group.",
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
            <h2 className="text-2xl font-bold text-foreground mb-4">Popular Group Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The popular group you're looking for doesn't exist or you don't have access to it.
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
  
  // Check minimum order value requirement ($50 excluding delivery)
  const MINIMUM_ORDER_VALUE = 50.00;
  const orderValueExcludingDelivery = totalValue;
  
  // Calculate per-person savings: Total Cart × 8%
  const potentialSavings = totalValue * 0.08;

  // Use collection-level participant count
  const collectionParticipants = userGroup.participantCount || 0;
  
  // Popular group-level progress - 5 people needed for discount activation
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
          <div className="relative p-4 sm:p-6 lg:p-8 rounded-3xl border border-purple-200/50 dark:border-purple-800/50 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 sm:gap-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start space-x-2 sm:space-x-3">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex-shrink-0">
                    <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground break-words" data-testid="text-group-name">
                      {userGroup.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant={userGroup.isPublic ? "default" : "secondary"} className="flex items-center space-x-1 text-xs">
                        {userGroup.isPublic ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{userGroup.isPublic ? "Public" : "Private"}</span>
                      </Badge>
                      {isOwner && (
                        <Badge variant="outline" className="text-purple-600 border-purple-300 text-xs">
                          <Crown className="w-3 h-3 mr-1" />
                          Owner
                        </Badge>
                      )}
                      {isLocked && (
                        <Badge variant="destructive" className="bg-orange-600 text-white border-orange-600 text-xs">
                          🔒 Locked
                        </Badge>
                      )}
                      {isPaymentLocked && (
                        <Badge variant="destructive" className="bg-red-600 text-white border-red-600 text-xs">
                          🔒 Cart Frozen - Payment Made
                        </Badge>
                      )}
                      <Badge variant="outline" className={`flex items-center space-x-1 text-xs ${
                        userGroup.deliveryMethod === "pickup" 
                          ? "text-purple-600 border-purple-300 bg-purple-50" 
                          : "text-blue-600 border-blue-300 bg-blue-50"
                      }`}>
                        {userGroup.deliveryMethod === "pickup" ? (
                          <>
                            <Users className="w-3 h-3" />
                            <span className="hidden sm:inline">Single Location Drop</span>
                            <span className="sm:hidden">Pickup</span>
                          </>
                        ) : (
                          <>
                            <Truck className="w-3 h-3" />
                            <span className="hidden sm:inline">Deliver to Each Home</span>
                            <span className="sm:hidden">Delivery</span>
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>
                {userGroup.description && (
                  <p className="text-sm sm:text-base text-muted-foreground max-w-2xl" data-testid="text-group-description">
                    {userGroup.description}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col gap-2 sm:gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleShare}
                  size="sm"
                  className="border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/20 text-xs sm:text-sm w-full sm:w-auto"
                  data-testid="button-share-group"
                >
                  <Share2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  <span className="hidden sm:inline">Share Popular Group</span>
                  <span className="sm:hidden">Share</span>
                </Button>
                {isOwner && (
                  <>
                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline"
                          size="sm"
                          className="border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/20 text-xs sm:text-sm w-full sm:w-auto"
                          disabled={isLocked || isPaymentLocked}
                          data-testid="button-edit-group"
                        >
                          <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Edit Popular Group</DialogTitle>
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
                                  <FormLabel>Popular Group Name</FormLabel>
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
                                {editGroupMutation.isPending ? "Updating..." : "Update Popular Group"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                    
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => setIsDeleteDialogOpen(true)}
                      disabled={isLocked}
                      className="border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-xs sm:text-sm w-full sm:w-auto"
                      data-testid="button-delete-group"
                    >
                      <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Delivery Method Control - Always available for owners */}
          {isOwner && (
            <div className="mt-6 p-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-purple-200/50 dark:border-purple-800/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <Truck className="w-5 h-5 text-purple-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Delivery Method</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Change how group members receive their orders
                    </p>
                  </div>
                </div>
                <Form {...deliveryMethodForm}>
                  <form onSubmit={deliveryMethodForm.handleSubmit((data) => {
                    if (data.deliveryMethod === "pickup" && isOwner) {
                      setIsPickupAddressDialogOpen(true);
                      return;
                    }
                    deliveryMethodMutation.mutate(data);
                  })} className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <FormField
                      control={deliveryMethodForm.control}
                      name="deliveryMethod"
                      render={({ field }) => (
                        <FormItem className="flex-1 sm:flex-none">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-full sm:w-48">
                                <SelectValue placeholder="Select delivery method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="delivery">Deliver to Each Home</SelectItem>
                              <SelectItem value="pickup">Single Location Drop</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      size="sm"
                      disabled={deliveryMethodMutation.isPending}
                      className="bg-purple-600 hover:bg-purple-700 shrink-0"
                    >
                      {deliveryMethodMutation.isPending ? "Updating..." : "Update"}
                    </Button>
                  </form>
                </Form>
              </div>
            </div>
          )}
          {isOwner && (
            <Dialog open={isPickupAddressDialogOpen} onOpenChange={setIsPickupAddressDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Confirm pickup address</DialogTitle>
                  <DialogDescription>
                    Select or edit the address where members will pick up their orders. This address is shown to members and used for delivery cost calculations.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-2">
                  <AddressManager
                    selectedAddressId={selectedPickupAddressId}
                    onAddressSelect={setSelectedPickupAddressId}
                    showSelection={true}
                    deliveryMethod="pickup"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPickupAddressDialogOpen(false)}>Cancel</Button>
                  <Button
                    className="bg-purple-600 hover:bg-purple-700"
                    disabled={!selectedPickupAddressId || deliveryMethodMutation.isPending}
                    onClick={() => {
                      deliveryMethodMutation.mutate({ 
                        deliveryMethod: "pickup",
                        pickupAddressId: selectedPickupAddressId 
                      });
                      setIsPickupAddressDialogOpen(false);
                    }}
                  >
                    {deliveryMethodMutation.isPending ? "Saving..." : "Use this address"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs for Products and Participants */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className={`grid w-full ${isOwner ? 'grid-cols-2 sm:grid-cols-4' : (participationStatus?.isApproved ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2')} bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm mb-6`}>
                <TabsTrigger value="products" className="data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/50 text-xs sm:text-sm">
                  <ShoppingCart className="hidden sm:inline-flex w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="inline">Items</span> ({totalItems})
                </TabsTrigger>
                {(isOwner || participationStatus?.isApproved) && (
                  <TabsTrigger value="members" className="data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/50 text-xs sm:text-sm" data-testid="tab-members">
                    <Users className="hidden sm:inline-flex w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="inline">Members</span> ({allMembers.length})
                  </TabsTrigger>
                )}
                {(isOwner || participationStatus?.isApproved) && (
                  <TabsTrigger value="approved" className="data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/50 text-xs sm:text-sm" data-testid="tab-approved">
                    <UserCheck className="hidden sm:inline-flex w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="inline">Approved</span> ({approvedParticipants.length})
                  </TabsTrigger>
                )}
                {isOwner && (
                  <TabsTrigger value="pending" className="data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/50 relative text-xs sm:text-sm">
                    <Clock className="hidden sm:inline-flex w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="inline">Pending</span> ({pendingParticipants.length})
                    {pendingParticipants.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center border-2 border-white dark:border-gray-800 text-[10px]">
                        {pendingParticipants.length}
                      </span>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="products">
                <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center space-x-2">
                    <ShoppingCart className="w-5 h-5 text-purple-600" />
                    <span>Popular Group Items ({totalItems})</span>
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
                          <DialogTitle>Add Product to Popular Group</DialogTitle>
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
                                {addProductMutation.isPending ? "Adding..." : "Add to Popular Group"}
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
                          className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-md transition-shadow"
                          data-testid={`item-${item.id}`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <img 
                              src={item.product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&h=80"} 
                              alt={item.product.name}
                              className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-lg flex-shrink-0"
                              data-testid={`img-product-${item.product.id}`}
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm sm:text-base text-foreground truncate" data-testid={`text-product-name-${item.product.id}`}>
                                {item.product.name}
                              </h4>
                              <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                                <span className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400">
                                  ${discountPrice.toFixed(2)}
                                </span>
                                {savings > 0 && (
                                  <>
                                    <span className="text-xs sm:text-sm text-muted-foreground line-through">
                                      ${originalPrice.toFixed(2)}
                                    </span>
                                    <Badge variant="outline" className="text-green-600 border-green-300 text-[10px] sm:text-xs">
                                      Save ${savings.toFixed(2)}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Quantity Controls and Pay Now Button */}
                          <div className="flex items-center space-x-2">
                            {isOwner && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => item.quantity > 1 && updateQuantityMutation.mutate({ productId: item.productId, quantity: item.quantity - 1 })}
                                disabled={item.quantity <= 1 || updateQuantityMutation.isPending || isPaymentLocked}
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
                                  disabled={updateQuantityMutation.isPending || isPaymentLocked}
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
              
              {/* Pickup Location Display - Show when delivery method is pickup and address is set */}
              {userGroup.deliveryMethod === "pickup" && userGroup.pickupAddress && (
                <div className="px-6 pb-6">
                  <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-800">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2 text-purple-700 dark:text-purple-300">
                        <MapPin className="w-5 h-5" />
                        <span>Pickup Location</span>
                      </CardTitle>
                      <CardDescription className="text-purple-600 dark:text-purple-400 font-medium">
                        This is a Single Location Drop - All members pick up their orders from this address
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-purple-200 dark:border-purple-700 space-y-3">
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg">
                            <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 dark:text-white text-lg">
                              {userGroup.pickupAddress.nickname}
                            </p>
                            <p className="text-gray-700 dark:text-gray-300 mt-1">
                              {userGroup.pickupAddress.fullName}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 mt-2">
                              {userGroup.pickupAddress.addressLine}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                              {userGroup.pickupAddress.city}, {userGroup.pickupAddress.state} {userGroup.pickupAddress.pincode}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                              {userGroup.pickupAddress.country}
                            </p>
                            {userGroup.pickupAddress.phoneNumber && (
                              <p className="text-purple-600 dark:text-purple-400 mt-2 flex items-center space-x-2">
                                <span>📞</span>
                                <span>{userGroup.pickupAddress.phoneNumber}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
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

          {/* Members Tab - Shows all group members with Pay Now functionality */}
          {(isOwner || participationStatus?.isApproved) && (
            <TabsContent value="members">
                <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
                  {/* Payment Status Refresh Button */}
                  <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-semibold">Group Members</h3>
                    <div className="flex items-center space-x-2">
                      {/* Payment status summary */}
                      {paymentStatus && (
                        <span className="text-xs text-gray-500">
                          {paymentStatus.filter(p => p.hasPaid).length}/{paymentStatus.length} paid
                          {paymentStatusLoading && " (refreshing...)"}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Clear cache first
                          queryClient.removeQueries({ queryKey: [`/api/user-groups/${groupId}/payment-status`] });
                          queryClient.removeQueries({ queryKey: ["/api/user-groups", groupId] });
                          // Then refetch
                          refetchPaymentStatus();
                          // Also refetch the group data
                          queryClient.refetchQueries({ queryKey: ["/api/user-groups", groupId] });
                        }}
                        disabled={paymentStatusLoading}
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${paymentStatusLoading ? 'animate-spin' : ''}`} />
                        {paymentStatusLoading ? "Refreshing..." : "Refresh Status"}
                      </Button>
                    </div>
                  </div>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        <span>Group Members ({allMembers.length}/5)</span>
                      </div>
                      {allMembers.length >= 5 && (
                        <div className="flex items-center text-green-600">
                          <AlertTriangle className="w-4 h-4 mr-1" />
                          <span className="text-sm font-medium">Group Full</span>
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
                    ) : allMembers.length === 0 ? (
                      <div className="text-center py-8">
                        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">No group members yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {allMembers.map((member: any) => (
                          <div
                            key={member.userId}
                            className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                            data-testid={`member-card-${member.userId}`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-200 dark:bg-blue-800 rounded-full flex items-center justify-center">
                                {member.userId === userGroup?.userId ? (
                                  <Crown className="w-5 h-5 text-blue-700 dark:text-blue-300" />
                                ) : (
                                  <Users className="w-5 h-5 text-blue-700 dark:text-blue-300" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">
                                  {member.user.firstName || member.user.email || member.userId}
                                  {member.userId === userGroup?.userId && " (Owner)"}
                                  {member.userId === user?.id && " (You)"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {member.userId === userGroup?.userId ? "Group Owner" : "Member"}
                                </p>
                              </div>
                            </div>
                            
                            {/* Payment status - only shown when conditions are met */}
                            {totalItems > 0 && (
                              <div className="flex flex-col items-end space-y-1">
                                {(() => {
                                  // Check if this member has paid
                                  const memberPaymentStatus = paymentStatus?.find(p => p.userId === member.userId);
                                  const hasPaid = memberPaymentStatus?.hasPaid || false;
                                  
                                  // Determine if current user can pay for this member
                                  const canPayForThisMember = isOwner || member.userId === user?.id;
                                  
                                  // Group is locked when 5 members have joined
                                  const isGroupLocked = allMembers.length >= 5;
                                  
                                  if (hasPaid) {
                                    return (
                                      <>
                                        <Button
                                          size="sm"
                                          disabled
                                          className="bg-green-100 text-green-800 border-green-200 cursor-default"
                                          data-testid={`button-paid-${member.userId}`}
                                        >
                                          <CheckCircle className="w-4 h-4 mr-1" />
                                          Paid
                                        </Button>
                                        <p className="text-xs text-green-600 dark:text-green-400">
                                          Payment completed
                                        </p>
                                      </>
                                    );
                                  } else if (canPayForThisMember) {
                                    // Show pay button only if:
                                    // 1. User is owner (can pay for anyone), OR
                                    // 2. This is the current user's own row
                                    return (
                                      <>
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            const shareUrl = `${window.location.origin}/checkout?group=${userGroup?.shareToken}&member=${member.userId}`;
                                            window.location.href = shareUrl;
                                          }}
                                          disabled={!isGroupLocked}
                                          className="bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
                                          data-testid={`button-pay-now-${member.userId}`}
                                        >
                                          <CreditCard className="w-4 h-4 mr-1" />
                                          Pay Now
                                        </Button>
                                        <p className="text-xs text-muted-foreground">
                                          {isGroupLocked ? "Ready for payment" : "Waiting for 5 members"}
                                        </p>
                                      </>
                                    );
                                  } else {
                                    // Non-owner viewing someone else's payment status
                                    return (
                                      <p className="text-xs text-muted-foreground">
                                        {isGroupLocked ? "Pending payment" : "Waiting for 5 members"}
                                      </p>
                                    );
                                  }
                                })()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Payment Locked Message when group is not full */}
                    {totalItems > 0 && allMembers.length < 5 && (
                      <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-800 rounded-full flex items-center justify-center">
                              <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">
                              ⏳ Waiting for Members
                            </h4>
                            <p className="text-sm text-orange-700 dark:text-orange-300 mb-2">
                              Payment is currently locked. You need exactly <strong>5 members</strong> to unlock payment and activate group discounts.
                            </p>
                            <p className="text-sm text-orange-700 dark:text-orange-300">
                              Current members: <strong>{allMembers.length}/5</strong> ({5 - allMembers.length} more needed)
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Payment Instructions when conditions are met */}
                    {totalItems > 0 && allMembers.length >= 5 && (
                      <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                              <CreditCard className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                              🎉 Ready for Payment!
                            </h4>
                            <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                              Your group is now full with {allMembers.length} members and has {totalItems} item{totalItems !== 1 ? 's' : ''}. 
                              {isOwner 
                                ? " As the owner, you can complete payment for any member."
                                : " You can now complete your individual payment."}
                            </p>
                            
                            {(() => {
                              const totalAmount = userGroup?.items?.reduce((sum, item) => {
                                const originalPrice = parseFloat(item.product.originalPrice.toString());
                                const discountPrice = item.product.discountTiers?.[0]?.finalPrice 
                                  ? parseFloat(item.product.discountTiers[0].finalPrice.toString())
                                  : originalPrice;
                                return sum + (discountPrice * item.quantity);
                              }, 0) || 0;

                              const paidCount = paymentStatus?.filter(p => p.hasPaid).length || 0;

                              return (
                                <div className="text-center">
                                  <p className="text-sm text-green-600 dark:text-green-400">Payment Status: {paidCount}/{allMembers.length} paid</p>
                                  <p className="text-2xl font-bold text-green-800 dark:text-green-200 mt-2">
                                    ${totalAmount.toFixed(2)}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Amount per member
                                  </p>
                                  <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                                    {isOwner 
                                      ? "Click 'Pay Now' next to any unpaid member to complete their payment"
                                      : "Click 'Pay Now' next to your name above to complete payment"}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
          )}

          {/* Approved Participants Tab - Now visible to approved group members only */}
          {(isOwner || participationStatus?.isApproved) && (
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
                        <span className="text-sm font-medium">Popular Group Full</span>
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
                          <div className="flex items-center space-x-2">
                            {/* Pay Now Button for each member when group is locked and has items */}
                            {userGroup && userGroup.items && userGroup.items.length > 0 && isLocked && (
                              (() => {
                                const totalAmount = userGroup.items.reduce((sum, item) => {
                                  const originalPrice = parseFloat(item.product.originalPrice.toString());
                                  const discountPrice = item.product.discountTiers?.[0]?.finalPrice 
                                    ? parseFloat(item.product.discountTiers[0].finalPrice.toString())
                                    : originalPrice;
                                  return sum + (discountPrice * item.quantity);
                                }, 0);

                                // Check if this participant has paid
                                const participantPaymentStatus = paymentStatus?.find(p => p.userId === participant.userId);
                                const hasPaid = participantPaymentStatus?.hasPaid || false;
                                

                                if (hasPaid) {
                                  return (
                                    <Button 
                                      size="sm"
                                      disabled
                                      className="bg-green-100 text-green-800 border-green-200 cursor-default"
                                      data-testid={`button-paid-${participant.userId}`}
                                    >
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      Paid
                                    </Button>
                                  );
                                } else {
                                  // return (
                                  //   <Button 
                                  //     size="sm"
                                  //     className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold"
                                  //     onClick={() => setLocation(`/checkout?type=group&userGroupId=${groupId}`)}
                                  //     data-testid={`button-pay-now-${participant.userId}`}
                                  //   >
                                  //     <DollarSign className="w-4 h-4 mr-1" />
                                  //     Pay Now - ${totalAmount.toFixed(2)}
                                  //   </Button>
                                  // );
                                }
                              })()
                            )}
                            {isOwner && participant.userId !== user?.id && (
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
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Group Payment Status - Shows when group has items and is at max capacity */}
                  {userGroup && userGroup.items && userGroup.items.length > 0 && isLocked && (
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-xl border border-green-200 dark:border-green-800">
                        <div className="text-center space-y-4">
                          <div className="flex items-center justify-center space-x-2">
                            <DollarSign className="w-6 h-6 text-green-600" />
                            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                              Group Payment Ready
                            </h3>
                          </div>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            This group has reached maximum capacity! All members can now pay for their items with group discounts.
                          </p>
                          
                          {/* Calculate and display total amount with discounts */}
                          {(() => {
                            const totalAmount = userGroup.items.reduce((sum, item) => {
                              const originalPrice = parseFloat(item.product.originalPrice.toString());
                              const discountPrice = item.product.discountTiers?.[0]?.finalPrice 
                                ? parseFloat(item.product.discountTiers[0].finalPrice.toString())
                                : originalPrice;
                              return sum + (discountPrice * item.quantity);
                            }, 0);

                            return (
                              <div className="text-center">
                                <p className="text-sm text-green-600 dark:text-green-400">Total amount per member:</p>
                                <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                                  ${totalAmount.toFixed(2)}
                                </p>
                                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                                  Click "Pay Now" next to your name above to complete payment
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
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
            {/* Popular Group Stats */}
            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <span>Popular Group Stats</span>
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
                
                {/* Minimum Order Value Requirement */}
                <div className="space-y-2">
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      ${orderValueExcludingDelivery.toFixed(2)} / $50.00
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {orderValueExcludingDelivery >= MINIMUM_ORDER_VALUE 
                        ? "✅ Minimum order value met" 
                        : `$${(MINIMUM_ORDER_VALUE - orderValueExcludingDelivery).toFixed(2)} more needed for discounts`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      (Minimum cart value must be $50 to get discount)
                    </p>
                  </div>
                  
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        orderValueExcludingDelivery >= MINIMUM_ORDER_VALUE 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                          : 'bg-gradient-to-r from-orange-500 to-yellow-500'
                      }`}
                      style={{ width: `${Math.min((orderValueExcludingDelivery / MINIMUM_ORDER_VALUE) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                  <div className="text-center p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                    <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400" data-testid="text-total-items">
                      {totalItems}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Items</p>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-total-value">
                      ${totalValue.toFixed(2)}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Popular Group Value</p>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <p className="text-base sm:text-lg lg:text-xl font-bold text-green-600 dark:text-green-400" data-testid="text-potential-savings">
                      ${potentialSavings.toFixed(2)} per person
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Potential Savings</p>
                    <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 mt-1">
                      (8% discount if 5 people join this group)
                    </p>
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
      
      {/* First Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <span>Delete Group</span>
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <p>Are you sure you want to delete this group?</p>
              <p className="text-red-600 font-medium">
                All {(approvedParticipants?.length || 0)} member(s) will be removed from this group.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteGroup}
              data-testid="button-confirm-delete-warning"
            >
              Yes, Delete Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Second Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={setIsDeleteConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <span>Are you absolutely sure?</span>
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <p>This action cannot be undone. This will permanently delete the group and remove all members.</p>
              <p className="text-red-600 font-bold">
                Group: "{userGroup?.name}"
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteConfirmDialogOpen(false)}
              data-testid="button-cancel-final-delete"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteGroup}
              disabled={deleteGroupMutation.isPending}
              data-testid="button-confirm-final-delete"
            >
              {deleteGroupMutation.isPending ? "Deleting..." : "Delete Forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}