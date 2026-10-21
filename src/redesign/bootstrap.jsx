import { React } from "../../dist/modules/apps/web/src/shared/react.js";
import { AppRuntimeProvider } from "../../dist/modules/apps/web/src/app/app.context.js";
import { AppRuntime } from "../../dist/modules/apps/web/src/app/app.runtime.js";
import { installArtworkIntent } from "../../dist/modules/apps/web/src/shared/images/image-intent.js";
import { artworkById } from "../../dist/modules/apps/web/src/app/app.selectors.js";
import { NeedleApp } from "./NeedleApp.jsx";
import { startEmptySearch } from "./start-empty-search.mjs";

const root = document.getElementById("root");
if (!root) throw new Error("Needle root element was not found.");
const localDevelopment = ["localhost", "127.0.0.1", "[::1]"].includes(
  window.location.hostname,
);
const runtime = new AppRuntime({
  experimentalVisual:
    localDevelopment &&
    new URLSearchParams(window.location.search).get("experimentalVisual") ===
      "1",
});
// Match the deployed bootstrap's responsive runtime subscription.
const viewport = window.matchMedia("(max-width: 680px)");
const sync = () =>
  runtime.store.dispatch({
    type: "VIEWPORT_CHANGED",
    isMobile: viewport.matches,
  });
sync();
viewport.addEventListener?.("change", sync);
window.SHAP.ReactDom.render(
  <React.StrictMode>
    <AppRuntimeProvider runtime={runtime}>
      <NeedleApp />
    </AppRuntimeProvider>
  </React.StrictMode>,
  root,
);
void startEmptySearch(runtime, root, window.location);
const releaseIntent = installArtworkIntent(root, (id) =>
  artworkById(runtime.store.getSnapshot(), id),
);
window.addEventListener(
  "beforeunload",
  () => {
    viewport.removeEventListener?.("change", sync);
    releaseIntent();
    runtime.dispose();
  },
  { once: true },
);
