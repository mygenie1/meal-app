import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

mkdirSync('./scripts', { recursive: true })

const svg = readFileSync('./public/icon.svg', 'utf-8')

for (const size of [192, 512]) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  const png = resvg.render().asPng()
  writeFileSync(`./public/icon-${size}x${size}.png`, png)
  console.log(`✓ public/icon-${size}x${size}.png`)
}

// Apple Touch Icon (180x180)
const resvg180 = new Resvg(svg, { fitTo: { mode: 'width', value: 180 } })
writeFileSync('./public/apple-touch-icon.png', resvg180.render().asPng())
console.log('✓ public/apple-touch-icon.png')
