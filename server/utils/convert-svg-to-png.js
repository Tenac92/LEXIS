import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { createLogger } from './logger';

const logger = createLogger('ConvertSvgToPng');

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
    logger.debug(`Successfully converted ${svgPath} to ${pngPath}`);
  })
  .catch(err => {
    logger.error('Error converting SVG to PNG:', err);
  });