import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter } from "lucide-react";
import type { GroupPurchaseWithDetails, Category } from "@shared/schema";

export default function Browse() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  const { data: groupPurchases, isLoading } = useQuery<GroupPurchaseWithDetails[]>({
    queryKey: ["/api/group-purchases"],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Filter and sort group purchases
  const filteredAndSortedPurchases = groupPurchases
    ?.filter((groupPurchase) => {
      const matchesSearch = groupPurchase.product.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory = 
        selectedCategory === "all" || 
        groupPurchase.product.category?.id.toString() === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    ?.sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return parseFloat(a.currentPrice.toString()) - parseFloat(b.currentPrice.toString());
        case "price-high":
          return parseFloat(b.currentPrice.toString()) - parseFloat(a.currentPrice.toString());
        case "popular":
          return (b.currentParticipants || 0) - (a.currentParticipants || 0);
        case "ending-soon":
          return new Date(a.endTime || new Date()).getTime() - new Date(b.endTime || new Date()).getTime();
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
            Browse Group Deals
          </h1>
          <p className="text-muted-foreground">
            Discover amazing products and join group purchases to unlock incredible savings.
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
                {filteredAndSortedPurchases.length} {filteredAndSortedPurchases.length === 1 ? 'deal' : 'deals'} found
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

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : filteredAndSortedPurchases.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Filter className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No deals found</h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm || selectedCategory !== "all" 
                ? "Try adjusting your filters or search terms." 
                : "No group purchases are currently active. Check back later for new deals!"
              }
            </p>
            {(searchTerm || selectedCategory !== "all") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                }}
                data-testid="button-show-all"
              >
                Show All Deals
              </Button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredAndSortedPurchases.map((groupPurchase) => (
              <ProductCard 
                key={groupPurchase.id} 
                groupPurchase={groupPurchase}
              />
            ))}
          </div>
        )}

        {/* Load More Button (if needed for pagination) */}
        {filteredAndSortedPurchases.length > 12 && (
          <div className="text-center mt-12">
            <Button variant="outline" size="lg">
              Load More Deals
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}