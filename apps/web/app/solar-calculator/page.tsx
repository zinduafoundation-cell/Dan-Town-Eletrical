"use client";

import Link from "next/link";
import { BatteryCharging, Calculator, Plus, Sun, Trash2, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { calculateSolarLoad, type SolarLoad } from "@/lib/solar-calculator";

const starterLoads: SolarLoad[] = [
  { name: "Lights", watts: 10, hours: 5, quantity: 4 },
  { name: "Fridge", watts: 150, hours: 8, quantity: 1 },
  { name: "TV", watts: 80, hours: 4, quantity: 1 }
];

export default function SolarCalculatorPage() {
  const [loads, setLoads] = useState(starterLoads);
  const result = useMemo(() => calculateSolarLoad(loads), [loads]);

  function updateLoad(index: number, field: keyof SolarLoad, value: string) {
    setLoads((current) => current.map((load, loadIndex) => loadIndex === index ? { ...load, [field]: field === "name" ? value : Math.max(0, Number(value)) } : load));
  }

  return <main className="solar-calculator-page"><section className="solar-calculator-shell"><div className="solar-calculator-intro"><p className="eyebrow">Dantown Solar Advisor</p><h1>Start with the power your home needs.</h1><p>Estimate your daily energy use and a sensible starting point for panels, battery storage, and inverter capacity. This is an estimate, not a final installation design.</p><div className="hero-actions"><Link href="/request-quote" className="button button-primary">Request a verified design</Link><Link href="/services" className="text-link">Explore services</Link></div></div><section className="solar-calculator-card" aria-labelledby="load-heading"><div className="solar-calculator-card-heading"><div><Calculator size={22} /><h2 id="load-heading">Your appliances</h2></div><button type="button" className="solar-add-load" onClick={() => setLoads((current) => [...current, { name: "New appliance", watts: 50, hours: 2, quantity: 1 }])}><Plus size={16} /> Add appliance</button></div><div className="solar-load-list">{loads.map((load, index) => <div className="solar-load-row" key={`${index}-${load.name}`}><input aria-label={`Appliance ${index + 1} name`} value={load.name} onChange={(event) => updateLoad(index, "name", event.target.value)} /><label>Watts<input aria-label={`${load.name} watts`} type="number" min="0" value={load.watts} onChange={(event) => updateLoad(index, "watts", event.target.value)} /></label><label>Hours/day<input aria-label={`${load.name} hours per day`} type="number" min="0" max="24" step=".5" value={load.hours} onChange={(event) => updateLoad(index, "hours", event.target.value)} /></label><label>Qty<input aria-label={`${load.name} quantity`} type="number" min="1" value={load.quantity} onChange={(event) => updateLoad(index, "quantity", event.target.value)} /></label><button type="button" className="solar-remove-load" aria-label={`Remove ${load.name}`} onClick={() => setLoads((current) => current.filter((_, loadIndex) => loadIndex !== index))}><Trash2 size={16} /></button></div>)}</div></section><section className="solar-results" aria-live="polite"><p className="eyebrow">Estimated starting point</p><div className="solar-result-grid"><Result icon={Zap} label="Peak load" value={`${result.peakWatts.toLocaleString()} W`} /><Result icon={Sun} label="Panel capacity" value={`${result.recommendedPanelWatts.toLocaleString()} W`} /><Result icon={BatteryCharging} label="Battery capacity" value={`${result.recommendedBatteryWh.toLocaleString()} Wh`} /><Result icon={Zap} label="Inverter capacity" value={`${result.recommendedInverterWatts.toLocaleString()} W`} /></div><p className="solar-footnote">Estimated daily use: {(result.dailyWh / 1000).toFixed(2)} kWh. A Dantown specialist should confirm roof conditions, backup goals, wiring, local solar conditions, and product availability.</p></section></section></main>;
}

function Result({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: string }) {
  return <article className="solar-result"><Icon size={19} /><small>{label}</small><strong>{value}</strong></article>;
}