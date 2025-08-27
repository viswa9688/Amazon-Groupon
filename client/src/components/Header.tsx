import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Store, User, Menu, LogOut, Users } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PhoneAuthModal from "./PhoneAuthModal";

export default function Header() {
  const { user, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Logged out",
        description: "You've been successfully logged out.",
      });
      window.location.href = "/";
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <header className="bg-card shadow-sm border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="bg-primary text-primary-foreground w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xl">
              1A
            </div>
            <h1 className="text-2xl font-bold text-primary cursor-pointer" onClick={() => window.location.href = "/"}>
              OneAnt
            </h1>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="/browse" className="text-foreground hover:text-primary font-medium transition-colors">
              Browse
            </a>
            <a href="#" className="text-foreground hover:text-primary font-medium transition-colors">
              How it Works
            </a>
            {isAuthenticated && (
              <>
                <a href="/orders" className="text-foreground hover:text-primary font-medium transition-colors">
                  Orders
                </a>
                <a href="/my-groups" className="text-foreground hover:text-primary font-medium transition-colors">
                  My Groups
                </a>
              </>
            )}
          </nav>

          {/* User Actions */}
          <div className="flex items-center space-x-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center space-x-4">
              {!isAuthenticated ? (
                <>
                  <Button 
                    variant="ghost" 
                    onClick={() => setAuthModalOpen(true)}
                    data-testid="button-login"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Login
                  </Button>
                  <Button 
                    className="bg-primary hover:bg-primary/90"
                    onClick={() => setAuthModalOpen(true)}
                    data-testid="button-sell-on-oneant"
                  >
                    <Store className="w-4 h-4 mr-2" />
                    Sell on OneAnt
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-2" data-testid="user-info">
                    <img 
                      src={(user as any)?.profileImageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${(user as any)?.firstName}`}
                      alt="Profile"
                      className="w-8 h-8 rounded-full"
                    />
                    <span className="text-sm font-medium text-foreground">
                      {(user as any)?.firstName || 'User'}
                    </span>
                  </div>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = "/seller"}
                    data-testid="button-seller-dashboard"
                  >
                    <Store className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                  <Button 
                    variant="ghost"
                    size="sm"
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                    data-testid="button-logout"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {logoutMutation.isPending ? "Logging out..." : "Logout"}
                  </Button>
                </>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                className="relative"
                data-testid="button-cart"
              >
                <ShoppingCart className="w-4 h-4" />
                <Badge className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs w-5 h-5 flex items-center justify-center">
                  0
                </Badge>
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border py-4 space-y-2">
            <a href="/browse" className="block py-2 text-foreground hover:text-primary font-medium">
              Browse
            </a>
            <a href="#" className="block py-2 text-foreground hover:text-primary font-medium">
              How it Works
            </a>
            {isAuthenticated && (
              <>
                <a href="/orders" className="block py-2 text-foreground hover:text-primary font-medium">
                  Orders
                </a>
                <a href="/my-groups" className="block py-2 text-foreground hover:text-primary font-medium">
                  My Groups
                </a>
              </>
            )}
            <div className="border-t border-border pt-2">
              {!isAuthenticated ? (
                <div className="space-y-2">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start"
                    onClick={() => setAuthModalOpen(true)}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Login
                  </Button>
                  <Button 
                    className="w-full justify-start bg-primary hover:bg-primary/90"
                    onClick={() => setAuthModalOpen(true)}
                  >
                    <Store className="w-4 h-4 mr-2" />
                    Sell on OneAnt
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 py-2">
                    <img 
                      src={(user as any)?.profileImageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${(user as any)?.firstName}`}
                      alt="Profile"
                      className="w-8 h-8 rounded-full"
                    />
                    <span className="text-sm font-medium text-foreground">
                      {(user as any)?.firstName || 'User'}
                    </span>
                  </div>
                  <Button 
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {logoutMutation.isPending ? "Logging out..." : "Logout"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <PhoneAuthModal 
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </header>
  );
}
