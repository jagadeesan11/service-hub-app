'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { createClient } from '@/lib/supabase/client';
import type { AppSettings } from '@/types/database';

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const router = useRouter();

  const [shopName, setShopName] = useState(settings.shop_name);
  const [supportEmail, setSupportEmail] = useState(settings.support_email ?? '');
  const [supportPhone, setSupportPhone] = useState(settings.support_phone ?? '');
  const [addressLine, setAddressLine] = useState(settings.shop_address_line ?? '');
  const [city, setCity] = useState(settings.shop_city ?? '');
  const [postalCode, setPostalCode] = useState(settings.shop_postal_code ?? '');
  const [codEnabled, setCodEnabled] = useState(settings.cod_enabled);
  const [onlineEnabled, setOnlineEnabled] = useState(settings.online_payment_enabled);
  const [privacyUrl, setPrivacyUrl] = useState(settings.privacy_url ?? '');
  const [termsUrl, setTermsUrl] = useState(settings.terms_url ?? '');

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: saveError } = await supabase
      .from('app_settings')
      .update({
        shop_name: shopName,
        support_email: supportEmail || null,
        support_phone: supportPhone || null,
        shop_address_line: addressLine || null,
        shop_city: city || null,
        shop_postal_code: postalCode || null,
        cod_enabled: codEnabled,
        online_payment_enabled: onlineEnabled,
        privacy_url: privacyUrl || null,
        terms_url: termsUrl || null,
      })
      .eq('id', true);

    setIsSubmitting(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  const noPaymentMethod = !codEnabled && !onlineEnabled;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-primary">Saved. The app picks this up within five minutes.</p>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Business</h2>
          <p className="text-xs text-muted-foreground">
            Shown in the app wherever your name appears — sign-in, help centre, payment receipts.
          </p>
        </div>

        <div>
          <Label htmlFor="shop_name" className="mb-1.5">
            Shop name
          </Label>
          <Input
            id="shop_name"
            required
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Help centre contact</h2>
          <p className="text-xs text-muted-foreground">
            What customers tap to reach you. Leave a field empty to hide that option in the app.
          </p>
        </div>

        <div>
          <Label htmlFor="support_email" className="mb-1.5">
            Support email
          </Label>
          <Input
            id="support_email"
            type="email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            placeholder="help@yourshop.in"
          />
        </div>

        <div>
          <Label htmlFor="support_phone" className="mb-1.5">
            Support phone
          </Label>
          <Input
            id="support_phone"
            value={supportPhone}
            onChange={(e) => setSupportPhone(e.target.value)}
            placeholder="+91 98765 43210"
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Shop address</h2>
          <p className="text-xs text-muted-foreground">
            Appears in the help centre as &ldquo;Visit us&rdquo; and opens in Maps.
          </p>
        </div>

        <div>
          <Label htmlFor="address_line" className="mb-1.5">
            Address
          </Label>
          <Input
            id="address_line"
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            placeholder="Unit 4, 12 MG Road"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="city" className="mb-1.5">
              City
            </Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="postal_code" className="mb-1.5">
              PIN code
            </Label>
            <Input
              id="postal_code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Checkout</h2>
          <p className="text-xs text-muted-foreground">
            Which payment methods the app offers. Enforced server-side, so turning one off blocks
            it for real, not just in the UI.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="online_enabled" checked={onlineEnabled} onCheckedChange={setOnlineEnabled} />
          <Label htmlFor="online_enabled">Pay now (Razorpay — UPI, card, netbanking)</Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="cod_enabled" checked={codEnabled} onCheckedChange={setCodEnabled} />
          <Label htmlFor="cod_enabled">Cash on service</Label>
        </div>

        {noPaymentMethod && (
          <p className="rounded-md border border-destructive/40 bg-destructive/8 px-3 py-2 text-xs text-destructive">
            With both off, customers can pick a slot but never complete a booking — it stays
            pending payment and no technician is dispatched.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Legal documents</h2>
          <p className="text-xs text-muted-foreground">
            Public URLs for your published policies. They must open without a login — store
            reviewers check them anonymously. While a field is empty, the app tells customers the
            document is not published yet rather than showing placeholder text.
          </p>
        </div>

        <div>
          <Label htmlFor="privacy_url" className="mb-1.5">
            Privacy policy URL
          </Label>
          <Input
            id="privacy_url"
            type="url"
            value={privacyUrl}
            onChange={(e) => setPrivacyUrl(e.target.value)}
            placeholder="https://example.com/privacy-policy.html"
          />
          {!privacyUrl && (
            <p className="mt-1.5 text-xs text-destructive">
              Required by both the App Store and Google Play. No submission is accepted without it.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="terms_url" className="mb-1.5">
            Terms and conditions URL
          </Label>
          <Input
            id="terms_url"
            type="url"
            value={termsUrl}
            onChange={(e) => setTermsUrl(e.target.value)}
            placeholder="https://example.com/terms.html"
          />
        </div>
      </section>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save settings'}
      </Button>
    </form>
  );
}
