import { React } from '../../shared/react.js';
export function ClusterContours(props) {
    return (React.createElement("svg", { className: "cluster-contours", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true" }, props.clusters.map((cluster, index) => {
        const rotation = [-8, 7, -4, 6, -7, 5, 3, -5][index % 8] ?? 0;
        const radiusX = index === 0 ? 17 : 13.5;
        const radiusY = index === 0 ? 13.5 : 10.5;
        const dimmed = props.activeClusterId && props.activeClusterId !== cluster.id;
        return (React.createElement("ellipse", { key: cluster.id, cx: cluster.center.x * 100, cy: cluster.center.y * 100, rx: radiusX, ry: radiusY, stroke: cluster.color, opacity: dimmed ? 0.12 : 0.42, transform: `rotate(${rotation} ${cluster.center.x * 100} ${cluster.center.y * 100})` }));
    })));
}
//# sourceMappingURL=ClusterContours.js.map