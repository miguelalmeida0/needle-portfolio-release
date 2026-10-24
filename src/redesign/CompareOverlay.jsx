import { React, useEffect, useRef, useState } from "../../dist/modules/apps/web/src/shared/react.js";
import { useAppRuntime } from "../../dist/modules/apps/web/src/app/app.context.js";
import { artworkById } from "../../dist/modules/apps/web/src/app/app.selectors.js";
import { Icon } from "../../dist/modules/apps/web/src/shared/icons.js";
import { ArtworkImage } from "./GalleryImage.jsx";
import { comparisonCopy, comparisonTitle, safeCompareIds } from "./comparison.mjs";

function ArtworkSide({ artwork, index }) {
  return (
    <figure className="needle-compare-work">
      <div className="needle-compare-art">
        <ArtworkImage
          role="detail"
          src={artwork.detailImageUrl || artwork.imageUrl || artwork.thumbnailUrl}
          fallbackSrc={artwork.thumbnailFallbackUrls?.[0] || artwork.thumbnailUrl}
          alt={artwork.title || "Untitled artwork"}
          width={artwork.imageWidth}
          height={artwork.imageHeight}
          dominantColor={artwork.dominantColor}
          sizes="(max-width: 760px) 48vw, 34vw"
        />
      </div>
      <figcaption>
        <p className="needle-compare-work__number">Artwork {"0" + index}</p>
        <h3>{artwork.title || "Untitled"}</h3>
        <p>{artwork.creator || "Unknown maker"}</p>
        <p>{artwork.objectDate || (artwork.year == null ? "Date unknown" : String(artwork.year))}</p>
        {artwork.medium && <p className="needle-compare-work__medium">{artwork.medium}</p>}
        {artwork.objectUrl && <a href={artwork.objectUrl} target="_blank" rel="noreferrer">View Met record <Icon name="arrow-right" size={13}/></a>}
      </figcaption>
    </figure>
  );
}

export function CompareOverlay({ ids, query, state, onClose }) {
  const runtime = useAppRuntime();
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const pair = safeCompareIds(ids).map(id => artworkById(state, id)).filter(Boolean);
  const complete = pair.length === 2;
  const [left, right] = pair;
  const alreadySaved = complete && state.savedCollections?.find(collection =>
    pair.every(artwork => collection.artworkIds?.includes(artwork.id)),
  );

  useEffect(() => {
    const previous = document.activeElement;
    const panel = panelRef.current;
    panel?.querySelector(".needle-compare-close")?.focus({ preventScroll: true });
    const keydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = [...panel.querySelectorAll('button:not([disabled]),a[href],[tabindex="0"]')]
        .filter(element => element.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  async function saveBoth() {
    if (!complete || saving || alreadySaved || saved) return;
    setSaving(true);
    setError("");
    try {
      const existing = new Set(runtime.store.getSnapshot().savedCollections.map(collection => collection.id));
      await runtime.createCollectionFromArtwork(left.id);
      const created = runtime.store.getSnapshot().savedCollections.find(collection => !existing.has(collection.id));
      if (!created) throw new Error("Collection not created");
      await runtime.addArtworkToCollection(created.id, right.id);
      const confirmed = runtime.store.getSnapshot().savedCollections.find(collection => collection.id === created.id);
      if (!confirmed || ![left.id, right.id].every(id => confirmed.artworkIds.includes(id))) throw new Error("Collection not saved");
      setSaved(true);
    } catch {
      setError("Could not save these works. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="needle-compare-layer">
      <div className="needle-compare-scrim" aria-hidden="true" onClick={onClose}/>
      <section className="needle-compare-panel" ref={panelRef}
        role="dialog" aria-modal="true"
        aria-labelledby="needle-compare-title" aria-describedby="needle-compare-description">
        <div className="needle-compare-header">
          <span>COMPARE&nbsp; / &nbsp;02 WORKS</span>
          <button className="needle-compare-close" type="button" onClick={onClose} aria-label="Close artwork comparison">
            <Icon name="close" size={19}/>
          </button>
        </div>
        <h2 id="needle-compare-title">{comparisonTitle(query)}</h2>
        <p id="needle-compare-description" className="needle-compare-subtitle">The works you selected</p>
        {complete ? <>
          <div className="needle-compare-pair">
            <ArtworkSide artwork={left} index={1}/>
            <ArtworkSide artwork={right} index={2}/>
          </div>
          <div className="needle-compare-connection">
            <div>
              <p className="needle-compare-eyebrow">THE CONNECTION</p>
              <p>{comparisonCopy(left, right)}</p>
            </div>
            <button type="button" className="needle-compare-save"
              onClick={() => void saveBoth()}
              disabled={saving || saved || Boolean(alreadySaved)}>
              {saving ? "Saving…" : saved || alreadySaved ? "Saved together" : "Save both works"}
            </button>
          </div>
        </> : <p className="needle-compare-unavailable" role="status">
          {state.status === "booting" ? "Opening the collection…" : "These artworks are no longer available. Return to results and choose another pair."}
        </p>}
        <p className="needle-compare-feedback" role="status" aria-live="polite">{error || (saved ? "Both artworks are in your saved collections." : "")}</p>
      </section>
    </div>
  );
}
