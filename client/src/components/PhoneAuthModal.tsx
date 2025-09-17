import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Phone, ArrowRight, ArrowLeft } from "lucide-react";

interface PhoneAuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  redirectTo?: string;
}

export default function PhoneAuthModal({ open, onClose, onSuccess, redirectTo }: PhoneAuthModalProps) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const { toast } = useToast();

  const sendOtpMutation = useMutation({
    mutationFn: async (phone: string) => {
      return apiRequest("POST", "/api/auth/send-otp", { phoneNumber: phone });
    },
    onSuccess: () => {
      setStep("otp");
      toast({
        title: "OTP Sent",
        description: `Verification code sent to ${phoneNumber}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send OTP. Please try again.",
        variant: "destructive",
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; otp: string }) => {
      return apiRequest("POST", "/api/auth/verify-otp", data);
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "You've been logged in successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onClose();
      
      // Execute custom success callback if provided
      if (onSuccess) {
        onSuccess();
      } else if (redirectTo) {
        // Sanitize redirect URL for security - only allow internal paths
        const sanitizedRedirect = redirectTo.startsWith('/') && !redirectTo.startsWith('//') 
          ? redirectTo 
          : '/browse';
        window.location.href = sanitizedRedirect;
      }
      // Default behavior: stay on current page (no redirect)
    },
    onError: () => {
      toast({
        title: "Invalid OTP",
        description: "Please check your verification code and try again.",
        variant: "destructive",
      });
    },
  });

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 10) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid phone number.",
        variant: "destructive",
      });
      return;
    }
    sendOtpMutation.mutate(phoneNumber);
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the verification code.",
        variant: "destructive",
      });
      return;
    }
    verifyOtpMutation.mutate({ phoneNumber, otp });
  };

  const handleClose = () => {
    setStep("phone");
    setPhoneNumber("");
    setOtp("");
    onClose();
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, "");
    
    // Format as (xxx) xxx-xxxx
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Phone className="w-5 h-5 text-primary" />
            <span>{step === "phone" ? "Enter Phone Number" : "Verify Your Number"}</span>
          </DialogTitle>
        </DialogHeader>

        {step === "phone" ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phoneNumber}
                onChange={handlePhoneChange}
                maxLength={14}
                data-testid="input-phone-number"
              />
              <p className="text-sm text-muted-foreground">
                We'll send you a verification code to confirm your number.
              </p>
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={sendOtpMutation.isPending || phoneNumber.length < 14}
              data-testid="button-send-otp"
            >
              {sendOtpMutation.isPending ? (
                "Sending..."
              ) : (
                <>
                  Send Verification Code
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                type="text"
                placeholder="Enter 4-6 digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                maxLength={6}
                className="text-center text-2xl tracking-wider"
                data-testid="input-otp"
              />
              <p className="text-sm text-muted-foreground">
                Enter the verification code sent to {phoneNumber}
              </p>
            </div>

            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                }}
                className="flex-1"
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={verifyOtpMutation.isPending || otp.length < 4}
                data-testid="button-verify-otp"
              >
                {verifyOtpMutation.isPending ? "Verifying..." : "Verify & Login"}
              </Button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => sendOtpMutation.mutate(phoneNumber)}
                disabled={sendOtpMutation.isPending}
                className="text-sm text-primary hover:underline"
                data-testid="button-resend-otp"
              >
                Didn't receive the code? Resend
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}