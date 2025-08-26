import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Package, ShoppingBag, TrendingUp } from "lucide-react";
import type { ProductWithDetails } from "@shared/schema";

export default function SellerDashboard() {
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

  const { data: products, isLoading: productsLoading } = useQuery<ProductWithDetails[]>({
    queryKey: ["/api/seller/products"],
    enabled: isAuthenticated,
    retry: false,
  });

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

  // Calculate dashboard stats
  const totalProducts = products?.length || 0;
  const activeGroups = products?.reduce((acc, product) => 
    acc + (product.groupPurchases?.length || 0), 0) || 0;
  const totalRevenue = products?.reduce((acc, product) => {
    const productRevenue = product.groupPurchases?.reduce((groupAcc, group) => 
      groupAcc + ((group.currentParticipants || 0) * parseFloat(group.currentPrice.toString())), 0) || 0;
    return acc + productRevenue;
  }, 0) || 0;

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
          <Button className="bg-primary hover:bg-primary/90" data-testid="button-add-product">
            <Package className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                  <p className="text-2xl font-bold text-accent">+12.5%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Products */}
        <Card className="mb-8">
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
                <Button className="bg-primary hover:bg-primary/90">
                  <Package className="w-4 h-4 mr-2" />
                  Add Your First Product
                </Button>
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
                      <Button variant="outline" size="sm" data-testid={`button-edit-${product.id}`}>
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Group Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Group Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {!products || products.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground">No group activity yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {products
                  .filter(product => product.groupPurchases && product.groupPurchases.length > 0)
                  .slice(0, 5)
                  .map((product) => 
                    product.groupPurchases?.map((group) => (
                      <div key={`${product.id}-${group.id}`} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div>
                          <div className="font-medium text-sm" data-testid={`text-group-product-${group.id}`}>
                            {product.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {group.currentParticipants}/{group.targetParticipants} people joined
                          </div>
                        </div>
                        <div className="text-accent font-semibold" data-testid={`text-group-revenue-${group.id}`}>
                          +${((group.currentParticipants || 0) * parseFloat(group.currentPrice.toString())).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))
                  )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
