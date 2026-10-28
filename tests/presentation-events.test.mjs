import test from "node:test";
import assert from "node:assert/strict";
import { mapArtworks } from '../src/redesign/map-artworks.mjs';
import { readFile } from "node:fs/promises";
import {
  backLabel,
  createNavigation,
  isSearchSubmission,
} from "../src/redesign/navigation.mjs";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const source = (
  await read("src/redesign/SearchComposer.jsx")
)
  .replace(/^import .*;\n/gm, "")
  .replace("export function SearchComposer", "function SearchComposer");
const compileComposer = new Function(
  "React",
  "useState",
  "useEffect",
  "useRef",
  "Icon",
  "LoadingMark",
  "useAppRuntime",
  "useAppState",
  source + "\nreturn SearchComposer;",
);

function composer(draft = "door") {
  const state = { draftQuery: draft, corpus: {}, status: "ready" };
  const calls = [];
  const runtime = {
    setDraft(value) {
      state.draftQuery = value;
      calls.push(["draft", value]);
    },
    submitDraft(addToHistory = true) {
      calls.push(["submit", addToHistory]);
    },
  };
  const component = compileComposer(
    {
      createElement: (type, props, ...children) => ({ type, props, children }),
    },
    (value) => [value, () => undefined],
    () => undefined,
    (current) => ({ current }),
    () => undefined,
    () => undefined,
    () => runtime,
    () => state,
  );
  const nodes = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    nodes.push(node);
    node.children?.flat(Infinity).forEach(visit);
  };
  visit(component());
  return {
    calls,
    state,
    input: nodes.find((node) => node.type === "input"),
    clear: nodes.find((node) => node.props?.["aria-label"] === "Clear search"),
    submit: nodes.find(
      (node) => node.props?.["aria-label"] === "Search the collection",
    ),
  };
}

const target = (kind, disabled = false) => ({
  tagName: kind === "input" ? "INPUT" : "BUTTON",
  closest(selector) {
    return kind === "submit" && selector === ".search-composer__submit"
      ? { disabled }
      : null;
  },
});
const key = (kind, options = {}) => ({
  type: "keydown",
  key: "Enter",
  target: target(kind),
  preventDefault() {},
  ...options,
});
const click = (kind) => ({ type: "click", target: target(kind) });

// Exercise the actual deployed Composer handlers together with the presentation
// boundary. Runtime search/history semantics are separately verified by instant-search.test.
test("typing stays a preview while input Enter produces one explicit submission", () => {
  let current = composer("do");
  current.input.props.onInput({ currentTarget: { value: "door" } });
  assert.deepEqual(current.calls, [
    ["draft", "door"],
    ["submit", false],
  ]);
  assert.equal(
    isSearchSubmission({ type: "input", target: target("input") }, "door"),
    false,
  );

  current = composer("door");
  const event = key("input");
  assert.equal(isSearchSubmission(event, current.state.draftQuery), true);
  current.input.props.onKeyDown(event);
  assert.deepEqual(current.calls, [
    ["draft", "door"],
    ["submit", true],
  ]);
});

test("keyboard Clear clears through the original edit path without requesting result navigation", () => {
  const current = composer("door");
  assert.equal(
    isSearchSubmission(key("clear"), current.state.draftQuery),
    false,
  );
  assert.equal(
    isSearchSubmission(click("clear"), current.state.draftQuery),
    false,
  );
  current.clear.props.onClick();
  assert.deepEqual(current.calls, [
    ["draft", ""],
    ["submit", false],
  ]);
});

test("IME Enter stays in composition and submit click follows the Composer once", () => {
  const current = composer("door");
  current.input.props.onCompositionStart();
  const composition = key("input", {
    isComposing: true,
    nativeEvent: { isComposing: true },
  });
  assert.equal(isSearchSubmission(composition, "door", true), false);
  current.input.props.onKeyDown(composition);
  assert.deepEqual(current.calls, []);
  assert.equal(
    isSearchSubmission(key("input"), "door", true),
    false,
    "composition ref also guards platforms without event flag",
  );

  assert.equal(
    isSearchSubmission(key("submit"), "door"),
    false,
    "keyboard button activation navigates through its generated click only",
  );
  assert.equal(isSearchSubmission(click("submit"), "door"), true);
  current.submit.props.onClick();
  assert.deepEqual(current.calls, [
    ["draft", "door"],
    ["submit", true],
  ]);
});

test("empty and disabled search controls do not request presentation changes", () => {
  const current = composer("");
  assert.equal(current.submit.props.disabled, true);
  assert.equal(isSearchSubmission(key("input"), ""), false);
  assert.equal(isSearchSubmission(click("submit"), "   "), false);
  assert.equal(
    isSearchSubmission(
      { type: "click", target: target("submit", true) },
      "door",
    ),
    false,
  );
  assert.equal(
    isSearchSubmission(key("input", { key: "Escape" }), "door"),
    false,
  );
});

test("the presentation wrapper consumes the tested boundary while retaining the tested Composer", async () => {
  const app = await read("src/redesign/NeedleApp.jsx");
  assert.match(
    app,
    /isSearchSubmission\(event, state\.draftQuery, composing\.current\)/,
  );
  assert.match(app, /<SearchComposer\b[^>]*\/>/);
  assert.match(app, /onClickCapture=\{explicitCapture\}/);
  assert.match(app, /onKeyDownCapture=\{explicitCapture\}/);
});

function browserHistory() {
  const entries = [{ state: null }];
  let index = 0;
  return {
    get state() {
      return entries[index].state;
    },
    get length() {
      return entries.length;
    },
    pushState(state) {
      entries.splice(index + 1);
      entries.push({ state: structuredClone(state) });
      index++;
    },
    replaceState(state) {
      entries[index] = { state: structuredClone(state) };
    },
    back() {
      index = Math.max(0, index - 1);
    },
    forward() {
      index = Math.min(entries.length - 1, index + 1);
    },
  };
}
const location = { pathname: "/", search: "" };

test("Back labels name the persisted destination, including results reached from a map", () => {
  const history = browserHistory();
  const nav = createNavigation(history, location);
  nav.visit({ view: "results" });
  assert.equal(backLabel(nav.current()), "search");
  nav.visit({ view: "map" });
  assert.equal(backLabel(nav.current()), "results");
  nav.visit({ view: "results" });
  assert.equal(backLabel(nav.current()), "map");
  nav.back();
  nav.restore(history.state);
  assert.equal(nav.current().view, "map");
  assert.equal(backLabel(nav.current()), "results");
});

test("artwork identity survives Forward and reload independently of current runtime selection", () => {
  const history = browserHistory();
  let nav = createNavigation(history, location);
  nav.visit({ view: "results" });
  nav.visit({ overlay: "tools" });
  nav.visit({
    overlay: "artwork",
    artworkId: "met-552610",
    fromRecommendations: true,
  });
  nav.back();
  nav.restore(history.state);
  assert.equal(nav.current().overlay, "tools");
  history.forward();
  nav.restore(history.state);
  assert.equal(nav.current().artworkId, "met-552610");
  assert.equal(nav.current().fromRecommendations, true);
  nav = createNavigation(history, location);
  assert.equal(nav.current().artworkId, "met-552610");
  const length = history.length;
  nav.visit({ overlay: "artwork", artworkId: "met-53529" });
  assert.equal(
    history.length,
    length + 1,
    "another artwork is a distinct presentation destination",
  );
  nav.back();
  nav.restore(history.state);
  assert.equal(nav.current().artworkId, "met-552610");
  assert.equal(Object.hasOwn(nav.current(), "queryVector"), false);
  assert.equal(
    Object.hasOwn(nav.current(), "queryTerms"),
    false,
    "search recipes remain exclusively runtime-owned",
  );
});

// Run the actual shell's layout effects without a DOM. Browser QA covers native
// dialogs and focus; this pins the route/runtime selection boundary at startup.
async function identityEffect(state, route, visited = [route.view]) {
  const { transform } = await import("esbuild");
  let code = (
    await transform(await read("src/redesign/NeedleApp.jsx"), {
      loader: "jsx",
      format: "esm",
      jsx: "transform",
    })
  ).code;
  const names = [
    ...code.matchAll(/^import\s*\{([\s\S]*?)\}\s*from [^;]+;/gm),
  ].flatMap((match) =>
    match[1]
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );
  code = code
    .replace(/^import [\s\S]*? from [^;]+;\n/gm, "")
    .replace(/^export \{[\s\S]*?\};?\s*$/m, "");
  const effects = [];
  const calls = [];
  const navigation = { current: () => route };
  const values = [navigation, route, new Set(visited), false, { remove() {} }];
  names.push("window", "document");
  const env = Object.fromEntries(names.map((name) => [name, () => undefined]));
  Object.assign(env, {
    window: { SHAP: { ReactDOM: { createPortal: child => child } } },
    document: { documentElement: { dataset: {} } },
    React: {
      createElement: (type, props, ...children) => ({ type, props, children }),
      lazy: () => () => undefined,
    },
    useEffect: () => undefined,
    useLayoutEffect: (callback) => effects.push(callback),
    useMemo: (callback) => callback(),
    useRef: (current) => ({ current }),
    useState: () => [values.shift(), () => undefined],
    useAppRuntime: () => ({
      selectArtwork: (id) => calls.push(id),
      experimentalVisual: false,
    }),
    useAppState: () => state,
    artworkById: (current, id) =>
      current.corpus?.items.find((item) => item.id === id),
    activeCollection: () => null,
    visibleHits: () => [],
    mapArtworks,
    backLabel,
    isSearchSubmission,
    createNavigation,
  });
  const component = new Function(
    "env",
    `const {${names.join(",")}} = env;\n${code}\nreturn NeedleApp;`,
  )(env);
  const tree = component();
  return { calls, restore: effects[2], tree };
}

// Regression: ISSUE-001 — native dragging must not lift controls or selected text.
// Found by /qa on 2026-10-24. Browser layout is checked separately.
test("the shell cancels native drag starts without cancelling pointer or editing events", async () => {
  const { tree } = await identityEffect(
    { status: "ready", corpus: { items: [] }, queryFilters: [] },
    { view: "home", overlay: null },
  );
  assert.equal(typeof tree.props.onDragStartCapture, "function");
  let prevented = 0;
  for (const tagName of ["INPUT", "BUTTON", "SVG", "IMG", "A"]) {
    tree.props.onDragStartCapture({ target: { tagName }, preventDefault() { prevented++; } });
  }
  assert.equal(prevented, 5);
  tree.props.onPointerDownCapture({ preventDefault() { throw new Error("Pointer interaction must remain native"); } });
  assert.equal(tree.props.onTouchMove, undefined, "page scrolling and pinch zoom stay native");
  assert.equal(tree.props.onSelectStartCapture, undefined, "text selection remains available");
  assert.equal(tree.props.onDropCapture, undefined, "external image uploads remain available");
});

test("the shell restores a history artwork after startup, once per route", async () => {
  const state = {
    status: "booting",
    corpus: { items: [{ id: "met-552610" }] },
    queryFilters: [],
    selectedArtworkId: "default",
  };
  const { calls, restore } = await identityEffect(state, {
    view: "map",
    overlay: "artwork",
    artworkId: "met-552610",
  });
  restore();
  assert.deepEqual(calls, [], "startup search retains ownership until ready");
  state.status = "ready";
  restore();
  assert.deepEqual(calls, ["met-552610"]);
  state.selectedArtworkId = "inspector-selection";
  restore();
  assert.deepEqual(
    calls,
    ["met-552610"],
    "later inspector actions are not overwritten by the route",
  );
});

test("opening the already selected image does not duplicate its production select command", async () => {
  const state = {
    status: "ready",
    corpus: { items: [{ id: "met-552610" }] },
    queryFilters: [],
    selectedArtworkId: "met-552610",
  };
  const { calls, restore } = await identityEffect(state, {
    view: "map",
    overlay: "artwork",
    artworkId: "met-552610",
  });
  restore();
  assert.deepEqual(calls, []);
});

test("opening search retains a results destination after a reloaded map", async () => {
  const state = { status: "ready", corpus: { items: [] }, queryFilters: [] };
  const route = { view: "home", overlay: null };
  const nodes = (tree) => [
    tree,
    ...(tree?.children ?? [])
      .flat(Infinity)
      .flatMap((node) => (node && typeof node === "object" ? nodes(node) : [])),
  ];
  const resumed = await identityEffect(state, route, ["map", "home"]);
  assert.equal(
    nodes(resumed.tree).find((node) => node.props?.className === "needle-brand")
      .props["aria-label"],
    "Needle — return to results",
  );
  assert.ok(
    nodes(resumed.tree).some(
      (node) => node.props?.className === "needle-resume",
    ),
  );
  const reloaded = await identityEffect(state, { ...route, backView: "map" });
  assert.ok(
    nodes(reloaded.tree).some(
      (node) => node.props?.className === "needle-resume",
    ),
  );
  const initial = await identityEffect(state, route);
  assert.equal(
    nodes(initial.tree).find((node) => node.props?.className === "needle-brand")
      .props["aria-label"],
    "Needle",
  );
  assert.equal(
    nodes(initial.tree).some(
      (node) => node.props?.className === "needle-resume",
    ),
    false,
  );
});

test('opening a collection clears input even when the prior query was typed during startup',()=>{
 const state={draftQuery:'',corpus:null,status:'booting',indexBuildProgress:{total:0}};
 let value='',effect,dependencies,refIndex=0;const refs=[];
 const component=compileComposer(
  {createElement:(type,props,...children)=>({type,props,children})},
  ()=>[value,next=>{value=next;}],(fn,deps)=>{effect=(!dependencies||deps.some((value,index)=>value!==dependencies[index]))?fn:()=>{};dependencies=deps;},
  initial=>refs[refIndex++]??(refs[refIndex-1]={current:initial}),()=>{},()=>{},
  ()=>({setDraft:next=>{state.draftQuery=next;},submitDraft:()=>{}}),()=>state);
 const render=()=>{refIndex=0;const nodes=[];const visit=n=>{if(n?.children){nodes.push(n);n.children.flat(Infinity).forEach(visit);}};visit(component());return nodes;};
 const input=render().find(n=>n.type==='input');effect();
 input.props.onInput({currentTarget:{value:'cat'}});render();effect();assert.equal(value,'cat');
 // The runtime preserves the typed query while boot completes. The next change is collection reset.
 state.corpus={};state.status='ready';render();effect();
 state.draftQuery='';render();effect();
 assert.equal(value,'','A startup edit must not suppress an explicit collection reset');
});

test('corpus readiness preserves an unfinished startup composition',()=>{
 const state={draftQuery:'',corpus:null,status:'booting',indexBuildProgress:{total:0}};
 let value='',effect,dependencies,refIndex=0;const refs=[];
 const component=compileComposer(
  {createElement:(type,props,...children)=>({type,props,children})},
  ()=>[value,next=>{value=next;}],(fn,deps)=>{effect=(!dependencies||deps.some((value,index)=>value!==dependencies[index]))?fn:()=>{};dependencies=deps;},
  initial=>refs[refIndex++]??(refs[refIndex-1]={current:initial}),()=>{},()=>{},
  ()=>({setDraft:next=>{state.draftQuery=next;},submitDraft:()=>{}}),()=>state);
 const render=()=>{refIndex=0;const nodes=[];const visit=n=>{if(n?.children){nodes.push(n);n.children.flat(Infinity).forEach(visit);}};visit(component());return nodes;};
 const input=render().find(n=>n.type==='input');effect();
 input.props.onCompositionStart();input.props.onInput({currentTarget:{value:'猫'}});render();effect();
 state.corpus={};state.status='searching';state.draftQuery='default startup query';render();effect();
 assert.equal(value,'猫','Boot readiness must not overwrite ongoing composition');
 state.draftQuery='猫';render();effect();
 input.props.onCompositionEnd({currentTarget:{value:'猫'}});
 assert.equal(value,'猫');
});
