export type SolarLoad = { name: string; watts: number; hours: number; quantity: number };

export function calculateSolarLoad(loads: SolarLoad[]) {
  const safeLoads = loads.map((load) => ({
    watts: Number.isFinite(load.watts) ? Math.max(0, load.watts) : 0,
    hours: Number.isFinite(load.hours) ? Math.min(24, Math.max(0, load.hours)) : 0,
    quantity: Number.isFinite(load.quantity) ? Math.max(1, Math.floor(load.quantity)) : 1,
  }));
  const peakWatts = safeLoads.reduce((total, load) => total + load.watts * load.quantity, 0);
  const dailyWh = safeLoads.reduce((total, load) => total + load.watts * load.quantity * load.hours, 0);
  const recommendedPanelWatts = Math.ceil((dailyWh / 4.5 / 0.8) / 50) * 50;
  const recommendedBatteryWh = Math.ceil((dailyWh * 1.2) / 100) * 100;
  const recommendedInverterWatts = Math.ceil((peakWatts * 1.25) / 100) * 100;
  return { peakWatts, dailyWh, recommendedPanelWatts, recommendedBatteryWh, recommendedInverterWatts };
}