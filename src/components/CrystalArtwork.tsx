// Provisional decorative renderer. No scheduling or persistence dependencies.
export function CrystalArtwork() {
  return (
    <div className="crystal-scene" aria-hidden="true">
      <div className="halo" />
      <div className="crystal c1" />
      <div className="crystal c2" />
      <div className="crystal c3" />
      <div className="crystal-floor" />
    </div>
  );
}
