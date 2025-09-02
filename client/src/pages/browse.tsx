import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Users, ShoppingCart, Zap } from "lucide-react";
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-browse-title">
            Browse Products & Group Deals
          </h1>
          <p className="text-muted-foreground">
            Discover amazing products for individual purchase or join group deals to unlock incredible savings.
          </p>
        </div>

        {/* Search and Filters */}
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
                {filteredAndSortedProducts.length} products, {filteredAndSortedCollections.length} collection{filteredAndSortedCollections.length === 1 ? '' : 's'} found
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

        {/* Individual Products Section */}
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
              <p className="text-muted-foreground text-sm">
                {searchTerm || selectedCategory !== "all" 
                  ? "Try adjusting your filters or search terms." 
                  : "No individual products are available."
                }
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAndSortedProducts.map((product) => (
                <Card key={product.id} className="group hover:shadow-lg transition-shadow duration-200" data-testid={`card-product-${product.id}`}>
                  <CardContent className="p-0">
                    <Link href={`/product/${product.id}`}>
                      <div className="cursor-pointer">
                        <div className="relative">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-48 object-cover rounded-t-lg"
                            data-testid={`img-product-${product.id}`}
                          />
                          <div className="absolute top-3 right-3">
                            <Badge variant="secondary" className="bg-white/90 text-gray-800">
                              {product.category.name}
                            </Badge>
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold text-lg text-foreground mb-2 group-hover:text-primary transition-colors" data-testid={`text-product-name-${product.id}`}>
                            {product.name}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {product.description}
                          </p>
                          <div className="space-y-3">
                            {/* Pricing with discount tier display */}
                            {product.discountTiers && product.discountTiers.length > 0 ? (
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-2xl font-bold text-accent" data-testid={`text-current-price-${product.id}`}>
                                    ${product.discountTiers[0].finalPrice}
                                  </span>
                                  <span className="text-muted-foreground line-through ml-2">
                                    ${product.originalPrice}
                                  </span>
                                </div>
                                <div className="text-accent font-semibold">
                                  Save ${(parseFloat(product.originalPrice) - parseFloat(product.discountTiers[0].finalPrice)).toFixed(2)}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-2xl font-bold text-foreground" data-testid={`text-price-${product.id}`}>
                                    ${product.originalPrice}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-muted-foreground">
                                by {product.seller.firstName} {product.seller.lastName}
                              </p>
                              <Button size="sm" data-testid={`button-view-product-${product.id}`}>
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Other Collections Section */}
        <div className="mb-12">
          <div className="flex items-center space-x-2 mb-6">
            <Users className="h-6 w-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-foreground">Other Collections</h2>
            <Badge variant="secondary">{filteredAndSortedCollections.length} public collections</Badge>
          </div>
          
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="h-48 w-full rounded-xl" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : filteredAndSortedCollections.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No collections found</h3>
              <p className="text-muted-foreground text-sm">
                {searchTerm || selectedCategory !== "all" 
                  ? "Try adjusting your filters or search terms." 
                  : "No public collections are available. Check back later for new collections!"
                }
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAndSortedCollections.map((collection) => (
                <Card key={collection.id} className="group hover:shadow-lg transition-shadow duration-200" data-testid={`card-collection-${collection.id}`}>
                  <CardContent className="p-0">
                    <Link href={`/shared/${collection.shareToken}`}>
                      <div className="cursor-pointer">
                        <div className="relative">
                          <img
                            src={collection.items[0]?.product.imageUrl || "/api/placeholder/400/300"}
                            alt={collection.name}
                            className="w-full h-48 object-cover rounded-t-lg"
                            data-testid={`img-collection-${collection.id}`}
                          />
                          <div className="absolute top-3 right-3">
                            <Badge variant="secondary" className="bg-white/90 text-gray-800">
                              {collection.items.length} products
                            </Badge>
                          </div>
                          <div className="absolute top-3 left-3">
                            <Badge variant="default" className="bg-purple-600 text-white">
                              {collection.participantCount}/5 joined
                            </Badge>
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold text-lg text-foreground mb-2 group-hover:text-primary transition-colors" data-testid={`text-collection-name-${collection.id}`}>
                            {collection.name}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {collection.description}
                          </p>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-muted-foreground">
                                <p>by {collection.user.firstName} {collection.user.lastName}</p>
                                {collection.user.phoneNumber && (
                                  <p className="text-xs text-muted-foreground" data-testid={`text-owner-phone-${collection.id}`}>
                                    📞 {collection.user.phoneNumber}
                                  </p>
                                )}
                              </div>
                              <Button size="sm" data-testid={`button-view-collection-${collection.id}`}>
                                View Collection
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}