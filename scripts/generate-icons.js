import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const sourceLogo = path.resolve('src/assets/images/mallikarjuna_rottelu_logo_1789103187340.jpg');
const publicDir = path.resolve('public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

async function generate() {
  console.log('Generating PWA icons from:', sourceLogo);

  // 1. 192x192
  await sharp(sourceLogo)
    .resize(192, 192, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Created pwa-192x192.png');

  // 2. 512x512
  await sharp(sourceLogo)
    .resize(512, 512, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Created pwa-512x512.png');

  // 3. 512x512 Maskable (Inner content scaled to 80% safe zone with #78350F background)
  const innerSize = Math.round(512 * 0.78);
  const innerLogo = await sharp(sourceLogo)
    .resize(innerSize, innerSize, { fit: 'cover' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 120, g: 53, b: 15, alpha: 1 }, // #78350F
    }
  })
  .composite([
    {
      input: innerLogo,
      gravity: 'center'
    }
  ])
  .png()
  .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Created pwa-maskable-512x512.png');

  // 4. Apple Touch Icon 180x180
  await sharp(sourceLogo)
    .resize(180, 180, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  // 5. Favicon PNG
  await sharp(sourceLogo)
    .resize(64, 64, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('Created favicon.png');

  // 6. Favicon ICO (copy or 32x32 png)
  await sharp(sourceLogo)
    .resize(32, 32, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('Created favicon.ico');

  console.log('All icons generated successfully!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
