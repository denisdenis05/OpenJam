import { IntegrationFailureCode } from '../../contracts/network';
import { IntegrationFailure } from './IntegrationFailure';

const TextType = 'string';
const NumberType = 'number';
const ObjectType = 'object';
const EmptyText = '';
const MinimumDurationMilliseconds = 0;

export function objectValue(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== ObjectType || Array.isArray(value)) {
    throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  }
  return value as Record<string, unknown>;
}

export function textValue(value: unknown): string {
  if (typeof value !== TextType || (value as string).trim() === EmptyText) {
    throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  }
  return (value as string).trim();
}

export function durationValue(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== NumberType || !Number.isFinite(value) || (value as number) < MinimumDurationMilliseconds) {
    throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  }
  return value as number;
}

export function arrayValue(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  return value;
}
