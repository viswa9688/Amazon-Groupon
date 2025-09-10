import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import SimpleProductCard from "@/components/SimpleProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Users, ShoppingCart, Zap, Apple, Briefcase, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import type { UserGroupWithDetails, Category } from "@shared/schema";

interface Product {
  id: number;
  name: string;
  description: string;
  originalPrice: string;
  imageUrl: string;
  discountTiers?: Array<{
    id: number;
    participantCount: number;
    finalPrice: string;
  }>;
  seller: {
    id: string;
    firstName: string;
    lastName: string;
  };
  category: {
    id: number;
    name: string;
  };
}

export default function Browse() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [showCategories, setShowCategories] = useState(true);

  const { data: collections, isLoading: collectionsLoading } = useQuery<UserGroupWithDetails[]>({
    queryKey: ["/api/collections"],
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch user's own collections to exclude them from browse
  const { data: userCollections = [] } = useQuery<UserGroupWithDetails[]>({
    queryKey: ["/api/user-groups"],
    enabled: !!user,
  });

  const isLoading = collectionsLoading || productsLoading;

  // Filter and sort products
  const filteredAndSortedProducts = products
    ?.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory = 
        selectedCategory === "all" || 
        product.category?.id.toString() === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    ?.sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return parseFloat(a.originalPrice) - parseFloat(b.originalPrice);
        case "price-high":
          return parseFloat(b.originalPrice) - parseFloat(a.originalPrice);
        case "newest":
        default:
          return a.name.localeCompare(b.name); // Sort by name for now
      }
    }) || [];

  // Filter and sort collections for "Other Collections" section
  const filteredAndSortedCollections = collections
    ?.filter((collection) => {
      // Check if any product in collection matches search
      const matchesSearch = collection.items.some(item => 
        item.product.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      // Check if any product in collection matches category
      const matchesCategory = selectedCategory === "all" || 
        collection.items.some(item => 
          item.product.category?.id.toString() === selectedCategory
        );
      // Hide collections owned by current user
      const notOwnedByUser = collection.userId !== user?.id;
      return matchesSearch && matchesCategory && notOwnedByUser;
    })
    ?.sort((a, b) => {
      switch (sortBy) {
        case "popular":
          return (b.participantCount || 0) - (a.participantCount || 0);
        case "newest":
        default:
          return new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime();
      }
    }) || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-3 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent" data-testid="text-browse-title">
            OneAnt Marketplace
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Join popular groups to unlock amazing bulk discounts on everyday essentials and premium services
          </p>
        </div>

        {/* Category Selection Cards */}
        {showCategories && (
          <div className="mb-12">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Groceries Card */}
              <Card 
                className="group cursor-pointer hover:shadow-2xl transition-all duration-300 border-2 hover:border-green-500 overflow-hidden relative bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950"
                onClick={() => window.location.href = '/browse/groceries'}
                data-testid="card-category-groceries"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/20 to-emerald-400/20 rounded-full blur-3xl"></div>
                <CardContent className="p-8">
                  <div className="flex items-start justify-between">
                    <div className="space-y-4">
                      <div className="p-4 bg-green-500 text-white rounded-2xl w-fit">
                        <Apple className="h-8 w-8" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold text-foreground mb-2">Groceries</h2>
                        <p className="text-muted-foreground text-lg mb-4">
                          Fresh produce, daily essentials, and organic foods with bulk discounts
                        </p>
                        <div className="flex items-center space-x-4 text-sm">
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Save up to 20%
                          </Badge>
                          <span className="text-muted-foreground">
                            {products?.filter(p => p.category?.id === 1).length || 0} products
                          </span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-6 w-6 text-muted-foreground group-hover:text-green-600 transition-colors mt-4" />
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {products?.filter(p => p.category?.id === 1).slice(0, 3).map((product) => (
                      <div key={product.id} className="aspect-square rounded-lg overflow-hidden">
                        <img 
                          src={product.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200"} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Services Card */}
              <Card 
                className="group cursor-pointer hover:shadow-2xl transition-all duration-300 border-2 hover:border-blue-500 overflow-hidden relative bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950"
                onClick={() => window.location.href = '/browse/services'}
                data-testid="card-category-services"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
                <CardContent className="p-8">
                  <div className="flex items-start justify-between">
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-500 text-white rounded-2xl w-fit">
                        <Briefcase className="h-8 w-8" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold text-foreground mb-2">Services</h2>
                        <p className="text-muted-foreground text-lg mb-4">
                          Electronics, fashion, home goods, and professional services
                        </p>
                        <div className="flex items-center space-x-4 text-sm">
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Group discounts
                          </Badge>
                          <span className="text-muted-foreground">
                            {products?.filter(p => p.category?.id === 2).length || 0} products
                          </span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-6 w-6 text-muted-foreground group-hover:text-blue-600 transition-colors mt-4" />
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {products?.filter(p => p.category?.id === 2).slice(0, 3).map((product) => (
                      <div key={product.id} className="aspect-square rounded-lg overflow-hidden">
                        <img 
                          src={product.imageUrl || "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=200"} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Stats */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 border-0">
                <CardContent className="p-6 text-center">
                  <Users className="h-8 w-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {collections?.reduce((acc, c) => acc + (c.participantCount || 0), 0) || 0}+
                  </p>
                  <p className="text-sm text-muted-foreground">Active Group Members</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 border-0">
                <CardContent className="p-6 text-center">
                  <ShoppingCart className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {products?.length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Products Available</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 border-0">
                <CardContent className="p-6 text-center">
                  <Zap className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {collections?.length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Active Popular Groups</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Show All Products Link */}
        {showCategories && (
          <div className="text-center mb-8">
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => setShowCategories(false)}
              className="group"
              data-testid="button-show-all-products"
            >
              View All Products
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        )}

        {/* Search and Filters - Only show when not showing categories */}
        {!showCategories && (
        <div className="mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full lg:w-48" data-testid="select-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort Filter */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full lg:w-48" data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="ending-soon">Ending Soon</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Summary */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span data-testid="text-results-count">
                {filteredAndSortedProducts.length} products, {filteredAndSortedCollections.length} popular group{filteredAndSortedCollections.length === 1 ? '' : 's'} found
              </span>
              {searchTerm && (
                <span>for "{searchTerm}"</span>
              )}
              {selectedCategory !== "all" && (
                <span>in {categories?.find(c => c.id.toString() === selectedCategory)?.name}</span>
              )}
            </div>
            
            {(searchTerm || selectedCategory !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
        )}

        {/* Individual Products Section - Only show when not showing categories */}
        {!showCategories && (
        <div className="mb-12">
          <div className="flex items-center space-x-2 mb-6">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-foreground">Individual Products</h2>
            <Badge variant="secondary">{filteredAndSortedProducts.length} products</Badge>
          </div>
          
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="h-48 w-full rounded-xl" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : filteredAndSortedProducts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <ShoppingCart className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No products found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search or filters to find what you're looking for.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                }}
                data-testid="button-reset-filters"
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAndSortedProducts.map((product) => (
                <SimpleProductCard 
                  key={product.id} 
                  product={product}
                  testId={`product-card-${product.id}`}
                />
              ))}
            </div>
          )}
        </div>
        )}

        {/* Other Popular Groups Section - Only show when not showing categories */}
        {!showCategories && (
        <div>
          <div className="flex items-center space-x-2 mb-6">
            <Users className="h-6 w-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-foreground">Other Popular Groups</h2>
            <Badge variant="secondary">{filteredAndSortedCollections.length} popular groups</Badge>
          </div>
          
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredAndSortedCollections.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No popular groups found</h3>
              <p className="text-muted-foreground mb-4">
                Start your own popular group to get others to join for discounts!
              </p>
              <Link href="/my-groups">
                <Button variant="outline" data-testid="button-create-group">
                  Create a Popular Group
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedCollections.map((collection) => {
                const potentialSavings = collection.items.reduce((sum, item) => {
                  const discountPrice = item.product.discountTiers?.[0]?.finalPrice || item.product.originalPrice;
                  const savings = (parseFloat(item.product.originalPrice.toString()) - parseFloat(discountPrice.toString())) * item.quantity;
                  return sum + savings;
                }, 0);

                const participantsNeeded = Math.max(0, 5 - (collection.participantCount || 0));
                const progress = Math.min(((collection.participantCount || 0) / 5) * 100, 100);

                return (
                  <Card 
                    key={collection.id} 
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => window.location.href = `/shared/${collection.shareToken}`}
                    data-testid={`collection-card-${collection.id}`}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg" data-testid={`collection-name-${collection.id}`}>
                            {collection.name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            By {collection.user?.firstName || 'Unknown'} {collection.user?.lastName || ''}
                          </p>
                        </div>
                        {potentialSavings > 0 && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            Save ${potentialSavings.toFixed(2)}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Product Preview */}
                      <div className="flex -space-x-2">
                        {collection.items.slice(0, 4).map((item) => (
                          <div 
                            key={item.id} 
                            className="w-10 h-10 rounded-full border-2 border-white overflow-hidden"
                          >
                            <img 
                              src={item.product.imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100"} 
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                        {collection.items.length > 4 && (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            +{collection.items.length - 4}
                          </div>
                        )}
                      </div>

                      {/* Progress */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {collection.participantCount || 0} / 5 members
                          </span>
                          {participantsNeeded > 0 ? (
                            <span className="text-orange-600 font-medium">
                              {participantsNeeded} more needed
                            </span>
                          ) : (
                            <span className="text-green-600 font-medium flex items-center">
                              <Zap className="w-3 h-3 mr-1" />
                              Active!
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              progress >= 100 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                                : 'bg-gradient-to-r from-orange-400 to-yellow-400'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{collection.items.length} items</span>
                        <span>
                          {collection.isPublic ? (
                            <Badge variant="outline" className="text-xs">Public</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Private</Badge>
                          )}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        )}
        
        {/* Back to Categories Button */}
        {!showCategories && (
          <div className="text-center mt-8">
            <Button 
              variant="ghost" 
              onClick={() => setShowCategories(true)}
              data-testid="button-back-to-categories"
            >
              ← Back to Categories
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}