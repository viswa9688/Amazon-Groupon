import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || 'default-secret-key-for-development',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to false for development
      maxAge: sessionTtl,
    },
  });
}

export async function setupPhoneAuth(app: Express) {
  app.use(getSession());

  // Send OTP endpoint (mock)
  app.post('/api/auth/send-otp', async (req, res) => {
    try {
      const { phoneNumber, sellerIntent } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      // Mock OTP generation - in real implementation, send actual SMS
      const mockOtp = "1234";
      
      // Store OTP in session for verification
      (req.session as any).pendingAuth = {
        phoneNumber,
        otp: mockOtp,
        createdAt: new Date(),
        sellerIntent: sellerIntent || false, // Persist seller intent in session
      };

      console.log(`Mock OTP for ${phoneNumber}: ${mockOtp}`);
      
      res.json({ 
        message: "OTP sent successfully",
        // In development, return the OTP for testing
        ...(process.env.NODE_ENV === 'development' && { otp: mockOtp })
      });
    } catch (error) {
      console.error("Send OTP error:", error);
      res.status(500).json({ message: "Failed to send OTP" });
    }
  });

  // Verify OTP endpoint (mock)
  app.post('/api/auth/verify-otp', async (req, res) => {
    try {
      const { phoneNumber, otp, sellerIntent } = req.body;
      
      if (!phoneNumber || !otp) {
        return res.status(400).json({ message: "Phone number and OTP are required" });
      }

      const pendingAuth = (req.session as any).pendingAuth;
      
      if (!pendingAuth || pendingAuth.phoneNumber !== phoneNumber) {
        return res.status(400).json({ message: "Invalid verification session" });
      }

      // Mock OTP verification - accept any OTP for demo
      if (otp.length >= 4) {
        // Boolean coercion: check request body or session-stored seller intent
        const wantsSeller = sellerIntent === true || sellerIntent === 'true' || pendingAuth?.sellerIntent === true;
        
        // Create or get user
        let user = await storage.getUserByPhone(phoneNumber);
        
        if (!user) {
          user = await storage.createUserWithPhone({
            phoneNumber,
            firstName: "User",
            lastName: "",
            isSeller: wantsSeller,
          });
        } else if (wantsSeller && !user.isSeller) {
          // Update existing user to be a seller if they clicked "Sell on OneAnt"
          user = await storage.updateUserProfile(user.id, { isSeller: true });
        }

        // Set user session
        (req.session as any).user = {
          id: user.id,
          phoneNumber: user.phoneNumber,
          firstName: user.firstName,
          lastName: user.lastName,
          isSeller: user.isSeller,
        };

        // Clear pending auth
        delete (req.session as any).pendingAuth;
        
        res.json({ 
          message: "OTP verified successfully",
          user: {
            id: user.id,
            phoneNumber: user.phoneNumber,
            firstName: user.firstName,
            lastName: user.lastName,
            isSeller: user.isSeller,
          }
        });
      } else {
        res.status(400).json({ message: "Invalid OTP" });
      }
    } catch (error) {
      console.error("Verify OTP error:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      res.status(500).json({ 
        message: "Failed to verify OTP",
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Get current user endpoint (with admin impersonation support)
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      const sessionUser = (req.session as any).user;
      
      if (!sessionUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if admin is impersonating another user
      let userId = sessionUser.id;
      let isImpersonating = false;
      
      if (req.session.adminImpersonation && 
          req.session.adminImpersonation.adminUserId === 'viswa968' &&
          sessionUser.id === 'f3d84bd2-d98c-4a34-917d-c8e03a598b43') {
        userId = req.session.adminImpersonation.impersonatedUserId;
        isImpersonating = true;
      }

      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Include impersonation info for admin
      if (isImpersonating) {
        res.json({ 
          ...user, 
          _impersonation: { 
            isImpersonating: true, 
            adminUserId: req.session.adminImpersonation.adminUserId,
            originalUserId: sessionUser.id
          } 
        });
      } else {
        res.json(user);
      }
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', async (req, res) => {
    try {
      req.session.destroy(() => {
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Failed to logout" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const sessionUser = (req.session as any).user;
  
  console.log("=== isAuthenticated middleware ===");
  console.log("Session user:", sessionUser);
  
  if (!sessionUser) {
    console.log("No session user found");
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check if admin is impersonating another user
  let userId = sessionUser.id;
  if ((req.session as any).adminImpersonation && 
      (req.session as any).adminImpersonation.adminUserId === 'viswa968' &&
      sessionUser.id === 'f3d84bd2-d98c-4a34-917d-c8e03a598b43') {
    userId = (req.session as any).adminImpersonation.impersonatedUserId;
    console.log("Admin impersonation detected, using userId:", userId);
  }

  console.log("Looking up user with ID:", userId);
  const user = await storage.getUser(userId);
  
  if (!user) {
    console.log("User not found in database");
    return res.status(401).json({ message: "Unauthorized" });
  }

  console.log("User found:", {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    isSeller: user.isSeller,
    isSellerType: typeof user.isSeller,
    storeId: user.storeId,
    displayName: user.displayName
  });

  // Ensure isSeller is properly converted to boolean
  const isSeller = user.isSeller === true || user.isSeller === 'true' || user.isSeller === 1;
  console.log("isSeller converted:", isSeller, "type:", typeof isSeller);

  // Attach user to request for use in route handlers (use impersonated user if applicable)
  (req as any).user = { 
    claims: { sub: user.id },
    id: user.id,
    isSeller: isSeller,
    ...sessionUser 
  };
  
  console.log("Request user object set:", (req as any).user);
  next();
};

// Seller authorization middleware
export const isSellerAuthenticated: RequestHandler = async (req, res, next) => {
  console.log("=== isSellerAuthenticated middleware ===");
  
  // First check if user is authenticated
  const sessionUser = (req.session as any).user;
  
  if (!sessionUser) {
    console.log("No session user found");
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check if admin is impersonating another user
  let userId = sessionUser.id;
  if ((req.session as any).adminImpersonation && 
      (req.session as any).adminImpersonation.adminUserId === 'viswa968' &&
      sessionUser.id === 'f3d84bd2-d98c-4a34-917d-c8e03a598b43') {
    userId = (req.session as any).adminImpersonation.impersonatedUserId;
    console.log("Admin impersonation detected, using userId:", userId);
  }

  console.log("Looking up user with ID:", userId);
  const user = await storage.getUser(userId);
  
  if (!user) {
    console.log("User not found in database");
    return res.status(401).json({ message: "Unauthorized" });
  }

  console.log("User found:", {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    isSeller: user.isSeller,
    isSellerType: typeof user.isSeller,
    storeId: user.storeId,
    displayName: user.displayName
  });

  // Ensure isSeller is properly converted to boolean
  const isSeller = user.isSeller === true || user.isSeller === 'true' || user.isSeller === 1;
  console.log("isSeller converted:", isSeller, "type:", typeof isSeller);

  if (!isSeller) {
    console.log("User is not a seller. isSeller:", user.isSeller, "converted:", isSeller);
    return res.status(403).json({ message: "Seller access required" });
  }

  // Attach user to request for use in route handlers (use impersonated user if applicable)
  (req as any).user = { 
    claims: { sub: user.id },
    id: user.id,
    isSeller: isSeller,
    ...sessionUser 
  };
  
  console.log("Seller authentication successful");
  next();
};