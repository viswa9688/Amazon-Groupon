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
      const { phoneNumber } = req.body;
      
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
      const { phoneNumber, otp } = req.body;
      
      if (!phoneNumber || !otp) {
        return res.status(400).json({ message: "Phone number and OTP are required" });
      }

      const pendingAuth = (req.session as any).pendingAuth;
      
      if (!pendingAuth || pendingAuth.phoneNumber !== phoneNumber) {
        return res.status(400).json({ message: "Invalid verification session" });
      }

      // Mock OTP verification - accept any OTP for demo
      if (otp.length >= 4) {
        // Create or get user
        let user = await storage.getUserByPhone(phoneNumber);
        
        if (!user) {
          user = await storage.createUserWithPhone({
            phoneNumber,
            firstName: "User",
            lastName: "",
          });
        }

        // Set user session
        (req.session as any).user = {
          id: user.id,
          phoneNumber: user.phoneNumber,
          firstName: user.firstName,
          lastName: user.lastName,
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
          }
        });
      } else {
        res.status(400).json({ message: "Invalid OTP" });
      }
    } catch (error) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ message: "Failed to verify OTP" });
    }
  });

  // Get current user endpoint
  app.get('/api/auth/user', async (req, res) => {
    try {
      const sessionUser = (req.session as any).user;
      
      if (!sessionUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(sessionUser.id);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      res.json(user);
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
  
  if (!sessionUser) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await storage.getUser(sessionUser.id);
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Attach user to request for use in route handlers
  (req as any).user = { 
    claims: { sub: user.id },
    ...sessionUser 
  };
  
  next();
};