import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceIcon = path.join(root, "store-assets", "app-icon-1024.png");

await generateAndroidIcons();
await generateIosIcons();

console.log("Generated native Android and iOS app icons.");

async function generateAndroidIcons() {
  const densities = [
    ["mipmap-mdpi", 48, 108],
    ["mipmap-hdpi", 72, 162],
    ["mipmap-xhdpi", 96, 216],
    ["mipmap-xxhdpi", 144, 324],
    ["mipmap-xxxhdpi", 192, 432]
  ];

  for (const [folder, iconSize, foregroundSize] of densities) {
    const dir = path.join(root, "android", "app", "src", "main", "res", folder);
    await mkdir(dir, { recursive: true });
    await sharp(sourceIcon).resize(iconSize, iconSize).png().toFile(path.join(dir, "ic_launcher.png"));
    await sharp(sourceIcon).resize(iconSize, iconSize).png().toFile(path.join(dir, "ic_launcher_round.png"));

    const foreground = await sharp(sourceIcon)
      .resize(Math.round(foregroundSize * 0.72), Math.round(foregroundSize * 0.72))
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: foregroundSize,
        height: foregroundSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{ input: foreground, gravity: "center" }])
      .png()
      .toFile(path.join(dir, "ic_launcher_foreground.png"));
  }

  await writeFile(
    path.join(root, "android", "app", "src", "main", "res", "values", "ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#090A0F</color>\n</resources>\n`,
    "utf-8"
  );
}

async function generateIosIcons() {
  const dir = path.join(root, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset");
  await mkdir(dir, { recursive: true });

  const icons = [
    { idiom: "iphone", size: "20x20", scale: "2x", pixels: 40 },
    { idiom: "iphone", size: "20x20", scale: "3x", pixels: 60 },
    { idiom: "iphone", size: "29x29", scale: "2x", pixels: 58 },
    { idiom: "iphone", size: "29x29", scale: "3x", pixels: 87 },
    { idiom: "iphone", size: "40x40", scale: "2x", pixels: 80 },
    { idiom: "iphone", size: "40x40", scale: "3x", pixels: 120 },
    { idiom: "iphone", size: "60x60", scale: "2x", pixels: 120 },
    { idiom: "iphone", size: "60x60", scale: "3x", pixels: 180 },
    { idiom: "ipad", size: "20x20", scale: "1x", pixels: 20 },
    { idiom: "ipad", size: "20x20", scale: "2x", pixels: 40 },
    { idiom: "ipad", size: "29x29", scale: "1x", pixels: 29 },
    { idiom: "ipad", size: "29x29", scale: "2x", pixels: 58 },
    { idiom: "ipad", size: "40x40", scale: "1x", pixels: 40 },
    { idiom: "ipad", size: "40x40", scale: "2x", pixels: 80 },
    { idiom: "ipad", size: "76x76", scale: "1x", pixels: 76 },
    { idiom: "ipad", size: "76x76", scale: "2x", pixels: 152 },
    { idiom: "ipad", size: "83.5x83.5", scale: "2x", pixels: 167 },
    { idiom: "ios-marketing", size: "1024x1024", scale: "1x", pixels: 1024 }
  ];

  const images = [];
  for (const icon of icons) {
    const filename = `AppIcon-${icon.idiom}-${icon.size.replace(".", "_")}@${icon.scale}.png`;
    await sharp(sourceIcon).resize(icon.pixels, icon.pixels).png().toFile(path.join(dir, filename));
    images.push({
      size: icon.size,
      idiom: icon.idiom,
      filename,
      scale: icon.scale
    });
  }

  await writeFile(
    path.join(dir, "Contents.json"),
    JSON.stringify(
      {
        images,
        info: {
          version: 1,
          author: "xcode"
        }
      },
      null,
      2
    ),
    "utf-8"
  );
}
