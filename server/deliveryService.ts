import { storage } from "./storage";
import { geocodingService } from "./geocodingService";

interface Address {
  addressLine: string;
  city: string;
  state?: string;
  country: string;
  pincode: string;
}

interface DeliveryCalculation {
  distance: number; // in kilometers
  duration: number; // in minutes
  deliveryCharge: number;
  isFreeDelivery: boolean;
  reason: string;
}

interface DeliverySummary {
  totalDeliveryCharge: number;
  deliveryDetails: Array<{
    sellerId: string;
    sellerName: string;
    distance: number;
    deliveryCharge: number;
    isFreeDelivery: boolean;
    reason: string;
  }>;
  hasDeliveryCharges: boolean;
  isBCAddress: boolean;
  bcValidationError?: string;
}

interface BCValidationResult {
  isInBC: boolean;
  canDeliver: boolean;
  error?: string;
  reason?: string;
}

export class DeliveryService {
  private readonly GOOGLE_API_KEY = process.env.GOOGLE_DISTANCE_MATRIX_API_KEY;
  private readonly FREE_DELIVERY_DISTANCE_KM = 10;
  private readonly DELIVERY_RATE_PER_KM = 5.99; // $5.99 per km beyond 10km
  private readonly BC_PROVINCE_NAMES = [
    'British Columbia',
    'BC',
    'Colombie-Britannique', // French name
    'Colombie Britannique'
  ];
  // Fixed store location - configured for British Columbia operations
  private readonly STORE_ADDRESS = {
    addressLine: "456 Granville Street",
    city: "Vancouver",
    state: "British Columbia",
    country: "Canada",
    pincode: "V6C 1T4"
  };

  // BC-specific delivery constraints
  private readonly BC_DELIVERY_CONSTRAINTS = {
    // Group order constraints
    group: {
      minimumOrderValue: 50.00, // $50 minimum for group orders
      deliveryFee: 5.99, // $5.99 delivery fee for group orders
      freeDeliveryThreshold: 100.00 // Free delivery for group orders over $100
    },
    // Individual order constraints
    individual: {
      minimumOrderValue: 25.00, // $25 minimum for individual orders
      deliveryFee: 3.99, // $3.99 delivery fee for individual orders
      freeDeliveryThreshold: 75.00 // Free delivery for individual orders over $75
    }
  };

  constructor() {
    // Log configuration status on startup
    if (this.GOOGLE_API_KEY) {
      console.log('✅ Google Distance Matrix API key configured');
    } else {
      console.log('⚠️  Google Distance Matrix API key not configured - using fallback distance calculations');
      console.log('   Set GOOGLE_DISTANCE_MATRIX_API_KEY environment variable to enable real distance calculations');
    }
  }

  /**
   * Validate if address is in British Columbia and can receive delivery
   */
  async validateBCAddress(buyerAddress: Address): Promise<BCValidationResult> {
    try {
      const geocodingResult = await geocodingService.verifyBCAddress(buyerAddress);
      
      if (geocodingResult.error) {
        // If the error is due to missing API key, allow delivery but log a warning
        if (geocodingResult.error.includes('Google Geocoding API key not configured')) {
          console.warn('⚠️  Google Geocoding API key not configured - allowing delivery without BC validation');
          return {
            isInBC: true, // Assume BC for now
            canDeliver: true,
            reason: 'Delivery allowed (BC validation disabled - API key not configured)'
          };
        }
        
        return {
          isInBC: false,
          canDeliver: false,
          error: geocodingResult.error,
          reason: 'Address validation failed'
        };
      }

      if (!geocodingResult.isInBC) {
        return {
          isInBC: false,
          canDeliver: false,
          reason: `Address is not in British Columbia. Found: ${geocodingResult.province}`
        };
      }

      return {
        isInBC: true,
        canDeliver: true,
        reason: `Address verified in British Columbia (${geocodingResult.province})`
      };

    } catch (error) {
      console.error('Error validating BC address:', error);
      return {
        isInBC: false,
        canDeliver: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        reason: 'Address validation failed'
      };
    }
  }

  /**
   * Calculate delivery charges from shop location to buyer address
   * Now includes BC validation and shop-specific settings
   */
  async calculateDeliveryCharges(
    buyerAddress: Address,
    orderTotal: number = 0,
    orderType: 'group' | 'individual' = 'individual',
    sellerId?: string
  ): Promise<DeliveryCalculation> {
    try {
      // First validate BC address
      const bcValidation = await this.validateBCAddress(buyerAddress);
      
      if (!bcValidation.canDeliver) {
        throw new Error(`Delivery not available: ${bcValidation.reason}`);
      }

      // Correct address data inconsistency: if state is British Columbia, country should be Canada
      const correctedBuyerAddress = { ...buyerAddress };
      if (buyerAddress.state && this.BC_PROVINCE_NAMES.some(bcName => 
        buyerAddress.state!.toLowerCase().includes(bcName.toLowerCase())
      )) {
        correctedBuyerAddress.country = 'Canada';
        console.log('Corrected buyer address country to Canada for BC address:', correctedBuyerAddress);
      }

      // Get shop-specific address and settings
      let shopAddress = this.STORE_ADDRESS; // Default fallback
      let shopDeliveryFee = 5.99; // Default fallback
      let shopFreeDeliveryThreshold = 75.00; // Default fallback
      let shopMinimumOrderValue = 25.00; // Default fallback

      if (sellerId) {
        try {
          // Import storage dynamically to avoid circular dependency
          const { storage } = await import('./storage');
          const seller = await storage.getUser(sellerId);
          
          if (seller && seller.isSeller) {
            // Use shop-specific address if available
            if (seller.addressLine1 && seller.locality && seller.region && seller.country) {
              shopAddress = {
                addressLine: seller.addressLine1,
                city: seller.locality,
                state: seller.region,
                country: seller.country,
                pincode: seller.postalCode || ''
              };
              console.log('Using shop-specific address:', shopAddress);
            }

            // Use shop-specific delivery settings
            if (seller.deliveryFee !== undefined && seller.deliveryFee !== null) {
              shopDeliveryFee = parseFloat(seller.deliveryFee.toString());
            }
            if (seller.freeDeliveryThreshold !== undefined && seller.freeDeliveryThreshold !== null) {
              shopFreeDeliveryThreshold = parseFloat(seller.freeDeliveryThreshold.toString());
            }
            if (seller.minimumOrderValue !== undefined && seller.minimumOrderValue !== null) {
              shopMinimumOrderValue = parseFloat(seller.minimumOrderValue.toString());
            }
            
            console.log('Using shop-specific delivery settings:', {
              deliveryFee: shopDeliveryFee,
              freeDeliveryThreshold: shopFreeDeliveryThreshold,
              minimumOrderValue: shopMinimumOrderValue
            });
          }
        } catch (error) {
          console.warn('Failed to fetch shop-specific data, using defaults:', error);
        }
      }

      // Format shop address
      const shopAddressFormatted = this.formatAddress(shopAddress);

      // Format buyer address (use corrected address)
      const buyerAddressFormatted = this.formatAddress(correctedBuyerAddress);

      // Calculate distance using Google Distance Matrix API
      const distanceData = await this.getDistanceFromGoogle(shopAddressFormatted, buyerAddressFormatted);

      // Calculate delivery charges based on distance and shop-specific settings
      const deliveryCalculation = this.calculateShopDeliveryFee(
        distanceData.distance,
        distanceData.duration,
        orderTotal,
        shopDeliveryFee,
        shopFreeDeliveryThreshold,
        shopMinimumOrderValue
      );

      return deliveryCalculation;
    } catch (error) {
      console.error(`Error calculating delivery charges:`, error);
      throw error;
    }
  }

  /**
   * Get delivery summary for group orders (single store location)
   */
  async getDeliverySummary(buyerAddress: Address, orderTotal: number = 0, orderType: 'group' | 'individual' = 'group'): Promise<DeliverySummary> {
    try {
      // First validate BC address
      const bcValidation = await this.validateBCAddress(buyerAddress);
      
      if (!bcValidation.canDeliver) {
        return {
          totalDeliveryCharge: 0,
          deliveryDetails: [],
          hasDeliveryCharges: false,
          isBCAddress: false,
          bcValidationError: bcValidation.reason
        };
      }

      const calculation = await this.calculateDeliveryCharges(buyerAddress, orderTotal, orderType);
      
      const deliveryDetails = [{
        sellerId: "store",
        sellerName: "Main Store",
        distance: calculation.distance,
        deliveryCharge: calculation.deliveryCharge,
        isFreeDelivery: calculation.isFreeDelivery,
        reason: calculation.reason
      }];

      return {
        totalDeliveryCharge: calculation.deliveryCharge,
        deliveryDetails,
        hasDeliveryCharges: calculation.deliveryCharge > 0,
        isBCAddress: true
      };
    } catch (error) {
      console.error("Error getting delivery summary:", error);
      throw error;
    }
  }

  /**
   * Get distance from Google Distance Matrix API
   */
  private async getDistanceFromGoogle(origin: string, destination: string): Promise<{ distance: number; duration: number }> {
    try {
      // Check if API key is available
      if (!this.GOOGLE_API_KEY) {
        console.warn('Google Distance Matrix API key not configured, using fallback');
        return this.getEstimatedDistance(origin, destination);
      }

      const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
      url.searchParams.append('origins', origin);
      url.searchParams.append('destinations', destination);
      url.searchParams.append('units', 'metric');
      url.searchParams.append('mode', 'driving');
      url.searchParams.append('key', this.GOOGLE_API_KEY);

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.status !== 'OK') {
        console.warn(`Google Distance Matrix API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
        // Fallback to estimated distance calculation
        return this.getEstimatedDistance(origin, destination);
      }

      if (!data.rows || !data.rows[0] || !data.rows[0].elements || !data.rows[0].elements[0]) {
        console.warn('No distance data returned from Google API, using fallback');
        return this.getEstimatedDistance(origin, destination);
      }

      const element = data.rows[0].elements[0];
      
      if (element.status !== 'OK') {
        console.warn(`Distance calculation failed: ${element.status}, using fallback`);
        return this.getEstimatedDistance(origin, destination);
      }

      // Convert meters to kilometers
      const distanceKm = element.distance.value / 1000;
      // Convert seconds to minutes
      const durationMinutes = element.duration.value / 60;

      return {
        distance: Math.round(distanceKm * 100) / 100, // Round to 2 decimal places
        duration: Math.round(durationMinutes)
      };
    } catch (error) {
      console.error('Google Distance Matrix API error:', error);
      console.log('Falling back to estimated distance calculation');
      
      // Log specific error for debugging
      if (error instanceof Error) {
        if (error.message.includes('REQUEST_DENIED')) {
          console.log('Google API billing not enabled. Using fallback distance calculation.');
        } else if (error.message.includes('OVER_QUERY_LIMIT')) {
          console.log('Google API quota exceeded. Using fallback distance calculation.');
        } else {
          console.log('Google API error:', error.message);
        }
      }
      
      return await this.getEstimatedDistance(origin, destination);
    }
  }

  /**
   * Fallback method to estimate distance when Google API is unavailable
   */
  private async getEstimatedDistance(origin: string, destination: string): Promise<{ distance: number; duration: number }> {
    console.log(`Google API unavailable, estimating distance from: ${origin} to: ${destination}`);
    
    // Try to get coordinates using a free geocoding service first
    try {
      const coordinates = await this.getCoordinatesFromAddresses(origin, destination);
      if (coordinates) {
        const distance = this.calculateDistanceFromCoordinates(coordinates.origin, coordinates.destination);
        const duration = Math.round(distance * 2); // Assume 30 km/h average speed
        
        console.log(`Calculated distance using coordinates: ${distance}km`);
        return { distance, duration };
      }
    } catch (error) {
      console.log('Coordinate-based calculation failed, using address-based estimation');
    }
    
    // Use address-based estimation for more consistent results
    const estimatedDistance = this.calculateAddressBasedDistance(origin, destination);
    const estimatedDuration = Math.round(estimatedDistance * 2); // Assume 30 km/h average speed
    
    console.log(`Estimated distance: ${estimatedDistance}km from ${origin} to ${destination}`);
    
    return {
      distance: estimatedDistance,
      duration: estimatedDuration
    };
  }

  /**
   * Extract city information from address string
   */
  private extractCityFromAddress(address: string): string {
    // Simple extraction - look for common city patterns
    const parts = address.split(',').map(part => part.trim());
    
    // Look for city in different positions
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      // Skip if it looks like a state (2 letters) or zip code (5 digits)
      if (part.length === 2 || /^\d{5}$/.test(part)) continue;
      // Skip if it's the first part (usually street address)
      if (i === 0) continue;
      // Return the first part that looks like a city
      if (part.length > 2 && !/^\d/.test(part)) {
        return part.toLowerCase();
      }
    }
    
    return 'unknown';
  }

  /**
   * Calculate distance based on city information
   */
  private calculateCityBasedDistance(originCity: string, destinationCity: string): number {
    // If same city, assume local delivery
    if (originCity === destinationCity && originCity !== 'unknown') {
      // Use a consistent distance calculation instead of random
      // For Mountain View addresses, use a hash-based consistent distance
      const hash = this.simpleHash(originCity + destinationCity);
      return (hash % 8) + 2; // 2-9 km for same city, but consistent
    }
    
    // Define some common city distances (in km)
    const cityDistances: { [key: string]: { [key: string]: number } } = {
      'san francisco': {
        'oakland': 12,
        'san jose': 70,
        'berkeley': 15,
        'palo alto': 50,
        'fremont': 40,
        'hayward': 35,
        'richmond ca': 20,
        'vallejo': 30,
        'concord': 35,
        'sunnyvale': 60,
        'santa clara': 65,
        'mountain view': 55,
        'redwood city': 40,
        'san mateo': 35,
        'daly city': 8,
        'south san francisco': 10,
        'millbrae': 20,
        'burlingame': 25,
        'foster city': 30,
        'belmont': 35,
        'san carlos': 40,
        'menlo park': 45,
        'atherton': 50,
        'redwood shores': 35,
        'san bruno': 12,
        'pacifica': 15,
        'half moon bay': 30,
        'san rafael': 25,
        'novato': 35,
        'petaluma': 45,
        'santa rosa': 60,
        'napa': 50,
        'fairfield': 40,
        'vacaville': 45,
        'davis': 70,
        'sacramento': 90,
        'stockton': 80,
        'modesto': 100,
        'fresno': 200,
        'bakersfield': 300,
        'los angeles': 600,
        'san diego': 750,
        'las vegas': 900,
        'phoenix': 1200,
        'seattle': 1300,
        'portland': 1000,
        'denver': 1600,
        'chicago': 3000,
        'new york': 5000,
        'miami': 5500,
        'boston': 5000,
        'atlanta': 4000,
        'dallas': 2500,
        'houston': 2800,
        'philadelphia': 4800,
        'washington': 4600,
        'baltimore': 4500,
        'detroit': 3500,
        'minneapolis': 2800,
        'kansas city': 2200,
        'st. louis': 2500,
        'nashville': 3200,
        'memphis': 3000,
        'new orleans': 3200,
        'tampa': 4500,
        'orlando': 4400,
        'jacksonville': 4200,
        'charlotte': 3800,
        'raleigh': 4000,
        'richmond va': 4200,
        'norfolk': 4500,
        'buffalo': 3600,
        'rochester': 3700,
        'syracuse': 3800,
        'albany': 4000,
        'hartford': 4200,
        'providence': 4300,
        'burlington': 4500,
        'montreal': 5000,
        'toronto': 4000,
        'vancouver': 1400,
        'calgary': 2000,
        'edmonton': 2200,
        'winnipeg': 2500,
        'ottawa': 4500,
        'quebec city': 5000,
        'halifax': 5500,
        'st. john\'s': 6000,
        'london': 9000,
        'paris': 9500,
        'berlin': 10000,
        'rome': 11000,
        'madrid': 10000,
        'barcelona': 10200,
        'amsterdam': 9500,
        'brussels': 9600,
        'zurich': 10000,
        'vienna': 10500,
        'prague': 10000,
        'warsaw': 9500,
        'moscow': 12000,
        'istanbul': 11000,
        'cairo': 12000,
        'johannesburg': 18000,
        'cape town': 19000,
        'lagos': 15000,
        'nairobi': 16000,
        'riyadh': 13000,
        'dubai': 14000,
        'mumbai': 15000,
        'delhi': 15000,
        'bangalore': 16000,
        'chennai': 17000,
        'kolkata': 16000,
        'hyderabad': 16000,
        'pune': 16000,
        'ahmedabad': 16000,
        'surat': 16000,
        'jaipur': 16000,
        'lucknow': 16000,
        'kanpur': 16000,
        'nagpur': 16000,
        'indore': 16000,
        'bhopal': 16000,
        'visakhapatnam': 17000,
        'pimpri-chinchwad': 16000,
        'patna': 16000,
        'vadodara': 16000,
        'ghaziabad': 16000,
        'ludhiana': 16000,
        'agra': 16000,
        'nashik': 16000,
        'faridabad': 16000,
        'meerut': 16000,
        'rajkot': 16000,
        'kalyan-dombivli': 16000,
        'vasai-virar': 16000,
        'varanasi': 16000,
        'srinagar': 16000,
        'aurangabad': 16000,
        'howrah': 16000,
        'ranchi': 16000,
        'gwalior': 16000,
        'jabalpur': 16000,
        'coimbatore': 17000,
        'vijayawada': 17000,
        'jodhpur': 16000,
        'madurai': 17000,
        'raipur': 16000,
        'kota': 16000,
        'chandigarh': 16000,
        'guwahati': 16000,
        'solapur': 16000,
        'hubli-dharwad': 16000,
        'tiruchirappalli': 17000,
        'bareilly': 16000,
        'mysore': 16000,
        'tiruppur': 17000,
        'gurgaon': 16000,
        'aligarh': 16000,
        'moradabad': 16000,
        'jalandhar': 16000,
        'bhubaneswar': 16000,
        'salem': 17000,
        'mira-bhayandar': 16000,
        'warangal': 17000,
        'guntur': 17000,
        'bhiwandi': 16000,
        'saharanpur': 16000,
        'gorakhpur': 16000,
        'bikaner': 16000,
        'amravati': 16000,
        'noida': 16000,
        'jamshedpur': 16000,
        'bhilai': 16000,
        'cuttack': 16000,
        'firozabad': 16000,
        'kochi': 17000,
        'bhavnagar': 16000,
        'dehradun': 16000,
        'durgapur': 16000,
        'asansol': 16000,
        'rourkela': 16000,
        'nanded': 16000,
        'kolhapur': 16000,
        'ajmer': 16000,
        'akola': 16000,
        'gulbarga': 16000,
        'jamnagar': 16000,
        'ujjain': 16000,
        'loni': 16000,
        'siliguri': 16000,
        'jhansi': 16000,
        'ulhasnagar': 16000,
        'jammu': 16000,
        'sangli-miraj & kupwad': 16000,
        'mangalore': 16000,
        'erode': 17000,
        'belgaum': 16000,
        'ambattur': 17000,
        'tirunelveli': 17000,
        'malegaon': 16000,
        'gaya': 16000,
        'jalgaon': 16000,
        'udaipur': 16000,
        'maheshtala': 16000
      }
    };
    
    // Check if we have distance data for these cities
    if (cityDistances[originCity] && cityDistances[originCity][destinationCity]) {
      return cityDistances[originCity][destinationCity];
    }
    
    // If no specific data, estimate based on city size and general location
    if (originCity === 'unknown' || destinationCity === 'unknown') {
      return Math.random() * 20 + 10; // 10-30 km for unknown cities
    }
    
    // For different cities, estimate based on typical distances
    return Math.random() * 50 + 25; // 25-75 km for different cities
  }

  /**
   * Get coordinates from addresses using a free geocoding service
   */
  private async getCoordinatesFromAddresses(origin: string, destination: string): Promise<{ origin: { lat: number; lng: number }, destination: { lat: number; lng: number } } | null> {
    try {
      // Use Nominatim (OpenStreetMap) free geocoding service
      const [originCoords, destCoords] = await Promise.all([
        this.geocodeAddress(origin),
        this.geocodeAddress(destination)
      ]);

      if (originCoords && destCoords) {
        return { origin: originCoords, destination: destCoords };
      }
      return null;
    } catch (error) {
      console.log('Geocoding failed:', error);
      return null;
    }
  }

  /**
   * Geocode a single address using Nominatim
   */
  private async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const encodedAddress = encodeURIComponent(address);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Amazon-Groupon-Delivery-Service/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Geocoding request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon)
        };
      }
      
      return null;
    } catch (error) {
      console.log(`Geocoding failed for address: ${address}`, error);
      return null;
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistanceFromCoordinates(coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(coord2.lat - coord1.lat);
    const dLon = this.deg2rad(coord2.lng - coord1.lng);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(coord1.lat)) * Math.cos(this.deg2rad(coord2.lat)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers
    
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Convert degrees to radians
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  /**
   * Simple hash function for consistent distance calculation
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Calculate distance based on address strings for consistent results
   */
  private calculateAddressBasedDistance(origin: string, destination: string): number {
    // Extract cities from both addresses
    const originCity = this.extractCityFromAddress(origin);
    const destCity = this.extractCityFromAddress(destination);
    
    // If both addresses are in the same city, use street-based calculation
    if (originCity === destCity) {
      const originStreetNumber = this.extractStreetNumber(origin);
      const destStreetNumber = this.extractStreetNumber(destination);
      
      if (originStreetNumber && destStreetNumber) {
        // Calculate distance based on street number difference within same city
        const streetDiff = Math.abs(originStreetNumber - destStreetNumber);
        const streetBasedDistance = Math.min(streetDiff / 100, 10); // Max 10km based on street numbers
        return Math.max(streetBasedDistance, 0.5); // Minimum 0.5km
      }
      
      // Same city, different streets - estimate 2-8km
      return 5;
    }
    
    // Different cities - use realistic BC city distances
    const cityDistances: { [key: string]: { [key: string]: number } } = {
      'vancouver': {
        'burnaby': 12,
        'richmond': 15,
        'surrey': 25,
        'langley': 35,
        'coquitlam': 20,
        'delta': 18,
        'new westminster': 15,
        'north vancouver': 8,
        'west vancouver': 10,
        'victoria': 100
      },
      'burnaby': {
        'vancouver': 12,
        'richmond': 20,
        'surrey': 15,
        'langley': 25,
        'coquitlam': 8,
        'delta': 25,
        'new westminster': 5,
        'north vancouver': 15,
        'west vancouver': 18
      },
      'richmond': {
        'vancouver': 15,
        'burnaby': 20,
        'surrey': 30,
        'langley': 40,
        'coquitlam': 25,
        'delta': 10,
        'new westminster': 18,
        'north vancouver': 20,
        'west vancouver': 22
      },
      'surrey': {
        'vancouver': 25,
        'burnaby': 15,
        'richmond': 30,
        'langley': 10,
        'coquitlam': 20,
        'delta': 15,
        'new westminster': 18,
        'north vancouver': 30,
        'west vancouver': 32
      }
    };
    
    // Look up distance between cities
    if (cityDistances[originCity] && cityDistances[originCity][destCity]) {
      return cityDistances[originCity][destCity];
    }
    
    if (cityDistances[destCity] && cityDistances[destCity][originCity]) {
      return cityDistances[destCity][originCity];
    }
    
    // If cities not found in lookup, use a reasonable default for BC
    return 20; // Default 20km for unknown BC city combinations
  }

  /**
   * Extract street number from address
   */
  private extractStreetNumber(address: string): number | null {
    const match = address.match(/^(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Calculate delivery fee based on distance
   * Free delivery for distances up to 10 km, $5 per km beyond 10 km
   */
  private calculateDeliveryFee(distance: number, duration: number, orderTotal: number): DeliveryCalculation {
    const isWithinFreeDeliveryDistance = distance <= this.FREE_DELIVERY_DISTANCE_KM;
    const isFreeDelivery = isWithinFreeDeliveryDistance;

    let deliveryCharge = 0;
    let reason = '';

    if (isFreeDelivery) {
      reason = `Free delivery: ${distance}km ≤ ${this.FREE_DELIVERY_DISTANCE_KM}km`;
    } else {
      // Calculate charge for distance beyond 10km
      const excessDistance = distance - this.FREE_DELIVERY_DISTANCE_KM;
      deliveryCharge = excessDistance * this.DELIVERY_RATE_PER_KM;
      reason = `Delivery charge: ${distance}km > ${this.FREE_DELIVERY_DISTANCE_KM}km free delivery limit. Charge: $${this.DELIVERY_RATE_PER_KM} per km for ${excessDistance.toFixed(1)}km`;
    }

    return {
      distance,
      duration,
      deliveryCharge: Math.round(deliveryCharge * 100) / 100, // Round to 2 decimal places
      isFreeDelivery,
      reason
    };
  }

  /**
   * Calculate shop-specific delivery fee based on shop settings
   */
  private calculateShopDeliveryFee(
    distance: number, 
    duration: number, 
    orderTotal: number,
    shopDeliveryFee: number,
    shopFreeDeliveryThreshold: number,
    shopMinimumOrderValue: number
  ): DeliveryCalculation {
    // Check minimum order value
    if (orderTotal < shopMinimumOrderValue) {
      return {
        distance,
        duration,
        deliveryCharge: 0,
        isFreeDelivery: false,
        reason: `Order total $${orderTotal.toFixed(2)} is below minimum $${shopMinimumOrderValue.toFixed(2)}`
      };
    }

    // Check if order qualifies for free delivery
    const isFreeDelivery = orderTotal >= shopFreeDeliveryThreshold;

    let deliveryCharge = 0;
    let reason = '';

    if (isFreeDelivery) {
      reason = `Free delivery: Order total $${orderTotal.toFixed(2)} ≥ $${shopFreeDeliveryThreshold.toFixed(2)} threshold`;
    } else {
      deliveryCharge = shopDeliveryFee;
      reason = `Delivery fee: $${shopDeliveryFee.toFixed(2)} for orders under $${shopFreeDeliveryThreshold.toFixed(2)}`;
    }

    return {
      distance,
      duration,
      deliveryCharge: Math.round(deliveryCharge * 100) / 100,
      isFreeDelivery,
      reason
    };
  }

  /**
   * Calculate BC-specific delivery fee based on order type and constraints
   */
  private calculateBCDeliveryFee(distance: number, duration: number, orderTotal: number, orderType: 'group' | 'individual'): DeliveryCalculation {
    const constraints = this.BC_DELIVERY_CONSTRAINTS[orderType];
    
    // Check minimum order value
    if (orderTotal < constraints.minimumOrderValue) {
      return {
        distance,
        duration,
        deliveryCharge: 0,
        isFreeDelivery: false,
        reason: `Order total $${orderTotal.toFixed(2)} is below minimum $${constraints.minimumOrderValue.toFixed(2)} for ${orderType} orders`
      };
    }

    // Check if order qualifies for free delivery
    const isFreeDelivery = orderTotal >= constraints.freeDeliveryThreshold;
    
    let deliveryCharge = 0;
    let reason = '';

    if (isFreeDelivery) {
      reason = `Free delivery: Order total $${orderTotal.toFixed(2)} ≥ $${constraints.freeDeliveryThreshold.toFixed(2)} threshold for ${orderType} orders`;
    } else {
      deliveryCharge = constraints.deliveryFee;
      reason = `Delivery fee: $${constraints.deliveryFee.toFixed(2)} for ${orderType} orders under $${constraints.freeDeliveryThreshold.toFixed(2)}`;
    }

    return {
      distance,
      duration,
      deliveryCharge: Math.round(deliveryCharge * 100) / 100, // Round to 2 decimal places
      isFreeDelivery,
      reason
    };
  }

  /**
   * Check if an order meets the minimum value for shop delivery
   */
  async checkShopMinimumOrderValue(orderTotal: number, sellerId?: string): Promise<{ isValid: boolean; message: string; minimumRequired: number }> {
    let minimumRequired = 25.00; // Default fallback

    if (sellerId) {
      try {
        // Import storage dynamically to avoid circular dependency
        const { storage } = await import('./storage');
        const seller = await storage.getUser(sellerId);
        
        if (seller && seller.isSeller && seller.minimumOrderValue !== undefined && seller.minimumOrderValue !== null) {
          minimumRequired = parseFloat(seller.minimumOrderValue.toString());
        }
      } catch (error) {
        console.warn('Failed to fetch shop minimum order value, using default:', error);
      }
    }

    if (orderTotal < minimumRequired) {
      return {
        isValid: false,
        message: `Minimum order value is $${minimumRequired.toFixed(2)}. Current total: $${orderTotal.toFixed(2)}`,
        minimumRequired
      };
    }

    return {
      isValid: true,
      message: `Order meets minimum value requirement of $${minimumRequired.toFixed(2)}`,
      minimumRequired
    };
  }

  /**
   * Check if order meets minimum value requirements for BC delivery
   */
  async checkBCMinimumOrderValue(orderTotal: number, orderType: 'group' | 'individual'): Promise<{ isValid: boolean; message: string; minimumRequired: number }> {
    const constraints = this.BC_DELIVERY_CONSTRAINTS[orderType];
    const minimumRequired = constraints.minimumOrderValue;
    
    if (orderTotal < minimumRequired) {
      return {
        isValid: false,
        message: `Minimum order value for ${orderType} orders in BC is $${minimumRequired.toFixed(2)}. Current total: $${orderTotal.toFixed(2)}`,
        minimumRequired
      };
    }
    
    return {
      isValid: true,
      message: `Order meets minimum value requirement for ${orderType} orders in BC`,
      minimumRequired
    };
  }

  /**
   * Format address for Google API
   */
  private formatAddress(address: Address): string {
    const parts = [
      address.addressLine,
      address.city,
      address.state,
      address.pincode,
      address.country
    ].filter(part => part && part.trim() !== '');
    
    return parts.join(', ');
  }
}

export const deliveryService = new DeliveryService();
