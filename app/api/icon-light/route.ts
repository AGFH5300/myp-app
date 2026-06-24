export async function GET(request: Request) {
  const original = new URL('/myp-atlas-icon.svg', request.url)
  const source = await fetch(original).then((response) => response.text())
  const lightSource = source.replace('fill="#08263d"', 'fill="#fbf9f4"')

  return new Response(lightSource, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
  })
}
