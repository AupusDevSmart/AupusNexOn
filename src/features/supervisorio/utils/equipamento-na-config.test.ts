import { describe, expect, it } from "vitest";
import { equipamentoNaConfig } from "./equipamento-na-config";

const eq = (categoria: string, noDiagrama?: boolean, tipo = "") => ({ categoria, tipo, noDiagrama });

describe("equipamentoNaConfig (NEXON-19)", () => {
  it("mostra só quem está no diagrama unifilar", () => {
    expect(equipamentoNaConfig(eq("Inversor PV", true), false)).toBe(true);
    expect(equipamentoNaConfig(eq("Power Meter", false, "METER_M160"), false)).toBe(false);
  });

  it("TON e gateway A966 nunca aparecem, nem no diagrama", () => {
    expect(equipamentoNaConfig(eq("TON", true, "TON1"), false)).toBe(false);
    expect(equipamentoNaConfig(eq("Gateway", true, "IMS_A966"), false)).toBe(false);
  });

  it("selecionado fora do diagrama continua visível para poder desmarcar", () => {
    expect(equipamentoNaConfig(eq("Power Meter", false), true)).toBe(true);
  });

  it("sem informação de diagrama, mostra", () => {
    expect(equipamentoNaConfig(eq("Inversor PV"), false)).toBe(true);
  });
});
