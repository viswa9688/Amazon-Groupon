import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Store, Phone, User, CheckCircle2 } from "lucide-react";

interface SellerInquiryModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SellerInquiryModal({ open, onClose }: SellerInquiryModalProps) {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/seller-inquiry", { name, phoneNumber }),
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Success!",
        description: "Thank you for your interest! We'll get back to you soon.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit your inquiry. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setName("");
    setPhoneNumber("");
    setSubmitted(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !phoneNumber) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-seller-inquiry">
        {!submitted ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Store className="w-6 h-6 text-primary" />
                </div>
                <DialogTitle className="text-2xl font-bold">Sell on OneAnt</DialogTitle>
              </div>
              <DialogDescription className="text-base pt-2">
                Interested in selling your products on OneAnt? Share your details and we'll reach out to you!
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="input-seller-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number
                </Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  data-testid="input-seller-phone"
                />
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  data-testid="button-cancel-seller-inquiry"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitMutation.isPending}
                  data-testid="button-submit-seller-inquiry"
                >
                  {submitMutation.isPending ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex flex-col items-center gap-4 my-4">
                <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full">
                  <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
                </div>
                <DialogTitle className="text-2xl font-bold text-center">Thank You!</DialogTitle>
                <DialogDescription className="text-base text-center">
                  We've received your inquiry. Our team will contact you soon to discuss how you can start selling on OneAnt.
                </DialogDescription>
              </div>
            </DialogHeader>
            <div className="flex justify-center mt-4">
              <Button onClick={handleClose} data-testid="button-close-seller-inquiry">
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
