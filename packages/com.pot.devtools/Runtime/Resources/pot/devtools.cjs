"use strict";
var __potDevtools = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // pot-shim:pot
  var require_pot = __commonJS({
    "pot-shim:pot"(exports, module) {
      module.exports = globalThis.pot;
    }
  });

  // devtools/src/index.ts
  var index_exports = {};
  __export(index_exports, {
    attach: () => attach,
    checkLeaks: () => checkLeaks,
    handle: () => handle,
    reload: () => reload,
    toPlain: () => toPlain
  });

  // devtools/src/agent.ts
  var import_core2 = __toESM(require_pot());

  // devtools/src/hmr.ts
  var import_core = __toESM(require_pot());
  var ACTIVE = 2;
  var now = () => {
    const perf = globalThis.performance;
    return perf ? perf.now() : Date.now();
  };
  function errorText(error) {
    return String(error?.stack ?? error);
  }
  function isActive(ctx) {
    const fiber = ctx?.fiber;
    return !!fiber && fiber.state === ACTIVE;
  }
  function topMounts(mounts) {
    const set = new Set(mounts.map((m) => m.fiber));
    return mounts.filter((m) => !(0, import_core.ancestors)(m.fiber).some((f) => set.has(f)));
  }
  async function settle(runtime2) {
    for (let i = 0; i < 3; i++) await Promise.resolve();
    await runtime2.clock.waitFrames(1).then(() => {
    }, () => {
    });
  }
  async function transaction(runtime2, names, options, result) {
    const { plugins, state } = runtime2;
    const force = new Set(options.force ?? []);
    result.phase = "preload";
    const fresh = /* @__PURE__ */ new Map();
    const previous = /* @__PURE__ */ new Map();
    for (const name of new Set(names)) {
      const unit = plugins.compile(name);
      const prev = plugins.units.get(name);
      if (prev && prev.hash === unit.hash && !force.has(name)) {
        result.skipped.push(name);
        continue;
      }
      fresh.set(name, unit);
      previous.set(name, prev);
    }
    result.units = [...fresh.keys()];
    if (!fresh.size) return [];
    result.phase = "snapshot";
    const ownedBefore = [...fresh.keys()].flatMap((n) => state.ownerKeys(n));
    const snapshot = state.snapshot(ownedBefore);
    const mounts = [];
    for (const [name, prev] of previous) {
      for (const fiber of prev?.mounts ?? []) {
        mounts.push({ unit: name, fiber, parent: fiber.parent, config: fiber.config });
      }
    }
    const tops = topMounts(mounts);
    result.phase = "swap";
    for (const [name, unit] of fresh) plugins.swap(name, unit);
    const created = [];
    try {
      result.phase = "dispose";
      for (const mount of tops) await mount.fiber.dispose();
      result.phase = "apply";
      for (const mount of tops) {
        const unit = plugins.get(mount.unit);
        const fiber = mount.parent.plugin(unit.wrapper, mount.config);
        created.push(fiber);
        await fiber;
      }
      await settle(runtime2);
      for (const unit of fresh.values()) {
        if (unit.errors.length) throw unit.errors[0];
      }
    } catch (error) {
      result.error = errorText(error);
      await rollback(runtime2, fresh, previous, tops, created, snapshot, ownedBefore);
      result.rolledBack = true;
      return [];
    }
    result.phase = "commit";
    const sentinels = [];
    for (const [name, prev] of previous) {
      if (!prev) continue;
      sentinels.push({ label: `${name}@${prev.hash} exports`, ref: new WeakRef(prev.exports) });
      sentinels.push({ label: `${name}@${prev.hash} plugin`, ref: new WeakRef(prev.wrapper) });
      runtime2.root.registry.delete(prev.wrapper);
    }
    for (const mount of mounts) {
      sentinels.push({ label: `${mount.unit} fiber#${mount.fiber.uid}`, ref: new WeakRef(mount.fiber) });
    }
    return sentinels;
  }
  async function rollback(runtime2, fresh, previous, tops, created, snapshot, ownedBefore) {
    const { plugins, state } = runtime2;
    const log = runtime2.root.logger("hmr");
    for (const fiber of created) {
      try {
        await fiber.dispose();
      } catch (e) {
        log.warn(e);
      }
    }
    for (const unit of fresh.values()) {
      for (const fiber of [...unit.mounts]) {
        try {
          await fiber.dispose();
        } catch (e) {
          log.warn(e);
        }
      }
      runtime2.root.registry.delete(unit.wrapper);
    }
    for (const [name, prev] of previous) plugins.swap(name, prev);
    const ownedNow = [...fresh.keys()].flatMap((n) => state.ownerKeys(n));
    state.restore(snapshot, [.../* @__PURE__ */ new Set([...ownedBefore, ...ownedNow])]);
    for (const mount of tops) {
      if (!isActive(mount.parent)) continue;
      const prev = previous.get(mount.unit);
      if (!prev) continue;
      try {
        await mount.parent.plugin(prev.wrapper, mount.config);
      } catch (e) {
        log.error("回滚时重新挂载 %s 失败：%s", mount.unit, errorText(e));
      }
    }
  }
  function forceGC(runtime2) {
    const gc = globalThis.gc;
    if (typeof gc === "function") gc();
    runtime2.host.gc?.();
  }
  async function reload(runtime2, names, options = {}) {
    const start = now();
    const result = { ok: false, mode: "hot", units: [], skipped: [], phase: "preload", rolledBack: false, durationMs: 0 };
    const release = runtime2.clock.freeze();
    let sentinels = [];
    try {
      sentinels = await transaction(runtime2, names, options, result);
      result.ok = !result.error;
    } catch (error) {
      result.error = errorText(error);
    } finally {
      release();
    }
    result.durationMs = Math.round((now() - start) * 100) / 100;
    if (result.ok && sentinels.length && options.checkLeaks !== false) {
      result.leaks = await checkLeaks(runtime2, sentinels, options.leakFrames ?? 3);
    }
    return result;
  }
  async function checkLeaks(runtime2, sentinels, frames = 3) {
    forceGC(runtime2);
    await runtime2.clock.waitFrames(frames);
    forceGC(runtime2);
    await runtime2.clock.waitFrames(1);
    return sentinels.filter((s) => s.ref.deref() !== void 0).map((s) => s.label);
  }

  // devtools/src/agent.ts
  var attached;
  var lastReload;
  function attach(runtime2) {
    attached = runtime2;
  }
  function runtime() {
    const rt = attached ?? (0, import_core2.currentRuntime)();
    if (!rt) throw new Error("运行时尚未启动");
    return rt;
  }
  function toPlain(value, depth = 4, seen = /* @__PURE__ */ new Set()) {
    if (value === null || value === void 0) return value ?? null;
    const type = typeof value;
    if (type === "number") return Number.isFinite(value) ? value : String(value);
    if (type === "string" || type === "boolean") return value;
    if (type === "bigint" || type === "symbol") return String(value);
    if (type === "function") return `[Function ${value.name || "anonymous"}]`;
    if (value instanceof Error) return { error: value.message, stack: value.stack };
    if (seen.has(value)) return "[Circular]";
    if (depth <= 0) return Array.isArray(value) ? `[Array(${value.length})]` : "[Object]";
    seen.add(value);
    try {
      if (ArrayBuffer.isView(value)) return Array.from(value).slice(0, 64);
      if (Array.isArray(value)) return value.slice(0, 200).map((v) => toPlain(v, depth - 1, seen));
      if (value instanceof Map) return Object.fromEntries([...value].slice(0, 200).map(([k, v]) => [String(k), toPlain(v, depth - 1, seen)]));
      if (value instanceof Set) return [...value].slice(0, 200).map((v) => toPlain(v, depth - 1, seen));
      const result = {};
      for (const key of Object.keys(value).slice(0, 200)) result[key] = toPlain(value[key], depth - 1, seen);
      return result;
    } finally {
      seen.delete(value);
    }
  }
  function evaluate(code, rt) {
    const args = ["runtime", "ctx", "pot"];
    const values = [rt, rt.root, globalThis.pot];
    let fn;
    try {
      fn = new Function(...args, `return (${code}
)`);
    } catch {
      fn = new Function(...args, `return (async () => {
${code}
})()`);
    }
    return fn(...values);
  }
  var handlers = {
    async reload(msg, rt) {
      const files = msg.files ?? [];
      for (const file of files) rt.host.writeText?.(file.path, file.content);
      const names = new Set(msg.units ?? []);
      const force = /* @__PURE__ */ new Set();
      for (const file of files) {
        const match = /^units\/(.+)\.cjs$/.exec(file.path);
        if (match) names.add(match[1]);
        if (file.path.startsWith("data/")) {
          for (const unit of rt.data.readers(file.path)) {
            names.add(unit);
            force.add(unit);
          }
        }
      }
      const loaded = [...names].filter((n) => rt.plugins.units.has(n));
      lastReload = await reload(rt, loaded, { force, checkLeaks: msg.checkLeaks !== false });
      return lastReload;
    },
    async eval(msg, rt) {
      const value = await evaluate(String(msg.code ?? ""), rt);
      return toPlain(value, msg.depth ?? 4);
    },
    state(msg, rt) {
      const state = rt.state;
      switch (msg.action ?? "get") {
        case "keys":
          return state.info();
        case "get":
          return msg.key ? toPlain(state.get(msg.key), 8) : toPlain(state.snapshot(), 8);
        case "set":
          state.set(msg.key, msg.value);
          return true;
        case "reset":
          state.reset(msg.key);
          return true;
        default:
          throw new Error(`未知 state 操作：${msg.action}`);
      }
    },
    leaks(_msg, rt) {
      return {
        lastReload: lastReload ? { units: lastReload.units, leaks: lastReload.leaks ?? [] } : null,
        objects: rt.scene.objects.size,
        engineObjects: rt.host.engine.count(),
        timers: rt.clock.pending,
        units: rt.plugins.list().map((u) => ({ name: u.name, mounts: u.mounts.length }))
      };
    },
    plugins(_msg, rt) {
      return toPlain(rt.plugins.list(), 5);
    },
    query(msg, rt) {
      switch (msg.what ?? "info") {
        case "info":
          return rt.info();
        case "objects":
          return rt.scene.list(msg.unit);
        case "data":
          return rt.data.dependencies();
        case "cache":
          return rt.cache.stats();
        default:
          throw new Error(`未知查询：${msg.what}`);
      }
    },
    time(msg, rt) {
      const clock = rt.clock;
      switch (msg.action) {
        case "pause":
          clock.pause();
          break;
        case "resume":
          clock.resume();
          break;
        case "step":
          clock.step(msg.frames ?? 1);
          break;
        case "scale":
          clock.scale = Number(msg.value ?? 1);
          break;
        case void 0:
        case "get":
          break;
        default:
          throw new Error(`未知 time 操作：${msg.action}`);
      }
      return { time: clock.time, frame: clock.frame, paused: clock.paused, scale: clock.scale, frozen: clock.frozen };
    }
  };
  async function handle(json) {
    let msg;
    try {
      msg = typeof json === "string" ? JSON.parse(json) : json;
    } catch (error) {
      return { type: "result", id: null, ok: false, error: `消息不是合法 JSON：${error?.message}` };
    }
    let reply;
    try {
      const rt = runtime();
      const handler = handlers[msg.type];
      if (!handler) throw new Error(`JS 侧不支持的命令：${msg.type}`);
      const data = await handler(msg, rt);
      reply = { type: "result", id: msg.id ?? null, ok: true, data };
    } catch (error) {
      reply = { type: "result", id: msg.id ?? null, ok: false, error: String(error?.stack ?? error) };
    }
    try {
      const rt = attached ?? (0, import_core2.currentRuntime)();
      rt?.host.send?.(JSON.stringify(reply));
    } catch {
    }
    return reply;
  }
  return __toCommonJS(index_exports);
})();
globalThis.pot.devtools = __potDevtools;
