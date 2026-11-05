import type { City } from './cities'

export type TravelSource = { title: string; url: string; revision?: number; publisher?: string; license?: string; checkedAt?: string }
export type TravelContext = TravelSource & { text: string }
const cache = new Map<string, { expires: number; context: TravelContext | null }>()

export async function getTravelContext(city: City): Promise<TravelContext | null> {
  const cached = cache.get(city.code)
  if (cached && cached.expires > Date.now()) return cached.context
  const url = new URL('https://en.wikivoyage.org/w/api.php')
  url.search = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', titles: city.name, redirects: '1', prop: 'extracts|coordinates|info', explaintext: '1', inprop: 'url', exlimit: '1', colimit: '1' }).toString()
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'FlowTravel/1.0 (https://flow.squeakyfiddlepro.me)' }, signal: AbortSignal.timeout(7000) })
    if (!response.ok) return null
    const result = await response.json() as { query?: { pages?: { missing?: boolean; title: string; fullurl?: string; lastrevid: number; extract?: string; coordinates?: { lat: number; lon: number }[] }[] } }
    const page = result.query?.pages?.[0]
    const coordinates = page?.coordinates?.[0]
    let context: TravelContext | null = null
    if (page?.extract && coordinates && Math.abs(coordinates.lat - city.latitude) < 0.3 && Math.abs(coordinates.lon - city.longitude) < 0.3) {
      const sections = page.extract.split(/(?=^== [^=].* ==$)/mu)
      const transport = sections.filter((section) => /^== (Get in|Get around) ==/u.test(section.trim()))
      const intro = sections[0].slice(0, 500)
      const excerpts = transport.map((section) => section.split(/(?=^=== [^=].* ===$)/mu).map((part) => part.slice(0, 450)).slice(0, 7).join('\n').slice(0, 1700))
      const text = [intro, ...excerpts].join('\n').slice(0, 3900)
      context = { title: page.title, revision: page.lastrevid, url: `https://en.wikivoyage.org/w/index.php?oldid=${page.lastrevid}`, publisher: 'Wikivoyage contributors', license: 'CC BY-SA 4.0', text }
    }
    if (cache.size >= 100) cache.delete(cache.keys().next().value!)
    cache.set(city.code, { expires: Date.now() + 24 * 60 * 60 * 1000, context })
    return context
  } catch {
    return null
  }
}
