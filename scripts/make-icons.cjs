// Builds the app icons from public/Logo_Black_Main.png.
// Run from the repo root: node scripts/make-icons.cjs
const path = require('node:path');
const Jimp = require('jimp-compact');

const SOURCE = path.join(__dirname, '..', 'public', 'Logo_Black_Main.png');
const ASSETS = path.join(__dirname, '..', 'apps', 'mobile', 'assets');
const WHITE = 0xffffffff;
const CLEAR = 0x00000000;

/** The logo scaled to `scale` of a square canvas and centred on `background`. */
async function compose(size, scale, background) {
  const logo = await Jimp.read(SOURCE);
  const side = Math.round(size * scale);
  logo.resize(side, side);
  const canvas = new Jimp(size, size, background);
  const offset = Math.round((size - side) / 2);
  canvas.composite(logo, offset, offset);
  return canvas;
}

(async () => {
  // In-app logo: as supplied (transparent background).
  await (await Jimp.read(SOURCE)).writeAsync(path.join(ASSETS, 'logo.png'));
  // iOS icon: no transparency allowed, so the logo sits on white with a small margin.
  await (await compose(1024, 0.9, WHITE)).writeAsync(path.join(ASSETS, 'icon.png'));
  // Android adaptive icon: only the middle two thirds are always visible.
  await (await compose(1024, 0.6, CLEAR)).writeAsync(path.join(ASSETS, 'android-icon-foreground.png'));
  await (await compose(1024, 0.6, CLEAR)).writeAsync(path.join(ASSETS, 'android-icon-monochrome.png'));
  await new Jimp(1024, 1024, WHITE).writeAsync(path.join(ASSETS, 'android-icon-background.png'));
  // Splash and browser tab.
  await (await compose(1024, 0.6, CLEAR)).writeAsync(path.join(ASSETS, 'splash-icon.png'));
  await (await compose(96, 1, WHITE)).writeAsync(path.join(ASSETS, 'favicon.png'));
  console.log('Icons written to', ASSETS);
})();
