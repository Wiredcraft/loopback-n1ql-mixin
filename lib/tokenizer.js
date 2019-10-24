'use strict';

const mapping = {
  '[': ']'
};
class Token {
  constructor() {
    // check brackets openess
    this.left = [];
    this.value = '';
    this.type = 'str';
    this.next = null;
    this.pre = null;
  };
  open(s) {
    this.left.push(s);
  }

  close(s) {
    const c = this.left.pop();
    if (! c in mapping) throw Error('syn');
    if (s != mapping[c]) throw Error('syn2');
  }
  add(char) {
    switch (this.type) {
      case 'array':
        if (isNaN(parseInt(char))) throw Error('Array index should be number');
        break;
      default: break;
    }
    this.value = this.value.concat(char);
  }
  toString() {
    switch (this.type) {
      case 'array':
        if (this.left.length !== 0) throw Error('open Bracket');
        if (this.value === '') throw Error('Array index should be defined');
        return `[${this.value}]`;
      default:
        if (this.pre) {
          return `.\`${this.value}\``;
        }
        return `\`${this.value}\``;
    }
  }
  setType(value) {
    if (this.left.length !== 0) throw Error('open Bracket');
    this.type = value;
    if (value === 'any') {
      if (!this.pre) throw Error('syntax Error!');
    };
  }
}
class Tokenizer {
  constructor(str) {
    this.cur = new Token('');
    this.root = this.cur;
    this.value = str;
    this.anyCount = 0;
  }
  next() {
    const t = new Token('');
    t.pre = this.cur;
    this.cur.next = t;
    this.cur = t;
  }
  toString() {
    let field = '';
    while (this.cur) {
      field = field.concat(this.cur.toString());
      this.cur = this.cur.next;
    }
    return ['', field];
  };
  toAnyIndex() {
    let field = '';
    while (this.cur) {
      if (this.cur.type === 'any') {
        let tail = '';
        let next = this.cur.next;
        while (next) {
          tail = tail.concat(next.toString());
          next = next.next;
        }
        return `DISTINCT ARRAY \`elem\`${tail} FOR \`elem\` IN ${field} END`;
      };
      field = field.concat(this.cur.toString());
      this.cur = this.cur.next;
    }
    return ['', field];
  }
  toAnyQuery() {
    let field = '';
    let context = '';
    while (this.cur) {
      if (this.cur.type === 'any') {
        context = `ANY \`elem\` IN ${field} SATISFIES %s END`;
        field = `\`elem\``;
        this.cur = this.cur.next;
      };
      field = field.concat(this.cur.toString());
      this.cur = this.cur.next;
    }
    return [context, field];
  }
  parse(phase = 'query') {
    if (this.value === 'id') return ['', 'TOSTRING(META().id)'];
    const tokens = [];
    let cur = new Token('');
    tokens.push(cur);
    for (let c of this.value) {
      switch (c) {
        case '.':
          this.next();
          break;
        case '[':
          this.next();
          this.cur.setType('array');
          this.cur.open('[');
          break;
        case '*':
          this.cur.setType('any');
          this.anyCount = this.anyCount + 1;
          if (this.anyCount > 1) throw Error('Only one any is allowed');
          break;
        case ']':
          this.cur.close(']');
          break;
        default:
          this.cur.add(c);
          break;
      }
    }
    this.cur = this.root;
    if (this.anyCount === 0) return this.toString();
    if (phase === 'query') return this.toAnyQuery();
    return this.toAnyIndex();
  };
}
module.exports = (field, mod) => {
  const token = new Tokenizer(field);
  return token.parse(mod);
};
