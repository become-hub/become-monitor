import type { PolarSessionEndV2 } from "./types";

export type BuildPolarSessionEndInput = {
  sid: string;
  lastSeq: number;
  beatCount: number;
  epochs: number;
  ticks: number;
};

export function buildPolarSessionEndPayload(
  input: BuildPolarSessionEndInput
): PolarSessionEndV2 {
  return {
    sid: input.sid,
    lastSeq: input.lastSeq,
    beatCount: input.beatCount,
    epochs: input.epochs,
    ticks: input.ticks,
  };
}
