import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { GroupPurchaseWithDetails } from "@shared/schema";

export default function Home() {
  const { user } = useAuth();
  
  const { data: groupPurchases, isLoading } = useQuery<GroupPurchaseWithDetails[]>({
    queryKey: ["/api/group-purchases"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back, {(user as any)?.firstName || 'Shopper'}!
          </h1>
          <p className="text-muted-foreground">
            Discover amazing group deals and save money by shopping together.
          </p>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Active Group Purchases</h2>
          
          {!groupPurchases || groupPurchases.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                No active group purchases found. Check back later for new deals!
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {groupPurchases.map((groupPurchase) => (
                <ProductCard 
                  key={groupPurchase.id} 
                  groupPurchase={groupPurchase}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
