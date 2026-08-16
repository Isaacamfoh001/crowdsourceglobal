import { logisticsRepository } from "./repository";
import { ok, err, type Result } from "../../lib/result";
import type { ReceivingLocationInput } from "./types";

export const logisticsService = {
  listAll() {
    return logisticsRepository.listAll();
  },

  listActive() {
    return logisticsRepository.listActive();
  },

  findDefaultActive() {
    return logisticsRepository.findDefaultActive();
  },

  async create(input: ReceivingLocationInput): Promise<Result<{ id: string }>> {
    if (input.name.trim().length < 2) return err("Enter a location name.");
    if (input.country.trim().length < 2) return err("Enter a country.");
    if (input.addressLine1.trim().length < 3) return err("Enter an address.");
    const created = await logisticsRepository.create(input);
    return ok({ id: created.id });
  },

  async setActive(id: string, active: boolean): Promise<Result<null>> {
    const existing = await logisticsRepository.findById(id);
    if (!existing) return err("Receiving location not found.");
    await logisticsRepository.update(id, { active });
    return ok(null);
  },
};
