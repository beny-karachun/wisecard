import { z } from "zod";
import {
  ENGINE_VERSION,
  simulationSchema,
  type SimulationInput,
} from "./input";
const snapshotSchema = z.object({
  version: z.literal(ENGINE_VERSION),
  input: simulationSchema,
});
export function readSnapshot(value: unknown): SimulationInput | null {
  const parsed = snapshotSchema.safeParse(value);
  return parsed.success ? parsed.data.input : null;
}
