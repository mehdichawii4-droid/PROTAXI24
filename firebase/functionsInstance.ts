import { getFunctions, type Functions } from '@firebase/functions';
import { appConfig } from '@/config/appConfig';
import { app } from './app';

let functionsInstance: Functions | null = null;

export function getFirebaseFunctions(): Functions {
  if (!functionsInstance) {
    functionsInstance = getFunctions(
      app,
      appConfig.api.firebaseFunctionsRegion,
    );
  }

  return functionsInstance;
}
