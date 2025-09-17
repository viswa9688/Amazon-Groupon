import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Store,
  User,
  Menu,
  LogOut,
  Users,
  UserCircle,
  MapPin,
  ChevronDown,
  Apple,
  Briefcase,
} from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PhoneAuthModal from "./PhoneAuthModal";

export default function Header() {
  const { user, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [sellerIntent, setSellerIntent] = useState(false);
  const { toast } = useToast();

  // Fetch cart items to get count
  const { data: cartItems = [] } = useQuery<any[]>({
    queryKey: ["/api/cart"],
    enabled: isAuthenticated,
  });

  const cartItemCount = cartItems.length;

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
            <h1
              className="text-2xl font-bold text-primary cursor-pointer"
              onClick={() => (window.location.href = "/")}
            >
              OneAnt
            </h1>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a
              href="/browse"
              className="text-foreground hover:text-primary font-medium transition-colors"
            >
              Browse
            </a>
            <a
              href="#"
              className="text-foreground hover:text-primary font-medium transition-colors"
            >
              How it Works
            </a>
            {isAuthenticated && (
              <>
                <a
                  href="/cart"
                  className="text-foreground hover:text-primary font-medium transition-colors flex items-center space-x-1 relative"
                >
                  <div className="relative">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 flex items-center justify-center">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    {cartItemCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs font-bold"
                        data-testid="cart-count-badge"
                      >
                        {cartItemCount}
                      </Badge>
                    )}
                  </div>
                  <span>Cart</span>
                </a>
                <a
                  href="/orders"
                  className="text-foreground hover:text-primary font-medium transition-colors"
                >
                  Orders
                </a>
                <a
                  href="/my-groups"
                  className="text-foreground hover:text-primary font-medium transition-colors"
                >
                  My Popular Groups
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
                    onClick={() => {
                      setSellerIntent(false);
                      setAuthModalOpen(true);
                    }}
                    data-testid="button-login"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Login
                  </Button>
                  <Button
                    className="bg-primary hover:bg-primary/90"
                    onClick={() => {
                      setSellerIntent(true);
                      setAuthModalOpen(true);
                    }}
                    data-testid="button-sell-on-oneant"
                  >
                    <Store className="w-4 h-4 mr-2" />
                    Sell on OneAnt
                  </Button>
                </>
              ) : (
                <>
                  {/* User Profile Dropdown */}
                  <div
                    className="relative group"
                    data-testid="user-profile-dropdown"
                  >
                    <div className="flex items-center space-x-2 cursor-pointer py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <img
                        src={
                          (user as any)?.profileImageUrl ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${(user as any)?.firstName}`
                        }
                        alt="Profile"
                        className="w-8 h-8 rounded-full"
                      />
                      <span className="text-sm font-medium text-foreground">
                        {(user as any)?.firstName && (user as any)?.lastName
                          ? `${(user as any).firstName} ${(user as any).lastName}`
                          : (user as any)?.firstName || "User"}
                      </span>
                      {(!(user as any)?.firstName ||
                        !(user as any)?.lastName) && (
                        <div
                          className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"
                          title="Complete your profile"
                        ></div>
                      )}
                      <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-hover:rotate-180" />
                    </div>

                    {/* Dropdown Menu */}
                    <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 z-50">
                      <div className="p-1">
                        <div className="flex items-center space-x-3 px-3 py-2 mb-2 bg-muted/30 rounded-md">
                          <img
                            src={
                              (user as any)?.profileImageUrl ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${(user as any)?.firstName}`
                            }
                            alt="Profile"
                            className="w-10 h-10 rounded-full"
                          />
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              {(user as any)?.firstName &&
                              (user as any)?.lastName
                                ? `${(user as any).firstName} ${(user as any).lastName}`
                                : (user as any)?.firstName || "User"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(user as any)?.phoneNumber ||
                                (user as any)?.email}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            (window.location.href = "/personal-info")
                          }
                          className="w-full flex items-center space-x-2 px-3 py-2 text-left hover:bg-muted/50 rounded-md transition-colors"
                          data-testid="dropdown-personal-info"
                        >
                          <UserCircle className="w-4 h-4" />
                          <span className="text-sm">Personal Info</span>
                        </button>

                        <button
                          onClick={() => (window.location.href = "/address")}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-left hover:bg-muted/50 rounded-md transition-colors"
                          data-testid="dropdown-address"
                        >
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm">Address</span>
                        </button>

                        <div className="border-t border-border my-1"></div>

                        <button
                          onClick={() => logoutMutation.mutate()}
                          disabled={logoutMutation.isPending}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-left hover:bg-muted/50 rounded-md transition-colors text-destructive"
                          data-testid="dropdown-logout"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="text-sm">
                            {logoutMutation.isPending
                              ? "Logging out..."
                              : "Logout"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                  {user?.isSeller && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => (window.location.href = "/seller")}
                      data-testid="button-seller-dashboard"
                    >
                      <Store className="w-4 h-4 mr-2" />
                      Dashboard
                    </Button>
                  )}
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

              {/* <Button
                variant="outline"
                size="sm"
                className="relative p-2"
                data-testid="button-cart"
              >
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <Badge className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs w-5 h-5 flex items-center justify-center rounded-full">
                  {cartItemCount || 0}
                </Badge>
              </Button> */}
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border py-4 space-y-2">
            <a
              href="/browse"
              className="block py-2 text-foreground hover:text-primary font-medium"
            >
              Browse
            </a>
            <a
              href="#"
              className="block py-2 text-foreground hover:text-primary font-medium"
            >
              How it Works
            </a>
            {isAuthenticated && (
              <>
                <a
                  href="/cart"
                  className="block py-2 text-foreground hover:text-primary font-medium flex items-center space-x-2"
                >
                  <div className="relative">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 flex items-center justify-center">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    {cartItemCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs font-bold"
                        data-testid="mobile-cart-count-badge"
                      >
                        {cartItemCount}
                      </Badge>
                    )}
                  </div>
                  <span>Cart</span>
                </a>
                <a
                  href="/orders"
                  className="block py-2 text-foreground hover:text-primary font-medium"
                >
                  Orders
                </a>
                <a
                  href="/my-groups"
                  className="block py-2 text-foreground hover:text-primary font-medium"
                >
                  My Popular Groups
                </a>
              </>
            )}
            <div className="border-t border-border pt-2">
              {!isAuthenticated ? (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      setSellerIntent(false);
                      setAuthModalOpen(true);
                    }}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Login
                  </Button>
                  <Button
                    className="w-full justify-start bg-primary hover:bg-primary/90"
                    onClick={() => {
                      setSellerIntent(true);
                      setAuthModalOpen(true);
                    }}
                  >
                    <Store className="w-4 h-4 mr-2" />
                    Sell on OneAnt
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 py-2">
                    <img
                      src={
                        (user as any)?.profileImageUrl ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${(user as any)?.firstName}`
                      }
                      alt="Profile"
                      className="w-8 h-8 rounded-full"
                    />
                    <span className="text-sm font-medium text-foreground">
                      {(user as any)?.firstName || "User"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => (window.location.href = "/personal-info")}
                  >
                    <UserCircle className="w-4 h-4 mr-2" />
                    Personal Info
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => (window.location.href = "/address")}
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Address
                  </Button>
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

      {/* Category Tabs - Show on all pages */}
      <div className="border-t border-border bg-gradient-to-r from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center space-x-0">
            <a
              href="/browse/groceries"
              className={`flex items-center space-x-2 px-6 py-3 font-medium transition-all relative ${
                window.location.pathname === "/browse/groceries"
                  ? "text-primary bg-white dark:bg-gray-800 shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-gray-800/50"
              }`}
              data-testid="tab-groceries"
            >
              <Apple className="w-4 h-4" />
              <span>Groceries</span>
              {window.location.pathname === "/browse/groceries" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
              )}
            </a>
            <a
              href="/browse/services"
              className={`flex items-center space-x-2 px-6 py-3 font-medium transition-all relative ${
                window.location.pathname === "/browse/services"
                  ? "text-primary bg-white dark:bg-gray-800 shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-gray-800/50"
              }`}
              data-testid="tab-services"
            >
              <Briefcase className="w-4 h-4" />
              <span>Services</span>
              {window.location.pathname === "/browse/services" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
              )}
            </a>
          </div>
        </div>
      </div>

      <PhoneAuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        sellerIntent={sellerIntent}
      />
    </header>
  );
}
