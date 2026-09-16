export default function Loading() {
  return (
    <main className="route-state-page" aria-live="polite">
      <div className="route-state-card route-state-card--loading">
        <div className="route-state-brand" aria-hidden="true">D</div>
        <div className="route-state-copy">
          <p className="eyebrow">Dantown Electrical</p>
          <h1>Preparing your view</h1>
          <p>Just a moment while we bring the latest products and services into focus.</p>
        </div>
        <div className="route-state-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </main>
  );
}
