/**
 * Best-effort, honest label for the CURRENT browser/OS only -- derived from
 * navigator.userAgent, which is real data about the device rendering this
 * page right now. This must never be used to describe any other session:
 * Supabase Auth's client SDK has no API that returns device/browser info
 * for sessions other than the current one, so there is nothing to parse
 * for them.
 */
export function getCurrentDeviceLabel(): string {
  if (typeof navigator === 'undefined' || !navigator.userAgent) return 'This browser';
  const ua = navigator.userAgent;

  let browser = '';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua) && !/Chromium\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari';

  let os = '';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  if (browser && os) return `${browser} · ${os}`;
  if (browser) return browser;
  if (os) return os;
  return 'This browser';
}
