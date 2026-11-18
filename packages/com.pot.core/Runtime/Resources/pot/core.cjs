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
    API_VERSION: () => API_VERSION,
    AudioService: () => AudioService,
    BUILTIN_UNIFORMS: () => BUILTIN_UNIFORMS,
    CORE_SERVICES: () => CORE_SERVICES,
    CacheService: () => CacheService,
    Canvas: () => Canvas,
    CanvasGradient: () => CanvasGradient,
    CanvasRenderingContext2D: () => CanvasRenderingContext2D,
    ClockService: () => ClockService,
    Context: () => Context,
    CordisError: () => CordisError,
    DataService: () => DataService,
    DisposableList: () => DisposableList,
    Entity: () => Entity,
    EventsService: () => EventsService,
    Fiber: () => Fiber,
    FiberState: () => FiberState,
    GfxService: () => GfxService,
    Inject: () => Inject,
    InputService: () => InputService,
    LIBRARY: () => LIBRARY,
    Logger: () => Logger,
    LoggerLevel: () => LoggerLevel,
    LoggerService: () => LoggerService,
    PluginsService: () => PluginsService,
    PostChain: () => PostChain,
    RegistryService: () => RegistryService,
    Runtime: () => Runtime,
    SceneService: () => SceneService,
    Service: () => Service,
    Shader: () => Shader,
    StateService: () => StateService,
    StateTypeError: () => StateTypeError,
    Texture: () => Texture,
    TimerService: () => TimerService,
    UIService: () => UIService,
    VERSION: () => VERSION,
    ValidationError: () => ValidationError,
    ancestors: () => ancestors,
    applyUniforms: () => applyUniforms,
    assertSerializable: () => assertSerializable,
    buildOuterStack: () => buildOuterStack,
    c16: () => c16,
    c256: () => c256,
    compileModule: () => compileModule,
    composeError: () => composeError,
    createCallable: () => createCallable,
    createRuntime: () => createRuntime,
    createUnit: () => createUnit,
    createUnityHost: () => createUnityHost,
    currentRuntime: () => currentRuntime,
    decode: () => decode,
    deepClone: () => deepClone,
    defaultFormatters: () => defaultFormatters,
    definePlugin: () => definePlugin,
    encode: () => encode,
    encodePcm16: () => encodePcm16,
    estimateSize: () => estimateSize,
    fontFamilies: () => fontFamilies,
    getPropertyDescriptor: () => getPropertyDescriptor,
    getTraceable: () => getTraceable,
    hash: () => hash,
    isBailed: () => isBailed,
    isConstructor: () => isConstructor,
    isObject: () => isObject,
    joinPrototype: () => joinPrototype,
    mapErrors: () => mapErrors,
    markFiber: () => markFiber,
    parseColor: () => parseColor,
    parseCssColor: () => parseCssColor,
    parseFont: () => parseFont,
    preprocess: () => preprocess,
    resolveConfig: () => resolveConfig,
    runModule: () => runModule,
    symbols: () => symbols,
    unitOf: () => unitOf,
    unitOfFiber: () => unitOfFiber,
    unity: () => unity,
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
    /** 暂停状态下推进 n 个游戏帧 */
    step(frames = 1) {
      this._paused = true;
      this._steps += Math.max(1, frames | 0);
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
      if (this._paused) {
        if (this._steps <= 0) return;
        this._steps--;
      }
      const scaled = Math.max(0, dt) * this.scale;
      this.time += scaled;
      this.frame++;
      this._runDue();
      this.ctx.emit("update", scaled, this.time);
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
    _schedule(label, trigger, isDisposed = false) {
      let cancel;
      const dispose = this.ctx.effect(() => () => {
        isDisposed = true;
        cancel?.();
      }, label);
      const wrapper = (...args) => {
        cancel?.();
        cancel = trigger(args, isDisposed);
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
        if (existing.version === version) return existing.value;
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
        if (next === void 0) next = this._init(key, options);
        existing.value = next;
        existing.version = version;
        return next;
      }
      const value = this._init(key, options);
      this._entries.set(key, { value, owner, version, defined: true });
      return value;
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
    importJSON(json) {
      if (!json) return;
      const data = decode(JSON.parse(json));
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
    /** 窗口是否有焦点（失焦时可以自动暂停） */
    focused() {
      return this._host.engine.focused();
    }
  };

  // runtime/src/canvas.ts
  var TAU = Math.PI * 2;
  var NAMED = {
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    lime: "#00ff00",
    blue: "#0000ff",
    yellow: "#ffff00",
    orange: "#ffa500",
    gray: "#808080",
    grey: "#808080",
    silver: "#c0c0c0",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    purple: "#800080",
    navy: "#000080",
    maroon: "#800000",
    transparent: "#00000000"
  };
  function hue(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  function parseCssColor(input) {
    let s = String(input).trim().toLowerCase();
    if (NAMED[s]) s = NAMED[s];
    if (s[0] === "#") {
      const h = s.slice(1);
      if (!/^[0-9a-f]+$/.test(h)) return null;
      const x = h.length === 3 || h.length === 4 ? h.split("").map((c) => c + c).join("") : h;
      if (x.length !== 6 && x.length !== 8) return null;
      const v = (i) => parseInt(x.slice(i, i + 2), 16) / 255;
      return [v(0), v(2), v(4), x.length === 8 ? v(6) : 1];
    }
    const m = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(s);
    if (!m) return null;
    const parts = m[2].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const num = (t, scale) => t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t) / scale;
    const a = parts.length > 3 ? Math.min(1, Math.max(0, num(parts[3], 1))) : 1;
    if (m[1].startsWith("rgb")) {
      const c = parts.slice(0, 3).map((t) => Math.min(1, Math.max(0, num(t, 255))));
      if (c.some(Number.isNaN) || Number.isNaN(a)) return null;
      return [c[0], c[1], c[2], a];
    }
    const hh = (parseFloat(parts[0]) / 360 % 1 + 1) % 1;
    const ss = Math.min(1, Math.max(0, parseFloat(parts[1]) / 100));
    const ll = Math.min(1, Math.max(0, parseFloat(parts[2]) / 100));
    if ([hh, ss, ll, a].some(Number.isNaN)) return null;
    if (ss === 0) return [ll, ll, ll, a];
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    return [hue(p, q, hh + 1 / 3), hue(p, q, hh), hue(p, q, hh - 1 / 3), a];
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
      const half = Math.acos(Math.max(-1, Math.min(1, cos))) / 2;
      const dist = r / Math.tan(half);
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
      const W = this.canvas.width, H = this.canvas.height;
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
      const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H, Math.ceil(maxY));
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
  function srgbToLinear(v) {
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  function parseColor(color) {
    if (typeof color === "string") {
      const hex = color.replace("#", "");
      const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
      const n2 = parseInt(full.slice(0, 6), 16);
      const a = full.length >= 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
      return [(n2 >> 16 & 255) / 255, (n2 >> 8 & 255) / 255, (n2 & 255) / 255, a];
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
      if (options.mode !== void 0 || options.shadows !== void 0) {
        engine.material(this.id, options.mode ?? "", options.shadows === void 0 ? -1 : options.shadows ? 1 : 0);
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
    collider(enabled) {
      this._engine.collider(this.id, enabled);
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
      const blend = options.blend ?? "none";
      const queue = options.queue ?? (blend === "none" ? "opaque" : "transparent");
      const cull = options.cull ?? "back";
      let flags = cull === "front" ? 1 : cull === "none" ? 2 : 0;
      if (options.depthWrite ?? queue === "opaque") flags |= 4;
      flags |= { none: 0, alpha: 1, add: 2, premultiplied: 3 }[blend] << 3;
      if (options.depthTest === false) flags |= 128;
      if (options.frustumCull === false) flags |= 256;
      const shadows = options.shadows ?? queue === "opaque";
      engine.gfxBind(this.id, typeof shader === "string" ? shader : shader.name, flags, queue === "transparent" ? 1 : 0, shadows ? 1 : 0);
      if (options.uniforms) this.uniforms(options.uniforms);
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
    /** 灯光强度（仅灯光对象） */
    intensity(value) {
      this._engine.lightIntensity(this.id, value);
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
      const shape = options.shape ?? "cube";
      const name = options.name ?? shape;
      const unit = unitOf(this.ctx) ?? "(host)";
      let id = 0;
      const dispose = this.ctx.effect(() => {
        id = engine.spawn(shape, name, options.parent?.id ?? 0);
        this.objects.set(id, { id, name, shape, unit });
        return () => {
          this.objects.delete(id);
          engine.destroy(id);
        };
      }, `scene.spawn(${name})`);
      const entity = new Entity(this, id, dispose);
      if (options.parent) {
        if (options.position) entity.localPosition = options.position;
        if (options.rotation) entity.localRotation = options.rotation;
      } else {
        if (options.position) entity.position = options.position;
        if (options.rotation) entity.rotation = options.rotation;
      }
      if (options.scale !== void 0) {
        const s = options.scale;
        entity.scale = typeof s === "number" ? [s, s, s] : s;
      }
      if (options.color) entity.color(options.color);
      if (options.material) entity.material(options.material);
      if (options.collider === false) entity.collider(false);
      if (options.layer !== void 0) entity.layer(options.layer);
      if (options.active === false) entity.active(false);
      return entity;
    }
    light(options = {}) {
      const entity = this.spawn({ shape: "empty", name: options.name ?? `${options.type ?? "directional"} light`, parent: options.parent, position: options.position, rotation: options.rotation });
      const [r, g, b] = parseColor(options.color ?? [1, 1, 1]);
      const engine = this.host.engine;
      engine.light(entity.id, options.type ?? "directional", options.intensity ?? 1, r, g, b, options.range ?? 10);
      if (options.spotAngle !== void 0 || options.shadows !== void 0) {
        const shadows = options.shadows === void 0 ? -1 : options.shadows === "none" ? 0 : options.shadows === "hard" ? 1 : 2;
        engine.lightOptions(entity.id, options.spotAngle ?? 0, shadows);
      }
      return entity;
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
      const json = JSON.stringify({
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
        id = engine.textTexture(json);
        return () => engine.destroyTexture(id);
      }, `scene.text(${options.text})`);
      return new Texture(id, width, height, dispose);
    }
    /** 注册网格，之后用 spawn({ shape: 'mesh:名字' }) 创建（自带网格碰撞体）。同名覆盖 */
    mesh(name, data) {
      const f = (v) => v ? bytesOf(v, Float32Array) : null;
      return this.host.engine.mesh(name, f(data.positions), f(data.normals), f(data.uvs), f(data.colors), bytesOf(data.indices, Uint32Array));
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
    /** 射线检测（命中图元自带的碰撞体）。direction 不必归一化 */
    raycast(origin, direction, options = {}) {
      const hit = this.host.engine.raycast(origin[0], origin[1], origin[2], direction[0], direction[1], direction[2], options.maxDistance ?? 0, options.mask ?? 0);
      if (!hit) return null;
      return { ...hit, entity: hit.id > 0 ? new Entity(this, hit.id) : void 0 };
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
  var n = (v) => String(Math.round(v * 10) / 10);
  var UIService = class extends Service {
    constructor(ctx, _host) {
      super(ctx, "ui");
      __publicField(this, "_host", _host);
      __publicField(this, "_list", []);
      __publicField(this, "_colors", /* @__PURE__ */ new Map());
      __publicField(this, "_submittedEmpty", true);
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
    line(x1, y1, x2, y2, color, width = 1, alpha = 1) {
      this._list.push(["l", n(x1), n(y1), n(x2), n(y2), this.hex(color, alpha), n(width)].join(FS));
    }
    /** 圆弧：角度制，0 度朝上，顺时针；sweep 360 为整圆 */
    arc(cx, cy, radius, color, thickness = 2, start = 0, sweep = 360, alpha = 1) {
      this._list.push(["a", n(cx), n(cy), n(radius), this.hex(color, alpha), n(thickness), n(start), n(sweep)].join(FS));
    }
    text(text, x, y, options = {}) {
      const h = options.align === "right" ? 2 : options.align === "center" ? 1 : 0;
      const v = options.valign === "bottom" ? 2 : options.valign === "middle" ? 1 : 0;
      const flags = (options.bold ? 1 : 0) | (options.shadow ? 2 : 0) | (options.wrap ? 4 : 0);
      const w = options.w ?? 0;
      const hh = options.h ?? 0;
      const s = String(text).split(RS).join("").split(FS).join("");
      this._list.push(["t", n(x), n(y), n(w), n(hh), this.hex(options.color ?? "#ffffff", options.alpha), String(Math.round(options.size ?? 16)), String(v * 3 + h), String(flags), s].join(FS));
    }
    /** 文字尺寸（像素） */
    measure(text, size = 16, bold = false) {
      const [width, height] = this._host.engine.uiMeasure(text, size, bold);
      return { width, height };
    }
    /** 鼠标是否在矩形内 */
    hit(x, y, w, h) {
      const [mx, my] = this._host.engine.mouse();
      return mx >= x && mx <= x + w && my >= y && my <= y + h;
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

  // runtime/src/gfx.ts
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

// 主光阴影：1 = 全亮，0 = 全影。按级联包围球选级联，3x3 双线性 PCF，超出阴影距离淡出
// pot_ShadowParams: x 强度（0 表示本帧无阴影），y 级联数，z 最大距离，w 1 = reversed Z
float pot_ShadowCmp(ivec2 p, float z) {
  float d = texelFetch(pot_ShadowMap, p, 0).r;
  return pot_ShadowParams.w > 0.5 ? step(d, z) : step(z, d);
}

float pot_Shadow(vec3 worldPos) {
  if (pot_ShadowParams.x <= 0.0) return 1.0;
  int count = int(pot_ShadowParams.y + 0.5);
  int ci = -1;
  for (int i = 0; i < 4; i++) {
    if (i >= count) break;
    vec3 dv = worldPos - pot_ShadowSpheres[i].xyz;
    if (dot(dv, dv) < pot_ShadowSpheres[i].w * pot_ShadowSpheres[i].w) { ci = i; break; }
  }
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
  function preprocess(stage, entry, read) {
    const files = ["(预置)"];
    const once = /* @__PURE__ */ new Set();
    const out = [HEADER.trimEnd()];
    out.push(`#define ${stage === "vertex" ? "POT_VERTEX" : "POT_FRAGMENT"} 1`);
    out.push(BUILTIN_UNIFORMS.trimEnd());
    if (stage === "vertex") out.push(VERTEX_INPUTS.trimEnd());
    else out.push("uniform samplerCube pot_EnvMap;\nuniform highp sampler2D pot_ShadowMap;\nuniform sampler2D pot_PlanarMap;");
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
        if (m[1]) {
          target = `<${m[1]}>`;
          const lib = LIBRARY[m[1]];
          if (lib === void 0) throw new Error(`${name}:${i + 1}: 未知的内置库 <${m[1]}>（可用：${Object.keys(LIBRARY).join("、")}）`);
          body = lib;
        } else {
          target = normalize2(dirname(name.startsWith("<") ? "" : name) + m[2]);
          if (stack.includes(target)) throw new Error(`${name}:${i + 1}: #include 循环：${[...stack, target].join(" → ")}`);
          body = read(target);
        }
        if (once.has(target) && m[1]) {
          out.push("");
          continue;
        }
        once.add(target);
        expand(target, body, depth + 1, [...stack, target]);
        out.push(`#line ${i + 2} ${index}`);
      }
    };
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
    }
    /** 后端名（d3d11）；为空表示当前平台不支持运行时着色器 */
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
      const name = options.name ?? `${options.vertex ?? (options.vertexSource !== void 0 ? `inline:${hash2(options.vertexSource)}` : `<${vertexEntry.library ?? "pot/standard.vert"}>`)}|${options.fragment ?? `inline:${hash2(options.fragmentSource)}`}`;
      let error = "";
      let vs;
      let fs;
      try {
        vs = preprocess("vertex", vertexEntry, read);
        fs = preprocess("fragment", fragmentEntry, read);
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
     * 随调用方插件卸载而关闭。
     */
    post(options) {
      const engine = this._host.engine;
      if (!options.passes?.length) throw new Error("gfx.post：至少需要一个 pass");
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
        const json = JSON.stringify({
          shared: chain._shared,
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
        const error = engine.gfxPost(json);
        if (error) throw new Error(`gfx.post：${error}`);
        if (this._post) this._post._active = false;
        this._post = chain;
        chain._active = true;
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

  // runtime/src/plugins.ts
  var CORE_SERVICES = ["clock", "timer", "state", "cache", "data", "scene", "input", "ui", "audio", "gfx", "plugins"];
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
    /** 发布期：bundle.cjs 是一个整体打包的模块，导出 { units: { 单元名: 模块导出 } }，共享代码只有一份 */
    _getBundle() {
      if (this._bundle !== void 0) return this._bundle;
      const code = this._host.readText("bundle.cjs");
      this._bundle = null;
      if (code) {
        const exports = runModule(compileModule(code, "bundle.cjs"), "bundle.cjs", this._modules);
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
    /** 安装核心服务 */
    async init() {
      const { root, host } = this;
      const modules = this.options.modules ?? { "@pot/core": globalThis.pot, "cordis": globalThis.pot };
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
      try {
        this.manifest = this.readManifest();
      } catch (error) {
        this.status = "failed";
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
      this.status = "running";
      return this;
    }
    tick(dt) {
      const clock = this.root.clock;
      const frame = clock.frame;
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
        failures: this.failures
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
    const H = Pot.PotHost;
    const FS2 = Pot.GameFS;
    const S = Pot.PotScene;
    const I = Pot.PotInput;
    const U = Pot.PotUI;
    const A = Pot.PotAudio;
    const R = Pot.PotRender;
    const G = Pot.PotGfx;
    return {
      platform: "unity",
      log: (level, text) => H.Log(level, text),
      readText: (path) => {
        const text = FS2.ReadText(path);
        return text === null || text === void 0 ? null : text;
      },
      gc: () => H.RequestGC(),
      send: (message) => H.Send(message),
      engine: {
        spawn: (shape, name, parent) => S.Spawn(shape, name, parent),
        destroy: (id) => S.Destroy(id),
        exists: (id) => S.Exists(id),
        setVec: (id, prop, x, y, z) => S.SetVec(id, prop, x, y, z),
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
        material: (id, mode, castShadows) => S.SetMaterial(id, mode, castShadows),
        surface: (id, metallic, smoothness) => S.SetSurface(id, metallic, smoothness),
        emission: (id, r, g, b) => S.SetEmission(id, r, g, b),
        collider: (id, enabled) => S.SetCollider(id, enabled),
        layer: (id, layer) => S.SetLayer(id, layer),
        raycast: (ox, oy, oz, dx, dy, dz, maxDistance, mask) => {
          const id = S.Raycast(ox, oy, oz, dx, dy, dz, maxDistance, mask);
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
        uiSubmit: (list) => U.Submit(list),
        uiMeasure: (text, size, bold) => {
          U.Measure(text, size, bold);
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
        textTexture: (json) => R.TextTexture(json),
        canvasText: (text, family, size, style) => R.CanvasText(text, family, size, style) ?? null,
        mesh: (name, positions, normals, uvs, colors, indices) => S.Mesh(name, positions, normals, uvs, colors, indices),
        matTexture: (id, slot, tex) => S.MatTexture(id, slot, tex),
        matFloat: (id, prop, value) => S.MatFloat(id, prop, value),
        matVector: (id, prop, x, y, z, w) => S.MatVector(id, prop, x, y, z, w),
        ambientTrilight: (sr, sg, sb, er, eg, eb, gr, gg, gb, reflection) => S.SetAmbientTrilight(sr, sg, sb, er, eg, eb, gr, gg, gb, reflection),
        render: (kind, json) => R.Configure(kind, json) ?? "",
        burst: (json) => R.Burst(json),
        gfxBackend: () => G.Backend() ?? "",
        gfxProgram: (name, vs, fs) => G.Program(name, vs, fs) ?? "",
        gfxDestroyProgram: (name) => G.DestroyProgram(name),
        gfxBind: (id, program, flags, queue, shadows) => G.Bind(id, program, flags, queue, shadows),
        gfxUniform: (id, name, n2, x, y, z, w) => G.Uniform(id, name, n2, x, y, z, w),
        gfxUniformArray: (id, name, data) => G.UniformArray(id, name, data),
        gfxTexture: (id, name, tex) => G.Texture(id, name, tex),
        gfxBakeBegin: () => G.BakeBegin(),
        gfxBake: (bind2, program, width, height, targets, blend) => G.Bake(bind2, program, width, height, targets, blend) ?? "!",
        gfxPost: (json) => G.Post(json) ?? ""
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

  // runtime/src/index.ts
  function definePlugin(plugin) {
    return plugin;
  }
  return __toCommonJS(index_exports);
})();
globalThis.pot = pot;
