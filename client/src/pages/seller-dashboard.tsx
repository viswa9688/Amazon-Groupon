import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DollarSign, Package, ShoppingBag, TrendingUp, Plus, Edit, Truck, Trash2, BarChart3, Home, Calendar as CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import type { ProductWithDetails, Order, Category, InsertProduct } from "@shared/schema";
import { Link } from "wouter";

// Product form schema
const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  categoryId: z.string().min(1, "Category is required"),
  imageUrl: z.string().url("Please enter a valid image URL").optional().or(z.literal("")),
  originalPrice: z.string().min(1, "Price is required"),
  discountPrice: z.string().min(1, "Discount price is required"),
  minimumParticipants: z.string().min(1, "Minimum participants required"),
  maximumParticipants: z.string().min(1, "Maximum participants required"),
  offerValidTill: z.date().optional(),
});

type ProductFormData = z.infer<typeof productFormSchema>;

export default function SellerDashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("products");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithDetails | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductWithDetails | null>(null);

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

  const { data: products, isLoading: productsLoading } = useQuery<ProductWithDetails[]>({
    queryKey: ["/api/seller/products"],
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    enabled: isAuthenticated,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/seller/orders"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch seller metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<{
    totalRevenue: number;
    totalOrders: number;
    potentialRevenue: number;
    activeGroups: number;
    totalProducts: number;
    growthPercentage: number;
  }>({
    queryKey: ["/api/seller/metrics"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Product form
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      categoryId: "",
      imageUrl: "",
      originalPrice: "",
      discountPrice: "",
      minimumParticipants: "10",
      maximumParticipants: "1000",
      offerValidTill: undefined,
    },
  });

  // Edit product form
  const editForm = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      categoryId: "",
      imageUrl: "",
      originalPrice: "",
      discountPrice: "",
      minimumParticipants: "10",
      maximumParticipants: "1000",
      offerValidTill: undefined,
    },
  });

  // Add product mutation
  const addProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const productData = {
        ...data,
        categoryId: parseInt(data.categoryId),
        originalPrice: data.originalPrice,
        minimumParticipants: parseInt(data.minimumParticipants),
        maximumParticipants: parseInt(data.maximumParticipants),
        imageUrl: data.imageUrl || undefined,
        offerValidTill: data.offerValidTill?.toISOString() || undefined,
      };
      return apiRequest("POST", "/api/seller/products", productData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seller/products"] });
      toast({
        title: "Product Added",
        description: "Your product has been successfully added.",
      });
      setProductDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add product",
        variant: "destructive",
      });
    },
  });

  // Edit product mutation
  const editProductMutation = useMutation({
    mutationFn: async ({ productId, data }: { productId: number; data: ProductFormData }) => {
      const productData = {
        ...data,
        categoryId: parseInt(data.categoryId),
        originalPrice: data.originalPrice,
        minimumParticipants: parseInt(data.minimumParticipants),
        maximumParticipants: parseInt(data.maximumParticipants),
        imageUrl: data.imageUrl || undefined,
        offerValidTill: data.offerValidTill?.toISOString() || undefined,
      };
      return apiRequest("PATCH", `/api/seller/products/${productId}`, productData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seller/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/group-purchases"] });
      toast({
        title: "Product Updated",
        description: "Your product has been successfully updated.",
      });
      setEditDialogOpen(false);
      setEditingProduct(null);
      editForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product",
        variant: "destructive",
      });
    },
  });

  // Update order status mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      return apiRequest("PATCH", `/api/seller/orders/${orderId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seller/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/seller/metrics"] });
      toast({
        title: "Status Updated",
        description: "Order status has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProductFormData) => {
    addProductMutation.mutate(data);
  };

  const onEditSubmit = (data: ProductFormData) => {
    if (editingProduct) {
      editProductMutation.mutate({ productId: editingProduct.id!, data });
    }
  };

  const handleEditClick = (product: ProductWithDetails) => {
    setEditingProduct(product);
    
    // Get discount price from discount tiers if available
    const discountPrice = product.discountTiers && product.discountTiers.length > 0 
      ? product.discountTiers[0].finalPrice.toString() 
      : product.originalPrice.toString();

    // Debug: Check if offerValidTill exists
    console.log('Product offerValidTill:', product.offerValidTill);
    console.log('Product data:', product);
    
    const existingDate = product.offerValidTill ? new Date(product.offerValidTill) : undefined;
    console.log('Parsed date:', existingDate);
      
    editForm.reset({
      name: product.name,
      description: product.description || "",
      categoryId: product.categoryId?.toString() || "",
      imageUrl: product.imageUrl || "",
      originalPrice: product.originalPrice.toString(),
      discountPrice: discountPrice,
      minimumParticipants: product.minimumParticipants.toString(),
      maximumParticipants: product.maximumParticipants.toString(),
      offerValidTill: existingDate,
    });
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (product: ProductWithDetails) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest("DELETE", `/api/seller/products/${productId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Product deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/seller/products"] });
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    },
    onError: (error: any) => {
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
      
      // Handle participant warning
      if (error.message.includes("participants")) {
        const data = JSON.parse(error.message.split(': ')[1] || '{}');
        toast({
          title: "Cannot Delete Product",
          description: data.details || "This product has active participants.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete product. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const handleStatusUpdate = (orderId: number, status: string) => {
    updateOrderStatusMutation.mutate({ orderId, status });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Use metrics from API or fallback to loading state
  const totalProducts = metrics?.totalProducts ?? 0;
  const activeGroups = metrics?.activeGroups ?? 0;
  const totalRevenue = metrics?.totalRevenue ?? 0;
  const potentialRevenue = metrics?.potentialRevenue ?? 0;
  const growthPercentage = metrics?.growthPercentage ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-dashboard-title">
              Seller Dashboard
            </h1>
            <p className="text-muted-foreground">
              Welcome back, {(user as any)?.firstName || 'Seller'}! Here's your store overview.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" asChild>
              <Link href="/seller/analytics">
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-revenue">
                    ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Potential Revenue</p>
                  <p className="text-2xl font-bold text-orange-600" data-testid="text-potential-revenue">
                    ${potentialRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Groups</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-active-groups">
                    {activeGroups}
                  </p>
                </div>
                <ShoppingBag className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Products</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-products">
                    {totalProducts}
                  </p>
                </div>
                <Package className="h-8 w-8 text-secondary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Growth</p>
                  <p className="text-2xl font-bold text-accent" data-testid="text-growth-percentage">
                    {growthPercentage >= 0 ? '+' : ''}{growthPercentage.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Product Management
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Order Management
            </TabsTrigger>
            <TabsTrigger value="potential" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Potential Revenue
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <div className="space-y-6">
              {/* Add Product Button */}
              <div className="flex justify-end">
                <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary hover:bg-primary/90" data-testid="button-add-product">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New Product</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Product Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter product name" {...field} data-testid="input-product-name" />
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
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Describe your product" rows={4} {...field} data-testid="input-product-description" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="categoryId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-category">
                                    <SelectValue placeholder="Select a category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {categories?.map((category) => (
                                    <SelectItem key={category.id} value={category.id.toString()}>
                                      {category.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="imageUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Image URL (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="https://example.com/image.jpg" {...field} data-testid="input-image-url" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="originalPrice"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Original Price ($)</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-original-price" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="discountPrice"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Discount Price ($)</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-discount-price" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="minimumParticipants"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Minimum Participants</FormLabel>
                                <FormControl>
                                  <Input type="number" {...field} data-testid="input-min-participants" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="maximumParticipants"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Maximum Participants</FormLabel>
                                <FormControl>
                                  <Input type="number" {...field} data-testid="input-max-participants" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        {/* Offer Valid Till Field */}
                        <FormField
                          control={form.control}
                          name="offerValidTill"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Offer Valid Till (Optional)</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                                      data-testid="button-offer-valid-till"
                                    >
                                      {field.value ? (
                                        format(field.value, "PPP 'at' HH:mm")
                                      ) : (
                                        <span>Pick a date and time</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) => date < new Date()}
                                    initialFocus
                                  />
                                  {field.value && (
                                    <div className="p-3 border-t">
                                      <label className="text-sm font-medium">Time</label>
                                      <Input
                                        type="time"
                                        value={field.value ? format(field.value, "HH:mm") : ""}
                                        onChange={(e) => {
                                          if (field.value && e.target.value) {
                                            const [hours, minutes] = e.target.value.split(':');
                                            const newDate = new Date(field.value);
                                            newDate.setHours(parseInt(hours), parseInt(minutes));
                                            field.onChange(newDate);
                                          }
                                        }}
                                        className="mt-1"
                                      />
                                    </div>
                                  )}
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="flex justify-end space-x-4">
                          <Button type="button" variant="outline" onClick={() => setProductDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={addProductMutation.isPending} data-testid="button-submit-product">
                            {addProductMutation.isPending ? "Adding..." : "Add Product"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Edit Product Dialog */}
              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Product</DialogTitle>
                  </DialogHeader>
                  <Form {...editForm}>
                    <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
                      <FormField
                        control={editForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter product name" {...field} data-testid="input-edit-product-name" />
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
                              <Textarea placeholder="Describe your product" rows={4} {...field} data-testid="input-edit-product-description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editForm.control}
                        name="categoryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-edit-category">
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categories?.map((category) => (
                                  <SelectItem key={category.id} value={category.id.toString()}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editForm.control}
                        name="imageUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Image URL (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="https://example.com/image.jpg" {...field} data-testid="input-edit-image-url" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
                          name="originalPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Original Price ($)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-edit-original-price" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={editForm.control}
                          name="discountPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Discount Price ($)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-edit-discount-price" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
                          name="minimumParticipants"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Minimum Participants</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} data-testid="input-edit-min-participants" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={editForm.control}
                          name="maximumParticipants"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Maximum Participants</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} data-testid="input-edit-max-participants" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {/* Offer Valid Till Field - Edit Form */}
                      <FormField
                        control={editForm.control}
                        name="offerValidTill"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Offer Valid Till (Optional)</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                                    data-testid="button-edit-offer-valid-till"
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP 'at' HH:mm")
                                    ) : (
                                      <span>Pick a date and time</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                />
                                {field.value && (
                                  <div className="p-3 border-t">
                                    <label className="text-sm font-medium">Time</label>
                                    <Input
                                      type="time"
                                      value={field.value ? format(field.value, "HH:mm") : ""}
                                      onChange={(e) => {
                                        if (field.value && e.target.value) {
                                          const [hours, minutes] = e.target.value.split(':');
                                          const newDate = new Date(field.value);
                                          newDate.setHours(parseInt(hours), parseInt(minutes));
                                          field.onChange(newDate);
                                        }
                                      }}
                                      className="mt-1"
                                    />
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex justify-end space-x-4">
                        <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={editProductMutation.isPending} data-testid="button-update-product">
                          {editProductMutation.isPending ? "Updating..." : "Update Product"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* Delete Confirmation Dialog */}
              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Product</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.
                    </p>
                    {productToDelete && (
                      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <p className="text-sm text-destructive font-medium">
                          ⚠️ Warning: This may affect customers
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          If people have joined this product's group purchase, deleting it will impact their orders.
                        </p>
                      </div>
                    )}
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => setDeleteDialogOpen(false)}
                        data-testid="button-cancel-delete"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          if (productToDelete) {
                            deleteProductMutation.mutate(productToDelete.id!);
                          }
                        }}
                        disabled={deleteProductMutation.isPending}
                        data-testid="button-confirm-delete"
                      >
                        {deleteProductMutation.isPending ? "Deleting..." : "Delete Product"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Products List */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Products</CardTitle>
                </CardHeader>
                <CardContent>
                  {productsLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <Skeleton className="w-16 h-16 rounded" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-48" />
                              <Skeleton className="h-3 w-32" />
                            </div>
                          </div>
                          <Skeleton className="h-6 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : !products || products.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">No Products Yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Start by adding your first product to begin group selling.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {products.map((product) => (
                        <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors" data-testid={`row-product-${product.id}`}>
                          <div className="flex items-center space-x-4">
                            <img 
                              src={product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"} 
                              alt={product.name}
                              className="w-16 h-16 object-cover rounded"
                              data-testid={`img-product-${product.id}`}
                            />
                            <div>
                              <h4 className="font-semibold text-foreground" data-testid={`text-product-name-${product.id}`}>
                                {product.name}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                ${product.originalPrice} • {product.groupPurchases?.length || 0} active groups
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={product.isActive ? "default" : "secondary"}>
                              {product.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleEditClick(product)}
                              data-testid={`button-edit-${product.id}`}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleDeleteClick(product)}
                              data-testid={`button-delete-${product.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Order Management</CardTitle>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : !orders || orders.length === 0 ? (
                  <div className="text-center py-8">
                    <Truck className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Orders Yet</h3>
                    <p className="text-muted-foreground">
                      Orders will appear here once customers purchase your products.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="p-4 border rounded-lg space-y-3" data-testid={`row-order-${order.id}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-foreground" data-testid={`text-order-${order.id}`}>
                              Order #{order.id}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {new Date(order.createdAt || "").toLocaleDateString()} • Qty: {order.quantity} • ${order.totalPrice}
                            </p>
                          </div>
                          <Badge className={order.status === "completed" || order.status === "delivered" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>
                            {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : "Unknown"}
                          </Badge>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          {["pending", "processing", "shipped", "out_for_delivery", "delivered"].map((status) => (
                            <Button
                              key={status}
                              variant={order.status === status ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleStatusUpdate(order.id!, status)}
                              disabled={updateOrderStatusMutation.isPending}
                              data-testid={`button-status-${status}-${order.id}`}
                            >
                              {status === "out_for_delivery" ? "Out for Delivery" : status.charAt(0).toUpperCase() + status.slice(1)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="potential">
            <Card>
              <CardHeader>
                <CardTitle>Potential Revenue Analysis</CardTitle>
                <p className="text-muted-foreground">
                  Revenue from orders placed but not yet delivered
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Potential Revenue Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-6">
                        <div className="text-center">
                          <DollarSign className="w-12 h-12 text-orange-500 mx-auto mb-3" />
                          <h3 className="text-2xl font-bold text-orange-600" data-testid="text-potential-revenue-large">
                            ${potentialRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </h3>
                          <p className="text-muted-foreground">Total Potential Revenue</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-6">
                        <div className="text-center">
                          <Package className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                          <h3 className="text-2xl font-bold text-blue-600" data-testid="text-pending-orders">
                            {orders?.filter(order => order.status !== 'delivered' && order.status !== 'completed').length || 0}
                          </h3>
                          <p className="text-muted-foreground">Pending Orders</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Pending Orders List */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-lg">Orders in Progress</h4>
                    {!orders || orders.filter(order => order.status !== 'delivered' && order.status !== 'completed').length === 0 ? (
                      <div className="text-center py-8">
                        <DollarSign className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">No Pending Orders</h3>
                        <p className="text-muted-foreground">
                          All orders have been completed or delivered.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {orders?.filter(order => order.status !== 'delivered' && order.status !== 'completed').map((order) => (
                          <div key={order.id} className="p-4 border rounded-lg bg-orange-50 border-orange-200" data-testid={`row-pending-order-${order.id}`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold text-foreground">
                                  Order #{order.id}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(order.createdAt || "").toLocaleDateString()} • Qty: {order.quantity} • ${order.totalPrice}
                                </p>
                                <p className="text-sm font-medium text-orange-600 mt-1">
                                  Expected Revenue: ${order.finalPrice}
                                </p>
                              </div>
                              <Badge className="bg-orange-100 text-orange-800">
                                {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : "Unknown"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
