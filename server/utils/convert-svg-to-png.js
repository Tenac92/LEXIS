import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, 'assets', 'signature-box.svg');
const pngPath = path.join(__dirname, 'assets', 'signature-box.png');

// Convert SVG to PNG
sharp(svgPath)
  .resize(300, 200)
  .png()
  .toFile(pngPath)
  .then(() => {
    console.log(`Successfully converted ${svgPath} to ${pngPath}`);
  })
  .catch(err => {
    console.error('Error converting SVG to PNG:', err);
  });