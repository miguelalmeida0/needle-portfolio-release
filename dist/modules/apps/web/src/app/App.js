import { React } from '../shared/react.js';
import { SearchSidebar } from '../features/sidebar/SearchSidebar.js';
import { MapToolbar } from '../features/topbar/MapToolbar.js';
import { SpatialMap } from '../features/map/SpatialMap.js';
import { InspectorPanel } from '../features/inspector/InspectorPanel.js';
import { AccuracyControl } from '../features/tuning/AccuracyControl.js';
import { useAppState, useAppSelector, useAppRuntime } from './app.context.js';
import { TruthLens } from '../features/truth/TruthLens.js';
import { CollectionWall } from '../features/wall/CollectionWall.js';
import { FeedbackToast } from '../shared/ui/FeedbackToast.js';
const DetailSearchOverlay = React.lazy(() => import('../features/detail/DetailSearchOverlay.js').then(module => ({ default: module.DetailSearchOverlay })));
export function App() {
    const mapView = useAppSelector(state => state.mapView);
    return (React.createElement("div", { className: "app-shell" },
        React.createElement(SearchSidebar, null),
        React.createElement(MapToolbar, null),
        mapView === 'wall' ? React.createElement(CollectionWall, null) : React.createElement(SpatialMap, null),
        React.createElement(TruthLens, null),
        React.createElement(InspectorPanel, null),
        React.createElement(AccuracyControl, null),
        React.createElement(DetailSlot, null),
        React.createElement(FeedbackToast, null),
        React.createElement(StartupError, null)));
}
function DetailSlot() {
    const runtime = useAppRuntime();
    const id = useAppSelector(state => state.detailSearchArtworkId);
    return runtime.experimentalVisual && id ? React.createElement(React.Suspense, { fallback: null },
        React.createElement(DetailSearchOverlay, null)) : null;
}
function StartupError() {
    const state = useAppState();
    return state.status === 'error' ? (React.createElement("div", { className: "boot-screen boot-screen--error", role: "alert" },
        React.createElement("span", { className: "boot-screen__mark" }, "!"),
        React.createElement("h2", null, "The local data pack could not be opened"),
        React.createElement("p", null, state.errorMessage),
        React.createElement("button", { type: "button", onClick: () => window.location.reload() }, "Retry startup"))) : null;
}
//# sourceMappingURL=App.js.map