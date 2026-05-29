import { httpsCallable, type HttpsCallable } from '@firebase/functions';
import { getFirebaseFunctions } from '@/firebase/functionsInstance';

type ResolveLoginIdentifierRequest = {
  email?: string;
  phone?: string;
};

type ResolveLoginIdentifierResponse = {
  found: boolean;
  email?: string | null;
};

let resolveLoginIdentifierCallable: HttpsCallable<
  ResolveLoginIdentifierRequest,
  ResolveLoginIdentifierResponse
> | null = null;

function getResolveLoginIdentifierCallable() {
  if (!resolveLoginIdentifierCallable) {
    resolveLoginIdentifierCallable = httpsCallable<
      ResolveLoginIdentifierRequest,
      ResolveLoginIdentifierResponse
    >(getFirebaseFunctions(), 'resolveLoginIdentifier');
  }

  return resolveLoginIdentifierCallable;
}

export async function lookupLoginEmailByPhone(phone: string): Promise<string | null> {
  const result = await getResolveLoginIdentifierCallable()({ phone });
  const { found, email } = result.data;

  if (!found) return null;
  const normalized = String(email ?? '').trim().toLowerCase();
  return normalized || null;
}

export async function isLoginEmailRegistered(email: string): Promise<boolean> {
  const result = await getResolveLoginIdentifierCallable()({
    email: email.trim().toLowerCase(),
  });
  return Boolean(result.data.found);
}
