import { React, useMemo } from '../../shared/react.js';
import { layoutClusterLabels } from './cluster-label-layout.js';
export function ClusterLabels(props) {
    const positions = useMemo(() => layoutClusterLabels(props.clusters, {
        width: props.width,
        height: props.height,
        featuredMatch: props.featuredMatch,
        queryNode: props.queryNode,
        resultCoordinates: props.resultCoordinates
    }), [props.clusters, props.width, props.height, props.featuredMatch, props.queryNode, props.resultCoordinates]);
    const positionById = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions]);
    return (React.createElement("div", { className: "cluster-labels", "aria-label": "Semantic neighborhoods" }, props.clusters.map((cluster) => {
        const position = positionById.get(cluster.id) ?? { x: cluster.center.x, y: cluster.center.y - .11 };
        return (React.createElement("button", { type: "button", key: cluster.id, className: props.activeClusterId === cluster.id ? 'is-active' : '', style: {
                '--cluster-x': `${position.x * props.width}px`,
                '--cluster-y': `${position.y * props.height}px`,
                '--cluster-color': cluster.color
            }, onClick: () => props.onSelect(props.activeClusterId === cluster.id ? null : cluster.id) },
            React.createElement("i", null),
            React.createElement("span", null, cluster.label)));
    })));
}
//# sourceMappingURL=ClusterLabels.js.map