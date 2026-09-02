import { useEffect, useState } from 'react';
import { pickSponsoredAd, type SponsoredAd } from '@/lib/ads/delivery';
import { SponsoredFeedCard } from './SponsoredFeedCard';

/**
 * A feed slot that asks the server for one sponsored ad and renders it — or
 * renders nothing. When there's no eligible ad (the common case, and always
 * for non-test users), the feed is exactly as it was.
 */
export function SponsoredAdSlot() {
  const [ad, setAd] = useState<SponsoredAd | null>(null);

  useEffect(() => {
    let cancelled = false;
    pickSponsoredAd()
      .then((a) => {
        if (!cancelled) setAd(a);
      })
      .catch(() => {
        /* delivery is best-effort — never break the feed */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ad) return null;
  return <SponsoredFeedCard ad={ad} />;
}
