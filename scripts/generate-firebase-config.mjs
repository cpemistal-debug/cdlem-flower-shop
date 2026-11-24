import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parse } from 'dotenv';

const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const envPath = resolve(projectRoot, '.env');
const generatedPath = resolve(
  projectRoot,
  'src/environments/firebase-config.generated.ts',
);
let envFile = '';

try {
  envFile = await readFile(envPath, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

const values = { ...parse(envFile), ...process.env };

const requiredKeys = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_APP_ID',
];
const missingKeys = requiredKeys.filter((key) => !values[key]);

if (missingKeys.length > 0) {
  throw new Error(
    `Missing required Firebase settings in .env or environment: ${missingKeys.join(', ')}`,
  );
}

const firebaseOptions = {
  apiKey: values.FIREBASE_API_KEY,
  authDomain: values.FIREBASE_AUTH_DOMAIN,
  ...(values.FIREBASE_DATABASE_URL && { databaseURL: values.FIREBASE_DATABASE_URL }),
  projectId: values.FIREBASE_PROJECT_ID,
  ...(values.FIREBASE_STORAGE_BUCKET && { storageBucket: values.FIREBASE_STORAGE_BUCKET }),
  ...(values.FIREBASE_MESSAGING_SENDER_ID && {
    messagingSenderId: values.FIREBASE_MESSAGING_SENDER_ID,
  }),
  appId: values.FIREBASE_APP_ID,
  ...(values.FIREBASE_MEASUREMENT_ID && { measurementId: values.FIREBASE_MEASUREMENT_ID }),
};

const generatedSource = `import type { FirebaseOptions } from 'firebase/app';\n\nexport const firebaseConfig: FirebaseOptions = ${JSON.stringify(firebaseOptions, null, 2)};\n`;
await writeFile(generatedPath, generatedSource, 'utf8');
