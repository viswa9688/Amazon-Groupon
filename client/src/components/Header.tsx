import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Heart,
  HelpCircle,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PhoneAuthModal from "./PhoneAuthModal";
import SellerNotifications from "./SellerNotifications";
import SellerInquiryModal from "./SellerInquiryModal";
import FeedbackModal from "./FeedbackModal";
import howItWorksImage from "@assets/Info_1759688857805.png";

export default function Header() {
  const { user, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [sellerIntent, setSellerIntent] = useState(false);
  const [showComingSoonDialog, setShowComingSoonDialog] = useState(false);
  const [showHowItWorksDialog, setShowHowItWorksDialog] = useState(false);
  const [showSellerInquiryModal, setShowSellerInquiryModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const { toast } = useToast();

  // Check if admin is impersonating a user
  const isImpersonating = (user as any)?._impersonation?.isImpersonating;

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
    <header className="bg-card/95 backdrop-blur-sm shadow-sm border-b border-border sticky top-0 z-50">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-center py-2 text-sm font-medium">
          🔍 Admin Impersonation Mode - Viewing as {(user as any)?.firstName} {(user as any)?.lastName}
        </div>
      )}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Logo */}
          <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer" onClick={() => (window.location.href = "/")}>
            <svg width="74" height="28" viewBox="0 0 74 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 sm:h-8 w-auto">
              <path fillRule="evenodd" clipRule="evenodd" d="M19.1512 27.0219C24.3342 24.9699 28 19.913 28 14C28 6.26801 21.732 0 14 0C6.26801 0 0 6.26801 0 14C0 21.732 6.26801 28 14 28C14.3903 28 14.7768 27.984 15.159 27.9527V14.3281H10.4969V11.6758C11.7274 11.6211 12.5887 11.5391 13.0809 11.4297C13.8648 11.2565 14.5028 10.9102 14.995 10.3906C15.3322 10.0352 15.5874 9.5612 15.7606 8.96875C15.8609 8.61328 15.911 8.34896 15.911 8.17578H19.1512V27.0219Z" fill="#FF274E"/>
              <path d="M34.2388 9.93945C35.2687 8.62695 37.0369 7.9707 39.5435 7.9707C41.175 7.9707 42.6242 8.29427 43.8911 8.94141C45.158 9.58854 45.7915 10.8099 45.7915 12.6055V19.4414C45.7915 19.9154 45.8006 20.4896 45.8188 21.1641C45.8462 21.6745 45.9237 22.0208 46.0513 22.2031C46.1789 22.3854 46.3703 22.5358 46.6255 22.6543V23.2285H42.3872C42.2687 22.9277 42.1867 22.6452 42.1411 22.3809C42.0955 22.1165 42.0591 21.8158 42.0317 21.4785C41.494 22.0618 40.8742 22.5586 40.1724 22.9688C39.3338 23.4518 38.3859 23.6934 37.3286 23.6934C35.9797 23.6934 34.8631 23.3105 33.979 22.5449C33.104 21.7702 32.6665 20.6764 32.6665 19.2637C32.6665 17.4316 33.3729 16.1055 34.7856 15.2852C35.5604 14.8385 36.6997 14.5195 38.2036 14.3281L39.5298 14.1641C40.2498 14.0729 40.7648 13.959 41.0747 13.8223C41.6307 13.5853 41.9087 13.2161 41.9087 12.7148C41.9087 12.1042 41.6945 11.6849 41.2661 11.457C40.8468 11.2201 40.2271 11.1016 39.4067 11.1016C38.4862 11.1016 37.8345 11.3294 37.4517 11.7852C37.1782 12.1224 36.9959 12.5781 36.9048 13.1523H33.145C33.2271 11.849 33.5916 10.778 34.2388 9.93945ZM37.1372 20.4121C37.5018 20.7129 37.9484 20.8633 38.4771 20.8633C39.3156 20.8633 40.0858 20.6172 40.7876 20.125C41.4985 19.6328 41.8677 18.735 41.895 17.4316V15.9824C41.6489 16.1374 41.3983 16.265 41.1431 16.3652C40.897 16.4564 40.5552 16.543 40.1177 16.625L39.2427 16.7891C38.4224 16.9349 37.8345 17.1126 37.479 17.3223C36.8774 17.6777 36.5767 18.2292 36.5767 18.9766C36.5767 19.6419 36.7635 20.1204 37.1372 20.4121Z" fill="#2A2A2A"/>
              <path d="M56.2778 11.2109C54.9562 11.2109 54.0493 11.7715 53.5571 12.8926C53.3019 13.485 53.1743 14.2415 53.1743 15.1621V23.2285H49.2915V8.35352H53.0513V10.5273C53.5526 9.76172 54.0265 9.21029 54.4731 8.87305C55.2752 8.27148 56.2915 7.9707 57.522 7.9707C59.0623 7.9707 60.3201 8.3763 61.2954 9.1875C62.2798 9.98958 62.772 11.3249 62.772 13.1934V23.2285H58.7798V14.1641C58.7798 13.3802 58.675 12.7786 58.4653 12.3594C58.0825 11.5937 57.3534 11.2109 56.2778 11.2109Z" fill="#2A2A2A"/>
              <path d="M73.2036 20.4531V23.3652L71.3579 23.4336C69.5168 23.4974 68.2589 23.1784 67.5845 22.4766C67.147 22.0299 66.9282 21.3418 66.9282 20.4121V11.2383H64.8501V8.46289H66.9282V4.30664H70.7837V8.46289H73.2036V11.2383H70.7837V19.1133C70.7837 19.724 70.8612 20.1068 71.0161 20.2617C71.1711 20.4076 71.645 20.4805 72.438 20.4805C72.5565 20.4805 72.6795 20.4805 72.8071 20.4805C72.9438 20.4714 73.076 20.4622 73.2036 20.4531Z" fill="#2A2A2A"/>
            </svg>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-6 xl:space-x-8">
            <a
              href="/browse"
              className="text-foreground hover:text-primary font-medium transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
              data-testid="link-browse"
            >
              Browse
            </a>
            <a
              href="/about"
              className="text-foreground hover:text-primary font-medium transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
              data-testid="link-about"
            >
              About Us
            </a>
            <a
              href="/faq"
              className="text-foreground hover:text-primary font-medium transition-colors px-3 py-2 rounded-lg hover:bg-muted/50 flex items-center gap-1"
              data-testid="link-faq"
            >
              <HelpCircle className="w-4 h-4" />
              FAQ
            </a>
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowHowItWorksDialog(true);
              }}
              className="text-foreground hover:text-primary font-medium transition-colors px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer"
              data-testid="link-how-it-works"
            >
              How it Works
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFeedbackModal(true)}
              data-testid="button-feedback"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Feedback
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowSellerInquiryModal(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid="button-sell-on-oneant"
            >
              <Store className="w-4 h-4 mr-2" />
              Sell on OneAnt
            </Button>
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
              className="lg:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center space-x-3 xl:space-x-4">
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

                        {isImpersonating && (
                          <button
                            onClick={() => {
                              // Stop impersonation by calling the stop endpoint
                              fetch('/api/admin/stop-impersonation', {
                                method: 'POST',
                                credentials: 'include'
                              }).then(() => {
                                window.location.reload();
                              });
                            }}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-left hover:bg-muted/50 rounded-md transition-colors text-orange-600"
                          >
                            <LogOut className="w-4 h-4" />
                            <span className="text-sm">Stop Impersonation</span>
                          </button>
                        )}

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
                  {/* Debug: Show notifications for all authenticated users */}
                  {isAuthenticated && (
                    <>
                      <SellerNotifications />
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
                    </>
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
          <div className="lg:hidden border-t border-border py-4 space-y-2 bg-card/95 backdrop-blur-sm">
            <a
              href="/browse"
              className="block py-2 text-foreground hover:text-primary font-medium"
              data-testid="mobile-link-browse"
            >
              Browse
            </a>
            <a
              href="/about"
              className="block py-2 text-foreground hover:text-primary font-medium"
              data-testid="mobile-link-about"
            >
              About Us
            </a>
            <a
              href="/faq"
              className="block py-2 text-foreground hover:text-primary font-medium flex items-center gap-2"
              data-testid="mobile-link-faq"
            >
              <HelpCircle className="w-4 h-4" />
              FAQ
            </a>
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowHowItWorksDialog(true);
              }}
              className="block py-2 text-foreground hover:text-primary font-medium text-left w-full"
              data-testid="mobile-link-how-it-works"
            >
              How it Works
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFeedbackModal(true)}
              className="w-full mt-2"
              data-testid="mobile-button-feedback"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Feedback
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowSellerInquiryModal(true)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-2"
              data-testid="mobile-button-sell-on-oneant"
            >
              <Store className="w-4 h-4 mr-2" />
              Sell on OneAnt
            </Button>
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
                    onClick={() => {
                      setSellerIntent(false);
                      setAuthModalOpen(true);
                    }}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Login
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
          <div className="flex items-center justify-center space-x-0 overflow-x-auto">
            <a
              href="/browse/groceries"
              className={`flex items-center space-x-2 px-4 sm:px-6 py-3 font-medium transition-all relative whitespace-nowrap ${
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
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowComingSoonDialog(true);
              }}
              className="flex items-center space-x-2 px-4 sm:px-6 py-3 font-medium transition-all relative whitespace-nowrap text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-gray-800/50 cursor-pointer"
              data-testid="tab-services"
            >
              <Briefcase className="w-4 h-4" />
              <span>Services</span>
              <Badge className="bg-red-600 text-white hover:bg-red-700 text-xs px-2 py-0" data-testid="badge-tab-coming-soon-services">
                Coming Soon
              </Badge>
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowComingSoonDialog(true);
              }}
              className="flex items-center space-x-2 px-4 sm:px-6 py-3 font-medium transition-all relative whitespace-nowrap text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-gray-800/50 cursor-pointer"
              data-testid="tab-pet-essentials"
            >
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">Pet Essentials</span>
              <span className="sm:hidden">Pets</span>
              <Badge className="bg-red-600 text-white hover:bg-red-700 text-xs px-2 py-0" data-testid="badge-tab-coming-soon-pet-essentials">
                Coming Soon
              </Badge>
            </button>
          </div>
        </div>
      </div>

      <PhoneAuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        sellerIntent={sellerIntent}
      />

      {/* Coming Soon Dialog */}
      <Dialog open={showComingSoonDialog} onOpenChange={setShowComingSoonDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-coming-soon-header">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Coming Soon!</DialogTitle>
            <DialogDescription className="text-base pt-2">
              This category is currently under development and will be available soon. Stay tuned for exciting group buying opportunities!
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mt-4">
            <Button onClick={() => setShowComingSoonDialog(false)} data-testid="button-close-dialog-header">
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* How it Works Dialog */}
      <Dialog open={showHowItWorksDialog} onOpenChange={setShowHowItWorksDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-how-it-works">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              How it Works
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Start your group buying journey in 3 simple steps
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <img 
              src={howItWorksImage} 
              alt="How OneAnt Works - Group Buying Setup" 
              className="w-full h-auto rounded-lg shadow-md"
              data-testid="image-how-it-works"
            />
          </div>
          <div className="flex justify-end mt-4">
            <Button 
              onClick={() => setShowHowItWorksDialog(false)} 
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              data-testid="button-close-dialog-how-it-works"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Seller Inquiry Modal */}
      <SellerInquiryModal 
        open={showSellerInquiryModal} 
        onClose={() => setShowSellerInquiryModal(false)} 
      />

      {/* Feedback Modal */}
      <FeedbackModal 
        open={showFeedbackModal} 
        onClose={() => setShowFeedbackModal(false)} 
      />
    </header>
  );
}

export function ScrollingCartButton() {
  const { isAuthenticated } = useAuth();
  
  const { data: cartItems = [] } = useQuery<any[]>({
    queryKey: ["/api/cart"],
    enabled: isAuthenticated,
  });

  const cartItemCount = cartItems.length;

  if (!isAuthenticated || cartItemCount === 0) {
    return null;
  }

  return (
    <a
      href="/cart"
      className="fixed bottom-6 right-6 z-50 lg:hidden"
      data-testid="button-floating-cart"
    >
      <div className="relative">
        <div className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 animate-pulse">
          <ShoppingCart className="h-6 w-6" />
        </div>
        <Badge
          variant="destructive"
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold bg-white text-red-600 border-2 border-red-600"
          data-testid="floating-cart-count-badge"
        >
          {cartItemCount}
        </Badge>
      </div>
    </a>
  );
}
