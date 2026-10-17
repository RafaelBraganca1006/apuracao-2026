// Classificações usadas na coleta: aparelho, sistema e origem do tráfego.

export function device(ua = '') {
  if (/SmartTV|Smart-TV|SMART-TV|Tizen|Web0S|WebOS|HbbTV|AppleTV|GoogleTV|Android TV|CrKey|Roku|BRAVIA|VIDAA|Vizio|NetCast|AFT[A-Z]/i.test(ua)) return 'tv';
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function os(ua = '') {
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'outro';
}

const SOURCES = [
  ['twitch', /(^|\.)twitch\.tv$/], ['kick', /(^|\.)kick\.com$/], ['youtube', /(^|\.)(youtube\.com|youtu\.be)$/],
  ['x', /(^|\.)(twitter\.com|x\.com|t\.co)$/], ['instagram', /(^|\.)instagram\.com$/], ['reddit', /(^|\.)reddit\.com$/],
  ['facebook', /(^|\.)(facebook\.com|fb\.com|l\.facebook\.com)$/], ['tiktok', /(^|\.)tiktok\.com$/],
  ['whatsapp', /(^|\.)(whatsapp\.com|wa\.me)$/], ['telegram', /(^|\.)(telegram\.org|t\.me)$/],
  ['google', /(^|\.)google\.[a-z.]+$/], ['bing', /(^|\.)bing\.com$/], ['linkedin', /(^|\.)(linkedin\.com|lnkd\.in)$/],
];

// utm_source tem prioridade (links em apps costumam não mandar referrer); depois o host do referrer.
export function source(refHost = '', utm = '', ownHost = '') {
  const pick = (s) => { s = String(s || '').toLowerCase().slice(0, 60); for (const [n, re] of SOURCES) if (re.test(s) || s === n) return n; return ''; };
  if (utm) return pick(utm) || utm.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'outro';
  if (!refHost) return 'direto';
  if (ownHost && refHost.endsWith(ownHost)) return 'interno';
  return pick(refHost) || 'outro';
}
