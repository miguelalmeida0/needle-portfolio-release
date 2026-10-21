import { React, useState } from "../../dist/modules/apps/web/src/shared/react.js";
import { ArtworkImage as OptimizedArtworkImage } from "../../dist/modules/apps/web/src/shared/ui/ArtworkImage.js";
import { mediumSource, imagePriority } from "../../dist/modules/apps/web/src/shared/images/image-sizing.js";

// The museum already publishes gallery-sized JPEGs with a shared CDN cache.
// Reuse one original URL across wall/map/preview instead of making each view
// enqueue a different server transform. Bundled files keep the original cache.
export function ArtworkImage(props) {
  const source = mediumSource(props.src ?? "");
  if (!/^https:\/\/images\.metmuseum\.org\/CRDImages\/[^/]+\/web-large\/[^/?#]+$/i.test(source)) {
    return <OptimizedArtworkImage {...props} />;
  }
  return <MuseumImage key={source} {...props} src={source} />;
}

function MuseumImage(props) {
  const [failed, setFailed] = useState(false);
  if (failed) return <OptimizedArtworkImage {...props} />;
  return <img
    src={props.src}
    alt={props.alt}
    width={props.width || 1}
    height={props.height || 1}
    className={props.className}
    {...imagePriority(props.eager, props.priority)}
    draggable={props.draggable ?? false}
    style={{ backgroundColor: props.dominantColor ?? '#efeee8', aspectRatio: `${props.width || 1} / ${props.height || 1}` }}
    onError={() => setFailed(true)}
  />;
}
