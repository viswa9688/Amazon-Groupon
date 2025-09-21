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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  DollarSign,
  Package,
  ShoppingBag,
  TrendingUp,
  Plus,
  Edit,
  Truck,
  Trash2,
  BarChart3,
  Home,
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Users,
  Star,
  Briefcase,
  Shield,
  Phone,
  Globe,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import type {
  ProductWithDetails,
  Order,
  Category,
  InsertProduct,
} from "@shared/schema";
import { Link } from "wouter";
import SellerNotifications from "@/components/SellerNotifications";

// Service categories
const serviceCategories = [
  "Salon & Beauty",
  "Tutoring & Education",
  "Cleaning & Maintenance",
  "Repairs & Installation",
  "Fitness & Wellness",
  "Professional Services",
  "Healthcare",
  "Events & Entertainment",
  "Other",
];

// Pricing models
const pricingModels = [
  { value: "flat_fee", label: "Flat Fee" },
  { value: "hourly", label: "Hourly Rate" },
  { value: "per_session", label: "Per Session" },
  { value: "subscription", label: "Subscription" },
];

// Service modes
const serviceModes = [
  { value: "in_person", label: "In-Person Only" },
  { value: "online", label: "Online Only" },
  { value: "hybrid", label: "Both In-Person & Online" },
];

// Product form schema - Base fields
const baseProductSchema = z.object({
  shopId: z.string().min(1, "Shop is required"),
  name: z.string().min(1, "Product/Service name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  categoryId: z.string().min(1, "Category is required"),
  imageUrl: z
    .string()
    .url("Please enter a valid image URL")
    .optional()
    .or(z.literal("")),
  originalPrice: z.string().min(1, "Price is required"),
  discountPrice: z.string().min(1, "Discount price is required"),
  minimumParticipants: z.string().min(1, "Minimum participants required"),
  maximumParticipants: z.string().min(1, "Maximum participants required"),
  offerValidTill: z.date().optional(),
});

// Service-specific fields
const serviceProviderSchema = z.object({
  // Provider Profile
  legalName: z.string().optional(),
  displayName: z.string().optional(),
  serviceCategory: z.string().optional(),
  licenseNumber: z.string().optional(),
  yearsInBusiness: z.string().optional(),
  insuranceValidTill: z.date().optional(),

  // Location & Coverage
  serviceMode: z.string().default("in_person"),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  locality: z.string().optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  serviceAreaPolygon: z.any().optional(), // GeoJSON

  // Service Details
  serviceName: z.string().optional(),
  durationMinutes: z.string().optional(),
  pricingModel: z.string().default("flat_fee"),
  materialsIncluded: z.boolean().default(false),
  ageRestriction: z.string().optional(),
  taxClass: z.string().optional(),

  // Availability
  availabilityType: z.string().default("by_appointment"),
  operatingHours: z.any().optional(), // JSON for operating hours
  advanceBookingDays: z.string().default("7"),
  cancellationPolicyUrl: z.string().optional(),
  rescheduleAllowed: z.boolean().default(true),

  // Compliance
  insurancePolicyNumber: z.string().optional(),
  liabilityWaiverRequired: z.boolean().default(false),
  healthSafetyCert: z.string().optional(),

  // Staff
  staff: z
    .array(
      z.object({
        name: z.string(),
        skills: z.string(),
        availability: z.string(),
        rating: z.string(),
      }),
    )
    .optional(),

  // Reviews & Ratings
  avgRating: z.string().optional(),
  reviewCount: z.string().optional(),
  highlightedTestimonials: z.any().optional(),
});

// Grocery-specific fields
const groceryProductSchema = z.object({
  // Basic Product Information
  productTitle: z.string().optional(),
  productDescription: z.string().optional(),
  brand: z.string().optional(),
  
  // Product Identification
  skuId: z.string().optional(),
  skuCode: z.string().optional(),
  gtin: z.string().optional(),
  barcodeSymbology: z.string().optional(),
  
  // Product Specifications
  uom: z.string().optional(), // Unit of measure
  netContentValue: z.string().optional(),
  netContentUom: z.string().optional(),
  isVariableWeight: z.boolean().default(false),
  pluCode: z.string().optional(),
  
  // Product Attributes
  dietaryTags: z.string().optional(), // JSON string of dietary tags
  allergens: z.string().optional(), // JSON string of allergens
  countryOfOrigin: z.string().optional(),
  temperatureZone: z.string().optional(),
  shelfLifeDays: z.string().optional(),
  storageInstructions: z.string().optional(),
  substitutable: z.boolean().default(true),
  
  // Physical Properties
  grossWeightG: z.string().optional(),
  
  // Pricing Information
  listPriceCents: z.string().optional(),
  salePriceCents: z.string().optional(),
  effectiveFrom: z.date().optional(),
  effectiveTo: z.date().optional(),
  taxClass: z.string().optional(),
  
  // Inventory Management
  inventoryOnHand: z.string().optional(),
  inventoryReserved: z.string().optional(),
  inventoryStatus: z.string().default("in_stock"),
});

// Combined form schema
const productFormSchema = baseProductSchema.merge(serviceProviderSchema).merge(groceryProductSchema);

type ProductFormData = z.infer<typeof productFormSchema>;

export default function SellerDashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("products");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<ProductWithDetails | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] =
    useState<ProductWithDetails | null>(null);

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

  const { data: products, isLoading: productsLoading } = useQuery<
    ProductWithDetails[]
  >({
    queryKey: ["/api/seller/products"],
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    enabled: isAuthenticated,
  });

  // Get available shops
  const { data: shops = [], isLoading: shopsLoading } = useQuery<any[]>({
    queryKey: ["/api/seller/shops"],
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
      shopId: "",
      name: "",
      description: "",
      categoryId: "",
      imageUrl: "",
      originalPrice: "",
      discountPrice: "",
      minimumParticipants: "10",
      maximumParticipants: "1000",
      offerValidTill: undefined,
      // Service defaults
      serviceMode: "in_person",
      pricingModel: "flat_fee",
      materialsIncluded: false,
      availabilityType: "by_appointment",
      advanceBookingDays: "7",
      rescheduleAllowed: true,
      liabilityWaiverRequired: false,
      // Grocery defaults
      isVariableWeight: false,
      substitutable: true,
      inventoryStatus: "in_stock",
    },
  });

  // Watch shop selection to automatically set category
  const selectedShopId = form.watch("shopId");
  const selectedShop = shops.find((shop: any) => shop.id === selectedShopId);

  // Automatically set category based on shop type
  useEffect(() => {
    if (selectedShop) {
      const categoryId = selectedShop.shopType === "groceries" ? "1" : "2";
      form.setValue("categoryId", categoryId);
    } else {
      // Reset category when no shop is selected
      form.setValue("categoryId", "");
    }
  }, [selectedShop, form]);

  // Watch category to show/hide service fields
  const selectedCategoryId = form.watch("categoryId");

  // Check for service category - grocery shops should show product fields, service shops should show service fields
  const isServiceCategory =
    selectedCategoryId === "2" && selectedShop?.shopType === "services";
  
  // Check for grocery category
  const isGroceryCategory =
    selectedCategoryId === "1" && selectedShop?.shopType === "groceries";

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

  const editSelectedCategoryId = editForm.watch("categoryId");
  const isEditServiceCategory = editSelectedCategoryId === "2";

  // Add product mutation
  const addProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const productData: any = {
        shopId: data.shopId,
        name: data.name,
        description: data.description,
        categoryId: parseInt(data.categoryId),
        originalPrice: data.originalPrice,
        minimumParticipants: parseInt(data.minimumParticipants),
        maximumParticipants: parseInt(data.maximumParticipants),
        imageUrl: data.imageUrl || undefined,
        offerValidTill: data.offerValidTill?.toISOString() || undefined,
        discountPrice: data.discountPrice,
      };

      // Add service-specific data if Services category
      if (data.categoryId === "2") {
        productData.serviceProvider = {
          legalName: data.legalName,
          displayName: data.displayName,
          serviceCategory: data.serviceCategory,
          licenseNumber: data.licenseNumber,
          yearsInBusiness: data.yearsInBusiness
            ? parseInt(data.yearsInBusiness)
            : undefined,
          serviceMode: data.serviceMode,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          locality: data.locality,
          region: data.region,
          postalCode: data.postalCode,
          serviceName: data.serviceName,
          durationMinutes: data.durationMinutes
            ? parseInt(data.durationMinutes)
            : undefined,
          pricingModel: data.pricingModel,
          materialsIncluded: data.materialsIncluded,
          ageRestriction: data.ageRestriction
            ? parseInt(data.ageRestriction)
            : undefined,
          availabilityType: data.availabilityType,
          advanceBookingDays: parseInt(data.advanceBookingDays || "7"),
          rescheduleAllowed: data.rescheduleAllowed,
          insurancePolicyNumber: data.insurancePolicyNumber,
          liabilityWaiverRequired: data.liabilityWaiverRequired,
        };
      }

      // Add grocery-specific data if Groceries category
      if (data.categoryId === "1") {
        productData.groceryProduct = {
          productTitle: data.productTitle,
          productDescription: data.productDescription,
          brand: data.brand,
          skuId: data.skuId,
          skuCode: data.skuCode,
          gtin: data.gtin,
          barcodeSymbology: data.barcodeSymbology,
          uom: data.uom,
          netContentValue: data.netContentValue ? parseFloat(data.netContentValue) : undefined,
          netContentUom: data.netContentUom,
          isVariableWeight: data.isVariableWeight,
          pluCode: data.pluCode,
          dietaryTags: data.dietaryTags,
          allergens: data.allergens,
          countryOfOrigin: data.countryOfOrigin,
          temperatureZone: data.temperatureZone,
          shelfLifeDays: data.shelfLifeDays ? parseInt(data.shelfLifeDays) : undefined,
          storageInstructions: data.storageInstructions,
          substitutable: data.substitutable,
          grossWeightG: data.grossWeightG ? parseFloat(data.grossWeightG) : undefined,
          listPriceCents: data.listPriceCents ? parseInt(data.listPriceCents) : undefined,
          salePriceCents: data.salePriceCents ? parseInt(data.salePriceCents) : undefined,
          effectiveFrom: data.effectiveFrom?.toISOString() || undefined,
          effectiveTo: data.effectiveTo?.toISOString() || undefined,
          taxClass: data.taxClass,
          inventoryOnHand: data.inventoryOnHand ? parseInt(data.inventoryOnHand) : undefined,
          inventoryReserved: data.inventoryReserved ? parseInt(data.inventoryReserved) : undefined,
          inventoryStatus: data.inventoryStatus,
        };
      }

      return apiRequest("POST", "/api/seller/products", productData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seller/products"] });
      toast({
        title: "Success!",
        description: isServiceCategory
          ? "Service added successfully."
          : "Product added successfully.",
      });
      setProductDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add product/service",
        variant: "destructive",
      });
    },
  });

  // Edit product mutation
  const editProductMutation = useMutation({
    mutationFn: async ({
      productId,
      data,
    }: {
      productId: number;
      data: ProductFormData;
    }) => {
      const productData: any = {
        name: data.name,
        description: data.description,
        categoryId: parseInt(data.categoryId),
        originalPrice: data.originalPrice,
        minimumParticipants: parseInt(data.minimumParticipants),
        maximumParticipants: parseInt(data.maximumParticipants),
        imageUrl: data.imageUrl || undefined,
        offerValidTill: data.offerValidTill?.toISOString() || undefined,
        discountPrice: data.discountPrice,
      };

      // Add service-specific data if Services category
      if (data.categoryId === "2") {
        productData.serviceProvider = {
          legalName: data.legalName,
          displayName: data.displayName,
          serviceCategory: data.serviceCategory,
          licenseNumber: data.licenseNumber,
          yearsInBusiness: data.yearsInBusiness
            ? parseInt(data.yearsInBusiness)
            : undefined,
          serviceMode: data.serviceMode,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          locality: data.locality,
          region: data.region,
          postalCode: data.postalCode,
          serviceName: data.serviceName,
          durationMinutes: data.durationMinutes
            ? parseInt(data.durationMinutes)
            : undefined,
          pricingModel: data.pricingModel,
          materialsIncluded: data.materialsIncluded,
          ageRestriction: data.ageRestriction
            ? parseInt(data.ageRestriction)
            : undefined,
          availabilityType: data.availabilityType,
          advanceBookingDays: parseInt(data.advanceBookingDays || "7"),
          rescheduleAllowed: data.rescheduleAllowed,
          insurancePolicyNumber: data.insurancePolicyNumber,
          liabilityWaiverRequired: data.liabilityWaiverRequired,
        };
      }

      return apiRequest(
        "PATCH",
        `/api/seller/products/${productId}`,
        productData,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seller/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/group-purchases"] });
      toast({
        title: "Success!",
        description: isEditServiceCategory
          ? "Service updated successfully."
          : "Product updated successfully.",
      });
      setEditDialogOpen(false);
      setEditingProduct(null);
      editForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product/service",
        variant: "destructive",
      });
    },
  });

  // Update order status mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: number;
      status: string;
    }) => {
      return apiRequest("PATCH", `/api/seller/orders/${orderId}/status`, {
        status,
      });
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

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!productDialogOpen) {
      form.reset({
        shopId: "",
        name: "",
        description: "",
        categoryId: "",
        imageUrl: "",
        originalPrice: "",
        discountPrice: "",
        minimumParticipants: "10",
        maximumParticipants: "1000",
        offerValidTill: undefined,
        serviceMode: "in_person",
        pricingModel: "flat_fee",
        materialsIncluded: false,
        availabilityType: "by_appointment",
        advanceBookingDays: "7",
        rescheduleAllowed: true,
        liabilityWaiverRequired: false,
      });
    }
  }, [productDialogOpen, form]);

  const onEditSubmit = (data: ProductFormData) => {
    if (editingProduct) {
      editProductMutation.mutate({ productId: editingProduct.id!, data });
    }
  };

  const handleEditClick = (product: ProductWithDetails) => {
    setEditingProduct(product);

    // Get discount price from discount tiers if available
    const discountPrice =
      product.discountTiers && product.discountTiers.length > 0
        ? product.discountTiers[0].finalPrice.toString()
        : product.originalPrice.toString();

    const formData: any = {
      name: product.name,
      description: product.description || "",
      categoryId: product.categoryId?.toString() || "",
      imageUrl: product.imageUrl || "",
      originalPrice: product.originalPrice.toString(),
      discountPrice: discountPrice,
      minimumParticipants: product.minimumParticipants.toString(),
      maximumParticipants: product.maximumParticipants.toString(),
      offerValidTill: product.offerValidTill
        ? new Date(product.offerValidTill)
        : undefined,
    };

    // Load service provider data if exists
    if (product.serviceProvider) {
      const sp = product.serviceProvider;
      formData.legalName = sp.legalName || "";
      formData.displayName = sp.displayName || "";
      formData.serviceCategory = sp.serviceCategory || "";
      formData.licenseNumber = sp.licenseNumber || "";
      formData.yearsInBusiness = sp.yearsInBusiness?.toString() || "";
      formData.insuranceValidTill = sp.insuranceValidTill
        ? new Date(sp.insuranceValidTill)
        : undefined;
      formData.serviceMode = sp.serviceMode || "in_person";
      formData.addressLine1 = sp.addressLine1 || "";
      formData.addressLine2 = sp.addressLine2 || "";
      formData.locality = sp.locality || "";
      formData.region = sp.region || "";
      formData.postalCode = sp.postalCode || "";
      formData.serviceAreaPolygon = sp.serviceAreaPolygon || null;
      formData.serviceName = sp.serviceName || "";
      formData.durationMinutes = sp.durationMinutes?.toString() || "";
      formData.pricingModel = sp.pricingModel || "flat_fee";
      formData.materialsIncluded = sp.materialsIncluded || false;
      formData.ageRestriction = sp.ageRestriction?.toString() || "";
      formData.taxClass = sp.taxClass || "";
      formData.availabilityType = sp.availabilityType || "by_appointment";
      formData.operatingHours = sp.operatingHours || null;
      formData.advanceBookingDays = sp.advanceBookingDays?.toString() || "7";
      formData.cancellationPolicyUrl = sp.cancellationPolicyUrl || "";
      formData.rescheduleAllowed = sp.rescheduleAllowed ?? true;
      formData.insurancePolicyNumber = sp.insurancePolicyNumber || "";
      formData.liabilityWaiverRequired = sp.liabilityWaiverRequired || false;
      formData.healthSafetyCert = sp.healthSafetyCert || "";

      // Load staff data
      if (sp.staff && sp.staff.length > 0) {
        formData.staff = sp.staff.map((staffMember: any) => ({
          name: staffMember.name || "",
          skills: Array.isArray(staffMember.skills)
            ? staffMember.skills.join(", ")
            : staffMember.skills || "",
          availability: staffMember.availability
            ? JSON.stringify(staffMember.availability)
            : "",
          rating: staffMember.rating?.toString() || "",
        }));
      }

      // Load reviews data
      formData.avgRating = sp.avgRating?.toString() || "0";
      formData.reviewCount = sp.reviewCount?.toString() || "0";
      formData.highlightedTestimonials = sp.highlightedTestimonials || null;
    }

    editForm.reset(formData);
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
        const data = JSON.parse(error.message.split(": ")[1] || "{}");
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
            <h1
              className="text-3xl font-bold text-foreground mb-2"
              data-testid="text-dashboard-title"
            >
              Seller Dashboard
            </h1>
            <p className="text-muted-foreground">
              Welcome back, {(user as any)?.firstName || "Seller"}! Here's your
              store overview.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <SellerNotifications />
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
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Revenue
                  </p>
                  <p
                    className="text-2xl font-bold text-foreground"
                    data-testid="text-revenue"
                  >
                    $
                    {totalRevenue.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
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
                  <p className="text-sm font-medium text-muted-foreground">
                    Potential Revenue
                  </p>
                  <p
                    className="text-2xl font-bold text-orange-600"
                    data-testid="text-potential-revenue"
                  >
                    $
                    {potentialRevenue.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
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
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Groups
                  </p>
                  <p
                    className="text-2xl font-bold text-foreground"
                    data-testid="text-active-groups"
                  >
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
                  <p className="text-sm font-medium text-muted-foreground">
                    Products
                  </p>
                  <p
                    className="text-2xl font-bold text-foreground"
                    data-testid="text-total-products"
                  >
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
                  <p className="text-sm font-medium text-muted-foreground">
                    Growth
                  </p>
                  <p
                    className="text-2xl font-bold text-accent"
                    data-testid="text-growth-percentage"
                  >
                    {growthPercentage >= 0 ? "+" : ""}
                    {growthPercentage.toFixed(1)}%
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
                <Dialog
                  open={productDialogOpen}
                  onOpenChange={setProductDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      className="bg-primary hover:bg-primary/90"
                      data-testid="button-add-product"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Groceries/Service
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New Groceries/Service</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                      >
                        {/* Shop Selection - FIRST */}
                        <FormField
                          control={form.control}
                          name="shopId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Shop *</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-shop">
                                    <SelectValue placeholder="Select a shop first" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {shops?.map((shop: any) => (
                                    <SelectItem key={shop.id} value={shop.id}>
                                      {shop.displayName} ({shop.storeType})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Choose the shop to automatically set the
                                category
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Category Selection - Auto-determined by shop */}
                        <FormField
                          control={form.control}
                          name="categoryId"
                          render={({ field }) => {
                            const selectedCategory = categories?.find(
                              (cat) => cat.id.toString() === field.value,
                            );
                            return (
                              <FormItem>
                                <FormLabel>Category *</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value}
                                  disabled
                                >
                                  <FormControl>
                                    <SelectTrigger data-testid="select-category">
                                      <SelectValue
                                        placeholder={
                                          selectedCategory
                                            ? selectedCategory.name
                                            : selectedShop
                                              ? "Auto-determined by shop"
                                              : "Select a shop first"
                                        }
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {categories?.map((category) => (
                                      <SelectItem
                                        key={category.id}
                                        value={category.id.toString()}
                                      >
                                        {category.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormDescription>
                                  {selectedCategory
                                    ? `Category: ${selectedCategory.name} (auto-selected based on shop type)`
                                    : "Category is automatically determined by the selected shop"}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />

                        {/* Basic Fields */}
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {isServiceCategory
                                  ? "Service Name"
                                  : "Product Name"}{" "}
                                *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={
                                    isServiceCategory
                                      ? "Enter service name"
                                      : "Enter product name"
                                  }
                                  {...field}
                                  data-testid="input-product-name"
                                />
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
                              <FormLabel>Description *</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder={
                                    isServiceCategory
                                      ? "Describe your service"
                                      : "Describe your product"
                                  }
                                  rows={4}
                                  {...field}
                                  data-testid="input-product-description"
                                />
                              </FormControl>
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
                                <Input
                                  placeholder="https://example.com/image.jpg"
                                  {...field}
                                  data-testid="input-image-url"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Service-Specific Fields */}
                        {isServiceCategory && (
                          <>
                            <div className="space-y-4 border-t pt-4">
                              <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Briefcase className="w-5 h-5" />
                                Service Provider Details
                              </h3>

                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="displayName"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        Business Display Name
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="Your business name"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="serviceCategory"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Service Category</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select service type" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {serviceCategories.map((cat) => (
                                            <SelectItem key={cat} value={cat}>
                                              {cat}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="yearsInBusiness"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Years in Business</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          placeholder="5"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="licenseNumber"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        License Number (if applicable)
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="LIC-123456"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="insuranceValidTill"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        Insurance Valid Till
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          type="date"
                                          {...field}
                                          value={
                                            field.value
                                              ? new Date(field.value)
                                                  .toISOString()
                                                  .split("T")[0]
                                              : ""
                                          }
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>

                            <div className="space-y-4 border-t pt-4">
                              <h3 className="text-lg font-semibold flex items-center gap-2">
                                <MapPin className="w-5 h-5" />
                                Service Location & Coverage
                              </h3>

                              <FormField
                                control={form.control}
                                name="serviceMode"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Service Mode</FormLabel>
                                    <FormControl>
                                      <RadioGroup
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        className="flex flex-row space-x-4"
                                      >
                                        {serviceModes.map((mode) => (
                                          <div
                                            key={mode.value}
                                            className="flex items-center space-x-2"
                                          >
                                            <RadioGroupItem
                                              value={mode.value}
                                              id={mode.value}
                                            />
                                            <Label htmlFor={mode.value}>
                                              {mode.label}
                                            </Label>
                                          </div>
                                        ))}
                                      </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {(form.watch("serviceMode") === "in_person" ||
                                form.watch("serviceMode") === "hybrid") && (
                                <>
                                  <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                      control={form.control}
                                      name="addressLine1"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Address Line 1</FormLabel>
                                          <FormControl>
                                            <Input
                                              placeholder="123 Main St"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={form.control}
                                      name="addressLine2"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Address Line 2</FormLabel>
                                          <FormControl>
                                            <Input
                                              placeholder="Suite 100"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <div className="grid grid-cols-3 gap-4">
                                    <FormField
                                      control={form.control}
                                      name="locality"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>City</FormLabel>
                                          <FormControl>
                                            <Input
                                              placeholder="New York"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={form.control}
                                      name="region"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>State/Region</FormLabel>
                                          <FormControl>
                                            <Input
                                              placeholder="NY"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={form.control}
                                      name="postalCode"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Postal Code</FormLabel>
                                          <FormControl>
                                            <Input
                                              placeholder="10001"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <FormField
                                    control={form.control}
                                    name="serviceAreaPolygon"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>
                                          Service Area Coverage (GeoJSON)
                                        </FormLabel>
                                        <FormControl>
                                          <Textarea
                                            placeholder='Optional: Enter GeoJSON for service area coverage, e.g., {"type": "Polygon", "coordinates": [...]}'
                                            className="min-h-[100px]"
                                            {...field}
                                            value={
                                              field.value
                                                ? JSON.stringify(field.value)
                                                : ""
                                            }
                                            onChange={(e) => {
                                              try {
                                                field.onChange(
                                                  e.target.value
                                                    ? JSON.parse(e.target.value)
                                                    : null,
                                                );
                                              } catch {
                                                field.onChange(e.target.value);
                                              }
                                            }}
                                          />
                                        </FormControl>
                                        <FormDescription>
                                          Define the geographical area where you
                                          provide services
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </>
                              )}
                            </div>

                            <div className="space-y-4 border-t pt-4">
                              <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Clock className="w-5 h-5" />
                                Service Details & Availability
                              </h3>

                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="durationMinutes"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        Service Duration (minutes)
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          placeholder="60"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="pricingModel"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Pricing Model</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select pricing model" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {pricingModels.map((model) => (
                                            <SelectItem
                                              key={model.value}
                                              value={model.value}
                                            >
                                              {model.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="advanceBookingDays"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        Advance Booking (days)
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          placeholder="7"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        How far in advance can customers book?
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="ageRestriction"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        Age Restriction (if any)
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          placeholder="18"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="taxClass"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Tax Class</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select tax class" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="services_basic">
                                            Services Basic
                                          </SelectItem>
                                          <SelectItem value="personal_training">
                                            Personal Training
                                          </SelectItem>
                                          <SelectItem value="beauty_services">
                                            Beauty Services
                                          </SelectItem>
                                          <SelectItem value="exempt">
                                            Tax Exempt
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="availabilityType"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Availability Type</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select availability type" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="fixed_hours">
                                            Fixed Hours
                                          </SelectItem>
                                          <SelectItem value="by_appointment">
                                            By Appointment
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="materialsIncluded"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                      <div className="space-y-0.5">
                                        <FormLabel>
                                          Materials Included
                                        </FormLabel>
                                        <FormDescription>
                                          Are materials/supplies included?
                                        </FormDescription>
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="rescheduleAllowed"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                      <div className="space-y-0.5">
                                        <FormLabel>
                                          Allow Rescheduling
                                        </FormLabel>
                                        <FormDescription>
                                          Can customers reschedule?
                                        </FormDescription>
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>

                            <div className="space-y-4 border-t pt-4">
                              <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Shield className="w-5 h-5" />
                                Compliance & Insurance
                              </h3>

                              <FormField
                                control={form.control}
                                name="insurancePolicyNumber"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      Insurance Policy Number (optional)
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="POL-123456789"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="liabilityWaiverRequired"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                      <FormLabel>
                                        Liability Waiver Required
                                      </FormLabel>
                                      <FormDescription>
                                        Do customers need to sign a liability
                                        waiver?
                                      </FormDescription>
                                    </div>
                                    <FormControl>
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />

                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="operatingHours"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Operating Hours</FormLabel>
                                      <FormControl>
                                        <Textarea
                                          placeholder="E.g., Mon-Fri: 9:00 AM - 6:00 PM, Sat: 10:00 AM - 4:00 PM"
                                          className="min-h-[80px]"
                                          {...field}
                                          value={
                                            field.value
                                              ? JSON.stringify(field.value)
                                              : ""
                                          }
                                          onChange={(e) => {
                                            try {
                                              field.onChange(
                                                e.target.value
                                                  ? JSON.parse(e.target.value)
                                                  : null,
                                              );
                                            } catch {
                                              field.onChange(e.target.value);
                                            }
                                          }}
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        Enter your business hours
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="cancellationPolicyUrl"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        Cancellation Policy URL
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          type="url"
                                          placeholder="https://example.com/cancellation-policy"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        Link to your cancellation policy
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <FormField
                                control={form.control}
                                name="healthSafetyCert"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      Health & Safety Certificate URL
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        type="url"
                                        placeholder="https://example.com/certificate.pdf"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      Link to health and safety certification
                                      (optional)
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="space-y-4 border-t pt-4">
                              <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Users className="w-5 h-5" />
                                Staff Management (Optional)
                              </h3>

                              <FormField
                                control={form.control}
                                name="staff"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Staff Members</FormLabel>
                                    <FormControl>
                                      <div className="space-y-4">
                                        {!field.value ||
                                        field.value.length === 0 ? (
                                          <div className="text-sm text-muted-foreground p-4 border-2 border-dashed rounded-lg">
                                            No staff members added yet
                                          </div>
                                        ) : (
                                          field.value.map(
                                            (staff: any, index: number) => (
                                              <div
                                                key={index}
                                                className="p-4 border rounded-lg space-y-3"
                                              >
                                                <div className="flex justify-between">
                                                  <h4 className="font-medium">
                                                    Staff Member {index + 1}
                                                  </h4>
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                      const newStaff = [
                                                        ...(field.value || []),
                                                      ];
                                                      newStaff.splice(index, 1);
                                                      field.onChange(newStaff);
                                                    }}
                                                  >
                                                    <Trash2 className="w-4 h-4" />
                                                  </Button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                  <Input
                                                    placeholder="Staff name"
                                                    value={staff.name || ""}
                                                    onChange={(e) => {
                                                      const newStaff = [
                                                        ...(field.value || []),
                                                      ];
                                                      newStaff[index] = {
                                                        ...newStaff[index],
                                                        name: e.target.value,
                                                      };
                                                      field.onChange(newStaff);
                                                    }}
                                                  />
                                                  <Input
                                                    placeholder="Skills (comma separated)"
                                                    value={staff.skills || ""}
                                                    onChange={(e) => {
                                                      const newStaff = [
                                                        ...(field.value || []),
                                                      ];
                                                      newStaff[index] = {
                                                        ...newStaff[index],
                                                        skills: e.target.value,
                                                      };
                                                      field.onChange(newStaff);
                                                    }}
                                                  />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                  <Input
                                                    placeholder="Availability (e.g., Mon-Fri 9-5)"
                                                    value={
                                                      staff.availability || ""
                                                    }
                                                    onChange={(e) => {
                                                      const newStaff = [
                                                        ...(field.value || []),
                                                      ];
                                                      newStaff[index] = {
                                                        ...newStaff[index],
                                                        availability:
                                                          e.target.value,
                                                      };
                                                      field.onChange(newStaff);
                                                    }}
                                                  />
                                                  <Input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    max="5"
                                                    placeholder="Rating (0-5)"
                                                    value={staff.rating || ""}
                                                    onChange={(e) => {
                                                      const newStaff = [
                                                        ...(field.value || []),
                                                      ];
                                                      newStaff[index] = {
                                                        ...newStaff[index],
                                                        rating: e.target.value,
                                                      };
                                                      field.onChange(newStaff);
                                                    }}
                                                  />
                                                </div>
                                              </div>
                                            ),
                                          )
                                        )}
                                        <Button
                                          type="button"
                                          variant="outline"
                                          className="w-full"
                                          onClick={() => {
                                            const newStaff = [
                                              ...(field.value || []),
                                              {
                                                name: "",
                                                skills: "",
                                                availability: "",
                                                rating: "",
                                              },
                                            ];
                                            field.onChange(newStaff);
                                          }}
                                        >
                                          <Plus className="w-4 h-4 mr-2" />
                                          Add Staff Member
                                        </Button>
                                      </div>
                                    </FormControl>
                                    <FormDescription>
                                      Add staff members who will provide this
                                      service
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="space-y-4 border-t pt-4">
                              <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Star className="w-5 h-5" />
                                Reviews & Ratings
                              </h3>

                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="avgRating"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Average Rating</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          step="0.1"
                                          min="0"
                                          max="5"
                                          placeholder="0.0"
                                          {...field}
                                          disabled
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        Auto-calculated from customer reviews
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="reviewCount"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Total Reviews</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          placeholder="0"
                                          {...field}
                                          disabled
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        Number of customer reviews
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <FormField
                                control={form.control}
                                name="highlightedTestimonials"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      Highlighted Testimonials
                                    </FormLabel>
                                    <FormControl>
                                      <Textarea
                                        placeholder="Featured customer testimonials will appear here"
                                        className="min-h-[100px]"
                                        {...field}
                                        value={
                                          field.value
                                            ? JSON.stringify(field.value)
                                            : ""
                                        }
                                        disabled
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      Best testimonials from customers
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </>
                        )}

                        {/* Pricing Fields - Show for both categories */}
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="originalPrice"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Original Price ($) *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    {...field}
                                    data-testid="input-original-price"
                                  />
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
                                <FormLabel>
                                  Group Discount Price ($) *
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    {...field}
                                    data-testid="input-discount-price"
                                  />
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
                                <FormLabel>Minimum Participants *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    data-testid="input-min-participants"
                                  />
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
                                <FormLabel>Maximum Participants *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    data-testid="input-max-participants"
                                  />
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
                                        format(field.value, "PPP")
                                      ) : (
                                        <span>Pick a date</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-auto p-0"
                                  align="start"
                                >
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) => date < new Date()}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Grocery-Specific Fields */}
                        {isGroceryCategory && (
                          <>
                            <div className="space-y-4 border-t pt-4">
                              <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Package className="w-5 h-5" />
                                Grocery Product Details
                              </h3>

                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="brand"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Brand</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="e.g. Coca-Cola, Nestle"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="countryOfOrigin"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Country of Origin</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="e.g. India, USA"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-3 gap-4">
                                <FormField
                                  control={form.control}
                                  name="skuCode"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>SKU Code</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="SKU-123456"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="gtin"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>GTIN/Barcode</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="1234567890123"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="uom"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Unit of Measure</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="kg, g, lbs, oz"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="netContentValue"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Net Content Value</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          step="0.001"
                                          placeholder="500"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="netContentUom"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Net Content Unit</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="g, ml, kg"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="temperatureZone"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Temperature Zone</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select temperature zone" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="ambient">Ambient</SelectItem>
                                          <SelectItem value="refrigerated">Refrigerated</SelectItem>
                                          <SelectItem value="frozen">Frozen</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="shelfLifeDays"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Shelf Life (Days)</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          placeholder="30"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="space-y-4">
                                <FormField
                                  control={form.control}
                                  name="dietaryTags"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Dietary Tags (comma-separated)</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="vegan, gluten-free, organic, halal"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        Enter dietary tags separated by commas
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="allergens"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Allergens (comma-separated)</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="nuts, dairy, eggs, soy"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        Enter allergens separated by commas
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="storageInstructions"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Storage Instructions</FormLabel>
                                      <FormControl>
                                        <Textarea
                                          placeholder="Store in a cool, dry place. Keep refrigerated after opening."
                                          rows={3}
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="inventoryOnHand"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Inventory On Hand</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          placeholder="100"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="inventoryStatus"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Inventory Status</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select status" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="in_stock">In Stock</SelectItem>
                                          <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                                          <SelectItem value="discontinued">Discontinued</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="flex items-center space-x-4">
                                <FormField
                                  control={form.control}
                                  name="isVariableWeight"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                      <div className="space-y-1 leading-none">
                                        <FormLabel>Variable Weight Product</FormLabel>
                                        <FormDescription>
                                          Check if this product is sold by weight
                                        </FormDescription>
                                      </div>
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="substitutable"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                      <div className="space-y-1 leading-none">
                                        <FormLabel>Substitutable</FormLabel>
                                        <FormDescription>
                                          Allow substitutions for this product
                                        </FormDescription>
                                      </div>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          </>
                        )}

                        <div className="flex justify-end space-x-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setProductDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={addProductMutation.isPending}
                            data-testid="button-submit-product"
                          >
                            {addProductMutation.isPending
                              ? "Adding..."
                              : isServiceCategory
                                ? "Add Service"
                                : "Add Product"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Products List */}
              {productsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : products && products.length > 0 ? (
                <div className="grid gap-4">
                  {products.map((product: ProductWithDetails) => (
                    <Card key={product.id} className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3
                              className="text-lg font-semibold text-foreground"
                              data-testid={`text-product-name-${product.id}`}
                            >
                              {product.name}
                            </h3>
                            <Badge
                              variant={
                                product.categoryId === 1
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {product.categoryId === 1
                                ? "Groceries"
                                : "Services"}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mb-3">
                            {product.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              <span className="line-through text-muted-foreground">
                                ${product.originalPrice}
                              </span>
                              <span className="font-semibold text-green-600">
                                $
                                {product.discountTiers?.[0]?.finalPrice ||
                                  product.originalPrice}
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {product.minimumParticipants}-
                              {product.maximumParticipants} participants
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
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
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteClick(product)}
                            data-testid={`button-delete-${product.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No products yet
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Start by adding your first product or service
                  </p>
                  <Button
                    onClick={() => setProductDialogOpen(true)}
                    data-testid="button-add-first-product"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Product
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Orders Tab Content */}
          <TabsContent value="orders">
            <div className="space-y-6">
              {ordersLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : orders && orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order: Order) => (
                    <Card key={order.id} className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-semibold">Order #{order.id}</h4>
                          <p className="text-sm text-muted-foreground">
                            Status: {order.status}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleStatusUpdate(order.id!, "processing")
                            }
                          >
                            Processing
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              handleStatusUpdate(order.id!, "shipped")
                            }
                          >
                            Ship
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No orders yet</h3>
                  <p className="text-muted-foreground">
                    Orders will appear here when customers make purchases.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Potential Revenue Tab Content */}
          <TabsContent value="potential">
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">
                Potential Revenue Tracking
              </h3>
              <p className="text-muted-foreground">
                Advanced revenue analytics coming soon.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Product Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Product/Service</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form
                onSubmit={editForm.handleSubmit(onEditSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="originalPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description *</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="minimumParticipants"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Participants *</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
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
                        <FormLabel>Max Participants *</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={editProductMutation.isPending}
                  >
                    {editProductMutation.isPending
                      ? "Updating..."
                      : "Update Product"}
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
            <div className="py-4">
              <p>
                Are you sure you want to delete "
                <strong>{productToDelete?.name}</strong>"?
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end space-x-4">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
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
              >
                {deleteProductMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
