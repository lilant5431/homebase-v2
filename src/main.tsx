import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Workspace from "./Workspace";
import "./style.css";
const CrystalWorkspace = lazy(() => import("./demo/CrystalWorkspace"));
const ConstellationWorkspace = lazy(
  () => import("./constellation/ConstellationWorkspace"),
);
function Entry() {
  const [route, setRoute] = useState(() => location.hash);
  useEffect(() => {
    const update = () => setRoute(location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const world = route === "#world" || route === "#demo";
  return route === "#crystal" ? (
    <Suspense fallback={<p role="status">Opening your constellation…</p>}>
      <ConstellationWorkspace />
    </Suspense>
  ) : route.startsWith("#auditions") || world ? (
    <Suspense fallback={<p role="status">Opening Lumen World…</p>}>
      <CrystalWorkspace />
    </Suspense>
  ) : (
    <>
      <Workspace route={route} />
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Entry />
  </React.StrictMode>,
);
