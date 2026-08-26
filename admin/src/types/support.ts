export type SupportStatus = 'open' | 'in_progress' | 'resolved';
export type SupportKind = 'password_reset' | 'question';

export interface SupportRequest {
  id: string;
  kind: SupportKind;
  contact_raw: string;
  contact_email: string | null;
  contact_phone: string | null;
  message: string | null;
  status: SupportStatus;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

/** The account a request appears to be about, resolved from the contact given. */
export interface AccountMatch {
  id: string;
  name: string | null;
  identity: string;
}
