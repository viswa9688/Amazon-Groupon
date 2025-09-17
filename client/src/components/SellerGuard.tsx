import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldX, Store } from "lucide-react";
import { Link } from "wouter";

interface SellerGuardProps {
  children: React.ReactNode;
}

export default function SellerGuard({ children }: SellerGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2">
              <Store className="h-8 w-8 text-blue-500" />
              <h1 className="text-2xl font-bold text-gray-900">Seller Access Required</h1>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Please log in to access the seller dashboard.
            </p>
            <div className="mt-6">
              <Link href="/">
                <Button variant="outline" className="w-full">
                  Go to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user?.isSeller) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2">
              <ShieldX className="h-8 w-8 text-red-500" />
              <h1 className="text-2xl font-bold text-gray-900">Seller Access Required</h1>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              You need seller permissions to access this page. Contact support to become a seller.
            </p>
            <div className="mt-6">
              <Link href="/">
                <Button variant="outline" className="w-full">
                  Go to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}