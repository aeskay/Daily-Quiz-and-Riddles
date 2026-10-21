/**
 * Vector Image Service for Daily Quiz & Riddles
 * 
 * Sources:
 * 1. Pixabay Vector API (isolated vectors, transparent background, top-ranked)
 * 2. Wikimedia Commons (free SVG / vector drawings)
 */

export function getPixabayKey(): string {
  try {
    return localStorage.getItem('dqr_pixabay_key') || process.env.PIXABAY_KEY || '';
  } catch {
    return process.env.PIXABAY_KEY || '';
  }
}

export function setPixabayKey(key: string): void {
  try {
    localStorage.setItem('dqr_pixabay_key', key.trim());
  } catch (e) {
    console.error('Failed to save Pixabay key', e);
  }
}

const CACHE_PREFIX = 'dqr_img_v3_';

function cacheGet(keyword: string): string | null {
  try { return sessionStorage.getItem(CACHE_PREFIX + keyword); }
  catch { return null; }
}

function cacheSet(keyword: string, url: string): void {
  try { sessionStorage.setItem(CACHE_PREFIX + keyword, url); }
  catch { /* ignore */ }
}

/** Fetch top vector hits from Pixabay with transparent background */
export async function fetchPixabayList(keyword: string): Promise<string[]> {
  const key = getPixabayKey();
  if (!key) return [];
  try {
    // Clean keyword: take only first 2 words for best search accuracy
    const query = keyword.split(',')[0].trim().split(' ').slice(0, 2).join(' ');
    const params = new URLSearchParams({
      key,
      q: query,
      image_type: 'vector',
      colors: 'transparent',
      safesearch: 'true',
      per_page: '12',
    });
    const res = await fetch(`https://pixabay.com/api/?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.hits?.length) return [];
    return data.hits.map((h: any) => h.webformatURL || h.previewURL).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchPixabay(keyword: string): Promise<string | null> {
  const list = await fetchPixabayList(keyword);
  return list.length > 0 ? list[0] : null;
}

async function fetchWikimediaVector(keyword: string): Promise<string | null> {
  try {
    const queryTerm = keyword.split(',')[0].trim().split(' ').slice(0, 2).join(' ');
    const queries = [
      `${queryTerm} drawing filetype:svg`,
      `${queryTerm} icon filetype:svg`,
      `${queryTerm} clipart filetype:svg`,
      `${queryTerm} illustration`,
    ];

    for (const query of queries) {
      const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&format=json&origin=*`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'DailyQuizAndRiddles/2.0' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const pages = data.query?.pages;
      if (!pages) continue;
      const urls: string[] = Object.values(pages)
        .map((p: any) => p.imageinfo?.[0]?.url)
        .filter((u: any): u is string => typeof u === 'string' && !u.endsWith('.ogg') && !u.endsWith('.ogv') && !u.endsWith('.pdf'));

      if (urls.length > 0) {
        return urls[0];
      }
    }
    return null;
  } catch (err) {
    console.error('Wikimedia fetch error:', err);
    return null;
  }
}

export async function fetchVectorImage(keyword: string): Promise<string | null> {
  if (!keyword) return null;
  const key = keyword.toLowerCase().trim();

  const cached = cacheGet(key);
  if (cached) return cached;

  // 1. Try Pixabay transparent vector first
  const pixabayUrl = await fetchPixabay(key);
  if (pixabayUrl) {
    cacheSet(key, pixabayUrl);
    return pixabayUrl;
  }

  // 2. Fallback to Wikimedia Commons
  const commonsUrl = await fetchWikimediaVector(key);
  if (commonsUrl) {
    cacheSet(key, commonsUrl);
    return commonsUrl;
  }

  return null;
}
