"use strict";
var pot = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // runtime/src/index.ts
  var index_exports = {};
  __export(index_exports, {
    ANCHORS: () => ANCHORS,
    API_VERSION: () => API_VERSION,
    AudioService: () => AudioService,
    BUILTIN_BLOCKS: () => BUILTIN_BLOCKS,
    BUILTIN_PREFABS: () => BUILTIN_PREFABS,
    BUILTIN_UNIFORMS: () => BUILTIN_UNIFORMS,
    CORE_SERVICES: () => CORE_SERVICES,
    CacheService: () => CacheService,
    Canvas: () => Canvas,
    CanvasGradient: () => CanvasGradient,
    CanvasRenderingContext2D: () => CanvasRenderingContext2D,
    ClockService: () => ClockService,
    Context: () => Context,
    CordisError: () => CordisError,
    DEFAULT_CONTROLS: () => DEFAULT_CONTROLS,
    DataService: () => DataService,
    DisposableList: () => DisposableList,
    Entity: () => Entity,
    EventsService: () => EventsService,
    Fiber: () => Fiber,
    FiberState: () => FiberState,
    Flow: () => Flow,
    Fragment: () => Fragment,
    GfxService: () => GfxService,
    Inject: () => Inject,
    InputService: () => InputService,
    LIBRARY: () => LIBRARY,
    LoadingService: () => LoadingService,
    Logger: () => Logger,
    LoggerLevel: () => LoggerLevel,
    LoggerService: () => LoggerService,
    MAX_EVENT_ROUNDS: () => MAX_EVENT_ROUNDS,
    MAX_VERTEX_INPUTS: () => MAX_VERTEX_INPUTS,
    PREFAB: () => PREFAB,
    PluginsService: () => PluginsService,
    PostChain: () => PostChain,
    Registry: () => Registry,
    RegistryService: () => RegistryService,
    Runtime: () => Runtime,
    SceneService: () => SceneService,
    Service: () => Service,
    Shader: () => Shader,
    StandardMaterial: () => StandardMaterial,
    StateService: () => StateService,
    StateTypeError: () => StateTypeError,
    Texture: () => Texture,
    TimerService: () => TimerService,
    UIService: () => UIService,
    UI_MARGIN: () => UI_MARGIN,
    VERSION: () => VERSION,
    ValidationError: () => ValidationError,
    WorldService: () => WorldService,
    WorldView: () => WorldView,
    ancestors: () => ancestors,
    applyUniforms: () => applyUniforms,
    assertSerializable: () => assertSerializable,
    bindEntry: () => bindEntry,
    buildOuterStack: () => buildOuterStack,
    c16: () => c16,
    c256: () => c256,
    compileModule: () => compileModule,
    composeError: () => composeError,
    createCallable: () => createCallable,
    createElement: () => createElement,
    createRuntime: () => createRuntime,
    createUIRenderer: () => createUIRenderer,
    createUnit: () => createUnit,
    createUnityHost: () => createUnityHost,
    currentRuntime: () => currentRuntime,
    decode: () => decode,
    deepClone: () => deepClone,
    defaultFormatters: () => defaultFormatters,
    defineBlock: () => defineBlock,
    defineGame: () => defineGame,
    definePlugin: () => definePlugin,
    definePrefab: () => definePrefab,
    encode: () => encode,
    encodePcm16: () => encodePcm16,
    estimateSize: () => estimateSize,
    eulerToQuaternion: () => eulerToQuaternion,
    evaluate: () => evaluate,
    fontFamilies: () => fontFamilies,
    fontFlags: () => fontFlags,
    formatSource: () => formatSource,
    getPropertyDescriptor: () => getPropertyDescriptor,
    getTraceable: () => getTraceable,
    hash: () => hash,
    instanceLayout: () => instanceLayout,
    isBailed: () => isBailed,
    isConstructor: () => isConstructor,
    isNode: () => isNode,
    isObject: () => isObject,
    isPrefab: () => isPrefab,
    joinPrototype: () => joinPrototype,
    jsxDevRuntime: () => jsx_dev_runtime_exports,
    jsxRuntime: () => jsx_runtime_exports,
    layoutRects: () => layoutRects,
    makeNode: () => makeNode,
    mapErrors: () => mapErrors,
    markFiber: () => markFiber,
    nodeName: () => nodeName,
    overlap: () => overlap,
    overlappingPairs: () => overlappingPairs,
    parseColor: () => parseColor,
    parseCssColor: () => parseCssColor,
    parseFont: () => parseFont,
    preprocess: () => preprocess,
    rayPlane: () => rayPlane,
    resolveConfig: () => resolveConfig,
    runModule: () => runModule,
    slerpQuaternion: () => slerpQuaternion,
    sourcePrefix: () => sourcePrefix,
    symbols: () => symbols,
    threeChunks: () => threeChunks,
    unitOf: () => unitOf,
    unitOfFiber: () => unitOfFiber,
    unity: () => unity,
    vertexInputs: () => vertexInputs,
    withProps: () => withProps
  });

  // node_modules/cosmokit/lib/index.mjs
  function isNullable(value) {
    return value === null || value === void 0;
  }
  function defineProperty(object, key, value) {
    return Object.defineProperty(object, key, { writable: true, value, enumerable: false });
  }
  function is(type, value) {
    if (arguments.length === 1) return (value2) => is(type, value2);
    return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
  }
  function isArrayBufferLike(value) {
    return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
  }
  function isArrayBufferSource(value) {
    return isArrayBufferLike(value) || ArrayBuffer.isView(value);
  }
  var Binary;
  ((Binary2) => {
    Binary2.is = isArrayBufferLike;
    Binary2.isSource = isArrayBufferSource;
    function fromSource(source) {
      if (ArrayBuffer.isView(source)) {
        return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
      } else {
        return source;
      }
    }
    Binary2.fromSource = fromSource;
    function toBase64(source) {
      source = fromSource(source);
      if (typeof Buffer !== "undefined") {
        return Buffer.from(source).toString("base64");
      }
      let binary = "";
      const bytes = new Uint8Array(source);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }
    Binary2.toBase64 = toBase64;
    function fromBase64(source) {
      if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
      return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
    }
    Binary2.fromBase64 = fromBase64;
    function toHex(source) {
      source = fromSource(source);
      if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
      return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    Binary2.toHex = toHex;
    function fromHex(source) {
      if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
      const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
      const buffer = [];
      for (let i = 0; i < hex.length; i += 2) {
        buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
      }
      return Uint8Array.from(buffer).buffer;
    }
    Binary2.fromHex = fromHex;
  })(Binary || (Binary = {}));
  var base64ToArrayBuffer = Binary.fromBase64;
  var arrayBufferToBase64 = Binary.toBase64;
  var hexToArrayBuffer = Binary.fromHex;
  var arrayBufferToHex = Binary.toHex;
  function tokenize(source, delimiters, delimiter) {
    const output = [];
    let state = 0;
    for (let i = 0; i < source.length; i++) {
      const code = source.charCodeAt(i);
      if (code >= 65 && code <= 90) {
        if (state === 1) {
          const next = source.charCodeAt(i + 1);
          if (next >= 97 && next <= 122) {
            output.push(delimiter);
          }
          output.push(code + 32);
        } else {
          if (state !== 0) {
            output.push(delimiter);
          }
          output.push(code + 32);
        }
        state = 1;
      } else if (code >= 97 && code <= 122) {
        output.push(code);
        state = 2;
      } else if (delimiters.includes(code)) {
        if (state !== 0) {
          output.push(delimiter);
        }
        state = 0;
      } else {
        output.push(code);
      }
    }
    return String.fromCharCode(...output);
  }
  function paramCase(source) {
    return tokenize(source, [45, 95], 45);
  }
  var hyphenate = paramCase;
  var Time;
  ((Time2) => {
    Time2.millisecond = 1;
    Time2.second = 1e3;
    Time2.minute = Time2.second * 60;
    Time2.hour = Time2.minute * 60;
    Time2.day = Time2.hour * 24;
    Time2.week = Time2.day * 7;
    let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
    function setTimezoneOffset(offset) {
      timezoneOffset = offset;
    }
    Time2.setTimezoneOffset = setTimezoneOffset;
    function getTimezoneOffset() {
      return timezoneOffset;
    }
    Time2.getTimezoneOffset = getTimezoneOffset;
    function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
      if (typeof date === "number") date = new Date(date);
      if (offset === void 0) offset = timezoneOffset;
      return Math.floor((date.valueOf() / Time2.minute - offset) / 1440);
    }
    Time2.getDateNumber = getDateNumber;
    function fromDateNumber(value, offset) {
      const date = new Date(value * Time2.day);
      if (offset === void 0) offset = timezoneOffset;
      return new Date(+date + offset * Time2.minute);
    }
    Time2.fromDateNumber = fromDateNumber;
    const numeric = /\d+(?:\.\d+)?/.source;
    const timeRegExp = new RegExp(`^${[
      "w(?:eek(?:s)?)?",
      "d(?:ay(?:s)?)?",
      "h(?:our(?:s)?)?",
      "m(?:in(?:ute)?(?:s)?)?",
      "s(?:ec(?:ond)?(?:s)?)?"
    ].map((unit) => `(${numeric}${unit})?`).join("")}$`);
    function parseTime(source) {
      const capture = timeRegExp.exec(source);
      if (!capture) return 0;
      return (parseFloat(capture[1]) * Time2.week || 0) + (parseFloat(capture[2]) * Time2.day || 0) + (parseFloat(capture[3]) * Time2.hour || 0) + (parseFloat(capture[4]) * Time2.minute || 0) + (parseFloat(capture[5]) * Time2.second || 0);
    }
    Time2.parseTime = parseTime;
    function parseDate(date) {
      const parsed = parseTime(date);
      if (parsed) {
        date = Date.now() + parsed;
      } else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) {
        date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
      } else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) {
        date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
      }
      return date ? new Date(date) : /* @__PURE__ */ new Date();
    }
    Time2.parseDate = parseDate;
    function format(ms) {
      const abs = Math.abs(ms);
      if (abs >= Time2.day - Time2.hour / 2) {
        return Math.round(ms / Time2.day) + "d";
      } else if (abs >= Time2.hour - Time2.minute / 2) {
        return Math.round(ms / Time2.hour) + "h";
      } else if (abs >= Time2.minute - Time2.second / 2) {
        return Math.round(ms / Time2.minute) + "m";
      } else if (abs >= Time2.second) {
        return Math.round(ms / Time2.second) + "s";
      }
      return ms + "ms";
    }
    Time2.format = format;
    function toDigits(source, length = 2) {
      return source.toString().padStart(length, "0");
    }
    Time2.toDigits = toDigits;
    function template(template2, time = /* @__PURE__ */ new Date()) {
      return template2.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
    }
    Time2.template = template;
  })(Time || (Time = {}));

  // node_modules/cordis/lib/index.js
  var __defProp2 = Object.defineProperty;
  var __name = (target, value) => __defProp2(target, "name", { value, configurable: true });
  var _a;
  var DisposableList = (_a = class {
    constructor() {
      __publicField(this, "sn", 0);
      __publicField(this, "map", /* @__PURE__ */ new Map());
      __publicField(this, "weak", /* @__PURE__ */ new WeakMap());
    }
    get length() {
      return this.map.size;
    }
    push(value) {
      const sn = ++this.sn;
      this.map.set(sn, value);
      this.weak.set(value, sn);
      return () => this.map.delete(sn);
    }
    delete(value) {
      const sn = this.weak.get(value);
      if (!sn) return false;
      return this.map.delete(sn);
    }
    clear() {
      const values = [...this.map.values()];
      this.map.clear();
      return values.reverse();
    }
    [Symbol.iterator]() {
      return this.map.values();
    }
    [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")]() {
      return [...this];
    }
  }, __name(_a, "DisposableList"), _a);
  var symbols = {
    // internal symbols
    shadow: /* @__PURE__ */ Symbol.for("cordis.shadow"),
    caller: /* @__PURE__ */ Symbol.for("cordis.caller"),
    receiver: /* @__PURE__ */ Symbol.for("cordis.receiver"),
    original: /* @__PURE__ */ Symbol.for("cordis.original"),
    metadata: /* @__PURE__ */ Symbol.for("cordis.metadata"),
    initHooks: /* @__PURE__ */ Symbol.for("cordis.initHooks"),
    checkProto: /* @__PURE__ */ Symbol.for("cordis.checkProto"),
    // context symbols
    effect: /* @__PURE__ */ Symbol.for("cordis.effect"),
    filter: /* @__PURE__ */ Symbol.for("cordis.filter"),
    isolate: /* @__PURE__ */ Symbol.for("cordis.isolate"),
    intercept: /* @__PURE__ */ Symbol.for("cordis.intercept"),
    // service symbols
    init: /* @__PURE__ */ Symbol.for("cordis.init"),
    check: /* @__PURE__ */ Symbol.for("cordis.check"),
    config: /* @__PURE__ */ Symbol.for("cordis.config"),
    invoke: /* @__PURE__ */ Symbol.for("cordis.invoke"),
    extend: /* @__PURE__ */ Symbol.for("cordis.extend"),
    tracker: /* @__PURE__ */ Symbol.for("cordis.tracker"),
    resolveConfig: /* @__PURE__ */ Symbol.for("cordis.resolveConfig")
  };
  var GeneratorFunction = function* () {
  }.constructor;
  var AsyncGeneratorFunction = async function* () {
  }.constructor;
  function isConstructor(func) {
    if (!func.prototype) return false;
    if (func instanceof GeneratorFunction) return false;
    if (AsyncGeneratorFunction !== Function && func instanceof AsyncGeneratorFunction) return false;
    return true;
  }
  __name(isConstructor, "isConstructor");
  function joinPrototype(proto1, proto2) {
    if (proto1 === Object.prototype) return proto2;
    const result = Object.create(joinPrototype(Object.getPrototypeOf(proto1), proto2));
    for (const key of Reflect.ownKeys(proto1)) {
      Object.defineProperty(result, key, Object.getOwnPropertyDescriptor(proto1, key));
    }
    return result;
  }
  __name(joinPrototype, "joinPrototype");
  function isObject(value) {
    return value && (typeof value === "object" || typeof value === "function");
  }
  __name(isObject, "isObject");
  function getPropertyDescriptor(target, prop) {
    let proto = target;
    while (proto) {
      const desc = Reflect.getOwnPropertyDescriptor(proto, prop);
      if (desc) return desc;
      proto = Object.getPrototypeOf(proto);
    }
  }
  __name(getPropertyDescriptor, "getPropertyDescriptor");
  function getTraceable(ctx, value) {
    if (!isObject(value)) return value;
    if (Object.hasOwn(value, symbols.shadow)) {
      return Object.getPrototypeOf(value);
    }
    const tracker = value[symbols.tracker];
    if (!tracker) return value;
    return createTraceable(ctx, value, tracker);
  }
  __name(getTraceable, "getTraceable");
  function withProps(target, props) {
    if (!props) return target;
    return new Proxy(target, {
      get: /* @__PURE__ */ __name((target2, prop, receiver) => {
        if (prop in props && prop !== "constructor") return Reflect.get(props, prop, receiver);
        return Reflect.get(target2, prop, receiver);
      }, "get"),
      set: /* @__PURE__ */ __name((target2, prop, value, receiver) => {
        if (prop in props && prop !== "constructor") return Reflect.set(props, prop, value, receiver);
        return Reflect.set(target2, prop, value, receiver);
      }, "set")
    });
  }
  __name(withProps, "withProps");
  function withProp(target, prop, value) {
    return withProps(target, Object.defineProperty(/* @__PURE__ */ Object.create(null), prop, {
      value,
      writable: false
    }));
  }
  __name(withProp, "withProp");
  function createShadow(ctx, target, property, receiver) {
    if (!property) return receiver;
    const origin = getPropertyDescriptor(target, property)?.value;
    if (!origin) return receiver;
    return withProp(receiver, property, ctx.extend({ [symbols.shadow]: origin }));
  }
  __name(createShadow, "createShadow");
  function createShadowMethod(ctx, value, outer, shadow) {
    return new Proxy(value, {
      apply: /* @__PURE__ */ __name((target, thisArg, args) => {
        if (thisArg === outer) thisArg = shadow;
        return getTraceable(ctx, Reflect.apply(target, thisArg, args));
      }, "apply")
    });
  }
  __name(createShadowMethod, "createShadowMethod");
  function createTraceable(ctx, value, tracker) {
    const caller = ctx[symbols.shadow] ?? ctx;
    if (ctx[symbols.shadow]) {
      ctx = Object.getPrototypeOf(ctx);
    }
    const proxy = new Proxy(value, {
      get: /* @__PURE__ */ __name((target, prop, receiver) => {
        if (prop === symbols.original) return target;
        if (prop === symbols.caller) return caller;
        if (prop === tracker.property) return ctx;
        if (typeof prop === "symbol") {
          return Reflect.get(target, prop, receiver);
        }
        if (tracker.associate && ctx.reflect.props[`${tracker.associate}.${prop}`]) {
          return Reflect.get(ctx, `${tracker.associate}.${prop}`, withProp(ctx, symbols.receiver, receiver));
        }
        let shadow, innerValue;
        const desc = getPropertyDescriptor(target, prop);
        if (desc && "value" in desc) {
          innerValue = desc.value;
        } else {
          shadow = createShadow(ctx, target, tracker.property, receiver);
          innerValue = Reflect.get(target, prop, shadow);
        }
        const innerTracker = innerValue?.[symbols.tracker];
        if (innerTracker) {
          return createTraceable(ctx, innerValue, innerTracker);
        } else if (!tracker.noShadow && typeof innerValue === "function") {
          shadow ?? (shadow = createShadow(ctx, target, tracker.property, receiver));
          return createShadowMethod(ctx, innerValue, receiver, shadow);
        } else {
          return innerValue;
        }
      }, "get"),
      set: /* @__PURE__ */ __name((target, prop, value2, receiver) => {
        if (prop === symbols.original) return false;
        if (prop === symbols.caller) return false;
        if (prop === tracker.property) return false;
        if (typeof prop === "symbol") {
          return Reflect.set(target, prop, value2, receiver);
        }
        if (tracker.associate && ctx.reflect.props[`${tracker.associate}.${prop}`]) {
          return Reflect.set(ctx, `${tracker.associate}.${prop}`, value2, withProp(ctx, symbols.receiver, receiver));
        }
        const shadow = createShadow(ctx, target, tracker.property, receiver);
        return Reflect.set(target, prop, value2, shadow);
      }, "set"),
      apply: /* @__PURE__ */ __name((target, thisArg, args) => {
        const receiver = tracker.noShadow ? proxy : createShadow(ctx, target, tracker.property, proxy);
        return applyTraceable(receiver, target, thisArg, args);
      }, "apply")
    });
    return proxy;
  }
  __name(createTraceable, "createTraceable");
  function applyTraceable(proxy, value, thisArg, args) {
    if (!value[symbols.invoke]) return Reflect.apply(value, thisArg, args);
    return value[symbols.invoke].apply(proxy, args);
  }
  __name(applyTraceable, "applyTraceable");
  function createCallable(name, proto, tracker) {
    const self = /* @__PURE__ */ __name(function(...args) {
      const proxy = createTraceable(self["ctx"], self, tracker);
      return Reflect.apply(proxy, this, args);
    }, "self");
    defineProperty(self, "name", name);
    return Object.setPrototypeOf(self, proto);
  }
  __name(createCallable, "createCallable");
  function handleError(info, reason, getOuterStack) {
    const innerLines = info.error.stack.split("\n");
    if (typeof reason?.stack !== "string") {
      const outerError = new Error(reason);
      const lines2 = outerError.stack.split("\n");
      lines2.splice(1, Infinity, ...getOuterStack());
      outerError.stack = lines2.join("\n");
      throw outerError;
    }
    const lines = reason.stack.split("\n");
    let index = lines.indexOf(innerLines[2]);
    if (index === -1) throw reason;
    index -= info.offset;
    while (index > 0) {
      if (!lines[index - 1].endsWith(" (<anonymous>)")) break;
      index -= 1;
    }
    lines.splice(index, Infinity, ...getOuterStack());
    reason.stack = lines.join("\n");
    throw reason;
  }
  __name(handleError, "handleError");
  function composeError(callback, getOuterStack = buildOuterStack()) {
    const info = { offset: 1, error: new Error() };
    try {
      const result = callback(info);
      if (isObject(result) && "then" in result) {
        return result.then(void 0, (reason) => handleError(info, reason, getOuterStack));
      } else {
        return result;
      }
    } catch (reason) {
      handleError(info, reason, getOuterStack);
    }
  }
  __name(composeError, "composeError");
  function buildOuterStack(offset = 0) {
    const outerError = new Error();
    return () => outerError.stack.split("\n").slice(3 + offset);
  }
  __name(buildOuterStack, "buildOuterStack");
  function isBailed(value) {
    return value !== null && value !== false && value !== void 0;
  }
  __name(isBailed, "isBailed");
  var _a2;
  var EventsService = (_a2 = class {
    constructor(ctx) {
      __publicField(this, "ctx");
      __publicField(this, "_hooks", {});
      this.ctx = ctx;
      defineProperty(this, symbols.tracker, {
        property: "ctx",
        noShadow: true
      });
      this.on("internal/listener", function(name, listener, options) {
        var _a12;
        if (name === "internal/update" && !options.global) {
          const hooks = (_a12 = this.fiber._hooks)["internal/update"] ?? (_a12["internal/update"] = new DisposableList());
          const method = options.prepend ? "unshift" : "push";
          return hooks[method](listener);
        }
      });
      this.on("internal/update", function(config, noSave, next) {
        const cbs = [...this._hooks["internal/update"] || []];
        const _next = /* @__PURE__ */ __name(() => {
          const cb = cbs.shift() ?? next;
          return cb.call(this, config, noSave, _next);
        }, "_next");
        return _next();
      }, { global: true, prepend: true });
    }
    _resolve(type, args) {
      const thisArg = typeof args[0] === "object" || typeof args[0] === "function" ? args.shift() : null;
      const name = args.shift();
      if (!name.startsWith("internal/") && this._hooks["internal/dispatch"]?.length) {
        this.emit("internal/dispatch", type, name, args, thisArg);
      }
      const filter = thisArg?.[Context.filter];
      return [thisArg, (this._hooks[name] || []).filter((hook) => hook.global || !filter || filter.call(thisArg, hook.ctx)).map((hook) => hook.callback)];
    }
    /** @deprecated */
    dispatch(type, args) {
      const [thisArg, callbacks] = this._resolve(type, args);
      return callbacks.map((callback) => callback.bind(thisArg));
    }
    async parallel(...args) {
      const [thisArg, callbacks] = this._resolve("emit", args);
      const results = await Promise.allSettled(callbacks.map(async (callback) => Reflect.apply(callback, thisArg, args)));
      const errors = results.filter((result) => result.status === "rejected");
      if (errors.length) throw new AggregateError(errors.map((error) => error.reason));
    }
    emit(...args) {
      const [thisArg, callbacks] = this._resolve("emit", args);
      for (const callback of callbacks) Reflect.apply(callback, thisArg, args);
    }
    async serial(...args) {
      const [thisArg, callbacks] = this._resolve("serial", args);
      for (const callback of callbacks) {
        const result = await Reflect.apply(callback, thisArg, args);
        if (isBailed(result)) return result;
      }
    }
    bail(...args) {
      const [thisArg, callbacks] = this._resolve("bail", args);
      for (const callback of callbacks) {
        const result = Reflect.apply(callback, thisArg, args);
        if (isBailed(result)) return result;
      }
    }
    waterfall(...args) {
      const [thisArg, callbacks] = this._resolve("waterfall", args);
      const inner = args.pop();
      const next = /* @__PURE__ */ __name(() => {
        const callback = callbacks.shift();
        return callback ? Reflect.apply(callback, thisArg, args) : inner(...args);
      }, "next");
      args.push(next);
      return next();
    }
    register(label, hooks, callback, options) {
      const method = options.prepend ? "unshift" : "push";
      return this.ctx.fiber.effect(() => {
        hooks[method]({ ctx: this.ctx, callback, ...options });
        return () => this.unregister(hooks, callback);
      }, label);
    }
    unregister(hooks, callback) {
      const index = hooks.findIndex((hook) => hook.callback === callback);
      if (index >= 0) {
        hooks.splice(index, 1);
        return true;
      }
    }
    on(name, listener, options) {
      var _a12;
      if (typeof options !== "object") {
        options = { prepend: options };
      }
      this.ctx.fiber.assertActive();
      listener = this.ctx.reflect.bind(listener);
      const result = this.bail(this.ctx, "internal/listener", name, listener, options);
      if (result) return result;
      const hooks = (_a12 = this._hooks)[name] || (_a12[name] = []);
      const label = `ctx.on(${typeof name === "string" ? JSON.stringify(name) : name.toString()})`;
      return this.register(label, hooks, listener, options);
    }
    once(name, listener, options) {
      const dispose = this.on(name, function(...args) {
        dispose();
        return listener.apply(this, args);
      }, options);
      return dispose;
    }
  }, __name(_a2, "EventsService"), _a2);
  var LoggerLevel = /* @__PURE__ */ ((LoggerLevel2) => {
    LoggerLevel2[LoggerLevel2["ERROR"] = 0] = "ERROR";
    LoggerLevel2[LoggerLevel2["WARN"] = 1] = "WARN";
    LoggerLevel2[LoggerLevel2["INFO"] = 2] = "INFO";
    LoggerLevel2[LoggerLevel2["DEBUG"] = 3] = "DEBUG";
    return LoggerLevel2;
  })(LoggerLevel || {});
  var defaultFormatters = {
    s: /* @__PURE__ */ __name((value) => String(value), "s"),
    d: /* @__PURE__ */ __name((value) => Math.trunc(Number(value)), "d"),
    i: /* @__PURE__ */ __name((value) => Math.trunc(Number(value)), "i"),
    f: /* @__PURE__ */ __name((value) => Number(value), "f"),
    o: /* @__PURE__ */ __name((value) => JSON.stringify(value), "o"),
    O: /* @__PURE__ */ __name((value) => JSON.stringify(value), "O"),
    c: /* @__PURE__ */ __name(() => "", "c"),
    C: /* @__PURE__ */ __name((value, exporter, message) => {
      return Logger.color(exporter, Logger.code(message.name, exporter.colors), value);
    }, "C")
  };
  function isAggregateError(error) {
    return error instanceof Error && Array.isArray(error["errors"]);
  }
  __name(isAggregateError, "isAggregateError");
  var _a3;
  var Logger = (_a3 = class {
    constructor(options, service) {
      __publicField(this, "service");
      this.service = service;
      Object.assign(this, options);
      this.error = this._method(
        "error",
        0
        /* ERROR */
      );
      this.info = this._method(
        "info",
        2
        /* INFO */
      );
      this.warn = this._method(
        "warn",
        1
        /* WARN */
      );
      this.debug = this._method(
        "debug",
        3
        /* DEBUG */
      );
    }
    static color(exporter, code, value, decoration = "") {
      if (!exporter.colors) return "" + value;
      return `\x1B[3${code < 8 ? code : "8;5;" + code}${exporter.colors >= 2 ? decoration : ""}m${value}\x1B[0m`;
    }
    static code(name, level) {
      let hash3 = 0;
      for (let i = 0; i < name.length; i++) {
        hash3 = (hash3 << 3) - hash3 + name.charCodeAt(i) + 13;
        hash3 |= 0;
      }
      const colors = !level ? [] : level >= 2 ? c256 : c16;
      return colors[Math.abs(hash3) % colors.length];
    }
    static format(exporter, message) {
      const args = message.args.slice();
      if (args[0] instanceof Error) {
        args[0] = args[0].stack || args[0].message;
        args.unshift("%s");
      } else if (typeof args[0] !== "string") {
        args.unshift("%o");
      }
      let format = args.shift();
      format = format.replace(/%([a-zA-Z%])/g, (match, char) => {
        if (match === "%%") return "%";
        const formatter = exporter.formatters?.[char] ?? defaultFormatters[char];
        if (typeof formatter === "function") {
          const value = args.shift();
          return formatter(value, exporter, message);
        }
        return match;
      });
      const oFormatter = exporter.formatters?.o ?? defaultFormatters.o;
      for (let arg of args) {
        if (typeof arg === "object" && arg) {
          arg = oFormatter(arg, exporter, message);
        }
        format += " " + arg;
      }
      const { maxLength = 10240 } = exporter;
      return format.split(/\r?\n/g).map((line) => {
        return line.slice(0, maxLength) + (line.length > maxLength ? "..." : "");
      }).join("\n");
    }
    _method(type, level) {
      return (...args) => {
        if (args.length === 1 && args[0] instanceof Error) {
          if (args[0].cause) {
            this[type](args[0].cause);
          } else if (isAggregateError(args[0])) {
            args[0].errors.forEach((error) => this[type](error));
            return;
          }
        }
        const sn = ++this.service._snMessage;
        const ts = Date.now();
        for (const exporter of this.service.exporters.values()) {
          const targetLevel = exporter.levels?.[this.name] ?? exporter.levels?.default ?? this.level ?? 2;
          if (targetLevel < level) continue;
          const message = { sn, ts, type, level, name: this.name, ...this.meta, args };
          exporter.export(message);
        }
      };
    }
  }, __name(_a3, "Logger"), _a3);
  var c16 = [6, 2, 3, 4, 5, 1];
  var c256 = [
    20,
    21,
    26,
    27,
    32,
    33,
    38,
    39,
    40,
    41,
    42,
    43,
    44,
    45,
    56,
    57,
    62,
    63,
    68,
    69,
    74,
    75,
    76,
    77,
    78,
    79,
    80,
    81,
    92,
    93,
    98,
    99,
    112,
    113,
    129,
    134,
    135,
    148,
    149,
    160,
    161,
    162,
    163,
    164,
    165,
    166,
    167,
    168,
    169,
    170,
    171,
    172,
    173,
    178,
    179,
    184,
    185,
    196,
    197,
    198,
    199,
    200,
    201,
    202,
    203,
    204,
    205,
    206,
    207,
    208,
    209,
    214,
    215,
    220,
    221
  ];
  var _a4;
  var LoggerService = (_a4 = class {
    constructor(ctx) {
      __publicField(this, "bufferSize", 1e3);
      __publicField(this, "buffer", []);
      __publicField(this, "ctx");
      __publicField(this, "_snMessage", 0);
      __publicField(this, "_snExporter", 0);
      __publicField(this, "exporters", /* @__PURE__ */ new Map());
      const tracker = {
        property: "ctx",
        noShadow: true
      };
      const self = createCallable("logger", joinPrototype(Object.getPrototypeOf(this), Function.prototype), tracker);
      Object.assign(self, this);
      self.ctx = ctx;
      defineProperty(self, symbols.tracker, tracker);
      self.exporter({
        colors: 3,
        export: /* @__PURE__ */ __name((message) => {
          self.buffer.push(message);
          const overflow = self.buffer.length - self.bufferSize;
          if (overflow === 1) {
            self.buffer.shift();
          } else if (overflow > 1) {
            self.buffer.splice(0, overflow);
          }
        }, "export")
      });
      return self;
    }
    exporter(exporter) {
      return this.ctx.effect(() => {
        const id = ++this._snExporter;
        this.exporters.set(id, exporter);
        return () => this.exporters.delete(id);
      }, "ctx.logger.exporter()");
    }
    _resolveConfig() {
      let intercept = this.ctx[symbols.intercept];
      const configs = [];
      while ("logger" in intercept) {
        if (Object.hasOwn(intercept, "logger")) {
          configs.unshift(intercept["logger"]);
        }
        intercept = Object.getPrototypeOf(intercept);
      }
      return Object.assign({}, ...configs);
    }
    [symbols.invoke](name) {
      const config = this._resolveConfig();
      const caller = this[symbols.caller];
      const fiber = (caller ?? this.ctx).fiber;
      name ?? (name = config.name);
      name ?? (name = hyphenate(fiber.name));
      return new Logger({
        name,
        level: config.level,
        meta: { fiber: new WeakRef(fiber) }
      }, this);
    }
  }, __name(_a4, "LoggerService"), (() => {
    for (const type of ["error", "info", "warn", "debug"]) {
      ;
      _a4.prototype[type] = function(...args) {
        return this()[type](...args);
      };
    }
  })(), _a4);
  var kValidationError = /* @__PURE__ */ Symbol.for("ValidationError");
  var _a5;
  var ValidationError = (_a5 = class extends TypeError {
    constructor(issues) {
      super(`invalid config:
` + issues.map((issue) => {
        if (issue.path) {
          return `  - ${issue.message} (at ${issue.path.join(".")})`;
        } else {
          return `  - ${issue.message}`;
        }
      }).join("\n"));
      __publicField(this, "name", "ValidationError");
    }
  }, __name(_a5, "ValidationError"), _a5);
  Object.defineProperty(ValidationError.prototype, kValidationError, {
    value: true
  });
  function resolveConfig(runtime, config) {
    if (!runtime.Config) return config;
    const result = runtime.Config["~standard"].validate(config);
    if ("then" in result) {
      throw new TypeError("Async config validation is not supported");
    }
    if (result.issues) {
      throw new ValidationError(result.issues);
    } else {
      return result.value;
    }
  }
  __name(resolveConfig, "resolveConfig");
  var FiberState = /* @__PURE__ */ ((FiberState2) => {
    FiberState2[FiberState2["PENDING"] = 0] = "PENDING";
    FiberState2[FiberState2["LOADING"] = 1] = "LOADING";
    FiberState2[FiberState2["ACTIVE"] = 2] = "ACTIVE";
    FiberState2[FiberState2["FAILED"] = 3] = "FAILED";
    FiberState2[FiberState2["DISPOSED"] = 4] = "DISPOSED";
    FiberState2[FiberState2["UNLOADING"] = 5] = "UNLOADING";
    return FiberState2;
  })(FiberState || {});
  var _a6;
  var CordisError = (_a6 = class extends Error {
    constructor(code, message) {
      super(message ?? _a6.Code[code]);
      __publicField(this, "code");
      this.code = code;
    }
  }, __name(_a6, "CordisError"), _a6);
  ((CordisError2) => {
    CordisError2.Code = {
      INACTIVE_EFFECT: "cannot create effect on inactive context"
    };
  })(CordisError || (CordisError = {}));
  var INACTIVE = "__INACTIVE__";
  var _a7;
  var Fiber = (_a7 = class {
    constructor(parent, config, inject, runtime, getOuterStack) {
      __publicField(this, "parent");
      __publicField(this, "inject");
      __publicField(this, "runtime");
      __publicField(this, "uid");
      __publicField(this, "ctx");
      __publicField(this, "config");
      __publicField(this, "state", 0);
      __publicField(this, "dispose");
      __publicField(this, "store");
      __publicField(this, "inertia");
      __publicField(this, "_hooks", /* @__PURE__ */ Object.create(null));
      __publicField(this, "_disposables", new DisposableList());
      // Same as `this.ctx`, but with a more specific type.
      __publicField(this, "context");
      __publicField(this, "_error");
      __publicField(this, "_runner");
      __publicField(this, "_store", /* @__PURE__ */ Object.create(null));
      this.parent = parent;
      this.inject = inject;
      this.runtime = runtime;
      const collect = /* @__PURE__ */ __name((dispose) => {
        this._disposables.push(dispose);
      }, "collect");
      if (runtime) {
        this.uid = parent.registry.counter;
        this.ctx = this.context = parent.extend({ fiber: this });
        const injectEntries = Object.entries(this.inject);
        if (injectEntries.length) {
          this.ctx[Context.intercept] = Object.create(parent[Context.intercept]);
          for (const [name, config2] of injectEntries) {
            if (isNullable(config2)) continue;
            this.ctx[Context.intercept][name] = config2;
          }
        }
        this._runner = {
          epoch: INACTIVE,
          getOuterStack,
          execute: /* @__PURE__ */ __name(function() {
            if (isConstructor(runtime.callback)) {
              const instance = new runtime.callback(this.ctx, this.config);
              for (const hook of instance?.[symbols.initHooks] ?? []) {
                hook();
              }
              return instance?.[symbols.init]?.();
            } else {
              return runtime.callback(this.ctx, this.config);
            }
          }, "execute"),
          collect
        };
        this.context.emit("internal/plugin", this);
        for (const name of Object.keys(this.inject)) {
          this._checkImpl(name);
        }
        this.dispose = parent.fiber.effect(() => {
          const remove = runtime.fibers.push(this);
          try {
            this.config = resolveConfig(runtime, config);
            this._refresh();
          } catch (error) {
            this.ctx.logger.error(error);
            this._error = error;
          }
          return async () => {
            this.uid = null;
            this.context.emit("internal/plugin", this);
            if (this.ctx.registry.has(runtime.callback)) {
              remove();
              if (!runtime.fibers.length) {
                this.ctx.registry.delete(runtime.callback);
              }
            }
            this._setEpoch(INACTIVE);
            while (this.inertia) {
              await this.inertia;
            }
          };
        }, "ctx.plugin()");
      } else {
        this.uid = 0;
        this.ctx = this.context = parent;
        this.state = 2;
        this.store = /* @__PURE__ */ Object.create(null);
        this._runner = {
          epoch: "",
          getOuterStack,
          execute: /* @__PURE__ */ __name(() => {
          }, "execute"),
          collect
        };
        this.dispose = () => this.restart();
      }
    }
    get name() {
      let fiber = this;
      do {
        if (fiber.runtime?.name) return fiber.runtime.name;
        fiber = fiber.parent.fiber;
      } while (fiber !== fiber.parent.fiber);
      return "root";
    }
    assertActive() {
      if (this.uid !== null) return;
      throw new CordisError("INACTIVE_EFFECT");
    }
    _execute(runner) {
      const oldEpoch = runner.epoch;
      return composeError((info) => {
        const safeCollect = /* @__PURE__ */ __name((dispose) => {
          if (typeof dispose === "function") {
            runner.collect(dispose);
          } else if (!isNullable(dispose)) {
            throw new TypeError("Invalid effect");
          }
        }, "safeCollect");
        const effect = runner.execute.call(this);
        if (typeof effect === "function") {
          return runner.collect(effect);
        } else if (isNullable(effect)) {
        } else if (!isObject(effect)) {
          throw new TypeError("Invalid effect");
        } else if ("then" in effect) {
          return effect.then(safeCollect);
        } else if (Symbol.iterator in effect) {
          info.error = new Error();
          const iter = effect[Symbol.iterator]();
          while (true) {
            const result = iter.next();
            safeCollect(result.value);
            if (result.done) return;
          }
        } else if (Symbol.asyncIterator in effect) {
          const iter = effect[Symbol.asyncIterator]();
          return (async () => {
            await Promise.resolve();
            info.error = new Error();
            while (true) {
              if (runner.epoch !== oldEpoch) return;
              const result = await iter.next();
              safeCollect(result.value);
              if (result.done) return;
            }
          })();
        } else {
          throw new TypeError("Invalid effect");
        }
      }, runner.getOuterStack);
    }
    effect(execute, label = "anonymous") {
      this.assertActive();
      const disposables = [];
      const dispose = /* @__PURE__ */ __name(() => {
        let task2;
        for (const dispose2 of disposables.splice(0).reverse()) {
          if (task2) {
            task2 = task2.then(dispose2);
          } else {
            const result = dispose2();
            if (isObject(result) && "then" in result) {
              task2 = result;
            }
          }
        }
        return task2;
      }, "dispose");
      const meta = { label, children: [] };
      const runner = {
        execute,
        epoch: true,
        collect: /* @__PURE__ */ __name((dispose2) => {
          disposables.push(dispose2);
          this._disposables.delete(dispose2);
          if (dispose2[symbols.effect]) {
            meta.children.push(dispose2[symbols.effect]);
          }
        }, "collect"),
        getOuterStack: buildOuterStack()
      };
      let task;
      try {
        task = this._execute(runner);
      } catch (reason) {
        dispose();
        throw reason;
      }
      task?.catch(dispose).catch((error) => this.ctx.logger.error(error));
      const wrapper = defineProperty(() => {
        if (!runner.epoch) return;
        runner.epoch = false;
        return task ? task.then(dispose) : dispose();
      }, symbols.effect, meta);
      const disposeAsync = /* @__PURE__ */ __name(() => {
        if (!runner.epoch) return;
        runner.epoch = false;
        return dispose();
      }, "disposeAsync");
      wrapper.then = async (onFulfilled, onRejected) => {
        return Promise.resolve(task).then(() => disposeAsync).then(onFulfilled, onRejected);
      };
      disposables.push(this._disposables.push(wrapper));
      return wrapper;
    }
    getEffects() {
      return [...this._disposables].map((dispose) => dispose[symbols.effect]).filter(Boolean);
    }
    _getState() {
      if (this.uid === null) return 4;
      if (this._error) return 3;
      if (this._runner.epoch !== INACTIVE) return 2;
      return 0;
    }
    _updateState(callback) {
      const oldState = this.state;
      this.state = callback() ?? this._getState();
      if (oldState === this.state) return;
      this.context.emit("internal/status", this, oldState);
      if (oldState !== 2 && this.state !== 2) return;
      for (const key of Reflect.ownKeys(this.ctx.reflect.store)) {
        const impl = this.ctx.reflect.store[key];
        if (impl.fiber !== this) continue;
        this.ctx.reflect.notify([impl.name]);
      }
    }
    _checkImpl(name) {
      const impl = this.ctx.reflect._getImpl(name, true);
      if (!impl) return delete this._store[name];
      try {
        if (impl.check && !impl.check.call(getTraceable(this.ctx, impl.value))) {
          return delete this._store[name];
        }
      } catch (error) {
        impl.fiber.ctx.logger.error(error);
        return delete this._store[name];
      }
      this._store[name] = impl;
    }
    _refresh() {
      let epoch = false;
      epoch = "";
      for (const name of Object.keys(this.inject)) {
        const impl = this._store[name];
        if (!impl) {
          epoch = INACTIVE;
          break;
        }
        epoch += ":" + impl.fiber.uid;
      }
      this._setEpoch(epoch);
    }
    _setEpoch(epoch) {
      const oldEpoch = this._runner.epoch;
      if (epoch === oldEpoch) return;
      this._runner.epoch = epoch;
      if (this.inertia) return;
      this._updateState(() => {
        if (epoch !== INACTIVE && oldEpoch === INACTIVE) {
          this.inertia = this._reload();
          return 1;
        } else {
          this.inertia = this._unload();
          return 5;
        }
      });
    }
    async _reload() {
      this.store = { ...this._store };
      const oldEpoch = this._runner.epoch;
      try {
        await Promise.resolve();
        await this._execute(this._runner);
      } catch (reason) {
        this.ctx.logger.error(reason);
        this._error = reason;
        this._runner.epoch = INACTIVE;
      }
      this._updateState(() => {
        if (this._runner.epoch === oldEpoch) {
          this.inertia = void 0;
        } else {
          this.inertia = this._unload();
          return 5;
        }
      });
    }
    async _unload() {
      await Promise.all(this._disposables.clear().map(async (dispose) => {
        try {
          await composeError(async (info) => {
            await Promise.resolve();
            info.error = new Error();
            await dispose();
          }, this._runner.getOuterStack);
        } catch (reason) {
          this.ctx.logger.error(reason);
        }
      }));
      this.store = void 0;
      this._updateState(() => {
        if (this._runner.epoch === INACTIVE) {
          this.inertia = void 0;
        } else {
          this.inertia = this._reload();
          return 1;
        }
      });
    }
    async await() {
      while (this.inertia) {
        await this.inertia;
      }
      if (this._error) throw this._error;
      return this;
    }
    async restart() {
      const fiber = this.ctx.fiber;
      fiber.assertActive();
      fiber._setEpoch(INACTIVE);
      fiber._refresh();
      await fiber.await();
    }
    update(config, noSave = false) {
      const fiber = this.ctx.fiber;
      fiber.assertActive();
      config = resolveConfig(fiber.runtime, config);
      fiber.context.waterfall(fiber, "internal/update", config, noSave, () => {
        fiber.config = config;
        fiber._error = void 0;
        return fiber.restart();
      });
    }
  }, __name(_a7, "Fiber"), _a7);
  function enhanceError(error) {
    const lines = error.stack.split("\n");
    lines.splice(0, 2, `Error: ${error.message}`);
    error.stack = lines.join("\n");
    return error;
  }
  __name(enhanceError, "enhanceError");
  var RESERVED_WORDS = ["prototype", "then"];
  function isSpecialProperty(prop) {
    return typeof prop === "symbol" || RESERVED_WORDS.includes(prop) || parseInt(prop).toString() === prop || prop.startsWith("_");
  }
  __name(isSpecialProperty, "isSpecialProperty");
  var _a8;
  var ReflectService = (_a8 = class {
    constructor(ctx) {
      __publicField(this, "ctx");
      __publicField(this, "store", /* @__PURE__ */ Object.create(null));
      __publicField(this, "props", /* @__PURE__ */ Object.create(null));
      this.ctx = ctx;
      defineProperty(this, symbols.tracker, {
        property: "ctx",
        noShadow: true
      });
      this.mixin("reflect", ["get", "set", "provide", "accessor", "mixin"]);
      this.mixin("fiber", ["runtime", "effect"]);
      this.mixin("registry", ["inject", "plugin"]);
      this.mixin("events", ["on", "once", "parallel", "emit", "serial", "bail", "waterfall"]);
    }
    get(name, strict = true) {
      return getTraceable(this.ctx, this._getImpl(name, strict)?.value);
    }
    _getImpl(name, strict = true) {
      const key = this.ctx[symbols.isolate][name];
      const impl = key && this.store[key];
      if (!impl) return;
      if (strict && impl.fiber.state !== 2) return;
      return impl;
    }
    set(name, value, error) {
      const key = this.ctx[symbols.isolate][name];
      const impl = this.store[key];
      if (!impl) {
        throw new Error(`cannot set property "${name}" without provide`);
      }
      if (impl.fiber !== this.ctx.fiber) {
        throw new Error(`cannot set property "${name}" in multiple fibers`);
      }
      impl.value = value;
      return true;
    }
    provide(name, value, check) {
      return this.ctx.fiber.effect(() => {
        var _a12, _b;
        if (!this.props[name]) {
          (_a12 = this.props)[name] ?? (_a12[name] = { type: "service" });
        } else if (this.props[name].type !== "service") {
          throw new Error(`property "${name}" is already declared as ${this.props[name].type}`);
        }
        this.props[name] = { type: "service" };
        (_b = this.ctx.root[symbols.isolate])[name] ?? (_b[name] = Symbol(name));
        const key = this.ctx[symbols.isolate][name];
        const impl = { name, value, fiber: this.ctx.fiber, check };
        if (this.store[key]) {
          throw new Error(`service "${name}" has been registered at <${this.store[key].fiber.name}>`);
        }
        this.store[key] = impl;
        this.ctx.fiber.store[name] = impl;
        if (this.ctx.fiber.state === 2) {
          this.notify([name]);
        }
        return async () => {
          delete this.store[key];
          const fibers = this.notify([name]);
          await Promise.allSettled(fibers.map((fiber) => fiber.await()));
          delete this.ctx.fiber.store[name];
        };
      }, `ctx.provide(${JSON.stringify(name)})`);
    }
    notify(names, filter = (ctx, name) => ctx[symbols.isolate][name] === this.ctx[symbols.isolate][name]) {
      const fibers = [];
      for (const runtime of this.ctx.registry.values()) {
        for (const fiber of runtime.fibers) {
          let hasUpdate = false;
          for (const name of names) {
            if (!(name in fiber.inject)) continue;
            if (!filter(fiber.ctx, name)) continue;
            hasUpdate = true;
            fiber._checkImpl(name);
          }
          if (!hasUpdate) continue;
          fiber._refresh();
          fibers.push(fiber);
        }
      }
      for (const name of names) {
        const self = Object.create(this.ctx);
        self[symbols.filter] = (target) => filter(target, name);
        this.ctx.events.emit(self, "internal/service", name, this._getImpl(name, false)?.value);
      }
      return fibers;
    }
    accessor(name, options) {
      return this.ctx.fiber.effect(() => {
        if (name in this.props) {
          throw new Error(`property "${name}" is already declared as ${this.props[name].type}`);
        }
        this.props[name] = { type: "accessor", ...options };
        return () => delete this.props[name];
      }, `ctx.accessor(${JSON.stringify(name)})`);
    }
    mixin(source, mixins) {
      const self = this;
      return this.ctx.fiber.effect(function* () {
        const entries = Array.isArray(mixins) ? mixins.map((key) => [key, key]) : Object.entries(mixins);
        const getTarget = /* @__PURE__ */ __name((ctx, error) => {
          return ctx[source];
        }, "getTarget");
        for (const [key, value] of entries) {
          yield self.accessor(value, {
            get(receiver, error) {
              const service = getTarget(this, error);
              if (isNullable(service)) return service;
              const mixin = receiver ? withProps(receiver, service) : service;
              const value2 = Reflect.get(service, key, mixin);
              if (typeof value2 !== "function") return value2;
              return value2.bind(mixin ?? service);
            },
            set(value2, receiver, error) {
              const service = getTarget(this, error);
              const mixin = receiver ? withProps(receiver, service) : service;
              return Reflect.set(service, key, value2, mixin);
            }
          });
        }
      }, `ctx.mixin(${JSON.stringify(source)})`);
    }
    trace(value) {
      return getTraceable(this.ctx, value);
    }
    bind(callback) {
      return new Proxy(callback, {
        apply: /* @__PURE__ */ __name((target, thisArg, args) => {
          return Reflect.apply(target, this.trace(thisArg), args.map((arg) => this.trace(arg)));
        }, "apply"),
        construct: /* @__PURE__ */ __name((target, args, newTarget) => {
          return Reflect.construct(target, args.map((arg) => this.trace(arg)), newTarget);
        }, "construct")
      });
    }
  }, __name(_a8, "ReflectService"), __publicField(_a8, "handler", {
    get: /* @__PURE__ */ __name((target, prop, ctx) => {
      if (isSpecialProperty(prop)) {
        return Reflect.get(target, prop, ctx);
      }
      if (Reflect.has(target, prop)) {
        return getTraceable(ctx, Reflect.get(target, prop, ctx));
      }
      const error = new Error(`cannot get property "${prop}" without inject`);
      try {
        const def = target.reflect.props[prop];
        if (def?.type === "accessor") {
          return def.get.call(ctx, ctx[symbols.receiver], error);
        }
        if (!ctx.fiber.runtime) return ctx.reflect.get(prop, false);
        return ctx.events.waterfall("internal/get", ctx, prop, error, () => {
          const key = target[symbols.isolate][prop];
          let fiber = (ctx[symbols.shadow] ?? ctx).fiber;
          while (true) {
            const impl = fiber.store?.[prop];
            if (impl) return getTraceable(ctx, impl.value);
            if (prop in fiber.inject) {
              error.message = `cannot get required service "${prop}" in inactive context`;
              throw error;
            }
            if (!fiber.runtime) throw error;
            if (fiber.parent[symbols.isolate][prop] !== key) throw error;
            fiber = fiber.parent.fiber;
          }
        });
      } catch (e) {
        throw e === error ? enhanceError(e) : e;
      }
    }, "get"),
    set: /* @__PURE__ */ __name((target, prop, value, ctx) => {
      if (isSpecialProperty(prop)) {
        return Reflect.set(target, prop, value, ctx);
      }
      const error = new Error(`cannot set property "${prop}" without provide`);
      const def = target.reflect.props[prop];
      if (!def) {
        if (!ctx.fiber.runtime) return Reflect.set(target, prop, value, ctx);
        throw enhanceError(error);
      }
      try {
        if (def.type === "accessor") {
          if (!def.set) return false;
          return def.set.call(ctx, value, ctx[symbols.receiver], error);
        }
        return ctx.events.waterfall("internal/set", ctx, prop, value, error, () => {
          return ctx.reflect.set(prop, value, error);
        });
      } catch (e) {
        throw e === error ? enhanceError(e) : e;
      }
    }, "set"),
    has: /* @__PURE__ */ __name((target, prop) => {
      if (isSpecialProperty(prop)) {
        return Reflect.has(target, prop);
      }
      if (Reflect.has(target, prop)) return true;
      return !!target.reflect.props[prop];
    }, "has")
  }), _a8);
  function isApplicable(object) {
    return object && typeof object === "object" && typeof object.apply === "function";
  }
  __name(isApplicable, "isApplicable");
  function Inject(name, config) {
    return function(value, decorator) {
      var _a12, _b;
      if (decorator.kind === "class") {
        if (!Object.hasOwn(value, "inject")) {
          defineProperty(value, "inject", Object.create(Object.getPrototypeOf(value).inject ?? null));
          defineProperty(value.inject, symbols.checkProto, true);
        }
        value.inject[name] = config;
      } else if (decorator.kind === "method") {
        const inject = (_b = value[_a12 = symbols.metadata] ?? (value[_a12] = {})).inject ?? (_b.inject = /* @__PURE__ */ Object.create(null));
        inject[name] = config;
        decorator.addInitializer(function() {
          var _a13;
          const property = this[symbols.tracker]?.property;
          (this[_a13 = symbols.initHooks] ?? (this[_a13] = [])).push(() => {
            this.ctx.inject(inject, (ctx) => {
              return value.call(property ? withProps(this, { [property]: ctx }) : this);
            });
          });
        });
      } else {
        throw new Error("@Inject() can only be used on class or class methods");
      }
    };
  }
  __name(Inject, "Inject");
  ((Inject2) => {
    function resolve(inject, result = /* @__PURE__ */ Object.create(null)) {
      if (!inject) return result;
      if (Array.isArray(inject)) {
        for (const name of inject) {
          result[name] = null;
        }
      } else if (Reflect.has(inject, symbols.checkProto)) {
        Object.assign(result, resolve(Object.getPrototypeOf(inject)));
        for (const name of Object.keys(inject)) {
          result[name] = inject[name] ?? null;
        }
      } else {
        for (const name of Object.keys(inject)) {
          result[name] = inject[name] ?? null;
        }
      }
      return result;
    }
    Inject2.resolve = resolve;
    __name(resolve, "resolve");
  })(Inject || (Inject = {}));
  var _a9;
  var RegistryService = (_a9 = class {
    constructor(ctx) {
      __publicField(this, "ctx");
      __publicField(this, "_counter", 0);
      __publicField(this, "_internal", /* @__PURE__ */ new Map());
      this.ctx = ctx;
      defineProperty(this, symbols.tracker, {
        property: "ctx",
        noShadow: true
      });
    }
    get counter() {
      return ++this._counter;
    }
    get size() {
      return this._internal.size;
    }
    resolve(plugin) {
      try {
        if (typeof plugin === "function") return plugin;
        if (isApplicable(plugin)) return plugin.apply;
      } catch {
      }
    }
    get(plugin) {
      const key = this.resolve(plugin);
      return key && this._internal.get(key);
    }
    has(plugin) {
      const key = this.resolve(plugin);
      return !!key && this._internal.has(key);
    }
    delete(plugin) {
      const key = this.resolve(plugin);
      const runtime = key && this._internal.get(key);
      if (!runtime) return;
      this._internal.delete(key);
      for (const fiber of runtime.fibers) {
        fiber.dispose();
      }
      return runtime;
    }
    keys() {
      return this._internal.keys();
    }
    values() {
      return this._internal.values();
    }
    entries() {
      return this._internal.entries();
    }
    forEach(callback) {
      return this._internal.forEach(callback);
    }
    inject(inject, callback) {
      return this.plugin({ inject, apply: callback, name: callback.name });
    }
    plugin(plugin, config, getOuterStack = buildOuterStack()) {
      const callback = this.resolve(plugin);
      if (!callback) throw new Error('invalid plugin, expect function or object with an "apply" method, received ' + typeof plugin);
      this.ctx.fiber.assertActive();
      let runtime = this._internal.get(callback);
      if (!runtime) {
        let name = plugin.name;
        if (name === "apply") name = void 0;
        runtime = { name, callback, fibers: new DisposableList(), Config: plugin.Config };
        this._internal.set(callback, runtime);
      }
      const fiber = new Fiber(this.ctx, config, Inject.resolve(plugin.inject), runtime, getOuterStack);
      const wrapped = Object.create(fiber);
      wrapped.then = (onFulfilled, onRejected) => {
        return fiber.await().then(onFulfilled, onRejected);
      };
      return wrapped;
    }
  }, __name(_a9, "RegistryService"), _a9);
  var _a10;
  var Context = (_a10 = class {
    static is(value) {
      return !!value?.[_a10.is];
    }
    constructor() {
      this[symbols.isolate] = /* @__PURE__ */ Object.create(null);
      this[symbols.intercept] = /* @__PURE__ */ Object.create(null);
      const self = new Proxy(this, ReflectService.handler);
      this.root = self;
      this.baseUrl = void 0;
      this.fiber = new Fiber(self, {}, /* @__PURE__ */ Object.create(null), null, () => []);
      this.reflect = new ReflectService(self);
      this.registry = new RegistryService(self);
      this.events = new EventsService(self);
      this.logger = new LoggerService(self);
      this.fiber._disposables.clear();
      return self;
    }
    [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")]() {
      return `Context <${this.fiber.name}>`;
    }
    extend(meta = {}) {
      const shadow = Reflect.getOwnPropertyDescriptor(this, symbols.shadow)?.value;
      const self = Object.create(getTraceable(this, this));
      for (const prop of Reflect.ownKeys(meta)) {
        Object.defineProperty(self, prop, Reflect.getOwnPropertyDescriptor(meta, prop));
      }
      if (!shadow) return self;
      return Object.assign(Object.create(self), { [symbols.shadow]: shadow });
    }
    isolate(name, label) {
      const shadow = Object.create(this[symbols.isolate]);
      shadow[name] = label ?? Symbol(name);
      return this.extend({ [symbols.isolate]: shadow });
    }
    intercept(name, config) {
      const intercept = Object.create(this[symbols.intercept]);
      intercept[name] = config;
      return this.extend({ [symbols.intercept]: intercept });
    }
  }, __name(_a10, "Context"), __publicField(_a10, "effect", symbols.effect), __publicField(_a10, "filter", symbols.filter), __publicField(_a10, "isolate", symbols.isolate), __publicField(_a10, "intercept", symbols.intercept), _a10.is[Symbol.toPrimitive] = () => /* @__PURE__ */ Symbol.for("cordis.is"), _a10.prototype[_a10.is] = true, _a10);
  var _a11;
  var Service = (_a11 = class {
    constructor(ctx, name) {
      __publicField(this, "ctx");
      __publicField(this, "name");
      this.ctx = ctx;
      name ?? (name = this.constructor["provide"]);
      let self = this;
      const tracker = {
        associate: name,
        property: "ctx"
      };
      if (self[symbols.invoke]) {
        self = createCallable(name, joinPrototype(Object.getPrototypeOf(this), Function.prototype), tracker);
      }
      self.ctx = ctx;
      self.name = name;
      defineProperty(self, symbols.tracker, tracker);
      self.ctx.reflect.provide(name, self, this[symbols.check]);
      return self;
    }
    [symbols.filter](ctx) {
      return ctx[symbols.isolate][this.name] === this.ctx[symbols.isolate][this.name];
    }
    [symbols.extend](props) {
      let self;
      if (this[_a11.invoke]) {
        self = createCallable(this.name, this, this[symbols.tracker]);
      } else {
        self = Object.create(this);
      }
      return Object.assign(self, props);
    }
    [symbols.resolveConfig](base, head) {
      let intercept = this.ctx[Context.intercept];
      const configs = [];
      while (this.name in intercept) {
        if (Object.hasOwn(intercept, this.name)) {
          configs.unshift(intercept[this.name]);
        }
        intercept = Object.getPrototypeOf(intercept);
      }
      if (base) configs.unshift(base);
      if (head) configs.push(head);
      if (this["Config"]?.merge) {
        return this["Config"].merge(...configs);
      } else {
        return Object.assign({}, ...configs);
      }
    }
    static [Symbol.hasInstance](instance) {
      if (!instance) return false;
      let constructor = instance.constructor;
      while (constructor) {
        constructor = constructor.prototype?.constructor;
        if (constructor === this) return true;
        constructor && (constructor = Object.getPrototypeOf(constructor));
      }
      return false;
    }
  }, __name(_a11, "Service"), __publicField(_a11, "init", symbols.init), __publicField(_a11, "check", symbols.check), __publicField(_a11, "config", symbols.config), __publicField(_a11, "invoke", symbols.invoke), __publicField(_a11, "extend", symbols.extend), __publicField(_a11, "tracker", symbols.tracker), __publicField(_a11, "resolveConfig", symbols.resolveConfig), _a11);

  // runtime/src/serialize.ts
  var TYPED_ARRAYS = {
    Int8Array,
    Uint8Array,
    Uint8ClampedArray,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array
  };
  function typedName(value) {
    if (!ArrayBuffer.isView(value) || value instanceof DataView) return;
    const name = value.constructor?.name;
    return name && TYPED_ARRAYS[name] ? name : void 0;
  }
  function isPlainObject(value) {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
  var StateTypeError = class extends TypeError {
    constructor(path, kind) {
      super(`state 中只能放可序列化数据，${path} 是 ${kind}。场景对象请存 id 或描述，生成结果请放 cache`);
      __publicField(this, "path", path);
      __publicField(this, "kind", kind);
      __publicField(this, "name", "StateTypeError");
    }
  };
  function describe(value) {
    if (typeof value === "function") return "函数";
    if (typeof value === "number") return `非有限数字 ${value}`;
    if (typeof value === "bigint") return "bigint";
    if (typeof value === "symbol") return "symbol";
    if (value === void 0) return "undefined";
    if (value instanceof Promise) return "Promise";
    if (value instanceof Map) return "Map（请改用普通对象）";
    if (value instanceof Set) return "Set（请改用数组）";
    const ctor = value?.constructor?.name;
    return ctor ? `${ctor} 实例` : typeof value;
  }
  function assertSerializable(value, path = "$", seen = /* @__PURE__ */ new Set()) {
    if (value === null) return;
    switch (typeof value) {
      case "string":
      case "boolean":
        return;
      case "number":
        if (Number.isFinite(value)) return;
        throw new StateTypeError(path, describe(value));
      case "object":
        break;
      default:
        throw new StateTypeError(path, describe(value));
    }
    if (typedName(value)) return;
    if (seen.has(value)) throw new StateTypeError(path, "循环引用");
    seen.add(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (!(i in value)) continue;
        assertSerializable(value[i], `${path}[${i}]`, seen);
      }
    } else if (isPlainObject(value)) {
      for (const key of Object.keys(value)) {
        const child = value[key];
        if (child === void 0) continue;
        assertSerializable(child, `${path}.${key}`, seen);
      }
    } else {
      throw new StateTypeError(path, describe(value));
    }
    seen.delete(value);
  }
  function deepClone(value) {
    if (value === null || typeof value !== "object") return value;
    const typed = typedName(value);
    if (typed) return value.slice();
    if (Array.isArray(value)) return value.map(deepClone);
    const result = {};
    for (const key of Object.keys(value)) {
      const child = value[key];
      if (child !== void 0) result[key] = deepClone(child);
    }
    return result;
  }
  function encode(value) {
    if (value === null || typeof value !== "object") return value;
    const typed = typedName(value);
    if (typed) return { $typed: typed, data: Array.from(value) };
    if (Array.isArray(value)) return value.map(encode);
    const result = {};
    for (const key of Object.keys(value)) {
      if (value[key] !== void 0) result[key] = encode(value[key]);
    }
    return result;
  }
  function decode(value) {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(decode);
    if (typeof value.$typed === "string" && Array.isArray(value.data) && TYPED_ARRAYS[value.$typed]) {
      return new TYPED_ARRAYS[value.$typed](value.data);
    }
    const result = {};
    for (const key of Object.keys(value)) result[key] = decode(value[key]);
    return result;
  }
  function estimateSize(value, depth = 0) {
    if (value === null || value === void 0) return 8;
    switch (typeof value) {
      case "string":
        return 16 + value.length * 2;
      case "number":
      case "boolean":
        return 8;
      case "object":
        break;
      default:
        return 16;
    }
    if (ArrayBuffer.isView(value)) return 64 + value.byteLength;
    if (value instanceof ArrayBuffer) return 64 + value.byteLength;
    if (depth > 8) return 64;
    let size = 32;
    if (Array.isArray(value)) {
      for (const item of value) size += estimateSize(item, depth + 1);
    } else {
      for (const key of Object.keys(value)) size += 16 + key.length * 2 + estimateSize(value[key], depth + 1);
    }
    return size;
  }
  function hash(...parts) {
    const text = parts.map((p) => typeof p === "string" ? p : JSON.stringify(encode(p))).join("\0");
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  // runtime/src/units.ts
  var marks = /* @__PURE__ */ new WeakMap();
  function markFiber(fiber, unit) {
    marks.set(fiber, unit);
  }
  function unitOfFiber(fiber) {
    const seen = /* @__PURE__ */ new Set();
    while (fiber && !seen.has(fiber)) {
      seen.add(fiber);
      const name = marks.get(fiber);
      if (name) return name;
      fiber = fiber.parent?.fiber;
    }
  }
  function unitOf(ctx) {
    return unitOfFiber(ctx?.fiber);
  }
  function ancestors(fiber) {
    const result = [];
    const seen = /* @__PURE__ */ new Set([fiber]);
    let current2 = fiber.parent?.fiber;
    while (current2 && !seen.has(current2)) {
      seen.add(current2);
      result.push(current2);
      current2 = current2.parent?.fiber;
    }
    return result;
  }

  // runtime/src/clock.ts
  var ClockService = class extends Service {
    constructor(ctx) {
      super(ctx, "clock");
      /** 游戏时间（秒），冻结或暂停时不走 */
      __publicField(this, "time", 0);
      /** 游戏帧数 */
      __publicField(this, "frame", 0);
      /** 宿主帧数，任何情况下都走 */
      __publicField(this, "hostFrame", 0);
      __publicField(this, "scale", 1);
      /** fixed-update 的步长（秒，游戏时间） */
      __publicField(this, "fixedStep", 1 / 60);
      /** 每帧最多触发的 fixed-update 次数（防止卡顿后越补越慢） */
      __publicField(this, "maxFixedSteps", 8);
      /** 已完成的固定步累计的游戏时间（秒） */
      __publicField(this, "fixedTime", 0);
      /** 固定步总数 */
      __publicField(this, "fixedFrame", 0);
      /** 因超过 maxFixedSteps 被丢弃的游戏时间（秒，累计） */
      __publicField(this, "fixedDropped", 0);
      /** 未满一步的剩余时间占步长的比例（0 到 1），渲染插值用：pos = lerp(prev, curr, fixedAlpha) */
      __publicField(this, "fixedAlpha", 0);
      __publicField(this, "_fixedAcc", 0);
      __publicField(this, "_freeze", 0);
      __publicField(this, "_paused", false);
      __publicField(this, "_steps", 0);
      __publicField(this, "_seq", 0);
      __publicField(this, "_queue", []);
      __publicField(this, "_frameWaiters", []);
    }
    get frozen() {
      return this._freeze > 0;
    }
    get paused() {
      return this._paused;
    }
    /** 冻结时钟，返回解冻函数（可嵌套） */
    freeze() {
      this._freeze++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        this._freeze--;
      };
    }
    pause() {
      this._paused = true;
      this._steps = 0;
    }
    resume() {
      this._paused = false;
      this._steps = 0;
    }
    /** 暂停状态下推进 n 个游戏帧；每帧恰好一个固定步（fixedStep 秒），与宿主帧率无关 */
    step(frames = 1) {
      this._paused = true;
      this._steps += Math.max(1, frames | 0);
    }
    /** step 还没推进完的帧数 */
    get pendingSteps() {
      return this._steps;
    }
    /** 宿主每帧调用 */
    tick(dt) {
      this.hostFrame++;
      if (this._frameWaiters.length) {
        const due = this._frameWaiters.filter((w) => w.frame <= this.hostFrame);
        this._frameWaiters = this._frameWaiters.filter((w) => w.frame > this.hostFrame);
        for (const waiter of due) waiter.resolve();
      }
      if (this._freeze > 0) return;
      let scaled;
      if (this._paused) {
        if (this._steps <= 0) return;
        this._steps--;
        scaled = this.fixedStep > 0 ? this.fixedStep : 1 / 60;
        this._fixedAcc = 0;
      } else {
        scaled = Math.max(0, dt) * this.scale;
      }
      this.time += scaled;
      this.frame++;
      this._runDue();
      this._runFixed(scaled);
      this.ctx.emit("update", scaled, this.time);
    }
    _runFixed(dt) {
      const step = this.fixedStep > 0 ? this.fixedStep : 1 / 60;
      const max = Math.max(1, this.maxFixedSteps | 0);
      this._fixedAcc += dt;
      let n2 = 0;
      while (this._fixedAcc >= step * (1 - 1e-6) && n2 < max) {
        this._fixedAcc = Math.max(0, this._fixedAcc - step);
        this.fixedTime += step;
        this.fixedFrame++;
        n2++;
        this.ctx.emit("fixed-update", step, this.fixedTime);
      }
      if (this._fixedAcc >= step) {
        const drop = this._fixedAcc - this._fixedAcc % step;
        this.fixedDropped += drop;
        this._fixedAcc -= drop;
      }
      this.fixedAlpha = Math.min(1, this._fixedAcc / step);
    }
    /** 宿主帧计数等待（冻结/暂停时也会推进） */
    waitFrames(frames = 1) {
      return new Promise((resolve) => {
        this._frameWaiters.push({ frame: this.hostFrame + Math.max(1, frames | 0), resolve });
      });
    }
    /** 按游戏时间调度回调，返回取消函数。一般用 ctx.timeout，它会随插件自动清理 */
    schedule(delayMs, callback) {
      const item = {
        at: this.time + Math.max(0, delayMs) / 1e3,
        seq: this._seq++,
        callback,
        cancelled: false
      };
      let index = this._queue.length;
      while (index > 0) {
        const prev = this._queue[index - 1];
        if (prev.at < item.at || prev.at === item.at && prev.seq < item.seq) break;
        index--;
      }
      this._queue.splice(index, 0, item);
      return () => {
        if (item.cancelled) return;
        item.cancelled = true;
        const i = this._queue.indexOf(item);
        if (i >= 0) this._queue.splice(i, 1);
      };
    }
    /** 当前排队中的定时器数量（泄漏排查用） */
    get pending() {
      return this._queue.length;
    }
    _runDue() {
      let guard = 1e4;
      while (this._queue.length && this._queue[0].at <= this.time && guard-- > 0) {
        const item = this._queue.shift();
        if (item.cancelled) continue;
        item.cancelled = true;
        try {
          item.callback();
        } catch (error) {
          this.ctx.logger("clock").error(error);
        }
      }
    }
  };

  // runtime/src/timer.ts
  var TimerService = class extends Service {
    constructor(ctx) {
      super(ctx, "timer");
      __publicField(this, "_clock");
      this._clock = ctx.clock;
      ctx.mixin("timer", ["timeout", "interval", "throttle", "debounce", "setTimeout", "setInterval"]);
    }
    setTimeout(callback, delay) {
      return this.timeout(callback, delay);
    }
    setInterval(callback, delay) {
      return this.interval(callback, delay);
    }
    timeout(...args) {
      const callback = typeof args[0] === "function" ? args.shift() : void 0;
      const delay = args[0];
      const clock = this._clock;
      if (callback) {
        const dispose2 = this.ctx.effect(() => {
          const cancel = clock.schedule(delay, () => {
            dispose2();
            callback();
          });
          return cancel;
        }, "ctx.timeout()");
        return dispose2;
      }
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      let settled = false;
      const dispose = this.ctx.effect(() => {
        const cancel = clock.schedule(delay, () => {
          settled = true;
          resolve();
        });
        return () => {
          cancel();
          if (!settled) reject(new Error("Context has been disposed"));
        };
      }, "ctx.timeout()");
      promise.catch(() => {
      });
      return promise.finally(() => dispose());
    }
    /** interval(cb, ms)，返回取消函数 */
    interval(callback, delay) {
      const clock = this._clock;
      const period = Math.max(1, delay);
      return this.ctx.effect(() => {
        let cancel = () => {
        };
        const loop = () => {
          cancel = clock.schedule(period, () => {
            loop();
            callback();
          });
        };
        loop();
        return () => cancel();
      }, "ctx.interval()");
    }
    _schedule(label, trigger2, isDisposed = false) {
      let cancel;
      const dispose = this.ctx.effect(() => () => {
        isDisposed = true;
        cancel?.();
      }, label);
      const wrapper = (...args) => {
        cancel?.();
        cancel = trigger2(args, isDisposed);
      };
      wrapper.dispose = dispose;
      return wrapper;
    }
    throttle(callback, delay, noTrailing) {
      const clock = this._clock;
      let lastCall = -Infinity;
      const execute = (...args) => {
        lastCall = clock.time * 1e3;
        callback(...args);
      };
      return this._schedule("ctx.throttle()", (args, isDisposed) => {
        const now = clock.time * 1e3;
        const remaining = delay - now + lastCall;
        if (remaining <= 0) {
          execute(...args);
        } else if (!isDisposed) {
          return clock.schedule(remaining, () => execute(...args));
        }
      }, noTrailing);
    }
    debounce(callback, delay) {
      const clock = this._clock;
      return this._schedule("ctx.debounce()", (args, isDisposed) => {
        if (isDisposed) return;
        return clock.schedule(delay, () => callback(...args));
      });
    }
  };
  __publicField(TimerService, "inject", ["clock"]);

  // runtime/src/state.ts
  function assertContainer(key, value) {
    if (value === null || typeof value !== "object") {
      throw new TypeError(`state.define("${key}") 的 init 必须返回对象或数组，以便返回同一个引用；标量请包一层，如 { value: 0 }`);
    }
  }
  var StateService = class extends Service {
    constructor(ctx) {
      super(ctx, "state");
      __publicField(this, "_entries", /* @__PURE__ */ new Map());
    }
    define(key, options) {
      const owner = unitOf(this.ctx) ?? "(host)";
      const version = options.version ?? 1;
      const existing = this._entries.get(key);
      if (existing) {
        if (existing.owner !== owner) {
          throw new Error(`state key "${key}" 已被单元 "${existing.owner}" 定义，单元 "${owner}" 不能重复定义；请改名或通过 state.get 读取`);
        }
        existing.defined = true;
        if (existing.version === version) return this._validate(key, existing, options);
        let next;
        if (options.migrate) {
          try {
            next = options.migrate(existing.value, existing.version);
            assertContainer(key, next);
            assertSerializable(next, key);
          } catch (error) {
            this.ctx.logger("state").warn('state "%s" 从 v%d 迁移到 v%d 失败，已重新初始化：%s', key, existing.version, version, error);
            next = void 0;
          }
        } else {
          this.ctx.logger("state").warn('state "%s" 版本 v%d → v%d 且未提供 migrate，已重新初始化', key, existing.version, version);
        }
        existing.version = version;
        if (next === void 0) {
          existing.value = this._init(key, options);
          return existing.value;
        }
        existing.value = next;
        return this._validate(key, existing, options);
      }
      const value = this._init(key, options);
      this._entries.set(key, { value, owner, version, defined: true });
      return value;
    }
    /** 校验沿用下来的数据；不通过时用 init 重新初始化（尽量原地写回） */
    _validate(key, entry, options) {
      if (!options.validate) return entry.value;
      let reason;
      try {
        const result = options.validate(entry.value);
        if (result === false) reason = "校验未通过";
        else if (typeof result === "string") reason = result;
      } catch (error) {
        reason = `校验出错：${error?.message ?? error}`;
      }
      if (reason === void 0) {
        try {
          assertSerializable(entry.value, key);
          return entry.value;
        } catch (error) {
          reason = `校验修正后不可序列化：${error?.message ?? error}`;
        }
      }
      this.ctx.logger("state").warn('state "%s" 沿用的数据无效（%s），已重新初始化', key, reason);
      const fresh = this._init(key, options);
      if (sameShape(entry.value, fresh)) assignInPlace(entry.value, fresh);
      else entry.value = fresh;
      return entry.value;
    }
    _init(key, options) {
      const value = options.init();
      assertContainer(key, value);
      assertSerializable(value, key);
      return value;
    }
    has(key) {
      return this._entries.has(key);
    }
    get(key) {
      return this._entries.get(key)?.value;
    }
    /** 整体替换（会断开旧引用，插件持有的活对象需要重新 define/get） */
    set(key, value) {
      assertContainer(key, value);
      assertSerializable(value, key);
      const entry = this._entries.get(key);
      if (entry) entry.value = value;
      else this._entries.set(key, { value, owner: unitOf(this.ctx) ?? "(host)", version: 1, defined: false });
    }
    keys() {
      return [...this._entries.keys()];
    }
    ownerKeys(unit) {
      return [...this._entries].filter(([, e]) => e.owner === unit).map(([k]) => k);
    }
    info() {
      return [...this._entries].map(([key, e]) => ({ key, owner: e.owner, version: e.version }));
    }
    /** 深拷贝快照（含校验）。keys 省略表示全部 */
    snapshot(keys) {
      const result = {};
      for (const key of keys ?? this._entries.keys()) {
        const entry = this._entries.get(key);
        if (!entry) continue;
        assertSerializable(entry.value, key);
        result[key] = { owner: entry.owner, version: entry.version, value: deepClone(entry.value) };
      }
      return result;
    }
    /**
     * 用快照恢复：尽量原地写回，保持插件持有的引用有效。
     * keys 指定时，快照中没有但当前存在的 key 会被删除（回滚新版本定义的 key）。
     */
    restore(snapshot, keys) {
      for (const key of keys ?? []) {
        if (!(key in snapshot)) this._entries.delete(key);
      }
      for (const key of Object.keys(snapshot)) {
        const saved = snapshot[key];
        const entry = this._entries.get(key);
        const value = deepClone(saved.value);
        if (entry && sameShape(entry.value, value)) {
          assignInPlace(entry.value, value);
          entry.owner = saved.owner;
          entry.version = saved.version;
        } else {
          this._entries.set(key, { value, owner: saved.owner, version: saved.version, defined: entry?.defined ?? false });
        }
      }
    }
    reset(key) {
      if (key === void 0) this._entries.clear();
      else this._entries.delete(key);
    }
    /** 导出为 JSON 字符串（TypedArray 编码），用于冷重启 */
    exportJSON() {
      return JSON.stringify(encode(this.snapshot()));
    }
    importJSON(json2) {
      if (!json2) return;
      const data = decode(JSON.parse(json2));
      for (const key of Object.keys(data)) {
        const saved = data[key];
        this._entries.set(key, { value: saved.value, owner: saved.owner, version: saved.version, defined: false });
      }
    }
  };
  function sameShape(a, b) {
    return a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b) && !ArrayBuffer.isView(a);
  }
  function assignInPlace(target, source) {
    if (Array.isArray(target)) {
      target.length = 0;
      target.push(...source);
      return;
    }
    for (const key of Object.keys(target)) {
      if (!(key in source)) delete target[key];
    }
    Object.assign(target, source);
  }

  // runtime/src/cache.ts
  var CacheService = class extends Service {
    constructor(ctx) {
      super(ctx, "cache");
      /** 预算字节数 */
      __publicField(this, "budget", 64 * 1024 * 1024);
      __publicField(this, "_items", /* @__PURE__ */ new Map());
      __publicField(this, "_bytes", 0);
      __publicField(this, "hits", 0);
      __publicField(this, "misses", 0);
      __publicField(this, "hash", hash);
    }
    get(key) {
      const item = this._items.get(key);
      if (!item) {
        this.misses++;
        return;
      }
      this.hits++;
      this._items.delete(key);
      this._items.set(key, item);
      return item.value;
    }
    has(key) {
      return this._items.has(key);
    }
    set(key, value, size = estimateSize(value)) {
      this.delete(key);
      this._items.set(key, { value, size });
      this._bytes += size;
      this._evict();
      return value;
    }
    /** 以 name + deps 的 hash 为 key，命中返回缓存，否则调用 factory 生成 */
    getOrCreate(name, deps, factory) {
      const key = `${name}:${hash(deps)}`;
      const item = this._items.get(key);
      if (item) {
        this.hits++;
        this._items.delete(key);
        this._items.set(key, item);
        return item.value;
      }
      this.misses++;
      return this.set(key, factory());
    }
    delete(key) {
      const item = this._items.get(key);
      if (!item) return false;
      this._bytes -= item.size;
      this._items.delete(key);
      return true;
    }
    clear() {
      this._items.clear();
      this._bytes = 0;
    }
    stats() {
      return { count: this._items.size, bytes: this._bytes, budget: this.budget, hits: this.hits, misses: this.misses };
    }
    _evict() {
      for (const [key, item] of this._items) {
        if (this._bytes <= this.budget) break;
        this._items.delete(key);
        this._bytes -= item.size;
      }
    }
  };

  // runtime/src/data.ts
  var DataService = class extends Service {
    constructor(ctx, _host) {
      super(ctx, "data");
      __publicField(this, "_host", _host);
      /** path → 读取过它的单元 */
      __publicField(this, "_readers", /* @__PURE__ */ new Map());
    }
    _track(path) {
      const unit = unitOf(this.ctx);
      if (!unit) return;
      let set = this._readers.get(path);
      if (!set) this._readers.set(path, set = /* @__PURE__ */ new Set());
      set.add(unit);
    }
    /** 读取文本；不存在时抛错 */
    text(path) {
      path = normalize(path);
      this._track(path);
      const text = this._host.readText(`data/${path}`);
      if (text === null || text === void 0) throw new Error(`数据文件不存在：data/${path}`);
      return text;
    }
    /** 读取 JSON（每次都重新解析，返回新对象，可放心修改） */
    load(path) {
      const text = this.text(path);
      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error(`数据文件 data/${normalize(path)} 不是合法 JSON：${error?.message ?? error}`);
      }
    }
    exists(path) {
      path = normalize(path);
      this._track(path);
      const text = this._host.readText(`data/${path}`);
      return text !== null && text !== void 0;
    }
    /** 读取过某个数据文件的单元 */
    readers(path) {
      return [...this._readers.get(normalize(path)) ?? []];
    }
    dependencies() {
      const result = {};
      for (const [path, set] of this._readers) result[path] = [...set];
      return result;
    }
  };
  function normalize(path) {
    return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^data\//, "");
  }

  // runtime/src/input.ts
  var InputService = class extends Service {
    constructor(ctx, _host) {
      super(ctx, "input");
      __publicField(this, "_host", _host);
    }
    /** move：WASD/方向键，look：鼠标增量。返回 { x, y } */
    axis(name = "move") {
      const [x, y] = this._host.engine.axis(name);
      return { x, y };
    }
    /** 按住。鼠标按键用 mouse0（左）、mouse1（右）、mouse2（中） */
    key(name) {
      return this._host.engine.key(name, 0);
    }
    /** 本帧按下 */
    pressed(name) {
      return this._host.engine.key(name, 1);
    }
    /** 本帧抬起 */
    released(name) {
      return this._host.engine.key(name, 2);
    }
    /** 锁定并隐藏鼠标（第一人称视角）；false 释放。不传参数时只返回当前是否锁定 */
    cursor(locked) {
      if (locked !== void 0) this._host.engine.cursor(locked);
      return this._host.engine.cursorLocked();
    }
    /** 鼠标位置（像素，左上角为原点，与 ctx.ui 坐标一致） */
    mouse() {
      const [x, y] = this._host.engine.mouse();
      return { x, y };
    }
    /** 屏幕尺寸（像素） */
    screen() {
      const [width, height] = this._host.engine.screen();
      return { width, height };
    }
    /** 本帧滚轮增量 */
    wheel() {
      return this._host.engine.wheel();
    }
    /** 本帧键入的文字：退格为 \b，回车为 \n（输入框用；只有桌面键盘） */
    text() {
      return this._host.engine.textInput?.() ?? "";
    }
    /** 窗口是否有焦点（失焦时可以自动暂停） */
    focused() {
      return this._host.engine.focused();
    }
  };

  // runtime/src/color.ts
  var NAMED = {
    transparent: "#00000000",
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    lime: "#00ff00",
    green: "#008000",
    blue: "#0000ff",
    yellow: "#ffff00",
    cyan: "#00ffff",
    aqua: "#00ffff",
    magenta: "#ff00ff",
    fuchsia: "#ff00ff",
    gray: "#808080",
    grey: "#808080",
    silver: "#c0c0c0",
    maroon: "#800000",
    olive: "#808000",
    navy: "#000080",
    purple: "#800080",
    teal: "#008080",
    orange: "#ffa500"
  };
  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function cssNumber(text, scale, source) {
    const s = text.trim();
    const v = s.endsWith("%") ? parseFloat(s) / 100 : parseFloat(s) / scale;
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?%?$/i.test(s) || !Number.isFinite(v)) throw new TypeError(`无法解析颜色 "${source}"：分量 "${s}" 不是数字`);
    return clamp01(v);
  }
  function hue(text, source) {
    const m = /^([+-]?(?:\d+\.?\d*|\.\d+))(deg|turn|rad)?$/i.exec(text.trim());
    if (!m) throw new TypeError(`无法解析颜色 "${source}"：色相 "${text.trim()}" 不是角度`);
    const v = parseFloat(m[1]);
    const unit = (m[2] ?? "deg").toLowerCase();
    const deg = unit === "turn" ? v * 360 : unit === "rad" ? v * 180 / Math.PI : v;
    return (deg % 360 + 360) % 360;
  }
  function hslToRgb(h, s, l) {
    const k = (n2) => (n2 + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n2) => l - a * Math.max(-1, Math.min(k(n2) - 3, 9 - k(n2), 1));
    return [f(0), f(8), f(4)];
  }
  function parseColorString(color) {
    const source = color;
    const text = color.trim().toLowerCase();
    if (text in NAMED) return parseColorString(NAMED[text]);
    const hex = text.startsWith("#") ? text.slice(1) : /^[0-9a-f]{3,8}$/.test(text) ? text : null;
    if (hex !== null) {
      if (!/^[0-9a-f]+$/.test(hex) || ![3, 4, 6, 8].includes(hex.length)) throw new TypeError(`无法解析颜色 "${source}"：十六进制应为 3、4、6 或 8 位`);
      const full = hex.length <= 4 ? hex.split("").map((c) => c + c).join("") : hex;
      const n2 = parseInt(full.slice(0, 6), 16);
      const a = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
      return [(n2 >> 16 & 255) / 255, (n2 >> 8 & 255) / 255, (n2 & 255) / 255, a];
    }
    const fn = /^(rgba?|hsla?)\(\s*(.*?)\s*\)$/.exec(text);
    if (fn) {
      const [body, alphaText] = fn[2].includes("/") ? fn[2].split("/") : [fn[2], void 0];
      const parts = body.includes(",") ? body.split(",") : body.trim().split(/\s+/);
      let alpha = alphaText;
      if (alpha === void 0 && parts.length === 4) alpha = parts.pop();
      if (parts.length !== 3) throw new TypeError(`无法解析颜色 "${source}"：需要 3 个分量（另可带 alpha）`);
      const a = alpha === void 0 ? 1 : cssNumber(alpha, 1, source);
      if (fn[1].startsWith("rgb")) return [cssNumber(parts[0], 255, source), cssNumber(parts[1], 255, source), cssNumber(parts[2], 255, source), a];
      const pct = (p) => {
        if (!p.trim().endsWith("%") && !/^[+-]?[\d.]+$/.test(p.trim())) throw new TypeError(`无法解析颜色 "${source}"：饱和度与亮度应为百分比`);
        return clamp01(parseFloat(p) / 100);
      };
      const [r, g, b] = hslToRgb(hue(parts[0], source), pct(parts[1]), pct(parts[2]));
      return [r, g, b, a];
    }
    throw new TypeError(`无法解析颜色 "${source}"：支持 #rgb/#rgba/#rrggbb/#rrggbbaa、rgb()/rgba()、hsl()/hsla() 和常用颜色名`);
  }

  // runtime/src/canvas.ts
  var TAU = Math.PI * 2;
  function parseCssColor(input) {
    try {
      return parseColorString(String(input));
    } catch {
      return null;
    }
  }
  var CanvasGradient = class {
    constructor(kind, args) {
      __publicField(this, "kind", kind);
      __publicField(this, "args", args);
      /** @internal */
      __publicField(this, "stops", []);
      __publicField(this, "_lut");
    }
    addColorStop(offset, color) {
      const c = parseCssColor(color);
      if (!c) throw new Error(`addColorStop：无法解析颜色 ${color}`);
      if (!(offset >= 0 && offset <= 1)) throw new Error(`addColorStop：offset ${offset} 超出 0 到 1`);
      this.stops.push({ t: offset, c });
      this.stops.sort((a, b) => a.t - b.t);
      this._lut = void 0;
    }
    /** @internal 1024 项预乘 LUT */
    lut() {
      if (this._lut) return this._lut;
      const n2 = 1024;
      const lut = new Float32Array(n2 * 4);
      const st = this.stops;
      for (let i = 0; i < n2; i++) {
        const t = i / (n2 - 1);
        let c;
        if (!st.length) c = [0, 0, 0, 0];
        else if (t <= st[0].t) c = st[0].c;
        else if (t >= st[st.length - 1].t) c = st[st.length - 1].c;
        else {
          let k = 1;
          while (st[k].t < t) k++;
          const a = st[k - 1], b = st[k];
          const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
          c = [0, 1, 2, 3].map((j) => a.c[j] + (b.c[j] - a.c[j]) * f);
        }
        lut[i * 4] = c[0] * c[3];
        lut[i * 4 + 1] = c[1] * c[3];
        lut[i * 4 + 2] = c[2] * c[3];
        lut[i * 4 + 3] = c[3];
      }
      return this._lut = lut;
    }
  };
  function parseFont(css) {
    const m = /^\s*((?:(?:italic|oblique|normal|small-caps|bold|bolder|lighter|\d{3}|condensed|expanded)\s+)*)(\d*\.?\d+)(px|pt|em|rem)?(?:\s*\/\s*\S+)?\s+(.+?)\s*$/i.exec(css);
    if (!m) return null;
    const pre = m[1].toLowerCase().split(/\s+/).filter(Boolean);
    let size = parseFloat(m[2]);
    const unit = (m[3] || "px").toLowerCase();
    if (unit === "pt") size *= 4 / 3;
    else if (unit === "em" || unit === "rem") size *= 16;
    let bold = false, italic = false;
    for (const t of pre) {
      if (t === "bold" || t === "bolder" || /^\d{3}$/.test(t) && +t >= 600) bold = true;
      if (t === "italic" || t === "oblique") italic = true;
    }
    return { css, size, bold, italic, family: m[4] };
  }
  function mul(a, b) {
    return [
      a[0] * b[0] + a[2] * b[1],
      a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3],
      a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4],
      a[1] * b[4] + a[3] * b[5] + a[5]
    ];
  }
  function invert(m) {
    const det = m[0] * m[3] - m[1] * m[2];
    if (!det) return [0, 0, 0, 0, 0, 0];
    const i = 1 / det;
    return [m[3] * i, -m[1] * i, -m[2] * i, m[0] * i, (m[2] * m[5] - m[3] * m[4]) * i, (m[1] * m[4] - m[0] * m[5]) * i];
  }
  function polyArea(p) {
    let a = 0;
    for (let i = 0, n2 = p.length; i < n2; i += 2) {
      const j = (i + 2) % n2;
      a += p[i] * p[j + 1] - p[j] * p[i + 1];
    }
    return a;
  }
  function orient(p) {
    if (polyArea(p) >= 0) return p;
    const r = [];
    for (let i = p.length - 2; i >= 0; i -= 2) r.push(p[i], p[i + 1]);
    return r;
  }
  var OPS = /* @__PURE__ */ new Set(["source-over", "destination-over", "destination-out", "destination-in", "source-atop", "lighter", "copy", "multiply", "screen"]);
  var CanvasRenderingContext2D = class _CanvasRenderingContext2D {
    constructor(canvas) {
      __publicField(this, "canvas", canvas);
      __publicField(this, "_s");
      __publicField(this, "_stack", []);
      __publicField(this, "_subs", []);
      __publicField(this, "_cur", null);
      __publicField(this, "imageSmoothingEnabled", true);
      __publicField(this, "imageSmoothingQuality", "low");
      __publicField(this, "filter", "none");
      __publicField(this, "shadowBlur", 0);
      __publicField(this, "shadowColor", "rgba(0, 0, 0, 0)");
      __publicField(this, "shadowOffsetX", 0);
      __publicField(this, "shadowOffsetY", 0);
      __publicField(this, "letterSpacing", "0px");
      // ---------------- 覆盖率光栅化（按像素面积累加，非零环绕 / 奇偶） ----------------
      __publicField(this, "_evenodd", false);
      this._s = {
        m: [1, 0, 0, 1, 0, 0],
        fill: { color: [0, 0, 0, 1] },
        stroke: { color: [0, 0, 0, 1] },
        fillText: "#000000",
        strokeText: "#000000",
        lineWidth: 1,
        lineCap: "butt",
        lineJoin: "miter",
        miterLimit: 10,
        dash: [],
        dashOffset: 0,
        alpha: 1,
        op: "source-over",
        font: parseFont("10px sans-serif"),
        textAlign: "start",
        textBaseline: "alphabetic",
        clip: null
      };
    }
    // ---------------- 状态 ----------------
    save() {
      this._stack.push({ ...this._s, dash: this._s.dash.slice() });
    }
    restore() {
      const s = this._stack.pop();
      if (s) this._s = s;
    }
    reset() {
      this._stack = [];
      this._subs = [];
      this._cur = null;
      this._s = new _CanvasRenderingContext2D(this.canvas)._s;
      this.canvas.data.fill(0);
    }
    get fillStyle() {
      return this._s.fillText;
    }
    set fillStyle(v) {
      this._setPaint("fill", v);
    }
    get strokeStyle() {
      return this._s.strokeText;
    }
    set strokeStyle(v) {
      this._setPaint("stroke", v);
    }
    _setPaint(which, v) {
      if (v instanceof CanvasGradient) {
        this._s[which] = { gradient: v };
        this._s[which === "fill" ? "fillText" : "strokeText"] = v;
        return;
      }
      const c = parseCssColor(v);
      if (!c) return;
      this._s[which] = { color: c };
      this._s[which === "fill" ? "fillText" : "strokeText"] = String(v);
    }
    get lineWidth() {
      return this._s.lineWidth;
    }
    set lineWidth(v) {
      if (v > 0 && Number.isFinite(v)) this._s.lineWidth = v;
    }
    get lineCap() {
      return this._s.lineCap;
    }
    set lineCap(v) {
      if (v === "butt" || v === "round" || v === "square") this._s.lineCap = v;
    }
    get lineJoin() {
      return this._s.lineJoin;
    }
    set lineJoin(v) {
      if (v === "miter" || v === "round" || v === "bevel") this._s.lineJoin = v;
    }
    get miterLimit() {
      return this._s.miterLimit;
    }
    set miterLimit(v) {
      if (v > 0 && Number.isFinite(v)) this._s.miterLimit = v;
    }
    get lineDashOffset() {
      return this._s.dashOffset;
    }
    set lineDashOffset(v) {
      if (Number.isFinite(v)) this._s.dashOffset = v;
    }
    setLineDash(d) {
      if (d.some((x) => !(x >= 0) || !Number.isFinite(x))) return;
      this._s.dash = d.length % 2 ? d.concat(d) : d.slice();
    }
    getLineDash() {
      return this._s.dash.slice();
    }
    get globalAlpha() {
      return this._s.alpha;
    }
    set globalAlpha(v) {
      if (v >= 0 && v <= 1) this._s.alpha = v;
    }
    get globalCompositeOperation() {
      return this._s.op;
    }
    set globalCompositeOperation(v) {
      if (OPS.has(v)) this._s.op = v;
    }
    get font() {
      return this._s.font.css;
    }
    set font(v) {
      const f = parseFont(v);
      if (f) this._s.font = f;
    }
    get textAlign() {
      return this._s.textAlign;
    }
    set textAlign(v) {
      this._s.textAlign = v;
    }
    get textBaseline() {
      return this._s.textBaseline;
    }
    set textBaseline(v) {
      this._s.textBaseline = v;
    }
    // ---------------- 变换 ----------------
    setTransform(a, b, c, d, e, f) {
      if (typeof a === "object") this._s.m = [a.a, a.b, a.c, a.d, a.e, a.f];
      else this._s.m = [a, b, c, d, e, f];
    }
    getTransform() {
      const [a, b, c, d, e, f] = this._s.m;
      return { a, b, c, d, e, f };
    }
    resetTransform() {
      this._s.m = [1, 0, 0, 1, 0, 0];
    }
    transform(a, b, c, d, e, f) {
      this._s.m = mul(this._s.m, [a, b, c, d, e, f]);
    }
    translate(x, y) {
      this._s.m = mul(this._s.m, [1, 0, 0, 1, x, y]);
    }
    scale(x, y) {
      this._s.m = mul(this._s.m, [x, 0, 0, y, 0, 0]);
    }
    rotate(r) {
      const c = Math.cos(r), s = Math.sin(r);
      this._s.m = mul(this._s.m, [c, s, -s, c, 0, 0]);
    }
    // ---------------- 路径（存设备坐标） ----------------
    _tx(x, y) {
      const m = this._s.m;
      return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    }
    _scale() {
      const m = this._s.m;
      return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
    }
    _last() {
      const c = this._cur;
      if (!c || !c.pts.length) return null;
      return [c.pts[c.pts.length - 2], c.pts[c.pts.length - 1]];
    }
    _addDev(x, y) {
      if (!this._cur) {
        this._cur = { pts: [x, y], closed: false };
        this._subs.push(this._cur);
      } else this._cur.pts.push(x, y);
    }
    beginPath() {
      this._subs = [];
      this._cur = null;
    }
    moveTo(x, y) {
      const [dx, dy] = this._tx(x, y);
      this._cur = { pts: [dx, dy], closed: false };
      this._subs.push(this._cur);
    }
    lineTo(x, y) {
      const [dx, dy] = this._tx(x, y);
      this._addDev(dx, dy);
    }
    closePath() {
      const c = this._cur;
      if (!c || !c.pts.length) return;
      c.closed = true;
      this._cur = { pts: [c.pts[0], c.pts[1]], closed: false };
      this._subs.push(this._cur);
    }
    quadraticCurveTo(cx, cy, x, y) {
      let p0 = this._last();
      if (!p0) {
        this.moveTo(cx, cy);
        p0 = this._last();
      }
      const p1 = this._tx(cx, cy), p2 = this._tx(x, y);
      const d = Math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1]);
      const n2 = Math.min(256, Math.max(1, Math.ceil(Math.sqrt(d * 2))));
      for (let i = 1; i <= n2; i++) {
        const t = i / n2, u = 1 - t;
        this._addDev(u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]);
      }
    }
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
      let p0 = this._last();
      if (!p0) {
        this.moveTo(c1x, c1y);
        p0 = this._last();
      }
      const p1 = this._tx(c1x, c1y), p2 = this._tx(c2x, c2y), p3 = this._tx(x, y);
      const d = Math.max(
        Math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1]),
        Math.hypot(p1[0] - 2 * p2[0] + p3[0], p1[1] - 2 * p2[1] + p3[1])
      );
      const n2 = Math.min(256, Math.max(1, Math.ceil(Math.sqrt(d * 3))));
      for (let i = 1; i <= n2; i++) {
        const t = i / n2, u = 1 - t;
        const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
        this._addDev(a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1]);
      }
    }
    arc(x, y, r, a0, a1, ccw = false) {
      this.ellipse(x, y, r, r, 0, a0, a1, ccw);
    }
    ellipse(x, y, rx, ry, rot, a0, a1, ccw = false) {
      if (rx < 0 || ry < 0) throw new Error("ellipse：半径不能为负");
      let sweep = a1 - a0;
      if (!ccw) {
        if (sweep >= TAU) sweep = TAU;
        else {
          sweep %= TAU;
          if (sweep < 0) sweep += TAU;
        }
      } else {
        if (-sweep >= TAU) sweep = -TAU;
        else {
          sweep %= TAU;
          if (sweep > 0) sweep -= TAU;
        }
      }
      const rd = Math.max(rx, ry) * this._scale();
      const n2 = Math.min(1024, Math.max(2, Math.ceil(Math.abs(sweep) * Math.sqrt(Math.max(rd, 0.5)) * 1.3)));
      const cr = Math.cos(rot), sr = Math.sin(rot);
      for (let i = 0; i <= n2; i++) {
        const a = a0 + sweep * i / n2;
        const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
        const [dx, dy] = this._tx(x + ex * cr - ey * sr, y + ex * sr + ey * cr);
        this._addDev(dx, dy);
      }
    }
    arcTo(x1, y1, x2, y2, r) {
      const m = this._s.m;
      const inv = invert(m);
      const last = this._last();
      if (!last) {
        this.moveTo(x1, y1);
        return;
      }
      const x0 = inv[0] * last[0] + inv[2] * last[1] + inv[4], y0 = inv[1] * last[0] + inv[3] * last[1] + inv[5];
      const ax = x0 - x1, ay = y0 - y1, bx = x2 - x1, by = y2 - y1;
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      const cross = ax * by - ay * bx;
      if (!la || !lb || !r || Math.abs(cross) < 1e-9) {
        this.lineTo(x1, y1);
        return;
      }
      const cos = (ax * bx + ay * by) / (la * lb);
      const half2 = Math.acos(Math.max(-1, Math.min(1, cos))) / 2;
      const dist = r / Math.tan(half2);
      const t0x = x1 + ax / la * dist, t0y = y1 + ay / la * dist;
      const t1x = x1 + bx / lb * dist, t1y = y1 + by / lb * dist;
      const nx = cross > 0 ? -ay / la : ay / la, ny = cross > 0 ? ax / la : -ax / la;
      const cx = t0x + nx * r, cy = t0y + ny * r;
      this.lineTo(t0x, t0y);
      const s = Math.atan2(t0y - cy, t0x - cx), e = Math.atan2(t1y - cy, t1x - cx);
      this.arc(cx, cy, r, s, e, cross > 0);
    }
    rect(x, y, w, h) {
      this.moveTo(x, y);
      this.lineTo(x + w, y);
      this.lineTo(x + w, y + h);
      this.lineTo(x, y + h);
      this.closePath();
    }
    roundRect(x, y, w, h, radii = 0) {
      const r = Array.isArray(radii) ? radii : [radii];
      const [tl, tr, br, bl] = r.length === 1 ? [r[0], r[0], r[0], r[0]] : r.length === 2 ? [r[0], r[1], r[0], r[1]] : r.length === 3 ? [r[0], r[1], r[2], r[1]] : r;
      const k = Math.min(1, Math.abs(w) / Math.max(1e-9, tl + tr, bl + br), Math.abs(h) / Math.max(1e-9, tl + bl, tr + br));
      const a = tl * k, b = tr * k, c = br * k, d = bl * k;
      this.moveTo(x + a, y);
      this.lineTo(x + w - b, y);
      if (b) this.arc(x + w - b, y + b, b, -Math.PI / 2, 0);
      this.lineTo(x + w, y + h - c);
      if (c) this.arc(x + w - c, y + h - c, c, 0, Math.PI / 2);
      this.lineTo(x + d, y + h);
      if (d) this.arc(x + d, y + h - d, d, Math.PI / 2, Math.PI);
      this.lineTo(x, y + a);
      if (a) this.arc(x + a, y + a, a, Math.PI, Math.PI * 1.5);
      this.closePath();
    }
    // ---------------- 绘制 ----------------
    _fillPolys() {
      return this._subs.filter((s) => s.pts.length >= 6).map((s) => s.pts);
    }
    fill(rule) {
      this._evenodd = rule === "evenodd";
      try {
        this._paint(this._fillPolys(), this._s.fill);
      } finally {
        this._evenodd = false;
      }
    }
    stroke() {
      this._paint(this._strokePolys(this._subs), this._s.stroke);
    }
    clip(rule) {
      const c = this.canvas;
      const mask = new Float32Array(c.width * c.height);
      this._evenodd = rule === "evenodd";
      const cov = this._coverage(this._fillPolys());
      this._evenodd = false;
      if (cov) {
        const { x0, y0, w, h, a } = cov;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[(y0 + y) * c.width + x0 + x] = a[y * w + x];
      }
      const old = this._s.clip;
      if (old) for (let i = 0; i < mask.length; i++) mask[i] *= old[i];
      this._s.clip = mask;
    }
    fillRect(x, y, w, h) {
      this._paint([this._rectPoly(x, y, w, h)], this._s.fill);
    }
    strokeRect(x, y, w, h) {
      const p = this._rectPoly(x, y, w, h);
      this._paint(this._strokePolys([{ pts: p, closed: true }]), this._s.stroke);
    }
    clearRect(x, y, w, h) {
      const cov = this._coverage([this._rectPoly(x, y, w, h)]);
      if (!cov) return;
      const d = this.canvas.data, W = this.canvas.width, clip = this._s.clip;
      const { x0, y0, w: cw, h: ch, a } = cov;
      for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) {
        let c = a[yy * cw + xx];
        const pi = (y0 + yy) * W + x0 + xx;
        if (clip) c *= clip[pi];
        if (c <= 0) continue;
        const k = 1 - Math.min(1, c);
        d[pi * 4] *= k;
        d[pi * 4 + 1] *= k;
        d[pi * 4 + 2] *= k;
        d[pi * 4 + 3] *= k;
      }
    }
    isPointInPath(x, y) {
      const cov = this._coverage(this._fillPolys());
      if (!cov) return false;
      const xi = Math.floor(x) - cov.x0, yi = Math.floor(y) - cov.y0;
      return xi >= 0 && yi >= 0 && xi < cov.w && yi < cov.h && cov.a[yi * cov.w + xi] > 0.5;
    }
    _rectPoly(x, y, w, h) {
      const a = this._tx(x, y), b = this._tx(x + w, y), c = this._tx(x + w, y + h), d = this._tx(x, y + h);
      return [a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]];
    }
    createLinearGradient(x0, y0, x1, y1) {
      return new CanvasGradient("linear", [x0, y0, x1, y1]);
    }
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      if (r0 < 0 || r1 < 0) throw new Error("createRadialGradient：半径不能为负");
      return new CanvasGradient("radial", [x0, y0, r0, x1, y1, r1]);
    }
    createPattern() {
      throw new Error("Canvas：暂不支持 createPattern");
    }
    /** @internal */
    _coverage(polys) {
      const W = this.canvas.width, H2 = this.canvas.height;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of polys) for (let i = 0; i < p.length; i += 2) {
        const x = p[i], y = p[i + 1];
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const x0 = Math.max(0, Math.floor(minX)), x1 = Math.min(W, Math.ceil(maxX));
      const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H2, Math.ceil(maxY));
      if (x1 <= x0 || y1 <= y0) return null;
      const bw = x1 - x0, bh = y1 - y0, stride = bw + 2;
      const acc = new Float32Array(stride * bh);
      const line = (ax, ay, bx, by) => {
        if (ay === by) return;
        let dir = 1;
        if (ay > by) {
          dir = -1;
          let t = ax;
          ax = bx;
          bx = t;
          t = ay;
          ay = by;
          by = t;
        }
        const dxdy = (bx - ax) / (by - ay);
        let x = ax;
        if (ay < 0) x -= ay * dxdy;
        const ys = Math.max(0, Math.floor(ay)), ye = Math.min(bh, Math.ceil(by));
        for (let y = ys; y < ye; y++) {
          const ls = y * stride;
          const dy = Math.min(y + 1, by) - Math.max(y, ay);
          const xn = x + dxdy * dy;
          const d = dy * dir;
          const xa = x < xn ? x : xn, xb = x < xn ? xn : x;
          const xaf = Math.floor(xa), xai = xaf;
          const xbc = Math.ceil(xb), xbi = xbc;
          if (xbi <= xai + 1) {
            const xmf = 0.5 * (x + xn) - xaf;
            acc[ls + xai] += d - d * xmf;
            acc[ls + xai + 1] += d * xmf;
          } else {
            const s = 1 / (xb - xa);
            const x0f = xa - xaf;
            const a0 = 0.5 * s * (1 - x0f) * (1 - x0f);
            const x1f = xb - xbc + 1;
            const am = 0.5 * s * x1f * x1f;
            acc[ls + xai] += d * a0;
            if (xbi === xai + 2) acc[ls + xai + 1] += d * (1 - a0 - am);
            else {
              const a1 = s * (1.5 - x0f);
              acc[ls + xai + 1] += d * (a1 - a0);
              for (let xi = xai + 2; xi < xbi - 1; xi++) acc[ls + xi] += d * s;
              const a2 = a1 + (xbi - xai - 3) * s;
              acc[ls + xbi - 1] += d * (1 - a2 - am);
            }
            acc[ls + xbi] += d * am;
          }
          x = xn;
        }
      };
      const seg = (ax, ay, bx, by) => {
        ax -= x0;
        bx -= x0;
        ay -= y0;
        by -= y0;
        if (ay === by) return;
        const ts = [0, 1];
        if (ax !== bx) for (const X of [0, bw]) {
          const t = (X - ax) / (bx - ax);
          if (t > 0 && t < 1) ts.push(t);
        }
        ts.sort((p, q) => p - q);
        const cl = (v) => v < 0 ? 0 : v > bw ? bw : v;
        for (let i = 0; i + 1 < ts.length; i++) {
          const t0 = ts[i], t1 = ts[i + 1];
          line(cl(ax + (bx - ax) * t0), ay + (by - ay) * t0, cl(ax + (bx - ax) * t1), ay + (by - ay) * t1);
        }
      };
      for (const p of polys) {
        const n2 = p.length;
        for (let i = 0; i < n2; i += 2) {
          const j = (i + 2) % n2;
          seg(p[i], p[i + 1], p[j], p[j + 1]);
        }
      }
      const a = new Float32Array(bw * bh);
      const eo = this._evenodd;
      for (let y = 0; y < bh; y++) {
        let s = 0;
        const ls = y * stride;
        for (let x = 0; x < bw; x++) {
          s += acc[ls + x];
          let v = Math.abs(s);
          if (eo) {
            v %= 2;
            if (v > 1) v = 2 - v;
          }
          a[y * bw + x] = v > 1 ? 1 : v;
        }
      }
      return { x0, y0, w: bw, h: bh, a };
    }
    // ---------------- 描边转多边形 ----------------
    _strokePolys(subs) {
      const s = this._s;
      const m = s.m, inv = invert(m);
      const hw = s.lineWidth / 2;
      const out = [];
      const scale = this._scale();
      const push = (p) => {
        const r = [];
        for (let i = 0; i < p.length; i += 2) r.push(m[0] * p[i] + m[2] * p[i + 1] + m[4], m[1] * p[i] + m[3] * p[i + 1] + m[5]);
        out.push(orient(r));
      };
      const circle = (x, y) => {
        const n2 = Math.min(256, Math.max(8, Math.ceil(TAU * Math.sqrt(Math.max(hw * scale, 0.5)) * 1.3)));
        const p = [];
        for (let i = 0; i < n2; i++) p.push(x + Math.cos(i / n2 * TAU) * hw, y + Math.sin(i / n2 * TAU) * hw);
        push(p);
      };
      const stroke = (pts, closed) => {
        const n2 = pts.length / 2;
        if (n2 < 2) return;
        const segs = closed ? n2 : n2 - 1;
        const dirs = [];
        for (let i = 0; i < segs; i++) {
          const j = (i + 1) % n2;
          const dx = pts[j * 2] - pts[i * 2], dy = pts[j * 2 + 1] - pts[i * 2 + 1];
          const l = Math.hypot(dx, dy) || 1;
          dirs.push(dx / l, dy / l);
          const nx = -dy / l * hw, ny = dx / l * hw;
          const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[j * 2], by = pts[j * 2 + 1];
          push([ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny, ax - nx, ay - ny]);
        }
        const join = (vi, d0, d1) => {
          const px = pts[vi * 2], py = pts[vi * 2 + 1];
          const ax = dirs[d0 * 2], ay = dirs[d0 * 2 + 1], bx = dirs[d1 * 2], by = dirs[d1 * 2 + 1];
          const cross = ax * by - ay * bx, dot = ax * bx + ay * by;
          if (Math.abs(cross) < 1e-6 && dot > 0) return;
          if (s.lineJoin === "round") {
            circle(px, py);
            return;
          }
          const sg = cross > 0 ? -1 : 1;
          const n0x = -ay * hw * sg, n0y = ax * hw * sg, n1x = -by * hw * sg, n1y = bx * hw * sg;
          if (s.lineJoin === "miter" && 1 + dot > 1e-9) {
            const ratio = Math.sqrt(2 / (1 + dot));
            if (ratio <= s.miterLimit) {
              const k = 1 / (1 + dot);
              push([px, py, px + n0x, py + n0y, px + (n0x + n1x) * k, py + (n0y + n1y) * k, px + n1x, py + n1y]);
              return;
            }
          }
          push([px, py, px + n0x, py + n0y, px + n1x, py + n1y]);
        };
        for (let i = 1; i < segs; i++) join(i, i - 1, i);
        if (closed) join(0, segs - 1, 0);
        else {
          const cap = (vi, dx, dy) => {
            const px = pts[vi * 2], py = pts[vi * 2 + 1];
            if (s.lineCap === "round") circle(px, py);
            else if (s.lineCap === "square") {
              const nx = -dy * hw, ny = dx * hw, ex = dx * hw, ey = dy * hw;
              push([px + nx, py + ny, px + nx + ex, py + ny + ey, px - nx + ex, py - ny + ey, px - nx, py - ny]);
            }
          };
          cap(0, -dirs[0], -dirs[1]);
          cap(n2 - 1, dirs[(segs - 1) * 2], dirs[(segs - 1) * 2 + 1]);
        }
      };
      for (const sub of subs) {
        const user = [];
        for (let i = 0; i < sub.pts.length; i += 2) {
          const x = inv[0] * sub.pts[i] + inv[2] * sub.pts[i + 1] + inv[4];
          const y = inv[1] * sub.pts[i] + inv[3] * sub.pts[i + 1] + inv[5];
          const k = user.length;
          if (k && Math.abs(user[k - 2] - x) < 1e-7 && Math.abs(user[k - 1] - y) < 1e-7) continue;
          user.push(x, y);
        }
        if (sub.closed && user.length > 4 && Math.abs(user[0] - user[user.length - 2]) < 1e-7 && Math.abs(user[1] - user[user.length - 1]) < 1e-7) user.length -= 2;
        if (user.length < 4) continue;
        if (s.dash.length && s.dash.some((d) => d > 0)) for (const piece of this._dashes(user, sub.closed)) stroke(piece, false);
        else stroke(user, sub.closed);
      }
      return out;
    }
    _dashes(pts, closed) {
      const dash = this._s.dash;
      const total = dash.reduce((a, b) => a + b, 0);
      let off = (this._s.dashOffset % total + total) % total;
      let di = 0;
      while (off >= dash[di]) {
        off -= dash[di];
        di = (di + 1) % dash.length;
      }
      let left = dash[di] - off;
      let on = di % 2 === 0;
      const out = [];
      let cur = on ? [pts[0], pts[1]] : null;
      const n2 = pts.length / 2;
      const segs = closed ? n2 : n2 - 1;
      for (let i = 0; i < segs; i++) {
        const j = (i + 1) % n2;
        let ax = pts[i * 2], ay = pts[i * 2 + 1];
        const bx = pts[j * 2], by = pts[j * 2 + 1];
        let len = Math.hypot(bx - ax, by - ay);
        const ux = len ? (bx - ax) / len : 0, uy = len ? (by - ay) / len : 0;
        while (len > left) {
          ax += ux * left;
          ay += uy * left;
          len -= left;
          if (on) {
            cur.push(ax, ay);
            out.push(cur);
            cur = null;
          } else cur = [ax, ay];
          on = !on;
          di = (di + 1) % dash.length;
          left = dash[di];
        }
        left -= len;
        if (on) cur.push(bx, by);
      }
      if (cur && cur.length >= 4) out.push(cur);
      return out;
    }
    // ---------------- 着色与合成 ----------------
    _shader(paint) {
      if ("color" in paint) {
        const [r, g, b, a2] = paint.color;
        return (_x, _y, o) => {
          o[0] = r * a2;
          o[1] = g * a2;
          o[2] = b * a2;
          o[3] = a2;
        };
      }
      const gr = paint.gradient;
      const lut = gr.lut();
      const inv = invert(this._s.m);
      const look = (t, o) => {
        const i = (t <= 0 ? 0 : t >= 1 ? 1023 : Math.round(t * 1023)) * 4;
        o[0] = lut[i];
        o[1] = lut[i + 1];
        o[2] = lut[i + 2];
        o[3] = lut[i + 3];
      };
      const A = gr.args;
      if (gr.kind === "linear") {
        const [x0, y0, x1, y1] = A;
        const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
        return (x, y, o) => {
          if (!l2) {
            o.fill(0);
            return;
          }
          const ux = inv[0] * x + inv[2] * y + inv[4], uy = inv[1] * x + inv[3] * y + inv[5];
          look(((ux - x0) * dx + (uy - y0) * dy) / l2, o);
        };
      }
      const [cx0, cy0, r0, cx1, cy1, r1] = A;
      const cdx = cx1 - cx0, cdy = cy1 - cy0, dr = r1 - r0;
      const a = cdx * cdx + cdy * cdy - dr * dr;
      return (x, y, o) => {
        const ux = inv[0] * x + inv[2] * y + inv[4], uy = inv[1] * x + inv[3] * y + inv[5];
        const px = ux - cx0, py = uy - cy0;
        const b = px * cdx + py * cdy + r0 * dr;
        const c = px * px + py * py - r0 * r0;
        let t;
        if (Math.abs(a) < 1e-9) {
          if (Math.abs(b) < 1e-12) {
            o.fill(0);
            return;
          }
          t = c / (2 * b);
        } else {
          const disc = b * b - a * c;
          if (disc < 0) {
            o.fill(0);
            return;
          }
          const sq = Math.sqrt(disc);
          t = (b + sq) / a;
          if (r0 + t * dr < 0) t = (b - sq) / a;
        }
        if (r0 + t * dr < 0) {
          o.fill(0);
          return;
        }
        look(t, o);
      };
    }
    /** 合成一个预乘源像素（c 为覆盖率 × globalAlpha × clip） */
    _blend(pi, S, c) {
      const d = this.canvas.data;
      const i = pi * 4;
      const Dr = d[i], Dg = d[i + 1], Db = d[i + 2], Da = d[i + 3];
      const Sr = S[0], Sg = S[1], Sb = S[2], Sa = S[3];
      let r, g, b, a;
      switch (this._s.op) {
        case "destination-out":
          r = Dr * (1 - Sa);
          g = Dg * (1 - Sa);
          b = Db * (1 - Sa);
          a = Da * (1 - Sa);
          break;
        case "destination-in":
          r = Dr * Sa;
          g = Dg * Sa;
          b = Db * Sa;
          a = Da * Sa;
          break;
        case "destination-over":
          r = Dr + Sr * (1 - Da);
          g = Dg + Sg * (1 - Da);
          b = Db + Sb * (1 - Da);
          a = Da + Sa * (1 - Da);
          break;
        case "source-atop":
          r = Sr * Da + Dr * (1 - Sa);
          g = Sg * Da + Dg * (1 - Sa);
          b = Sb * Da + Db * (1 - Sa);
          a = Da;
          break;
        case "lighter":
          r = Math.min(1, Sr + Dr);
          g = Math.min(1, Sg + Dg);
          b = Math.min(1, Sb + Db);
          a = Math.min(1, Sa + Da);
          break;
        case "copy":
          r = Sr;
          g = Sg;
          b = Sb;
          a = Sa;
          break;
        case "multiply":
          r = Sr * (1 - Da) + Dr * (1 - Sa) + Sr * Dr;
          g = Sg * (1 - Da) + Dg * (1 - Sa) + Sg * Dg;
          b = Sb * (1 - Da) + Db * (1 - Sa) + Sb * Db;
          a = Sa + Da - Sa * Da;
          break;
        case "screen":
          r = Sr + Dr - Sr * Dr;
          g = Sg + Dg - Sg * Dg;
          b = Sb + Db - Sb * Db;
          a = Sa + Da - Sa * Da;
          break;
        default:
          r = Sr + Dr * (1 - Sa);
          g = Sg + Dg * (1 - Sa);
          b = Sb + Db * (1 - Sa);
          a = Sa + Da * (1 - Sa);
      }
      if (c >= 1) {
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = a;
      } else {
        d[i] = Dr + (r - Dr) * c;
        d[i + 1] = Dg + (g - Dg) * c;
        d[i + 2] = Db + (b - Db) * c;
        d[i + 3] = Da + (a - Da) * c;
      }
    }
    _paint(polys, paint, sample) {
      if (!polys.length) return;
      const cov = this._coverage(polys);
      if (!cov) return;
      const W = this.canvas.width, clip = this._s.clip, alpha = this._s.alpha;
      const shade = this._shader(paint);
      const S = new Float32Array(4);
      const { x0, y0, w, h, a } = cov;
      for (let y = 0; y < h; y++) {
        const py = y0 + y + 0.5;
        for (let x = 0; x < w; x++) {
          let c = a[y * w + x];
          if (c <= 0) continue;
          const pi = (y0 + y) * W + x0 + x;
          if (clip) {
            c *= clip[pi];
            if (c <= 0) continue;
          }
          c *= alpha;
          if (sample) {
            const k = sample(x0 + x + 0.5, py, S);
            if (k < 0) {
              this._blend(pi, S, c);
              continue;
            }
            if (k <= 0) continue;
            shade(x0 + x + 0.5, py, S);
            S[0] *= k;
            S[1] *= k;
            S[2] *= k;
            S[3] *= k;
          } else shade(x0 + x + 0.5, py, S);
          this._blend(pi, S, c);
        }
      }
    }
    // ---------------- 图像 ----------------
    drawImage(img, ...args) {
      const iw = img.width, ih = img.height;
      let sx = 0, sy = 0, sw = iw, sh = ih, dx, dy, dw = iw, dh = ih;
      if (args.length === 2) [dx, dy] = args;
      else if (args.length === 4) [dx, dy, dw, dh] = args;
      else if (args.length === 8) [sx, sy, sw, sh, dx, dy, dw, dh] = args;
      else throw new Error("drawImage：参数个数应为 3、5 或 9");
      if (!sw || !sh || !dw || !dh) return;
      const src = img instanceof Canvas ? img.data : premulBytes(img.data);
      const inv = invert(this._s.m);
      const smooth = this.imageSmoothingEnabled;
      const lx = Math.max(0, Math.min(sx, sx + sw)), hx = Math.min(iw, Math.max(sx, sx + sw));
      const ly = Math.max(0, Math.min(sy, sy + sh)), hy = Math.min(ih, Math.max(sy, sy + sh));
      this._paint([this._rectPoly(dx, dy, dw, dh)], this._s.fill, (x, y, o) => {
        const ux = inv[0] * x + inv[2] * y + inv[4], uy = inv[1] * x + inv[3] * y + inv[5];
        const u = sx + (ux - dx) / dw * sw, v = sy + (uy - dy) / dh * sh;
        sampleRGBA(src, iw, u, v, lx, ly, hx, hy, smooth, o);
        return -1;
      });
    }
    getImageData(x, y, w, h) {
      const out = new Uint8ClampedArray(w * h * 4);
      const c = this.canvas, d = c.data;
      for (let j = 0; j < h; j++) {
        const yy = y + j;
        if (yy < 0 || yy >= c.height) continue;
        for (let i = 0; i < w; i++) {
          const xx = x + i;
          if (xx < 0 || xx >= c.width) continue;
          const s = (yy * c.width + xx) * 4, o = (j * w + i) * 4;
          const a = d[s + 3];
          if (a > 0) {
            out[o] = Math.round(d[s] / a * 255);
            out[o + 1] = Math.round(d[s + 1] / a * 255);
            out[o + 2] = Math.round(d[s + 2] / a * 255);
            out[o + 3] = Math.round(a * 255);
          }
        }
      }
      return { width: w, height: h, data: out };
    }
    createImageData(w, h) {
      if (typeof w === "object") return { width: w.width, height: w.height, data: new Uint8ClampedArray(w.width * w.height * 4) };
      return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    }
    putImageData(img, x, y) {
      const c = this.canvas, d = c.data, s = img.data;
      x = Math.round(x);
      y = Math.round(y);
      for (let j = 0; j < img.height; j++) {
        const yy = y + j;
        if (yy < 0 || yy >= c.height) continue;
        for (let i = 0; i < img.width; i++) {
          const xx = x + i;
          if (xx < 0 || xx >= c.width) continue;
          const si = (j * img.width + i) * 4, di = (yy * c.width + xx) * 4;
          const a = s[si + 3] / 255;
          d[di] = s[si] / 255 * a;
          d[di + 1] = s[si + 1] / 255 * a;
          d[di + 2] = s[si + 2] / 255 * a;
          d[di + 3] = a;
        }
      }
    }
    // ---------------- 文字 ----------------
    measureText(text) {
      const f = this._s.font;
      const g = this.canvas._glyphs(String(text), f, f.size);
      const left = this._alignOffset(g.adv);
      return {
        width: g.adv,
        actualBoundingBoxLeft: -left + g.ox,
        actualBoundingBoxRight: left + g.w - g.ox,
        actualBoundingBoxAscent: g.base,
        actualBoundingBoxDescent: g.h - g.base,
        fontBoundingBoxAscent: g.ascent,
        fontBoundingBoxDescent: g.descent
      };
    }
    _alignOffset(adv) {
      switch (this._s.textAlign) {
        case "center":
          return -adv / 2;
        case "right":
        case "end":
          return -adv;
        default:
          return 0;
      }
    }
    fillText(text, x, y, maxWidth) {
      text = String(text).replace(/[\t\n\r\f]/g, " ");
      if (!text) return;
      const f = this._s.font;
      const scale = Math.min(8, Math.max(0.25, this._scale()));
      const rs = Math.max(4, Math.min(512, Math.round(f.size * scale)));
      const k = f.size / rs;
      const g = this.canvas._glyphs(text, f, rs);
      const adv = g.adv * k;
      const sxk = maxWidth !== void 0 && maxWidth > 0 && adv > maxWidth ? maxWidth / adv : 1;
      const ascent = f.size * 0.8, descent = f.size * 0.2;
      let base = y;
      switch (this._s.textBaseline) {
        case "top":
        case "hanging":
          base = y + ascent;
          break;
        case "middle":
          base = y + (ascent - descent) / 2;
          break;
        case "bottom":
        case "ideographic":
          base = y - descent;
          break;
      }
      const left = x + this._alignOffset(adv * sxk);
      const qx = left - g.ox * k * sxk, qy = base - g.base * k, qw = g.w * k * sxk, qh = g.h * k;
      if (!g.w || !g.h) return;
      const inv = invert(this._s.m);
      const A = g.alpha, gw = g.w, gh = g.h;
      this._paint([this._rectPoly(qx, qy, qw, qh)], this._s.fill, (px, py) => {
        const ux = inv[0] * px + inv[2] * py + inv[4], uy = inv[1] * px + inv[3] * py + inv[5];
        return sampleAlpha(A, gw, gh, (ux - qx) / qw * gw, (uy - qy) / qh * gh);
      });
    }
    strokeText() {
      throw new Error("Canvas：暂不支持 strokeText");
    }
  };
  function premulBytes(b) {
    const f = new Float32Array(b.length);
    for (let i = 0; i < b.length; i += 4) {
      const a = b[i + 3] / 255;
      f[i] = b[i] / 255 * a;
      f[i + 1] = b[i + 1] / 255 * a;
      f[i + 2] = b[i + 2] / 255 * a;
      f[i + 3] = a;
    }
    return f;
  }
  function sampleRGBA(src, w, u, v, lx, ly, hx, hy, smooth, o) {
    if (!smooth) {
      const x = Math.min(hx - 1, Math.max(lx, Math.floor(u))), y = Math.min(hy - 1, Math.max(ly, Math.floor(v)));
      const i = (y * w + x) * 4;
      o[0] = src[i];
      o[1] = src[i + 1];
      o[2] = src[i + 2];
      o[3] = src[i + 3];
      return;
    }
    const fx = u - 0.5, fy = v - 0.5;
    let x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const cx = (x) => x < lx ? lx : x > hx - 1 ? hx - 1 : x;
    const cy = (y) => y < ly ? ly : y > hy - 1 ? hy - 1 : y;
    const xa = cx(x0), xb = cx(x0 + 1), ya = cy(y0), yb = cy(y0 + 1);
    const i00 = (ya * w + xa) * 4, i10 = (ya * w + xb) * 4, i01 = (yb * w + xa) * 4, i11 = (yb * w + xb) * 4;
    for (let k = 0; k < 4; k++) {
      const top = src[i00 + k] + (src[i10 + k] - src[i00 + k]) * tx;
      const bot = src[i01 + k] + (src[i11 + k] - src[i01 + k]) * tx;
      o[k] = top + (bot - top) * ty;
    }
    x0 = y0 = 0;
  }
  function sampleAlpha(A, w, h, u, v) {
    const fx = u - 0.5, fy = v - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const at = (x, y) => x < 0 || y < 0 || x >= w || y >= h ? 0 : A[y * w + x];
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
    const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
    return (top + (bot - top) * ty) / 255;
  }
  var GENERIC = {
    "sans-serif": ["Microsoft YaHei", "Arial"],
    sans: ["Microsoft YaHei", "Arial"],
    "system-ui": ["Microsoft YaHei", "Segoe UI"],
    serif: ["SimSun", "Times New Roman"],
    monospace: ["Consolas", "Courier New", "SimHei"],
    "ui-monospace": ["Consolas", "Courier New"]
  };
  function fontFamilies(css) {
    const out = [];
    for (const raw of css.split(",")) {
      const name = raw.trim().replace(/^["']|["']$/g, "");
      if (!name) continue;
      const g = GENERIC[name.toLowerCase()];
      for (const n2 of g ?? [name]) if (!out.includes(n2)) out.push(n2);
    }
    for (const n2 of ["Microsoft YaHei", "SimHei", "PingFang SC", "Noto Sans CJK SC", "Arial"]) if (!out.includes(n2)) out.push(n2);
    return out.join(",");
  }
  var Canvas = class {
    constructor(width, height, host) {
      __publicField(this, "data");
      __publicField(this, "_w");
      __publicField(this, "_h");
      __publicField(this, "_ctx");
      __publicField(this, "_glyphCache", /* @__PURE__ */ new Map());
      /** 宿主文字栅格化（scene.canvas 创建时注入；独立 new Canvas 时不能画文字） */
      __publicField(this, "host");
      /** 由 scene.canvas 注入：把像素上传为贴图 */
      __publicField(this, "upload");
      this._w = Math.max(1, Math.floor(width));
      this._h = Math.max(1, Math.floor(height));
      this.data = new Float32Array(this._w * this._h * 4);
      this.host = host;
    }
    get width() {
      return this._w;
    }
    set width(v) {
      this._resize(v, this._h);
    }
    get height() {
      return this._h;
    }
    set height(v) {
      this._resize(this._w, v);
    }
    _resize(w, h) {
      this._w = Math.max(1, Math.floor(w));
      this._h = Math.max(1, Math.floor(h));
      this.data = new Float32Array(this._w * this._h * 4);
      this._ctx = void 0;
    }
    getContext(kind, _options) {
      if (kind !== "2d") throw new Error(`Canvas：只支持 getContext('2d')`);
      return this._ctx ?? (this._ctx = new CanvasRenderingContext2D(this));
    }
    /** RGBA8 非预乘像素；flipY 为 true 时行从下到上（scene.texture 的约定） */
    pixels(flipY = false) {
      const w = this._w, h = this._h, d = this.data;
      const out = new Uint8Array(w * h * 4);
      for (let y = 0; y < h; y++) {
        const ry = flipY ? h - 1 - y : y;
        for (let x = 0; x < w; x++) {
          const s = (y * w + x) * 4, o = (ry * w + x) * 4;
          const a = d[s + 3];
          if (a <= 0) continue;
          const ia = 1 / a;
          out[o] = Math.min(255, Math.round(d[s] * ia * 255));
          out[o + 1] = Math.min(255, Math.round(d[s + 1] * ia * 255));
          out[o + 2] = Math.min(255, Math.round(d[s + 2] * ia * 255));
          out[o + 3] = Math.min(255, Math.round(a * 255));
        }
      }
      return out;
    }
    /**
     * 上传为贴图（scene.texture 的选项：linear 数据贴图如法线/遮罩用 true，mipmaps、wrap、filter、aniso）。
     * 只有 ctx.scene.canvas 创建的画布可用；贴图随调用 scene.canvas 的插件卸载销毁。
     */
    texture(options = {}) {
      if (!this.upload) throw new Error("canvas.texture：请用 ctx.scene.canvas 创建画布");
      return this.upload(this.pixels(true), this._w, this._h, options);
    }
    /** @internal 一行文字的 alpha 位图（宿主栅格化，带缓存） */
    _glyphs(text, font, size) {
      const style = (font.bold ? 1 : 0) | (font.italic ? 2 : 0);
      const key = `${size}|${style}|${font.family}|${text}`;
      let g = this._glyphCache.get(key);
      if (g) return g;
      const engine = this.host?.engine;
      if (!engine?.canvasText) throw new Error("Canvas：文字需要宿主支持，请用 ctx.scene.canvas 创建画布");
      const buf = engine.canvasText(text, fontFamilies(font.family), size, style);
      if (!buf || buf.byteLength < 32) g = { w: 0, h: 0, ox: 0, base: 0, adv: 0, ascent: size * 0.8, descent: size * 0.2, alpha: new Uint8Array(0) };
      else {
        const hd = new Float32Array(buf, 0, 8);
        const w = hd[0], h = hd[1];
        g = { w, h, ox: hd[2], base: hd[3], adv: hd[4], ascent: hd[5], descent: hd[6], alpha: new Uint8Array(buf, 32, w * h) };
      }
      if (this._glyphCache.size > 512) this._glyphCache.clear();
      this._glyphCache.set(key, g);
      return g;
    }
  };

  // runtime/src/scene.ts
  var CULL = { none: 0, front: 1, back: 2, default: 3 };
  var Texture = class {
    constructor(id, width, height, _dispose) {
      __publicField(this, "id", id);
      __publicField(this, "width", width);
      __publicField(this, "height", height);
      __publicField(this, "_dispose", _dispose);
    }
    destroy() {
      return this._dispose?.();
    }
  };
  function rgb(color, k = 1) {
    if (color === void 0) return void 0;
    const [r, g, b, a] = parseColor(color);
    return [r * k, g * k, b * k, a];
  }
  function bool(v) {
    return v === void 0 ? void 0 : v ? 1 : 0;
  }
  function bytesOf(view, Type) {
    const typed = view instanceof Type ? view : new Type(view);
    return typed.byteOffset === 0 && typed.byteLength === typed.buffer.byteLength ? typed.buffer : typed.buffer.slice(typed.byteOffset, typed.byteOffset + typed.byteLength);
  }
  var ATTRIBUTE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
  function meshAttributes(mesh, attrs, vcount) {
    if (!attrs) return [];
    const names = Object.keys(attrs).sort();
    if (names.length > 7) throw new Error(`scene.mesh(${mesh})：自定义顶点属性最多 7 个，给了 ${names.length} 个`);
    return names.map((name) => {
      if (!ATTRIBUTE_NAME.test(name) || name.startsWith("pot_") || name.startsWith("gl_")) throw new Error(`scene.mesh(${mesh})：顶点属性名 ${name} 不合法`);
      const v = attrs[name];
      const isArray = typeof v.length === "number";
      const data = isArray ? v : v.data;
      const size = isArray ? vcount > 0 ? data.length / vcount : 0 : v.size;
      if (!(size >= 1 && size <= 4 && Number.isInteger(size))) throw new Error(`scene.mesh(${mesh})：顶点属性 ${name} 须为每顶点 1 到 4 个数`);
      if (data.length !== size * vcount) throw new Error(`scene.mesh(${mesh})：顶点属性 ${name} 须为每顶点 ${size} 个数，共 ${size * vcount} 个`);
      return { name, size, data: bytesOf(data, Float32Array) };
    });
  }
  function attributeKeyParts(attrs) {
    const out = [];
    for (const a of attrs) {
      const head = new Uint32Array(a.name.length + 1);
      head[0] = a.size;
      for (let i = 0; i < a.name.length; i++) head[i + 1] = a.name.charCodeAt(i);
      out.push(head.buffer, a.data);
    }
    return out;
  }
  function contentKey(buffers) {
    let a = 2166136261 | 0;
    let b = 2654435769 | 0;
    let total = 0;
    for (const buffer of buffers) {
      if (!buffer) {
        a = Math.imul(a ^ 255, 16777619);
        continue;
      }
      const w = new Uint32Array(buffer, 0, buffer.byteLength >> 2);
      total += w.length;
      a = Math.imul(a ^ w.length, 16777619);
      for (let i = 0; i < w.length; i++) {
        const x = w[i];
        a = Math.imul(a ^ x, 16777619);
        b = Math.imul(b ^ x + 2654435769 + (b << 6) + (b >>> 2), 2246822507);
      }
    }
    return `#${(a >>> 0).toString(16)}${(b >>> 0).toString(16)}.${total}`;
  }
  function applyUniforms(engine, id, values) {
    for (const name of Object.keys(values)) {
      const v = values[name];
      if (v === null || v === void 0) engine.gfxTexture(id, name, 0);
      else if (v instanceof Texture) engine.gfxTexture(id, name, v.id);
      else if (typeof v === "number") engine.gfxUniform(id, name, 1, v, 0, 0, 0);
      else if (typeof v === "boolean") engine.gfxUniform(id, name, 1, v ? 1 : 0, 0, 0, 0);
      else if (typeof v === "string") {
        const [r, g, b, a] = parseColor(v);
        engine.gfxUniform(id, name, 4, srgbToLinear(r), srgbToLinear(g), srgbToLinear(b), a);
      } else if (v.length <= 4) engine.gfxUniform(id, name, v.length, v[0] ?? 0, v[1] ?? 0, v[2] ?? 0, v[3] ?? 0);
      else engine.gfxUniformArray(id, name, bytesOf(v, Float32Array));
    }
  }
  var INSTANCE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
  function instanceLayout(layout) {
    const names = Object.keys(layout ?? {});
    if (names.length === 0 || names.length > 11) throw new Error(`instances：layout 应有 1 到 11 项，给了 ${names.length} 项`);
    let stride = 0;
    const parts = [];
    for (const name of names) {
      if (!INSTANCE_NAME.test(name) || name.startsWith("pot_") || name.startsWith("gl_")) throw new Error(`instances：属性名无效 ${name}`);
      const size = layout[name];
      if (!Number.isInteger(size) || size < 1 || size > 4) throw new Error(`instances：${name} 的分量数应为 1 到 4，收到 ${size}`);
      parts.push(`${name}:${size}`);
      stride += size;
    }
    return { text: parts.join(";"), stride };
  }
  function srgbToLinear(v) {
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  var colorCache = /* @__PURE__ */ new Map();
  function rayPlane(o, d, plane) {
    const n2 = plane.normal ?? [0, 1, 0];
    const p = plane.point ?? [0, plane.y ?? 0, 0];
    const denom = n2[0] * d[0] + n2[1] * d[1] + n2[2] * d[2];
    if (Math.abs(denom) < 1e-9) return;
    if (denom > 0 && !plane.twoSided) return;
    const t = (n2[0] * (p[0] - o[0]) + n2[1] * (p[1] - o[1]) + n2[2] * (p[2] - o[2])) / denom;
    if (!(t > 0)) return;
    const r = plane.region;
    if (r) {
      const x = o[0] + d[0] * t, y = o[1] + d[1] * t, z = o[2] + d[2] * t;
      if (r.minX !== void 0 && x < r.minX || r.maxX !== void 0 && x > r.maxX) return;
      if (r.minY !== void 0 && y < r.minY || r.maxY !== void 0 && y > r.maxY) return;
      if (r.minZ !== void 0 && z < r.minZ || r.maxZ !== void 0 && z > r.maxZ) return;
    }
    return t;
  }
  function eulerToQuaternion(x, y, z, out = [0, 0, 0, 1]) {
    const h = Math.PI / 360;
    const sx = Math.sin(x * h), cx = Math.cos(x * h);
    const sy = Math.sin(y * h), cy = Math.cos(y * h);
    const sz = Math.sin(z * h), cz = Math.cos(z * h);
    const ax = sx * cz, ay = -sx * sz, az = cx * sz, aw = cx * cz;
    out[0] = cy * ax + sy * az;
    out[1] = cy * ay + sy * aw;
    out[2] = cy * az - sy * ax;
    out[3] = cy * aw - sy * ay;
    return out;
  }
  function slerpQuaternion(a, b, t, out = [0, 0, 0, 1]) {
    let bx = b[0], by = b[1], bz = b[2], bw = b[3];
    let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
    if (cos < 0) {
      cos = -cos;
      bx = -bx;
      by = -by;
      bz = -bz;
      bw = -bw;
    }
    let k0 = 1 - t, k1 = t;
    if (cos < 0.9995) {
      const angle = Math.acos(cos);
      const sin = Math.sin(angle);
      k0 = Math.sin((1 - t) * angle) / sin;
      k1 = Math.sin(t * angle) / sin;
    }
    const x = k0 * a[0] + k1 * bx, y = k0 * a[1] + k1 * by, z = k0 * a[2] + k1 * bz, w = k0 * a[3] + k1 * bw;
    const len = Math.hypot(x, y, z, w) || 1;
    out[0] = x / len;
    out[1] = y / len;
    out[2] = z / len;
    out[3] = w / len;
    return out;
  }
  function parseColor(color) {
    if (typeof color === "string") {
      let c = colorCache.get(color);
      if (!c) {
        c = parseColorString(color);
        if (colorCache.size > 2048) colorCache.clear();
        colorCache.set(color, c);
      }
      return [c[0], c[1], c[2], c[3]];
    }
    return [color[0], color[1], color[2], color[3] ?? 1];
  }
  var Entity = class _Entity {
    constructor(_scene, id, _dispose) {
      __publicField(this, "_scene", _scene);
      __publicField(this, "id", id);
      __publicField(this, "_dispose", _dispose);
    }
    get _engine() {
      return this._scene.host.engine;
    }
    get alive() {
      return this._engine.exists(this.id);
    }
    get position() {
      return this._engine.getVec(this.id, "position");
    }
    set position(v) {
      this._engine.setVec(this.id, "position", v[0], v[1], v[2]);
    }
    get rotation() {
      return this._engine.getVec(this.id, "rotation");
    }
    set rotation(v) {
      this._engine.setVec(this.id, "rotation", v[0], v[1], v[2]);
    }
    get scale() {
      return this._engine.getVec(this.id, "scale");
    }
    set scale(v) {
      this._engine.setVec(this.id, "scale", v[0], v[1], v[2]);
    }
    move(dx, dy, dz) {
      const [x, y, z] = this.position;
      this.position = [x + dx, y + dy, z + dz];
      return this;
    }
    lookAt(target) {
      const [x, y, z] = target instanceof _Entity ? target.position : target;
      this._engine.lookAt(this.id, x, y, z);
      return this;
    }
    color(color) {
      const [r, g, b, a] = parseColor(color);
      this._engine.setColor(this.id, r, g, b, a);
      return this;
    }
    active(value) {
      this._engine.setActive(this.id, value);
      return this;
    }
    /** 开关渲染。false 时碰撞体、子节点、灯光照常工作（只碰撞不渲染的命中体） */
    visible(value) {
      this._engine.visible(this.id, value);
      return this;
    }
    /** 相对父节点的位置 */
    get localPosition() {
      return this._engine.getVec(this.id, "localPosition");
    }
    set localPosition(v) {
      this._engine.setVec(this.id, "localPosition", v[0], v[1], v[2]);
    }
    /** 相对父节点的欧拉角（度） */
    get localRotation() {
      return this._engine.getVec(this.id, "localRotation");
    }
    set localRotation(v) {
      this._engine.setVec(this.id, "localRotation", v[0], v[1], v[2]);
    }
    /** 材质参数（逐对象，不复制材质）。只设置传入的字段 */
    material(options) {
      const engine = this._engine;
      if (options.mode !== void 0 || options.shadows !== void 0 || options.cull !== void 0) {
        const cull = options.cull === void 0 ? -1 : CULL[options.cull];
        if (cull === void 0) throw new Error(`material.cull 只能是 back/front/none/default，收到 ${options.cull}`);
        engine.material(this.id, options.mode ?? "", options.shadows === void 0 ? -1 : options.shadows ? 1 : 0, cull);
      }
      if (options.metallic !== void 0 || options.smoothness !== void 0) {
        engine.surface(this.id, options.metallic ?? -1, options.smoothness ?? -1);
      }
      if (options.emission !== void 0) {
        const [r, g, b] = parseColor(options.emission);
        const k = options.emissionIntensity ?? 1;
        engine.emission(this.id, r * k, g * k, b * k);
      }
      if (options.map !== void 0) engine.matTexture(this.id, "map", options.map?.id ?? 0);
      if (options.normalMap !== void 0) engine.matTexture(this.id, "normal", options.normalMap?.id ?? 0);
      if (options.maskMap !== void 0) engine.matTexture(this.id, "mask", options.maskMap?.id ?? 0);
      if (options.tiling !== void 0 || options.offset !== void 0) {
        const t = options.tiling ?? [1, 1];
        const o = options.offset ?? [0, 0];
        engine.matVector(this.id, "_Tiling", t[0], t[1], o[0], o[1]);
      }
      if (options.uv !== void 0) engine.matFloat(this.id, "_UVMode", options.uv === "world" ? 1 : options.uv === "object" ? 2 : 0);
      if (options.normalScale !== void 0) engine.matFloat(this.id, "_BumpScale", options.normalScale);
      if (options.occlusion !== void 0) engine.matFloat(this.id, "_Occlusion", options.occlusion);
      if (options.wet !== void 0) engine.matFloat(this.id, "_Wet", options.wet);
      if (options.planar !== void 0) engine.matFloat(this.id, "_Planar", options.planar);
      if (options.cutoff !== void 0) engine.matFloat(this.id, "_Cutoff", options.cutoff);
      if (options.vertexColors !== void 0) engine.matFloat(this.id, "_VColor", options.vertexColors ? 1 : 0);
      return this;
    }
    /**
     * 开关碰撞体，或换成指定形状（'mesh' / 'convex' / 'box'，同时打开）。
     * options.dynamic 挂运动学刚体，适合会动的碰撞体（见 SpawnOptions.dynamic）
     */
    collider(value, options = {}) {
      if (typeof value === "string" || options.dynamic) {
        if (typeof value === "string" && value !== "mesh" && value !== "convex" && value !== "box") throw new Error(`collider(${value})：形状只能是 mesh、convex 或 box`);
        const error = this._engine.colliderShape(this.id, typeof value === "string" ? value : "", !!options.dynamic);
        if (error) throw new Error(`collider(${value})：${error}`);
      }
      this._engine.collider(this.id, value !== false);
      return this;
    }
    /**
     * 改用运行时着色器绘制（ctx.gfx.shader 创建；也可传程序名）。null 恢复普通材质。
     * 网格仍由 Unity 渲染器投射阴影（shadows: false 关闭）；接收主光阴影用 <pot/lit> 的 pot_Lit / pot_Shadow。
     */
    shader(shader, options = {}) {
      const engine = this._engine;
      if (!shader) {
        engine.gfxBind(this.id, "", 0, 0, 0);
        return this;
      }
      if (this._scene.skinned.has(this.id)) throw new Error("蒙皮实体暂不支持运行时着色器（顶点由引擎蒙皮，运行时着色器拿不到蒙皮后的网格）");
      const blend = options.blend ?? "none";
      const queue = options.queue ?? (blend === "none" ? "opaque" : "transparent");
      const cull = options.cull ?? "back";
      let flags = cull === "front" ? 1 : cull === "none" ? 2 : 0;
      if (options.depthWrite ?? queue === "opaque") flags |= 4;
      flags |= { none: 0, alpha: 1, add: 2, premultiplied: 3 }[blend] << 3;
      if (options.depthTest === false) flags |= 128;
      if (options.frustumCull === false) flags |= 256;
      if (options.polygonOffset) {
        const [f, u] = options.polygonOffset;
        if (!Number.isFinite(f) || !Number.isFinite(u)) throw new Error(`polygonOffset 须为两个有限数 [factor, units]，收到 ${options.polygonOffset}`);
        const i8 = (v) => Math.max(-128, Math.min(127, Math.round(v))) & 255;
        flags |= i8(f) << 16 | i8(u) << 24;
      }
      if (options.sceneDepth ?? (queue === "opaque" && (flags & 4) !== 0 && options.depthTest !== false)) flags |= 512;
      const shadows = options.shadows ?? queue === "opaque";
      engine.gfxBind(this.id, typeof shader === "string" ? shader : shader.name, flags, queue === "transparent" ? 1 : 0, shadows ? 1 : 0);
      if (options.uniforms) this.uniforms(options.uniforms);
      if (options.instances) this.instances(options.instances.layout, options.instances.data, options.instances.count);
      return this;
    }
    /**
     * 实例化绘制（先调用 shader）：网格画 count 次，着色器里 gfx.shader({ instanced }) 声明的同名输入每实例读一次。
     * layout 如 { aOffset: 3, aColor: 4 }，data 按此顺序交错；data 可以是预分配的大数组，只上传前 count 个实例。
     * 实例化时不做视锥剔除、不投射网格阴影。传 null 或 count 0 恢复单次绘制
     */
    instances(layout, data, count) {
      const engine = this._engine;
      if (!engine.gfxInstances) throw new Error("当前 Runner 不支持实例化（宿主缺少 gfxInstances），请更新 Runner");
      if (!layout || count === 0) {
        engine.gfxInstances(this.id, 0, "", new ArrayBuffer(0));
        return this;
      }
      const { text, stride } = instanceLayout(layout);
      if (!data) throw new Error("instances：缺少 data");
      const n2 = count ?? Math.floor(data.length / stride);
      if (!Number.isInteger(n2) || n2 < 0) throw new Error(`instances：count 无效 ${count}`);
      if (n2 * stride > data.length) throw new Error(`instances：${n2} 个实例需要 ${n2 * stride} 个 float，data 只有 ${data.length} 个`);
      if (n2 === 0) {
        engine.gfxInstances(this.id, 0, "", new ArrayBuffer(0));
        return this;
      }
      const err = engine.gfxInstances(this.id, n2, text, bytesOf(data, Float32Array));
      if (err) throw new Error(`instances：${err}`);
      return this;
    }
    /**
     * 设置运行时着色器的 uniform（先调用 shader）。数字、布尔、数组（矩阵按列主序）、颜色字符串（转为线性 rgba）、Texture；
     * 贴图传 null 解除。
     */
    uniforms(values) {
      applyUniforms(this._engine, this.id, values);
      return this;
    }
    layer(layer) {
      this._engine.layer(this.id, layer);
      return this;
    }
    /** 灯光强度（仅灯光对象）；单位与创建时的 units 一致 */
    intensity(value) {
      this._engine.lightIntensity(this.id, value * (this._scene.lightScale.get(this.id) ?? 1));
      return this;
    }
    destroy() {
      if (this._dispose) return this._dispose();
      throw new Error("该对象不能销毁（例如主相机）");
    }
  };
  var SceneService = class extends Service {
    constructor(ctx, host) {
      super(ctx, "scene");
      __publicField(this, "host", host);
      /** id → 对象登记信息（只登记 pot 创建的对象） */
      __publicField(this, "objects", /* @__PURE__ */ new Map());
      /** 蒙皮实体的 id */
      __publicField(this, "skinned", /* @__PURE__ */ new Set());
      /** 灯光 id → 强度换算系数（units: 'three' 为 1/π） */
      __publicField(this, "lightScale", /* @__PURE__ */ new Map());
    }
    /** 主相机（不归任何插件所有，不能销毁） */
    get camera() {
      return new Entity(this, this.host.engine.cameraId());
    }
    background(color) {
      const [r, g, b] = parseColor(color);
      this.host.engine.setBackground(r, g, b);
    }
    spawn(options = {}) {
      const engine = this.host.engine;
      const shape2 = options.shape ?? "cube";
      const name = options.name ?? shape2;
      const unit = unitOf(this.ctx) ?? "(host)";
      const bones = options.bones;
      if (bones && !shape2.startsWith("mesh:")) throw new Error(`scene.spawn(${name})：bones 只能配 mesh: 形状`);
      let id = 0;
      const dispose = this.ctx.effect(() => {
        id = engine.spawn(bones ? `skin:${shape2.slice(5)}` : shape2, name, options.parent?.id ?? 0);
        if (bones) {
          const ids = new Int32Array(bones.length);
          for (let i = 0; i < bones.length; i++) ids[i] = bones[i].id;
          const error = engine.skin(id, ids.buffer);
          if (error) {
            engine.destroy(id);
            throw new Error(`scene.spawn(${name})：${error}`);
          }
          this.skinned.add(id);
        }
        this.objects.set(id, { id, name, shape: shape2, unit });
        return () => {
          this.objects.delete(id);
          this.skinned.delete(id);
          this.lightScale.delete(id);
          engine.destroy(id);
        };
      }, `scene.spawn(${name})`);
      const entity2 = new Entity(this, id, dispose);
      if (options.parent) {
        if (options.position) entity2.localPosition = options.position;
        if (options.rotation) entity2.localRotation = options.rotation;
      } else {
        if (options.position) entity2.position = options.position;
        if (options.rotation) entity2.rotation = options.rotation;
      }
      if (options.scale !== void 0) {
        const s = options.scale;
        entity2.scale = typeof s === "number" ? [s, s, s] : s;
      }
      if (options.color) entity2.color(options.color);
      if (options.material) entity2.material(options.material);
      if (options.collider === false) entity2.collider(false);
      else if (typeof options.collider === "string" || options.dynamic) {
        try {
          entity2.collider(options.collider ?? true, { dynamic: options.dynamic });
        } catch (e) {
          entity2.destroy();
          throw new Error(`scene.spawn(${name})：${e.message}`);
        }
      }
      if (options.layer !== void 0) entity2.layer(options.layer);
      if (options.active === false) entity2.active(false);
      if (options.visible === false) entity2.visible(false);
      return entity2;
    }
    /**
     * 批量设置变换：一次跨语言调用写完一批实体（骨骼、成群的动态物体），比逐个设 position/rotation/scale 省得多。
     * data 每个实体 10 个数：位置 xyz、单位四元数 xyzw、缩放 xyz（引擎坐标系）。
     * targets 传 Int32Array（实体 id，建好后复用）时不产生分配；也可以传实体数组。
     * 世界空间下若同一批里有父子关系，父节点要排在子节点前面。返回实际写入的实体数（已销毁的跳过）
     */
    setTransforms(targets, data, options = {}) {
      let ids;
      if (targets instanceof Int32Array) ids = targets;
      else {
        ids = new Int32Array(targets.length);
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i];
          ids[i] = typeof t === "number" ? t : t.id;
        }
      }
      const count = options.count ?? Math.min(ids.length, Math.floor(data.length / 10));
      if (count <= 0) return 0;
      if (count > ids.length || count * 10 > data.length) throw new Error(`scene.setTransforms：count ${count} 超出范围（${ids.length} 个实体，data 能容纳 ${Math.floor(data.length / 10)} 个）`);
      let flags = 0;
      if (options.position !== false) flags |= 1;
      if (options.rotation !== false) flags |= 2;
      if (options.scale !== false) flags |= 4;
      if (options.space === "local") flags |= 8;
      if (!(flags & 7)) return 0;
      return this.host.engine.setTransforms(bytesOf(ids, Int32Array), bytesOf(data, Float32Array), count, flags);
    }
    light(options = {}) {
      const entity2 = this.spawn({ shape: "empty", name: options.name ?? `${options.type ?? "directional"} light`, parent: options.parent, position: options.position, rotation: options.rotation });
      const [r, g, b] = parseColor(options.color ?? [1, 1, 1]);
      const engine = this.host.engine;
      const three = options.units === "three";
      if (options.units !== void 0 && options.units !== "unity" && !three) throw new Error(`scene.light：未知的 units "${options.units}"，可用 unity / three`);
      const scale = three ? 1 / Math.PI : 1;
      if (scale !== 1) this.lightScale.set(entity2.id, scale);
      const range = options.range ?? (three && options.distance && options.distance > 0 ? options.distance : 10);
      engine.light(entity2.id, options.type ?? "directional", (options.intensity ?? 1) * scale, r, g, b, range);
      if (options.spotAngle !== void 0 || options.shadows !== void 0) {
        const shadows = options.shadows === void 0 ? -1 : options.shadows === "none" ? 0 : options.shadows === "hard" ? 1 : 2;
        engine.lightOptions(entity2.id, options.spotAngle ?? 0, shadows);
      }
      return entity2;
    }
    /** 主相机参数：视野（度）、近/远裁剪面 */
    view(options) {
      this.host.engine.view(options.fov ?? 0, options.near ?? 0, options.far ?? 0);
    }
    /** 指数平方雾；density 为 0 或传 false 关闭。options 可加高度衰减与太阳散射 */
    fog(color, density = 0.03, options) {
      if (color === false) return this.host.engine.fog(0, 0, 0, 0);
      const [r, g, b] = parseColor(color);
      this.host.engine.fog(r, g, b, density);
      if (options) this._render("fog", { height: options.height, base: options.base, sun: options.sun });
    }
    /** 环境光：纯色，或 { sky, equator, ground } 三色；reflection 为环境反射强度（0 到 1） */
    ambient(color, reflection = 0.3) {
      if (typeof color === "object" && !Array.isArray(color)) {
        const [sr, sg, sb] = parseColor(color.sky);
        const [er, eg, eb] = parseColor(color.equator);
        const [gr, gg, gb] = parseColor(color.ground);
        return this.host.engine.ambientTrilight(sr, sg, sb, er, eg, eb, gr, gg, gb, reflection);
      }
      const [r, g, b] = parseColor(color);
      this.host.engine.ambient(r, g, b, reflection);
    }
    _render(kind, options) {
      const error = this.host.engine.render(kind, JSON.stringify(options));
      if (error) throw new Error(`scene.${kind}：${error}`);
    }
    /** 由像素创建贴图（随调用方插件卸载销毁） */
    texture(options) {
      const engine = this.host.engine;
      const { width, height, data } = options;
      if (data.length < width * height * 4) throw new Error(`scene.texture：数据长度 ${data.length} 小于 ${width}x${height}x4`);
      const wrap = options.wrap === "clamp" ? 1 : 0;
      const filter = options.filter === "point" ? 0 : options.filter === "bilinear" ? 1 : 2;
      let id = 0;
      const dispose = this.ctx.effect(() => {
        const view = data instanceof Uint8Array ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        const buffer = view.byteOffset === 0 && view.byteLength === view.buffer.byteLength ? view.buffer : view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
        id = engine.texture(buffer, width, height, !!options.linear, options.mipmaps !== false, wrap, filter, options.aniso ?? 8);
        return () => engine.destroyTexture(id);
      }, "scene.texture");
      return new Texture(id, width, height, dispose);
    }
    /** Canvas 2D 画布（软件光栅化，文字由宿主栅格化）；canvas.texture() 转贴图，随调用方插件卸载销毁 */
    canvas(width, height) {
      const canvas = new Canvas(width, height, this.host);
      canvas.upload = (data, w, h, o) => this.texture({ ...o, data, width: w, height: h });
      return canvas;
    }
    /** 文字转贴图（系统中文字体），可贴在任意材质上（例如集装箱喷字、路牌） */
    text(options) {
      const engine = this.host.engine;
      const width = options.width ?? 256;
      const height = options.height ?? 64;
      const json2 = JSON.stringify({
        text: options.text,
        width,
        height,
        size: options.size ?? Math.round(height * 0.7),
        color: rgb(options.color ?? [1, 1, 1]),
        background: rgb(options.background ?? [0, 0, 0, 0]),
        align: options.align === "left" ? 0 : options.align === "right" ? 2 : 1,
        bold: options.bold ? 1 : 0,
        letterSpacing: options.letterSpacing ?? 0
      });
      let id = 0;
      const dispose = this.ctx.effect(() => {
        id = engine.textTexture(json2);
        return () => engine.destroyTexture(id);
      }, `scene.text(${options.text})`);
      return new Texture(id, width, height, dispose);
    }
    /**
     * 注册网格，之后用 spawn({ shape: 'mesh:名字' }) 创建（自带网格碰撞体）。同名覆盖。
     * 大网格给 options.key 并把 data 写成函数：热重载时内容没变就直接复用 Runner 里已有的网格。
     * 带 boneIndices 的网格用 spawn({ shape: 'mesh:名字', bones }) 建成蒙皮网格。返回顶点数
     */
    mesh(name, data, options = {}) {
      const engine = this.host.engine;
      let key = typeof options.key === "string" ? options.key : "";
      if (key) {
        const cached = engine.meshCached(name, key);
        if (cached >= 0) return cached;
      }
      const d = typeof data === "function" ? data() : data;
      const f = (v) => v ? bytesOf(v, Float32Array) : null;
      const positions = f(d.positions);
      const normals = f(d.normals);
      const uvs = f(d.uvs);
      const colors = f(d.colors);
      const indices = bytesOf(d.indices, Uint32Array);
      const boneIndices = d.boneIndices ? bytesOf(d.boneIndices, Int32Array) : null;
      const boneWeights = f(d.boneWeights);
      const bindPoses = f(d.bindPoses);
      const tangents = f(d.tangents);
      if (!boneIndices && (boneWeights || bindPoses)) throw new Error(`scene.mesh(${name})：boneWeights、bindPoses 需要和 boneIndices 一起给`);
      if (tangents && tangents.byteLength !== positions.byteLength / 3 * 4) throw new Error(`scene.mesh(${name})：tangents 须为每顶点 4 个数（xyzw），共 ${positions.byteLength / 12 * 4} 个`);
      const vcount = positions.byteLength / 12;
      const attributes = meshAttributes(name, d.attributes, vcount);
      if (attributes.length && boneIndices) throw new Error(`scene.mesh(${name})：自定义顶点属性不能与蒙皮同时使用`);
      if (d.colorSpace !== void 0 && d.colorSpace !== "srgb" && d.colorSpace !== "linear") throw new Error(`scene.mesh(${name})：colorSpace 只能是 srgb 或 linear`);
      const linearColors = !!colors && d.colorSpace === "linear";
      if (options.key === true) {
        key = contentKey([positions, normals, uvs, colors, indices, boneIndices, boneWeights, bindPoses, tangents, ...attributeKeyParts(attributes), ...linearColors ? [new Uint32Array([4999502]).buffer] : []]);
        const cached = engine.meshCached(name, key);
        if (cached >= 0) return cached;
      }
      const count = engine.mesh(name, positions, normals, uvs, linearColors ? null : colors, indices, key);
      if (linearColors) {
        const error = engine.meshColors(name, colors, true);
        if (error) throw new Error(`scene.mesh(${name})：${error}`);
      }
      if (tangents) {
        const error = engine.meshTangents(name, tangents);
        if (error) throw new Error(`scene.mesh(${name})：${error}`);
      }
      attributes.forEach((a, i) => {
        const error = engine.meshAttribute(name, i + 1, a.name, a.size, a.data);
        if (error) throw new Error(`scene.mesh(${name})：${error}`);
      });
      if (boneIndices) {
        const error = engine.meshSkin(name, boneIndices, boneWeights, bindPoses);
        if (error) throw new Error(`scene.mesh(${name})：${error}`);
      }
      return count;
    }
    /** 后处理（色调映射、曝光、调色、泛光、暗角、颗粒、色差、SSAO、抗锯齿）；只改传入的字段 */
    post(options) {
      const tonemap = options.tonemap === void 0 ? void 0 : options.tonemap === "none" ? 0 : options.tonemap === "neutral" ? 1 : 2;
      const antialias = options.antialias === void 0 ? void 0 : options.antialias === "none" ? 0 : options.antialias === "fxaa" ? 1 : 2;
      this._render("post", {
        ...options,
        enabled: bool(options.enabled),
        tonemap,
        antialias,
        filter: rgb(options.filter),
        bloomTint: rgb(options.bloomTint),
        vignetteColor: rgb(options.vignetteColor)
      });
    }
    /** 程序化天空盒（渐变、日轮光晕、云、地平线雾），太阳方向跟随主方向光；同时捕捉环境反射 */
    sky(options) {
      this._render("sky", {
        ...options,
        zenith: rgb(options.zenith),
        horizon: rgb(options.horizon),
        horizonAway: rgb(options.horizonAway),
        ground: rgb(options.ground),
        sun: rgb(options.sun, options.sunIntensity ?? 1),
        cloudColor: rgb(options.cloudColor),
        reflection: bool(options.reflection),
        ambient: bool(options.ambient),
        sunIntensity: void 0
      });
    }
    /** 天气：全局湿润、积水、雨丝与波纹 */
    weather(options) {
      this._render("weather", { ...options, rainColor: rgb(options.rainColor) });
    }
    /** 平面反射（湿地面、积水、水面）。材质需设置 planar */
    reflection(options) {
      const exclude = options.exclude?.reduce((m, l) => m | 1 << l, 0);
      this._render("reflection", { ...options, enabled: bool(options.enabled), shadows: bool(options.shadows), exclude });
    }
    /** 画质参数（渲染缩放、阴影距离/分辨率/级联、MSAA、HDR） */
    quality(options) {
      this._render("quality", { ...options, hdr: bool(options.hdr), cascades: options.shadowCascades, shadowCascades: void 0 });
    }
    /** 太阳或天空改变后重新捕捉环境反射 */
    refreshEnvironment() {
      this._render("refresh", {});
    }
    /** 粒子迸发（枪口火花、弹着点火星、烟尘）。不需要销毁，生命周期结束自动消失 */
    burst(options) {
      this.host.engine.burst(JSON.stringify({
        kind: options.kind ?? "spark",
        pos: options.position,
        dir: options.direction,
        color: rgb(options.color ?? [1, 0.8, 0.5], options.intensity ?? 1),
        count: options.count,
        speed: options.speed,
        speedJitter: options.speedJitter,
        spread: options.spread,
        size: options.size,
        sizeJitter: options.sizeJitter,
        life: options.life,
        lifeJitter: options.lifeJitter
      }));
    }
    /**
     * 球体扫掠（粗射线）：半径 radius 的球沿 direction 移动，返回第一个碰到的碰撞体。
     * 适合子弹、视线这类细射线容易从缝里漏过去的场合。起点已与碰撞体重叠时不算命中。direction 不必归一化
     */
    sphereCast(origin, direction, radius, options = {}) {
      if (!(radius > 0)) throw new Error(`sphereCast：radius 须大于 0，给了 ${radius}`);
      const hit = this.host.engine.sphereCast(origin[0], origin[1], origin[2], direction[0], direction[1], direction[2], radius, options.maxDistance ?? 0, options.mask ?? 0);
      return hit ? { ...hit, entity: hit.id > 0 ? new Entity(this, hit.id) : void 0 } : null;
    }
    /** 射线检测（命中图元自带的碰撞体，以及 options.planes 中的无限平面）。direction 不必归一化 */
    raycast(origin, direction, options = {}) {
      const hit = this.host.engine.raycast(origin[0], origin[1], origin[2], direction[0], direction[1], direction[2], options.maxDistance ?? 0, options.mask ?? 0);
      let best = hit ? { ...hit, entity: hit.id > 0 ? new Entity(this, hit.id) : void 0 } : null;
      const planes = options.planes;
      if (!planes?.length) return best;
      const len = Math.hypot(direction[0], direction[1], direction[2]);
      if (!(len > 0)) return best;
      const d = [direction[0] / len, direction[1] / len, direction[2] / len];
      const max = options.maxDistance && options.maxDistance > 0 ? options.maxDistance : Infinity;
      for (let i = 0; i < planes.length; i++) {
        const t = rayPlane(origin, d, planes[i]);
        if (t === void 0 || t > max || best && best.distance <= t) continue;
        const pl = planes[i];
        const nl = pl.normal ? Math.hypot(pl.normal[0], pl.normal[1], pl.normal[2]) || 1 : 1;
        let n2 = pl.normal ? [pl.normal[0] / nl, pl.normal[1] / nl, pl.normal[2] / nl] : [0, 1, 0];
        if (n2[0] * d[0] + n2[1] * d[1] + n2[2] * d[2] > 0) n2 = [-n2[0], -n2[1], -n2[2]];
        best = { id: -1, point: [origin[0] + d[0] * t, origin[1] + d[1] * t, origin[2] + d[2] * t], normal: n2, distance: t, plane: i, tag: pl.tag };
      }
      return best;
    }
    find(name) {
      for (const info of this.objects.values()) {
        if (info.name === name) return new Entity(this, info.id);
      }
    }
    list(unit) {
      const result = [...this.objects.values()];
      return unit ? result.filter((o) => o.unit === unit) : result;
    }
  };

  // runtime/src/ui.ts
  var RS = "";
  var FS = "";
  function fontFlags(o) {
    const opt = typeof o === "boolean" ? { bold: o } : o ?? {};
    let w = opt.weight === "bold" ? 700 : opt.weight === "normal" ? 400 : opt.weight ?? (opt.bold ? 700 : 400);
    if (!Number.isFinite(w)) throw new Error("ui：weight 须为 100 到 900 的数或 normal/bold");
    w = Math.min(9, Math.max(1, Math.round(w / 100)));
    return (w >= 6 ? 1 : 0) | (opt.mono ? 8 : 0) | (w === 4 || w === 7 ? 0 : w << 4);
  }
  var Flow = class {
    constructor(_x0, _y0, _o = {}) {
      __publicField(this, "_x0", _x0);
      __publicField(this, "_y0", _y0);
      __publicField(this, "_o", _o);
      /** 下一项的主轴起点（row 为 x，column 为 y）与交叉轴锚点 */
      __publicField(this, "x");
      __publicField(this, "y");
      __publicField(this, "width", 0);
      __publicField(this, "height", 0);
      __publicField(this, "_count", 0);
      this.x = _x0;
      this.y = _y0;
    }
    next(w, h) {
      const row = (this._o.dir ?? "row") === "row";
      const gap = this._o.gap ?? 0;
      const align = this._o.align ?? "start";
      const cross = row ? h : w;
      const off = align === "center" ? -cross / 2 : align === "end" ? -cross : 0;
      const r = row ? { x: this.x, y: this._y0 + off, w, h } : { x: this._x0 + off, y: this.y, w, h };
      if (row) {
        this.width = this.x + w - this._x0;
        this.height = Math.max(this.height, h);
        this.x += w + gap;
      } else {
        this.height = this.y + h - this._y0;
        this.width = Math.max(this.width, w);
        this.y += h + gap;
      }
      this._count++;
      return r;
    }
    /** 已排的项数 */
    get count() {
      return this._count;
    }
  };
  function layoutRects(sizes, box, options = {}) {
    const row = (options.dir ?? "row") === "row";
    const gap = options.gap ?? 0;
    const items = Array.from(sizes, (s) => Array.isArray(s) ? { w: s[0], h: s[1] } : { w: s.w, h: s.h });
    const mainBox = row ? box.w : box.h;
    const crossBox = row ? box.h : box.w;
    const mains = items.map((s) => row ? s.w : s.h);
    const total = mains.reduce((a, b) => a + b, 0);
    const justify = options.justify ?? "start";
    let space = gap;
    let start = 0;
    const used = total + gap * Math.max(0, items.length - 1);
    if (justify === "between" && items.length > 1) space = Math.max(gap, (mainBox - total) / (items.length - 1));
    else if (justify === "center") start = (mainBox - used) / 2;
    else if (justify === "end") start = mainBox - used;
    else if (justify === "between") start = (mainBox - used) / 2;
    const align = options.align ?? "start";
    const out = [];
    let at = start;
    for (let i = 0; i < items.length; i++) {
      const s = items[i];
      let cross = row ? s.h : s.w;
      let off = 0;
      if (align === "stretch") cross = crossBox;
      else if (align === "center") off = (crossBox - cross) / 2;
      else if (align === "end") off = crossBox - cross;
      out.push(row ? { x: box.x + at, y: box.y + off, w: s.w, h: cross } : { x: box.x + off, y: box.y + at, w: cross, h: s.h });
      at += mains[i] + space;
    }
    return out;
  }
  var n = (v) => String(Math.round(v * 10) / 10);
  var UIService = class extends Service {
    constructor(ctx, _host) {
      super(ctx, "ui");
      __publicField(this, "_host", _host);
      __publicField(this, "_list", []);
      __publicField(this, "_colors", /* @__PURE__ */ new Map());
      __publicField(this, "_submittedEmpty", true);
      __publicField(this, "_charWidths", /* @__PURE__ */ new Map());
      __publicField(this, "_lineHeights", /* @__PURE__ */ new Map());
    }
    /** 屏幕宽（像素） */
    get width() {
      return this._host.engine.screen()[0];
    }
    /** 屏幕高（像素） */
    get height() {
      return this._host.engine.screen()[1];
    }
    /** 颜色转 rrggbbaa，alpha 为倍数 */
    hex(color, alpha = 1) {
      let base;
      if (typeof color === "string") {
        base = this._colors.get(color);
        if (base === void 0) {
          const [r2, g2, b2, a3] = parseColor(color);
          base = [r2, g2, b2, a3].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");
          if (this._colors.size > 1024) this._colors.clear();
          this._colors.set(color, base);
        }
        if (alpha >= 1) return base;
        const a2 = Math.round(parseInt(base.slice(6, 8), 16) * Math.max(0, alpha));
        return base.slice(0, 6) + a2.toString(16).padStart(2, "0");
      }
      const [r, g, b, a] = parseColor(color);
      return [r, g, b, a * Math.max(0, Math.min(1, alpha))].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");
    }
    rect(x, y, w, h, color, options = {}) {
      this._list.push(["r", n(x), n(y), n(w), n(h), this.hex(color, options.alpha), n(options.radius ?? 0)].join(FS));
    }
    border(x, y, w, h, color, thickness = 1, options = {}) {
      this._list.push(["b", n(x), n(y), n(w), n(h), this.hex(color, options.alpha), n(thickness), n(options.radius ?? 0)].join(FS));
    }
    /**
     * 线性渐变填充矩形（同 CSS linear-gradient，色标间按预乘 alpha 插值）。
     * 例：ui.gradient(0, 0, W, H, [['#06080ad1', 0], ['#06080a80', 0.38], ['#06080a00', 0.72]], { angle: 90 })
     */
    gradient(x, y, w, h, stops, options = {}) {
      if (!Array.isArray(stops) || stops.length === 0) throw new Error("ui.gradient：stops 至少要有一个色标");
      const raw = options.angle ?? 180;
      if (!Number.isFinite(raw) || raw % 90 !== 0) throw new Error("ui.gradient：angle 只支持 0/90/180/270");
      const angle = (raw % 360 + 360) % 360;
      const list = stops.map((s) => {
        const pair = Array.isArray(s) && s.length === 2 && typeof s[1] === "number" && (typeof s[0] === "string" || Array.isArray(s[0]));
        const color = pair ? s[0] : s;
        const pos = pair ? s[1] : void 0;
        if (pos !== void 0 && !Number.isFinite(pos)) throw new Error("ui.gradient：色标位置须为有限数");
        return { hex: this.hex(color, options.alpha), pos };
      });
      if (list[0].pos === void 0) list[0].pos = 0;
      if (list.length > 1 && list[list.length - 1].pos === void 0) list[list.length - 1].pos = 1;
      let max = -Infinity;
      for (const s of list) if (s.pos !== void 0) {
        s.pos = Math.max(s.pos, max);
        max = s.pos;
      }
      for (let i = 1; i < list.length; i++) {
        if (list[i].pos !== void 0) continue;
        let j = i;
        while (list[j].pos === void 0) j++;
        const a = list[i - 1].pos, b = list[j].pos;
        for (let k = i; k < j; k++) list[k].pos = a + (b - a) * (k - i + 1) / (j - i + 1);
      }
      const vertical = angle === 0 || angle === 180;
      const flip = angle === 0 || angle === 270;
      const out = (flip ? list.slice().reverse().map((s) => ({ hex: s.hex, pos: 1 - s.pos })) : list).map((s) => `${s.hex}@${Math.round(s.pos * 1e4) / 1e4}`);
      this._list.push(["g", n(x), n(y), n(w), n(h), n(options.radius ?? 0), vertical ? "1" : "0", out.join(";")].join(FS));
    }
    line(x1, y1, x2, y2, color, width = 1, alpha = 1) {
      this._list.push(["l", n(x1), n(y1), n(x2), n(y2), this.hex(color, alpha), n(width)].join(FS));
    }
    /** 圆弧：角度制，0 度朝上，顺时针；sweep 360 为整圆 */
    arc(cx, cy, radius, color, thickness = 2, start = 0, sweep = 360, alpha = 1) {
      this._list.push(["a", n(cx), n(cy), n(radius), this.hex(color, alpha), n(thickness), n(start), n(sweep)].join(FS));
    }
    text(text, x, y, options = {}) {
      const size = Math.round(options.size ?? 16);
      if (options.spacing) return this._spacedText(String(text), x, y, size, options);
      const h = options.align === "right" ? 2 : options.align === "center" ? 1 : 0;
      const v = options.valign === "bottom" ? 2 : options.valign === "middle" ? 1 : 0;
      const flags = fontFlags(options) | (options.shadow ? 2 : 0) | (options.wrap ? 4 : 0);
      const w = options.w ?? 0;
      const hh = options.h ?? 0;
      const s = String(text).split(RS).join("").split(FS).join("");
      this._list.push(["t", n(x), n(y), n(w), n(hh), this.hex(options.color ?? "#ffffff", options.alpha), String(size), String(v * 3 + h), String(flags), s].join(FS));
    }
    /**
     * 文字尺寸（像素）。第三个参数为是否粗体，或字体选项 { bold, weight, mono }。
     * spacing（em）不为 0 时按逐字宽度加字距计算，宽度含末尾字距（同 CSS）
     */
    measure(text, size = 16, font = false, spacing = 0) {
      const ff = fontFlags(font);
      if (spacing) {
        const lines = String(text).split("\n");
        const width2 = Math.max(...lines.map((l) => this._spacedWidth(l, Math.round(size), ff, spacing * Math.round(size))));
        return { width: width2, height: this._lineHeight(Math.round(size), ff) * lines.length };
      }
      const [width, height] = this._host.engine.uiMeasure(text, size, ff);
      return { width, height };
    }
    _charWidth(ch, size, ff) {
      const key = `${size}|${ff}|${ch}`;
      let w = this._charWidths.get(key);
      if (w === void 0) {
        w = ch === " " ? size * 0.3 : this._host.engine.uiMeasure(ch, size, ff)[0];
        if (this._charWidths.size > 4096) this._charWidths.clear();
        this._charWidths.set(key, w);
      }
      return w;
    }
    _lineHeight(size, ff) {
      const key = `${size}|${ff}`;
      let h = this._lineHeights.get(key);
      if (h === void 0) {
        h = this._host.engine.uiMeasure("国Mg", size, ff)[1];
        this._lineHeights.set(key, h);
      }
      return h;
    }
    _spacedWidth(line, size, ff, sp) {
      let w = 0;
      for (const ch of line) w += this._charWidth(ch, size, ff) + sp;
      return w;
    }
    /** 带字距：按字切行（wrap 时在 w 内按字断行，英文优先在空格处断）、按 align/valign 定位后逐字提交 */
    _spacedText(text, x, y, size, o) {
      const ff = fontFlags(o);
      const sp = (o.spacing ?? 0) * size;
      const maxW = o.w ?? 0;
      const lines = [];
      for (const para of text.split("\n")) {
        if (!o.wrap || !maxW) {
          lines.push(para);
          continue;
        }
        let line = "", lw = 0, lastSpace = -1;
        for (const ch of para) {
          const cw = this._charWidth(ch, size, ff) + sp;
          if (lw + cw > maxW && line) {
            if (ch !== " " && lastSpace > 0) {
              lines.push(line.slice(0, lastSpace));
              line = line.slice(lastSpace + 1);
              lw = this._spacedWidth(line, size, ff, sp);
            } else {
              lines.push(line);
              line = "";
              lw = 0;
            }
            lastSpace = -1;
            if (ch === " ") continue;
          }
          if (ch === " ") lastSpace = line.length;
          line += ch;
          lw += cw;
        }
        lines.push(line);
      }
      const lh = this._lineHeight(size, ff);
      const total = lh * lines.length;
      const boxH = o.h ?? 0;
      let top = y;
      if (o.valign === "middle") top = boxH ? y + (boxH - total) / 2 : y - total / 2;
      else if (o.valign === "bottom") top = boxH ? y + boxH - total : y - total;
      const color = this.hex(o.color ?? "#ffffff", o.alpha);
      const flags = ff | (o.shadow ? 2 : 0);
      const single = lines.length === 1 && !boxH;
      const vcode = single ? o.valign === "bottom" ? 2 : o.valign === "middle" ? 1 : 0 : 1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lw = this._spacedWidth(line, size, ff, sp);
        let cx = x;
        if (o.align === "center") cx = maxW ? x + (maxW - lw) / 2 : x - lw / 2;
        else if (o.align === "right") cx = maxW ? x + maxW - lw : x - lw;
        if (o.align === "center") cx += sp / 2;
        else if (o.align === "right") cx += sp;
        const cy = single ? y : top + lh * i + lh / 2;
        for (const ch of line) {
          if (ch !== " ") this._list.push(["t", n(cx), n(cy), "0", "0", color, String(size), String(vcode * 3), String(flags), ch.split(RS).join("").split(FS).join("")].join(FS));
          cx += this._charWidth(ch, size, ff) + sp;
        }
      }
    }
    /** 压入裁剪矩形：之后的绘制只在矩形内可见，可嵌套（取交集），与 unclip 成对使用 */
    clip(x, y, w, h) {
      this._list.push(["c", n(x), n(y), n(Math.max(0, w)), n(Math.max(0, h))].join(FS));
    }
    /** 弹出最近一次 clip */
    unclip() {
      this._list.push(["C", ""].join(FS));
    }
    /** 画贴图：tex 为 Texture（或贴图 id）；tint 为染色，uv 为 [u, v, w, h]（缺省整张） */
    image(tex, x, y, w, h, options = {}) {
      const id = typeof tex === "number" ? tex : tex?.id;
      if (!Number.isFinite(id)) throw new Error("ui.image：需要贴图（Texture）");
      const uv = options.uv ? options.uv.map((v) => String(Math.round(v * 1e4) / 1e4)).join(",") : "";
      this._list.push(["i", n(x), n(y), n(w), n(h), String(id), this.hex(options.tint ?? "#ffffff", options.alpha), n(options.radius ?? 0), uv].join(FS));
    }
    /** 鼠标是否在矩形内 */
    hit(x, y, w, h) {
      const [mx, my] = this._host.engine.mouse();
      return mx >= x && mx <= x + w && my >= y && my <= y + h;
    }
    /** 增量行/列排布（各项尺寸边画边知道时用）：const f = ui.flow(x, y, { gap: 10 }); const r = f.next(w, h) */
    flow(x, y, options = {}) {
      return new Flow(x, y, options);
    }
    /** 已知各项尺寸时在容器内排布：返回每项矩形（justify 主轴分布、align 交叉轴对齐） */
    layout(sizes, box, options = {}) {
      return layoutRects(sizes, box, options);
    }
    /** 运行时在每个游戏帧末调用 */
    flush() {
      if (!this._list.length) {
        if (this._submittedEmpty) return;
        this._submittedEmpty = true;
        this._host.engine.uiSubmit("");
        return;
      }
      this._submittedEmpty = false;
      this._host.engine.uiSubmit(this._list.join(RS));
      this._list = [];
    }
  };

  // runtime/src/audio.ts
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function encodePcm16(samples) {
    const bytes = new Uint8Array(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
      let v = Math.round(Math.max(-1, Math.min(1, samples[i] || 0)) * 32767);
      if (v < 0) v += 65536;
      bytes[i * 2] = v & 255;
      bytes[i * 2 + 1] = v >> 8;
    }
    const out = [];
    let chunk = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
      const triple = a << 16 | (b ?? 0) << 8 | (c ?? 0);
      chunk += B64[triple >> 18 & 63] + B64[triple >> 12 & 63] + (i + 1 < bytes.length ? B64[triple >> 6 & 63] : "=") + (i + 2 < bytes.length ? B64[triple & 63] : "=");
      if (chunk.length >= 4096) {
        out.push(chunk);
        chunk = "";
      }
    }
    out.push(chunk);
    return out.join("");
  }
  var AudioService = class extends Service {
    constructor(ctx, _host) {
      super(ctx, "audio");
      __publicField(this, "_host", _host);
    }
    /** 注册（或替换）片段；rate 为采样率，默认 22050 */
    clip(name, samples, rate = 22050) {
      return this._host.engine.audioClip(name, rate, 1, encodePcm16(samples));
    }
    /** 片段是否已注册（热重载后可以跳过重新合成） */
    has(name) {
      return this._host.engine.audioHas(name);
    }
    play(name, options = {}) {
      const p = options.position;
      this._host.engine.audioPlay(name, options.volume ?? 1, options.pitch ?? 1, p?.[0] ?? 0, p?.[1] ?? 0, p?.[2] ?? 0, !!p);
    }
    /** 循环播放，随调用方单元卸载自动停止 */
    loop(name, options = {}) {
      const engine = this._host.engine;
      let id = 0;
      const dispose = this.ctx.effect(() => {
        id = engine.audioLoop(name, options.volume ?? 1, options.pitch ?? 1);
        return () => {
          if (id) engine.audioStop(id);
          id = 0;
        };
      }, `audio.loop(${name})`);
      const handle = {
        get id() {
          return id;
        },
        set(o) {
          if (!id) return;
          const p = o.position;
          engine.audioSetLoop(id, o.volume ?? -1, o.pitch ?? 0, p?.[0] ?? 0, p?.[1] ?? 0, p?.[2] ?? 0, !!p);
        },
        stop() {
          dispose();
        }
      };
      if (options.position) handle.set({ position: options.position });
      return handle;
    }
    /** 主音量 0 到 1 */
    volume(value) {
      this._host.engine.audioVolume(value);
    }
    /** 暂停/恢复全部声音 */
    pause(paused) {
      this._host.engine.audioPause(paused);
    }
  };

  // runtime/src/three-chunks.ts
  var THREE_CHUNKS = {
    "alphahash_fragment": "#ifdef USE_ALPHAHASH\n\n	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;\n\n#endif\n",
    "alphahash_pars_fragment": "#ifdef USE_ALPHAHASH\n\n	/**\n	 * See: https://casual-effects.com/research/Wyman2017Hashed/index.html\n	 */\n\n	const float ALPHA_HASH_SCALE = 0.05; // Derived from trials only, and may be changed.\n\n	float hash2D( vec2 value ) {\n\n		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );\n\n	}\n\n	float hash3D( vec3 value ) {\n\n		return hash2D( vec2( hash2D( value.xy ), value.z ) );\n\n	}\n\n	float getAlphaHashThreshold( vec3 position ) {\n\n		// Find the discretized derivatives of our coordinates\n		float maxDeriv = max(\n			length( dFdx( position.xyz ) ),\n			length( dFdy( position.xyz ) )\n		);\n		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );\n\n		// Find two nearest log-discretized noise scales\n		vec2 pixScales = vec2(\n			exp2( floor( log2( pixScale ) ) ),\n			exp2( ceil( log2( pixScale ) ) )\n		);\n\n		// Compute alpha thresholds at our two noise scales\n		vec2 alpha = vec2(\n			hash3D( floor( pixScales.x * position.xyz ) ),\n			hash3D( floor( pixScales.y * position.xyz ) )\n		);\n\n		// Factor to interpolate lerp with\n		float lerpFactor = fract( log2( pixScale ) );\n\n		// Interpolate alpha threshold from noise at two scales\n		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;\n\n		// Pass into CDF to compute uniformly distrib threshold\n		float a = min( lerpFactor, 1.0 - lerpFactor );\n		vec3 cases = vec3(\n			x * x / ( 2.0 * a * ( 1.0 - a ) ),\n			( x - 0.5 * a ) / ( 1.0 - a ),\n			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )\n		);\n\n		// Find our final, uniformly distributed alpha threshold (ατ)\n		float threshold = ( x < ( 1.0 - a ) )\n			? ( ( x < a ) ? cases.x : cases.y )\n			: cases.z;\n\n		// Avoids ατ == 0. Could also do ατ =1-ατ\n		return clamp( threshold , 1.0e-6, 1.0 );\n\n	}\n\n#endif\n",
    "alphamap_fragment": "#ifdef USE_ALPHAMAP\n\n	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;\n\n#endif\n",
    "alphamap_pars_fragment": "#ifdef USE_ALPHAMAP\n\n	uniform sampler2D alphaMap;\n\n#endif\n",
    "alphatest_fragment": "#ifdef USE_ALPHATEST\n\n	#ifdef ALPHA_TO_COVERAGE\n\n	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );\n	if ( diffuseColor.a == 0.0 ) discard;\n\n	#else\n\n	if ( diffuseColor.a < alphaTest ) discard;\n\n	#endif\n\n#endif\n",
    "alphatest_pars_fragment": "#ifdef USE_ALPHATEST\n	uniform float alphaTest;\n#endif\n",
    "aomap_fragment": "#ifdef USE_AOMAP\n\n	// reads channel R, compatible with a combined OcclusionRoughnessMetallic (RGB) texture\n	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;\n\n	reflectedLight.indirectDiffuse *= ambientOcclusion;\n\n	#if defined( USE_CLEARCOAT )\n		clearcoatSpecularIndirect *= ambientOcclusion;\n	#endif\n\n	#if defined( USE_SHEEN )\n		sheenSpecularIndirect *= ambientOcclusion;\n	#endif\n\n	#if defined( USE_ENVMAP ) && defined( STANDARD )\n\n		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );\n\n		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );\n\n	#endif\n\n#endif\n",
    "aomap_pars_fragment": "#ifdef USE_AOMAP\n\n	uniform sampler2D aoMap;\n	uniform float aoMapIntensity;\n\n#endif\n",
    "batching_pars_vertex": "#ifdef USE_BATCHING\n	#if ! defined( GL_ANGLE_multi_draw )\n	#define gl_DrawID _gl_DrawID\n	uniform int _gl_DrawID;\n	#endif\n\n	uniform highp sampler2D batchingTexture;\n	uniform highp usampler2D batchingIdTexture;\n	mat4 getBatchingMatrix( const in float i ) {\n\n		int size = textureSize( batchingTexture, 0 ).x;\n		int j = int( i ) * 4;\n		int x = j % size;\n		int y = j / size;\n		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );\n		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );\n		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );\n		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );\n		return mat4( v1, v2, v3, v4 );\n\n	}\n\n	float getIndirectIndex( const in int i ) {\n\n		int size = textureSize( batchingIdTexture, 0 ).x;\n		int x = i % size;\n		int y = i / size;\n		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );\n\n	}\n\n#endif\n\n#ifdef USE_BATCHING_COLOR\n\n	uniform sampler2D batchingColorTexture;\n	vec3 getBatchingColor( const in float i ) {\n\n		int size = textureSize( batchingColorTexture, 0 ).x;\n		int j = int( i );\n		int x = j % size;\n		int y = j / size;\n		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;\n\n	}\n\n#endif\n",
    "batching_vertex": "#ifdef USE_BATCHING\n	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );\n#endif\n",
    "begin_vertex": "vec3 transformed = vec3( position );\n\n#ifdef USE_ALPHAHASH\n\n	vPosition = vec3( position );\n\n#endif\n",
    "beginnormal_vertex": "vec3 objectNormal = vec3( normal );\n\n#ifdef USE_TANGENT\n\n	vec3 objectTangent = vec3( tangent.xyz );\n\n#endif\n",
    "bsdfs": "float G_BlinnPhong_Implicit( /* const in float dotNL, const in float dotNV */ ) {\n\n	// geometry term is (n dot l)(n dot v) / 4(n dot l)(n dot v)\n	return 0.25;\n\n}\n\nfloat D_BlinnPhong( const in float shininess, const in float dotNH ) {\n\n	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );\n\n}\n\nvec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {\n\n	vec3 halfDir = normalize( lightDir + viewDir );\n\n	float dotNH = saturate( dot( normal, halfDir ) );\n	float dotVH = saturate( dot( viewDir, halfDir ) );\n\n	vec3 F = F_Schlick( specularColor, 1.0, dotVH );\n\n	float G = G_BlinnPhong_Implicit( /* dotNL, dotNV */ );\n\n	float D = D_BlinnPhong( shininess, dotNH );\n\n	return F * ( G * D );\n\n} // validated\n",
    "bumpmap_pars_fragment": "#ifdef USE_BUMPMAP\n\n	uniform sampler2D bumpMap;\n	uniform float bumpScale;\n\n	// Bump Mapping Unparametrized Surfaces on the GPU by Morten S. Mikkelsen\n	// https://mmikk.github.io/papers3d/mm_sfgrad_bump.pdf\n\n	// Evaluate the derivative of the height w.r.t. screen-space using forward differencing (listing 2)\n\n	vec2 dHdxy_fwd() {\n\n		vec2 dSTdx = dFdx( vBumpMapUv );\n		vec2 dSTdy = dFdy( vBumpMapUv );\n\n		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;\n		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;\n		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;\n\n		return vec2( dBx, dBy );\n\n	}\n\n	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {\n\n		// normalize is done to ensure that the bump map looks the same regardless of the texture's scale\n		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );\n		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );\n		vec3 vN = surf_norm; // normalized\n\n		vec3 R1 = cross( vSigmaY, vN );\n		vec3 R2 = cross( vN, vSigmaX );\n\n		float fDet = dot( vSigmaX, R1 ) * faceDirection;\n\n		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );\n		return normalize( abs( fDet ) * surf_norm - vGrad );\n\n	}\n\n#endif\n",
    "clearcoat_normal_fragment_begin": "#ifdef USE_CLEARCOAT\n\n	vec3 clearcoatNormal = nonPerturbedNormal;\n\n#endif\n",
    "clearcoat_normal_fragment_maps": "#ifdef USE_CLEARCOAT_NORMALMAP\n\n	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;\n	clearcoatMapN.xy *= clearcoatNormalScale;\n\n	clearcoatNormal = normalize( tbn2 * clearcoatMapN );\n\n#endif\n",
    "clearcoat_pars_fragment": "#ifdef USE_CLEARCOATMAP\n\n	uniform sampler2D clearcoatMap;\n\n#endif\n\n#ifdef USE_CLEARCOAT_NORMALMAP\n\n	uniform sampler2D clearcoatNormalMap;\n	uniform vec2 clearcoatNormalScale;\n\n#endif\n\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n\n	uniform sampler2D clearcoatRoughnessMap;\n\n#endif\n",
    "clipping_planes_fragment": "#if NUM_CLIPPING_PLANES > 0\n\n	vec4 plane;\n\n	#ifdef ALPHA_TO_COVERAGE\n\n		float distanceToPlane, distanceGradient;\n		float clipOpacity = 1.0;\n\n		#pragma unroll_loop_start\n		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {\n\n			plane = clippingPlanes[ i ];\n			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;\n			distanceGradient = fwidth( distanceToPlane ) / 2.0;\n			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );\n\n			if ( clipOpacity == 0.0 ) discard;\n\n		}\n		#pragma unroll_loop_end\n\n		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES\n\n			float unionClipOpacity = 1.0;\n\n			#pragma unroll_loop_start\n			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {\n\n				plane = clippingPlanes[ i ];\n				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;\n				distanceGradient = fwidth( distanceToPlane ) / 2.0;\n				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );\n\n			}\n			#pragma unroll_loop_end\n\n			clipOpacity *= 1.0 - unionClipOpacity;\n\n		#endif\n\n		diffuseColor.a *= clipOpacity;\n\n		if ( diffuseColor.a == 0.0 ) discard;\n\n	#else\n\n		#pragma unroll_loop_start\n		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {\n\n			plane = clippingPlanes[ i ];\n			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;\n\n		}\n		#pragma unroll_loop_end\n\n		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES\n\n			bool clipped = true;\n\n			#pragma unroll_loop_start\n			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {\n\n				plane = clippingPlanes[ i ];\n				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;\n\n			}\n			#pragma unroll_loop_end\n\n			if ( clipped ) discard;\n\n		#endif\n\n	#endif\n\n#endif\n",
    "clipping_planes_pars_fragment": "#if NUM_CLIPPING_PLANES > 0\n\n	varying vec3 vClipPosition;\n\n	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];\n\n#endif\n",
    "clipping_planes_pars_vertex": "#if NUM_CLIPPING_PLANES > 0\n\n	varying vec3 vClipPosition;\n\n#endif\n",
    "clipping_planes_vertex": "#if NUM_CLIPPING_PLANES > 0\n\n	vClipPosition = - mvPosition.xyz;\n\n#endif\n",
    "color_fragment": "#if defined( USE_COLOR_ALPHA )\n\n	diffuseColor *= vColor;\n\n#elif defined( USE_COLOR )\n\n	diffuseColor.rgb *= vColor;\n\n#endif\n",
    "color_pars_fragment": "#if defined( USE_COLOR_ALPHA )\n\n	varying vec4 vColor;\n\n#elif defined( USE_COLOR )\n\n	varying vec3 vColor;\n\n#endif\n",
    "color_pars_vertex": "#if defined( USE_COLOR_ALPHA )\n\n	varying vec4 vColor;\n\n#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )\n\n	varying vec3 vColor;\n\n#endif\n",
    "color_vertex": "#if defined( USE_COLOR_ALPHA )\n\n	vColor = vec4( 1.0 );\n\n#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )\n\n	vColor = vec3( 1.0 );\n\n#endif\n\n#ifdef USE_COLOR\n\n	vColor *= color;\n\n#endif\n\n#ifdef USE_INSTANCING_COLOR\n\n	vColor.xyz *= instanceColor.xyz;\n\n#endif\n\n#ifdef USE_BATCHING_COLOR\n\n	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );\n\n	vColor.xyz *= batchingColor.xyz;\n\n#endif\n",
    "colorspace_fragment": "gl_FragColor = linearToOutputTexel( gl_FragColor );\n",
    "colorspace_pars_fragment": "vec4 LinearTransferOETF( in vec4 value ) {\n	return value;\n}\n\nvec4 sRGBTransferEOTF( in vec4 value ) {\n	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );\n}\n\nvec4 sRGBTransferOETF( in vec4 value ) {\n	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );\n}\n",
    "common": "#define PI 3.141592653589793\n#define PI2 6.283185307179586\n#define PI_HALF 1.5707963267948966\n#define RECIPROCAL_PI 0.3183098861837907\n#define RECIPROCAL_PI2 0.15915494309189535\n#define EPSILON 1e-6\n\n#ifndef saturate\n// <tonemapping_pars_fragment> may have defined saturate() already\n#define saturate( a ) clamp( a, 0.0, 1.0 )\n#endif\n#define whiteComplement( a ) ( 1.0 - saturate( a ) )\n\nfloat pow2( const in float x ) { return x*x; }\nvec3 pow2( const in vec3 x ) { return x*x; }\nfloat pow3( const in float x ) { return x*x*x; }\nfloat pow4( const in float x ) { float x2 = x*x; return x2*x2; }\nfloat max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }\nfloat average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }\n\n// expects values in the range of [0,1]x[0,1], returns values in the [0,1] range.\n// do not collapse into a single function per: http://byteblacksmith.com/improvements-to-the-canonical-one-liner-glsl-rand-for-opengl-es-2-0/\nhighp float rand( const in vec2 uv ) {\n\n	const highp float a = 12.9898, b = 78.233, c = 43758.5453;\n	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );\n\n	return fract( sin( sn ) * c );\n\n}\n\n#ifdef HIGH_PRECISION\n	float precisionSafeLength( vec3 v ) { return length( v ); }\n#else\n	float precisionSafeLength( vec3 v ) {\n		float maxComponent = max3( abs( v ) );\n		return length( v / maxComponent ) * maxComponent;\n	}\n#endif\n\nstruct IncidentLight {\n	vec3 color;\n	vec3 direction;\n	bool visible;\n};\n\nstruct ReflectedLight {\n	vec3 directDiffuse;\n	vec3 directSpecular;\n	vec3 indirectDiffuse;\n	vec3 indirectSpecular;\n};\n\n#ifdef USE_ALPHAHASH\n\n	varying vec3 vPosition;\n\n#endif\n\nvec3 transformDirection( in vec3 dir, in mat4 matrix ) {\n\n	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );\n\n}\n\nvec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {\n\n	// dir can be either a direction vector or a normal vector\n	// upper-left 3x3 of matrix is assumed to be orthogonal\n\n	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );\n\n}\n\nmat3 transposeMat3( const in mat3 m ) {\n\n	mat3 tmp;\n\n	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );\n	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );\n	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );\n\n	return tmp;\n\n}\n\nbool isPerspectiveMatrix( mat4 m ) {\n\n	return m[ 2 ][ 3 ] == - 1.0;\n\n}\n\nvec2 equirectUv( in vec3 dir ) {\n\n	// dir is assumed to be unit length\n\n	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;\n\n	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;\n\n	return vec2( u, v );\n\n}\n\nvec3 BRDF_Lambert( const in vec3 diffuseColor ) {\n\n	return RECIPROCAL_PI * diffuseColor;\n\n} // validated\n\nvec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {\n\n	// Original approximation by Christophe Schlick '94\n	// float fresnel = pow( 1.0 - dotVH, 5.0 );\n\n	// Optimized variant (presented by Epic at SIGGRAPH '13)\n	// https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf\n	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );\n\n	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );\n\n} // validated\n\nfloat F_Schlick( const in float f0, const in float f90, const in float dotVH ) {\n\n	// Original approximation by Christophe Schlick '94\n	// float fresnel = pow( 1.0 - dotVH, 5.0 );\n\n	// Optimized variant (presented by Epic at SIGGRAPH '13)\n	// https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf\n	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );\n\n	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );\n\n} // validated\n",
    "cube_uv_reflection_fragment": "#ifdef ENVMAP_TYPE_CUBE_UV\n\n	#define cubeUV_minMipLevel 4.0\n	#define cubeUV_minTileSize 16.0\n\n	// These shader functions convert between the UV coordinates of a single face of\n	// a cubemap, the 0-5 integer index of a cube face, and the direction vector for\n	// sampling a textureCube (not generally normalized ).\n\n	float getFace( vec3 direction ) {\n\n		vec3 absDirection = abs( direction );\n\n		float face = - 1.0;\n\n		if ( absDirection.x > absDirection.z ) {\n\n			if ( absDirection.x > absDirection.y )\n\n				face = direction.x > 0.0 ? 0.0 : 3.0;\n\n			else\n\n				face = direction.y > 0.0 ? 1.0 : 4.0;\n\n		} else {\n\n			if ( absDirection.z > absDirection.y )\n\n				face = direction.z > 0.0 ? 2.0 : 5.0;\n\n			else\n\n				face = direction.y > 0.0 ? 1.0 : 4.0;\n\n		}\n\n		return face;\n\n	}\n\n	// RH coordinate system; PMREM face-indexing convention\n	vec2 getUV( vec3 direction, float face ) {\n\n		vec2 uv;\n\n		if ( face == 0.0 ) {\n\n			uv = vec2( direction.z, direction.y ) / abs( direction.x ); // pos x\n\n		} else if ( face == 1.0 ) {\n\n			uv = vec2( - direction.x, - direction.z ) / abs( direction.y ); // pos y\n\n		} else if ( face == 2.0 ) {\n\n			uv = vec2( - direction.x, direction.y ) / abs( direction.z ); // pos z\n\n		} else if ( face == 3.0 ) {\n\n			uv = vec2( - direction.z, direction.y ) / abs( direction.x ); // neg x\n\n		} else if ( face == 4.0 ) {\n\n			uv = vec2( - direction.x, direction.z ) / abs( direction.y ); // neg y\n\n		} else {\n\n			uv = vec2( direction.x, direction.y ) / abs( direction.z ); // neg z\n\n		}\n\n		return 0.5 * ( uv + 1.0 );\n\n	}\n\n	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {\n\n		float face = getFace( direction );\n\n		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );\n\n		mipInt = max( mipInt, cubeUV_minMipLevel );\n\n		float faceSize = exp2( mipInt );\n\n		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0; // #25071\n\n		if ( face > 2.0 ) {\n\n			uv.y += faceSize;\n\n			face -= 3.0;\n\n		}\n\n		uv.x += face * faceSize;\n\n		uv.x += filterInt * 3.0 * cubeUV_minTileSize;\n\n		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );\n\n		uv.x *= CUBEUV_TEXEL_WIDTH;\n		uv.y *= CUBEUV_TEXEL_HEIGHT;\n\n		#ifdef texture2DGradEXT\n\n			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb; // disable anisotropic filtering\n\n		#else\n\n			return texture2D( envMap, uv ).rgb;\n\n		#endif\n\n	}\n\n	// These defines must match with PMREMGenerator\n\n	#define cubeUV_r0 1.0\n	#define cubeUV_m0 - 2.0\n	#define cubeUV_r1 0.8\n	#define cubeUV_m1 - 1.0\n	#define cubeUV_r4 0.4\n	#define cubeUV_m4 2.0\n	#define cubeUV_r5 0.305\n	#define cubeUV_m5 3.0\n	#define cubeUV_r6 0.21\n	#define cubeUV_m6 4.0\n\n	float roughnessToMip( float roughness ) {\n\n		float mip = 0.0;\n\n		if ( roughness >= cubeUV_r1 ) {\n\n			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;\n\n		} else if ( roughness >= cubeUV_r4 ) {\n\n			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;\n\n		} else if ( roughness >= cubeUV_r5 ) {\n\n			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;\n\n		} else if ( roughness >= cubeUV_r6 ) {\n\n			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;\n\n		} else {\n\n			mip = - 2.0 * log2( 1.16 * roughness ); // 1.16 = 1.79^0.25\n		}\n\n		return mip;\n\n	}\n\n	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {\n\n		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );\n\n		float mipF = fract( mip );\n\n		float mipInt = floor( mip );\n\n		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );\n\n		if ( mipF == 0.0 ) {\n\n			return vec4( color0, 1.0 );\n\n		} else {\n\n			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );\n\n			return vec4( mix( color0, color1, mipF ), 1.0 );\n\n		}\n\n	}\n\n#endif\n",
    "default_fragment": "void main() {\n	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );\n}\n",
    "default_vertex": "void main() {\n	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}\n",
    "defaultnormal_vertex": "vec3 transformedNormal = objectNormal;\n#ifdef USE_TANGENT\n\n	vec3 transformedTangent = objectTangent;\n\n#endif\n\n#ifdef USE_BATCHING\n\n	// this is in lieu of a per-instance normal-matrix\n	// shear transforms in the instance matrix are not supported\n\n	mat3 bm = mat3( batchingMatrix );\n	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );\n	transformedNormal = bm * transformedNormal;\n\n	#ifdef USE_TANGENT\n\n		transformedTangent = bm * transformedTangent;\n\n	#endif\n\n#endif\n\n#ifdef USE_INSTANCING\n\n	// this is in lieu of a per-instance normal-matrix\n	// shear transforms in the instance matrix are not supported\n\n	mat3 im = mat3( instanceMatrix );\n	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );\n	transformedNormal = im * transformedNormal;\n\n	#ifdef USE_TANGENT\n\n		transformedTangent = im * transformedTangent;\n\n	#endif\n\n#endif\n\ntransformedNormal = normalMatrix * transformedNormal;\n\n#ifdef FLIP_SIDED\n\n	transformedNormal = - transformedNormal;\n\n#endif\n\n#ifdef USE_TANGENT\n\n	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;\n\n	#ifdef FLIP_SIDED\n\n		transformedTangent = - transformedTangent;\n\n	#endif\n\n#endif\n",
    "displacementmap_pars_vertex": "#ifdef USE_DISPLACEMENTMAP\n\n	uniform sampler2D displacementMap;\n	uniform float displacementScale;\n	uniform float displacementBias;\n\n#endif\n",
    "displacementmap_vertex": "#ifdef USE_DISPLACEMENTMAP\n\n	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );\n\n#endif\n",
    "dithering_fragment": "#ifdef DITHERING\n\n	gl_FragColor.rgb = dithering( gl_FragColor.rgb );\n\n#endif\n",
    "dithering_pars_fragment": "#ifdef DITHERING\n\n	// based on https://www.shadertoy.com/view/MslGR8\n	vec3 dithering( vec3 color ) {\n		//Calculate grid position\n		float grid_position = rand( gl_FragCoord.xy );\n\n		//Shift the individual colors differently, thus making it even harder to see the dithering pattern\n		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );\n\n		//modify shift according to grid position.\n		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );\n\n		//shift the color by dither_shift\n		return color + dither_shift_RGB;\n	}\n\n#endif\n",
    "emissivemap_fragment": "#ifdef USE_EMISSIVEMAP\n\n	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );\n\n	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE\n\n		// use inline sRGB decode until browsers properly support SRGB8_ALPHA8 with video textures (#26516)\n\n		emissiveColor = sRGBTransferEOTF( emissiveColor );\n\n	#endif\n\n	totalEmissiveRadiance *= emissiveColor.rgb;\n\n#endif\n",
    "emissivemap_pars_fragment": "#ifdef USE_EMISSIVEMAP\n\n	uniform sampler2D emissiveMap;\n\n#endif\n",
    "envmap_common_pars_fragment": "#ifdef USE_ENVMAP\n\n	uniform float envMapIntensity;\n	uniform float flipEnvMap;\n	uniform mat3 envMapRotation;\n\n	#ifdef ENVMAP_TYPE_CUBE\n		uniform samplerCube envMap;\n	#else\n		uniform sampler2D envMap;\n	#endif\n\n#endif\n",
    "envmap_fragment": "#ifdef USE_ENVMAP\n\n	#ifdef ENV_WORLDPOS\n\n		vec3 cameraToFrag;\n\n		if ( isOrthographic ) {\n\n			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );\n\n		} else {\n\n			cameraToFrag = normalize( vWorldPosition - cameraPosition );\n\n		}\n\n		// Transforming Normal Vectors with the Inverse Transformation\n		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );\n\n		#ifdef ENVMAP_MODE_REFLECTION\n\n			vec3 reflectVec = reflect( cameraToFrag, worldNormal );\n\n		#else\n\n			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );\n\n		#endif\n\n	#else\n\n		vec3 reflectVec = vReflect;\n\n	#endif\n\n	#ifdef ENVMAP_TYPE_CUBE\n\n		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );\n\n	#else\n\n		vec4 envColor = vec4( 0.0 );\n\n	#endif\n\n	#ifdef ENVMAP_BLENDING_MULTIPLY\n\n		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );\n\n	#elif defined( ENVMAP_BLENDING_MIX )\n\n		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );\n\n	#elif defined( ENVMAP_BLENDING_ADD )\n\n		outgoingLight += envColor.xyz * specularStrength * reflectivity;\n\n	#endif\n\n#endif\n",
    "envmap_pars_fragment": "#ifdef USE_ENVMAP\n\n	uniform float reflectivity;\n\n	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )\n\n		#define ENV_WORLDPOS\n\n	#endif\n\n	#ifdef ENV_WORLDPOS\n\n		varying vec3 vWorldPosition;\n		uniform float refractionRatio;\n	#else\n		varying vec3 vReflect;\n	#endif\n\n#endif\n",
    "envmap_pars_vertex": "#ifdef USE_ENVMAP\n\n	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )\n\n		#define ENV_WORLDPOS\n\n	#endif\n\n	#ifdef ENV_WORLDPOS\n\n		varying vec3 vWorldPosition;\n\n	#else\n\n		varying vec3 vReflect;\n		uniform float refractionRatio;\n\n	#endif\n\n#endif\n",
    "envmap_physical_pars_fragment": "#ifdef USE_ENVMAP\n\n	vec3 getIBLIrradiance( const in vec3 normal ) {\n\n		#ifdef ENVMAP_TYPE_CUBE_UV\n\n			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );\n\n			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );\n\n			return PI * envMapColor.rgb * envMapIntensity;\n\n		#else\n\n			return vec3( 0.0 );\n\n		#endif\n\n	}\n\n	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {\n\n		#ifdef ENVMAP_TYPE_CUBE_UV\n\n			vec3 reflectVec = reflect( - viewDir, normal );\n\n			// Mixing the reflection with the normal is more accurate and keeps rough objects from gathering light from behind their tangent plane.\n			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );\n\n			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );\n\n			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );\n\n			return envMapColor.rgb * envMapIntensity;\n\n		#else\n\n			return vec3( 0.0 );\n\n		#endif\n\n	}\n\n	#ifdef USE_ANISOTROPY\n\n		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {\n\n			#ifdef ENVMAP_TYPE_CUBE_UV\n\n			  // https://google.github.io/filament/Filament.md.html#lighting/imagebasedlights/anisotropy\n				vec3 bentNormal = cross( bitangent, viewDir );\n				bentNormal = normalize( cross( bentNormal, bitangent ) );\n				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );\n\n				return getIBLRadiance( viewDir, bentNormal, roughness );\n\n			#else\n\n				return vec3( 0.0 );\n\n			#endif\n\n		}\n\n	#endif\n\n#endif\n",
    "envmap_vertex": "#ifdef USE_ENVMAP\n\n	#ifdef ENV_WORLDPOS\n\n		vWorldPosition = worldPosition.xyz;\n\n	#else\n\n		vec3 cameraToVertex;\n\n		if ( isOrthographic ) {\n\n			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );\n\n		} else {\n\n			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );\n\n		}\n\n		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );\n\n		#ifdef ENVMAP_MODE_REFLECTION\n\n			vReflect = reflect( cameraToVertex, worldNormal );\n\n		#else\n\n			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );\n\n		#endif\n\n	#endif\n\n#endif\n",
    "fog_fragment": "#ifdef USE_FOG\n\n	#ifdef FOG_EXP2\n\n		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );\n\n	#else\n\n		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );\n\n	#endif\n\n	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n\n#endif\n",
    "fog_pars_fragment": "#ifdef USE_FOG\n\n	uniform vec3 fogColor;\n	varying float vFogDepth;\n\n	#ifdef FOG_EXP2\n\n		uniform float fogDensity;\n\n	#else\n\n		uniform float fogNear;\n		uniform float fogFar;\n\n	#endif\n\n#endif\n",
    "fog_pars_vertex": "#ifdef USE_FOG\n\n	varying float vFogDepth;\n\n#endif\n",
    "fog_vertex": "#ifdef USE_FOG\n\n	vFogDepth = - mvPosition.z;\n\n#endif\n",
    "gradientmap_pars_fragment": "#ifdef USE_GRADIENTMAP\n\n	uniform sampler2D gradientMap;\n\n#endif\n\nvec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {\n\n	// dotNL will be from -1.0 to 1.0\n	float dotNL = dot( normal, lightDirection );\n	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );\n\n	#ifdef USE_GRADIENTMAP\n\n		return vec3( texture2D( gradientMap, coord ).r );\n\n	#else\n\n		vec2 fw = fwidth( coord ) * 0.5;\n		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );\n\n	#endif\n\n}\n",
    "iridescence_fragment": "#ifdef USE_IRIDESCENCE\n\n	// XYZ to linear-sRGB color space\n	const mat3 XYZ_TO_REC709 = mat3(\n		 3.2404542, -0.9692660,  0.0556434,\n		-1.5371385,  1.8760108, -0.2040259,\n		-0.4985314,  0.0415560,  1.0572252\n	);\n\n	// Assume air interface for top\n	// Note: We don't handle the case fresnel0 == 1\n	vec3 Fresnel0ToIor( vec3 fresnel0 ) {\n\n		vec3 sqrtF0 = sqrt( fresnel0 );\n		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );\n\n	}\n\n	// Conversion FO/IOR\n	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {\n\n		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );\n\n	}\n\n	// ior is a value between 1.0 and 3.0. 1.0 is air interface\n	float IorToFresnel0( float transmittedIor, float incidentIor ) {\n\n		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));\n\n	}\n\n	// Fresnel equations for dielectric/dielectric interfaces.\n	// Ref: https://belcour.github.io/blog/research/2017/05/01/brdf-thin-film.html\n	// Evaluation XYZ sensitivity curves in Fourier space\n	vec3 evalSensitivity( float OPD, vec3 shift ) {\n\n		float phase = 2.0 * PI * OPD * 1.0e-9;\n		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );\n		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );\n		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );\n\n		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );\n		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );\n		xyz /= 1.0685e-7;\n\n		vec3 rgb = XYZ_TO_REC709 * xyz;\n		return rgb;\n\n	}\n\n	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {\n\n		vec3 I;\n\n		// Force iridescenceIOR -> outsideIOR when thinFilmThickness -> 0.0\n		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );\n		// Evaluate the cosTheta on the base layer (Snell law)\n		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );\n\n		// Handle TIR:\n		float cosTheta2Sq = 1.0 - sinTheta2Sq;\n		if ( cosTheta2Sq < 0.0 ) {\n\n			return vec3( 1.0 );\n\n		}\n\n		float cosTheta2 = sqrt( cosTheta2Sq );\n\n		// First interface\n		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );\n		float R12 = F_Schlick( R0, 1.0, cosTheta1 );\n		float T121 = 1.0 - R12;\n		float phi12 = 0.0;\n		if ( iridescenceIOR < outsideIOR ) phi12 = PI;\n		float phi21 = PI - phi12;\n\n		// Second interface\n		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) ); // guard against 1.0\n		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );\n		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );\n		vec3 phi23 = vec3( 0.0 );\n		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;\n		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;\n		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;\n\n		// Phase shift\n		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;\n		vec3 phi = vec3( phi21 ) + phi23;\n\n		// Compound terms\n		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );\n		vec3 r123 = sqrt( R123 );\n		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );\n\n		// Reflectance term for m = 0 (DC term amplitude)\n		vec3 C0 = R12 + Rs;\n		I = C0;\n\n		// Reflectance term for m > 0 (pairs of diracs)\n		vec3 Cm = Rs - T121;\n		for ( int m = 1; m <= 2; ++ m ) {\n\n			Cm *= r123;\n			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );\n			I += Cm * Sm;\n\n		}\n\n		// Since out of gamut colors might be produced, negative color values are clamped to 0.\n		return max( I, vec3( 0.0 ) );\n\n	}\n\n#endif\n",
    "iridescence_pars_fragment": "#ifdef USE_IRIDESCENCEMAP\n\n	uniform sampler2D iridescenceMap;\n\n#endif\n\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n\n	uniform sampler2D iridescenceThicknessMap;\n\n#endif\n",
    "lightmap_pars_fragment": "#ifdef USE_LIGHTMAP\n\n	uniform sampler2D lightMap;\n	uniform float lightMapIntensity;\n\n#endif\n",
    "lights_fragment_begin": "/**\n * This is a template that can be used to light a material, it uses pluggable\n * RenderEquations (RE)for specific lighting scenarios.\n *\n * Instructions for use:\n * - Ensure that both RE_Direct, RE_IndirectDiffuse and RE_IndirectSpecular are defined\n * - Create a material parameter that is to be passed as the third parameter to your lighting functions.\n *\n * TODO:\n * - Add area light support.\n * - Add sphere light support.\n * - Add diffuse light probe (irradiance cubemap) support.\n */\n\nvec3 geometryPosition = - vViewPosition;\nvec3 geometryNormal = normal;\nvec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );\n\nvec3 geometryClearcoatNormal = vec3( 0.0 );\n\n#ifdef USE_CLEARCOAT\n\n	geometryClearcoatNormal = clearcoatNormal;\n\n#endif\n\n#ifdef USE_IRIDESCENCE\n\n	float dotNVi = saturate( dot( normal, geometryViewDir ) );\n\n	if ( material.iridescenceThickness == 0.0 ) {\n\n		material.iridescence = 0.0;\n\n	} else {\n\n		material.iridescence = saturate( material.iridescence );\n\n	}\n\n	if ( material.iridescence > 0.0 ) {\n\n		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );\n\n		// Iridescence F0 approximation\n		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );\n\n	}\n\n#endif\n\nIncidentLight directLight;\n\n#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )\n\n	PointLight pointLight;\n	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0\n	PointLightShadow pointLightShadow;\n	#endif\n\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\n\n		pointLight = pointLights[ i ];\n\n		getPointLightInfo( pointLight, geometryPosition, directLight );\n\n		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )\n		pointLightShadow = pointLightShadows[ i ];\n		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;\n		#endif\n\n		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n\n	}\n	#pragma unroll_loop_end\n\n#endif\n\n#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )\n\n	SpotLight spotLight;\n	vec4 spotColor;\n	vec3 spotLightCoord;\n	bool inSpotLightMap;\n\n	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0\n	SpotLightShadow spotLightShadow;\n	#endif\n\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\n\n		spotLight = spotLights[ i ];\n\n		getSpotLightInfo( spotLight, geometryPosition, directLight );\n\n		// spot lights are ordered [shadows with maps, shadows without maps, maps without shadows, none]\n		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )\n		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX\n		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS\n		#else\n		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )\n		#endif\n\n		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )\n			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;\n			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );\n			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );\n			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;\n		#endif\n\n		#undef SPOT_LIGHT_MAP_INDEX\n\n		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n		spotLightShadow = spotLightShadows[ i ];\n		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;\n		#endif\n\n		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n\n	}\n	#pragma unroll_loop_end\n\n#endif\n\n#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )\n\n	DirectionalLight directionalLight;\n	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0\n	DirectionalLightShadow directionalLightShadow;\n	#endif\n\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n\n		directionalLight = directionalLights[ i ];\n\n		getDirectionalLightInfo( directionalLight, directLight );\n\n		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )\n		directionalLightShadow = directionalLightShadows[ i ];\n		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n		#endif\n\n		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n\n	}\n	#pragma unroll_loop_end\n\n#endif\n\n#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )\n\n	RectAreaLight rectAreaLight;\n\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {\n\n		rectAreaLight = rectAreaLights[ i ];\n		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n\n	}\n	#pragma unroll_loop_end\n\n#endif\n\n#if defined( RE_IndirectDiffuse )\n\n	vec3 iblIrradiance = vec3( 0.0 );\n\n	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );\n\n	#if defined( USE_LIGHT_PROBES )\n\n		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );\n\n	#endif\n\n	#if ( NUM_HEMI_LIGHTS > 0 )\n\n		#pragma unroll_loop_start\n		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {\n\n			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );\n\n		}\n		#pragma unroll_loop_end\n\n	#endif\n\n#endif\n\n#if defined( RE_IndirectSpecular )\n\n	vec3 radiance = vec3( 0.0 );\n	vec3 clearcoatRadiance = vec3( 0.0 );\n\n#endif\n",
    "lights_fragment_end": "#if defined( RE_IndirectDiffuse )\n\n	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n\n#endif\n\n#if defined( RE_IndirectSpecular )\n\n	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n\n#endif\n",
    "lights_fragment_maps": "#if defined( RE_IndirectDiffuse )\n\n	#ifdef USE_LIGHTMAP\n\n		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );\n		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;\n\n		irradiance += lightMapIrradiance;\n\n	#endif\n\n	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )\n\n		iblIrradiance += getIBLIrradiance( geometryNormal );\n\n	#endif\n\n#endif\n\n#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )\n\n	#ifdef USE_ANISOTROPY\n\n		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );\n\n	#else\n\n		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );\n\n	#endif\n\n	#ifdef USE_CLEARCOAT\n\n		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );\n\n	#endif\n\n#endif\n",
    "lights_lambert_fragment": "LambertMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;\nmaterial.specularStrength = specularStrength;\n",
    "lights_lambert_pars_fragment": "varying vec3 vViewPosition;\n\nstruct LambertMaterial {\n\n	vec3 diffuseColor;\n	float specularStrength;\n\n};\n\nvoid RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {\n\n	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n	vec3 irradiance = dotNL * directLight.color;\n\n	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n\n}\n\nvoid RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {\n\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n\n}\n\n#define RE_Direct				RE_Direct_Lambert\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert\n",
    "lights_pars_begin": "uniform bool receiveShadow;\nuniform vec3 ambientLightColor;\n\n#if defined( USE_LIGHT_PROBES )\n\n	uniform vec3 lightProbe[ 9 ];\n\n#endif\n\n// get the irradiance (radiance convolved with cosine lobe) at the point 'normal' on the unit sphere\n// source: https://graphics.stanford.edu/papers/envmap/envmap.pdf\nvec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {\n\n	// normal is assumed to have unit length\n\n	float x = normal.x, y = normal.y, z = normal.z;\n\n	// band 0\n	vec3 result = shCoefficients[ 0 ] * 0.886227;\n\n	// band 1\n	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;\n	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;\n	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;\n\n	// band 2\n	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;\n	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;\n	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );\n	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;\n	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );\n\n	return result;\n\n}\n\nvec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {\n\n	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );\n\n	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );\n\n	return irradiance;\n\n}\n\nvec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {\n\n	vec3 irradiance = ambientLightColor;\n\n	return irradiance;\n\n}\n\nfloat getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {\n\n	// based upon Frostbite 3 Moving to Physically-based Rendering\n	// page 32, equation 26: E[window1]\n	// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf\n	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );\n\n	if ( cutoffDistance > 0.0 ) {\n\n		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );\n\n	}\n\n	return distanceFalloff;\n\n}\n\nfloat getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {\n\n	return smoothstep( coneCosine, penumbraCosine, angleCosine );\n\n}\n\n#if NUM_DIR_LIGHTS > 0\n\n	struct DirectionalLight {\n		vec3 direction;\n		vec3 color;\n	};\n\n	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];\n\n	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {\n\n		light.color = directionalLight.color;\n		light.direction = directionalLight.direction;\n		light.visible = true;\n\n	}\n\n#endif\n\n#if NUM_POINT_LIGHTS > 0\n\n	struct PointLight {\n		vec3 position;\n		vec3 color;\n		float distance;\n		float decay;\n	};\n\n	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];\n\n	// light is an out parameter as having it as a return value caused compiler errors on some devices\n	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {\n\n		vec3 lVector = pointLight.position - geometryPosition;\n\n		light.direction = normalize( lVector );\n\n		float lightDistance = length( lVector );\n\n		light.color = pointLight.color;\n		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );\n		light.visible = ( light.color != vec3( 0.0 ) );\n\n	}\n\n#endif\n\n#if NUM_SPOT_LIGHTS > 0\n\n	struct SpotLight {\n		vec3 position;\n		vec3 direction;\n		vec3 color;\n		float distance;\n		float decay;\n		float coneCos;\n		float penumbraCos;\n	};\n\n	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];\n\n	// light is an out parameter as having it as a return value caused compiler errors on some devices\n	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {\n\n		vec3 lVector = spotLight.position - geometryPosition;\n\n		light.direction = normalize( lVector );\n\n		float angleCos = dot( light.direction, spotLight.direction );\n\n		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );\n\n		if ( spotAttenuation > 0.0 ) {\n\n			float lightDistance = length( lVector );\n\n			light.color = spotLight.color * spotAttenuation;\n			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );\n			light.visible = ( light.color != vec3( 0.0 ) );\n\n		} else {\n\n			light.color = vec3( 0.0 );\n			light.visible = false;\n\n		}\n\n	}\n\n#endif\n\n#if NUM_RECT_AREA_LIGHTS > 0\n\n	struct RectAreaLight {\n		vec3 color;\n		vec3 position;\n		vec3 halfWidth;\n		vec3 halfHeight;\n	};\n\n	// Pre-computed values of LinearTransformedCosine approximation of BRDF\n	// BRDF approximation Texture is 64x64\n	uniform sampler2D ltc_1; // RGBA Float\n	uniform sampler2D ltc_2; // RGBA Float\n\n	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];\n\n#endif\n\n#if NUM_HEMI_LIGHTS > 0\n\n	struct HemisphereLight {\n		vec3 direction;\n		vec3 skyColor;\n		vec3 groundColor;\n	};\n\n	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];\n\n	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {\n\n		float dotNL = dot( normal, hemiLight.direction );\n		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;\n\n		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );\n\n		return irradiance;\n\n	}\n\n#endif\n",
    "lights_phong_fragment": "BlinnPhongMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;\nmaterial.specularColor = specular;\nmaterial.specularShininess = shininess;\nmaterial.specularStrength = specularStrength;\n",
    "lights_phong_pars_fragment": "varying vec3 vViewPosition;\n\nstruct BlinnPhongMaterial {\n\n	vec3 diffuseColor;\n	vec3 specularColor;\n	float specularShininess;\n	float specularStrength;\n\n};\n\nvoid RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {\n\n	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n	vec3 irradiance = dotNL * directLight.color;\n\n	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n\n	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;\n\n}\n\nvoid RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {\n\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n\n}\n\n#define RE_Direct				RE_Direct_BlinnPhong\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong\n",
    "lights_physical_fragment": "PhysicalMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );\n\nvec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );\nfloat geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );\n\nmaterial.roughness = max( roughnessFactor, 0.0525 );// 0.0525 corresponds to the base mip of a 256 cubemap.\nmaterial.roughness += geometryRoughness;\nmaterial.roughness = min( material.roughness, 1.0 );\n\n#ifdef IOR\n\n	material.ior = ior;\n\n	#ifdef USE_SPECULAR\n\n		float specularIntensityFactor = specularIntensity;\n		vec3 specularColorFactor = specularColor;\n\n		#ifdef USE_SPECULAR_COLORMAP\n\n			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;\n\n		#endif\n\n		#ifdef USE_SPECULAR_INTENSITYMAP\n\n			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;\n\n		#endif\n\n		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );\n\n	#else\n\n		float specularIntensityFactor = 1.0;\n		vec3 specularColorFactor = vec3( 1.0 );\n		material.specularF90 = 1.0;\n\n	#endif\n\n	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );\n\n#else\n\n	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );\n	material.specularF90 = 1.0;\n\n#endif\n\n#ifdef USE_CLEARCOAT\n\n	material.clearcoat = clearcoat;\n	material.clearcoatRoughness = clearcoatRoughness;\n	material.clearcoatF0 = vec3( 0.04 );\n	material.clearcoatF90 = 1.0;\n\n	#ifdef USE_CLEARCOATMAP\n\n		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;\n\n	#endif\n\n	#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n\n		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;\n\n	#endif\n\n	material.clearcoat = saturate( material.clearcoat ); // Burley clearcoat model\n	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );\n	material.clearcoatRoughness += geometryRoughness;\n	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );\n\n#endif\n\n#ifdef USE_DISPERSION\n\n	material.dispersion = dispersion;\n\n#endif\n\n#ifdef USE_IRIDESCENCE\n\n	material.iridescence = iridescence;\n	material.iridescenceIOR = iridescenceIOR;\n\n	#ifdef USE_IRIDESCENCEMAP\n\n		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;\n\n	#endif\n\n	#ifdef USE_IRIDESCENCE_THICKNESSMAP\n\n		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;\n\n	#else\n\n		material.iridescenceThickness = iridescenceThicknessMaximum;\n\n	#endif\n\n#endif\n\n#ifdef USE_SHEEN\n\n	material.sheenColor = sheenColor;\n\n	#ifdef USE_SHEEN_COLORMAP\n\n		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;\n\n	#endif\n\n	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );\n\n	#ifdef USE_SHEEN_ROUGHNESSMAP\n\n		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;\n\n	#endif\n\n#endif\n\n#ifdef USE_ANISOTROPY\n\n	#ifdef USE_ANISOTROPYMAP\n\n		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );\n		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;\n		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;\n\n	#else\n\n		vec2 anisotropyV = anisotropyVector;\n\n	#endif\n\n	material.anisotropy = length( anisotropyV );\n\n	if( material.anisotropy == 0.0 ) {\n		anisotropyV = vec2( 1.0, 0.0 );\n	} else {\n		anisotropyV /= material.anisotropy;\n		material.anisotropy = saturate( material.anisotropy );\n	}\n\n	// Roughness along the anisotropy bitangent is the material roughness, while the tangent roughness increases with anisotropy.\n	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );\n\n	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;\n	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;\n\n#endif\n",
    "lights_physical_pars_fragment": `struct PhysicalMaterial {

	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;

	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif

	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif

	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif

	#ifdef IOR
		float ior;
	#endif

	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif

	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif

};

// temporary
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );

vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );

    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}

// Moving Frostbite to Physically Based Rendering 3.0 - page 12, listing 2
// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {

	float a2 = pow2( alpha );

	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );

	return 0.5 / max( gv + gl, EPSILON );

}

// Microfacet Models for Refraction through Rough Surfaces - equation (33)
// http://graphicrants.blogspot.com/2013/08/specular-brdf-reference.html
// alpha is "roughness squared" in Disney’s reparameterization
float D_GGX( const in float alpha, const in float dotNH ) {

	float a2 = pow2( alpha );

	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0; // avoid alpha = 0 with dotNH = 1

	return RECIPROCAL_PI * a2 / pow2( denom );

}

// https://google.github.io/filament/Filament.md.html#materialsystem/anisotropicmodel/anisotropicspecularbrdf
#ifdef USE_ANISOTROPY

	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {

		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );

		return saturate(v);

	}

	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {

		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;

		return RECIPROCAL_PI * a2 * pow2 ( w2 );

	}

#endif

#ifdef USE_CLEARCOAT

	// GGX Distribution, Schlick Fresnel, GGX_SmithCorrelated Visibility
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {

		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;

		float alpha = pow2( roughness ); // UE4's roughness

		vec3 halfDir = normalize( lightDir + viewDir );

		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );

		vec3 F = F_Schlick( f0, f90, dotVH );

		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );

		float D = D_GGX( alpha, dotNH );

		return F * ( V * D );

	}

#endif

vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {

	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;

	float alpha = pow2( roughness ); // UE4's roughness

	vec3 halfDir = normalize( lightDir + viewDir );

	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );

	vec3 F = F_Schlick( f0, f90, dotVH );

	#ifdef USE_IRIDESCENCE

		F = mix( F, material.iridescenceFresnel, material.iridescence );

	#endif

	#ifdef USE_ANISOTROPY

		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );

		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );

		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );

	#else

		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );

		float D = D_GGX( alpha, dotNH );

	#endif

	return F * ( V * D );

}

// Rect Area Light

// Real-Time Polygonal-Light Shading with Linearly Transformed Cosines
// by Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt
// code: https://github.com/selfshadow/ltc_code/

vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {

	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;

	float dotNV = saturate( dot( N, V ) );

	// texture parameterized by sqrt( GGX alpha ) and sqrt( 1 - cos( theta ) )
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );

	uv = uv * LUT_SCALE + LUT_BIAS;

	return uv;

}

float LTC_ClippedSphereFormFactor( const in vec3 f ) {

	// Real-Time Area Lighting: a Journey from Research to Production (p.102)
	// An approximation of the form factor of a horizon-clipped rectangle.

	float l = length( f );

	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );

}

vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {

	float x = dot( v1, v2 );

	float y = abs( x );

	// rational polynomial approximation to theta / sin( theta ) / 2PI
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;

	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;

	return cross( v1, v2 ) * theta_sintheta;

}

vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {

	// bail if point is on back side of plane of light
	// assumes ccw winding order of light vertices
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );

	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );

	// construct orthonormal basis around N
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 ); // negated from paper; possibly due to a different handedness of world coordinate system

	// compute transform
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );

	// transform rect
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );

	// project rect onto sphere
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );

	// calculate vector form factor
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );

	// adjust for horizon clipping
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );

/*
	// alternate method of adjusting for horizon clipping (see reference)
	// refactoring required
	float len = length( vectorFormFactor );
	float z = vectorFormFactor.z / len;

	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;

	// tabulated horizon-clipped sphere, apparently...
	vec2 uv = vec2( z * 0.5 + 0.5, len );
	uv = uv * LUT_SCALE + LUT_BIAS;

	float scale = texture2D( ltc_2, uv ).w;

	float result = len * scale;
*/

	return vec3( result );

}

// End Rect Area Light

#if defined( USE_SHEEN )

// https://github.com/google/filament/blob/master/shaders/src/brdf.fs
float D_Charlie( float roughness, float dotNH ) {

	float alpha = pow2( roughness );

	// Estevez and Kulla 2017, "Production Friendly Microfacet Sheen BRDF"
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 ); // 2^(-14/2), so sin2h^2 > 0 in fp16

	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );

}

// https://github.com/google/filament/blob/master/shaders/src/brdf.fs
float V_Neubelt( float dotNV, float dotNL ) {

	// Neubelt and Pettineo 2013, "Crafting a Next-gen Material Pipeline for The Order: 1886"
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );

}

vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {

	vec3 halfDir = normalize( lightDir + viewDir );

	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );

	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );

	return sheenColor * ( D * V );

}

#endif

// This is a curve-fit approximation to the "Charlie sheen" BRDF integrated over the hemisphere from
// Estevez and Kulla 2017, "Production Friendly Microfacet Sheen BRDF". The analysis can be found
// in the Sheen section of https://drive.google.com/file/d/1T0D1VSyR4AllqIJTQAraEIzjlb5h4FKH/view?usp=sharing
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {

	float dotNV = saturate( dot( normal, viewDir ) );

	float r2 = roughness * roughness;

	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;

	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;

	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );

	return saturate( DG * RECIPROCAL_PI );

}

// Analytical approximation of the DFG LUT, one half of the
// split-sum approximation used in indirect specular lighting.
// via 'environmentBRDF' from "Physically Based Shading on Mobile"
// https://www.unrealengine.com/blog/physically-based-shading-on-mobile
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {

	float dotNV = saturate( dot( normal, viewDir ) );

	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );

	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );

	vec4 r = roughness * c0 + c1;

	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;

	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;

	return fab;

}

vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {

	vec2 fab = DFGApprox( normal, viewDir, roughness );

	return specularColor * fab.x + specularF90 * fab.y;

}

// Fdez-Agüera's "Multiple-Scattering Microfacet Model for Real-Time Image Based Lighting"
// Approximates multiscattering in order to preserve energy.
// http://www.jcgt.org/published/0008/01/03/
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif

	vec2 fab = DFGApprox( normal, viewDir, roughness );

	#ifdef USE_IRIDESCENCE

		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );

	#else

		vec3 Fr = specularColor;

	#endif

	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;

	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;

	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619; // 1/21
	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );

	singleScatter += FssEss;
	multiScatter += Fms * Ems;

}

#if NUM_RECT_AREA_LIGHTS > 0

	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {

		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;

		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight; // counterclockwise; light shines in local neg z direction
		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;

		vec2 uv = LTC_Uv( normal, viewDir, roughness );

		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );

		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);

		// LTC Fresnel Approximation by Stephen Hill
		// http://blog.selfshadow.com/publications/s2016-advances/s2016_ltc_fresnel.pdf
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );

		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );

		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );

	}

#endif

void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {

	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );

	vec3 irradiance = dotNL * directLight.color;

	#ifdef USE_CLEARCOAT

		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );

		vec3 ccIrradiance = dotNLcc * directLight.color;

		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );

	#endif

	#ifdef USE_SHEEN

		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );

	#endif

	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );

	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}

void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {

	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

}

void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {

	#ifdef USE_CLEARCOAT

		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );

	#endif

	#ifdef USE_SHEEN

		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );

	#endif

	// Both indirect specular and indirect diffuse light accumulate here

	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;

	#ifdef USE_IRIDESCENCE

		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );

	#else

		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );

	#endif

	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );

	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;

	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;

}

#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical

// ref: https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {

	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );

}
`,
    "lights_toon_fragment": "ToonMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;\n",
    "lights_toon_pars_fragment": "varying vec3 vViewPosition;\n\nstruct ToonMaterial {\n\n	vec3 diffuseColor;\n\n};\n\nvoid RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {\n\n	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;\n\n	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n\n}\n\nvoid RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {\n\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n\n}\n\n#define RE_Direct				RE_Direct_Toon\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon\n",
    "logdepthbuf_fragment": "#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )\n\n	// Doing a strict comparison with == 1.0 can cause noise artifacts\n	// on some platforms. See issue #17623.\n	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;\n\n#endif\n",
    "logdepthbuf_pars_fragment": "#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )\n\n	uniform float logDepthBufFC;\n	varying float vFragDepth;\n	varying float vIsPerspective;\n\n#endif\n",
    "logdepthbuf_pars_vertex": "#ifdef USE_LOGARITHMIC_DEPTH_BUFFER\n\n	varying float vFragDepth;\n	varying float vIsPerspective;\n\n#endif\n",
    "logdepthbuf_vertex": "#ifdef USE_LOGARITHMIC_DEPTH_BUFFER\n\n	vFragDepth = 1.0 + gl_Position.w;\n	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );\n\n#endif\n",
    "map_fragment": "#ifdef USE_MAP\n\n	vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n\n	#ifdef DECODE_VIDEO_TEXTURE\n\n		// use inline sRGB decode until browsers properly support SRGB8_ALPHA8 with video textures (#26516)\n\n		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );\n\n	#endif\n\n	diffuseColor *= sampledDiffuseColor;\n\n#endif\n",
    "map_pars_fragment": "#ifdef USE_MAP\n\n	uniform sampler2D map;\n\n#endif\n",
    "map_particle_fragment": "#if defined( USE_MAP ) || defined( USE_ALPHAMAP )\n\n	#if defined( USE_POINTS_UV )\n\n		vec2 uv = vUv;\n\n	#else\n\n		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;\n\n	#endif\n\n#endif\n\n#ifdef USE_MAP\n\n	diffuseColor *= texture2D( map, uv );\n\n#endif\n\n#ifdef USE_ALPHAMAP\n\n	diffuseColor.a *= texture2D( alphaMap, uv ).g;\n\n#endif\n",
    "map_particle_pars_fragment": "#if defined( USE_POINTS_UV )\n\n	varying vec2 vUv;\n\n#else\n\n	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )\n\n		uniform mat3 uvTransform;\n\n	#endif\n\n#endif\n\n#ifdef USE_MAP\n\n	uniform sampler2D map;\n\n#endif\n\n#ifdef USE_ALPHAMAP\n\n	uniform sampler2D alphaMap;\n\n#endif\n",
    "metalnessmap_fragment": "float metalnessFactor = metalness;\n\n#ifdef USE_METALNESSMAP\n\n	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );\n\n	// reads channel B, compatible with a combined OcclusionRoughnessMetallic (RGB) texture\n	metalnessFactor *= texelMetalness.b;\n\n#endif\n",
    "metalnessmap_pars_fragment": "#ifdef USE_METALNESSMAP\n\n	uniform sampler2D metalnessMap;\n\n#endif\n",
    "morphcolor_vertex": "#if defined( USE_MORPHCOLORS )\n\n	// morphTargetBaseInfluence is set based on BufferGeometry.morphTargetsRelative value:\n	// When morphTargetsRelative is false, this is set to 1 - sum(influences); this results in normal = sum((target - base) * influence)\n	// When morphTargetsRelative is true, this is set to 1; as a result, all morph targets are simply added to the base after weighting\n	vColor *= morphTargetBaseInfluence;\n\n	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n\n		#if defined( USE_COLOR_ALPHA )\n\n			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];\n\n		#elif defined( USE_COLOR )\n\n			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];\n\n		#endif\n\n	}\n\n#endif\n",
    "morphinstance_vertex": "#ifdef USE_INSTANCING_MORPH\n\n	float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n\n	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;\n\n	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n\n		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;\n\n	}\n#endif\n",
    "morphnormal_vertex": "#ifdef USE_MORPHNORMALS\n\n	// morphTargetBaseInfluence is set based on BufferGeometry.morphTargetsRelative value:\n	// When morphTargetsRelative is false, this is set to 1 - sum(influences); this results in normal = sum((target - base) * influence)\n	// When morphTargetsRelative is true, this is set to 1; as a result, all morph targets are simply added to the base after weighting\n	objectNormal *= morphTargetBaseInfluence;\n\n	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n\n		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];\n\n	}\n\n#endif\n",
    "morphtarget_pars_vertex": "#ifdef USE_MORPHTARGETS\n\n	#ifndef USE_INSTANCING_MORPH\n\n		uniform float morphTargetBaseInfluence;\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n\n	#endif\n\n	uniform sampler2DArray morphTargetsTexture;\n	uniform ivec2 morphTargetsTextureSize;\n\n	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {\n\n		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;\n		int y = texelIndex / morphTargetsTextureSize.x;\n		int x = texelIndex - y * morphTargetsTextureSize.x;\n\n		ivec3 morphUV = ivec3( x, y, morphTargetIndex );\n		return texelFetch( morphTargetsTexture, morphUV, 0 );\n\n	}\n\n#endif\n",
    "morphtarget_vertex": "#ifdef USE_MORPHTARGETS\n\n	// morphTargetBaseInfluence is set based on BufferGeometry.morphTargetsRelative value:\n	// When morphTargetsRelative is false, this is set to 1 - sum(influences); this results in position = sum((target - base) * influence)\n	// When morphTargetsRelative is true, this is set to 1; as a result, all morph targets are simply added to the base after weighting\n	transformed *= morphTargetBaseInfluence;\n\n	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n\n		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];\n\n	}\n\n#endif\n",
    "normal_fragment_begin": "float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;\n\n#ifdef FLAT_SHADED\n\n	vec3 fdx = dFdx( vViewPosition );\n	vec3 fdy = dFdy( vViewPosition );\n	vec3 normal = normalize( cross( fdx, fdy ) );\n\n#else\n\n	vec3 normal = normalize( vNormal );\n\n	#ifdef DOUBLE_SIDED\n\n		normal *= faceDirection;\n\n	#endif\n\n#endif\n\n#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )\n\n	#ifdef USE_TANGENT\n\n		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );\n\n	#else\n\n		mat3 tbn = getTangentFrame( - vViewPosition, normal,\n		#if defined( USE_NORMALMAP )\n			vNormalMapUv\n		#elif defined( USE_CLEARCOAT_NORMALMAP )\n			vClearcoatNormalMapUv\n		#else\n			vUv\n		#endif\n		);\n\n	#endif\n\n	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )\n\n		tbn[0] *= faceDirection;\n		tbn[1] *= faceDirection;\n\n	#endif\n\n#endif\n\n#ifdef USE_CLEARCOAT_NORMALMAP\n\n	#ifdef USE_TANGENT\n\n		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );\n\n	#else\n\n		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );\n\n	#endif\n\n	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )\n\n		tbn2[0] *= faceDirection;\n		tbn2[1] *= faceDirection;\n\n	#endif\n\n#endif\n\n// non perturbed normal for clearcoat among others\n\nvec3 nonPerturbedNormal = normal;\n",
    "normal_fragment_maps": "#ifdef USE_NORMALMAP_OBJECTSPACE\n\n	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals\n\n	#ifdef FLIP_SIDED\n\n		normal = - normal;\n\n	#endif\n\n	#ifdef DOUBLE_SIDED\n\n		normal = normal * faceDirection;\n\n	#endif\n\n	normal = normalize( normalMatrix * normal );\n\n#elif defined( USE_NORMALMAP_TANGENTSPACE )\n\n	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;\n	mapN.xy *= normalScale;\n\n	normal = normalize( tbn * mapN );\n\n#elif defined( USE_BUMPMAP )\n\n	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );\n\n#endif\n",
    "normal_pars_fragment": "#ifndef FLAT_SHADED\n\n	varying vec3 vNormal;\n\n	#ifdef USE_TANGENT\n\n		varying vec3 vTangent;\n		varying vec3 vBitangent;\n\n	#endif\n\n#endif\n",
    "normal_pars_vertex": "#ifndef FLAT_SHADED\n\n	varying vec3 vNormal;\n\n	#ifdef USE_TANGENT\n\n		varying vec3 vTangent;\n		varying vec3 vBitangent;\n\n	#endif\n\n#endif\n",
    "normal_vertex": "#ifndef FLAT_SHADED // normal is computed with derivatives when FLAT_SHADED\n\n	vNormal = normalize( transformedNormal );\n\n	#ifdef USE_TANGENT\n\n		vTangent = normalize( transformedTangent );\n		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );\n\n	#endif\n\n#endif\n",
    "normalmap_pars_fragment": "#ifdef USE_NORMALMAP\n\n	uniform sampler2D normalMap;\n	uniform vec2 normalScale;\n\n#endif\n\n#ifdef USE_NORMALMAP_OBJECTSPACE\n\n	uniform mat3 normalMatrix;\n\n#endif\n\n#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )\n\n	// Normal Mapping Without Precomputed Tangents\n	// http://www.thetenthplanet.de/archives/1180\n\n	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {\n\n		vec3 q0 = dFdx( eye_pos.xyz );\n		vec3 q1 = dFdy( eye_pos.xyz );\n		vec2 st0 = dFdx( uv.st );\n		vec2 st1 = dFdy( uv.st );\n\n		vec3 N = surf_norm; // normalized\n\n		vec3 q1perp = cross( q1, N );\n		vec3 q0perp = cross( N, q0 );\n\n		vec3 T = q1perp * st0.x + q0perp * st1.x;\n		vec3 B = q1perp * st0.y + q0perp * st1.y;\n\n		float det = max( dot( T, T ), dot( B, B ) );\n		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );\n\n		return mat3( T * scale, B * scale, N );\n\n	}\n\n#endif\n",
    "opaque_fragment": "#ifdef OPAQUE\ndiffuseColor.a = 1.0;\n#endif\n\n#ifdef USE_TRANSMISSION\ndiffuseColor.a *= material.transmissionAlpha;\n#endif\n\ngl_FragColor = vec4( outgoingLight, diffuseColor.a );\n",
    "packing": "vec3 packNormalToRGB( const in vec3 normal ) {\n	return normalize( normal ) * 0.5 + 0.5;\n}\n\nvec3 unpackRGBToNormal( const in vec3 rgb ) {\n	return 2.0 * rgb.xyz - 1.0;\n}\n\nconst float PackUpscale = 256. / 255.; // fraction -> 0..1 (including 1)\nconst float UnpackDownscale = 255. / 256.; // 0..1 -> fraction (excluding 1)\nconst float ShiftRight8 = 1. / 256.;\nconst float Inv255 = 1. / 255.;\n\nconst vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );\n\nconst vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );\nconst vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );\nconst vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );\n\nvec4 packDepthToRGBA( const in float v ) {\n	if( v <= 0.0 )\n		return vec4( 0., 0., 0., 0. );\n	if( v >= 1.0 )\n		return vec4( 1., 1., 1., 1. );\n	float vuf;\n	float af = modf( v * PackFactors.a, vuf );\n	float bf = modf( vuf * ShiftRight8, vuf );\n	float gf = modf( vuf * ShiftRight8, vuf );\n	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );\n}\n\nvec3 packDepthToRGB( const in float v ) {\n	if( v <= 0.0 )\n		return vec3( 0., 0., 0. );\n	if( v >= 1.0 )\n		return vec3( 1., 1., 1. );\n	float vuf;\n	float bf = modf( v * PackFactors.b, vuf );\n	float gf = modf( vuf * ShiftRight8, vuf );\n	// the 0.9999 tweak is unimportant, very tiny empirical improvement\n	// return vec3( vuf * Inv255, gf * PackUpscale, bf * 0.9999 );\n	return vec3( vuf * Inv255, gf * PackUpscale, bf );\n}\n\nvec2 packDepthToRG( const in float v ) {\n	if( v <= 0.0 )\n		return vec2( 0., 0. );\n	if( v >= 1.0 )\n		return vec2( 1., 1. );\n	float vuf;\n	float gf = modf( v * 256., vuf );\n	return vec2( vuf * Inv255, gf );\n}\n\nfloat unpackRGBAToDepth( const in vec4 v ) {\n	return dot( v, UnpackFactors4 );\n}\n\nfloat unpackRGBToDepth( const in vec3 v ) {\n	return dot( v, UnpackFactors3 );\n}\n\nfloat unpackRGToDepth( const in vec2 v ) {\n	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;\n}\n\nvec4 pack2HalfToRGBA( const in vec2 v ) {\n	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );\n	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );\n}\n\nvec2 unpackRGBATo2Half( const in vec4 v ) {\n	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );\n}\n\n// NOTE: viewZ, the z-coordinate in camera space, is negative for points in front of the camera\n\nfloat viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {\n	// -near maps to 0; -far maps to 1\n	return ( viewZ + near ) / ( near - far );\n}\n\nfloat orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {\n	// maps orthographic depth in [ 0, 1 ] to viewZ\n	return depth * ( near - far ) - near;\n}\n\n// NOTE: https://twitter.com/gonnavis/status/1377183786949959682\n\nfloat viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {\n	// -near maps to 0; -far maps to 1\n	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );\n}\n\nfloat perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {\n	// maps perspective depth in [ 0, 1 ] to viewZ\n	return ( near * far ) / ( ( far - near ) * depth - far );\n}\n",
    "premultiplied_alpha_fragment": "#ifdef PREMULTIPLIED_ALPHA\n\n	// Get normal blending with premultipled, use with CustomBlending, OneFactor, OneMinusSrcAlphaFactor, AddEquation.\n	gl_FragColor.rgb *= gl_FragColor.a;\n\n#endif\n",
    "project_vertex": "vec4 mvPosition = vec4( transformed, 1.0 );\n\n#ifdef USE_BATCHING\n\n	mvPosition = batchingMatrix * mvPosition;\n\n#endif\n\n#ifdef USE_INSTANCING\n\n	mvPosition = instanceMatrix * mvPosition;\n\n#endif\n\nmvPosition = modelViewMatrix * mvPosition;\n\ngl_Position = projectionMatrix * mvPosition;\n",
    "roughnessmap_fragment": "float roughnessFactor = roughness;\n\n#ifdef USE_ROUGHNESSMAP\n\n	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );\n\n	// reads channel G, compatible with a combined OcclusionRoughnessMetallic (RGB) texture\n	roughnessFactor *= texelRoughness.g;\n\n#endif\n",
    "roughnessmap_pars_fragment": "#ifdef USE_ROUGHNESSMAP\n\n	uniform sampler2D roughnessMap;\n\n#endif\n",
    "shadowmap_pars_fragment": "#if NUM_SPOT_LIGHT_COORDS > 0\n\n	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];\n\n#endif\n\n#if NUM_SPOT_LIGHT_MAPS > 0\n\n	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];\n\n#endif\n\n#ifdef USE_SHADOWMAP\n\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n\n		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];\n		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];\n\n		struct DirectionalLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n\n		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];\n\n	#endif\n\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n\n		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];\n\n		struct SpotLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n\n		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];\n\n	#endif\n\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n\n		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];\n		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];\n\n		struct PointLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n			float shadowCameraNear;\n			float shadowCameraFar;\n		};\n\n		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];\n\n	#endif\n\n	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {\n\n		float depth = unpackRGBAToDepth( texture2D( depths, uv ) );\n\n		#ifdef USE_REVERSED_DEPTH_BUFFER\n\n			return step( depth, compare );\n\n		#else\n\n			return step( compare, depth );\n\n		#endif\n\n	}\n\n	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {\n\n		return unpackRGBATo2Half( texture2D( shadow, uv ) );\n\n	}\n\n	float VSMShadow( sampler2D shadow, vec2 uv, float compare ) {\n\n		float occlusion = 1.0;\n\n		vec2 distribution = texture2DDistribution( shadow, uv );\n\n		#ifdef USE_REVERSED_DEPTH_BUFFER\n\n			float hard_shadow = step( distribution.x, compare );\n\n		#else\n\n			float hard_shadow = step( compare, distribution.x );\n\n		#endif\n\n		if ( hard_shadow != 1.0 ) {\n\n			float distance = compare - distribution.x;\n			float variance = max( 0.00000, distribution.y * distribution.y );\n			float softness_probability = variance / (variance + distance * distance ); // Chebeyshevs inequality\n			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 ); // 0.3 reduces light bleed\n			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );\n\n		}\n		return occlusion;\n\n	}\n\n	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {\n\n		float shadow = 1.0;\n\n		shadowCoord.xyz /= shadowCoord.w;\n		shadowCoord.z += shadowBias;\n\n		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;\n		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;\n\n		if ( frustumTest ) {\n\n		#if defined( SHADOWMAP_TYPE_PCF )\n\n			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;\n\n			float dx0 = - texelSize.x * shadowRadius;\n			float dy0 = - texelSize.y * shadowRadius;\n			float dx1 = + texelSize.x * shadowRadius;\n			float dy1 = + texelSize.y * shadowRadius;\n			float dx2 = dx0 / 2.0;\n			float dy2 = dy0 / 2.0;\n			float dx3 = dx1 / 2.0;\n			float dy3 = dy1 / 2.0;\n\n			shadow = (\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )\n			) * ( 1.0 / 17.0 );\n\n		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )\n\n			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;\n			float dx = texelSize.x;\n			float dy = texelSize.y;\n\n			vec2 uv = shadowCoord.xy;\n			vec2 f = fract( uv * shadowMapSize + 0.5 );\n			uv -= f * texelSize;\n\n			shadow = (\n				texture2DCompare( shadowMap, uv, shadowCoord.z ) +\n				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +\n				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),\n					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),\n					 f.x ) +\n				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),\n					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),\n					 f.x ) +\n				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),\n					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),\n					 f.y ) +\n				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),\n					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),\n					 f.y ) +\n				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),\n						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),\n						  f.x ),\n					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),\n						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),\n						  f.x ),\n					 f.y )\n			) * ( 1.0 / 9.0 );\n\n		#elif defined( SHADOWMAP_TYPE_VSM )\n\n			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );\n\n		#else // no percentage-closer filtering:\n\n			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );\n\n		#endif\n\n		}\n\n		return mix( 1.0, shadow, shadowIntensity );\n\n	}\n\n	// cubeToUV() maps a 3D direction vector suitable for cube texture mapping to a 2D\n	// vector suitable for 2D texture mapping. This code uses the following layout for the\n	// 2D texture:\n	//\n	// xzXZ\n	//  y Y\n	//\n	// Y - Positive y direction\n	// y - Negative y direction\n	// X - Positive x direction\n	// x - Negative x direction\n	// Z - Positive z direction\n	// z - Negative z direction\n	//\n	// Source and test bed:\n	// https://gist.github.com/tschw/da10c43c467ce8afd0c4\n\n	vec2 cubeToUV( vec3 v, float texelSizeY ) {\n\n		// Number of texels to avoid at the edge of each square\n\n		vec3 absV = abs( v );\n\n		// Intersect unit cube\n\n		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );\n		absV *= scaleToCube;\n\n		// Apply scale to avoid seams\n\n		// two texels less per square (one texel will do for NEAREST)\n		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );\n\n		// Unwrap\n\n		// space: -1 ... 1 range for each square\n		//\n		// #X##		dim    := ( 4 , 2 )\n		//  # #		center := ( 1 , 1 )\n\n		vec2 planar = v.xy;\n\n		float almostATexel = 1.5 * texelSizeY;\n		float almostOne = 1.0 - almostATexel;\n\n		if ( absV.z >= almostOne ) {\n\n			if ( v.z > 0.0 )\n				planar.x = 4.0 - v.x;\n\n		} else if ( absV.x >= almostOne ) {\n\n			float signX = sign( v.x );\n			planar.x = v.z * signX + 2.0 * signX;\n\n		} else if ( absV.y >= almostOne ) {\n\n			float signY = sign( v.y );\n			planar.x = v.x + 2.0 * signY + 2.0;\n			planar.y = v.z * signY - 2.0;\n\n		}\n\n		// Transform to UV space\n\n		// scale := 0.5 / dim\n		// translate := ( center + 0.5 ) / dim\n		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );\n\n	}\n\n	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {\n\n		float shadow = 1.0;\n\n		// for point lights, the uniform @vShadowCoord is re-purposed to hold\n		// the vector from the light to the world-space position of the fragment.\n		vec3 lightToPosition = shadowCoord.xyz;\n\n		float lightToPositionLength = length( lightToPosition );\n\n		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {\n\n			// dp = normalized distance from light to fragment position\n			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear ); // need to clamp?\n			dp += shadowBias;\n\n			// bd3D = base direction 3D\n			vec3 bd3D = normalize( lightToPosition );\n\n			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );\n\n			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )\n\n				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;\n\n				shadow = (\n					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +\n					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +\n					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +\n					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +\n					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +\n					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +\n					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +\n					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +\n					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )\n				) * ( 1.0 / 9.0 );\n\n			#else // no percentage-closer filtering\n\n				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );\n\n			#endif\n\n		}\n\n		return mix( 1.0, shadow, shadowIntensity );\n\n	}\n\n#endif\n",
    "shadowmap_pars_vertex": "#if NUM_SPOT_LIGHT_COORDS > 0\n\n	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];\n	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];\n\n#endif\n\n#ifdef USE_SHADOWMAP\n\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n\n		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];\n		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];\n\n		struct DirectionalLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n\n		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];\n\n	#endif\n\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n\n		struct SpotLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n\n		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];\n\n	#endif\n\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n\n		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];\n		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];\n\n		struct PointLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n			float shadowCameraNear;\n			float shadowCameraFar;\n		};\n\n		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];\n\n	#endif\n\n	/*\n	#if NUM_RECT_AREA_LIGHTS > 0\n\n		// TODO (abelnation): uniforms for area light shadows\n\n	#endif\n	*/\n\n#endif\n",
    "shadowmap_vertex": "#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )\n\n	// Offsetting the position used for querying occlusion along the world normal can be used to reduce shadow acne.\n	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );\n	vec4 shadowWorldPosition;\n\n#endif\n\n#if defined( USE_SHADOWMAP )\n\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n\n		#pragma unroll_loop_start\n		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {\n\n			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );\n			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;\n\n		}\n		#pragma unroll_loop_end\n\n	#endif\n\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n\n		#pragma unroll_loop_start\n		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {\n\n			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );\n			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;\n\n		}\n		#pragma unroll_loop_end\n\n	#endif\n\n	/*\n	#if NUM_RECT_AREA_LIGHTS > 0\n\n		// TODO (abelnation): update vAreaShadowCoord with area light info\n\n	#endif\n	*/\n\n#endif\n\n// spot lights can be evaluated without active shadow mapping (when SpotLight.map is used)\n\n#if NUM_SPOT_LIGHT_COORDS > 0\n\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {\n\n		shadowWorldPosition = worldPosition;\n		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;\n		#endif\n		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;\n\n	}\n	#pragma unroll_loop_end\n\n#endif\n",
    "shadowmask_pars_fragment": "float getShadowMask() {\n\n	float shadow = 1.0;\n\n	#ifdef USE_SHADOWMAP\n\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n\n	DirectionalLightShadow directionalLight;\n\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {\n\n		directionalLight = directionalLightShadows[ i ];\n		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n\n	}\n	#pragma unroll_loop_end\n\n	#endif\n\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n\n	SpotLightShadow spotLight;\n\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {\n\n		spotLight = spotLightShadows[ i ];\n		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;\n\n	}\n	#pragma unroll_loop_end\n\n	#endif\n\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n\n	PointLightShadow pointLight;\n\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {\n\n		pointLight = pointLightShadows[ i ];\n		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;\n\n	}\n	#pragma unroll_loop_end\n\n	#endif\n\n	/*\n	#if NUM_RECT_AREA_LIGHTS > 0\n\n		// TODO (abelnation): update shadow for Area light\n\n	#endif\n	*/\n\n	#endif\n\n	return shadow;\n\n}\n",
    "skinbase_vertex": "#ifdef USE_SKINNING\n\n	mat4 boneMatX = getBoneMatrix( skinIndex.x );\n	mat4 boneMatY = getBoneMatrix( skinIndex.y );\n	mat4 boneMatZ = getBoneMatrix( skinIndex.z );\n	mat4 boneMatW = getBoneMatrix( skinIndex.w );\n\n#endif\n",
    "skinning_pars_vertex": "#ifdef USE_SKINNING\n\n	uniform mat4 bindMatrix;\n	uniform mat4 bindMatrixInverse;\n\n	uniform highp sampler2D boneTexture;\n\n	mat4 getBoneMatrix( const in float i ) {\n\n		int size = textureSize( boneTexture, 0 ).x;\n		int j = int( i ) * 4;\n		int x = j % size;\n		int y = j / size;\n		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );\n		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );\n		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );\n		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );\n\n		return mat4( v1, v2, v3, v4 );\n\n	}\n\n#endif\n",
    "skinning_vertex": "#ifdef USE_SKINNING\n\n	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );\n\n	vec4 skinned = vec4( 0.0 );\n	skinned += boneMatX * skinVertex * skinWeight.x;\n	skinned += boneMatY * skinVertex * skinWeight.y;\n	skinned += boneMatZ * skinVertex * skinWeight.z;\n	skinned += boneMatW * skinVertex * skinWeight.w;\n\n	transformed = ( bindMatrixInverse * skinned ).xyz;\n\n#endif\n",
    "skinnormal_vertex": "#ifdef USE_SKINNING\n\n	mat4 skinMatrix = mat4( 0.0 );\n	skinMatrix += skinWeight.x * boneMatX;\n	skinMatrix += skinWeight.y * boneMatY;\n	skinMatrix += skinWeight.z * boneMatZ;\n	skinMatrix += skinWeight.w * boneMatW;\n	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;\n\n	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;\n\n	#ifdef USE_TANGENT\n\n		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;\n\n	#endif\n\n#endif\n",
    "specularmap_fragment": "float specularStrength;\n\n#ifdef USE_SPECULARMAP\n\n	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );\n	specularStrength = texelSpecular.r;\n\n#else\n\n	specularStrength = 1.0;\n\n#endif\n",
    "specularmap_pars_fragment": "#ifdef USE_SPECULARMAP\n\n	uniform sampler2D specularMap;\n\n#endif\n",
    "tonemapping_fragment": "#if defined( TONE_MAPPING )\n\n	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );\n\n#endif\n",
    "tonemapping_pars_fragment": "#ifndef saturate\n// <common> may have defined saturate() already\n#define saturate( a ) clamp( a, 0.0, 1.0 )\n#endif\n\nuniform float toneMappingExposure;\n\n// exposure only\nvec3 LinearToneMapping( vec3 color ) {\n\n	return saturate( toneMappingExposure * color );\n\n}\n\n// source: https://www.cs.utah.edu/docs/techreports/2002/pdf/UUCS-02-001.pdf\nvec3 ReinhardToneMapping( vec3 color ) {\n\n	color *= toneMappingExposure;\n	return saturate( color / ( vec3( 1.0 ) + color ) );\n\n}\n\n// source: http://filmicworlds.com/blog/filmic-tonemapping-operators/\nvec3 CineonToneMapping( vec3 color ) {\n\n	// filmic operator by Jim Hejl and Richard Burgess-Dawson\n	color *= toneMappingExposure;\n	color = max( vec3( 0.0 ), color - 0.004 );\n	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );\n\n}\n\n// source: https://github.com/selfshadow/ltc_code/blob/master/webgl/shaders/ltc/ltc_blit.fs\nvec3 RRTAndODTFit( vec3 v ) {\n\n	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;\n	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;\n	return a / b;\n\n}\n\n// this implementation of ACES is modified to accommodate a brighter viewing environment.\n// the scale factor of 1/0.6 is subjective. see discussion in #19621.\n\nvec3 ACESFilmicToneMapping( vec3 color ) {\n\n	// sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT\n	const mat3 ACESInputMat = mat3(\n		vec3( 0.59719, 0.07600, 0.02840 ), // transposed from source\n		vec3( 0.35458, 0.90834, 0.13383 ),\n		vec3( 0.04823, 0.01566, 0.83777 )\n	);\n\n	// ODT_SAT => XYZ => D60_2_D65 => sRGB\n	const mat3 ACESOutputMat = mat3(\n		vec3(  1.60475, -0.10208, -0.00327 ), // transposed from source\n		vec3( -0.53108,  1.10813, -0.07276 ),\n		vec3( -0.07367, -0.00605,  1.07602 )\n	);\n\n	color *= toneMappingExposure / 0.6;\n\n	color = ACESInputMat * color;\n\n	// Apply RRT and ODT\n	color = RRTAndODTFit( color );\n\n	color = ACESOutputMat * color;\n\n	// Clamp to [0, 1]\n	return saturate( color );\n\n}\n\n// Matrices for rec 2020 <> rec 709 color space conversion\n// matrix provided in row-major order so it has been transposed\n// https://www.itu.int/pub/R-REP-BT.2407-2017\nconst mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(\n	vec3( 1.6605, - 0.1246, - 0.0182 ),\n	vec3( - 0.5876, 1.1329, - 0.1006 ),\n	vec3( - 0.0728, - 0.0083, 1.1187 )\n);\n\nconst mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(\n	vec3( 0.6274, 0.0691, 0.0164 ),\n	vec3( 0.3293, 0.9195, 0.0880 ),\n	vec3( 0.0433, 0.0113, 0.8956 )\n);\n\n// https://iolite-engine.com/blog_posts/minimal_agx_implementation\n// Mean error^2: 3.6705141e-06\nvec3 agxDefaultContrastApprox( vec3 x ) {\n\n	vec3 x2 = x * x;\n	vec3 x4 = x2 * x2;\n\n	return + 15.5 * x4 * x2\n		- 40.14 * x4 * x\n		+ 31.96 * x4\n		- 6.868 * x2 * x\n		+ 0.4298 * x2\n		+ 0.1191 * x\n		- 0.00232;\n\n}\n\n// AgX Tone Mapping implementation based on Filament, which in turn is based\n// on Blender's implementation using rec 2020 primaries\n// https://github.com/google/filament/pull/7236\n// Inputs and outputs are encoded as Linear-sRGB.\n\nvec3 AgXToneMapping( vec3 color ) {\n\n	// AgX constants\n	const mat3 AgXInsetMatrix = mat3(\n		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),\n		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),\n		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )\n	);\n\n	// explicit AgXOutsetMatrix generated from Filaments AgXOutsetMatrixInv\n	const mat3 AgXOutsetMatrix = mat3(\n		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),\n		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),\n		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )\n	);\n\n	// LOG2_MIN      = -10.0\n	// LOG2_MAX      =  +6.5\n	// MIDDLE_GRAY   =  0.18\n	const float AgxMinEv = - 12.47393;  // log2( pow( 2, LOG2_MIN ) * MIDDLE_GRAY )\n	const float AgxMaxEv = 4.026069;    // log2( pow( 2, LOG2_MAX ) * MIDDLE_GRAY )\n\n	color *= toneMappingExposure;\n\n	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;\n\n	color = AgXInsetMatrix * color;\n\n	// Log2 encoding\n	color = max( color, 1e-10 ); // avoid 0 or negative numbers for log2\n	color = log2( color );\n	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );\n\n	color = clamp( color, 0.0, 1.0 );\n\n	// Apply sigmoid\n	color = agxDefaultContrastApprox( color );\n\n	// Apply AgX look\n	// v = agxLook(v, look);\n\n	color = AgXOutsetMatrix * color;\n\n	// Linearize\n	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );\n\n	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;\n\n	// Gamut mapping. Simple clamp for now.\n	color = clamp( color, 0.0, 1.0 );\n\n	return color;\n\n}\n\n// https://modelviewer.dev/examples/tone-mapping\n\nvec3 NeutralToneMapping( vec3 color ) {\n\n	const float StartCompression = 0.8 - 0.04;\n	const float Desaturation = 0.15;\n\n	color *= toneMappingExposure;\n\n	float x = min( color.r, min( color.g, color.b ) );\n\n	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;\n\n	color -= offset;\n\n	float peak = max( color.r, max( color.g, color.b ) );\n\n	if ( peak < StartCompression ) return color;\n\n	float d = 1. - StartCompression;\n\n	float newPeak = 1. - d * d / ( peak + d - StartCompression );\n\n	color *= newPeak / peak;\n\n	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );\n\n	return mix( color, vec3( newPeak ), g );\n\n}\n\nvec3 CustomToneMapping( vec3 color ) { return color; }\n",
    "transmission_fragment": "#ifdef USE_TRANSMISSION\n\n	material.transmission = transmission;\n	material.transmissionAlpha = 1.0;\n	material.thickness = thickness;\n	material.attenuationDistance = attenuationDistance;\n	material.attenuationColor = attenuationColor;\n\n	#ifdef USE_TRANSMISSIONMAP\n\n		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;\n\n	#endif\n\n	#ifdef USE_THICKNESSMAP\n\n		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;\n\n	#endif\n\n	vec3 pos = vWorldPosition;\n	vec3 v = normalize( cameraPosition - pos );\n	vec3 n = inverseTransformDirection( normal, viewMatrix );\n\n	vec4 transmitted = getIBLVolumeRefraction(\n		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,\n		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,\n		material.attenuationColor, material.attenuationDistance );\n\n	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );\n\n	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );\n\n#endif\n",
    "transmission_pars_fragment": "#ifdef USE_TRANSMISSION\n\n	// Transmission code is based on glTF-Sampler-Viewer\n	// https://github.com/KhronosGroup/glTF-Sample-Viewer\n\n	uniform float transmission;\n	uniform float thickness;\n	uniform float attenuationDistance;\n	uniform vec3 attenuationColor;\n\n	#ifdef USE_TRANSMISSIONMAP\n\n		uniform sampler2D transmissionMap;\n\n	#endif\n\n	#ifdef USE_THICKNESSMAP\n\n		uniform sampler2D thicknessMap;\n\n	#endif\n\n	uniform vec2 transmissionSamplerSize;\n	uniform sampler2D transmissionSamplerMap;\n\n	uniform mat4 modelMatrix;\n	uniform mat4 projectionMatrix;\n\n	varying vec3 vWorldPosition;\n\n	// Mipped Bicubic Texture Filtering by N8\n	// https://www.shadertoy.com/view/Dl2SDW\n\n	float w0( float a ) {\n\n		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );\n\n	}\n\n	float w1( float a ) {\n\n		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );\n\n	}\n\n	float w2( float a ){\n\n		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );\n\n	}\n\n	float w3( float a ) {\n\n		return ( 1.0 / 6.0 ) * ( a * a * a );\n\n	}\n\n	// g0 and g1 are the two amplitude functions\n	float g0( float a ) {\n\n		return w0( a ) + w1( a );\n\n	}\n\n	float g1( float a ) {\n\n		return w2( a ) + w3( a );\n\n	}\n\n	// h0 and h1 are the two offset functions\n	float h0( float a ) {\n\n		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );\n\n	}\n\n	float h1( float a ) {\n\n		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );\n\n	}\n\n	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {\n\n		uv = uv * texelSize.zw + 0.5;\n\n		vec2 iuv = floor( uv );\n		vec2 fuv = fract( uv );\n\n		float g0x = g0( fuv.x );\n		float g1x = g1( fuv.x );\n		float h0x = h0( fuv.x );\n		float h1x = h1( fuv.x );\n		float h0y = h0( fuv.y );\n		float h1y = h1( fuv.y );\n\n		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;\n		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;\n		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;\n		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;\n\n		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +\n			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );\n\n	}\n\n	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {\n\n		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );\n		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );\n		vec2 fLodSizeInv = 1.0 / fLodSize;\n		vec2 cLodSizeInv = 1.0 / cLodSize;\n		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );\n		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );\n		return mix( fSample, cSample, fract( lod ) );\n\n	}\n\n	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {\n\n		// Direction of refracted light.\n		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );\n\n		// Compute rotation-independent scaling of the model matrix.\n		vec3 modelScale;\n		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );\n		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );\n		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );\n\n		// The thickness is specified in local space.\n		return normalize( refractionVector ) * thickness * modelScale;\n\n	}\n\n	float applyIorToRoughness( const in float roughness, const in float ior ) {\n\n		// Scale roughness with IOR so that an IOR of 1.0 results in no microfacet refraction and\n		// an IOR of 1.5 results in the default amount of microfacet refraction.\n		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );\n\n	}\n\n	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {\n\n		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );\n		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );\n\n	}\n\n	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {\n\n		if ( isinf( attenuationDistance ) ) {\n\n			// Attenuation distance is +∞, i.e. the transmitted color is not attenuated at all.\n			return vec3( 1.0 );\n\n		} else {\n\n			// Compute light attenuation using Beer's law.\n			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;\n			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance ); // Beer's law\n			return transmittance;\n\n		}\n\n	}\n\n	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,\n		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,\n		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,\n		const in vec3 attenuationColor, const in float attenuationDistance ) {\n\n		vec4 transmittedLight;\n		vec3 transmittance;\n\n		#ifdef USE_DISPERSION\n\n			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;\n			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );\n\n			for ( int i = 0; i < 3; i ++ ) {\n\n				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );\n				vec3 refractedRayExit = position + transmissionRay;\n\n				// Project refracted vector on the framebuffer, while mapping to normalized device coordinates.\n				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );\n				vec2 refractionCoords = ndcPos.xy / ndcPos.w;\n				refractionCoords += 1.0;\n				refractionCoords /= 2.0;\n\n				// Sample framebuffer to get pixel the refracted ray hits.\n				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );\n				transmittedLight[ i ] = transmissionSample[ i ];\n				transmittedLight.a += transmissionSample.a;\n\n				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];\n\n			}\n\n			transmittedLight.a /= 3.0;\n\n		#else\n\n			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );\n			vec3 refractedRayExit = position + transmissionRay;\n\n			// Project refracted vector on the framebuffer, while mapping to normalized device coordinates.\n			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );\n			vec2 refractionCoords = ndcPos.xy / ndcPos.w;\n			refractionCoords += 1.0;\n			refractionCoords /= 2.0;\n\n			// Sample framebuffer to get pixel the refracted ray hits.\n			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );\n			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );\n\n		#endif\n\n		vec3 attenuatedColor = transmittance * transmittedLight.rgb;\n\n		// Get the specular component.\n		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );\n\n		// As less light is transmitted, the opacity should be increased. This simple approximation does a decent job\n		// of modulating a CSS background, and has no effect when the buffer is opaque, due to a solid object or clear color.\n		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;\n\n		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );\n\n	}\n#endif\n",
    "uv_pars_fragment": "#if defined( USE_UV ) || defined( USE_ANISOTROPY )\n\n	varying vec2 vUv;\n\n#endif\n#ifdef USE_MAP\n\n	varying vec2 vMapUv;\n\n#endif\n#ifdef USE_ALPHAMAP\n\n	varying vec2 vAlphaMapUv;\n\n#endif\n#ifdef USE_LIGHTMAP\n\n	varying vec2 vLightMapUv;\n\n#endif\n#ifdef USE_AOMAP\n\n	varying vec2 vAoMapUv;\n\n#endif\n#ifdef USE_BUMPMAP\n\n	varying vec2 vBumpMapUv;\n\n#endif\n#ifdef USE_NORMALMAP\n\n	varying vec2 vNormalMapUv;\n\n#endif\n#ifdef USE_EMISSIVEMAP\n\n	varying vec2 vEmissiveMapUv;\n\n#endif\n#ifdef USE_METALNESSMAP\n\n	varying vec2 vMetalnessMapUv;\n\n#endif\n#ifdef USE_ROUGHNESSMAP\n\n	varying vec2 vRoughnessMapUv;\n\n#endif\n#ifdef USE_ANISOTROPYMAP\n\n	varying vec2 vAnisotropyMapUv;\n\n#endif\n#ifdef USE_CLEARCOATMAP\n\n	varying vec2 vClearcoatMapUv;\n\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n\n	varying vec2 vClearcoatNormalMapUv;\n\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n\n	varying vec2 vClearcoatRoughnessMapUv;\n\n#endif\n#ifdef USE_IRIDESCENCEMAP\n\n	varying vec2 vIridescenceMapUv;\n\n#endif\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n\n	varying vec2 vIridescenceThicknessMapUv;\n\n#endif\n#ifdef USE_SHEEN_COLORMAP\n\n	varying vec2 vSheenColorMapUv;\n\n#endif\n#ifdef USE_SHEEN_ROUGHNESSMAP\n\n	varying vec2 vSheenRoughnessMapUv;\n\n#endif\n#ifdef USE_SPECULARMAP\n\n	varying vec2 vSpecularMapUv;\n\n#endif\n#ifdef USE_SPECULAR_COLORMAP\n\n	varying vec2 vSpecularColorMapUv;\n\n#endif\n#ifdef USE_SPECULAR_INTENSITYMAP\n\n	varying vec2 vSpecularIntensityMapUv;\n\n#endif\n#ifdef USE_TRANSMISSIONMAP\n\n	uniform mat3 transmissionMapTransform;\n	varying vec2 vTransmissionMapUv;\n\n#endif\n#ifdef USE_THICKNESSMAP\n\n	uniform mat3 thicknessMapTransform;\n	varying vec2 vThicknessMapUv;\n\n#endif\n",
    "uv_pars_vertex": "#if defined( USE_UV ) || defined( USE_ANISOTROPY )\n\n	varying vec2 vUv;\n\n#endif\n#ifdef USE_MAP\n\n	uniform mat3 mapTransform;\n	varying vec2 vMapUv;\n\n#endif\n#ifdef USE_ALPHAMAP\n\n	uniform mat3 alphaMapTransform;\n	varying vec2 vAlphaMapUv;\n\n#endif\n#ifdef USE_LIGHTMAP\n\n	uniform mat3 lightMapTransform;\n	varying vec2 vLightMapUv;\n\n#endif\n#ifdef USE_AOMAP\n\n	uniform mat3 aoMapTransform;\n	varying vec2 vAoMapUv;\n\n#endif\n#ifdef USE_BUMPMAP\n\n	uniform mat3 bumpMapTransform;\n	varying vec2 vBumpMapUv;\n\n#endif\n#ifdef USE_NORMALMAP\n\n	uniform mat3 normalMapTransform;\n	varying vec2 vNormalMapUv;\n\n#endif\n#ifdef USE_DISPLACEMENTMAP\n\n	uniform mat3 displacementMapTransform;\n	varying vec2 vDisplacementMapUv;\n\n#endif\n#ifdef USE_EMISSIVEMAP\n\n	uniform mat3 emissiveMapTransform;\n	varying vec2 vEmissiveMapUv;\n\n#endif\n#ifdef USE_METALNESSMAP\n\n	uniform mat3 metalnessMapTransform;\n	varying vec2 vMetalnessMapUv;\n\n#endif\n#ifdef USE_ROUGHNESSMAP\n\n	uniform mat3 roughnessMapTransform;\n	varying vec2 vRoughnessMapUv;\n\n#endif\n#ifdef USE_ANISOTROPYMAP\n\n	uniform mat3 anisotropyMapTransform;\n	varying vec2 vAnisotropyMapUv;\n\n#endif\n#ifdef USE_CLEARCOATMAP\n\n	uniform mat3 clearcoatMapTransform;\n	varying vec2 vClearcoatMapUv;\n\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n\n	uniform mat3 clearcoatNormalMapTransform;\n	varying vec2 vClearcoatNormalMapUv;\n\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n\n	uniform mat3 clearcoatRoughnessMapTransform;\n	varying vec2 vClearcoatRoughnessMapUv;\n\n#endif\n#ifdef USE_SHEEN_COLORMAP\n\n	uniform mat3 sheenColorMapTransform;\n	varying vec2 vSheenColorMapUv;\n\n#endif\n#ifdef USE_SHEEN_ROUGHNESSMAP\n\n	uniform mat3 sheenRoughnessMapTransform;\n	varying vec2 vSheenRoughnessMapUv;\n\n#endif\n#ifdef USE_IRIDESCENCEMAP\n\n	uniform mat3 iridescenceMapTransform;\n	varying vec2 vIridescenceMapUv;\n\n#endif\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n\n	uniform mat3 iridescenceThicknessMapTransform;\n	varying vec2 vIridescenceThicknessMapUv;\n\n#endif\n#ifdef USE_SPECULARMAP\n\n	uniform mat3 specularMapTransform;\n	varying vec2 vSpecularMapUv;\n\n#endif\n#ifdef USE_SPECULAR_COLORMAP\n\n	uniform mat3 specularColorMapTransform;\n	varying vec2 vSpecularColorMapUv;\n\n#endif\n#ifdef USE_SPECULAR_INTENSITYMAP\n\n	uniform mat3 specularIntensityMapTransform;\n	varying vec2 vSpecularIntensityMapUv;\n\n#endif\n#ifdef USE_TRANSMISSIONMAP\n\n	uniform mat3 transmissionMapTransform;\n	varying vec2 vTransmissionMapUv;\n\n#endif\n#ifdef USE_THICKNESSMAP\n\n	uniform mat3 thicknessMapTransform;\n	varying vec2 vThicknessMapUv;\n\n#endif\n",
    "uv_vertex": "#if defined( USE_UV ) || defined( USE_ANISOTROPY )\n\n	vUv = vec3( uv, 1 ).xy;\n\n#endif\n#ifdef USE_MAP\n\n	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_ALPHAMAP\n\n	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_LIGHTMAP\n\n	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_AOMAP\n\n	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_BUMPMAP\n\n	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_NORMALMAP\n\n	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_DISPLACEMENTMAP\n\n	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_EMISSIVEMAP\n\n	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_METALNESSMAP\n\n	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_ROUGHNESSMAP\n\n	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_ANISOTROPYMAP\n\n	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_CLEARCOATMAP\n\n	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n\n	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n\n	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_IRIDESCENCEMAP\n\n	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n\n	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_SHEEN_COLORMAP\n\n	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_SHEEN_ROUGHNESSMAP\n\n	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_SPECULARMAP\n\n	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_SPECULAR_COLORMAP\n\n	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_SPECULAR_INTENSITYMAP\n\n	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_TRANSMISSIONMAP\n\n	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;\n\n#endif\n#ifdef USE_THICKNESSMAP\n\n	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;\n\n#endif\n",
    "worldpos_vertex": "#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0\n\n	vec4 worldPosition = vec4( transformed, 1.0 );\n\n	#ifdef USE_BATCHING\n\n		worldPosition = batchingMatrix * worldPosition;\n\n	#endif\n\n	#ifdef USE_INSTANCING\n\n		worldPosition = instanceMatrix * worldPosition;\n\n	#endif\n\n	worldPosition = modelMatrix * worldPosition;\n\n#endif\n"
  };
  var THREE_PHYSICAL = {
    "vertex": "#define STANDARD\n\nvarying vec3 vViewPosition;\n\n#ifdef USE_TRANSMISSION\n\n	varying vec3 vWorldPosition;\n\n#endif\n\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\n\nvoid main() {\n\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphinstance_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n\n	vViewPosition = - mvPosition.xyz;\n\n	#include <worldpos_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n\n#ifdef USE_TRANSMISSION\n\n	vWorldPosition = worldPosition.xyz;\n\n#endif\n}\n",
    "fragment": "#define STANDARD\n\n#ifdef PHYSICAL\n	#define IOR\n	#define USE_SPECULAR\n#endif\n\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform float roughness;\nuniform float metalness;\nuniform float opacity;\n\n#ifdef IOR\n	uniform float ior;\n#endif\n\n#ifdef USE_SPECULAR\n	uniform float specularIntensity;\n	uniform vec3 specularColor;\n\n	#ifdef USE_SPECULAR_COLORMAP\n		uniform sampler2D specularColorMap;\n	#endif\n\n	#ifdef USE_SPECULAR_INTENSITYMAP\n		uniform sampler2D specularIntensityMap;\n	#endif\n#endif\n\n#ifdef USE_CLEARCOAT\n	uniform float clearcoat;\n	uniform float clearcoatRoughness;\n#endif\n\n#ifdef USE_DISPERSION\n	uniform float dispersion;\n#endif\n\n#ifdef USE_IRIDESCENCE\n	uniform float iridescence;\n	uniform float iridescenceIOR;\n	uniform float iridescenceThicknessMinimum;\n	uniform float iridescenceThicknessMaximum;\n#endif\n\n#ifdef USE_SHEEN\n	uniform vec3 sheenColor;\n	uniform float sheenRoughness;\n\n	#ifdef USE_SHEEN_COLORMAP\n		uniform sampler2D sheenColorMap;\n	#endif\n\n	#ifdef USE_SHEEN_ROUGHNESSMAP\n		uniform sampler2D sheenRoughnessMap;\n	#endif\n#endif\n\n#ifdef USE_ANISOTROPY\n	uniform vec2 anisotropyVector;\n\n	#ifdef USE_ANISOTROPYMAP\n		uniform sampler2D anisotropyMap;\n	#endif\n#endif\n\nvarying vec3 vViewPosition;\n\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <iridescence_fragment>\n#include <cube_uv_reflection_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_physical_pars_fragment>\n#include <fog_pars_fragment>\n#include <lights_pars_begin>\n#include <normal_pars_fragment>\n#include <lights_physical_pars_fragment>\n#include <transmission_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <clearcoat_pars_fragment>\n#include <iridescence_pars_fragment>\n#include <roughnessmap_pars_fragment>\n#include <metalnessmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\n\nvoid main() {\n\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <roughnessmap_fragment>\n	#include <metalnessmap_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <clearcoat_normal_fragment_begin>\n	#include <clearcoat_normal_fragment_maps>\n	#include <emissivemap_fragment>\n\n	// accumulation\n	#include <lights_physical_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n\n	// modulation\n	#include <aomap_fragment>\n\n	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;\n	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;\n\n	#include <transmission_fragment>\n\n	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;\n\n	#ifdef USE_SHEEN\n\n		// Sheen energy compensation approximation calculation can be found at the end of\n		// https://drive.google.com/file/d/1T0D1VSyR4AllqIJTQAraEIzjlb5h4FKH/view?usp=sharing\n		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );\n\n		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;\n\n	#endif\n\n	#ifdef USE_CLEARCOAT\n\n		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );\n\n		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );\n\n		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;\n\n	#endif\n\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n\n}\n"
  };

  // runtime/src/three.ts
  var threeChunks = THREE_CHUNKS;
  var LIGHT_NUMS = [
    "NUM_DIR_LIGHTS",
    "NUM_SPOT_LIGHTS",
    "NUM_SPOT_LIGHT_MAPS",
    "NUM_SPOT_LIGHT_COORDS",
    "NUM_RECT_AREA_LIGHTS",
    "NUM_POINT_LIGHTS",
    "NUM_HEMI_LIGHTS",
    "NUM_DIR_LIGHT_SHADOWS",
    "NUM_SPOT_LIGHT_SHADOWS",
    "NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS",
    "NUM_POINT_LIGHT_SHADOWS",
    "NUM_CLIPPING_PLANES",
    "UNION_CLIPPING_PLANES"
  ].map((n2) => `#define ${n2} 0`).join("\n");
  var COMMON_PREFIX = `#define HIGH_PRECISION
${LIGHT_NUMS}
// glslang 的 Vulkan 宽松规则里 average 是保留名，three 的 common 定义了同名函数
#define average pot3_average
#define texture2D texture
#define cameraPosition (pot_CameraPos.xyz)
#define isOrthographic (pot_Proj[3][3] > 0.5)
#define viewMatrix pot_View
`;
  var VERTEX_PREFIX = `${COMMON_PREFIX}#define attribute in
#define varying out
#define modelMatrix pot_Model
#define projectionMatrix pot_Proj
#define modelViewMatrix (pot_View * pot_Model)
#define normalMatrix (mat3(pot_View) * pot_NormalMatrix)
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec2 uv;
#if defined(USE_COLOR_ALPHA)
layout(location = 3) in vec4 color;
#elif defined(USE_COLOR)
layout(location = 3) in vec3 color;
#endif
#ifdef USE_TANGENT
layout(location = 4) in vec4 tangent;
#endif
out vec3 pot3_vWorldPos;
vec3 pot3_SrgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
`;
  var FRAGMENT_PREFIX = `${COMMON_PREFIX}#define varying in
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define gl_FragDepthEXT gl_FragDepth
#define textureCube texture
#define texture2DProj textureProj
#define texture2DLodEXT textureLod
#define texture2DProjLodEXT textureProjLod
#define textureCubeLodEXT textureLod
#define texture2DGradEXT textureGrad
#define texture2DProjGradEXT textureProjGrad
#define textureCubeGradEXT textureGrad
uniform float envMapIntensity;
in vec3 pot3_vWorldPos;
${THREE_CHUNKS.colorspace_pars_fragment}
vec4 linearToOutputTexel(vec4 value) { return value; }
float luminance(const in vec3 rgb) {
  const vec3 weights = vec3(0.2126729, 0.7151522, 0.0721750);
  return dot(weights, rgb);
}
#include <pot/lit>
`;
  function threePrefix(stage) {
    return stage === "vertex" ? VERTEX_PREFIX : FRAGMENT_PREFIX;
  }
  var THREE_OVERRIDES = {
    worldpos_vertex: `vec4 worldPosition = vec4( transformed, 1.0 );
worldPosition = modelMatrix * worldPosition;
pot3_vWorldPos = worldPosition.xyz;
`,
    // pot 的网格顶点色按 sRGB 存储，three 期望线性
    color_vertex: `#if defined( USE_COLOR_ALPHA )
	vColor = vec4( pot3_SrgbToLinear( color.rgb ), color.a );
#elif defined( USE_COLOR )
	vColor = pot3_SrgbToLinear( color.rgb );
#endif
`,
    fog_pars_vertex: "",
    fog_vertex: "",
    fog_pars_fragment: "",
    fog_fragment: `#ifdef USE_FOG
	gl_FragColor.rgb = pot_ApplyFog( gl_FragColor.rgb, pot3_vWorldPos );
#endif
`,
    lights_fragment_begin: `vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif

IncidentLight directLight;

#if defined( RE_Direct )
	// 太阳（pot_SunDir 为世界空间、指向光源；three 光色 = pot 光色 × π）
	directLight.direction = normalize( ( viewMatrix * vec4( pot_SunDir.xyz, 0.0 ) ).xyz );
	directLight.color = pot_SunColor.rgb * PI;
	#ifndef POT3_NO_SHADOW
	directLight.color *= pot_Shadow( pot3_vWorldPos );
	#endif
	directLight.visible = true;
	RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	// 附加光（点光、聚光，URP 衰减）
	int pot3LightCount = int( pot_LightCount.x + 0.5 );
	for ( int i = 0; i < 16; i ++ ) {
		if ( i >= pot3LightCount ) break;
		vec3 dl = pot_LightPos[ i ].xyz - pot3_vWorldPos;
		float d2 = max( dot( dl, dl ), 1e-4 );
		vec3 l = dl * inversesqrt( d2 );
		float f = d2 * pot_LightPos[ i ].w;
		float sm = clamp( 1.0 - f * f, 0.0, 1.0 );
		float sp = clamp( dot( pot_LightSpot[ i ].xyz, l ) * pot_LightAtten[ i ].x + pot_LightAtten[ i ].y, 0.0, 1.0 );
		float att = sm * sm / d2 * sp * sp;
		if ( att <= 0.0 ) continue;
		directLight.direction = normalize( ( viewMatrix * vec4( l, 0.0 ) ).xyz );
		directLight.color = pot_LightColor[ i ].rgb * ( PI * att );
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
#endif

#if defined( RE_IndirectDiffuse )
	// 环境光按 scene.environment 的方式进入 iblIrradiance（π × 环境辐亮度）
	vec3 iblIrradiance = PI * pot_Hemisphere( inverseTransformDirection( geometryNormal, viewMatrix ) );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
#endif

#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif
`,
    lights_fragment_maps: `#if defined( RE_IndirectSpecular )
	{
		vec3 pot3R = reflect( - geometryViewDir, geometryNormal );
		pot3R = normalize( mix( pot3R, geometryNormal, material.roughness * material.roughness ) );
		radiance += pot_EnvReflection( inverseTransformDirection( pot3R, viewMatrix ), material.roughness ) * envMapIntensity;
		#ifdef USE_CLEARCOAT
		vec3 pot3C = reflect( - geometryViewDir, geometryClearcoatNormal );
		clearcoatRadiance += pot_EnvReflection( inverseTransformDirection( pot3C, viewMatrix ), material.clearcoatRoughness ) * envMapIntensity;
		#endif
	}
#endif
`
  };
  function threeInclude(name) {
    return THREE_OVERRIDES[name] ?? THREE_CHUNKS[name];
  }
  function linearRgb(c) {
    const s2l = (v) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    if (typeof c === "number") return [s2l((c >> 16 & 255) / 255), s2l((c >> 8 & 255) / 255), s2l((c & 255) / 255)];
    if (typeof c === "string") {
      const [r, g, b] = parseColor(c);
      return [s2l(r), s2l(g), s2l(b)];
    }
    return [c[0], c[1], c[2]];
  }
  var MAPS = [
    ["map", "MAP"],
    ["normalMap", "NORMALMAP"],
    ["roughnessMap", "ROUGHNESSMAP"],
    ["metalnessMap", "METALNESSMAP"],
    ["aoMap", "AOMAP"],
    ["emissiveMap", "EMISSIVEMAP"],
    ["alphaMap", "ALPHAMAP"]
  ];
  function buildStandard(o) {
    const defines = {};
    const uniforms = {
      diffuse: { value: linearRgb(o.color ?? 16777215) },
      opacity: { value: o.opacity ?? 1 },
      roughness: { value: o.roughness ?? 1 },
      metalness: { value: o.metalness ?? 0 },
      emissive: { value: linearRgb(o.emissive ?? 0).map((v) => v * (o.emissiveIntensity ?? 1)) },
      envMapIntensity: { value: o.envMapIntensity ?? 1 }
    };
    const [rx, ry] = o.repeat ?? [1, 1];
    const [ox, oy] = o.offset ?? [0, 0];
    const transform = [rx, 0, 0, 0, ry, 0, ox, oy, 1];
    for (const [key, macro] of MAPS) {
      const tex = o[key];
      if (!tex) continue;
      defines[`USE_${macro}`] = true;
      defines[`${macro}_UV`] = "uv";
      uniforms[key] = { value: tex };
      uniforms[`${key}Transform`] = { value: transform };
    }
    if (o.normalMap) {
      defines.USE_NORMALMAP_TANGENTSPACE = true;
      const s = o.normalScale ?? 1;
      uniforms.normalScale = { value: typeof s === "number" ? [s, s] : s };
    }
    if (o.aoMap) uniforms.aoMapIntensity = { value: o.aoMapIntensity ?? 1 };
    if (o.vertexColors) defines[o.vertexColors === "alpha" ? "USE_COLOR_ALPHA" : "USE_COLOR"] = true;
    if (o.alphaTest) {
      defines.USE_ALPHATEST = true;
      uniforms.alphaTest = { value: o.alphaTest };
    }
    if (!o.transparent) defines.OPAQUE = true;
    if (o.fog !== false) defines.USE_FOG = true;
    if (o.flatShading) defines.FLAT_SHADED = true;
    if (o.side === "double") defines.DOUBLE_SIDED = true;
    if (o.side === "back") defines.FLIP_SIDED = true;
    if (o.receiveShadow === false) defines.POT3_NO_SHADOW = true;
    Object.assign(defines, o.defines);
    for (const [k, v] of Object.entries(o.uniforms ?? {})) {
      uniforms[k] = v !== null && typeof v === "object" && "value" in v && !(v instanceof Texture) ? v : { value: v };
    }
    const shader = { vertexShader: THREE_PHYSICAL.vertex, fragmentShader: THREE_PHYSICAL.fragment, uniforms, defines };
    o.onBeforeCompile?.(shader);
    const state = {
      cull: o.side === "double" ? "none" : o.side === "back" ? "front" : "back",
      blend: o.transparent ? "alpha" : "none",
      queue: o.transparent ? "transparent" : "opaque",
      depthWrite: o.depthWrite ?? true,
      depthTest: o.depthTest ?? true,
      shadows: o.castShadow ?? true
    };
    if (o.polygonOffset) state.polygonOffset = [o.polygonOffsetFactor ?? 0, o.polygonOffsetUnits ?? 0];
    return { shader, state };
  }
  function resolveUniforms(uniforms) {
    const out = {};
    for (const [k, u] of Object.entries(uniforms)) {
      const v = u?.value;
      if (v === void 0) continue;
      if (v !== null && typeof v === "object" && !(v instanceof Texture) && !ArrayLikeCheck(v)) {
        if ("r" in v) out[k] = [v.r, v.g, v.b];
        else if ("x" in v) out[k] = "w" in v ? [v.x, v.y, v.z, v.w] : "z" in v ? [v.x, v.y, v.z] : [v.x, v.y];
        else if ("elements" in v) out[k] = v.elements;
        continue;
      }
      out[k] = v;
    }
    return out;
  }
  function ArrayLikeCheck(v) {
    return Array.isArray(v) || ArrayBuffer.isView(v);
  }

  // runtime/src/gfx.ts
  var MAX_VERTEX_INPUTS = 11;
  function vertexInputs(attributes, instanced) {
    const lines = [];
    const seen = /* @__PURE__ */ new Set();
    const add = (group, instance) => {
      for (const [name, type] of Object.entries(group ?? {})) {
        if (!/^[A-Za-z_]\w*$/.test(name) || name.startsWith("pot_") || name.startsWith("gl_")) throw new Error(`gfx.shader：顶点属性名 ${name} 不合法`);
        if (seen.has(name)) throw new Error(`gfx.shader：顶点属性 ${name} 重复声明`);
        if (!["float", "vec2", "vec3", "vec4"].includes(type)) throw new Error(`gfx.shader：顶点属性 ${name} 的类型须为 float / vec2 / vec3 / vec4`);
        seen.add(name);
        lines.push(`layout(location = ${5 + lines.length}) in ${type} ${name};${instance ? " // pot:instance" : ""}`);
      }
    };
    add(attributes, false);
    add(instanced, true);
    if (lines.length > MAX_VERTEX_INPUTS) throw new Error(`gfx.shader：自定义与实例属性合计最多 ${MAX_VERTEX_INPUTS} 个，给了 ${lines.length} 个`);
    return lines.join("\n");
  }
  var PostChain = class {
    constructor(_apply, _dispose) {
      __publicField(this, "_apply", _apply);
      __publicField(this, "_dispose", _dispose);
      /** @internal */
      __publicField(this, "_shared", 0);
      /** @internal */
      __publicField(this, "_binds", []);
      /** @internal */
      __publicField(this, "_active", false);
      /** @internal */
      __publicField(this, "_names", []);
      /** @internal */
      __publicField(this, "_disabled", /* @__PURE__ */ new Set());
      /** @internal */
      __publicField(this, "_send");
    }
    /** 当前是否生效 */
    get active() {
      return this._active;
    }
    /** 更新共享 uniform */
    set(values) {
      if (this._active) this._apply(this._shared, values);
      return this;
    }
    /** 更新第 index 个 pass 的 uniform */
    setPass(index, values) {
      if (this._active && this._binds[index] !== void 0) this._apply(this._binds[index], values);
      return this;
    }
    /** @internal */
    _resolve(which) {
      const list = Array.isArray(which) ? which : [which];
      const out = [];
      for (const w of list) {
        if (typeof w === "number") {
          if (!Number.isInteger(w) || w < 0 || w >= this._names.length) throw new Error(`PostChain：pass 下标越界：${w}`);
          out.push(w);
        } else {
          const hit = this._names.flatMap((n2, i) => n2 === w ? [i] : []);
          if (!hit.length) throw new Error(`PostChain：没有名为 ${w} 的 pass`);
          out.push(...hit);
        }
      }
      return out;
    }
    /**
     * 开关 pass：下标、pass 的 name（同名的一组一起开关，如 'bloom'）或它们的数组。
     * 关闭的 pass 不执行；它写的普通目标被清成透明黑（下游读到 0），history 目标保留上次结果，写 screen 的则画面保持上一步。
     * 也可以在 gfx.post 的 pass 上写 enabled: false 作为初始状态。
     */
    enable(which, on = true) {
      for (const i of this._resolve(which)) {
        if (on === !this._disabled.has(i)) continue;
        if (on) this._disabled.delete(i);
        else this._disabled.add(i);
        if (this._active) this._send?.(i, on);
      }
      return this;
    }
    /** pass 是否开启（同名多个时全部开启才为 true） */
    enabled(which) {
      return this._resolve(which).every((i) => !this._disabled.has(i));
    }
    destroy() {
      return this._dispose?.();
    }
  };
  var Shader = class {
    constructor(name, error, _dispose) {
      __publicField(this, "name", name);
      __publicField(this, "error", error);
      __publicField(this, "_dispose", _dispose);
    }
    /** 本次编译是否成功（失败时若有同名旧程序，画面仍用旧程序） */
    get ok() {
      return !this.error;
    }
    destroy() {
      return this._dispose?.();
    }
  };
  var StandardMaterial = class {
    constructor(shader, uniforms, state) {
      __publicField(this, "shader", shader);
      __publicField(this, "uniforms", uniforms);
      __publicField(this, "state", state);
    }
    get ok() {
      return this.shader.ok;
    }
    /** 取 uniform 当前值生成绑定；extra 覆盖默认状态（如 frustumCull、queue） */
    binding(extra = {}) {
      return { ...this.state, ...extra, uniforms: { ...resolveUniforms(this.uniforms), ...extra.uniforms } };
    }
    /** 当前 uniform 值（用于 entity.uniforms 刷新共享 uniform，如 uRain） */
    values(...names) {
      const all = resolveUniforms(this.uniforms);
      if (!names.length) return all;
      const out = {};
      for (const n2 of names) if (n2 in all) out[n2] = all[n2];
      return out;
    }
    destroy() {
      return this.shader.destroy();
    }
  };
  var BUILTIN_UNIFORMS = `uniform mat4 pot_Model;
uniform mat4 pot_ModelInv;
uniform mat3 pot_NormalMatrix;
uniform mat4 pot_View;
uniform mat4 pot_Proj;
uniform mat4 pot_ViewProj;
uniform vec4 pot_CameraPos;
uniform vec4 pot_Time;
uniform vec4 pot_ScreenSize;
uniform vec4 pot_SunDir;
uniform vec4 pot_SunColor;
uniform vec4 pot_AmbientSky;
uniform vec4 pot_AmbientEquator;
uniform vec4 pot_AmbientGround;
uniform vec4 pot_Fog;
uniform vec4 pot_Env;
uniform mat4 pot_ShadowMatrix[4];
uniform vec4 pot_ShadowSpheres[4];
uniform vec4 pot_ShadowParams;
uniform vec4 pot_FogParams;
uniform vec4 pot_Planar;
uniform mat4 pot_PlanarVP;
uniform vec4 pot_LightPos[16];
uniform vec4 pot_LightColor[16];
uniform vec4 pot_LightSpot[16];
uniform vec4 pot_LightAtten[16];
uniform vec4 pot_LightCount;
uniform mat4 pot_ScreenVP;
uniform mat4 pot_ScreenInvVP;
uniform vec4 pot_DepthParams;
uniform vec4 pot_Camera;
uniform vec4 pot_Resolution;
`;
  var HEADER = `#version 310 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp samplerCube;
`;
  var VERTEX_INPUTS = `layout(location = 0) in vec3 pot_Position;
layout(location = 1) in vec3 pot_Normal;
layout(location = 2) in vec2 pot_UV;
layout(location = 3) in vec4 pot_VertexColor;
layout(location = 4) in vec4 pot_Tangent;
`;
  var LIBRARY = {
    "pot/varyings": `#ifndef POT_VARYINGS
#define POT_VARYINGS
#ifdef POT_VERTEX
out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUV;
out vec4 vColor;
out vec4 vTangent;
#else
in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUV;
in vec4 vColor;
in vec4 vTangent;
#endif
#endif
`,
    "pot/standard.vert": `#include <pot/varyings>
void main() {
  vec4 world = pot_Model * vec4(pot_Position, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(pot_NormalMatrix * pot_Normal);
  vUV = pot_UV;
  vColor = pot_VertexColor;
  vTangent = vec4(normalize(mat3(pot_Model) * pot_Tangent.xyz), pot_Tangent.w);
  gl_Position = pot_ViewProj * world;
}
`,
    "pot/fullscreen.vert": `// gfx.bake 用：网格是裁剪空间的全屏四边形，UV 0..1（v=0 对应采样时的 v=0，已处理平台差异）
out vec2 vUv;
void main() {
  vUv = pot_UV;
  gl_Position = vec4(pot_Position.xy, 0.0, 1.0);
}
`,
    "pot/post": `#ifndef POT_POST
#define POT_POST
// 后处理 pass 用（gfx.post）：vUv 原点在左下，与 NDC 一致（ndc = vUv * 2 - 1）
// pot_ScreenSize 为本 pass 输出目标的 (宽, 高, 1/宽, 1/高)
in vec2 vUv;
// 深度纹理（inputs 里 'depth'）的原始值 → 0（近）..1（远），已处理 reversed Z
float pot_Depth01(float raw) {
  return pot_DepthParams.z > 0.5 ? 1.0 - raw : raw;
}
// 视空间距离（沿视线方向的深度，米）
float pot_EyeDepth(float raw) {
  float n = pot_DepthParams.x, f = pot_DepthParams.y;
  return n * f / (f - pot_Depth01(raw) * (f - n));
}
bool pot_IsSky(float raw) {
  return pot_Depth01(raw) >= 0.99999;
}
vec3 pot_WorldPos(vec2 uv, float raw) {
  vec4 p = pot_ScreenInvVP * vec4(uv * 2.0 - 1.0, pot_Depth01(raw) * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
// 从相机指向该像素的世界方向
vec3 pot_ViewDir(vec2 uv) {
  return normalize(pot_WorldPos(uv, 0.5) - pot_CameraPos.xyz);
}
// 世界坐标 → 屏幕 uv（z = 裁剪空间 w，<= 0 表示在相机后方）
vec3 pot_WorldToUv(vec3 p) {
  vec4 c = pot_ScreenVP * vec4(p, 1.0);
  return vec3(c.xy / max(abs(c.w), 1e-6) * 0.5 + 0.5, c.w);
}
#endif
`,
    "pot/depth": `#ifndef POT_DEPTH
#define POT_DEPTH
// 普通网格读场景深度（pot_SceneDepth = 不透明物体写出的 _CameraDepthTexture）
// 只在透明队列（shader 选项 queue: 'transparent'）可用；不透明队列与无深度纹理时读到"无限远"
// 世界坐标 → 屏幕 uv（与深度纹理同约定，已处理平台差异）
vec2 pot_SceneUv(vec3 worldPos) {
  vec4 c = pot_ScreenVP * vec4(worldPos, 1.0);
  return c.xy / max(abs(c.w), 1e-6) * 0.5 + 0.5;
}
// 原始深度 → 0（近）..1（远）
float pot_SceneDepth01(vec2 uv) {
  float raw = textureLod(pot_SceneDepth, uv, 0.0).r;
  return pot_DepthParams.z > 0.5 ? 1.0 - raw : raw;
}
// 该屏幕位置上不透明场景的视空间距离（米，透视相机）
float pot_SceneEyeDepth(vec2 uv) {
  float n = pot_DepthParams.x, f = pot_DepthParams.y;
  return n * f / (f - pot_SceneDepth01(uv) * (f - n));
}
// 世界坐标自身的视空间距离（米）
float pot_EyeDepthOf(vec3 worldPos) {
  return (pot_ScreenVP * vec4(worldPos, 1.0)).w;
}
// 软粒子：片元距背后不透明表面越近越透明，distance 为完全不透明所需的距离（米）
float pot_SoftFade(vec3 worldPos, float distance) {
  float d = pot_SceneEyeDepth(pot_SceneUv(worldPos)) - pot_EyeDepthOf(worldPos);
  return clamp(d / max(distance, 1e-4), 0.0, 1.0);
}
#endif
`,
    "pot/shadow": `#ifndef POT_SHADOW
#define POT_SHADOW
// 主光阴影（普通网格与 gfx.post 后处理均可用；后处理里配合 pot/post 的 pot_WorldPos 重建世界坐标）
// pot_ShadowParams: x 强度（0 表示本帧无阴影），y 级联数，z 最大距离，w 1 = reversed Z
float pot_ShadowCmp(ivec2 p, float z) {
  float d = texelFetch(pot_ShadowMap, p, 0).r;
  return pot_ShadowParams.w > 0.5 ? step(d, z) : step(z, d);
}

// 按级联包围球选级联；返回 -1 表示不在任何级联内（或本帧无阴影）
int pot_ShadowCascade(vec3 worldPos) {
  if (pot_ShadowParams.x <= 0.0) return -1;
  int count = int(pot_ShadowParams.y + 0.5);
  for (int i = 0; i < 4; i++) {
    if (i >= count) break;
    vec3 dv = worldPos - pot_ShadowSpheres[i].xyz;
    if (dot(dv, dv) < pot_ShadowSpheres[i].w * pot_ShadowSpheres[i].w) return i;
  }
  return -1;
}

// 1 = 全亮，0 = 全影。3x3 双线性 PCF，超出阴影距离淡出，已乘阴影强度
float pot_Shadow(vec3 worldPos) {
  int ci = pot_ShadowCascade(worldPos);
  if (ci < 0) return 1.0;
  vec4 sc = pot_ShadowMatrix[ci] * vec4(worldPos, 1.0);
  sc.xyz /= sc.w;
  ivec2 size = textureSize(pot_ShadowMap, 0);
  vec2 tc = sc.xy * vec2(size) - 0.5;
  ivec2 base = ivec2(floor(tc)) - 1;
  vec2 f = fract(tc);
  float sum = 0.0;
  for (int j = 0; j < 4; j++) {
    float wy = j == 0 ? 1.0 - f.y : (j == 3 ? f.y : 1.0);
    for (int i = 0; i < 4; i++) {
      float wx = i == 0 ? 1.0 - f.x : (i == 3 ? f.x : 1.0);
      ivec2 p = clamp(base + ivec2(i, j), ivec2(0), size - 1);
      sum += wx * wy * pot_ShadowCmp(p, sc.z);
    }
  }
  float lit = sum / 9.0;
  float dist = length(worldPos - pot_CameraPos.xyz);
  float fade = clamp((dist - pot_ShadowParams.z * 0.9) / max(pot_ShadowParams.z * 0.1, 1e-3), 0.0, 1.0);
  return mix(1.0, mix(1.0, lit, pot_ShadowParams.x), 1.0 - fade);
}

// 单次采样的太阳可见度（体积光 raymarch 用，开销低）：1 = 被照亮，0 = 在阴影中
// 不在级联内、超出最大阴影距离或本帧无阴影时返回 1；不乘阴影强度
float pot_SunVisibility(vec3 worldPos) {
  int ci = pot_ShadowCascade(worldPos);
  if (ci < 0) return 1.0;
  if (length(worldPos - pot_CameraPos.xyz) > pot_ShadowParams.z) return 1.0;
  vec4 sc = pot_ShadowMatrix[ci] * vec4(worldPos, 1.0);
  sc.xyz /= sc.w;
  ivec2 size = textureSize(pot_ShadowMap, 0);
  ivec2 p = clamp(ivec2(sc.xy * vec2(size)), ivec2(0), size - 1);
  return pot_ShadowCmp(p, sc.z);
}
#endif
`,
    "pot/lit": `#ifndef POT_LIT
#define POT_LIT
// 输出到 HDR 线性缓冲（后处理负责色调映射）；颜色常量多为 sRGB，用 pot_ToLinear 转换
struct PotSurface {
  vec3 albedo;     // 线性
  float metallic;
  float roughness;
  vec3 normal;     // 世界空间，已归一化
  vec3 emission;   // 线性，HDR
  float ao;
  float alpha;
  float planar;    // 平面反射权重 0..1（需 scene.reflection 启用；只对接近反射平面、朝上的表面有意义）
  float specular;  // 直射高光倍率（太阳与附加光，默认 1；如海面闪光按方位调制）
  float specularMax; // 直射高光上限（每个光源，线性 HDR；默认 1e4 即不限）
  vec2 planarOffset; // 平面反射采样的屏幕 uv 偏移（涟漪、风浪让倒影晃动；默认 0）
};

PotSurface pot_DefaultSurface(vec3 normal) {
  PotSurface s;
  s.albedo = vec3(0.8);
  s.metallic = 0.0;
  s.roughness = 0.5;
  s.normal = normal;
  s.emission = vec3(0.0);
  s.ao = 1.0;
  s.alpha = 1.0;
  s.planar = 0.0;
  s.specular = 1.0;
  s.specularMax = 1e4;
  s.planarOffset = vec2(0.0);
  return s;
}

vec3 pot_ToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 pot_ToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

const float POT_PI = 3.14159265359;

vec3 pot_Hemisphere(vec3 n) {
  float y = n.y;
  vec3 up = mix(pot_AmbientEquator.rgb, pot_AmbientSky.rgb, clamp(y, 0.0, 1.0));
  return mix(up, pot_AmbientGround.rgb, clamp(-y, 0.0, 1.0));
}

vec3 pot_EnvReflection(vec3 r, float roughness) {
  vec3 env = textureLod(pot_EnvMap, r, roughness * 6.0).rgb;
  return mix(pot_Hemisphere(r), env, pot_Env.y) * pot_Env.x;
}

// 雾（与 PotCommon.hlsl 一致）：pot_Fog = (线性颜色, 密度)，pot_FogParams = (高度衰减, 基准高度, 太阳散射, 0)
float pot_FogFactor(vec3 worldPos) {
  if (pot_Fog.w <= 0.0) return 1.0;
  vec3 c = pot_CameraPos.xyz;
  vec3 d = worldPos - c;
  float od = pot_Fog.w * length(d);
  if (pot_FogParams.x > 0.0) {
    float k = pot_FogParams.x;
    float f = exp(-k * max(c.y - pot_FogParams.y, -20.0));
    float kdy = k * d.y;
    float t = abs(kdy) > 1e-3 ? (1.0 - exp(-kdy)) / kdy : 1.0;
    od *= f * t;
  }
  return exp(-od * od);
}

vec3 pot_FogColor(vec3 viewDir) {
  float s = pow(clamp(dot(viewDir, normalize(pot_SunDir.xyz)), 0.0, 1.0), 8.0);
  return pot_Fog.rgb + pot_SunColor.rgb * (pot_FogParams.z * s);
}

vec3 pot_ApplyFog(vec3 color, vec3 worldPos) {
  return mix(pot_FogColor(normalize(worldPos - pot_CameraPos.xyz)), color, pot_FogFactor(worldPos));
}

// 平面反射（scene.reflection）：rgb = 镜像相机画面，a = 可用权重（未启用或远离反射平面时为 0）
// n 用于扰动采样位置（涟漪、法线贴图会让倒影晃动）；offset 为额外的屏幕 uv 偏移（量级 0.01..0.1）
vec4 pot_PlanarReflection(vec3 worldPos, vec3 n, float roughness, vec2 offset) {
  if (pot_Planar.x < 0.5) return vec4(0.0);
  float near = clamp(1.0 - abs(worldPos.y - pot_Planar.y) * 3.0, 0.0, 1.0);
  if (near <= 0.0) return vec4(0.0);
  float dist = length(worldPos - pot_CameraPos.xyz);
  vec3 p = worldPos + vec3(n.x, 0.0, n.z) * (0.05 * dist);
  vec4 c = pot_PlanarVP * vec4(p, 1.0);
  vec2 uv = clamp(c.xy / max(c.w, 1e-4) * 0.5 + 0.5 + offset, vec2(0.001), vec2(0.999));
  return vec4(textureLod(pot_PlanarMap, uv, roughness * 7.0).rgb, near);
}

vec4 pot_PlanarReflection(vec3 worldPos, vec3 n, float roughness) {
  return pot_PlanarReflection(worldPos, n, roughness, vec2(0.0));
}

#include <pot/shadow>

// 单个光源的直射项（GGX + Lambert，与 URP LightingPhysicallyBased 同量纲：乘 π 后对应 Unity 光强）
vec3 pot_BRDF(PotSurface s, vec3 n, vec3 v, vec3 l, vec3 f0) {
  vec3 h = normalize(l + v);
  float nl = max(dot(n, l), 0.0);
  float nv = max(dot(n, v), 1e-4);
  float nh = max(dot(n, h), 0.0);
  float vh = max(dot(v, h), 0.0);
  float a = max(s.roughness * s.roughness, 2e-3);
  float a2 = a * a;
  float dd = nh * nh * (a2 - 1.0) + 1.0;
  float D = a2 / (POT_PI * dd * dd);
  float k = (s.roughness + 1.0) * (s.roughness + 1.0) / 8.0;
  float G = (nl / (nl * (1.0 - k) + k)) * (nv / (nv * (1.0 - k) + k));
  vec3 F = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
  vec3 spec = D * G * F / max(4.0 * nl * nv, 1e-4);
  vec3 kd = (1.0 - F) * (1.0 - s.metallic);
  return (kd * s.albedo / POT_PI + spec * s.specular) * nl * POT_PI;
}

// 同 pot_BRDF，但把直射高光（乘光色后）截到 s.specularMax 以内（three.js 常见的 directSpecular 钳制）
vec3 pot_BRDFLight(PotSurface s, vec3 n, vec3 v, vec3 l, vec3 f0, vec3 lightColor) {
  if (s.specularMax >= 1e4) return pot_BRDF(s, n, v, l, f0) * lightColor;
  PotSurface d = s; d.specular = 0.0;
  vec3 diff = pot_BRDF(d, n, v, l, f0) * lightColor;
  PotSurface p = s; p.albedo = vec3(0.0); p.metallic = 1.0;
  // metallic=1、albedo=0 时 kd=0，但 f0 由调用方给出，只剩高光项
  vec3 spec = pot_BRDF(p, n, v, l, f0) * lightColor;
  return diff + min(spec, vec3(s.specularMax * s.specular));
}

// 附加光（场景里的点光、聚光；Runner 每个物体挑最多 16 个），衰减与 URP 相同
vec3 pot_AdditionalLights(PotSurface s, vec3 n, vec3 v, vec3 f0, vec3 worldPos) {
  vec3 sum = vec3(0.0);
  int count = int(pot_LightCount.x + 0.5);
  for (int i = 0; i < 16; i++) {
    if (i >= count) break;
    vec3 dl = pot_LightPos[i].xyz - worldPos;
    float d2 = max(dot(dl, dl), 1e-4);
    vec3 l = dl * inversesqrt(d2);
    float f = d2 * pot_LightPos[i].w;
    float sm = clamp(1.0 - f * f, 0.0, 1.0);
    float sp = clamp(dot(pot_LightSpot[i].xyz, l) * pot_LightAtten[i].x + pot_LightAtten[i].y, 0.0, 1.0);
    float att = sm * sm / d2 * sp * sp;
    if (att <= 0.0) continue;
    sum += pot_BRDFLight(s, n, v, l, f0, pot_LightColor[i].rgb) * att;
  }
  return sum;
}

// GGX 太阳光（含阴影）+ 点光/聚光 + 半球环境光 + 环境反射（可混入平面反射），不含雾
// 需要在雾之前叠加效果（如远处雾霭）时用它，最后自行 pot_ApplyFog
vec3 pot_LitColor(PotSurface s, vec3 worldPos) {
  vec3 n = normalize(s.normal);
  float r0 = s.roughness;
  // 镜面抗锯齿：法线在像素内的变化折算为粗糙度（同 three.js geometryRoughness），避免细碎法线在高光里闪烁
  vec3 dxy = max(abs(dFdx(n)), abs(dFdy(n)));
  s.roughness = min(max(s.roughness, 0.0525) + max(max(dxy.x, dxy.y), dxy.z), 1.0);
  vec3 v = normalize(pot_CameraPos.xyz - worldPos);
  vec3 f0 = mix(vec3(0.04), s.albedo, s.metallic);
  float nv = max(dot(n, v), 1e-4);
  vec3 direct = pot_BRDFLight(s, n, v, normalize(pot_SunDir.xyz), f0, pot_SunColor.rgb) * pot_Shadow(worldPos);
  direct += pot_AdditionalLights(s, n, v, f0, worldPos);
  vec3 fenv = f0 + (max(vec3(1.0 - s.roughness), f0) - f0) * pow(1.0 - nv, 5.0);
  vec3 ambient = (1.0 - s.metallic) * s.albedo * pot_Hemisphere(n) * s.ao;
  vec3 env = pot_EnvReflection(reflect(-v, n), s.roughness);
  if (s.planar > 0.0) {
    // 倒影用原始粗糙度：抗锯齿项会把涟漪处的 mip 拉高，倒影糊成一片
    vec4 pr = pot_PlanarReflection(worldPos, n, r0, s.planarOffset);
    env = mix(env, pr.rgb, clamp(s.planar * pr.a, 0.0, 1.0));
  }
  vec3 refl = env * fenv * s.ao;
  return direct + ambient + refl + s.emission;
}

// pot_LitColor + 雾
vec4 pot_Lit(PotSurface s, vec3 worldPos) {
  return vec4(pot_ApplyFog(pot_LitColor(s, worldPos), worldPos), s.alpha);
}
#endif
`
  };
  function normalize2(path) {
    const parts = [];
    for (const p of path.replace(/\\/g, "/").replace(/^data\//, "").split("/")) {
      if (!p || p === ".") continue;
      if (p === "..") parts.pop();
      else parts.push(p);
    }
    return parts.join("/");
  }
  function dirname(path) {
    const i = path.lastIndexOf("/");
    return i < 0 ? "" : path.slice(0, i + 1);
  }
  function preprocess(stage, entry, read, options = {}) {
    const files = ["(预置)"];
    const once = /* @__PURE__ */ new Set();
    const three = options.dialect === "three";
    const out = [HEADER.trimEnd()];
    out.push(`#define ${stage === "vertex" ? "POT_VERTEX" : "POT_FRAGMENT"} 1`);
    for (const [k, v] of Object.entries(options.defines ?? {})) {
      if (!/^[A-Za-z_]\w*$/.test(k)) throw new Error(`defines：非法的宏名 ${k}`);
      if (v === false) continue;
      out.push(v === true ? `#define ${k}` : `#define ${k} ${v}`);
    }
    out.push(BUILTIN_UNIFORMS.trimEnd());
    if (stage === "vertex") {
      if (!three) out.push(VERTEX_INPUTS.trimEnd());
      if (options.inputs) out.push(options.inputs);
    } else out.push("uniform samplerCube pot_EnvMap;\nuniform highp sampler2D pot_ShadowMap;\nuniform sampler2D pot_PlanarMap;\nuniform highp sampler2D pot_SceneDepth;");
    const expand = (name, text, depth, stack) => {
      if (depth > 16) throw new Error(`#include 嵌套过深：${stack.join(" → ")}`);
      const index = files.length;
      files.push(name);
      out.push(`#line 1 ${index}`);
      const lines = text.replace(/\r\n?/g, "\n").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*#\s*version\b/.test(line)) {
          out.push("");
          continue;
        }
        const m = /^\s*#\s*include\s+(?:<([^>]+)>|"([^"]+)")/.exec(line);
        if (!m) {
          out.push(line);
          continue;
        }
        let target;
        let body;
        let repeatable = false;
        if (m[1]) {
          target = `<${m[1]}>`;
          const chunk = three && !m[1].startsWith("pot/") ? threeInclude(m[1]) : void 0;
          if (chunk !== void 0) {
            body = chunk;
            repeatable = true;
          } else {
            const lib = LIBRARY[m[1]];
            if (lib === void 0) throw new Error(`${name}:${i + 1}: 未知的内置库 <${m[1]}>（可用：${Object.keys(LIBRARY).join("、")}${three ? "，以及 three 的 ShaderChunk" : ""}）`);
            body = lib;
          }
        } else {
          target = normalize2(dirname(name.startsWith("<") || name.startsWith("(") ? "" : name) + m[2]);
          if (stack.includes(target)) throw new Error(`${name}:${i + 1}: #include 循环：${[...stack, target].join(" → ")}`);
          body = read(target);
        }
        if (!repeatable && once.has(target) && m[1]) {
          out.push("");
          continue;
        }
        once.add(target);
        expand(target, body, depth + 1, [...stack, target]);
        out.push(`#line ${i + 2} ${index}`);
      }
    };
    if (three) expand("(three 前缀)", threePrefix(stage), 0, []);
    if (entry.path !== void 0) {
      const path = normalize2(entry.path);
      expand(path, read(path), 0, [path]);
    } else if (entry.source !== void 0) {
      expand(stage === "vertex" ? "(内联顶点着色器)" : "(内联片元着色器)", entry.source, 0, []);
    } else {
      const lib = entry.library ?? "pot/standard.vert";
      expand(`<${lib}>`, LIBRARY[lib], 0, []);
    }
    return { code: out.join("\n") + "\n", files };
  }
  function mapErrors(message, vs, fs) {
    const lines = message.split("\n");
    let current2;
    return lines.map((line) => {
      if (/^\[vertex\]/.test(line)) current2 = vs;
      else if (/^\[fragment\]/.test(line)) current2 = fs;
      else if (/^\[link\]|^\[mapIO\]/.test(line)) current2 = void 0;
      return line.replace(/(ERROR|WARNING): (\d+):(\d+):/g, (all, kind, file, row) => {
        const name = current2?.files[Number(file)];
        return name ? `${kind}: ${name}:${row}:` : all;
      });
    }).join("\n");
  }
  var GfxService = class extends Service {
    constructor(ctx, _host) {
      super(ctx, "gfx");
      __publicField(this, "_host", _host);
      /** 程序名 → 引用数（同名程序可被多个插件共享） */
      __publicField(this, "_refs", /* @__PURE__ */ new Map());
      __publicField(this, "_post");
      if (!this.backend) {
        ctx.logger("gfx").warn(`运行时着色器不可用：${this.unsupported || "未知原因"}。自定义着色器、three 材质、烘焙和后处理链不会生效，游戏应走回退画面`);
      }
    }
    /** 运行时着色器不可用的原因；可用时为空串 */
    get unsupported() {
      return this.backend ? "" : this._host.engine.gfxUnsupported?.() ?? "当前平台没有 pot_gfx 后端";
    }
    /** 后端名（d3d11 / metal / gles3）；为空表示当前平台不支持运行时着色器，原因见 unsupported */
    get backend() {
      return this._host.engine.gfxBackend();
    }
    get supported() {
      return !!this.backend;
    }
    /** 编译着色器程序。失败不抛错（返回的 Shader.error 为错误信息，并输出日志），以便热重载时保留旧画面 */
    shader(options) {
      const ctx = this.ctx;
      const read = (path) => ctx.data.text(path);
      const vertexEntry = { path: options.vertex, source: options.vertexSource, library: options.fullscreen ? "pot/fullscreen.vert" : void 0 };
      const fragmentEntry = { path: options.fragment, source: options.fragmentSource };
      if (fragmentEntry.path === void 0 && fragmentEntry.source === void 0) throw new Error("gfx.shader：需要 fragment 或 fragmentSource");
      if (options.dialect === "three" && options.vertex === void 0 && options.vertexSource === void 0) throw new Error("gfx.shader：three 方言需要 vertex 或 vertexSource");
      const defs = options.defines && Object.keys(options.defines).length ? `|${hash2(JSON.stringify(options.defines))}` : "";
      let inputs = "";
      let inputError = "";
      try {
        inputs = vertexInputs(options.attributes, options.instanced);
      } catch (e) {
        inputError = String(e?.message ?? e);
      }
      const ins = inputs ? `|in:${hash2(inputs)}` : "";
      const name = options.name ?? `${options.dialect ? `${options.dialect}:` : ""}${options.vertex ?? (options.vertexSource !== void 0 ? `inline:${hash2(options.vertexSource)}` : `<${vertexEntry.library ?? "pot/standard.vert"}>`)}|${options.fragment ?? `inline:${hash2(options.fragmentSource)}`}${defs}${ins}`;
      let error = inputError;
      let vs;
      let fs;
      if (!error) try {
        const pre = { dialect: options.dialect, defines: options.defines, inputs };
        vs = preprocess("vertex", vertexEntry, read, pre);
        fs = preprocess("fragment", fragmentEntry, read, pre);
      } catch (e) {
        error = String(e?.message ?? e);
      }
      const engine = this._host.engine;
      const clock = ctx.clock;
      const dispose = ctx.effect(() => {
        if (vs && fs) {
          const result = engine.gfxProgram(name, vs.code, fs.code);
          if (result) error = mapErrors(result, vs, fs);
        }
        if (error) ctx.logger("gfx").error("着色器 %s 编译失败：\n%s", name, error);
        this._refs.set(name, (this._refs.get(name) ?? 0) + 1);
        return () => this._release(name, clock);
      }, `gfx.shader(${name})`);
      return new Shader(name, error, dispose);
    }
    /**
     * MeshStandardMaterial 兼容材质：three r180 的 meshphysical 着色器原文（STANDARD），支持 onBeforeCompile 补丁。
     * 光照、阴影、环境、雾来自 pot 场景。返回的 binding() 可直接用于 entity.shader(m.shader, m.binding())。
     *
     *   const m = ctx.gfx.standard({ color: [0.016, 0.016, 0.0165], roughness: 0.5, metalness: 0.7, vertexColors: true,
     *     onBeforeCompile(s) { s.uniforms.uKind = { value: 1 }; s.fragmentShader = s.fragmentShader.replace(...) } })
     */
    standard(options = {}) {
      const { shader, state } = buildStandard(options);
      const vs = shader.vertexShader;
      const fs = shader.fragmentShader;
      const name = `three:${options.name ?? "standard"}:${hash2(`${vs}\0${fs}\0${JSON.stringify(shader.defines)}`)}`;
      const program = this.shader({ name, dialect: "three", vertexSource: vs, fragmentSource: fs, defines: shader.defines });
      return new StandardMaterial(program, shader.uniforms, state);
    }
    /**
     * 用全屏程序（shader({ fullscreen: true })）一次画到新建的贴图，返回每个目标一张 Texture（随调用方插件卸载销毁）。
     * 用于程序化材质、查找表、法线生成等：结果可当 material 的 map/normalMap/maskMap，也可作为下一次 bake 的输入。
     * 采样坐标与 vUv 一致（vUv.y=0 即贴图 v=0），无需关心平台的 UV 原点差异。
     */
    bake(shader, options) {
      const program = typeof shader === "string" ? shader : shader.name;
      if (typeof shader !== "string" && shader.error) throw new Error(`gfx.bake：着色器 ${program} 编译失败`);
      const width = Math.round(options.width);
      const height = Math.round(options.height ?? options.width);
      const targets = options.targets?.length ? options.targets : [{}];
      const spec = targets.map((t) => [
        t.format ?? "rgba8",
        t.mipmaps === false ? 0 : 1,
        t.wrap === "clamp" ? 1 : 0,
        t.filter === "point" ? 0 : t.filter === "bilinear" ? 1 : 2,
        t.aniso ?? 8
      ].join(",")).join(";");
      const blend = { none: 0, alpha: 1, add: 2, premultiplied: 3 }[options.blend ?? "none"];
      const engine = this._host.engine;
      let ids = [];
      const dispose = this.ctx.effect(() => {
        const bind2 = engine.gfxBakeBegin();
        if (options.uniforms) applyUniforms(engine, bind2, options.uniforms);
        const result = engine.gfxBake(bind2, program, width, height, spec, blend);
        if (result.startsWith("!")) throw new Error(`gfx.bake(${program})：${result.slice(1) || "失败"}`);
        ids = result.split(",").map(Number);
        return () => {
          for (const id of ids) engine.destroyTexture(id);
        };
      }, `gfx.bake(${program})`);
      return ids.map((id) => new Texture(id, width, height, dispose));
    }
    /**
     * 设置每帧后处理链：相机画面（HDR 线性）渲染完成后、URP 后处理之前依次执行各 pass（全屏程序）。
     * 链生效期间自动关闭 URP 自带后处理（色调映射、bloom 等由游戏自己实现）；最后一个写 'screen' 的 pass 应输出线性颜色。
     * `after: 'urp'` 时改为挂在 URP 后处理之后，不关闭 URP 后处理（与 scene.post 的景深、bloom 等共存）。
     * 随调用方插件卸载而关闭。
     */
    post(options) {
      const engine = this._host.engine;
      if (!options.passes?.length) throw new Error("gfx.post：至少需要一个 pass");
      if (options.after !== void 0 && options.after !== "scene" && options.after !== "urp") throw new Error(`gfx.post：after 只能是 'scene' 或 'urp'，收到 ${String(options.after)}`);
      const targets = options.targets ?? {};
      for (const name of Object.keys(targets)) {
        if (name === "scene" || name === "depth" || name === "screen") throw new Error(`gfx.post：目标名 ${name} 是保留名`);
      }
      const programs = options.passes.map((p, i) => {
        const name = typeof p.shader === "string" ? p.shader : p.shader.name;
        if (typeof p.shader !== "string" && p.shader.error) throw new Error(`gfx.post：pass ${i} 的着色器 ${name} 编译失败`);
        if (p.output !== "screen" && !(p.output in targets)) throw new Error(`gfx.post：pass ${i} 的输出目标不存在：${p.output}`);
        for (const [u, t] of Object.entries(p.inputs ?? {})) {
          if (typeof t === "string" && t !== "scene" && t !== "depth" && !(t in targets)) throw new Error(`gfx.post：pass ${i} 的输入 ${u} 指向不存在的目标：${t}`);
        }
        return name;
      });
      const apply = (id, values) => applyUniforms(engine, id, values);
      const chain = new PostChain(apply, () => dispose());
      chain._names = options.passes.map((p) => p.name);
      options.passes.forEach((p, i) => {
        if (p.enabled === false) chain._disabled.add(i);
      });
      chain._send = (i, on) => {
        const error = engine.gfxPostEnable(i, on);
        if (error) throw new Error(`gfx.post：${error}`);
      };
      const dispose = this.ctx.effect(() => {
        chain._shared = engine.gfxBakeBegin();
        if (options.uniforms) apply(chain._shared, options.uniforms);
        chain._binds = options.passes.map((p) => {
          const id = engine.gfxBakeBegin();
          if (p.uniforms) apply(id, p.uniforms);
          for (const [u, t] of Object.entries(p.inputs ?? {})) {
            if (typeof t !== "string") apply(id, { [u]: t });
          }
          return id;
        });
        const json2 = JSON.stringify({
          shared: chain._shared,
          stage: options.after === "urp" ? 1 : 0,
          targets: Object.entries(targets).map(([name, t]) => ({
            name,
            width: Math.round(t.width ?? 0),
            height: Math.round(t.height ?? t.width ?? 0),
            scale: t.scale ?? 1,
            format: t.format ?? "rgba16f",
            filter: t.filter === "point" ? 0 : 1,
            history: t.history ? 1 : 0
          })),
          passes: options.passes.map((p, i) => ({
            program: programs[i],
            output: p.output,
            inputs: Object.entries(p.inputs ?? {}).filter(([, t]) => typeof t === "string").map(([u, t]) => `${u}=${t}`),
            bind: chain._binds[i],
            blend: { none: 0, alpha: 1, add: 2, premultiplied: 3 }[p.blend ?? "none"]
          }))
        });
        const error = engine.gfxPost(json2);
        if (error) throw new Error(`gfx.post：${error}`);
        if (this._post) this._post._active = false;
        this._post = chain;
        chain._active = true;
        for (const i of chain._disabled) chain._send(i, false);
        return () => {
          if (this._post !== chain) return;
          chain._active = false;
          this._post = void 0;
          engine.gfxPost("");
        };
      }, "gfx.post");
      return chain;
    }
    /** 引用归零后延迟两帧再释放：热重载时新单元会先重新登记同名程序，旧程序得以平滑替换或在出错时保留 */
    _release(name, clock) {
      const n2 = (this._refs.get(name) ?? 1) - 1;
      if (n2 > 0) {
        this._refs.set(name, n2);
        return;
      }
      this._refs.delete(name);
      clock.waitFrames(2).then(() => {
        if (!this._refs.has(name)) this._host.engine.gfxDestroyProgram(name);
      });
    }
  };
  __publicField(GfxService, "inject", ["data", "clock"]);
  function hash2(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  // runtime/src/loading.ts
  var LoadingService = class extends Service {
    constructor(ctx, _host) {
      super(ctx, "loading");
      __publicField(this, "_host", _host);
      /** 0..1；小于 0 表示未知（外壳画不确定进度条） */
      __publicField(this, "progress", -1);
      __publicField(this, "text", "");
      /** 运行时启动期间为 true */
      __publicField(this, "active", false);
      /** 单次连续执行的时间预算（毫秒），超过后 step 让帧 */
      __publicField(this, "budget", 50);
      /** 本次启动/加载让出的帧数 */
      __publicField(this, "yields", 0);
      __publicField(this, "_waiters", []);
      __publicField(this, "_sliceStart", Date.now());
      __publicField(this, "_explicit", false);
    }
    /** 宿主是否按帧驱动（否则让帧是空操作） */
    get frames() {
      return !!this._host.frames;
    }
    /** 回报进度（不让帧）。progress 省略时保持不变；只在加载期间转发给宿主 */
    report(text, progress) {
      if (text !== void 0) this.text = text;
      if (progress !== void 0) {
        this.progress = Math.min(1, progress);
        this._explicit = true;
      }
      if (this.active) this._host.loading?.(this.progress, this.text);
    }
    /** 运行时在单元开始 apply 时调用：游戏没报过进度时，至少显示正在加载哪个单元 */
    unit(name) {
      if (!this.active || this._explicit) return;
      this.report(`加载 ${name}`);
    }
    /** 等到下一帧（宿主 pump 时继续） */
    frame() {
      if (!this._host.frames) return Promise.resolve();
      this.yields++;
      return new Promise((resolve) => this._waiters.push(resolve));
    }
    /** 回报进度；本帧连续执行超过 budget 时让出一帧 */
    step(text, progress) {
      this.report(text, progress);
      if (Date.now() - this._sliceStart < this.budget) return Promise.resolve();
      return this.frame();
    }
    /** 宿主每帧调用（Runtime.tick 与 Unity 启动期间） */
    pump() {
      this._sliceStart = Date.now();
      if (!this._waiters.length) return;
      const waiters = this._waiters;
      this._waiters = [];
      for (const resolve of waiters) resolve();
    }
    /** 运行时启动开始 */
    begin(text = "启动") {
      this.active = true;
      this._explicit = false;
      this.yields = 0;
      this.progress = -1;
      this._sliceStart = Date.now();
      this.report(text);
    }
    /** 运行时启动结束 */
    end() {
      this.report("完成", 1);
      this.active = false;
    }
  };

  // runtime/src/plugins.ts
  var CORE_SERVICES = ["clock", "timer", "state", "cache", "data", "scene", "input", "ui", "audio", "gfx", "loading", "world", "plugins"];
  function compileModule(code, filename) {
    const indirectEval = eval;
    return indirectEval(`(function (exports, require, module, __filename) {${code}
})
//# sourceURL=${filename}`);
  }
  function runModule(factory, filename, modules) {
    const module = { exports: {} };
    const require2 = (id) => {
      if (id in modules) return modules[id];
      throw new Error(`${filename}: 不支持 require("${id}")。游戏单元只能依赖 @pot/core，其余代码请由构建打包进单元`);
    };
    factory.call(module.exports, module.exports, require2, module, filename);
    return module.exports;
  }
  function resolvePlugin(name, exports) {
    let plugin = exports;
    if (typeof exports?.apply !== "function" && exports?.default) plugin = exports.default;
    const apply = typeof plugin === "function" ? plugin : plugin?.apply;
    if (typeof apply !== "function") {
      throw new Error(`单元 "${name}" 没有导出 apply(ctx, config)；请 export function apply(ctx) { ... }`);
    }
    if (typeof plugin === "object" && typeof plugin.name === "string" && plugin.name !== name) {
      throw new Error(`单元文件名是 "${name}"，但导出的 name 是 "${plugin.name}"，二者必须一致`);
    }
    return { plugin, apply };
  }
  function createUnit(name, exports, contentHash, source) {
    const { plugin, apply } = resolvePlugin(name, exports);
    const inject = Object.assign(Inject.resolve(CORE_SERVICES), Inject.resolve(plugin.inject));
    const unit = { name, hash: contentHash, exports, wrapper: null, mounts: /* @__PURE__ */ new Set(), source, errors: [] };
    unit.wrapper = {
      name: `unit:${name}`,
      inject,
      Config: plugin.Config,
      apply(ctx, config) {
        const fiber = ctx.fiber;
        markFiber(fiber, name);
        unit.mounts.add(fiber);
        ctx.effect(() => () => {
          unit.mounts.delete(fiber);
        }, "pot:mount");
        ctx.loading?.unit(name);
        try {
          const result = apply.call(plugin, ctx, config);
          if (result && typeof result.then === "function") {
            result.then(void 0, (error) => {
              unit.errors.push(error);
            });
          }
          return result;
        } catch (error) {
          unit.errors.push(error);
          throw error;
        }
      }
    };
    return unit;
  }
  var PluginsService = class extends Service {
    constructor(ctx, _host, _modules, loader) {
      super(ctx, "plugins");
      __publicField(this, "_host", _host);
      __publicField(this, "_modules", _modules);
      __publicField(this, "loader", loader);
      __publicField(this, "units", /* @__PURE__ */ new Map());
      __publicField(this, "_bundle");
      ctx.mixin("plugins", ["use"]);
    }
    /**
     * 发布期：bundle.cjs 是一个整体打包的模块，导出 { units: { 单元名: 模块导出 } }，共享代码只有一份。
     * WebGL/小游戏禁止 eval：构建时把 bundle.cjs 包成 globalThis.__potBundle = function (exports, require, module, __filename) {...}，
     * 由宿主以普通脚本预先加载（PotRuntime 用 ScriptEnv.ExecuteModule），这里直接拿工厂函数；没有时才读源码编译。
     */
    _getBundle() {
      if (this._bundle !== void 0) return this._bundle;
      this._bundle = null;
      const preloaded = globalThis.__potBundle;
      let factory;
      if (typeof preloaded === "function") factory = preloaded;
      else {
        const code = this._host.readText("bundle.cjs");
        if (code) factory = compileModule(code, "bundle.cjs");
      }
      if (factory) {
        const exports = runModule(factory, "bundle.cjs", this._modules);
        if (!exports?.units) throw new Error("bundle.cjs 格式不对（缺少 units），请用当前版本的 pot build 重新构建");
        this._bundle = exports.units;
      }
      return this._bundle;
    }
    /** 编译单元但不登记（热重载预加载用）。有源码（Runner）读源码，否则读发布包 bundle.cjs */
    compile(name) {
      const source = this.loader?.load(name, this._modules);
      if (source) return createUnit(name, source.exports, source.hash, source.source);
      const bundle = this._getBundle();
      if (bundle && Object.prototype.hasOwnProperty.call(bundle, name)) {
        return createUnit(name, bundle[name], `bundle:${name}`, "bundle.cjs");
      }
      throw new Error(`找不到单元 "${name}"（src/plugins/${name}.ts）`);
    }
    /** 取已加载的单元，未加载则编译并登记 */
    get(name) {
      let unit = this.units.get(name);
      if (!unit) {
        unit = this.compile(name);
        this.units.set(name, unit);
      }
      return unit;
    }
    /** 替换名字指向的版本（热重载用），返回旧版本 */
    swap(name, unit) {
      const old = this.units.get(name);
      if (unit) this.units.set(name, unit);
      else this.units.delete(name);
      return old;
    }
    /** 在调用方 ctx 下挂载单元 */
    use(name, config) {
      const unit = this.get(name);
      return this.ctx.plugin(unit.wrapper, config);
    }
    list() {
      return [...this.units.values()].map((u) => ({
        name: u.name,
        hash: u.hash,
        source: u.source,
        mounts: [...u.mounts].map((f) => ({ state: f.state, config: f.config }))
      }));
    }
  };

  // runtime/src/world/node.ts
  var Fragment = /* @__PURE__ */ Symbol.for("pot.fragment");
  var PREFAB = /* @__PURE__ */ Symbol.for("pot.prefab");
  var Node = class {
    constructor(type, key, props) {
      __publicField(this, "type", type);
      __publicField(this, "key", key);
      __publicField(this, "props", props);
    }
  };
  function makeNode(type, props, key, source) {
    const node = new Node(type, key === void 0 || key === null ? null : String(key), props ?? {});
    if (source) node.source = source;
    return node;
  }
  function isNode(value) {
    return value instanceof Node;
  }
  function isPrefab(value) {
    return typeof value === "function" && value[PREFAB] === true;
  }
  function nodeName(node) {
    const t = node.type;
    if (typeof t === "string") return t;
    if (t === Fragment) return "#fragment";
    if (isPrefab(t)) return t.prefab;
    return t.name || "anonymous";
  }
  function formatSource(source) {
    return source ? `${source.file}:${source.line}` : "";
  }
  function sourcePrefix(source) {
    return source ? `${formatSource(source)} ` : "";
  }

  // runtime/src/world/registry.ts
  var RESERVED = /* @__PURE__ */ new Set(["key", "at", "rot", "scale", "name", "tags", "children"]);
  var PREFAB_RESERVED = /* @__PURE__ */ new Set(["is", "tags"]);
  var IDENT = /^[a-z][A-Za-z0-9]*$/;
  function defineBlock(def) {
    if (!def || typeof def.name !== "string" || !IDENT.test(def.name)) {
      throw new Error(`defineBlock：积木名必须是小写开头的驼峰标识符，收到 ${JSON.stringify(def?.name)}`);
    }
    if (RESERVED.has(def.name) || PREFAB_RESERVED.has(def.name)) throw new Error(`defineBlock：积木名 "${def.name}" 是保留属性`);
    if (def.props !== void 0 && !isPlainObject2(def.props)) throw new Error(`defineBlock(${def.name})：props 必须是普通对象`);
    if (def.state !== void 0 && !isPlainObject2(def.state)) throw new Error(`defineBlock(${def.name})：state 必须是普通对象`);
    for (const key of Object.keys(def.state ?? {})) {
      if (def.props && key in def.props) throw new Error(`defineBlock(${def.name})：字段 "${key}" 同时出现在 props 与 state 里`);
    }
    return def;
  }
  function definePrefab(name, def = {}) {
    if (typeof name !== "string" || !IDENT.test(name)) throw new Error(`definePrefab：预制件名必须是小写开头的驼峰标识符，收到 ${JSON.stringify(name)}`);
    if (!isPlainObject2(def)) throw new Error(`definePrefab(${name})：定义必须是普通对象`);
    const prefab = ((props) => makeNode(prefab, props, props?.key));
    Object.defineProperty(prefab, "name", { value: name });
    Object.defineProperty(prefab, PREFAB, { value: true });
    Object.defineProperty(prefab, "prefab", { value: name, enumerable: true });
    Object.defineProperty(prefab, "def", { value: def, enumerable: true });
    return prefab;
  }
  var Registry = class {
    constructor() {
      __publicField(this, "_blocks", /* @__PURE__ */ new Map());
      __publicField(this, "_prefabs", /* @__PURE__ */ new Map());
      /** 名字第一次登记的序号，决定同 order 积木的先后 */
      __publicField(this, "_seen", /* @__PURE__ */ new Map());
      /** 内容变化时加一，供缓存失效 */
      __publicField(this, "version", 0);
    }
    /** 登记积木，返回撤销函数 */
    addBlock(def) {
      defineBlock(def);
      if (!this._seen.has(def.name)) this._seen.set(def.name, this._seen.size);
      return this._push(this._blocks, def.name, def);
    }
    /** 登记预制件，返回撤销函数 */
    addPrefab(prefab) {
      if (!isPrefab(prefab)) throw new Error("登记预制件：需要 definePrefab 的返回值");
      return this._push(this._prefabs, prefab.prefab, prefab);
    }
    _push(map, name, value) {
      let stack = map.get(name);
      if (!stack) map.set(name, stack = []);
      const entry = { value, token: {} };
      stack.push(entry);
      this.version++;
      return () => {
        const list = map.get(name);
        const i = list ? list.indexOf(entry) : -1;
        if (i < 0) return;
        list.splice(i, 1);
        if (!list.length) map.delete(name);
        this.version++;
      };
    }
    block(name) {
      const stack = this._blocks.get(name);
      return stack?.[stack.length - 1].value;
    }
    prefab(name) {
      const stack = this._prefabs.get(name);
      return stack?.[stack.length - 1].value;
    }
    /** 预制件链上的名字（从根到叶）；未知的预制件只返回它自己 */
    chain(name) {
      const out = [];
      let current2 = name;
      for (let guard = 0; current2 !== void 0 && guard < 32; guard++) {
        const p = typeof current2 === "string" ? this.prefab(current2) : current2;
        const n2 = typeof current2 === "string" ? current2 : current2.prefab;
        out.unshift(n2);
        current2 = p?.def.is;
      }
      return out;
    }
    blockNames() {
      return [...this._blocks.keys()];
    }
    prefabNames() {
      return [...this._prefabs.keys()];
    }
    /** 按执行顺序排好的积木 */
    ordered() {
      return [...this._blocks.keys()].map((name) => this.block(name)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || this._seen.get(a.name) - this._seen.get(b.name));
    }
  };
  function isPlainObject2(value) {
    if (!value || typeof value !== "object") return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isPlainObject2(value)) {
      const out = {};
      for (const key of Object.keys(value)) out[key] = clone(value[key]);
      return out;
    }
    return value;
  }
  function merge(base, over) {
    if (over === void 0) return clone(base);
    if (isPlainObject2(base) && isPlainObject2(over)) {
      const out = clone(base);
      for (const key of Object.keys(over)) out[key] = merge(base[key], over[key]);
      return out;
    }
    return clone(over);
  }

  // runtime/src/world/tree.ts
  var BUILTIN_TAGS = ["rule", "stage"];
  var EVENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
  var BUILTIN_EVENTS = ["touch", "death", "every"];
  function distance(a, b) {
    const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = dp[j];
        dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1));
        prev = tmp;
      }
    }
    return dp[b.length];
  }
  function similar(name, candidates) {
    const limit = name.length <= 4 ? 1 : 2;
    const list = candidates.map((c) => ({ c, d: distance(name, c) })).filter(({ c, d }) => d <= limit || c.toLowerCase().startsWith(name.toLowerCase()) || name.toLowerCase().startsWith(c.toLowerCase())).sort((x, y) => x.d - y.d).slice(0, 3).map(({ c }) => c);
    return list.length ? `，是不是 ${list.join("、")}？` : "";
  }
  function isVec3(v) {
    return Array.isArray(v) && v.length === 3 && v.every((n2) => typeof n2 === "number" && Number.isFinite(n2));
  }
  function flatChildren(children) {
    const out = [];
    const walk = (c) => {
      if (Array.isArray(c)) c.forEach(walk);
      else if (c !== null && c !== void 0 && c !== false && c !== true && c !== "") out.push(c);
    };
    walk(children);
    return out;
  }
  function evaluate(root, registry) {
    const result = { entities: [], rules: [], stage: null, prefabs: [] };
    const errors = [];
    const paths = /* @__PURE__ */ new Map();
    const usedPrefabs = /* @__PURE__ */ new Set();
    const segment = (layer, name, key) => {
      if (key !== null) return `${name}:${key}`;
      const n2 = layer.counts.get(name) ?? 0;
      layer.counts.set(name, n2 + 1);
      return `${name}#${n2}`;
    };
    const join = (layer, seg) => layer.prefix ? `${layer.prefix}/${seg}` : seg;
    const claim = (path, node) => {
      if (paths.has(path)) {
        const first = paths.get(path);
        errors.push(`${sourcePrefix(node.source)}重复的 key 路径 "${path}"${first ? `（第一次出现在 ${first.file}:${first.line}）` : ""}：同一层的同名标签请用不同的 key 区分，或包一层带 key 的片段`);
        return false;
      }
      paths.set(path, node.source);
      return true;
    };
    const visit = (child, layer, depth) => {
      if (child === null || child === void 0 || child === true || child === false || child === "") return;
      if (depth > 64) {
        errors.push("场景树嵌套超过 64 层，可能是函数组件递归");
        return;
      }
      if (Array.isArray(child)) {
        for (const c of child) visit(c, layer, depth + 1);
        return;
      }
      if (typeof child === "string" || typeof child === "number") {
        errors.push(`${sourcePrefix(layer.source)}场景树里不能有文本：${JSON.stringify(child)}`);
        return;
      }
      if (!isNode(child)) {
        errors.push(`${sourcePrefix(layer.source)}场景树里不能有 ${Object.prototype.toString.call(child)}，只能是标签、数组或 null`);
        return;
      }
      const node = child;
      const type = node.type;
      if (type === Fragment) {
        if (node.key === null) visit(node.props.children, { ...layer, source: node.source }, depth + 1);
        else {
          const prefix = join(layer, `#${node.key}`);
          visit(node.props.children, { prefix, counts: /* @__PURE__ */ new Map(), source: node.source }, depth + 1);
        }
        return;
      }
      if (typeof type === "function" && !isPrefab(type)) {
        const name = nodeName(node);
        const prefix = join(layer, segment(layer, name, node.key));
        let out;
        try {
          out = type(node.props);
        } catch (error) {
          errors.push(`${sourcePrefix(node.source)}函数组件 ${name} 出错：${error?.message ?? error}`);
          return;
        }
        visit(out, { prefix, counts: /* @__PURE__ */ new Map(), source: node.source }, depth + 1);
        return;
      }
      if (type === "rule") return rule(node, layer);
      if (type === "stage") return stage(node);
      let prefab;
      if (isPrefab(type)) {
        prefab = type;
        if (!usedPrefabs.has(type)) {
          usedPrefabs.add(type);
          result.prefabs.push(type);
        }
      } else if (typeof type === "string") {
        prefab = registry.prefab(type);
        if (!prefab) {
          errors.push(`${sourcePrefix(node.source)}未知的标签 <${type}>${similar(type, [...registry.prefabNames(), ...BUILTIN_TAGS])}`);
          return;
        }
      } else {
        errors.push(`${sourcePrefix(node.source)}无法识别的标签类型`);
        return;
      }
      const path = join(layer, segment(layer, prefab.prefab, node.key));
      if (!claim(path, node)) return;
      const spec = entity2(node, prefab, path);
      if (spec) result.entities.push(spec);
    };
    const chainOf = (prefab, node) => {
      const chain = [];
      let current2 = prefab;
      while (current2 !== void 0) {
        const p = typeof current2 === "string" ? registry.prefab(current2) : current2;
        if (!p) {
          errors.push(`${sourcePrefix(node.source)}预制件 ${chain[0]?.prefab ?? prefab.prefab} 继承的 "${current2}" 没有登记${similar(String(current2), registry.prefabNames())}`);
          return null;
        }
        if (chain.includes(p) || chain.length > 32) {
          errors.push(`${sourcePrefix(node.source)}预制件 ${prefab.prefab} 的 is 链有循环`);
          return null;
        }
        chain.unshift(p);
        current2 = p.def.is;
      }
      return chain;
    };
    const apply = (acc, tags, values, reserved, where) => {
      let ok = true;
      for (const key of Object.keys(values)) {
        if (key === "tags") {
          const list = values.tags;
          if (list === void 0) continue;
          if (!Array.isArray(list) || list.some((t) => typeof t !== "string")) {
            errors.push(`${where}tags 必须是字符串数组`);
            ok = false;
          } else list.forEach((t) => tags.add(t));
          continue;
        }
        if (reserved.has(key)) continue;
        const block = registry.block(key);
        if (!block) {
          errors.push(`${where}未知的积木 ${key}${similar(key, registry.blockNames())}`);
          ok = false;
          continue;
        }
        const value = values[key];
        if (value === false || value === null) {
          delete acc[key];
          continue;
        }
        if (value === void 0) continue;
        const over = value === true ? {} : value;
        if (!isPlainObject2(over)) {
          errors.push(`${where}积木 ${key} 的值必须是对象（或 true 表示用默认值、false 表示去掉）`);
          ok = false;
          continue;
        }
        const fields = block.props ?? {};
        for (const field of Object.keys(over)) {
          if (!(field in fields)) {
            errors.push(`${where}积木 ${key} 没有字段 ${field}${similar(field, Object.keys(fields))}`);
            ok = false;
          }
        }
        acc[key] = merge(acc[key] ?? {}, over);
      }
      return ok;
    };
    const entity2 = (node, prefab, path) => {
      const where = sourcePrefix(node.source);
      const props = node.props;
      if (flatChildren(props.children).length) {
        errors.push(`${where}<${prefab.prefab}> 有子节点：M1 的实体是平的，不支持子节点`);
        return null;
      }
      const chain = chainOf(prefab, node);
      if (!chain) return null;
      const acc = {};
      const tags = /* @__PURE__ */ new Set();
      let ok = true;
      for (const p of chain) ok = apply(acc, tags, p.def, PREFAB_RESERVED, `${where}预制件 ${p.prefab}：`) && ok;
      ok = apply(acc, tags, props, RESERVED, where) && ok;
      const vec = (name, value, fallback) => {
        if (value === void 0) return [...fallback];
        if (!isVec3(value)) {
          errors.push(`${where}${name} 必须是三个有限数 [x, y, z]，收到 ${JSON.stringify(value)}`);
          ok = false;
          return [...fallback];
        }
        return [value[0], value[1], value[2]];
      };
      const at = vec("at", props.at, [0, 0, 0]);
      const rot = vec("rot", props.rot, [0, 0, 0]);
      const scale = typeof props.scale === "number" && Number.isFinite(props.scale) ? [props.scale, props.scale, props.scale] : vec("scale", props.scale, [1, 1, 1]);
      if (props.name !== void 0 && typeof props.name !== "string") {
        errors.push(`${where}name 必须是字符串`);
        ok = false;
      }
      if (!ok) return null;
      const blocks = {};
      for (const name of Object.keys(acc)) {
        const block = registry.block(name);
        blocks[name] = merge(clone(block.props ?? {}), acc[name]);
      }
      const spec = { path, prefab: prefab.prefab, at, rot, scale, tags: [...tags], blocks };
      if (props.name !== void 0) spec.name = props.name;
      if (node.source) spec.source = node.source;
      return spec;
    };
    const rule = (node, layer) => {
      const where = sourcePrefix(node.source);
      const p = node.props;
      const path = join(layer, segment(layer, "rule", node.key));
      if (!claim(path, node)) return;
      if (typeof p.on !== "string" || !(BUILTIN_EVENTS.includes(p.on) || EVENT.test(p.on))) {
        errors.push(`${where}<rule> 未知的事件 ${JSON.stringify(p.on)}：可用 touch、death、every 或自定义事件名（标识符）`);
        return;
      }
      if (typeof p.do !== "function") {
        errors.push(`${where}<rule on="${p.on}"> 缺少 do 函数`);
        return;
      }
      if (p.on === "every" && !(typeof p.seconds === "number" && p.seconds > 0)) {
        errors.push(`${where}<rule on="every"> 需要正数 seconds`);
        return;
      }
      const filter = (v) => v === void 0 ? void 0 : isPrefab(v) ? v.prefab : String(v);
      const spec = { path, on: p.on, do: p.do };
      const a = filter(p.a), b = filter(p.b);
      if (a !== void 0) spec.a = a;
      if (b !== void 0) spec.b = b;
      if (p.seconds !== void 0) spec.seconds = p.seconds;
      if (node.source) spec.source = node.source;
      result.rules.push(spec);
    };
    const stage = (node) => {
      if (result.stage) {
        errors.push(`${sourcePrefix(node.source)}一棵场景树只能有一个 <stage>${result.stage.source ? `（第一个在 ${result.stage.source.file}:${result.stage.source.line}）` : ""}`);
        return;
      }
      const { children, ...rest } = node.props;
      const spec = clone(rest);
      if (node.source) spec.source = node.source;
      result.stage = spec;
    };
    visit(root, { prefix: "", counts: /* @__PURE__ */ new Map() }, 0);
    if (errors.length) {
      const error = new Error(errors.join("\n"));
      error.errors = errors;
      throw error;
    }
    return result;
  }

  // runtime/src/world/collide.ts
  var GRID_THRESHOLD = 256;
  var GRID_CELL = 4;
  function overlap(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    if (!a.box && !b.box) {
      const r = a.r + b.r;
      return dx * dx + dy * dy + dz * dz < r * r;
    }
    if (a.box && b.box) {
      return Math.abs(dx) < a.box[0] + b.box[0] && Math.abs(dy) < a.box[1] + b.box[1] && Math.abs(dz) < a.box[2] + b.box[2];
    }
    const sphere = a.box ? b : a;
    const box = a.box ? a : b;
    const [hx, hy, hz] = box.box;
    const cx = clamp(sphere.x, box.x - hx, box.x + hx) - sphere.x;
    const cy = clamp(sphere.y, box.y - hy, box.y + hy) - sphere.y;
    const cz = clamp(sphere.z, box.z - hz, box.z + hz) - sphere.z;
    const d2 = cx * cx + cy * cy + cz * cz;
    if (sphere.r > 0) return d2 < sphere.r * sphere.r;
    return Math.abs(sphere.x - box.x) < hx && Math.abs(sphere.y - box.y) < hy && Math.abs(sphere.z - box.z) < hz;
  }
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }
  function half(c) {
    return c.box ?? [c.r, c.r, c.r];
  }
  function overlappingPairs(list) {
    const sorted = [...list].sort((a, b) => a.id - b.id);
    const out = [];
    if (sorted.length <= GRID_THRESHOLD) {
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          if (overlap(sorted[i], sorted[j])) out.push([sorted[i], sorted[j]]);
        }
      }
      return out;
    }
    const cells = /* @__PURE__ */ new Map();
    sorted.forEach((c, index) => {
      const [hx, hy, hz] = half(c);
      const x0 = Math.floor((c.x - hx) / GRID_CELL), x1 = Math.floor((c.x + hx) / GRID_CELL);
      const y0 = Math.floor((c.y - hy) / GRID_CELL), y1 = Math.floor((c.y + hy) / GRID_CELL);
      const z0 = Math.floor((c.z - hz) / GRID_CELL), z1 = Math.floor((c.z + hz) / GRID_CELL);
      for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) for (let k = z0; k <= z1; k++) {
        const key = `${i},${j},${k}`;
        let cell = cells.get(key);
        if (!cell) cells.set(key, cell = []);
        cell.push(index);
      }
    });
    const seen = /* @__PURE__ */ new Set();
    const n2 = sorted.length;
    const found = [];
    for (const cell of cells.values()) {
      for (let i = 0; i < cell.length; i++) {
        for (let j = i + 1; j < cell.length; j++) {
          const a = cell[i], b = cell[j];
          const key = a * n2 + b;
          if (seen.has(key)) continue;
          seen.add(key);
          if (overlap(sorted[a], sorted[b])) found.push([a, b]);
        }
      }
    }
    found.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    for (const [a, b] of found) out.push([sorted[a], sorted[b]]);
    return out;
  }

  // runtime/src/world/view.ts
  var json = (v) => v === void 0 ? void 0 : JSON.stringify(v);
  function normalizeSun(sun) {
    if (sun === void 0 || sun === null || sun === false) return null;
    if (Array.isArray(sun)) return { rot: sun, intensity: 1, color: "#ffffff" };
    return { rot: sun.rot ?? [50, -30, 0], intensity: sun.intensity ?? 1, color: sun.color ?? "#ffffff" };
  }
  var WorldView = class {
    constructor(_world, _root, _guard) {
      __publicField(this, "_world", _world);
      __publicField(this, "_root", _root);
      __publicField(this, "_guard", _guard);
      __publicField(this, "_entities", /* @__PURE__ */ new Map());
      __publicField(this, "_ids", new Int32Array(64));
      __publicField(this, "_buf", new Float32Array(640));
      __publicField(this, "_qa", [0, 0, 0, 1]);
      __publicField(this, "_qb", [0, 0, 0, 1]);
      __publicField(this, "_q", [0, 0, 0, 1]);
      __publicField(this, "_background");
      __publicField(this, "_sunKey");
      __publicField(this, "_sun", null);
      __publicField(this, "_camera");
    }
    /** 当前登记的场景对象数（测试与开发工具用） */
    get objectCount() {
      let n2 = 0;
      for (const v of this._entities.values()) for (const b of v.blocks.values()) n2 += b.objs.length;
      return n2;
    }
    /** 每个游戏帧调用一次 */
    frame() {
      const w = this._world;
      this._applyStage(w.stage);
      const data = w.data;
      const registry = w.registry;
      const ordered = registry.ordered();
      const ctx = this._root;
      const seen = /* @__PURE__ */ new Set();
      for (const key in data.entities) {
        const e = data.entities[key];
        seen.add(e.id);
        let v = this._entities.get(e.id);
        if (!v) this._entities.set(e.id, v = { e, blocks: /* @__PURE__ */ new Map() });
        v.e = e;
        const rev = w.revision(e.id);
        for (const [name, rec] of v.blocks) {
          if (e.b[name] && registry.block(name) === rec.def && rec.rev === rev) continue;
          this._exit(rec, e);
          v.blocks.delete(name);
        }
        for (const def of ordered) {
          const me = e.b[def.name];
          if (!def.view || !me) continue;
          const rec = v.blocks.get(def.name);
          if (rec) {
            rec.me = me;
            continue;
          }
          const created = { def, me, objs: [], scales: [], rev };
          v.blocks.set(def.name, created);
          if (def.view.enter) {
            this._guard(`积木 ${def.name}.view.enter`, () => {
              const out = def.view.enter(me, e, ctx, w);
              const list = out === void 0 || out === null ? [] : Array.isArray(out) ? out : [out];
              const unit = w.unitOfMount(e.mount);
              for (const obj of list) {
                if (!(obj instanceof Entity)) continue;
                created.objs.push(obj);
                created.scales.push(obj.scale);
                this._label(obj.id, unit);
              }
            });
          }
        }
      }
      for (const [id, v] of this._entities) {
        if (seen.has(id)) continue;
        for (const rec of v.blocks.values()) this._exit(rec, v.e);
        this._entities.delete(id);
      }
      for (const def of ordered) {
        const update = def.view?.update;
        if (!update) continue;
        for (const v of this._entities.values()) {
          const rec = v.blocks.get(def.name);
          if (rec) this._guard(`积木 ${def.name}.view.update`, () => update(rec.me, v.e, rec.objs, ctx, w));
        }
      }
      this._sync();
    }
    /** 改记场景对象的展示归属 */
    _label(id, unit) {
      const info = this._root.scene.objects.get(id);
      if (info) info.unit = unit;
    }
    _exit(rec, e) {
      const exit = rec.def.view?.exit;
      if (exit) this._guard(`积木 ${rec.def.name}.view.exit`, () => exit(rec.me, e, rec.objs, this._root, this._world));
      for (const obj of rec.objs) {
        try {
          obj.destroy();
        } catch {
        }
      }
      rec.objs = [];
      rec.scales = [];
    }
    _sync() {
      let count = 0;
      for (const v of this._entities.values()) for (const b of v.blocks.values()) count += b.objs.length;
      if (!count) return;
      if (this._ids.length < count) {
        let size = this._ids.length;
        while (size < count) size *= 2;
        this._ids = new Int32Array(size);
        this._buf = new Float32Array(size * 10);
      }
      const alpha = this._root.clock.fixedAlpha;
      const ids = this._ids;
      const buf = this._buf;
      let k = 0;
      for (const v of this._entities.values()) {
        const e = v.e;
        const prev = this._world.prev.get(e.id);
        const p0 = prev?.pos ?? e.pos;
        const x = p0[0] + (e.pos[0] - p0[0]) * alpha;
        const y = p0[1] + (e.pos[1] - p0[1]) * alpha;
        const z = p0[2] + (e.pos[2] - p0[2]) * alpha;
        const r1 = e.rot;
        const r0 = prev?.rot ?? r1;
        eulerToQuaternion(r1[0], r1[1], r1[2], this._qb);
        const q = r0 === r1 || r0[0] === r1[0] && r0[1] === r1[1] && r0[2] === r1[2] ? this._qb : slerpQuaternion(eulerToQuaternion(r0[0], r0[1], r0[2], this._qa), this._qb, alpha, this._q);
        for (const b of v.blocks.values()) {
          for (let i = 0; i < b.objs.length; i++) {
            const s = b.scales[i];
            const at = k * 10;
            ids[k] = b.objs[i].id;
            buf[at] = x;
            buf[at + 1] = y;
            buf[at + 2] = z;
            buf[at + 3] = q[0];
            buf[at + 4] = q[1];
            buf[at + 5] = q[2];
            buf[at + 6] = q[3];
            buf[at + 7] = e.scale[0] * s[0];
            buf[at + 8] = e.scale[1] * s[1];
            buf[at + 9] = e.scale[2] * s[2];
            k++;
          }
        }
      }
      this._root.scene.setTransforms(ids, buf, { count: k });
    }
    _applyStage(stage) {
      const scene = this._root.scene;
      const background = json(stage?.background);
      if (background !== void 0 && background !== this._background) {
        this._background = background;
        this._guard("<stage background>", () => scene.background(stage.background));
      }
      const sun = normalizeSun(stage?.sun);
      const sunKey = json(sun);
      if (sunKey !== this._sunKey) {
        this._sunKey = sunKey;
        if (this._sun) {
          const old = this._sun;
          this._sun = null;
          try {
            old.destroy();
          } catch {
          }
        }
        if (sun) {
          this._guard("<stage sun>", () => {
            this._sun = scene.light({ type: "directional", name: "sun", rotation: sun.rot, intensity: sun.intensity, color: sun.color });
            this._label(this._sun.id, this._world.stageUnit);
          });
        }
      }
      const camera = stage?.camera;
      const cameraKey = json(camera ? { at: camera.at, look: camera.look } : void 0);
      if (cameraKey !== void 0 && cameraKey !== this._camera) {
        this._camera = cameraKey;
        this._guard("<stage camera>", () => {
          const cam = scene.camera;
          if (camera.at) cam.position = camera.at;
          if (camera.look) cam.lookAt(camera.look);
        });
      }
    }
  };

  // runtime/src/world/blocks/index.ts
  var shape = defineBlock({
    name: "shape",
    about: "外形：kind 为 scene.spawn 支持的形状（cube、sphere、plane、cylinder、capsule、quad 或 mesh:名字），color 颜色，scale 相对实体的缩放",
    props: { kind: "cube", color: "#ffffff", scale: 1 },
    view: {
      enter(me, e, ctx) {
        return ctx.scene.spawn({ shape: me.kind, name: e.name ?? e.prefab, color: me.color, scale: me.scale, position: e.pos, rotation: e.rot });
      }
    }
  });
  var spin = defineBlock({
    name: "spin",
    about: "绕 y 轴旋转，speed 为度每秒",
    props: { speed: 90 },
    step(me, e, w) {
      e.rot[1] = (e.rot[1] + me.speed * w.dt) % 360;
    }
  });
  var moveTopdown = defineBlock({
    name: "moveTopdown",
    about: "俯视角移动：读指令轴 move，按 speed（米每秒）改 pos 的 x、z",
    props: { speed: 5 },
    step(me, e, w) {
      const { x, y } = w.cmd(e).axis("move");
      if (!x && !y) return;
      e.pos[0] += x * me.speed * w.dt;
      e.pos[2] += y * me.speed * w.dt;
    }
  });
  var trigger = defineBlock({
    name: "trigger",
    about: "触发区：radius 为球半径（米，0 表示中心点），box 给了 [x, y, z] 时按轴对齐盒判定；两个触发区开始重叠时发 touch",
    props: { radius: 0.5, box: null }
  });
  var lifetime = defineBlock({
    name: "lifetime",
    about: "存活 seconds 秒后销毁",
    props: { seconds: 2 },
    state: { age: 0 },
    step(me, e, w) {
      me.age += w.dt;
      if (me.age >= me.seconds) w.destroy(e);
    }
  });
  var projectile = defineBlock({
    name: "projectile",
    about: "沿世界方向 dir 以 speed（米每秒）匀速飞行",
    props: { speed: 10, dir: [0, 0, 1] },
    step(me, e, w) {
      const [x, y, z] = me.dir;
      const len = Math.hypot(x, y, z);
      if (!len) return;
      const k = me.speed * w.dt / len;
      e.pos[0] += x * k;
      e.pos[1] += y * k;
      e.pos[2] += z * k;
    }
  });
  var cameraFollow = defineBlock({
    name: "cameraFollow",
    about: "相机跟随：相机放在实体位置加 offset 处并看向实体（每帧，按插值后的位置）",
    props: { offset: [0, 12, -10] },
    view: {
      update(me, e, _objs, ctx, w) {
        const prev = w.prev.get(e.id)?.pos ?? e.pos;
        const a = ctx.clock.fixedAlpha;
        const p = [prev[0] + (e.pos[0] - prev[0]) * a, prev[1] + (e.pos[1] - prev[1]) * a, prev[2] + (e.pos[2] - prev[2]) * a];
        const o = me.offset;
        const cam = ctx.scene.camera;
        cam.position = [p[0] + o[0], p[1] + o[1], p[2] + o[2]];
        cam.lookAt(p);
      }
    }
  });
  var light = defineBlock({
    name: "light",
    about: "点光源：color 颜色，intensity 强度，range 照射范围（米）",
    props: { color: "#ffffff", intensity: 1, range: 10 },
    view: {
      enter(me, e, ctx) {
        return ctx.scene.light({ type: "point", name: e.name ?? `${e.prefab} light`, color: me.color, intensity: me.intensity, range: me.range, position: e.pos });
      }
    }
  });
  var BUILTIN_BLOCKS = [shape, spin, moveTopdown, trigger, lifetime, projectile, cameraFollow, light];

  // runtime/src/world/prefabs.ts
  var entity = definePrefab("entity", {});
  var BUILTIN_PREFABS = [entity];

  // runtime/src/world/flow.ts
  var NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
  function checkFlow(flow) {
    const fail = (message) => {
      throw new Error(`defineGame：flow ${message}`);
    };
    if (!flow || typeof flow !== "object") fail("必须是对象 { start, states }");
    const def = flow;
    if (!def.states || typeof def.states !== "object") fail("缺少 states");
    const names = Object.keys(def.states);
    if (!names.length) fail("的 states 至少要有一个状态");
    for (const name of names) {
      if (!NAME.test(name)) fail(`的状态名 ${JSON.stringify(name)} 必须是标识符`);
      const s = def.states[name];
      if (!s || typeof s !== "object") fail(`的状态 ${name} 必须是对象`);
      if (s.enter !== void 0 && typeof s.enter !== "function") fail(`的状态 ${name} 的 enter 必须是函数`);
      for (const [event, target] of Object.entries(s.on ?? {})) {
        if (!NAME.test(event)) fail(`的状态 ${name} 的事件名 ${JSON.stringify(event)} 必须是标识符`);
        if (!(target in def.states)) fail(`的状态 ${name} 在 ${event} 时切到不存在的状态 ${JSON.stringify(target)}`);
      }
    }
    if (typeof def.start !== "string" || !(def.start in def.states)) fail(`的 start ${JSON.stringify(def.start)} 不是已定义的状态`);
    if (def.states[def.start].pause) fail(`的 start 不能是叠加状态（pause）`);
    return def;
  }
  function initialFlow(state = "play") {
    return { state, params: {}, base: state, baseParams: {} };
  }

  // runtime/src/world/world.ts
  var DEFAULT_CONTROLS = {
    axes: { move: "move", look: "look" },
    actions: { jump: ["space"], fire: ["mouse0"] }
  };
  var DEFAULT_SEED = 795581745;
  var MAX_EVENT_ROUNDS = 8;
  function initData() {
    return { nextId: 1, tick: 0, seed: DEFAULT_SEED, vars: {}, entities: {}, mounts: {}, contacts: {} };
  }
  function normalize3(spec) {
    return { prefab: spec.prefab, at: spec.at, rot: spec.rot, scale: spec.scale, name: spec.name ?? null, tags: spec.tags, blocks: spec.blocks };
  }
  var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  var WorldService = class extends Service {
    constructor(ctx) {
      super(ctx, "world");
      __publicField(this, "registry", new Registry());
      /** 表现（15.10） */
      __publicField(this, "view");
      /** 构造时的 ctx：服务自己的东西挂在这里 */
      __publicField(this, "_root");
      __publicField(this, "_controls", DEFAULT_CONTROLS);
      /** 挂载 id → 当前挂着它的单元（脱离后删除） */
      __publicField(this, "_attached", /* @__PURE__ */ new Map());
      /** 已脱离、等待清扫的挂载 id */
      __publicField(this, "_detached", /* @__PURE__ */ new Set());
      /** 本次运行里挂载过的 id（冷重启清扫用） */
      __publicField(this, "_mountedThisRun", /* @__PURE__ */ new Set());
      __publicField(this, "_coldChecked", false);
      /** 挂载 id → 规则表（按挂载先后，每次挂载整体替换） */
      __publicField(this, "_rules", /* @__PURE__ */ new Map());
      __publicField(this, "_handlers", []);
      __publicField(this, "_queue", []);
      __publicField(this, "_pending", []);
      __publicField(this, "_pendingSet", /* @__PURE__ */ new Set());
      /** 上一步的变换（插值用）：id → { pos, rot } */
      __publicField(this, "prev", /* @__PURE__ */ new Map());
      __publicField(this, "_axes", {});
      __publicField(this, "_down", {});
      __publicField(this, "_prevDown", {});
      __publicField(this, "_chains", /* @__PURE__ */ new Map());
      __publicField(this, "_chainVersion", -1);
      __publicField(this, "_reported", /* @__PURE__ */ new Set());
      __publicField(this, "_stepping", false);
      /** 当前 stage（由挂载给出，最后一个带 stage 的挂载生效） */
      __publicField(this, "_stages", /* @__PURE__ */ new Map());
      /** 实体 id → 积木属性被挂载对比改过的次数（表现据此重做 enter；内存表，丢了只会多重建一次） */
      __publicField(this, "_revs", /* @__PURE__ */ new Map());
      /** 当前流程定义及其所属单元 */
      __publicField(this, "_flowOwner", null);
      /** 待应用的流程切换 */
      __publicField(this, "_goto", null);
      /** 进入流程状态后调用的钩子（defineGame 用它重建场景） */
      __publicField(this, "_enterHooks", []);
      this._root = ctx;
      for (const block of BUILTIN_BLOCKS) this.registry.addBlock(block);
      for (const prefab of BUILTIN_PREFABS) this.registry.addPrefab(prefab);
      ctx.state.define("world", { init: initData });
      ctx.on("fixed-update", () => this._step());
      this.view = new WorldView(this, ctx, (what, fn) => this._guard(what, void 0, fn));
      ctx.on("update", () => {
        this._sweep();
        this.view.frame();
      });
    }
    /** 当前的 World 数据（每次重新取，不缓存） */
    get data() {
      const state = this._root.state;
      let data = state.get("world");
      if (!data) {
        state.set("world", initData());
        data = state.get("world");
      }
      return data;
    }
    get dt() {
      return this._root.clock.fixedStep;
    }
    get tick() {
      return this.data.tick;
    }
    get time() {
      return this.data.tick * this.dt;
    }
    get vars() {
      return this.data.vars;
    }
    /** 挂载 id 对应的单元（展示用）；w.spawn 生成的实体没有挂载，记为 (world) */
    unitOfMount(mount) {
      if (mount === null) return "(world)";
      return this._attached.get(mount)?.unit ?? mount;
    }
    /** 当前生效的 stage 来自哪个单元（展示用） */
    get stageUnit() {
      let last = null;
      for (const id of this._stages.keys()) last = id;
      return last === null ? "(world)" : this.unitOfMount(last);
    }
    /** 当前生效的 stage（多个挂载都给了时取最后挂载的） */
    get stage() {
      let last = null;
      for (const s of this._stages.values()) last = s;
      return last;
    }
    /** 当前的指令映射 */
    get controls() {
      return this._controls;
    }
    /** 设置指令映射（defineGame 的 controls） */
    setControls(controls) {
      this._controls = {
        axes: { ...DEFAULT_CONTROLS.axes, ...controls?.axes },
        actions: { ...DEFAULT_CONTROLS.actions, ...controls?.actions }
      };
    }
    // ---------------------------------------------------------------- 流程（16.2）
    /** 当前流程状态（只读快照）；没有 flow 时为 play */
    get flow() {
      const f = this.data.flow ?? initialFlow();
      return { state: f.state, params: f.params, base: f.base };
    }
    /** scene 求值用的状态名与参数 */
    get flowScene() {
      if (!this._flowOwner) return { state: "play", params: {} };
      const f = this.data.flow ?? initialFlow(this._flowOwner.def.start);
      return { state: f.base, params: clone(f.baseParams) };
    }
    /** 设置流程定义（defineGame 的 flow），返回撤销函数。一个 World 同时只能有一个 flow */
    setFlow(def, unit) {
      const owner = this._flowOwner;
      if (owner && owner.unit !== unit) throw new Error(`world.setFlow：流程已由单元 "${owner.unit}" 定义，一个 World 只能有一个 flow`);
      const token = {};
      this._flowOwner = { unit, token, def };
      const data = this.data;
      if (!data.flow) data.flow = initialFlow(def.start);
      else if (!(data.flow.state in def.states) || !(data.flow.base in def.states)) {
        this._root.logger("world").warn("流程状态 %s 已不在 flow 里，进入 %s", data.flow.state, def.start);
        data.flow = initialFlow(def.start);
        this._goto = { name: def.start, params: void 0, force: true };
      }
      return () => {
        if (this._flowOwner?.token === token) this._flowOwner = null;
      };
    }
    /** 请求切换流程状态：步内调用时在本步末尾应用，否则在下一步开始时应用；一步里多次调用以最后一次为准 */
    goto(name, params) {
      const owner = this._flowOwner;
      if (!owner) throw new Error("w.goto：游戏没有定义 flow");
      if (!(name in owner.def.states)) throw new Error(`w.goto：没有状态 "${name}"，可用 ${Object.keys(owner.def.states).join("、")}`);
      if (params !== void 0 && !isPlainObject2(params)) throw new Error("w.goto 的参数必须是普通对象");
      this._goto = { name, params: params === void 0 ? void 0 : clone(params) };
    }
    /** 注册“进入流程状态后”的钩子（随调用单元回收） */
    onFlowEnter(fn) {
      return this.ctx.effect(() => {
        this._enterHooks.push(fn);
        return () => {
          const i = this._enterHooks.indexOf(fn);
          if (i >= 0) this._enterHooks.splice(i, 1);
        };
      }, "world.onFlowEnter");
    }
    /** 当前是否处于叠加状态（模拟暂停） */
    _overlay() {
      const owner = this._flowOwner;
      const f = this.data.flow;
      return !!owner && !!f && !!owner.def.states[f.state]?.pause;
    }
    /** 自定义事件触发的流程切换 */
    _flowEvent(name, payload) {
      const owner = this._flowOwner;
      if (!owner) return;
      const f = this.data.flow;
      const target = f && owner.def.states[f.state]?.on?.[name];
      if (target) this._goto = { name: target, params: isPlainObject2(payload) ? clone(payload) : void 0 };
    }
    _applyGoto() {
      const req = this._goto;
      if (!req) return;
      this._goto = null;
      const owner = this._flowOwner;
      if (!owner) return;
      const def = owner.def;
      const target = def.states[req.name];
      if (!target) return;
      const data = this.data;
      const cur = data.flow ?? (data.flow = initialFlow(def.start));
      if (!req.force) {
        if (target.pause) {
          cur.state = req.name;
          cur.params = req.params ?? {};
          return;
        }
        if (def.states[cur.state]?.pause && req.name === cur.base && req.params === void 0) {
          cur.state = cur.base;
          cur.params = clone(cur.baseParams);
          return;
        }
      }
      const params = req.params ?? {};
      this._enterCleanup(data, owner.unit);
      data.flow = { state: req.name, params, base: req.name, baseParams: clone(params) };
      for (const hook of [...this._enterHooks]) this._guard(`进入流程状态 ${req.name} 时重建场景`, void 0, hook);
      if (target.enter) this._guard(`flow 状态 ${req.name} 的 enter`, void 0, () => target.enter(this));
    }
    /** 进入流程状态前：销毁 w.spawn 的实体与游戏挂载的实体，清空该挂载的 key 记录和接触表 */
    _enterCleanup(data, mountId) {
      for (const key of Object.keys(data.entities)) {
        const e = data.entities[key];
        if (e && e.mount === null) this._remove(data, e, false);
      }
      const mount = data.mounts[mountId];
      if (mount) {
        for (const rec of Object.values(mount.keys)) {
          const e = !rec.dead && data.entities[rec.id];
          if (e) this._remove(data, e, false);
        }
        data.mounts[mountId] = { keys: {} };
      }
      data.contacts = {};
    }
    /** 合并 vars：没有的键补初值，已有的保留 */
    mergeVars(vars) {
      if (!vars) return;
      const target = this.data.vars;
      for (const key of Object.keys(vars)) {
        if (!(key in target)) target[key] = clone(vars[key]);
      }
    }
    // ---------------------------------------------------------------- 挂载与对比（15.6）
    mount(tree, options = {}) {
      const unit = unitOf(this.ctx) ?? "(host)";
      const id = options.id ?? unit;
      const current2 = this._attached.get(id);
      if (current2 && current2.unit !== unit) {
        throw new Error(`world.mount：挂载 id "${id}" 已被单元 "${current2.unit}" 使用，请换一个 id`);
      }
      const result = evaluate(tree, this.registry);
      for (const prefab of result.prefabs) {
        if (this.registry.prefab(prefab.prefab) !== prefab) this.ctx.effect(() => this.registry.addPrefab(prefab), `world.prefab(${prefab.prefab})`);
      }
      const data = this.data;
      this._diff(data, id, result.entities);
      this._rules.set(id, result.rules);
      if (result.stage) this._stages.set(id, result.stage);
      else this._stages.delete(id);
      this._detached.delete(id);
      this._mountedThisRun.add(id);
      const fiber = this.ctx.fiber;
      if (current2 && current2.fiber === fiber) return;
      const token = {};
      this._attached.set(id, { unit, token, fiber });
      this.ctx.effect(() => () => {
        if (this._attached.get(id)?.token !== token) return;
        this._attached.delete(id);
        this._detached.add(id);
      }, `world.mount(${id})`);
    }
    _diff(data, id, specs) {
      var _a12;
      const mount = (_a12 = data.mounts)[id] ?? (_a12[id] = { keys: {} });
      const seen = /* @__PURE__ */ new Set();
      for (const spec of specs) {
        seen.add(spec.path);
        const last = JSON.stringify(normalize3(spec));
        const rec = mount.keys[spec.path];
        if (!rec) {
          const e2 = this._create(data, spec, id, spec.path);
          mount.keys[spec.path] = { id: e2.id, dead: false, last };
          continue;
        }
        if (rec.dead) continue;
        const e = data.entities[rec.id];
        if (!e) {
          rec.dead = true;
          continue;
        }
        const old = JSON.parse(rec.last);
        if (old.prefab !== spec.prefab) {
          this._remove(data, e, false);
          const fresh = this._create(data, spec, id, spec.path);
          mount.keys[spec.path] = { id: fresh.id, dead: false, last };
          continue;
        }
        if (last === rec.last) continue;
        if (!same(old.at, spec.at)) e.pos = [...spec.at];
        if (!same(old.rot, spec.rot)) e.rot = [...spec.rot];
        if (!same(old.scale, spec.scale)) e.scale = [...spec.scale];
        if (old.name !== (spec.name ?? null)) {
          if (spec.name === void 0) delete e.name;
          else e.name = spec.name;
        }
        if (!same(old.tags, spec.tags)) e.tags = [...spec.tags];
        const added = [];
        let changed = false;
        for (const name of Object.keys(spec.blocks)) {
          const props = spec.blocks[name];
          if (!e.b[name]) {
            e.b[name] = this._blockData(name, props);
            added.push(name);
          } else if (!same(old.blocks?.[name], props)) {
            Object.assign(e.b[name], clone(props));
            changed = true;
          }
        }
        if (changed) this._revs.set(e.id, (this._revs.get(e.id) ?? 0) + 1);
        for (const name of Object.keys(e.b)) {
          if (!(name in spec.blocks)) delete e.b[name];
        }
        this._init(e, added);
        rec.last = last;
      }
      for (const path of Object.keys(mount.keys)) {
        if (seen.has(path)) continue;
        const rec = mount.keys[path];
        const e = !rec.dead && data.entities[rec.id];
        if (e) this._remove(data, e, false);
        delete mount.keys[path];
      }
    }
    /** 清扫已脱离的挂载：销毁它们的实体、删除记录。fixed-update 与 update 先到的一处执行 */
    _sweep() {
      if (!this._coldChecked) {
        this._coldChecked = true;
        for (const id of Object.keys(this.data.mounts)) {
          if (!this._mountedThisRun.has(id) && !this._attached.has(id)) this._detached.add(id);
        }
      }
      if (!this._detached.size) return;
      const data = this.data;
      for (const id of this._detached) {
        const mount = data.mounts[id];
        if (mount) {
          for (const rec of Object.values(mount.keys)) {
            const e = !rec.dead && data.entities[rec.id];
            if (e) this._remove(data, e, false);
          }
          delete data.mounts[id];
        }
        this._rules.delete(id);
        this._stages.delete(id);
      }
      this._detached.clear();
    }
    // ---------------------------------------------------------------- 实体
    _blockData(name, props) {
      const block = this.registry.block(name);
      return { ...clone(block?.state ?? {}), ...clone(props) };
    }
    _create(data, spec, mount, path) {
      const id = data.nextId++;
      const e = {
        id,
        prefab: spec.prefab,
        mount,
        path,
        tags: [...spec.tags],
        pos: [...spec.at],
        rot: [...spec.rot],
        scale: [...spec.scale],
        b: {}
      };
      if (spec.name !== void 0) e.name = spec.name;
      for (const name of Object.keys(spec.blocks)) e.b[name] = this._blockData(name, spec.blocks[name]);
      data.entities[id] = e;
      this._init(e, Object.keys(e.b));
      return e;
    }
    /** 按执行顺序对指定积木调用 init */
    _init(e, names) {
      if (!names.length) return;
      for (const block of this.registry.ordered()) {
        if (!block.init || !names.includes(block.name) || !e.b[block.name]) continue;
        this._guard(`积木 ${block.name}.init`, void 0, () => block.init(e.b[block.name], e, this));
      }
    }
    /** 立即移除实体；gameplay 为真时把挂载记录标为 dead */
    _remove(data, e, gameplay) {
      delete data.entities[e.id];
      this.prev.delete(e.id);
      this._revs.delete(e.id);
      if (this._pendingSet.delete(e.id)) this._pending = this._pending.filter((id) => id !== e.id);
      if (gameplay && e.mount !== null && e.path !== null) {
        const rec = data.mounts[e.mount]?.keys[e.path];
        if (rec && rec.id === e.id) rec.dead = true;
      }
    }
    _alive(e) {
      return !!e && !this._pendingSet.has(e.id) && this.data.entities[e.id] === e;
    }
    /** 实体的积木属性修订号：挂载对比改了已有积木的属性时加一，表现据此重做 view.enter */
    revision(id) {
      return this._revs.get(id) ?? 0;
    }
    spawn(prefab, props = {}) {
      if (typeof prefab !== "string" && this.registry.prefab(prefab.prefab) !== prefab) {
        if (!this.registry.prefab(prefab.prefab)) this.registry.addPrefab(prefab);
      }
      if (!isPlainObject2(props)) throw new Error("w.spawn 的属性必须是普通对象");
      const { key, children, ...rest } = props;
      let saved;
      try {
        saved = JSON.parse(JSON.stringify(rest));
      } catch {
        throw new Error("w.spawn 的属性必须可序列化（热重载与读档要靠它重建）");
      }
      const { entities } = evaluate(makeNode(prefab, rest, null), this.registry);
      const e = this._create(this.data, entities[0], null, null);
      e.spawn = saved;
      return e;
    }
    /** 延迟到本步末尾销毁（不在步内调用时，到下一步末尾） */
    destroy(target) {
      const id = typeof target === "number" ? target : target?.id;
      const e = this.data.entities[id];
      if (!e || this._pendingSet.has(id)) return;
      this._pendingSet.add(id);
      this._pending.push(id);
    }
    get(id) {
      const e = this.data.entities[id];
      return e && !this._pendingSet.has(id) ? e : void 0;
    }
    /** 预制件链上的名字（按登记表版本缓存） */
    chain(prefab) {
      if (this._chainVersion !== this.registry.version) {
        this._chains.clear();
        this._chainVersion = this.registry.version;
      }
      let chain = this._chains.get(prefab);
      if (!chain) this._chains.set(prefab, chain = this.registry.chain(prefab));
      return chain;
    }
    /** filter 匹配实体的标签，或它预制件链上的任一名字；省略时匹配全部 */
    matches(e, filter) {
      if (filter === void 0) return true;
      return e.tags.includes(filter) || this.chain(e.prefab).includes(filter);
    }
    query(filter) {
      const out = [];
      const entities = this.data.entities;
      for (const key in entities) {
        const e = entities[key];
        if (!this._pendingSet.has(e.id) && this.matches(e, filter)) out.push(e);
      }
      return out;
    }
    count(filter) {
      return this.query(filter).length;
    }
    // ---------------------------------------------------------------- 事件
    on(event, filter, fn) {
      const entry = typeof filter === "function" ? { event, fn: filter } : { event, filter, fn };
      if (typeof entry.fn !== "function") throw new Error("w.on 需要处理函数");
      return this.ctx.effect(() => {
        this._handlers.push(entry);
        return () => {
          const i = this._handlers.indexOf(entry);
          if (i >= 0) this._handlers.splice(i, 1);
        };
      }, `world.on(${event})`);
    }
    emit(name, payload) {
      this._queue.push({ name, args: [payload] });
    }
    cmd(_e) {
      return {
        axis: (name) => this._axes[name] ?? this._root.input.axis(this._controls.axes[name] ?? name),
        down: (action) => !!this._down[action],
        pressed: (action) => !!this._down[action] && !this._prevDown[action]
      };
    }
    rand(min, max) {
      const data = this.data;
      let t = data.seed = data.seed + 1831565813 >>> 0;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      const r = ((t ^ t >>> 14) >>> 0) / 4294967296;
      return min === void 0 ? r : min + r * ((max ?? 1) - min);
    }
    /** 打印一次（同一来源同一信息只打印一次），不中断其余部分 */
    _guard(what, source, fn) {
      try {
        fn();
      } catch (error) {
        const where = source ? `${source.file}:${source.line} ` : "";
        const message = `${where}${what} 出错：${error?.stack ?? error?.message ?? error}`;
        const key = `${where}${what}:${error?.message ?? error}`;
        if (this._reported.has(key)) return;
        if (this._reported.size > 1e3) this._reported.clear();
        this._reported.add(key);
        this._root.logger("world").error(message);
      }
    }
    *_allRules(on) {
      for (const rules of this._rules.values()) {
        for (const rule of rules) if (rule.on === on) yield rule;
      }
    }
    _dispatch(event) {
      if (event.name === "touch") {
        const [x, y] = event.args;
        if (!this._alive(x) || !this._alive(y)) return;
        for (const rule of this._allRules("touch")) {
          if (this.matches(x, rule.a) && this.matches(y, rule.b)) this._guard(`<rule on="touch">`, rule.source, () => rule.do(this, x, y));
          else if (this.matches(y, rule.a) && this.matches(x, rule.b)) this._guard(`<rule on="touch">`, rule.source, () => rule.do(this, y, x));
        }
        for (const h of [...this._handlers]) {
          if (h.event !== "touch") continue;
          if (this.matches(x, h.filter)) this._guard('w.on("touch")', void 0, () => h.fn(this, x, y));
          else if (this.matches(y, h.filter)) this._guard('w.on("touch")', void 0, () => h.fn(this, y, x));
        }
        return;
      }
      if (event.name === "death") {
        const [e] = event.args;
        for (const rule of this._allRules("death")) {
          if (this.matches(e, rule.a)) this._guard(`<rule on="death">`, rule.source, () => rule.do(this, e));
        }
        for (const h of [...this._handlers]) {
          if (h.event === "death" && this.matches(e, h.filter)) this._guard('w.on("death")', void 0, () => h.fn(this, e));
        }
        return;
      }
      for (const rule of this._allRules(event.name)) {
        this._guard(`<rule on="${event.name}">`, rule.source, () => rule.do(this, ...event.args));
      }
      for (const h of [...this._handlers]) {
        if (h.event === event.name) this._guard(`w.on("${event.name}")`, void 0, () => h.fn(this, ...event.args));
      }
      this._flowEvent(event.name, event.args[0]);
    }
    // ---------------------------------------------------------------- 每一步（15.8）
    _step() {
      if (this._stepping) return;
      this._stepping = true;
      try {
        this._sweep();
        this._applyGoto();
        const data = this.data;
        this._prevDown = this._down;
        this._down = {};
        this._axes = {};
        const input = this._root.input;
        for (const name of Object.keys(this._controls.axes)) this._axes[name] = input.axis(this._controls.axes[name]);
        for (const action of Object.keys(this._controls.actions)) {
          const keys = this._controls.actions[action];
          this._down[action] = (Array.isArray(keys) ? keys : [keys]).some((k) => input.key(k));
        }
        if (this._overlay()) {
          this.prev.clear();
          this._drain(data);
          this._applyGoto();
          return;
        }
        this.prev.clear();
        for (const key in data.entities) {
          const e = data.entities[key];
          this.prev.set(e.id, { pos: [...e.pos], rot: [...e.rot] });
        }
        const alive = Object.values(data.entities);
        for (const block of this.registry.ordered()) {
          if (!block.step) continue;
          for (const e of alive) {
            const me = e.b[block.name];
            if (!me || !this._alive(e)) continue;
            this._guard(`积木 ${block.name}.step`, void 0, () => block.step(me, e, this));
          }
        }
        const touches = this._detect(data);
        for (const rule of this._allRules("every")) {
          const n2 = Math.max(1, Math.round(rule.seconds / this.dt));
          if ((data.tick + 1) % n2 === 0) this._guard('<rule on="every">', rule.source, () => rule.do(this));
        }
        this._queue.unshift(...touches);
        this._drain(data);
        data.tick++;
        this._applyGoto();
      } finally {
        this._stepping = false;
      }
    }
    _drain(data) {
      let rounds = 0;
      while (this._queue.length || this._pending.length) {
        if (++rounds > MAX_EVENT_ROUNDS) {
          const dropped = this._queue.map((e) => e.name);
          this._queue = [];
          this._root.logger("world").error("事件与销毁连锁超过 %d 轮，本步剩余的事件已丢弃：%s", MAX_EVENT_ROUNDS, dropped.join("、") || "（death）");
          for (const id of this._pending.splice(0)) {
            const e = data.entities[id];
            this._pendingSet.delete(id);
            if (e) this._remove(data, e, true);
          }
          return;
        }
        const batch = this._queue.splice(0);
        for (const event of batch) this._dispatch(event);
        const pending = this._pending.splice(0);
        for (const id of pending) {
          this._pendingSet.delete(id);
          const e = data.entities[id];
          if (!e) continue;
          this._remove(data, e, true);
          this._queue.push({ name: "death", args: [e] });
        }
      }
    }
    _detect(data) {
      const colliders = [];
      for (const key in data.entities) {
        const e = data.entities[key];
        const t = e.b.trigger;
        if (!t || this._pendingSet.has(e.id)) continue;
        const [sx, sy, sz] = e.scale.map(Math.abs);
        const box = Array.isArray(t.box) ? [t.box[0] * sx, t.box[1] * sy, t.box[2] * sz] : null;
        colliders.push({ id: e.id, x: e.pos[0], y: e.pos[1], z: e.pos[2], r: (Number(t.radius) || 0) * Math.max(sx, sy, sz), box });
      }
      const now = /* @__PURE__ */ new Set();
      const events = [];
      for (const [a, b] of overlappingPairs(colliders)) {
        const key = `${a.id}:${b.id}`;
        now.add(key);
        if (!data.contacts[key]) {
          data.contacts[key] = true;
          events.push({ name: "touch", args: [data.entities[a.id], data.entities[b.id]] });
        }
      }
      for (const key of Object.keys(data.contacts)) {
        if (!now.has(key)) delete data.contacts[key];
      }
      return events;
    }
    /** 测试与开发工具用：当前规则表 */
    rules() {
      return [...this._rules.values()].flat();
    }
    /** 测试与开发工具用：挂载状态 */
    mounts() {
      return { attached: [...this._attached.keys()], detached: [...this._detached] };
    }
  };
  __publicField(WorldService, "inject", ["clock", "state", "input", "scene", "ui"]);

  // runtime/src/jsx-runtime.ts
  var jsx_runtime_exports = {};
  __export(jsx_runtime_exports, {
    Fragment: () => Fragment,
    createElement: () => createElement,
    jsx: () => jsx,
    jsxs: () => jsxs
  });
  function jsx(type, props, key) {
    return makeNode(type, props, key);
  }
  var jsxs = jsx;
  function createElement(type, config, ...children) {
    const props = {};
    let key;
    for (const name in config ?? {}) {
      if (name === "key") key = config[name];
      else if (name !== "__self" && name !== "__source") props[name] = config[name];
    }
    if (children.length === 1) props.children = children[0];
    else if (children.length > 1) props.children = children;
    return makeNode(type, props, key);
  }

  // runtime/src/jsx-dev-runtime.ts
  var jsx_dev_runtime_exports = {};
  __export(jsx_dev_runtime_exports, {
    Fragment: () => Fragment,
    jsxDEV: () => jsxDEV
  });
  function jsxDEV(type, props, key, _isStatic, source, _self) {
    const pos = source && source.fileName ? { file: source.fileName, line: source.lineNumber ?? 0, col: source.columnNumber ?? 0 } : void 0;
    return makeNode(type, props, key, pos);
  }

  // runtime/src/runtime.ts
  var API_VERSION = "0.1";
  var VERSION = "0.1.0";
  var current;
  function currentRuntime() {
    return current;
  }
  function bind(Base, ...args) {
    const Bound = class extends Base {
      constructor(ctx) {
        super(ctx, ...args);
      }
    };
    Object.defineProperty(Bound, "name", { value: Base.name });
    return Bound;
  }
  var Runtime = class {
    constructor(host, options = {}) {
      __publicField(this, "host", host);
      __publicField(this, "options", options);
      __publicField(this, "root");
      __publicField(this, "manifest");
      __publicField(this, "status", "idle");
      /** 启动阶段失败的单元 */
      __publicField(this, "failures", []);
      this.root = new Context();
      current = this;
      const exporter = {
        colors: false,
        export(message) {
          const level = ["error", "warn", "info", "debug"].includes(message.type) ? message.type : "info";
          try {
            host.log(level, Logger.format(exporter, message));
          } catch {
            host.log(level, String(message.args?.[0]));
          }
        }
      };
      this.root.logger.exporter(exporter);
    }
    get clock() {
      return this.root.clock;
    }
    get state() {
      return this.root.state;
    }
    get plugins() {
      return this.root.plugins;
    }
    get scene() {
      return this.root.scene;
    }
    get data() {
      return this.root.data;
    }
    get cache() {
      return this.root.cache;
    }
    get loading() {
      return this.root.loading;
    }
    /** 安装核心服务 */
    async init() {
      const { root, host } = this;
      const pot = globalThis.pot;
      const modules = this.options.modules ?? {
        "@pot/core": pot,
        "cordis": pot,
        "@pot/core/jsx-runtime": jsx_runtime_exports,
        "@pot/core/jsx-dev-runtime": jsx_dev_runtime_exports
      };
      const install = (plugin) => root.plugin(plugin, void 0);
      await install(ClockService);
      await install(TimerService);
      await install(bind(StateService));
      await install(CacheService);
      await install(bind(DataService, host));
      await install(bind(SceneService, host));
      await install(bind(InputService, host));
      await install(bind(UIService, host));
      await install(bind(AudioService, host));
      await install(bind(GfxService, host));
      await install(bind(LoadingService, host));
      await install(WorldService);
      await install(bind(PluginsService, host, modules, this.options.loader));
      if (this.options.state) this.root.state.importJSON(this.options.state);
      return this;
    }
    readManifest() {
      const text = this.host.readText("manifest.json");
      if (!text) throw new Error("找不到 manifest.json");
      const manifest = JSON.parse(text);
      if (!manifest.id) throw new Error("manifest.json 缺少 id");
      if (!Array.isArray(manifest.plugins)) throw new Error("manifest.json 缺少 plugins 数组");
      if (manifest.apiVersion && manifest.apiVersion.split(".")[0] !== API_VERSION.split(".")[0]) {
        throw new Error(`manifest.apiVersion=${manifest.apiVersion} 与运行时 ${API_VERSION} 不兼容`);
      }
      return manifest;
    }
    /**
     * 读取 manifest 并挂载入口单元。单个单元失败不影响其他单元。
     * 注意：不要在这里持有入口 fiber 的引用，否则热重载后旧 fiber 无法回收。
     */
    async start() {
      this.status = "starting";
      this.root.loading.begin();
      try {
        this.manifest = this.readManifest();
      } catch (error) {
        this.status = "failed";
        this.root.loading.end();
        this.root.logger("pot").error(error);
        throw error;
      }
      for (const item of this.manifest.plugins) {
        const entry = typeof item === "string" ? { name: item } : item;
        try {
          await this.root.plugins.use(entry.name, entry.config);
        } catch (error) {
          this.failures.push({ name: entry.name, error: error?.stack ?? String(error) });
          this.root.logger("pot").error("单元 %s 启动失败：%s", entry.name, error?.stack ?? error);
        }
      }
      this.root.loading.end();
      this.status = "running";
      return this;
    }
    tick(dt) {
      const clock = this.root.clock;
      const frame = clock.frame;
      this.root.loading.pump();
      clock.tick(dt);
      if (clock.frame !== frame) this.root.ui.flush();
    }
    /** 卸载所有单元（服务保留，state 保留） */
    async stop() {
      for (const unit of this.root.plugins.units.values()) {
        for (const fiber of [...unit.mounts]) {
          try {
            await fiber.dispose();
          } catch (error) {
            this.root.logger("pot").warn(error);
          }
        }
      }
      this.status = "stopped";
    }
    exportState() {
      return this.root.state.exportJSON();
    }
    info() {
      return {
        status: this.status,
        game: this.manifest?.id,
        apiVersion: API_VERSION,
        time: this.root.clock.time,
        frame: this.root.clock.frame,
        paused: this.root.clock.paused,
        frozen: this.root.clock.frozen,
        units: this.root.plugins.list().map((u) => ({ name: u.name, hash: u.hash, mounts: u.mounts.length })),
        objects: this.root.scene.objects.size,
        timers: this.root.clock.pending,
        state: this.root.state.keys(),
        failures: this.failures,
        loading: { active: this.root.loading.active, progress: this.root.loading.progress, text: this.root.loading.text, yields: this.root.loading.yields }
      };
    }
  };
  async function createRuntime(host, options) {
    const runtime = new Runtime(host, options);
    await runtime.init();
    return runtime;
  }

  // runtime/src/unity.ts
  function createUnityHost() {
    const Pot = CS.Pot;
    const H2 = Pot.PotHost;
    const FS2 = Pot.GameFS;
    const S = Pot.PotScene;
    const I = Pot.PotInput;
    const U = Pot.PotUI;
    const A = Pot.PotAudio;
    const R = Pot.PotRender;
    const G = Pot.PotGfx;
    return {
      platform: "unity",
      log: (level, text) => H2.Log(level, text),
      readText: (path) => {
        const text = FS2.ReadText(path);
        return text === null || text === void 0 ? null : text;
      },
      cacheRead: (bucket, key) => {
        const text = FS2.CacheRead(bucket, key);
        return text === null || text === void 0 ? null : text;
      },
      cacheWrite: (bucket, key, text) => FS2.CacheWrite(bucket, key, text),
      gc: () => H2.RequestGC(),
      send: (message) => H2.Send(message),
      frames: true,
      loading: (progress, text) => H2.OnLoading(progress, text),
      engine: {
        spawn: (shape2, name, parent) => S.Spawn(shape2, name, parent),
        destroy: (id) => S.Destroy(id),
        exists: (id) => S.Exists(id),
        setVec: (id, prop, x, y, z) => S.SetVec(id, prop, x, y, z),
        setTransforms: (ids, data, count, flags) => S.SetTransforms(ids, data, count, flags),
        visible: (id, visible) => S.SetVisible(id, visible),
        skin: (id, bones) => S.Skin(id, bones) ?? "",
        getVec: (id, prop) => {
          S.GetVec(id, prop);
          return [S.vx, S.vy, S.vz];
        },
        setColor: (id, r, g, b, a) => S.SetColor(id, r, g, b, a),
        setActive: (id, active) => S.SetActive(id, active),
        lookAt: (id, x, y, z) => S.LookAt(id, x, y, z),
        light: (id, type, intensity, r, g, b, range) => S.Light(id, type, intensity, r, g, b, range),
        cameraId: () => S.CameraId(),
        setBackground: (r, g, b) => S.SetBackground(r, g, b),
        axis: (name) => {
          I.Axis(name);
          return [I.ax, I.ay];
        },
        key: (name, mode) => I.Key(name, mode),
        count: () => S.Count(),
        material: (id, mode, castShadows, cull) => S.SetMaterial(id, mode, castShadows, cull),
        surface: (id, metallic, smoothness) => S.SetSurface(id, metallic, smoothness),
        emission: (id, r, g, b) => S.SetEmission(id, r, g, b),
        collider: (id, enabled) => S.SetCollider(id, enabled),
        colliderShape: (id, kind, dynamic) => S.SetColliderShape(id, kind, dynamic) ?? "",
        layer: (id, layer) => S.SetLayer(id, layer),
        raycast: (ox, oy, oz, dx, dy, dz, maxDistance, mask) => {
          const id = S.Raycast(ox, oy, oz, dx, dy, dz, maxDistance, mask);
          if (!id) return null;
          return { id, point: [S.vx, S.vy, S.vz], normal: [S.nx, S.ny, S.nz], distance: S.dist };
        },
        sphereCast: (ox, oy, oz, dx, dy, dz, radius, maxDistance, mask) => {
          const id = S.SphereCast(ox, oy, oz, dx, dy, dz, radius, maxDistance, mask);
          if (!id) return null;
          return { id, point: [S.vx, S.vy, S.vz], normal: [S.nx, S.ny, S.nz], distance: S.dist };
        },
        view: (fov, near, far) => S.SetCamera(fov, near, far),
        fog: (r, g, b, density) => S.SetFog(r, g, b, density),
        ambient: (r, g, b, reflection) => S.SetAmbient(r, g, b, reflection),
        lightOptions: (id, spotAngle, shadows) => S.LightOptions(id, spotAngle, shadows),
        lightIntensity: (id, intensity) => S.SetLightIntensity(id, intensity),
        cursor: (locked) => I.SetCursor(locked),
        cursorLocked: () => I.CursorLocked(),
        mouse: () => {
          I.Mouse();
          return [I.mx, I.my];
        },
        screen: () => {
          I.ScreenSize();
          return [I.sw, I.sh];
        },
        wheel: () => I.Wheel(),
        focused: () => I.Focused(),
        textInput: () => I.TextInput(),
        uiSubmit: (list) => U.Submit(list),
        uiMeasure: (text, size, flags) => {
          U.Measure(text, size, flags);
          return [U.tw, U.th];
        },
        audioClip: (name, rate, channels, data) => A.Clip(name, rate, channels, data),
        audioHas: (name) => A.HasClip(name),
        audioPlay: (name, volume, pitch, x, y, z, spatial) => A.Play(name, volume, pitch, x, y, z, spatial),
        audioLoop: (name, volume, pitch) => A.Loop(name, volume, pitch),
        audioSetLoop: (handle, volume, pitch, x, y, z, spatial) => A.SetLoop(handle, volume, pitch, x, y, z, spatial),
        audioStop: (handle) => A.StopLoop(handle),
        audioVolume: (volume) => A.Volume(volume),
        audioPause: (paused) => A.Pause(paused),
        texture: (data, width, height, linear, mipmaps, wrap, filter, aniso) => S.Texture(data, width, height, linear, mipmaps, wrap, filter, aniso),
        destroyTexture: (id) => S.DestroyTexture(id),
        textTexture: (json2) => R.TextTexture(json2),
        canvasText: (text, family, size, style) => R.CanvasText(text, family, size, style) ?? null,
        mesh: (name, positions, normals, uvs, colors, indices, key) => S.Mesh(name, positions, normals, uvs, colors, indices, key),
        meshCached: (name, key) => S.MeshCached(name, key),
        meshSkin: (name, boneIndices, weights, bindPoses) => S.MeshSkin(name, boneIndices, weights, bindPoses) ?? "",
        meshTangents: (name, tangents) => S.MeshTangents(name, tangents) ?? "",
        meshColors: (name, colors, linear) => S.MeshColors(name, colors, linear) ?? "",
        meshAttribute: (name, channel, attr, size, data) => S.MeshAttribute(name, channel, attr, size, data) ?? "",
        matTexture: (id, slot, tex) => S.MatTexture(id, slot, tex),
        matFloat: (id, prop, value) => S.MatFloat(id, prop, value),
        matVector: (id, prop, x, y, z, w) => S.MatVector(id, prop, x, y, z, w),
        ambientTrilight: (sr, sg, sb, er, eg, eb, gr, gg, gb, reflection) => S.SetAmbientTrilight(sr, sg, sb, er, eg, eb, gr, gg, gb, reflection),
        render: (kind, json2) => R.Configure(kind, json2) ?? "",
        burst: (json2) => R.Burst(json2),
        gfxBackend: () => G.Backend() ?? "",
        gfxUnsupported: () => G.Unsupported() ?? "",
        gfxProgram: (name, vs, fs) => G.Program(name, vs, fs) ?? "",
        gfxDestroyProgram: (name) => G.DestroyProgram(name),
        gfxBind: (id, program, flags, queue, shadows) => G.Bind(id, program, flags, queue, shadows),
        gfxUniform: (id, name, n2, x, y, z, w) => G.Uniform(id, name, n2, x, y, z, w),
        gfxUniformArray: (id, name, data) => G.UniformArray(id, name, data),
        gfxTexture: (id, name, tex) => G.Texture(id, name, tex),
        gfxInstances: (id, count, layout, data) => G.Instances(id, count, layout, data) ?? "",
        gfxBakeBegin: () => G.BakeBegin(),
        gfxBake: (bind2, program, width, height, targets, blend) => G.Bake(bind2, program, width, height, targets, blend) ?? "!",
        gfxPost: (json2) => G.Post(json2) ?? "",
        gfxPostEnable: (pass, on) => G.PostEnable(pass, on) ?? ""
      }
    };
  }
  var unity = {
    runtime: void 0,
    /** 启动：异步完成后回调 PotHost.OnBooted(ok, error) */
    boot(stateJson) {
      const host = createUnityHost();
      const loader = globalThis.pot?.devtools?.createLoader?.(host);
      createRuntime(host, { state: stateJson || void 0, loader }).then((runtime) => {
        unity.runtime = runtime;
        globalThis.pot?.devtools?.attach?.(runtime);
        return runtime.start();
      }).then(() => CS.Pot.PotHost.OnBooted(true, ""), (error) => CS.Pot.PotHost.OnBooted(false, String(error?.stack ?? error)));
    },
    tick(dt) {
      unity.runtime?.tick(dt);
    },
    /** 启动期间（尚未 Running）每帧调用：放行 loading.frame()/step() 的等待 */
    pump() {
      unity.runtime?.root.loading.pump();
    },
    /** 冷重启前调用：导出 state JSON（失败返回空串） */
    exportState() {
      try {
        return unity.runtime?.exportState() ?? "";
      } catch (error) {
        CS.Pot.PotHost.Log("error", `导出 state 失败：${error?.stack ?? error}`);
        return "";
      }
    },
    stop() {
      const runtime = unity.runtime;
      unity.runtime = void 0;
      runtime?.stop().catch(() => {
      });
    },
    info() {
      return JSON.stringify(unity.runtime?.info() ?? { status: "idle" });
    }
  };
  function bindEntry(name, fn) {
    const R = typeof CS === "undefined" ? void 0 : CS?.Pot?.PotRuntime;
    if (!R || typeof R.Bind !== "function") return false;
    R.Bind(name, () => {
      const result = fn(R.TakeArg() ?? "");
      if (typeof result === "string") R.Return(result);
    });
    return true;
  }
  function bindUnity() {
    bindEntry("unity.boot", (state) => unity.boot(state));
    bindEntry("unity.tick", () => unity.tick(CS.Pot.PotRuntime.frameDt));
    bindEntry("unity.pump", () => unity.pump());
    bindEntry("unity.exportState", () => unity.exportState());
    bindEntry("unity.stop", () => unity.stop());
    bindEntry("unity.info", () => unity.info());
  }
  bindUnity();

  // runtime/src/world/ui-eval.ts
  var UI_MARGIN = 16;
  var ANCHORS = {
    "top-left": [0, 0],
    top: [0.5, 0],
    "top-right": [1, 0],
    left: [0, 0.5],
    center: [0.5, 0.5],
    right: [1, 0.5],
    "bottom-left": [0, 1],
    bottom: [0.5, 1],
    "bottom-right": [1, 1]
  };
  var H = ["left", "center", "right"];
  var V = ["top", "middle", "bottom"];
  var MAX_DEPTH = 64;
  function textOf(children, out) {
    if (children === null || children === void 0 || typeof children === "boolean") return;
    if (typeof children === "string" || typeof children === "number") {
      out.push(String(children));
      return;
    }
    if (Array.isArray(children)) {
      for (const c of children) textOf(c, out);
      return;
    }
    throw new Error("<text> 的子节点只能是字符串和数字");
  }
  function createUIRenderer(onError) {
    const reported = /* @__PURE__ */ new Set();
    const report = (message) => {
      if (reported.has(message)) return;
      if (reported.size > 256) reported.clear();
      reported.add(message);
      onError(message);
    };
    const text = (node, ui) => {
      const p = node.props;
      const parts = [];
      textOf(p.children, parts);
      const content = parts.join("").replace(/[\r\n]+/g, " ");
      const at = p.at ?? "top-left";
      let x, y, h = 0, v = 0;
      if (typeof at === "string") {
        const anchor = ANCHORS[at];
        if (!anchor) throw new Error(`<text> 的 at 不认识 "${at}"，可用 ${Object.keys(ANCHORS).join("、")} 或 [x, y]`);
        x = UI_MARGIN + (ui.width - UI_MARGIN * 2) * anchor[0];
        y = UI_MARGIN + (ui.height - UI_MARGIN * 2) * anchor[1];
        h = anchor[0] * 2;
        v = anchor[1] * 2;
      } else if (Array.isArray(at) && at.length === 2 && at.every((n2) => typeof n2 === "number" && Number.isFinite(n2))) {
        x = at[0];
        y = at[1];
      } else {
        throw new Error("<text> 的 at 必须是九宫格位置名或 [x, y]");
      }
      ui.text(content, x, y, { size: p.size, color: p.color, bold: p.bold, align: H[h], valign: V[v] });
    };
    const visit = (child, ui, depth, source) => {
      if (child === null || child === void 0 || typeof child === "boolean") return;
      if (depth > MAX_DEPTH) {
        report(`${sourcePrefix(source)}界面树嵌套超过 ${MAX_DEPTH} 层`);
        return;
      }
      if (Array.isArray(child)) {
        for (const c of child) visit(c, ui, depth + 1, source);
        return;
      }
      if (!isNode(child)) {
        report(`${sourcePrefix(source)}界面树里的文字要放在 <text> 里`);
        return;
      }
      const node = child;
      const type = node.type;
      if (type === Fragment) return visit(node.props.children, ui, depth + 1, node.source ?? source);
      if (typeof type === "function" && !isPrefab(type)) {
        let out;
        try {
          out = type(node.props);
        } catch (error) {
          report(`${sourcePrefix(node.source)}界面组件 ${nodeName(node)} 出错：${error?.message ?? error}`);
          return;
        }
        return visit(out, ui, depth + 1, node.source ?? source);
      }
      if (type === "text") {
        try {
          text(node, ui);
        } catch (error) {
          report(`${sourcePrefix(node.source)}${error?.message ?? error}`);
        }
        return;
      }
      report(`${sourcePrefix(node.source)}界面树里不认识 <${nodeName(node)}>，只能用 <text>、片段和函数组件`);
    };
    return (tree, ui) => visit(tree, ui, 0);
  }

  // runtime/src/world/game.ts
  function defineGame(def) {
    if (!def || typeof def !== "object") throw new Error("defineGame 的参数必须是对象");
    for (const key of ["scene", "ui"]) {
      if (def[key] !== void 0 && typeof def[key] !== "function") throw new Error(`defineGame：${key} 必须是返回标签树的函数`);
    }
    if (def.blocks !== void 0 && !Array.isArray(def.blocks)) throw new Error("defineGame：blocks 必须是 defineBlock 结果的数组");
    if (def.prefabs !== void 0 && (!Array.isArray(def.prefabs) || !def.prefabs.every(isPrefab))) {
      throw new Error("defineGame：prefabs 必须是 definePrefab 结果的数组");
    }
    const flow = def.flow === void 0 ? void 0 : checkFlow(def.flow);
    return {
      apply(ctx) {
        const w = ctx.world;
        const unit = unitOf(ctx) ?? "(host)";
        if (flow) ctx.effect(() => w.setFlow(flow, unit), "world.flow");
        for (const block of def.blocks ?? []) ctx.effect(() => w.registry.addBlock(block), `world.block(${block.name})`);
        for (const prefab of def.prefabs ?? []) ctx.effect(() => w.registry.addPrefab(prefab), `world.prefab(${prefab.prefab})`);
        ctx.effect(() => {
          w.setControls(def.controls);
          const applied = w.controls;
          return () => {
            if (w.controls === applied) w.setControls(void 0);
          };
        }, "world.controls");
        w.mergeVars(def.vars);
        const scene = def.scene;
        if (scene) {
          const mountScene = () => {
            const s = w.flowScene;
            w.mount(scene({ state: s.state, params: s.params, data: ctx.data }));
          };
          mountScene();
          if (flow) w.onFlowEnter(mountScene);
        }
        const ui = def.ui;
        if (ui) {
          const logger = ctx.logger("world");
          const render = createUIRenderer((message) => logger.error(message));
          let lastError = "";
          ctx.on("update", () => {
            let tree;
            try {
              tree = ui(w, ctx.ui);
            } catch (error) {
              const message = `ui 出错：${error?.stack ?? error?.message ?? error}`;
              if (message !== lastError) logger.error(message);
              lastError = message;
              return;
            }
            lastError = "";
            render(tree, ctx.ui);
          });
        }
      }
    };
  }

  // runtime/src/index.ts
  function definePlugin(plugin) {
    return plugin;
  }
  return __toCommonJS(index_exports);
})();
globalThis.pot = pot;
