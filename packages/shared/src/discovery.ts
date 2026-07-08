import type { Candidate } from "./types.js";

export interface CandidateSource {
  find(capability: string, hint?: string[]): Promise<Candidate[]>;
}

export interface RegistryEntry extends Candidate {
  capability: string;
}

export class ConfiguredRegistrySource implements CandidateSource {
  constructor(private registry: RegistryEntry[]) {}

  async find(capability: string, hint?: string[]): Promise<Candidate[]> {
    const matches = this.registry.filter((entry) => entry.capability === capability);
    const filtered = hint && hint.length > 0 ? matches.filter((entry) => hint.includes(entry.serviceId)) : matches;
    return filtered.map(({ capability: _capability, ...candidate }) => candidate);
  }
}
