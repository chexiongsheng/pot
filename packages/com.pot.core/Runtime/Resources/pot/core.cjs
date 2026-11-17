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
    CORE_SERVICES: () => CORE_SERVICES,
    CacheService: () => CacheService,
    ClockService: () => ClockService,
    Context: () => Context,
    CordisError: () => CordisError,
    DataService: () => DataService,
    DisposableList: () => DisposableList,
    Entity: () => Entity,
    EventsService: () => EventsService,
    Fiber: () => Fiber,
    FiberState: () => FiberState,
    Inject: () => Inject,
    InputService: () => InputService,
    Logger: () => Logger,
    LoggerLevel: () => LoggerLevel,
    LoggerService: () => LoggerService,
    PluginsService: () => PluginsService,
    RegistryService: () => RegistryService,
    Runtime: () => Runtime,
    SceneService: () => SceneService,
    Service: () => Service,
    StateService: () => StateService,
    StateTypeError: () => StateTypeError,
    Texture: () => Texture,
    TimerService: () => TimerService,
    UIService: () => UIService,
    VERSION: () => VERSION,
    ValidationError: () => ValidationError,
    ancestors: () => ancestors,
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
    getPropertyDescriptor: () => getPropertyDescriptor,
    getTraceable: () => getTraceable,
    hash: () => hash,
    isBailed: () => isBailed,
    isConstructor: () => isConstructor,
    isObject: () => isObject,
    joinPrototype: () => joinPrototype,
    markFiber: () => markFiber,
    parseColor: () => parseColor,
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
      let hash2 = 0;
      for (let i = 0; i < name.length; i++) {
        hash2 = (hash2 << 3) - hash2 + name.charCodeAt(i) + 13;
        hash2 |= 0;
      }
      const colors = !level ? [] : level >= 2 ? c256 : c16;
      return colors[Math.abs(hash2) % colors.length];
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

  // runtime/src/plugins.ts
  var CORE_SERVICES = ["clock", "timer", "state", "cache", "data", "scene", "input", "ui", "audio", "plugins"];
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
        mesh: (name, positions, normals, uvs, colors, indices) => S.Mesh(name, positions, normals, uvs, colors, indices),
        matTexture: (id, slot, tex) => S.MatTexture(id, slot, tex),
        matFloat: (id, prop, value) => S.MatFloat(id, prop, value),
        matVector: (id, prop, x, y, z, w) => S.MatVector(id, prop, x, y, z, w),
        ambientTrilight: (sr, sg, sb, er, eg, eb, gr, gg, gb, reflection) => S.SetAmbientTrilight(sr, sg, sb, er, eg, eb, gr, gg, gb, reflection),
        render: (kind, json) => R.Configure(kind, json) ?? "",
        burst: (json) => R.Burst(json)
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
