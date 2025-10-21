/**
 * Default Playwright configuration
 * 
 * This file determines which config to use based on NODE_ENV
 * - Use local config by default
 * - Use prod config when NODE_ENV=production
 * 
 * Usage:
 * - Local: npm test (uses playwright.config.local.ts)
 * - Production: NODE_ENV=production npm test (uses playwright.config.prod.ts)
 */

import localConfig from './playwright.config.local';
import prodConfig from './playwright.config.prod';

const isProduction = process.env.NODE_ENV === 'production';

export default isProduction ? prodConfig : localConfig;

