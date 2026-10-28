import { React as R } from "../../dist/modules/apps/web/src/shared/react.js";
const h = R.createElement;
const { useState, useRef, useEffect, useLayoutEffect, useId } = R;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const instant = () => reduced() || document.documentElement.dataset.ndInput === "keyboard";
function menuPlacement(trigger, viewport, clips, natural) {
  const bounds = clips.reduce((box, clip) => ({ top: Math.max(box.top, clip.top), bottom: Math.min(box.bottom, clip.bottom), left: Math.max(box.left, clip.left), right: Math.min(box.right, clip.right) }), viewport);
  const below = bounds.bottom - trigger.bottom - 6, above = trigger.top - bounds.top - 6;
  const opensAbove = below < Math.min(natural.height, 230) && above > below;
  const maxWidth = Math.max(0, bounds.right - bounds.left);
  const width = Math.min(maxWidth, Math.max(trigger.width, natural.width));
  return {
    above: opensAbove,
    maxHeight: Math.max(0, Math.min(230, opensAbove ? above : below)),
    maxWidth,
    minWidth: Math.min(trigger.width, maxWidth),
    left: Math.max(bounds.left, Math.min(trigger.left, bounds.right - width)) - trigger.left
  };
}
function Select({ options, value, onChange, label, placeholder = "Choose", disabled = false }) {
  const [open, setOpen] = useState(false), [present, setPresent] = useState(false), [active, setActive] = useState(-1), [placement, setPlacement] = useState({ above: false });
  const root = useRef(null), trigger = useRef(null), menu = useRef(null), search = useRef({ text: "", at: 0 });
  const id = useId(), selected = options.findIndex((option) => option.value === value);
  const enabled = options.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);
  const close = () => {
    setOpen(false);
    search.current.text = "";
  };
  function show(edge) {
    if (disabled || !enabled.length) return;
    setActive(edge === "last" ? enabled.at(-1) : edge === "first" ? enabled[0] : selected >= 0 && !options[selected].disabled ? selected : enabled[0]);
    setOpen(true);
  }
  function choose(index) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
    trigger.current?.focus({ preventScroll: true });
  }
  function keydown(event) {
    const key = event.key;
    if (key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (key === "Tab") {
      close();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
      event.preventDefault();
      if (!open) {
        show(key === "ArrowUp" || key === "End" ? "last" : key === "Home" ? "first" : void 0);
        return;
      }
      const position = enabled.indexOf(active);
      setActive(key === "Home" ? enabled[0] : key === "End" ? enabled.at(-1) : enabled[(position + (key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length]);
      return;
    }
    if (key === "Enter" || key === " ") {
      event.preventDefault();
      open ? choose(active) : show();
      return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now(), previous = now - search.current.at < 700 ? search.current.text : "";
      const query = previous === key.toLocaleLowerCase() ? previous : previous + key.toLocaleLowerCase();
      search.current = { text: query, at: now };
      const start = enabled.indexOf(open ? active : selected);
      const ordered = enabled.slice(start + 1).concat(enabled.slice(0, start + 1));
      const found = ordered.find((index) => options[index].label.toLocaleLowerCase().startsWith(query));
      if (found !== void 0) {
        if (!open) show();
        setActive(found);
      }
    }
  }
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    if (instant()) {
      setPresent(false);
      return;
    }
    const timer = setTimeout(() => setPresent(false), 110);
    return () => clearTimeout(timer);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!root.current?.contains(event.target)) close();
    };
    const resize = () => close();
    const scroll = (event) => {
      if (event.target !== menu.current && !menu.current?.contains(event.target)) close();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !menu.current) return;
    const panel = menu.current, rect = trigger.current.getBoundingClientRect(), clips = [];
    for (let node = root.current.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY + style.overflowX)) {
        const box = node.getBoundingClientRect();
        clips.push({ top: box.top + node.clientTop + 4, bottom: box.top + node.clientTop + node.clientHeight - 4, left: box.left + node.clientLeft + 4, right: box.left + node.clientLeft + node.clientWidth - 4 });
      }
    }
    setPlacement(menuPlacement(rect, { top: 6, bottom: window.innerHeight - 6, left: 6, right: window.innerWidth - 6 }, clips, { height: panel.scrollHeight + 2, width: Math.min(260, panel.scrollWidth + 2) }));
  }, [open, options]);
  useLayoutEffect(() => {
    const panel = menu.current, option = panel?.querySelector('[data-active="true"]');
    if (!open || !option) return;
    if (option.offsetTop < panel.scrollTop) panel.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > panel.scrollTop + panel.clientHeight) panel.scrollTop = option.offsetTop + option.offsetHeight - panel.clientHeight;
  }, [open, active, placement.maxHeight]);
  return h(
    "div",
    { className: "nd-select", ref: root },
    h(
      "button",
      {
        ref: trigger,
        type: "button",
        className: "nd-select-trigger",
        role: "combobox",
        disabled,
        "aria-label": label,
        "aria-haspopup": "listbox",
        "aria-expanded": open,
        "aria-controls": open ? id : void 0,
        "aria-activedescendant": open && active >= 0 ? id + "-" + active : void 0,
        onKeyDown: keydown,
        onClick: () => open ? close() : show()
      },
      h("span", { className: "nd-select-value" }, options[selected]?.label || placeholder),
      h("svg", { width: 12, height: 12, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true }, h("path", { d: "m4 6 4 4 4-4", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }))
    ),
    (open || present) && h(
      "div",
      { ref: menu, id, role: "listbox", "aria-label": label, "aria-hidden": !open || void 0, "data-open": open, className: "nd-select-menu" + (placement.above ? " opens-above" : ""), style: { maxHeight: placement.maxHeight, maxWidth: placement.maxWidth, minWidth: placement.minWidth, left: placement.left } },
      options.map((option, index) => h(
        "div",
        {
          id: id + "-" + index,
          key: option.value,
          role: "option",
          "aria-selected": option.value === value,
          "aria-disabled": option.disabled || void 0,
          "data-active": index === active,
          className: "nd-select-option",
          onPointerMove: () => !option.disabled && setActive(index),
          onPointerDown: (event) => event.preventDefault(),
          onClick: () => choose(index)
        },
        h("span", null, option.label),
        h("svg", { width: 12, height: 12, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, style: { visibility: option.value === value ? "visible" : "hidden" } }, h("path", { d: "m3 8 3 3 7-7", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }))
      ))
    )
  );
}
const dismissals = /* @__PURE__ */ new WeakMap();
function dismissOverlay(callback, event) {
  event?.preventDefault?.();
  const target = document.querySelector("dialog.needle-dialog[open], .needle-tools-overlay, .needle-compare-layer");
  if (target && dismissals.has(target)) return;
  if (!target || instant()) {
    callback();
    return;
  }
  const wasInert = target.inert;
  target.inert = true;
  target.dataset.uiExiting = "true";
  const cancel = () => {
    clearTimeout(timer);
    dismissals.delete(target);
    delete target.dataset.uiExiting;
    target.inert = wasInert;
    target.removeEventListener("close", cancel);
  };
  const timer = setTimeout(() => {
    dismissals.delete(target);
    target.removeEventListener("close", cancel);
    try {
      if (target.isConnected && (target.tagName !== "DIALOG" || target.open)) callback();
    } finally {
      requestAnimationFrame(() => {
        delete target.dataset.uiExiting;
        target.inert = wasInert;
      });
    }
  }, 160);
  target.addEventListener("close", cancel, { once: true });
  dismissals.set(target, timer);
}
export {
  Select,
  dismissOverlay,
  menuPlacement
};
