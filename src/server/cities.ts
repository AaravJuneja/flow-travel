import rows from '../data/india-cities.json'

export type City = { code: string; name: string; latitude: number; longitude: number; state: string }

const states: Record<string, string> = {
  '01': 'Andaman and Nicobar Islands', '02': 'Andhra Pradesh', '03': 'Assam', '05': 'Chandigarh', '07': 'Delhi', '09': 'Gujarat', '10': 'Haryana', '11': 'Himachal Pradesh', '12': 'Jammu and Kashmir', '13': 'Kerala', '14': 'Lakshadweep', '16': 'Maharashtra', '17': 'Manipur', '18': 'Meghalaya', '19': 'Karnataka', '20': 'Nagaland', '21': 'Odisha', '22': 'Puducherry', '23': 'Punjab', '24': 'Rajasthan', '25': 'Tamil Nadu', '26': 'Tripura', '28': 'West Bengal', '29': 'Sikkim', '30': 'Arunachal Pradesh', '31': 'Mizoram', '32': 'Daman and Diu', '33': 'Goa', '34': 'Bihar', '35': 'Madhya Pradesh', '36': 'Uttar Pradesh', '37': 'Chhattisgarh', '38': 'Jharkhand', '39': 'Uttarakhand', '40': 'Telangana', '41': 'Ladakh', '52': 'Dadra and Nagar Haveli and Daman and Diu',
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const cities = rows.map((row) => ({
  code: `IN-${row[0]}`, name: String(row[1]), latitude: Number(row[2]), longitude: Number(row[3]), state: states[String(row[4])] ?? 'India',
  search: normalize(`${row[1]} ${row[6]}`),
}))
const aliases: Record<string, string> = { GGM: 'IN-1270642', JAI: 'IN-1269515' }
const publicCity = ({ search: _, ...city }: typeof cities[number]): City => city

export function findCity(code: string): City | undefined {
  const city = cities.find((city) => city.code === (aliases[code] ?? code))
  return city ? publicCity(city) : undefined
}

export function searchCities(query: string) {
  const term = normalize(query.trim())
  if (term.length < 2) return []
  return cities.filter((city) => city.search.includes(term))
    .sort((a, b) => Number(!normalize(a.name).startsWith(term)) - Number(!normalize(b.name).startsWith(term)))
    .slice(0, 12).map(publicCity)
}

export async function cityPhoto(code: string) {
  const city = findCity(code)
  if (!city) throw new Error('City not found.')
  const headers = { 'User-Agent': 'FlowTravel/1.0 (https://flow.squeakyfiddlepro.me)' }
  const url = new URL('https://en.wikipedia.org/w/api.php')
  url.search = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', generator: 'geosearch', ggscoord: `${city.latitude}|${city.longitude}`, ggsradius: '10000', ggslimit: '5', prop: 'pageimages|info', inprop: 'url', piprop: 'name', pilicense: 'free' }).toString()
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error('City photos are temporarily unavailable.')
  const result = await response.json() as { query?: { pages?: { pageimage?: string; fullurl: string; title: string }[] } }
  const page = result.query?.pages?.find((page) => page.pageimage)
  if (!page?.pageimage) return null
  const imageUrl = new URL('https://commons.wikimedia.org/w/api.php')
  imageUrl.search = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', titles: `File:${page.pageimage}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '400' }).toString()
  const imageResponse = await fetch(imageUrl, { headers, signal: AbortSignal.timeout(8000) })
  if (!imageResponse.ok) throw new Error('City photos are temporarily unavailable.')
  const image = await imageResponse.json() as { query?: { pages?: { imageinfo?: { thumburl?: string; descriptionurl: string; extmetadata?: Record<string, { value: string }> }[] }[] } }
  const info = image.query?.pages?.[0]?.imageinfo?.[0]
  if (!info?.thumburl) return null
  const photoUrl = new URL(info.thumburl)
  if (photoUrl.protocol !== 'https:' || !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(photoUrl.hostname)) return null
  const text = (value?: string) => (value ?? '').replace(/<[^>]*>/g, '').slice(0, 300)
  return { url: info.thumburl, source: info.descriptionurl, title: page.pageimage, author: text(info.extmetadata?.Artist?.value), license: text(info.extmetadata?.LicenseShortName?.value) }
}
