/**
 * A mock of the Figma plugin API, just faithful enough to execute
 * figma/code.js end to end and surface runtime errors.
 *
 * It is NOT a layout engine — widths and heights are rough — but it catches
 * undefined identifiers, bad call order, missing nodes, wrong property
 * shapes and anything that throws.
 */

let idSeq = 0;

const WARN = [];
const ERR = [];

class Node {
  constructor(type) {
    this.type = type;
    this.id = `${type}:${++idSeq}`;
    this.name = type;
    this.children = [];
    this.parent = null;
    this.fills = [];
    this.strokes = [];
    this.effects = [];
    this.x = 0;
    this.y = 0;
    this._w = 100;
    this._h = 40;
    this.reactions = [];
    this.visible = true;
  }

  get width() {
    if (this.layoutMode && this.layoutMode !== "NONE" && this.primaryAxisSizingMode === "AUTO") {
      return this._measure().w;
    }
    return this._w;
  }
  set width(v) { this._w = v; }

  get height() {
    if (this.layoutMode && this.layoutMode !== "NONE") return this._measure().h;
    return this._h;
  }
  set height(v) { this._h = v; }

  _measure() {
    const horizontal = this.layoutMode === "HORIZONTAL";
    const pl = this.paddingLeft || 0, pr = this.paddingRight || 0;
    const pt = this.paddingTop || 0, pb = this.paddingBottom || 0;
    const gap = this.itemSpacing || 0;
    let main = 0, cross = 0;
    for (const c of this.children) {
      const cw = c._w || 0, ch = c._h || 0;
      if (horizontal) { main += cw; cross = Math.max(cross, ch); }
      else { main += ch; cross = Math.max(cross, cw); }
    }
    if (this.children.length > 1) main += gap * (this.children.length - 1);
    return horizontal
      ? { w: this._w || main + pl + pr, h: main === 0 ? this._h : cross + pt + pb }
      : { w: this._w, h: main + pt + pb };
  }

  // Figma rejects WRAP while the main axis still hugs its content.
  set layoutWrap(v) {
    if (v === "WRAP") {
      if (this.layoutMode !== "HORIZONTAL") {
        throw new Error(`layoutWrap=WRAP needs HORIZONTAL layout on "${this.name}" (got ${this.layoutMode})`);
      }
      if (this.primaryAxisSizingMode === "AUTO") {
        throw new Error(`layoutWrap=WRAP while primaryAxisSizingMode=AUTO on "${this.name}"`);
      }
    }
    this._wrap = v;
  }
  get layoutWrap() { return this._wrap; }

  set counterAxisSpacing(v) {
    if (this._wrap !== "WRAP") throw new Error(`counterAxisSpacing without WRAP on "${this.name}"`);
    this._crossGap = v;
  }
  get counterAxisSpacing() { return this._crossGap; }

  appendChild(node) {
    if (!node) throw new Error(`appendChild(${node}) on ${this.name}`);
    if (node.parent) node.parent.children = node.parent.children.filter((c) => c !== node);
    node.parent = this;
    this.children.push(node);
  }

  insertChild(i, node) { this.appendChild(node); }

  resize(w, h) {
    if (typeof w !== "number" || Number.isNaN(w)) throw new Error(`resize width=${w} on ${this.name}`);
    if (typeof h !== "number" || Number.isNaN(h)) throw new Error(`resize height=${h} on ${this.name}`);
    this._w = Math.max(0.01, w);
    this._h = Math.max(0.01, h);
  }

  rescale(f) { this._w *= f; this._h *= f; }

  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }

  clone() {
    const copy = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    copy.id = `${this.type}:${++idSeq}`;
    copy.parent = null;
    copy.children = this.children.map((c) => {
      const cc = c.clone();
      cc.parent = copy;
      return cc;
    });
    copy.reactions = [];
    return copy;
  }

  async setReactionsAsync(r) {
    for (const reaction of r) {
      for (const action of reaction.actions || []) {
        if (action.type === "NODE" && !action.destinationId) {
          throw new Error(`reaction with no destinationId on ${this.name}`);
        }
      }
    }
    this.reactions = r;
  }

  setExplicitVariableModeForCollection(collection, modeId) {
    if (!collection || !modeId) throw new Error(`bad setExplicitVariableModeForCollection on ${this.name}`);
    this._mode = modeId;
  }

  setBoundVariable() {}
  async loadAsync() {}
}

class TextNode extends Node {
  constructor() {
    super("TEXT");
    this._chars = "";
    this.fontSize = 15;
    this.textAutoResize = "WIDTH_AND_HEIGHT";
  }
  get characters() { return this._chars; }
  set characters(v) {
    if (typeof v !== "string") throw new Error(`characters set to ${typeof v}`);
    this._chars = v;
    // Rough metrics so downstream layout maths gets plausible numbers.
    this._w = Math.max(8, v.length * this.fontSize * 0.55);
    this._h = Math.max(this.fontSize * 1.3, 12);
  }
  set textTruncation(v) {
    if (v === "ENDING" && this.textAutoResize === "WIDTH_AND_HEIGHT") {
      throw new Error(`textTruncation=ENDING while the node still auto-widens: "${this._chars}"`);
    }
    this._truncation = v;
  }
  get textTruncation() { return this._truncation; }

  set fontName(v) {
    if (!v || !v.family || !v.style) throw new Error(`bad fontName ${JSON.stringify(v)}`);
    if (!LOADED_FONTS.has(`${v.family}|${v.style}`)) {
      throw new Error(`font not loaded: ${v.family} ${v.style}`);
    }
    this._font = v;
  }
  get fontName() { return this._font; }
}

class VectorNode extends Node {
  constructor() { super("VECTOR"); }

  async setVectorNetworkAsync(net) {
    if (!net || !Array.isArray(net.vertices) || !Array.isArray(net.segments)) {
      throw new Error("setVectorNetworkAsync needs vertices + segments");
    }
    if (net.vertices.length < 2) throw new Error("vector network needs at least 2 vertices");
    for (const v of net.vertices) {
      for (const k of ["x", "y"]) {
        if (typeof v[k] !== "number" || Number.isNaN(v[k])) throw new Error(`vertex.${k} = ${v[k]}`);
      }
      if (v.strokeCap && !["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL"].includes(v.strokeCap)) {
        throw new Error(`bad strokeCap ${v.strokeCap}`);
      }
    }
    for (const s of net.segments) {
      if (net.vertices[s.start] === undefined || net.vertices[s.end] === undefined) {
        throw new Error(`segment references missing vertex: ${s.start}->${s.end}`);
      }
    }
    this._network = net;
    const xs = net.vertices.map((v) => v.x);
    const ys = net.vertices.map((v) => v.y);
    this._w = Math.max(1, Math.max(...xs) - Math.min(...xs));
    this._h = Math.max(1, Math.max(...ys) - Math.min(...ys));
  }

  set vectorPaths(v) {
    if (!Array.isArray(v)) throw new Error("vectorPaths must be an array");
    for (const p of v) {
      if (typeof p.data !== "string" || !p.data.length) throw new Error("empty vector path data");
      if (/NaN|undefined/.test(p.data)) throw new Error(`vector path contains NaN/undefined: ${p.data}`);
    }
    this._paths = v;
  }
  get vectorPaths() { return this._paths; }
}

class EllipseNode extends Node {
  constructor() { super("ELLIPSE"); }
  set arcData(v) {
    for (const k of ["startingAngle", "endingAngle", "innerRadius"]) {
      if (typeof v[k] !== "number" || Number.isNaN(v[k])) throw new Error(`arcData.${k} = ${v[k]}`);
    }
    if (v.innerRadius < 0 || v.innerRadius > 1) throw new Error(`arcData.innerRadius out of range: ${v.innerRadius}`);
    this._arc = v;
  }
  get arcData() { return this._arc; }
}

class ComponentNode extends Node { constructor() { super("COMPONENT"); } }
class ComponentSetNode extends Node { constructor() { super("COMPONENT_SET"); } }

class PageNode extends Node {
  constructor() { super("PAGE"); this.backgrounds = []; }
}

const LOADED_FONTS = new Set();

const collections = [];
const variables = [];

const figma = {
  root: { children: [], type: "DOCUMENT" },
  currentPage: null,

  createFrame() { const n = new Node("FRAME"); n.layoutMode = "NONE"; return n; },
  createText() { return new TextNode(); },
  createRectangle() { return new Node("RECTANGLE"); },
  createEllipse() { return new EllipseNode(); },
  createVector() { return new VectorNode(); },
  createPage() { const p = new PageNode(); figma.root.children.push(p); return p; },

  createNodeFromSvg(svg) {
    if (typeof svg !== "string" || svg.indexOf("<svg") !== 0) throw new Error("createNodeFromSvg needs svg markup");
    if (/CURRENT/.test(svg)) throw new Error("unsubstituted CURRENT placeholder in svg");
    const n = new Node("FRAME");
    n.resize(24, 24);
    const child = new VectorNode();
    child.vectorPaths = [{ windingRule: "NONE", data: "M 0 0 L 1 1" }];
    child.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
    n.appendChild(child);
    return n;
  },

  createComponentFromNode(node) {
    if (!node.parent) throw new Error(`createComponentFromNode on unparented node "${node.name}"`);
    const c = new ComponentNode();
    c.name = node.name;
    c._w = node._w;
    c._h = node._h;
    c.parent = node.parent;
    node.parent.children = node.parent.children.map((x) => (x === node ? c : x));
    return c;
  },

  combineAsVariants(components, parent) {
    if (!Array.isArray(components) || !components.length) throw new Error("combineAsVariants needs components");
    const names = new Set();
    for (const c of components) {
      if (c.type !== "COMPONENT") throw new Error("combineAsVariants got a non-component");
      if (names.has(c.name)) throw new Error(`duplicate variant name: ${c.name}`);
      names.add(c.name);
    }
    // Figma requires every variant to declare the same property set.
    const keysets = components.map((c) =>
      c.name.split(",").map((p) => p.split("=")[0].trim()).sort().join("|"));
    if (new Set(keysets).size > 1) throw new Error(`inconsistent variant properties: ${[...new Set(keysets)].join(" vs ")}`);

    const set = new ComponentSetNode();
    set.parent = parent;
    parent.children.push(set);
    for (const c of components) {
      c.parent = set;
      parent.children = parent.children.filter((x) => x !== c);
      set.children.push(c);
    }
    return set;
  },

  async loadFontAsync(f) {
    const known = process.env.INTER_ONLY
      ? { Inter: ["Regular", "Bold"] }
      : {
          Inter: ["Regular", "Medium", "Semi Bold", "Bold", "Italic"],
          Nunito: ["Regular", "SemiBold", "Bold", "ExtraBold", "Black", "Italic"],
          "Libre Baskerville": ["Regular", "Bold", "Italic"],
        };
    if (!known[f.family] || !known[f.family].includes(f.style)) {
      throw new Error(`font not available: ${f.family} ${f.style}`);
    }
    LOADED_FONTS.add(`${f.family}|${f.style}`);
  },

  async loadAllPagesAsync() {},

  notify(t) { NOTIFY.push(t); },
  closePlugin() {},
  showUI() {},
  ui: {
    postMessage(m) { UI_MESSAGES.push(m); },
    onmessage: null,
  },

  variables: {
    createVariableCollection(name) {
      const col = {
        id: `col:${++idSeq}`,
        name,
        modes: [{ modeId: `mode:${++idSeq}`, name: "Mode 1" }],
        variableIds: [],
        renameMode(id, n) {
          const m = this.modes.find((x) => x.modeId === id);
          if (!m) throw new Error("renameMode: unknown mode");
          m.name = n;
        },
        addMode(n) {
          const id = `mode:${++idSeq}`;
          this.modes.push({ modeId: id, name: n });
          return id;
        },
      };
      collections.push(col);
      return col;
    },
    createVariable(name, col, type) {
      if (typeof col === "string") throw new Error("legacy createVariable(collectionId) path taken");
      if (!col || !col.variableIds) throw new Error("createVariable: bad collection");
      if (!["COLOR", "FLOAT", "STRING", "BOOLEAN"].includes(type)) throw new Error(`bad variable type ${type}`);
      const v = {
        id: `var:${++idSeq}`,
        name,
        resolvedType: type,
        collection: col,
        values: {},
        scopes: [],
        setValueForMode(modeId, value) {
          if (!modeId) throw new Error(`setValueForMode with no modeId on ${name}`);
          if (type === "COLOR") {
            for (const k of ["r", "g", "b"]) {
              if (typeof value[k] !== "number" || Number.isNaN(value[k])) {
                throw new Error(`colour variable ${name} got ${k}=${value[k]}`);
              }
            }
          } else if (typeof value !== "number" || Number.isNaN(value)) {
            throw new Error(`float variable ${name} got ${value}`);
          }
          this.values[modeId] = value;
        },
      };
      col.variableIds.push(v.id);
      variables.push(v);
      return v;
    },
    async getLocalVariableCollectionsAsync() { return collections; },
    async getVariableByIdAsync(id) { return variables.find((v) => v.id === id) || null; },
    setBoundVariableForPaint(paint, field, variable) {
      if (!variable || !variable.id) throw new Error(`setBoundVariableForPaint got ${variable}`);
      if (variable.resolvedType !== "COLOR") throw new Error(`bound ${variable.name} is ${variable.resolvedType}, not COLOR`);
      return Object.assign({}, paint, { boundVariables: { [field]: { type: "VARIABLE_ALIAS", id: variable.id } } });
    },
  },
};

const NOTIFY = [];
const UI_MESSAGES = [];

globalThis.figma = figma;
globalThis.__html__ = "<html></html>";
globalThis.console = {
  log: (...a) => process.stdout.write(a.join(" ") + "\n"),
  warn: (...a) => WARN.push(a.join(" ")),
  error: (...a) => ERR.push(a.map((x) => (x && x.stack) || String(x)).join(" ")),
};

export { figma, NOTIFY, UI_MESSAGES, WARN, ERR, collections, variables };
