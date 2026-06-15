import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { query } = await req.json()
    if (!query?.trim()) {
      return new Response(JSON.stringify({ photos: [] }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const clientId = Deno.env.get('NAVER_CLIENT_ID')
    const clientSecret = Deno.env.get('NAVER_CLIENT_SECRET')

    const imgRes = await fetch(
      `https://openapi.naver.com/v1/search/image.json?query=${encodeURIComponent(query + ' 음식')}&display=3&sort=sim`,
      {
        headers: {
          'X-Naver-Client-Id': clientId ?? '',
          'X-Naver-Client-Secret': clientSecret ?? '',
        },
      }
    )

    const imgData = await imgRes.json()
    const photos = imgData.items?.map((i: { link: string }) => i.link) ?? []

    return new Response(JSON.stringify({ photos }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('naver-place-photo error:', err)
    return new Response(JSON.stringify({ photos: [], error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
