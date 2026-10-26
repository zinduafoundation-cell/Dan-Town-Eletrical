import { describe, expect, it } from "vitest";
import { calculateSolarLoad } from "./solar-calculator";

describe("solar load calculator", () => {
  it("calculates load and rounded system recommendations", () => {
    expect(calculateSolarLoad([{ name: "Lights", watts: 10, hours: 5, quantity: 6 }])).toEqual({
      peakWatts: 60,
      dailyWh: 300,
      recommendedPanelWatts: 100,
      recommendedBatteryWh: 400,
      recommendedInverterWatts: 100,
    });
  });

  it("returns zero recommendations for an empty appliance list", () => {
    expect(calculateSolarLoad([])).toEqual({
      peakWatts: 0,
      dailyWh: 0,
      recommendedPanelWatts: 0,
      recommendedBatteryWh: 0,
      recommendedInverterWatts: 0,
    });
  });

  it("clamps invalid hours and ignores non-finite input", () => {
    expect(calculateSolarLoad([{ name: "Invalid", watts: Number.NaN, hours: 30, quantity: -2 }])).toEqual({
      peakWatts: 0,
      dailyWh: 0,
      recommendedPanelWatts: 0,
      recommendedBatteryWh: 0,
      recommendedInverterWatts: 0,
    });
  });
});