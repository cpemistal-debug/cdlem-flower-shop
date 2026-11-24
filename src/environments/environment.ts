import type { FirebaseOptions } from 'firebase/app';
import { firebaseConfig } from './firebase-config.generated';

export const environment: { firebase: FirebaseOptions } = {
  firebase: firebaseConfig,
};
