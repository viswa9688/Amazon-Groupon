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
      // Fix data inconsistency: if state is British Columbia, country should be Canada
      const correctedAddress = { ...address };
      if (address.state && this.BC_PROVINCE_NAMES.some(bcName => 
        address.state!.toLowerCase().includes(bcName.toLowerCase())
      )) {
        correctedAddress.country = 'Canada';
        console.log('Corrected address country to Canada for BC address:', correctedAddress);
      }

      const formattedAddress = this.formatAddress(correctedAddress);
      const geocodingResult = await this.geocodeAddress(formattedAddress);
      
      if (!geocodingResult) {
        // Fallback: check address data directly
        const isBCFromData = this.isBCFromAddressData(correctedAddress);
        return {
          isInBC: isBCFromData,
          formattedAddress,
          province: isBCFromData ? 'British Columbia' : 'Unknown',
          confidence: isBCFromData ? 0.8 : 0,
          error: isBCFromData ? undefined : 'No geocoding results found'
        };
      }

      const isInBC = this.isAddressInBC(geocodingResult);
      const confidence = this.calculateConfidence(geocodingResult);

      // If geocoding says not BC but address data suggests BC, use fallback
      // BUT only if the geocoding result is actually in Canada
      if (!isInBC && this.isBCFromAddressData(correctedAddress)) {
        const isInCanada = geocodingResult.address_components?.some((component: any) => 
          component.types.includes('country') && component.short_name === 'CA'
        );
        
        if (isInCanada) {
          console.log('Geocoding failed but address data suggests BC and result is in Canada, using fallback validation');
          return {
            isInBC: true,
            formattedAddress: geocodingResult.formatted_address || formattedAddress,
            province: 'British Columbia',
            confidence: 0.7
          };
        } else {
          console.log('Geocoding result is not in Canada, rejecting BC validation');
          return {
            isInBC: false,
            formattedAddress: geocodingResult.formatted_address || formattedAddress,
            province: geocodingResult.address_components?.find(component => 
              component.types.includes('administrative_area_level_1')
            )?.long_name || 'Unknown',
            confidence: 0.8,
            error: 'Address is not in Canada'
          };
        }
      }

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
      
      // Fallback: check address data directly when geocoding fails
      const isBCFromData = this.isBCFromAddressData(address);
      return {
        isInBC: isBCFromData,
        formattedAddress: this.formatAddress(address),
        province: isBCFromData ? 'British Columbia' : 'Unknown',
        confidence: isBCFromData ? 0.6 : 0,
        error: isBCFromData ? undefined : (error instanceof Error ? error.message : 'Unknown error')
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
   * Check if address data suggests it's in British Columbia (fallback validation)
   */
  private isBCFromAddressData(address: Address): boolean {
    // First, check if country is explicitly NOT Canada - if so, definitely not BC
    if (address.country && address.country.toLowerCase() !== 'canada' && address.country.toLowerCase() !== 'ca') {
      return false;
    }

    // Check if state/province is British Columbia
    if (address.state && this.BC_PROVINCE_NAMES.some(bcName => 
      address.state!.toLowerCase().includes(bcName.toLowerCase())
    )) {
      return true;
    }

    // Check if postal code starts with V (BC postal codes) AND country is Canada
    if (address.pincode && address.pincode.toUpperCase().startsWith('V') && 
        address.country && (address.country.toLowerCase() === 'canada' || address.country.toLowerCase() === 'ca')) {
      return true;
    }

    // Check if city is a known BC city AND country is Canada
    const bcCities = ['vancouver', 'victoria', 'burnaby', 'richmond', 'surrey', 'langley', 'coquitlam', 'delta', 'new westminster', 'north vancouver', 'west vancouver'];
    if (address.city && bcCities.some(city => 
      address.city!.toLowerCase().includes(city)
    ) && address.country && (address.country.toLowerCase() === 'canada' || address.country.toLowerCase() === 'ca')) {
      return true;
    }

    return false;
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

