import { React as R } from "../../dist/modules/apps/web/src/shared/react.js";
import * as C from "./detail-core.mjs";
import { imageUrl } from "../../dist/modules/apps/web/src/shared/images/image-sizing.js";
import { Select } from "./ui-controls.jsx";
import { ArtworkImage } from "./GalleryImage.jsx";
const h = R.createElement;
const useState = R.useState, useRef = R.useRef, useEffect = R.useEffect;
let dataPromise;
function detailData() {
  if (!dataPromise) {
    dataPromise = Promise.all(["items.json", "visual-index.json"].map((n) => fetch("/detail-assets/" + n, { signal: AbortSignal.timeout(1e4) }).then((r) => {
      if (!r.ok) throw Error("Detail search could not load. Try again.");
      return r.json();
    }))).then(([items, index]) => ({ items, index }));
    dataPromise.catch(() => {
      dataPromise = null;
    });
  }
  return dataPromise;
}
const button = (text, onClick, props = {}) => h("button", { type: "button", onClick, ...props }, text);
function Navigation({ onDiscover, onCompare, onSaved, compareCount, active }) {
  const [notice, setNotice] = useState(false);
  const compareTrigger = useRef(null), compareNotice = useRef(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(false), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!notice) return;
    const outside = (e) => {
      if (!compareTrigger.current?.contains(e.target) && !compareNotice.current?.contains(e.target)) setNotice(false);
    };
    const escape = (e) => {
      if (e.key === "Escape") setNotice(false);
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [notice]);
  return h(
    "nav",
    { className: "nd-nav", "aria-label": "Main navigation" },
    button("Discover", onDiscover, { "aria-current": active === "discover" ? "page" : void 0 }),
    button("Compare" + (compareCount ? " " + compareCount : ""), () => {
      if (compareCount >= 2) onCompare();
      else setNotice((v) => !v);
    }, { ref: compareTrigger, "aria-current": active === "compare" ? "page" : void 0, "aria-expanded": notice }),
    button("Saved", onSaved, { "aria-current": active === "saved" ? "page" : void 0 }),
    notice && h("p", { ref: compareNotice, className: "nd-nav-note", role: "status" }, "Select two artworks with the compare button on each image.")
  );
}
function ArtworkPopup({ artwork: a, runtime, state, onOpen, onCompare, onOpenCollection, resultIds = [] }) {
  const [phase, setPhase] = useState("artwork"), [busy, setBusy] = useState(false), [error, setError] = useState(""), [data, setData] = useState(null), [image, setImage] = useState(null), [crop, setCrop] = useState({ x: 0.275, y: 0.275, width: 0.45, height: 0.45 }), [matches, setMatches] = useState([]), [visible, setVisible] = useState(12), [collection, setCollection] = useState(""), [notice, setNotice] = useState(""), [sourceIndex, setSourceIndex] = useState(0), [saving, setSaving] = useState(false);
  const [savedDestination, setSavedDestination] = useState(null);
  const operation = useRef(0), stage = useRef(null), drag = useRef(null), cropButton = useRef(null), searchButton = useRef(null), resultsHeading = useRef(null), artworkHeading = useRef(null), mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current++;
    };
  }, []);
  useEffect(() => {
    artworkHeading.current?.focus();
  }, [a?.id]);
  useEffect(() => {
    if (phase === "crop") searchButton.current?.focus();
    if (phase === "matches") resultsHeading.current?.focus();
  }, [phase]);
  if (!a) return h("p", { className: "nd-status", role: "status" }, "Opening artwork\u2026");
  const local = data?.items.find((x) => x.id === a.objectId), sources = C.imageSources(a, local?.image), src = image?.src || sources[sourceIndex], comparison = C.compareState(state.compareArtworkIds || [], a.id);
  const saved = state.savedCollections.filter((c) => c.artworkIds.includes(a.id));
  const ids = resultIds.includes(a.id) ? resultIds : [a.id], position = ids.indexOf(a.id);
  async function beginCrop() {
    const token = ++operation.current;
    setBusy(true);
    setError("");
    try {
      const d = await detailData(), item = d.items.find((x) => x.id === a.objectId);
      const candidates = C.imageSources(a, item?.image);
      // Use the existing same-origin image service so remote museum images can
      // be read by canvas even when the museum omits CORS response headers.
      const im = await C.loadFirstImage([...new Set([item?.image, ...candidates.map(source => imageUrl(source, 640, "webp")), ...candidates].filter(Boolean))]);
      C.describe(im, { x: 0, y: 0, width: 1, height: 1 });
      if (!mounted.current || token !== operation.current) return;
      setData(d);
      setImage(im);
      setPhase("crop");
    } catch (e) {
      if (mounted.current && token === operation.current) setError(e.name === "SecurityError" ? "This image host does not allow detail search. Try another artwork." : e.message);
    } finally {
      if (mounted.current && token === operation.current) setBusy(false);
    }
  }
  function cancelCrop() {
    operation.current++;
    setBusy(false);
    setError("");
    setPhase("artwork");
    requestAnimationFrame(() => cropButton.current?.focus());
  }
  function search() {
    setError("");
    try {
      const descriptor = C.describe(image, crop), ids2 = C.rank(descriptor, data.index, a.objectId);
      const byId = new Map(data.items.map((x) => [x.id, x]));
      setMatches(ids2.map((id) => byId.get(id)).filter(Boolean));
      setVisible(12);
      setPhase("matches");
    } catch (e) {
      setError(e.name === "SecurityError" ? "This image cannot be processed in your browser. Try another artwork." : "The selection could not be processed. Try again.");
    }
  }
  function point(e) {
    const rect = stage.current.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) };
  }
  function startDrag(e) {
    if (phase !== "crop") return;
    e.preventDefault();
    drag.current = point(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moveDrag(e) {
    if (!drag.current) return;
    const p = point(e), s = drag.current;
    setCrop(C.clampCrop({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), width: Math.abs(s.x - p.x), height: Math.abs(s.y - p.y) }));
  }
  function shift(dx, dy) {
    setCrop((r) => C.clampCrop({ ...r, x: Math.min(1 - r.width, r.x + dx), y: Math.min(1 - r.height, r.y + dy) }));
  }
  async function save() {
    if (saving) return;
    setSaving(true);
    setNotice("");
    setSavedDestination(null);
    try {
      const id = collection || state.savedCollections[0]?.id;
      if (id) await runtime.addArtworkToCollection(id, a.id);
      else await runtime.createCollectionFromArtwork(a.id);
      const updated = runtime.store.getSnapshot().savedCollections;
      const destination = id ? updated.find(item => item.id === id) : updated[0];
      if (!destination?.artworkIds.includes(a.id)) throw Error("Save failed");
      if (mounted.current) { setNotice("Artwork saved."); setSavedDestination(destination.id); }
    } catch (error2) {
      if (mounted.current) setNotice("The artwork could not be saved. Try again.");
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  if (phase === "matches") return h(
    "section",
    { className: "nd-detail-results" },
    h("div", { className: "nd-results-heading" }, h("div", null, h("p", { className: "nd-label" }, "DETAIL SEARCH"), h("h2", { ref: resultsHeading, tabIndex: -1 }, "Similar details"), h("p", null, `Color and texture matches across ${data.items.length} indexed artworks.`)), button("\u2190 Adjust selection", () => setPhase("crop"), { className: "nd-button" })),
    h("div", { className: "nd-result-grid" }, matches.slice(0, visible).map((item) => h("button", { className: "nd-match", key: item.id, onClick: () => onOpen("met-" + item.id), "aria-label": "View " + item.title }, h("img", { src: item.image, alt: item.title, loading: "lazy" }), h("span", null, item.title), h("small", null, item.creator)))),
    visible < matches.length && button("Show more", () => setVisible((v) => v + 12), { className: "nd-button nd-more" })
  );
  return h(
    "div",
    { className: "nd-popup" },
    h(
      "section",
      { className: "nd-visual", "aria-label": "Selected artwork" },
      h("div", { className: "nd-stage-wrap" }, h(
        "div",
        { ref: stage, className: "nd-stage" + (phase === "crop" ? " is-cropping" : ""), onPointerDown: startDrag, onPointerMove: moveDrag, onPointerUp: () => {
          drag.current = null;
        }, onPointerCancel: () => {
          drag.current = null;
        } },
        phase === "artwork" ? h(ArtworkImage, { role: "detail", src: a.detailImageUrl || a.imageUrl || a.thumbnailUrl, fallbackSrc: a.imageUrl || a.thumbnailUrl, alt: a.title, width: a.imageWidth, height: a.imageHeight }) : h("img", { src, alt: a.title, onError: () => {
          if (sourceIndex + 1 < sources.length) setSourceIndex((i) => i + 1);
          else setError("Image unavailable. Try detail search to retry, or choose another artwork.");
        } }),
        phase === "crop" && h("div", { className: "nd-crop-box", style: { left: crop.x * 100 + "%", top: crop.y * 100 + "%", width: crop.width * 100 + "%", height: crop.height * 100 + "%" }, "aria-hidden": true })
      )),
      phase === "artwork" ? h("div", { className: "nd-image-actions" }, button(busy ? "Preparing image\u2026" : "Search a detail", beginCrop, { ref: cropButton, className: "nd-button", disabled: busy, "aria-busy": busy }), h("div", { className: "nd-pagination" }, button("\u2190", () => onOpen(ids[(position - 1 + ids.length) % ids.length]), { "aria-label": "Previous artwork", disabled: ids.length < 2 }), button("\u2192", () => onOpen(ids[(position + 1) % ids.length]), { "aria-label": "Next artwork", disabled: ids.length < 2 }))) : h("div", { className: "nd-crop-controls" }, h("p", null, "Drag over the image to select a detail."), h("label", null, "Selection size", h("input", { type: "range", min: 3, max: 100, value: Math.round(crop.width * 100), "aria-label": "Selection size", onChange: (e) => {
        const size = +e.target.value / 100;
        setCrop(C.clampCrop({ x: Math.min(crop.x, 1 - size), y: Math.min(crop.y, 1 - size), width: size, height: size }));
      } })), h("div", { className: "nd-crop-buttons" }, button("\u2190", () => shift(-0.03, 0), { "aria-label": "Move selection left" }), button("\u2191", () => shift(0, -0.03), { "aria-label": "Move selection up" }), button("\u2193", () => shift(0, 0.03), { "aria-label": "Move selection down" }), button("\u2192", () => shift(0.03, 0), { "aria-label": "Move selection right" }), button("Cancel", cancelCrop, { className: "nd-button" }), button("Search this detail", search, { ref: searchButton, className: "nd-button nd-primary" })), h("p", { className: "nd-fine" }, "Matches color and texture; it does not identify objects.")),
      error && h("p", { role: "alert", className: "nd-error" }, error)
    ),
    h(
      "section",
      { className: "nd-info" },
      h("p", { className: "nd-label" }, a.department),
      h("h2", { ref: artworkHeading, tabIndex: -1 }, a.title),
      h("p", { className: "nd-creator" }, a.creator),
      h("p", { className: "nd-date" }, a.objectDate),
      h("div", { className: "nd-actions" }, button(saving ? "Saving\u2026" : saved.some((c) => c.id === (collection || state.savedCollections[0]?.id)) ? "Saved" : "Save artwork", save, { className: "nd-button nd-primary", disabled: saving, "aria-busy": saving }), button(comparison.label, () => {
        setNotice(comparison.selected ? "Removed from comparison." : "Selected for comparison. Choose another artwork.");
        onCompare(a.id);
      }, { className: "nd-button" + (comparison.selected ? " nd-selected" : ""), "aria-pressed": comparison.selected })),
      state.savedCollections.length > 0 && h("div", { className: "nd-collection-label" }, h("span", null, "Save to"), h(Select, { value: collection || state.savedCollections[0].id, onChange: setCollection, label: "Save to collection", options: state.savedCollections.map((c) => ({ value: c.id, label: c.name })) })),
      h("div", { className: "nd-save-feedback" }, h("p", { role: "status", className: "nd-fine" }, notice), savedDestination && onOpenCollection && button("View collection", () => onOpenCollection(savedDestination), {className:"nd-inline-action"})),
      h("dl", null, [["Medium", a.medium], ["Culture", a.culture], ["Credit", a.creditLine]].filter(([, v]) => v).map(([label, value]) => h("div", { key: label }, h("dt", null, label), h("dd", null, value)))),
      h("a", { href: a.objectUrl, target: "_blank", rel: "noopener noreferrer", className: "nd-source" }, "View the museum record \u2197")
    )
  );
}
export {
  ArtworkPopup,
  Navigation
};
