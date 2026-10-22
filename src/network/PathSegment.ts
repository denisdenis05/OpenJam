import { IntegrationFailureCode } from '../../contracts/network';
import { IntegrationFailure } from './IntegrationFailure';

const PathPolicy = Object.freeze({ current: '.', parent: '..' });

export function pathSegment(value: string): string {
  if (!value.trim() || value === PathPolicy.current || value === PathPolicy.parent) {
    throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  }
  return encodeURIComponent(value);
}
