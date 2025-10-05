import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldX, Store } from "lucide-react";
import { Link, useLocation } from "wouter";

interface SellerGuardProps {
  children: React.ReactNode;
}

export default function SellerGuard({ children }: SellerGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to home if not authenticated (they need to login)
    setLocation("/");
    return null;
  }

  if (!user?.isSeller) {
    // Redirect to unauthorized page if logged in but not a seller
    setLocation("/unauthorized");
    return null;
  }

  return <>{children}</>;
}