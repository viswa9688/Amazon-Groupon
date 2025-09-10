import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package, AlertTriangle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CategoryConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCategory: string;
  attemptedCategory: string;
  onClearCart?: () => void;
}

export default function CategoryConflictDialog({
  open,
  onOpenChange,
  currentCategory,
  attemptedCategory,
  onClearCart
}: CategoryConflictDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <div className="absolute right-4 top-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-full hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <AlertDialogHeader className="space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          
          <AlertDialogTitle className="text-center text-xl font-semibold">
            Cannot Mix Categories
          </AlertDialogTitle>
          
          <AlertDialogDescription className="text-center space-y-4">
            <p className="text-base font-medium">
              We can't club services and groceries together. Please add them separately to cart.
            </p>
            
            <div className="flex items-center justify-center gap-3 my-4">
              <div className="flex flex-col items-center">
                <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  {currentCategory === "Groceries" ? (
                    <ShoppingCart className="h-6 w-6 text-blue-600" />
                  ) : (
                    <Package className="h-6 w-6 text-blue-600" />
                  )}
                </div>
                <span className="text-xs mt-1 font-medium">{currentCategory}</span>
              </div>
              
              <div className="px-2">
                <X className="h-5 w-5 text-red-500" />
              </div>
              
              <div className="flex flex-col items-center">
                <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                  {attemptedCategory === "Groceries" ? (
                    <ShoppingCart className="h-6 w-6 text-gray-400" />
                  ) : (
                    <Package className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <span className="text-xs mt-1 font-medium text-gray-400">{attemptedCategory}</span>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mt-2">
              Your cart currently contains <Badge variant="secondary" className="mx-1">{currentCategory}</Badge> items.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-col">
          {onClearCart && (
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={() => {
                onClearCart();
                onOpenChange(false);
              }}
            >
              Clear Cart & Add This Item
            </Button>
          )}
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Keep Current Cart
          </Button>
          
          <p className="text-xs text-center text-muted-foreground mt-2">
            Complete your current order first, or clear your cart to add different items.
          </p>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}