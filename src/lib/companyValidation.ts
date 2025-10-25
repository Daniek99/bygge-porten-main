interface BronnoysundResponse {
  _embedded?: {
    enheter: Array<{
      organisasjonsnummer: string;
      navn: string;
      organisasjonsform: {
        kode: string;
        beskrivelse: string;
      };
      registreringsdatoEnhetsregisteret: string;
      registrertIMvaregisteret: boolean;
      frivilligRegistrertIMvaregisteret: boolean;
      registrertIForetaksregisteret: boolean;
      registrertIStiftelsesregisteret: boolean;
      registrertIFrivillighetsregisteret: boolean;
    }>;
  };
  _links?: {
    self: {
      href: string;
    };
  };
  page?: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

export const validateCompany = async (companyName: string): Promise<boolean> => {
  try {
    // Clean and prepare the company name for search
    const cleanName = companyName.trim();

    if (!cleanName || cleanName.length < 2) {
      return false;
    }

    // Use the Brønnøysundregisteret API to search for companies
    const response = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(cleanName)}&size=10`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Brønnøysund API error:', response.status);
      // If API fails, we'll allow the company for now to avoid blocking users
      return true;
    }

    const data: BronnoysundResponse = await response.json();

    // Check if any companies match the search
    const companies = data._embedded?.enheter || [];

    // Look for exact or close matches
    const exactMatch = companies.find(company =>
      company.navn.toLowerCase() === cleanName.toLowerCase()
    );

    const partialMatch = companies.find(company =>
      company.navn.toLowerCase().includes(cleanName.toLowerCase()) ||
      cleanName.toLowerCase().includes(company.navn.toLowerCase())
    );

    // Return true if we find a reasonable match
    return exactMatch !== undefined || partialMatch !== undefined;
  } catch (error) {
    console.error('Company validation error:', error);
    // If validation fails, allow the company to avoid blocking users
    return true;
  }
};

export const getCompanySuggestions = async (partialName: string): Promise<string[]> => {
  try {
    if (!partialName || partialName.length < 2) {
      return [];
    }

    const response = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(partialName)}&size=5`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data: BronnoysundResponse = await response.json();
    const companies = data._embedded?.enheter || [];

    return companies.map(company => company.navn);
  } catch (error) {
    console.error('Company suggestions error:', error);
    return [];
  }
};