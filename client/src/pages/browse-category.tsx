import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import Header, { ScrollingCartButton } from "@/components/Header";
import ServiceProductCard from "@/components/ServiceProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Users, ShoppingCart, Zap, Apple, Briefcase, Heart, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import type { UserGroupWithDetails } from "@shared/schema";

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

export default function BrowseCategory() {
  const { user } = useAuth();
  const { category } = useParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");

  // Determine category ID based on URL parameter
  const categoryId = category === "groceries" ? 1 : category === "services" ? 2 : category === "pet-essentials" ? 3 : null;
  const categoryName = category === "groceries" ? "Groceries" : category === "services" ? "Services" : "Pet Essentials";
  const categoryIcon = category === "groceries" ? Apple : category === "services" ? Briefcase : Heart;
  const categoryColor = category === "groceries" ? "green" : category === "services" ? "blue" : "pink";

  const { data: collections, isLoading: collectionsLoading } = useQuery<UserGroupWithDetails[]>({
    queryKey: ["/api/collections"],
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Fetch user's own collections to exclude them from browse
  const { data: userCollections = [] } = useQuery<UserGroupWithDetails[]>({
    queryKey: ["/api/user-groups"],
    enabled: !!user,
  });

  const isLoading = collectionsLoading || productsLoading;

  // Filter products by category
  const categoryProducts = products?.filter((product) => product.category?.id === categoryId) || [];

  // Filter and sort products
  const filteredAndSortedProducts = categoryProducts
    ?.filter((product) => {
      return product.name.toLowerCase().includes(searchTerm.toLowerCase());
    })
    ?.sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return parseFloat(a.originalPrice) - parseFloat(b.originalPrice);
        case "price-high":
          return parseFloat(b.originalPrice) - parseFloat(a.originalPrice);
        case "newest":
        default:
          return a.name.localeCompare(b.name);
      }
    }) || [];

  // Filter collections that contain products from this category
  const filteredAndSortedCollections = collections
    ?.filter((collection) => {
      // Check if collection has products from this category
      const hasProductsFromCategory = collection.items.some(item => 
        item.product.category?.id === categoryId
      );
      // Check if any product in collection matches search
      const matchesSearch = searchTerm === "" || collection.items.some(item => 
        item.product.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      // Hide collections owned by current user
      const notOwnedByUser = collection.userId !== user?.id;
      return hasProductsFromCategory && matchesSearch && notOwnedByUser;
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

  const Icon = categoryIcon;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link href="/browse">
          <Button variant="ghost" className="mb-6" data-testid="button-back-to-browse">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Browse
          </Button>
        </Link>

        {/* Category Header */}
        <div className={`mb-8 p-8 rounded-3xl bg-gradient-to-br ${
          categoryColor === "green" 
            ? "from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800" 
            : categoryColor === "blue"
            ? "from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-blue-200 dark:border-blue-800"
            : "from-pink-50 to-rose-50 dark:from-pink-950 dark:to-rose-950 border-pink-200 dark:border-pink-800"
        } border-2`}>
          <div className="flex items-center space-x-4 mb-4">
            <div className={`p-4 ${
              categoryColor === "green" ? "bg-green-500" : categoryColor === "blue" ? "bg-blue-500" : "bg-pink-500"
            } text-white rounded-2xl`}>
              <Icon className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground" data-testid={`text-category-${category}`}>
                {categoryName}
              </h1>
              <p className="text-muted-foreground text-lg">
                {category === "groceries" 
                  ? "Fresh produce, daily essentials, and organic foods with bulk discounts"
                  : category === "services"
                  ? "Electronics, fashion, home goods, and professional services"
                  : "Pet grooming, training, sitting, and veterinary services"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="secondary" className={`${
              categoryColor === "green" 
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" 
                : categoryColor === "blue"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300"
            }`}>
              {categoryProducts.length} products available
            </Badge>
            <Badge variant="secondary" className={`${
              categoryColor === "green" 
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" 
                : categoryColor === "blue"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300"
            }`}>
              {filteredAndSortedCollections.length} popular groups
            </Badge>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={`Search ${categoryName.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>

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
              </SelectContent>
            </Select>
          </div>

          {/* Filter Summary */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span data-testid="text-results-count">
                {filteredAndSortedProducts.length} products found
                {searchTerm && ` for "${searchTerm}"`}
              </span>
            </div>
            
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm("")}
                data-testid="button-clear-search"
              >
                Clear Search
              </Button>
            )}
          </div>
        </div>

        {/* Products Section */}
        <div className="mb-12">
          <div className="flex items-center space-x-2 mb-6">
            <ShoppingCart className={`h-6 w-6 ${
              categoryColor === "green" ? "text-green-600" : categoryColor === "blue" ? "text-blue-600" : "text-pink-600"
            }`} />
            <h2 className="text-2xl font-bold text-foreground">{categoryName} Products</h2>
            <Badge variant="secondary">{filteredAndSortedProducts.length} items</Badge>
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
                {searchTerm 
                  ? "Try adjusting your search to find what you're looking for."
                  : `No ${categoryName.toLowerCase()} available at the moment.`}
              </p>
              {searchTerm && (
                <Button
                  variant="outline"
                  onClick={() => setSearchTerm("")}
                  data-testid="button-reset-search"
                >
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAndSortedProducts.map((product) => (
                <ServiceProductCard 
                  key={product.id} 
                  product={product}
                  testId={`product-card-${product.id}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Related Popular Groups Section */}
        {filteredAndSortedCollections.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-6">
              <Users className={`h-6 w-6 ${
                categoryColor === "green" ? "text-green-600" : categoryColor === "blue" ? "text-blue-600" : "text-pink-600"
              }`} />
              <h2 className="text-2xl font-bold text-foreground">Other Groups with {categoryName}</h2>
              <Badge variant="secondary">{filteredAndSortedCollections.length} groups</Badge>
            </div>
            
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
          </div>
        )}
      </div>
      
      {/* Floating Cart Button */}
      <ScrollingCartButton />
    </div>
  );
}