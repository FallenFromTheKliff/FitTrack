import { existsSync } from 'fs';
import { resolve } from 'path';

const candidates = [
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), '.env'),
  resolve(__dirname, '../../../.env'),
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../.env'),
  resolve(__dirname, '.env'),
];

export const localEnvFilePath = candidates.find((candidate) => existsSync(candidate));
