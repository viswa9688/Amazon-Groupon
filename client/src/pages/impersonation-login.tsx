import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";

export default function ImpersonationLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleImpersonationLogin = async () => {
      try {
        // Get token from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (!token) {
          setError("No impersonation token provided");
          setIsLoading(false);
          return;
        }

        // Call impersonation login endpoint
        const response = await apiRequest("POST", "/api/impersonation-login", { token });
        const data = await response.json();
        
        if (response.ok) {
          toast({
            title: "Impersonation Login Successful",
            description: `You are now logged in as ${data.user?.firstName || 'user'}`,
          });
          
          // Redirect to browse page
          navigate("/browse");
        } else {
          setError(data.message || "Failed to login with impersonation");
        }
      } catch (error: any) {
        console.error("Impersonation login error:", error);
        setError(error.message || "Failed to login with impersonation");
      } finally {
        setIsLoading(false);
      }
    };

    handleImpersonationLogin();
  }, [navigate, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Logging in as user...
              </h2>
              <p className="text-muted-foreground">
                Please wait while we set up your impersonation session.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Impersonation Failed
              </h2>
              <p className="text-muted-foreground mb-4">
                {error}
              </p>
              <button
                onClick={() => navigate("/admin-super")}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Return to Admin Panel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
