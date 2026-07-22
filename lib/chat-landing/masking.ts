import type { CvrCompany } from "@/lib/cvr-api";

const MASKED = "•••";

export interface MaskedCompanyPreview {
  vat: number;
  name: string;
  companyStatus: string | null;
  industry: string | null;
  address: {
    zipcode: number | null;
    cityname: string | null;
  };
  contact: {
    email: string;
    phone: string;
    www: string;
  };
  participantCount: number;
  financials: {
    revenue: string;
    profitLoss: string;
    employees: string;
  };
}

/**
 * Re-shapes a CvrCompany into a preview type that structurally cannot hold a real
 * email/phone/participant-name/financial value — company identity fields (name, VAT,
 * industry, status) stay real since that's public registry data.
 */
export function maskCompanyForPreview(company: CvrCompany): MaskedCompanyPreview {
  return {
    vat: company.vat,
    name: company.life.name,
    companyStatus: company.companystatus?.text ?? null,
    industry: company.industry?.primary?.text ?? null,
    address: {
      zipcode: company.address?.zipcode ?? null,
      cityname: company.address?.cityname ?? null,
    },
    contact: {
      email: MASKED,
      phone: MASKED,
      www: MASKED,
    },
    participantCount: company.participants?.length ?? 0,
    financials: {
      revenue: MASKED,
      profitLoss: MASKED,
      employees: MASKED,
    },
  };
}
