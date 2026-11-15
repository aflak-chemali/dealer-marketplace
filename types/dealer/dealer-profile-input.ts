/**
 * Editable dealer profile fields submitted from the "Become a dealer" and
 * dealer settings forms.
 */
export interface DealerProfileInput {
  name: string;
  slug: string;
  bio?: string;
  phone?: string;
  email?: string;
  whatsappPhone?: string;
  address?: string;
  city?: string;
}
