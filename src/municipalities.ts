import type { CityClient } from './city.js';
import type { MunicipalAdapter } from './places.js';
import type { Point, ReportInput, Destination, Receipt } from './model.js';
import type { zurichReportingGuidance } from './reporting-guidance.js';

export type ReportingGuidance = typeof zurichReportingGuidance;
export type ReportingAdapter = MunicipalAdapter &
  Pick<CityClient, 'categories' | 'geocode' | 'reports' | 'report' | 'nearby'> & {
    requirements(
      point: Point,
      options?: { fresh?: boolean },
    ): ReturnType<CityClient['requirements']>;
    submit(preview: import('./model.js').Prepared): Promise<{
      state: 'accepted' | 'confirmation_pending' | 'rejected' | 'unknown';
      report_id?: string;
    }>;
    readonly termsUrl?: string;
    readonly serviceId: string;
    readonly privacy: string;
    readonly reportingService: string;
    readonly reportingUrl: string;
    readonly reportFormUrl: string;
    readonly placeMapUrl: string;
    readonly submissionMode: 'direct' | 'official_form' | 'unverified';
    readonly fallbackPrefilled: boolean;
    readonly trackingSupported: boolean;
    readonly guidance: ReportingGuidance;
    mapUrl(point: Point): string;
    fallbackUrl(input: ReportInput): string;
    reportUrl(id: string): string;
  };

// Records predating routing belong exclusively to the original Zürich service.
export const ZURICH_DESTINATION: Destination = { bfs_id: 261, service_id: 'zurich-fixmystreet' };
export const destinationFor = (city: ReportingAdapter): Destination => ({
  bfs_id: city.bfsId,
  service_id: city.serviceId,
});
export const sameDestination = (a: Destination, b: Destination) =>
  a.bfs_id === b.bfs_id && a.service_id === b.service_id;
export function receiptDestination(receipt: Receipt): Destination {
  if (receipt.destination) return receipt.destination;
  if (receipt.summary && receipt.summary.municipality.bfs_id !== 261)
    return {
      bfs_id: receipt.summary.municipality.bfs_id,
      service_id: 'unidentified-legacy-service',
    };
  return ZURICH_DESTINATION;
}
