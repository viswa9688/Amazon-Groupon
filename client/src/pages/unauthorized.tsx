import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldX, Home } from "lucide-react";
import { Link } from "wouter";

export default function Unauthorized() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md mx-4 border-red-200 dark:border-red-900">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-4 mb-4">
              <ShieldX className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Unauthorized Access
            </h1>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              You do not have permission to access the seller dashboard. Only authorized sellers can access this area.
            </p>
            
            <div className="w-full space-y-2">
              <Link href="/">
                <Button 
                  variant="default" 
                  className="w-full bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                  data-testid="button-go-home"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go to Home
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
