window.__ModuleLoader__.load({
	id: "pmp-dsh-tavern",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
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
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
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

// node_modules/showdown/dist/showdown.js
var require_showdown = __commonJS({
  "node_modules/showdown/dist/showdown.js"(exports, module2) {
    (function() {
      function getDefaultOpts(simple) {
        "use strict";
        var defaultOptions = {
          omitExtraWLInCodeBlocks: {
            defaultValue: false,
            describe: "Omit the default extra whiteline added to code blocks",
            type: "boolean"
          },
          noHeaderId: {
            defaultValue: false,
            describe: "Turn on/off generated header id",
            type: "boolean"
          },
          prefixHeaderId: {
            defaultValue: false,
            describe: "Add a prefix to the generated header ids. Passing a string will prefix that string to the header id. Setting to true will add a generic 'section-' prefix",
            type: "string"
          },
          rawPrefixHeaderId: {
            defaultValue: false,
            describe: 'Setting this option to true will prevent showdown from modifying the prefix. This might result in malformed IDs (if, for instance, the " char is used in the prefix)',
            type: "boolean"
          },
          ghCompatibleHeaderId: {
            defaultValue: false,
            describe: "Generate header ids compatible with github style (spaces are replaced with dashes, a bunch of non alphanumeric chars are removed)",
            type: "boolean"
          },
          rawHeaderId: {
            defaultValue: false,
            describe: `Remove only spaces, ' and " from generated header ids (including prefixes), replacing them with dashes (-). WARNING: This might result in malformed ids`,
            type: "boolean"
          },
          headerLevelStart: {
            defaultValue: false,
            describe: "The header blocks level start",
            type: "integer"
          },
          parseImgDimensions: {
            defaultValue: false,
            describe: "Turn on/off image dimension parsing",
            type: "boolean"
          },
          simplifiedAutoLink: {
            defaultValue: false,
            describe: "Turn on/off GFM autolink style",
            type: "boolean"
          },
          excludeTrailingPunctuationFromURLs: {
            defaultValue: false,
            describe: "Excludes trailing punctuation from links generated with autoLinking",
            type: "boolean"
          },
          literalMidWordUnderscores: {
            defaultValue: false,
            describe: "Parse midword underscores as literal underscores",
            type: "boolean"
          },
          literalMidWordAsterisks: {
            defaultValue: false,
            describe: "Parse midword asterisks as literal asterisks",
            type: "boolean"
          },
          strikethrough: {
            defaultValue: false,
            describe: "Turn on/off strikethrough support",
            type: "boolean"
          },
          tables: {
            defaultValue: false,
            describe: "Turn on/off tables support",
            type: "boolean"
          },
          tablesHeaderId: {
            defaultValue: false,
            describe: "Add an id to table headers",
            type: "boolean"
          },
          ghCodeBlocks: {
            defaultValue: true,
            describe: "Turn on/off GFM fenced code blocks support",
            type: "boolean"
          },
          tasklists: {
            defaultValue: false,
            describe: "Turn on/off GFM tasklist support",
            type: "boolean"
          },
          smoothLivePreview: {
            defaultValue: false,
            describe: "Prevents weird effects in live previews due to incomplete input",
            type: "boolean"
          },
          smartIndentationFix: {
            defaultValue: false,
            describe: "Tries to smartly fix indentation in es6 strings",
            type: "boolean"
          },
          disableForced4SpacesIndentedSublists: {
            defaultValue: false,
            describe: "Disables the requirement of indenting nested sublists by 4 spaces",
            type: "boolean"
          },
          simpleLineBreaks: {
            defaultValue: false,
            describe: "Parses simple line breaks as <br> (GFM Style)",
            type: "boolean"
          },
          requireSpaceBeforeHeadingText: {
            defaultValue: false,
            describe: "Makes adding a space between `#` and the header text mandatory (GFM Style)",
            type: "boolean"
          },
          ghMentions: {
            defaultValue: false,
            describe: "Enables github @mentions",
            type: "boolean"
          },
          ghMentionsLink: {
            defaultValue: "https://github.com/{u}",
            describe: "Changes the link generated by @mentions. Only applies if ghMentions option is enabled.",
            type: "string"
          },
          encodeEmails: {
            defaultValue: true,
            describe: "Encode e-mail addresses through the use of Character Entities, transforming ASCII e-mail addresses into its equivalent decimal entities",
            type: "boolean"
          },
          openLinksInNewWindow: {
            defaultValue: false,
            describe: "Open all links in new windows",
            type: "boolean"
          },
          backslashEscapesHTMLTags: {
            defaultValue: false,
            describe: "Support for HTML Tag escaping. ex: <div>foo</div>",
            type: "boolean"
          },
          emoji: {
            defaultValue: false,
            describe: "Enable emoji support. Ex: `this is a :smile: emoji`",
            type: "boolean"
          },
          underline: {
            defaultValue: false,
            describe: "Enable support for underline. Syntax is double or triple underscores: `__underline word__`. With this option enabled, underscores no longer parses into `<em>` and `<strong>`",
            type: "boolean"
          },
          ellipsis: {
            defaultValue: true,
            describe: "Replaces three dots with the ellipsis unicode character",
            type: "boolean"
          },
          completeHTMLDocument: {
            defaultValue: false,
            describe: "Outputs a complete html document, including `<html>`, `<head>` and `<body>` tags",
            type: "boolean"
          },
          metadata: {
            defaultValue: false,
            describe: "Enable support for document metadata (defined at the top of the document between `\xAB\xAB\xAB` and `\xBB\xBB\xBB` or between `---` and `---`).",
            type: "boolean"
          },
          splitAdjacentBlockquotes: {
            defaultValue: false,
            describe: "Split adjacent blockquote blocks",
            type: "boolean"
          }
        };
        if (simple === false) {
          return JSON.parse(JSON.stringify(defaultOptions));
        }
        var ret = {};
        for (var opt in defaultOptions) {
          if (defaultOptions.hasOwnProperty(opt)) {
            ret[opt] = defaultOptions[opt].defaultValue;
          }
        }
        return ret;
      }
      function allOptionsOn() {
        "use strict";
        var options = getDefaultOpts(true), ret = {};
        for (var opt in options) {
          if (options.hasOwnProperty(opt)) {
            ret[opt] = true;
          }
        }
        return ret;
      }
      var showdown2 = {}, parsers = {}, extensions = {}, globalOptions = getDefaultOpts(true), setFlavor = "vanilla", flavor = {
        github: {
          omitExtraWLInCodeBlocks: true,
          simplifiedAutoLink: true,
          excludeTrailingPunctuationFromURLs: true,
          literalMidWordUnderscores: true,
          strikethrough: true,
          tables: true,
          tablesHeaderId: true,
          ghCodeBlocks: true,
          tasklists: true,
          disableForced4SpacesIndentedSublists: true,
          simpleLineBreaks: true,
          requireSpaceBeforeHeadingText: true,
          ghCompatibleHeaderId: true,
          ghMentions: true,
          backslashEscapesHTMLTags: true,
          emoji: true,
          splitAdjacentBlockquotes: true
        },
        original: {
          noHeaderId: true,
          ghCodeBlocks: false
        },
        ghost: {
          omitExtraWLInCodeBlocks: true,
          parseImgDimensions: true,
          simplifiedAutoLink: true,
          excludeTrailingPunctuationFromURLs: true,
          literalMidWordUnderscores: true,
          strikethrough: true,
          tables: true,
          tablesHeaderId: true,
          ghCodeBlocks: true,
          tasklists: true,
          smoothLivePreview: true,
          simpleLineBreaks: true,
          requireSpaceBeforeHeadingText: true,
          ghMentions: false,
          encodeEmails: true
        },
        vanilla: getDefaultOpts(true),
        allOn: allOptionsOn()
      };
      showdown2.helper = {};
      showdown2.extensions = {};
      showdown2.setOption = function(key, value) {
        "use strict";
        globalOptions[key] = value;
        return this;
      };
      showdown2.getOption = function(key) {
        "use strict";
        return globalOptions[key];
      };
      showdown2.getOptions = function() {
        "use strict";
        return globalOptions;
      };
      showdown2.resetOptions = function() {
        "use strict";
        globalOptions = getDefaultOpts(true);
      };
      showdown2.setFlavor = function(name2) {
        "use strict";
        if (!flavor.hasOwnProperty(name2)) {
          throw Error(name2 + " flavor was not found");
        }
        showdown2.resetOptions();
        var preset = flavor[name2];
        setFlavor = name2;
        for (var option in preset) {
          if (preset.hasOwnProperty(option)) {
            globalOptions[option] = preset[option];
          }
        }
      };
      showdown2.getFlavor = function() {
        "use strict";
        return setFlavor;
      };
      showdown2.getFlavorOptions = function(name2) {
        "use strict";
        if (flavor.hasOwnProperty(name2)) {
          return flavor[name2];
        }
      };
      showdown2.getDefaultOptions = function(simple) {
        "use strict";
        return getDefaultOpts(simple);
      };
      showdown2.subParser = function(name2, func) {
        "use strict";
        if (showdown2.helper.isString(name2)) {
          if (typeof func !== "undefined") {
            parsers[name2] = func;
          } else {
            if (parsers.hasOwnProperty(name2)) {
              return parsers[name2];
            } else {
              throw Error("SubParser named " + name2 + " not registered!");
            }
          }
        }
      };
      showdown2.extension = function(name2, ext) {
        "use strict";
        if (!showdown2.helper.isString(name2)) {
          throw Error("Extension 'name' must be a string");
        }
        name2 = showdown2.helper.stdExtName(name2);
        if (showdown2.helper.isUndefined(ext)) {
          if (!extensions.hasOwnProperty(name2)) {
            throw Error("Extension named " + name2 + " is not registered!");
          }
          return extensions[name2];
        } else {
          if (typeof ext === "function") {
            ext = ext();
          }
          if (!showdown2.helper.isArray(ext)) {
            ext = [ext];
          }
          var validExtension = validate(ext, name2);
          if (validExtension.valid) {
            extensions[name2] = ext;
          } else {
            throw Error(validExtension.error);
          }
        }
      };
      showdown2.getAllExtensions = function() {
        "use strict";
        return extensions;
      };
      showdown2.removeExtension = function(name2) {
        "use strict";
        delete extensions[name2];
      };
      showdown2.resetExtensions = function() {
        "use strict";
        extensions = {};
      };
      function validate(extension, name2) {
        "use strict";
        var errMsg = name2 ? "Error in " + name2 + " extension->" : "Error in unnamed extension", ret = {
          valid: true,
          error: ""
        };
        if (!showdown2.helper.isArray(extension)) {
          extension = [extension];
        }
        for (var i = 0; i < extension.length; ++i) {
          var baseMsg = errMsg + " sub-extension " + i + ": ", ext = extension[i];
          if (typeof ext !== "object") {
            ret.valid = false;
            ret.error = baseMsg + "must be an object, but " + typeof ext + " given";
            return ret;
          }
          if (!showdown2.helper.isString(ext.type)) {
            ret.valid = false;
            ret.error = baseMsg + 'property "type" must be a string, but ' + typeof ext.type + " given";
            return ret;
          }
          var type = ext.type = ext.type.toLowerCase();
          if (type === "language") {
            type = ext.type = "lang";
          }
          if (type === "html") {
            type = ext.type = "output";
          }
          if (type !== "lang" && type !== "output" && type !== "listener") {
            ret.valid = false;
            ret.error = baseMsg + "type " + type + ' is not recognized. Valid values: "lang/language", "output/html" or "listener"';
            return ret;
          }
          if (type === "listener") {
            if (showdown2.helper.isUndefined(ext.listeners)) {
              ret.valid = false;
              ret.error = baseMsg + '. Extensions of type "listener" must have a property called "listeners"';
              return ret;
            }
          } else {
            if (showdown2.helper.isUndefined(ext.filter) && showdown2.helper.isUndefined(ext.regex)) {
              ret.valid = false;
              ret.error = baseMsg + type + ' extensions must define either a "regex" property or a "filter" method';
              return ret;
            }
          }
          if (ext.listeners) {
            if (typeof ext.listeners !== "object") {
              ret.valid = false;
              ret.error = baseMsg + '"listeners" property must be an object but ' + typeof ext.listeners + " given";
              return ret;
            }
            for (var ln in ext.listeners) {
              if (ext.listeners.hasOwnProperty(ln)) {
                if (typeof ext.listeners[ln] !== "function") {
                  ret.valid = false;
                  ret.error = baseMsg + '"listeners" property must be an hash of [event name]: [callback]. listeners.' + ln + " must be a function but " + typeof ext.listeners[ln] + " given";
                  return ret;
                }
              }
            }
          }
          if (ext.filter) {
            if (typeof ext.filter !== "function") {
              ret.valid = false;
              ret.error = baseMsg + '"filter" must be a function, but ' + typeof ext.filter + " given";
              return ret;
            }
          } else if (ext.regex) {
            if (showdown2.helper.isString(ext.regex)) {
              ext.regex = new RegExp(ext.regex, "g");
            }
            if (!(ext.regex instanceof RegExp)) {
              ret.valid = false;
              ret.error = baseMsg + '"regex" property must either be a string or a RegExp object, but ' + typeof ext.regex + " given";
              return ret;
            }
            if (showdown2.helper.isUndefined(ext.replace)) {
              ret.valid = false;
              ret.error = baseMsg + '"regex" extensions must implement a replace string or function';
              return ret;
            }
          }
        }
        return ret;
      }
      showdown2.validateExtension = function(ext) {
        "use strict";
        var validateExtension = validate(ext, null);
        if (!validateExtension.valid) {
          console.warn(validateExtension.error);
          return false;
        }
        return true;
      };
      if (!showdown2.hasOwnProperty("helper")) {
        showdown2.helper = {};
      }
      showdown2.helper.isString = function(a) {
        "use strict";
        return typeof a === "string" || a instanceof String;
      };
      showdown2.helper.isFunction = function(a) {
        "use strict";
        var getType = {};
        return a && getType.toString.call(a) === "[object Function]";
      };
      showdown2.helper.isArray = function(a) {
        "use strict";
        return Array.isArray(a);
      };
      showdown2.helper.isUndefined = function(value) {
        "use strict";
        return typeof value === "undefined";
      };
      showdown2.helper.forEach = function(obj, callback) {
        "use strict";
        if (showdown2.helper.isUndefined(obj)) {
          throw new Error("obj param is required");
        }
        if (showdown2.helper.isUndefined(callback)) {
          throw new Error("callback param is required");
        }
        if (!showdown2.helper.isFunction(callback)) {
          throw new Error("callback param must be a function/closure");
        }
        if (typeof obj.forEach === "function") {
          obj.forEach(callback);
        } else if (showdown2.helper.isArray(obj)) {
          for (var i = 0; i < obj.length; i++) {
            callback(obj[i], i, obj);
          }
        } else if (typeof obj === "object") {
          for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
              callback(obj[prop], prop, obj);
            }
          }
        } else {
          throw new Error("obj does not seem to be an array or an iterable object");
        }
      };
      showdown2.helper.stdExtName = function(s) {
        "use strict";
        return s.replace(/[_?*+\/\\.^-]/g, "").replace(/\s/g, "").toLowerCase();
      };
      function escapeCharactersCallback(wholeMatch, m1) {
        "use strict";
        var charCodeToEscape = m1.charCodeAt(0);
        return "\xA8E" + charCodeToEscape + "E";
      }
      showdown2.helper.escapeCharactersCallback = escapeCharactersCallback;
      showdown2.helper.escapeCharacters = function(text2, charsToEscape, afterBackslash) {
        "use strict";
        var regexString = "([" + charsToEscape.replace(/([\[\]\\])/g, "\\$1") + "])";
        if (afterBackslash) {
          regexString = "\\\\" + regexString;
        }
        var regex = new RegExp(regexString, "g");
        text2 = text2.replace(regex, escapeCharactersCallback);
        return text2;
      };
      showdown2.helper.unescapeHTMLEntities = function(txt) {
        "use strict";
        return txt.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      };
      var rgxFindMatchPos = function(str, left, right, flags) {
        "use strict";
        var f = flags || "", g = f.indexOf("g") > -1, x = new RegExp(left + "|" + right, "g" + f.replace(/g/g, "")), l = new RegExp(left, f.replace(/g/g, "")), pos = [], t, s, m, start, end;
        do {
          t = 0;
          while (m = x.exec(str)) {
            if (l.test(m[0])) {
              if (!t++) {
                s = x.lastIndex;
                start = s - m[0].length;
              }
            } else if (t) {
              if (!--t) {
                end = m.index + m[0].length;
                var obj = {
                  left: { start, end: s },
                  match: { start: s, end: m.index },
                  right: { start: m.index, end },
                  wholeMatch: { start, end }
                };
                pos.push(obj);
                if (!g) {
                  return pos;
                }
              }
            }
          }
        } while (t && (x.lastIndex = s));
        return pos;
      };
      showdown2.helper.matchRecursiveRegExp = function(str, left, right, flags) {
        "use strict";
        var matchPos = rgxFindMatchPos(str, left, right, flags), results = [];
        for (var i = 0; i < matchPos.length; ++i) {
          results.push([
            str.slice(matchPos[i].wholeMatch.start, matchPos[i].wholeMatch.end),
            str.slice(matchPos[i].match.start, matchPos[i].match.end),
            str.slice(matchPos[i].left.start, matchPos[i].left.end),
            str.slice(matchPos[i].right.start, matchPos[i].right.end)
          ]);
        }
        return results;
      };
      showdown2.helper.replaceRecursiveRegExp = function(str, replacement2, left, right, flags) {
        "use strict";
        if (!showdown2.helper.isFunction(replacement2)) {
          var repStr = replacement2;
          replacement2 = function() {
            return repStr;
          };
        }
        var matchPos = rgxFindMatchPos(str, left, right, flags), finalStr = str, lng = matchPos.length;
        if (lng > 0) {
          var bits = [];
          if (matchPos[0].wholeMatch.start !== 0) {
            bits.push(str.slice(0, matchPos[0].wholeMatch.start));
          }
          for (var i = 0; i < lng; ++i) {
            bits.push(
              replacement2(
                str.slice(matchPos[i].wholeMatch.start, matchPos[i].wholeMatch.end),
                str.slice(matchPos[i].match.start, matchPos[i].match.end),
                str.slice(matchPos[i].left.start, matchPos[i].left.end),
                str.slice(matchPos[i].right.start, matchPos[i].right.end)
              )
            );
            if (i < lng - 1) {
              bits.push(str.slice(matchPos[i].wholeMatch.end, matchPos[i + 1].wholeMatch.start));
            }
          }
          if (matchPos[lng - 1].wholeMatch.end < str.length) {
            bits.push(str.slice(matchPos[lng - 1].wholeMatch.end));
          }
          finalStr = bits.join("");
        }
        return finalStr;
      };
      showdown2.helper.regexIndexOf = function(str, regex, fromIndex) {
        "use strict";
        if (!showdown2.helper.isString(str)) {
          throw "InvalidArgumentError: first parameter of showdown.helper.regexIndexOf function must be a string";
        }
        if (regex instanceof RegExp === false) {
          throw "InvalidArgumentError: second parameter of showdown.helper.regexIndexOf function must be an instance of RegExp";
        }
        var indexOf = str.substring(fromIndex || 0).search(regex);
        return indexOf >= 0 ? indexOf + (fromIndex || 0) : indexOf;
      };
      showdown2.helper.splitAtIndex = function(str, index) {
        "use strict";
        if (!showdown2.helper.isString(str)) {
          throw "InvalidArgumentError: first parameter of showdown.helper.regexIndexOf function must be a string";
        }
        return [str.substring(0, index), str.substring(index)];
      };
      showdown2.helper.encodeEmailAddress = function(mail) {
        "use strict";
        var encode = [
          function(ch) {
            return "&#" + ch.charCodeAt(0) + ";";
          },
          function(ch) {
            return "&#x" + ch.charCodeAt(0).toString(16) + ";";
          },
          function(ch) {
            return ch;
          }
        ];
        mail = mail.replace(/./g, function(ch) {
          if (ch === "@") {
            ch = encode[Math.floor(Math.random() * 2)](ch);
          } else {
            var r = Math.random();
            ch = r > 0.9 ? encode[2](ch) : r > 0.45 ? encode[1](ch) : encode[0](ch);
          }
          return ch;
        });
        return mail;
      };
      showdown2.helper.padEnd = function padEnd(str, targetLength, padString) {
        "use strict";
        targetLength = targetLength >> 0;
        padString = String(padString || " ");
        if (str.length > targetLength) {
          return String(str);
        } else {
          targetLength = targetLength - str.length;
          if (targetLength > padString.length) {
            padString += padString.repeat(targetLength / padString.length);
          }
          return String(str) + padString.slice(0, targetLength);
        }
      };
      if (typeof console === "undefined") {
        console = {
          warn: function(msg) {
            "use strict";
            alert(msg);
          },
          log: function(msg) {
            "use strict";
            alert(msg);
          },
          error: function(msg) {
            "use strict";
            throw msg;
          }
        };
      }
      showdown2.helper.regexes = {
        asteriskDashAndColon: /([*_:~])/g
      };
      showdown2.helper.emojis = {
        "+1": "\u{1F44D}",
        "-1": "\u{1F44E}",
        "100": "\u{1F4AF}",
        "1234": "\u{1F522}",
        "1st_place_medal": "\u{1F947}",
        "2nd_place_medal": "\u{1F948}",
        "3rd_place_medal": "\u{1F949}",
        "8ball": "\u{1F3B1}",
        "a": "\u{1F170}\uFE0F",
        "ab": "\u{1F18E}",
        "abc": "\u{1F524}",
        "abcd": "\u{1F521}",
        "accept": "\u{1F251}",
        "aerial_tramway": "\u{1F6A1}",
        "airplane": "\u2708\uFE0F",
        "alarm_clock": "\u23F0",
        "alembic": "\u2697\uFE0F",
        "alien": "\u{1F47D}",
        "ambulance": "\u{1F691}",
        "amphora": "\u{1F3FA}",
        "anchor": "\u2693\uFE0F",
        "angel": "\u{1F47C}",
        "anger": "\u{1F4A2}",
        "angry": "\u{1F620}",
        "anguished": "\u{1F627}",
        "ant": "\u{1F41C}",
        "apple": "\u{1F34E}",
        "aquarius": "\u2652\uFE0F",
        "aries": "\u2648\uFE0F",
        "arrow_backward": "\u25C0\uFE0F",
        "arrow_double_down": "\u23EC",
        "arrow_double_up": "\u23EB",
        "arrow_down": "\u2B07\uFE0F",
        "arrow_down_small": "\u{1F53D}",
        "arrow_forward": "\u25B6\uFE0F",
        "arrow_heading_down": "\u2935\uFE0F",
        "arrow_heading_up": "\u2934\uFE0F",
        "arrow_left": "\u2B05\uFE0F",
        "arrow_lower_left": "\u2199\uFE0F",
        "arrow_lower_right": "\u2198\uFE0F",
        "arrow_right": "\u27A1\uFE0F",
        "arrow_right_hook": "\u21AA\uFE0F",
        "arrow_up": "\u2B06\uFE0F",
        "arrow_up_down": "\u2195\uFE0F",
        "arrow_up_small": "\u{1F53C}",
        "arrow_upper_left": "\u2196\uFE0F",
        "arrow_upper_right": "\u2197\uFE0F",
        "arrows_clockwise": "\u{1F503}",
        "arrows_counterclockwise": "\u{1F504}",
        "art": "\u{1F3A8}",
        "articulated_lorry": "\u{1F69B}",
        "artificial_satellite": "\u{1F6F0}",
        "astonished": "\u{1F632}",
        "athletic_shoe": "\u{1F45F}",
        "atm": "\u{1F3E7}",
        "atom_symbol": "\u269B\uFE0F",
        "avocado": "\u{1F951}",
        "b": "\u{1F171}\uFE0F",
        "baby": "\u{1F476}",
        "baby_bottle": "\u{1F37C}",
        "baby_chick": "\u{1F424}",
        "baby_symbol": "\u{1F6BC}",
        "back": "\u{1F519}",
        "bacon": "\u{1F953}",
        "badminton": "\u{1F3F8}",
        "baggage_claim": "\u{1F6C4}",
        "baguette_bread": "\u{1F956}",
        "balance_scale": "\u2696\uFE0F",
        "balloon": "\u{1F388}",
        "ballot_box": "\u{1F5F3}",
        "ballot_box_with_check": "\u2611\uFE0F",
        "bamboo": "\u{1F38D}",
        "banana": "\u{1F34C}",
        "bangbang": "\u203C\uFE0F",
        "bank": "\u{1F3E6}",
        "bar_chart": "\u{1F4CA}",
        "barber": "\u{1F488}",
        "baseball": "\u26BE\uFE0F",
        "basketball": "\u{1F3C0}",
        "basketball_man": "\u26F9\uFE0F",
        "basketball_woman": "\u26F9\uFE0F&zwj;\u2640\uFE0F",
        "bat": "\u{1F987}",
        "bath": "\u{1F6C0}",
        "bathtub": "\u{1F6C1}",
        "battery": "\u{1F50B}",
        "beach_umbrella": "\u{1F3D6}",
        "bear": "\u{1F43B}",
        "bed": "\u{1F6CF}",
        "bee": "\u{1F41D}",
        "beer": "\u{1F37A}",
        "beers": "\u{1F37B}",
        "beetle": "\u{1F41E}",
        "beginner": "\u{1F530}",
        "bell": "\u{1F514}",
        "bellhop_bell": "\u{1F6CE}",
        "bento": "\u{1F371}",
        "biking_man": "\u{1F6B4}",
        "bike": "\u{1F6B2}",
        "biking_woman": "\u{1F6B4}&zwj;\u2640\uFE0F",
        "bikini": "\u{1F459}",
        "biohazard": "\u2623\uFE0F",
        "bird": "\u{1F426}",
        "birthday": "\u{1F382}",
        "black_circle": "\u26AB\uFE0F",
        "black_flag": "\u{1F3F4}",
        "black_heart": "\u{1F5A4}",
        "black_joker": "\u{1F0CF}",
        "black_large_square": "\u2B1B\uFE0F",
        "black_medium_small_square": "\u25FE\uFE0F",
        "black_medium_square": "\u25FC\uFE0F",
        "black_nib": "\u2712\uFE0F",
        "black_small_square": "\u25AA\uFE0F",
        "black_square_button": "\u{1F532}",
        "blonde_man": "\u{1F471}",
        "blonde_woman": "\u{1F471}&zwj;\u2640\uFE0F",
        "blossom": "\u{1F33C}",
        "blowfish": "\u{1F421}",
        "blue_book": "\u{1F4D8}",
        "blue_car": "\u{1F699}",
        "blue_heart": "\u{1F499}",
        "blush": "\u{1F60A}",
        "boar": "\u{1F417}",
        "boat": "\u26F5\uFE0F",
        "bomb": "\u{1F4A3}",
        "book": "\u{1F4D6}",
        "bookmark": "\u{1F516}",
        "bookmark_tabs": "\u{1F4D1}",
        "books": "\u{1F4DA}",
        "boom": "\u{1F4A5}",
        "boot": "\u{1F462}",
        "bouquet": "\u{1F490}",
        "bowing_man": "\u{1F647}",
        "bow_and_arrow": "\u{1F3F9}",
        "bowing_woman": "\u{1F647}&zwj;\u2640\uFE0F",
        "bowling": "\u{1F3B3}",
        "boxing_glove": "\u{1F94A}",
        "boy": "\u{1F466}",
        "bread": "\u{1F35E}",
        "bride_with_veil": "\u{1F470}",
        "bridge_at_night": "\u{1F309}",
        "briefcase": "\u{1F4BC}",
        "broken_heart": "\u{1F494}",
        "bug": "\u{1F41B}",
        "building_construction": "\u{1F3D7}",
        "bulb": "\u{1F4A1}",
        "bullettrain_front": "\u{1F685}",
        "bullettrain_side": "\u{1F684}",
        "burrito": "\u{1F32F}",
        "bus": "\u{1F68C}",
        "business_suit_levitating": "\u{1F574}",
        "busstop": "\u{1F68F}",
        "bust_in_silhouette": "\u{1F464}",
        "busts_in_silhouette": "\u{1F465}",
        "butterfly": "\u{1F98B}",
        "cactus": "\u{1F335}",
        "cake": "\u{1F370}",
        "calendar": "\u{1F4C6}",
        "call_me_hand": "\u{1F919}",
        "calling": "\u{1F4F2}",
        "camel": "\u{1F42B}",
        "camera": "\u{1F4F7}",
        "camera_flash": "\u{1F4F8}",
        "camping": "\u{1F3D5}",
        "cancer": "\u264B\uFE0F",
        "candle": "\u{1F56F}",
        "candy": "\u{1F36C}",
        "canoe": "\u{1F6F6}",
        "capital_abcd": "\u{1F520}",
        "capricorn": "\u2651\uFE0F",
        "car": "\u{1F697}",
        "card_file_box": "\u{1F5C3}",
        "card_index": "\u{1F4C7}",
        "card_index_dividers": "\u{1F5C2}",
        "carousel_horse": "\u{1F3A0}",
        "carrot": "\u{1F955}",
        "cat": "\u{1F431}",
        "cat2": "\u{1F408}",
        "cd": "\u{1F4BF}",
        "chains": "\u26D3",
        "champagne": "\u{1F37E}",
        "chart": "\u{1F4B9}",
        "chart_with_downwards_trend": "\u{1F4C9}",
        "chart_with_upwards_trend": "\u{1F4C8}",
        "checkered_flag": "\u{1F3C1}",
        "cheese": "\u{1F9C0}",
        "cherries": "\u{1F352}",
        "cherry_blossom": "\u{1F338}",
        "chestnut": "\u{1F330}",
        "chicken": "\u{1F414}",
        "children_crossing": "\u{1F6B8}",
        "chipmunk": "\u{1F43F}",
        "chocolate_bar": "\u{1F36B}",
        "christmas_tree": "\u{1F384}",
        "church": "\u26EA\uFE0F",
        "cinema": "\u{1F3A6}",
        "circus_tent": "\u{1F3AA}",
        "city_sunrise": "\u{1F307}",
        "city_sunset": "\u{1F306}",
        "cityscape": "\u{1F3D9}",
        "cl": "\u{1F191}",
        "clamp": "\u{1F5DC}",
        "clap": "\u{1F44F}",
        "clapper": "\u{1F3AC}",
        "classical_building": "\u{1F3DB}",
        "clinking_glasses": "\u{1F942}",
        "clipboard": "\u{1F4CB}",
        "clock1": "\u{1F550}",
        "clock10": "\u{1F559}",
        "clock1030": "\u{1F565}",
        "clock11": "\u{1F55A}",
        "clock1130": "\u{1F566}",
        "clock12": "\u{1F55B}",
        "clock1230": "\u{1F567}",
        "clock130": "\u{1F55C}",
        "clock2": "\u{1F551}",
        "clock230": "\u{1F55D}",
        "clock3": "\u{1F552}",
        "clock330": "\u{1F55E}",
        "clock4": "\u{1F553}",
        "clock430": "\u{1F55F}",
        "clock5": "\u{1F554}",
        "clock530": "\u{1F560}",
        "clock6": "\u{1F555}",
        "clock630": "\u{1F561}",
        "clock7": "\u{1F556}",
        "clock730": "\u{1F562}",
        "clock8": "\u{1F557}",
        "clock830": "\u{1F563}",
        "clock9": "\u{1F558}",
        "clock930": "\u{1F564}",
        "closed_book": "\u{1F4D5}",
        "closed_lock_with_key": "\u{1F510}",
        "closed_umbrella": "\u{1F302}",
        "cloud": "\u2601\uFE0F",
        "cloud_with_lightning": "\u{1F329}",
        "cloud_with_lightning_and_rain": "\u26C8",
        "cloud_with_rain": "\u{1F327}",
        "cloud_with_snow": "\u{1F328}",
        "clown_face": "\u{1F921}",
        "clubs": "\u2663\uFE0F",
        "cocktail": "\u{1F378}",
        "coffee": "\u2615\uFE0F",
        "coffin": "\u26B0\uFE0F",
        "cold_sweat": "\u{1F630}",
        "comet": "\u2604\uFE0F",
        "computer": "\u{1F4BB}",
        "computer_mouse": "\u{1F5B1}",
        "confetti_ball": "\u{1F38A}",
        "confounded": "\u{1F616}",
        "confused": "\u{1F615}",
        "congratulations": "\u3297\uFE0F",
        "construction": "\u{1F6A7}",
        "construction_worker_man": "\u{1F477}",
        "construction_worker_woman": "\u{1F477}&zwj;\u2640\uFE0F",
        "control_knobs": "\u{1F39B}",
        "convenience_store": "\u{1F3EA}",
        "cookie": "\u{1F36A}",
        "cool": "\u{1F192}",
        "policeman": "\u{1F46E}",
        "copyright": "\xA9\uFE0F",
        "corn": "\u{1F33D}",
        "couch_and_lamp": "\u{1F6CB}",
        "couple": "\u{1F46B}",
        "couple_with_heart_woman_man": "\u{1F491}",
        "couple_with_heart_man_man": "\u{1F468}&zwj;\u2764\uFE0F&zwj;\u{1F468}",
        "couple_with_heart_woman_woman": "\u{1F469}&zwj;\u2764\uFE0F&zwj;\u{1F469}",
        "couplekiss_man_man": "\u{1F468}&zwj;\u2764\uFE0F&zwj;\u{1F48B}&zwj;\u{1F468}",
        "couplekiss_man_woman": "\u{1F48F}",
        "couplekiss_woman_woman": "\u{1F469}&zwj;\u2764\uFE0F&zwj;\u{1F48B}&zwj;\u{1F469}",
        "cow": "\u{1F42E}",
        "cow2": "\u{1F404}",
        "cowboy_hat_face": "\u{1F920}",
        "crab": "\u{1F980}",
        "crayon": "\u{1F58D}",
        "credit_card": "\u{1F4B3}",
        "crescent_moon": "\u{1F319}",
        "cricket": "\u{1F3CF}",
        "crocodile": "\u{1F40A}",
        "croissant": "\u{1F950}",
        "crossed_fingers": "\u{1F91E}",
        "crossed_flags": "\u{1F38C}",
        "crossed_swords": "\u2694\uFE0F",
        "crown": "\u{1F451}",
        "cry": "\u{1F622}",
        "crying_cat_face": "\u{1F63F}",
        "crystal_ball": "\u{1F52E}",
        "cucumber": "\u{1F952}",
        "cupid": "\u{1F498}",
        "curly_loop": "\u27B0",
        "currency_exchange": "\u{1F4B1}",
        "curry": "\u{1F35B}",
        "custard": "\u{1F36E}",
        "customs": "\u{1F6C3}",
        "cyclone": "\u{1F300}",
        "dagger": "\u{1F5E1}",
        "dancer": "\u{1F483}",
        "dancing_women": "\u{1F46F}",
        "dancing_men": "\u{1F46F}&zwj;\u2642\uFE0F",
        "dango": "\u{1F361}",
        "dark_sunglasses": "\u{1F576}",
        "dart": "\u{1F3AF}",
        "dash": "\u{1F4A8}",
        "date": "\u{1F4C5}",
        "deciduous_tree": "\u{1F333}",
        "deer": "\u{1F98C}",
        "department_store": "\u{1F3EC}",
        "derelict_house": "\u{1F3DA}",
        "desert": "\u{1F3DC}",
        "desert_island": "\u{1F3DD}",
        "desktop_computer": "\u{1F5A5}",
        "male_detective": "\u{1F575}\uFE0F",
        "diamond_shape_with_a_dot_inside": "\u{1F4A0}",
        "diamonds": "\u2666\uFE0F",
        "disappointed": "\u{1F61E}",
        "disappointed_relieved": "\u{1F625}",
        "dizzy": "\u{1F4AB}",
        "dizzy_face": "\u{1F635}",
        "do_not_litter": "\u{1F6AF}",
        "dog": "\u{1F436}",
        "dog2": "\u{1F415}",
        "dollar": "\u{1F4B5}",
        "dolls": "\u{1F38E}",
        "dolphin": "\u{1F42C}",
        "door": "\u{1F6AA}",
        "doughnut": "\u{1F369}",
        "dove": "\u{1F54A}",
        "dragon": "\u{1F409}",
        "dragon_face": "\u{1F432}",
        "dress": "\u{1F457}",
        "dromedary_camel": "\u{1F42A}",
        "drooling_face": "\u{1F924}",
        "droplet": "\u{1F4A7}",
        "drum": "\u{1F941}",
        "duck": "\u{1F986}",
        "dvd": "\u{1F4C0}",
        "e-mail": "\u{1F4E7}",
        "eagle": "\u{1F985}",
        "ear": "\u{1F442}",
        "ear_of_rice": "\u{1F33E}",
        "earth_africa": "\u{1F30D}",
        "earth_americas": "\u{1F30E}",
        "earth_asia": "\u{1F30F}",
        "egg": "\u{1F95A}",
        "eggplant": "\u{1F346}",
        "eight_pointed_black_star": "\u2734\uFE0F",
        "eight_spoked_asterisk": "\u2733\uFE0F",
        "electric_plug": "\u{1F50C}",
        "elephant": "\u{1F418}",
        "email": "\u2709\uFE0F",
        "end": "\u{1F51A}",
        "envelope_with_arrow": "\u{1F4E9}",
        "euro": "\u{1F4B6}",
        "european_castle": "\u{1F3F0}",
        "european_post_office": "\u{1F3E4}",
        "evergreen_tree": "\u{1F332}",
        "exclamation": "\u2757\uFE0F",
        "expressionless": "\u{1F611}",
        "eye": "\u{1F441}",
        "eye_speech_bubble": "\u{1F441}&zwj;\u{1F5E8}",
        "eyeglasses": "\u{1F453}",
        "eyes": "\u{1F440}",
        "face_with_head_bandage": "\u{1F915}",
        "face_with_thermometer": "\u{1F912}",
        "fist_oncoming": "\u{1F44A}",
        "factory": "\u{1F3ED}",
        "fallen_leaf": "\u{1F342}",
        "family_man_woman_boy": "\u{1F46A}",
        "family_man_boy": "\u{1F468}&zwj;\u{1F466}",
        "family_man_boy_boy": "\u{1F468}&zwj;\u{1F466}&zwj;\u{1F466}",
        "family_man_girl": "\u{1F468}&zwj;\u{1F467}",
        "family_man_girl_boy": "\u{1F468}&zwj;\u{1F467}&zwj;\u{1F466}",
        "family_man_girl_girl": "\u{1F468}&zwj;\u{1F467}&zwj;\u{1F467}",
        "family_man_man_boy": "\u{1F468}&zwj;\u{1F468}&zwj;\u{1F466}",
        "family_man_man_boy_boy": "\u{1F468}&zwj;\u{1F468}&zwj;\u{1F466}&zwj;\u{1F466}",
        "family_man_man_girl": "\u{1F468}&zwj;\u{1F468}&zwj;\u{1F467}",
        "family_man_man_girl_boy": "\u{1F468}&zwj;\u{1F468}&zwj;\u{1F467}&zwj;\u{1F466}",
        "family_man_man_girl_girl": "\u{1F468}&zwj;\u{1F468}&zwj;\u{1F467}&zwj;\u{1F467}",
        "family_man_woman_boy_boy": "\u{1F468}&zwj;\u{1F469}&zwj;\u{1F466}&zwj;\u{1F466}",
        "family_man_woman_girl": "\u{1F468}&zwj;\u{1F469}&zwj;\u{1F467}",
        "family_man_woman_girl_boy": "\u{1F468}&zwj;\u{1F469}&zwj;\u{1F467}&zwj;\u{1F466}",
        "family_man_woman_girl_girl": "\u{1F468}&zwj;\u{1F469}&zwj;\u{1F467}&zwj;\u{1F467}",
        "family_woman_boy": "\u{1F469}&zwj;\u{1F466}",
        "family_woman_boy_boy": "\u{1F469}&zwj;\u{1F466}&zwj;\u{1F466}",
        "family_woman_girl": "\u{1F469}&zwj;\u{1F467}",
        "family_woman_girl_boy": "\u{1F469}&zwj;\u{1F467}&zwj;\u{1F466}",
        "family_woman_girl_girl": "\u{1F469}&zwj;\u{1F467}&zwj;\u{1F467}",
        "family_woman_woman_boy": "\u{1F469}&zwj;\u{1F469}&zwj;\u{1F466}",
        "family_woman_woman_boy_boy": "\u{1F469}&zwj;\u{1F469}&zwj;\u{1F466}&zwj;\u{1F466}",
        "family_woman_woman_girl": "\u{1F469}&zwj;\u{1F469}&zwj;\u{1F467}",
        "family_woman_woman_girl_boy": "\u{1F469}&zwj;\u{1F469}&zwj;\u{1F467}&zwj;\u{1F466}",
        "family_woman_woman_girl_girl": "\u{1F469}&zwj;\u{1F469}&zwj;\u{1F467}&zwj;\u{1F467}",
        "fast_forward": "\u23E9",
        "fax": "\u{1F4E0}",
        "fearful": "\u{1F628}",
        "feet": "\u{1F43E}",
        "female_detective": "\u{1F575}\uFE0F&zwj;\u2640\uFE0F",
        "ferris_wheel": "\u{1F3A1}",
        "ferry": "\u26F4",
        "field_hockey": "\u{1F3D1}",
        "file_cabinet": "\u{1F5C4}",
        "file_folder": "\u{1F4C1}",
        "film_projector": "\u{1F4FD}",
        "film_strip": "\u{1F39E}",
        "fire": "\u{1F525}",
        "fire_engine": "\u{1F692}",
        "fireworks": "\u{1F386}",
        "first_quarter_moon": "\u{1F313}",
        "first_quarter_moon_with_face": "\u{1F31B}",
        "fish": "\u{1F41F}",
        "fish_cake": "\u{1F365}",
        "fishing_pole_and_fish": "\u{1F3A3}",
        "fist_raised": "\u270A",
        "fist_left": "\u{1F91B}",
        "fist_right": "\u{1F91C}",
        "flags": "\u{1F38F}",
        "flashlight": "\u{1F526}",
        "fleur_de_lis": "\u269C\uFE0F",
        "flight_arrival": "\u{1F6EC}",
        "flight_departure": "\u{1F6EB}",
        "floppy_disk": "\u{1F4BE}",
        "flower_playing_cards": "\u{1F3B4}",
        "flushed": "\u{1F633}",
        "fog": "\u{1F32B}",
        "foggy": "\u{1F301}",
        "football": "\u{1F3C8}",
        "footprints": "\u{1F463}",
        "fork_and_knife": "\u{1F374}",
        "fountain": "\u26F2\uFE0F",
        "fountain_pen": "\u{1F58B}",
        "four_leaf_clover": "\u{1F340}",
        "fox_face": "\u{1F98A}",
        "framed_picture": "\u{1F5BC}",
        "free": "\u{1F193}",
        "fried_egg": "\u{1F373}",
        "fried_shrimp": "\u{1F364}",
        "fries": "\u{1F35F}",
        "frog": "\u{1F438}",
        "frowning": "\u{1F626}",
        "frowning_face": "\u2639\uFE0F",
        "frowning_man": "\u{1F64D}&zwj;\u2642\uFE0F",
        "frowning_woman": "\u{1F64D}",
        "middle_finger": "\u{1F595}",
        "fuelpump": "\u26FD\uFE0F",
        "full_moon": "\u{1F315}",
        "full_moon_with_face": "\u{1F31D}",
        "funeral_urn": "\u26B1\uFE0F",
        "game_die": "\u{1F3B2}",
        "gear": "\u2699\uFE0F",
        "gem": "\u{1F48E}",
        "gemini": "\u264A\uFE0F",
        "ghost": "\u{1F47B}",
        "gift": "\u{1F381}",
        "gift_heart": "\u{1F49D}",
        "girl": "\u{1F467}",
        "globe_with_meridians": "\u{1F310}",
        "goal_net": "\u{1F945}",
        "goat": "\u{1F410}",
        "golf": "\u26F3\uFE0F",
        "golfing_man": "\u{1F3CC}\uFE0F",
        "golfing_woman": "\u{1F3CC}\uFE0F&zwj;\u2640\uFE0F",
        "gorilla": "\u{1F98D}",
        "grapes": "\u{1F347}",
        "green_apple": "\u{1F34F}",
        "green_book": "\u{1F4D7}",
        "green_heart": "\u{1F49A}",
        "green_salad": "\u{1F957}",
        "grey_exclamation": "\u2755",
        "grey_question": "\u2754",
        "grimacing": "\u{1F62C}",
        "grin": "\u{1F601}",
        "grinning": "\u{1F600}",
        "guardsman": "\u{1F482}",
        "guardswoman": "\u{1F482}&zwj;\u2640\uFE0F",
        "guitar": "\u{1F3B8}",
        "gun": "\u{1F52B}",
        "haircut_woman": "\u{1F487}",
        "haircut_man": "\u{1F487}&zwj;\u2642\uFE0F",
        "hamburger": "\u{1F354}",
        "hammer": "\u{1F528}",
        "hammer_and_pick": "\u2692",
        "hammer_and_wrench": "\u{1F6E0}",
        "hamster": "\u{1F439}",
        "hand": "\u270B",
        "handbag": "\u{1F45C}",
        "handshake": "\u{1F91D}",
        "hankey": "\u{1F4A9}",
        "hatched_chick": "\u{1F425}",
        "hatching_chick": "\u{1F423}",
        "headphones": "\u{1F3A7}",
        "hear_no_evil": "\u{1F649}",
        "heart": "\u2764\uFE0F",
        "heart_decoration": "\u{1F49F}",
        "heart_eyes": "\u{1F60D}",
        "heart_eyes_cat": "\u{1F63B}",
        "heartbeat": "\u{1F493}",
        "heartpulse": "\u{1F497}",
        "hearts": "\u2665\uFE0F",
        "heavy_check_mark": "\u2714\uFE0F",
        "heavy_division_sign": "\u2797",
        "heavy_dollar_sign": "\u{1F4B2}",
        "heavy_heart_exclamation": "\u2763\uFE0F",
        "heavy_minus_sign": "\u2796",
        "heavy_multiplication_x": "\u2716\uFE0F",
        "heavy_plus_sign": "\u2795",
        "helicopter": "\u{1F681}",
        "herb": "\u{1F33F}",
        "hibiscus": "\u{1F33A}",
        "high_brightness": "\u{1F506}",
        "high_heel": "\u{1F460}",
        "hocho": "\u{1F52A}",
        "hole": "\u{1F573}",
        "honey_pot": "\u{1F36F}",
        "horse": "\u{1F434}",
        "horse_racing": "\u{1F3C7}",
        "hospital": "\u{1F3E5}",
        "hot_pepper": "\u{1F336}",
        "hotdog": "\u{1F32D}",
        "hotel": "\u{1F3E8}",
        "hotsprings": "\u2668\uFE0F",
        "hourglass": "\u231B\uFE0F",
        "hourglass_flowing_sand": "\u23F3",
        "house": "\u{1F3E0}",
        "house_with_garden": "\u{1F3E1}",
        "houses": "\u{1F3D8}",
        "hugs": "\u{1F917}",
        "hushed": "\u{1F62F}",
        "ice_cream": "\u{1F368}",
        "ice_hockey": "\u{1F3D2}",
        "ice_skate": "\u26F8",
        "icecream": "\u{1F366}",
        "id": "\u{1F194}",
        "ideograph_advantage": "\u{1F250}",
        "imp": "\u{1F47F}",
        "inbox_tray": "\u{1F4E5}",
        "incoming_envelope": "\u{1F4E8}",
        "tipping_hand_woman": "\u{1F481}",
        "information_source": "\u2139\uFE0F",
        "innocent": "\u{1F607}",
        "interrobang": "\u2049\uFE0F",
        "iphone": "\u{1F4F1}",
        "izakaya_lantern": "\u{1F3EE}",
        "jack_o_lantern": "\u{1F383}",
        "japan": "\u{1F5FE}",
        "japanese_castle": "\u{1F3EF}",
        "japanese_goblin": "\u{1F47A}",
        "japanese_ogre": "\u{1F479}",
        "jeans": "\u{1F456}",
        "joy": "\u{1F602}",
        "joy_cat": "\u{1F639}",
        "joystick": "\u{1F579}",
        "kaaba": "\u{1F54B}",
        "key": "\u{1F511}",
        "keyboard": "\u2328\uFE0F",
        "keycap_ten": "\u{1F51F}",
        "kick_scooter": "\u{1F6F4}",
        "kimono": "\u{1F458}",
        "kiss": "\u{1F48B}",
        "kissing": "\u{1F617}",
        "kissing_cat": "\u{1F63D}",
        "kissing_closed_eyes": "\u{1F61A}",
        "kissing_heart": "\u{1F618}",
        "kissing_smiling_eyes": "\u{1F619}",
        "kiwi_fruit": "\u{1F95D}",
        "koala": "\u{1F428}",
        "koko": "\u{1F201}",
        "label": "\u{1F3F7}",
        "large_blue_circle": "\u{1F535}",
        "large_blue_diamond": "\u{1F537}",
        "large_orange_diamond": "\u{1F536}",
        "last_quarter_moon": "\u{1F317}",
        "last_quarter_moon_with_face": "\u{1F31C}",
        "latin_cross": "\u271D\uFE0F",
        "laughing": "\u{1F606}",
        "leaves": "\u{1F343}",
        "ledger": "\u{1F4D2}",
        "left_luggage": "\u{1F6C5}",
        "left_right_arrow": "\u2194\uFE0F",
        "leftwards_arrow_with_hook": "\u21A9\uFE0F",
        "lemon": "\u{1F34B}",
        "leo": "\u264C\uFE0F",
        "leopard": "\u{1F406}",
        "level_slider": "\u{1F39A}",
        "libra": "\u264E\uFE0F",
        "light_rail": "\u{1F688}",
        "link": "\u{1F517}",
        "lion": "\u{1F981}",
        "lips": "\u{1F444}",
        "lipstick": "\u{1F484}",
        "lizard": "\u{1F98E}",
        "lock": "\u{1F512}",
        "lock_with_ink_pen": "\u{1F50F}",
        "lollipop": "\u{1F36D}",
        "loop": "\u27BF",
        "loud_sound": "\u{1F50A}",
        "loudspeaker": "\u{1F4E2}",
        "love_hotel": "\u{1F3E9}",
        "love_letter": "\u{1F48C}",
        "low_brightness": "\u{1F505}",
        "lying_face": "\u{1F925}",
        "m": "\u24C2\uFE0F",
        "mag": "\u{1F50D}",
        "mag_right": "\u{1F50E}",
        "mahjong": "\u{1F004}\uFE0F",
        "mailbox": "\u{1F4EB}",
        "mailbox_closed": "\u{1F4EA}",
        "mailbox_with_mail": "\u{1F4EC}",
        "mailbox_with_no_mail": "\u{1F4ED}",
        "man": "\u{1F468}",
        "man_artist": "\u{1F468}&zwj;\u{1F3A8}",
        "man_astronaut": "\u{1F468}&zwj;\u{1F680}",
        "man_cartwheeling": "\u{1F938}&zwj;\u2642\uFE0F",
        "man_cook": "\u{1F468}&zwj;\u{1F373}",
        "man_dancing": "\u{1F57A}",
        "man_facepalming": "\u{1F926}&zwj;\u2642\uFE0F",
        "man_factory_worker": "\u{1F468}&zwj;\u{1F3ED}",
        "man_farmer": "\u{1F468}&zwj;\u{1F33E}",
        "man_firefighter": "\u{1F468}&zwj;\u{1F692}",
        "man_health_worker": "\u{1F468}&zwj;\u2695\uFE0F",
        "man_in_tuxedo": "\u{1F935}",
        "man_judge": "\u{1F468}&zwj;\u2696\uFE0F",
        "man_juggling": "\u{1F939}&zwj;\u2642\uFE0F",
        "man_mechanic": "\u{1F468}&zwj;\u{1F527}",
        "man_office_worker": "\u{1F468}&zwj;\u{1F4BC}",
        "man_pilot": "\u{1F468}&zwj;\u2708\uFE0F",
        "man_playing_handball": "\u{1F93E}&zwj;\u2642\uFE0F",
        "man_playing_water_polo": "\u{1F93D}&zwj;\u2642\uFE0F",
        "man_scientist": "\u{1F468}&zwj;\u{1F52C}",
        "man_shrugging": "\u{1F937}&zwj;\u2642\uFE0F",
        "man_singer": "\u{1F468}&zwj;\u{1F3A4}",
        "man_student": "\u{1F468}&zwj;\u{1F393}",
        "man_teacher": "\u{1F468}&zwj;\u{1F3EB}",
        "man_technologist": "\u{1F468}&zwj;\u{1F4BB}",
        "man_with_gua_pi_mao": "\u{1F472}",
        "man_with_turban": "\u{1F473}",
        "tangerine": "\u{1F34A}",
        "mans_shoe": "\u{1F45E}",
        "mantelpiece_clock": "\u{1F570}",
        "maple_leaf": "\u{1F341}",
        "martial_arts_uniform": "\u{1F94B}",
        "mask": "\u{1F637}",
        "massage_woman": "\u{1F486}",
        "massage_man": "\u{1F486}&zwj;\u2642\uFE0F",
        "meat_on_bone": "\u{1F356}",
        "medal_military": "\u{1F396}",
        "medal_sports": "\u{1F3C5}",
        "mega": "\u{1F4E3}",
        "melon": "\u{1F348}",
        "memo": "\u{1F4DD}",
        "men_wrestling": "\u{1F93C}&zwj;\u2642\uFE0F",
        "menorah": "\u{1F54E}",
        "mens": "\u{1F6B9}",
        "metal": "\u{1F918}",
        "metro": "\u{1F687}",
        "microphone": "\u{1F3A4}",
        "microscope": "\u{1F52C}",
        "milk_glass": "\u{1F95B}",
        "milky_way": "\u{1F30C}",
        "minibus": "\u{1F690}",
        "minidisc": "\u{1F4BD}",
        "mobile_phone_off": "\u{1F4F4}",
        "money_mouth_face": "\u{1F911}",
        "money_with_wings": "\u{1F4B8}",
        "moneybag": "\u{1F4B0}",
        "monkey": "\u{1F412}",
        "monkey_face": "\u{1F435}",
        "monorail": "\u{1F69D}",
        "moon": "\u{1F314}",
        "mortar_board": "\u{1F393}",
        "mosque": "\u{1F54C}",
        "motor_boat": "\u{1F6E5}",
        "motor_scooter": "\u{1F6F5}",
        "motorcycle": "\u{1F3CD}",
        "motorway": "\u{1F6E3}",
        "mount_fuji": "\u{1F5FB}",
        "mountain": "\u26F0",
        "mountain_biking_man": "\u{1F6B5}",
        "mountain_biking_woman": "\u{1F6B5}&zwj;\u2640\uFE0F",
        "mountain_cableway": "\u{1F6A0}",
        "mountain_railway": "\u{1F69E}",
        "mountain_snow": "\u{1F3D4}",
        "mouse": "\u{1F42D}",
        "mouse2": "\u{1F401}",
        "movie_camera": "\u{1F3A5}",
        "moyai": "\u{1F5FF}",
        "mrs_claus": "\u{1F936}",
        "muscle": "\u{1F4AA}",
        "mushroom": "\u{1F344}",
        "musical_keyboard": "\u{1F3B9}",
        "musical_note": "\u{1F3B5}",
        "musical_score": "\u{1F3BC}",
        "mute": "\u{1F507}",
        "nail_care": "\u{1F485}",
        "name_badge": "\u{1F4DB}",
        "national_park": "\u{1F3DE}",
        "nauseated_face": "\u{1F922}",
        "necktie": "\u{1F454}",
        "negative_squared_cross_mark": "\u274E",
        "nerd_face": "\u{1F913}",
        "neutral_face": "\u{1F610}",
        "new": "\u{1F195}",
        "new_moon": "\u{1F311}",
        "new_moon_with_face": "\u{1F31A}",
        "newspaper": "\u{1F4F0}",
        "newspaper_roll": "\u{1F5DE}",
        "next_track_button": "\u23ED",
        "ng": "\u{1F196}",
        "no_good_man": "\u{1F645}&zwj;\u2642\uFE0F",
        "no_good_woman": "\u{1F645}",
        "night_with_stars": "\u{1F303}",
        "no_bell": "\u{1F515}",
        "no_bicycles": "\u{1F6B3}",
        "no_entry": "\u26D4\uFE0F",
        "no_entry_sign": "\u{1F6AB}",
        "no_mobile_phones": "\u{1F4F5}",
        "no_mouth": "\u{1F636}",
        "no_pedestrians": "\u{1F6B7}",
        "no_smoking": "\u{1F6AD}",
        "non-potable_water": "\u{1F6B1}",
        "nose": "\u{1F443}",
        "notebook": "\u{1F4D3}",
        "notebook_with_decorative_cover": "\u{1F4D4}",
        "notes": "\u{1F3B6}",
        "nut_and_bolt": "\u{1F529}",
        "o": "\u2B55\uFE0F",
        "o2": "\u{1F17E}\uFE0F",
        "ocean": "\u{1F30A}",
        "octopus": "\u{1F419}",
        "oden": "\u{1F362}",
        "office": "\u{1F3E2}",
        "oil_drum": "\u{1F6E2}",
        "ok": "\u{1F197}",
        "ok_hand": "\u{1F44C}",
        "ok_man": "\u{1F646}&zwj;\u2642\uFE0F",
        "ok_woman": "\u{1F646}",
        "old_key": "\u{1F5DD}",
        "older_man": "\u{1F474}",
        "older_woman": "\u{1F475}",
        "om": "\u{1F549}",
        "on": "\u{1F51B}",
        "oncoming_automobile": "\u{1F698}",
        "oncoming_bus": "\u{1F68D}",
        "oncoming_police_car": "\u{1F694}",
        "oncoming_taxi": "\u{1F696}",
        "open_file_folder": "\u{1F4C2}",
        "open_hands": "\u{1F450}",
        "open_mouth": "\u{1F62E}",
        "open_umbrella": "\u2602\uFE0F",
        "ophiuchus": "\u26CE",
        "orange_book": "\u{1F4D9}",
        "orthodox_cross": "\u2626\uFE0F",
        "outbox_tray": "\u{1F4E4}",
        "owl": "\u{1F989}",
        "ox": "\u{1F402}",
        "package": "\u{1F4E6}",
        "page_facing_up": "\u{1F4C4}",
        "page_with_curl": "\u{1F4C3}",
        "pager": "\u{1F4DF}",
        "paintbrush": "\u{1F58C}",
        "palm_tree": "\u{1F334}",
        "pancakes": "\u{1F95E}",
        "panda_face": "\u{1F43C}",
        "paperclip": "\u{1F4CE}",
        "paperclips": "\u{1F587}",
        "parasol_on_ground": "\u26F1",
        "parking": "\u{1F17F}\uFE0F",
        "part_alternation_mark": "\u303D\uFE0F",
        "partly_sunny": "\u26C5\uFE0F",
        "passenger_ship": "\u{1F6F3}",
        "passport_control": "\u{1F6C2}",
        "pause_button": "\u23F8",
        "peace_symbol": "\u262E\uFE0F",
        "peach": "\u{1F351}",
        "peanuts": "\u{1F95C}",
        "pear": "\u{1F350}",
        "pen": "\u{1F58A}",
        "pencil2": "\u270F\uFE0F",
        "penguin": "\u{1F427}",
        "pensive": "\u{1F614}",
        "performing_arts": "\u{1F3AD}",
        "persevere": "\u{1F623}",
        "person_fencing": "\u{1F93A}",
        "pouting_woman": "\u{1F64E}",
        "phone": "\u260E\uFE0F",
        "pick": "\u26CF",
        "pig": "\u{1F437}",
        "pig2": "\u{1F416}",
        "pig_nose": "\u{1F43D}",
        "pill": "\u{1F48A}",
        "pineapple": "\u{1F34D}",
        "ping_pong": "\u{1F3D3}",
        "pisces": "\u2653\uFE0F",
        "pizza": "\u{1F355}",
        "place_of_worship": "\u{1F6D0}",
        "plate_with_cutlery": "\u{1F37D}",
        "play_or_pause_button": "\u23EF",
        "point_down": "\u{1F447}",
        "point_left": "\u{1F448}",
        "point_right": "\u{1F449}",
        "point_up": "\u261D\uFE0F",
        "point_up_2": "\u{1F446}",
        "police_car": "\u{1F693}",
        "policewoman": "\u{1F46E}&zwj;\u2640\uFE0F",
        "poodle": "\u{1F429}",
        "popcorn": "\u{1F37F}",
        "post_office": "\u{1F3E3}",
        "postal_horn": "\u{1F4EF}",
        "postbox": "\u{1F4EE}",
        "potable_water": "\u{1F6B0}",
        "potato": "\u{1F954}",
        "pouch": "\u{1F45D}",
        "poultry_leg": "\u{1F357}",
        "pound": "\u{1F4B7}",
        "rage": "\u{1F621}",
        "pouting_cat": "\u{1F63E}",
        "pouting_man": "\u{1F64E}&zwj;\u2642\uFE0F",
        "pray": "\u{1F64F}",
        "prayer_beads": "\u{1F4FF}",
        "pregnant_woman": "\u{1F930}",
        "previous_track_button": "\u23EE",
        "prince": "\u{1F934}",
        "princess": "\u{1F478}",
        "printer": "\u{1F5A8}",
        "purple_heart": "\u{1F49C}",
        "purse": "\u{1F45B}",
        "pushpin": "\u{1F4CC}",
        "put_litter_in_its_place": "\u{1F6AE}",
        "question": "\u2753",
        "rabbit": "\u{1F430}",
        "rabbit2": "\u{1F407}",
        "racehorse": "\u{1F40E}",
        "racing_car": "\u{1F3CE}",
        "radio": "\u{1F4FB}",
        "radio_button": "\u{1F518}",
        "radioactive": "\u2622\uFE0F",
        "railway_car": "\u{1F683}",
        "railway_track": "\u{1F6E4}",
        "rainbow": "\u{1F308}",
        "rainbow_flag": "\u{1F3F3}\uFE0F&zwj;\u{1F308}",
        "raised_back_of_hand": "\u{1F91A}",
        "raised_hand_with_fingers_splayed": "\u{1F590}",
        "raised_hands": "\u{1F64C}",
        "raising_hand_woman": "\u{1F64B}",
        "raising_hand_man": "\u{1F64B}&zwj;\u2642\uFE0F",
        "ram": "\u{1F40F}",
        "ramen": "\u{1F35C}",
        "rat": "\u{1F400}",
        "record_button": "\u23FA",
        "recycle": "\u267B\uFE0F",
        "red_circle": "\u{1F534}",
        "registered": "\xAE\uFE0F",
        "relaxed": "\u263A\uFE0F",
        "relieved": "\u{1F60C}",
        "reminder_ribbon": "\u{1F397}",
        "repeat": "\u{1F501}",
        "repeat_one": "\u{1F502}",
        "rescue_worker_helmet": "\u26D1",
        "restroom": "\u{1F6BB}",
        "revolving_hearts": "\u{1F49E}",
        "rewind": "\u23EA",
        "rhinoceros": "\u{1F98F}",
        "ribbon": "\u{1F380}",
        "rice": "\u{1F35A}",
        "rice_ball": "\u{1F359}",
        "rice_cracker": "\u{1F358}",
        "rice_scene": "\u{1F391}",
        "right_anger_bubble": "\u{1F5EF}",
        "ring": "\u{1F48D}",
        "robot": "\u{1F916}",
        "rocket": "\u{1F680}",
        "rofl": "\u{1F923}",
        "roll_eyes": "\u{1F644}",
        "roller_coaster": "\u{1F3A2}",
        "rooster": "\u{1F413}",
        "rose": "\u{1F339}",
        "rosette": "\u{1F3F5}",
        "rotating_light": "\u{1F6A8}",
        "round_pushpin": "\u{1F4CD}",
        "rowing_man": "\u{1F6A3}",
        "rowing_woman": "\u{1F6A3}&zwj;\u2640\uFE0F",
        "rugby_football": "\u{1F3C9}",
        "running_man": "\u{1F3C3}",
        "running_shirt_with_sash": "\u{1F3BD}",
        "running_woman": "\u{1F3C3}&zwj;\u2640\uFE0F",
        "sa": "\u{1F202}\uFE0F",
        "sagittarius": "\u2650\uFE0F",
        "sake": "\u{1F376}",
        "sandal": "\u{1F461}",
        "santa": "\u{1F385}",
        "satellite": "\u{1F4E1}",
        "saxophone": "\u{1F3B7}",
        "school": "\u{1F3EB}",
        "school_satchel": "\u{1F392}",
        "scissors": "\u2702\uFE0F",
        "scorpion": "\u{1F982}",
        "scorpius": "\u264F\uFE0F",
        "scream": "\u{1F631}",
        "scream_cat": "\u{1F640}",
        "scroll": "\u{1F4DC}",
        "seat": "\u{1F4BA}",
        "secret": "\u3299\uFE0F",
        "see_no_evil": "\u{1F648}",
        "seedling": "\u{1F331}",
        "selfie": "\u{1F933}",
        "shallow_pan_of_food": "\u{1F958}",
        "shamrock": "\u2618\uFE0F",
        "shark": "\u{1F988}",
        "shaved_ice": "\u{1F367}",
        "sheep": "\u{1F411}",
        "shell": "\u{1F41A}",
        "shield": "\u{1F6E1}",
        "shinto_shrine": "\u26E9",
        "ship": "\u{1F6A2}",
        "shirt": "\u{1F455}",
        "shopping": "\u{1F6CD}",
        "shopping_cart": "\u{1F6D2}",
        "shower": "\u{1F6BF}",
        "shrimp": "\u{1F990}",
        "signal_strength": "\u{1F4F6}",
        "six_pointed_star": "\u{1F52F}",
        "ski": "\u{1F3BF}",
        "skier": "\u26F7",
        "skull": "\u{1F480}",
        "skull_and_crossbones": "\u2620\uFE0F",
        "sleeping": "\u{1F634}",
        "sleeping_bed": "\u{1F6CC}",
        "sleepy": "\u{1F62A}",
        "slightly_frowning_face": "\u{1F641}",
        "slightly_smiling_face": "\u{1F642}",
        "slot_machine": "\u{1F3B0}",
        "small_airplane": "\u{1F6E9}",
        "small_blue_diamond": "\u{1F539}",
        "small_orange_diamond": "\u{1F538}",
        "small_red_triangle": "\u{1F53A}",
        "small_red_triangle_down": "\u{1F53B}",
        "smile": "\u{1F604}",
        "smile_cat": "\u{1F638}",
        "smiley": "\u{1F603}",
        "smiley_cat": "\u{1F63A}",
        "smiling_imp": "\u{1F608}",
        "smirk": "\u{1F60F}",
        "smirk_cat": "\u{1F63C}",
        "smoking": "\u{1F6AC}",
        "snail": "\u{1F40C}",
        "snake": "\u{1F40D}",
        "sneezing_face": "\u{1F927}",
        "snowboarder": "\u{1F3C2}",
        "snowflake": "\u2744\uFE0F",
        "snowman": "\u26C4\uFE0F",
        "snowman_with_snow": "\u2603\uFE0F",
        "sob": "\u{1F62D}",
        "soccer": "\u26BD\uFE0F",
        "soon": "\u{1F51C}",
        "sos": "\u{1F198}",
        "sound": "\u{1F509}",
        "space_invader": "\u{1F47E}",
        "spades": "\u2660\uFE0F",
        "spaghetti": "\u{1F35D}",
        "sparkle": "\u2747\uFE0F",
        "sparkler": "\u{1F387}",
        "sparkles": "\u2728",
        "sparkling_heart": "\u{1F496}",
        "speak_no_evil": "\u{1F64A}",
        "speaker": "\u{1F508}",
        "speaking_head": "\u{1F5E3}",
        "speech_balloon": "\u{1F4AC}",
        "speedboat": "\u{1F6A4}",
        "spider": "\u{1F577}",
        "spider_web": "\u{1F578}",
        "spiral_calendar": "\u{1F5D3}",
        "spiral_notepad": "\u{1F5D2}",
        "spoon": "\u{1F944}",
        "squid": "\u{1F991}",
        "stadium": "\u{1F3DF}",
        "star": "\u2B50\uFE0F",
        "star2": "\u{1F31F}",
        "star_and_crescent": "\u262A\uFE0F",
        "star_of_david": "\u2721\uFE0F",
        "stars": "\u{1F320}",
        "station": "\u{1F689}",
        "statue_of_liberty": "\u{1F5FD}",
        "steam_locomotive": "\u{1F682}",
        "stew": "\u{1F372}",
        "stop_button": "\u23F9",
        "stop_sign": "\u{1F6D1}",
        "stopwatch": "\u23F1",
        "straight_ruler": "\u{1F4CF}",
        "strawberry": "\u{1F353}",
        "stuck_out_tongue": "\u{1F61B}",
        "stuck_out_tongue_closed_eyes": "\u{1F61D}",
        "stuck_out_tongue_winking_eye": "\u{1F61C}",
        "studio_microphone": "\u{1F399}",
        "stuffed_flatbread": "\u{1F959}",
        "sun_behind_large_cloud": "\u{1F325}",
        "sun_behind_rain_cloud": "\u{1F326}",
        "sun_behind_small_cloud": "\u{1F324}",
        "sun_with_face": "\u{1F31E}",
        "sunflower": "\u{1F33B}",
        "sunglasses": "\u{1F60E}",
        "sunny": "\u2600\uFE0F",
        "sunrise": "\u{1F305}",
        "sunrise_over_mountains": "\u{1F304}",
        "surfing_man": "\u{1F3C4}",
        "surfing_woman": "\u{1F3C4}&zwj;\u2640\uFE0F",
        "sushi": "\u{1F363}",
        "suspension_railway": "\u{1F69F}",
        "sweat": "\u{1F613}",
        "sweat_drops": "\u{1F4A6}",
        "sweat_smile": "\u{1F605}",
        "sweet_potato": "\u{1F360}",
        "swimming_man": "\u{1F3CA}",
        "swimming_woman": "\u{1F3CA}&zwj;\u2640\uFE0F",
        "symbols": "\u{1F523}",
        "synagogue": "\u{1F54D}",
        "syringe": "\u{1F489}",
        "taco": "\u{1F32E}",
        "tada": "\u{1F389}",
        "tanabata_tree": "\u{1F38B}",
        "taurus": "\u2649\uFE0F",
        "taxi": "\u{1F695}",
        "tea": "\u{1F375}",
        "telephone_receiver": "\u{1F4DE}",
        "telescope": "\u{1F52D}",
        "tennis": "\u{1F3BE}",
        "tent": "\u26FA\uFE0F",
        "thermometer": "\u{1F321}",
        "thinking": "\u{1F914}",
        "thought_balloon": "\u{1F4AD}",
        "ticket": "\u{1F3AB}",
        "tickets": "\u{1F39F}",
        "tiger": "\u{1F42F}",
        "tiger2": "\u{1F405}",
        "timer_clock": "\u23F2",
        "tipping_hand_man": "\u{1F481}&zwj;\u2642\uFE0F",
        "tired_face": "\u{1F62B}",
        "tm": "\u2122\uFE0F",
        "toilet": "\u{1F6BD}",
        "tokyo_tower": "\u{1F5FC}",
        "tomato": "\u{1F345}",
        "tongue": "\u{1F445}",
        "top": "\u{1F51D}",
        "tophat": "\u{1F3A9}",
        "tornado": "\u{1F32A}",
        "trackball": "\u{1F5B2}",
        "tractor": "\u{1F69C}",
        "traffic_light": "\u{1F6A5}",
        "train": "\u{1F68B}",
        "train2": "\u{1F686}",
        "tram": "\u{1F68A}",
        "triangular_flag_on_post": "\u{1F6A9}",
        "triangular_ruler": "\u{1F4D0}",
        "trident": "\u{1F531}",
        "triumph": "\u{1F624}",
        "trolleybus": "\u{1F68E}",
        "trophy": "\u{1F3C6}",
        "tropical_drink": "\u{1F379}",
        "tropical_fish": "\u{1F420}",
        "truck": "\u{1F69A}",
        "trumpet": "\u{1F3BA}",
        "tulip": "\u{1F337}",
        "tumbler_glass": "\u{1F943}",
        "turkey": "\u{1F983}",
        "turtle": "\u{1F422}",
        "tv": "\u{1F4FA}",
        "twisted_rightwards_arrows": "\u{1F500}",
        "two_hearts": "\u{1F495}",
        "two_men_holding_hands": "\u{1F46C}",
        "two_women_holding_hands": "\u{1F46D}",
        "u5272": "\u{1F239}",
        "u5408": "\u{1F234}",
        "u55b6": "\u{1F23A}",
        "u6307": "\u{1F22F}\uFE0F",
        "u6708": "\u{1F237}\uFE0F",
        "u6709": "\u{1F236}",
        "u6e80": "\u{1F235}",
        "u7121": "\u{1F21A}\uFE0F",
        "u7533": "\u{1F238}",
        "u7981": "\u{1F232}",
        "u7a7a": "\u{1F233}",
        "umbrella": "\u2614\uFE0F",
        "unamused": "\u{1F612}",
        "underage": "\u{1F51E}",
        "unicorn": "\u{1F984}",
        "unlock": "\u{1F513}",
        "up": "\u{1F199}",
        "upside_down_face": "\u{1F643}",
        "v": "\u270C\uFE0F",
        "vertical_traffic_light": "\u{1F6A6}",
        "vhs": "\u{1F4FC}",
        "vibration_mode": "\u{1F4F3}",
        "video_camera": "\u{1F4F9}",
        "video_game": "\u{1F3AE}",
        "violin": "\u{1F3BB}",
        "virgo": "\u264D\uFE0F",
        "volcano": "\u{1F30B}",
        "volleyball": "\u{1F3D0}",
        "vs": "\u{1F19A}",
        "vulcan_salute": "\u{1F596}",
        "walking_man": "\u{1F6B6}",
        "walking_woman": "\u{1F6B6}&zwj;\u2640\uFE0F",
        "waning_crescent_moon": "\u{1F318}",
        "waning_gibbous_moon": "\u{1F316}",
        "warning": "\u26A0\uFE0F",
        "wastebasket": "\u{1F5D1}",
        "watch": "\u231A\uFE0F",
        "water_buffalo": "\u{1F403}",
        "watermelon": "\u{1F349}",
        "wave": "\u{1F44B}",
        "wavy_dash": "\u3030\uFE0F",
        "waxing_crescent_moon": "\u{1F312}",
        "wc": "\u{1F6BE}",
        "weary": "\u{1F629}",
        "wedding": "\u{1F492}",
        "weight_lifting_man": "\u{1F3CB}\uFE0F",
        "weight_lifting_woman": "\u{1F3CB}\uFE0F&zwj;\u2640\uFE0F",
        "whale": "\u{1F433}",
        "whale2": "\u{1F40B}",
        "wheel_of_dharma": "\u2638\uFE0F",
        "wheelchair": "\u267F\uFE0F",
        "white_check_mark": "\u2705",
        "white_circle": "\u26AA\uFE0F",
        "white_flag": "\u{1F3F3}\uFE0F",
        "white_flower": "\u{1F4AE}",
        "white_large_square": "\u2B1C\uFE0F",
        "white_medium_small_square": "\u25FD\uFE0F",
        "white_medium_square": "\u25FB\uFE0F",
        "white_small_square": "\u25AB\uFE0F",
        "white_square_button": "\u{1F533}",
        "wilted_flower": "\u{1F940}",
        "wind_chime": "\u{1F390}",
        "wind_face": "\u{1F32C}",
        "wine_glass": "\u{1F377}",
        "wink": "\u{1F609}",
        "wolf": "\u{1F43A}",
        "woman": "\u{1F469}",
        "woman_artist": "\u{1F469}&zwj;\u{1F3A8}",
        "woman_astronaut": "\u{1F469}&zwj;\u{1F680}",
        "woman_cartwheeling": "\u{1F938}&zwj;\u2640\uFE0F",
        "woman_cook": "\u{1F469}&zwj;\u{1F373}",
        "woman_facepalming": "\u{1F926}&zwj;\u2640\uFE0F",
        "woman_factory_worker": "\u{1F469}&zwj;\u{1F3ED}",
        "woman_farmer": "\u{1F469}&zwj;\u{1F33E}",
        "woman_firefighter": "\u{1F469}&zwj;\u{1F692}",
        "woman_health_worker": "\u{1F469}&zwj;\u2695\uFE0F",
        "woman_judge": "\u{1F469}&zwj;\u2696\uFE0F",
        "woman_juggling": "\u{1F939}&zwj;\u2640\uFE0F",
        "woman_mechanic": "\u{1F469}&zwj;\u{1F527}",
        "woman_office_worker": "\u{1F469}&zwj;\u{1F4BC}",
        "woman_pilot": "\u{1F469}&zwj;\u2708\uFE0F",
        "woman_playing_handball": "\u{1F93E}&zwj;\u2640\uFE0F",
        "woman_playing_water_polo": "\u{1F93D}&zwj;\u2640\uFE0F",
        "woman_scientist": "\u{1F469}&zwj;\u{1F52C}",
        "woman_shrugging": "\u{1F937}&zwj;\u2640\uFE0F",
        "woman_singer": "\u{1F469}&zwj;\u{1F3A4}",
        "woman_student": "\u{1F469}&zwj;\u{1F393}",
        "woman_teacher": "\u{1F469}&zwj;\u{1F3EB}",
        "woman_technologist": "\u{1F469}&zwj;\u{1F4BB}",
        "woman_with_turban": "\u{1F473}&zwj;\u2640\uFE0F",
        "womans_clothes": "\u{1F45A}",
        "womans_hat": "\u{1F452}",
        "women_wrestling": "\u{1F93C}&zwj;\u2640\uFE0F",
        "womens": "\u{1F6BA}",
        "world_map": "\u{1F5FA}",
        "worried": "\u{1F61F}",
        "wrench": "\u{1F527}",
        "writing_hand": "\u270D\uFE0F",
        "x": "\u274C",
        "yellow_heart": "\u{1F49B}",
        "yen": "\u{1F4B4}",
        "yin_yang": "\u262F\uFE0F",
        "yum": "\u{1F60B}",
        "zap": "\u26A1\uFE0F",
        "zipper_mouth_face": "\u{1F910}",
        "zzz": "\u{1F4A4}",
        /* special emojis :P */
        "octocat": '<img alt=":octocat:" height="20" width="20" align="absmiddle" src="https://assets-cdn.github.com/images/icons/emoji/octocat.png">',
        "showdown": `<span style="font-family: 'Anonymous Pro', monospace; text-decoration: underline; text-decoration-style: dashed; text-decoration-color: #3e8b8a;text-underline-position: under;">S</span>`
      };
      showdown2.Converter = function(converterOptions) {
        "use strict";
        var options = {}, langExtensions = [], outputModifiers = [], listeners = {}, setConvFlavor = setFlavor, metadata = {
          parsed: {},
          raw: "",
          format: ""
        };
        _constructor();
        function _constructor() {
          converterOptions = converterOptions || {};
          for (var gOpt in globalOptions) {
            if (globalOptions.hasOwnProperty(gOpt)) {
              options[gOpt] = globalOptions[gOpt];
            }
          }
          if (typeof converterOptions === "object") {
            for (var opt in converterOptions) {
              if (converterOptions.hasOwnProperty(opt)) {
                options[opt] = converterOptions[opt];
              }
            }
          } else {
            throw Error("Converter expects the passed parameter to be an object, but " + typeof converterOptions + " was passed instead.");
          }
          if (options.extensions) {
            showdown2.helper.forEach(options.extensions, _parseExtension);
          }
        }
        function _parseExtension(ext, name2) {
          name2 = name2 || null;
          if (showdown2.helper.isString(ext)) {
            ext = showdown2.helper.stdExtName(ext);
            name2 = ext;
            if (showdown2.extensions[ext]) {
              console.warn("DEPRECATION WARNING: " + ext + " is an old extension that uses a deprecated loading method.Please inform the developer that the extension should be updated!");
              legacyExtensionLoading(showdown2.extensions[ext], ext);
              return;
            } else if (!showdown2.helper.isUndefined(extensions[ext])) {
              ext = extensions[ext];
            } else {
              throw Error('Extension "' + ext + '" could not be loaded. It was either not found or is not a valid extension.');
            }
          }
          if (typeof ext === "function") {
            ext = ext();
          }
          if (!showdown2.helper.isArray(ext)) {
            ext = [ext];
          }
          var validExt = validate(ext, name2);
          if (!validExt.valid) {
            throw Error(validExt.error);
          }
          for (var i = 0; i < ext.length; ++i) {
            switch (ext[i].type) {
              case "lang":
                langExtensions.push(ext[i]);
                break;
              case "output":
                outputModifiers.push(ext[i]);
                break;
            }
            if (ext[i].hasOwnProperty("listeners")) {
              for (var ln in ext[i].listeners) {
                if (ext[i].listeners.hasOwnProperty(ln)) {
                  listen(ln, ext[i].listeners[ln]);
                }
              }
            }
          }
        }
        function legacyExtensionLoading(ext, name2) {
          if (typeof ext === "function") {
            ext = ext(new showdown2.Converter());
          }
          if (!showdown2.helper.isArray(ext)) {
            ext = [ext];
          }
          var valid = validate(ext, name2);
          if (!valid.valid) {
            throw Error(valid.error);
          }
          for (var i = 0; i < ext.length; ++i) {
            switch (ext[i].type) {
              case "lang":
                langExtensions.push(ext[i]);
                break;
              case "output":
                outputModifiers.push(ext[i]);
                break;
              default:
                throw Error("Extension loader error: Type unrecognized!!!");
            }
          }
        }
        function listen(name2, callback) {
          if (!showdown2.helper.isString(name2)) {
            throw Error("Invalid argument in converter.listen() method: name must be a string, but " + typeof name2 + " given");
          }
          if (typeof callback !== "function") {
            throw Error("Invalid argument in converter.listen() method: callback must be a function, but " + typeof callback + " given");
          }
          if (!listeners.hasOwnProperty(name2)) {
            listeners[name2] = [];
          }
          listeners[name2].push(callback);
        }
        function rTrimInputText(text2) {
          var rsp = text2.match(/^\s*/)[0].length, rgx = new RegExp("^\\s{0," + rsp + "}", "gm");
          return text2.replace(rgx, "");
        }
        this._dispatch = function dispatch(evtName, text2, options2, globals) {
          if (listeners.hasOwnProperty(evtName)) {
            for (var ei = 0; ei < listeners[evtName].length; ++ei) {
              var nText = listeners[evtName][ei](evtName, text2, this, options2, globals);
              if (nText && typeof nText !== "undefined") {
                text2 = nText;
              }
            }
          }
          return text2;
        };
        this.listen = function(name2, callback) {
          listen(name2, callback);
          return this;
        };
        this.makeHtml = function(text2) {
          if (!text2) {
            return text2;
          }
          var globals = {
            gHtmlBlocks: [],
            gHtmlMdBlocks: [],
            gHtmlSpans: [],
            gUrls: {},
            gTitles: {},
            gDimensions: {},
            gListLevel: 0,
            hashLinkCounts: {},
            langExtensions,
            outputModifiers,
            converter: this,
            ghCodeBlocks: [],
            metadata: {
              parsed: {},
              raw: "",
              format: ""
            }
          };
          text2 = text2.replace(/¨/g, "\xA8T");
          text2 = text2.replace(/\$/g, "\xA8D");
          text2 = text2.replace(/\r\n/g, "\n");
          text2 = text2.replace(/\r/g, "\n");
          text2 = text2.replace(/\u00A0/g, "&nbsp;");
          if (options.smartIndentationFix) {
            text2 = rTrimInputText(text2);
          }
          text2 = "\n\n" + text2 + "\n\n";
          text2 = showdown2.subParser("detab")(text2, options, globals);
          text2 = text2.replace(/^[ \t]+$/mg, "");
          showdown2.helper.forEach(langExtensions, function(ext) {
            text2 = showdown2.subParser("runExtension")(ext, text2, options, globals);
          });
          text2 = showdown2.subParser("metadata")(text2, options, globals);
          text2 = showdown2.subParser("hashPreCodeTags")(text2, options, globals);
          text2 = showdown2.subParser("githubCodeBlocks")(text2, options, globals);
          text2 = showdown2.subParser("hashHTMLBlocks")(text2, options, globals);
          text2 = showdown2.subParser("hashCodeTags")(text2, options, globals);
          text2 = showdown2.subParser("stripLinkDefinitions")(text2, options, globals);
          text2 = showdown2.subParser("blockGamut")(text2, options, globals);
          text2 = showdown2.subParser("unhashHTMLSpans")(text2, options, globals);
          text2 = showdown2.subParser("unescapeSpecialChars")(text2, options, globals);
          text2 = text2.replace(/¨D/g, "$$");
          text2 = text2.replace(/¨T/g, "\xA8");
          text2 = showdown2.subParser("completeHTMLDocument")(text2, options, globals);
          showdown2.helper.forEach(outputModifiers, function(ext) {
            text2 = showdown2.subParser("runExtension")(ext, text2, options, globals);
          });
          metadata = globals.metadata;
          return text2;
        };
        this.makeMarkdown = this.makeMd = function(src, HTMLParser) {
          src = src.replace(/\r\n/g, "\n");
          src = src.replace(/\r/g, "\n");
          src = src.replace(/>[ \t]+</, ">\xA8NBSP;<");
          if (!HTMLParser) {
            if (window && window.document) {
              HTMLParser = window.document;
            } else {
              throw new Error("HTMLParser is undefined. If in a webworker or nodejs environment, you need to provide a WHATWG DOM and HTML such as JSDOM");
            }
          }
          var doc = HTMLParser.createElement("div");
          doc.innerHTML = src;
          var globals = {
            preList: substitutePreCodeTags(doc)
          };
          clean(doc);
          var nodes = doc.childNodes, mdDoc = "";
          for (var i = 0; i < nodes.length; i++) {
            mdDoc += showdown2.subParser("makeMarkdown.node")(nodes[i], globals);
          }
          function clean(node) {
            for (var n = 0; n < node.childNodes.length; ++n) {
              var child = node.childNodes[n];
              if (child.nodeType === 3) {
                if (!/\S/.test(child.nodeValue) && !/^[ ]+$/.test(child.nodeValue)) {
                  node.removeChild(child);
                  --n;
                } else {
                  child.nodeValue = child.nodeValue.split("\n").join(" ");
                  child.nodeValue = child.nodeValue.replace(/(\s)+/g, "$1");
                }
              } else if (child.nodeType === 1) {
                clean(child);
              }
            }
          }
          function substitutePreCodeTags(doc2) {
            var pres = doc2.querySelectorAll("pre"), presPH = [];
            for (var i2 = 0; i2 < pres.length; ++i2) {
              if (pres[i2].childElementCount === 1 && pres[i2].firstChild.tagName.toLowerCase() === "code") {
                var content = pres[i2].firstChild.innerHTML.trim(), language = pres[i2].firstChild.getAttribute("data-language") || "";
                if (language === "") {
                  var classes = pres[i2].firstChild.className.split(" ");
                  for (var c = 0; c < classes.length; ++c) {
                    var matches = classes[c].match(/^language-(.+)$/);
                    if (matches !== null) {
                      language = matches[1];
                      break;
                    }
                  }
                }
                content = showdown2.helper.unescapeHTMLEntities(content);
                presPH.push(content);
                pres[i2].outerHTML = '<precode language="' + language + '" precodenum="' + i2.toString() + '"></precode>';
              } else {
                presPH.push(pres[i2].innerHTML);
                pres[i2].innerHTML = "";
                pres[i2].setAttribute("prenum", i2.toString());
              }
            }
            return presPH;
          }
          return mdDoc;
        };
        this.setOption = function(key, value) {
          options[key] = value;
        };
        this.getOption = function(key) {
          return options[key];
        };
        this.getOptions = function() {
          return options;
        };
        this.addExtension = function(extension, name2) {
          name2 = name2 || null;
          _parseExtension(extension, name2);
        };
        this.useExtension = function(extensionName) {
          _parseExtension(extensionName);
        };
        this.setFlavor = function(name2) {
          if (!flavor.hasOwnProperty(name2)) {
            throw Error(name2 + " flavor was not found");
          }
          var preset = flavor[name2];
          setConvFlavor = name2;
          for (var option in preset) {
            if (preset.hasOwnProperty(option)) {
              options[option] = preset[option];
            }
          }
        };
        this.getFlavor = function() {
          return setConvFlavor;
        };
        this.removeExtension = function(extension) {
          if (!showdown2.helper.isArray(extension)) {
            extension = [extension];
          }
          for (var a = 0; a < extension.length; ++a) {
            var ext = extension[a];
            for (var i = 0; i < langExtensions.length; ++i) {
              if (langExtensions[i] === ext) {
                langExtensions.splice(i, 1);
              }
            }
            for (var ii = 0; ii < outputModifiers.length; ++ii) {
              if (outputModifiers[ii] === ext) {
                outputModifiers.splice(ii, 1);
              }
            }
          }
        };
        this.getAllExtensions = function() {
          return {
            language: langExtensions,
            output: outputModifiers
          };
        };
        this.getMetadata = function(raw) {
          if (raw) {
            return metadata.raw;
          } else {
            return metadata.parsed;
          }
        };
        this.getMetadataFormat = function() {
          return metadata.format;
        };
        this._setMetadataPair = function(key, value) {
          metadata.parsed[key] = value;
        };
        this._setMetadataFormat = function(format) {
          metadata.format = format;
        };
        this._setMetadataRaw = function(raw) {
          metadata.raw = raw;
        };
      };
      showdown2.subParser("anchors", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("anchors.before", text2, options, globals);
        var writeAnchorTag = function(wholeMatch, linkText, linkId, url, m5, m6, title) {
          if (showdown2.helper.isUndefined(title)) {
            title = "";
          }
          linkId = linkId.toLowerCase();
          if (wholeMatch.search(/\(<?\s*>? ?(['"].*['"])?\)$/m) > -1) {
            url = "";
          } else if (!url) {
            if (!linkId) {
              linkId = linkText.toLowerCase().replace(/ ?\n/g, " ");
            }
            url = "#" + linkId;
            if (!showdown2.helper.isUndefined(globals.gUrls[linkId])) {
              url = globals.gUrls[linkId];
              if (!showdown2.helper.isUndefined(globals.gTitles[linkId])) {
                title = globals.gTitles[linkId];
              }
            } else {
              return wholeMatch;
            }
          }
          url = url.replace(showdown2.helper.regexes.asteriskDashAndColon, showdown2.helper.escapeCharactersCallback);
          var result = '<a href="' + url + '"';
          if (title !== "" && title !== null) {
            title = title.replace(/"/g, "&quot;");
            title = title.replace(showdown2.helper.regexes.asteriskDashAndColon, showdown2.helper.escapeCharactersCallback);
            result += ' title="' + title + '"';
          }
          if (options.openLinksInNewWindow && !/^#/.test(url)) {
            result += ' rel="noopener noreferrer" target="\xA8E95Eblank"';
          }
          result += ">" + linkText + "</a>";
          return result;
        };
        text2 = text2.replace(/\[((?:\[[^\]]*]|[^\[\]])*)] ?(?:\n *)?\[(.*?)]()()()()/g, writeAnchorTag);
        text2 = text2.replace(
          /\[((?:\[[^\]]*]|[^\[\]])*)]()[ \t]*\([ \t]?<([^>]*)>(?:[ \t]*((["'])([^"]*?)\5))?[ \t]?\)/g,
          writeAnchorTag
        );
        text2 = text2.replace(
          /\[((?:\[[^\]]*]|[^\[\]])*)]()[ \t]*\([ \t]?<?([\S]+?(?:\([\S]*?\)[\S]*?)?)>?(?:[ \t]*((["'])([^"]*?)\5))?[ \t]?\)/g,
          writeAnchorTag
        );
        text2 = text2.replace(/\[([^\[\]]+)]()()()()()/g, writeAnchorTag);
        if (options.ghMentions) {
          text2 = text2.replace(/(^|\s)(\\)?(@([a-z\d]+(?:[a-z\d.-]+?[a-z\d]+)*))/gmi, function(wm, st, escape, mentions, username) {
            if (escape === "\\") {
              return st + mentions;
            }
            if (!showdown2.helper.isString(options.ghMentionsLink)) {
              throw new Error("ghMentionsLink option must be a string");
            }
            var lnk = options.ghMentionsLink.replace(/\{u}/g, username), target = "";
            if (options.openLinksInNewWindow) {
              target = ' rel="noopener noreferrer" target="\xA8E95Eblank"';
            }
            return st + '<a href="' + lnk + '"' + target + ">" + mentions + "</a>";
          });
        }
        text2 = globals.converter._dispatch("anchors.after", text2, options, globals);
        return text2;
      });
      var simpleURLRegex = /([*~_]+|\b)(((https?|ftp|dict):\/\/|www\.)[^'">\s]+?\.[^'">\s]+?)()(\1)?(?=\s|$)(?!["<>])/gi, simpleURLRegex2 = /([*~_]+|\b)(((https?|ftp|dict):\/\/|www\.)[^'">\s]+\.[^'">\s]+?)([.!?,()\[\]])?(\1)?(?=\s|$)(?!["<>])/gi, delimUrlRegex = /()<(((https?|ftp|dict):\/\/|www\.)[^'">\s]+)()>()/gi, simpleMailRegex = /(^|\s)(?:mailto:)?([A-Za-z0-9!#$%&'*+-/=?^_`{|}~.]+@[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+)(?=$|\s)/gmi, delimMailRegex = /<()(?:mailto:)?([-.\w]+@[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+)>/gi, replaceLink = function(options) {
        "use strict";
        return function(wm, leadingMagicChars, link, m2, m3, trailingPunctuation, trailingMagicChars) {
          link = link.replace(showdown2.helper.regexes.asteriskDashAndColon, showdown2.helper.escapeCharactersCallback);
          var lnkTxt = link, append = "", target = "", lmc = leadingMagicChars || "", tmc = trailingMagicChars || "";
          if (/^www\./i.test(link)) {
            link = link.replace(/^www\./i, "http://www.");
          }
          if (options.excludeTrailingPunctuationFromURLs && trailingPunctuation) {
            append = trailingPunctuation;
          }
          if (options.openLinksInNewWindow) {
            target = ' rel="noopener noreferrer" target="\xA8E95Eblank"';
          }
          return lmc + '<a href="' + link + '"' + target + ">" + lnkTxt + "</a>" + append + tmc;
        };
      }, replaceMail = function(options, globals) {
        "use strict";
        return function(wholeMatch, b, mail) {
          var href = "mailto:";
          b = b || "";
          mail = showdown2.subParser("unescapeSpecialChars")(mail, options, globals);
          if (options.encodeEmails) {
            href = showdown2.helper.encodeEmailAddress(href + mail);
            mail = showdown2.helper.encodeEmailAddress(mail);
          } else {
            href = href + mail;
          }
          return b + '<a href="' + href + '">' + mail + "</a>";
        };
      };
      showdown2.subParser("autoLinks", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("autoLinks.before", text2, options, globals);
        text2 = text2.replace(delimUrlRegex, replaceLink(options));
        text2 = text2.replace(delimMailRegex, replaceMail(options, globals));
        text2 = globals.converter._dispatch("autoLinks.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("simplifiedAutoLinks", function(text2, options, globals) {
        "use strict";
        if (!options.simplifiedAutoLink) {
          return text2;
        }
        text2 = globals.converter._dispatch("simplifiedAutoLinks.before", text2, options, globals);
        if (options.excludeTrailingPunctuationFromURLs) {
          text2 = text2.replace(simpleURLRegex2, replaceLink(options));
        } else {
          text2 = text2.replace(simpleURLRegex, replaceLink(options));
        }
        text2 = text2.replace(simpleMailRegex, replaceMail(options, globals));
        text2 = globals.converter._dispatch("simplifiedAutoLinks.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("blockGamut", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("blockGamut.before", text2, options, globals);
        text2 = showdown2.subParser("blockQuotes")(text2, options, globals);
        text2 = showdown2.subParser("headers")(text2, options, globals);
        text2 = showdown2.subParser("horizontalRule")(text2, options, globals);
        text2 = showdown2.subParser("lists")(text2, options, globals);
        text2 = showdown2.subParser("codeBlocks")(text2, options, globals);
        text2 = showdown2.subParser("tables")(text2, options, globals);
        text2 = showdown2.subParser("hashHTMLBlocks")(text2, options, globals);
        text2 = showdown2.subParser("paragraphs")(text2, options, globals);
        text2 = globals.converter._dispatch("blockGamut.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("blockQuotes", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("blockQuotes.before", text2, options, globals);
        text2 = text2 + "\n\n";
        var rgx = /(^ {0,3}>[ \t]?.+\n(.+\n)*\n*)+/gm;
        if (options.splitAdjacentBlockquotes) {
          rgx = /^ {0,3}>[\s\S]*?(?:\n\n)/gm;
        }
        text2 = text2.replace(rgx, function(bq) {
          bq = bq.replace(/^[ \t]*>[ \t]?/gm, "");
          bq = bq.replace(/¨0/g, "");
          bq = bq.replace(/^[ \t]+$/gm, "");
          bq = showdown2.subParser("githubCodeBlocks")(bq, options, globals);
          bq = showdown2.subParser("blockGamut")(bq, options, globals);
          bq = bq.replace(/(^|\n)/g, "$1  ");
          bq = bq.replace(/(\s*<pre>[^\r]+?<\/pre>)/gm, function(wholeMatch, m1) {
            var pre = m1;
            pre = pre.replace(/^  /mg, "\xA80");
            pre = pre.replace(/¨0/g, "");
            return pre;
          });
          return showdown2.subParser("hashBlock")("<blockquote>\n" + bq + "\n</blockquote>", options, globals);
        });
        text2 = globals.converter._dispatch("blockQuotes.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("codeBlocks", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("codeBlocks.before", text2, options, globals);
        text2 += "\xA80";
        var pattern = /(?:\n\n|^)((?:(?:[ ]{4}|\t).*\n+)+)(\n*[ ]{0,3}[^ \t\n]|(?=¨0))/g;
        text2 = text2.replace(pattern, function(wholeMatch, m1, m2) {
          var codeblock = m1, nextChar = m2, end = "\n";
          codeblock = showdown2.subParser("outdent")(codeblock, options, globals);
          codeblock = showdown2.subParser("encodeCode")(codeblock, options, globals);
          codeblock = showdown2.subParser("detab")(codeblock, options, globals);
          codeblock = codeblock.replace(/^\n+/g, "");
          codeblock = codeblock.replace(/\n+$/g, "");
          if (options.omitExtraWLInCodeBlocks) {
            end = "";
          }
          codeblock = "<pre><code>" + codeblock + end + "</code></pre>";
          return showdown2.subParser("hashBlock")(codeblock, options, globals) + nextChar;
        });
        text2 = text2.replace(/¨0/, "");
        text2 = globals.converter._dispatch("codeBlocks.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("codeSpans", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("codeSpans.before", text2, options, globals);
        if (typeof text2 === "undefined") {
          text2 = "";
        }
        text2 = text2.replace(
          /(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)/gm,
          function(wholeMatch, m1, m2, m3) {
            var c = m3;
            c = c.replace(/^([ \t]*)/g, "");
            c = c.replace(/[ \t]*$/g, "");
            c = showdown2.subParser("encodeCode")(c, options, globals);
            c = m1 + "<code>" + c + "</code>";
            c = showdown2.subParser("hashHTMLSpans")(c, options, globals);
            return c;
          }
        );
        text2 = globals.converter._dispatch("codeSpans.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("completeHTMLDocument", function(text2, options, globals) {
        "use strict";
        if (!options.completeHTMLDocument) {
          return text2;
        }
        text2 = globals.converter._dispatch("completeHTMLDocument.before", text2, options, globals);
        var doctype = "html", doctypeParsed = "<!DOCTYPE HTML>\n", title = "", charset = '<meta charset="utf-8">\n', lang = "", metadata = "";
        if (typeof globals.metadata.parsed.doctype !== "undefined") {
          doctypeParsed = "<!DOCTYPE " + globals.metadata.parsed.doctype + ">\n";
          doctype = globals.metadata.parsed.doctype.toString().toLowerCase();
          if (doctype === "html" || doctype === "html5") {
            charset = '<meta charset="utf-8">';
          }
        }
        for (var meta in globals.metadata.parsed) {
          if (globals.metadata.parsed.hasOwnProperty(meta)) {
            switch (meta.toLowerCase()) {
              case "doctype":
                break;
              case "title":
                title = "<title>" + globals.metadata.parsed.title + "</title>\n";
                break;
              case "charset":
                if (doctype === "html" || doctype === "html5") {
                  charset = '<meta charset="' + globals.metadata.parsed.charset + '">\n';
                } else {
                  charset = '<meta name="charset" content="' + globals.metadata.parsed.charset + '">\n';
                }
                break;
              case "language":
              case "lang":
                lang = ' lang="' + globals.metadata.parsed[meta] + '"';
                metadata += '<meta name="' + meta + '" content="' + globals.metadata.parsed[meta] + '">\n';
                break;
              default:
                metadata += '<meta name="' + meta + '" content="' + globals.metadata.parsed[meta] + '">\n';
            }
          }
        }
        text2 = doctypeParsed + "<html" + lang + ">\n<head>\n" + title + charset + metadata + "</head>\n<body>\n" + text2.trim() + "\n</body>\n</html>";
        text2 = globals.converter._dispatch("completeHTMLDocument.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("detab", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("detab.before", text2, options, globals);
        text2 = text2.replace(/\t(?=\t)/g, "    ");
        text2 = text2.replace(/\t/g, "\xA8A\xA8B");
        text2 = text2.replace(/¨B(.+?)¨A/g, function(wholeMatch, m1) {
          var leadingText = m1, numSpaces = 4 - leadingText.length % 4;
          for (var i = 0; i < numSpaces; i++) {
            leadingText += " ";
          }
          return leadingText;
        });
        text2 = text2.replace(/¨A/g, "    ");
        text2 = text2.replace(/¨B/g, "");
        text2 = globals.converter._dispatch("detab.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("ellipsis", function(text2, options, globals) {
        "use strict";
        if (!options.ellipsis) {
          return text2;
        }
        text2 = globals.converter._dispatch("ellipsis.before", text2, options, globals);
        text2 = text2.replace(/\.\.\./g, "\u2026");
        text2 = globals.converter._dispatch("ellipsis.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("emoji", function(text2, options, globals) {
        "use strict";
        if (!options.emoji) {
          return text2;
        }
        text2 = globals.converter._dispatch("emoji.before", text2, options, globals);
        var emojiRgx = /:([\S]+?):/g;
        text2 = text2.replace(emojiRgx, function(wm, emojiCode) {
          if (showdown2.helper.emojis.hasOwnProperty(emojiCode)) {
            return showdown2.helper.emojis[emojiCode];
          }
          return wm;
        });
        text2 = globals.converter._dispatch("emoji.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("encodeAmpsAndAngles", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("encodeAmpsAndAngles.before", text2, options, globals);
        text2 = text2.replace(/&(?!#?[xX]?(?:[0-9a-fA-F]+|\w+);)/g, "&amp;");
        text2 = text2.replace(/<(?![a-z\/?$!])/gi, "&lt;");
        text2 = text2.replace(/</g, "&lt;");
        text2 = text2.replace(/>/g, "&gt;");
        text2 = globals.converter._dispatch("encodeAmpsAndAngles.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("encodeBackslashEscapes", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("encodeBackslashEscapes.before", text2, options, globals);
        text2 = text2.replace(/\\(\\)/g, showdown2.helper.escapeCharactersCallback);
        text2 = text2.replace(/\\([`*_{}\[\]()>#+.!~=|:-])/g, showdown2.helper.escapeCharactersCallback);
        text2 = globals.converter._dispatch("encodeBackslashEscapes.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("encodeCode", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("encodeCode.before", text2, options, globals);
        text2 = text2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/([*_{}\[\]\\=~-])/g, showdown2.helper.escapeCharactersCallback);
        text2 = globals.converter._dispatch("encodeCode.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("escapeSpecialCharsWithinTagAttributes", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("escapeSpecialCharsWithinTagAttributes.before", text2, options, globals);
        var tags = /<\/?[a-z\d_:-]+(?:[\s]+[\s\S]+?)?>/gi, comments = /<!(--(?:(?:[^>-]|-[^>])(?:[^-]|-[^-])*)--)>/gi;
        text2 = text2.replace(tags, function(wholeMatch) {
          return wholeMatch.replace(/(.)<\/?code>(?=.)/g, "$1`").replace(/([\\`*_~=|])/g, showdown2.helper.escapeCharactersCallback);
        });
        text2 = text2.replace(comments, function(wholeMatch) {
          return wholeMatch.replace(/([\\`*_~=|])/g, showdown2.helper.escapeCharactersCallback);
        });
        text2 = globals.converter._dispatch("escapeSpecialCharsWithinTagAttributes.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("githubCodeBlocks", function(text2, options, globals) {
        "use strict";
        if (!options.ghCodeBlocks) {
          return text2;
        }
        text2 = globals.converter._dispatch("githubCodeBlocks.before", text2, options, globals);
        text2 += "\xA80";
        text2 = text2.replace(/(?:^|\n)(?: {0,3})(```+|~~~+)(?: *)([^\s`~]*)\n([\s\S]*?)\n(?: {0,3})\1/g, function(wholeMatch, delim, language, codeblock) {
          var end = options.omitExtraWLInCodeBlocks ? "" : "\n";
          codeblock = showdown2.subParser("encodeCode")(codeblock, options, globals);
          codeblock = showdown2.subParser("detab")(codeblock, options, globals);
          codeblock = codeblock.replace(/^\n+/g, "");
          codeblock = codeblock.replace(/\n+$/g, "");
          codeblock = "<pre><code" + (language ? ' class="' + language + " language-" + language + '"' : "") + ">" + codeblock + end + "</code></pre>";
          codeblock = showdown2.subParser("hashBlock")(codeblock, options, globals);
          return "\n\n\xA8G" + (globals.ghCodeBlocks.push({ text: wholeMatch, codeblock }) - 1) + "G\n\n";
        });
        text2 = text2.replace(/¨0/, "");
        return globals.converter._dispatch("githubCodeBlocks.after", text2, options, globals);
      });
      showdown2.subParser("hashBlock", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("hashBlock.before", text2, options, globals);
        text2 = text2.replace(/(^\n+|\n+$)/g, "");
        text2 = "\n\n\xA8K" + (globals.gHtmlBlocks.push(text2) - 1) + "K\n\n";
        text2 = globals.converter._dispatch("hashBlock.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("hashCodeTags", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("hashCodeTags.before", text2, options, globals);
        var repFunc = function(wholeMatch, match, left, right) {
          var codeblock = left + showdown2.subParser("encodeCode")(match, options, globals) + right;
          return "\xA8C" + (globals.gHtmlSpans.push(codeblock) - 1) + "C";
        };
        text2 = showdown2.helper.replaceRecursiveRegExp(text2, repFunc, "<code\\b[^>]*>", "</code>", "gim");
        text2 = globals.converter._dispatch("hashCodeTags.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("hashElement", function(text2, options, globals) {
        "use strict";
        return function(wholeMatch, m1) {
          var blockText = m1;
          blockText = blockText.replace(/\n\n/g, "\n");
          blockText = blockText.replace(/^\n/, "");
          blockText = blockText.replace(/\n+$/g, "");
          blockText = "\n\n\xA8K" + (globals.gHtmlBlocks.push(blockText) - 1) + "K\n\n";
          return blockText;
        };
      });
      showdown2.subParser("hashHTMLBlocks", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("hashHTMLBlocks.before", text2, options, globals);
        var blockTags = [
          "pre",
          "div",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "blockquote",
          "table",
          "dl",
          "ol",
          "ul",
          "script",
          "noscript",
          "form",
          "fieldset",
          "iframe",
          "math",
          "style",
          "section",
          "header",
          "footer",
          "nav",
          "article",
          "aside",
          "address",
          "audio",
          "canvas",
          "figure",
          "hgroup",
          "output",
          "video",
          "p"
        ], repFunc = function(wholeMatch, match, left, right) {
          var txt = wholeMatch;
          if (left.search(/\bmarkdown\b/) !== -1) {
            txt = left + globals.converter.makeHtml(match) + right;
          }
          return "\n\n\xA8K" + (globals.gHtmlBlocks.push(txt) - 1) + "K\n\n";
        };
        if (options.backslashEscapesHTMLTags) {
          text2 = text2.replace(/\\<(\/?[^>]+?)>/g, function(wm, inside) {
            return "&lt;" + inside + "&gt;";
          });
        }
        for (var i = 0; i < blockTags.length; ++i) {
          var opTagPos, rgx1 = new RegExp("^ {0,3}(<" + blockTags[i] + "\\b[^>]*>)", "im"), patLeft = "<" + blockTags[i] + "\\b[^>]*>", patRight = "</" + blockTags[i] + ">";
          while ((opTagPos = showdown2.helper.regexIndexOf(text2, rgx1)) !== -1) {
            var subTexts = showdown2.helper.splitAtIndex(text2, opTagPos), newSubText1 = showdown2.helper.replaceRecursiveRegExp(subTexts[1], repFunc, patLeft, patRight, "im");
            if (newSubText1 === subTexts[1]) {
              break;
            }
            text2 = subTexts[0].concat(newSubText1);
          }
        }
        text2 = text2.replace(
          /(\n {0,3}(<(hr)\b([^<>])*?\/?>)[ \t]*(?=\n{2,}))/g,
          showdown2.subParser("hashElement")(text2, options, globals)
        );
        text2 = showdown2.helper.replaceRecursiveRegExp(text2, function(txt) {
          return "\n\n\xA8K" + (globals.gHtmlBlocks.push(txt) - 1) + "K\n\n";
        }, "^ {0,3}<!--", "-->", "gm");
        text2 = text2.replace(
          /(?:\n\n)( {0,3}(?:<([?%])[^\r]*?\2>)[ \t]*(?=\n{2,}))/g,
          showdown2.subParser("hashElement")(text2, options, globals)
        );
        text2 = globals.converter._dispatch("hashHTMLBlocks.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("hashHTMLSpans", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("hashHTMLSpans.before", text2, options, globals);
        function hashHTMLSpan(html2) {
          return "\xA8C" + (globals.gHtmlSpans.push(html2) - 1) + "C";
        }
        text2 = text2.replace(/<[^>]+?\/>/gi, function(wm) {
          return hashHTMLSpan(wm);
        });
        text2 = text2.replace(/<([^>]+?)>[\s\S]*?<\/\1>/g, function(wm) {
          return hashHTMLSpan(wm);
        });
        text2 = text2.replace(/<([^>]+?)\s[^>]+?>[\s\S]*?<\/\1>/g, function(wm) {
          return hashHTMLSpan(wm);
        });
        text2 = text2.replace(/<[^>]+?>/gi, function(wm) {
          return hashHTMLSpan(wm);
        });
        text2 = globals.converter._dispatch("hashHTMLSpans.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("unhashHTMLSpans", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("unhashHTMLSpans.before", text2, options, globals);
        for (var i = 0; i < globals.gHtmlSpans.length; ++i) {
          var repText = globals.gHtmlSpans[i], limit = 0;
          while (/¨C(\d+)C/.test(repText)) {
            var num = RegExp.$1;
            repText = repText.replace("\xA8C" + num + "C", globals.gHtmlSpans[num]);
            if (limit === 10) {
              console.error("maximum nesting of 10 spans reached!!!");
              break;
            }
            ++limit;
          }
          text2 = text2.replace("\xA8C" + i + "C", repText);
        }
        text2 = globals.converter._dispatch("unhashHTMLSpans.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("hashPreCodeTags", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("hashPreCodeTags.before", text2, options, globals);
        var repFunc = function(wholeMatch, match, left, right) {
          var codeblock = left + showdown2.subParser("encodeCode")(match, options, globals) + right;
          return "\n\n\xA8G" + (globals.ghCodeBlocks.push({ text: wholeMatch, codeblock }) - 1) + "G\n\n";
        };
        text2 = showdown2.helper.replaceRecursiveRegExp(text2, repFunc, "^ {0,3}<pre\\b[^>]*>\\s*<code\\b[^>]*>", "^ {0,3}</code>\\s*</pre>", "gim");
        text2 = globals.converter._dispatch("hashPreCodeTags.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("headers", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("headers.before", text2, options, globals);
        var headerLevelStart = isNaN(parseInt(options.headerLevelStart)) ? 1 : parseInt(options.headerLevelStart), setextRegexH1 = options.smoothLivePreview ? /^(.+)[ \t]*\n={2,}[ \t]*\n+/gm : /^(.+)[ \t]*\n=+[ \t]*\n+/gm, setextRegexH2 = options.smoothLivePreview ? /^(.+)[ \t]*\n-{2,}[ \t]*\n+/gm : /^(.+)[ \t]*\n-+[ \t]*\n+/gm;
        text2 = text2.replace(setextRegexH1, function(wholeMatch, m1) {
          var spanGamut = showdown2.subParser("spanGamut")(m1, options, globals), hID = options.noHeaderId ? "" : ' id="' + headerId(m1) + '"', hLevel = headerLevelStart, hashBlock = "<h" + hLevel + hID + ">" + spanGamut + "</h" + hLevel + ">";
          return showdown2.subParser("hashBlock")(hashBlock, options, globals);
        });
        text2 = text2.replace(setextRegexH2, function(matchFound, m1) {
          var spanGamut = showdown2.subParser("spanGamut")(m1, options, globals), hID = options.noHeaderId ? "" : ' id="' + headerId(m1) + '"', hLevel = headerLevelStart + 1, hashBlock = "<h" + hLevel + hID + ">" + spanGamut + "</h" + hLevel + ">";
          return showdown2.subParser("hashBlock")(hashBlock, options, globals);
        });
        var atxStyle = options.requireSpaceBeforeHeadingText ? /^(#{1,6})[ \t]+(.+?)[ \t]*#*\n+/gm : /^(#{1,6})[ \t]*(.+?)[ \t]*#*\n+/gm;
        text2 = text2.replace(atxStyle, function(wholeMatch, m1, m2) {
          var hText = m2;
          if (options.customizedHeaderId) {
            hText = m2.replace(/\s?\{([^{]+?)}\s*$/, "");
          }
          var span = showdown2.subParser("spanGamut")(hText, options, globals), hID = options.noHeaderId ? "" : ' id="' + headerId(m2) + '"', hLevel = headerLevelStart - 1 + m1.length, header = "<h" + hLevel + hID + ">" + span + "</h" + hLevel + ">";
          return showdown2.subParser("hashBlock")(header, options, globals);
        });
        function headerId(m) {
          var title, prefix;
          if (options.customizedHeaderId) {
            var match = m.match(/\{([^{]+?)}\s*$/);
            if (match && match[1]) {
              m = match[1];
            }
          }
          title = m;
          if (showdown2.helper.isString(options.prefixHeaderId)) {
            prefix = options.prefixHeaderId;
          } else if (options.prefixHeaderId === true) {
            prefix = "section-";
          } else {
            prefix = "";
          }
          if (!options.rawPrefixHeaderId) {
            title = prefix + title;
          }
          if (options.ghCompatibleHeaderId) {
            title = title.replace(/ /g, "-").replace(/&amp;/g, "").replace(/¨T/g, "").replace(/¨D/g, "").replace(/[&+$,\/:;=?@"#{}|^¨~\[\]`\\*)(%.!'<>]/g, "").toLowerCase();
          } else if (options.rawHeaderId) {
            title = title.replace(/ /g, "-").replace(/&amp;/g, "&").replace(/¨T/g, "\xA8").replace(/¨D/g, "$").replace(/["']/g, "-").toLowerCase();
          } else {
            title = title.replace(/[^\w]/g, "").toLowerCase();
          }
          if (options.rawPrefixHeaderId) {
            title = prefix + title;
          }
          if (globals.hashLinkCounts[title]) {
            title = title + "-" + globals.hashLinkCounts[title]++;
          } else {
            globals.hashLinkCounts[title] = 1;
          }
          return title;
        }
        text2 = globals.converter._dispatch("headers.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("horizontalRule", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("horizontalRule.before", text2, options, globals);
        var key = showdown2.subParser("hashBlock")("<hr />", options, globals);
        text2 = text2.replace(/^ {0,2}( ?-){3,}[ \t]*$/gm, key);
        text2 = text2.replace(/^ {0,2}( ?\*){3,}[ \t]*$/gm, key);
        text2 = text2.replace(/^ {0,2}( ?_){3,}[ \t]*$/gm, key);
        text2 = globals.converter._dispatch("horizontalRule.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("images", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("images.before", text2, options, globals);
        var inlineRegExp = /!\[([^\]]*?)][ \t]*()\([ \t]?<?([\S]+?(?:\([\S]*?\)[\S]*?)?)>?(?: =([*\d]+[A-Za-z%]{0,4})x([*\d]+[A-Za-z%]{0,4}))?[ \t]*(?:(["'])([^"]*?)\6)?[ \t]?\)/g, crazyRegExp = /!\[([^\]]*?)][ \t]*()\([ \t]?<([^>]*)>(?: =([*\d]+[A-Za-z%]{0,4})x([*\d]+[A-Za-z%]{0,4}))?[ \t]*(?:(?:(["'])([^"]*?)\6))?[ \t]?\)/g, base64RegExp = /!\[([^\]]*?)][ \t]*()\([ \t]?<?(data:.+?\/.+?;base64,[A-Za-z0-9+/=\n]+?)>?(?: =([*\d]+[A-Za-z%]{0,4})x([*\d]+[A-Za-z%]{0,4}))?[ \t]*(?:(["'])([^"]*?)\6)?[ \t]?\)/g, referenceRegExp = /!\[([^\]]*?)] ?(?:\n *)?\[([\s\S]*?)]()()()()()/g, refShortcutRegExp = /!\[([^\[\]]+)]()()()()()/g;
        function writeImageTagBase64(wholeMatch, altText, linkId, url, width, height, m5, title) {
          url = url.replace(/\s/g, "");
          return writeImageTag(wholeMatch, altText, linkId, url, width, height, m5, title);
        }
        function writeImageTag(wholeMatch, altText, linkId, url, width, height, m5, title) {
          var gUrls = globals.gUrls, gTitles = globals.gTitles, gDims = globals.gDimensions;
          linkId = linkId.toLowerCase();
          if (!title) {
            title = "";
          }
          if (wholeMatch.search(/\(<?\s*>? ?(['"].*['"])?\)$/m) > -1) {
            url = "";
          } else if (url === "" || url === null) {
            if (linkId === "" || linkId === null) {
              linkId = altText.toLowerCase().replace(/ ?\n/g, " ");
            }
            url = "#" + linkId;
            if (!showdown2.helper.isUndefined(gUrls[linkId])) {
              url = gUrls[linkId];
              if (!showdown2.helper.isUndefined(gTitles[linkId])) {
                title = gTitles[linkId];
              }
              if (!showdown2.helper.isUndefined(gDims[linkId])) {
                width = gDims[linkId].width;
                height = gDims[linkId].height;
              }
            } else {
              return wholeMatch;
            }
          }
          altText = altText.replace(/"/g, "&quot;").replace(showdown2.helper.regexes.asteriskDashAndColon, showdown2.helper.escapeCharactersCallback);
          url = url.replace(showdown2.helper.regexes.asteriskDashAndColon, showdown2.helper.escapeCharactersCallback);
          var result = '<img src="' + url + '" alt="' + altText + '"';
          if (title && showdown2.helper.isString(title)) {
            title = title.replace(/"/g, "&quot;").replace(showdown2.helper.regexes.asteriskDashAndColon, showdown2.helper.escapeCharactersCallback);
            result += ' title="' + title + '"';
          }
          if (width && height) {
            width = width === "*" ? "auto" : width;
            height = height === "*" ? "auto" : height;
            result += ' width="' + width + '"';
            result += ' height="' + height + '"';
          }
          result += " />";
          return result;
        }
        text2 = text2.replace(referenceRegExp, writeImageTag);
        text2 = text2.replace(base64RegExp, writeImageTagBase64);
        text2 = text2.replace(crazyRegExp, writeImageTag);
        text2 = text2.replace(inlineRegExp, writeImageTag);
        text2 = text2.replace(refShortcutRegExp, writeImageTag);
        text2 = globals.converter._dispatch("images.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("italicsAndBold", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("italicsAndBold.before", text2, options, globals);
        function parseInside(txt, left, right) {
          return left + txt + right;
        }
        if (options.literalMidWordUnderscores) {
          text2 = text2.replace(/\b___(\S[\s\S]*?)___\b/g, function(wm, txt) {
            return parseInside(txt, "<strong><em>", "</em></strong>");
          });
          text2 = text2.replace(/\b__(\S[\s\S]*?)__\b/g, function(wm, txt) {
            return parseInside(txt, "<strong>", "</strong>");
          });
          text2 = text2.replace(/\b_(\S[\s\S]*?)_\b/g, function(wm, txt) {
            return parseInside(txt, "<em>", "</em>");
          });
        } else {
          text2 = text2.replace(/___(\S[\s\S]*?)___/g, function(wm, m) {
            return /\S$/.test(m) ? parseInside(m, "<strong><em>", "</em></strong>") : wm;
          });
          text2 = text2.replace(/__(\S[\s\S]*?)__/g, function(wm, m) {
            return /\S$/.test(m) ? parseInside(m, "<strong>", "</strong>") : wm;
          });
          text2 = text2.replace(/_([^\s_][\s\S]*?)_/g, function(wm, m) {
            return /\S$/.test(m) ? parseInside(m, "<em>", "</em>") : wm;
          });
        }
        if (options.literalMidWordAsterisks) {
          text2 = text2.replace(/([^*]|^)\B\*\*\*(\S[\s\S]*?)\*\*\*\B(?!\*)/g, function(wm, lead, txt) {
            return parseInside(txt, lead + "<strong><em>", "</em></strong>");
          });
          text2 = text2.replace(/([^*]|^)\B\*\*(\S[\s\S]*?)\*\*\B(?!\*)/g, function(wm, lead, txt) {
            return parseInside(txt, lead + "<strong>", "</strong>");
          });
          text2 = text2.replace(/([^*]|^)\B\*(\S[\s\S]*?)\*\B(?!\*)/g, function(wm, lead, txt) {
            return parseInside(txt, lead + "<em>", "</em>");
          });
        } else {
          text2 = text2.replace(/\*\*\*(\S[\s\S]*?)\*\*\*/g, function(wm, m) {
            return /\S$/.test(m) ? parseInside(m, "<strong><em>", "</em></strong>") : wm;
          });
          text2 = text2.replace(/\*\*(\S[\s\S]*?)\*\*/g, function(wm, m) {
            return /\S$/.test(m) ? parseInside(m, "<strong>", "</strong>") : wm;
          });
          text2 = text2.replace(/\*([^\s*][\s\S]*?)\*/g, function(wm, m) {
            return /\S$/.test(m) ? parseInside(m, "<em>", "</em>") : wm;
          });
        }
        text2 = globals.converter._dispatch("italicsAndBold.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("lists", function(text2, options, globals) {
        "use strict";
        function processListItems(listStr, trimTrailing) {
          globals.gListLevel++;
          listStr = listStr.replace(/\n{2,}$/, "\n");
          listStr += "\xA80";
          var rgx = /(\n)?(^ {0,3})([*+-]|\d+[.])[ \t]+((\[(x|X| )?])?[ \t]*[^\r]+?(\n{1,2}))(?=\n*(¨0| {0,3}([*+-]|\d+[.])[ \t]+))/gm, isParagraphed = /\n[ \t]*\n(?!¨0)/.test(listStr);
          if (options.disableForced4SpacesIndentedSublists) {
            rgx = /(\n)?(^ {0,3})([*+-]|\d+[.])[ \t]+((\[(x|X| )?])?[ \t]*[^\r]+?(\n{1,2}))(?=\n*(¨0|\2([*+-]|\d+[.])[ \t]+))/gm;
          }
          listStr = listStr.replace(rgx, function(wholeMatch, m1, m2, m3, m4, taskbtn, checked) {
            checked = checked && checked.trim() !== "";
            var item = showdown2.subParser("outdent")(m4, options, globals), bulletStyle = "";
            if (taskbtn && options.tasklists) {
              bulletStyle = ' class="task-list-item" style="list-style-type: none;"';
              item = item.replace(/^[ \t]*\[(x|X| )?]/m, function() {
                var otp = '<input type="checkbox" disabled style="margin: 0px 0.35em 0.25em -1.6em; vertical-align: middle;"';
                if (checked) {
                  otp += " checked";
                }
                otp += ">";
                return otp;
              });
            }
            item = item.replace(/^([-*+]|\d\.)[ \t]+[\S\n ]*/g, function(wm2) {
              return "\xA8A" + wm2;
            });
            if (m1 || item.search(/\n{2,}/) > -1) {
              item = showdown2.subParser("githubCodeBlocks")(item, options, globals);
              item = showdown2.subParser("blockGamut")(item, options, globals);
            } else {
              item = showdown2.subParser("lists")(item, options, globals);
              item = item.replace(/\n$/, "");
              item = showdown2.subParser("hashHTMLBlocks")(item, options, globals);
              item = item.replace(/\n\n+/g, "\n\n");
              if (isParagraphed) {
                item = showdown2.subParser("paragraphs")(item, options, globals);
              } else {
                item = showdown2.subParser("spanGamut")(item, options, globals);
              }
            }
            item = item.replace("\xA8A", "");
            item = "<li" + bulletStyle + ">" + item + "</li>\n";
            return item;
          });
          listStr = listStr.replace(/¨0/g, "");
          globals.gListLevel--;
          if (trimTrailing) {
            listStr = listStr.replace(/\s+$/, "");
          }
          return listStr;
        }
        function styleStartNumber(list, listType) {
          if (listType === "ol") {
            var res = list.match(/^ *(\d+)\./);
            if (res && res[1] !== "1") {
              return ' start="' + res[1] + '"';
            }
          }
          return "";
        }
        function parseConsecutiveLists(list, listType, trimTrailing) {
          var olRgx = options.disableForced4SpacesIndentedSublists ? /^ ?\d+\.[ \t]/gm : /^ {0,3}\d+\.[ \t]/gm, ulRgx = options.disableForced4SpacesIndentedSublists ? /^ ?[*+-][ \t]/gm : /^ {0,3}[*+-][ \t]/gm, counterRxg = listType === "ul" ? olRgx : ulRgx, result = "";
          if (list.search(counterRxg) !== -1) {
            (function parseCL(txt) {
              var pos = txt.search(counterRxg), style2 = styleStartNumber(list, listType);
              if (pos !== -1) {
                result += "\n\n<" + listType + style2 + ">\n" + processListItems(txt.slice(0, pos), !!trimTrailing) + "</" + listType + ">\n";
                listType = listType === "ul" ? "ol" : "ul";
                counterRxg = listType === "ul" ? olRgx : ulRgx;
                parseCL(txt.slice(pos));
              } else {
                result += "\n\n<" + listType + style2 + ">\n" + processListItems(txt, !!trimTrailing) + "</" + listType + ">\n";
              }
            })(list);
          } else {
            var style = styleStartNumber(list, listType);
            result = "\n\n<" + listType + style + ">\n" + processListItems(list, !!trimTrailing) + "</" + listType + ">\n";
          }
          return result;
        }
        text2 = globals.converter._dispatch("lists.before", text2, options, globals);
        text2 += "\xA80";
        if (globals.gListLevel) {
          text2 = text2.replace(
            /^(( {0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(¨0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/gm,
            function(wholeMatch, list, m2) {
              var listType = m2.search(/[*+-]/g) > -1 ? "ul" : "ol";
              return parseConsecutiveLists(list, listType, true);
            }
          );
        } else {
          text2 = text2.replace(
            /(\n\n|^\n?)(( {0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(¨0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/gm,
            function(wholeMatch, m1, list, m3) {
              var listType = m3.search(/[*+-]/g) > -1 ? "ul" : "ol";
              return parseConsecutiveLists(list, listType, false);
            }
          );
        }
        text2 = text2.replace(/¨0/, "");
        text2 = globals.converter._dispatch("lists.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("metadata", function(text2, options, globals) {
        "use strict";
        if (!options.metadata) {
          return text2;
        }
        text2 = globals.converter._dispatch("metadata.before", text2, options, globals);
        function parseMetadataContents(content) {
          globals.metadata.raw = content;
          content = content.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
          content = content.replace(/\n {4}/g, " ");
          content.replace(/^([\S ]+): +([\s\S]+?)$/gm, function(wm, key, value) {
            globals.metadata.parsed[key] = value;
            return "";
          });
        }
        text2 = text2.replace(/^\s*«««+(\S*?)\n([\s\S]+?)\n»»»+\n/, function(wholematch, format, content) {
          parseMetadataContents(content);
          return "\xA8M";
        });
        text2 = text2.replace(/^\s*---+(\S*?)\n([\s\S]+?)\n---+\n/, function(wholematch, format, content) {
          if (format) {
            globals.metadata.format = format;
          }
          parseMetadataContents(content);
          return "\xA8M";
        });
        text2 = text2.replace(/¨M/g, "");
        text2 = globals.converter._dispatch("metadata.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("outdent", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("outdent.before", text2, options, globals);
        text2 = text2.replace(/^(\t|[ ]{1,4})/gm, "\xA80");
        text2 = text2.replace(/¨0/g, "");
        text2 = globals.converter._dispatch("outdent.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("paragraphs", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("paragraphs.before", text2, options, globals);
        text2 = text2.replace(/^\n+/g, "");
        text2 = text2.replace(/\n+$/g, "");
        var grafs = text2.split(/\n{2,}/g), grafsOut = [], end = grafs.length;
        for (var i = 0; i < end; i++) {
          var str = grafs[i];
          if (str.search(/¨(K|G)(\d+)\1/g) >= 0) {
            grafsOut.push(str);
          } else if (str.search(/\S/) >= 0) {
            str = showdown2.subParser("spanGamut")(str, options, globals);
            str = str.replace(/^([ \t]*)/g, "<p>");
            str += "</p>";
            grafsOut.push(str);
          }
        }
        end = grafsOut.length;
        for (i = 0; i < end; i++) {
          var blockText = "", grafsOutIt = grafsOut[i], codeFlag = false;
          while (/¨(K|G)(\d+)\1/.test(grafsOutIt)) {
            var delim = RegExp.$1, num = RegExp.$2;
            if (delim === "K") {
              blockText = globals.gHtmlBlocks[num];
            } else {
              if (codeFlag) {
                blockText = showdown2.subParser("encodeCode")(globals.ghCodeBlocks[num].text, options, globals);
              } else {
                blockText = globals.ghCodeBlocks[num].codeblock;
              }
            }
            blockText = blockText.replace(/\$/g, "$$$$");
            grafsOutIt = grafsOutIt.replace(/(\n\n)?¨(K|G)\d+\2(\n\n)?/, blockText);
            if (/^<pre\b[^>]*>\s*<code\b[^>]*>/.test(grafsOutIt)) {
              codeFlag = true;
            }
          }
          grafsOut[i] = grafsOutIt;
        }
        text2 = grafsOut.join("\n");
        text2 = text2.replace(/^\n+/g, "");
        text2 = text2.replace(/\n+$/g, "");
        return globals.converter._dispatch("paragraphs.after", text2, options, globals);
      });
      showdown2.subParser("runExtension", function(ext, text2, options, globals) {
        "use strict";
        if (ext.filter) {
          text2 = ext.filter(text2, globals.converter, options);
        } else if (ext.regex) {
          var re = ext.regex;
          if (!(re instanceof RegExp)) {
            re = new RegExp(re, "g");
          }
          text2 = text2.replace(re, ext.replace);
        }
        return text2;
      });
      showdown2.subParser("spanGamut", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("spanGamut.before", text2, options, globals);
        text2 = showdown2.subParser("codeSpans")(text2, options, globals);
        text2 = showdown2.subParser("escapeSpecialCharsWithinTagAttributes")(text2, options, globals);
        text2 = showdown2.subParser("encodeBackslashEscapes")(text2, options, globals);
        text2 = showdown2.subParser("images")(text2, options, globals);
        text2 = showdown2.subParser("anchors")(text2, options, globals);
        text2 = showdown2.subParser("autoLinks")(text2, options, globals);
        text2 = showdown2.subParser("simplifiedAutoLinks")(text2, options, globals);
        text2 = showdown2.subParser("emoji")(text2, options, globals);
        text2 = showdown2.subParser("underline")(text2, options, globals);
        text2 = showdown2.subParser("italicsAndBold")(text2, options, globals);
        text2 = showdown2.subParser("strikethrough")(text2, options, globals);
        text2 = showdown2.subParser("ellipsis")(text2, options, globals);
        text2 = showdown2.subParser("hashHTMLSpans")(text2, options, globals);
        text2 = showdown2.subParser("encodeAmpsAndAngles")(text2, options, globals);
        if (options.simpleLineBreaks) {
          if (!/\n\n¨K/.test(text2)) {
            text2 = text2.replace(/\n+/g, "<br />\n");
          }
        } else {
          text2 = text2.replace(/  +\n/g, "<br />\n");
        }
        text2 = globals.converter._dispatch("spanGamut.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("strikethrough", function(text2, options, globals) {
        "use strict";
        function parseInside(txt) {
          if (options.simplifiedAutoLink) {
            txt = showdown2.subParser("simplifiedAutoLinks")(txt, options, globals);
          }
          return "<del>" + txt + "</del>";
        }
        if (options.strikethrough) {
          text2 = globals.converter._dispatch("strikethrough.before", text2, options, globals);
          text2 = text2.replace(/(?:~){2}([\s\S]+?)(?:~){2}/g, function(wm, txt) {
            return parseInside(txt);
          });
          text2 = globals.converter._dispatch("strikethrough.after", text2, options, globals);
        }
        return text2;
      });
      showdown2.subParser("stripLinkDefinitions", function(text2, options, globals) {
        "use strict";
        var regex = /^ {0,3}\[([^\]]+)]:[ \t]*\n?[ \t]*<?([^>\s]+)>?(?: =([*\d]+[A-Za-z%]{0,4})x([*\d]+[A-Za-z%]{0,4}))?[ \t]*\n?[ \t]*(?:(\n*)["|'(](.+?)["|')][ \t]*)?(?:\n+|(?=¨0))/gm, base64Regex = /^ {0,3}\[([^\]]+)]:[ \t]*\n?[ \t]*<?(data:.+?\/.+?;base64,[A-Za-z0-9+/=\n]+?)>?(?: =([*\d]+[A-Za-z%]{0,4})x([*\d]+[A-Za-z%]{0,4}))?[ \t]*\n?[ \t]*(?:(\n*)["|'(](.+?)["|')][ \t]*)?(?:\n\n|(?=¨0)|(?=\n\[))/gm;
        text2 += "\xA80";
        var replaceFunc = function(wholeMatch, linkId, url, width, height, blankLines, title) {
          linkId = linkId.toLowerCase();
          if (text2.toLowerCase().split(linkId).length - 1 < 2) {
            return wholeMatch;
          }
          if (url.match(/^data:.+?\/.+?;base64,/)) {
            globals.gUrls[linkId] = url.replace(/\s/g, "");
          } else {
            globals.gUrls[linkId] = showdown2.subParser("encodeAmpsAndAngles")(url, options, globals);
          }
          if (blankLines) {
            return blankLines + title;
          } else {
            if (title) {
              globals.gTitles[linkId] = title.replace(/"|'/g, "&quot;");
            }
            if (options.parseImgDimensions && width && height) {
              globals.gDimensions[linkId] = {
                width,
                height
              };
            }
          }
          return "";
        };
        text2 = text2.replace(base64Regex, replaceFunc);
        text2 = text2.replace(regex, replaceFunc);
        text2 = text2.replace(/¨0/, "");
        return text2;
      });
      showdown2.subParser("tables", function(text2, options, globals) {
        "use strict";
        if (!options.tables) {
          return text2;
        }
        var tableRgx = /^ {0,3}\|?.+\|.+\n {0,3}\|?[ \t]*:?[ \t]*(?:[-=]){2,}[ \t]*:?[ \t]*\|[ \t]*:?[ \t]*(?:[-=]){2,}[\s\S]+?(?:\n\n|¨0)/gm, singeColTblRgx = /^ {0,3}\|.+\|[ \t]*\n {0,3}\|[ \t]*:?[ \t]*(?:[-=]){2,}[ \t]*:?[ \t]*\|[ \t]*\n( {0,3}\|.+\|[ \t]*\n)*(?:\n|¨0)/gm;
        function parseStyles(sLine) {
          if (/^:[ \t]*--*$/.test(sLine)) {
            return ' style="text-align:left;"';
          } else if (/^--*[ \t]*:[ \t]*$/.test(sLine)) {
            return ' style="text-align:right;"';
          } else if (/^:[ \t]*--*[ \t]*:$/.test(sLine)) {
            return ' style="text-align:center;"';
          } else {
            return "";
          }
        }
        function parseHeaders(header, style) {
          var id = "";
          header = header.trim();
          if (options.tablesHeaderId || options.tableHeaderId) {
            id = ' id="' + header.replace(/ /g, "_").toLowerCase() + '"';
          }
          header = showdown2.subParser("spanGamut")(header, options, globals);
          return "<th" + id + style + ">" + header + "</th>\n";
        }
        function parseCells(cell, style) {
          var subText = showdown2.subParser("spanGamut")(cell, options, globals);
          return "<td" + style + ">" + subText + "</td>\n";
        }
        function buildTable(headers, cells) {
          var tb = "<table>\n<thead>\n<tr>\n", tblLgn = headers.length;
          for (var i = 0; i < tblLgn; ++i) {
            tb += headers[i];
          }
          tb += "</tr>\n</thead>\n<tbody>\n";
          for (i = 0; i < cells.length; ++i) {
            tb += "<tr>\n";
            for (var ii = 0; ii < tblLgn; ++ii) {
              tb += cells[i][ii];
            }
            tb += "</tr>\n";
          }
          tb += "</tbody>\n</table>\n";
          return tb;
        }
        function parseTable(rawTable) {
          var i, tableLines = rawTable.split("\n");
          for (i = 0; i < tableLines.length; ++i) {
            if (/^ {0,3}\|/.test(tableLines[i])) {
              tableLines[i] = tableLines[i].replace(/^ {0,3}\|/, "");
            }
            if (/\|[ \t]*$/.test(tableLines[i])) {
              tableLines[i] = tableLines[i].replace(/\|[ \t]*$/, "");
            }
            tableLines[i] = showdown2.subParser("codeSpans")(tableLines[i], options, globals);
          }
          var rawHeaders = tableLines[0].split("|").map(function(s) {
            return s.trim();
          }), rawStyles = tableLines[1].split("|").map(function(s) {
            return s.trim();
          }), rawCells = [], headers = [], styles = [], cells = [];
          tableLines.shift();
          tableLines.shift();
          for (i = 0; i < tableLines.length; ++i) {
            if (tableLines[i].trim() === "") {
              continue;
            }
            rawCells.push(
              tableLines[i].split("|").map(function(s) {
                return s.trim();
              })
            );
          }
          if (rawHeaders.length < rawStyles.length) {
            return rawTable;
          }
          for (i = 0; i < rawStyles.length; ++i) {
            styles.push(parseStyles(rawStyles[i]));
          }
          for (i = 0; i < rawHeaders.length; ++i) {
            if (showdown2.helper.isUndefined(styles[i])) {
              styles[i] = "";
            }
            headers.push(parseHeaders(rawHeaders[i], styles[i]));
          }
          for (i = 0; i < rawCells.length; ++i) {
            var row = [];
            for (var ii = 0; ii < headers.length; ++ii) {
              if (showdown2.helper.isUndefined(rawCells[i][ii])) {
              }
              row.push(parseCells(rawCells[i][ii], styles[ii]));
            }
            cells.push(row);
          }
          return buildTable(headers, cells);
        }
        text2 = globals.converter._dispatch("tables.before", text2, options, globals);
        text2 = text2.replace(/\\(\|)/g, showdown2.helper.escapeCharactersCallback);
        text2 = text2.replace(tableRgx, parseTable);
        text2 = text2.replace(singeColTblRgx, parseTable);
        text2 = globals.converter._dispatch("tables.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("underline", function(text2, options, globals) {
        "use strict";
        if (!options.underline) {
          return text2;
        }
        text2 = globals.converter._dispatch("underline.before", text2, options, globals);
        if (options.literalMidWordUnderscores) {
          text2 = text2.replace(/\b___(\S[\s\S]*?)___\b/g, function(wm, txt) {
            return "<u>" + txt + "</u>";
          });
          text2 = text2.replace(/\b__(\S[\s\S]*?)__\b/g, function(wm, txt) {
            return "<u>" + txt + "</u>";
          });
        } else {
          text2 = text2.replace(/___(\S[\s\S]*?)___/g, function(wm, m) {
            return /\S$/.test(m) ? "<u>" + m + "</u>" : wm;
          });
          text2 = text2.replace(/__(\S[\s\S]*?)__/g, function(wm, m) {
            return /\S$/.test(m) ? "<u>" + m + "</u>" : wm;
          });
        }
        text2 = text2.replace(/(_)/g, showdown2.helper.escapeCharactersCallback);
        text2 = globals.converter._dispatch("underline.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("unescapeSpecialChars", function(text2, options, globals) {
        "use strict";
        text2 = globals.converter._dispatch("unescapeSpecialChars.before", text2, options, globals);
        text2 = text2.replace(/¨E(\d+)E/g, function(wholeMatch, m1) {
          var charCodeToReplace = parseInt(m1);
          return String.fromCharCode(charCodeToReplace);
        });
        text2 = globals.converter._dispatch("unescapeSpecialChars.after", text2, options, globals);
        return text2;
      });
      showdown2.subParser("makeMarkdown.blockquote", function(node, globals) {
        "use strict";
        var txt = "";
        if (node.hasChildNodes()) {
          var children = node.childNodes, childrenLength = children.length;
          for (var i = 0; i < childrenLength; ++i) {
            var innerTxt = showdown2.subParser("makeMarkdown.node")(children[i], globals);
            if (innerTxt === "") {
              continue;
            }
            txt += innerTxt;
          }
        }
        txt = txt.trim();
        txt = "> " + txt.split("\n").join("\n> ");
        return txt;
      });
      showdown2.subParser("makeMarkdown.codeBlock", function(node, globals) {
        "use strict";
        var lang = node.getAttribute("language"), num = node.getAttribute("precodenum");
        return "```" + lang + "\n" + globals.preList[num] + "\n```";
      });
      showdown2.subParser("makeMarkdown.codeSpan", function(node) {
        "use strict";
        return "`" + node.innerHTML + "`";
      });
      showdown2.subParser("makeMarkdown.emphasis", function(node, globals) {
        "use strict";
        var txt = "";
        if (node.hasChildNodes()) {
          txt += "*";
          var children = node.childNodes, childrenLength = children.length;
          for (var i = 0; i < childrenLength; ++i) {
            txt += showdown2.subParser("makeMarkdown.node")(children[i], globals);
          }
          txt += "*";
        }
        return txt;
      });
      showdown2.subParser("makeMarkdown.header", function(node, globals, headerLevel) {
        "use strict";
        var headerMark = new Array(headerLevel + 1).join("#"), txt = "";
        if (node.hasChildNodes()) {
          txt = headerMark + " ";
          var children = node.childNodes, childrenLength = children.length;
          for (var i = 0; i < childrenLength; ++i) {
            txt += showdown2.subParser("makeMarkdown.node")(children[i], globals);
          }
        }
        return txt;
      });
      showdown2.subParser("makeMarkdown.hr", function() {
        "use strict";
        return "---";
      });
      showdown2.subParser("makeMarkdown.image", function(node) {
        "use strict";
        var txt = "";
        if (node.hasAttribute("src")) {
          txt += "![" + node.getAttribute("alt") + "](";
          txt += "<" + node.getAttribute("src") + ">";
          if (node.hasAttribute("width") && node.hasAttribute("height")) {
            txt += " =" + node.getAttribute("width") + "x" + node.getAttribute("height");
          }
          if (node.hasAttribute("title")) {
            txt += ' "' + node.getAttribute("title") + '"';
          }
          txt += ")";
        }
        return txt;
      });
      showdown2.subParser("makeMarkdown.links", function(node, globals) {
        "use strict";
        var txt = "";
        if (node.hasChildNodes() && node.hasAttribute("href")) {
          var children = node.childNodes, childrenLength = children.length;
          txt = "[";
          for (var i = 0; i < childrenLength; ++i) {
            txt += showdown2.subParser("makeMarkdown.node")(children[i], globals);
          }
          txt += "](";
          txt += "<" + node.getAttribute("href") + ">";
          if (node.hasAttribute("title")) {
            txt += ' "' + node.getAttribute("title") + '"';
          }
          txt += ")";
        }
        return txt;
      });
      showdown2.subParser("makeMarkdown.list", function(node, globals, type) {
        "use strict";
        var txt = "";
        if (!node.hasChildNodes()) {
          return "";
        }
        var listItems = node.childNodes, listItemsLenght = listItems.length, listNum = node.getAttribute("start") || 1;
        for (var i = 0; i < listItemsLenght; ++i) {
          if (typeof listItems[i].tagName === "undefined" || listItems[i].tagName.toLowerCase() !== "li") {
            continue;
          }
          var bullet = "";
          if (type === "ol") {
            bullet = listNum.toString() + ". ";
          } else {
            bullet = "- ";
          }
          txt += bullet + showdown2.subParser("makeMarkdown.listItem")(listItems[i], globals);
          ++listNum;
        }
        txt += "\n<!-- -->\n";
        return txt.trim();
      });
      showdown2.subParser("makeMarkdown.listItem", function(node, globals) {
        "use strict";
        var listItemTxt = "";
        var children = node.childNodes, childrenLenght = children.length;
        for (var i = 0; i < childrenLenght; ++i) {
          listItemTxt += showdown2.subParser("makeMarkdown.node")(children[i], globals);
        }
        if (!/\n$/.test(listItemTxt)) {
          listItemTxt += "\n";
        } else {
          listItemTxt = listItemTxt.split("\n").join("\n    ").replace(/^ {4}$/gm, "").replace(/\n\n+/g, "\n\n");
        }
        return listItemTxt;
      });
      showdown2.subParser("makeMarkdown.node", function(node, globals, spansOnly) {
        "use strict";
        spansOnly = spansOnly || false;
        var txt = "";
        if (node.nodeType === 3) {
          return showdown2.subParser("makeMarkdown.txt")(node, globals);
        }
        if (node.nodeType === 8) {
          return "<!--" + node.data + "-->\n\n";
        }
        if (node.nodeType !== 1) {
          return "";
        }
        var tagName = node.tagName.toLowerCase();
        switch (tagName) {
          //
          // BLOCKS
          //
          case "h1":
            if (!spansOnly) {
              txt = showdown2.subParser("makeMarkdown.header")(node, globals, 1) + "\n\n";
            }
            break;
          case "h2":
            if (!spansOnly) {
              txt = showdown2.subParser("makeMarkdown.header")(node, globals, 2) + "\n\n";
            }
            break;
          case "h3":
            if (!spansOnly) {
              txt = showdown2.subParser("makeMarkdown.header")(node, globals, 3) + "\n\n";
            }
            break;
          case "h4":
            if (!spansOnly) {
              txt = showdown2.subParser("makeMarkdown.header")(node, globals, 4) + "\n\n";
            }
            break;
          case "h5":
            if (!spansOnly) {
              txt = showdown2.subParser("makeMarkdown.header")(node, globals, 5) + "\n\n";
            }
            break;
          case "h6":
            if (!spansOnly) {
              txt = showdown2.subParser("makeMarkdown.header")(node, globals, 6) + "\n\n";
            }
            break;
          case "p":
            if (!spansOnly) {
              txt = showdown2.subParser("makeMarkdown.paragraph")(node, globals) + "\n\n";
            }
            break;
          case "blockquote":
            if (!spansOnly) {
              txt = showdown2.subParser("makeMarkdown.blockquote")(node, globals) + "\n\n";
            }
            break;
          case "hr":
            if (!spansOnly) {
              txt = showdown2.subParser("makeMarkdown.hr")(node, globals) + "\n\n";
            }
            break;
          case "ol":
            if (!spansOnly) {
              txt = showdown2.subParser("makeMarkdown.list")(node, globals, "ol") + "\n\n";
            }
            break;
          case "ul":
            if (!spansOnly) {
              txt = showdown2.subParser("makeMarkdown.list")(node, globals, "ul") + "\n\n";
            }
            break;
          case "precode":
            if (!spansOnly) {
              txt = showdown2.subParser("makeMarkdown.codeBlock")(node, globals) + "\n\n";
            }
            break;
          case "pre":
            if (!spansOnly) {
              txt = showdown2.subParser("makeMarkdown.pre")(node, globals) + "\n\n";
            }
            break;
          case "table":
            if (!spansOnly) {
              txt = showdown2.subParser("makeMarkdown.table")(node, globals) + "\n\n";
            }
            break;
          //
          // SPANS
          //
          case "code":
            txt = showdown2.subParser("makeMarkdown.codeSpan")(node, globals);
            break;
          case "em":
          case "i":
            txt = showdown2.subParser("makeMarkdown.emphasis")(node, globals);
            break;
          case "strong":
          case "b":
            txt = showdown2.subParser("makeMarkdown.strong")(node, globals);
            break;
          case "del":
            txt = showdown2.subParser("makeMarkdown.strikethrough")(node, globals);
            break;
          case "a":
            txt = showdown2.subParser("makeMarkdown.links")(node, globals);
            break;
          case "img":
            txt = showdown2.subParser("makeMarkdown.image")(node, globals);
            break;
          default:
            txt = node.outerHTML + "\n\n";
        }
        return txt;
      });
      showdown2.subParser("makeMarkdown.paragraph", function(node, globals) {
        "use strict";
        var txt = "";
        if (node.hasChildNodes()) {
          var children = node.childNodes, childrenLength = children.length;
          for (var i = 0; i < childrenLength; ++i) {
            txt += showdown2.subParser("makeMarkdown.node")(children[i], globals);
          }
        }
        txt = txt.trim();
        return txt;
      });
      showdown2.subParser("makeMarkdown.pre", function(node, globals) {
        "use strict";
        var num = node.getAttribute("prenum");
        return "<pre>" + globals.preList[num] + "</pre>";
      });
      showdown2.subParser("makeMarkdown.strikethrough", function(node, globals) {
        "use strict";
        var txt = "";
        if (node.hasChildNodes()) {
          txt += "~~";
          var children = node.childNodes, childrenLength = children.length;
          for (var i = 0; i < childrenLength; ++i) {
            txt += showdown2.subParser("makeMarkdown.node")(children[i], globals);
          }
          txt += "~~";
        }
        return txt;
      });
      showdown2.subParser("makeMarkdown.strong", function(node, globals) {
        "use strict";
        var txt = "";
        if (node.hasChildNodes()) {
          txt += "**";
          var children = node.childNodes, childrenLength = children.length;
          for (var i = 0; i < childrenLength; ++i) {
            txt += showdown2.subParser("makeMarkdown.node")(children[i], globals);
          }
          txt += "**";
        }
        return txt;
      });
      showdown2.subParser("makeMarkdown.table", function(node, globals) {
        "use strict";
        var txt = "", tableArray = [[], []], headings = node.querySelectorAll("thead>tr>th"), rows = node.querySelectorAll("tbody>tr"), i, ii;
        for (i = 0; i < headings.length; ++i) {
          var headContent = showdown2.subParser("makeMarkdown.tableCell")(headings[i], globals), allign = "---";
          if (headings[i].hasAttribute("style")) {
            var style = headings[i].getAttribute("style").toLowerCase().replace(/\s/g, "");
            switch (style) {
              case "text-align:left;":
                allign = ":---";
                break;
              case "text-align:right;":
                allign = "---:";
                break;
              case "text-align:center;":
                allign = ":---:";
                break;
            }
          }
          tableArray[0][i] = headContent.trim();
          tableArray[1][i] = allign;
        }
        for (i = 0; i < rows.length; ++i) {
          var r = tableArray.push([]) - 1, cols = rows[i].getElementsByTagName("td");
          for (ii = 0; ii < headings.length; ++ii) {
            var cellContent = " ";
            if (typeof cols[ii] !== "undefined") {
              cellContent = showdown2.subParser("makeMarkdown.tableCell")(cols[ii], globals);
            }
            tableArray[r].push(cellContent);
          }
        }
        var cellSpacesCount = 3;
        for (i = 0; i < tableArray.length; ++i) {
          for (ii = 0; ii < tableArray[i].length; ++ii) {
            var strLen = tableArray[i][ii].length;
            if (strLen > cellSpacesCount) {
              cellSpacesCount = strLen;
            }
          }
        }
        for (i = 0; i < tableArray.length; ++i) {
          for (ii = 0; ii < tableArray[i].length; ++ii) {
            if (i === 1) {
              if (tableArray[i][ii].slice(-1) === ":") {
                tableArray[i][ii] = showdown2.helper.padEnd(tableArray[i][ii].slice(-1), cellSpacesCount - 1, "-") + ":";
              } else {
                tableArray[i][ii] = showdown2.helper.padEnd(tableArray[i][ii], cellSpacesCount, "-");
              }
            } else {
              tableArray[i][ii] = showdown2.helper.padEnd(tableArray[i][ii], cellSpacesCount);
            }
          }
          txt += "| " + tableArray[i].join(" | ") + " |\n";
        }
        return txt.trim();
      });
      showdown2.subParser("makeMarkdown.tableCell", function(node, globals) {
        "use strict";
        var txt = "";
        if (!node.hasChildNodes()) {
          return "";
        }
        var children = node.childNodes, childrenLength = children.length;
        for (var i = 0; i < childrenLength; ++i) {
          txt += showdown2.subParser("makeMarkdown.node")(children[i], globals, true);
        }
        return txt.trim();
      });
      showdown2.subParser("makeMarkdown.txt", function(node) {
        "use strict";
        var txt = node.nodeValue;
        txt = txt.replace(/ +/g, " ");
        txt = txt.replace(/¨NBSP;/g, " ");
        txt = showdown2.helper.unescapeHTMLEntities(txt);
        txt = txt.replace(/([*_~|`])/g, "\\$1");
        txt = txt.replace(/^(\s*)>/g, "\\$1>");
        txt = txt.replace(/^#/gm, "\\#");
        txt = txt.replace(/^(\s*)([-=]{3,})(\s*)$/, "$1\\$2$3");
        txt = txt.replace(/^( {0,3}\d+)\./gm, "$1\\.");
        txt = txt.replace(/^( {0,3})([+-])/gm, "$1\\$2");
        txt = txt.replace(/]([\s]*)\(/g, "\\]$1\\(");
        txt = txt.replace(/^ {0,3}\[([\S \t]*?)]:/gm, "\\[$1]:");
        return txt;
      });
      var root = this;
      if (typeof define === "function" && define.amd) {
        define(function() {
          "use strict";
          return showdown2;
        });
      } else if (typeof module2 !== "undefined" && module2.exports) {
        module2.exports = showdown2;
      } else {
        root.showdown = showdown2;
      }
    }).call(exports);
  }
});

// packages/client/src/index.js
var index_exports = {};
__export(index_exports, {
  PanelHeader: () => PanelHeader,
  apply: () => apply2,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react15 = require("react");

// packages/ui-settings/src/locale-contract.js
var DEFAULT_UI_LOCALE = "zh-CN";
var UI_LOCALES = Object.freeze([
  Object.freeze({ id: "zh-CN", nativeName: "\u7B80\u4F53\u4E2D\u6587" }),
  Object.freeze({ id: "en", nativeName: "English" })
]);
var SUPPORTED_UI_LOCALES = Object.freeze(UI_LOCALES.map((locale) => locale.id));
function isSupportedUiLocale(value) {
  return typeof value === "string" && SUPPORTED_UI_LOCALES.includes(value);
}

// packages/identity.js
var PLUGIN_ID = "pmp-dsh-tavern";
var API_ROOT = `/${PLUGIN_ID}/api`;
var API_V1 = `${API_ROOT}/v1`;
var API_V2 = `${API_ROOT}/v2`;
var LEGACY_API_ROOT = "/dsh-tavern/api";
var PROFILE_SECTION = `${PLUGIN_ID}:profile`;
var CLIENT_REFRESH_EVENT = `${PLUGIN_ID}:refresh`;
var CHROME_SERVICE_NAME = "pmpDshTavernChrome";
var CLIENT_UI_SETTINGS_EVENT = `${PLUGIN_ID}:ui-settings`;
var identityConstants = Object.freeze({
  pluginId: PLUGIN_ID,
  apiRoot: API_ROOT,
  apiV1: API_V1,
  apiV2: API_V2,
  chromeServiceName: CHROME_SERVICE_NAME,
  legacyApiRoot: LEGACY_API_ROOT,
  profileSection: PROFILE_SECTION,
  clientRefreshEvent: CLIENT_REFRESH_EVENT,
  clientUiSettingsEvent: CLIENT_UI_SETTINGS_EVENT
});

// packages/client/src/i18n/catalogs/zh-CN.js
var zh_CN_default = Object.freeze({
  "common.unavailable": "\u754C\u9762\u6587\u672C\u6682\u4E0D\u53EF\u7528",
  "common.loading": "\u52A0\u8F7D\u4E2D\u2026",
  "common.none": "\u65E0",
  "common.unknown": "\u672A\u77E5",
  "common.unknownAuthor": "\u672A\u77E5\u4F5C\u8005",
  "common.refresh": "\u5237\u65B0",
  "common.delete": "\u5220\u9664",
  "common.save": "\u4FDD\u5B58",
  "common.saveChanges": "\u4FDD\u5B58\u4FEE\u6539",
  "common.saved": "\u5DF2\u4FDD\u5B58",
  "common.reload": "\u91CD\u65B0\u8F7D\u5165",
  "common.working": "\u5904\u7406\u4E2D\u2026",
  "common.enabled": "\u5DF2\u542F\u7528",
  "common.disabled": "\u5DF2\u7981\u7528",
  "common.bound": "\u5DF2\u7ED1\u5B9A",
  "common.unbound": "\u672A\u7ED1\u5B9A",
  "common.planned": "\u89C4\u5212\u4E2D",
  "common.listSeparator": "\u3001",
  "common.name": "\u540D\u79F0",
  "common.role": "\u89D2\u8272",
  "common.content": "\u5185\u5BB9",
  "common.exportJson": "\u5BFC\u51FA JSON",
  "common.importJson": "\u5BFC\u5165 JSON",
  "common.enable": "\u542F\u7528",
  "panel.close": "\u5173\u95ED{title}\u4FA7\u8FB9\u680F",
  "nav.preset": "\u9884\u8BBE",
  "nav.character": "\u89D2\u8272\u5361",
  "nav.worldBook": "\u4E16\u754C\u4E66",
  "nav.user": "\u7528\u6237",
  "nav.sessionTemplate": "\u65B0\u4F1A\u8BDD",
  "nav.settings": "\u754C\u9762\u8BBE\u7F6E",
  "nav.preset.empty": "\u672A\u9009\u62E9\u9884\u8BBE",
  "nav.character.empty": "\u672A\u7ED1\u5B9A\u89D2\u8272",
  "nav.worldBook.empty": "\u672A\u7ED1\u5B9A\u4E16\u754C\u4E66",
  "nav.user.empty": "\u672A\u7ED1\u5B9A\u7528\u6237",
  "nav.sessionTemplate.empty": "\u5F53\u524D\u8BBE\u7F6E\u6216\u914D\u7F6E\u6A21\u677F",
  "nav.settings.empty": "\u8BED\u8A00\u3001\u7F29\u653E\u3001\u9ED8\u8BA4 RP \u5DE5\u4F5C\u533A\u3001RP \u8DDF\u968F\u4E0E\u63D0\u793A\u8BCD",
  "nav.regex": "\u663E\u793A\u6B63\u5219",
  "nav.regex.empty": "\u4EC5\u7528\u4E8E\u9B54\u4E38\u663E\u793A\u7684\u89C4\u5219",
  "regex.title": "\u663E\u793A\u6B63\u5219",
  "regex.displayOnlyNote": "\u8FD9\u4E9B\u89C4\u5219\u53EA\u6539\u53D8\u9B54\u4E38\u6E32\u67D3\u548C\u9759\u6001 HTML\uFF0C\u4E0D\u4F1A\u6539\u5199\u5386\u53F2\u3001\u65F6\u95F4\u7EBF\u6570\u636E\u6216\u53D1\u9001\u7ED9 AI \u7684\u8BF7\u6C42\u3002\u5BFC\u5165\u89C4\u5219\u7684\u5F00\u5173\u6309\u539F\u6837\u4FDD\u7559\u3002",
  "regex.scopes": "\u6B63\u5219\u4F5C\u7528\u57DF",
  "regex.scope.global": "\u5168\u5C40",
  "regex.scope.preset": "\u9884\u8BBE\u7ED1\u5B9A",
  "regex.scope.character": "\u89D2\u8272\u5361\u7ED1\u5B9A",
  "regex.noPreset": "\u5F53\u524D\u672A\u9009\u62E9\u9884\u8BBE\uFF1B\u9884\u8BBE\u4F5C\u7528\u57DF\u7684\u65B0\u89C4\u5219\u9700\u8981\u586B\u5199\u8D44\u6E90 ID \u540E\u624D\u80FD\u5339\u914D\u3002",
  "regex.noCharacter": "\u5F53\u524D\u672A\u7ED1\u5B9A\u89D2\u8272\u5361\uFF1B\u89D2\u8272\u5361\u4F5C\u7528\u57DF\u7684\u65B0\u89C4\u5219\u9700\u8981\u586B\u5199\u8D44\u6E90 ID \u540E\u624D\u80FD\u5339\u914D\u3002",
  "regex.add": "\u65B0\u5EFA\u89C4\u5219",
  "regex.emptyScope": "\u6B64\u4F5C\u7528\u57DF\u6682\u65E0\u89C4\u5219\u3002",
  "regex.enabled": "\u4F7F\u7528\u6B64\u89C4\u5219",
  "regex.name": "\u89C4\u5219\u540D\u79F0",
  "regex.unnamed": "\u672A\u547D\u540D\u89C4\u5219",
  "regex.newRule": "\u65B0\u6B63\u5219",
  "regex.find": "\u67E5\u627E\u8868\u8FBE\u5F0F",
  "regex.replace": "\u66FF\u6362\u5185\u5BB9",
  "regex.flags": "\u6807\u5FD7",
  "regex.target": "\u6E32\u67D3\u6D88\u606F",
  "regex.target.assistant": "\u52A9\u624B",
  "regex.target.user": "\u7528\u6237",
  "regex.target.both": "\u4E24\u8005",
  "regex.scope": "\u4F5C\u7528\u57DF",
  "regex.resourceId": "\u8D44\u6E90 ID",
  "regex.loaded": "\u5DF2\u52A0\u8F7D {count} \u6761\u6B63\u5219",
  "regex.saved": "\u5DF2\u4FDD\u5B58 {count} \u6761\u6B63\u5219",
  "regex.imported": "\u5DF2\u5BFC\u5165\u5E76\u4FDD\u5B58 {count} \u6761\u6B63\u5219",
  "regex.confirmReload": "\u653E\u5F03\u672A\u4FDD\u5B58\u7684\u6B63\u5219\u4FEE\u6539\u5E76\u91CD\u65B0\u8F7D\u5165\uFF1F",
  "regex.confirmClose": "\u5173\u95ED\u5E76\u653E\u5F03\u672A\u4FDD\u5B58\u7684\u6B63\u5219\u4FEE\u6539\uFF1F",
  "regex.sourceOwnedDisplay": "\u6B64\u89C4\u5219\u5B58\u50A8\u5728\u5F53\u524D\u7ED1\u5B9A\u8D44\u6E90\u4E2D\uFF1B\u4FDD\u5B58\u66F4\u6539\u4F1A\u5199\u56DE\u539F\u9884\u8BBE\u6216\u89D2\u8272\u5361\u3002",
  "regex.sourceOwnedPromptOnly": "\u6B64\u89C4\u5219\u5B58\u50A8\u5728\u5F53\u524D\u7ED1\u5B9A\u8D44\u6E90\u4E2D\uFF0C\u4F46\u53EA\u7528\u4E8E\u63D0\u793A\u8BCD\u3001\u4E0D\u53C2\u4E0E\u9B54\u4E38\u663E\u793A\uFF1B\u4FDD\u5B58\u66F4\u6539\u4F1A\u5199\u56DE\u539F\u9884\u8BBE\u6216\u89D2\u8272\u5361\u3002",
  "nav.session.none": "\u65E0\u4F1A\u8BDD",
  "nav.syncFailed": "\u72B6\u6001\u540C\u6B65\u5931\u8D25\uFF1A{message}",
  "nav.menuTitle": "Tavern \xB7 {session}",
  "nav.itemTitleBound": "{label}\uFF1A{title}\uFF08{state}\uFF09",
  "nav.itemTitle": "{label}\uFF1A{title}",
  "nav.itemAriaBound": "{label}\uFF0C{title}\uFF0C{state}",
  "nav.itemAria": "{label}\uFF0C{title}",
  "nav.bookCount": "{count} \u672C",
  "nav.launcher": "\u62D6\u52A8\u53EF\u79FB\u52A8\uFF1B\u5DE6\u952E\u5C55\u5F00\u9762\u677F\uFF1B\u53F3\u952E\u5207\u6362\u524D\u7AEF\u663E\u793A\u6A21\u5F0F",
  "chrome.switchToPlay": "\u5207\u6362\u5230\u81EA\u5B9A\u4E49\u524D\u7AEF\u6A21\u5F0F",
  "chrome.switchToNative": "\u5207\u6362\u5230 DSH \u539F\u751F\u6A21\u5F0F",
  "chrome.currentPlay": "\u5F53\u524D\uFF1A\u9B54\u4E38",
  "chrome.currentNative": "\u5F53\u524D\uFF1ADSH \u539F\u751F",
  "play.sidebar.loading": "\u6B63\u5728\u8BFB\u53D6\u89D2\u8272\u626E\u6F14\u5DE5\u4F5C\u533A\u2026",
  "play.sidebar.workspaceMissing": "\u5C1A\u672A\u9009\u62E9\u89D2\u8272\u626E\u6F14\u5DE5\u4F5C\u533A\uFF1B\u7075\u73E0\u6A21\u5F0F\u4E2D\u7684\u539F\u751F\u4F1A\u8BDD\u4ECD\u53EF\u6B63\u5E38\u4F7F\u7528\u3002",
  "play.sidebar.selectWorkspace": "\u5C06 {name} \u8BBE\u4E3A\u89D2\u8272\u626E\u6F14\u5DE5\u4F5C\u533A",
  "play.sidebar.systemWorkspaceConfirm": "{path} \u4F4D\u4E8E\u7CFB\u7EDF\u76D8\uFF0C\u4ECD\u8981\u5C06\u5176\u8BBE\u4E3A\u89D2\u8272\u626E\u6F14\u5DE5\u4F5C\u533A\u5417\uFF1F",
  "play.sidebar.newPlaythrough": "\u4E0E {name} \u65B0\u5F00\u5468\u76EE",
  "play.sidebar.noCharacters": "\u6682\u65E0\u89D2\u8272\u5361\u3002",
  "play.sidebar.noPlaythroughs": "\u5C1A\u672A\u521B\u5EFA\u5468\u76EE\u3002",
  "play.sidebar.unassigned": "\u672A\u5F52\u5165\u5468\u76EE",
  "play.sidebar.other": "\u666E\u901A / \u975E\u89D2\u8272\u626E\u6F14\u4F1A\u8BDD",
  "play.sidebar.otherEmpty": "\u6682\u65E0\u666E\u901A\u6216\u5916\u90E8\u4F1A\u8BDD\u3002",
  "play.notice.unbound": "\u672C\u4F1A\u8BDD\u6682\u672A\u7ED1\u5B9A\u89D2\u8272\u5361\uFF1B\u53EF\u4EE5\u6B63\u5E38\u5BF9\u8BDD\u3002\u7ED1\u5B9A\u89D2\u8272\u5361\u540E\u65B0\u5F00\u5468\u76EE\uFF0C\u624D\u4F1A\u542F\u7528\u5F00\u573A\u767D\u3001\u56DE\u590D\u5207\u6362\u3001\u663E\u793A\u7F16\u8F91\u4E0E\u5468\u76EE\u5BFC\u5165/\u5BFC\u51FA\u3002",
  "play.sidebar.sessionMissing": "\u8BE5\u5468\u76EE\u5728\u89D2\u8272\u626E\u6F14\u5DE5\u4F5C\u533A\u4E2D\u6CA1\u6709\u53EF\u7528\u4F1A\u8BDD\u3002",
  "play.sidebar.timelineErrors": "\u6709 {count} \u4E2A\u5468\u76EE\u7684 timeline \u65E0\u6CD5\u8BFB\u53D6\u3002",
  "play.chat.label": "RP\u89C6\u56FE",
  "play.chat.loading": "\u6B63\u5728\u8BFB\u53D6\u672C\u5468\u76EE\u8BB0\u5F55\u2026",
  "play.chat.empty": "\u672C\u5468\u76EE\u5C1A\u65E0\u5BF9\u8BDD\uFF0C\u8BF7\u5728\u4E0B\u65B9\u5F00\u59CB\u3002",
  "play.chat.thinking": "\u6B63\u5728\u601D\u8003\u2026",
  "play.chat.reasoning": "\u601D\u8003",
  "play.chat.previousGreeting": "\u4E0A\u4E00\u6761\u5F00\u573A\u767D",
  "play.chat.nextGreeting": "\u4E0B\u4E00\u6761\u5F00\u573A\u767D",
  "play.chat.hiddenNode": "\u8FD9\u4E00\u7EC4\u95EE\u7B54\u5DF2\u5728\u9B54\u4E38\u663E\u793A\u4E2D\u9690\u85CF\u3002",
  "play.chat.runningDisabled": "Agent \u8FD0\u884C\u4E2D\u4E0D\u53EF\u64CD\u4F5C",
  "play.chat.copy": "\u590D\u5236\u5F53\u524D\u663E\u793A\u56DE\u590D",
  "play.chat.copyUnavailable": "\u5F53\u524D\u73AF\u5883\u65E0\u6CD5\u8BBF\u95EE\u526A\u8D34\u677F\u3002",
  "play.chat.previousReply": "\u4E0A\u4E00\u6761\u5DF2\u6709\u56DE\u590D",
  "play.chat.nextReply": "\u4E0B\u4E00\u6761\u5DF2\u6709\u56DE\u590D",
  "play.chat.noOtherReply": "\u6CA1\u6709\u5176\u4ED6\u5DF2\u6709\u56DE\u590D",
  "play.chat.generateReply": "\u751F\u6210\u4E00\u6761\u65B0\u56DE\u590D",
  "play.chat.forkPlaythrough": "\u4ECE\u8FD9\u91CC\u5206\u652F\u4E3A\u65B0\u5468\u76EE",
  "play.chat.editDisplay": "\u4FEE\u6539\u663E\u793A\u6587\u5B57",
  "play.chat.editDisplayPrompt": "\u8F93\u5165\u66FF\u4EE3\u539F\u56DE\u590D\u7684\u663E\u793A\u6587\u5B57\uFF1A",
  "play.chat.restoreOriginal": "\u6062\u590D\u539F\u56DE\u590D",
  "play.chat.hideNode": "\u4ECE\u9B54\u4E38\u663E\u793A\u4E2D\u9690\u85CF\u672C\u7EC4\u95EE\u7B54",
  "play.chat.hideConfirm": "\u8981\u4ECE\u9B54\u4E38\u663E\u793A\u4E2D\u9690\u85CF\u672C\u7EC4\u95EE\u7B54\u5417\uFF1F\u539F\u59CB DSH \u6D88\u606F\u4E0D\u4F1A\u88AB\u5220\u9664\u3002",
  "play.chat.restoreNode": "\u6062\u590D\u663E\u793A\u672C\u7EC4\u95EE\u7B54",
  "play.io.menu": "\u5468\u76EE\u5BFC\u5165 / \u5BFC\u51FA",
  "play.io.rename": "\u91CD\u547D\u540D\u5468\u76EE",
  "play.io.renamePrompt": "\u8F93\u5165\u65B0\u7684\u5468\u76EE\u540D\u79F0\uFF1A",
  "play.io.renameInvalid": "\u5468\u76EE\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A\uFF0C\u4E14\u4E0D\u80FD\u8D85\u8FC7 120 \u4E2A\u5B57\u7B26\u3002",
  "play.io.exportHtml": "\u5BFC\u51FA\u9759\u6001 HTML",
  "play.io.exportSt": "\u5BFC\u51FA SillyTavern JSONL",
  "play.io.exportBundle": "\u5BFC\u51FA portable bundle",
  "play.io.import": "\u5BFC\u5165\u5E76\u65B0\u5F00 session",
  "play.io.importUnavailable": "\u540E\u7AEF\u5C1A\u672A\u63D0\u4F9B\u907F\u514D\u4F2A\u9020 DSH \u5386\u53F2\u6240\u9700\u7684\u4E00\u6B21\u6027 import-context reference\uFF0C\u56E0\u6B64\u6682\u4E0D\u5F00\u653E\u5BFC\u5165\u3002",
  "play.import.bind": "\u5BFC\u5165\u5916\u90E8\u8BB0\u5F55",
  "play.import.replace": "\u6362\u7ED1",
  "play.import.unbind": "\u89E3\u7ED1",
  "play.import.bound": "\u5DF2\u7ED1\u5B9A\u5916\u90E8\u5BFC\u5165\u8BB0\u5F55",
  "play.import.lastQa": "\u5916\u90E8\u5BFC\u5165\u8BB0\u5F55 \xB7 \u6700\u540E\u4E00\u8F6E",
  "play.import.unbindConfirm": "\u89E3\u7ED1\u5F53\u524D\u5916\u90E8\u5BFC\u5165\u8BB0\u5F55\uFF1F\u8BB0\u5F55\u6587\u4EF6\u4F1A\u4FDD\u7559\uFF0C\u4F46\u672C\u5468\u76EE\u4E0D\u518D\u663E\u793A\u6216\u53D1\u9001\u8BE5\u4E0A\u4E0B\u6587\u3002",
  "settings.menu": "\u754C\u9762\u8BBE\u7F6E",
  "settings.title": "Tavern \u754C\u9762\u8BBE\u7F6E",
  "settings.language": "\u754C\u9762\u8BED\u8A00",
  "settings.language.zh": "\u7B80\u4F53\u4E2D\u6587",
  "settings.language.en": "English",
  "settings.scale": "Tavern UI \u7F29\u653E",
  "settings.scale.help": "\u4EC5\u7F29\u653E Tavern \u60AC\u6D6E\u5165\u53E3\u3001\u8D44\u6E90\u9762\u677F\u548C Trace\uFF0C\u4E0D\u5F71\u54CD DSH \u4E3B\u754C\u9762\u3002",
  "settings.currentScale": "\u5F53\u524D\u7F29\u653E\uFF1A{scale}%",
  "settings.reset": "\u6062\u590D\u9ED8\u8BA4",
  "settings.saving": "\u6B63\u5728\u4FDD\u5B58\u8BBE\u7F6E\u2026",
  "settings.saved": "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u5E76\u5C06\u5728\u5237\u65B0\u548C\u4F1A\u8BDD\u5207\u6362\u540E\u4FDD\u6301\u3002",
  "settings.loadError": "\u65E0\u6CD5\u8BFB\u53D6\u754C\u9762\u8BBE\u7F6E\uFF1A{message}",
  "settings.saveError": "\u65E0\u6CD5\u4FDD\u5B58\u754C\u9762\u8BBE\u7F6E\uFF1A{message}",
  "settings.close": "\u5173\u95ED\u754C\u9762\u8BBE\u7F6E\u4FA7\u8FB9\u680F",
  "settings.rpFollow": "\u7ED1\u5B9A\u89D2\u8272\u5361\u65F6\u81EA\u52A8\u8FDB\u5165 RP \u6A21\u5F0F",
  "settings.rpFollow.help": "\u5F00\u542F\u540E\uFF0C\u7ED1\u5B9A\u89D2\u8272\u5361\u4F1A\u8FDB\u5165\u89D2\u8272\u626E\u6F14\u5E76\u628A\u6587\u4EF6\u6C99\u7BB1\u9489\u5728\u53EA\u8BFB\u3002\u5199\u5165\u3001\u7EC8\u7AEF\u3001\u5916\u8FDE\u548C\u5DE5\u4F5C\u533A\u5916\u6216\u673A\u5BC6\u6587\u4EF6\u8BFB\u53D6\u4F1A\u88AB\u62E6\u4F4F\u5E76\u4E2D\u65AD\u8BE5 agent\uFF1B\u5B50 agent \u53EF\u4EE5\u6D3E\uFF0C\u4F46\u540C\u6837\u53D7\u9650\u5236\u3002\u804A\u5929\u680F\u6539\u6743\u9650\u65E0\u6548\u3002\u8981\u505A\u8FD9\u4E9B\u4E8B\u5FC5\u987B\u5148\u5173\u6389 RP\uFF08\u6216 /rp off\uFF09\u3002",
  "settings.rpWorkspace": "\u9ED8\u8BA4 RP \u5DE5\u4F5C\u533A",
  "settings.rpWorkspace.help": "\u65B0\u5EFA\u5468\u76EE\u9ED8\u8BA4\u4F7F\u7528\u6B64\u5DE5\u4F5C\u533A\u3002\u66F4\u6539\u53EA\u5F71\u54CD\u4E4B\u540E\u7684\u9ED8\u8BA4\u843D\u70B9\u548C RP \u4F1A\u8BDD\u5206\u7C7B\uFF0C\u4E0D\u79FB\u52A8\u5DF2\u6709\u4F1A\u8BDD\u3001\u76EE\u5F55\u6216\u5468\u76EE\u3002",
  "settings.rpWorkspace.unselected": "\u5C1A\u672A\u9009\u62E9 RP \u5DE5\u4F5C\u533A",
  "settings.rpWorkspace.unavailable": "\u5F53\u524D\u7ED1\u5B9A\u5DF2\u4E0D\u5728 DSH \u5DE5\u4F5C\u533A\u5217\u8868\u4E2D\uFF1A{path}",
  "settings.rpWorkspace.none": "\u6CA1\u6709\u53EF\u7528\u7684 DSH \u5DE5\u4F5C\u533A",
  "settings.rpWorkspace.verifyError": "\u9ED8\u8BA4 RP \u5DE5\u4F5C\u533A\u5DF2\u66F4\u65B0\uFF0C\u4F46\u56DE\u8BFB\u9A8C\u8BC1\u5931\u8D25\uFF1A{message}",
  "settings.rpPolicy": "RP \u6A21\u5F0F\u63D0\u793A\u8BCD\uFF08rp:policy\uFF09",
  "settings.rpPolicy.help": "\u53EF\u9009\u3002DSH \u4E0D\u80FD\u6309\u6BB5\u52A0\u6743\uFF0C\u8EAB\u4EFD\u548C\u6587\u98CE\u5E94\u5199\u5728\u9884\u8BBE\u6216\u89D2\u8272\u5361\u91CC\u3002\u9ED8\u8BA4\u53EA\u8BF4\u660E\u9AD8\u98CE\u9669\u64CD\u4F5C\u88AB\u9501\u5B9A\u3002\u7559\u7A7A\u5219\u4E0D\u9644\u52A0\u8FD9\u6BB5\u63D0\u793A\uFF0C\u9501\u5B9A\u4ECD\u7136\u6709\u6548\u3002\u5E95\u90E8\u7684\u300C\u6062\u590D\u9ED8\u8BA4\u300D\u53EA\u91CD\u7F6E\u8BED\u8A00\u3001\u7F29\u653E\u548C\u7ED1\u5361\u8DDF\u968F\u3002",
  "settings.rpPolicy.placeholder": "\u7559\u7A7A\uFF1A\u53EA\u542F\u7528\u53EA\u8BFB\u6C99\u7BB1\uFF0C\u4E0D\u9644\u52A0 RP \u63D0\u793A\u8BCD",
  "settings.rpPolicy.save": "\u4FDD\u5B58 RP \u63D0\u793A\u8BCD",
  "settings.rpPolicy.reset": "\u6062\u590D\u9ED8\u8BA4 RP \u63D0\u793A\u8BCD",
  "settings.rpPolicy.saved": "RP \u63D0\u793A\u8BCD\u5DF2\u4FDD\u5B58\uFF0C\u4E0B\u4E00\u8F6E\u8BF7\u6C42\u751F\u6548\u3002",
  "rp.block.body": "Agent \u6B63\u5728\u8FDB\u884C\u5199\u5165\u7B49\u9AD8\u98CE\u9669\u64CD\u4F5C\u3002\u5982\u679C\u4F60\u77E5\u9053\u4F60\u5728\u505A\u4EC0\u4E48\uFF0C\u8BF7\u5173\u95ED RP \u6A21\u5F0F\u540E\u91CD\u8BD5\u3002",
  "rp.block.dismiss": "\u77E5\u9053\u4E86",
  "preset.title": "Tavern \u9884\u8BBE",
  "preset.active": "\u25CF \u5DF2\u542F\u7528",
  "preset.importStJson": "\u5BFC\u5165 ST JSON",
  "preset.create": "\u521B\u5EFA\u9884\u8BBE",
  "preset.browse": "\u6D4F\u89C8\u9884\u8BBE",
  "preset.libraryEmpty": "\u9884\u8BBE\u5E93\u4E3A\u7A7A",
  "preset.unboundNote": "\u5F53\u524D\u4F1A\u8BDD\u672A\u7ED1\u5B9A\u9884\u8BBE\u3002",
  "preset.currentSessionBound": "\u5F53\u524D\u4F1A\u8BDD\u7ED1\u5B9A\uFF1A{name}\u3002",
  "preset.browsingUnbound": "\u6B63\u5728\u6D4F\u89C8\u201C{name}\u201D\uFF1B\u5B83\u5C1A\u672A\u7ED1\u5B9A\u5230\u5F53\u524D\u4F1A\u8BDD\u3002",
  "preset.bind": "\u7ED1\u5B9A\u5230\u5F53\u524D\u4F1A\u8BDD",
  "preset.bindUpdate": "\u66F4\u65B0\u4F1A\u8BDD\u7ED1\u5B9A",
  "preset.unbind": "\u89E3\u9664\u5F53\u524D\u4F1A\u8BDD\u7ED1\u5B9A",
  "preset.loading": "\u6B63\u5728\u52A0\u8F7D\u9884\u8BBE\u2026",
  "preset.emptyHint": "\u8BF7\u9009\u62E9\u6216\u521B\u5EFA\u9884\u8BBE\u4EE5\u5F00\u59CB\u914D\u7F6E\u3002",
  "preset.basicSettings": "\u57FA\u672C\u8BBE\u7F6E",
  "preset.name": "\u9884\u8BBE\u540D\u79F0",
  "preset.temperature": "Temperature",
  "preset.maxTokens": "Max tokens",
  "preset.reasoningEffort": "Reasoning effort",
  "preset.modelDefault": "\u8DDF\u968F\u6A21\u578B\u9ED8\u8BA4",
  "preset.effort.low": "Low",
  "preset.effort.medium": "Medium",
  "preset.effort.high": "High",
  "preset.effort.xhigh": "Extra high",
  "preset.advancedShow": "\u5C55\u5F00\u9AD8\u7EA7\u8BBE\u7F6E",
  "preset.advancedHide": "\u6536\u8D77\u9AD8\u7EA7\u8BBE\u7F6E",
  "preset.advancedNote": "\u8FD9\u4E9B\u5B57\u6BB5\u4F1A\u88AB\u5B8C\u6574\u4FDD\u5B58\uFF1Bdsh 0.1.0 \u5F53\u524D\u8BF7\u6C42\u534F\u8BAE\u672A\u66B4\u9732\u7684\u53C2\u6570\u4E0D\u4F1A\u5F3A\u884C\u4E0B\u53D1\u7ED9\u9002\u914D\u5668\u3002",
  "preset.systemPrompt": "DSH \u7CFB\u7EDF\u63D0\u793A\u8BCD",
  "preset.systemAppend": "\u4FDD\u7559 DSH \u7CFB\u7EDF\u63D0\u793A\u8BCD\uFF0C\u5E76\u8FFD\u52A0\u9884\u8BBE\uFF08\u63A8\u8350\uFF09",
  "preset.systemReplace": "\u4EC5\u4F7F\u7528\u9884\u8BBE\uFF0C\u79FB\u9664 DSH \u7CFB\u7EDF\u6BB5\uFF08\u9AD8\u7EA7\uFF09",
  "preset.replaceWarning": "\u8B66\u544A\uFF1A\u8FD9\u4F1A\u79FB\u9664\u6A21\u578B\u53EF\u89C1\u7684 Harness \u8EAB\u4EFD\u3001Agent persona \u548C\u5DE5\u5177\u8BF4\u660E\uFF0C\u53EF\u80FD\u7834\u574F\u5DE5\u5177\u8C03\u7528\u6216\u7ED3\u6784\u5316\u8F93\u51FA\uFF1B\u6C99\u7BB1\u4E0E\u5BA1\u6279\u7B49\u6267\u884C\u5C42\u5B89\u5168\u4ECD\u7136\u6709\u6548\u3002",
  "preset.prompts": "\u63D0\u793A\u8BCD ({count})",
  "preset.addPrompt": "\uFF0B \u6DFB\u52A0",
  "preset.dropHere": "\u677E\u5F00\u540E\u653E\u7F6E\u4E8E\u6B64",
  "preset.dragOrder": "\u62D6\u62FD\u6392\u5217\u987A\u5E8F",
  "preset.dragNamed": "\u62D6\u62FD\u201C{name}\u201D\u6392\u5217\u987A\u5E8F",
  "preset.markerHint": "ST marker \u4E0D\u4F1A\u4F5C\u4E3A\u72EC\u7ACB\u63D0\u793A\u8BCD\u6CE8\u5165",
  "preset.enablePrompt": "\u542F\u7528\u63D0\u793A\u8BCD",
  "preset.role.system": "System",
  "preset.role.user": "User",
  "preset.role.assistant": "Assistant",
  "preset.sampling.topP": "Top P",
  "preset.sampling.topK": "Top K",
  "preset.sampling.topA": "Top A",
  "preset.sampling.minP": "Min P",
  "preset.sampling.frequencyPenalty": "Frequency penalty",
  "preset.sampling.presencePenalty": "Presence penalty",
  "preset.sampling.repetitionPenalty": "Repetition penalty",
  "preset.sampling.seed": "Seed",
  "preset.defaultName": "\u65B0\u9884\u8BBE",
  "preset.defaultPromptName": "\u65B0\u63D0\u793A\u8BCD",
  "preset.confirmDelete": "\u5220\u9664\u9884\u8BBE\u201C{name}\u201D\uFF1F",
  "preset.confirmHistoricalSwitch": "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u6709\u5386\u53F2\u3002\u66F4\u6362\u9884\u8BBE\u53EA\u5F71\u54CD\u540E\u7EED\u8BF7\u6C42\uFF0C\u4E0D\u4F1A\u91CD\u5199\u5DF2\u6709\u6D88\u606F\uFF1B\u7EE7\u7EED\u5417\uFF1F",
  "preset.status.syncing": "\u6B63\u5728\u540C\u6B65\u5F53\u524D\u4F1A\u8BDD\u7684\u9884\u8BBE\u72B6\u6001\u2026",
  "preset.status.loaded": "\u9884\u8BBE\u5DF2\u52A0\u8F7D",
  "preset.status.refreshed": "\u9884\u8BBE\u72B6\u6001\u5DF2\u5237\u65B0",
  "preset.status.detailsLoaded": "\u9884\u8BBE\u8BE6\u60C5\u5DF2\u52A0\u8F7D\uFF1B\u4F1A\u8BDD\u7ED1\u5B9A\u5C1A\u672A\u6539\u53D8",
  "preset.status.bound": "\u9884\u8BBE\u5DF2\u7ED1\u5B9A\uFF1B\u5F53\u524D\u4F1A\u8BDD\u7684\u4E0B\u4E00\u6B21\u8BF7\u6C42\u5C06\u4F7F\u7528\u5B83",
  "preset.status.unbound": "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u89E3\u9664\u9884\u8BBE\u7ED1\u5B9A",
  "preset.status.created": "\u9884\u8BBE\u5DF2\u521B\u5EFA\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5F53\u524D\u4F1A\u8BDD",
  "preset.status.imported": "ST \u9884\u8BBE\u5DF2\u5BFC\u5165\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5F53\u524D\u4F1A\u8BDD",
  "preset.status.saved": "\u9884\u8BBE\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF1B\u5DF2\u7ED1\u5B9A\u5B83\u7684\u4F1A\u8BDD\u5C06\u5728\u540E\u7EED\u8BF7\u6C42\u4F7F\u7528\u65B0\u5185\u5BB9",
  "preset.status.deleted": "\u9884\u8BBE\u5DF2\u5220\u9664",
  "preset.error.needSession": "\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u518D\u7ED1\u5B9A\u9884\u8BBE",
  "preset.error.needPreset": "\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u9884\u8BBE",
  "preset.error.noSessionToUnbind": "\u5F53\u524D\u6CA1\u6709\u53EF\u89E3\u9664\u7ED1\u5B9A\u7684\u4F1A\u8BDD",
  "character.title": "Tavern \u89D2\u8272\u5361",
  "character.import": "\u5BFC\u5165 JSON / PNG",
  "character.create": "\u65B0\u5EFA\u89D2\u8272\u5361",
  "character.defaultName": "\u65B0\u89D2\u8272",
  "character.browse": "\u6D4F\u89C8\u89D2\u8272\u5E93",
  "character.libraryEmpty": "\u89D2\u8272\u5E93\u4E3A\u7A7A",
  "character.sessionBinding": "\u5F53\u524D\u4F1A\u8BDD\uFF1A{session}\uFF1B\u7ED1\u5B9A\uFF1A{name}",
  "character.loading": "\u6B63\u5728\u52A0\u8F7D\u89D2\u8272\u5E93\u2026",
  "character.emptyHint": "\u65B0\u5EFA\u4E00\u5F20\u7A7A\u767D\u89D2\u8272\u5361\uFF0C\u6216\u5BFC\u5165\u5408\u6210/\u81EA\u6709\u6388\u6743\u7684 SillyTavern \u89D2\u8272\u5361\u3002",
  "character.imageAlt": "{name} \u89D2\u8272\u5361\u56FE\u7247",
  "character.greeting": "\u5F00\u573A\u53C2\u8003",
  "character.greeting.default": "\u9ED8\u8BA4\u5F00\u573A",
  "character.greeting.defaultEmpty": "\u9ED8\u8BA4\u5F00\u573A\uFF08\u7A7A\uFF09",
  "character.greeting.alternate": "\u5907\u9009\u5F00\u573A {index}",
  "character.preferSystem": "\u5141\u8BB8 loader \u4F18\u5148\u91C7\u7528\u5361\u5185 system_prompt",
  "character.preferPostHistory": "\u5141\u8BB8 loader \u91C7\u7528 post_history_instructions\uFF08\u5B9E\u9645\u4F4D\u7F6E\u7531 loader \u51B3\u5B9A\uFF09",
  "character.bind": "\u7ED1\u5B9A\u5230\u5F53\u524D\u4F1A\u8BDD",
  "character.bindUpdate": "\u66F4\u65B0\u4F1A\u8BDD\u7ED1\u5B9A\uFF08\u672A\u4FDD\u5B58\uFF09",
  "character.bindingUnsaved": "\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\uFF0C\u5F53\u524D\u5F00\u573A\u9009\u62E9\u5C1A\u672A\u5E94\u7528\u5230\u4F1A\u8BDD\u3002",
  "character.bindingApplied": "\u9762\u677F\u663E\u793A\u7684\u5F00\u573A\u9009\u62E9\u5DF2\u5E94\u7528\u5230\u5F53\u524D\u4F1A\u8BDD\u3002",
  "character.bindingAppliedButton": "\u5F53\u524D\u7ED1\u5B9A\u5DF2\u5E94\u7528",
  "character.unbind": "\u89E3\u9664\u7ED1\u5B9A",
  "character.rpMode": "RP \u6A21\u5F0F\uFF08\u9AD8\u98CE\u9669\u9501\u5B9A\uFF09",
  "character.rpMode.help": "\u5F00\u542F\u540E\u6587\u4EF6\u6C99\u7BB1\u9489\u5728\u53EA\u8BFB\uFF1B\u5199\u5165\u3001\u7EC8\u7AEF\u3001\u5916\u8FDE\u548C\u5DE5\u4F5C\u533A\u5916\u6216\u673A\u5BC6\u6587\u4EF6\u8BFB\u53D6\u4F1A\u62D2\u7EDD\u5E76\u4E2D\u65AD\u8BE5 agent\u3002\u5B50 agent \u53EF\u4EE5\u6D3E\uFF0C\u5B69\u5B50\u540C\u6837\u53D7\u9650\u5236\u3002\u5173\u6389\u672C\u5F00\u5173\u6216 /rp off \u540E\u624D\u80FD\u505A\u8FD9\u4E9B\u4E8B\u3002",
  "character.status.rpUpdated": "RP \u6A21\u5F0F\u5DF2\u66F4\u65B0",
  "character.moduleNote": "\u89D2\u8272\u5361\u6A21\u5757\u8D1F\u8D23\u4FDD\u5B58\u6807\u51C6\u5316\u8D44\u6E90\u548C\u4F1A\u8BDD\u9009\u62E9\uFF1B\u5B9E\u9645 system profile \u4E0E\u5185\u5D4C\u4E16\u754C\u4FE1\u606F\u5339\u914D\u7531 Tavern loader \u5728\u6BCF\u6B21\u8BF7\u6C42\u65F6\u7EDF\u4E00\u5904\u7406\uFF0C\u4E0D\u4F1A\u4F2A\u9020 assistant \u5386\u53F2\u3002",
  "character.field.creatorNotes": "Creator notes",
  "character.field.description": "Description",
  "character.field.personality": "Personality",
  "character.field.scenario": "Scenario",
  "character.field.greetingContent": "\u5F53\u524D\u5F00\u573A\u53C2\u8003\u5185\u5BB9",
  "character.field.messageExamples": "Message examples",
  "character.field.systemPrompt": "System prompt\uFF08\u7531 loader \u6309\u7ED1\u5B9A\u8BBE\u7F6E\u5904\u7406\uFF09",
  "character.field.postHistory": "Post-history instructions\uFF08\u7531 loader \u8FD1\u4F3C\u653E\u7F6E\uFF09",
  "character.embeddedBook": "\u5185\u5D4C character_book \u5DF2\u65E0\u635F\u4FDD\u7559\uFF08{count} \u6761\uFF09\uFF1B\u7ED1\u5B9A\u89D2\u8272\u540E\u7531 Tavern loader \u8C03\u7528\u4E16\u754C\u4FE1\u606F matcher\uFF0C\u89E3\u7ED1\u540E\u4E0D\u518D\u53C2\u4E0E\u540E\u7EED\u8BF7\u6C42\u3002",
  "character.warnings": "\u517C\u5BB9\u8B66\u544A ({count})",
  "character.unsupported": "\u9700\u8981 loader/\u5176\u4ED6\u6A21\u5757\u5904\u7406 ({count})",
  "character.unknownMacros": "\u672A\u77E5\u5B8F\uFF1A{names}",
  "character.exportPng": "\u5BFC\u51FA PNG",
  "character.saveResource": "\u4FDD\u5B58\u5B57\u6BB5\uFF08\u672A\u4FDD\u5B58\uFF09",
  "character.resourceSaved": "\u5B57\u6BB5\u5DF2\u4FDD\u5B58",
  "character.saveFirst": "\u8BF7\u5148\u4FDD\u5B58\u4FEE\u6539",
  "character.dirty": "\u5F53\u524D\u89D2\u8272\u5361\u5B57\u6BB5\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002",
  "character.savedNote": "\u5F53\u524D\u663E\u793A\u7684\u89D2\u8272\u5361\u5B57\u6BB5\u5747\u5DF2\u4FDD\u5B58\u3002",
  "character.field.nickname": "\u6635\u79F0",
  "character.field.creator": "\u4F5C\u8005",
  "character.field.characterVersion": "\u89D2\u8272\u7248\u672C",
  "character.field.tags": "\u6807\u7B7E",
  "character.tagsPlaceholder": "\u6807\u7B7E\u4E00, \u6807\u7B7E\u4E8C",
  "character.field.firstMessage": "\u9ED8\u8BA4\u5F00\u573A",
  "character.alternateGreetings": "\u5907\u9009\u5F00\u573A",
  "character.addGreeting": "\u6DFB\u52A0\u5907\u9009\u5F00\u573A",
  "character.delete": "\u5220\u9664\u89D2\u8272\u5361",
  "character.confirmDelete": "\u5220\u9664\u89D2\u8272\u5361\u201C{name}\u201D\uFF1F",
  "character.confirmHistoricalSwitch": "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u6709\u5386\u53F2\u3002\u66F4\u6362\u89D2\u8272\u53EA\u5F71\u54CD\u540E\u7EED\u8BF7\u6C42\uFF0C\u4E0D\u4F1A\u91CD\u5199\u5DF2\u6709\u6D88\u606F\uFF1B\u7EE7\u7EED\u5417\uFF1F",
  "character.confirmCloseDirty": "\u5F53\u524D\u89D2\u8272\u5361\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u4ECD\u7136\u5173\u95ED\u5417\uFF1F",
  "character.confirmDiscardForSwitch": "\u5F53\u524D\u89D2\u8272\u5361\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u4ECD\u7136\u5207\u6362\u5417\uFF1F",
  "character.confirmDiscardRefresh": "\u5F53\u524D\u89D2\u8272\u5361\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u4ECD\u7136\u5237\u65B0\u5417\uFF1F",
  "character.confirmDiscardForCreate": "\u5F53\u524D\u89D2\u8272\u5361\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u653E\u5F03\u4FEE\u6539\u5E76\u65B0\u5EFA\u89D2\u8272\u5361\u5417\uFF1F",
  "character.status.loaded": "\u89D2\u8272\u5E93\u5DF2\u52A0\u8F7D",
  "character.status.refreshed": "\u89D2\u8272\u72B6\u6001\u5DF2\u5237\u65B0",
  "character.status.libraryRefreshed": "\u89D2\u8272\u5E93\u5DF2\u5237\u65B0",
  "character.status.imported": "\u89D2\u8272\u5361\u5DF2\u5BFC\u5165\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5230\u4F1A\u8BDD",
  "character.status.created": "\u5DF2\u521B\u5EFA\u7A7A\u767D\u89D2\u8272\u5361\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5230\u4F1A\u8BDD",
  "character.status.bound": "\u89D2\u8272\u9009\u62E9\u5DF2\u4FDD\u5B58\uFF1B\u5B9E\u9645\u5BF9\u8BDD\u52A0\u8F7D\u7531 Tavern loader \u7EDF\u4E00\u5904\u7406",
  "character.status.unbound": "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u89E3\u9664\u89D2\u8272\u7ED1\u5B9A",
  "character.status.deleted": "\u89D2\u8272\u5361\u5DF2\u5220\u9664\uFF0C\u76F8\u5173\u4F1A\u8BDD\u7ED1\u5B9A\u5DF2\u6E05\u9664",
  "character.status.detailsLoaded": "\u89D2\u8272\u8BE6\u60C5\u5DF2\u52A0\u8F7D",
  "character.status.saved": "\u89D2\u8272\u5361\u5DF2\u4FDD\u5B58\uFF1B\u5DF2\u7ED1\u5B9A\u4F1A\u8BDD\u7684\u4E0B\u4E00\u6B21\u8BF7\u6C42\u4F1A\u4F7F\u7528\u65B0\u5B57\u6BB5",
  "character.status.skippedRefresh": "\u6709\u672A\u4FDD\u5B58\u7684\u89D2\u8272\u5361\u4FEE\u6539\uFF0C\u5DF2\u8DF3\u8FC7\u5237\u65B0",
  "character.error.needSession": "\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u518D\u7ED1\u5B9A\u89D2\u8272",
  "character.error.noSessionToUnbind": "\u5F53\u524D\u6CA1\u6709\u53EF\u89E3\u7ED1\u7684\u4F1A\u8BDD",
  "character.error.saveFirst": "\u8BF7\u5148\u4FDD\u5B58\u89D2\u8272\u5361\u5B57\u6BB5\u518D\u7ED1\u5B9A",
  "world.title": "\u4E16\u754C\u4FE1\u606F\uFF08World Book\uFF09",
  "world.lorebookTitle": "\u4E16\u754C\u4FE1\u606F\uFF08Lorebook\uFF09",
  "world.importJson": "\u5BFC\u5165 JSON",
  "world.create": "\u65B0\u5EFA\u4E16\u754C\u4E66",
  "world.defaultName": "Untitled World Book",
  "world.standalone": "\u72EC\u7ACB\u4E16\u754C\u4E66",
  "world.sessionBinding": "\u5F53\u524D\u4F1A\u8BDD\u7ED1\u5B9A",
  "world.libraryEmpty": "\u72EC\u7ACB\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u4E3A\u7A7A\u3002",
  "world.bindingUnsaved": "\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\uFF0C\u5F53\u524D\u52FE\u9009\u5C1A\u672A\u5E94\u7528\u5230\u4F1A\u8BDD\u3002",
  "world.bindingApplied": "\u9762\u677F\u663E\u793A\u7684\u7ED1\u5B9A\u5DF2\u5E94\u7528\u5230\u5F53\u524D\u4F1A\u8BDD\u3002",
  "world.applyBinding": "\u5E94\u7528\u4F1A\u8BDD\u7ED1\u5B9A\uFF08\u672A\u4FDD\u5B58\uFF09",
  "world.bindingAppliedButton": "\u5F53\u524D\u7ED1\u5B9A\u5DF2\u5E94\u7528",
  "world.clearPending": "\u6E05\u7A7A\u5F85\u5E94\u7528\u9009\u62E9",
  "world.browse": "\u6D4F\u89C8\u72EC\u7ACB\u4E16\u754C\u4E66",
  "world.catalogEmpty": "\u8D44\u6E90\u5E93\u4E3A\u7A7A",
  "world.bookName": "\u4E16\u754C\u4E66\u540D\u79F0",
  "world.addEntry": "\u65B0\u589E\u6761\u76EE",
  "world.deleteStandalone": "\u5220\u9664\u72EC\u7ACB\u4E66",
  "world.characterBound": "\u89D2\u8272\u5361\u7ED1\u5B9A\u7684\u4E16\u754C\u4E66",
  "world.embeddedTitle": "\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66",
  "world.embeddedInfoTitle": "\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4FE1\u606F",
  "world.addEmbeddedEntry": "\u65B0\u589E\u5185\u5D4C\u6761\u76EE",
  "world.saveEmbedded": "\u4FDD\u5B58\u5185\u5D4C\u4E66",
  "world.embeddedSaved": "\u5185\u5D4C\u4E66\u5DF2\u4FDD\u5B58",
  "world.matcherNote": "\u5B9E\u9645\u6FC0\u6D3B\u3001\u6392\u5E8F\u3001\u6982\u7387\u548C\u9884\u7B97\u7531\u5171\u4EAB matcher \u786E\u5B9A\uFF1B\u6700\u7EC8\u6CE8\u5165\u4ECD\u7531 Tavern loader \u7EDF\u4E00\u5B8C\u6210\u3002\u5F53\u524D\u626B\u63CF\u4F1A\u628A\u672C\u6B65\u9AA4 claimed \u8F93\u5165\u4E0E\u6301\u4E45\u5386\u53F2\u7EC4\u5408\u6210\u4E34\u65F6\u4E0A\u4E0B\u6587\uFF0C\u56E0\u6B64\u5355\u6B65\u9AA4\u4F1A\u8BDD\u4E5F\u80FD\u5728\u9996\u6B21\u8BF7\u6C42\u89E6\u53D1\u5173\u952E\u8BCD\u3002",
  "world.infoIntro": "\u5F53\u524D\u4F1A\u8BDD\uFF1A{session}\u3002SillyTavern \u7684\u6B63\u5F0F\u529F\u80FD\u540D\u662F World Info\uFF0CLorebook \u662F\u5B98\u65B9\u8BA4\u53EF\u7684\u5E38\u7528\u522B\u540D\u3002",
  "world.infoLoaded": "\u5DF2\u8F7D\u5165 {count} \u4E2A\u6761\u76EE\u3002",
  "world.infoDirty": "\u6709\u5C1A\u672A\u4FDD\u5B58\u7684\u6761\u76EE\u4FEE\u6539\u3002",
  "world.infoReading": "\u6B63\u5728\u8BFB\u53D6\u4E16\u754C\u4FE1\u606F\u2026",
  "world.infoEmpty": "\u5F53\u524D\u4F1A\u8BDD\u6CA1\u6709\u53EF\u7528\u4E16\u754C\u4FE1\u606F\u3002\u7ED1\u5B9A\u542B character_book \u7684\u89D2\u8272\u5361\u540E\uFF0C\u5176\u5185\u5D4C\u6761\u76EE\u4F1A\u81EA\u52A8\u7531 loader \u5339\u914D\uFF1B\u89E3\u7ED1\u89D2\u8272\u4F1A\u540C\u65F6\u79FB\u9664\u8BE5\u6765\u6E90\u3002",
  "world.infoMeta": "\u89D2\u8272\u5361\u5185\u5D4C \xB7 {count} \u6761\u3002\u6298\u53E0\u6807\u9898\u76F4\u63A5\u663E\u793A\u8BE5\u6761\u76EE\u7684\u89E6\u53D1\u65B9\u5F0F\uFF1B\u5C55\u5F00\u540E\u53EF\u7F16\u8F91\u5173\u952E\u8BCD\u3001\u903B\u8F91\u3001\u5185\u5BB9\u3001\u4F4D\u7F6E\u548C\u6392\u5E8F\u3002",
  "world.infoPendingIds": "\u5DF2\u9009\u62E9 {count} \u4E2A\u72EC\u7ACB\u4E16\u754C\u4FE1\u606F ID\uFF0C\u4F46\u72EC\u7ACB\u8D44\u6E90\u5E93/API \u5C1A\u672A\u63A5\u5165\uFF0C\u672C\u9636\u6BB5\u4E0D\u4F1A\u52A0\u8F7D\u8FD9\u4E9B ID\u3002",
  "world.infoSaveNote": "\u4FDD\u5B58\u4F1A\u66F4\u65B0\u89D2\u8272\u5361\u6587\u6863\u53CA\u5176 JSON/PNG \u5BFC\u51FA\u3002matcher \u4F1A\u5728\u9996\u6B21\u8BF7\u6C42\u7EC4\u88C5\u524D\u628A\u672C\u6B65\u9AA4 claimed \u8F93\u5165\u4E0E Session \u5386\u53F2\u7EC4\u5408\u626B\u63CF\uFF0C\u4E0D\u4F1A\u5411\u5386\u53F2\u5199\u5165\u526F\u672C\u3002",
  "world.entry.untitled": "\u65B0\u6761\u76EE {id}",
  "world.entry.fallback": "\u6761\u76EE {id}",
  "world.entry.title": "\u6761\u76EE\u6807\u9898",
  "world.entry.nameNote": "\u6761\u76EE\u540D\u79F0 / \u5907\u6CE8",
  "world.entry.delete": "\u5220\u9664\u6761\u76EE",
  "world.entry.constant": "\u5E38\u9A7B",
  "world.entry.noKeywords": "\u65E0\u5173\u952E\u8BCD",
  "world.entry.noPrimaryKeys": "\u65E0\u4E3B\u5173\u952E\u8BCD",
  "world.entry.disabled": "\u5DF2\u7981\u7528",
  "world.entry.useSecondary": "\u4F7F\u7528\u9644\u52A0\u5173\u952E\u8BCD",
  "world.entry.caseSensitive": "\u533A\u5206\u5927\u5C0F\u5199",
  "world.entry.wholeWord": "\u5168\u8BCD\u5339\u914D",
  "world.entry.primaryKeys": "\u4E3B\u5173\u952E\u8BCD\uFF08\u652F\u6301\u4E2D\u6587\u3001\u82F1\u6587\u9017\u53F7\u5206\u9694\uFF09",
  "world.entry.secondaryKeys": "\u9644\u52A0\u5173\u952E\u8BCD\uFF08\u652F\u6301\u4E2D\u6587\u3001\u82F1\u6587\u9017\u53F7\u5206\u9694\uFF09",
  "world.entry.primaryKeysLines": "\u4E3B\u5173\u952E\u8BCD\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF1B\u4EFB\u4E00\u547D\u4E2D\uFF09",
  "world.entry.secondaryKeysLines": "\u9644\u52A0\u5173\u952E\u8BCD\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF09",
  "world.entry.secondaryLogic": "\u9644\u52A0\u5173\u952E\u8BCD\u903B\u8F91",
  "world.entry.secondaryLogicShort": "Secondary logic",
  "world.entry.body": "\u6B63\u6587",
  "world.entry.content": "\u6761\u76EE\u5185\u5BB9\uFF08\u89E6\u53D1\u540E\u6CE8\u5165 system profile\uFF09",
  "world.entry.position": "\u4F4D\u7F6E",
  "world.entry.insertionPosition": "\u63D2\u5165\u4F4D\u7F6E",
  "world.entry.order": "\u987A\u5E8F\uFF08\u9AD8\u503C\u4F18\u5148\uFF09",
  "world.entry.sortWeight": "\u6392\u5E8F\u6743\u91CD",
  "world.entry.probability": "\u6982\u7387\uFF080\u2013100\uFF09",
  "world.entry.trigger": "\u5173\u952E\u8BCD\uFF1A{keys}",
  "world.entry.triggerWithSecondary": "\u5173\u952E\u8BCD\uFF1A{keys} \xB7 {logic}\uFF1A{secondary}",
  "world.logic.andAny": "AND ANY\uFF1A\u547D\u4E2D\u4EFB\u4E00",
  "world.logic.andAll": "AND ALL\uFF1A\u547D\u4E2D\u5168\u90E8",
  "world.logic.notAny": "NOT ANY\uFF1A\u4E0D\u80FD\u547D\u4E2D\u4EFB\u4E00",
  "world.logic.notAll": "NOT ALL\uFF1A\u4E0D\u80FD\u5168\u90E8\u547D\u4E2D",
  "world.position.beforeCharacter": "\u89D2\u8272\u5B9A\u4E49\u4E4B\u524D",
  "world.position.afterCharacter": "\u89D2\u8272\u5B9A\u4E49\u4E4B\u540E",
  "world.position.beforeAuthor": "\u4F5C\u8005\u6CE8\u91CA\u4E4B\u524D\uFF08\u8FD1\u4F3C\uFF09",
  "world.position.afterAuthor": "\u4F5C\u8005\u6CE8\u91CA\u4E4B\u540E\uFF08\u8FD1\u4F3C\uFF09",
  "world.position.atDepth": "\u6307\u5B9A\u6DF1\u5EA6\uFF08\u8FD1\u4F3C\uFF09",
  "world.position.beforeExamples": "\u793A\u4F8B\u6D88\u606F\u4E4B\u524D\uFF08\u8FD1\u4F3C\uFF09",
  "world.position.afterExamples": "\u793A\u4F8B\u6D88\u606F\u4E4B\u540E\uFF08\u8FD1\u4F3C\uFF09",
  "world.position.outlet": "Outlet\uFF08\u5F53\u524D\u4E0D\u6CE8\u5165\uFF09",
  "world.currentSession": "\u5F53\u524D\u4F1A\u8BDD\uFF1A{session}\u3002\u53EF\u7ED1\u5B9A\u96F6\u672C\u3001\u4E00\u672C\u6216\u591A\u672C\u72EC\u7ACB\u4E16\u754C\u4E66\uFF1B\u7ED1\u5B9A\u987A\u5E8F\u4FDD\u6301\u7A33\u5B9A\u3002",
  "world.catalogItem": "{name}\uFF08{count} \u6761\uFF09",
  "world.documentMeta": "{count} \u6761 \xB7 \u672A\u77E5\u5B57\u6BB5\u5728\u4FDD\u5B58\u548C\u5BFC\u51FA\u65F6\u7A33\u5B9A\u4FDD\u7559",
  "world.user.title": "\u7528\u6237\u7ED1\u5B9A\u7684\u4E16\u754C\u4E66",
  "world.user.current": "\u5F53\u524D\u7528\u6237\uFF1A{name}",
  "world.user.none": "\u5F53\u524D\u4F1A\u8BDD\u672A\u7ED1\u5B9A\u7528\u6237\uFF0C\u56E0\u6B64\u6CA1\u6709\u7528\u6237\u6765\u6E90\u7684\u4E16\u754C\u4E66\u3002",
  "world.user.empty": "\u5F53\u524D\u7528\u6237\u6CA1\u6709\u7ED1\u5B9A\u72EC\u7ACB\u4E16\u754C\u4E66\u3002",
  "world.user.libraryEmpty": "\u72EC\u7ACB\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u4E3A\u7A7A\u3002\u8BF7\u5148\u521B\u5EFA\u6216\u5BFC\u5165\u4E16\u754C\u4E66\u3002",
  "world.user.unsaved": "\u7528\u6237\u4E16\u754C\u4E66\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\uFF1B\u5F53\u524D\u52FE\u9009\u5C1A\u672A\u5E94\u7528\u3002",
  "world.user.saved": "\u5F53\u524D\u663E\u793A\u7684\u7528\u6237\u4E16\u754C\u4E66\u7ED1\u5B9A\u5DF2\u4FDD\u5B58\u5E76\u5E94\u7528\u3002",
  "world.user.order": "\u6709\u6548\u7EC4\u5408\u987A\u5E8F\u4E3A\uFF1A\u5F53\u524D\u4F1A\u8BDD\u663E\u5F0F\u4E16\u754C\u4E66\u5728\u524D\uFF0C\u7528\u6237\u7ED1\u5B9A\u4E16\u754C\u4E66\u968F\u540E\uFF1B\u91CD\u590D\u8D44\u6E90\u53EA\u6267\u884C\u4E00\u6B21\u3002",
  "world.user.duplicate": "\u4E0E\u4F1A\u8BDD\u7ED1\u5B9A\u91CD\u590D\uFF0C\u5DF2\u53BB\u91CD",
  "world.user.appended": "\u7531\u7528\u6237\u7ED1\u5B9A\u8FFD\u52A0",
  "world.user.pendingAdd": "\u5F85\u6DFB\u52A0",
  "world.user.pendingRemove": "\u5F85\u79FB\u9664",
  "world.user.save": "\u4FDD\u5B58\u7528\u6237\u7ED1\u5B9A\uFF08\u672A\u4FDD\u5B58\uFF09",
  "world.user.saveApplied": "\u7528\u6237\u7ED1\u5B9A\u5DF2\u4FDD\u5B58",
  "world.user.clear": "\u6E05\u7A7A\u5F85\u4FDD\u5B58\u9009\u62E9",
  "world.user.saveSuccess": "\u7528\u6237\u7ED1\u5B9A\u7684\u4E16\u754C\u4E66\u5DF2\u4FDD\u5B58\uFF1B\u540E\u7EED\u8BF7\u6C42\u5C06\u4F7F\u7528\u65B0\u7EC4\u5408\u3002",
  "world.user.editContent": "\u7F16\u8F91\u5185\u5BB9",
  "world.user.editHint": "\u8FD9\u91CC\u4E0E\u7528\u6237\u9762\u677F\u7F16\u8F91\u540C\u4E00\u4EFD\u7ED1\u5B9A\u5173\u7CFB\uFF1B\u4EFB\u4E00\u5904\u4FDD\u5B58\u540E\uFF0C\u53E6\u4E00\u5904\u4F1A\u540C\u6B65\u5237\u65B0\u3002",
  "world.user.error.noUser": "\u5F53\u524D\u4F1A\u8BDD\u6CA1\u6709\u53EF\u7F16\u8F91\u4E16\u754C\u4E66\u5173\u7CFB\u7684\u7ED1\u5B9A\u7528\u6237",
  "world.embeddedMeta": "{count} \u6761\u3002\u5B83\u4E0E\u72EC\u7ACB\u4E66\u5171\u7528 matcher/loader\uFF1B\u5220\u9664\u72EC\u7ACB\u4E66\u4E0D\u4F1A\u4FEE\u6539\u6216\u89E3\u7ED1\u89D2\u8272\u5361\u5185\u5D4C\u4E66\u3002",
  "world.embeddedEmpty": "\u5F53\u524D\u4F1A\u8BDD\u6CA1\u6709\u89D2\u8272\u5361\u7ED1\u5B9A\u7684\u5185\u5D4C\u4E16\u754C\u4E66\u3002\u7ED1\u5B9A\u542B character_book \u7684\u89D2\u8272\u5361\u540E\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002",
  "world.diagnostics": "\u8FD0\u884C\u8BCA\u65AD\uFF08{count}\uFF09",
  "world.confirmDelete": "\u5220\u9664\u72EC\u7ACB\u4E16\u754C\u4E66\u201C{name}\u201D\uFF1F\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66\u4E0D\u4F1A\u53D7\u5230\u5F71\u54CD\u3002",
  "world.confirmDiscardChanges": "\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF1F",
  "world.confirmDeleteEntry": "\u5220\u9664\u8FD9\u4E2A\u4E16\u754C\u4E66\u6761\u76EE\uFF1F\u4FDD\u5B58\u540E\u751F\u6548\u3002",
  "world.confirmDeleteEmbeddedEntry": "\u5220\u9664\u8FD9\u4E2A\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66\u6761\u76EE\uFF1F\u4FDD\u5B58\u540E\u751F\u6548\u3002",
  "world.confirmDeleteInfoEntry": "\u5220\u9664\u8FD9\u4E2A\u4E16\u754C\u4FE1\u606F\u6761\u76EE\uFF1F\u4FDD\u5B58\u540E\u624D\u4F1A\u5199\u5165\u89D2\u8272\u5361\u526F\u672C\u3002",
  "world.confirmReloadInfo": "\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u6761\u76EE\u4FEE\u6539\u5E76\u91CD\u65B0\u8F7D\u5165\uFF1F",
  "world.status.loaded": "\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u5DF2\u52A0\u8F7D",
  "world.status.refreshed": "\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u5DF2\u5237\u65B0",
  "world.status.detailsLoaded": "\u4E16\u754C\u4E66\u8BE6\u60C5\u5DF2\u52A0\u8F7D",
  "world.status.created": "\u5DF2\u521B\u5EFA\u72EC\u7ACB\u4E16\u754C\u4E66\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5F53\u524D\u4F1A\u8BDD",
  "world.status.imported": "\u4E16\u754C\u4E66\u5DF2\u5BFC\u5165\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5F53\u524D\u4F1A\u8BDD",
  "world.status.saved": "\u4E16\u754C\u4E66\u4FEE\u6539\u5DF2\u6301\u4E45\u5316\uFF0C\u540E\u7EED\u8BF7\u6C42\u5C06\u4F7F\u7528\u65B0\u5185\u5BB9",
  "world.status.bindingSaved": "\u5F53\u524D\u4F1A\u8BDD\u7684\u4E16\u754C\u4E66\u7ED1\u5B9A\u5DF2\u4FDD\u5B58",
  "world.status.deleted": "\u72EC\u7ACB\u4E16\u754C\u4E66\u5DF2\u5220\u9664\uFF0C\u76F8\u5173\u4F1A\u8BDD\u7ED1\u5B9A\u5DF2\u6E05\u7406",
  "world.status.embeddedSaved": "\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66\u5DF2\u4FDD\u5B58\uFF0C\u540E\u7EED\u8BF7\u6C42\u5C06\u4F7F\u7528\u65B0\u5185\u5BB9",
  "world.error.needSession": "\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u518D\u7ED1\u5B9A\u4E16\u754C\u4E66",
  "user.title": "Tavern \u7528\u6237",
  "user.create": "\u65B0\u5EFA\u7528\u6237",
  "user.browse": "\u6D4F\u89C8\u7528\u6237\u8D44\u6E90",
  "user.libraryEmpty": "\u7528\u6237\u8D44\u6E90\u5E93\u4E3A\u7A7A",
  "user.sessionBinding": "\u5F53\u524D\u4F1A\u8BDD\uFF1A{session}\uFF1B\u7ED1\u5B9A\uFF1A{name}",
  "user.dirty": "\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\uFF1A{parts}\u3002",
  "user.dirty.name": "\u540D\u5B57/\u63CF\u8FF0",
  "user.dirty.binding": "\u7528\u6237\u4E16\u754C\u4E66\u7ED1\u5B9A",
  "user.savedNote": "\u5F53\u524D\u663E\u793A\u7684\u7528\u6237\u8D44\u6E90\u548C\u4E16\u754C\u4E66\u7ED1\u5B9A\u5747\u5DF2\u4FDD\u5B58\u3002",
  "user.loading": "\u6B63\u5728\u52A0\u8F7D\u7528\u6237\u8D44\u6E90\u2026",
  "user.emptyHint": "\u521B\u5EFA\u4E00\u4E2A\u53EA\u542B\u540D\u5B57\u548C\u63CF\u8FF0\u7684\u7528\u6237\u8D44\u6E90\u3002",
  "user.name": "\u540D\u5B57\uFF08\u7528\u4E8E {macro} \u5B8F\uFF09",
  "user.description": "\u63CF\u8FF0\uFF08\u8FDB\u5165 personaDescription marker\uFF1B\u7F3A marker \u65F6\u7531 loader \u7A33\u5B9A\u964D\u7EA7\uFF09",
  "user.saveResource": "\u4FDD\u5B58\u8D44\u6E90\uFF08\u672A\u4FDD\u5B58\uFF09",
  "user.resourceSaved": "\u8D44\u6E90\u5DF2\u4FDD\u5B58",
  "user.saveFirst": "\u8BF7\u5148\u4FDD\u5B58\u4FEE\u6539",
  "user.refreshBinding": "\u5237\u65B0\u4F1A\u8BDD\u7ED1\u5B9A",
  "user.bind": "\u7ED1\u5B9A\u5230\u5F53\u524D\u4F1A\u8BDD",
  "user.worldBooksTitle": "\u7528\u6237\u7ED1\u5B9A\u7684\u72EC\u7ACB\u4E16\u754C\u4E66",
  "user.worldBooksHint": "\u9009\u62E9\u8BE5\u7528\u6237\u65F6\uFF0Cloader \u4F1A\u81EA\u52A8\u7EC4\u5408\u8FD9\u91CC\u7684\u4E16\u754C\u4E66\u4E0E\u5F53\u524D\u4F1A\u8BDD\u663E\u5F0F\u9009\u62E9\u7684\u4E16\u754C\u4E66\uFF1B\u91CD\u590D\u7684\u540C\u4E00\u672C\u4E66\u53EA\u6267\u884C\u4E00\u6B21\u3002",
  "user.worldBooksLoading": "\u6B63\u5728\u52A0\u8F7D\u72EC\u7ACB\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u2026",
  "user.worldBooksEmpty": "\u72EC\u7ACB\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u4E3A\u7A7A\u3002\u8BF7\u5148\u5728\u4E16\u754C\u4E66\u9762\u677F\u521B\u5EFA\u6216\u5BFC\u5165\u3002",
  "user.saveWorldBooks": "\u4FDD\u5B58\u4E16\u754C\u4E66\u7ED1\u5B9A\uFF08\u672A\u4FDD\u5B58\uFF09",
  "user.worldBooksSaved": "\u4E16\u754C\u4E66\u7ED1\u5B9A\u5DF2\u4FDD\u5B58",
  "user.clearPending": "\u6E05\u7A7A\u5F85\u4FDD\u5B58\u9009\u62E9",
  "user.unbind": "\u89E3\u9664\u5F53\u524D\u4F1A\u8BDD\u7ED1\u5B9A",
  "user.identityNote": "\u7528\u6237\u8D44\u6E90\u6B63\u6587\u4ECD\u4E25\u683C\u53EA\u6709\u540D\u5B57\u548C\u63CF\u8FF0\uFF1B\u4E16\u754C\u4E66\u5173\u7CFB\u4FDD\u5B58\u5728 loader \u7684\u72EC\u7ACB\u7ED3\u6784\u5316\u7B56\u7565\u4E2D\u3002\u7528\u6237\u8D44\u6E90\u4E0D\u5305\u542B\u5934\u50CF\uFF0C\u4E5F\u4E0D\u4F1A\u8986\u76D6 DSH Agent \u8EAB\u4EFD\u3002",
  "user.delete": "\u5220\u9664\u7528\u6237",
  "user.defaultName": "\u65B0\u7528\u6237",
  "user.confirmDelete": "\u5220\u9664\u7528\u6237\u201C{name}\u201D\uFF1F\u6240\u6709\u4F1A\u8BDD\u4E2D\u7684\u7528\u6237\u9009\u62E9\u548C\u8BE5\u7528\u6237\u7684\u4E16\u754C\u4E66\u5173\u7CFB\u90FD\u4F1A\u6E05\u9664\u3002",
  "user.confirmDiscardForCreate": "\u5F53\u524D\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u653E\u5F03\u4FEE\u6539\u5E76\u65B0\u5EFA\u7528\u6237\u5417\uFF1F",
  "user.confirmDiscardForSwitch": "\u5F53\u524D\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u653E\u5F03\u4FEE\u6539\u5E76\u5207\u6362\u5417\uFF1F",
  "user.confirmHistoricalSwitch": "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u6709\u5386\u53F2\u3002\u5207\u6362\u7528\u6237\u53EA\u5F71\u54CD\u540E\u7EED\u8BF7\u6C42\uFF0C\u4E0D\u4F1A\u91CD\u5199\u5DF2\u6709\u6D88\u606F\uFF1B\u7EE7\u7EED\u5417\uFF1F",
  "user.confirmCloseDirty": "\u5F53\u524D\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u4ECD\u7136\u5173\u95ED\u5417\uFF1F",
  "user.confirmDiscardRefresh": "\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u4FEE\u6539\uFF1F",
  "user.status.loaded": "\u7528\u6237\u8D44\u6E90\u5DF2\u52A0\u8F7D",
  "user.status.refreshed": "\u7528\u6237\u8D44\u6E90\u5DF2\u5237\u65B0",
  "user.status.created": "\u7528\u6237\u8D44\u6E90\u5DF2\u521B\u5EFA\uFF1B\u4FDD\u5B58\u540D\u5B57\u548C\u63CF\u8FF0\u540E\u518D\u7ED1\u5B9A",
  "user.status.saved": "\u540D\u5B57\u548C\u63CF\u8FF0\u5DF2\u4FDD\u5B58\uFF1B\u5DF2\u7ED1\u5B9A\u4F1A\u8BDD\u7684\u4E0B\u4E00\u6B21\u8BF7\u6C42\u4F1A\u7ACB\u5373\u4F7F\u7528\u65B0\u5185\u5BB9",
  "user.status.bound": "\u7528\u6237\u5DF2\u7ED1\u5B9A\uFF1B\u5F53\u524D\u4F1A\u8BDD\u7684\u4E0B\u4E00\u6B21\u8BF7\u6C42\u4F1A\u4F7F\u7528\u8BE5\u540D\u5B57\u548C\u63CF\u8FF0",
  "user.status.unbound": "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u89E3\u9664\u7528\u6237\u7ED1\u5B9A",
  "user.status.deleted": "\u7528\u6237\u5DF2\u5220\u9664\uFF0C\u76F8\u5173\u4F1A\u8BDD\u7ED1\u5B9A\u5DF2\u6E05\u9664",
  "user.status.skippedRefresh": "\u68C0\u6D4B\u5230\u5176\u4ED6 Tavern \u8D44\u6E90\u53D8\u5316\uFF1B\u4E3A\u4FDD\u7559\u672C\u9762\u677F\u672A\u4FDD\u5B58\u4FEE\u6539\uFF0C\u672A\u81EA\u52A8\u5237\u65B0\u3002",
  "user.status.worldBooksSaved": "\u7528\u6237\u7ED1\u5B9A\u7684\u4E16\u754C\u4E66\u5DF2\u4FDD\u5B58\uFF1B\u9009\u62E9\u8BE5\u7528\u6237\u7684\u4F1A\u8BDD\u4F1A\u5728\u4E0B\u4E00\u6B21\u7EC4\u88C5\u65F6\u81EA\u52A8\u4F7F\u7528",
  "user.status.userLoaded": "\u7528\u6237\u8D44\u6E90\u548C\u4E16\u754C\u4E66\u7ED1\u5B9A\u5DF2\u52A0\u8F7D",
  "user.error.needSession": "\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u5E76\u9009\u62E9\u7528\u6237\u8D44\u6E90",
  "user.error.noSessionToUnbind": "\u5F53\u524D\u6CA1\u6709\u53EF\u89E3\u7ED1\u7684\u4F1A\u8BDD",
  "template.title": "\u65B0\u4F1A\u8BDD\u4E0E\u914D\u7F6E\u6A21\u677F",
  "template.startCurrent": "\u7EF4\u6301\u5F53\u524D Tavern \u8BBE\u7F6E\u65B0\u5F00\u5BF9\u8BDD",
  "template.inheritNote": "\u53EA\u7EE7\u627F preset\u3001\u89D2\u8272\u5361\u4E0E greeting/\u5F00\u5173\u3001\u7528\u6237\u548C\u72EC\u7ACB\u4E16\u754C\u4E66\u9009\u62E9\u3002DSH \u5386\u53F2\u3001Tavern Trace\u3001Inbox\u3001\u8FD0\u884C\u4E2D turn/step \u548C\u5176\u4ED6\u8FD0\u884C\u6001\u4E0D\u4F1A\u590D\u5236\u3002",
  "template.noWorkspace": "\u6CA1\u6709\u53EF\u7528\u7684 DSH \u76EE\u6807\u5DE5\u4F5C\u533A\u3002\u8BF7\u5148\u5728 DSH \u4FA7\u680F\u4E2D\u52A0\u5165\u6216\u6253\u5F00\u5DE5\u4F5C\u533A\u3002",
  "template.listTitle": "\u914D\u7F6E\u6A21\u677F\uFF08{count}\uFF09",
  "template.selected": "\u5DF2\u9009\u62E9\u6A21\u677F",
  "template.noneSelected": "\u672A\u9009\u62E9\u6A21\u677F",
  "template.name": "\u6A21\u677F\u540D\u79F0",
  "template.createFromCurrent": "\u7531\u5F53\u524D\u8BBE\u7F6E\u521B\u5EFA",
  "template.saveNameOnly": "\u4EC5\u4FDD\u5B58\u540D\u79F0",
  "template.updateFromCurrent": "\u7528\u5F53\u524D\u8BBE\u7F6E\u66F4\u65B0",
  "template.delete": "\u5220\u9664\u6A21\u677F",
  "template.unusable": "\u8BE5\u6A21\u677F\u6682\u4E0D\u53EF\u7528\u4E8E\u521B\u5EFA\uFF1A",
  "template.startFromTemplate": "\u6839\u636E\u6240\u9009\u6A21\u677F\u65B0\u5F00\u5E72\u51C0\u5BF9\u8BDD",
  "template.ready": "\u6A21\u677F\u4E0E\u65B0\u4F1A\u8BDD\u64CD\u4F5C\u5DF2\u5C31\u7EEA\u3002",
  "template.blankSessionNote": "DSH \u53EF\u80FD\u590D\u7528\u540C\u5DE5\u4F5C\u533A\u4E2D\u5DF2\u6709\u7684\u771F\u5B9E blank session\uFF1B\u8FD9\u662F\u5176\u516C\u5F00 New Session \u8BED\u4E49\u3002\u63D2\u4EF6\u4F1A\u5728\u5BFC\u822A\u524D\u539F\u5B50\u66FF\u6362\u8BE5 blank session \u7684 Tavern \u9009\u62E9\u3002",
  "template.preview.title": "\u4FDD\u5B58\u7684 Tavern \u914D\u7F6E",
  "template.preview.worldBooks": "\u72EC\u7ACB\u4E16\u754C\u4E66\uFF08\u6309\u7ED1\u5B9A\u987A\u5E8F\uFF09",
  "template.preview.greeting": "\u5F00\u573A\u5E8F\u53F7\uFF1A{value}",
  "template.preview.systemPrompt": "\u5361\u5185 system_prompt\uFF1A{value}",
  "template.preview.postHistory": "post_history_instructions\uFF1A{value}",
  "template.defaultName": "\u65B0\u914D\u7F6E\u6A21\u677F",
  "template.currentSettingsReminder": "\u6A21\u677F\u53EA\u80FD\u7528\u5F53\u524D\u4F1A\u8BDD\u7684 Tavern \u8BBE\u7F6E\u521B\u5EFA\u6216\u66F4\u65B0\u3002\u8BF7\u5728\u60AC\u6D6E\u7403\u7684\u9884\u8BBE\u3001\u89D2\u8272\u5361\u3001\u4E16\u754C\u4E66\u548C\u7528\u6237\u9762\u677F\u4E2D\u67E5\u770B\u6216\u4FEE\u6539\u5F53\u524D\u914D\u7F6E\uFF0C\u518D\u56DE\u5230\u8FD9\u91CC\u4FDD\u5B58\u3002",
  "template.confirmDelete": "\u5220\u9664\u914D\u7F6E\u6A21\u677F\u201C{name}\u201D\uFF1F\u8FD9\u4E0D\u4F1A\u5220\u9664\u4EFB\u4F55 DSH \u4F1A\u8BDD\u3002",
  "template.status.selected": "\u6A21\u677F\u9009\u62E9\u5DF2\u66F4\u65B0",
  "template.status.created": "\u5DF2\u521B\u5EFA\u6A21\u677F\uFF1A{name}",
  "template.status.renamed": "\u5DF2\u91CD\u547D\u540D\u6A21\u677F\uFF1A{name}",
  "template.status.updated": "\u5DF2\u7528\u5F53\u524D\u8BBE\u7F6E\u66F4\u65B0\u6A21\u677F\uFF1A{name}",
  "template.status.deleted": "\u6A21\u677F\u5DF2\u5220\u9664",
  "template.status.switched": "\u5DF2\u5207\u6362\u5230\u5E72\u51C0\u4F1A\u8BDD\uFF1A{id}",
  "template.error.needSessionToSave": "\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\uFF0C\u518D\u4FDD\u5B58\u5F53\u524D Tavern \u8BBE\u7F6E",
  "template.error.needTemplate": "\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u6A21\u677F",
  "template.error.needSessionAndTemplate": "\u8BF7\u5148\u6253\u5F00\u4F1A\u8BDD\u5E76\u9009\u62E9\u6A21\u677F",
  "template.error.needSourceSession": "\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u6765\u6E90\u4F1A\u8BDD",
  "template.error.needWorkspace": "\u5F53\u524D\u4F1A\u8BDD\u4E0D\u5C5E\u4E8E DSH \u5DE5\u4F5C\u533A\uFF1B\u8BF7\u5148\u628A\u4F1A\u8BDD\u52A0\u5165\u5DE5\u4F5C\u533A",
  "trace.title": "Tavern Trace",
  "trace.intro": "\u4E0E Conversation / Trajectory \u5E76\u5217\u7684 loader \u5BA1\u8BA1\u89C6\u56FE\u3002DSH request/header \u59CB\u7EC8\u662F\u6700\u7EC8\u53D1\u9001 system\u3001tools \u4E0E\u751F\u6548 config \u7684\u6743\u5A01\u3002",
  "trace.reading": "\u6B63\u5728\u8BFB\u53D6\u5BA1\u8BA1\u8BB0\u5F55\u2026",
  "trace.empty": "\u6B64\u4F1A\u8BDD\u8FD8\u6CA1\u6709 Tavern \u8BF7\u6C42\u5BA1\u8BA1\u8BB0\u5F55\u3002\u53D1\u9001\u4E0B\u4E00\u6761\u6D88\u606F\u540E\u518D\u67E5\u770B\u3002",
  "trace.privacy": "\u9690\u79C1\u8FB9\u754C\uFF1A\u8FD9\u91CC\u53EA\u4FDD\u5B58\u8D44\u6E90\u6458\u8981\u3001\u914D\u7F6E/\u547D\u4E2D\u5173\u952E\u8BCD\u3001\u51B3\u7B56\u539F\u56E0\u3001\u4F4D\u7F6E\u3001\u9884\u7B97\u548C SHA-256 \u6458\u8981\uFF1B\u4E0D\u4FDD\u5B58 preset/\u89D2\u8272/user/\u4E16\u754C\u4E66\u6B63\u6587\u3001\u5B8C\u6574 system\u3001\u804A\u5929\u5386\u53F2\u3001header \u5185\u5BB9\u6216 tool payload\u3002",
  "trace.unused": "\u672A\u4F7F\u7528",
  "trace.noSource": "\u672C\u8F6E\u6CA1\u6709\u53EF\u5BA1\u8BA1\u7684\u4E16\u754C\u4E66\u5339\u914D\u6765\u6E90\u3002",
  "trace.assembly": "\u7EC4\u5408\u4E0E\u63D2\u5165",
  "trace.assemblyMeta": "{section} \xB7 order {order} \xB7 {mode} \xB7 {characters} characters \xB7 call config: {config}",
  "trace.worldBookDecisions": "\u4E16\u754C\u4E66\u5339\u914D\u51B3\u7B56",
  "trace.historyOnly": "\u5339\u914D\u57FA\u4E8E\u672C\u6B65\u9AA4 system assembly \u5F53\u65F6\u53EF\u89C1\u7684\u6301\u4E45\u5316\u4F1A\u8BDD\u5386\u53F2\uFF1B\u6CA1\u6709\u91CD\u590D\u9644\u52A0 pending \u8F93\u5165\u3002",
  "trace.waitingHeader": "\u7B49\u5F85\u6743\u5A01 header",
  "trace.pendingHeader": "\u5C1A\u672A\u89C2\u5BDF\u5230\u53EF\u5BF9\u9F50\u7684 DSH request/header\uFF1B\u8FD9\u4E0D\u4EE3\u8868\u8BF7\u6C42\u5DF2\u7ECF\u53D1\u9001\u3002\u5237\u65B0\u540E\u4ECD\u4F1A\u4FDD\u7559\u8BE5\u5F85\u786E\u8BA4\u8BB0\u5F55\u3002",
  "trace.round": "\u8F6E\u6B21 {turn} \xB7 \u6B65\u9AA4 {step}",
  "trace.roundAttempt": "\u8F6E\u6B21 {turn} \xB7 \u6B65\u9AA4 {step} \xB7 \u5C1D\u8BD5 {attempt}",
  "trace.resource.preset": "Preset",
  "trace.resource.character": "Character",
  "trace.resource.user": "User",
  "trace.inserted": "\u5DF2\u63D2\u5165",
  "trace.rejected": "\u5DF2\u62D2\u7EDD",
  "trace.noConfiguredKeywords": "\u65E0\u914D\u7F6E\u5173\u952E\u8BCD",
  "trace.noKeywordMatches": "\u65E0\u5173\u952E\u8BCD\u547D\u4E2D",
  "trace.truncated": "\uFF1B\u626B\u63CF\u8F93\u5165\u5DF2\u6309\u4E0A\u9650\u622A\u65AD",
  "trace.reusedHeader": "\uFF08\u6CBF\u7528\u4E0A\u4E00\u4EFD header\uFF09",
  "trace.profile.missing": "\u672A\u627E\u5230",
  "trace.profile.consistent": "\u4E00\u81F4",
  "trace.profile.absent": "\u672C\u8F6E\u65E0 profile",
  "trace.config.inconsistent": "\u4E0D\u4E00\u81F4",
  "trace.config.consistent": "\u4E00\u81F4\u6216\u65E0\u5B57\u6BB5",
  "trace.position.approximate": "\uFF08\u8FD1\u4F3C\uFF09",
  "trace.position.notInserted": " \u2192 \u672A\u63D2\u5165",
  "trace.position.applied": " \u2192 {position}{approximate}",
  "trace.storage.total": "\u603B\u8BA1\u6700\u591A {value}",
  "trace.storage.perSession": "\u6BCF\u4F1A\u8BDD\u6700\u591A {value} \u6761",
  "trace.storage.sessions": "\u6700\u591A {value} \u4E2A\u4F1A\u8BDD",
  "trace.storage.perRecord": "\u5355\u6761\u6700\u591A {value}",
  "trace.storage.summary": "\u63D2\u4EF6\u6709\u754C\u5B58\u50A8\uFF1A{limits}\uFF1B\u5237\u65B0\u6216\u5BBF\u4E3B\u91CD\u542F\u540E\u53EF\u6062\u590D\u3002",
  "trace.keywords.primary": "\u4E3B\uFF1A{values}",
  "trace.keywords.secondary": "\u9644\u52A0\uFF1A{values}",
  "trace.keywords.configured": "\u914D\u7F6E\u5173\u952E\u8BCD\uFF1A{value}",
  "trace.keywords.matched": "\u672C\u8F6E\u547D\u4E2D\uFF1A{value}",
  "trace.bookBudget": "\u9884\u7B97\uFF1A{used}{limit} tokens \xB7 {decisionCount}",
  "trace.decisionCount.one": "{count} \u6761\u51B3\u7B56",
  "trace.decisionCount.other": "{count} \u6761\u51B3\u7B56",
  "trace.decision.group": "\u7EC4 {name}{detail}",
  "trace.decision.probability": "\u6982\u7387 {value}%{roll}",
  "trace.decision.budget": "\u9884\u7B97 {value} tokens",
  "trace.decision.position": "\u4F4D\u7F6E {requested}{result}",
  "trace.recordAligned": "\u8BE5\u8BB0\u5F55\u5DF2\u5BF9\u9F50 DSH request/header #{sequence}{reused}\u3002Tavern profile \u6821\u9A8C\uFF1A{profile}\uFF1B\u91C7\u6837\u5B57\u6BB5\uFF1A{config}\u3002",
  "trace.activationPending": "\u5339\u914D\u57FA\u4E8E\u672C\u6B65\u9AA4 assembly \u7684\u4E34\u65F6\u6FC0\u6D3B\u4E0A\u4E0B\u6587\uFF1A\u6301\u4E45\u5386\u53F2 + {included}/{pending} \u6761\u672C\u8F6E claimed \u8F93\u5165\uFF1B\u4E0D\u4FDD\u5B58\u8F93\u5165\u6B63\u6587{truncated}\u3002",
  "trace.diagnostics": "\u8BCA\u65AD\uFF08{count}\uFF09",
  "trace.reason.constant": "\u5E38\u9A7B\u6761\u76EE",
  "trace.reason.primary-key-match": "\u4E3B\u5173\u952E\u8BCD\u547D\u4E2D",
  "trace.reason.primary-key-miss": "\u4E3B\u5173\u952E\u8BCD\u672A\u547D\u4E2D",
  "trace.reason.secondary-and_any-match": "\u9644\u52A0\u5173\u952E\u8BCD\u4EFB\u4E00\u547D\u4E2D",
  "trace.reason.secondary-and_any-miss": "\u9644\u52A0\u5173\u952E\u8BCD\u5747\u672A\u547D\u4E2D",
  "trace.reason.secondary-and_all-match": "\u9644\u52A0\u5173\u952E\u8BCD\u5168\u90E8\u547D\u4E2D",
  "trace.reason.secondary-and_all-miss": "\u9644\u52A0\u5173\u952E\u8BCD\u672A\u5168\u90E8\u547D\u4E2D",
  "trace.reason.secondary-not_any-match": "\u9644\u52A0\u5173\u952E\u8BCD\u6392\u9664\u6761\u4EF6\u901A\u8FC7",
  "trace.reason.secondary-not_any-miss": "\u9644\u52A0\u5173\u952E\u8BCD\u89E6\u53D1\u6392\u9664",
  "trace.reason.secondary-not_all-match": "\u9644\u52A0\u5173\u952E\u8BCD\u975E\u5168\u4E2D\u6761\u4EF6\u901A\u8FC7",
  "trace.reason.secondary-not_all-miss": "\u9644\u52A0\u5173\u952E\u8BCD\u5168\u4E2D\u800C\u6392\u9664",
  "trace.reason.disabled": "\u6761\u76EE\u5DF2\u7981\u7528",
  "trace.reason.external-vector-match-required": "\u9700\u8981\u5916\u90E8\u5411\u91CF\u5339\u914D",
  "trace.reason.inclusion-group-loser": "\u4E92\u65A5\u7EC4\u672A\u80DC\u51FA",
  "trace.reason.probability-failed": "\u6982\u7387\u68C0\u67E5\u62D2\u7EDD",
  "trace.reason.budget-exceeded": "\u8D85\u51FA token \u9884\u7B97",
  "trace.reason.empty-content": "\u6B63\u6587\u4E3A\u7A7A\uFF0C\u672A\u63D2\u5165",
  "trace.reason.outlet-unsupported": "Outlet \u65E0\u7A33\u5B9A\u63D2\u5165 seam"
});

// packages/client/src/i18n/catalogs/en.js
var en_default = Object.freeze({
  "common.unavailable": "Interface text unavailable",
  "common.loading": "Loading\u2026",
  "common.none": "None",
  "common.unknown": "Unknown",
  "common.unknownAuthor": "Unknown author",
  "common.refresh": "Refresh",
  "common.delete": "Delete",
  "common.save": "Save",
  "common.saveChanges": "Save changes",
  "common.saved": "Saved",
  "common.reload": "Reload",
  "common.working": "Working\u2026",
  "common.enabled": "Enabled",
  "common.disabled": "Disabled",
  "common.bound": "Bound",
  "common.unbound": "Not bound",
  "common.planned": "Planned",
  "common.listSeparator": ", ",
  "common.name": "Name",
  "common.role": "Role",
  "common.content": "Content",
  "common.exportJson": "Export JSON",
  "common.importJson": "Import JSON",
  "common.enable": "Enabled",
  "panel.close": "Close the {title} sidebar",
  "nav.preset": "Preset",
  "nav.character": "Character card",
  "nav.worldBook": "World book",
  "nav.user": "User",
  "nav.sessionTemplate": "New session",
  "nav.settings": "UI settings",
  "nav.preset.empty": "No preset selected",
  "nav.character.empty": "No character bound",
  "nav.worldBook.empty": "No world book bound",
  "nav.user.empty": "No user bound",
  "nav.sessionTemplate.empty": "Current settings or configuration template",
  "nav.settings.empty": "Language, scale, default RP workspace, RP follow, and prompt",
  "nav.regex": "Display regex",
  "nav.regex.empty": "Mowan display-only rules",
  "regex.title": "Display regex",
  "regex.displayOnlyNote": "These rules change Mowan rendering and static HTML only. They never rewrite history, timeline data, or AI requests. Imported switches are preserved as supplied.",
  "regex.scopes": "Regex scopes",
  "regex.scope.global": "Global",
  "regex.scope.preset": "Preset-bound",
  "regex.scope.character": "Character-bound",
  "regex.noPreset": "No preset is selected. New preset-scoped rules need a resource ID before they can match.",
  "regex.noCharacter": "No character card is bound. New character-scoped rules need a resource ID before they can match.",
  "regex.add": "New rule",
  "regex.emptyScope": "No rules in this scope.",
  "regex.enabled": "Use this rule",
  "regex.name": "Rule name",
  "regex.unnamed": "Unnamed rule",
  "regex.newRule": "New regex",
  "regex.find": "Find expression",
  "regex.replace": "Replacement",
  "regex.flags": "Flags",
  "regex.target": "Rendered messages",
  "regex.target.assistant": "Assistant",
  "regex.target.user": "User",
  "regex.target.both": "Both",
  "regex.scope": "Scope",
  "regex.resourceId": "Resource ID",
  "regex.loaded": "{count} regex rules loaded",
  "regex.saved": "{count} regex rules saved",
  "regex.imported": "{count} regex rules imported and saved",
  "regex.confirmReload": "Discard unsaved regex changes and reload?",
  "regex.confirmClose": "Close and discard unsaved regex changes?",
  "regex.sourceOwnedDisplay": "This rule is stored in the bound resource. Saving changes writes it back to the original preset or character card.",
  "regex.sourceOwnedPromptOnly": "This rule is stored in the bound resource but only affects prompts, not Mowan display. Saving changes writes it back to the original preset or character card.",
  "nav.session.none": "No session",
  "nav.syncFailed": "Status sync failed: {message}",
  "nav.menuTitle": "Tavern \xB7 {session}",
  "nav.itemTitleBound": "{label}: {title} ({state})",
  "nav.itemTitle": "{label}: {title}",
  "nav.itemAriaBound": "{label}, {title}, {state}",
  "nav.itemAria": "{label}, {title}",
  "nav.bookCount": "{count} books",
  "nav.launcher": "Drag to move; left-click to open panels; right-click to switch frontend display mode",
  "chrome.switchToPlay": "Switch to custom frontend mode",
  "chrome.switchToNative": "Switch to native DSH mode",
  "chrome.currentPlay": "Current: Mowan",
  "chrome.currentNative": "Current: native DSH",
  "play.sidebar.loading": "Loading role-play workspace\u2026",
  "play.sidebar.workspaceMissing": "No role-play workspace is selected. Native sessions remain available in Lingzhu mode.",
  "play.sidebar.selectWorkspace": "Use {name} as the role-play workspace",
  "play.sidebar.systemWorkspaceConfirm": "{path} is on the system disk. Use it as the role-play workspace anyway?",
  "play.sidebar.newPlaythrough": "Start a new playthrough with {name}",
  "play.sidebar.noCharacters": "No character cards are available.",
  "play.sidebar.noPlaythroughs": "No playthroughs yet.",
  "play.sidebar.unassigned": "Not in a playthrough",
  "play.sidebar.other": "Regular / non-role-play sessions",
  "play.sidebar.otherEmpty": "No regular or external sessions.",
  "play.notice.unbound": "This session is not bound to a character card. You can keep chatting normally; start a new playthrough after binding a card to enable greetings, swipes, display edits, and playthrough import/export.",
  "play.sidebar.sessionMissing": "This playthrough has no available session in the role-play workspace.",
  "play.sidebar.timelineErrors": "{count} playthrough timelines could not be read.",
  "play.chat.label": "RP View",
  "play.chat.loading": "Loading playthrough\u2026",
  "play.chat.empty": "No turns yet. Start the conversation below.",
  "play.chat.thinking": "Thinking\u2026",
  "play.chat.reasoning": "Thinking",
  "play.chat.previousGreeting": "Previous greeting",
  "play.chat.nextGreeting": "Next greeting",
  "play.chat.hiddenNode": "This QA is hidden in Mowan display.",
  "play.chat.runningDisabled": "Unavailable while the agent is running",
  "play.chat.copy": "Copy displayed reply",
  "play.chat.copyUnavailable": "Clipboard access is unavailable.",
  "play.chat.previousReply": "Previous saved reply",
  "play.chat.nextReply": "Next saved reply",
  "play.chat.noOtherReply": "No other saved reply",
  "play.chat.generateReply": "Generate a new reply",
  "play.chat.forkPlaythrough": "Fork a new playthrough here",
  "play.chat.editDisplay": "Edit displayed reply",
  "play.chat.editDisplayPrompt": "Display this text instead of the original reply:",
  "play.chat.restoreOriginal": "Restore original reply",
  "play.chat.hideNode": "Hide this QA from Mowan display",
  "play.chat.hideConfirm": "Hide this QA from Mowan display? The original DSH messages will not be deleted.",
  "play.chat.restoreNode": "Restore this QA to Mowan display",
  "play.io.menu": "Playthrough import / export",
  "play.io.rename": "Rename playthrough",
  "play.io.renamePrompt": "Enter a new playthrough name:",
  "play.io.renameInvalid": "The playthrough name must contain 1\u2013120 characters.",
  "play.io.exportHtml": "Export static HTML",
  "play.io.exportSt": "Export SillyTavern JSONL",
  "play.io.exportBundle": "Export portable bundle",
  "play.io.import": "Import into a new session",
  "play.io.importUnavailable": "Import is unavailable until the backend provides the one-shot import-context reference required to avoid fake DSH history.",
  "play.import.bind": "Import external history",
  "play.import.replace": "Replace binding",
  "play.import.unbind": "Unbind",
  "play.import.bound": "External imported history is bound",
  "play.import.lastQa": "Imported history \xB7 latest turn",
  "play.import.unbindConfirm": "Unbind the current imported history? Its file will remain, but this playthrough will no longer display or send that context.",
  "settings.menu": "UI settings",
  "settings.title": "Tavern UI settings",
  "settings.language": "Interface language",
  "settings.language.zh": "\u7B80\u4F53\u4E2D\u6587",
  "settings.language.en": "English",
  "settings.scale": "Tavern UI scale",
  "settings.scale.help": "Scales only the Tavern launcher, resource panels, and Trace\u2014not the DSH interface.",
  "settings.currentScale": "Current scale: {scale}%",
  "settings.reset": "Restore defaults",
  "settings.saving": "Saving settings\u2026",
  "settings.saved": "Settings saved and retained across refreshes and session changes.",
  "settings.loadError": "Could not load UI settings: {message}",
  "settings.saveError": "Could not save UI settings: {message}",
  "settings.close": "Close the UI settings sidebar",
  "settings.rpFollow": "Enter RP mode when a character card is bound",
  "settings.rpFollow.help": "When enabled, binding a character card enters roleplay and pins the file sandbox to read-only. Writes, shell, outbound fetch, and reads outside the workspace or of secret files are refused and that agent is cancelled. Subagents may still be spawned and inherit the same lock. The chat permission chip cannot override this; turn RP off on the character card (or /rp off) first.",
  "settings.rpWorkspace": "Default RP workspace",
  "settings.rpWorkspace.help": "New playthroughs use this workspace by default. Changing it only affects future placement and RP-session classification; it does not move existing sessions, directories, or playthroughs.",
  "settings.rpWorkspace.unselected": "No RP workspace selected",
  "settings.rpWorkspace.unavailable": "The current binding is no longer in the DSH workspace list: {path}",
  "settings.rpWorkspace.none": "No DSH workspaces are available",
  "settings.rpWorkspace.verifyError": "The default RP workspace was updated, but read-back verification failed: {message}",
  "settings.rpPolicy": "RP mode prompt (rp:policy)",
  "settings.rpPolicy.help": "Optional. DSH cannot weight prompt sections; identity and style belong in the preset or character card. The default only says high-risk actions are locked. Leave empty to skip extra RP text; the lock still applies. Restore defaults at the bottom only resets language, scale, and RP follow.",
  "settings.rpPolicy.placeholder": "Leave empty to use the read-only sandbox with no extra RP prompt",
  "settings.rpPolicy.save": "Save RP prompt",
  "settings.rpPolicy.reset": "Restore default RP prompt",
  "settings.rpPolicy.saved": "RP prompt saved; it applies on the next request.",
  "rp.block.body": "The agent is attempting a high-risk action such as writing files. If you know what you are doing, turn off RP mode and try again.",
  "rp.block.dismiss": "OK",
  "preset.title": "Tavern preset",
  "preset.active": "\u25CF Enabled",
  "preset.importStJson": "Import ST JSON",
  "preset.create": "Create preset",
  "preset.browse": "Browse presets",
  "preset.libraryEmpty": "Preset library is empty",
  "preset.unboundNote": "The current session has no bound preset.",
  "preset.currentSessionBound": "Current session binding: {name}.",
  "preset.browsingUnbound": "Browsing \u201C{name}\u201D; it is not bound to the current session.",
  "preset.bind": "Bind to current session",
  "preset.bindUpdate": "Update session binding",
  "preset.unbind": "Unbind from current session",
  "preset.loading": "Loading presets\u2026",
  "preset.emptyHint": "Select or create a preset to begin configuring it.",
  "preset.basicSettings": "Basic settings",
  "preset.name": "Preset name",
  "preset.temperature": "Temperature",
  "preset.maxTokens": "Max tokens",
  "preset.reasoningEffort": "Reasoning effort",
  "preset.modelDefault": "Use model default",
  "preset.effort.low": "Low",
  "preset.effort.medium": "Medium",
  "preset.effort.high": "High",
  "preset.effort.xhigh": "Extra high",
  "preset.advancedShow": "Show advanced settings",
  "preset.advancedHide": "Hide advanced settings",
  "preset.advancedNote": "These fields are saved in full. Parameters not exposed by the current dsh request protocol are not forced into the adapter.",
  "preset.systemPrompt": "DSH system prompt",
  "preset.systemAppend": "Keep the DSH system prompt and append the preset (recommended)",
  "preset.systemReplace": "Use only the preset and remove DSH system sections (advanced)",
  "preset.replaceWarning": "Warning: this removes the model-visible Harness identity, Agent persona, and tool instructions, which may break tool use or structured output. Execution-layer sandboxing and approvals remain active.",
  "preset.prompts": "Prompts ({count})",
  "preset.addPrompt": "+ Add",
  "preset.dropHere": "Release to place here",
  "preset.dragOrder": "Drag to reorder",
  "preset.dragNamed": "Drag \u201C{name}\u201D to reorder",
  "preset.markerHint": "ST markers are not injected as standalone prompts",
  "preset.enablePrompt": "Enable prompt",
  "preset.role.system": "System",
  "preset.role.user": "User",
  "preset.role.assistant": "Assistant",
  "preset.sampling.topP": "Top P",
  "preset.sampling.topK": "Top K",
  "preset.sampling.topA": "Top A",
  "preset.sampling.minP": "Min P",
  "preset.sampling.frequencyPenalty": "Frequency penalty",
  "preset.sampling.presencePenalty": "Presence penalty",
  "preset.sampling.repetitionPenalty": "Repetition penalty",
  "preset.sampling.seed": "Seed",
  "preset.defaultName": "New preset",
  "preset.defaultPromptName": "New prompt",
  "preset.confirmDelete": "Delete preset \u201C{name}\u201D?",
  "preset.confirmHistoricalSwitch": "This session already has history. Changing the preset affects only later requests and does not rewrite existing messages. Continue?",
  "preset.status.syncing": "Syncing preset state for the current session\u2026",
  "preset.status.loaded": "Preset loaded",
  "preset.status.refreshed": "Preset status refreshed",
  "preset.status.detailsLoaded": "Preset details loaded; the session binding is unchanged",
  "preset.status.bound": "Preset bound; the current session will use it on the next request",
  "preset.status.unbound": "Preset unbound from the current session",
  "preset.status.created": "Preset created; not bound to the current session",
  "preset.status.imported": "ST preset imported; not bound to the current session",
  "preset.status.saved": "Preset saved; sessions bound to it will use the new content on later requests",
  "preset.status.deleted": "Preset deleted",
  "preset.error.needSession": "Create or open a session before binding a preset",
  "preset.error.needPreset": "Select a preset first",
  "preset.error.noSessionToUnbind": "There is no session to unbind",
  "character.title": "Tavern character card",
  "character.import": "Import JSON / PNG",
  "character.create": "New character card",
  "character.defaultName": "New character",
  "character.browse": "Browse character library",
  "character.libraryEmpty": "Character library is empty",
  "character.sessionBinding": "Current session: {session}; Binding: {name}",
  "character.loading": "Loading character library\u2026",
  "character.emptyHint": "Create a blank character card or import a synthetic or properly licensed SillyTavern card.",
  "character.imageAlt": "{name} character card image",
  "character.greeting": "Greeting reference",
  "character.greeting.default": "Default greeting",
  "character.greeting.defaultEmpty": "Default greeting (empty)",
  "character.greeting.alternate": "Alternate greeting {index}",
  "character.preferSystem": "Allow the loader to prefer the card system_prompt",
  "character.preferPostHistory": "Allow the loader to use post_history_instructions (the loader determines placement)",
  "character.bind": "Bind to current session",
  "character.bindUpdate": "Update session binding (unsaved)",
  "character.bindingUnsaved": "The binding has unsaved changes; the current greeting is not yet applied.",
  "character.bindingApplied": "The greeting shown in this panel is applied to the current session.",
  "character.bindingAppliedButton": "Current binding applied",
  "character.unbind": "Unbind",
  "character.rpMode": "RP mode (high-risk lock)",
  "character.rpMode.help": "When on, the file sandbox stays read-only. Writes, shell, outbound fetch, and reads outside the workspace or of secret files are refused and that agent is cancelled. Subagents may still be spawned and inherit the same lock. Turn this switch off or use /rp off first.",
  "character.status.rpUpdated": "RP mode updated",
  "character.moduleNote": "The character-card module stores normalized resources and session selection. The Tavern loader handles the system profile and embedded World Info on each request without fabricating assistant history.",
  "character.field.creatorNotes": "Creator notes",
  "character.field.description": "Description",
  "character.field.personality": "Personality",
  "character.field.scenario": "Scenario",
  "character.field.greetingContent": "Current greeting reference",
  "character.field.messageExamples": "Message examples",
  "character.field.systemPrompt": "System prompt (handled by the loader according to binding settings)",
  "character.field.postHistory": "Post-history instructions (approximately placed by the loader)",
  "character.embeddedBook": "Embedded character_book preserved losslessly ({count} entries); when the character is bound, the Tavern loader invokes the World Info matcher, and unbinding removes it from later requests.",
  "character.warnings": "Compatibility warnings ({count})",
  "character.unsupported": "Requires loader/other module handling ({count})",
  "character.unknownMacros": "Unknown macros: {names}",
  "character.exportPng": "Export PNG",
  "character.saveResource": "Save fields (unsaved)",
  "character.resourceSaved": "Fields saved",
  "character.saveFirst": "Save changes first",
  "character.dirty": "This character card has unsaved field changes.",
  "character.savedNote": "The displayed character card fields are saved.",
  "character.field.nickname": "Nickname",
  "character.field.creator": "Creator",
  "character.field.characterVersion": "Character version",
  "character.field.tags": "Tags",
  "character.tagsPlaceholder": "tag-one, tag-two",
  "character.field.firstMessage": "Default greeting",
  "character.alternateGreetings": "Alternate greetings",
  "character.addGreeting": "Add alternate greeting",
  "character.delete": "Delete character card",
  "character.confirmDelete": "Delete character card \u201C{name}\u201D?",
  "character.confirmHistoricalSwitch": "This session already has history. Changing the character affects only later requests and does not rewrite existing messages. Continue?",
  "character.confirmCloseDirty": "This character card has unsaved changes. Close anyway?",
  "character.confirmDiscardForSwitch": "This character card has unsaved changes. Switch anyway?",
  "character.confirmDiscardRefresh": "This character card has unsaved changes. Refresh anyway?",
  "character.confirmDiscardForCreate": "This character card has unsaved changes. Discard them and create a new card?",
  "character.status.loaded": "Character library loaded",
  "character.status.refreshed": "Character status refreshed",
  "character.status.libraryRefreshed": "Character library refreshed",
  "character.status.imported": "Character card imported; it is not yet bound to a session",
  "character.status.created": "Blank character card created; it is not yet bound to a session",
  "character.status.bound": "Character selection saved; the Tavern loader handles runtime loading",
  "character.status.unbound": "Character unbound from the current session",
  "character.status.deleted": "Character card deleted and related bindings cleared",
  "character.status.detailsLoaded": "Character details loaded",
  "character.status.saved": "Character card saved; bound sessions will use the new fields on the next request",
  "character.status.skippedRefresh": "Unsaved character edits were kept; refresh skipped",
  "character.error.needSession": "Create or open a session before binding a character",
  "character.error.noSessionToUnbind": "There is no session to unbind",
  "character.error.saveFirst": "Save character field changes before binding",
  "world.title": "World Info (World Book)",
  "world.lorebookTitle": "World Info (Lorebook)",
  "world.importJson": "Import JSON",
  "world.create": "New world book",
  "world.defaultName": "Untitled World Book",
  "world.standalone": "Standalone world books",
  "world.sessionBinding": "Current session binding",
  "world.libraryEmpty": "The standalone world-book library is empty.",
  "world.bindingUnsaved": "The binding has unsaved changes; the current selection is not yet applied.",
  "world.bindingApplied": "The binding shown in this panel is applied to the current session.",
  "world.applyBinding": "Apply session binding (unsaved)",
  "world.bindingAppliedButton": "Current binding applied",
  "world.clearPending": "Clear pending selection",
  "world.browse": "Browse standalone world books",
  "world.catalogEmpty": "Library is empty",
  "world.bookName": "World-book name",
  "world.addEntry": "Add entry",
  "world.deleteStandalone": "Delete standalone book",
  "world.characterBound": "Character-bound world book",
  "world.embeddedTitle": "Embedded character world book",
  "world.embeddedInfoTitle": "Embedded character World Info",
  "world.addEmbeddedEntry": "Add embedded entry",
  "world.saveEmbedded": "Save embedded book",
  "world.embeddedSaved": "Embedded book saved",
  "world.matcherNote": "The shared matcher determines activation, ordering, probability, and budget, and the Tavern loader performs final injection. Scanning combines this step\u2019s claimed input with durable history in a temporary context, so a single-step session can trigger keywords on its first request.",
  "world.infoIntro": "Current session: {session}. SillyTavern\u2019s official feature name is World Info; Lorebook is a commonly accepted alias.",
  "world.infoLoaded": "Loaded {count} entries.",
  "world.infoDirty": "There are unsaved entry changes.",
  "world.infoReading": "Reading World Info\u2026",
  "world.infoEmpty": "No World Info is available for this session. Bind a character card containing character_book to let the loader match its entries; unbinding removes that source.",
  "world.infoMeta": "Embedded character book \xB7 {count} entries. The collapsed title shows how the entry triggers; expand it to edit keywords, logic, content, position, and order.",
  "world.infoPendingIds": "{count} standalone World Info IDs are selected, but the standalone library/API is not wired in this phase and those IDs will not be loaded.",
  "world.infoSaveNote": "Saving updates the character card document and its JSON/PNG export. Before the first request assembly, the matcher scans this step\u2019s claimed input together with Session history without writing a duplicate into history.",
  "world.entry.untitled": "New entry {id}",
  "world.entry.fallback": "Entry {id}",
  "world.entry.title": "Entry title",
  "world.entry.nameNote": "Entry name / note",
  "world.entry.delete": "Delete entry",
  "world.entry.constant": "Always active",
  "world.entry.noKeywords": "No keywords",
  "world.entry.noPrimaryKeys": "No primary keywords",
  "world.entry.disabled": "Disabled",
  "world.entry.useSecondary": "Use secondary keywords",
  "world.entry.caseSensitive": "Case sensitive",
  "world.entry.wholeWord": "Whole-word matching",
  "world.entry.primaryKeys": "Primary keywords (Chinese or English comma separators)",
  "world.entry.secondaryKeys": "Secondary keywords (Chinese or English comma separators)",
  "world.entry.primaryKeysLines": "Primary keywords (one per line; any match)",
  "world.entry.secondaryKeysLines": "Secondary keywords (one per line)",
  "world.entry.secondaryLogic": "Secondary keyword logic",
  "world.entry.secondaryLogicShort": "Secondary logic",
  "world.entry.body": "Body",
  "world.entry.content": "Entry content (injected into the system profile when triggered)",
  "world.entry.position": "Position",
  "world.entry.insertionPosition": "Insertion position",
  "world.entry.order": "Order (higher values first)",
  "world.entry.sortWeight": "Sort weight",
  "world.entry.probability": "Probability (0\u2013100)",
  "world.entry.trigger": "Keywords: {keys}",
  "world.entry.triggerWithSecondary": "Keywords: {keys} \xB7 {logic}: {secondary}",
  "world.logic.andAny": "AND ANY: match any",
  "world.logic.andAll": "AND ALL: match all",
  "world.logic.notAny": "NOT ANY: match none",
  "world.logic.notAll": "NOT ALL: not all may match",
  "world.position.beforeCharacter": "Before character definition",
  "world.position.afterCharacter": "After character definition",
  "world.position.beforeAuthor": "Before author note (approximate)",
  "world.position.afterAuthor": "After author note (approximate)",
  "world.position.atDepth": "At depth (approximate)",
  "world.position.beforeExamples": "Before example messages (approximate)",
  "world.position.afterExamples": "After example messages (approximate)",
  "world.position.outlet": "Outlet (not currently injected)",
  "world.currentSession": "Current session: {session}. Bind zero, one, or multiple standalone world books; binding order remains stable.",
  "world.catalogItem": "{name} ({count} entries)",
  "world.documentMeta": "{count} entries \xB7 Unknown fields are preserved across saves and exports",
  "world.user.title": "User-bound world books",
  "world.user.current": "Current user: {name}",
  "world.user.none": "The current session has no bound user, so it has no user-sourced world books.",
  "world.user.empty": "The current user has no bound standalone world books.",
  "world.user.libraryEmpty": "The standalone world-book library is empty. Create or import a world book first.",
  "world.user.unsaved": "The user world-book binding has unsaved changes; the current selection is not yet applied.",
  "world.user.saved": "The displayed user world-book binding is saved and applied.",
  "world.user.order": "Effective order: explicit session books first, followed by user-bound books; duplicate resources run only once.",
  "world.user.duplicate": "Also session-bound; deduplicated",
  "world.user.appended": "Appended from user binding",
  "world.user.pendingAdd": "Pending addition",
  "world.user.pendingRemove": "Pending removal",
  "world.user.save": "Save user binding (unsaved)",
  "world.user.saveApplied": "User binding saved",
  "world.user.clear": "Clear pending selection",
  "world.user.saveSuccess": "The user-bound world books were saved; later requests will use the new composition.",
  "world.user.editContent": "Edit contents",
  "world.user.editHint": "This panel and the User panel edit the same binding. Saving in either place refreshes the other.",
  "world.user.error.noUser": "The current session has no bound user whose world-book relationship can be edited",
  "world.embeddedMeta": "{count} entries. It shares the matcher/loader with standalone books; deleting a standalone book never edits or unbinds this embedded book.",
  "world.embeddedEmpty": "The current session has no character-bound embedded world book. Bind a character card with character_book to show it here.",
  "world.diagnostics": "Runtime diagnostics ({count})",
  "world.confirmDelete": "Delete standalone world book \u201C{name}\u201D? Character-card embedded books will not be affected.",
  "world.confirmDiscardChanges": "Discard unsaved changes?",
  "world.confirmDeleteEntry": "Delete this world-book entry? It takes effect after saving.",
  "world.confirmDeleteEmbeddedEntry": "Delete this embedded character-card world-book entry? It takes effect after saving.",
  "world.confirmDeleteInfoEntry": "Delete this World Info entry? It will be written to the character-card copy only after saving.",
  "world.confirmReloadInfo": "Discard unsaved entry changes and reload?",
  "world.status.loaded": "World-book library loaded",
  "world.status.refreshed": "World-book library refreshed",
  "world.status.detailsLoaded": "World-book details loaded",
  "world.status.created": "Standalone world book created; not yet bound to the current session",
  "world.status.imported": "World book imported; not yet bound to the current session",
  "world.status.saved": "World-book changes saved; future requests will use the new content",
  "world.status.bindingSaved": "World-book binding saved for the current session",
  "world.status.deleted": "Standalone world book deleted and related session bindings cleared",
  "world.status.embeddedSaved": "Embedded character world book saved; future requests will use the new content",
  "world.error.needSession": "Create or open a session before binding world books",
  "user.title": "Tavern user",
  "user.create": "New user",
  "user.browse": "Browse user resources",
  "user.libraryEmpty": "User library is empty",
  "user.sessionBinding": "Current session: {session}; Binding: {name}",
  "user.dirty": "Unsaved changes: {parts}.",
  "user.dirty.name": "Name/description",
  "user.dirty.binding": "User world-book binding",
  "user.savedNote": "The displayed user resource and world-book binding are saved.",
  "user.loading": "Loading user resources\u2026",
  "user.emptyHint": "Create a user resource containing only a name and description.",
  "user.name": "Name (used by the {macro} macro)",
  "user.description": "Description (placed at the personaDescription marker, with a stable loader fallback)",
  "user.saveResource": "Save resource (unsaved)",
  "user.resourceSaved": "Resource saved",
  "user.saveFirst": "Save changes first",
  "user.refreshBinding": "Refresh session binding",
  "user.bind": "Bind to current session",
  "user.worldBooksTitle": "Standalone world books bound to this user",
  "user.worldBooksHint": "When this user is selected, the loader combines these books with the session\u2019s explicit world books; a duplicate book runs only once.",
  "user.worldBooksLoading": "Loading the standalone world-book library\u2026",
  "user.worldBooksEmpty": "The standalone world-book library is empty. Create or import one in the world-book panel first.",
  "user.saveWorldBooks": "Save world-book binding (unsaved)",
  "user.worldBooksSaved": "World-book binding saved",
  "user.clearPending": "Clear pending selection",
  "user.unbind": "Unbind from current session",
  "user.identityNote": "The user resource remains strictly name and description only; world-book relationships are stored in a separate structured loader policy. User resources have no avatar and do not override the DSH Agent identity.",
  "user.delete": "Delete user",
  "user.defaultName": "New user",
  "user.confirmDelete": "Delete user \u201C{name}\u201D? User selections in every session and this user\u2019s world-book relationships will be cleared.",
  "user.confirmDiscardForCreate": "The current user resource or world-book binding has unsaved changes. Discard them and create a new user?",
  "user.confirmDiscardForSwitch": "The current user resource or world-book binding has unsaved changes. Discard them and switch?",
  "user.confirmHistoricalSwitch": "This session already has history. Changing the user affects only later requests and does not rewrite existing messages. Continue?",
  "user.confirmCloseDirty": "The current user resource or world-book binding has unsaved changes. Close anyway?",
  "user.confirmDiscardRefresh": "Discard unsaved user-resource or world-book binding changes?",
  "user.status.loaded": "User resources loaded",
  "user.status.refreshed": "User resources refreshed",
  "user.status.created": "User created; save its name and description before binding",
  "user.status.saved": "Name and description saved; bound sessions will use them on the next request",
  "user.status.bound": "User bound; the current session will use this name and description on its next request",
  "user.status.unbound": "User unbound from the current session",
  "user.status.deleted": "User deleted and related session bindings cleared",
  "user.status.skippedRefresh": "Other Tavern resources changed. This panel was not refreshed so its unsaved changes are preserved.",
  "user.status.worldBooksSaved": "The user\u2019s world-book binding was saved; sessions using this user will apply it on their next assembly",
  "user.status.userLoaded": "User resource and world-book binding loaded",
  "user.error.needSession": "Create or open a session and select a user resource first",
  "user.error.noSessionToUnbind": "There is no session to unbind",
  "template.title": "New session and configuration templates",
  "template.startCurrent": "Start a new conversation with the current Tavern settings",
  "template.inheritNote": "Carries only the preset, character and greeting/options, user, and standalone world-book selections. DSH history, Tavern Trace, Inbox, active turns/steps, and other runtime state are not copied.",
  "template.noWorkspace": "No DSH target workspace is available. Add or open a workspace in the DSH sidebar first.",
  "template.listTitle": "Configuration templates ({count})",
  "template.selected": "Selected template",
  "template.noneSelected": "No template selected",
  "template.name": "Template name",
  "template.createFromCurrent": "Create from current settings",
  "template.saveNameOnly": "Save name only",
  "template.updateFromCurrent": "Update from current settings",
  "template.delete": "Delete template",
  "template.unusable": "This template cannot currently be used:",
  "template.startFromTemplate": "Start a clean conversation from the selected template",
  "template.ready": "Template and new-session actions are ready.",
  "template.blankSessionNote": "DSH may reuse an existing real blank session in the same workspace; this is its public New Session behavior. The plugin atomically replaces that blank session\u2019s Tavern selection before navigation.",
  "template.preview.title": "Saved Tavern configuration",
  "template.preview.worldBooks": "Standalone world books (binding order)",
  "template.preview.greeting": "Greeting index: {value}",
  "template.preview.systemPrompt": "Character system_prompt: {value}",
  "template.preview.postHistory": "post_history_instructions: {value}",
  "template.defaultName": "New configuration template",
  "template.currentSettingsReminder": "Templates can only be created or updated from the current session\u2019s Tavern settings. Review or change the current configuration in the launcher\u2019s Preset, Character, World book, and User panels, then return here to save it.",
  "template.confirmDelete": "Delete configuration template \u201C{name}\u201D? This will not delete any DSH session.",
  "template.status.selected": "Template selection updated",
  "template.status.created": "Template created: {name}",
  "template.status.renamed": "Template renamed: {name}",
  "template.status.updated": "Template updated from current settings: {name}",
  "template.status.deleted": "Template deleted",
  "template.status.switched": "Switched to clean session: {id}",
  "template.error.needSessionToSave": "Open a session before saving its current Tavern settings",
  "template.error.needTemplate": "Select a template first",
  "template.error.needSessionAndTemplate": "Open a session and select a template first",
  "template.error.needSourceSession": "Open a source session first",
  "template.error.needWorkspace": "The current session is not in a DSH workspace; add it to a workspace first",
  "trace.title": "Tavern Trace",
  "trace.intro": "A loader audit view alongside Conversation and Trajectory. The DSH request/header remains authoritative for the final system, tools, and effective config.",
  "trace.reading": "Reading audit records\u2026",
  "trace.empty": "This session has no Tavern request audit records yet. Send the next message and check again.",
  "trace.privacy": "Privacy boundary: this stores only resource summaries, configured/matched keywords, decision reasons, placement, budgets, and SHA-256 digests\u2014not resource bodies, full system text, chat history, header content, or tool payloads.",
  "trace.unused": "Not used",
  "trace.noSource": "This request has no auditable world-book source.",
  "trace.assembly": "Assembly and insertion",
  "trace.assemblyMeta": "{section} \xB7 order {order} \xB7 {mode} \xB7 {characters} characters \xB7 call config: {config}",
  "trace.worldBookDecisions": "World-book match decisions",
  "trace.historyOnly": "Matching uses durable session history visible during this step\u2019s system assembly; pending input was not appended a second time.",
  "trace.waitingHeader": "Waiting for authoritative header",
  "trace.pendingHeader": "No alignable DSH request/header has been observed; this does not mean the request was sent. The pending record remains after refresh.",
  "trace.round": "Turn {turn} \xB7 Step {step}",
  "trace.roundAttempt": "Turn {turn} \xB7 Step {step} \xB7 Attempt {attempt}",
  "trace.resource.preset": "Preset",
  "trace.resource.character": "Character",
  "trace.resource.user": "User",
  "trace.inserted": "Inserted",
  "trace.rejected": "Rejected",
  "trace.noConfiguredKeywords": "No configured keywords",
  "trace.noKeywordMatches": "No keyword matches",
  "trace.truncated": "; scan input was truncated to the configured limit",
  "trace.reusedHeader": " (reused previous header)",
  "trace.profile.missing": "Not found",
  "trace.profile.consistent": "Consistent",
  "trace.profile.absent": "No profile this request",
  "trace.config.inconsistent": "Inconsistent",
  "trace.config.consistent": "Consistent or no fields",
  "trace.position.approximate": " (approximate)",
  "trace.position.notInserted": " \u2192 not inserted",
  "trace.position.applied": " \u2192 {position}{approximate}",
  "trace.storage.total": "up to {value} total",
  "trace.storage.perSession": "up to {value} entries per session",
  "trace.storage.sessions": "up to {value} sessions",
  "trace.storage.perRecord": "up to {value} per entry",
  "trace.storage.summary": "Bounded plugin storage: {limits}. Restored after refresh or host restart.",
  "trace.keywords.primary": "Primary: {values}",
  "trace.keywords.secondary": "Secondary: {values}",
  "trace.keywords.configured": "Configured keywords: {value}",
  "trace.keywords.matched": "Matched this request: {value}",
  "trace.bookBudget": "Budget: {used}{limit} tokens \xB7 {decisionCount}",
  "trace.decisionCount.one": "{count} decision",
  "trace.decisionCount.other": "{count} decisions",
  "trace.decision.group": "Group {name}{detail}",
  "trace.decision.probability": "Probability {value}%{roll}",
  "trace.decision.budget": "Budget {value} tokens",
  "trace.decision.position": "Position {requested}{result}",
  "trace.recordAligned": "This record is aligned with DSH request/header #{sequence}{reused}. Tavern profile validation: {profile}; sampler fields: {config}.",
  "trace.activationPending": "Matching uses this step\u2019s temporary activation context: durable history + {included}/{pending} claimed messages from this turn; input bodies are not stored{truncated}.",
  "trace.diagnostics": "Diagnostics ({count})",
  "trace.reason.constant": "Always-active entry",
  "trace.reason.primary-key-match": "Primary keyword matched",
  "trace.reason.primary-key-miss": "Primary keyword missed",
  "trace.reason.secondary-and_any-match": "Any secondary keyword matched",
  "trace.reason.secondary-and_any-miss": "No secondary keyword matched",
  "trace.reason.secondary-and_all-match": "All secondary keywords matched",
  "trace.reason.secondary-and_all-miss": "Not all secondary keywords matched",
  "trace.reason.secondary-not_any-match": "Secondary exclusion condition passed",
  "trace.reason.secondary-not_any-miss": "Secondary keyword triggered exclusion",
  "trace.reason.secondary-not_all-match": "Secondary not-all condition passed",
  "trace.reason.secondary-not_all-miss": "All secondary keywords matched and excluded the entry",
  "trace.reason.disabled": "Entry disabled",
  "trace.reason.external-vector-match-required": "External vector match required",
  "trace.reason.inclusion-group-loser": "Did not win the inclusion group",
  "trace.reason.probability-failed": "Rejected by probability check",
  "trace.reason.budget-exceeded": "Token budget exceeded",
  "trace.reason.empty-content": "Empty body; not inserted",
  "trace.reason.outlet-unsupported": "Outlet has no stable insertion seam"
});

// packages/client/src/i18n/catalogs/index.js
var PRODUCTION_CATALOGS = Object.freeze({
  "zh-CN": zh_CN_default,
  en: en_default
});

// packages/client/src/i18n/runtime.js
var DEFAULT_UI_SETTINGS = Object.freeze({ locale: DEFAULT_UI_LOCALE, scale: 1, rpFollowCharacter: true });
var UI_SCALE_OPTIONS = Object.freeze([0.75, 0.85, 1, 1.15, 1.25, 1.5]);
var RAW_TEXT = /* @__PURE__ */ Symbol("dsh-tavern.raw-text");
var catalogs = PRODUCTION_CATALOGS;
var current = { ...DEFAULT_UI_SETTINGS };
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function catalogKeys(catalog2) {
  return Object.keys(catalog2 ?? {}).toSorted();
}
function assertCatalogParity(catalog2, locale, expectedKeys = catalogKeys(catalogs[DEFAULT_UI_LOCALE] ?? PRODUCTION_CATALOGS[DEFAULT_UI_LOCALE])) {
  if (!isRecord(catalog2)) throw new TypeError(`UI message catalog ${locale} must be an object`);
  const actual = catalogKeys(catalog2);
  if (JSON.stringify(actual) !== JSON.stringify(expectedKeys)) {
    throw new TypeError(`UI message catalog ${locale} does not have the same keys as ${DEFAULT_UI_LOCALE}`);
  }
  for (const key of actual) {
    if (typeof catalog2[key] !== "string") {
      throw new TypeError(`UI message catalog ${locale} key ${JSON.stringify(key)} must be a string`);
    }
  }
  return true;
}
function assertCompleteMessageCatalogs(source) {
  const expected = catalogKeys(source[DEFAULT_UI_LOCALE]);
  if (expected.length === 0) throw new TypeError(`Missing UI message catalog for ${DEFAULT_UI_LOCALE}`);
  for (const locale of Object.keys(source)) {
    assertCatalogParity(source[locale], locale, expected);
  }
}
assertCompleteMessageCatalogs(PRODUCTION_CATALOGS);
function fill(template, values) {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_match, key) => String(values?.[key] ?? ""));
}
function templateFor(key, locale) {
  const currentCatalog = catalogs[locale];
  const defaultCatalog = catalogs[DEFAULT_UI_LOCALE];
  if (typeof currentCatalog?.[key] === "string") return currentCatalog[key];
  if (typeof defaultCatalog?.[key] === "string") return defaultCatalog[key];
  if (typeof defaultCatalog?.["common.unavailable"] === "string") return defaultCatalog["common.unavailable"];
  if (typeof currentCatalog?.["common.unavailable"] === "string") return currentCatalog["common.unavailable"];
  return "";
}
function translate(key, values = {}) {
  return fill(templateFor(key, current.locale), values);
}
function rawText(value) {
  return Object.freeze({
    [RAW_TEXT]: true,
    value: value === null || value === void 0 ? "" : String(value),
    toString() {
      return this.value;
    }
  });
}
function uiMessage(key, values = {}) {
  return rawText(translate(key, values));
}
function statusText(status) {
  if (status?.error && !status.key) return rawText(status.text);
  return uiMessage(status?.key ?? "common.unavailable", status?.values);
}
function uiError(key, values = {}) {
  const error = new Error(translate(key, values));
  error.uiKey = key;
  error.uiValues = values;
  return error;
}
function isRawText(value) {
  return value?.[RAW_TEXT] === true && typeof value.value === "string";
}
function unwrapText(value) {
  return isRawText(value) ? value.value : String(value ?? "");
}
function localizeChild(value) {
  if (isRawText(value)) return value.value;
  if (Array.isArray(value)) return value.map(localizeChild);
  return value;
}
function createLocalizedElement(createElement15) {
  return (type, props, ...children) => {
    let localizedProps = props;
    if (props !== null && props !== void 0) {
      localizedProps = { ...props };
      for (const key of ["title", "aria-label", "placeholder", "alt"]) {
        if (isRawText(localizedProps[key])) localizedProps[key] = localizedProps[key].value;
      }
    }
    return createElement15(type, localizedProps, ...children.map(localizeChild));
  };
}
function getClientUiSettings() {
  return { ...current };
}
function setClientUiSettings(value, { announce = true } = {}) {
  const requested = value?.locale;
  const locale = catalogs[requested] !== void 0 ? requested : isSupportedUiLocale(requested) ? requested : DEFAULT_UI_SETTINGS.locale;
  const numericScale = Number(value?.scale);
  const scale = Number.isFinite(numericScale) && numericScale >= 0.75 && numericScale <= 1.5 ? Number(numericScale.toFixed(2)) : DEFAULT_UI_SETTINGS.scale;
  const rpFollowCharacter = value?.rpFollowCharacter !== false;
  current = { locale, scale, rpFollowCharacter };
  if (announce && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CLIENT_UI_SETTINGS_EVENT, { detail: getClientUiSettings() }));
  }
  return getClientUiSettings();
}

// packages/preset/src/client.js
var import_react = require("react");

// packages/preset/src/client-state.js
function reorder(items, from, to) {
  if (!Array.isArray(items)) throw new TypeError("items must be an array");
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) return items;
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const result = [...items];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
}
function reorderAtBoundary(items, from, boundary) {
  if (!Number.isSafeInteger(boundary) || boundary < 0 || boundary > items.length) return items;
  const destination = boundary > from ? boundary - 1 : boundary;
  return reorder(items, from, destination);
}

// packages/preset/src/client.js
var h = createLocalizedElement(import_react.createElement);
function announceTavernRefresh() {
  window.dispatchEvent(new CustomEvent(CLIENT_REFRESH_EVENT, { detail: { source: "preset" } }));
}
var ST_NUMBER_FIELDS = [
  ["top_p", "preset.sampling.topP"],
  ["top_k", "preset.sampling.topK"],
  ["top_a", "preset.sampling.topA"],
  ["min_p", "preset.sampling.minP"],
  ["frequency_penalty", "preset.sampling.frequencyPenalty"],
  ["presence_penalty", "preset.sampling.presencePenalty"],
  ["repetition_penalty", "preset.sampling.repetitionPenalty"],
  ["seed", "preset.sampling.seed"]
];
var css = `
.dtt-root{height:100%;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:Inter,var(--dsw-font-family),sans-serif}
.dtt-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.dtt-title{font-size:16px;font-weight:650;flex:1;min-width:0}.dtt-active{font-size:13px;color:var(--dsw-alias-state-success);margin-left:7px}
.dtt-icon{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dtt-icon:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtt-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.dtt-toolbar,.dtt-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtt-button{height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:0 10px;font-size:13px}.dtt-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtt-button:disabled{opacity:.5;cursor:default}.dtt-button-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dtt-danger{color:var(--dsw-alias-state-error)}
.dtt-field{display:flex;flex-direction:column;gap:5px}.dtt-label{font-size:12px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dtt-input,.dtt-select,.dtt-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}.dtt-input,.dtt-select{height:36px;padding:0 9px}.dtt-textarea{min-height:110px;resize:vertical;padding:8px;line-height:1.5}.dtt-input:focus,.dtt-select:focus,.dtt-textarea:focus{border-color:var(--dsw-alias-state-business-primary)}
.dtt-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.dtt-section{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dtt-section-title{font-size:14px;font-weight:650;display:flex;align-items:center;justify-content:space-between}
.dtt-note{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0}.dtt-status{font-size:13px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);word-break:break-word}.dtt-status[data-error=true]{color:var(--dsw-alias-state-error)}.dtt-status[data-warning=true]{color:var(--dsw-alias-state-warning,var(--dsw-alias-label-primary))}
.dtt-prompts{display:flex;flex-direction:column;gap:7px}.dtt-prompt{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden;transition:border-color .12s,box-shadow .12s}.dtt-prompt[data-dragging=true]{height:4px;min-height:4px;margin:5px 10px;border:0;border-radius:999px;background:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 25%,transparent)}.dtt-prompt[data-dragging=true]>*{opacity:0}.dtt-drop-placeholder{box-sizing:border-box;height:42px;border:2px dashed var(--dsw-alias-state-business-primary);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 7%,transparent);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-state-business-primary);font-size:12px;font-weight:600;pointer-events:none}.dtt-prompt-summary{display:flex;align-items:center;gap:7px;padding:8px;cursor:pointer;font-size:13px}.dtt-prompt-summary::marker{color:var(--dsw-alias-label-tertiary)}.dtt-drag{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:grab;padding:1px 2px;font-size:15px;line-height:1;touch-action:none;user-select:none}.dtt-drag:active{cursor:grabbing}.dtt-prompt-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dtt-role{font-size:12px;color:var(--dsw-alias-label-tertiary);text-transform:uppercase}.dtt-prompt-body{padding:0 9px 9px;display:flex;flex-direction:column;gap:8px}.dtt-row-actions{display:flex;gap:6px}.dtt-row-actions .dtt-button{height:30px;padding:0 8px;flex:1}
.dtt-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2);display:grid;grid-template-columns:1fr auto;gap:8px}
`;
async function api(path, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  const response = await fetch(`${API_V1}${path}`, {
    ...options,
    headers: {
      ...method === "GET" || method === "HEAD" ? {} : { "Content-Type": "application/json" },
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
  if (!response.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}
function body(value) {
  return JSON.stringify(value);
}
function Field({ label, children }) {
  return h(
    "label",
    { className: "dtt-field" },
    h("span", { className: "dtt-label" }, label),
    children
  );
}
function NumberField({ label, value, onChange, min, step = "any" }) {
  return h(Field, { label }, h("input", {
    className: "dtt-input",
    type: "number",
    value: value ?? "",
    min,
    step,
    onChange: (event) => onChange(event.target.value === "" ? void 0 : Number(event.target.value))
  }));
}
function PromptEditor({ prompt, index, dragging, onPatch, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDelete }) {
  return h(
    "details",
    {
      className: "dtt-prompt",
      "data-prompt-index": index,
      "data-dragging": dragging || void 0
    },
    h(
      "summary",
      { className: "dtt-prompt-summary" },
      h("button", {
        className: "dtt-drag",
        type: "button",
        title: uiMessage("preset.dragOrder"),
        "aria-label": uiMessage("preset.dragNamed", { name: prompt.name || prompt.identifier }),
        "aria-pressed": dragging,
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
        },
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel
      }, "\u283F"),
      h("input", {
        type: "checkbox",
        checked: prompt.enabled === true,
        disabled: prompt.marker === true,
        title: prompt.marker === true ? uiMessage("preset.markerHint") : uiMessage("preset.enablePrompt"),
        onClick: (event) => event.stopPropagation(),
        onChange: (event) => onPatch({ enabled: event.target.checked })
      }),
      h("span", { className: "dtt-prompt-name" }, rawText(prompt.name || prompt.identifier)),
      h("span", { className: "dtt-role" }, rawText(prompt.marker ? "marker" : prompt.role))
    ),
    h(
      "div",
      { className: "dtt-prompt-body" },
      h(Field, { label: uiMessage("common.name") }, h("input", {
        className: "dtt-input",
        value: prompt.name,
        onChange: (event) => onPatch({ name: event.target.value })
      })),
      h(Field, { label: uiMessage("common.role") }, h(
        "select",
        {
          className: "dtt-select",
          value: prompt.role,
          disabled: prompt.marker === true,
          onChange: (event) => onPatch({ role: event.target.value })
        },
        h("option", { value: "system" }, uiMessage("preset.role.system")),
        h("option", { value: "user" }, uiMessage("preset.role.user")),
        h("option", { value: "assistant" }, uiMessage("preset.role.assistant"))
      )),
      h(Field, { label: uiMessage("common.content") }, h("textarea", {
        className: "dtt-textarea",
        value: prompt.content,
        disabled: prompt.marker === true,
        onChange: (event) => onPatch({ content: event.target.value })
      })),
      h(
        "div",
        { className: "dtt-row-actions" },
        h("button", { className: "dtt-button dtt-danger", type: "button", onClick: onDelete }, uiMessage("common.delete"))
      )
    )
  );
}
function DropPlaceholder() {
  return h("div", {
    className: "dtt-drop-placeholder",
    "aria-hidden": true
  }, uiMessage("preset.dropHere"));
}
function insertionBoundary(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-prompt-index]");
  if (target === null) return null;
  const index = Number(target.dataset.promptIndex);
  const bounds = target.getBoundingClientRect();
  return event.clientY < bounds.top + bounds.height / 2 ? index : index + 1;
}
function PresetSidebar({ closePanel, openPanel, sessionId, sessionBlank, autoOpen = true }) {
  const [catalog2, setCatalog] = (0, import_react.useState)(null);
  const [draft, setDraft] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [status, setStatus] = (0, import_react.useState)({ error: false, key: "common.loading" });
  const [advanced, setAdvanced] = (0, import_react.useState)(false);
  const [dragFrom, setDragFrom] = (0, import_react.useState)(null);
  const [dropIndex, setDropIndex] = (0, import_react.useState)(null);
  const fileRef = (0, import_react.useRef)(null);
  const refreshGeneration = (0, import_react.useRef)(0);
  (0, import_react.useEffect)(() => {
    if (!autoOpen) return void 0;
    const timers = [0, 200, 800].map((delay) => window.setTimeout(openPanel, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [autoOpen]);
  const run = (0, import_react.useCallback)(async (operation, successKey) => {
    setBusy(true);
    try {
      const result = await operation();
      setStatus({ error: false, key: successKey });
      return result;
    } catch (error) {
      setStatus(error?.uiKey ? { error: true, key: error.uiKey, values: error.uiValues } : { error: true, text: error instanceof Error ? error.message : String(error) });
      return null;
    } finally {
      setBusy(false);
    }
  }, []);
  const refresh = (0, import_react.useCallback)(async (preferredId) => {
    const generation = ++refreshGeneration.current;
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    const data = await api(`/presets${query}`);
    const id = preferredId === void 0 ? data.selectedId ?? data.presets[0]?.id ?? null : preferredId;
    const detail = id === null || id === void 0 ? null : (await api(`/presets/${encodeURIComponent(id)}`)).preset;
    if (generation !== refreshGeneration.current) return false;
    setCatalog(data);
    setDraft(detail);
    return true;
  }, [sessionId]);
  (0, import_react.useEffect)(() => {
    refreshGeneration.current += 1;
    setCatalog(null);
    setDraft(null);
    setStatus({ error: false, key: "preset.status.syncing" });
    run(() => refresh(), "preset.status.loaded");
    return () => {
      refreshGeneration.current += 1;
    };
  }, [refresh, run, sessionId]);
  (0, import_react.useEffect)(() => {
    const onRefresh = (event) => {
      if (event.detail?.source === "preset") return;
      run(() => refresh(), "preset.status.refreshed");
    };
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh);
  }, [refresh, run]);
  const browse = (0, import_react.useCallback)((id) => run(async () => {
    const detail = await api(`/presets/${encodeURIComponent(id)}`);
    setDraft(detail.preset);
  }, "preset.status.detailsLoaded"), [run]);
  const bind = (0, import_react.useCallback)(() => run(async () => {
    if (!sessionId) throw uiError("preset.error.needSession");
    if (draft === null) throw uiError("preset.error.needPreset");
    if (catalog2?.selectedId !== draft.id && catalog2?.selectedId !== null && sessionBlank === false && !window.confirm(unwrapText(uiMessage("preset.confirmHistoricalSwitch")))) return;
    await api("/select", { method: "POST", body: body({ id: draft.id, sessionId }) });
    await refresh(draft.id);
    announceTavernRefresh();
  }, "preset.status.bound"), [catalog2?.selectedId, draft, refresh, run, sessionBlank, sessionId]);
  const unbind = (0, import_react.useCallback)(() => run(async () => {
    if (!sessionId) throw uiError("preset.error.noSessionToUnbind");
    await api("/select", { method: "POST", body: body({ id: null, sessionId }) });
    await refresh(draft?.id);
    announceTavernRefresh();
  }, "preset.status.unbound"), [draft?.id, refresh, run, sessionId]);
  const createPreset = (0, import_react.useCallback)(() => run(async () => {
    const created = await api("/presets", { method: "POST", body: body({ name: translate("preset.defaultName") }) });
    await refresh(created.preset.id);
    announceTavernRefresh();
  }, "preset.status.created"), [refresh, run]);
  const importFile = (0, import_react.useCallback)((file) => run(async () => {
    const content = await file.text();
    const imported = await api("/import", {
      method: "POST",
      body: body({ name: file.name.replace(/\.json$/i, ""), content })
    });
    await refresh(imported.preset.id);
    announceTavernRefresh();
    if (fileRef.current !== null) fileRef.current.value = "";
  }, "preset.status.imported"), [refresh, run]);
  const save = (0, import_react.useCallback)(() => run(async () => {
    const result = await api(`/presets/${encodeURIComponent(draft.id)}`, {
      method: "PUT",
      body: body({ name: draft.name, systemPromptMode: draft.systemPromptMode, sampling: draft.sampling, prompts: draft.prompts })
    });
    setDraft(result.preset);
    await refresh(result.preset.id);
    announceTavernRefresh();
  }, "preset.status.saved"), [draft, refresh, run]);
  const remove = (0, import_react.useCallback)(() => run(async () => {
    if (!window.confirm(unwrapText(uiMessage("preset.confirmDelete", { name: draft.name })))) return;
    await api(`/presets/${encodeURIComponent(draft.id)}`, { method: "DELETE" });
    await refresh();
    announceTavernRefresh();
  }, "preset.status.deleted"), [draft, refresh, run]);
  const patchSampling = (patch) => setDraft((current2) => ({
    ...current2,
    sampling: { ...current2.sampling, ...patch }
  }));
  const patchSt = (key, value) => patchSampling({
    st: { ...draft.sampling.st, [key]: value }
  });
  const patchPrompt = (index, patch) => setDraft((current2) => ({
    ...current2,
    prompts: current2.prompts.map((prompt, at) => at === index ? { ...prompt, ...patch } : prompt)
  }));
  const movePrompt = (from, boundary) => setDraft((current2) => {
    const prompts = reorderAtBoundary(current2.prompts, from, boundary);
    if (prompts === current2.prompts) return current2;
    return { ...current2, prompts };
  });
  const deletePrompt = (index) => setDraft((current2) => ({
    ...current2,
    prompts: current2.prompts.filter((_prompt, at) => at !== index)
  }));
  const addPrompt = () => setDraft((current2) => ({
    ...current2,
    prompts: [...current2.prompts, {
      identifier: `prompt-${Date.now().toString(36)}`,
      name: translate("preset.defaultPromptName"),
      role: "system",
      content: "",
      enabled: true,
      marker: false,
      systemPrompt: false,
      st: {}
    }]
  }));
  const closeLabel = uiMessage("panel.close", { title: unwrapText(uiMessage("preset.title")) });
  return h(
    "div",
    { className: "dtt-root" },
    h(
      "div",
      { className: "dtt-header" },
      h("div", { className: "dtt-title" }, uiMessage("preset.title"), catalog2?.selectedId ? h("span", { className: "dtt-active" }, uiMessage("preset.active")) : null),
      h("button", { className: "dtt-icon", type: "button", title: closeLabel, "aria-label": closeLabel, onClick: closePanel }, "\u2715")
    ),
    h(
      "div",
      { className: "dtt-body" },
      h(
        "div",
        { className: "dtt-toolbar" },
        h("button", { className: "dtt-button", type: "button", disabled: busy, onClick: () => fileRef.current?.click() }, uiMessage("preset.importStJson")),
        h("button", { className: "dtt-button", type: "button", disabled: busy, onClick: createPreset }, uiMessage("preset.create")),
        h("input", {
          ref: fileRef,
          hidden: true,
          type: "file",
          accept: ".json,application/json",
          onChange: (event) => {
            const file = event.target.files?.[0];
            if (file !== void 0) importFile(file);
          }
        })
      ),
      h(Field, { label: uiMessage("preset.browse") }, h(
        "select",
        {
          className: "dtt-select",
          value: draft?.id ?? "",
          disabled: busy || catalog2 === null || catalog2.presets.length === 0,
          onChange: (event) => browse(event.target.value)
        },
        ...catalog2?.presets.length ? [] : [h("option", { key: "empty", value: "" }, uiMessage("preset.libraryEmpty"))],
        ...(catalog2?.presets ?? []).map((preset) => h("option", { key: preset.id, value: preset.id }, rawText(`${preset.name} (${preset.enabledPromptCount}/${preset.promptCount})`)))
      )),
      catalog2 === null ? null : catalog2.selectedId === null ? h("p", { className: "dtt-note" }, uiMessage("preset.unboundNote")) : h("p", { className: "dtt-note" }, uiMessage("preset.currentSessionBound", { name: catalog2.presets.find((item) => item.id === catalog2.selectedId)?.name ?? catalog2.selectedId })),
      draft !== null && draft.id !== catalog2?.selectedId ? h("div", { className: "dtt-status", "data-warning": true }, uiMessage("preset.browsingUnbound", { name: draft.name })) : null,
      h(
        "div",
        { className: "dtt-actions" },
        h("button", { className: "dtt-button dtt-button-primary", type: "button", disabled: busy || !sessionId || draft === null, onClick: bind }, catalog2?.selectedId === draft?.id ? uiMessage("preset.bindUpdate") : uiMessage("preset.bind")),
        h("button", { className: "dtt-button", type: "button", disabled: busy || !sessionId || catalog2?.selectedId == null, onClick: unbind }, uiMessage("preset.unbind"))
      ),
      h("div", { className: "dtt-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, statusText(status)),
      draft === null ? h("p", { className: "dtt-note" }, catalog2 === null ? uiMessage("preset.loading") : uiMessage("preset.emptyHint")) : h(
        "div",
        { className: "dtt-section" },
        h("div", { className: "dtt-section-title" }, uiMessage("preset.basicSettings")),
        h(Field, { label: uiMessage("preset.name") }, h("input", {
          className: "dtt-input",
          value: draft.name,
          onChange: (event) => setDraft((current2) => ({ ...current2, name: event.target.value }))
        })),
        h(
          "div",
          { className: "dtt-grid" },
          h(NumberField, { label: uiMessage("preset.temperature"), value: draft.sampling.temperature, onChange: (temperature) => patchSampling({ temperature }), min: 0 }),
          h(NumberField, { label: uiMessage("preset.maxTokens"), value: draft.sampling.maxTokens, onChange: (maxTokens) => patchSampling({ maxTokens }), min: 1, step: 1 })
        ),
        h(Field, { label: uiMessage("preset.reasoningEffort") }, h(
          "select",
          {
            className: "dtt-select",
            value: draft.sampling.reasoningEffort ?? "",
            onChange: (event) => patchSampling({ reasoningEffort: event.target.value || void 0 })
          },
          h("option", { value: "" }, uiMessage("preset.modelDefault")),
          h("option", { value: "low" }, uiMessage("preset.effort.low")),
          h("option", { value: "medium" }, uiMessage("preset.effort.medium")),
          h("option", { value: "high" }, uiMessage("preset.effort.high")),
          h("option", { value: "xhigh" }, uiMessage("preset.effort.xhigh"))
        )),
        h("button", { className: "dtt-button", type: "button", onClick: () => setAdvanced((value) => !value) }, advanced ? uiMessage("preset.advancedHide") : uiMessage("preset.advancedShow")),
        advanced ? h("div", { className: "dtt-grid" }, ...ST_NUMBER_FIELDS.map(([key, messageKey]) => h(NumberField, {
          key,
          label: uiMessage(messageKey),
          value: draft.sampling.st?.[key],
          onChange: (value) => patchSt(key, value)
        }))) : null,
        advanced ? h("p", { className: "dtt-note" }, uiMessage("preset.advancedNote")) : null,
        advanced ? h(Field, { label: uiMessage("preset.systemPrompt") }, h(
          "select",
          {
            className: "dtt-select",
            value: draft.systemPromptMode === "replace" ? "replace" : "append",
            onChange: (event) => setDraft((current2) => ({ ...current2, systemPromptMode: event.target.value }))
          },
          h("option", { value: "append" }, uiMessage("preset.systemAppend")),
          h("option", { value: "replace" }, uiMessage("preset.systemReplace"))
        )) : null,
        advanced && draft.systemPromptMode === "replace" ? h("p", { className: "dtt-status", "data-error": true }, uiMessage("preset.replaceWarning")) : null,
        h(
          "div",
          { className: "dtt-section" },
          h(
            "div",
            { className: "dtt-section-title" },
            h("span", null, uiMessage("preset.prompts", { count: draft.prompts.length })),
            h("button", { className: "dtt-button", type: "button", onClick: addPrompt }, uiMessage("preset.addPrompt"))
          ),
          h(
            "div",
            { className: "dtt-prompts" },
            ...draft.prompts.flatMap((prompt, index) => [
              dragFrom !== null && dropIndex === index ? h(DropPlaceholder, { key: `drop-${index}` }) : null,
              h(PromptEditor, {
                key: `${prompt.identifier}-${index}`,
                prompt,
                index,
                dragging: dragFrom === index,
                onPatch: (patch) => patchPrompt(index, patch),
                onPointerDown: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDragFrom(index);
                  setDropIndex(index + 1);
                },
                onPointerMove: (event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  const boundary = insertionBoundary(event);
                  if (boundary !== null) setDropIndex(boundary);
                },
                onPointerUp: (event) => {
                  event.preventDefault();
                  const boundary = insertionBoundary(event) ?? dropIndex ?? index + 1;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                  movePrompt(index, boundary);
                  setDragFrom(null);
                  setDropIndex(null);
                },
                onPointerCancel: () => {
                  setDragFrom(null);
                  setDropIndex(null);
                },
                onDelete: () => deletePrompt(index)
              })
            ]),
            dragFrom !== null && dropIndex === draft.prompts.length ? h(DropPlaceholder, { key: "drop-end" }) : null
          )
        ),
        h(
          "div",
          { className: "dtt-footer" },
          h("button", { className: "dtt-button dtt-button-primary", type: "button", disabled: busy, onClick: save }, busy ? uiMessage("common.working") : uiMessage("common.saveChanges")),
          h("button", { className: "dtt-button dtt-danger", type: "button", disabled: busy, onClick: remove }, uiMessage("common.delete"))
        )
      )
    )
  );
}
function installPresetStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = PLUGIN_ID;
  style.textContent = css;
  document.head.append(style);
}

// packages/character/src/client.js
var import_react2 = require("react");

// packages/character/src/client-state.js
function characterGreetingOptions(character) {
  if (character === null || typeof character !== "object") return [];
  const first = typeof character.data?.firstMessage === "string" ? character.data.firstMessage : "";
  const alternates = Array.isArray(character.data?.alternateGreetings) ? character.data.alternateGreetings.filter((item) => typeof item === "string") : [];
  return [
    { index: 0, labelKey: first === "" ? "character.greeting.defaultEmpty" : "character.greeting.default", text: first },
    ...alternates.map((text2, index) => ({
      index: index + 1,
      labelKey: "character.greeting.alternate",
      labelValues: { index: index + 1 },
      text: text2
    }))
  ];
}
function defaultCharacterSelection(characterCardId) {
  return {
    characterCardId,
    character: {
      greetingIndex: 0,
      preferCharacterSystemPrompt: true,
      preferCharacterPostHistory: true
    }
  };
}
function characterBindingOptions(value) {
  const options = value !== null && typeof value === "object" && value.character !== null && typeof value.character === "object" ? value.character : {};
  return {
    greetingIndex: Number(options.greetingIndex ?? 0),
    preferCharacterSystemPrompt: options.preferCharacterSystemPrompt !== false,
    preferCharacterPostHistory: options.preferCharacterPostHistory !== false
  };
}
function characterBindingDirty(selection, binding) {
  if (selection === null || typeof selection !== "object" || binding === null || typeof binding !== "object") return false;
  if (selection.characterCardId !== binding.characterCardId) return false;
  const applied = characterBindingOptions(selection);
  const pending = characterBindingOptions(binding);
  return applied.greetingIndex !== pending.greetingIndex || applied.preferCharacterSystemPrompt !== pending.preferCharacterSystemPrompt || applied.preferCharacterPostHistory !== pending.preferCharacterPostHistory;
}
function characterEditorDraft(character) {
  if (character === null || typeof character !== "object") return null;
  const data = character.data ?? {};
  return {
    name: typeof data.name === "string" ? data.name : "",
    nickname: typeof data.nickname === "string" ? data.nickname : "",
    description: typeof data.description === "string" ? data.description : "",
    personality: typeof data.personality === "string" ? data.personality : "",
    scenario: typeof data.scenario === "string" ? data.scenario : "",
    firstMessage: typeof data.firstMessage === "string" ? data.firstMessage : "",
    alternateGreetings: Array.isArray(data.alternateGreetings) ? data.alternateGreetings.filter((item) => typeof item === "string") : [],
    messageExample: typeof data.messageExample === "string" ? data.messageExample : "",
    creatorNotes: typeof data.creatorNotes === "string" ? data.creatorNotes : "",
    systemPrompt: typeof data.systemPrompt === "string" ? data.systemPrompt : "",
    postHistoryInstructions: typeof data.postHistoryInstructions === "string" ? data.postHistoryInstructions : "",
    tagsText: Array.isArray(data.tags) ? data.tags.filter((item) => typeof item === "string").join(", ") : "",
    creator: typeof data.creator === "string" ? data.creator : "",
    characterVersion: typeof data.characterVersion === "string" ? data.characterVersion : ""
  };
}
function characterEditorDirty(draft, saved) {
  return JSON.stringify(draft) !== JSON.stringify(saved);
}
function characterEditorPatch(draft) {
  return {
    name: draft.name,
    nickname: draft.nickname,
    description: draft.description,
    personality: draft.personality,
    scenario: draft.scenario,
    firstMessage: draft.firstMessage,
    alternateGreetings: [...draft.alternateGreetings],
    messageExample: draft.messageExample,
    creatorNotes: draft.creatorNotes,
    systemPrompt: draft.systemPrompt,
    postHistoryInstructions: draft.postHistoryInstructions,
    tags: draft.tagsText.split(",").map((item) => item.trim()).filter(Boolean),
    creator: draft.creator,
    characterVersion: draft.characterVersion
  };
}

// packages/character/src/client.js
var h2 = createLocalizedElement(import_react2.createElement);
function announceTavernRefresh2() {
  window.dispatchEvent(new CustomEvent(CLIENT_REFRESH_EVENT, { detail: { source: "character" } }));
}
var css2 = `
.dcc-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dcc-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dcc-title{font-size:16px;font-weight:650;flex:1}.dcc-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px;font-size:14px}.dcc-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dcc-toolbar{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.dcc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dcc-button{min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:13px;text-decoration:none;display:flex;align-items:center;justify-content:center;box-sizing:border-box}.dcc-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dcc-button:disabled{opacity:.5;cursor:default}.dcc-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dcc-danger{color:var(--dsw-alias-state-error)}.dcc-field{display:flex;flex-direction:column;gap:5px}.dcc-label{font-size:12px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dcc-select,.dcc-input,.dcc-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}.dcc-select,.dcc-input{height:36px;padding:0 9px}.dcc-textarea{min-height:88px;resize:vertical;padding:8px;line-height:1.5}.dcc-note,.dcc-meta{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dcc-status{font-size:13px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dcc-status[data-error=true]{color:var(--dsw-alias-state-error)}.dcc-status[data-warning=true]{color:var(--dsw-alias-state-warning,var(--dsw-alias-label-primary))}.dcc-card{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dcc-card-head{display:flex;gap:11px}.dcc-avatar{width:76px;height:100px;object-fit:cover;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-container);flex:none}.dcc-card-title{font-size:16px;font-weight:650;margin:0 0 5px}.dcc-check{display:flex;gap:7px;align-items:flex-start;font-size:13px;line-height:1.4}.dcc-detail{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px}.dcc-detail summary{cursor:pointer;font-size:13px;font-weight:600}.dcc-detail-body{display:flex;flex-direction:column;gap:8px;margin-top:8px}.dcc-diags{margin:7px 0 0;padding-left:18px;font-size:13px;line-height:1.5}.dcc-greetings{display:flex;flex-direction:column;gap:8px}.dcc-greeting-item{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px}.dcc-greeting-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.dcc-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2)}
`;
function errorMessage(data, status) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.error?.message === "string") return data.error.message;
  return `HTTP ${status}`;
}
async function api2(path, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  const response = await fetch(`${API_V1}${path}`, {
    ...options,
    headers: {
      ...method === "GET" || method === "HEAD" ? {} : { "Content-Type": "application/json" },
      ...options.headers
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(errorMessage(data, response.status));
  return data;
}
function Field2({ label, children }) {
  return h2("label", { className: "dcc-field" }, h2("span", { className: "dcc-label" }, label), children);
}
function DiagnosticList({ titleKey, items }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return h2(
    "details",
    { className: "dcc-detail" },
    h2("summary", null, uiMessage(titleKey, { count: items.length })),
    h2("ul", { className: "dcc-diags" }, ...items.map((item, index) => h2("li", { key: `${item.code}-${index}` }, rawText(`${item.message}${item.path ? ` [${item.path}]` : ""}`))))
  );
}
function patchDraft(setter, field, value) {
  setter((current2) => current2 === null ? current2 : { ...current2, [field]: value });
}
function CharacterPanel({ sessionId, sessionBlank, hasConversationHistory, close }) {
  const [catalog2, setCatalog] = (0, import_react2.useState)(null);
  const [detail, setDetail] = (0, import_react2.useState)(null);
  const [draft, setDraft] = (0, import_react2.useState)(null);
  const [savedDraft, setSavedDraft] = (0, import_react2.useState)(null);
  const [selection, setSelection] = (0, import_react2.useState)(null);
  const [binding, setBinding] = (0, import_react2.useState)(null);
  const [rp, setRp] = (0, import_react2.useState)({ active: false });
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [status, setStatus] = (0, import_react2.useState)({ error: false, key: "common.loading" });
  const fileRef = (0, import_react2.useRef)(null);
  const refreshGeneration = (0, import_react2.useRef)(0);
  const dirtyRef = (0, import_react2.useRef)(false);
  const dirty = characterEditorDirty(draft, savedDraft);
  dirtyRef.current = dirty;
  const applyCharacter = (0, import_react2.useCallback)((character, currentSelection) => {
    const nextDraft = characterEditorDraft(character);
    setDetail(character);
    setDraft(nextDraft);
    setSavedDraft(nextDraft === null ? null : structuredClone(nextDraft));
    setBinding(currentSelection?.characterCardId === character?.id ? currentSelection : character === null ? null : defaultCharacterSelection(character.id));
  }, []);
  const run = (0, import_react2.useCallback)(async (operation, successKey) => {
    setBusy(true);
    try {
      const result = await operation();
      setStatus({ error: false, key: successKey });
      return result;
    } catch (error) {
      setStatus(error?.uiKey ? { error: true, key: error.uiKey, values: error.uiValues } : { error: true, text: error instanceof Error ? error.message : String(error) });
      return null;
    } finally {
      setBusy(false);
    }
  }, []);
  const loadDetail = (0, import_react2.useCallback)(async (id) => {
    const generation = ++refreshGeneration.current;
    if (id === null || id === void 0 || id === "") {
      applyCharacter(null, null);
      return;
    }
    const data = await api2(`/characters/${encodeURIComponent(id)}`);
    if (generation !== refreshGeneration.current) return;
    applyCharacter(data.character, selection);
  }, [applyCharacter, selection]);
  const refresh = (0, import_react2.useCallback)(async (preferredId) => {
    const generation = ++refreshGeneration.current;
    const list = await api2("/characters");
    let currentSelection = null;
    let currentRp = { active: false };
    if (sessionId) {
      const selected = await api2(`/character-selection?sessionId=${encodeURIComponent(sessionId)}`);
      currentSelection = selected.selection;
      const rpData = await api2(`/rp-mode?sessionId=${encodeURIComponent(sessionId)}`);
      currentRp = rpData.rp ?? { active: false };
    }
    if (generation !== refreshGeneration.current) return;
    setCatalog(list);
    setSelection(currentSelection);
    setRp(currentRp);
    const id = preferredId ?? currentSelection?.characterCardId ?? list.characters[0]?.id ?? null;
    if (id === null) {
      applyCharacter(null, null);
      return;
    }
    const data = await api2(`/characters/${encodeURIComponent(id)}`);
    if (generation !== refreshGeneration.current) return;
    applyCharacter(data.character, currentSelection);
  }, [applyCharacter, sessionId]);
  (0, import_react2.useEffect)(() => {
    run(() => refresh(), "character.status.loaded");
    return () => {
      refreshGeneration.current += 1;
    };
  }, [refresh, run]);
  (0, import_react2.useEffect)(() => {
    const onRefresh = (event) => {
      if (event.detail?.source === "character") return;
      if (dirtyRef.current) {
        setStatus({ error: false, key: "character.status.skippedRefresh" });
        return;
      }
      run(() => refresh(detail?.id), "character.status.refreshed");
    };
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh);
  }, [detail?.id, refresh, run]);
  (0, import_react2.useEffect)(() => {
    if (!dirty) return void 0;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const create2 = (0, import_react2.useCallback)(() => {
    if (dirty && !window.confirm(unwrapText(uiMessage("character.confirmDiscardForCreate")))) return;
    run(async () => {
      const data = await api2("/characters", { method: "POST", body: JSON.stringify({ name: translate("character.defaultName") }) });
      await refresh(data.character.id);
      announceTavernRefresh2();
    }, "character.status.created");
  }, [dirty, refresh, run]);
  const importFile = (0, import_react2.useCallback)((file) => run(async () => {
    const response = await fetch(`${API_V1}/characters/import?filename=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) throw new Error(errorMessage(data, response.status));
    await refresh(data.character.id);
    announceTavernRefresh2();
    if (fileRef.current !== null) fileRef.current.value = "";
  }, "character.status.imported"), [refresh, run]);
  const save = (0, import_react2.useCallback)(() => run(async () => {
    if (detail === null || draft === null) return;
    const data = await api2(`/characters/${encodeURIComponent(detail.id)}`, {
      method: "PATCH",
      body: JSON.stringify(characterEditorPatch(draft))
    });
    const nextDraft = characterEditorDraft(data.character);
    setDetail(data.character);
    setDraft(nextDraft);
    setSavedDraft(structuredClone(nextDraft));
    setCatalog((current2) => current2 === null ? current2 : {
      ...current2,
      characters: current2.characters.map((item) => item.id === data.character.id ? { ...item, name: data.character.name } : item)
    });
    setBinding((current2) => {
      if (current2 === null || current2.characterCardId !== data.character.id) return current2;
      const greetings2 = characterGreetingOptions(data.character);
      const maxIndex = Math.max(0, greetings2.length - 1);
      const greetingIndex2 = Math.min(current2.character?.greetingIndex ?? 0, maxIndex);
      return { ...current2, character: { ...current2.character, greetingIndex: greetingIndex2 } };
    });
    announceTavernRefresh2();
  }, "character.status.saved"), [detail, draft, run]);
  const bind = (0, import_react2.useCallback)(() => run(async () => {
    if (!sessionId) throw uiError("character.error.needSession");
    if (dirty) throw uiError("character.error.saveFirst");
    if (selection?.characterCardId !== binding?.characterCardId) {
      const historical = typeof hasConversationHistory === "function" ? await hasConversationHistory(sessionId) : sessionBlank === false;
      if (historical && !window.confirm(unwrapText(uiMessage("character.confirmHistoricalSwitch")))) return;
    }
    const data = await api2("/character-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, ...binding })
    });
    setSelection(data.selection);
    setBinding(data.selection);
    const rpData = await api2(`/rp-mode?sessionId=${encodeURIComponent(sessionId)}`);
    setRp(rpData.rp ?? { active: false });
    announceTavernRefresh2();
  }, "character.status.bound"), [binding, dirty, hasConversationHistory, run, selection, sessionBlank, sessionId]);
  const unbind = (0, import_react2.useCallback)(() => run(async () => {
    if (!sessionId) throw uiError("character.error.noSessionToUnbind");
    await api2("/character-selection", {
      method: "POST",
      body: JSON.stringify({ sessionId, characterCardId: null })
    });
    await refresh(detail?.id);
    announceTavernRefresh2();
  }, "character.status.unbound"), [detail?.id, refresh, run, sessionId]);
  const toggleRp = (0, import_react2.useCallback)(() => run(async () => {
    if (!sessionId) throw uiError("character.error.needSession");
    const data = await api2("/rp-mode", {
      method: "PUT",
      body: JSON.stringify({ sessionId, active: rp.active !== true })
    });
    setRp(data.rp ?? { active: rp.active !== true });
    announceTavernRefresh2();
  }, "character.status.rpUpdated"), [rp.active, run, sessionId]);
  const remove = (0, import_react2.useCallback)(() => run(async () => {
    if (detail === null || !window.confirm(unwrapText(uiMessage("character.confirmDelete", { name: detail.name })))) return;
    await api2(`/characters/${encodeURIComponent(detail.id)}`, { method: "DELETE" });
    await refresh(null);
    announceTavernRefresh2();
  }, "character.status.deleted"), [detail, refresh, run]);
  const chooseCharacter = (0, import_react2.useCallback)((id) => {
    if (dirty && !window.confirm(unwrapText(uiMessage("character.confirmDiscardForSwitch")))) return;
    run(() => loadDetail(id), "character.status.detailsLoaded");
  }, [dirty, loadDetail, run]);
  const requestClose = () => {
    if (!dirty || window.confirm(unwrapText(uiMessage("character.confirmCloseDirty")))) close();
  };
  const greetings = characterGreetingOptions(draft === null ? detail : { data: draft });
  const greetingIndex = Math.min(binding?.character?.greetingIndex ?? 0, Math.max(0, greetings.length - 1));
  const boundHere = detail !== null && selection?.characterCardId === detail.id;
  const bindingDirty = characterBindingDirty(selection, binding);
  const activeName = selection === null ? translate("nav.character.empty") : catalog2?.characters.find((item) => item.id === selection.characterCardId)?.name ?? selection.characterCardId;
  const closeLabel = uiMessage("panel.close", { title: unwrapText(uiMessage("character.title")) });
  const avatarSrc = detail === null ? null : `${API_V1}/characters/${encodeURIComponent(detail.id)}/png`;
  return h2(
    "div",
    { className: "dcc-panel" },
    h2(
      "div",
      { className: "dcc-header" },
      h2("div", { className: "dcc-title" }, uiMessage("character.title")),
      h2("button", { className: "dcc-close", type: "button", title: closeLabel, "aria-label": closeLabel, onClick: requestClose }, "\u2715")
    ),
    h2(
      "div",
      { className: "dcc-body" },
      h2(
        "div",
        { className: "dcc-toolbar" },
        h2("button", { className: "dcc-button", type: "button", disabled: busy, onClick: create2 }, uiMessage("character.create")),
        h2("button", { className: "dcc-button", type: "button", disabled: busy, onClick: () => fileRef.current?.click() }, uiMessage("character.import")),
        h2("button", { className: "dcc-button", type: "button", disabled: busy, onClick: () => {
          if (dirty && !window.confirm(unwrapText(uiMessage("character.confirmDiscardRefresh")))) return;
          run(() => refresh(detail?.id), "character.status.libraryRefreshed");
        } }, uiMessage("common.refresh")),
        h2("input", { ref: fileRef, hidden: true, type: "file", accept: ".json,.png,application/json,image/png", onChange: (event) => {
          const file = event.target.files?.[0];
          if (file !== void 0) importFile(file);
        } })
      ),
      h2(Field2, { label: uiMessage("character.browse") }, h2(
        "select",
        {
          className: "dcc-select",
          value: detail?.id ?? "",
          disabled: busy || catalog2 === null || catalog2.characters.length === 0,
          onChange: (event) => chooseCharacter(event.target.value)
        },
        ...catalog2?.characters.length ? [] : [h2("option", { key: "empty", value: "" }, uiMessage("character.libraryEmpty"))],
        ...(catalog2?.characters ?? []).map((item) => h2("option", { key: item.id, value: item.id }, rawText(item.name)))
      )),
      h2("p", { className: "dcc-note" }, uiMessage("character.sessionBinding", {
        session: sessionId || translate("common.none"),
        name: activeName
      })),
      h2("div", { className: "dcc-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, statusText(status)),
      dirty ? h2("div", { className: "dcc-status", "data-warning": true, role: "status" }, uiMessage("character.dirty")) : detail === null ? null : h2("p", { className: "dcc-note" }, uiMessage("character.savedNote")),
      detail === null || draft === null ? h2("p", { className: "dcc-note" }, catalog2 === null ? uiMessage("character.loading") : uiMessage("character.emptyHint")) : h2(
        "div",
        { className: "dcc-card" },
        h2(
          "div",
          { className: "dcc-card-head" },
          h2("img", { className: "dcc-avatar", src: avatarSrc, alt: uiMessage("character.imageAlt", { name: detail.name }) }),
          h2(
            "div",
            null,
            h2("h3", { className: "dcc-card-title" }, rawText(detail.name)),
            h2("p", { className: "dcc-meta" }, rawText(`${detail.source.format}${detail.source.specVersion ? ` \xB7 ${detail.source.specVersion}` : ""} \xB7 ${detail.source.container}`)),
            h2("p", { className: "dcc-meta" }, rawText(`${draft.creator || translate("common.unknownAuthor")}${draft.characterVersion ? ` \xB7 ${draft.characterVersion}` : ""}`))
          )
        ),
        h2(Field2, { label: uiMessage("common.name") }, h2("input", {
          className: "dcc-input",
          value: draft.name,
          maxLength: 200,
          onChange: (event) => patchDraft(setDraft, "name", event.target.value)
        })),
        h2(Field2, { label: uiMessage("character.field.nickname") }, h2("input", {
          className: "dcc-input",
          value: draft.nickname,
          onChange: (event) => patchDraft(setDraft, "nickname", event.target.value)
        })),
        h2(Field2, { label: uiMessage("character.field.creator") }, h2("input", {
          className: "dcc-input",
          value: draft.creator,
          onChange: (event) => patchDraft(setDraft, "creator", event.target.value)
        })),
        h2(Field2, { label: uiMessage("character.field.characterVersion") }, h2("input", {
          className: "dcc-input",
          value: draft.characterVersion,
          onChange: (event) => patchDraft(setDraft, "characterVersion", event.target.value)
        })),
        h2(Field2, { label: uiMessage("character.field.tags") }, h2("input", {
          className: "dcc-input",
          value: draft.tagsText,
          placeholder: uiMessage("character.tagsPlaceholder"),
          onChange: (event) => patchDraft(setDraft, "tagsText", event.target.value)
        })),
        h2(Field2, { label: uiMessage("character.greeting") }, h2("select", {
          className: "dcc-select",
          value: greetingIndex,
          onChange: (event) => setBinding((current2) => ({ ...current2, character: { ...current2.character, greetingIndex: Number(event.target.value) } }))
        }, ...greetings.map((item) => h2("option", { key: item.index, value: item.index }, uiMessage(item.labelKey, item.labelValues))))),
        h2("label", { className: "dcc-check" }, h2("input", { type: "checkbox", checked: binding?.character?.preferCharacterSystemPrompt !== false, onChange: (event) => setBinding((current2) => ({ ...current2, character: { ...current2.character, preferCharacterSystemPrompt: event.target.checked } })) }), h2("span", null, uiMessage("character.preferSystem"))),
        h2("label", { className: "dcc-check" }, h2("input", { type: "checkbox", checked: binding?.character?.preferCharacterPostHistory !== false, onChange: (event) => setBinding((current2) => ({ ...current2, character: { ...current2.character, preferCharacterPostHistory: event.target.checked } })) }), h2("span", null, uiMessage("character.preferPostHistory"))),
        boundHere ? bindingDirty ? h2("div", { className: "dcc-status", "data-warning": true, role: "status" }, uiMessage("character.bindingUnsaved")) : h2("p", { className: "dcc-note" }, uiMessage("character.bindingApplied")) : null,
        h2(
          "div",
          { className: "dcc-actions" },
          h2("button", { className: "dcc-button dcc-primary", type: "button", disabled: busy || !dirty, onClick: save }, dirty ? uiMessage("character.saveResource") : uiMessage("character.resourceSaved")),
          h2("button", { className: "dcc-button dcc-primary", type: "button", disabled: busy || !sessionId || dirty || boundHere && !bindingDirty, onClick: bind }, dirty ? uiMessage("character.saveFirst") : boundHere ? bindingDirty ? uiMessage("character.bindUpdate") : uiMessage("character.bindingAppliedButton") : uiMessage("character.bind"))
        ),
        h2("button", { className: "dcc-button", type: "button", disabled: busy || !sessionId || selection === null, onClick: unbind }, uiMessage("character.unbind")),
        h2(
          "label",
          { className: "dcc-check" },
          h2("input", {
            type: "checkbox",
            checked: rp.active === true,
            disabled: busy || !sessionId,
            onChange: toggleRp
          }),
          h2("span", null, uiMessage("character.rpMode"))
        ),
        h2("p", { className: "dcc-note" }, uiMessage("character.rpMode.help")),
        h2("p", { className: "dcc-note" }, uiMessage("character.moduleNote")),
        h2(
          "details",
          { className: "dcc-detail", open: true },
          h2("summary", null, uiMessage("character.field.firstMessage")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", {
            className: "dcc-textarea",
            value: draft.firstMessage,
            onChange: (event) => patchDraft(setDraft, "firstMessage", event.target.value)
          }))
        ),
        h2(
          "details",
          { className: "dcc-detail", open: true },
          h2("summary", null, uiMessage("character.alternateGreetings")),
          h2(
            "div",
            { className: "dcc-detail-body" },
            h2(
              "div",
              { className: "dcc-greetings" },
              ...draft.alternateGreetings.map((text2, index) => h2(
                "div",
                { className: "dcc-greeting-item", key: `alt-${index}` },
                h2(
                  "div",
                  { className: "dcc-greeting-head" },
                  h2("span", { className: "dcc-label" }, uiMessage("character.greeting.alternate", { index: index + 1 })),
                  h2("button", {
                    className: "dcc-button dcc-danger",
                    type: "button",
                    disabled: busy,
                    onClick: () => setDraft((current2) => current2 === null ? current2 : {
                      ...current2,
                      alternateGreetings: current2.alternateGreetings.filter((_item, itemIndex) => itemIndex !== index)
                    })
                  }, uiMessage("common.delete"))
                ),
                h2("textarea", {
                  className: "dcc-textarea",
                  value: text2,
                  onChange: (event) => setDraft((current2) => {
                    if (current2 === null) return current2;
                    const alternateGreetings = [...current2.alternateGreetings];
                    alternateGreetings[index] = event.target.value;
                    return { ...current2, alternateGreetings };
                  })
                })
              ))
            ),
            h2("button", {
              className: "dcc-button",
              type: "button",
              disabled: busy,
              onClick: () => setDraft((current2) => current2 === null ? current2 : {
                ...current2,
                alternateGreetings: [...current2.alternateGreetings, ""]
              })
            }, uiMessage("character.addGreeting"))
          )
        ),
        h2(
          "details",
          { className: "dcc-detail" },
          h2("summary", null, uiMessage("character.field.creatorNotes")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", { className: "dcc-textarea", value: draft.creatorNotes, onChange: (event) => patchDraft(setDraft, "creatorNotes", event.target.value) }))
        ),
        h2(
          "details",
          { className: "dcc-detail" },
          h2("summary", null, uiMessage("character.field.description")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", { className: "dcc-textarea", value: draft.description, onChange: (event) => patchDraft(setDraft, "description", event.target.value) }))
        ),
        h2(
          "details",
          { className: "dcc-detail" },
          h2("summary", null, uiMessage("character.field.personality")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", { className: "dcc-textarea", value: draft.personality, onChange: (event) => patchDraft(setDraft, "personality", event.target.value) }))
        ),
        h2(
          "details",
          { className: "dcc-detail" },
          h2("summary", null, uiMessage("character.field.scenario")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", { className: "dcc-textarea", value: draft.scenario, onChange: (event) => patchDraft(setDraft, "scenario", event.target.value) }))
        ),
        h2(
          "details",
          { className: "dcc-detail" },
          h2("summary", null, uiMessage("character.field.messageExamples")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", { className: "dcc-textarea", value: draft.messageExample, onChange: (event) => patchDraft(setDraft, "messageExample", event.target.value) }))
        ),
        h2(
          "details",
          { className: "dcc-detail" },
          h2("summary", null, uiMessage("character.field.systemPrompt")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", { className: "dcc-textarea", value: draft.systemPrompt, onChange: (event) => patchDraft(setDraft, "systemPrompt", event.target.value) }))
        ),
        h2(
          "details",
          { className: "dcc-detail" },
          h2("summary", null, uiMessage("character.field.postHistory")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", { className: "dcc-textarea", value: draft.postHistoryInstructions, onChange: (event) => patchDraft(setDraft, "postHistoryInstructions", event.target.value) }))
        ),
        detail.data.characterBook !== null ? h2("div", { className: "dcc-status" }, uiMessage("character.embeddedBook", { count: Array.isArray(detail.data.characterBook.entries) ? detail.data.characterBook.entries.length : translate("common.unknown") })) : null,
        h2(DiagnosticList, { titleKey: "character.warnings", items: detail.compatibility.warnings }),
        h2(DiagnosticList, { titleKey: "character.unsupported", items: detail.compatibility.unsupportedFeatures }),
        detail.compatibility.unknownMacroNames.length > 0 ? h2("div", { className: "dcc-status" }, uiMessage("character.unknownMacros", { names: detail.compatibility.unknownMacroNames.join(", ") })) : null,
        h2(
          "div",
          { className: "dcc-actions" },
          h2("a", { className: "dcc-button", href: `${API_V1}/characters/${encodeURIComponent(detail.id)}/json`, download: "" }, uiMessage("common.exportJson")),
          h2("a", { className: "dcc-button", href: `${API_V1}/characters/${encodeURIComponent(detail.id)}/png`, download: "" }, uiMessage("character.exportPng"))
        ),
        h2("div", { className: "dcc-footer" }, h2("button", { className: "dcc-button dcc-danger", type: "button", disabled: busy, onClick: remove }, uiMessage("character.delete")))
      )
    )
  );
}
function installCharacterStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-character"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-character`;
  style.textContent = css2;
  document.head.append(style);
}

// packages/world-book-library/src/client.js
var import_react3 = require("react");
var h3 = createLocalizedElement(import_react3.createElement);
var POSITIONS = [
  ["before_character_definition", "world.position.beforeCharacter"],
  ["after_character_definition", "world.position.afterCharacter"],
  ["before_author_note", "world.position.beforeAuthor"],
  ["after_author_note", "world.position.afterAuthor"],
  ["at_depth", "world.position.atDepth"],
  ["before_example_messages", "world.position.beforeExamples"],
  ["after_example_messages", "world.position.afterExamples"],
  ["outlet", "world.position.outlet"]
];
var css3 = `
.dwb-panel{position:absolute;top:0;right:0;bottom:0;width:min(500px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dwb-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dwb-title{font-size:16px;font-weight:650;flex:1}.dwb-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px;font-size:14px}.dwb-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:11px}.dwb-toolbar{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.dwb-actions{display:flex;gap:7px;flex-wrap:wrap}.dwb-button{min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:13px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}.dwb-button:disabled{opacity:.5;cursor:default}.dwb-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dwb-danger{color:var(--dsw-alias-state-error)}.dwb-field{display:flex;flex-direction:column;gap:4px}.dwb-label{font-size:12px;font-weight:620;color:var(--dsw-alias-label-tertiary)}.dwb-input,.dwb-select,.dwb-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:7px 8px}.dwb-input,.dwb-select{height:36px}.dwb-textarea{min-height:110px;resize:vertical;line-height:1.5}.dwb-note,.dwb-meta{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dwb-status{font-size:13px;line-height:1.45;border-radius:7px;padding:8px 10px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dwb-status[data-error=true]{color:var(--dsw-alias-state-error)}.dwb-status[data-warning=true]{color:var(--dsw-alias-state-warning,#b46b00)}.dwb-section-title{font-size:15px;font-weight:700;margin:5px 0 0}.dwb-resource{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:8px}.dwb-resource-title{font-size:14px;font-weight:650}.dwb-bindings{display:grid;grid-template-columns:1fr 1fr;gap:5px}.dwb-check{display:flex;gap:6px;align-items:flex-start;font-size:12px;line-height:1.45}.dwb-entry{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden}.dwb-entry>summary{list-style:none;cursor:pointer;padding:8px;display:flex;align-items:center;gap:7px;font-size:13px}.dwb-entry>summary::-webkit-details-marker{display:none}.dwb-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary)}.dwb-entry[data-enabled=true] .dwb-dot{background:var(--dsw-alias-state-success,#2fa36b)}.dwb-entry-name{font-weight:620;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dwb-entry-state{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary);font-size:12px}.dwb-entry-body{border-top:1px solid var(--dsw-alias-border-l1);padding:8px;display:flex;flex-direction:column;gap:8px}.dwb-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.dwb-checks{display:flex;flex-wrap:wrap;gap:10px}.dwb-list{margin:0;padding-left:18px;font-size:13px;line-height:1.5}
.dwb-source-section{border:1px solid var(--dsw-alias-border-l2);border-radius:11px;padding:10px;background:color-mix(in srgb,var(--dsw-specific-tip) 35%,transparent);display:flex;flex-direction:column;gap:9px}.dwb-source-section>.dwb-section-title{margin:0}.dwb-source-section>.dwb-resource{background:var(--dsw-alias-bg-base)}.dwb-source-list{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:7px}.dwb-source-book{padding-left:2px}.dwb-source-book-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.dwb-source-book-name{min-width:0;font-size:13px;font-weight:620;overflow-wrap:anywhere}.dwb-source-badge{flex:none;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:2px 7px;font-size:11px;line-height:1.35;color:var(--dsw-alias-label-tertiary);background:var(--dsw-specific-tip)}.dwb-user-bindings{grid-template-columns:1fr}.dwb-user-binding-row{display:flex;align-items:center;gap:7px}.dwb-user-binding-row>.dwb-check{align-items:center;flex:1;min-width:0}.dwb-user-binding-row .dwb-source-badge{margin-left:auto}.dwb-inline-edit{min-height:30px;padding:4px 8px;flex:none}
`;
function errorMessage2(data, status) {
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.error === "string") return data.error;
  return `HTTP ${status}`;
}
async function api3(path, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  const response = await fetch(`${API_V1}${path}`, {
    ...options,
    headers: {
      ...method === "GET" || method === "HEAD" ? {} : { "Content-Type": "application/json" },
      ...options.headers
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(errorMessage2(data, response.status));
  return data;
}
function Field3({ label, children }) {
  return h3("label", { className: "dwb-field" }, h3("span", { className: "dwb-label" }, label), children);
}
function parseKeywords(value) {
  return value.split(/[,，]/u).map((item) => item.trim()).filter(Boolean);
}
function sameKeywords(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}
function reconcileKeywordEditorText(current2, keywords2) {
  const normalized = Array.isArray(keywords2) ? keywords2.filter((value) => typeof value === "string" && value !== "") : [];
  return sameKeywords(parseKeywords(current2), normalized) ? current2 : normalized.join(", ");
}
function KeywordInput({ keywords: keywords2, onChange }) {
  const [text2, setText] = (0, import_react3.useState)(() => Array.isArray(keywords2) ? keywords2.join(", ") : "");
  (0, import_react3.useEffect)(() => {
    setText((current2) => reconcileKeywordEditorText(current2, keywords2));
  }, [keywords2]);
  return h3("input", {
    className: "dwb-input",
    value: text2,
    onChange: (event) => {
      const next = event.target.value;
      setText(next);
      onChange(parseKeywords(next));
    }
  });
}
function embeddedPosition(entry) {
  const value = entry?.extensions?.position;
  if (Number.isInteger(value) && value >= 0 && value <= 7) return value;
  return entry?.position === "before_char" ? 0 : 1;
}
function EmbeddedEntryEditor({ entry, index, update, remove }) {
  const patch = (value) => update(index, value);
  const secondaryKeys = Array.isArray(entry.secondary_keys) ? entry.secondary_keys : [];
  const position = embeddedPosition(entry);
  return h3(
    "details",
    { className: "dwb-entry", "data-enabled": entry.enabled === true },
    h3(
      "summary",
      null,
      h3("span", { className: "dwb-dot" }),
      h3("span", { className: "dwb-entry-name" }, entry.comment || entry.name ? rawText(entry.comment || entry.name) : uiMessage("world.entry.fallback", { id: entry.id ?? index })),
      h3("span", { className: "dwb-entry-state" }, entry.constant ? uiMessage("world.entry.constant") : (entry.keys ?? []).length > 0 ? rawText(entry.keys.join(", ")) : uiMessage("world.entry.noKeywords"))
    ),
    h3(
      "div",
      { className: "dwb-entry-body" },
      h3(Field3, { label: uiMessage("world.entry.title") }, h3("input", { className: "dwb-input", value: entry.comment ?? entry.name ?? "", onChange: (event) => patch({ comment: event.target.value }) })),
      h3(Field3, { label: uiMessage("world.entry.primaryKeys") }, h3(KeywordInput, { keywords: entry.keys, onChange: (keys) => patch({ keys }) })),
      h3(Field3, { label: uiMessage("world.entry.secondaryKeys") }, h3(KeywordInput, { keywords: secondaryKeys, onChange: (keys) => patch({ secondary_keys: keys, selective: keys.length > 0 }) })),
      secondaryKeys.length > 0 ? h3(Field3, { label: uiMessage("world.entry.secondaryLogicShort") }, h3(
        "select",
        {
          className: "dwb-select",
          value: entry.selectiveLogic ?? entry.extensions?.selectiveLogic ?? "and_any",
          onChange: (event) => patch({ selectiveLogic: event.target.value, selective: true, extensions: { ...entry.extensions ?? {}, selectiveLogic: event.target.value } })
        },
        h3("option", { value: "and_any" }, uiMessage("world.logic.andAny")),
        h3("option", { value: "and_all" }, uiMessage("world.logic.andAll")),
        h3("option", { value: "not_any" }, uiMessage("world.logic.notAny")),
        h3("option", { value: "not_all" }, uiMessage("world.logic.notAll"))
      )) : null,
      h3(Field3, { label: uiMessage("world.entry.body") }, h3("textarea", { className: "dwb-textarea", value: entry.content ?? "", onChange: (event) => patch({ content: event.target.value }) })),
      h3(
        "div",
        { className: "dwb-grid" },
        h3(Field3, { label: uiMessage("world.entry.position") }, h3("select", { className: "dwb-select", value: position, onChange: (event) => {
          const value = Number(event.target.value);
          patch({ position: value === 0 ? "before_char" : value === 1 ? "after_char" : entry.position, extensions: { ...entry.extensions ?? {}, position: value } });
        } }, ...POSITIONS.map(([_value, key], value) => h3("option", { key: value, value }, uiMessage(key))))),
        h3(Field3, { label: uiMessage("world.entry.order") }, h3("input", { className: "dwb-input", type: "number", value: entry.insertion_order ?? 100, onChange: (event) => patch({ insertion_order: Number(event.target.value) }) })),
        h3(Field3, { label: uiMessage("world.entry.probability") }, h3("input", { className: "dwb-input", type: "number", min: 0, max: 100, value: entry.probability ?? entry.extensions?.probability ?? 100, onChange: (event) => patch({ probability: Number(event.target.value), extensions: { ...entry.extensions ?? {}, probability: Number(event.target.value), useProbability: true } }) }))
      ),
      h3(
        "div",
        { className: "dwb-checks" },
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.enabled === true, onChange: (event) => patch({ enabled: event.target.checked }) }), uiMessage("common.enable")),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.constant === true, onChange: (event) => patch({ constant: event.target.checked }) }), uiMessage("world.entry.constant")),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: (entry.case_sensitive ?? entry.extensions?.case_sensitive) === true, onChange: (event) => patch({ case_sensitive: event.target.checked, extensions: { ...entry.extensions ?? {}, case_sensitive: event.target.checked } }) }), uiMessage("world.entry.caseSensitive")),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: (entry.match_whole_words ?? entry.extensions?.match_whole_words) === true, onChange: (event) => patch({ match_whole_words: event.target.checked, extensions: { ...entry.extensions ?? {}, match_whole_words: event.target.checked } }) }), uiMessage("world.entry.wholeWord"))
      ),
      h3("div", { className: "dwb-actions" }, h3("button", { className: "dwb-button dwb-danger", type: "button", onClick: () => remove(index) }, uiMessage("world.entry.delete")))
    )
  );
}
function nextUid(entries2) {
  const numeric = entries2.map((entry) => entry.uid).filter(Number.isSafeInteger);
  return numeric.length === 0 ? 0 : Math.max(...numeric) + 1;
}
function createWorldBookEntry(entries2 = []) {
  const uid = nextUid(entries2);
  return {
    uid,
    keys: [],
    secondaryKeys: [],
    comment: translate("world.entry.untitled", { id: uid }),
    content: "",
    enabled: true,
    constant: false,
    selective: false,
    insertionOrder: 100,
    position: "after_character_definition",
    probability: 100,
    useProbability: true,
    caseSensitive: false,
    matchWholeWords: false
  };
}
function deriveUserWorldBookSource(active, catalog2) {
  const user = active?.resources?.user ?? null;
  const selection = active?.worldBookSelection ?? {};
  const userBoundIds = Array.isArray(selection.userBoundIds) ? selection.userBoundIds : [];
  const duplicateIds = new Set(Array.isArray(selection.duplicateIds) ? selection.duplicateIds : []);
  const known = new Map([
    ...Array.isArray(catalog2?.worldBooks) ? catalog2.worldBooks : [],
    ...Array.isArray(active?.resources?.worldBooks) ? active.resources.worldBooks : []
  ].map((item) => [item.id, item]));
  return {
    user,
    books: userBoundIds.map((id) => ({
      id,
      name: known.get(id)?.name ?? id,
      duplicate: duplicateIds.has(id)
    }))
  };
}
function EntryEditor({ entry, index, update, remove }) {
  const patch = (value) => update(index, value);
  const secondary = Array.isArray(entry.secondaryKeys) ? entry.secondaryKeys : [];
  return h3(
    "details",
    { className: "dwb-entry", "data-enabled": entry.enabled === true },
    h3(
      "summary",
      null,
      h3("span", { className: "dwb-dot" }),
      h3("span", { className: "dwb-entry-name" }, entry.comment ? rawText(entry.comment) : uiMessage("world.entry.fallback", { id: entry.uid ?? index })),
      h3("span", { className: "dwb-entry-state" }, entry.constant ? uiMessage("world.entry.constant") : (entry.keys ?? []).length > 0 ? rawText(entry.keys.join(", ")) : uiMessage("world.entry.noKeywords"))
    ),
    h3(
      "div",
      { className: "dwb-entry-body" },
      h3(Field3, { label: uiMessage("world.entry.title") }, h3("input", { className: "dwb-input", value: entry.comment ?? "", onChange: (event) => patch({ comment: event.target.value }) })),
      h3(Field3, { label: uiMessage("world.entry.primaryKeys") }, h3(KeywordInput, { keywords: entry.keys, onChange: (keys) => patch({ keys }) })),
      h3(Field3, { label: uiMessage("world.entry.secondaryKeys") }, h3(KeywordInput, { keywords: secondary, onChange: (keys) => patch({ secondaryKeys: keys, selective: keys.length > 0 }) })),
      secondary.length > 0 ? h3(Field3, { label: uiMessage("world.entry.secondaryLogicShort") }, h3(
        "select",
        { className: "dwb-select", value: entry.selectiveLogic ?? "and_any", onChange: (event) => patch({ selectiveLogic: event.target.value, selective: true }) },
        h3("option", { value: "and_any" }, uiMessage("world.logic.andAny")),
        h3("option", { value: "and_all" }, uiMessage("world.logic.andAll")),
        h3("option", { value: "not_any" }, uiMessage("world.logic.notAny")),
        h3("option", { value: "not_all" }, uiMessage("world.logic.notAll"))
      )) : null,
      h3(Field3, { label: uiMessage("world.entry.body") }, h3("textarea", { className: "dwb-textarea", value: entry.content ?? "", onChange: (event) => patch({ content: event.target.value }) })),
      h3(
        "div",
        { className: "dwb-grid" },
        h3(Field3, { label: uiMessage("world.entry.position") }, h3("select", { className: "dwb-select", value: entry.position, onChange: (event) => patch({ position: event.target.value }) }, ...POSITIONS.map(([value, key]) => h3("option", { key: value, value }, uiMessage(key))))),
        h3(Field3, { label: uiMessage("world.entry.order") }, h3("input", { className: "dwb-input", type: "number", value: entry.insertionOrder ?? 100, onChange: (event) => patch({ insertionOrder: Number(event.target.value) }) })),
        h3(Field3, { label: uiMessage("world.entry.probability") }, h3("input", { className: "dwb-input", type: "number", min: 0, max: 100, value: entry.probability ?? 100, onChange: (event) => patch({ probability: Number(event.target.value), useProbability: true }) }))
      ),
      h3(
        "div",
        { className: "dwb-checks" },
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.enabled === true, onChange: (event) => patch({ enabled: event.target.checked }) }), uiMessage("common.enable")),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.constant === true, onChange: (event) => patch({ constant: event.target.checked }) }), uiMessage("world.entry.constant")),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.caseSensitive === true, onChange: (event) => patch({ caseSensitive: event.target.checked }) }), uiMessage("world.entry.caseSensitive")),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.matchWholeWords === true, onChange: (event) => patch({ matchWholeWords: event.target.checked }) }), uiMessage("world.entry.wholeWord"))
      ),
      h3("div", { className: "dwb-actions" }, h3("button", { className: "dwb-button dwb-danger", type: "button", onClick: () => remove(index) }, uiMessage("world.entry.delete")))
    )
  );
}
function WorldBookPanel({ sessionId, close }) {
  const [catalog2, setCatalog] = (0, import_react3.useState)(null);
  const [document2, setDocument] = (0, import_react3.useState)(null);
  const [draft, setDraft] = (0, import_react3.useState)(null);
  const [selection, setSelection] = (0, import_react3.useState)([]);
  const [appliedSelection, setAppliedSelection] = (0, import_react3.useState)([]);
  const [userSelection, setUserSelection] = (0, import_react3.useState)([]);
  const [appliedUserSelection, setAppliedUserSelection] = (0, import_react3.useState)([]);
  const [active, setActive] = (0, import_react3.useState)(null);
  const [embeddedCharacterId, setEmbeddedCharacterId] = (0, import_react3.useState)(null);
  const [embeddedDraft, setEmbeddedDraft] = (0, import_react3.useState)(null);
  const [embeddedDirty, setEmbeddedDirty] = (0, import_react3.useState)(false);
  const [dirty, setDirty] = (0, import_react3.useState)(false);
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const [status, setStatus] = (0, import_react3.useState)({ error: false, key: "common.loading" });
  const fileRef = (0, import_react3.useRef)(null);
  const standaloneEditorRef = (0, import_react3.useRef)(null);
  const generation = (0, import_react3.useRef)(0);
  const run = (0, import_react3.useCallback)(async (operation, success, values) => {
    setBusy(true);
    try {
      const value = await operation();
      setStatus({ error: false, key: success, values });
      return value;
    } catch (error) {
      setStatus({
        error: true,
        key: error.uiKey,
        values: error.uiValues,
        text: error instanceof Error ? error.message : String(error)
      });
      return null;
    } finally {
      setBusy(false);
    }
  }, []);
  const refresh = (0, import_react3.useCallback)(async (preferredId) => {
    const currentGeneration = ++generation.current;
    const list = await api3("/world-books");
    const selected = sessionId ? await api3(`/world-book-selection?sessionId=${encodeURIComponent(sessionId)}`) : { selection: { worldBookIds: [] } };
    const activeView2 = await api3(`/active${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""}`);
    const characterId = activeView2.resources?.characterCard?.id ?? null;
    let embeddedBook = null;
    if (characterId !== null) {
      const character = await api3(`/characters/${encodeURIComponent(characterId)}`);
      embeddedBook = character.character?.data?.characterBook ?? null;
    }
    if (currentGeneration !== generation.current) return;
    const ids = selected.selection?.worldBookIds ?? [];
    const resolvedUserIds = activeView2.resources?.user === null || activeView2.resources?.user === void 0 ? [] : activeView2.worldBookSelection?.userBoundIds ?? [];
    const userIds = Array.isArray(resolvedUserIds) ? resolvedUserIds : [];
    setCatalog(list);
    setSelection(ids);
    setAppliedSelection(ids);
    setUserSelection(userIds);
    setAppliedUserSelection(userIds);
    setActive(activeView2);
    setEmbeddedCharacterId(characterId);
    setEmbeddedDraft(embeddedBook === null ? null : structuredClone(embeddedBook));
    setEmbeddedDirty(false);
    const id = preferredId ?? document2?.id ?? ids[0] ?? list.worldBooks[0]?.id ?? null;
    if (id === null || !list.worldBooks.some((item) => item.id === id)) {
      setDocument(null);
      setDraft(null);
      setDirty(false);
      return;
    }
    const detail = await api3(`/world-books/${encodeURIComponent(id)}`);
    if (currentGeneration !== generation.current) return;
    setDocument(detail.worldBook);
    setDraft(structuredClone(detail.worldBook.book));
    setDirty(false);
  }, [document2?.id, sessionId]);
  (0, import_react3.useEffect)(() => {
    run(() => refresh(), "world.status.loaded");
    const onRefresh = () => run(() => refresh(), "world.status.refreshed");
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh);
    return () => {
      generation.current += 1;
      window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh);
    };
  }, [refresh, run]);
  const load = (id) => run(async () => {
    const detail = await api3(`/world-books/${encodeURIComponent(id)}`);
    setDocument(detail.worldBook);
    setDraft(structuredClone(detail.worldBook.book));
    setDirty(false);
  }, "world.status.detailsLoaded");
  const editUserBook = async (id) => {
    await load(id);
    requestAnimationFrame(() => standaloneEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const create2 = () => run(async () => {
    const data = await api3("/world-books", { method: "POST", body: JSON.stringify({ name: translate("world.defaultName") }) });
    await refresh(data.worldBook.id);
  }, "world.status.created");
  const importFile = (file) => run(async () => {
    const response = await fetch(`${API_V1}/world-books/import?filename=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: file
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) throw new Error(errorMessage2(data, response.status));
    if (fileRef.current !== null) fileRef.current.value = "";
    await refresh(data.worldBook.id);
  }, "world.status.imported");
  const save = () => run(async () => {
    const data = await api3(`/world-books/${encodeURIComponent(document2.id)}`, { method: "PATCH", body: JSON.stringify({ book: draft }) });
    setDocument(data.worldBook);
    setDraft(structuredClone(data.worldBook.book));
    setDirty(false);
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
  }, "world.status.saved");
  const saveSelection = () => run(async () => {
    if (!sessionId) throw uiError("world.error.needSession");
    const data = await api3("/world-book-selection", { method: "POST", body: JSON.stringify({ sessionId, worldBookIds: selection }) });
    setSelection(data.selection.worldBookIds);
    setAppliedSelection(data.selection.worldBookIds);
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
  }, "world.status.bindingSaved");
  const saveUserSelection = () => run(async () => {
    const userId = active?.resources?.user?.id;
    if (!userId) throw uiError("world.user.error.noUser");
    const data = await api3(`/users/${encodeURIComponent(userId)}/world-books`, {
      method: "PUT",
      body: JSON.stringify({ worldBookIds: userSelection })
    });
    const ids = data.binding.worldBookIds;
    setUserSelection(ids);
    setAppliedUserSelection(ids);
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
  }, "world.user.saveSuccess");
  const remove = () => run(async () => {
    if (document2 === null || !window.confirm(unwrapText(uiMessage("world.confirmDelete", { name: document2.name })))) return;
    await api3(`/world-books/${encodeURIComponent(document2.id)}`, { method: "DELETE" });
    setDocument(null);
    setDraft(null);
    await refresh(null);
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
  }, "world.status.deleted");
  const saveEmbedded = () => run(async () => {
    const data = await api3(`/characters/${encodeURIComponent(embeddedCharacterId)}/world-book`, {
      method: "PATCH",
      body: JSON.stringify({ characterBook: embeddedDraft })
    });
    setEmbeddedDraft(structuredClone(data.character.data.characterBook));
    setEmbeddedDirty(false);
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
  }, "world.status.embeddedSaved");
  const updateEntry = (index, patch) => {
    setDraft((current2) => {
      const next = structuredClone(current2);
      next.entries[index] = { ...next.entries[index], ...patch };
      return next;
    });
    setDirty(true);
  };
  const entries2 = draft?.entries ?? [];
  const embeddedEntries = embeddedDraft?.entries ?? [];
  const embedded = active?.resources?.worldBooks?.filter((item) => item.kind === "embedded-character-book") ?? [];
  const diagnostics = active?.diagnostics?.filter((item) => String(item.code ?? "").includes("WORLD_BOOK")) ?? [];
  const selectionDirty = selection.length !== appliedSelection.length || selection.some((id, index) => id !== appliedSelection[index]);
  const userSelectionDirty = userSelection.length !== appliedUserSelection.length || userSelection.some((id, index) => id !== appliedUserSelection[index]);
  const userSource = deriveUserWorldBookSource(active, catalog2);
  const catalogBooks = Array.isArray(catalog2?.worldBooks) ? catalog2.worldBooks : [];
  const catalogById = new Map(catalogBooks.map((book) => [book.id, book]));
  const userCatalog = [
    ...userSelection.map((id) => catalogById.get(id)).filter(Boolean),
    ...catalogBooks.filter((book) => !userSelection.includes(book.id))
  ];
  const closeLabel = uiMessage("panel.close", { title: unwrapText(uiMessage("world.title")) });
  return h3(
    "div",
    { className: "dwb-panel" },
    h3("div", { className: "dwb-header" }, h3("div", { className: "dwb-title" }, uiMessage("world.title")), h3("button", { className: "dwb-close", type: "button", onClick: close, title: closeLabel, "aria-label": closeLabel }, "\u2715")),
    h3(
      "div",
      { className: "dwb-body" },
      h3(
        "div",
        { className: "dwb-toolbar" },
        h3("button", { className: "dwb-button", type: "button", disabled: busy, onClick: () => fileRef.current?.click() }, uiMessage("world.importJson")),
        h3("button", { className: "dwb-button", type: "button", disabled: busy, onClick: create2 }, uiMessage("world.create")),
        h3("button", { className: "dwb-button", type: "button", disabled: busy, onClick: () => {
          if (!dirty || window.confirm(unwrapText(uiMessage("world.confirmDiscardChanges")))) run(() => refresh(), "world.status.refreshed");
        } }, uiMessage("common.refresh")),
        h3("input", { ref: fileRef, hidden: true, type: "file", accept: ".json,application/json", onChange: (event) => {
          const file = event.target.files?.[0];
          if (file !== void 0) importFile(file);
        } })
      ),
      h3("p", { className: "dwb-note" }, uiMessage("world.currentSession", { session: sessionId || translate("common.none") })),
      h3("div", { className: "dwb-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, statusText(status)),
      h3(
        "section",
        { className: "dwb-source-section", "data-source": "standalone" },
        h3("h2", { className: "dwb-section-title" }, uiMessage("world.standalone")),
        h3(
          "div",
          { className: "dwb-resource" },
          h3("div", { className: "dwb-resource-title" }, uiMessage("world.sessionBinding")),
          catalog2?.worldBooks.length ? h3("div", { className: "dwb-bindings" }, ...catalog2.worldBooks.map((item) => h3(
            "label",
            { className: "dwb-check", key: item.id },
            h3("input", { type: "checkbox", checked: selection.includes(item.id), onChange: (event) => setSelection((current2) => event.target.checked ? [...current2, item.id] : current2.filter((id) => id !== item.id)) }),
            uiMessage("world.catalogItem", { name: item.name, count: item.entryCount })
          ))) : h3("p", { className: "dwb-note" }, uiMessage("world.libraryEmpty")),
          selectionDirty ? h3("div", { className: "dwb-status", "data-warning": true }, uiMessage("world.bindingUnsaved")) : h3("p", { className: "dwb-note" }, uiMessage("world.bindingApplied")),
          h3(
            "div",
            { className: "dwb-actions" },
            h3("button", { className: "dwb-button dwb-primary", type: "button", disabled: busy || !sessionId || !selectionDirty, onClick: saveSelection }, selectionDirty ? uiMessage("world.applyBinding") : uiMessage("world.bindingAppliedButton")),
            h3("button", { className: "dwb-button", type: "button", disabled: busy || !sessionId || selection.length === 0, onClick: () => setSelection([]) }, uiMessage("world.clearPending"))
          )
        ),
        h3(Field3, { label: uiMessage("world.browse") }, h3(
          "select",
          { className: "dwb-select", value: document2?.id ?? "", disabled: busy || !catalog2?.worldBooks.length, onChange: (event) => {
            if (!dirty || window.confirm(unwrapText(uiMessage("world.confirmDiscardChanges")))) load(event.target.value);
          } },
          ...catalog2?.worldBooks.length ? [] : [h3("option", { key: "empty", value: "" }, uiMessage("world.catalogEmpty"))],
          ...(catalog2?.worldBooks ?? []).map((item) => h3("option", { key: item.id, value: item.id }, rawText(item.name)))
        )),
        draft === null ? null : h3(
          "div",
          { className: "dwb-resource", ref: standaloneEditorRef },
          h3(Field3, { label: uiMessage("world.bookName") }, h3("input", { className: "dwb-input", value: draft.name ?? "", onChange: (event) => {
            setDraft((current2) => ({ ...current2, name: event.target.value }));
            setDirty(true);
          } })),
          h3("p", { className: "dwb-meta" }, uiMessage("world.documentMeta", { count: entries2.length })),
          h3(
            "div",
            { className: "dwb-actions" },
            h3("button", { className: "dwb-button", type: "button", onClick: () => {
              setDraft((current2) => ({ ...current2, entries: [...current2.entries, createWorldBookEntry(current2.entries)] }));
              setDirty(true);
            } }, uiMessage("world.addEntry")),
            h3("button", { className: "dwb-button dwb-primary", type: "button", disabled: busy || !dirty, onClick: save }, dirty ? uiMessage("common.saveChanges") : uiMessage("common.saved")),
            h3("a", { className: "dwb-button", href: `${API_V1}/world-books/${encodeURIComponent(document2.id)}/json`, download: "" }, uiMessage("common.exportJson")),
            h3("button", { className: "dwb-button dwb-danger", type: "button", disabled: busy, onClick: remove }, uiMessage("world.deleteStandalone"))
          ),
          ...entries2.map((entry, index) => h3(EntryEditor, { key: `${String(document2.id)}-${String(entry.uid)}-${index}`, entry, index, update: updateEntry, remove: (itemIndex) => {
            if (window.confirm(unwrapText(uiMessage("world.confirmDeleteEntry")))) {
              setDraft((current2) => ({ ...current2, entries: current2.entries.filter((_item, candidate) => candidate !== itemIndex) }));
              setDirty(true);
            }
          } }))
        )
      ),
      h3(
        "section",
        { className: "dwb-source-section", "data-source": "user" },
        h3("h2", { className: "dwb-section-title" }, uiMessage("world.user.title")),
        userSource.user === null ? h3("p", { className: "dwb-note" }, uiMessage("world.user.none")) : h3(
          "div",
          { className: "dwb-resource" },
          h3("div", { className: "dwb-resource-title" }, uiMessage("world.user.current", { name: userSource.user.name || userSource.user.id })),
          userCatalog.length ? h3("div", { className: "dwb-bindings dwb-user-bindings" }, ...userCatalog.map((book) => {
            const checked = userSelection.includes(book.id);
            const wasApplied = appliedUserSelection.includes(book.id);
            const badge = checked && !wasApplied ? uiMessage("world.user.pendingAdd") : !checked && wasApplied ? uiMessage("world.user.pendingRemove") : checked && selection.includes(book.id) ? uiMessage("world.user.duplicate") : checked ? uiMessage("world.user.appended") : null;
            return h3(
              "div",
              { className: "dwb-user-binding-row", key: book.id },
              h3(
                "label",
                { className: "dwb-check" },
                h3("input", {
                  type: "checkbox",
                  checked,
                  onChange: (event) => setUserSelection((current2) => event.target.checked ? [...current2, book.id] : current2.filter((id) => id !== book.id))
                }),
                h3("span", { className: "dwb-source-book-name" }, rawText(book.name)),
                badge === null ? null : h3("span", { className: "dwb-source-badge" }, badge)
              ),
              checked || wasApplied ? h3("button", { className: "dwb-button dwb-inline-edit", type: "button", disabled: busy, onClick: () => editUserBook(book.id) }, uiMessage("world.user.editContent")) : null
            );
          })) : h3("p", { className: "dwb-note" }, uiMessage("world.user.libraryEmpty")),
          userSelectionDirty ? h3("div", { className: "dwb-status", "data-warning": true }, uiMessage("world.user.unsaved")) : h3("p", { className: "dwb-note" }, userSource.books.length === 0 ? uiMessage("world.user.empty") : uiMessage("world.user.saved")),
          h3(
            "div",
            { className: "dwb-actions" },
            h3("button", { className: "dwb-button dwb-primary", type: "button", disabled: busy || !userSelectionDirty, onClick: saveUserSelection }, userSelectionDirty ? uiMessage("world.user.save") : uiMessage("world.user.saveApplied")),
            h3("button", { className: "dwb-button", type: "button", disabled: busy || userSelection.length === 0, onClick: () => setUserSelection([]) }, uiMessage("world.user.clear"))
          ),
          h3("p", { className: "dwb-note" }, uiMessage("world.user.order")),
          h3("p", { className: "dwb-note" }, uiMessage("world.user.editHint"))
        )
      ),
      h3(
        "section",
        { className: "dwb-source-section", "data-source": "character" },
        h3("h2", { className: "dwb-section-title" }, uiMessage("world.characterBound")),
        embeddedDraft !== null ? h3(
          "div",
          { className: "dwb-resource" },
          h3("div", { className: "dwb-resource-title" }, embeddedDraft.name || embedded[0]?.name ? rawText(embeddedDraft.name || embedded[0]?.name) : uiMessage("world.embeddedTitle")),
          h3("p", { className: "dwb-note" }, uiMessage("world.embeddedMeta", { count: embeddedEntries.length })),
          h3(
            "div",
            { className: "dwb-actions" },
            h3("button", { className: "dwb-button", type: "button", onClick: () => {
              const ids = embeddedEntries.map((entry) => Number(entry.id)).filter(Number.isSafeInteger);
              const id = ids.length === 0 ? 0 : Math.max(...ids) + 1;
              setEmbeddedDraft((current2) => ({ ...structuredClone(current2), entries: [...current2.entries, { id, keys: [], secondary_keys: [], comment: translate("world.entry.untitled", { id }), content: "", enabled: true, constant: false, selective: false, insertion_order: 100, position: "after_char", extensions: { position: 1, probability: 100, useProbability: true } }] }));
              setEmbeddedDirty(true);
            } }, uiMessage("world.addEmbeddedEntry")),
            h3("button", { className: "dwb-button dwb-primary", type: "button", disabled: busy || !embeddedDirty, onClick: saveEmbedded }, embeddedDirty ? uiMessage("world.saveEmbedded") : uiMessage("world.embeddedSaved"))
          ),
          ...embeddedEntries.map((entry, index) => h3(EmbeddedEntryEditor, { key: `${String(embeddedCharacterId)}-${String(entry.id)}-${index}`, entry, index, update: (itemIndex, value) => {
            setEmbeddedDraft((current2) => {
              const next = structuredClone(current2);
              next.entries[itemIndex] = { ...next.entries[itemIndex], ...value };
              return next;
            });
            setEmbeddedDirty(true);
          }, remove: (itemIndex) => {
            if (window.confirm(unwrapText(uiMessage("world.confirmDeleteEmbeddedEntry")))) {
              setEmbeddedDraft((current2) => ({ ...structuredClone(current2), entries: current2.entries.filter((_item, candidate) => candidate !== itemIndex) }));
              setEmbeddedDirty(true);
            }
          } }))
        ) : h3("p", { className: "dwb-note" }, uiMessage("world.embeddedEmpty"))
      ),
      diagnostics.length > 0 ? h3("details", { className: "dwb-resource" }, h3("summary", { className: "dwb-resource-title" }, uiMessage("world.diagnostics", { count: diagnostics.length })), h3("ul", { className: "dwb-list" }, ...diagnostics.map((item, index) => h3("li", { key: `${item.code}-${index}` }, rawText(item.message))))) : null,
      h3("p", { className: "dwb-note" }, uiMessage("world.matcherNote"))
    )
  );
}
function installWorldBookStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-world-book"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-world-book`;
  style.textContent = css3;
  document.head.append(style);
}

// packages/user/src/client.js
var import_react4 = require("react");

// packages/user/src/client-state.js
function sameOrderedIds(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((id, index) => id === right[index]);
}
function userResourceDirty(draft, saved) {
  if (draft === null || saved === null) return draft !== saved;
  return draft.id !== saved.id || draft.name !== saved.name || draft.description !== saved.description;
}
function userPanelDirty(draft, saved, worldBookIds, appliedWorldBookIds) {
  return userResourceDirty(draft, saved) || !sameOrderedIds(worldBookIds, appliedWorldBookIds);
}

// packages/user/src/client.js
var h4 = createLocalizedElement(import_react4.createElement);
var css4 = `
.dtu-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dtu-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dtu-title{font-size:16px;font-weight:650;flex:1}.dtu-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px;font-size:14px}.dtu-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dtu-toolbar,.dtu-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtu-button{min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:13px}.dtu-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtu-button:disabled{opacity:.5;cursor:default}.dtu-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dtu-danger{color:var(--dsw-alias-state-error)}.dtu-field{display:flex;flex-direction:column;gap:5px}.dtu-label{font-size:12px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dtu-input,.dtu-textarea,.dtu-select{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:8px 9px}.dtu-input,.dtu-select{height:36px}.dtu-textarea{min-height:220px;line-height:1.5;resize:vertical}.dtu-note{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dtu-status{font-size:13px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dtu-status[data-error=true]{color:var(--dsw-alias-state-error)}.dtu-status[data-warning=true]{color:var(--dsw-alias-state-warning,var(--dsw-alias-label-primary))}.dtu-editor{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dtu-bindings{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:9px}.dtu-check{display:flex;align-items:flex-start;gap:8px;font-size:13px;line-height:1.4}.dtu-section-title{font-size:14px;margin:4px 0 0}.dtu-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2)}
`;
function errorMessage3(data, status) {
  return data?.error?.message ?? data?.error ?? `HTTP ${status}`;
}
async function api4(path, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  const response = await fetch(`${API_V1}${path}`, {
    ...options,
    headers: {
      ...method === "GET" || method === "HEAD" ? {} : { "Content-Type": "application/json" },
      ...options.headers
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(errorMessage3(data, response.status));
  return data;
}
function Field4({ label, children }) {
  return h4("label", { className: "dtu-field" }, h4("span", { className: "dtu-label" }, label), children);
}
function notifyRefresh() {
  window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
}
function UserPanel({ sessionId, sessionBlank, close }) {
  const [users, setUsers] = (0, import_react4.useState)(null);
  const [draft, setDraft] = (0, import_react4.useState)(null);
  const [savedDraft, setSavedDraft] = (0, import_react4.useState)(null);
  const [worldBooks, setWorldBooks] = (0, import_react4.useState)(null);
  const [worldBookIds, setWorldBookIds] = (0, import_react4.useState)([]);
  const [appliedWorldBookIds, setAppliedWorldBookIds] = (0, import_react4.useState)([]);
  const [selectedUserId, setSelectedUserId] = (0, import_react4.useState)(null);
  const [busy, setBusy] = (0, import_react4.useState)(false);
  const [status, setStatus] = (0, import_react4.useState)({ error: false, key: "common.loading" });
  const generation = (0, import_react4.useRef)(0);
  const draftId = (0, import_react4.useRef)(null);
  const dirtyRef = (0, import_react4.useRef)(false);
  draftId.current = draft?.id ?? null;
  const dirty = userPanelDirty(draft, savedDraft, worldBookIds, appliedWorldBookIds);
  dirtyRef.current = dirty;
  const resourceDirty = userResourceDirty(draft, savedDraft);
  const bindingDirty = !sameOrderedIds(worldBookIds, appliedWorldBookIds);
  const run = (0, import_react4.useCallback)(async (operation, success, values) => {
    setBusy(true);
    try {
      const result = await operation();
      setStatus({ error: false, key: success, values });
      return result;
    } catch (error) {
      setStatus({
        error: true,
        key: error.uiKey,
        values: error.uiValues,
        text: error instanceof Error ? error.message : String(error)
      });
      return null;
    } finally {
      setBusy(false);
    }
  }, []);
  const refresh = (0, import_react4.useCallback)(async (preferredId) => {
    const current2 = ++generation.current;
    const [catalog2, worldBookCatalog, binding] = await Promise.all([
      api4("/users"),
      api4("/world-books"),
      sessionId ? api4(`/user-selection?sessionId=${encodeURIComponent(sessionId)}`) : Promise.resolve({ selection: null })
    ]);
    const availableIds = new Set(catalog2.users.map((user) => user.id));
    const preferred = availableIds.has(preferredId) ? preferredId : availableIds.has(binding.selection?.userId) ? binding.selection.userId : null;
    const id = preferred ?? catalog2.users[0]?.id ?? null;
    const relation = id === null ? { binding: { worldBookIds: [] } } : await api4(`/users/${encodeURIComponent(id)}/world-books`);
    if (current2 !== generation.current) return;
    setUsers(catalog2.users);
    setWorldBooks(worldBookCatalog.worldBooks);
    setSelectedUserId(binding.selection?.userId ?? null);
    const nextDraft = id === null ? null : structuredClone(catalog2.users.find((user) => user.id === id) ?? null);
    const ids = relation.binding?.worldBookIds ?? [];
    setDraft(nextDraft);
    setSavedDraft(nextDraft === null ? null : structuredClone(nextDraft));
    setWorldBookIds(ids);
    setAppliedWorldBookIds(ids);
  }, [sessionId]);
  (0, import_react4.useEffect)(() => {
    run(() => refresh(), "user.status.loaded");
    const onRefresh = () => {
      if (dirtyRef.current) {
        setStatus({ error: false, key: "user.status.skippedRefresh" });
        return;
      }
      run(() => refresh(draftId.current), "user.status.refreshed");
    };
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh);
    return () => {
      generation.current += 1;
      window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh);
    };
  }, [refresh, run]);
  (0, import_react4.useEffect)(() => {
    if (!dirty) return void 0;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const create2 = (0, import_react4.useCallback)(() => {
    if (dirty && !window.confirm(unwrapText(uiMessage("user.confirmDiscardForCreate")))) return;
    run(async () => {
      const data = await api4("/users", { method: "POST", body: JSON.stringify({ name: translate("user.defaultName"), description: "" }) });
      draftId.current = data.user.id;
      await refresh(data.user.id);
      notifyRefresh();
    }, "user.status.created");
  }, [dirty, refresh, run]);
  const save = (0, import_react4.useCallback)(() => run(async () => {
    if (draft === null) return;
    const data = await api4(`/users/${encodeURIComponent(draft.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: draft.name, description: draft.description })
    });
    draftId.current = data.user.id;
    setDraft(data.user);
    setSavedDraft(structuredClone(data.user));
    setUsers((current2) => current2?.map((user) => user.id === data.user.id ? data.user : user) ?? current2);
    notifyRefresh();
  }, "user.status.saved"), [draft, run]);
  const saveWorldBooks = (0, import_react4.useCallback)(() => run(async () => {
    if (draft === null) return;
    const data = await api4(`/users/${encodeURIComponent(draft.id)}/world-books`, {
      method: "PUT",
      body: JSON.stringify({ worldBookIds })
    });
    const ids = data.binding.worldBookIds;
    setWorldBookIds(ids);
    setAppliedWorldBookIds(ids);
    notifyRefresh();
  }, "user.status.worldBooksSaved"), [draft, run, worldBookIds]);
  const chooseUser = (0, import_react4.useCallback)((id) => {
    if (dirty && !window.confirm(unwrapText(uiMessage("user.confirmDiscardForSwitch")))) return;
    run(() => refresh(id), "user.status.userLoaded");
  }, [dirty, refresh, run]);
  const bind = (0, import_react4.useCallback)(() => run(async () => {
    if (!sessionId || draft === null) throw uiError("user.error.needSession");
    if (selectedUserId !== draft.id && sessionBlank === false && !window.confirm(unwrapText(uiMessage("user.confirmHistoricalSwitch")))) return;
    const data = await api4("/user-selection", {
      method: "POST",
      body: JSON.stringify({ sessionId, userId: draft.id })
    });
    setSelectedUserId(data.selection.userId);
    notifyRefresh();
  }, "user.status.bound"), [draft, run, selectedUserId, sessionBlank, sessionId]);
  const unbind = (0, import_react4.useCallback)(() => run(async () => {
    if (!sessionId) throw uiError("user.error.noSessionToUnbind");
    await api4("/user-selection", { method: "POST", body: JSON.stringify({ sessionId, userId: null }) });
    setSelectedUserId(null);
    notifyRefresh();
  }, "user.status.unbound"), [run, sessionId]);
  const remove = (0, import_react4.useCallback)(() => run(async () => {
    if (draft === null || !window.confirm(unwrapText(uiMessage("user.confirmDelete", { name: draft.name })))) return;
    await api4(`/users/${encodeURIComponent(draft.id)}`, { method: "DELETE", body: "{}" });
    draftId.current = null;
    await refresh(null);
    notifyRefresh();
  }, "user.status.deleted"), [draft, refresh, run]);
  const activeName = selectedUserId === null ? translate("nav.user.empty") : users?.find((user) => user.id === selectedUserId)?.name ?? selectedUserId;
  const requestClose = () => {
    if (!dirty || window.confirm(unwrapText(uiMessage("user.confirmCloseDirty")))) close();
  };
  const dirtyParts = [
    resourceDirty ? translate("user.dirty.name") : "",
    bindingDirty ? translate("user.dirty.binding") : ""
  ].filter(Boolean);
  const dirtyText = uiMessage("user.dirty", { parts: dirtyParts.join(translate("common.listSeparator")) });
  const closeLabel = uiMessage("panel.close", { title: unwrapText(uiMessage("user.title")) });
  return h4(
    "div",
    { className: "dtu-panel" },
    h4(
      "div",
      { className: "dtu-header" },
      h4("div", { className: "dtu-title" }, uiMessage("user.title")),
      h4("button", { className: "dtu-close", type: "button", title: closeLabel, "aria-label": closeLabel, onClick: requestClose }, "\u2715")
    ),
    h4(
      "div",
      { className: "dtu-body" },
      h4(
        "div",
        { className: "dtu-toolbar" },
        h4("button", { className: "dtu-button", type: "button", disabled: busy, onClick: create2 }, uiMessage("user.create")),
        h4("button", { className: "dtu-button", type: "button", disabled: busy, onClick: () => {
          if (!dirty || window.confirm(unwrapText(uiMessage("user.confirmDiscardRefresh")))) run(() => refresh(draft?.id), "user.status.refreshed");
        } }, uiMessage("common.refresh"))
      ),
      h4(Field4, { label: uiMessage("user.browse") }, h4(
        "select",
        {
          className: "dtu-select",
          value: draft?.id ?? "",
          disabled: busy || users === null || users.length === 0,
          onChange: (event) => chooseUser(event.target.value)
        },
        ...users?.length ? [] : [h4("option", { key: "empty", value: "" }, uiMessage("user.libraryEmpty"))],
        ...(users ?? []).map((user) => h4("option", { key: user.id, value: user.id }, rawText(user.name)))
      )),
      h4("p", { className: "dtu-note" }, uiMessage("user.sessionBinding", { session: sessionId || translate("common.none"), name: activeName })),
      h4("div", { className: "dtu-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, statusText(status)),
      dirty ? h4("div", { className: "dtu-status", "data-warning": true, role: "status" }, dirtyText) : h4("p", { className: "dtu-note" }, uiMessage("user.savedNote")),
      draft === null ? h4("p", { className: "dtu-note" }, users === null ? uiMessage("user.loading") : uiMessage("user.emptyHint")) : h4(
        "div",
        { className: "dtu-editor" },
        h4(Field4, { label: uiMessage("user.name", { macro: "{{user}}" }) }, h4("input", { className: "dtu-input", value: draft.name, maxLength: 200, onChange: (event) => setDraft((current2) => ({ ...current2, name: event.target.value })) })),
        h4(Field4, { label: uiMessage("user.description") }, h4("textarea", { className: "dtu-textarea", value: draft.description, maxLength: 1e5, onChange: (event) => setDraft((current2) => ({ ...current2, description: event.target.value })) })),
        h4(
          "div",
          { className: "dtu-actions" },
          h4("button", { className: "dtu-button dtu-primary", type: "button", disabled: busy || !resourceDirty, onClick: save }, resourceDirty ? uiMessage("user.saveResource") : uiMessage("user.resourceSaved")),
          h4("button", { className: "dtu-button dtu-primary", type: "button", disabled: busy || !sessionId || dirty, onClick: bind }, dirty ? uiMessage("user.saveFirst") : selectedUserId === draft.id ? uiMessage("user.refreshBinding") : uiMessage("user.bind"))
        ),
        h4("h2", { className: "dtu-section-title" }, uiMessage("user.worldBooksTitle")),
        h4("p", { className: "dtu-note" }, uiMessage("user.worldBooksHint")),
        worldBooks?.length ? h4("div", { className: "dtu-bindings" }, ...worldBooks.map((book) => h4(
          "label",
          { className: "dtu-check", key: book.id },
          h4("input", {
            type: "checkbox",
            checked: worldBookIds.includes(book.id),
            onChange: (event) => setWorldBookIds((current2) => event.target.checked ? [...current2, book.id] : current2.filter((id) => id !== book.id))
          }),
          h4("span", null, uiMessage("world.catalogItem", { name: book.name, count: book.entryCount }))
        ))) : h4("p", { className: "dtu-note" }, worldBooks === null ? uiMessage("user.worldBooksLoading") : uiMessage("user.worldBooksEmpty")),
        h4(
          "div",
          { className: "dtu-actions" },
          h4("button", { className: "dtu-button dtu-primary", type: "button", disabled: busy || !bindingDirty, onClick: saveWorldBooks }, bindingDirty ? uiMessage("user.saveWorldBooks") : uiMessage("user.worldBooksSaved")),
          h4("button", { className: "dtu-button", type: "button", disabled: busy || worldBookIds.length === 0, onClick: () => setWorldBookIds([]) }, uiMessage("user.clearPending"))
        ),
        h4("button", { className: "dtu-button", type: "button", disabled: busy || !sessionId || selectedUserId === null, onClick: unbind }, uiMessage("user.unbind")),
        h4("p", { className: "dtu-note" }, uiMessage("user.identityNote")),
        h4("div", { className: "dtu-footer" }, h4("button", { className: "dtu-button dtu-danger", type: "button", disabled: busy, onClick: remove }, uiMessage("user.delete")))
      )
    )
  );
}
function installUserStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-user"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-user`;
  style.textContent = css4;
  document.head.append(style);
}

// packages/tavern-trace/src/client.js
var import_react5 = require("react");
var h5 = createLocalizedElement(import_react5.createElement);
var TRACE_API = `${API_V1}/traces`;
var css5 = `
.dttrace-root{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:Inter,var(--dsw-font-family),sans-serif}
.dttrace-toolbar{min-height:48px;box-sizing:border-box;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;align-items:center;gap:10px;flex:none;zoom:var(--dtv-trace-scale,1);width:calc(100%/var(--dtv-trace-scale,1))}.dttrace-title{font-size:16px;font-weight:680;flex:1}.dttrace-button{border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:inherit;padding:7px 10px;font-size:13px;cursor:pointer}.dttrace-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dttrace-body{flex:1;min-height:0;overflow:auto;padding:12px max(14px,calc((100% - 880px)/2)) 28px}.dttrace-scale{zoom:var(--dtv-trace-scale,1);width:calc(100%/var(--dtv-trace-scale,1));display:flex;flex-direction:column;gap:10px;padding-bottom:8px}.dttrace-note,.dttrace-status{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0}.dttrace-status{padding:9px 10px;border-radius:8px;background:var(--dsw-specific-tip)}.dttrace-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dttrace-record{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);overflow:visible}.dttrace-record>summary{list-style:none;cursor:pointer;padding:10px 12px;display:flex;align-items:center;gap:8px;border-radius:10px}.dttrace-record[open]>summary{border-radius:10px 10px 0 0}.dttrace-record>summary::-webkit-details-marker{display:none}.dttrace-round{font-size:14px;font-weight:670}.dttrace-time{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-left:auto}.dttrace-badge{border-radius:999px;padding:2px 7px;font-size:11px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-secondary)}.dttrace-badge[data-ok=true]{background:color-mix(in srgb,var(--dsw-alias-state-success,#2fa36b) 18%,transparent);color:var(--dsw-alias-state-success,#2fa36b)}
.dttrace-content{border-top:1px solid var(--dsw-alias-border-l1);padding:11px 12px 16px;display:flex;flex-direction:column;gap:10px}.dttrace-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.dttrace-card{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;min-width:0}.dttrace-label{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}.dttrace-value{font-size:13px;font-weight:620;margin-top:3px;overflow-wrap:anywhere}.dttrace-meta{font-size:12px;line-height:1.45;color:var(--dsw-alias-label-tertiary);margin-top:3px;overflow-wrap:anywhere}
.dttrace-section{display:flex;flex-direction:column;gap:6px}.dttrace-section-title{font-size:14px;font-weight:670}.dttrace-book{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px}.dttrace-decision{display:grid;grid-template-columns:76px minmax(110px,.7fr) minmax(160px,1.5fr);gap:7px;padding:6px 0;border-top:1px solid var(--dsw-alias-border-l1);font-size:12px;line-height:1.45}.dttrace-decision:first-of-type{border-top:0}.dttrace-decision-state{font-weight:650}.dttrace-decision[data-included=true] .dttrace-decision-state{color:var(--dsw-alias-state-success,#2fa36b)}.dttrace-keywords{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}.dttrace-list{margin:0;padding-left:18px;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary)}
@media(max-width:760px){.dttrace-grid{grid-template-columns:1fr}.dttrace-decision{grid-template-columns:70px 1fr}.dttrace-keywords{grid-column:1/-1}}
`;
var reasonLabels = Object.freeze({
  constant: "trace.reason.constant",
  "primary-key-match": "trace.reason.primary-key-match",
  "primary-key-miss": "trace.reason.primary-key-miss",
  "secondary-and_any-match": "trace.reason.secondary-and_any-match",
  "secondary-and_any-miss": "trace.reason.secondary-and_any-miss",
  "secondary-and_all-match": "trace.reason.secondary-and_all-match",
  "secondary-and_all-miss": "trace.reason.secondary-and_all-miss",
  "secondary-not_any-match": "trace.reason.secondary-not_any-match",
  "secondary-not_any-miss": "trace.reason.secondary-not_any-miss",
  "secondary-not_all-match": "trace.reason.secondary-not_all-match",
  "secondary-not_all-miss": "trace.reason.secondary-not_all-miss",
  disabled: "trace.reason.disabled",
  "external-vector-match-required": "trace.reason.external-vector-match-required",
  "inclusion-group-loser": "trace.reason.inclusion-group-loser",
  "probability-failed": "trace.reason.probability-failed",
  "budget-exceeded": "trace.reason.budget-exceeded",
  "empty-content": "trace.reason.empty-content",
  "outlet-unsupported": "trace.reason.outlet-unsupported"
});
function formatTime(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}
function formatBytes(value) {
  return value >= 1024 * 1024 ? `${Math.round(value / 1024 / 1024)} MiB` : `${Math.round(value / 1024)} KiB`;
}
function storageStatus(storage) {
  const parts = [translate("trace.storage.total", { value: formatBytes(storage.maxTotalBytes) })];
  if (Number.isSafeInteger(storage.maxRecordsPerSession)) parts.push(translate("trace.storage.perSession", { value: storage.maxRecordsPerSession }));
  if (Number.isSafeInteger(storage.maxSessions)) parts.push(translate("trace.storage.sessions", { value: storage.maxSessions }));
  if (Number.isSafeInteger(storage.maxRecordBytes)) parts.push(translate("trace.storage.perRecord", { value: formatBytes(storage.maxRecordBytes) }));
  return uiMessage("trace.storage.summary", { limits: parts.join(translate("common.listSeparator")) });
}
function resourceCard(labelKey, value) {
  return h5(
    "div",
    { className: "dttrace-card", key: labelKey },
    h5("div", { className: "dttrace-label" }, uiMessage(labelKey)),
    h5("div", { className: "dttrace-value" }, value?.name ? rawText(value.name) : uiMessage("trace.unused")),
    value?.id ? h5("div", { className: "dttrace-meta" }, rawText(value.id)) : null
  );
}
function keywords(decision) {
  const configuredPrimary = decision.primaryKeys ?? [];
  const configuredSecondary = decision.secondaryKeys ?? [];
  const primary = decision.primaryMatches ?? [];
  const secondary = decision.secondaryMatches ?? [];
  const separator = translate("common.listSeparator");
  const configured = [
    configuredPrimary.length > 0 ? translate("trace.keywords.primary", { values: configuredPrimary.map((value) => JSON.stringify(value)).join(separator) }) : null,
    configuredSecondary.length > 0 ? translate("trace.keywords.secondary", { values: configuredSecondary.map((value) => JSON.stringify(value)).join(separator) }) : null
  ].filter(Boolean).join(" \xB7 ") || translate("trace.noConfiguredKeywords");
  const matched = [
    primary.length > 0 ? translate("trace.keywords.primary", { values: primary.map((value) => JSON.stringify(value)).join(separator) }) : null,
    secondary.length > 0 ? translate("trace.keywords.secondary", { values: secondary.map((value) => JSON.stringify(value)).join(separator) }) : null
  ].filter(Boolean).join(" \xB7 ") || translate("trace.noKeywordMatches");
  return { configured: rawText(configured), matched: rawText(matched) };
}
function decisionMeta(value) {
  const parts = [];
  if (value.secondaryLogic) parts.push(`secondary=${value.secondaryLogic}`);
  if (value.groupName) parts.push(unwrapText(uiMessage("trace.decision.group", { name: value.groupName, detail: value.groupOverride ? " / override" : value.groupWeight === null ? "" : ` / weight ${value.groupWeight}` })));
  if (value.probability !== null) {
    parts.push(unwrapText(uiMessage("trace.decision.probability", { value: value.probability, roll: value.probabilityRoll === null ? "" : ` / roll ${(value.probabilityRoll * 100).toFixed(2)}%` })));
  }
  if (value.tokenCost !== null) parts.push(unwrapText(uiMessage("trace.decision.budget", { value: value.tokenCost })));
  if (value.requestedPosition) {
    parts.push(unwrapText(uiMessage("trace.decision.position", {
      requested: value.requestedPosition,
      result: value.appliedPosition ? translate("trace.position.applied", {
        position: value.appliedPosition,
        approximate: value.approximatePosition ? translate("trace.position.approximate") : ""
      }) : translate("trace.position.notInserted")
    })));
  }
  return rawText(parts.join(" \xB7 "));
}
function WorldBookAudit({ book }) {
  const name2 = book.resource?.name || book.resource?.id;
  const decisionCount = translate(book.decisions.length === 1 ? "trace.decisionCount.one" : "trace.decisionCount.other", { count: book.decisions.length });
  return h5(
    "div",
    { className: "dttrace-book" },
    h5("div", { className: "dttrace-section-title" }, name2 ? rawText(name2) : uiMessage("nav.worldBook")),
    h5("div", { className: "dttrace-meta" }, uiMessage("trace.bookBudget", { used: book.budget.used, limit: book.budget.limit === null ? "" : ` / ${book.budget.limit}`, decisionCount })),
    ...book.decisions.map((item, index) => {
      const keywordState = keywords(item);
      return h5(
        "div",
        {
          className: "dttrace-decision",
          "data-included": item.decision === "included",
          key: `${item.entryId ?? "entry"}-${index}`
        },
        h5("div", { className: "dttrace-decision-state" }, item.decision === "included" ? uiMessage("trace.inserted") : uiMessage("trace.rejected")),
        h5(
          "div",
          null,
          h5("div", null, item.entryName ? rawText(item.entryName) : uiMessage("world.entry.fallback", { id: String(item.entryId ?? index + 1) })),
          h5("div", { className: "dttrace-meta" }, reasonLabels[item.reason] ? uiMessage(reasonLabels[item.reason]) : rawText(item.reason))
        ),
        h5(
          "div",
          { className: "dttrace-keywords" },
          h5("div", null, uiMessage("trace.keywords.configured", { value: unwrapText(keywordState.configured) })),
          h5("div", null, uiMessage("trace.keywords.matched", { value: unwrapText(keywordState.matched) })),
          h5("div", { className: "dttrace-meta" }, decisionMeta(item))
        )
      );
    })
  );
}
function TraceRecord({ record, latest }) {
  const authority = record.authority ?? {};
  const linked = authority.headerEventSeq !== null;
  const reusedHeader = authority.headerReused ? translate("trace.reusedHeader") : "";
  const profileStatus = translate(authority.tavernProfilePresent === false ? "trace.profile.missing" : authority.tavernProfilePresent === true ? "trace.profile.consistent" : "trace.profile.absent");
  const configStatus = translate(authority.tavernCallConfigApplied === false ? "trace.config.inconsistent" : "trace.config.consistent");
  return h5(
    "details",
    { className: "dttrace-record", open: latest },
    h5(
      "summary",
      null,
      h5("span", { className: "dttrace-round" }, uiMessage(record.attempt > 1 ? "trace.roundAttempt" : "trace.round", { turn: record.turn, step: record.step, attempt: record.attempt })),
      h5("span", { className: "dttrace-badge", "data-ok": linked || void 0 }, linked ? rawText(`request/header #${authority.headerEventSeq}`) : uiMessage("trace.waitingHeader")),
      h5("span", { className: "dttrace-time" }, rawText(formatTime(record.recordedAt)))
    ),
    h5(
      "div",
      { className: "dttrace-content" },
      h5("div", { className: "dttrace-status" }, linked ? uiMessage("trace.recordAligned", { sequence: authority.headerEventSeq, reused: reusedHeader, profile: profileStatus, config: configStatus }) : uiMessage("trace.pendingHeader")),
      h5(
        "div",
        { className: "dttrace-grid" },
        resourceCard("trace.resource.preset", record.resources?.preset),
        resourceCard("trace.resource.character", record.resources?.characterCard),
        resourceCard("trace.resource.user", record.resources?.userProfile)
      ),
      h5(
        "div",
        { className: "dttrace-section" },
        h5("div", { className: "dttrace-section-title" }, uiMessage("trace.assembly")),
        h5("div", { className: "dttrace-meta" }, uiMessage("trace.assemblyMeta", {
          section: record.assembly.profileSection,
          order: record.assembly.profileOrder,
          mode: record.assembly.systemPromptMode,
          characters: record.assembly.systemCharacters,
          config: Object.keys(record.assembly.callConfig ?? {}).join(", ") || translate("common.none")
        }))
      ),
      record.worldBooks?.length > 0 ? h5(
        "div",
        { className: "dttrace-section" },
        h5("div", { className: "dttrace-section-title" }, uiMessage("trace.worldBookDecisions")),
        h5("div", { className: "dttrace-meta" }, record.activation?.pendingMessageCount > 0 ? uiMessage("trace.activationPending", {
          included: record.activation.includedPendingMessageCount,
          pending: record.activation.pendingMessageCount,
          truncated: record.activation.truncated ? translate("trace.truncated") : ""
        }) : uiMessage("trace.historyOnly")),
        ...record.worldBooks.map((book, index) => h5(WorldBookAudit, { book, key: `${book.resource?.id ?? "book"}-${index}` }))
      ) : h5("div", { className: "dttrace-note" }, uiMessage("trace.noSource")),
      record.diagnostics?.length > 0 ? h5(
        "div",
        { className: "dttrace-section" },
        h5("div", { className: "dttrace-section-title" }, uiMessage("trace.diagnostics", { count: record.diagnostics.length })),
        h5("ul", { className: "dttrace-list" }, ...record.diagnostics.map((item, index) => h5("li", { key: `${item.code}-${index}` }, rawText(`${item.code}: ${item.message}`))))
      ) : null,
      h5("p", { className: "dttrace-note" }, uiMessage("trace.privacy"))
    )
  );
}
function TavernTraceView({ sessionId, useSession }) {
  const lastVisibleSeq = useSession((snapshot) => snapshot.nodes.at(-1)?.seq ?? -1);
  const running = useSession((snapshot) => snapshot.running);
  const [data, setData] = (0, import_react5.useState)(null);
  const [error, setError] = (0, import_react5.useState)("");
  const [uiSettings, setUiSettings] = (0, import_react5.useState)(getClientUiSettings);
  const refresh = (0, import_react5.useCallback)(async () => {
    try {
      const response = await fetch(`${TRACE_API}?sessionId=${encodeURIComponent(sessionId)}`);
      const next = await response.json().catch(() => null);
      if (!response.ok || next?.ok === false) throw new Error(next?.error ?? `HTTP ${response.status}`);
      setData(next);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [sessionId]);
  (0, import_react5.useEffect)(() => {
    refresh();
  }, [refresh, lastVisibleSeq, running]);
  (0, import_react5.useEffect)(() => {
    const onSettings = (event) => setUiSettings(event.detail ?? getClientUiSettings());
    window.addEventListener(CLIENT_UI_SETTINGS_EVENT, onSettings);
    return () => window.removeEventListener(CLIENT_UI_SETTINGS_EVENT, onSettings);
  }, []);
  const records = [...data?.records ?? []].reverse();
  return h5(
    "div",
    {
      className: "dttrace-root",
      lang: uiSettings.locale,
      style: { "--dtv-trace-scale": String(uiSettings.scale) }
    },
    h5(
      "div",
      { className: "dttrace-toolbar" },
      h5("div", { className: "dttrace-title" }, uiMessage("trace.title")),
      h5("button", { className: "dttrace-button", type: "button", onClick: refresh }, uiMessage("common.refresh"))
    ),
    h5(
      "div",
      { className: "dttrace-body" },
      h5(
        "div",
        { className: "dttrace-scale" },
        h5("p", { className: "dttrace-note" }, uiMessage("trace.intro")),
        error ? h5("div", { className: "dttrace-status", "data-error": true }, rawText(error)) : null,
        data === null && !error ? h5("div", { className: "dttrace-status" }, uiMessage("trace.reading")) : null,
        data !== null ? h5("div", { className: "dttrace-status" }, storageStatus(data.storage)) : null,
        records.length === 0 && data !== null ? h5("div", { className: "dttrace-status" }, uiMessage("trace.empty")) : null,
        ...records.map((record, index) => h5(TraceRecord, { record, latest: index === 0, key: record.id }))
      )
    )
  );
}
function installTavernTraceStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-trace"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-trace`;
  style.textContent = css5;
  document.head.append(style);
}
function registerTavernTraceView(ctx) {
  ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view",
    id: "tavern-trace",
    order: 20,
    label: translate("trace.title"),
    inject: () => ({})
  }, TavernTraceView));
}

// packages/session-template/src/client.js
var import_react6 = require("react");
var h6 = createLocalizedElement(import_react6.createElement);
async function api5(path, options = {}) {
  const response = await fetch(`${API_V1}${path}`, {
    ...options,
    headers: options.body === void 0 ? options.headers : { "Content-Type": "application/json", ...options.headers }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error?.message ?? data?.error ?? `HTTP ${response.status}`);
    error.diagnostics = data?.error?.diagnostics ?? [];
    throw error;
  }
  return data;
}
function PreviewRow({ label, value, missing = false }) {
  return h6(
    "div",
    { className: "dtv-preview-row", "data-missing": missing || void 0 },
    h6("span", { className: "dtv-preview-label" }, label),
    h6("span", { className: "dtv-preview-value" }, value)
  );
}
function resourceValue(resource, emptyKey) {
  return resource === null || resource === void 0 ? uiMessage(emptyKey) : rawText(resource.name || resource.id);
}
function TemplatePreview({ template }) {
  const contents = template?.contents ?? {};
  const character = template?.selection?.character ?? contents.character ?? {};
  const books = Array.isArray(contents.worldBooks) ? contents.worldBooks : [];
  const enabledLabel = character.preferCharacterSystemPrompt === false ? translate("common.disabled") : translate("common.enabled");
  const postHistoryLabel = character.preferCharacterPostHistory === false ? translate("common.disabled") : translate("common.enabled");
  return h6(
    "div",
    { className: "dtv-preview" },
    h6("div", { className: "dtv-preview-title" }, uiMessage("template.preview.title")),
    h6(PreviewRow, { label: uiMessage("nav.preset"), value: resourceValue(contents.preset, "nav.preset.empty"), missing: contents.preset?.missing }),
    h6(PreviewRow, { label: uiMessage("nav.character"), value: resourceValue(contents.characterCard, "nav.character.empty"), missing: contents.characterCard?.missing }),
    contents.characterCard === null || contents.characterCard === void 0 ? null : h6(
      "div",
      { className: "dtv-preview-options" },
      h6("span", null, uiMessage("template.preview.greeting", { value: Number(character.greetingIndex ?? 0) + 1 })),
      h6("span", null, uiMessage("template.preview.systemPrompt", { value: enabledLabel })),
      h6("span", null, uiMessage("template.preview.postHistory", { value: postHistoryLabel }))
    ),
    h6(PreviewRow, { label: uiMessage("nav.user"), value: resourceValue(contents.user, "nav.user.empty"), missing: contents.user?.missing }),
    h6(
      "div",
      { className: "dtv-preview-row dtv-preview-books" },
      h6("span", { className: "dtv-preview-label" }, uiMessage("template.preview.worldBooks")),
      books.length === 0 ? h6("span", { className: "dtv-preview-value" }, uiMessage("nav.worldBook.empty")) : h6("ol", { className: "dtv-preview-list" }, ...books.map((book) => h6("li", { key: book.id, "data-missing": book.missing || void 0 }, rawText(book.name || book.id))))
    )
  );
}
function SessionTemplatePanel({ sessionId, workspaceId, createCleanSession, close }) {
  const [templates, setTemplates] = (0, import_react6.useState)([]);
  const [selectedId, setSelectedId] = (0, import_react6.useState)(null);
  const [name2, setName] = (0, import_react6.useState)(() => translate("template.defaultName"));
  const [busy, setBusy] = (0, import_react6.useState)(false);
  const [status, setStatus] = (0, import_react6.useState)({ error: false, key: "template.ready" });
  const selected = templates.find((item) => item.id === selectedId) ?? null;
  const refresh = (0, import_react6.useCallback)(async () => {
    const data = await api5("/session-templates");
    setTemplates(data.templates);
    setSelectedId(data.selectedId);
    const active = data.templates.find((item) => item.id === data.selectedId);
    if (active !== void 0) setName(active.name);
  }, []);
  (0, import_react6.useEffect)(() => {
    refresh().catch((reason) => setStatus({
      error: true,
      key: reason.uiKey,
      values: reason.uiValues,
      text: reason instanceof Error ? reason.message : String(reason)
    }));
    const onRefresh = () => refresh().catch((reason) => setStatus({
      error: true,
      key: reason.uiKey,
      values: reason.uiValues,
      text: reason instanceof Error ? reason.message : String(reason)
    }));
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh);
  }, [refresh]);
  const run = (0, import_react6.useCallback)(async (operation, success) => {
    setBusy(true);
    try {
      const result = await operation();
      const next = typeof success === "function" ? success(result) : success;
      setStatus(typeof next === "string" ? { error: false, key: next } : { error: false, ...next });
      await refresh();
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
      return result;
    } catch (reason) {
      const diagnostics2 = Array.isArray(reason?.diagnostics) ? reason.diagnostics : [];
      setStatus({
        error: true,
        key: reason.uiKey,
        values: reason.uiValues,
        text: diagnostics2[0]?.message ?? (reason instanceof Error ? reason.message : String(reason))
      });
      return null;
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  const select = (event) => run(async () => {
    const id = event.target.value || null;
    const data = await api5("/session-templates/select", {
      method: "POST",
      body: JSON.stringify({ id })
    });
    setSelectedId(data.selectedId);
    if (data.template !== null) setName(data.template.name);
  }, "template.status.selected");
  const create2 = () => run(async () => {
    if (!sessionId) throw uiError("template.error.needSessionToSave");
    return api5("/session-templates", {
      method: "POST",
      body: JSON.stringify({ name: name2, sourceSessionId: sessionId })
    });
  }, (result) => ({ key: "template.status.created", values: { name: result.template.name } }));
  const rename = () => run(async () => {
    if (selectedId === null) throw uiError("template.error.needTemplate");
    return api5(`/session-templates/${encodeURIComponent(selectedId)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: name2 })
    });
  }, (result) => ({ key: "template.status.renamed", values: { name: result.template.name } }));
  const update = () => run(async () => {
    if (!sessionId || selectedId === null) throw uiError("template.error.needSessionAndTemplate");
    return api5(`/session-templates/${encodeURIComponent(selectedId)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: name2, sourceSessionId: sessionId })
    });
  }, (result) => ({ key: "template.status.updated", values: { name: result.template.name } }));
  const remove = () => {
    if (selectedId === null || !window.confirm(unwrapText(uiMessage("template.confirmDelete", { name: selected?.name ?? selectedId })))) return;
    run(() => api5(`/session-templates/${encodeURIComponent(selectedId)}`, { method: "DELETE", body: JSON.stringify({}) }), "template.status.deleted");
  };
  const start = (mode) => run(async () => {
    if (mode === "current" && !sessionId) throw uiError("template.error.needSourceSession");
    if (workspaceId === null) throw uiError("template.error.needWorkspace");
    const source = mode === "current" ? { mode: "current", sessionId } : { mode: "template", templateId: selectedId };
    if (mode === "template" && selectedId === null) throw uiError("template.error.needTemplate");
    return createCleanSession({ workspaceId, source });
  }, (id) => ({ key: "template.status.switched", values: { id } }));
  const diagnostics = Array.isArray(selected?.diagnostics) ? selected.diagnostics : [];
  const closeLabel = uiMessage("panel.close", { title: unwrapText(uiMessage("template.title")) });
  return h6(
    "div",
    { className: "dtv-panel" },
    h6(
      "div",
      { className: "dtv-header" },
      h6("div", { className: "dtv-title" }, uiMessage("template.title")),
      h6("button", { className: "dtv-close", type: "button", title: closeLabel, "aria-label": closeLabel, onClick: close }, "\u2715")
    ),
    h6(
      "div",
      { className: "dtv-body" },
      h6("button", {
        className: "dtv-button dtv-primary",
        type: "button",
        disabled: busy || !sessionId || workspaceId === null,
        onClick: () => start("current")
      }, uiMessage("template.startCurrent")),
      h6("p", { className: "dtv-note" }, uiMessage("template.inheritNote")),
      workspaceId === null ? h6("div", { className: "dtv-status", "data-error": true }, uiMessage("template.noWorkspace")) : null,
      h6(
        "div",
        { className: "dtv-resource" },
        h6("div", { className: "dtv-resource-title" }, uiMessage("template.listTitle", { count: templates.length })),
        h6(
          "label",
          { className: "dtv-field" },
          h6("span", { className: "dtv-label" }, uiMessage("template.selected")),
          h6(
            "select",
            { className: "dtv-select", value: selectedId ?? "", disabled: busy, onChange: select },
            h6("option", { value: "" }, uiMessage("template.noneSelected")),
            ...templates.map((template) => h6("option", { key: template.id, value: template.id }, rawText(template.name)))
          )
        ),
        h6(
          "label",
          { className: "dtv-field" },
          h6("span", { className: "dtv-label" }, uiMessage("template.name")),
          h6("input", { className: "dtv-input", value: name2, maxLength: 120, disabled: busy, onChange: (event) => setName(event.target.value) })
        ),
        h6(
          "div",
          { className: "dtv-template-actions" },
          h6("button", { className: "dtv-button", type: "button", disabled: busy || !sessionId, onClick: create2 }, uiMessage("template.createFromCurrent")),
          h6("button", { className: "dtv-button", type: "button", disabled: busy || selectedId === null, onClick: rename }, uiMessage("template.saveNameOnly")),
          h6("button", { className: "dtv-button", type: "button", disabled: busy || !sessionId || selectedId === null, onClick: update }, uiMessage("template.updateFromCurrent")),
          h6("button", { className: "dtv-button dtv-danger", type: "button", disabled: busy || selectedId === null, onClick: remove }, uiMessage("template.delete"))
        ),
        h6("p", { className: "dtv-note" }, uiMessage("template.currentSettingsReminder")),
        selected === null ? null : h6(TemplatePreview, { template: selected }),
        diagnostics.length === 0 ? null : h6(
          "div",
          { className: "dtv-status", "data-error": true },
          h6("div", null, uiMessage("template.unusable")),
          h6("ul", { className: "dtv-list" }, ...diagnostics.map((item, index) => h6("li", { key: `${item.code}-${index}` }, rawText(item.message))))
        ),
        h6("button", {
          className: "dtv-button dtv-primary",
          type: "button",
          disabled: busy || selectedId === null || diagnostics.length > 0 || workspaceId === null,
          onClick: () => start("template")
        }, uiMessage("template.startFromTemplate"))
      ),
      h6("div", { className: "dtv-status", "data-error": status.error || void 0, role: "status" }, statusText(status)),
      h6("p", { className: "dtv-note" }, uiMessage("template.blankSessionNote"))
    )
  );
}

// packages/session-template/src/client-state.js
function workspaceIdForSession(workspaces, sessionId) {
  if (!Array.isArray(workspaces) || typeof sessionId !== "string" || sessionId === "") return null;
  return workspaces.find((item) => Array.isArray(item?.sessionIds) && item.sessionIds.includes(sessionId))?.workspaceId ?? null;
}
function workspaceTargetId(workspaceState, sessionId) {
  if (typeof sessionId === "string" && sessionId !== "") {
    return workspaceIdForSession(workspaceState?.items, sessionId);
  }
  return typeof workspaceState?.recentWorkspaceId === "string" && workspaceState.recentWorkspaceId !== "" ? workspaceState.recentWorkspaceId : null;
}
var SessionConfigurationUnavailableError = class extends Error {
  constructor(diagnostics = []) {
    super(diagnostics[0]?.message ?? "\u5F53\u524D\u914D\u7F6E\u5305\u542B\u7F3A\u5931\u6216\u65E0\u6548\u8D44\u6E90\uFF0C\u65E0\u6CD5\u521B\u5EFA\u65B0\u4F1A\u8BDD");
    this.name = "SessionConfigurationUnavailableError";
    this.diagnostics = structuredClone(diagnostics);
  }
};
async function createCleanSessionWorkflow({
  workspaceId,
  source,
  preview,
  connectWorkspace,
  applySelection,
  openSession,
  refresh
}) {
  if (workspaceId === null || workspaceId === void 0 || workspaceId === "") {
    throw new Error("\u5F53\u524D\u4F1A\u8BDD\u4E0D\u5C5E\u4E8E DSH \u5DE5\u4F5C\u533A\uFF1B\u8BF7\u5148\u628A\u4F1A\u8BDD\u52A0\u5165\u5DE5\u4F5C\u533A\uFF0C\u518D\u521B\u5EFA\u5E72\u51C0\u4F1A\u8BDD");
  }
  const checked = await preview(source);
  if (checked?.available !== true) throw new SessionConfigurationUnavailableError(checked?.diagnostics);
  const targetSessionId = await connectWorkspace(workspaceId);
  await applySelection(targetSessionId, source);
  openSession(targetSessionId);
  refresh();
  return targetSessionId;
}

// packages/client/src/state.js
var TAVERN_MENU_ITEMS = Object.freeze([
  { id: "preset", labelKey: "nav.preset", emptyTitleKey: "nav.preset.empty", available: true },
  { id: "character", labelKey: "nav.character", emptyTitleKey: "nav.character.empty", available: true },
  { id: "world-info", labelKey: "nav.worldBook", emptyTitleKey: "nav.worldBook.empty", available: true },
  { id: "regex", labelKey: "nav.regex", emptyTitleKey: "nav.regex.empty", available: true, binding: false, showBinding: false, playOnly: true },
  { id: "user", labelKey: "nav.user", emptyTitleKey: "nav.user.empty", available: true },
  { id: "session-template", labelKey: "nav.sessionTemplate", emptyTitleKey: "nav.sessionTemplate.empty", available: true, binding: false, showBinding: false },
  { id: "settings", labelKey: "nav.settings", emptyTitleKey: "nav.settings.empty", available: true, binding: false, showBinding: false }
]);
var TAVERN_LAUNCHER_SIZE = 44;
var TAVERN_LAUNCHER_PANEL = Object.freeze({ width: 300, height: 376 });
function isRecord2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function firstRecord(...values) {
  return values.find(isRecord2) ?? null;
}
function firstArray(...values) {
  return values.find(Array.isArray) ?? [];
}
function resourceTitle(resource, fallback = "") {
  if (!isRecord2(resource)) return fallback;
  for (const key of ["name", "title", "displayName", "label"]) {
    if (typeof resource[key] === "string" && resource[key].trim() !== "") return resource[key].trim();
  }
  return fallback;
}
function catalog(snapshot, ...keys) {
  for (const container of [snapshot?.catalog, snapshot?.catalogs]) {
    if (!isRecord2(container)) continue;
    for (const key of keys) {
      if (Array.isArray(container[key])) return container[key];
      if (Array.isArray(container[key]?.items)) return container[key].items;
    }
  }
  return [];
}
function findResourceById(items, id) {
  return items.find((item) => isRecord2(item) && String(item.id ?? item.resourceId ?? "") === String(id)) ?? null;
}
function selectionIds(value) {
  if (!Array.isArray(value)) return [];
  const ids = value.map((item) => isRecord2(item) ? item.id ?? item.resourceId : item).filter((id) => typeof id === "string" && id !== "" || Number.isSafeInteger(id));
  return ids.filter((id, index) => ids.findIndex((item) => String(item) === String(id)) === index);
}
function singleStatus({ id, resource, items, emptyTitleKey }) {
  const bound = id !== null && id !== void 0 && id !== "";
  const directResource = isRecord2(resource) && (resource.id === void 0 || String(resource.id) === String(id)) ? resource : null;
  const resolved = firstRecord(directResource, bound ? findResourceById(items, id) : null);
  return {
    bound,
    title: bound ? resourceTitle(resolved, String(id)) : null,
    titleKey: bound ? null : emptyTitleKey,
    count: bound ? 1 : 0
  };
}
function launcherResourceStatuses(snapshot) {
  const selection = isRecord2(snapshot?.selection) ? snapshot.selection : {};
  const resources = isRecord2(snapshot?.resources) ? snapshot.resources : {};
  const presetResource = firstRecord(resources.preset, snapshot?.selected);
  const presetId = selection.presetId ?? presetResource?.id ?? null;
  const characterResource = firstRecord(resources.characterCard, resources.character);
  const characterId = selection.characterCardId ?? selection.characterId ?? characterResource?.id ?? null;
  const userResource = firstRecord(resources.user, resources.userProfile, resources.persona);
  const userId = selection.userId ?? selection.userProfileId ?? selection.personaId ?? userResource?.id ?? null;
  const explicitWorldIds = selectionIds(firstArray(
    selection.worldBookIds,
    selection.worldBooks,
    selection.worldBookSelection?.ids
  ));
  const resolvedWorlds = firstArray(resources.worldBooks, resources.worldBook).filter(isRecord2);
  const implicitlySelectedWorlds = resolvedWorlds.filter((resource) => resource.selected !== false);
  const worldIds = explicitWorldIds.length > 0 ? explicitWorldIds : implicitlySelectedWorlds.map((resource) => resource.id ?? resource.resourceId).filter((id) => id !== void 0 && id !== null);
  const worldCatalog = catalog(snapshot, "worldBooks", "worldBook", "lorebooks");
  const selectedWorlds = worldIds.map((id) => firstRecord(
    findResourceById(resolvedWorlds, id),
    findResourceById(worldCatalog, id),
    { id }
  ));
  for (const resource of implicitlySelectedWorlds) {
    const id = resource.id ?? resource.resourceId;
    if (id === void 0 || id === null || selectedWorlds.some((item) => String(item.id ?? item.resourceId) === String(id))) continue;
    selectedWorlds.push(resource);
  }
  const worldTitles = selectedWorlds.map((resource) => resourceTitle(resource, String(resource.id ?? resource.resourceId ?? "")));
  return {
    preset: singleStatus({
      id: presetId,
      resource: presetResource,
      items: catalog(snapshot, "presets", "preset"),
      emptyTitleKey: "nav.preset.empty"
    }),
    character: singleStatus({
      id: characterId,
      resource: characterResource,
      items: catalog(snapshot, "characters", "characterCards", "character"),
      emptyTitleKey: "nav.character.empty"
    }),
    "world-info": {
      bound: selectedWorlds.length > 0,
      count: selectedWorlds.length,
      title: selectedWorlds.length === 0 ? null : selectedWorlds.length === 1 ? worldTitles[0] : worldTitles.join(" \xB7 "),
      titleKey: selectedWorlds.length === 0 ? "nav.worldBook.empty" : null
    },
    user: singleStatus({
      id: userId,
      resource: userResource,
      items: catalog(snapshot, "users", "userProfiles", "personas"),
      emptyTitleKey: "nav.user.empty"
    }),
    "session-template": { bound: false, count: 0, title: null, titleKey: "nav.sessionTemplate.empty" },
    settings: { bound: false, count: 0, title: null, titleKey: "nav.settings.empty" },
    regex: { bound: false, count: 0, title: null, titleKey: "nav.regex.empty" }
  };
}
function clampLauncherAnchor(position, viewport2, scale = 1) {
  const width = Math.max(TAVERN_LAUNCHER_SIZE, Number(viewport2?.width) || TAVERN_LAUNCHER_SIZE);
  const height = Math.max(TAVERN_LAUNCHER_SIZE, Number(viewport2?.height) || TAVERN_LAUNCHER_SIZE);
  const launcherSize = TAVERN_LAUNCHER_SIZE * Math.max(0.1, Number(scale) || 1);
  const margin = 8;
  return {
    x: Math.min(width - launcherSize - margin, Math.max(margin, Number(position?.x) || margin)),
    y: Math.min(height - launcherSize - margin, Math.max(margin, Number(position?.y) || margin))
  };
}
function launcherPlacement(anchor, viewport2, expanded = false, scale = 1) {
  const factor = Math.max(0.1, Number(scale) || 1);
  const point = clampLauncherAnchor(anchor, viewport2, factor);
  const panelWidth = TAVERN_LAUNCHER_PANEL.width * factor;
  const panelHeight = TAVERN_LAUNCHER_PANEL.height * factor;
  const launcherSize = TAVERN_LAUNCHER_SIZE * factor;
  const opensLeft = point.x + panelWidth > viewport2.width - 8;
  const opensUp = point.y + panelHeight > viewport2.height - 8;
  return {
    side: opensLeft ? "left" : "right",
    vertical: opensUp ? "up" : "down",
    left: expanded && opensLeft ? point.x - panelWidth + launcherSize : point.x,
    top: expanded && opensUp ? point.y - panelHeight + launcherSize : point.y,
    anchor: point
  };
}

// packages/client/src/play/chrome.js
function nextChromeMode(mode) {
  return mode === "play" ? "native" : "play";
}
function createChromeClickController({
  getMode,
  persistMode,
  openMenu,
  closeMenu,
  setMode,
  setError = () => {
  }
}) {
  if (typeof getMode !== "function") throw new TypeError("getMode is required");
  if (typeof persistMode !== "function") throw new TypeError("persistMode is required");
  if (typeof openMenu !== "function") throw new TypeError("openMenu is required");
  if (typeof closeMenu !== "function") throw new TypeError("closeMenu is required");
  if (typeof setMode !== "function") throw new TypeError("setMode is required");
  let switching = false;
  let disposed = false;
  const switchMode = async ({ suppressed = false } = {}) => {
    closeMenu();
    if (disposed || suppressed || switching) return false;
    switching = true;
    try {
      const saved = await persistMode(nextChromeMode(getMode()));
      if (disposed) return false;
      setMode(saved.mode);
      setError(null);
      return true;
    } catch (reason) {
      if (!disposed) setError(reason);
      return false;
    } finally {
      switching = false;
    }
  };
  return {
    click({ suppressed = false } = {}) {
      if (disposed || suppressed || switching) return false;
      openMenu();
      return true;
    },
    switchMode,
    dispose() {
      disposed = true;
    }
  };
}

// packages/client/src/play/chat.js
var import_react9 = require("react");

// packages/client/src/play/chat-model.js
function normalizedPath(value) {
  return typeof value === "string" ? value.replaceAll("\\", "/").replace(/\/+$/, "").toLocaleLowerCase() : "";
}
function rootSessionId(playthrough) {
  const value = playthrough?.ext?.pmpDshTavern?.rootSessionId;
  return typeof value === "string" && value !== "" ? value : null;
}
function adoptedVariant(node) {
  return node?.variants?.find((variant) => variant.id === node.adoptedVariantId) ?? null;
}
function recordedEndSeq(timeline, sessionId) {
  let end = -1;
  for (const node of timeline?.nodes ?? []) {
    for (const variant of node.variants ?? []) {
      if (variant.sessionId === sessionId && Number.isSafeInteger(variant.endEventId)) {
        end = Math.max(end, variant.endEventId);
      }
    }
  }
  return end;
}
function contentText(content) {
  if (!Array.isArray(content)) return "";
  return content.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("");
}
function contentReasoning(content) {
  if (!Array.isArray(content)) return "";
  return content.filter((part) => part?.type === "reasoning" && typeof part.text === "string").map((part) => part.text).join("");
}
function assistantText(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks.filter((block) => block?.kind === "text" && typeof block.text === "string").map((block) => block.text).join("");
}
function assistantReasoning(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks.filter((block) => block?.kind === "reasoning" && typeof block.text === "string").map((block) => block.text).join("");
}
function renderedMessageText(message) {
  if (Array.isArray(message?.content) && message.content.length > 0) return contentText(message.content);
  return typeof message?.text === "string" ? message.text : "";
}
function sessionIsInRpWorkspace(workspace, session) {
  if (workspace?.selected !== true || session == null) return false;
  const root = normalizedPath(workspace.rootPath);
  return root !== "" && normalizedPath(session.cwd) === root;
}
function sessionHasConversationHistory(response) {
  return (response?.messages ?? []).some((message) => message?.role === "user" || message?.role === "assistant");
}
function findPlaythroughForSession(sessionId, catalog2, timelines = {}) {
  if (typeof sessionId !== "string" || sessionId === "") return null;
  for (const playthrough of catalog2?.playthroughs ?? []) {
    const timeline = timelines[playthrough.path];
    if (rootSessionId(playthrough) === sessionId) return { playthrough, timeline: timeline ?? null };
    if (timeline?.nodes?.some((node) => node.variants?.some((variant) => variant.sessionId === sessionId))) {
      return { playthrough, timeline };
    }
  }
  return null;
}
async function loadTimelines(client, playthroughs, concurrency = 4) {
  const result = {};
  let cursor = 0;
  const worker = async () => {
    while (cursor < playthroughs.length) {
      const playthrough = playthroughs[cursor];
      cursor += 1;
      result[playthrough.path] = await client.getTimeline(playthrough);
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(Math.max(1, concurrency), playthroughs.length) },
    worker
  ));
  return result;
}
async function loadCurrentPlaythrough(client, session, options = {}) {
  if (client == null) throw new TypeError("playClient.required");
  const workspace = await client.getWorkspace();
  if (!sessionIsInRpWorkspace(workspace, session)) return null;
  const catalog2 = await client.getCatalog();
  const playthroughs = catalog2.playthroughs ?? [];
  const sessionId = session.id ?? session.sessionId;
  const root = playthroughs.find((item) => rootSessionId(item) === sessionId);
  if (root !== void 0) {
    return { workspace, playthrough: root, timeline: await client.getTimeline(root) };
  }
  const timelines = await loadTimelines(client, playthroughs, options.concurrency);
  const match = findPlaythroughForSession(sessionId, catalog2, timelines);
  return match === null ? null : { workspace, ...match };
}
function projectTimelineQa(timeline, messagesBySession = {}) {
  const result = [];
  for (const node of timeline?.nodes ?? []) {
    if (node.kind !== "qa") continue;
    const variant = adoptedVariant(node);
    if (variant === null) continue;
    const messages = messagesBySession[variant.sessionId]?.messages ?? messagesBySession[variant.sessionId] ?? [];
    const within = messages.filter((message) => Number.isSafeInteger(message.seq) && message.seq >= variant.startEventId && message.seq <= variant.endEventId);
    const user = within.find((message) => message.role === "user") ?? null;
    const assistant = [...within].reverse().find((message) => message.role === "assistant") ?? null;
    result.push({
      id: node.id,
      hidden: node.hidden === true,
      userText: renderedMessageText(user),
      reasoningText: contentReasoning(assistant?.content),
      assistantText: node.displayOverride ?? renderedMessageText(assistant),
      originalAssistantText: renderedMessageText(assistant),
      displayOverridden: node.displayOverride !== null,
      variant,
      variants: node.variants,
      variantCount: node.variants.length
    });
  }
  return result;
}
function projectLiveTurns({
  timeline,
  sessionId,
  nodes,
  partial,
  running = false
} = {}) {
  if (typeof sessionId !== "string" || sessionId === "") return [];
  const boundary = recordedEndSeq(timeline, sessionId);
  const pending = [];
  let turn = null;
  for (const node of nodes ?? []) {
    if (!Number.isFinite(node?.seq) || node.seq <= boundary) continue;
    if (node.kind === "user") {
      if (turn !== null) pending.push(turn);
      turn = {
        id: `live-${node.seq}`,
        transient: true,
        userText: contentText(node.content),
        reasoningText: "",
        assistantText: "",
        running: false
      };
    } else if (node.kind === "assistant" && turn !== null) {
      turn.reasoningText = assistantReasoning(node.blocks);
      turn.assistantText = assistantText(node.blocks);
    }
  }
  if (turn !== null) pending.push(turn);
  if (pending.length === 0) return pending;
  const tail = pending[pending.length - 1];
  if (running) {
    const reasoning = assistantReasoning(partial?.blocks);
    const streamed = assistantText(partial?.blocks);
    if (reasoning !== "") tail.reasoningText = reasoning;
    if (streamed !== "") tail.assistantText = streamed;
    tail.running = true;
  }
  return pending;
}
function latestUserNodeSeq(nodes) {
  let latest = -1;
  for (const node of nodes ?? []) {
    if (node?.kind === "user" && Number.isFinite(node.seq)) latest = Math.max(latest, node.seq);
  }
  return latest;
}
function projectGreeting({
  openingCharacterId,
  selectionResponse,
  characterResponse
} = {}) {
  const selection = selectionResponse?.selection;
  const character = characterResponse?.character;
  if (typeof selection?.characterCardId !== "string" || selection.characterCardId === "" || selection.characterCardId !== openingCharacterId || character?.id !== selection.characterCardId) return null;
  const options = characterGreetingOptions(character);
  if (options.length === 0) return null;
  const requested = Number(selection.character?.greetingIndex ?? 0);
  const selected = options.find((option) => option.index === requested) ?? options[0];
  if (selected.text === "") return null;
  return {
    characterId: character.id,
    characterName: character.data?.nickname || character.data?.name || character.name || character.id,
    index: selected.index,
    text: selected.text,
    options
  };
}
function applyDisplayNameMacros(text2, {
  user = "User",
  character = "Assistant"
} = {}) {
  const names = {
    user: typeof user === "string" && user !== "" ? user : "User",
    char: typeof character === "string" && character !== "" ? character : "Assistant"
  };
  return String(text2 ?? "").replace(/\{\{\s*(user|char)\s*\}\}/gi, (_match, name2) => names[name2.toLowerCase()]);
}
function adjacentGreetingIndex(greeting, direction) {
  const options = greeting?.options ?? [];
  if (options.length === 0) return null;
  const cursor = Math.max(0, options.findIndex((option) => option.index === greeting.index));
  const offset = direction === "previous" ? -1 : 1;
  return options[(cursor + offset + options.length) % options.length].index;
}

// packages/client/src/play/regex.js
var REGEX_PATH = "ui/regex.json";
function isRecord3(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function stringValue(...values) {
  return values.find((value) => typeof value === "string") ?? "";
}
function importedEnabled(value) {
  if (typeof value.enabled === "boolean") return value.enabled;
  if (typeof value.disabled === "boolean") return !value.disabled;
  return true;
}
function finiteDepth(value) {
  if (value === null || value === void 0 || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function nativePlacement(value) {
  const placement = Array.isArray(value.placement) ? [...value.placement] : typeof value.placement === "number" ? [value.placement] : [];
  let markdownOnly = value.markdownOnly === true || value.markdown_only === true;
  let promptOnly = value.promptOnly === true || value.prompt_only === true;
  if (placement.includes(0)) {
    placement.splice(0, placement.length, ...placement.length === 1 ? [1, 2, 3, 5, 6] : placement.filter((item) => item !== 0));
    markdownOnly = true;
    promptOnly = true;
  }
  if (placement.includes(4)) {
    placement.splice(0, placement.length, ...placement.length === 1 ? [3] : placement.filter((item) => item !== 4));
  }
  return { placement, markdownOnly, promptOnly };
}
function normalizeScope(value, fallback = { kind: "global", resourceId: null }) {
  const source = isRecord3(value) ? value : fallback;
  const kind = ["global", "preset", "character"].includes(source.kind) ? source.kind : fallback.kind;
  const resourceId = kind === "global" ? null : stringValue(source.resourceId, fallback.resourceId);
  return { kind, resourceId: resourceId || null };
}
function normalizeTarget(value) {
  return ["user", "assistant", "both"].includes(value) ? value : "assistant";
}
function importedTarget(value) {
  if (typeof value.target === "string") return normalizeTarget(value.target);
  if (typeof value.placement === "string") return normalizeTarget(value.placement);
  const { placement } = nativePlacement(value);
  if (placement.length === 0) return "assistant";
  const user = placement.some((item) => item === 1 || item === "user" || item === "user_input");
  const assistant = placement.some((item) => item === 2 || item === "assistant" || item === "ai_output");
  if (user && assistant) return "both";
  if (user) return "user";
  return "assistant";
}
function displayImportCandidate(value) {
  if (!isRecord3(value)) return false;
  const native = nativePlacement(value);
  if (native.promptOnly && !native.markdownOnly) return false;
  if (native.placement.length === 0) return true;
  return native.placement.some((item) => item === 1 || item === 2 || item === "user" || item === "assistant" || item === "user_input" || item === "ai_output");
}
function regexCandidates(value) {
  if (Array.isArray(value)) return value;
  if (isRecord3(value) && [value.find, value.findRegex, value.find_regex, value.regex].some((item) => typeof item === "string")) {
    return [value];
  }
  const candidates = [
    value?.rules,
    value?.regex_scripts,
    value?.extensions?.regex_scripts,
    value?.data?.extensions?.regex_scripts,
    value?.source?.raw?.regex_scripts,
    value?.source?.raw?.extensions?.regex_scripts,
    value?.source?.raw?.data?.extensions?.regex_scripts
  ];
  return candidates.find(Array.isArray) ?? null;
}
function generatedId() {
  return `regex-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}
function normalizeRegexRule(value, { scope } = {}) {
  if (!isRecord3(value)) throw new TypeError("regex rule must be an object");
  const source = stringValue(value.find, value.findRegex, value.find_regex, value.regex);
  const native = nativePlacement(value);
  return {
    id: stringValue(value.id) || generatedId(),
    name: stringValue(value.name, value.script_name, value.scriptName) || "Regex",
    enabled: importedEnabled(value),
    find: source,
    replace: stringValue(value.replace, value.replaceString, value.replace_string, value.replacement),
    flags: stringValue(value.flags),
    target: importedTarget(value),
    scope: normalizeScope(value.scope, scope),
    placement: native.placement,
    trimStrings: stringList(value.trimStrings ?? value.trim_strings),
    markdownOnly: native.markdownOnly || value.markdown_only === true,
    promptOnly: native.promptOnly || value.prompt_only === true,
    runOnEdit: value.runOnEdit === true || value.run_on_edit === true,
    substituteRegex: [0, 1, 2].includes(Number(value.substituteRegex ?? value.substitute_regex)) ? Number(value.substituteRegex ?? value.substitute_regex) : 0,
    minDepth: finiteDepth(value.minDepth ?? value.min_depth),
    maxDepth: finiteDepth(value.maxDepth ?? value.max_depth),
    ext: isRecord3(value.ext) ? structuredClone(value.ext) : {}
  };
}
function normalizeRegexDocument(value) {
  if (!isRecord3(value)) throw new TypeError("regex document must be an object");
  const rules = Array.isArray(value.rules) ? value.rules : [];
  return { schemaVersion: 1, rules: rules.map((rule) => normalizeRegexRule(rule)) };
}
function importRegexDocument(value, { scope = { kind: "global", resourceId: null } } = {}) {
  const candidates = regexCandidates(value);
  if (candidates === null) throw new TypeError("No regex rules were found");
  return candidates.filter(displayImportCandidate).map((rule) => normalizeRegexRule(rule, { scope }));
}
function resourceRegexInventory(value, scope) {
  const candidates = regexCandidates(value);
  if (candidates === null) return [];
  return candidates.map((rule, sourceIndex) => ({
    ...normalizeRegexRule(rule, { scope }),
    sourceDisplayEligible: displayImportCandidate(rule),
    sourceIndex,
    sourceRaw: structuredClone(rule)
  }));
}
function writeNativeField(target, aliases, canonical, value) {
  const existing = aliases.filter((key) => Object.hasOwn(target, key));
  for (const key of existing.length === 0 ? [canonical] : existing) target[key] = structuredClone(value);
}
function nativePlacementFor(rule) {
  const placement = Array.isArray(rule.placement) ? rule.placement : [];
  const retained = placement.filter((item) => ![1, 2, "user", "assistant", "user_input", "ai_output"].includes(item));
  if (rule.target === "user" || rule.target === "both") retained.push(1);
  if (rule.target === "assistant" || rule.target === "both") retained.push(2);
  return retained;
}
function findWithFlags(source, flags) {
  if (!source.startsWith("/") || flags === "") return source;
  const closing = source.lastIndexOf("/");
  if (closing <= 0 || !/^[dgimsuvy]*$/.test(flags)) return source;
  return `${source.slice(0, closing + 1)}${flags}`;
}
function nativeRegexScript(rule) {
  const source = isRecord3(rule?.sourceRaw) ? structuredClone(rule.sourceRaw) : {};
  const original = isRecord3(rule?.sourceRaw) ? normalizeRegexRule(rule.sourceRaw, { scope: rule.scope }) : null;
  if (original === null) source.id = rule.id;
  if (original === null || rule.name !== original.name) {
    writeNativeField(source, ["scriptName", "script_name", "name"], "scriptName", rule.name);
  }
  if (original === null || rule.find !== original.find || rule.flags !== original.flags) {
    writeNativeField(source, ["findRegex", "find_regex", "find", "regex"], "findRegex", findWithFlags(rule.find, rule.flags));
  }
  if (original === null || rule.replace !== original.replace) {
    writeNativeField(source, ["replaceString", "replace_string", "replace", "replacement"], "replaceString", rule.replace);
  }
  if (original === null || rule.enabled !== original.enabled) {
    writeNativeField(source, ["disabled"], "disabled", !rule.enabled);
    if (Object.hasOwn(source, "enabled")) source.enabled = rule.enabled;
  }
  if (original === null || rule.target !== original.target) {
    writeNativeField(source, ["placement"], "placement", nativePlacementFor(rule));
  }
  if (original === null) {
    source.trimStrings = structuredClone(rule.trimStrings);
    source.markdownOnly = rule.markdownOnly;
    source.promptOnly = rule.promptOnly;
    source.runOnEdit = rule.runOnEdit;
    source.substituteRegex = rule.substituteRegex;
    source.minDepth = rule.minDepth;
    source.maxDepth = rule.maxDepth;
  }
  return source;
}
function exportNativeRegexScripts(rules) {
  if (!Array.isArray(rules)) throw new TypeError("regex rules must be an array");
  return rules.map(nativeRegexScript);
}
function resourceRegexRules(value, scope) {
  try {
    return importRegexDocument(value, { scope });
  } catch (error) {
    if (error instanceof TypeError && error.message === "No regex rules were found") return [];
    throw error;
  }
}
async function getRegexDocument(client) {
  try {
    const file = await client.getFile(REGEX_PATH);
    return normalizeRegexDocument(JSON.parse(file.content));
  } catch (error) {
    if (error?.status === 404 || error?.code === "PLAY_FILE_NOT_FOUND") {
      return { schemaVersion: 1, rules: [] };
    }
    throw error;
  }
}
async function putRegexDocument(client, document2) {
  const normalized = normalizeRegexDocument(document2);
  await client.createDirs("ui");
  await client.putFile(REGEX_PATH, JSON.stringify(normalized, null, 2));
  return normalized;
}
function expression(rule, context) {
  const source = rule.substituteRegex !== 0 && typeof context?.substituteRegex === "function" ? context.substituteRegex(rule.find, { escaped: rule.substituteRegex === 2 }) : rule.find;
  if (source.startsWith("/")) {
    const closing = source.lastIndexOf("/");
    if (closing > 0) {
      const pattern = source.slice(1, closing);
      const flags = rule.flags || source.slice(closing + 1);
      return new RegExp(pattern, flags);
    }
  }
  return new RegExp(source, rule.flags || "g");
}
function applies(rule, bindings, target, context) {
  if (!rule.enabled || rule.target !== "both" && rule.target !== target) return false;
  if (typeof context?.depth === "number") {
    if (rule.minDepth !== null && rule.minDepth >= -1 && context.depth < rule.minDepth) return false;
    if (rule.maxDepth !== null && rule.maxDepth >= 0 && context.depth > rule.maxDepth) return false;
  }
  if (rule.scope.kind === "global") return true;
  if (rule.scope.kind === "preset") return rule.scope.resourceId === bindings?.presetId;
  return rule.scope.resourceId === bindings?.characterId;
}
function replacement(rule, context) {
  return function replaceMatch(match, ...args) {
    const groups = isRecord3(args.at(-1)) ? args.at(-1) : null;
    let value = rule.replace.replace(/\{\{match\}\}/gi, "$0");
    value = value.replaceAll(/\$(\d+)|\$<([^>]+)>/g, (_token, number, groupName) => {
      const captureIndex = Number(number);
      const captured = groupName === void 0 ? captureIndex === 0 ? match : args[captureIndex - 1] : groups?.[groupName];
      if (!captured) return "";
      return rule.trimStrings.reduce(
        (result, trim) => result.replaceAll(trim, ""),
        String(captured)
      );
    });
    return typeof context?.substituteReplacement === "function" ? context.substituteReplacement(value) : value;
  };
}
function applyDisplayRegex(text2, rules, bindings, target = "assistant", context = {}) {
  let output = String(text2 ?? "");
  const diagnostics = [];
  for (const rule of rules ?? []) {
    if (!applies(rule, bindings, target, context)) continue;
    try {
      output = output.replace(expression(rule, context), replacement(rule, context));
    } catch (error) {
      diagnostics.push({ ruleId: rule.id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { text: output, diagnostics };
}

// node_modules/dompurify/dist/purify.es.mjs
function _arrayLikeToArray(r, a) {
  (null == a || a > r.length) && (a = r.length);
  for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
  return n;
}
function _arrayWithHoles(r) {
  if (Array.isArray(r)) return r;
}
function _iterableToArrayLimit(r, l) {
  var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (null != t) {
    var e, n, i, u, a = [], f = true, o = false;
    try {
      if (i = (t = t.call(r)).next, 0 === l) ;
      else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = true) ;
    } catch (r2) {
      o = true, n = r2;
    } finally {
      try {
        if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
      } finally {
        if (o) throw n;
      }
    }
    return a;
  }
}
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _slicedToArray(r, e) {
  return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
}
function _unsupportedIterableToArray(r, a) {
  if (r) {
    if ("string" == typeof r) return _arrayLikeToArray(r, a);
    var t = {}.toString.call(r).slice(8, -1);
    return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
  }
}
var entries = Object.entries;
var setPrototypeOf = Object.setPrototypeOf;
var isFrozen = Object.isFrozen;
var getPrototypeOf = Object.getPrototypeOf;
var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
var freeze = Object.freeze;
var seal = Object.seal;
var create = Object.create;
var _ref = typeof Reflect !== "undefined" && Reflect;
var apply = _ref.apply;
var construct = _ref.construct;
if (!freeze) {
  freeze = function freeze2(x) {
    return x;
  };
}
if (!seal) {
  seal = function seal2(x) {
    return x;
  };
}
if (!apply) {
  apply = function apply3(func, thisArg) {
    for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      args[_key - 2] = arguments[_key];
    }
    return func.apply(thisArg, args);
  };
}
if (!construct) {
  construct = function construct2(Func) {
    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }
    return new Func(...args);
  };
}
var arrayForEach = unapply(Array.prototype.forEach);
var arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
var arrayPop = unapply(Array.prototype.pop);
var arrayPush = unapply(Array.prototype.push);
var arraySplice = unapply(Array.prototype.splice);
var arrayIsArray = Array.isArray;
var stringToLowerCase = unapply(String.prototype.toLowerCase);
var stringToString = unapply(String.prototype.toString);
var stringMatch = unapply(String.prototype.match);
var stringReplace = unapply(String.prototype.replace);
var stringIndexOf = unapply(String.prototype.indexOf);
var stringTrim = unapply(String.prototype.trim);
var numberToString = unapply(Number.prototype.toString);
var booleanToString = unapply(Boolean.prototype.toString);
var bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
var symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
var objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
var objectToString = unapply(Object.prototype.toString);
var regExpTest = unapply(RegExp.prototype.test);
var typeErrorCreate = unconstruct(TypeError);
function unapply(func) {
  return function(thisArg) {
    if (thisArg instanceof RegExp) {
      thisArg.lastIndex = 0;
    }
    for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
      args[_key3 - 1] = arguments[_key3];
    }
    return apply(func, thisArg, args);
  };
}
function unconstruct(Func) {
  return function() {
    for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      args[_key4] = arguments[_key4];
    }
    return construct(Func, args);
  };
}
function addToSet(set, array) {
  let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
  if (setPrototypeOf) {
    setPrototypeOf(set, null);
  }
  if (!arrayIsArray(array)) {
    return set;
  }
  let l = array.length;
  while (l--) {
    let element = array[l];
    if (typeof element === "string") {
      const lcElement = transformCaseFunc(element);
      if (lcElement !== element) {
        if (!isFrozen(array)) {
          array[l] = lcElement;
        }
        element = lcElement;
      }
    }
    set[element] = true;
  }
  return set;
}
function cleanArray(array) {
  for (let index = 0; index < array.length; index++) {
    const isPropertyExist = objectHasOwnProperty(array, index);
    if (!isPropertyExist) {
      array[index] = null;
    }
  }
  return array;
}
function clone(object) {
  const newObject = create(null);
  for (const _ref2 of entries(object)) {
    var _ref3 = _slicedToArray(_ref2, 2);
    const property = _ref3[0];
    const value = _ref3[1];
    const isPropertyExist = objectHasOwnProperty(object, property);
    if (isPropertyExist) {
      if (arrayIsArray(value)) {
        newObject[property] = cleanArray(value);
      } else if (value && typeof value === "object" && value.constructor === Object) {
        newObject[property] = clone(value);
      } else {
        newObject[property] = value;
      }
    }
  }
  return newObject;
}
function stringifyValue(value) {
  switch (typeof value) {
    case "string": {
      return value;
    }
    case "number": {
      return numberToString(value);
    }
    case "boolean": {
      return booleanToString(value);
    }
    case "bigint": {
      return bigintToString ? bigintToString(value) : "0";
    }
    case "symbol": {
      return symbolToString ? symbolToString(value) : "Symbol()";
    }
    case "undefined": {
      return objectToString(value);
    }
    case "function":
    case "object": {
      if (value === null) {
        return objectToString(value);
      }
      const valueAsRecord = value;
      const valueToString = lookupGetter(valueAsRecord, "toString");
      if (typeof valueToString === "function") {
        const stringified = valueToString(valueAsRecord);
        return typeof stringified === "string" ? stringified : objectToString(stringified);
      }
      return objectToString(value);
    }
    default: {
      return objectToString(value);
    }
  }
}
function lookupGetter(object, prop) {
  while (object !== null) {
    const desc = getOwnPropertyDescriptor(object, prop);
    if (desc) {
      if (desc.get) {
        return unapply(desc.get);
      }
      if (typeof desc.value === "function") {
        return unapply(desc.value);
      }
    }
    object = getPrototypeOf(object);
  }
  function fallbackValue() {
    return null;
  }
  return fallbackValue;
}
function isRegex(value) {
  try {
    regExpTest(value, "");
    return true;
  } catch (_unused) {
    return false;
  }
}
var html$1 = freeze(["a", "abbr", "acronym", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "content", "data", "datalist", "dd", "decorator", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "element", "em", "fieldset", "figcaption", "figure", "font", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "map", "mark", "marquee", "menu", "menuitem", "meter", "nav", "nobr", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "search", "section", "select", "shadow", "slot", "small", "source", "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "tr", "track", "tt", "u", "ul", "var", "video", "wbr"]);
var svg$1 = freeze(["svg", "a", "altglyph", "altglyphdef", "altglyphitem", "animatecolor", "animatemotion", "animatetransform", "circle", "clippath", "defs", "desc", "ellipse", "enterkeyhint", "exportparts", "filter", "font", "g", "glyph", "glyphref", "hkern", "image", "inputmode", "line", "lineargradient", "marker", "mask", "metadata", "mpath", "part", "path", "pattern", "polygon", "polyline", "radialgradient", "rect", "stop", "style", "switch", "symbol", "text", "textpath", "title", "tref", "tspan", "view", "vkern"]);
var svgFilters = freeze(["feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence"]);
var svgDisallowed = freeze(["animate", "color-profile", "cursor", "discard", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "foreignobject", "hatch", "hatchpath", "mesh", "meshgradient", "meshpatch", "meshrow", "missing-glyph", "script", "set", "solidcolor", "unknown", "use"]);
var mathMl$1 = freeze(["math", "menclose", "merror", "mfenced", "mfrac", "mglyph", "mi", "mlabeledtr", "mmultiscripts", "mn", "mo", "mover", "mpadded", "mphantom", "mroot", "mrow", "ms", "mspace", "msqrt", "mstyle", "msub", "msup", "msubsup", "mtable", "mtd", "mtext", "mtr", "munder", "munderover", "mprescripts"]);
var mathMlDisallowed = freeze(["maction", "maligngroup", "malignmark", "mlongdiv", "mscarries", "mscarry", "msgroup", "mstack", "msline", "msrow", "semantics", "annotation", "annotation-xml", "mprescripts", "none"]);
var text = freeze(["#text"]);
var html = freeze(["accept", "action", "align", "alt", "autocapitalize", "autocomplete", "autopictureinpicture", "autoplay", "background", "bgcolor", "border", "capture", "cellpadding", "cellspacing", "checked", "cite", "class", "clear", "color", "cols", "colspan", "command", "commandfor", "controls", "controlslist", "coords", "crossorigin", "datetime", "decoding", "default", "dir", "disabled", "disablepictureinpicture", "disableremoteplayback", "download", "draggable", "enctype", "enterkeyhint", "exportparts", "face", "for", "headers", "height", "hidden", "high", "href", "hreflang", "id", "inert", "inputmode", "integrity", "ismap", "kind", "label", "lang", "list", "loading", "loop", "low", "max", "maxlength", "media", "method", "min", "minlength", "multiple", "muted", "name", "nonce", "noshade", "novalidate", "nowrap", "open", "optimum", "part", "pattern", "placeholder", "playsinline", "popover", "popovertarget", "popovertargetaction", "poster", "preload", "pubdate", "radiogroup", "readonly", "rel", "required", "rev", "reversed", "role", "rows", "rowspan", "spellcheck", "scope", "selected", "shape", "size", "sizes", "slot", "span", "srclang", "start", "src", "srcset", "step", "style", "summary", "tabindex", "title", "translate", "type", "usemap", "valign", "value", "width", "wrap", "xmlns"]);
var svg = freeze(["accent-height", "accumulate", "additive", "alignment-baseline", "amplitude", "ascent", "attributename", "attributetype", "azimuth", "basefrequency", "baseline-shift", "begin", "bias", "by", "class", "clip", "clippathunits", "clip-path", "clip-rule", "color", "color-interpolation", "color-interpolation-filters", "color-profile", "color-rendering", "cx", "cy", "d", "dx", "dy", "diffuseconstant", "direction", "display", "divisor", "dominant-baseline", "dur", "edgemode", "elevation", "end", "exponent", "fill", "fill-opacity", "fill-rule", "filter", "filterunits", "flood-color", "flood-opacity", "font-family", "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant", "font-weight", "fx", "fy", "g1", "g2", "glyph-name", "glyphref", "gradientunits", "gradienttransform", "height", "href", "id", "image-rendering", "in", "in2", "intercept", "k", "k1", "k2", "k3", "k4", "kerning", "keypoints", "keysplines", "keytimes", "lang", "lengthadjust", "letter-spacing", "kernelmatrix", "kernelunitlength", "lighting-color", "local", "marker-end", "marker-mid", "marker-start", "markerheight", "markerunits", "markerwidth", "maskcontentunits", "maskunits", "max", "mask", "mask-type", "media", "method", "mode", "min", "name", "numoctaves", "offset", "operator", "opacity", "order", "orient", "orientation", "origin", "overflow", "paint-order", "path", "pathlength", "patterncontentunits", "patterntransform", "patternunits", "pointer-events", "points", "preservealpha", "preserveaspectratio", "primitiveunits", "r", "rx", "ry", "radius", "refx", "refy", "repeatcount", "repeatdur", "restart", "result", "rotate", "scale", "seed", "shape-rendering", "slope", "specularconstant", "specularexponent", "spreadmethod", "startoffset", "stddeviation", "stitchtiles", "stop-color", "stop-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke", "stroke-width", "style", "surfacescale", "systemlanguage", "tabindex", "tablevalues", "targetx", "targety", "transform", "transform-origin", "text-anchor", "text-decoration", "text-orientation", "text-rendering", "textlength", "type", "u1", "u2", "unicode", "values", "vector-effect", "viewbox", "visibility", "version", "vert-adv-y", "vert-origin-x", "vert-origin-y", "width", "word-spacing", "wrap", "writing-mode", "xchannelselector", "ychannelselector", "x", "x1", "x2", "xmlns", "y", "y1", "y2", "z", "zoomandpan"]);
var mathMl = freeze(["accent", "accentunder", "align", "bevelled", "close", "columnalign", "columnlines", "columnspacing", "columnspan", "denomalign", "depth", "dir", "display", "displaystyle", "encoding", "fence", "frame", "height", "href", "id", "largeop", "length", "linethickness", "lquote", "lspace", "mathbackground", "mathcolor", "mathsize", "mathvariant", "maxsize", "minsize", "movablelimits", "notation", "numalign", "open", "rowalign", "rowlines", "rowspacing", "rowspan", "rspace", "rquote", "scriptlevel", "scriptminsize", "scriptsizemultiplier", "selection", "separator", "separators", "stretchy", "subscriptshift", "supscriptshift", "symmetric", "voffset", "width", "xmlns"]);
var xml = freeze(["xlink:href", "xml:id", "xlink:title", "xml:space", "xmlns:xlink"]);
var MUSTACHE_EXPR = seal(/{{[\w\W]*|^[\w\W]*}}/g);
var ERB_EXPR = seal(/<%[\w\W]*|^[\w\W]*%>/g);
var TMPLIT_EXPR = seal(/\${[\w\W]*/g);
var DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
var ARIA_ATTR = seal(/^aria-[\-\w]+$/);
var IS_ALLOWED_URI = seal(
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  // eslint-disable-line no-useless-escape
);
var IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
var ATTR_WHITESPACE = seal(
  /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g
  // eslint-disable-line no-control-regex
);
var DOCTYPE_NAME = seal(/^html$/i);
var CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
var ELEMENT_MARKUP_PROBE = seal(/<[/\w!]/g);
var COMMENT_MARKUP_PROBE = seal(/<[/\w]/g);
var FALLBACK_TAG_CLOSE = seal(/<\/no(script|embed|frames)/i);
var SELF_CLOSING_TAG = seal(/\/>/i);
var NODE_TYPE = {
  element: 1,
  attribute: 2,
  text: 3,
  cdataSection: 4,
  entityReference: 5,
  // Deprecated
  entityNode: 6,
  // Deprecated
  processingInstruction: 7,
  comment: 8,
  document: 9,
  documentType: 10,
  documentFragment: 11,
  notation: 12
  // Deprecated
};
var LITERAL_TEXT_ELEMENT_NAMES = ["style", "script", "xmp", "iframe", "noembed", "noframes", "plaintext", "noscript"];
var LITERAL_TEXT_ELEMENTS = freeze(addToSet({}, LITERAL_TEXT_ELEMENT_NAMES));
var LITERAL_TEXT_CLOSE = (function() {
  const map = {};
  arrayForEach(LITERAL_TEXT_ELEMENT_NAMES, (name2) => {
    map[name2] = seal(new RegExp("</" + name2 + "(?=[\\t\\n\\f\\r />])", "i"));
  });
  return freeze(map);
})();
var getGlobal = function getGlobal2() {
  return typeof window === "undefined" ? null : window;
};
var _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, purifyHostElement) {
  if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") {
    return null;
  }
  let suffix = null;
  const ATTR_NAME = "data-tt-policy-suffix";
  if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) {
    suffix = purifyHostElement.getAttribute(ATTR_NAME);
  }
  const policyName = "dompurify" + (suffix ? "#" + suffix : "");
  try {
    return trustedTypes.createPolicy(policyName, {
      createHTML(html2) {
        return html2;
      },
      createScriptURL(scriptUrl) {
        return scriptUrl;
      }
    });
  } catch (_) {
    console.warn("TrustedTypes policy " + policyName + " could not be created.");
    return null;
  }
};
var _createHooksMap = function _createHooksMap2() {
  return {
    afterSanitizeAttributes: [],
    afterSanitizeElements: [],
    afterSanitizeShadowDOM: [],
    beforeSanitizeAttributes: [],
    beforeSanitizeElements: [],
    beforeSanitizeShadowDOM: [],
    uponSanitizeAttribute: [],
    uponSanitizeElement: [],
    uponSanitizeShadowNode: []
  };
};
var _resolveSetOption = function _resolveSetOption2(cfg, key, fallback, options) {
  return objectHasOwnProperty(cfg, key) && arrayIsArray(cfg[key]) ? addToSet(options.base ? clone(options.base) : {}, cfg[key], options.transform) : fallback;
};
var _resolveObjectOption = function _resolveObjectOption2(cfg, key, makeFallback) {
  const value = objectHasOwnProperty(cfg, key) ? cfg[key] : void 0;
  return value && typeof value === "object" ? clone(value) : makeFallback();
};
function createDOMPurify() {
  let window2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
  const DOMPurify = (root) => createDOMPurify(root);
  DOMPurify.version = "3.4.14";
  DOMPurify.removed = [];
  if (!window2 || !window2.document || window2.document.nodeType !== NODE_TYPE.document || !window2.Element) {
    DOMPurify.isSupported = false;
    return DOMPurify;
  }
  let document2 = window2.document;
  const originalDocument = document2;
  const currentScript = originalDocument.currentScript;
  window2.DocumentFragment;
  const HTMLTemplateElement = window2.HTMLTemplateElement, Node = window2.Node, Element = window2.Element, NodeFilter = window2.NodeFilter, _window$NamedNodeMap = window2.NamedNodeMap;
  _window$NamedNodeMap === void 0 ? window2.NamedNodeMap || window2.MozNamedAttrMap : _window$NamedNodeMap;
  window2.HTMLFormElement;
  const DOMParser = window2.DOMParser, trustedTypes = window2.trustedTypes;
  const ElementPrototype = Element.prototype;
  const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
  const remove = lookupGetter(ElementPrototype, "remove");
  const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
  const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
  const getParentNode = lookupGetter(ElementPrototype, "parentNode");
  const getShadowRoot = lookupGetter(ElementPrototype, "shadowRoot");
  const getAttributes = lookupGetter(ElementPrototype, "attributes");
  const getNodeType = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeType") : null;
  const getNodeName = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeName") : null;
  const getOwnerDocument = Node && Node.prototype ? lookupGetter(Node.prototype, "ownerDocument") : null;
  const _readNodeType = function _readNodeType2(node) {
    return getNodeType ? getNodeType(node) : node.nodeType;
  };
  const _readNodeName = function _readNodeName2(node) {
    return getNodeName ? getNodeName(node) : node.nodeName;
  };
  if (typeof HTMLTemplateElement === "function") {
    const template = document2.createElement("template");
    if (template.content && template.content.ownerDocument) {
      document2 = template.content.ownerDocument;
    }
  }
  let trustedTypesPolicy;
  let emptyHTML = "";
  let defaultTrustedTypesPolicy;
  let defaultTrustedTypesPolicyResolved = false;
  let IN_TRUSTED_TYPES_POLICY = 0;
  const _assertNotInTrustedTypesPolicy = function _assertNotInTrustedTypesPolicy2() {
    if (IN_TRUSTED_TYPES_POLICY > 0) {
      throw typeErrorCreate('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.');
    }
  };
  const _createTrustedHTML = function _createTrustedHTML2(html2) {
    _assertNotInTrustedTypesPolicy();
    IN_TRUSTED_TYPES_POLICY++;
    try {
      return trustedTypesPolicy.createHTML(html2);
    } finally {
      IN_TRUSTED_TYPES_POLICY--;
    }
  };
  const _createTrustedScriptURL = function _createTrustedScriptURL2(scriptUrl) {
    _assertNotInTrustedTypesPolicy();
    IN_TRUSTED_TYPES_POLICY++;
    try {
      return trustedTypesPolicy.createScriptURL(scriptUrl);
    } finally {
      IN_TRUSTED_TYPES_POLICY--;
    }
  };
  const _getDefaultTrustedTypesPolicy = function _getDefaultTrustedTypesPolicy2() {
    if (!defaultTrustedTypesPolicyResolved) {
      defaultTrustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
      defaultTrustedTypesPolicyResolved = true;
    }
    return defaultTrustedTypesPolicy;
  };
  const _document = document2, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
  const importNode = originalDocument.importNode;
  let hooks = _createHooksMap();
  DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
  const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
  let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
  let ALLOWED_TAGS = null;
  const DEFAULT_ALLOWED_TAGS = addToSet({}, [...html$1, ...svg$1, ...svgFilters, ...mathMl$1, ...text]);
  let ALLOWED_ATTR = null;
  const DEFAULT_ALLOWED_ATTR = addToSet({}, [...html, ...svg, ...mathMl, ...xml]);
  let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
    tagNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    allowCustomizedBuiltInElements: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: false
    }
  }));
  let FORBID_TAGS = null;
  let FORBID_ATTR = null;
  const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
    tagCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    }
  }));
  let ALLOW_ARIA_ATTR = true;
  let ALLOW_DATA_ATTR = true;
  let ALLOW_UNKNOWN_PROTOCOLS = false;
  let ALLOW_SELF_CLOSE_IN_ATTR = true;
  let SAFE_FOR_TEMPLATES = false;
  let SAFE_FOR_XML = true;
  let WHOLE_DOCUMENT = false;
  let SET_CONFIG = false;
  let SET_CONFIG_ALLOWED_TAGS = null;
  let SET_CONFIG_ALLOWED_ATTR = null;
  let FORCE_BODY = false;
  let RETURN_DOM = false;
  let RETURN_DOM_FRAGMENT = false;
  let RETURN_TRUSTED_TYPE = false;
  let SANITIZE_DOM = true;
  let SANITIZE_NAMED_PROPS = false;
  const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
  let KEEP_CONTENT = true;
  let IN_PLACE = false;
  let USE_PROFILES = {};
  let FORBID_CONTENTS = null;
  const DEFAULT_FORBID_CONTENTS = addToSet({}, [
    "annotation-xml",
    "audio",
    "colgroup",
    "desc",
    "foreignobject",
    "head",
    "iframe",
    "math",
    "mi",
    "mn",
    "mo",
    "ms",
    "mtext",
    "noembed",
    "noframes",
    "noscript",
    "plaintext",
    "script",
    // <selectedcontent> mirrors the selected <option>'s subtree, cloned by
    // the UA (customizable <select>) — including any on* handlers — and the
    // engine re-mirrors synchronously whenever a removal changes which
    // option/selectedcontent is current, even inside DOMPurify's inert
    // DOMParser document. Hoisting its children on removal re-inserts a fresh
    // mirror target ahead of the walk, which the engine refills, looping
    // forever (DoS) and amplifying output. Dropping its content on removal
    // (rather than hoisting) breaks that cascade; the content is a duplicate
    // of the option, which is sanitized on its own. See campaign-3 F1/F6.
    "selectedcontent",
    "style",
    "svg",
    "template",
    "thead",
    "title",
    "video",
    "xmp"
  ]);
  let DATA_URI_TAGS = null;
  const DEFAULT_DATA_URI_TAGS = addToSet({}, ["audio", "video", "img", "source", "image", "track"]);
  let URI_SAFE_ATTRIBUTES = null;
  const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, ["alt", "class", "for", "id", "label", "name", "pattern", "placeholder", "role", "summary", "title", "value", "style", "xmlns"]);
  const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  let NAMESPACE = HTML_NAMESPACE;
  let IS_EMPTY_INPUT = false;
  let ALLOWED_NAMESPACES = null;
  const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [MATHML_NAMESPACE, SVG_NAMESPACE, HTML_NAMESPACE], stringToString);
  const DEFAULT_MATHML_TEXT_INTEGRATION_POINTS = freeze(["mi", "mo", "mn", "ms", "mtext"]);
  let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
  const DEFAULT_HTML_INTEGRATION_POINTS = freeze(["annotation-xml"]);
  let HTML_INTEGRATION_POINTS = addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
  const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, ["title", "style", "font", "a", "script"]);
  let PARSER_MEDIA_TYPE = null;
  const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
  const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
  let transformCaseFunc = null;
  let CONFIG = null;
  const formElement = document2.createElement("form");
  const isRegexOrFunction = function isRegexOrFunction2(testValue) {
    return testValue instanceof RegExp || testValue instanceof Function;
  };
  const _parseConfig = function _parseConfig2() {
    let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    if (CONFIG && CONFIG === cfg) {
      return;
    }
    if (!cfg || typeof cfg !== "object") {
      cfg = {};
    }
    cfg = clone(cfg);
    PARSER_MEDIA_TYPE = // eslint-disable-next-line unicorn/prefer-includes
    SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
    transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
    ALLOWED_TAGS = _resolveSetOption(cfg, "ALLOWED_TAGS", DEFAULT_ALLOWED_TAGS, {
      transform: transformCaseFunc
    });
    ALLOWED_ATTR = _resolveSetOption(cfg, "ALLOWED_ATTR", DEFAULT_ALLOWED_ATTR, {
      transform: transformCaseFunc
    });
    ALLOWED_NAMESPACES = _resolveSetOption(cfg, "ALLOWED_NAMESPACES", DEFAULT_ALLOWED_NAMESPACES, {
      transform: stringToString
    });
    URI_SAFE_ATTRIBUTES = _resolveSetOption(cfg, "ADD_URI_SAFE_ATTR", DEFAULT_URI_SAFE_ATTRIBUTES, {
      transform: transformCaseFunc,
      base: DEFAULT_URI_SAFE_ATTRIBUTES
    });
    DATA_URI_TAGS = _resolveSetOption(cfg, "ADD_DATA_URI_TAGS", DEFAULT_DATA_URI_TAGS, {
      transform: transformCaseFunc,
      base: DEFAULT_DATA_URI_TAGS
    });
    FORBID_CONTENTS = _resolveSetOption(cfg, "FORBID_CONTENTS", DEFAULT_FORBID_CONTENTS, {
      transform: transformCaseFunc
    });
    FORBID_TAGS = _resolveSetOption(cfg, "FORBID_TAGS", clone({}), {
      transform: transformCaseFunc
    });
    FORBID_ATTR = _resolveSetOption(cfg, "FORBID_ATTR", clone({}), {
      transform: transformCaseFunc
    });
    USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
    ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
    ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
    ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
    ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
    SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
    SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
    WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
    RETURN_DOM = cfg.RETURN_DOM || false;
    RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
    RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
    FORCE_BODY = cfg.FORCE_BODY || false;
    SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
    SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
    KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
    IN_PLACE = cfg.IN_PLACE || false;
    IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
    NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
    MATHML_TEXT_INTEGRATION_POINTS = _resolveObjectOption(
      cfg,
      "MATHML_TEXT_INTEGRATION_POINTS",
      () => addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS)
      // Default built-in map
    );
    HTML_INTEGRATION_POINTS = _resolveObjectOption(
      cfg,
      "HTML_INTEGRATION_POINTS",
      () => addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS)
      // Default built-in map
    );
    const customElementHandling = _resolveObjectOption(cfg, "CUSTOM_ELEMENT_HANDLING", () => create(null));
    CUSTOM_ELEMENT_HANDLING = create(null);
    if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) {
      CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
    }
    if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) {
      CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
    }
    if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") {
      CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
    }
    seal(CUSTOM_ELEMENT_HANDLING);
    if (SAFE_FOR_TEMPLATES) {
      ALLOW_DATA_ATTR = false;
    }
    if (RETURN_DOM_FRAGMENT) {
      RETURN_DOM = true;
    }
    if (USE_PROFILES) {
      ALLOWED_TAGS = addToSet({}, text);
      ALLOWED_ATTR = create(null);
      if (USE_PROFILES.html === true) {
        addToSet(ALLOWED_TAGS, html$1);
        addToSet(ALLOWED_ATTR, html);
      }
      if (USE_PROFILES.svg === true) {
        addToSet(ALLOWED_TAGS, svg$1);
        addToSet(ALLOWED_ATTR, svg);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.svgFilters === true) {
        addToSet(ALLOWED_TAGS, svgFilters);
        addToSet(ALLOWED_ATTR, svg);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.mathMl === true) {
        addToSet(ALLOWED_TAGS, mathMl$1);
        addToSet(ALLOWED_ATTR, mathMl);
        addToSet(ALLOWED_ATTR, xml);
      }
    }
    EXTRA_ELEMENT_HANDLING.tagCheck = null;
    EXTRA_ELEMENT_HANDLING.attributeCheck = null;
    if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
      if (typeof cfg.ADD_TAGS === "function") {
        EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
      } else if (arrayIsArray(cfg.ADD_TAGS)) {
        if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) {
          ALLOWED_TAGS = clone(ALLOWED_TAGS);
        }
        addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
      }
    }
    if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
      if (typeof cfg.ADD_ATTR === "function") {
        EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
      } else if (arrayIsArray(cfg.ADD_ATTR)) {
        if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) {
          ALLOWED_ATTR = clone(ALLOWED_ATTR);
        }
        addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
      }
    }
    if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
      if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
        FORBID_CONTENTS = clone(FORBID_CONTENTS);
      }
      addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
    }
    if (KEEP_CONTENT) {
      ALLOWED_TAGS["#text"] = true;
    }
    if (WHOLE_DOCUMENT) {
      addToSet(ALLOWED_TAGS, ["html", "head", "body"]);
    }
    if (ALLOWED_TAGS.table) {
      addToSet(ALLOWED_TAGS, ["tbody"]);
      delete FORBID_TAGS.tbody;
    }
    if (cfg.TRUSTED_TYPES_POLICY) {
      if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") {
        throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');
      }
      if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") {
        throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');
      }
      const previousTrustedTypesPolicy = trustedTypesPolicy;
      trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
      try {
        emptyHTML = _createTrustedHTML("");
      } catch (error) {
        trustedTypesPolicy = previousTrustedTypesPolicy;
        throw error;
      }
    } else if (cfg.TRUSTED_TYPES_POLICY === null) {
      trustedTypesPolicy = void 0;
      emptyHTML = "";
    } else {
      if (trustedTypesPolicy === void 0) {
        trustedTypesPolicy = _getDefaultTrustedTypesPolicy();
      }
      if (trustedTypesPolicy && typeof emptyHTML === "string") {
        emptyHTML = _createTrustedHTML("");
      }
    }
    if (freeze) {
      freeze(cfg);
    }
    CONFIG = cfg;
  };
  const ALL_SVG_TAGS = addToSet({}, [...svg$1, ...svgFilters, ...svgDisallowed]);
  const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
  const _checkSvgNamespace = function _checkSvgNamespace2(tagName, parent, parentTagName) {
    if (parent.namespaceURI === HTML_NAMESPACE) {
      return tagName === "svg";
    }
    if (parent.namespaceURI === MATHML_NAMESPACE) {
      return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
    }
    return Boolean(ALL_SVG_TAGS[tagName]);
  };
  const _checkMathMlNamespace = function _checkMathMlNamespace2(tagName, parent, parentTagName) {
    if (parent.namespaceURI === HTML_NAMESPACE) {
      return tagName === "math";
    }
    if (parent.namespaceURI === SVG_NAMESPACE) {
      return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
    }
    return Boolean(ALL_MATHML_TAGS[tagName]);
  };
  const _checkHtmlNamespace = function _checkHtmlNamespace2(tagName, parent, parentTagName) {
    if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) {
      return false;
    }
    if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) {
      return false;
    }
    return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
  };
  const _checkValidNamespace = function _checkValidNamespace2(element) {
    let parent = getParentNode(element);
    if (!parent || !parent.tagName) {
      parent = {
        namespaceURI: NAMESPACE,
        tagName: "template"
      };
    }
    const tagName = stringToLowerCase(element.tagName);
    const parentTagName = stringToLowerCase(parent.tagName);
    if (!ALLOWED_NAMESPACES[element.namespaceURI]) {
      return false;
    }
    if (element.namespaceURI === SVG_NAMESPACE) {
      return _checkSvgNamespace(tagName, parent, parentTagName);
    }
    if (element.namespaceURI === MATHML_NAMESPACE) {
      return _checkMathMlNamespace(tagName, parent, parentTagName);
    }
    if (element.namespaceURI === HTML_NAMESPACE) {
      return _checkHtmlNamespace(tagName, parent, parentTagName);
    }
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[element.namespaceURI]) {
      return true;
    }
    return false;
  };
  const _forceRemove = function _forceRemove2(node) {
    arrayPush(DOMPurify.removed, {
      element: node
    });
    try {
      getParentNode(node).removeChild(node);
    } catch (_) {
      remove(node);
      if (!getParentNode(node)) {
        throw typeErrorCreate("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place");
      }
    }
  };
  const _stripAttributeNode = function _stripAttributeNode2(element, attribute, name2) {
    try {
      element.removeAttributeNode(attribute);
    } catch (_) {
      try {
        element.removeAttribute(name2);
      } catch (_2) {
      }
    }
  };
  const _neutralizeRoot = function _neutralizeRoot2(root) {
    _neutralizeSubtree(root);
    const childNodes = getChildNodes(root);
    if (childNodes) {
      const snapshot = [];
      arrayForEach(childNodes, (child) => {
        arrayPush(snapshot, child);
      });
      arrayForEach(snapshot, (child) => {
        try {
          remove(child);
        } catch (_) {
        }
      });
    }
    const attributes = getAttributes(root);
    if (attributes) {
      for (let i = attributes.length - 1; i >= 0; --i) {
        const attribute = attributes[i];
        const name2 = attribute && attribute.name;
        if (typeof name2 === "string") {
          _stripAttributeNode(root, attribute, name2);
        }
      }
    }
  };
  const _removeAttribute = function _removeAttribute2(name2, element, attr) {
    if (!attr) {
      try {
        attr = element.getAttributeNode(name2);
      } catch (_) {
        attr = null;
      }
    }
    arrayPush(DOMPurify.removed, {
      attribute: attr || null,
      from: element
    });
    try {
      if (attr) {
        element.removeAttributeNode(attr);
      } else {
        element.removeAttribute(name2);
      }
    } catch (_) {
      try {
        element.removeAttribute(name2);
      } catch (_2) {
      }
    }
    if (name2 === "is") {
      if (RETURN_DOM || RETURN_DOM_FRAGMENT) {
        try {
          _forceRemove(element);
        } catch (_) {
        }
      } else {
        try {
          element.setAttribute(name2, "");
        } catch (_) {
        }
      }
    }
  };
  const _stripDisallowedAttributes = function _stripDisallowedAttributes2(element) {
    const attributes = getAttributes(element);
    if (!attributes) {
      return;
    }
    for (let i = attributes.length - 1; i >= 0; --i) {
      const attribute = attributes[i];
      const name2 = attribute && attribute.name;
      if (typeof name2 !== "string" || ALLOWED_ATTR[transformCaseFunc(name2)]) {
        continue;
      }
      _stripAttributeNode(element, attribute, name2);
    }
  };
  const _neutralizeSubtree = function _neutralizeSubtree2(root) {
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      const nodeType = _readNodeType(node);
      if (nodeType === NODE_TYPE.element) {
        _stripDisallowedAttributes(node);
      }
      const childNodes = getChildNodes(node);
      if (childNodes) {
        for (let i = childNodes.length - 1; i >= 0; --i) {
          stack.push(childNodes[i]);
        }
      }
    }
  };
  const _isPatchLinkageAttribute = function _isPatchLinkageAttribute2(lcName, lcTag) {
    if (!SAFE_FOR_XML) {
      return false;
    }
    if (lcName === "patchsrc") {
      return true;
    }
    return lcName === "for" && lcTag !== "label" && lcTag !== "output";
  };
  const _neutralizePatchLinkage = function _neutralizePatchLinkage2(root) {
    if (!SAFE_FOR_XML) {
      return;
    }
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      const nodeType = _readNodeType(node);
      if (nodeType === NODE_TYPE.processingInstruction || nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, node.data)) {
        try {
          remove(node);
        } catch (_) {
        }
        continue;
      }
      if (nodeType === NODE_TYPE.element) {
        const element = node;
        const lcTag = transformCaseFunc(_readNodeName(node));
        try {
          if (element.hasAttribute && element.hasAttribute("patchsrc")) {
            element.removeAttribute("patchsrc");
          }
          if (element.hasAttribute && element.hasAttribute("for") && _isPatchLinkageAttribute("for", lcTag)) {
            element.removeAttribute("for");
          }
        } catch (_) {
        }
      }
      const childNodes = getChildNodes(node);
      if (childNodes) {
        for (let i = childNodes.length - 1; i >= 0; --i) {
          stack.push(childNodes[i]);
        }
      }
    }
  };
  const _initDocument = function _initDocument2(dirty) {
    let doc = null;
    let leadingWhitespace = null;
    if (FORCE_BODY) {
      dirty = "<remove></remove>" + dirty;
    } else {
      const matches = stringMatch(dirty, /^[\r\n\t ]+/);
      leadingWhitespace = matches && matches[0];
    }
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) {
      dirty = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + dirty + "</body></html>";
    }
    const dirtyPayload = trustedTypesPolicy ? _createTrustedHTML(dirty) : dirty;
    if (NAMESPACE === HTML_NAMESPACE) {
      try {
        doc = new DOMParser().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
      } catch (_) {
      }
    }
    if (!doc || !doc.documentElement) {
      doc = implementation.createDocument(NAMESPACE, "template", null);
      try {
        doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
      } catch (_) {
      }
    }
    const body2 = doc.body || doc.documentElement;
    if (dirty && leadingWhitespace) {
      body2.insertBefore(document2.createTextNode(leadingWhitespace), body2.childNodes[0] || null);
    }
    if (NAMESPACE === HTML_NAMESPACE) {
      return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
    }
    return WHOLE_DOCUMENT ? doc.documentElement : body2;
  };
  const _createNodeIterator = function _createNodeIterator2(root) {
    const doc = getOwnerDocument ? getOwnerDocument(root) : root.ownerDocument;
    return createNodeIterator.call(
      doc || root,
      root,
      // eslint-disable-next-line no-bitwise
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION,
      null
    );
  };
  const _stripTemplateExpressions = function _stripTemplateExpressions2(value) {
    value = stringReplace(value, MUSTACHE_EXPR$1, " ");
    value = stringReplace(value, ERB_EXPR$1, " ");
    value = stringReplace(value, TMPLIT_EXPR$1, " ");
    return value;
  };
  const _scrubTemplateExpressions2 = function _scrubTemplateExpressions(node) {
    var _node$querySelectorAl;
    node.normalize();
    const doc = getOwnerDocument ? getOwnerDocument(node) : node.ownerDocument;
    const walker = createNodeIterator.call(
      doc || node,
      node,
      // eslint-disable-next-line no-bitwise
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION,
      null
    );
    let currentNode = walker.nextNode();
    while (currentNode) {
      currentNode.data = _stripTemplateExpressions(currentNode.data);
      currentNode = walker.nextNode();
    }
    const templates = (_node$querySelectorAl = node.querySelectorAll) === null || _node$querySelectorAl === void 0 ? void 0 : _node$querySelectorAl.call(node, "template");
    if (templates) {
      arrayForEach(templates, (tmpl) => {
        if (_isDocumentFragment(tmpl.content)) {
          _scrubTemplateExpressions2(tmpl.content);
        }
      });
    }
  };
  const _isClobbered = function _isClobbered2(element) {
    const realTagName = getNodeName ? getNodeName(element) : null;
    if (typeof realTagName !== "string") {
      return false;
    }
    if (transformCaseFunc(realTagName) !== "form") {
      return false;
    }
    return typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || // Realm-safe NamedNodeMap detection: equality against the cached
    // prototype getter. Clobbered .attributes (e.g. <input name="attributes">)
    // makes the direct read diverge from the cached read; a clean form
    // (same-realm OR foreign-realm) has both reads pointing at the same
    // canonical NamedNodeMap.
    element.attributes !== getAttributes(element) || typeof element.removeAttribute !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function" || // NodeType clobbering probe. Cached Node.prototype.nodeType getter
    // returns the integer 1 for any Element regardless of realm; direct
    // read on a clobbered form (e.g. <input name="nodeType">) returns
    // the named child element. Cheap addition — nodeType is read from
    // an internal slot, no serialization cost — and removes a residual
    // clobbering surface used by several mXSS / PI / comment branches
    // in _sanitizeElements that compare currentNode.nodeType directly.
    element.nodeType !== getNodeType(element) || // HTMLFormElement has [LegacyOverrideBuiltIns]: a descendant named
    // "childNodes" shadows the prototype getter. Direct reads of
    // form.childNodes from a clobbered form return the named child
    // instead of the real NodeList, so any walk that reads it directly
    // skips the form's real children. Compare the direct read to the
    // cached Node.prototype getter — when the form's named-property
    // getter intercepts the read, the two values differ and we flag
    // the form. This catches every clobbering child type (input,
    // select, etc.) regardless of whether the named child happens to
    // carry a numeric .length, which a typeof-based probe would miss
    // (e.g. HTMLSelectElement.length is a defined unsigned-long).
    element.childNodes !== getChildNodes(element);
  };
  const _isDocumentFragment = function _isDocumentFragment2(value) {
    if (!getNodeType || typeof value !== "object" || value === null) {
      return false;
    }
    try {
      return getNodeType(value) === NODE_TYPE.documentFragment;
    } catch (_) {
      return false;
    }
  };
  const _isNode = function _isNode2(value) {
    if (!getNodeType || typeof value !== "object" || value === null) {
      return false;
    }
    try {
      return typeof getNodeType(value) === "number";
    } catch (_) {
      return false;
    }
  };
  function _executeHooks(hooks2, currentNode, data) {
    if (hooks2.length === 0) {
      return;
    }
    arrayForEach(hooks2, (hook) => {
      hook.call(DOMPurify, currentNode, data, CONFIG);
    });
  }
  const _isUnsafeNode = function _isUnsafeNode2(currentNode, tagName) {
    if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.innerHTML)) {
      return true;
    }
    if (SAFE_FOR_XML && currentNode.namespaceURI === HTML_NAMESPACE && LITERAL_TEXT_ELEMENTS[tagName] && (_isNode(currentNode.firstElementChild) || typeof currentNode.textContent === "string" && regExpTest(LITERAL_TEXT_CLOSE[tagName], currentNode.textContent))) {
      return true;
    }
    if (currentNode.nodeType === NODE_TYPE.processingInstruction) {
      return true;
    }
    if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, currentNode.data)) {
      return true;
    }
    return false;
  };
  const _matchesNameCheck = function _matchesNameCheck2(check, name2) {
    if (check instanceof RegExp) {
      return regExpTest(check, name2);
    }
    if (check instanceof Function) {
      for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        args[_key - 2] = arguments[_key];
      }
      return Boolean(check(name2, ...args));
    }
    return false;
  };
  const _sanitizeDisallowedNode = function _sanitizeDisallowedNode2(currentNode, tagName, root) {
    if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) {
      return false;
    }
    if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
      const parentNode = getParentNode(currentNode);
      const childNodes = getChildNodes(currentNode);
      if (childNodes && parentNode) {
        const childCount = childNodes.length;
        for (let i = childCount - 1; i >= 0; --i) {
          const hoisted = currentNode === root ? cloneNode(childNodes[i], true) : childNodes[i];
          parentNode.insertBefore(hoisted, getNextSibling(currentNode));
        }
      }
    }
    _forceRemove(currentNode);
    return true;
  };
  const _forkSharedAllowlist = function _forkSharedAllowlist2(hookList, set, defaultSet, setConfigSet) {
    if (hookList.length === 0) {
      return set;
    }
    return set === defaultSet || set === setConfigSet ? clone(set) : set;
  };
  const _handleHookDetachedNode = function _handleHookDetachedNode2(currentNode, root) {
    if (currentNode === root || getParentNode(currentNode) !== null) {
      return false;
    }
    if (IN_PLACE) {
      _neutralizeSubtree(currentNode);
    }
    return true;
  };
  const _sanitizeElements = function _sanitizeElements2(currentNode, root) {
    _executeHooks(hooks.beforeSanitizeElements, currentNode, null);
    if (_handleHookDetachedNode(currentNode, root)) {
      return true;
    }
    if (_isClobbered(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    const tagName = transformCaseFunc(_readNodeName(currentNode));
    ALLOWED_TAGS = _forkSharedAllowlist(hooks.uponSanitizeElement, ALLOWED_TAGS, DEFAULT_ALLOWED_TAGS, SET_CONFIG_ALLOWED_TAGS);
    _executeHooks(hooks.uponSanitizeElement, currentNode, {
      tagName,
      allowedTags: ALLOWED_TAGS
    });
    if (_handleHookDetachedNode(currentNode, root)) {
      return true;
    }
    if (_isUnsafeNode(currentNode, tagName)) {
      _forceRemove(currentNode);
      return true;
    }
    if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS[tagName]) {
      const removed = _sanitizeDisallowedNode(currentNode, tagName, root);
      if (removed === false) {
        _executeHooks(hooks.afterSanitizeElements, currentNode, null);
      }
      return removed;
    }
    const nt = _readNodeType(currentNode);
    if (nt === NODE_TYPE.element && !_checkValidNamespace(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(FALLBACK_TAG_CLOSE, currentNode.innerHTML)) {
      _forceRemove(currentNode);
      return true;
    }
    if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
      const content = _stripTemplateExpressions(currentNode.textContent);
      if (currentNode.textContent !== content) {
        arrayPush(DOMPurify.removed, {
          element: currentNode.cloneNode()
        });
        currentNode.textContent = content;
      }
    }
    _executeHooks(hooks.afterSanitizeElements, currentNode, null);
    return false;
  };
  const _isValidAttribute = function _isValidAttribute2(lcTag, lcName, value) {
    if (FORBID_ATTR[lcName]) {
      return false;
    }
    if (_isPatchLinkageAttribute(lcName, lcTag)) {
      return false;
    }
    if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document2 || value in formElement)) {
      return false;
    }
    const nameIsPermitted = ALLOWED_ATTR[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
    if (ALLOW_DATA_ATTR && regExpTest(DATA_ATTR$1, lcName)) {
      return true;
    }
    if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName)) {
      return true;
    }
    if (!nameIsPermitted) {
      return (
        // Condition a) covers a basically valid custom element tag name whose
        // tag passes the configured tagNameCheck and whose attribute name
        // passes the configured attributeNameCheck ...
        _isBasicCustomElement(lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName, lcTag) || // Condition b) covers an `is` attribute whose value passes the
        // configured tagNameCheck while customized built-in elements are
        // allowed.
        lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value)
      );
    }
    if (URI_SAFE_ATTRIBUTES[lcName]) {
      return true;
    }
    if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) {
      return true;
    }
    if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) {
      return true;
    }
    if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) {
      return true;
    }
    return !value;
  };
  const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, ["annotation-xml", "color-profile", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "missing-glyph"]);
  const _isBasicCustomElement = function _isBasicCustomElement2(tagName) {
    return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
  };
  const _applyTrustedTypesToAttribute = function _applyTrustedTypesToAttribute2(lcTag, lcName, namespaceURI, value) {
    if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function" && !namespaceURI) {
      switch (trustedTypes.getAttributeType(lcTag, lcName)) {
        case "TrustedHTML": {
          return _createTrustedHTML(value);
        }
        case "TrustedScriptURL": {
          return _createTrustedScriptURL(value);
        }
      }
    }
    return value;
  };
  const _setAttributeValue = function _setAttributeValue2(currentNode, name2, namespaceURI, value) {
    try {
      if (namespaceURI) {
        currentNode.setAttributeNS(namespaceURI, name2, value);
      } else {
        currentNode.setAttribute(name2, value);
      }
      if (_isClobbered(currentNode)) {
        _forceRemove(currentNode);
      } else {
        arrayPop(DOMPurify.removed);
      }
    } catch (_) {
      _removeAttribute(name2, currentNode);
    }
  };
  const _sanitizeAttributes = function _sanitizeAttributes2(currentNode) {
    _executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
    const attributes = currentNode.attributes;
    if (!attributes || _isClobbered(currentNode)) {
      return;
    }
    ALLOWED_ATTR = _forkSharedAllowlist(hooks.uponSanitizeAttribute, ALLOWED_ATTR, DEFAULT_ALLOWED_ATTR, SET_CONFIG_ALLOWED_ATTR);
    const hookEvent = {
      attrName: "",
      attrValue: "",
      keepAttr: true,
      allowedAttributes: ALLOWED_ATTR,
      forceKeepAttr: void 0
    };
    let l = attributes.length;
    const lcTag = transformCaseFunc(currentNode.nodeName);
    while (l--) {
      const attr = attributes[l];
      const name2 = attr.name, namespaceURI = attr.namespaceURI, attrValue = attr.value;
      const lcName = transformCaseFunc(name2);
      const initValue = attrValue;
      let value = name2 === "value" ? initValue : stringTrim(initValue);
      hookEvent.attrName = lcName;
      hookEvent.attrValue = value;
      hookEvent.keepAttr = true;
      hookEvent.forceKeepAttr = void 0;
      _executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
      value = hookEvent.attrValue;
      if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
        _removeAttribute(name2, currentNode, attr);
        value = SANITIZE_NAMED_PROPS_PREFIX + value;
      }
      if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) {
        _removeAttribute(name2, currentNode, attr);
        continue;
      }
      if (lcName === "attributename" && stringMatch(value, "href")) {
        _removeAttribute(name2, currentNode, attr);
        continue;
      }
      if (hookEvent.forceKeepAttr) {
        continue;
      }
      if (!hookEvent.keepAttr) {
        _removeAttribute(name2, currentNode, attr);
        continue;
      }
      if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value)) {
        _removeAttribute(name2, currentNode, attr);
        continue;
      }
      if (SAFE_FOR_TEMPLATES) {
        value = _stripTemplateExpressions(value);
      }
      if (!_isValidAttribute(lcTag, lcName, value)) {
        _removeAttribute(name2, currentNode, attr);
        continue;
      }
      value = _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value);
      if (value !== initValue) {
        _setAttributeValue(currentNode, name2, namespaceURI, value);
      }
    }
    _executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
  };
  const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
    let shadowNode = null;
    const shadowIterator = _createNodeIterator(fragment);
    _executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
    while (shadowNode = shadowIterator.nextNode()) {
      _executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
      _sanitizeElements(shadowNode, fragment);
      _sanitizeAttributes(shadowNode);
      if (_isDocumentFragment(shadowNode.content)) {
        _sanitizeShadowDOM2(shadowNode.content);
      }
      if (_readNodeType(shadowNode) === NODE_TYPE.element) {
        const innerSr = getShadowRoot(shadowNode);
        if (_isDocumentFragment(innerSr)) {
          _sanitizeAttachedShadowRoots(innerSr);
          _sanitizeShadowDOM2(innerSr);
        }
      }
    }
    _executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
  };
  const _sanitizeAttachedShadowRoots = function _sanitizeAttachedShadowRoots2(root) {
    const stack = [{
      node: root,
      shadow: null
    }];
    while (stack.length > 0) {
      const item = stack.pop();
      if (item.shadow) {
        _sanitizeShadowDOM2(item.shadow);
        continue;
      }
      const node = item.node;
      const nodeType = _readNodeType(node);
      const isElement = nodeType === NODE_TYPE.element;
      const childNodes = getChildNodes(node);
      if (childNodes) {
        for (let i = childNodes.length - 1; i >= 0; --i) {
          stack.push({
            node: childNodes[i],
            shadow: null
          });
        }
      }
      if (isElement) {
        const rootName = getNodeName ? getNodeName(node) : null;
        if (typeof rootName === "string" && transformCaseFunc(rootName) === "template") {
          const content = node.content;
          if (_isDocumentFragment(content)) {
            stack.push({
              node: content,
              shadow: null
            });
          }
        }
      }
      if (isElement) {
        const sr = getShadowRoot(node);
        if (_isDocumentFragment(sr)) {
          stack.push({
            node: null,
            shadow: sr
          }, {
            node: sr,
            shadow: null
          });
        }
      }
    }
  };
  DOMPurify.sanitize = function(dirty) {
    let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    let body2 = null;
    let importedNode = null;
    let currentNode = null;
    let returnNode = null;
    IS_EMPTY_INPUT = !dirty;
    if (IS_EMPTY_INPUT) {
      dirty = "<!-->";
    }
    if (typeof dirty !== "string" && !_isNode(dirty)) {
      dirty = stringifyValue(dirty);
      if (typeof dirty !== "string") {
        throw typeErrorCreate("dirty is not a string, aborting");
      }
    }
    if (!DOMPurify.isSupported) {
      return dirty;
    }
    if (SET_CONFIG) {
      ALLOWED_TAGS = SET_CONFIG_ALLOWED_TAGS;
      ALLOWED_ATTR = SET_CONFIG_ALLOWED_ATTR;
    } else {
      _parseConfig(cfg);
    }
    if (hooks.uponSanitizeElement.length > 0 || hooks.uponSanitizeAttribute.length > 0) {
      ALLOWED_TAGS = clone(ALLOWED_TAGS);
    }
    if (hooks.uponSanitizeAttribute.length > 0) {
      ALLOWED_ATTR = clone(ALLOWED_ATTR);
    }
    DOMPurify.removed = [];
    const inPlace = IN_PLACE && typeof dirty !== "string" && _isNode(dirty);
    if (inPlace) {
      _neutralizePatchLinkage(dirty);
      const nn = _readNodeName(dirty);
      if (typeof nn === "string") {
        const tagName = transformCaseFunc(nn);
        if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
          _neutralizeRoot(dirty);
          throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
        }
      }
      if (_isClobbered(dirty)) {
        _neutralizeRoot(dirty);
        throw typeErrorCreate("root node is clobbered and cannot be sanitized in-place");
      }
      try {
        _sanitizeAttachedShadowRoots(dirty);
      } catch (error) {
        _neutralizeRoot(dirty);
        throw error;
      }
    } else if (_isNode(dirty)) {
      body2 = _initDocument("<!---->");
      importedNode = body2.ownerDocument.importNode(dirty, true);
      if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") {
        body2 = importedNode;
      } else if (importedNode.nodeName === "HTML") {
        body2 = importedNode;
      } else {
        body2.appendChild(importedNode);
      }
      _sanitizeAttachedShadowRoots(importedNode);
    } else {
      if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && // eslint-disable-next-line unicorn/prefer-includes
      dirty.indexOf("<") === -1) {
        return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(dirty) : dirty;
      }
      body2 = _initDocument(dirty);
      if (!body2) {
        return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
      }
    }
    if (body2 && FORCE_BODY) {
      _forceRemove(body2.firstChild);
    }
    const walkRoot = inPlace ? dirty : body2;
    try {
      const nodeIterator = _createNodeIterator(walkRoot);
      while (currentNode = nodeIterator.nextNode()) {
        _sanitizeElements(currentNode, walkRoot);
        _sanitizeAttributes(currentNode);
        if (_isDocumentFragment(currentNode.content)) {
          _sanitizeShadowDOM2(currentNode.content);
        }
      }
    } catch (error) {
      if (inPlace) {
        _neutralizeRoot(dirty);
        arrayForEach(DOMPurify.removed, (entry) => {
          if (entry.element) {
            _neutralizeSubtree(entry.element);
          }
        });
      }
      throw error;
    }
    if (inPlace) {
      arrayForEach(DOMPurify.removed, (entry) => {
        if (entry.element) {
          _neutralizeSubtree(entry.element);
        }
      });
      if (SAFE_FOR_TEMPLATES) {
        _scrubTemplateExpressions2(dirty);
      }
      return dirty;
    }
    if (RETURN_DOM) {
      if (SAFE_FOR_TEMPLATES) {
        _scrubTemplateExpressions2(body2);
      }
      if (RETURN_DOM_FRAGMENT) {
        returnNode = createDocumentFragment.call(body2.ownerDocument);
        while (body2.firstChild) {
          returnNode.appendChild(body2.firstChild);
        }
      } else {
        returnNode = body2;
      }
      if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) {
        returnNode = importNode.call(originalDocument, returnNode, true);
      }
      return returnNode;
    }
    let serializedHTML = WHOLE_DOCUMENT ? body2.outerHTML : body2.innerHTML;
    if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body2.ownerDocument && body2.ownerDocument.doctype && body2.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body2.ownerDocument.doctype.name)) {
      serializedHTML = "<!DOCTYPE " + body2.ownerDocument.doctype.name + ">\n" + serializedHTML;
    }
    if (SAFE_FOR_TEMPLATES) {
      serializedHTML = _stripTemplateExpressions(serializedHTML);
    }
    return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(serializedHTML) : serializedHTML;
  };
  DOMPurify.setConfig = function() {
    let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    _parseConfig(cfg);
    SET_CONFIG = true;
    SET_CONFIG_ALLOWED_TAGS = ALLOWED_TAGS;
    SET_CONFIG_ALLOWED_ATTR = ALLOWED_ATTR;
  };
  DOMPurify.clearConfig = function() {
    CONFIG = null;
    SET_CONFIG = false;
    SET_CONFIG_ALLOWED_TAGS = null;
    SET_CONFIG_ALLOWED_ATTR = null;
    trustedTypesPolicy = defaultTrustedTypesPolicy;
    emptyHTML = "";
  };
  DOMPurify.isValidAttribute = function(tag, attr, value) {
    if (!CONFIG) {
      _parseConfig({});
    }
    const lcTag = transformCaseFunc(tag);
    const lcName = transformCaseFunc(attr);
    return _isValidAttribute(lcTag, lcName, value);
  };
  DOMPurify.addHook = function(entryPoint, hookFunction) {
    if (typeof hookFunction !== "function") {
      return;
    }
    if (!objectHasOwnProperty(hooks, entryPoint)) {
      return;
    }
    arrayPush(hooks[entryPoint], hookFunction);
  };
  DOMPurify.removeHook = function(entryPoint, hookFunction) {
    if (!objectHasOwnProperty(hooks, entryPoint)) {
      return void 0;
    }
    if (hookFunction !== void 0) {
      const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
      return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
    }
    return arrayPop(hooks[entryPoint]);
  };
  DOMPurify.removeHooks = function(entryPoint) {
    if (!objectHasOwnProperty(hooks, entryPoint)) {
      return;
    }
    hooks[entryPoint] = [];
  };
  DOMPurify.removeAllHooks = function() {
    hooks = _createHooksMap();
  };
  return DOMPurify;
}
var purify = createDOMPurify();

// packages/client/src/play/rich-text.js
var import_react7 = require("react");
var import_showdown = __toESM(require_showdown(), 1);
var SANITIZE_OPTIONS = Object.freeze({
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "textarea", "select", "meta", "link", "base", "style"],
  FORBID_ATTR: ["srcdoc"]
});
var markdownConverter = new import_showdown.default.Converter({
  disableForced4SpacesIndentedSublists: true,
  emoji: true,
  literalMidWordUnderscores: true,
  parseImgDimensions: true,
  simpleLineBreaks: true,
  strikethrough: true,
  tables: true,
  underline: true
});
function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function browserPurifier() {
  if (typeof purify?.sanitize === "function") return purify;
  if (typeof purify === "function" && globalThis.window?.document != null) {
    return purify(globalThis.window);
  }
  return null;
}
function markdownToHtml(text2) {
  return markdownConverter.makeHtml(String(text2 ?? ""));
}
function sanitizeRenderedHtml(html2, {
  purifier = browserPurifier(),
  documentObject = globalThis.document
} = {}) {
  if (purifier === null || typeof purifier?.sanitize !== "function") return escapeHtml(html2);
  const clean = String(purifier.sanitize(String(html2), SANITIZE_OPTIONS));
  if (documentObject == null || typeof documentObject.createElement !== "function") return clean;
  const template = documentObject.createElement("template");
  template.innerHTML = clean;
  for (const link of template.content.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href") ?? "";
    if (href.startsWith("#")) continue;
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  }
  return template.innerHTML;
}
function renderRichTextHtml(text2, options) {
  return sanitizeRenderedHtml(markdownToHtml(text2), options);
}
function RichText({ text: text2, className }) {
  return (0, import_react7.createElement)("div", {
    className,
    "data-dtv-rich-text": "",
    dangerouslySetInnerHTML: { __html: renderRichTextHtml(text2) }
  });
}

// packages/client/src/play/turn-actions.js
var import_react8 = require("react");

// packages/client/src/play/mutations.js
async function updateCatalog(client, mutator, options) {
  if (typeof client?.updateCatalog === "function") return client.updateCatalog(mutator, options);
  const current2 = await readCatalogOrEmpty(client);
  const next = await mutator(current2);
  const saved = await client.putCatalog(next);
  return saved ?? next;
}
async function updateTimeline(client, playthrough, mutator, options) {
  if (typeof client?.updateTimeline === "function") return client.updateTimeline(playthrough, mutator, options);
  const current2 = options?.initial ?? await client.getTimeline(playthrough);
  const next = await mutator(current2);
  const saved = await client.putTimeline(playthrough, next);
  return saved ?? next;
}
async function readCatalogOrEmpty(client) {
  try {
    return await client.getCatalog();
  } catch (error) {
    if (error?.code === "PLAY_PATH_NOT_FOUND" && (error?.status === void 0 || error?.status === 404)) return { playthroughs: [] };
    throw error;
  }
}

// packages/client/src/play/schema.js
var CHROME_MODES = /* @__PURE__ */ new Set(["native", "play"]);
var MESSAGE_ROLES = /* @__PURE__ */ new Set(["user", "assistant", "system"]);
function isRecord4(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function fail(label, detail) {
  throw new TypeError(`${label}: ${detail}`);
}
function stringId(value, label) {
  if (typeof value !== "string" || value.trim() === "") fail(label, "must be a non-empty string");
  return value;
}
function eventSeq(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(label, "must be a non-negative integer");
  return value;
}
function extRecord(value, label) {
  if (value === void 0) return void 0;
  if (!isRecord4(value)) fail(label, "must be an object");
  return value;
}
function normalizeChrome(value, label = "chrome") {
  if (!isRecord4(value)) fail(label, "must be an object");
  if (!CHROME_MODES.has(value.mode)) fail(label, "mode must be native or play");
  if (value.revision !== void 0 && value.revision !== null && (typeof value.revision !== "string" || value.revision === "")) {
    fail(label, "revision must be a non-empty string or null");
  }
  return { mode: value.mode, revision: value.revision ?? null };
}
function normalizeWorkspace(value, label = "workspace") {
  if (!isRecord4(value)) fail(label, "must be an object");
  if (typeof value.selected !== "boolean") fail(label, "selected must be a boolean");
  if (value.rootPath !== null && value.rootPath !== void 0 && typeof value.rootPath !== "string") {
    fail(label, "rootPath must be a string or null");
  }
  if (!Number.isSafeInteger(value.contractVersion) || value.contractVersion < 1) {
    fail(label, "contractVersion must be a positive integer");
  }
  const warnings = Array.isArray(value.warnings) ? value.warnings.filter(isRecord4).map((item) => ({
    code: typeof item.code === "string" ? item.code : "",
    message: typeof item.message === "string" ? item.message : ""
  })) : [];
  return {
    selected: value.selected,
    rootPath: value.rootPath ?? null,
    workspaceId: typeof value.workspaceId === "string" ? value.workspaceId : null,
    contractVersion: value.contractVersion,
    activeTimelinePath: typeof value.activeTimelinePath === "string" ? value.activeTimelinePath : null,
    firstSelection: value.firstSelection === true,
    warnings
  };
}
function normalizeTimelineVariant(value, label = "variant") {
  if (!isRecord4(value)) fail(label, "must be an object");
  const startEventId = eventSeq(value.startEventId, `${label}.startEventId`);
  const endEventId = eventSeq(value.endEventId, `${label}.endEventId`);
  if (startEventId > endEventId) fail(label, "startEventId must not exceed endEventId");
  const ext = extRecord(value.ext, `${label}.ext`);
  return {
    id: stringId(value.id, `${label}.id`),
    sessionId: stringId(value.sessionId, `${label}.sessionId`),
    startEventId,
    endEventId,
    ...ext === void 0 ? {} : { ext }
  };
}
function normalizeTimelineNode(value, label = "node") {
  if (!isRecord4(value)) fail(label, "must be an object");
  if (value.kind !== "qa") fail(label, "kind must be qa");
  if (!Array.isArray(value.variants) || value.variants.length === 0) {
    fail(label, "variants must be a non-empty array");
  }
  const variants = value.variants.map((item, index) => normalizeTimelineVariant(item, `${label}.variants[${index}]`));
  const adoptedVariantId = stringId(value.adoptedVariantId, `${label}.adoptedVariantId`);
  if (!variants.some((item) => item.id === adoptedVariantId)) fail(label, "adoptedVariantId must match a variant");
  if (value.hidden !== void 0 && typeof value.hidden !== "boolean") fail(label, "hidden must be a boolean");
  if (value.displayOverride !== void 0 && value.displayOverride !== null && typeof value.displayOverride !== "string") {
    fail(label, "displayOverride must be a string or null");
  }
  const ext = extRecord(value.ext, `${label}.ext`);
  return {
    id: stringId(value.id, `${label}.id`),
    kind: "qa",
    hidden: value.hidden === true,
    displayOverride: value.displayOverride ?? null,
    adoptedVariantId,
    variants,
    ...ext === void 0 ? {} : { ext }
  };
}
function normalizeTimeline(value, label = "timeline") {
  if (!isRecord4(value)) fail(label, "must be an object");
  if (!Array.isArray(value.nodes)) fail(label, "nodes must be an array");
  const nodes = value.nodes.map((item, index) => normalizeTimelineNode(item, `${label}.nodes[${index}]`));
  const ids = /* @__PURE__ */ new Set();
  for (const node of nodes) {
    if (ids.has(node.id)) fail(label, `duplicate node id ${node.id}`);
    ids.add(node.id);
  }
  const ext = extRecord(value.ext, `${label}.ext`);
  return { nodes, ...ext === void 0 ? {} : { ext } };
}
function normalizeCatalog(value, label = "catalog") {
  if (!isRecord4(value)) fail(label, "must be an object");
  if (!Array.isArray(value.playthroughs)) fail(label, "playthroughs must be an array");
  const playthroughs = value.playthroughs.map((item, index) => {
    const itemLabel = `${label}.playthroughs[${index}]`;
    if (!isRecord4(item)) fail(itemLabel, "must be an object");
    const ext2 = extRecord(item.ext, `${itemLabel}.ext`);
    return {
      id: stringId(item.id, `${itemLabel}.id`),
      path: stringId(item.path, `${itemLabel}.path`),
      ...typeof item.title === "string" ? { title: item.title } : {},
      ...typeof item.lastOpenedAt === "string" ? { lastOpenedAt: item.lastOpenedAt } : {},
      ...ext2 === void 0 ? {} : { ext: ext2 }
    };
  });
  const ext = extRecord(value.ext, `${label}.ext`);
  return { playthroughs, ...ext === void 0 ? {} : { ext } };
}
function parseJsonDocument(content, normalize, label) {
  if (typeof content !== "string") fail(label, "content must be a JSON string");
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    fail(label, "content must be valid JSON");
  }
  return normalize(parsed, label);
}
function projectContentText(content) {
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (!isRecord4(part)) return "";
    if (typeof part.text === "string") return part.text;
    return typeof part.type === "string" && part.type !== "text" ? `\u27E6${part.type}\u27E7` : "";
  }).join("");
}
function normalizeSessionMessages(value, label = "messages") {
  if (!isRecord4(value)) fail(label, "must be an object");
  if (!Array.isArray(value.messages)) fail(label, "messages must be an array");
  if (typeof value.incompleteTurn !== "boolean") fail(label, "incompleteTurn must be a boolean");
  const messages = value.messages.map((item, index) => {
    const itemLabel = `${label}.messages[${index}]`;
    if (!isRecord4(item)) fail(itemLabel, "must be an object");
    if (!MESSAGE_ROLES.has(item.role)) fail(itemLabel, "role is invalid");
    if (!Array.isArray(item.content)) fail(itemLabel, "content must be an array");
    if (item.seq !== null && (!Number.isSafeInteger(item.seq) || item.seq < 0)) fail(itemLabel, "seq must be a non-negative integer or null");
    return {
      id: stringId(item.id, `${itemLabel}.id`),
      role: item.role,
      content: item.content,
      seq: item.seq,
      text: projectContentText(item.content)
    };
  });
  return { messages, incompleteTurn: value.incompleteTurn };
}
function normalizeFocus(value, label = "focus") {
  if (!isRecord4(value)) fail(label, "must be an object");
  const nullableId = (field, fieldLabel) => {
    if (value[field] !== null && (typeof value[field] !== "string" || value[field].trim() === "")) {
      fail(label, `${fieldLabel} must be a non-empty string or null`);
    }
    return value[field];
  };
  return {
    playthroughId: stringId(value.playthroughId, `${label}.playthroughId`),
    sessionId: nullableId("sessionId", "sessionId"),
    nodeId: nullableId("nodeId", "nodeId"),
    variantId: nullableId("variantId", "variantId")
  };
}
function timelinePath(value, label = "timeline path") {
  const path = typeof value === "string" ? value : value?.path;
  stringId(path, label);
  if (!path.endsWith("timeline.json")) fail(label, "must point to timeline.json");
  return path;
}
function playthroughCharacterId(playthrough) {
  const explicit = playthrough?.ext?.pmpDshTavern?.characterId;
  if (typeof explicit === "string" && explicit !== "") return explicit;
  const path = typeof playthrough?.path === "string" ? playthrough.path.replaceAll("\\", "/") : "";
  const first = path.split("/").filter(Boolean)[0];
  return first || null;
}

// packages/client/src/play/sidebar-model.js
var SIDEBAR_LOAD_CONCURRENCY = 4;
function characterIdFromSelection(value) {
  const selection = value?.selection ?? value;
  const id = selection?.characterCardId;
  return typeof id === "string" && id !== "" ? id : null;
}
function rootSessionId2(playthrough) {
  const id = playthrough?.ext?.pmpDshTavern?.rootSessionId;
  return typeof id === "string" && id !== "" ? id : null;
}
function sessionTitle(session, id) {
  if (typeof session?.displayTitle === "string" && session.displayTitle !== "") return session.displayTitle;
  if (typeof session?.title === "string" && session.title !== "") return session.title;
  return id;
}
function normalizedPath2(value) {
  if (typeof value !== "string") return "";
  const normalized = value.replaceAll("\\", "/").replace(/\/+$/, "");
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized;
}
function requiresSystemWorkspaceConfirmation(value) {
  const path = typeof value === "string" ? value.replaceAll("\\", "/") : "";
  return /^c:\//i.test(path) || path === "/" || path === "/usr" || path.startsWith("/usr/") || path === "/System" || path.startsWith("/System/");
}
function timelineFor(timelines, playthrough) {
  return timelines?.[playthrough.path] ?? timelines?.[playthrough.id] ?? null;
}
function playthroughMembers(playthrough, timeline) {
  const ids = /* @__PURE__ */ new Set();
  const rootId = rootSessionId2(playthrough);
  if (rootId !== null) ids.add(rootId);
  for (const node of timeline?.nodes ?? []) {
    for (const variant of node?.variants ?? []) {
      if (typeof variant?.sessionId === "string" && variant.sessionId !== "") ids.add(variant.sessionId);
    }
  }
  return ids;
}
function sessionIdsInRpWorkspace({ workspace, workspaceItems = [], sessions = {} } = {}) {
  const ids = /* @__PURE__ */ new Set();
  if (workspace?.selected !== true) return ids;
  if (typeof workspace.workspaceId === "string" && workspace.workspaceId !== "") {
    const item = workspaceItems.find((candidate) => candidate?.workspaceId === workspace.workspaceId);
    if (item !== void 0) {
      for (const id of item.sessionIds ?? []) if (typeof id === "string" && id !== "") ids.add(id);
      return ids;
    }
  }
  const root = normalizedPath2(workspace.rootPath);
  if (root === "") return ids;
  for (const [id, session] of Object.entries(sessions)) {
    if (normalizedPath2(session?.cwd) === root) ids.add(id);
  }
  return ids;
}
var SessionCharacterBindingCache = class {
  constructor() {
    this.entries = /* @__PURE__ */ new Map();
    this.generation = 0;
  }
  clear() {
    this.generation += 1;
    this.entries.clear();
  }
  get(client, sessionId) {
    const cached = this.entries.get(sessionId);
    if (cached !== void 0) return cached.promise ?? Promise.resolve(cached.value);
    const generation = this.generation;
    const readSelection = typeof client.getSelection === "function" ? client.getSelection.bind(client) : client.getCharacterSelection.bind(client);
    const promise = readSelection(sessionId).then(characterIdFromSelection, () => null);
    this.entries.set(sessionId, { promise });
    promise.then((value) => {
      if (this.generation === generation) this.entries.set(sessionId, { value });
    });
    return promise;
  }
};
async function loadSessionCharacterBindings(client, sessionIds, {
  concurrency = SIDEBAR_LOAD_CONCURRENCY,
  cache = new SessionCharacterBindingCache()
} = {}) {
  if (client == null || typeof client.getSelection !== "function" && typeof client.getCharacterSelection !== "function") return {};
  const ids = [...new Set(sessionIds)].filter((id) => typeof id === "string" && id !== "");
  const result = {};
  let cursor = 0;
  const worker = async () => {
    while (cursor < ids.length) {
      const index = cursor;
      cursor += 1;
      const id = ids[index];
      result[id] = await cache.get(client, id);
    }
  };
  const requested = Number.isFinite(concurrency) ? Math.floor(concurrency) : SIDEBAR_LOAD_CONCURRENCY;
  const workerCount = Math.min(ids.length, Math.max(1, Math.min(SIDEBAR_LOAD_CONCURRENCY, requested)));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return result;
}
async function mapConcurrent(values, mapper, concurrency = SIDEBAR_LOAD_CONCURRENCY) {
  const result = new Array(values.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      result[index] = await mapper(values[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(values.length, concurrency) }, worker));
  return result;
}
async function loadPlaySidebarResources(client) {
  if (client == null) throw new TypeError("playClient.required");
  const [workspace, characterResponse] = await Promise.all([
    client.getWorkspace(),
    client.getCharacters()
  ]);
  const characters = Array.isArray(characterResponse?.characters) ? characterResponse.characters : [];
  if (workspace.selected !== true) return { workspace, characters, catalog: { playthroughs: [] }, timelines: {}, diagnostics: [] };
  let catalog2;
  try {
    catalog2 = await client.getCatalog();
  } catch (reason) {
    if (reason?.code !== "PLAY_PATH_NOT_FOUND") throw reason;
    catalog2 = { playthroughs: [] };
  }
  const timelines = {};
  const diagnostics = [];
  await mapConcurrent(catalog2.playthroughs, async (playthrough) => {
    try {
      timelines[playthrough.path] = await client.getTimeline(playthrough);
    } catch (reason) {
      diagnostics.push({
        playthroughId: playthrough.id,
        path: playthrough.path,
        message: reason instanceof Error ? reason.message : String(reason)
      });
    }
  });
  return { workspace, characters, catalog: catalog2, timelines, diagnostics };
}
function projectPlaySidebar({
  workspace = { selected: false },
  workspaceItems = [],
  characters = [],
  catalog: catalog2 = { playthroughs: [] },
  timelines = {},
  sessions = {},
  sessionIds = [],
  archivedSessionIds = [],
  currentId = null,
  sessionCharacters = {}
} = {}) {
  const archived = new Set(archivedSessionIds);
  const rpSessionIds = sessionIdsInRpWorkspace({ workspace, workspaceItems, sessions });
  const characterById = /* @__PURE__ */ new Map();
  const ensureCharacter = (id, name2 = id) => {
    if (!characterById.has(id)) characterById.set(id, { id, name: name2, playthroughs: [], unassigned: [] });
    return characterById.get(id);
  };
  for (const character of characters) {
    if (typeof character?.id !== "string" || character.id === "") continue;
    ensureCharacter(character.id, typeof character.name === "string" && character.name !== "" ? character.name : character.id);
  }
  const claimedRpSessions = /* @__PURE__ */ new Set();
  for (const playthrough of catalog2.playthroughs ?? []) {
    const rootId = rootSessionId2(playthrough);
    const characterId = playthroughCharacterId(playthrough);
    if (characterId === null) continue;
    const allMembers = playthroughMembers(playthrough, timelineFor(timelines, playthrough));
    const members = [...allMembers].filter((id) => rpSessionIds.has(id) && !archived.has(id));
    for (const id of members) claimedRpSessions.add(id);
    ensureCharacter(characterId).playthroughs.push({
      ...playthrough,
      title: typeof playthrough.title === "string" && playthrough.title !== "" ? playthrough.title : playthrough.id,
      rootSessionId: rootId !== null && members.includes(rootId) ? rootId : null,
      sessionIds: members,
      active: currentId !== null && members.includes(currentId),
      missing: members.length === 0
    });
  }
  const ids = sessionIds.length > 0 ? sessionIds : Object.keys(sessions);
  const otherSessions = [];
  for (const id of ids) {
    const session = sessions[id];
    if (session == null || archived.has(id)) continue;
    if (!rpSessionIds.has(id)) {
      otherSessions.push({ id, title: sessionTitle(session, id), active: currentId === id, kind: "external" });
      continue;
    }
    if (claimedRpSessions.has(id)) continue;
    const characterId = sessionCharacters[id];
    if (typeof characterId === "string" && characterId !== "") {
      ensureCharacter(characterId).unassigned.push({ id, title: sessionTitle(session, id), active: currentId === id });
      continue;
    }
    otherSessions.push({ id, title: sessionTitle(session, id), active: currentId === id, kind: "ordinary" });
  }
  return {
    workspaceReady: workspace.selected === true,
    rpSessionIds: [...rpSessionIds],
    playSessionIds: [...claimedRpSessions],
    characters: [...characterById.values()],
    otherSessions
  };
}
function shouldShowUnboundNotice({ workspace, session, selection } = {}) {
  if (workspace == null || session == null) return false;
  if (workspace.selected !== true) return true;
  const workspacePath = normalizedPath2(workspace.rootPath);
  const sessionPath = normalizedPath2(session.cwd);
  if (workspacePath === "" || sessionPath !== workspacePath) return true;
  return characterIdFromSelection(selection) === null;
}

// packages/client/src/play/import.js
function parseJsonl(text2) {
  const rows = text2.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  if (rows.length === 0) throw new TypeError("play.import.empty");
  const messages = rows.slice(1).filter((row) => typeof row?.mes === "string");
  let greeting = null;
  const qa = [];
  let pending = null;
  for (const message of messages) {
    if (message.is_user === true) {
      if (pending !== null) throw new TypeError("play.import.unpaired");
      pending = message.mes;
    } else if (pending === null && qa.length === 0 && greeting === null) {
      greeting = message.mes;
    } else if (pending !== null) {
      qa.push({ user: pending, assistant: message.mes });
      pending = null;
    }
  }
  if (pending !== null) throw new TypeError("play.import.unpaired");
  return { greeting, qa, source: { format: "sillytavern-jsonl" } };
}
function parseBundle(value) {
  if (value?.kind !== "pmp-dsh-tavern-playthrough" || value.schemaVersion !== 1) {
    throw new TypeError("play.import.unsupported");
  }
  const turns = projectTimelineQa(value.timeline, value.messagesBySession);
  const imported = value.resources?.importContext;
  const importedQa = Array.isArray(imported?.qa) ? imported.qa.map((item) => ({ user: String(item?.user ?? ""), assistant: String(item?.assistant ?? "") })) : [];
  return {
    greeting: typeof imported?.greeting === "string" ? imported.greeting : typeof value.resources?.greeting === "string" ? value.resources.greeting : null,
    qa: [
      ...importedQa,
      ...turns.filter((turn) => !turn.hidden).map((turn) => ({ user: turn.userText, assistant: turn.originalAssistantText }))
    ],
    source: { format: "pmp-dsh-tavern-bundle", playthroughId: value.playthrough?.id ?? null }
  };
}
function parsePlaythroughImport(text2, fileName = "") {
  if (typeof text2 !== "string" || text2.trim() === "") throw new TypeError("play.import.empty");
  const parsed = text2.trimStart().startsWith("{") && !text2.trimStart().includes("\n") ? parseBundle(JSON.parse(text2)) : (() => {
    try {
      return parseBundle(JSON.parse(text2));
    } catch (error) {
      if (text2.includes("\n")) return parseJsonl(text2);
      throw error;
    }
  })();
  return { schemaVersion: 1, ...parsed, source: { ...parsed.source, fileName } };
}
function rootSessionId3(playthrough) {
  const value = playthrough?.ext?.pmpDshTavern?.rootSessionId;
  return typeof value === "string" && value !== "" ? value : null;
}
function playthroughDirectory(playthrough) {
  const path = typeof playthrough?.path === "string" ? playthrough.path.replaceAll("\\", "/") : "";
  if (!path.endsWith("/timeline.json")) throw new TypeError("play.import.timelineRequired");
  return path.slice(0, -"/timeline.json".length);
}
function fallbackImportPath(playthrough, timeline) {
  const direct = playthrough?.ext?.pmpDshTavern?.importContextPath;
  if (typeof direct === "string" && direct !== "") return direct;
  const nested = timeline?.ext?.pmpDshTavern?.importContextPath;
  return typeof nested === "string" && nested !== "" ? nested : null;
}
async function getPlaythroughImportBinding(client, sessionId, playthrough, timeline) {
  if (typeof client.getImportContextBinding === "function") {
    return client.getImportContextBinding(sessionId);
  }
  const path = fallbackImportPath(playthrough, timeline);
  return path === null ? null : { path, state: "pending" };
}
async function loadPlaythroughImportContext(client, sessionId, playthrough, timeline) {
  const binding = await getPlaythroughImportBinding(client, sessionId, playthrough, timeline);
  if (typeof binding?.path !== "string" || binding.path === "") return { binding: null, document: null };
  const document2 = JSON.parse((await client.getFile(binding.path)).content);
  return { binding, document: document2 };
}
function assertLocallyMutable(timeline, messages) {
  if ((timeline?.nodes?.length ?? 0) > 0 || messages?.incompleteTurn === true || (messages?.messages ?? []).some((message) => message?.role === "user" || message?.role === "assistant")) {
    const error = new Error("play.import.locked");
    error.code = "PLAY_IMPORT_CONTEXT_LOCKED";
    throw error;
  }
}
async function bindPlaythroughImport(client, playthrough, file, {
  randomUUID = () => globalThis.crypto.randomUUID()
} = {}) {
  const document2 = parsePlaythroughImport(await file.text(), file.name);
  const sessionId = rootSessionId3(playthrough);
  if (sessionId === null) throw new TypeError("play.import.sessionRequired");
  const [timeline, messages] = await Promise.all([
    client.getTimeline(playthrough),
    client.getMessages(sessionId)
  ]);
  assertLocallyMutable(timeline, messages);
  const directory = playthroughDirectory(playthrough);
  const token = String(randomUUID());
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(token)) throw new TypeError("play.import.idInvalid");
  const contextPath = `${directory}/import-context-${token}.json`;
  await client.createDirs(directory);
  await client.putFile(contextPath, JSON.stringify(document2, null, 2));
  const bound = await client.putImportContextBinding(sessionId, { path: contextPath });
  const [savedFile, savedBinding] = await Promise.all([
    client.getFile(contextPath),
    client.getImportContextBinding(sessionId)
  ]);
  const savedDocument = JSON.parse(savedFile.content);
  if (bound?.path !== contextPath || savedBinding?.path !== contextPath || savedBinding?.state !== "pending" || savedDocument.schemaVersion !== document2.schemaVersion || savedDocument.qa?.length !== document2.qa.length) {
    throw new Error("play.import.verificationFailed");
  }
  return { sessionId, binding: savedBinding, document: document2 };
}
async function unbindPlaythroughImport(client, playthrough) {
  const sessionId = rootSessionId3(playthrough);
  if (sessionId === null) throw new TypeError("play.import.sessionRequired");
  const [timeline, messages] = await Promise.all([
    client.getTimeline(playthrough),
    client.getMessages(sessionId)
  ]);
  assertLocallyMutable(timeline, messages);
  await client.deleteImportContextBinding(sessionId);
  const saved = await client.getImportContextBinding(sessionId);
  if (saved !== null) throw new Error("play.import.verificationFailed");
  return { sessionId, binding: null };
}

// packages/client/src/play/create.js
var SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
var SAFE_SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
function safeSegment(value, label) {
  if (typeof value !== "string" || !SAFE_SEGMENT.test(value)) {
    throw new TypeError(`${label} must be a safe path segment`);
  }
  return value;
}
function safeSessionId(value) {
  if (typeof value !== "string" || !SAFE_SESSION_ID.test(value)) {
    throw new TypeError("session.id must be a valid DSH session id");
  }
  return value;
}
function isoNow(now) {
  const value = now();
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) throw new TypeError("now must return a valid Date");
  return value.toISOString();
}
async function catalogOrEmpty(client) {
  try {
    return await client.getCatalog();
  } catch (reason) {
    if (reason?.code === "PLAY_PATH_NOT_FOUND") return { playthroughs: [] };
    throw reason;
  }
}
function playthroughCharacterId2(playthrough) {
  const value = playthrough?.ext?.pmpDshTavern?.characterId;
  return typeof value === "string" && value !== "" ? value : null;
}
function rootSessionId4(playthrough) {
  const value = playthrough?.ext?.pmpDshTavern?.rootSessionId;
  return typeof value === "string" && value !== "" ? value : null;
}
function latestCharacterPlaythrough(catalog2, characterId) {
  let latest = null;
  let latestNumber = 0;
  let ordinal = 0;
  for (const playthrough of catalog2?.playthroughs ?? []) {
    if (playthroughCharacterId2(playthrough) !== characterId) continue;
    ordinal += 1;
    const explicit = playthrough?.ext?.pmpDshTavern?.playthroughNumber;
    const number = Number.isSafeInteger(explicit) && explicit > 0 ? explicit : ordinal;
    if (latest === null || number >= latestNumber) {
      latest = playthrough;
      latestNumber = number;
    }
  }
  return latest;
}
async function playthroughIsReusable(client, playthrough) {
  const sessionId = rootSessionId4(playthrough);
  if (sessionId === null) return false;
  const timeline = await client.getTimeline(playthrough);
  if ((timeline?.nodes?.length ?? 0) > 0) return false;
  const imported = await loadPlaythroughImportContext(client, sessionId, playthrough, timeline);
  if (Array.isArray(imported.document?.qa) && imported.document.qa.length > 0) return false;
  const history = await client.getMessages(sessionId);
  if (history?.incompleteTurn === true) return false;
  return !(history?.messages ?? []).some((message) => message?.role === "user" || message?.role === "assistant");
}
function nextPlaythroughNumber(catalog2, characterId) {
  let maximum = 0;
  let legacyOrdinal = 0;
  for (const playthrough of catalog2?.playthroughs ?? []) {
    if (playthroughCharacterId2(playthrough) !== characterId) continue;
    legacyOrdinal += 1;
    const explicit = playthrough?.ext?.pmpDshTavern?.playthroughNumber;
    maximum = Math.max(maximum, Number.isSafeInteger(explicit) && explicit > 0 ? explicit : legacyOrdinal);
  }
  return maximum + 1;
}
async function renamePlaythrough(client, playthrough, title) {
  if (client == null) throw new TypeError("playClient.required");
  const normalized = typeof title === "string" ? title.trim() : "";
  if (normalized === "" || normalized.length > 120) throw new TypeError("play.rename.invalid");
  const saved = await updateCatalog(client, (current2) => {
    const freshIndex = current2.playthroughs.findIndex((item) => item.id === playthrough?.id && item.path === playthrough?.path);
    if (freshIndex < 0) throw new TypeError("play.rename.missing");
    const freshPlaythroughs = [...current2.playthroughs];
    freshPlaythroughs[freshIndex] = { ...freshPlaythroughs[freshIndex], title: normalized };
    return { ...current2, playthroughs: freshPlaythroughs };
  });
  const verified = saved?.playthroughs === void 0 ? await client.getCatalog() : saved;
  const renamed = verified.playthroughs.find((item) => item.id === playthrough.id && item.path === playthrough.path);
  if (renamed?.title !== normalized) throw new Error("play.rename.verificationFailed");
  return renamed;
}
function sourceSessionIdForCharacter(character) {
  const activePlaythrough = character?.playthroughs?.find((item) => item.active && typeof item.rootSessionId === "string");
  if (activePlaythrough !== void 0) return activePlaythrough.rootSessionId;
  const activeLoose = character?.unassigned?.find((item) => item.active);
  if (activeLoose !== void 0) return activeLoose.id;
  const loose = character?.unassigned?.find((item) => typeof item.id === "string");
  if (loose !== void 0) return loose.id;
  const rooted = character?.playthroughs?.find((item) => typeof item.rootSessionId === "string");
  return rooted?.rootSessionId ?? null;
}
async function createCharacterPlaythrough(client, {
  character,
  selectionFromSessionId = null,
  now = () => /* @__PURE__ */ new Date(),
  randomUUID = () => globalThis.crypto.randomUUID()
} = {}) {
  if (client == null) throw new TypeError("playClient.required");
  const characterId = safeSegment(character?.id, "character.id");
  const createdAt = isoNow(now);
  const playthroughId = safeSegment(`playthrough-${randomUUID()}`, "playthrough.id");
  const directory = `${characterId}/${playthroughId}`;
  const path = `${directory}/timeline.json`;
  const sourceId = typeof selectionFromSessionId === "string" && selectionFromSessionId !== "" ? selectionFromSessionId : null;
  const catalog2 = await catalogOrEmpty(client);
  const latest = latestCharacterPlaythrough(catalog2, characterId);
  if (latest !== null && await playthroughIsReusable(client, latest)) {
    return { sessionId: rootSessionId4(latest), playthrough: latest, reused: true };
  }
  const created = await client.postSession(sourceId);
  const sessionId = safeSessionId(created?.sessionId);
  if (sourceId === null) {
    await client.putCharacterSelection(sessionId, characterId, { greetingIndex: 0 });
  }
  const selection = await client.getCharacterSelection(sessionId);
  if (characterIdFromSelection(selection) !== characterId) {
    throw new Error("playthrough character selection did not persist");
  }
  const playthrough = {
    id: playthroughId,
    path,
    title: "\u5468\u76EE",
    lastOpenedAt: createdAt,
    ext: {
      pmpDshTavern: {
        characterId,
        rootSessionId: sessionId,
        playthroughNumber: 0
      }
    }
  };
  await client.createDirs(directory);
  await client.putTimeline(playthrough, { nodes: [] });
  let saved;
  const savedCatalog = await updateCatalog(client, (fresh) => {
    const existing = fresh.playthroughs.find((item) => item.id === playthroughId && item.path === path);
    if (existing !== void 0) {
      if (existing.ext?.pmpDshTavern?.rootSessionId !== sessionId) throw new Error("playthrough.create.identityConflict");
      saved = existing;
      return fresh;
    }
    const playthroughNumber = nextPlaythroughNumber(fresh, characterId);
    const row = {
      ...playthrough,
      title: `${playthroughNumber}\u5468\u76EE`,
      ext: {
        ...playthrough.ext,
        pmpDshTavern: { ...playthrough.ext.pmpDshTavern, playthroughNumber }
      }
    };
    saved = row;
    return { ...fresh, playthroughs: [...fresh.playthroughs, row] };
  });
  const savedTimeline = await client.getTimeline(playthrough);
  saved ??= savedCatalog?.playthroughs?.find((item) => item.id === playthroughId && item.path === path);
  if (saved?.ext?.pmpDshTavern?.rootSessionId !== sessionId || savedTimeline.nodes.length !== 0) {
    throw new Error("playthrough verification failed");
  }
  return { sessionId, playthrough: saved, reused: false };
}
function createPlaythroughController(client, dependencies = {}) {
  const inFlight = /* @__PURE__ */ new Map();
  let tail = Promise.resolve();
  return {
    create(args) {
      const characterId = safeSegment(args?.character?.id, "character.id");
      const existing = inFlight.get(characterId);
      if (existing !== void 0) return existing;
      const task = tail.catch(() => {
      }).then(() => createCharacterPlaythrough(client, {
        ...dependencies,
        ...args
      }));
      tail = task;
      inFlight.set(characterId, task);
      task.finally(() => {
        if (inFlight.get(characterId) === task) inFlight.delete(characterId);
      }).catch(() => {
      });
      return task;
    }
  };
}

// packages/client/src/play/fork.js
var SAFE_SEGMENT2 = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
var SAFE_SESSION_ID2 = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
function safeSegment2(value, label) {
  if (typeof value !== "string" || !SAFE_SEGMENT2.test(value)) {
    throw new TypeError(`${label} must be a safe path segment`);
  }
  return value;
}
function safeSessionId2(value) {
  if (typeof value !== "string" || !SAFE_SESSION_ID2.test(value)) {
    throw new TypeError("session.id must be a valid DSH session id");
  }
  return value;
}
function nodeById(timeline, nodeId) {
  const index = timeline.nodes.findIndex((node) => node.id === nodeId);
  if (index < 0) throw new TypeError(`Unknown timeline node ${nodeId}`);
  return { index, node: timeline.nodes[index] };
}
function adoptedVariant2(node) {
  const value = node.variants.find((variant) => variant.id === node.adoptedVariantId);
  if (value === void 0) throw new TypeError("Adopted variant is missing");
  return value;
}
function forkedTimeline(source, nodeIndex, adoptedId, sessionId) {
  return {
    ...source,
    nodes: source.nodes.slice(0, nodeIndex + 1).map((node, index) => ({
      ...node,
      variants: node.variants.map((variant) => index === nodeIndex && variant.id === adoptedId ? { ...variant, sessionId } : { ...variant })
    }))
  };
}
function inheritedRangeExists(messages, variant) {
  const values = messages?.messages ?? [];
  const user = values.some((message) => message.role === "user" && Number.isSafeInteger(message.seq) && message.seq >= variant.startEventId && message.seq <= variant.endEventId);
  const assistant = values.some((message) => message.role === "assistant" && message.seq === variant.endEventId);
  return messages?.incompleteTurn !== true && user && assistant;
}
async function forkPlaythroughAtNode(client, {
  playthrough,
  nodeId,
  now = () => /* @__PURE__ */ new Date(),
  randomUUID = () => globalThis.crypto.randomUUID()
} = {}) {
  if (client == null) throw new TypeError("playClient.required");
  const characterId = safeSegment2(playthroughCharacterId(playthrough), "character.id");
  const source = await client.getTimeline(playthrough);
  const { index, node } = nodeById(source, nodeId);
  const adopted = adoptedVariant2(node);
  const branch = await client.postBranch(adopted.sessionId, adopted.endEventId);
  const sessionId = safeSessionId2(branch?.sessionId);
  const inherited = await client.getMessages(sessionId);
  if (!inheritedRangeExists(inherited, adopted)) {
    throw new Error("Forked session does not contain the adopted reply range");
  }
  const value = now();
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) throw new TypeError("now must return a valid Date");
  const playthroughId = safeSegment2(`playthrough-${randomUUID()}`, "playthrough.id");
  const directory = `${characterId}/${playthroughId}`;
  const path = `${directory}/timeline.json`;
  const timeline = forkedTimeline(source, index, adopted.id, sessionId);
  const draft = {
    id: playthroughId,
    path,
    title: "\u5468\u76EE",
    lastOpenedAt: value.toISOString(),
    ext: {
      pmpDshTavern: {
        characterId,
        rootSessionId: sessionId,
        playthroughNumber: 0
      }
    }
  };
  await client.createDirs(directory);
  await client.putTimeline(draft, timeline);
  let saved;
  const catalog2 = await updateCatalog(client, (fresh) => {
    const existing = fresh.playthroughs.find((item) => item.id === playthroughId && item.path === path);
    if (existing !== void 0) {
      if (existing.ext?.pmpDshTavern?.rootSessionId !== sessionId) {
        throw new Error("playthrough.fork.identityConflict");
      }
      saved = existing;
      return fresh;
    }
    const playthroughNumber = nextPlaythroughNumber(fresh, characterId);
    saved = {
      ...draft,
      title: `${playthroughNumber}\u5468\u76EE`,
      ext: {
        ...draft.ext,
        pmpDshTavern: { ...draft.ext.pmpDshTavern, playthroughNumber }
      }
    };
    return { ...fresh, playthroughs: [...fresh.playthroughs, saved] };
  });
  saved ??= catalog2?.playthroughs?.find((item) => item.id === playthroughId && item.path === path);
  const focus = await client.getFocus(saved ?? draft);
  if (focus.sessionId !== sessionId || focus.nodeId !== node.id || focus.variantId !== adopted.id) {
    throw new Error("Forked playthrough focus verification failed");
  }
  return { sessionId, playthrough: saved ?? draft, timeline };
}

// packages/client/src/play/nodes.js
function nodeById2(timeline, nodeId) {
  const index = timeline.nodes.findIndex((node) => node.id === nodeId);
  if (index < 0) throw new TypeError(`Unknown timeline node ${nodeId}`);
  return { index, node: timeline.nodes[index] };
}
function replaceNode(timeline, index, node) {
  const nodes = [...timeline.nodes];
  nodes[index] = node;
  return { ...timeline, nodes };
}
function defaultDelay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
function defaultId(startEventId, endEventId) {
  const random = globalThis.crypto?.randomUUID?.() ?? Date.now();
  return ["variant", startEventId, endEventId, random].join("-").slice(0, 200);
}
function completedPairAfter(messageState, eventId) {
  if (messageState?.incompleteTurn === true) return null;
  const messages = (messageState?.messages ?? []).filter((message) => Number.isSafeInteger(message.seq) && message.seq > eventId).sort((left, right) => left.seq - right.seq);
  const user = messages.find((message) => message.role === "user");
  if (user === void 0) return null;
  const assistant = [...messages].reverse().find((message) => message.role === "assistant" && message.seq > user.seq);
  return assistant === void 0 ? null : { user, assistant };
}
function createPlayNodeController(client, {
  delay = defaultDelay,
  pollInterval = 500,
  maxPolls = 240,
  idFactory = defaultId
} = {}) {
  if (client == null) throw new TypeError("playClient.required");
  let pending = Promise.resolve();
  const schedule = (operation) => {
    const task = pending.then(operation);
    pending = task.catch(() => {
    });
    return task;
  };
  const update = (playthrough, nodeId, transform) => schedule(async () => {
    return updateTimeline(client, playthrough, (timeline) => {
      const { index, node } = nodeById2(timeline, nodeId);
      return replaceNode(timeline, index, transform(node));
    });
  });
  return {
    setHidden(playthrough, nodeId, hidden) {
      if (typeof hidden !== "boolean") throw new TypeError("hidden must be a boolean");
      return update(playthrough, nodeId, (node) => ({ ...node, hidden }));
    },
    setDisplayOverride(playthrough, nodeId, value) {
      if (value !== null && typeof value !== "string") {
        throw new TypeError("displayOverride must be a string or null");
      }
      return update(playthrough, nodeId, (node) => ({ ...node, displayOverride: value }));
    },
    adoptVariant(playthrough, nodeId, variantId) {
      if (typeof variantId !== "string" || variantId === "") throw new TypeError("variantId is required");
      return schedule(async () => {
        const next = await updateTimeline(client, playthrough, (timeline) => {
          const { index, node: node2 } = nodeById2(timeline, nodeId);
          const variant2 = node2.variants.find((item) => item.id === variantId);
          if (variant2 === void 0) throw new TypeError(`Unknown variant ${variantId}`);
          return replaceNode(timeline, index, { ...node2, adoptedVariantId: variantId });
        });
        const { node } = nodeById2(next, nodeId);
        const variant = node.variants.find((item) => item.id === variantId);
        const focus = await client.getFocus(playthrough);
        if (focus.sessionId !== variant.sessionId) throw new Error("Saved variant does not match derived focus");
        return { timeline: next, sessionId: variant.sessionId };
      });
    },
    createReplySwipe(playthrough, nodeId) {
      return schedule(async () => {
        const timeline = await client.getTimeline(playthrough);
        const { node } = nodeById2(timeline, nodeId);
        const adopted = node.variants.find((item) => item.id === node.adoptedVariantId);
        if (adopted === void 0) throw new TypeError("Adopted variant is missing");
        const source = await client.getMessages(adopted.sessionId);
        const user = source.messages.find((message) => message.role === "user" && message.seq >= adopted.startEventId && message.seq <= adopted.endEventId);
        if (user === void 0 || typeof user.text !== "string" || user.text === "") {
          throw new TypeError("Adopted variant has no reusable user message");
        }
        const forkEventId = Math.max(0, adopted.startEventId - 1);
        const branch = await client.postBranch(adopted.sessionId, forkEventId);
        const newSessionId = branch?.sessionId;
        if (typeof newSessionId !== "string" || newSessionId === "") {
          throw new TypeError("Branch response has no sessionId");
        }
        await client.postUserMessage(newSessionId, user.text);
        let pair = null;
        for (let attempt = 0; attempt < maxPolls; attempt += 1) {
          pair = completedPairAfter(await client.getMessages(newSessionId), forkEventId);
          if (pair !== null) break;
          if (attempt + 1 < maxPolls) await delay(pollInterval);
        }
        if (pair === null) throw new Error("Timed out waiting for the swipe reply");
        const variantId = idFactory(pair.user.seq, pair.assistant.seq, newSessionId);
        const variant = {
          id: variantId,
          sessionId: newSessionId,
          startEventId: pair.user.seq,
          endEventId: pair.assistant.seq
        };
        const next = await updateTimeline(client, playthrough, (timeline2) => {
          const current2 = nodeById2(timeline2, nodeId);
          const existing = current2.node.variants.find((item) => item.id === variantId);
          if (existing !== void 0) {
            return replaceNode(timeline2, current2.index, { ...current2.node, adoptedVariantId: variantId });
          }
          return replaceNode(timeline2, current2.index, {
            ...current2.node,
            adoptedVariantId: variantId,
            variants: [...current2.node.variants, variant]
          });
        });
        const focus = await client.getFocus(playthrough);
        if (focus.sessionId !== newSessionId) throw new Error("Saved swipe does not match derived focus");
        return { timeline: next, sessionId: newSessionId, variantId };
      });
    },
    forkPlaythrough(playthrough, nodeId) {
      return schedule(() => forkPlaythroughAtNode(client, { playthrough, nodeId }));
    }
  };
}

// packages/client/src/play/turn-actions.js
var h7 = createLocalizedElement(import_react8.createElement);
var controllers = /* @__PURE__ */ new WeakMap();
var css6 = `
.dtv-play-turn-actions{display:flex;align-items:center;gap:2px;min-height:28px}.dtv-play-turn-action{width:28px;height:28px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;display:grid;place-items:center}.dtv-play-turn-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dtv-play-turn-action:disabled{cursor:default;opacity:.38}.dtv-play-turn-position{padding:0 5px;color:var(--dsw-alias-label-tertiary);font-size:10px}
`;
function installStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-turn-actions"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-play-turn-actions`;
  style.textContent = css6;
  document.head.append(style);
}
function controller(client) {
  let value = controllers.get(client);
  if (value === void 0) {
    value = createPlayNodeController(client);
    controllers.set(client, value);
  }
  return value;
}
function Action({ icon, label, disabled = false, disabledLabel, onClick }) {
  return h7("button", {
    type: "button",
    className: "dtv-play-turn-action",
    disabled,
    title: disabled ? disabledLabel ?? uiMessage("play.chat.runningDisabled") : label,
    "aria-label": label,
    onClick
  }, icon);
}
function PlayTurnActions({
  turn,
  playthrough,
  playClient,
  openSession,
  running,
  onChanged,
  onError
}) {
  installStyles();
  const [busy, setBusy] = (0, import_react8.useState)(false);
  const disabled = running || busy;
  const position = Math.max(0, turn.variants.findIndex((item) => item.id === turn.variant.id));
  const mutate = async (operation) => {
    if (disabled) return;
    setBusy(true);
    onError("");
    try {
      await operation();
      onChanged();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const adopt = (offset) => mutate(async () => {
    const target = turn.variants[(position + offset + turn.variants.length) % turn.variants.length];
    const result = await controller(playClient).adoptVariant(playthrough, turn.id, target.id);
    openSession(result.sessionId);
  });
  const copy = async () => {
    try {
      if (typeof navigator.clipboard?.writeText !== "function") throw new Error(translate("play.chat.copyUnavailable"));
      await navigator.clipboard.writeText(turn.assistantText);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  if (turn.hidden) {
    return h7(
      "div",
      { className: "dtv-play-turn-actions" },
      h7(Action, {
        icon: "\u25C9",
        label: uiMessage("play.chat.restoreNode"),
        disabled,
        onClick: () => mutate(() => controller(playClient).setHidden(playthrough, turn.id, false))
      })
    );
  }
  return h7(
    "div",
    { className: "dtv-play-turn-actions" },
    h7(Action, { icon: "\u29C9", label: uiMessage("play.chat.copy"), onClick: copy }),
    h7(Action, {
      icon: "\u2039",
      label: uiMessage("play.chat.previousReply"),
      disabled: disabled || turn.variants.length < 2,
      disabledLabel: turn.variants.length < 2 ? uiMessage("play.chat.noOtherReply") : void 0,
      onClick: () => adopt(-1)
    }),
    turn.variants.length < 2 ? null : h7("span", { className: "dtv-play-turn-position" }, `${position + 1}/${turn.variants.length}`),
    h7(Action, {
      icon: "\u203A",
      label: uiMessage("play.chat.nextReply"),
      disabled: disabled || turn.variants.length < 2,
      disabledLabel: turn.variants.length < 2 ? uiMessage("play.chat.noOtherReply") : void 0,
      onClick: () => adopt(1)
    }),
    h7(Action, {
      icon: "\u2726",
      label: uiMessage("play.chat.generateReply"),
      disabled,
      onClick: () => mutate(async () => {
        const result = await controller(playClient).createReplySwipe(playthrough, turn.id);
        openSession(result.sessionId);
      })
    }),
    h7(Action, {
      icon: "\u2442",
      label: uiMessage("play.chat.forkPlaythrough"),
      disabled,
      onClick: () => mutate(async () => {
        const result = await controller(playClient).forkPlaythrough(playthrough, turn.id);
        openSession(result.sessionId);
      })
    }),
    h7(Action, {
      icon: "\u270E",
      label: uiMessage("play.chat.editDisplay"),
      disabled,
      onClick: () => {
        const value = window.prompt(translate("play.chat.editDisplayPrompt"), turn.assistantText);
        if (value !== null) mutate(() => controller(playClient).setDisplayOverride(playthrough, turn.id, value));
      }
    }),
    turn.displayOverridden ? h7(Action, {
      icon: "\u21BA",
      label: uiMessage("play.chat.restoreOriginal"),
      disabled,
      onClick: () => mutate(() => controller(playClient).setDisplayOverride(playthrough, turn.id, null))
    }) : null,
    h7(Action, {
      icon: "\u2298",
      label: uiMessage("play.chat.hideNode"),
      disabled,
      onClick: () => {
        if (window.confirm(translate("play.chat.hideConfirm"))) {
          mutate(() => controller(playClient).setHidden(playthrough, turn.id, true));
        }
      }
    })
  );
}

// packages/client/src/play/turns.js
function recordedEndSeq2(timeline, sessionId) {
  let end = -1;
  for (const node of timeline?.nodes ?? []) {
    for (const variant of node.variants ?? []) {
      if (variant.sessionId === sessionId) end = Math.max(end, variant.endEventId);
    }
  }
  return end;
}
function defaultId2(prefix, sessionId, startEventId, endEventId) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${startEventId}-${endEventId}-${random}`.slice(0, 200);
}
function appendCompletedTurns(timeline, messageState, sessionId, {
  idFactory = defaultId2
} = {}) {
  if (typeof sessionId !== "string" || sessionId === "") throw new TypeError("sessionId is required");
  if (messageState?.incompleteTurn === true) return { timeline, added: [] };
  const boundary = recordedEndSeq2(timeline, sessionId);
  const messages = [...messageState?.messages ?? []].filter((message) => Number.isSafeInteger(message.seq) && message.seq > boundary).sort((left, right) => left.seq - right.seq);
  const added = [];
  let user = null;
  let assistant = null;
  const appendPair = () => {
    if (user === null || assistant === null) return;
    const nodeId = idFactory("qa", sessionId, user.seq, assistant.seq);
    const variantId = idFactory("variant", sessionId, user.seq, assistant.seq);
    added.push({
      id: nodeId,
      kind: "qa",
      hidden: false,
      displayOverride: null,
      adoptedVariantId: variantId,
      variants: [{
        id: variantId,
        sessionId,
        startEventId: user.seq,
        endEventId: assistant.seq
      }]
    });
  };
  for (const message of messages) {
    if (message.role === "user") {
      if (user === null) {
        user = message;
      } else if (assistant !== null) {
        appendPair();
        user = message;
        assistant = null;
      }
    } else if (message.role === "assistant" && user !== null) {
      assistant = message;
    }
  }
  appendPair();
  if (added.length === 0) return { timeline, added };
  return { timeline: { ...timeline, nodes: [...timeline.nodes, ...added] }, added };
}
function createTurnReconciler(client) {
  if (client == null) throw new TypeError("playClient.required");
  let pending = Promise.resolve();
  return function reconcile(sessionId, playthrough) {
    const task = pending.then(async () => {
      const messages = await client.getMessages(sessionId);
      if (messages.incompleteTurn) return { timeline: null, added: [] };
      const initial = await client.getTimeline(playthrough);
      const initialResult = appendCompletedTurns(initial, messages, sessionId);
      if (initialResult.added.length === 0) return initialResult;
      let added = initialResult.added;
      const timeline = await updateTimeline(client, playthrough, (current2) => {
        const next = appendCompletedTurns(current2, messages, sessionId);
        added = next.added;
        return next.timeline;
      }, { initial });
      return { timeline, added };
    });
    pending = task.catch(() => {
    });
    return task;
  };
}

// packages/client/src/play/chat.js
var h8 = createLocalizedElement(import_react9.createElement);
var turnReconcilers = /* @__PURE__ */ new WeakMap();
var css7 = `
.dtv-play-chat{height:100%;min-height:0;box-sizing:border-box;overflow:auto;padding:22px max(18px,calc((100% - 780px)/2)) 36px;color:var(--dsw-alias-label-primary)}
.dtv-play-chat-list{display:flex;flex-direction:column;gap:22px}.dtv-play-chat-row{display:flex;flex-direction:column;gap:8px}.dtv-play-chat-role{font-size:11px;font-weight:700;color:var(--dsw-alias-label-tertiary)}
.dtv-play-chat-bubble{max-width:88%;box-sizing:border-box;border-radius:14px;padding:12px 14px;overflow-wrap:anywhere;font-size:14px;line-height:1.65}.dtv-play-chat-user{align-self:flex-end;background:var(--dsw-alias-interactive-bg-selected,var(--dsw-specific-tip))}.dtv-play-chat-assistant{align-self:flex-start;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block))}
.dtv-play-greeting{position:relative;align-self:flex-start;max-width:88%;display:grid;grid-template-columns:30px minmax(0,1fr) 30px;align-items:center;gap:6px}.dtv-play-greeting-text{border-radius:14px;padding:13px 15px;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block));overflow-wrap:anywhere;font-size:14px;line-height:1.65}
.dtv-play-greeting-empty{min-height:34px;visibility:hidden}
.dtv-play-greeting-button{width:30px;height:34px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}.dtv-play-greeting-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-greeting-button:disabled{opacity:.4;cursor:default}
.dtv-play-import-controls{align-self:center;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;margin:0 0 2px}.dtv-play-import-bound{width:100%;margin:0;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:11px}.dtv-play-import-button{min-height:30px;padding:5px 11px;border:1px solid var(--dsw-alias-border-subtle);border-radius:9px;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block));color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;cursor:pointer}.dtv-play-import-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-import-button:disabled{opacity:.45;cursor:default}.dtv-play-import-last{margin:0;color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:700}
.dtv-play-chat-status{margin:16px 0;padding:12px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block));color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.55}.dtv-play-chat-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtv-play-chat-running{align-self:flex-start;margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}
.dtv-play-chat-reasoning{align-self:flex-start;max-width:88%;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.6}.dtv-play-chat-reasoning summary{width:max-content;cursor:pointer;user-select:none;color:var(--dsw-alias-label-tertiary);font-size:12px}.dtv-play-chat-reasoning-text{margin-top:8px;padding:10px 12px;border-left:2px solid var(--dsw-alias-border-secondary,var(--dsw-specific-divider));white-space:pre-wrap;overflow-wrap:anywhere}
.dtv-play-rich>:first-child{margin-top:0}.dtv-play-rich>:last-child{margin-bottom:0}.dtv-play-rich p,.dtv-play-rich ul,.dtv-play-rich ol,.dtv-play-rich blockquote,.dtv-play-rich pre,.dtv-play-rich table{margin:0 0 .85em}.dtv-play-rich ul,.dtv-play-rich ol{padding-left:1.5em}.dtv-play-rich blockquote{padding-left:12px;border-left:3px solid var(--dsw-alias-border-secondary,var(--dsw-specific-divider));color:var(--dsw-alias-label-secondary)}.dtv-play-rich pre{max-width:100%;overflow:auto;padding:11px 12px;border-radius:9px;background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-base));white-space:pre}.dtv-play-rich code{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:.92em}.dtv-play-rich :not(pre)>code{padding:.12em .35em;border-radius:5px;background:var(--dsw-alias-markdown-code-inline,var(--dsw-alias-bg-base))}.dtv-play-rich table{display:block;max-width:100%;overflow:auto;border-collapse:collapse}.dtv-play-rich th,.dtv-play-rich td{padding:6px 9px;border:1px solid var(--dsw-alias-border-l2)}.dtv-play-rich img,.dtv-play-rich video{max-width:100%;height:auto}.dtv-play-rich a{color:var(--dsw-alias-state-business-primary);text-decoration:underline}.dtv-play-rich hr{border:0;border-top:1px solid var(--dsw-alias-border-l2)}
`;
function installPlayChatStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-chat"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-play-chat`;
  style.textContent = css7;
  document.head.append(style);
}
function adoptedSessionIds(timeline, currentSessionId) {
  const ids = /* @__PURE__ */ new Set([currentSessionId]);
  for (const node of timeline?.nodes ?? []) {
    const variant = node.variants?.find((item) => item.id === node.adoptedVariantId);
    if (typeof variant?.sessionId === "string" && variant.sessionId !== "") ids.add(variant.sessionId);
  }
  return [...ids];
}
async function loadMessages(client, sessionIds, concurrency = 4) {
  const result = {};
  let cursor = 0;
  const worker = async () => {
    while (cursor < sessionIds.length) {
      const sessionId = sessionIds[cursor];
      cursor += 1;
      result[sessionId] = await client.getMessages(sessionId);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, sessionIds.length) }, worker));
  return result;
}
function turnReconciler(client) {
  let reconcile = turnReconcilers.get(client);
  if (reconcile === void 0) {
    reconcile = createTurnReconciler(client);
    turnReconcilers.set(client, reconcile);
  }
  return reconcile;
}
async function loadChatState(client, sessionId, playthrough) {
  const reconciled = await turnReconciler(client)(sessionId, playthrough);
  const timeline = reconciled.timeline ?? await client.getTimeline(playthrough);
  const messagesBySession = await loadMessages(client, adoptedSessionIds(timeline, sessionId));
  const selectionResponse = await client.getCharacterSelection(sessionId);
  const characterId = selectionResponse?.selection?.characterCardId;
  const characterResponse = typeof characterId === "string" && characterId !== "" ? await client.getCharacter(characterId) : null;
  const [regexDocument, active] = await Promise.all([
    typeof client.getFile === "function" ? getRegexDocument(client) : { schemaVersion: 1, rules: [] },
    typeof client.getActive === "function" ? client.getActive(sessionId) : null
  ]);
  const bindings = {
    presetId: active?.selection?.presetId ?? null,
    characterId: characterId ?? active?.selection?.characterCardId ?? null
  };
  const presetResponse = typeof bindings.presetId === "string" && bindings.presetId !== "" && typeof client.getPreset === "function" ? await client.getPreset(bindings.presetId) : null;
  const rules = [
    ...regexDocument.rules,
    ...resourceRegexRules(presetResponse?.preset ?? presetResponse, {
      kind: "preset",
      resourceId: bindings.presetId
    }),
    ...resourceRegexRules(characterResponse?.character ?? characterResponse, {
      kind: "character",
      resourceId: bindings.characterId
    })
  ];
  const character = characterResponse?.character;
  const characterData = character?.data ?? character;
  const macros = {
    user: active?.resources?.user?.name || "User",
    character: characterData?.nickname || characterData?.name || character?.name || "Assistant"
  };
  const regexDiagnostics = [];
  const renderText = (text2, target, context) => {
    const expanded = applyDisplayNameMacros(text2, macros);
    const result = applyDisplayRegex(expanded, rules, bindings, target, context);
    regexDiagnostics.push(...result.diagnostics);
    return result.text;
  };
  const timelineTurns = projectTimelineQa(timeline, messagesBySession);
  const greeting = projectGreeting({
    openingCharacterId: playthrough?.ext?.pmpDshTavern?.characterId,
    selectionResponse,
    characterResponse
  });
  const importedContext = await loadPlaythroughImportContext(client, sessionId, playthrough, timeline);
  let importedTurns = [];
  if (importedContext.document !== null) {
    const imported = importedContext.document;
    importedTurns = [
      ...typeof imported.greeting === "string" && imported.greeting !== "" ? [{
        id: "import-greeting",
        imported: true,
        hidden: false,
        userText: "",
        assistantText: imported.greeting,
        originalAssistantText: imported.greeting
      }] : [],
      ...(imported.qa ?? []).map((qa, index) => ({
        id: `import-${index}`,
        imported: true,
        hidden: false,
        userText: qa.user,
        assistantText: qa.assistant,
        originalAssistantText: qa.assistant,
        importLast: index === imported.qa.length - 1
      }))
    ];
  }
  const rawTurns = [...importedTurns, ...timelineTurns];
  const turns = Array(rawTurns.length);
  let depth = 0;
  for (let index = rawTurns.length - 1; index >= 0; index -= 1) {
    const turn = rawTurns[index];
    const assistantDepth = turn.assistantText === "" ? void 0 : depth++;
    const userDepth = turn.userText === "" ? void 0 : depth++;
    turns[index] = {
      ...turn,
      userText: renderText(turn.userText, "user", { depth: userDepth }),
      assistantText: renderText(turn.assistantText, "assistant", { depth: assistantDepth })
    };
  }
  const rootMessages = messagesBySession[sessionId];
  const importMutable = (timeline?.nodes?.length ?? 0) === 0 && rootMessages?.incompleteTurn !== true && !(rootMessages?.messages ?? []).some((message) => message?.role === "user" || message?.role === "assistant") && importedContext.binding?.state !== "consumed";
  return {
    timeline,
    turns,
    importBinding: importedContext.binding,
    importContext: importedContext.document,
    importMutable,
    greeting: importedTurns.length > 0 ? null : greeting === null ? null : { ...greeting, text: renderText(greeting.text, "assistant") },
    regexDiagnostics,
    display: { rules, bindings, macros }
  };
}
function applyTurnDisplayRegex(turn, display, { userDepth, assistantDepth } = {}) {
  return {
    ...turn,
    userText: applyDisplayRegex(
      applyDisplayNameMacros(turn.userText, display.macros),
      display.rules,
      display.bindings,
      "user",
      { depth: userDepth }
    ).text,
    assistantText: applyDisplayRegex(
      applyDisplayNameMacros(turn.assistantText, display.macros),
      display.rules,
      display.bindings,
      "assistant",
      { depth: assistantDepth }
    ).text
  };
}
function Greeting({ greeting, busy, change, footer = null }) {
  const multiple = (greeting?.options?.length ?? 0) > 1;
  return h8(
    "div",
    { className: "dtv-play-chat-row" },
    greeting === null ? null : h8("span", { className: "dtv-play-chat-role" }, rawText(greeting.characterName)),
    greeting === null ? h8("div", { className: "dtv-play-greeting dtv-play-greeting-empty", "aria-hidden": true }) : h8(
      "div",
      { className: "dtv-play-greeting" },
      h8("button", {
        type: "button",
        className: "dtv-play-greeting-button",
        disabled: busy || !multiple,
        title: uiMessage("play.chat.previousGreeting"),
        "aria-label": uiMessage("play.chat.previousGreeting"),
        onClick: () => change("previous")
      }, "\u2039"),
      h8(RichText, { className: "dtv-play-greeting-text dtv-play-rich", text: greeting.text }),
      h8("button", {
        type: "button",
        className: "dtv-play-greeting-button",
        disabled: busy || !multiple,
        title: uiMessage("play.chat.nextGreeting"),
        "aria-label": uiMessage("play.chat.nextGreeting"),
        onClick: () => change("next")
      }, "\u203A")
    ),
    footer
  );
}
function Turn({ turn, ...actionProps }) {
  if (turn.hidden) {
    return h8(
      "div",
      { className: "dtv-play-chat-row" },
      h8("p", { className: "dtv-play-chat-status" }, uiMessage("play.chat.hiddenNode")),
      h8(PlayTurnActions, { turn, ...actionProps })
    );
  }
  return h8(
    "div",
    { className: "dtv-play-chat-row" },
    turn.importLast === true ? h8("p", { className: "dtv-play-import-last" }, uiMessage("play.import.lastQa")) : null,
    turn.userText === "" ? null : h8(RichText, { className: "dtv-play-chat-bubble dtv-play-chat-user dtv-play-rich", text: turn.userText }),
    turn.reasoningText === "" || turn.reasoningText == null ? null : h8(
      "details",
      { className: "dtv-play-chat-reasoning" },
      h8("summary", { title: uiMessage("play.chat.reasoning") }, uiMessage("play.chat.reasoning")),
      h8("div", { className: "dtv-play-chat-reasoning-text" }, rawText(turn.reasoningText))
    ),
    turn.assistantText === "" ? null : h8(RichText, { className: "dtv-play-chat-bubble dtv-play-chat-assistant dtv-play-rich", text: turn.assistantText }),
    turn.running === true && turn.assistantText === "" ? h8("p", { className: "dtv-play-chat-running" }, uiMessage("play.chat.thinking")) : null,
    turn.imported || turn.transient ? null : h8(PlayTurnActions, { turn, ...actionProps })
  );
}
function ImportControls({
  playClient,
  playthrough,
  binding,
  locked,
  changed,
  onError
}) {
  const input = (0, import_react9.useRef)(null);
  const [busy, setBusy] = (0, import_react9.useState)(false);
  if (locked) return null;
  const choose = () => {
    if (!busy) input.current?.click();
  };
  const bind = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    setBusy(true);
    onError("");
    try {
      await bindPlaythroughImport(playClient, playthrough, file);
      changed();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const unbind = async () => {
    if (busy || !window.confirm(unwrapText(uiMessage("play.import.unbindConfirm")))) return;
    setBusy(true);
    onError("");
    try {
      await unbindPlaythroughImport(playClient, playthrough);
      changed();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  return h8(
    "div",
    { className: "dtv-play-import-controls" },
    binding === null ? null : h8("p", { className: "dtv-play-import-bound" }, uiMessage("play.import.bound")),
    h8("button", {
      type: "button",
      className: "dtv-play-import-button",
      disabled: busy,
      onClick: choose
    }, binding === null ? uiMessage("play.import.bind") : uiMessage("play.import.replace")),
    binding === null ? null : h8("button", {
      type: "button",
      className: "dtv-play-import-button",
      disabled: busy,
      onClick: unbind
    }, uiMessage("play.import.unbind")),
    h8("input", {
      ref: input,
      hidden: true,
      type: "file",
      accept: ".json,.jsonl,application/json,application/x-ndjson",
      onChange: bind
    })
  );
}
function MowanChatView({ sessionId, useSession, playClient, playthrough, openSession, chatScroll }) {
  installPlayChatStyles();
  const sessionRevision = useSession((state2) => `${state2.nodes?.length ?? 0}:${state2.running === true}:${state2.blank === true}`);
  const liveNodes = useSession((state2) => state2.nodes);
  const partial = useSession((state2) => state2.partial);
  const latestUserSeq = latestUserNodeSeq(liveNodes);
  const [revision, setRevision] = (0, import_react9.useState)(0);
  const running = useSession((state2) => state2.running === true);
  const [state, setState] = (0, import_react9.useState)(null);
  const [error, setError] = (0, import_react9.useState)("");
  const [greetingBusy, setGreetingBusy] = (0, import_react9.useState)(false);
  const bottomAnchor = (0, import_react9.useRef)(null);
  const initialScrollSession = (0, import_react9.useRef)(null);
  const userSeqSession = (0, import_react9.useRef)(null);
  const lastUserSeq = (0, import_react9.useRef)(-1);
  const scrollToBottom = () => {
    const local = bottomAnchor.current;
    if (local === null) return;
    const scrollport = local.closest("[data-conversation-scroll]") ?? local;
    scrollport.scrollTop = scrollport.scrollHeight;
    chatScroll?.save(null);
  };
  (0, import_react9.useLayoutEffect)(() => {
    if (state === null || initialScrollSession.current === sessionId) return;
    initialScrollSession.current = sessionId;
    scrollToBottom();
  }, [sessionId, state]);
  (0, import_react9.useLayoutEffect)(() => {
    if (userSeqSession.current !== sessionId) {
      userSeqSession.current = sessionId;
      lastUserSeq.current = latestUserSeq;
      return;
    }
    if (latestUserSeq <= lastUserSeq.current) return;
    lastUserSeq.current = latestUserSeq;
    scrollToBottom();
  }, [latestUserSeq, sessionId]);
  (0, import_react9.useEffect)(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(CLIENT_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, refresh);
  }, []);
  (0, import_react9.useEffect)(() => {
    let active = true;
    setError("");
    loadChatState(playClient, sessionId, playthrough).then((next) => {
      if (active) setState(next);
    }).catch((reason) => {
      if (!active) return;
      setState(null);
      setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {
      active = false;
    };
  }, [playClient, playthrough, revision, sessionId, sessionRevision]);
  const changeGreeting = async (direction) => {
    if (state?.greeting == null || greetingBusy) return;
    const next = adjacentGreetingIndex(state.greeting, direction);
    if (next === null) return;
    setGreetingBusy(true);
    setError("");
    try {
      await playClient.putGreetingIndex(sessionId, next);
      setRevision((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setGreetingBusy(false);
    }
  };
  const liveSourceTurns = state === null ? [] : projectLiveTurns({
    timeline: state.timeline,
    sessionId,
    nodes: liveNodes,
    partial,
    running
  });
  let liveDepth = 0;
  const liveTurns = Array(liveSourceTurns.length);
  for (let index = liveSourceTurns.length - 1; index >= 0; index -= 1) {
    const turn = liveSourceTurns[index];
    const assistantDepth = turn.assistantText === "" ? void 0 : liveDepth++;
    const userDepth = turn.userText === "" ? void 0 : liveDepth++;
    liveTurns[index] = applyTurnDisplayRegex(turn, state.display, { userDepth, assistantDepth });
  }
  const importLocked = state?.importMutable !== true || running || latestUserSeq >= 0 || liveTurns.length > 0;
  const importControls = state === null ? null : h8(ImportControls, {
    playClient,
    playthrough,
    binding: state.importBinding,
    locked: importLocked,
    changed: () => setRevision((value) => value + 1),
    onError: setError
  });
  return h8(
    "div",
    { className: "dtv-play-chat" },
    error === "" ? null : h8("p", { className: "dtv-play-chat-status", "data-error": true }, rawText(error)),
    state === null && error === "" ? h8("p", { className: "dtv-play-chat-status" }, uiMessage("play.chat.loading")) : null,
    state === null ? null : h8(
      "div",
      { className: "dtv-play-chat-list" },
      state.greeting === null && state.importBinding !== null ? null : h8(Greeting, {
        greeting: state.greeting,
        busy: greetingBusy,
        change: changeGreeting,
        footer: state.importBinding === null ? importControls : null
      }),
      ...state.turns.map((turn) => h8(Turn, {
        key: turn.id,
        turn,
        playthrough,
        playClient,
        openSession,
        running,
        onChanged: () => setRevision((value) => value + 1),
        onError: setError
      })),
      state.importBinding === null ? null : importControls,
      ...liveTurns.map((turn) => h8(Turn, { key: turn.id, turn })),
      state.greeting === null && state.turns.length === 0 && liveTurns.length === 0 && !running ? h8("p", { className: "dtv-play-chat-status" }, uiMessage("play.chat.empty")) : null,
      liveTurns.length === 0 && running ? h8("p", { className: "dtv-play-chat-running" }, uiMessage("play.chat.thinking")) : null,
      h8("span", { ref: bottomAnchor, "aria-hidden": true })
    )
  );
}

// packages/client/src/play/sidebar.js
var import_react11 = require("react");

// packages/client/src/play/io-menu.js
var import_react10 = require("react");

// packages/client/src/play/export.js
function rootSessionId5(playthrough, timeline) {
  const root = playthrough?.ext?.pmpDshTavern?.rootSessionId;
  if (typeof root === "string" && root !== "") return root;
  for (const node of timeline?.nodes ?? []) {
    const variant = node.variants?.find((item) => item.id === node.adoptedVariantId);
    if (typeof variant?.sessionId === "string") return variant.sessionId;
  }
  return null;
}
function allSessionIds(timeline) {
  const result = /* @__PURE__ */ new Set();
  for (const node of timeline?.nodes ?? []) {
    for (const variant of node.variants ?? []) result.add(variant.sessionId);
  }
  return [...result];
}
async function loadMessages2(client, sessionIds, concurrency = 4) {
  const result = {};
  let cursor = 0;
  const worker = async () => {
    while (cursor < sessionIds.length) {
      const sessionId = sessionIds[cursor];
      cursor += 1;
      result[sessionId] = await client.getMessages(sessionId);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, sessionIds.length) }, worker));
  return result;
}
function normalizeImportContext(value) {
  if (value === null) return null;
  return {
    schemaVersion: value?.schemaVersion ?? 1,
    greeting: typeof value?.greeting === "string" ? value.greeting : null,
    qa: Array.isArray(value?.qa) ? value.qa.map((item) => ({
      user: typeof item?.user === "string" ? item.user : "",
      assistant: typeof item?.assistant === "string" ? item.assistant : ""
    })) : [],
    source: value?.source ?? null
  };
}
function selectedGreeting(selectionResponse, characterResponse) {
  const selection = selectionResponse?.selection;
  const character = characterResponse?.character;
  if (character?.id !== selection?.characterCardId) return null;
  const options = characterGreetingOptions(character);
  const index = Number(selection.character?.greetingIndex ?? 0);
  const option = options.find((item) => item.index === index) ?? options[0];
  return option?.text ? option.text : null;
}
async function loadPlaythroughExport(client, playthrough) {
  const timeline = await client.getTimeline(playthrough);
  const sessionIds = allSessionIds(timeline);
  const messagesBySession = await loadMessages2(client, sessionIds);
  const root = rootSessionId5(playthrough, timeline);
  const importContext = root === null ? null : normalizeImportContext((await loadPlaythroughImportContext(client, root, playthrough, timeline)).document);
  const selectionResponse = root === null ? null : await client.getCharacterSelection(root);
  const characterId = selectionResponse?.selection?.characterCardId;
  const characterResponse = typeof characterId === "string" && characterId !== "" ? await client.getCharacter(characterId) : null;
  const timelineTurns = projectTimelineQa(timeline, messagesBySession);
  const importedTurns = (importContext?.qa ?? []).map((qa, index) => ({
    id: `import-${index}`,
    imported: true,
    hidden: false,
    userText: qa.user,
    assistantText: qa.assistant,
    originalAssistantText: qa.assistant
  }));
  const turns = [...importedTurns, ...timelineTurns];
  const hasImportedDisplay = importedTurns.length > 0 || (importContext?.greeting ?? "") !== "";
  const greeting = (importContext?.greeting ?? "") !== "" ? importContext.greeting : hasImportedDisplay ? null : selectedGreeting(selectionResponse, characterResponse);
  const [regexDocument, active] = await Promise.all([
    typeof client.getFile === "function" ? getRegexDocument(client) : { schemaVersion: 1, rules: [] },
    root !== null && typeof client.getActive === "function" ? client.getActive(root) : null
  ]);
  const bindings = {
    presetId: active?.selection?.presetId ?? null,
    characterId: characterId ?? active?.selection?.characterCardId ?? null
  };
  const presetResponse = typeof bindings.presetId === "string" && bindings.presetId !== "" && typeof client.getPreset === "function" ? await client.getPreset(bindings.presetId) : null;
  const rules = [
    ...regexDocument.rules,
    ...resourceRegexRules(presetResponse?.preset ?? presetResponse, {
      kind: "preset",
      resourceId: bindings.presetId
    }),
    ...resourceRegexRules(characterResponse?.character ?? characterResponse, {
      kind: "character",
      resourceId: bindings.characterId
    })
  ];
  const render = (text2, target) => applyDisplayRegex(text2, rules, bindings, target).text;
  return {
    playthrough,
    timeline,
    messagesBySession,
    turns,
    displayTurns: turns.map((turn) => ({
      ...turn,
      userText: render(turn.userText, "user"),
      assistantText: render(turn.assistantText, "assistant")
    })),
    character: characterResponse?.character ?? null,
    importContext,
    greeting,
    displayGreeting: greeting === null ? null : render(greeting, "assistant"),
    exportedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function escapeHtml2(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function staticHtmlExport(snapshot) {
  const title = snapshot.playthrough.title || snapshot.character?.name || snapshot.playthrough.id;
  const rows = (snapshot.displayTurns ?? snapshot.turns).filter((turn) => !turn.hidden).map((turn) => `
    <article class="turn">
      <div class="user rich">${renderRichTextHtml(turn.userText)}</div>
      <div class="assistant rich">${renderRichTextHtml(turn.assistantText)}</div>
    </article>`).join("");
  const displayGreeting = snapshot.displayGreeting ?? snapshot.greeting;
  const greeting = displayGreeting === null || displayGreeting === void 0 ? "" : `<div class="assistant greeting rich">${renderRichTextHtml(displayGreeting)}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml2(title)}</title><style>body{max-width:800px;margin:32px auto;padding:0 18px;background:#101216;color:#e8eaf0;font:15px/1.65 system-ui}.turn{display:flex;flex-direction:column;gap:10px;margin:24px 0}.user,.assistant{padding:12px 15px;border-radius:14px}.user{align-self:flex-end;background:#1c3651}.assistant{align-self:flex-start;background:#24262d}.greeting{margin:24px 0}.rich>:first-child{margin-top:0}.rich>:last-child{margin-bottom:0}.rich pre{max-width:100%;overflow:auto;white-space:pre-wrap}.rich img,.rich video{max-width:100%;height:auto}.rich table{display:block;max-width:100%;overflow:auto;border-collapse:collapse}.rich th,.rich td{padding:6px 9px;border:1px solid #555}</style></head><body><h1>${escapeHtml2(title)}</h1>${greeting}${rows}</body></html>`;
}
function sillyTavernJsonlExport(snapshot) {
  const characterName = snapshot.character?.data?.name || snapshot.character?.name || "Assistant";
  const lines = [JSON.stringify({
    user_name: "User",
    character_name: characterName,
    create_date: snapshot.exportedAt,
    chat_metadata: { source: "pmp-dsh-tavern", playthroughId: snapshot.playthrough.id }
  })];
  if (snapshot.greeting !== null) {
    lines.push(JSON.stringify({ name: characterName, is_user: false, is_name: true, mes: snapshot.greeting }));
  }
  for (const turn of snapshot.turns) {
    if (turn.hidden) continue;
    lines.push(JSON.stringify({ name: "User", is_user: true, is_name: true, mes: turn.userText }));
    lines.push(JSON.stringify({ name: characterName, is_user: false, is_name: true, mes: turn.originalAssistantText }));
  }
  return `${lines.join("\n")}
`;
}
function portableBundleExport(snapshot) {
  return JSON.stringify({
    kind: "pmp-dsh-tavern-playthrough",
    schemaVersion: 1,
    exportedAt: snapshot.exportedAt,
    playthrough: snapshot.playthrough,
    timeline: snapshot.timeline,
    messagesBySession: snapshot.messagesBySession,
    resources: {
      characterId: snapshot.character?.id ?? null,
      greeting: snapshot.greeting,
      importContext: snapshot.importContext
    }
  }, null, 2);
}
function playthroughExportDocument(snapshot, format) {
  if (format === "html") return { extension: "html", mime: "text/html;charset=utf-8", content: staticHtmlExport(snapshot) };
  if (format === "st") return { extension: "jsonl", mime: "application/x-ndjson;charset=utf-8", content: sillyTavernJsonlExport(snapshot) };
  if (format === "bundle") return { extension: "json", mime: "application/json;charset=utf-8", content: portableBundleExport(snapshot) };
  throw new TypeError(`Unknown export format ${format}`);
}

// packages/client/src/play/io-menu.js
var h9 = createLocalizedElement(import_react10.createElement);
var css8 = `
.dtv-play-io{position:relative;display:inline-flex}.dtv-play-io-trigger{width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}.dtv-play-io-trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtv-play-io-menu{position:absolute;z-index:30;left:0;bottom:calc(100% + 6px);min-width:210px;padding:6px;border:1px solid var(--dsw-alias-border-subtle);border-radius:11px;background:var(--dsw-alias-bg-layer-1,#181a20);box-shadow:0 12px 30px #0008;display:flex;flex-direction:column;gap:2px}.dtv-play-io[data-placement=sidebar] .dtv-play-io-menu{left:auto;right:0;bottom:auto;top:calc(100% + 4px);width:max-content;min-width:0;max-width:168px}.dtv-play-io[data-placement=sidebar] .dtv-play-io-item{white-space:nowrap}
.dtv-play-io-item{min-height:34px;border:0;border-radius:8px;padding:6px 9px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;text-align:left;cursor:pointer}.dtv-play-io-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-io-item:disabled{opacity:.45;cursor:default}.dtv-play-io-error{max-width:240px;margin:3px 5px;color:var(--dsw-alias-state-error);font-size:10px;overflow-wrap:anywhere}
`;
function installStyles2() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-io"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-play-io`;
  style.textContent = css8;
  document.head.append(style);
}
function safeFilename(value) {
  const normalized = String(value ?? "playthrough").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim();
  return normalized === "" ? "playthrough" : normalized.slice(0, 100);
}
function downloadDocument(playthrough, document2) {
  const blob = new Blob([document2.content], { type: document2.mime });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFilename(playthrough.title || playthrough.id)}.${document2.extension}`;
  anchor.style.display = "none";
  window.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  queueMicrotask(() => URL.revokeObjectURL(url));
}
function PlayIoMenu({ playClient, playthrough, trigger = "+", placement = "composer" }) {
  installStyles2();
  const root = (0, import_react10.useRef)(null);
  const [open, setOpen] = (0, import_react10.useState)(false);
  const [busy, setBusy] = (0, import_react10.useState)(false);
  const [error, setError] = (0, import_react10.useState)("");
  (0, import_react10.useEffect)(() => {
    if (!open) return void 0;
    const close = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    window.document.addEventListener("pointerdown", close);
    return () => window.document.removeEventListener("pointerdown", close);
  }, [open]);
  const exportAs = async (format) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const snapshot = await loadPlaythroughExport(playClient, playthrough);
      downloadDocument(playthrough, playthroughExportDocument(snapshot, format));
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const rename = async () => {
    if (busy) return;
    const title = window.prompt(unwrapText(uiMessage("play.io.renamePrompt")), playthrough.title ?? "");
    if (title === null) return;
    if (title.trim() === "" || title.trim().length > 120) {
      setError(unwrapText(uiMessage("play.io.renameInvalid")));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await renamePlaythrough(playClient, playthrough, title);
      window.dispatchEvent(new Event("pmp-dsh-tavern:refresh"));
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  return h9(
    "div",
    { ref: root, className: "dtv-play-io", "data-placement": placement },
    h9("button", {
      type: "button",
      className: "dtv-play-io-trigger",
      title: uiMessage("play.io.menu"),
      "aria-label": uiMessage("play.io.menu"),
      "aria-expanded": open,
      onClick: (event) => {
        event.stopPropagation();
        setOpen((value) => !value);
      }
    }, rawText(trigger)),
    !open ? null : h9(
      "div",
      { className: "dtv-play-io-menu" },
      h9("button", { type: "button", className: "dtv-play-io-item", disabled: busy, onClick: rename }, uiMessage("play.io.rename")),
      h9("button", { type: "button", className: "dtv-play-io-item", disabled: busy, onClick: () => exportAs("html") }, uiMessage("play.io.exportHtml")),
      h9("button", { type: "button", className: "dtv-play-io-item", disabled: busy, onClick: () => exportAs("st") }, uiMessage("play.io.exportSt")),
      h9("button", { type: "button", className: "dtv-play-io-item", disabled: busy, onClick: () => exportAs("bundle") }, uiMessage("play.io.exportBundle")),
      error === "" ? null : h9("p", { className: "dtv-play-io-error" }, rawText(error))
    )
  );
}

// packages/client/src/play/sidebar.js
var h10 = createLocalizedElement(import_react11.createElement);
var css9 = `
.dtv-play-sidebar{height:100%;min-height:0;box-sizing:border-box;display:flex;flex-direction:column;gap:4px;padding:6px 7px 10px;overflow:auto;zoom:var(--dtv-ui-scale,1);color:var(--dsw-alias-label-primary)}
.dtv-play-section{display:flex;flex-direction:column;gap:2px;border-radius:10px}.dtv-play-section[data-open=true]{padding-bottom:3px}
.dtv-play-group,.dtv-play-row{width:100%;box-sizing:border-box;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:7px}.dtv-play-group:hover,.dtv-play-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtv-play-row-line{display:flex;align-items:center;gap:2px}.dtv-play-row-line>.dtv-play-row{min-width:0;flex:1}.dtv-play-row-line>.dtv-play-io{flex:none}
.dtv-play-group{min-height:38px;padding:4px 6px;font-size:12px;font-weight:680}.dtv-play-row{min-height:32px;padding:4px 7px 4px 27px;font-size:11px}.dtv-play-row[data-active=true]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-specific-tip));font-weight:650}.dtv-play-row:disabled{cursor:default;opacity:.55}
.dtv-play-group-line{display:flex;align-items:center;gap:3px}.dtv-play-group-line>.dtv-play-group{min-width:0;flex:1}.dtv-play-create{width:30px;height:30px;flex:none;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}.dtv-play-create:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-create:disabled{cursor:default;opacity:.5}
.dtv-play-chevron{width:10px;flex:none;text-align:center;color:var(--dsw-alias-label-tertiary)}.dtv-play-title{min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dtv-play-count{flex:none;border-radius:9px;padding:1px 6px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-tertiary);font-size:9px}
.dtv-play-avatar{position:relative;width:25px;height:25px;flex:none;border-radius:50%;overflow:hidden;background:var(--dsw-specific-tip);display:grid;place-items:center;color:var(--dsw-alias-label-secondary);font-size:10px}.dtv-play-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.dtv-play-subgroup{display:flex;flex-direction:column;gap:1px}.dtv-play-subgroup>.dtv-play-group{min-height:30px;padding-left:25px;font-size:10px;font-weight:620;color:var(--dsw-alias-label-secondary)}
.dtv-play-empty,.dtv-play-status{margin:0;padding:7px 9px;font-size:10px;line-height:1.45;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}.dtv-play-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtv-play-rail{height:100%;box-sizing:border-box;padding:7px;display:flex;flex-direction:column;align-items:center;gap:7px;overflow:auto;zoom:var(--dtv-ui-scale,1)}.dtv-play-rail-button{width:38px;height:38px;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;display:grid;place-items:center}.dtv-play-rail-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-rail-button .dtv-play-avatar{width:30px;height:30px}
`;
function installStyles3() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-sidebar"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-play-sidebar`;
  style.textContent = css9;
  document.head.append(style);
}
function useUiScale() {
  const [scale, setScale] = (0, import_react11.useState)(() => getClientUiSettings().scale);
  (0, import_react11.useEffect)(() => {
    const onSettings = (event) => {
      const next = Number(event.detail?.scale);
      if (Number.isFinite(next)) setScale(next);
    };
    window.addEventListener(CLIENT_UI_SETTINGS_EVENT, onSettings);
    return () => window.removeEventListener(CLIENT_UI_SETTINGS_EVENT, onSettings);
  }, []);
  return scale;
}
function Avatar({ character }) {
  const fallback = (character.name || character.id).slice(0, 1).toUpperCase();
  return h10(
    "span",
    { className: "dtv-play-avatar", "aria-hidden": "true" },
    rawText(fallback),
    h10("img", {
      src: `${API_V1}/characters/${encodeURIComponent(character.id)}/png`,
      alt: "",
      onError: (event) => {
        event.currentTarget.hidden = true;
      }
    })
  );
}
function Rail({ model, scale, expandSidebar }) {
  return h10(
    "div",
    { className: "dtv-play-rail", style: { "--dtv-ui-scale": scale } },
    ...model.characters.map((character) => h10("button", {
      key: character.id,
      type: "button",
      className: "dtv-play-rail-button",
      title: rawText(character.name),
      "aria-label": rawText(character.name),
      onClick: expandSidebar
    }, h10(Avatar, { character }))),
    h10("button", {
      type: "button",
      className: "dtv-play-rail-button",
      title: uiMessage("play.sidebar.other"),
      "aria-label": uiMessage("play.sidebar.other"),
      onClick: expandSidebar
    }, "\u2630")
  );
}
function CharacterGroup({ character, collapsed, unassignedOpen, creating, createDisabled, toggle, toggleUnassigned, createPlaythrough, openPlaythrough, openSession, playClient }) {
  const count = character.playthroughs.length + character.unassigned.length;
  return h10(
    "section",
    { className: "dtv-play-section", "data-open": !collapsed },
    h10(
      "div",
      { className: "dtv-play-group-line" },
      h10(
        "button",
        {
          type: "button",
          className: "dtv-play-group",
          "aria-expanded": !collapsed,
          onClick: toggle
        },
        h10("span", { className: "dtv-play-chevron", "aria-hidden": "true" }, collapsed ? "\u203A" : "\u2304"),
        h10(Avatar, { character }),
        h10("span", { className: "dtv-play-title" }, rawText(character.name)),
        h10("span", { className: "dtv-play-count" }, rawText(String(count)))
      ),
      h10("button", {
        type: "button",
        className: "dtv-play-create",
        disabled: createDisabled,
        title: uiMessage("play.sidebar.newPlaythrough", { name: character.name }),
        "aria-label": uiMessage("play.sidebar.newPlaythrough", { name: character.name }),
        onClick: () => createPlaythrough(character)
      }, creating ? "\u2026" : "+")
    ),
    collapsed ? null : character.playthroughs.length === 0 && character.unassigned.length === 0 ? h10("p", { className: "dtv-play-empty" }, uiMessage("play.sidebar.noPlaythroughs")) : null,
    collapsed ? null : character.playthroughs.map((playthrough) => h10(
      "div",
      {
        key: playthrough.id,
        className: "dtv-play-row-line"
      },
      h10(
        "button",
        {
          type: "button",
          className: "dtv-play-row",
          "data-active": playthrough.active,
          disabled: playthrough.missing,
          title: playthrough.missing ? uiMessage("play.sidebar.sessionMissing") : rawText(playthrough.title),
          onClick: () => openPlaythrough(playthrough)
        },
        h10("span", { className: "dtv-play-chevron", "aria-hidden": "true" }, "\u25C6"),
        h10("span", { className: "dtv-play-title" }, rawText(playthrough.title))
      ),
      h10(PlayIoMenu, { playClient, playthrough, openSession, trigger: "\u22EF", placement: "sidebar" })
    )),
    collapsed || character.unassigned.length === 0 ? null : h10(
      "div",
      { className: "dtv-play-subgroup" },
      h10(
        "button",
        {
          type: "button",
          className: "dtv-play-group",
          "aria-expanded": unassignedOpen,
          onClick: toggleUnassigned
        },
        h10("span", { className: "dtv-play-chevron", "aria-hidden": "true" }, unassignedOpen ? "\u2304" : "\u203A"),
        h10("span", { className: "dtv-play-title" }, uiMessage("play.sidebar.unassigned")),
        h10("span", { className: "dtv-play-count" }, rawText(String(character.unassigned.length)))
      ),
      unassignedOpen ? character.unassigned.map((session) => h10(
        "button",
        {
          key: session.id,
          type: "button",
          className: "dtv-play-row",
          "data-active": session.active,
          onClick: () => openSession(session.id)
        },
        h10("span", { className: "dtv-play-chevron", "aria-hidden": "true" }, "\u2022"),
        h10("span", { className: "dtv-play-title" }, rawText(session.title))
      )) : null
    )
  );
}
function PlayWorkspaceBrowser({
  wide = true,
  expandSidebar,
  useSessions,
  useWorkspaces,
  playClient,
  openSession
}) {
  installStyles3();
  const scale = useUiScale();
  const sessionIds = useSessions((state) => state.ids);
  const sessions = useSessions((state) => state.byId);
  const currentId = useSessions((state) => state.current ?? null);
  const workspaceItems = useWorkspaces((state) => state.items);
  const archivedSessionIds = useWorkspaces((state) => state.archivedSessionIds);
  const cache = (0, import_react11.useRef)(null);
  if (cache.current === null) cache.current = new SessionCharacterBindingCache();
  const creator = (0, import_react11.useRef)(null);
  if (creator.current?.client !== playClient) {
    creator.current = { client: playClient, controller: createPlaythroughController(playClient) };
  }
  const [creatingCharacterId, setCreatingCharacterId] = (0, import_react11.useState)(null);
  const [revision, setRevision] = (0, import_react11.useState)(0);
  const [resources, setResources] = (0, import_react11.useState)(null);
  const [sessionCharacters, setSessionCharacters] = (0, import_react11.useState)({});
  const [status, setStatus] = (0, import_react11.useState)(null);
  const [collapsedCharacters, setCollapsedCharacters] = (0, import_react11.useState)(() => /* @__PURE__ */ new Set());
  const [expandedUnassigned, setExpandedUnassigned] = (0, import_react11.useState)(() => /* @__PURE__ */ new Set());
  const [otherOpen, setOtherOpen] = (0, import_react11.useState)(false);
  (0, import_react11.useEffect)(() => {
    const refresh = () => {
      cache.current.clear();
      setRevision((value) => value + 1);
    };
    window.addEventListener(CLIENT_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, refresh);
  }, []);
  (0, import_react11.useEffect)(() => {
    let active = true;
    setStatus(null);
    loadPlaySidebarResources(playClient).then((next) => {
      if (active) setResources(next);
    }).catch((reason) => {
      if (!active) return;
      setResources(null);
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) });
    });
    return () => {
      active = false;
    };
  }, [playClient, revision]);
  const rpIds = resources === null ? [] : [...sessionIdsInRpWorkspace({
    workspace: resources.workspace,
    workspaceItems,
    sessions
  })];
  const rpKey = rpIds.join("\0");
  (0, import_react11.useEffect)(() => {
    let active = true;
    if (resources === null) {
      setSessionCharacters({});
      return () => {
        active = false;
      };
    }
    loadSessionCharacterBindings(playClient, rpIds, { cache: cache.current }).then((next) => {
      if (active) setSessionCharacters(next);
    });
    return () => {
      active = false;
    };
  }, [playClient, resources, rpKey, revision]);
  const model = projectPlaySidebar({
    workspace: resources?.workspace,
    workspaceItems,
    characters: resources?.characters,
    catalog: resources?.catalog,
    timelines: resources?.timelines,
    sessions,
    sessionIds,
    archivedSessionIds,
    currentId,
    sessionCharacters
  });
  const bindWorkspace = async (workspace) => {
    if (requiresSystemWorkspaceConfirmation(workspace.path) && !window.confirm(unwrapText(uiMessage("play.sidebar.systemWorkspaceConfirm", { path: workspace.path })))) return;
    setStatus(null);
    try {
      await playClient.putWorkspace(workspace.path);
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
    } catch (reason) {
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) });
    }
  };
  const createPlaythrough = async (character) => {
    if (creatingCharacterId !== null) return;
    setCreatingCharacterId(character.id);
    setStatus(null);
    try {
      const result = await creator.current.controller.create({
        character,
        selectionFromSessionId: sourceSessionIdForCharacter(character)
      });
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
      openSession(result.sessionId);
    } catch (reason) {
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) });
    } finally {
      setCreatingCharacterId(null);
    }
  };
  const openPlaythrough = async (playthrough) => {
    setStatus(null);
    try {
      const focus = await playClient.getFocus(playthrough);
      const target = typeof focus.sessionId === "string" ? focus.sessionId : playthrough.rootSessionId;
      if (typeof target !== "string" || !playthrough.sessionIds.includes(target)) {
        setStatus({ key: "play.sidebar.sessionMissing" });
        return;
      }
      openSession(target);
    } catch (reason) {
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) });
    }
  };
  if (wide === false) return h10(Rail, { model, scale, expandSidebar });
  const toggleSet = (setter, id) => setter((current2) => {
    const next = new Set(current2);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  return h10(
    "div",
    { className: "dtv-play-sidebar", style: { "--dtv-ui-scale": scale } },
    resources === null && status === null ? h10("p", { className: "dtv-play-status" }, uiMessage("play.sidebar.loading")) : null,
    resources?.workspace?.selected === false ? h10(
      "section",
      { className: "dtv-play-section", "data-open": true },
      h10("p", { className: "dtv-play-status" }, uiMessage("play.sidebar.workspaceMissing")),
      ...workspaceItems.map((workspace) => {
        const label = uiMessage("play.sidebar.selectWorkspace", { name: workspace.title });
        return h10(
          "button",
          {
            key: workspace.workspaceId,
            type: "button",
            className: "dtv-play-row",
            title: label,
            "aria-label": label,
            onClick: () => bindWorkspace(workspace)
          },
          h10("span", { className: "dtv-play-chevron", "aria-hidden": "true" }, "\u25C7"),
          h10("span", { className: "dtv-play-title" }, rawText(workspace.title))
        );
      })
    ) : null,
    status === null ? null : h10("p", { className: "dtv-play-status", "data-error": true }, status.key ? uiMessage(status.key) : rawText(status.message)),
    (resources?.diagnostics.length ?? 0) === 0 ? null : h10("p", { className: "dtv-play-status", "data-error": true }, uiMessage("play.sidebar.timelineErrors", { count: resources.diagnostics.length })),
    ...(resources?.diagnostics ?? []).map((diagnostic) => h10("p", {
      key: diagnostic.playthroughId,
      className: "dtv-play-status",
      "data-error": true
    }, rawText(`${diagnostic.path}: ${diagnostic.message}`))),
    resources !== null && model.characters.length === 0 ? h10("p", { className: "dtv-play-empty" }, uiMessage("play.sidebar.noCharacters")) : null,
    ...model.characters.map((character) => h10(CharacterGroup, {
      key: character.id,
      character,
      collapsed: collapsedCharacters.has(character.id),
      unassignedOpen: expandedUnassigned.has(character.id),
      creating: creatingCharacterId === character.id,
      createDisabled: !model.workspaceReady || creatingCharacterId !== null,
      createPlaythrough,
      playClient,
      toggle: () => toggleSet(setCollapsedCharacters, character.id),
      toggleUnassigned: () => toggleSet(setExpandedUnassigned, character.id),
      openPlaythrough,
      openSession
    })),
    h10(
      "section",
      { className: "dtv-play-section", "data-open": otherOpen },
      h10(
        "button",
        {
          type: "button",
          className: "dtv-play-group",
          "aria-expanded": otherOpen,
          onClick: () => setOtherOpen((value) => !value)
        },
        h10("span", { className: "dtv-play-chevron", "aria-hidden": "true" }, otherOpen ? "\u2304" : "\u203A"),
        h10("span", { className: "dtv-play-title" }, uiMessage("play.sidebar.other")),
        h10("span", { className: "dtv-play-count" }, rawText(String(model.otherSessions.length)))
      ),
      otherOpen && model.otherSessions.length === 0 ? h10("p", { className: "dtv-play-empty" }, uiMessage("play.sidebar.otherEmpty")) : null,
      otherOpen ? model.otherSessions.map((session) => h10(
        "button",
        {
          key: session.id,
          type: "button",
          className: "dtv-play-row",
          "data-active": session.active,
          "data-kind": session.kind,
          onClick: () => openSession(session.id)
        },
        h10("span", { className: "dtv-play-chevron", "aria-hidden": "true" }, "\u2022"),
        h10("span", { className: "dtv-play-title" }, rawText(session.title))
      )) : null
    )
  );
}

// packages/client/src/play/notice.js
var import_react12 = require("react");
var h11 = createLocalizedElement(import_react12.createElement);
var css10 = `
.dtv-play-unbound-notice{box-sizing:border-box;width:100%;margin:0;padding:7px 10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warning,#d79921) 34%,transparent);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-state-warning,#d79921) 8%,transparent);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.45}
.dtv-play-opening-dock{box-sizing:border-box;width:100%;min-width:0;flex:none;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block));color:var(--dsw-alias-label-primary);box-shadow:0 4px 18px color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent)}
.dtv-play-opening-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:12px}.dtv-play-opening-name{min-width:0;overflow:hidden;font-weight:650;text-overflow:ellipsis;white-space:nowrap}.dtv-play-opening-index{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px}
.dtv-play-opening-body{box-sizing:border-box;max-height:45dvh;overflow-x:hidden;overflow-y:auto;padding:13px 15px;font-size:14px;line-height:1.65;overflow-wrap:anywhere}.dtv-play-opening-body-empty{min-height:34px}.dtv-play-opening-body>:first-child{margin-top:0}.dtv-play-opening-body>:last-child{margin-bottom:0}.dtv-play-opening-body p,.dtv-play-opening-body ul,.dtv-play-opening-body ol,.dtv-play-opening-body blockquote,.dtv-play-opening-body pre,.dtv-play-opening-body table{margin:0 0 .85em}.dtv-play-opening-body ul,.dtv-play-opening-body ol{padding-left:1.5em}.dtv-play-opening-body pre,.dtv-play-opening-body table{max-width:100%;overflow:auto}.dtv-play-opening-body img,.dtv-play-opening-body video{max-width:100%;height:auto}
.dtv-play-opening-actions{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:8px;padding:8px 10px;border-top:1px solid var(--dsw-alias-border-l2)}.dtv-play-opening-actions>.dtv-play-opening-button:first-child{justify-self:start}.dtv-play-opening-actions>.dtv-play-opening-button:last-child{justify-self:end}.dtv-play-opening-actions>.dtv-play-import-controls{margin:0}.dtv-play-opening-button{min-width:0;padding:6px 10px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}.dtv-play-opening-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-opening-button:disabled{opacity:.4;cursor:default}.dtv-play-opening-error{margin:0;padding:7px 12px;border-top:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-state-error);font-size:11px;line-height:1.45}
`;
function installStyles4() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-notice"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-play-notice`;
  style.textContent = css10;
  document.head.append(style);
}
function PlaySessionDock({ session, useSessions, playClient }) {
  installStyles4();
  installPlayChatStyles();
  const sessionId = session?.sessionId ?? null;
  const sessionBlank = session?.blank === true;
  const composerPhase = session?.composerPhase;
  const summary = useSessions((state) => sessionId === null ? null : state.byId?.[sessionId] ?? null);
  const [revision, setRevision] = (0, import_react12.useState)(0);
  const [content, setContent] = (0, import_react12.useState)(null);
  const [greetingBusy, setGreetingBusy] = (0, import_react12.useState)(false);
  const [error, setError] = (0, import_react12.useState)("");
  (0, import_react12.useEffect)(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(CLIENT_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, refresh);
  }, []);
  (0, import_react12.useEffect)(() => {
    let active = true;
    setContent((current2) => current2?.sessionId === sessionId && current2.kind === "opening" ? current2 : null);
    setError("");
    if (sessionId === null || summary === null) return () => {
      active = false;
    };
    Promise.all([
      playClient.getWorkspace(),
      playClient.getCharacterSelection(sessionId)
    ]).then(([workspace, selection]) => {
      if (!active) return;
      if (shouldShowUnboundNotice({ workspace, session: summary, selection })) {
        setContent({ kind: "unbound", sessionId });
        return;
      }
      if (!sessionBlank || composerPhase !== "blank") {
        setContent(null);
        return;
      }
      loadCurrentPlaythrough(playClient, summary).then((binding) => {
        if (!active) return;
        if (binding === null || (binding.timeline?.nodes?.length ?? 0) !== 0) {
          setContent(null);
          return;
        }
        loadChatState(playClient, sessionId, binding.playthrough).then((state) => {
          if (!active) return;
          setContent({
            kind: "opening",
            greeting: state.greeting,
            importBinding: state.importBinding,
            importMutable: state.importMutable,
            importTurns: state.turns.filter((turn) => turn.imported === true && turn.id !== "import-greeting").slice(-3),
            playthrough: binding.playthrough,
            sessionId
          });
        }, (reason) => {
          if (active) setError(reason instanceof Error ? reason.message : String(reason));
        });
      }, (reason) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      });
    }, (reason) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {
      active = false;
    };
  }, [composerPhase, playClient, revision, sessionBlank, sessionId, summary]);
  const changeGreeting = async (direction) => {
    if (content?.kind !== "opening" || greetingBusy || sessionId === null) return;
    const next = adjacentGreetingIndex(content.greeting, direction);
    if (next === null) return;
    setGreetingBusy(true);
    setError("");
    try {
      await playClient.putGreetingIndex(sessionId, next);
      setRevision((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setGreetingBusy(false);
    }
  };
  if (content?.sessionId !== sessionId) return null;
  if (content.kind === "unbound") {
    return h11("p", {
      className: "dtv-play-unbound-notice",
      role: "note"
    }, uiMessage("play.notice.unbound"));
  }
  if (content.kind !== "opening" || !sessionBlank || composerPhase !== "blank") return null;
  const greeting = content.greeting;
  const importTurns = content.importTurns ?? [];
  const options = greeting?.options ?? [];
  const multiple = options.length > 1;
  const position = greeting === null ? 0 : Math.max(0, options.findIndex((option) => option.index === greeting.index)) + 1;
  const importControls = h11(ImportControls, {
    playClient,
    playthrough: content.playthrough,
    binding: content.importBinding,
    locked: content.importMutable !== true,
    changed: () => setRevision((value) => value + 1),
    onError: setError
  });
  return h11(
    "section",
    {
      className: "dtv-play-opening-dock"
    },
    greeting === null ? null : h11(
      "header",
      { className: "dtv-play-opening-header" },
      h11("span", { className: "dtv-play-opening-name" }, rawText(greeting.characterName)),
      h11("span", { className: "dtv-play-opening-index" }, rawText(`${position} / ${options.length}`))
    ),
    importTurns.length > 0 ? h11(
      "div",
      { className: "dtv-play-opening-body dtv-play-chat-list" },
      ...importTurns.map((turn) => h11(
        "div",
        { key: turn.id, className: "dtv-play-chat-row" },
        turn.userText === "" ? null : h11(RichText, {
          className: "dtv-play-chat-bubble dtv-play-chat-user dtv-play-rich",
          text: turn.userText
        }),
        turn.assistantText === "" ? null : h11(RichText, {
          className: "dtv-play-chat-bubble dtv-play-chat-assistant dtv-play-rich",
          text: turn.assistantText
        })
      ))
    ) : greeting === null ? h11("div", { className: "dtv-play-opening-body dtv-play-opening-body-empty", "aria-hidden": true }) : h11(RichText, { className: "dtv-play-opening-body", text: greeting.text }),
    error === "" ? null : h11("p", { className: "dtv-play-opening-error", role: "alert" }, rawText(error)),
    h11(
      "footer",
      { className: "dtv-play-opening-actions" },
      h11("button", {
        type: "button",
        className: "dtv-play-opening-button",
        disabled: greetingBusy || !multiple,
        onClick: () => changeGreeting("previous")
      }, uiMessage("play.chat.previousGreeting")),
      importControls,
      h11("button", {
        type: "button",
        className: "dtv-play-opening-button",
        disabled: greetingBusy || !multiple,
        onClick: () => changeGreeting("next")
      }, uiMessage("play.chat.nextGreeting"))
    )
  );
}

// packages/client/src/play/view-default.js
var import_react13 = require("react");
function defaultViewTarget(selectedView, targetViewId) {
  return selectedView === null || selectedView === void 0 ? targetViewId : null;
}
function DefaultConversationViewAdapter({ useStore, actions, targetViewId, complete }) {
  const hasStore = typeof useStore === "function";
  const selectedView = hasStore ? useStore((state) => state.view) : void 0;
  (0, import_react13.useLayoutEffect)(() => {
    const target = defaultViewTarget(selectedView, targetViewId);
    if (hasStore && target !== null && typeof actions?.setView === "function") {
      try {
        actions.setView(target);
      } catch {
      }
    }
    queueMicrotask(complete);
  }, [actions, complete, hasStore, selectedView, targetViewId]);
  return null;
}

// packages/client/src/play/occupancy.js
var PLAY_SLOT_PRIORITY = -100;
var PLAY_VIEW_ID = "rp";
var PLAY_VIEW_ORDER = -100;
var PLAY_DEFAULT_VIEW_ADAPTER_ID = "pmp-dsh-tavern-default-rp-view";
var PLAY_DEFAULT_VIEW_ATTEMPT_LIMIT = 256;
function findNativeChatStore(slots) {
  if (typeof slots?.entries !== "function") return void 0;
  const entries2 = slots.entries("conversation.view");
  if (!Array.isArray(entries2) && entries2?.[Symbol.iterator] === void 0) return void 0;
  for (const entry of entries2) {
    if (entry?.options?.id === "chat" && entry.store !== void 0) return entry.store;
  }
  return void 0;
}
function installPlaySlotOccupancy(ctx, playClient) {
  let mode = "native";
  let declared = false;
  let disposeEntry = null;
  let disposeEffect = null;
  let noticeDeclared = false;
  let disposeNoticeEntry = null;
  let disposeNoticeEffect = null;
  let chatDeclared = false;
  let chatGeneration = 0;
  let disposeChatEntry = null;
  let disposeDefaultViewEntry = null;
  let defaultViewEntryKey = null;
  let disposeSessionSubscription = null;
  let refreshChatListener = null;
  let chatBinding = null;
  let pendingChatSignature = null;
  const completedDefaultViewAttempts = /* @__PURE__ */ new Set();
  const dropEntry = () => {
    const dispose = disposeEntry;
    disposeEntry = null;
    dispose?.();
  };
  const dropEffect = () => {
    const dispose = disposeEffect;
    disposeEffect = null;
    dispose?.();
    dropEntry();
  };
  const mount = () => {
    if (!declared || mode !== "play" || disposeEntry !== null) return;
    disposeEntry = ctx.slots.register({
      name: "sidebar.workspaces",
      priority: PLAY_SLOT_PRIORITY,
      inject: () => ({
        playClient,
        openSession: (sessionId) => ctx.sessions.open(sessionId)
      })
    }, PlayWorkspaceBrowser);
  };
  const reconcile = () => {
    dropEffect();
    if (!declared || mode !== "play") return;
    const effect = () => {
      mount();
      return dropEntry;
    };
    if (typeof ctx.effect === "function") {
      const dispose = ctx.effect(effect, "pmp-dsh-tavern:play-sidebar-shadow");
      disposeEffect = typeof dispose === "function" ? dispose : null;
    } else {
      disposeEffect = effect();
    }
  };
  const dropNoticeEntry = () => {
    const dispose = disposeNoticeEntry;
    disposeNoticeEntry = null;
    dispose?.();
  };
  const dropNoticeEffect = () => {
    const dispose = disposeNoticeEffect;
    disposeNoticeEffect = null;
    dispose?.();
    dropNoticeEntry();
  };
  const mountNotice = () => {
    if (!noticeDeclared || mode !== "play" || disposeNoticeEntry !== null) return;
    disposeNoticeEntry = ctx.slots.register({
      name: "conversation.input.dock",
      id: "pmp-dsh-tavern-session-dock",
      order: 90,
      inject: () => ({ playClient })
    }, PlaySessionDock);
  };
  const reconcileNotice = () => {
    dropNoticeEffect();
    if (!noticeDeclared || mode !== "play") return;
    const effect = () => {
      mountNotice();
      return dropNoticeEntry;
    };
    if (typeof ctx.effect === "function") {
      const dispose = ctx.effect(effect, "pmp-dsh-tavern:play-unbound-notice");
      disposeNoticeEffect = typeof dispose === "function" ? dispose : null;
    } else {
      disposeNoticeEffect = effect();
    }
  };
  const dropConversationEntry = () => {
    const dispose = disposeChatEntry;
    disposeChatEntry = null;
    dispose?.();
  };
  const dropDefaultViewEntry = () => {
    const dispose = disposeDefaultViewEntry;
    disposeDefaultViewEntry = null;
    defaultViewEntryKey = null;
    dispose?.();
  };
  const rememberDefaultViewAttempt = (key) => {
    completedDefaultViewAttempts.delete(key);
    completedDefaultViewAttempts.add(key);
    if (completedDefaultViewAttempts.size <= PLAY_DEFAULT_VIEW_ATTEMPT_LIMIT) return;
    completedDefaultViewAttempts.delete(completedDefaultViewAttempts.values().next().value);
  };
  const dropChatEntry = () => {
    dropDefaultViewEntry();
    dropConversationEntry();
    chatBinding = null;
  };
  const currentSession = () => {
    const snapshot = ctx.sessions?.list?.getSnapshot?.();
    const sessionId = snapshot?.current;
    if (typeof sessionId !== "string" || sessionId === "") return null;
    const session = snapshot.byId?.[sessionId];
    return session == null ? null : { ...session, id: session.id ?? sessionId };
  };
  const sessionSignature = (session) => `${session.id}\0${String(session.cwd ?? "")}`;
  const syncChatEntries = () => {
    if (chatBinding === null) return;
    if (!chatDeclared) {
      dropDefaultViewEntry();
      dropConversationEntry();
    } else if (disposeChatEntry === null) {
      disposeChatEntry = ctx.slots.register({
        name: "conversation.view",
        id: PLAY_VIEW_ID,
        order: PLAY_VIEW_ORDER,
        priority: PLAY_SLOT_PRIORITY,
        label: () => translate("play.chat.label"),
        inject: () => ({
          playClient,
          playthrough: chatBinding.playthrough,
          openSession: (sessionId) => ctx.sessions.open(sessionId)
        })
      }, MowanChatView);
    }
    const defaultViewKey = `${chatBinding.signature}\0${chatBinding.playthrough.path}`;
    if (chatDeclared && disposeDefaultViewEntry === null && !completedDefaultViewAttempts.has(defaultViewKey)) {
      const nativeChatStore = findNativeChatStore(ctx.slots);
      if (nativeChatStore !== void 0) {
        const complete = () => {
          rememberDefaultViewAttempt(defaultViewKey);
          if (defaultViewEntryKey === defaultViewKey) dropDefaultViewEntry();
        };
        defaultViewEntryKey = defaultViewKey;
        disposeDefaultViewEntry = ctx.slots.register({
          name: "conversation.input.dock",
          id: PLAY_DEFAULT_VIEW_ADAPTER_ID,
          order: -1e3,
          priority: PLAY_SLOT_PRIORITY,
          store: nativeChatStore,
          inject: () => ({
            targetViewId: PLAY_VIEW_ID,
            complete
          })
        }, DefaultConversationViewAdapter);
      }
    }
  };
  const reconcileChat = (force = false) => {
    if (force !== true) force = false;
    const session = currentSession();
    if (!chatDeclared || mode !== "play" || session === null) {
      chatGeneration += 1;
      pendingChatSignature = null;
      dropChatEntry();
      return;
    }
    const signature = sessionSignature(session);
    if (!force && chatBinding?.signature === signature) {
      syncChatEntries();
      return;
    }
    if (!force && pendingChatSignature === signature) return;
    chatGeneration += 1;
    const generation = chatGeneration;
    pendingChatSignature = signature;
    if (chatBinding !== null && chatBinding.signature !== signature) dropChatEntry();
    const sessionId = session.id;
    loadCurrentPlaythrough(playClient, session).then((match) => {
      if (generation === chatGeneration) pendingChatSignature = null;
      const latest = currentSession();
      if (generation !== chatGeneration || mode !== "play" || !chatDeclared || latest === null || sessionSignature(latest) !== signature) return;
      if (match === null) {
        dropChatEntry();
        return;
      }
      const samePlaythrough = chatBinding?.signature === signature && chatBinding.playthrough?.path === match.playthrough.path;
      if (!samePlaythrough) dropChatEntry();
      chatBinding = { signature, sessionId, playthrough: match.playthrough };
      syncChatEntries();
    }).catch(() => {
      if (generation === chatGeneration) pendingChatSignature = null;
    });
  };
  const stopChatObserver = () => {
    chatGeneration += 1;
    pendingChatSignature = null;
    dropChatEntry();
    const dispose = disposeSessionSubscription;
    disposeSessionSubscription = null;
    dispose?.();
    if (refreshChatListener !== null && typeof window !== "undefined") {
      window.removeEventListener(CLIENT_REFRESH_EVENT, refreshChatListener);
    }
    refreshChatListener = null;
  };
  const startChatObserver = () => {
    const list = ctx.sessions?.list;
    if (disposeSessionSubscription === null && typeof list?.subscribe === "function") {
      const dispose = list.subscribe(() => reconcileChat(false));
      disposeSessionSubscription = typeof dispose === "function" ? dispose : null;
    }
    if (refreshChatListener === null && typeof window !== "undefined") {
      refreshChatListener = () => reconcileChat(true);
      window.addEventListener(CLIENT_REFRESH_EVENT, refreshChatListener);
    }
    reconcileChat(false);
  };
  ctx.slots.inject("sidebar.workspaces", () => {
    declared = true;
    reconcile();
    return () => {
      declared = false;
      dropEffect();
    };
  });
  ctx.slots.inject("conversation.input.dock", () => {
    noticeDeclared = true;
    reconcileNotice();
    return () => {
      noticeDeclared = false;
      dropNoticeEffect();
    };
  });
  ctx.slots.inject("conversation.view", () => {
    chatDeclared = true;
    startChatObserver();
    return () => {
      chatDeclared = false;
      dropDefaultViewEntry();
      dropConversationEntry();
      stopChatObserver();
    };
  });
  return {
    setMode(next) {
      const normalized = next === "play" ? "play" : "native";
      if (mode === normalized) return;
      mode = normalized;
      reconcile();
      reconcileNotice();
      reconcileChat(true);
    }
  };
}

// packages/client/src/play/live.js
function errorMessage4(data, status) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.error?.message === "string") return data.error.message;
  return `HTTP ${status}`;
}
function createRequester(fetchImpl, root) {
  return async function request(method, path, body2) {
    const hasBody = body2 !== void 0;
    const response = await fetchImpl(`${root}${path}`, {
      method,
      headers: hasBody ? { "Content-Type": "application/json" } : void 0,
      body: hasBody ? JSON.stringify(body2) : void 0
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) {
      const error = new Error(errorMessage4(data, response.status));
      error.status = response.status;
      error.code = data?.code ?? data?.error?.code;
      error.diagnostics = data?.diagnostics ?? data?.error?.diagnostics ?? [];
      throw error;
    }
    return data;
  };
}
function fileContent(value, label) {
  if (typeof value?.content !== "string") throw new TypeError(`${label}: content must be a string`);
  return value.content;
}
var REVISION_PATTERN = /^[0-9a-f]{64}$/;
function fileRevision(value, label) {
  if (typeof value?.revision !== "string" || !REVISION_PATTERN.test(value.revision)) {
    throw new TypeError(`${label}: revision must be a 64-character lowercase SHA-256 hex string`);
  }
  return value.revision;
}
function pathQuery(path) {
  return `?path=${encodeURIComponent(path)}`;
}
function createLivePlayClient({
  fetchImpl = globalThis.fetch,
  apiRoot = API_V2,
  v1Root = API_V1
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl is required");
  const v1 = createRequester(fetchImpl, v1Root);
  const v2 = createRequester(fetchImpl, apiRoot);
  const managedRevisions = /* @__PURE__ */ new Map();
  function invalidateRevision(path) {
    managedRevisions.delete(path);
  }
  function expectedRevision(path) {
    return managedRevisions.has(path) ? managedRevisions.get(path) : null;
  }
  async function getCharacterSelection(sessionId) {
    const query = typeof sessionId === "string" && sessionId !== "" ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    return v1("GET", `/character-selection${query}`);
  }
  async function getJsonFile(path, normalize, label) {
    let response;
    try {
      response = await v2("GET", `/workspace/files${pathQuery(path)}`);
    } catch (error) {
      if (error?.status === 404 && error?.code === "PLAY_PATH_NOT_FOUND") {
        managedRevisions.set(path, null);
      }
      throw error;
    }
    const content = fileContent(response, label);
    const revision = fileRevision(response, label);
    const parsed = parseJsonDocument(content, normalize, label);
    managedRevisions.set(path, revision);
    return parsed;
  }
  async function putJsonFile(path, value, normalize, label) {
    const normalized = normalize(value, label);
    const body2 = {
      content: JSON.stringify(normalized),
      expectedRevision: expectedRevision(path)
    };
    try {
      const response = await v2("PUT", `/workspace/files${pathQuery(path)}`, body2);
      const revision = fileRevision(response, label);
      managedRevisions.set(path, revision);
    } catch (error) {
      if (error?.status === 409 && error?.code === "PLAY_FILE_REVISION_CONFLICT") {
        invalidateRevision(path);
      } else if (error instanceof TypeError) {
        invalidateRevision(path);
      }
      throw error;
    }
    return normalized;
  }
  function retryLimit(options) {
    const value = options?.maxRetries ?? options?.retries ?? 3;
    if (!Number.isSafeInteger(value) || value < 1 || value > 5) {
      throw new TypeError("maxRetries must be an integer from 1 to 5");
    }
    return value;
  }
  async function updateJsonFile({ getFresh, putFresh, mutator, options }) {
    if (typeof mutator !== "function") throw new TypeError("mutator must be a function");
    const maxRetries = retryLimit(options);
    for (let retry = 0; ; retry += 1) {
      const current2 = await getFresh();
      const next = await mutator(current2);
      try {
        return await putFresh(next);
      } catch (error) {
        if (error?.status !== 409 || error?.code !== "PLAY_FILE_REVISION_CONFLICT" || retry >= maxRetries) {
          throw error;
        }
      }
    }
  }
  return {
    mode: "live",
    apiRoot,
    chromeEventsUrl: `${apiRoot}/chrome/events`,
    v1Root,
    async getChrome() {
      return normalizeChrome(await v2("GET", "/chrome"));
    },
    async putChrome(mode) {
      return normalizeChrome(await v2("PUT", "/chrome", { mode }));
    },
    async getWorkspace() {
      return normalizeWorkspace(await v2("GET", "/workspace"));
    },
    async putWorkspace(path) {
      return normalizeWorkspace(await v2("PUT", "/workspace", { path }));
    },
    async createDirs(path) {
      return v2("POST", "/workspace/dirs", { path });
    },
    async listFiles(prefix = "") {
      return v2("GET", `/workspace/files?list=${encodeURIComponent(prefix)}`);
    },
    async getFile(path) {
      const response = await v2("GET", `/workspace/files${pathQuery(path)}`);
      return {
        path: response.path,
        content: fileContent(response, path),
        ...response.revision === void 0 ? {} : { revision: response.revision }
      };
    },
    async putFile(path, content, options = {}) {
      if (typeof content !== "string") throw new TypeError("content must be a string");
      const body2 = { content };
      if (options !== null && typeof options === "object" && Object.hasOwn(options, "expectedRevision")) {
        body2.expectedRevision = options.expectedRevision;
      }
      return v2("PUT", `/workspace/files${pathQuery(path)}`, body2);
    },
    getCatalog() {
      return getJsonFile("catalog.json", normalizeCatalog, "catalog");
    },
    putCatalog(catalog2) {
      return putJsonFile("catalog.json", catalog2, normalizeCatalog, "catalog");
    },
    updateCatalog(mutator, options) {
      return updateJsonFile({
        getFresh: async () => {
          try {
            return await getJsonFile("catalog.json", normalizeCatalog, "catalog");
          } catch (error) {
            if (error?.status === 404 && error?.code === "PLAY_PATH_NOT_FOUND") {
              return { playthroughs: [] };
            }
            throw error;
          }
        },
        putFresh: (value) => putJsonFile("catalog.json", value, normalizeCatalog, "catalog"),
        mutator,
        options
      });
    },
    getTimeline(playthrough) {
      const path = timelinePath(playthrough);
      return getJsonFile(path, normalizeTimeline, "timeline");
    },
    putTimeline(playthrough, timeline) {
      const path = timelinePath(playthrough);
      return putJsonFile(path, timeline, normalizeTimeline, "timeline");
    },
    updateTimeline(playthrough, mutator, options) {
      const path = timelinePath(playthrough);
      return updateJsonFile({
        getFresh: () => getJsonFile(path, normalizeTimeline, "timeline"),
        putFresh: (value) => putJsonFile(path, value, normalizeTimeline, "timeline"),
        mutator,
        options
      });
    },
    async getMessages(sessionId) {
      const response = await v2("GET", `/sessions/${encodeURIComponent(sessionId)}/messages`);
      return normalizeSessionMessages(response);
    },
    async getImportContextBinding(sessionId) {
      const response = await v2("GET", `/sessions/${encodeURIComponent(sessionId)}/import-context`);
      return response?.binding ?? null;
    },
    async putImportContextBinding(sessionId, reference) {
      const response = await v2("PUT", `/sessions/${encodeURIComponent(sessionId)}/import-context`, { reference });
      return response?.binding ?? null;
    },
    async deleteImportContextBinding(sessionId) {
      const response = await v2("DELETE", `/sessions/${encodeURIComponent(sessionId)}/import-context`, {});
      return response?.binding ?? null;
    },
    async getFocus(playthrough) {
      const playthroughId = playthrough?.id;
      if (typeof playthroughId !== "string" || playthroughId.trim() === "") {
        throw new TypeError("playthrough.id must be a non-empty string");
      }
      const focus = normalizeFocus(await v2("GET", `/playthroughs/${encodeURIComponent(playthroughId)}/focus`));
      if (focus.playthroughId !== playthroughId) {
        throw new TypeError("focus.playthroughId does not match playthrough.id");
      }
      return focus;
    },
    postUserMessage(sessionId, text2) {
      return v2("POST", `/sessions/${encodeURIComponent(sessionId)}/user-message`, { text: text2 });
    },
    postBranch(sessionId, atEventId) {
      if (!Number.isSafeInteger(atEventId) || atEventId < 0) {
        throw new TypeError("atEventId must be a non-negative integer");
      }
      return v2("POST", `/sessions/${encodeURIComponent(sessionId)}/branch`, { atEventId });
    },
    postSession(selectionFromSessionId, importContextRef) {
      const body2 = {
        ...typeof selectionFromSessionId === "string" && selectionFromSessionId !== "" ? { selectionFromSessionId } : {},
        ...importContextRef === void 0 ? {} : { importContextRef }
      };
      return v2("POST", "/sessions", body2);
    },
    getCharacterSelection,
    async getSelection(sessionId) {
      const response = await getCharacterSelection(sessionId);
      return response?.selection ?? null;
    },
    putCharacterSelection(sessionId, characterCardId, character = {}) {
      if (typeof sessionId !== "string" || sessionId === "") throw new TypeError("sessionId is required");
      if (typeof characterCardId !== "string" || characterCardId === "") {
        throw new TypeError("characterCardId is required");
      }
      if (character === null || typeof character !== "object" || Array.isArray(character)) {
        throw new TypeError("character selection options must be an object");
      }
      return v1("POST", "/character-selection", {
        sessionId,
        characterCardId,
        character
      });
    },
    getCharacters() {
      return v1("GET", "/characters");
    },
    getCharacter(id) {
      return v1("GET", `/characters/${encodeURIComponent(id)}`);
    },
    getCharacterRegexScripts(id) {
      return v1("GET", `/characters/${encodeURIComponent(id)}/regex-scripts`);
    },
    putCharacterRegexScripts(id, regexScripts) {
      return v1("PUT", `/characters/${encodeURIComponent(id)}/regex-scripts`, { regexScripts });
    },
    getPreset(id) {
      return v1("GET", `/presets/${encodeURIComponent(id)}`);
    },
    getPresetRegexScripts(id) {
      return v1("GET", `/presets/${encodeURIComponent(id)}/regex-scripts`);
    },
    putPresetRegexScripts(id, regexScripts) {
      return v1("PUT", `/presets/${encodeURIComponent(id)}/regex-scripts`, { regexScripts });
    },
    getActive(sessionId) {
      const query = typeof sessionId === "string" && sessionId !== "" ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
      return v1("GET", `/active${query}`);
    },
    async putGreetingIndex(sessionId, greetingIndex) {
      if (typeof sessionId !== "string" || sessionId === "") throw new TypeError("sessionId is required");
      if (!Number.isSafeInteger(greetingIndex) || greetingIndex < 0) {
        throw new TypeError("greetingIndex must be a non-negative integer");
      }
      const current2 = await getCharacterSelection(sessionId);
      if (typeof current2?.selection?.characterCardId !== "string") {
        throw new TypeError("character selection is empty");
      }
      return v1("POST", "/character-selection", {
        sessionId,
        characterCardId: current2.selection.characterCardId,
        character: { ...current2.selection.character ?? {}, greetingIndex }
      });
    }
  };
}

// packages/client/src/play/regex-panel.js
var import_react14 = require("react");
var h12 = createLocalizedElement(import_react14.createElement);
var EMPTY_DOCUMENT = Object.freeze({ schemaVersion: 1, rules: Object.freeze([]) });
var SCOPE_KINDS = Object.freeze(["global", "preset", "character"]);
function activeRegexBindings(snapshot) {
  return {
    presetId: typeof snapshot?.selection?.presetId === "string" ? snapshot.selection.presetId : null,
    characterId: typeof snapshot?.selection?.characterCardId === "string" ? snapshot.selection.characterCardId : typeof snapshot?.selection?.characterId === "string" ? snapshot.selection.characterId : null
  };
}
function scopeFor(kind, bindings) {
  return {
    kind,
    resourceId: kind === "global" ? null : kind === "preset" ? bindings.presetId : bindings.characterId
  };
}
function downloadRegexScripts(rules, kind) {
  const scripts = exportNativeRegexScripts(rules);
  const blob = new Blob([JSON.stringify(scripts, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `regex-${kind}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
function Field5({ labelKey, children }) {
  return h12(
    "label",
    { className: "dtv-field" },
    h12("span", { className: "dtv-label" }, uiMessage(labelKey)),
    children
  );
}
async function activeResourceRegexRules(client, bindings) {
  const [presetResponse, characterResponse] = await Promise.all([
    typeof bindings.presetId === "string" && typeof client.getPresetRegexScripts === "function" ? client.getPresetRegexScripts(bindings.presetId) : typeof bindings.presetId === "string" && typeof client.getPreset === "function" ? client.getPreset(bindings.presetId) : null,
    typeof bindings.characterId === "string" && typeof client.getCharacterRegexScripts === "function" ? client.getCharacterRegexScripts(bindings.characterId) : typeof bindings.characterId === "string" && typeof client.getCharacter === "function" ? client.getCharacter(bindings.characterId) : null
  ]);
  return {
    preset: resourceRegexInventory(presetResponse?.regexScripts ?? presetResponse?.preset ?? presetResponse, {
      kind: "preset",
      resourceId: bindings.presetId
    }),
    character: resourceRegexInventory(characterResponse?.regexScripts ?? characterResponse?.character ?? characterResponse, {
      kind: "character",
      resourceId: bindings.characterId
    })
  };
}
async function putActiveResourceRegexRules(client, kind, resourceId, rules) {
  if (typeof resourceId !== "string") throw new TypeError(`${kind} regex resource is not bound`);
  const method = kind === "preset" ? client.putPresetRegexScripts : client.putCharacterRegexScripts;
  if (typeof method !== "function") throw new TypeError(`${kind} regex resource API is unavailable`);
  const response = await method.call(client, resourceId, rules.map(nativeRegexScript));
  return resourceRegexInventory(response?.regexScripts ?? [], { kind, resourceId });
}
function RuleEditor({ rule, busy, update, remove, sourceOwned = false }) {
  const set = (patch) => update({ ...rule, ...patch });
  const setScope = (patch) => set({ scope: { ...rule.scope, ...patch } });
  const stateLabel = uiMessage(rule.enabled ? "common.enabled" : "common.disabled");
  return h12(
    "details",
    { className: "dtv-entry dtv-regex-rule", "data-enabled": rule.enabled },
    h12(
      "summary",
      null,
      h12("span", { className: "dtv-entry-dot", "aria-hidden": "true" }),
      h12("span", { className: "dtv-entry-name" }, rawText(rule.name || unwrapText(uiMessage("regex.unnamed")))),
      h12("span", { className: "dtv-entry-state" }, stateLabel)
    ),
    h12(
      "div",
      { className: "dtv-entry-body" },
      h12(
        "label",
        { className: "dtv-check" },
        h12("input", {
          type: "checkbox",
          checked: rule.enabled,
          disabled: busy,
          onChange: (event) => set({ enabled: event.target.checked })
        }),
        uiMessage("regex.enabled")
      ),
      h12(Field5, { labelKey: "regex.name" }, h12("input", {
        className: "dtv-input",
        value: rule.name,
        disabled: busy,
        onChange: (event) => set({ name: event.target.value })
      })),
      h12(Field5, { labelKey: "regex.find" }, h12("textarea", {
        className: "dtv-textarea dtv-regex-expression",
        value: rule.find,
        disabled: busy,
        spellCheck: false,
        onChange: (event) => set({ find: event.target.value })
      })),
      h12(Field5, { labelKey: "regex.replace" }, h12("textarea", {
        className: "dtv-textarea dtv-regex-expression",
        value: rule.replace,
        disabled: busy,
        spellCheck: false,
        onChange: (event) => set({ replace: event.target.value })
      })),
      h12(
        "div",
        { className: "dtv-entry-grid" },
        h12(Field5, { labelKey: "regex.flags" }, h12("input", {
          className: "dtv-input",
          value: rule.flags,
          disabled: busy,
          spellCheck: false,
          onChange: (event) => set({ flags: event.target.value })
        })),
        h12(Field5, { labelKey: "regex.target" }, h12(
          "select",
          {
            className: "dtv-select",
            value: rule.target,
            disabled: busy,
            onChange: (event) => set({ target: event.target.value })
          },
          h12("option", { value: "assistant" }, uiMessage("regex.target.assistant")),
          h12("option", { value: "user" }, uiMessage("regex.target.user")),
          h12("option", { value: "both" }, uiMessage("regex.target.both"))
        ))
      ),
      h12(
        "div",
        { className: "dtv-entry-grid" },
        h12(Field5, { labelKey: "regex.scope" }, h12(
          "select",
          {
            className: "dtv-select",
            value: rule.scope.kind,
            disabled: busy || sourceOwned,
            onChange: (event) => setScope({
              kind: event.target.value,
              resourceId: event.target.value === "global" ? null : rule.scope.resourceId
            })
          },
          ...SCOPE_KINDS.map((kind) => h12("option", { key: kind, value: kind }, uiMessage(`regex.scope.${kind}`)))
        )),
        rule.scope.kind === "global" ? null : h12(Field5, { labelKey: "regex.resourceId" }, h12("input", {
          className: "dtv-input",
          value: rule.scope.resourceId ?? "",
          disabled: busy || sourceOwned,
          onChange: (event) => setScope({ resourceId: event.target.value || null })
        }))
      ),
      sourceOwned ? h12("p", { className: "dtv-note" }, uiMessage(rule.sourceDisplayEligible ? "regex.sourceOwnedDisplay" : "regex.sourceOwnedPromptOnly")) : null,
      h12("div", { className: "dtv-entry-actions" }, h12("button", {
        className: "dtv-button dtv-danger",
        type: "button",
        disabled: busy,
        onClick: remove
      }, uiMessage("common.delete")))
    )
  );
}
function RegexScopeSection({
  kind,
  bindings,
  editableRules,
  sourceRules,
  busy,
  add,
  importJson,
  exportJson,
  update,
  remove,
  updateSource,
  removeSource
}) {
  const rules = [...editableRules, ...sourceRules];
  const unbound = kind === "preset" && bindings.presetId === null ? uiMessage("regex.noPreset") : kind === "character" && bindings.characterId === null ? uiMessage("regex.noCharacter") : null;
  return h12(
    "section",
    { className: "dtv-resource dtv-regex-section", "data-scope": kind },
    h12(
      "div",
      { className: "dtv-regex-section-title" },
      h12("div", { className: "dtv-resource-title" }, uiMessage(`regex.scope.${kind}`)),
      h12("span", { className: "dtv-item-count" }, rawText(String(rules.length)))
    ),
    unbound === null ? null : h12("p", { className: "dtv-note" }, unbound),
    h12(
      "div",
      { className: "dtv-book-toolbar" },
      h12("button", { className: "dtv-button", type: "button", disabled: busy, onClick: add }, uiMessage("regex.add")),
      h12("button", { className: "dtv-button", type: "button", disabled: busy, onClick: importJson }, uiMessage("common.importJson")),
      h12("button", { className: "dtv-button", type: "button", disabled: busy, onClick: () => exportJson(rules) }, uiMessage("common.exportJson"))
    ),
    rules.length === 0 ? h12("p", { className: "dtv-note" }, uiMessage("regex.emptyScope")) : [
      ...editableRules.map((rule, index) => h12(RuleEditor, {
        key: `${kind}-editable-${rule.id}-${index}`,
        rule,
        busy,
        update,
        remove: () => remove(rule.id)
      })),
      ...sourceRules.map((rule, index) => h12(RuleEditor, {
        key: `${kind}-source-${rule.id}-${index}`,
        rule,
        busy,
        sourceOwned: true,
        update: (next) => updateSource(index, next),
        remove: () => removeSource(index)
      }))
    ]
  );
}
function RegexPanel({ client, activeSnapshot, close }) {
  const [document2, setDocument] = (0, import_react14.useState)(EMPTY_DOCUMENT);
  const [savedDocument, setSavedDocument] = (0, import_react14.useState)(EMPTY_DOCUMENT);
  const [resourceRules, setResourceRules] = (0, import_react14.useState)({ preset: [], character: [] });
  const [savedResourceRules, setSavedResourceRules] = (0, import_react14.useState)({ preset: [], character: [] });
  const [busy, setBusy] = (0, import_react14.useState)(false);
  const [status, setStatus] = (0, import_react14.useState)({ text: uiMessage("common.loading"), error: false });
  const fileInput = (0, import_react14.useRef)(null);
  const importScope = (0, import_react14.useRef)("global");
  const bindings = activeRegexBindings(activeSnapshot);
  const dirty = JSON.stringify(document2) !== JSON.stringify(savedDocument) || JSON.stringify(resourceRules) !== JSON.stringify(savedResourceRules);
  const load = async () => {
    setBusy(true);
    try {
      const [next, nextResourceRules] = await Promise.all([
        getRegexDocument(client),
        activeResourceRegexRules(client, bindings)
      ]);
      setDocument(next);
      setSavedDocument(next);
      setResourceRules(nextResourceRules);
      setSavedResourceRules(nextResourceRules);
      const count = next.rules.length + nextResourceRules.preset.length + nextResourceRules.character.length;
      setStatus({ text: uiMessage("regex.loaded", { count }), error: false });
    } catch (reason) {
      setStatus({ text: rawText(reason instanceof Error ? reason.message : String(reason)), error: true });
    } finally {
      setBusy(false);
    }
  };
  (0, import_react14.useEffect)(() => {
    load();
  }, [client, bindings.presetId, bindings.characterId]);
  const persist = async (next, nextResourceRules = resourceRules) => {
    setBusy(true);
    try {
      const [saved, savedPresetRules, savedCharacterRules] = await Promise.all([
        JSON.stringify(next) === JSON.stringify(savedDocument) ? next : putRegexDocument(client, next),
        JSON.stringify(nextResourceRules.preset) === JSON.stringify(savedResourceRules.preset) ? nextResourceRules.preset : putActiveResourceRegexRules(client, "preset", bindings.presetId, nextResourceRules.preset),
        JSON.stringify(nextResourceRules.character) === JSON.stringify(savedResourceRules.character) ? nextResourceRules.character : putActiveResourceRegexRules(client, "character", bindings.characterId, nextResourceRules.character)
      ]);
      const savedResources = { preset: savedPresetRules, character: savedCharacterRules };
      setDocument(saved);
      setSavedDocument(saved);
      setResourceRules(savedResources);
      setSavedResourceRules(savedResources);
      const count = saved.rules.length + savedPresetRules.length + savedCharacterRules.length;
      setStatus({ text: uiMessage("regex.saved", { count }), error: false });
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
    } catch (reason) {
      setStatus({ text: rawText(reason instanceof Error ? reason.message : String(reason)), error: true });
    } finally {
      setBusy(false);
    }
  };
  const guardedLoad = () => {
    if (dirty && !window.confirm(unwrapText(uiMessage("regex.confirmReload")))) return;
    load();
  };
  const guardedClose = () => {
    if (dirty && !window.confirm(unwrapText(uiMessage("regex.confirmClose")))) return;
    close();
  };
  const addRule = (kind) => {
    const rule = normalizeRegexRule({
      name: unwrapText(uiMessage("regex.newRule")),
      enabled: true,
      find: "",
      replace: "",
      flags: "g",
      target: "assistant"
    }, { scope: scopeFor(kind, bindings) });
    setDocument((current2) => ({ ...current2, rules: [...current2.rules, rule] }));
  };
  const updateRule = (next) => setDocument((current2) => ({
    ...current2,
    rules: current2.rules.map((rule) => rule.id === next.id ? next : rule)
  }));
  const removeRule = (id) => setDocument((current2) => ({
    ...current2,
    rules: current2.rules.filter((rule) => rule.id !== id)
  }));
  const updateSourceRule = (kind, index, next) => setResourceRules((current2) => ({
    ...current2,
    [kind]: current2[kind].map((rule, ruleIndex) => ruleIndex === index ? next : rule)
  }));
  const removeSourceRule = (kind, index) => setResourceRules((current2) => ({
    ...current2,
    [kind]: current2[kind].filter((_rule, ruleIndex) => ruleIndex !== index)
  }));
  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const imported = importRegexDocument(JSON.parse(await file.text()), {
        scope: scopeFor(importScope.current, bindings)
      });
      await persist({ ...document2, rules: [...document2.rules, ...imported] });
      setStatus({ text: uiMessage("regex.imported", { count: imported.length }), error: false });
    } catch (reason) {
      setStatus({ text: rawText(reason instanceof Error ? reason.message : String(reason)), error: true });
      setBusy(false);
    }
  };
  const title = uiMessage("regex.title");
  const closeLabel = uiMessage("panel.close", { title: unwrapText(title) });
  return h12(
    "div",
    { className: "dtv-panel dtv-regex-panel" },
    h12(
      "div",
      { className: "dtv-header" },
      h12("div", { className: "dtv-title" }, title),
      h12("button", { className: "dtv-close", type: "button", title: closeLabel, "aria-label": closeLabel, onClick: guardedClose }, "\u2715")
    ),
    h12(
      "div",
      { className: "dtv-body" },
      h12("p", { className: "dtv-note" }, uiMessage("regex.displayOnlyNote")),
      h12("input", { ref: fileInput, type: "file", accept: "application/json,.json", hidden: true, onChange: importFile }),
      ...SCOPE_KINDS.map((kind) => h12(RegexScopeSection, {
        key: kind,
        kind,
        bindings,
        editableRules: document2.rules.filter((rule) => rule.scope.kind === kind),
        sourceRules: kind === "preset" ? resourceRules.preset : kind === "character" ? resourceRules.character : [],
        busy,
        add: () => addRule(kind),
        importJson: () => {
          importScope.current = kind;
          fileInput.current?.click();
        },
        exportJson: (rules) => downloadRegexScripts(rules, kind),
        update: updateRule,
        remove: removeRule,
        updateSource: (index, next) => updateSourceRule(kind, index, next),
        removeSource: (index) => removeSourceRule(kind, index)
      })),
      h12("div", { className: "dtv-status", "data-error": status.error }, status.text),
      h12(
        "div",
        { className: "dtv-regex-footer" },
        h12("button", { className: "dtv-button", type: "button", disabled: busy, onClick: guardedLoad }, uiMessage("common.reload")),
        h12("button", { className: "dtv-button dtv-primary", type: "button", disabled: busy || !dirty, onClick: () => persist(document2) }, busy ? uiMessage("common.working") : uiMessage("common.saveChanges"))
      )
    )
  );
}

// packages/client/src/play/workspace-setting.js
function isRecord5(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function pathOf(value) {
  return typeof value?.path === "string" && value.path !== "" ? value.path : null;
}
function titleOf(value) {
  if (typeof value?.title === "string" && value.title.trim() !== "") return value.title.trim();
  if (typeof value?.name === "string" && value.name.trim() !== "") return value.name.trim();
  return pathOf(value) ?? "";
}
function comparablePath(value) {
  if (typeof value !== "string") return "";
  const normalized = value.replaceAll("\\", "/").replace(/\/+$/, "");
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized;
}
function projectRpWorkspaceSetting({ workspace, items = [] } = {}) {
  const currentPath = pathOf(workspace?.rootPath === null ? null : { path: workspace?.rootPath });
  const available = items.filter((item) => isRecord5(item) && pathOf(item) !== null).map((item) => ({
    id: item.workspaceId ?? item.id ?? pathOf(item),
    path: pathOf(item),
    title: titleOf(item)
  }));
  const current2 = currentPath === null ? null : available.find((item) => comparablePath(item.path) === comparablePath(currentPath)) ?? { id: `unavailable:${currentPath}`, path: currentPath, title: currentPath, unavailable: true };
  return { currentPath, current: current2, available, selectedPath: current2?.path ?? "", currentAvailable: current2?.unavailable !== true && current2 !== null };
}
function workspaceSelectionRequest(path, { setting } = {}) {
  if (typeof path !== "string" || path === "") throw new TypeError("workspace path must be a non-empty string");
  if (comparablePath(setting?.currentPath) === comparablePath(path)) return { path, changed: false };
  return { path, changed: true };
}

// packages/client/src/play/chrome-service.js
var CHROME_MODES2 = /* @__PURE__ */ new Set(["native", "play"]);
function serviceError() {
  const error = new Error("Chrome mode service is disposed");
  error.code = "CHROME_SERVICE_DISPOSED";
  return error;
}
function normalizeSnapshot(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("chrome snapshot must be an object");
  if (!CHROME_MODES2.has(value.mode)) throw new TypeError("chrome snapshot mode must be native or play");
  if (value.revision !== void 0 && value.revision !== null && (typeof value.revision !== "string" || value.revision === "")) {
    throw new TypeError("chrome snapshot revision must be a non-empty string or null");
  }
  return Object.freeze({ mode: value.mode, revision: value.revision ?? null });
}
function safely(action) {
  try {
    action();
  } catch {
  }
}
function createChromeModeServiceCore({
  initial = { mode: "native", revision: null },
  read,
  write
} = {}) {
  if (typeof read !== "function") throw new TypeError("read must be a function");
  if (typeof write !== "function") throw new TypeError("write must be a function");
  let snapshot = normalizeSnapshot(initial);
  let disposed = false;
  let queue = Promise.resolve();
  let intentMode = snapshot.mode;
  let intentVersion = 0;
  let pendingWrites = 0;
  const listeners = /* @__PURE__ */ new Set();
  const effects = /* @__PURE__ */ new Set();
  const notify = () => {
    for (const listener of [...listeners]) safely(() => listener(snapshot));
  };
  const stopEffect = (effect) => {
    effect.generation += 1;
    if (effect.dispose !== null) safely(effect.dispose);
    effect.dispose = null;
  };
  const startEffect = (effect) => {
    if (!effect.active || disposed || snapshot.mode !== effect.mode) return;
    const generation = ++effect.generation;
    let result;
    try {
      result = effect.setup({ snapshot });
    } catch {
      return;
    }
    Promise.resolve(result).then((dispose) => {
      if (typeof dispose !== "function") return;
      if (!effect.active || disposed || effect.generation !== generation || snapshot.mode !== effect.mode) {
        safely(dispose);
        return;
      }
      effect.dispose = dispose;
    }, () => {
    });
  };
  const commit = (value) => {
    const next = normalizeSnapshot(value);
    if (next.mode === snapshot.mode && next.revision === snapshot.revision) return snapshot;
    const previousMode = snapshot.mode;
    snapshot = next;
    if (previousMode !== next.mode) {
      for (const effect of effects) stopEffect(effect);
      for (const effect of effects) startEffect(effect);
    }
    notify();
    return snapshot;
  };
  const enqueue = (action) => {
    const result = queue.then(() => {
      if (disposed) throw serviceError();
      return action();
    });
    queue = result.catch(() => {
    });
    return result;
  };
  const planWrite = (mode) => {
    if (!CHROME_MODES2.has(mode)) return Promise.reject(new TypeError("chrome mode must be native or play"));
    const version = ++intentVersion;
    intentMode = mode;
    pendingWrites += 1;
    return enqueue(async () => {
      try {
        const value = await write(mode);
        if (disposed) throw serviceError();
        const confirmed = commit(value);
        if (version === intentVersion) intentMode = confirmed.mode;
        return confirmed;
      } catch (error) {
        if (version === intentVersion) intentMode = snapshot.mode;
        throw error;
      } finally {
        pendingWrites -= 1;
      }
    });
  };
  const face = Object.freeze({
    getMode() {
      return snapshot.mode;
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      if (disposed) return () => {
      };
      listeners.add(listener);
      safely(() => listener(snapshot));
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        listeners.delete(listener);
      };
    },
    refresh() {
      const version = intentVersion;
      return enqueue(async () => {
        const value = await read();
        if (disposed) throw serviceError();
        const confirmed = commit(value);
        if (version === intentVersion) intentMode = confirmed.mode;
        return confirmed;
      });
    },
    setMode(mode) {
      return planWrite(mode);
    },
    switchMode() {
      const next = intentMode === "native" ? "play" : "native";
      return planWrite(next);
    },
    when(mode, setup) {
      if (!CHROME_MODES2.has(mode)) throw new TypeError("chrome mode must be native or play");
      if (typeof setup !== "function") throw new TypeError("setup must be a function");
      if (disposed) return () => {
      };
      const effect = { mode, setup, active: true, generation: 0, dispose: null };
      effects.add(effect);
      startEffect(effect);
      return () => {
        if (!effect.active) return;
        effect.active = false;
        stopEffect(effect);
        effects.delete(effect);
      };
    }
  });
  const internal = Object.freeze({
    acceptSnapshot(value) {
      if (disposed) throw serviceError();
      const confirmed = commit(value);
      if (pendingWrites === 0) {
        intentMode = confirmed.mode;
        intentVersion += 1;
      }
      return confirmed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      for (const effect of [...effects]) {
        effect.active = false;
        stopEffect(effect);
      }
      effects.clear();
    }
  });
  return Object.freeze({ face, internal });
}
var chromeModeServiceConstants = Object.freeze({
  modes: Object.freeze([...CHROME_MODES2]),
  disposedCode: "CHROME_SERVICE_DISPOSED"
});

// packages/client/src/play/chrome-transport.js
function startChromeModeTransport({
  face,
  internal,
  eventsUrl,
  EventSourceImpl = globalThis.EventSource,
  focusTarget = globalThis.window,
  pollIntervalMs = 1e3,
  setIntervalImpl = globalThis.setInterval,
  clearIntervalImpl = globalThis.clearInterval
} = {}) {
  if (typeof face?.refresh !== "function") throw new TypeError("face.refresh is required");
  if (typeof internal?.acceptSnapshot !== "function") throw new TypeError("internal.acceptSnapshot is required");
  if (typeof eventsUrl !== "string" || eventsUrl === "") throw new TypeError("eventsUrl is required");
  if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 250 || pollIntervalMs > 6e4) {
    throw new TypeError("pollIntervalMs must be an integer from 250 to 60000");
  }
  if (typeof setIntervalImpl !== "function" || typeof clearIntervalImpl !== "function") {
    throw new TypeError("timer functions are required");
  }
  let disposed = false;
  let source = null;
  let pollTimer = null;
  const refresh = () => {
    if (disposed) return Promise.resolve();
    return Promise.resolve(face.refresh()).catch(() => {
    });
  };
  const stopPolling = () => {
    if (pollTimer === null) return;
    clearIntervalImpl(pollTimer);
    pollTimer = null;
  };
  const startPolling = () => {
    if (disposed || pollTimer !== null) return;
    pollTimer = setIntervalImpl(() => {
      void refresh();
    }, pollIntervalMs);
  };
  const acceptEvent = (event) => {
    if (disposed) return;
    try {
      internal.acceptSnapshot(JSON.parse(String(event?.data ?? "")));
    } catch {
      void refresh();
    }
  };
  const focus = () => {
    void refresh();
  };
  focusTarget?.addEventListener?.("focus", focus);
  if (typeof EventSourceImpl === "function") {
    try {
      source = new EventSourceImpl(eventsUrl);
      source.addEventListener?.("chrome/change", acceptEvent);
      source.addEventListener?.("open", stopPolling);
      source.addEventListener?.("error", startPolling);
    } catch {
      source = null;
      startPolling();
    }
  } else {
    startPolling();
  }
  void refresh();
  return () => {
    if (disposed) return;
    disposed = true;
    stopPolling();
    focusTarget?.removeEventListener?.("focus", focus);
    source?.removeEventListener?.("chrome/change", acceptEvent);
    source?.removeEventListener?.("open", stopPolling);
    source?.removeEventListener?.("error", startPolling);
    source?.close?.();
    source = null;
  };
}

// packages/client/src/index.js
var h13 = createLocalizedElement(import_react15.createElement);
var css11 = `
.dtv-layer{position:absolute;inset:0;z-index:6;pointer-events:none;font-family:Inter,var(--dsw-font-family),sans-serif;color:var(--dsw-alias-label-primary)}
.dtv-launcher{position:absolute;z-index:2;width:44px;height:44px;pointer-events:auto;overflow:hidden;border:0 solid transparent;border-radius:22px;background:transparent;box-shadow:none;transition:width .22s ease,height .22s ease,border-radius .22s ease,background-color .18s ease,box-shadow .18s ease;display:block}
.dtv-launcher[data-open=true] .dtv-menu{overflow-y:auto}
.dtv-launcher[data-open=true]{width:300px;height:376px;border-width:1px;border-color:var(--dsw-alias-border-l2);border-radius:18px;background:var(--dsw-alias-bg-base);box-shadow:var(--ds-shadow-3,0 12px 34px rgba(0,0,0,.24))}
.dtv-ball-row{position:absolute;top:0;left:0;right:0;height:52px;display:flex;align-items:flex-start;pointer-events:none}.dtv-launcher[data-side=left] .dtv-ball-row{justify-content:flex-end}.dtv-launcher[data-vertical=up] .dtv-ball-row{top:auto;bottom:0;align-items:flex-end}
@property --dtv-orb-a{syntax:"<color>";inherits:true;initial-value:#f7fbff}@property --dtv-orb-b{syntax:"<color>";inherits:true;initial-value:#18569d}@property --dtv-orb-ring{syntax:"<color>";inherits:true;initial-value:#174e8a}
.dtv-ball{--dtv-orb-a:#f7fbff;--dtv-orb-b:#18569d;--dtv-orb-ring:#174e8a;pointer-events:auto;touch-action:none;user-select:none;position:relative;isolation:isolate;overflow:hidden;width:44px;height:44px;flex:none;border:2px solid #fff;border-radius:50%;background:transparent;box-shadow:0 0 0 2px var(--dtv-orb-ring),0 6px 20px rgba(0,0,0,.34),inset 0 0 0 1px rgba(255,255,255,.28);color:#fff;font-size:13px;letter-spacing:-.5px;font-weight:850;text-shadow:0 1px 2px #000;cursor:grab;transition:filter .15s ease,transform .18s ease,box-shadow .18s ease,--dtv-orb-a .32s ease,--dtv-orb-b .32s ease,--dtv-orb-ring .32s ease}.dtv-ball-face{position:absolute;inset:0;border-radius:inherit;background:conic-gradient(from 225deg,var(--dtv-orb-a) 0 50%,var(--dtv-orb-b) 50% 100%);z-index:-1}.dtv-ball-face[data-animate=true]{animation:dtv-orb-switch .48s cubic-bezier(.3,.7,.2,1)}.dtv-ball-label{position:relative;z-index:1}.dtv-ball:hover{filter:brightness(1.1);box-shadow:0 0 0 2px #2675c9,0 8px 24px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.35)}.dtv-layer[data-chrome=play] .dtv-ball{--dtv-orb-a:#090909;--dtv-orb-b:#b31319;--dtv-orb-ring:#a50f16}.dtv-layer[data-chrome=play] .dtv-ball:hover{box-shadow:0 0 0 2px #d5222b,0 8px 24px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.35)}.dtv-ball:active{cursor:grabbing}.dtv-launcher[data-open=true] .dtv-ball{transform:scale(.82) rotate(-8deg)}
@keyframes dtv-orb-switch{to{transform:rotate(1turn)}}@media (prefers-reduced-motion:reduce){.dtv-ball{transition:filter .15s ease,transform .18s ease,box-shadow .18s ease}.dtv-ball-face[data-animate=true]{animation:none}}
.dtv-menu{position:absolute;left:8px;right:8px;top:52px;bottom:8px;padding:1px;display:flex;flex-direction:column;gap:4px;opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-6px);transition:opacity .12s ease,transform .18s ease,visibility 0s linear .18s}.dtv-launcher[data-open=true] .dtv-menu{opacity:1;visibility:visible;pointer-events:auto;transform:none;transition-delay:.22s,.16s,.22s}.dtv-launcher[data-vertical=up] .dtv-menu{top:8px;bottom:52px;transform:translateY(6px)}.dtv-launcher[data-open=true][data-vertical=up] .dtv-menu{transform:none}
.dtv-menu-title{flex:none;padding:5px 8px 7px;font-size:11px;line-height:1.35;font-weight:650;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dtv-menu-item{min-height:43px;border:0;border-radius:9px;padding:5px 8px;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font:inherit;cursor:pointer;display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:8px;align-items:center}.dtv-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-menu-item[data-active=true]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-specific-tip))}.dtv-binding-dot{width:8px;height:8px;border-radius:50%;background:#d33239;box-shadow:0 0 0 1px rgba(98,0,4,.38)}.dtv-menu-item[data-bound=true] .dtv-binding-dot{background:#44d17a;box-shadow:0 0 5px #31c66b,0 0 10px rgba(49,198,107,.75)}.dtv-item-copy{min-width:0;display:flex;flex-direction:column;gap:1px}.dtv-item-label{font-size:11px;font-weight:700;line-height:1.2}.dtv-item-status{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;line-height:1.25;color:var(--dsw-alias-label-tertiary)}.dtv-item-count{border-radius:10px;padding:2px 6px;background:var(--dsw-specific-tip);font-size:9px;color:var(--dsw-alias-label-secondary)}.dtv-item-planned{font-size:9px;color:var(--dsw-alias-label-tertiary)}
.dtv-menu-item[data-show-binding=false] .dtv-binding-dot{visibility:hidden}
.dtv-panel{position:absolute;z-index:1;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);display:flex;flex-direction:column}
.dtv-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dtv-title{font-size:14px;font-weight:650;flex:1}.dtv-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dtv-close:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtv-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dtv-note{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dtv-status{font-size:11px;line-height:1.45;border-radius:7px;padding:8px 10px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dtv-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtv-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtv-button{min-height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:12px}.dtv-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtv-button:disabled{opacity:.5;cursor:default}
.dtv-primary{background:var(--dsw-alias-state-business-primary,#2677d9);border-color:transparent;color:var(--dsw-alias-button-primary-label,#fff)}.dtv-primary:hover:not(:disabled){filter:brightness(1.08);background:var(--dsw-alias-state-business-primary,#2677d9)}.dtv-template-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.dtv-resource{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:7px}.dtv-resource-title{font-size:12px;font-weight:650}.dtv-resource-meta{font-size:11px;line-height:1.45;color:var(--dsw-alias-label-tertiary)}.dtv-list{margin:0;padding-left:18px;font-size:11px;line-height:1.55}.dtv-preview{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-specific-tip);padding:9px;display:flex;flex-direction:column;gap:6px}.dtv-preview-title{font-size:12px;font-weight:700}.dtv-preview-row{display:grid;grid-template-columns:112px minmax(0,1fr);gap:8px;font-size:11px;line-height:1.45}.dtv-preview-label{color:var(--dsw-alias-label-tertiary)}.dtv-preview-value{overflow-wrap:anywhere}.dtv-preview-options{margin-left:120px;display:flex;flex-direction:column;gap:2px;font-size:10px;color:var(--dsw-alias-label-tertiary)}.dtv-preview-list{margin:0;padding-left:18px}.dtv-preview-row[data-missing=true] .dtv-preview-value,.dtv-preview-list>[data-missing=true]{color:var(--dsw-alias-state-error)}
.dtv-book-toolbar{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}.dtv-entry{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);overflow:hidden}.dtv-entry>summary{list-style:none;cursor:pointer;padding:8px;display:flex;align-items:center;gap:7px;font-size:11px}.dtv-entry>summary::-webkit-details-marker{display:none}.dtv-entry-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary)}.dtv-entry[data-enabled=true] .dtv-entry-dot{background:var(--dsw-alias-state-success,#2fa36b)}.dtv-entry-name{font-weight:620;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dtv-entry-state{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px}.dtv-entry-body{border-top:1px solid var(--dsw-alias-border-l1);padding:8px;display:flex;flex-direction:column;gap:8px}.dtv-field{display:flex;flex-direction:column;gap:4px}.dtv-label{font-size:10px;font-weight:620;color:var(--dsw-alias-label-tertiary)}.dtv-input,.dtv-select,.dtv-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;padding:7px 8px}.dtv-input,.dtv-select{height:32px}.dtv-textarea{min-height:94px;resize:vertical;line-height:1.45}.dtv-policy{min-height:96px}.dtv-entry-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.dtv-checks{display:flex;flex-wrap:wrap;gap:10px}.dtv-check{display:flex;gap:5px;align-items:center;font-size:10px}.dtv-entry-actions{display:flex;justify-content:flex-end}.dtv-danger{color:var(--dsw-alias-state-error)}
.dtv-layer>.dtv-launcher,.dtv-layer>.dtv-panel,.dtv-layer>.dcc-panel,.dtv-layer>.dwb-panel,.dtv-layer>.dtu-panel{zoom:var(--dtv-ui-scale,1)}.dtv-setting-value{font-size:12px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.dtv-modal-backdrop{position:absolute;inset:0;z-index:20;pointer-events:auto;background:rgba(0,0,0,.48);display:flex;align-items:center;justify-content:center;padding:24px}
.dtv-regex-panel .dtv-body{flex:1 1 auto;overscroll-behavior:contain}.dtv-regex-section{gap:8px}.dtv-regex-section-title{display:flex;align-items:center;gap:8px}.dtv-regex-section-title .dtv-item-count{margin-left:auto}.dtv-regex-rule .dtv-input:disabled,.dtv-regex-rule .dtv-select:disabled,.dtv-regex-rule .dtv-textarea:disabled{pointer-events:none}.dtv-regex-expression{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Consolas,monospace);min-height:72px}.dtv-regex-footer{position:sticky;bottom:-12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 0 12px;background:var(--dsw-alias-bg-base)}
.dtv-modal{width:min(420px,100%);border-radius:12px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,0 16px 40px rgba(0,0,0,.28));padding:18px 16px;display:flex;flex-direction:column;gap:14px}
.dtv-modal-body{margin:0;font-size:13px;line-height:1.55}.dtv-modal .dtv-button{align-self:flex-end;min-width:88px}
`;
var LAUNCHER_STORAGE_KEY = `${PLUGIN_ID}:launcher-position:v1`;
function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}
function initialLauncherAnchor() {
  try {
    const stored = window.localStorage.getItem(LAUNCHER_STORAGE_KEY);
    if (stored !== null) return clampLauncherAnchor(JSON.parse(stored), viewport());
  } catch {
  }
  return clampLauncherAnchor({ x: window.innerWidth - 60, y: 14 }, viewport());
}
function persistLauncherAnchor(anchor) {
  try {
    window.localStorage.setItem(LAUNCHER_STORAGE_KEY, JSON.stringify(anchor));
  } catch {
  }
}
async function activeView(sessionId) {
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  const response = await fetch(`${API_V1}/active${query}`);
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    const message = typeof data?.error === "string" ? data.error : data?.error?.message;
    throw new Error(message ?? `HTTP ${response.status}`);
  }
  return data;
}
async function sessionConfigurationRequest(path, body2) {
  const response = await fetch(`${API_V1}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body2)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error?.message ?? data?.error ?? `HTTP ${response.status}`);
    error.diagnostics = data?.error?.diagnostics ?? [];
    throw error;
  }
  return data;
}
async function rpAlertRequest(sessionId, { method = "GET", id } = {}) {
  const params = new URLSearchParams({ sessionId });
  if (id !== void 0) params.set("id", String(id));
  const mutating = method !== "GET" && method !== "HEAD";
  const response = await fetch(`${API_V1}/rp-alert?${params}`, {
    method,
    headers: mutating ? { "Content-Type": "application/json" } : void 0,
    body: mutating ? "{}" : void 0
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(data?.error ?? `HTTP ${response.status}`);
  return data;
}
async function rpPolicyRequest(method = "GET", body2) {
  const response = await fetch(`${API_V1}/rp-policy`, {
    method,
    headers: method === "GET" ? void 0 : { "Content-Type": "application/json" },
    body: body2 === void 0 ? void 0 : JSON.stringify(body2)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(data?.error ?? `HTTP ${response.status}`);
  return data;
}
async function uiSettingsRequest(method = "GET", body2) {
  const response = await fetch(`${API_V1}/ui-settings`, {
    method,
    headers: method === "GET" ? void 0 : { "Content-Type": "application/json" },
    body: body2 === void 0 ? void 0 : JSON.stringify(body2)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(data?.error ?? `HTTP ${response.status}`);
  return data.settings;
}
function PanelHeader({ title, titleKey, close }) {
  const titleText = titleKey ? uiMessage(titleKey) : title;
  const closeLabel = uiMessage("panel.close", { title: unwrapText(titleText) });
  return h13(
    "div",
    { className: "dtv-header" },
    h13("div", { className: "dtv-title" }, titleText),
    h13("button", { className: "dtv-close", type: "button", title: closeLabel, "aria-label": closeLabel, onClick: close }, "\u2715")
  );
}
function Field6({ label, children }) {
  return h13("label", { className: "dtv-field" }, h13("span", { className: "dtv-label" }, label), children);
}
function SettingsPanel({
  settings,
  status,
  busy,
  close,
  update,
  reset,
  policyDraft,
  policyBusy,
  policyLoaded,
  onPolicyDraft,
  savePolicy,
  resetPolicy,
  workspaceSetting,
  workspaceBusy,
  selectWorkspace
}) {
  const percent = Math.round(settings.scale * 100);
  return h13(
    "div",
    { className: "dtv-panel" },
    h13(
      "div",
      { className: "dtv-header" },
      h13("div", { className: "dtv-title" }, translate("settings.title")),
      h13("button", { className: "dtv-close", type: "button", title: translate("settings.close"), "aria-label": translate("settings.close"), onClick: close }, "\u2715")
    ),
    h13(
      "div",
      { className: "dtv-body" },
      h13(Field6, { label: translate("settings.language") }, h13(
        "select",
        {
          className: "dtv-select",
          value: settings.locale,
          disabled: busy,
          onChange: (event) => update({ ...settings, locale: event.target.value })
        },
        ...UI_LOCALES.map((locale) => h13("option", { key: locale.id, value: locale.id }, rawText(locale.nativeName)))
      )),
      h13(Field6, { label: translate("settings.scale") }, h13("select", {
        className: "dtv-select",
        value: settings.scale,
        disabled: busy,
        onChange: (event) => update({ ...settings, scale: Number(event.target.value) })
      }, ...UI_SCALE_OPTIONS.map((scale) => h13("option", { key: scale, value: scale }, `${Math.round(scale * 100)}%`)))),
      h13("div", { className: "dtv-setting-value" }, translate("settings.currentScale", { scale: percent })),
      h13("p", { className: "dtv-note" }, translate("settings.scale.help")),
      h13(
        "label",
        { className: "dtv-check" },
        h13("input", {
          type: "checkbox",
          checked: settings.rpFollowCharacter !== false,
          disabled: busy,
          onChange: (event) => update({ ...settings, rpFollowCharacter: event.target.checked })
        }),
        h13("span", null, translate("settings.rpFollow"))
      ),
      h13("p", { className: "dtv-note" }, translate("settings.rpFollow.help")),
      h13(Field6, { label: translate("settings.rpWorkspace") }, h13(
        "select",
        {
          className: "dtv-select",
          value: workspaceSetting?.selectedPath ?? "",
          disabled: busy || workspaceBusy || workspaceSetting === null,
          onChange: (event) => selectWorkspace(event.target.value)
        },
        workspaceSetting?.current === null && workspaceSetting.available.length > 0 ? h13("option", { value: "", disabled: true }, translate("settings.rpWorkspace.unselected")) : null,
        workspaceSetting?.current?.unavailable === true ? h13("option", { value: workspaceSetting.current.path, disabled: true }, translate("settings.rpWorkspace.unavailable", { path: workspaceSetting.current.path })) : null,
        workspaceSetting?.available?.length > 0 ? workspaceSetting.available.map((item) => h13("option", { key: item.id, value: item.path }, rawText(item.title))) : h13("option", { value: "", disabled: true }, translate("settings.rpWorkspace.none"))
      )),
      h13("p", { className: "dtv-note" }, translate("settings.rpWorkspace.help")),
      h13(Field6, { label: translate("settings.rpPolicy") }, h13("textarea", {
        className: "dtv-textarea dtv-policy",
        value: policyDraft,
        placeholder: translate("settings.rpPolicy.placeholder"),
        disabled: busy || policyBusy || policyLoaded !== true,
        onChange: (event) => onPolicyDraft(event.target.value)
      })),
      h13("p", { className: "dtv-note" }, translate("settings.rpPolicy.help")),
      h13(
        "div",
        { className: "dtv-actions" },
        h13("button", {
          className: "dtv-button dtv-primary",
          type: "button",
          disabled: busy || policyBusy || policyLoaded !== true,
          onClick: savePolicy
        }, translate("settings.rpPolicy.save")),
        h13("button", {
          className: "dtv-button",
          type: "button",
          disabled: busy || policyBusy || policyLoaded !== true,
          onClick: resetPolicy
        }, translate("settings.rpPolicy.reset"))
      ),
      h13("div", { className: "dtv-status", "data-error": status.error || void 0, role: "status" }, rawText(status.text)),
      h13(
        "div",
        { className: "dtv-actions" },
        h13("button", { className: "dtv-button", type: "button", disabled: busy, onClick: reset }, translate("settings.reset"))
      )
    )
  );
}
var LOGIC_KEYS = Object.freeze({
  and_any: "world.logic.andAny",
  and_all: "world.logic.andAll",
  not_any: "world.logic.notAny",
  not_all: "world.logic.notAll"
});
function RpHighRiskDialog({ onDismiss }) {
  return h13(
    "div",
    {
      className: "dtv-modal-backdrop",
      role: "alertdialog",
      "aria-modal": "true",
      "aria-labelledby": "dtv-rp-block-body"
    },
    h13(
      "div",
      { className: "dtv-modal" },
      h13("p", { id: "dtv-rp-block-body", className: "dtv-modal-body" }, translate("rp.block.body")),
      h13("button", { className: "dtv-button dtv-primary", type: "button", onClick: onDismiss }, translate("rp.block.dismiss"))
    )
  );
}
function TavernShell({ useSessions, useWorkspaces, createCleanSession, playClient, playSlots, chromeService }) {
  const [menuOpen, setMenuOpen] = (0, import_react15.useState)(false);
  const [surface, setSurface] = (0, import_react15.useState)(null);
  const [anchor, setAnchor] = (0, import_react15.useState)(initialLauncherAnchor);
  const [chromeMode, setChromeMode] = (0, import_react15.useState)(() => chromeService.getMode());
  const [chromeAnimation, setChromeAnimation] = (0, import_react15.useState)(0);
  const [chromeError, setChromeError] = (0, import_react15.useState)("");
  const [activeSnapshot, setActiveSnapshot] = (0, import_react15.useState)(null);
  const [statusError, setStatusError] = (0, import_react15.useState)("");
  const [uiSettings, setUiSettings] = (0, import_react15.useState)(getClientUiSettings);
  const [settingsStatus, setSettingsStatus] = (0, import_react15.useState)({ text: translate("settings.saved"), error: false });
  const [settingsBusy, setSettingsBusy] = (0, import_react15.useState)(false);
  const [rpPolicyDraft, setRpPolicyDraft] = (0, import_react15.useState)("");
  const [rpPolicyLoaded, setRpPolicyLoaded] = (0, import_react15.useState)(false);
  const [rpPolicyBusy, setRpPolicyBusy] = (0, import_react15.useState)(false);
  const [rpWorkspaceSetting, setRpWorkspaceSetting] = (0, import_react15.useState)(null);
  const [rpWorkspaceBusy, setRpWorkspaceBusy] = (0, import_react15.useState)(false);
  const rpWorkspaceBusyRef = (0, import_react15.useRef)(false);
  const [rpAlert, setRpAlert] = (0, import_react15.useState)(null);
  const drag = (0, import_react15.useRef)(null);
  const suppressClick = (0, import_react15.useRef)(false);
  const chromeController = (0, import_react15.useRef)(null);
  const statusGeneration = (0, import_react15.useRef)(0);
  const rpAlertRef = (0, import_react15.useRef)(null);
  const dismissedRpAlerts = (0, import_react15.useRef)(/* @__PURE__ */ new Set());
  const sessionId = useSessions((state) => state.current);
  const sessionBlank = useSessions((state) => state.current === void 0 || state.current === null ? true : state.byId?.[state.current]?.blank === true);
  const workspaceId = useWorkspaces((state) => workspaceTargetId(state, sessionId));
  const workspaceItems = useWorkspaces((state) => state.items);
  const hasConversationHistory = (0, import_react15.useCallback)(async (targetSessionId) => {
    const messages = await playClient.getMessages(targetSessionId);
    return sessionHasConversationHistory(messages);
  }, [playClient]);
  const close = () => setSurface(null);
  if (rpAlert === null || dismissedRpAlerts.current.has(rpAlert.id)) rpAlertRef.current = null;
  else rpAlertRef.current = rpAlert;
  (0, import_react15.useEffect)(() => {
    const commitChrome = (snapshot) => {
      setChromeMode(snapshot.mode);
      playSlots.setMode(snapshot.mode);
      if (snapshot.mode !== "play") setSurface((current2) => current2 === "regex" ? null : current2);
    };
    const unsubscribe = chromeService.subscribe((snapshot) => {
      commitChrome(snapshot);
      setChromeError("");
    });
    const controller2 = createChromeClickController({
      getMode: () => chromeService.getMode(),
      persistMode: (mode) => chromeService.setMode(mode),
      openMenu: () => setMenuOpen((value) => !value),
      closeMenu: () => setMenuOpen(false),
      setMode: () => {
      },
      setError: (reason) => setChromeError(reason instanceof Error ? reason.message : reason == null ? "" : String(reason))
    });
    chromeController.current = controller2;
    return () => {
      controller2.dispose();
      if (chromeController.current === controller2) chromeController.current = null;
      unsubscribe();
    };
  }, [chromeService, playSlots]);
  (0, import_react15.useEffect)(() => {
    let active = true;
    uiSettingsRequest().then((next) => {
      if (!active) return;
      const normalized = setClientUiSettings(next);
      setUiSettings(normalized);
      setSettingsStatus({ text: translate("settings.saved"), error: false });
    }).catch((reason) => {
      if (!active) return;
      setSettingsStatus({ text: translate("settings.loadError", { message: reason instanceof Error ? reason.message : String(reason) }), error: true });
    });
    return () => {
      active = false;
    };
  }, []);
  const persistSettings = async (next) => {
    const previous = uiSettings;
    const normalized = setClientUiSettings(next);
    setUiSettings(normalized);
    setSettingsBusy(true);
    setSettingsStatus({ text: translate("settings.saving"), error: false });
    try {
      const saved = setClientUiSettings(await uiSettingsRequest("PUT", normalized));
      setUiSettings(saved);
      setSettingsStatus({ text: translate("settings.saved"), error: false });
    } catch (reason) {
      setClientUiSettings(previous);
      setUiSettings(previous);
      setSettingsStatus({ text: translate("settings.saveError", { message: reason instanceof Error ? reason.message : String(reason) }), error: true });
    } finally {
      setSettingsBusy(false);
    }
  };
  const resetSettings = async () => {
    const previous = uiSettings;
    const defaults = setClientUiSettings(DEFAULT_UI_SETTINGS);
    setUiSettings(defaults);
    setSettingsBusy(true);
    setSettingsStatus({ text: translate("settings.saving"), error: false });
    try {
      const saved = setClientUiSettings(await uiSettingsRequest("DELETE"));
      setUiSettings(saved);
      setSettingsStatus({ text: translate("settings.saved"), error: false });
    } catch (reason) {
      setClientUiSettings(previous);
      setUiSettings(previous);
      setSettingsStatus({ text: translate("settings.saveError", { message: reason instanceof Error ? reason.message : String(reason) }), error: true });
    } finally {
      setSettingsBusy(false);
    }
  };
  (0, import_react15.useEffect)(() => {
    if (surface !== "settings") return void 0;
    let active = true;
    setRpPolicyLoaded(false);
    rpPolicyRequest().then((next) => {
      if (!active) return;
      setRpPolicyDraft(typeof next.section === "string" ? next.section : "");
      setRpPolicyLoaded(true);
    }).catch((reason) => {
      if (!active) return;
      setSettingsStatus({ text: translate("settings.loadError", { message: reason instanceof Error ? reason.message : String(reason) }), error: true });
    });
    return () => {
      active = false;
    };
  }, [surface]);
  (0, import_react15.useEffect)(() => {
    if (surface !== "settings") return void 0;
    let active = true;
    setRpWorkspaceSetting(null);
    playClient.getWorkspace().then((workspace) => {
      if (active) setRpWorkspaceSetting(projectRpWorkspaceSetting({ workspace, items: workspaceItems }));
    }).catch((reason) => {
      if (active) setSettingsStatus({ text: translate("settings.loadError", { message: reason instanceof Error ? reason.message : String(reason) }), error: true });
    });
    return () => {
      active = false;
    };
  }, [playClient, surface, workspaceItems]);
  const selectRpWorkspace = async (path) => {
    if (rpWorkspaceBusyRef.current) return;
    const request = workspaceSelectionRequest(path, { setting: rpWorkspaceSetting });
    if (!request.changed) return;
    const item = rpWorkspaceSetting?.available?.find((candidate) => candidate.path === path);
    if (item === void 0) return;
    if (requiresSystemWorkspaceConfirmation(path) && !window.confirm(unwrapText(uiMessage("play.sidebar.systemWorkspaceConfirm", { path })))) return;
    rpWorkspaceBusyRef.current = true;
    setRpWorkspaceBusy(true);
    setSettingsStatus({ text: translate("settings.saving"), error: false });
    try {
      const written = await playClient.putWorkspace(path);
      setRpWorkspaceSetting(projectRpWorkspaceSetting({ workspace: written, items: workspaceItems }));
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
      try {
        const current2 = await playClient.getWorkspace();
        setRpWorkspaceSetting(projectRpWorkspaceSetting({ workspace: current2, items: workspaceItems }));
        setSettingsStatus({ text: translate("settings.saved"), error: false });
      } catch (reason) {
        setSettingsStatus({ text: translate("settings.rpWorkspace.verifyError", { message: reason instanceof Error ? reason.message : String(reason) }), error: true });
      }
    } catch (reason) {
      setSettingsStatus({ text: translate("settings.saveError", { message: reason instanceof Error ? reason.message : String(reason) }), error: true });
    } finally {
      rpWorkspaceBusyRef.current = false;
      setRpWorkspaceBusy(false);
    }
  };
  const persistRpPolicy = async () => {
    setRpPolicyBusy(true);
    setSettingsStatus({ text: translate("settings.saving"), error: false });
    try {
      const saved = await rpPolicyRequest("PUT", { section: rpPolicyDraft });
      setRpPolicyDraft(saved.section);
      setRpPolicyLoaded(true);
      setSettingsStatus({ text: translate("settings.rpPolicy.saved"), error: false });
    } catch (reason) {
      setSettingsStatus({ text: translate("settings.saveError", { message: reason instanceof Error ? reason.message : String(reason) }), error: true });
    } finally {
      setRpPolicyBusy(false);
    }
  };
  const resetRpPolicy = async () => {
    setRpPolicyBusy(true);
    setSettingsStatus({ text: translate("settings.saving"), error: false });
    try {
      const saved = await rpPolicyRequest("DELETE");
      setRpPolicyDraft(saved.section);
      setRpPolicyLoaded(true);
      setSettingsStatus({ text: translate("settings.rpPolicy.saved"), error: false });
    } catch (reason) {
      setSettingsStatus({ text: translate("settings.saveError", { message: reason instanceof Error ? reason.message : String(reason) }), error: true });
    } finally {
      setRpPolicyBusy(false);
    }
  };
  const refreshStatus = (0, import_react15.useCallback)(async () => {
    const generation = ++statusGeneration.current;
    try {
      const next = await activeView(sessionId);
      if (generation !== statusGeneration.current) return;
      setActiveSnapshot(next);
      setStatusError("");
    } catch (reason) {
      if (generation !== statusGeneration.current) return;
      setStatusError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [sessionId]);
  (0, import_react15.useEffect)(() => {
    statusGeneration.current += 1;
    setActiveSnapshot(null);
    setStatusError("");
    refreshStatus();
    return () => {
      statusGeneration.current += 1;
    };
  }, [refreshStatus, sessionId]);
  (0, import_react15.useEffect)(() => {
    const onRefresh = () => refreshStatus();
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh);
  }, [refreshStatus]);
  (0, import_react15.useEffect)(() => {
    const onResize = () => setAnchor((current2) => {
      const next = clampLauncherAnchor(current2, viewport(), uiSettings.scale);
      persistLauncherAnchor(next);
      return next;
    });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [uiSettings.scale]);
  (0, import_react15.useEffect)(() => {
    setAnchor((current2) => {
      const next = clampLauncherAnchor(current2, viewport(), uiSettings.scale);
      persistLauncherAnchor(next);
      return next;
    });
  }, [uiSettings.scale]);
  (0, import_react15.useEffect)(() => {
    if (typeof sessionId !== "string" || sessionId === "") {
      dismissedRpAlerts.current = /* @__PURE__ */ new Set();
      rpAlertRef.current = null;
      setRpAlert(null);
      return void 0;
    }
    let active = true;
    const poll = async () => {
      try {
        const data = await rpAlertRequest(sessionId);
        if (!active || data?.alert == null) return;
        if (dismissedRpAlerts.current.has(data.alert.id)) return;
        if (rpAlertRef.current?.id === data.alert.id) return;
        setRpAlert(data.alert);
      } catch {
      }
    };
    poll();
    const timer = window.setInterval(poll, 800);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [sessionId]);
  const dismissRpAlert = async () => {
    const alert2 = rpAlertRef.current ?? rpAlert;
    if (alert2?.id != null) dismissedRpAlerts.current.add(alert2.id);
    rpAlertRef.current = null;
    setRpAlert(null);
    if (typeof sessionId !== "string" || sessionId === "" || alert2?.id == null) return;
    try {
      await rpAlertRequest(sessionId, { method: "DELETE", id: alert2.id });
    } catch {
    }
  };
  (0, import_react15.useEffect)(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (rpAlert !== null) dismissRpAlert();
      else if (menuOpen) setMenuOpen(false);
      else if (surface !== null) setSurface(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, rpAlert, surface]);
  const startDrag = (event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: anchor,
      latest: anchor,
      moved: false
    };
  };
  const moveDrag = (event) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.current.startX;
    const dy = event.clientY - drag.current.startY;
    if (Math.hypot(dx, dy) >= 4) drag.current.moved = true;
    if (!drag.current.moved) return;
    const next = clampLauncherAnchor({
      x: drag.current.origin.x + dx,
      y: drag.current.origin.y + dy
    }, viewport(), uiSettings.scale);
    drag.current.latest = next;
    setAnchor(next);
  };
  const endDrag = (event) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    if (drag.current.moved) {
      suppressClick.current = true;
      persistLauncherAnchor(drag.current.latest);
    }
    drag.current = null;
  };
  const consumeSuppressedClick = () => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  };
  const clickLauncher = () => chromeController.current?.click({
    suppressed: consumeSuppressedClick()
  });
  const contextSwitchLauncher = (event) => {
    event.preventDefault();
    const switching = chromeController.current?.switchMode({ suppressed: consumeSuppressedClick() });
    Promise.resolve(switching).then((changed) => {
      if (changed) setChromeAnimation((value) => value + 1);
    });
  };
  const switchChrome = () => chromeController.current?.switchMode();
  const open = (id) => {
    setMenuOpen(false);
    setSurface(id);
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
  };
  let panel = null;
  if (surface === "preset") {
    panel = h13("div", { className: "dtv-panel" }, h13(PresetSidebar, {
      closePanel: close,
      openPanel: () => {
      },
      sessionId,
      sessionBlank,
      autoOpen: false
    }));
  } else if (surface === "character") {
    panel = h13(CharacterPanel, { sessionId, sessionBlank, hasConversationHistory, close });
  } else if (surface === "regex" && chromeMode === "play") {
    panel = h13(RegexPanel, { client: playClient, activeSnapshot, close });
  } else if (surface === "world-info") {
    panel = h13(WorldBookPanel, { sessionId, close });
  } else if (surface === "user") {
    panel = h13(UserPanel, { sessionId, sessionBlank, close });
  } else if (surface === "session-template") {
    panel = h13(SessionTemplatePanel, { sessionId, workspaceId, createCleanSession, close });
  } else if (surface === "settings") {
    panel = h13(SettingsPanel, {
      settings: uiSettings,
      status: settingsStatus,
      busy: settingsBusy,
      close,
      update: persistSettings,
      reset: resetSettings,
      policyDraft: rpPolicyDraft,
      policyBusy: rpPolicyBusy,
      policyLoaded: rpPolicyLoaded,
      onPolicyDraft: setRpPolicyDraft,
      savePolicy: persistRpPolicy,
      resetPolicy: resetRpPolicy,
      workspaceSetting: rpWorkspaceSetting,
      workspaceBusy: rpWorkspaceBusy,
      selectWorkspace: selectRpWorkspace
    });
  }
  const placement = launcherPlacement(anchor, viewport(), menuOpen, uiSettings.scale);
  const statuses = launcherResourceStatuses(activeSnapshot);
  const chromeSwitchLabel = chromeMode === "play" ? uiMessage("chrome.switchToNative") : uiMessage("chrome.switchToPlay");
  const chromeStatusLabel = chromeMode === "play" ? uiMessage("chrome.currentPlay") : uiMessage("chrome.currentNative");
  return h13(
    "div",
    { className: "dtv-layer", lang: uiSettings.locale, "data-chrome": chromeMode, "data-surface-open": surface !== null, style: { "--dtv-ui-scale": uiSettings.scale } },
    panel,
    rpAlert === null ? null : h13(RpHighRiskDialog, { onDismiss: dismissRpAlert }),
    h13(
      "div",
      {
        className: "dtv-launcher",
        "data-open": menuOpen,
        "data-side": placement.side,
        "data-vertical": placement.vertical,
        style: { left: placement.left / uiSettings.scale, top: placement.top / uiSettings.scale }
      },
      h13("div", { className: "dtv-ball-row" }, h13(
        "button",
        {
          className: "dtv-ball",
          type: "button",
          title: uiMessage("nav.launcher"),
          "aria-label": uiMessage("nav.launcher"),
          "aria-expanded": menuOpen,
          onPointerDown: startDrag,
          onPointerMove: moveDrag,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
          onClick: clickLauncher,
          onContextMenu: contextSwitchLauncher
        },
        h13("span", { key: chromeAnimation, className: "dtv-ball-face", "data-animate": chromeAnimation > 0, "aria-hidden": "true" }),
        h13("span", { className: "dtv-ball-label" }, "DT")
      )),
      h13(
        "div",
        { className: "dtv-menu", role: "menu" },
        h13("div", { className: "dtv-menu-title", "aria-live": "polite" }, chromeError === "" && statusError === "" ? uiMessage("nav.menuTitle", { session: sessionId || translate("nav.session.none") }) : uiMessage("nav.syncFailed", { message: chromeError || statusError })),
        h13(
          "button",
          {
            className: "dtv-menu-item",
            type: "button",
            role: "menuitem",
            title: chromeSwitchLabel,
            "aria-label": chromeSwitchLabel,
            "data-show-binding": false,
            onClick: switchChrome
          },
          h13("span", { "aria-hidden": "true" }, "\u2194"),
          h13(
            "span",
            { className: "dtv-item-copy" },
            h13("span", { className: "dtv-item-label" }, chromeSwitchLabel),
            h13("span", { className: "dtv-item-status" }, chromeStatusLabel)
          ),
          h13("span", { className: "dtv-item-planned" }, chromeMode === "play" ? "ST" : "DSH")
        ),
        ...TAVERN_MENU_ITEMS.filter((item) => !item.playOnly || chromeMode === "play").map((item) => {
          const status = statuses[item.id] ?? { bound: false, count: 0, titleKey: item.emptyTitleKey };
          const itemLabel = unwrapText(uiMessage(item.labelKey));
          const statusTitle = status.bound ? status.title : unwrapText(uiMessage(status.titleKey ?? item.emptyTitleKey));
          const stateLabel = item.binding === false ? "" : unwrapText(uiMessage(status.bound ? "common.bound" : "common.unbound"));
          const titleText = stateLabel ? uiMessage("nav.itemTitleBound", { label: itemLabel, title: statusTitle, state: stateLabel }) : uiMessage("nav.itemTitle", { label: itemLabel, title: statusTitle });
          const ariaText = stateLabel ? uiMessage("nav.itemAriaBound", { label: itemLabel, title: statusTitle, state: stateLabel }) : uiMessage("nav.itemAria", { label: itemLabel, title: statusTitle });
          return h13(
            "button",
            {
              className: "dtv-menu-item",
              type: "button",
              role: "menuitem",
              key: item.id,
              title: titleText,
              "data-available": item.available,
              "data-active": surface === item.id,
              "data-bound": item.binding === false ? void 0 : status.bound,
              "data-show-binding": item.binding !== false && item.showBinding !== false,
              "aria-current": surface === item.id ? "page" : void 0,
              "aria-label": ariaText,
              onClick: () => open(item.id)
            },
            item.binding === false ? h13("span", { "aria-hidden": "true" }) : h13("span", { className: "dtv-binding-dot", "aria-hidden": "true" }),
            h13(
              "span",
              { className: "dtv-item-copy" },
              h13("span", { className: "dtv-item-label" }, uiMessage(item.labelKey)),
              h13("span", { className: "dtv-item-status" }, status.bound ? rawText(status.title) : uiMessage(status.titleKey ?? item.emptyTitleKey))
            ),
            status.count > 1 ? h13("span", { className: "dtv-item-count", "aria-label": uiMessage("nav.bookCount", { count: status.count }) }, uiMessage("nav.bookCount", { count: status.count })) : item.available ? null : h13("span", { className: "dtv-item-planned" }, uiMessage("common.planned"))
          );
        })
      )
    )
  );
}
function installStyles5() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-shell"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-shell`;
  style.textContent = css11;
  document.head.append(style);
}
var name = PLUGIN_ID;
var inject = ["slots", "layout", "sessions", "workspaces"];
function apply2(ctx) {
  installPresetStyles();
  installCharacterStyles();
  installWorldBookStyles();
  installUserStyles();
  installTavernTraceStyles();
  installStyles5();
  registerTavernTraceView(ctx);
  const playClient = createLivePlayClient();
  const chrome = createChromeModeServiceCore({
    read: () => playClient.getChrome(),
    write: (mode) => playClient.putChrome(mode)
  });
  ctx.provide(CHROME_SERVICE_NAME, chrome.face);
  ctx.effect(() => {
    const stopTransport = startChromeModeTransport({
      face: chrome.face,
      internal: chrome.internal,
      eventsUrl: playClient.chromeEventsUrl
    });
    return () => {
      stopTransport();
      chrome.internal.dispose();
    };
  }, "dsh-tavern: chrome mode service transport");
  const playSlots = installPlaySlotOccupancy(ctx, playClient);
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: `${PLUGIN_ID}-launcher`,
    order: 80,
    inject: () => ({
      playClient,
      chromeService: chrome.face,
      playSlots,
      createCleanSession: ({ workspaceId, source }) => createCleanSessionWorkflow({
        workspaceId,
        source,
        preview: (selectedSource) => sessionConfigurationRequest("/session-configurations/preview", { source: selectedSource }),
        connectWorkspace: (id) => ctx.workspaces.connectWorkspace(id),
        applySelection: (targetSessionId, selectedSource) => sessionConfigurationRequest("/session-configurations/apply", {
          targetSessionId,
          source: selectedSource
        }),
        openSession: (id) => ctx.sessions.open(id),
        refresh: () => window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
      })
    })
  }, TavernShell));
}
/*! Bundled license information:

showdown/dist/showdown.js:
  (*! showdown v 2.1.0 - 21-04-2022 *)

dompurify/dist/purify.es.mjs:
  (*! @license DOMPurify 3.4.14 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.14/LICENSE *)
*/

		return module.exports;
	}
});
