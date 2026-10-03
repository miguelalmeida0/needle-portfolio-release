import { React } from '../shared/react.js';
import { App } from './App.js';
import { AppRuntimeProvider } from './app.context.js';
import { AppRuntime } from './app.runtime.js';
import { installArtworkIntent } from '../shared/images/image-intent.js';
import { artworkById } from './app.selectors.js';
const root = document.getElementById('root');
if (!root)
    throw new Error('Needle root element was not found.');
// Local developer opt-in only. Public URLs and stored recipes cannot enable it.
const localDevelopment = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
const runtime = new AppRuntime({ experimentalVisual: localDevelopment && new URLSearchParams(window.location.search).get('experimentalVisual') === '1' });
window.SHAP.ReactDom.render(React.createElement(React.StrictMode, null,
    React.createElement(AppRuntimeProvider, { runtime: runtime },
        React.createElement(App, null))), root);
void runtime.start();
const releaseIntent = installArtworkIntent(root, id => artworkById(runtime.store.getSnapshot(), id));
window.addEventListener('beforeunload', () => { releaseIntent(); runtime.dispose(); }, { once: true });
//# sourceMappingURL=bootstrap.js.map