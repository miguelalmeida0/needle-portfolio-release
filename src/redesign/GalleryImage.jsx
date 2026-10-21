import { React, useState } from "../../dist/modules/apps/web/src/shared/react.js";
import { ArtworkImage as OptimizedArtworkImage } from "../../dist/modules/apps/web/src/shared/ui/ArtworkImage.js";
import { mediumSource, imagePriority, imageUrl } from "../../dist/modules/apps/web/src/shared/images/image-sizing.js";

// The museum already publishes gallery-sized JPEGs with a shared CDN cache.
// Reuse one original URL across wall/map/preview instead of making each view
// enqueue a different server transform. Bundled files keep the original cache.
export function ArtworkImage(props) {
  if (props.role === 'detail') props = { ...props, eager: true, priority: true };
  const source = mediumSource(props.src ?? "");
  if (!/^https:\/\/images\.metmuseum\.org\/CRDImages\/[^/]+\/web-large\/[^/?#]+$/i.test(source)) {
    return <OptimizedArtworkImage {...props} />;
  }
  return <MuseumImage key={source} {...props} src={source} />;
}

function MuseumImage(props) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  if (failed) return <OptimizedArtworkImage {...props} />;
  // Bundled gallery previews are already prepared at 640px. Show that same
  // artwork while its museum detail loads; remote galleries share src directly.
  const preview = props.role === 'detail' && !ready && /^\/packs\/[^/]+\/images\//.test(props.fallbackSrc ?? '')
    ? imageUrl(props.fallbackSrc, 640) : undefined;
  return <img
    src={props.src}
    alt={props.alt}
    width={props.width || 1}
    height={props.height || 1}
    className={props.className}
    {...imagePriority(props.eager, props.priority)}
    draggable={props.draggable ?? false}
    style={{ backgroundColor: props.dominantColor ?? '#efeee8', aspectRatio: `${props.width || 1} / ${props.height || 1}`, backgroundImage: preview ? `url("${preview}")` : undefined, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
    onLoad={() => setReady(true)}
    onError={() => setFailed(true)}
  />;
}
