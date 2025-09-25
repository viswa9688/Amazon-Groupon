import axios from 'axios';

interface Address {
  addressLine: string;
  city: string;
  state?: string;
  country: string;
  pincode: string;
}

interface GeocodingResult {
  isInBC: boolean;
  formattedAddress: string;
  province: string;
  confidence: number;
  error?: string;
}

export class GeocodingService {
  private readonly GOOGLE_GEOCODING_API_KEY = process.env.GOOGLE_GEOCODING_API_KEY;
  private readonly BC_PROVINCE_NAMES = [
    'British Columbia',
    'BC',
    'Colombie-Britannique', // French name
    'Colombie Britannique'
  ];

  constructor() {
    if (this.GOOGLE_GEOCODING_API_KEY) {
      console.log('✅ Google Geocoding API key configured');
    } else {
      console.log('⚠️  Google Geocoding API key not configured - BC validation will be disabled');
      console.log('   Set GOOGLE_GEOCODING_API_KEY environment variable to enable BC address validation');
    }
  }

  /**
   * Verify if an address is in British Columbia using Google Geocoding API
   */
  async verifyBCAddress(address: Address): Promise<GeocodingResult> {
    if (!this.GOOGLE_GEOCODING_API_KEY) {
      return {
        isInBC: false,
        formattedAddress: this.formatAddress(address),
        province: 'Unknown',
        confidence: 0,
        error: 'Google Geocoding API key not configured'
      };
    }

    try {
      const formattedAddress = this.formatAddress(address);
      const geocodingResult = await this.geocodeAddress(formattedAddress);
      
      if (!geocodingResult) {
        return {
          isInBC: false,
          formattedAddress,
          province: 'Unknown',
          confidence: 0,
          error: 'No geocoding results found'
        };
      }

      const isInBC = this.isAddressInBC(geocodingResult);
      const confidence = this.calculateConfidence(geocodingResult);

      return {
        isInBC,
        formattedAddress: geocodingResult.formatted_address,
        province: geocodingResult.address_components?.find(component => 
          component.types.includes('administrative_area_level_1')
        )?.long_name || 'Unknown',
        confidence
      };

    } catch (error) {
      console.error('Error verifying BC address:', error);
      return {
        isInBC: false,
        formattedAddress: this.formatAddress(address),
        province: 'Unknown',
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Call Google Geocoding API
   */
  private async geocodeAddress(address: string): Promise<any> {
    const url = 'https://maps.googleapis.com/maps/api/geocode/json';
    const params = {
      address: address,
      key: this.GOOGLE_GEOCODING_API_KEY,
      region: 'ca' // Bias results towards Canada
    };

    const response = await axios.get(url, { params });
    
    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding API error: ${response.data.status}`);
    }

    return response.data.results[0];
  }

  /**
   * Check if the geocoded result is in British Columbia
   */
  private isAddressInBC(geocodingResult: any): boolean {
    const addressComponents = geocodingResult.address_components || [];
    
    // Check administrative_area_level_1 (province/state)
    const provinceComponent = addressComponents.find((component: any) => 
      component.types.includes('administrative_area_level_1')
    );

    if (provinceComponent) {
      const provinceName = provinceComponent.long_name;
      const provinceShortName = provinceComponent.short_name;
      
      return this.BC_PROVINCE_NAMES.some(bcName => 
        provinceName.toLowerCase().includes(bcName.toLowerCase()) ||
        provinceShortName.toLowerCase().includes(bcName.toLowerCase())
      );
    }

    // Fallback: check country and postal code patterns
    const countryComponent = addressComponents.find((component: any) => 
      component.types.includes('country')
    );

    if (countryComponent && countryComponent.short_name === 'CA') {
      // Check if postal code is BC format (V followed by 6 characters)
      const postalCodeComponent = addressComponents.find((component: any) => 
        component.types.includes('postal_code')
      );

      if (postalCodeComponent) {
        const postalCode = postalCodeComponent.long_name;
        return /^V[0-9][A-Z][0-9][A-Z][0-9]$/i.test(postalCode);
      }
    }

    return false;
  }

  /**
   * Calculate confidence score for the geocoding result
   */
  private calculateConfidence(geocodingResult: any): number {
    const addressComponents = geocodingResult.address_components || [];
    
    // Base confidence from Google's result
    let confidence = 0.5;
    
    // Increase confidence if we have province information
    const hasProvince = addressComponents.some((component: any) => 
      component.types.includes('administrative_area_level_1')
    );
    if (hasProvince) confidence += 0.3;
    
    // Increase confidence if we have postal code
    const hasPostalCode = addressComponents.some((component: any) => 
      component.types.includes('postal_code')
    );
    if (hasPostalCode) confidence += 0.2;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Format address for geocoding
   */
  private formatAddress(address: Address): string {
    const parts = [
      address.addressLine,
      address.city,
      address.state,
      address.pincode,
      address.country
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  /**
   * Batch verify multiple addresses
   */
  async verifyMultipleBCAddresses(addresses: Address[]): Promise<GeocodingResult[]> {
    const results = await Promise.allSettled(
      addresses.map(address => this.verifyBCAddress(address))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          isInBC: false,
          formattedAddress: this.formatAddress(addresses[index]),
          province: 'Unknown',
          confidence: 0,
          error: result.reason?.message || 'Verification failed'
        };
      }
    });
  }
}

export const geocodingService = new GeocodingService();

