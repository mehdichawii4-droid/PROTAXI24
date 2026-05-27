import { httpsCallable } from '@firebase/functions';
import { functions } from '@/firebase/functionsInstance';

type ResolveLoginIdentifierRequest = {
  email?: string;
  phone?: string;
};

type ResolveLoginIdentifierResponse = {
  found: boolean;
  email?: string | null;
};

const resolveLoginIdentifierCallable = httpsCallable<
  ResolveLoginIdentifierRequest,
  ResolveLoginIdentifierResponse
>(functions, 'resolveLoginIdentifier');

export async function lookupLoginEmailByPhone(phone: string): Promise<string | null> {
  const result = await resolveLoginIdentifierCallable({ phone });
  const { found, email } = result.data;

  if (!found) return null;
  const normalized = String(email ?? '').trim().toLowerCase();
  return normalized || null;
}

export async function isLoginEmailRegistered(email: string): Promise<boolean> {
  const result = await resolveLoginIdentifierCallable({
    email: email.trim().toLowerCase(),
  });
  return Boolean(result.data.found);
}
