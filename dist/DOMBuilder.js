/**
 * DOMBuilder 2.0.0 (modes: dom [default], html) - https://github.com/insin/DOMBuilder
 * MIT licensed
 */
(function(__global__) {

// --------------------------------------------------------------- Utilities ---

var modules = !!(typeof module != 'undefined' && module.exports)
  // Native functions
  , toString = Object.prototype.toString
  , slice = Array.prototype.slice
  , splice = Array.prototype.splice
  /**
   * @const
   * @type {boolean}
   */
  , JQUERY_AVAILABLE = (typeof jQuery != 'undefined')
  /**
   * Attribute names corresponding to event handlers.
   * @const
   * @type {Object.<string, boolean>}
   */
  , EVENT_ATTRS = (JQUERY_AVAILABLE
        ? jQuery.attrFn
        : lookup(('blur focus focusin focusout load resize scroll unload ' +
                  'click dblclick mousedown mouseup mousemove mouseover ' +
                  'mouseout mouseenter mouseleave change select submit ' +
                  'keydown keypress keyup error').split(' ')))
  /**
   * Element name for fragments.
   * @const
   * @type {string}
   */
  , FRAGMENT_NAME = '#document-fragment'
  /**
   * Tag names defined in the HTML 4.01 Strict and Frameset DTDs and new elements
   * from HTML5.
   * @const
   * @type {Array.<string>}
   */
  , TAG_NAMES = ('a abbr acronym address area article aside audio b bdi bdo big ' +
    'blockquote body br button canvas caption cite code col colgroup command ' +
    'datalist dd del details dfn div dl dt em embed fieldset figcaption figure ' +
    'footer form frame frameset h1 h2 h3 h4 h5 h6 hr head header hgroup html i ' +
    'iframe img input ins kbd keygen label legend li link map mark meta meter ' +
    'nav noscript ' /* :) */ + 'object ol optgroup option output p param pre ' +
    'progress q rp rt ruby samp script section select small source span strong ' +
    'style sub summary sup table tbody td textarea tfoot th thead time title tr ' +
    'track tt ul var video wbr').split(' ')
  /**
   * Cross-browser means of setting innerHTML on a DOM Element.
   * @param {Element} el
   * @param {string} html
   */
  , setInnerHTML = (JQUERY_AVAILABLE
        ? function(el, html) { jQuery(el).html(html); }
        : function(el, html) {
            try {
              el.innerHTML = html;
            } catch (e) {
              var div = document.createElement('div');
              div.innerHTML = html;
              while (el.firstChild)
                el.removeChild(el.firstChild);
              while (div.firstChild)
                el.appendChild(div.firstChild);
            }
          })
  ;

/**
 * Naively copies properties from one Object to another.
 * @param {Object} dest the destination Object.
 * @param {Object} source the source Object.
 * @return {Object} dest the destination Object.
 */
function extend(dest, source) {
  for (var name in source) {
    dest[name] = source[name];
  }
  return dest;
}

/**
 * Creates a lookup Object from an Array of Strings.
 * @param {Array.<string>} a
 * @return {Object.<string, boolean>}
 */
function lookup(a) {
  var obj = {}
    , i = 0
    , l = a.length
    ;
  for (; i < l; i++) {
    obj[a[i]] = true;
  }
  return obj;
}

/**
 * Uses a dummy constructor to make a child constructor inherit from a
 * parent constructor.
 * @param {Function} child
 * @param {Function} parent
 */
function inheritFrom(child, parent) {
  /** @constructor */
  function F() {};
  F.prototype = parent.prototype;
  child.prototype = new F();
  child.prototype.constructor = child;
}

/**
 * @param {*} o
 * @return {boolean} true if the given object is an Array.
 */
function isArray(o) {
  return (toString.call(o) == '[object Array]');
}

/**
 * @param {*} o
 * @return {boolean} true if the given object is a Function.
 */
function isFunction(o) {
  return (toString.call(o) == '[object Function]');
}

/**
 * @param {*} o
 * @return {boolean} true if the given object is a String.
 */
function isString(o) {
  return (toString.call(o) == "[object String]");
}

/**
 * Flattens an Array in-place, replacing any Arrays it contains with their
 * contents, and flattening their contents in turn.
 * @param {Array} a
 * @return {Array} the flattened array.
 */
function flatten(a) {
  for (var i = 0, l = a.length, c; i < l; i++) {
    c = a[i];
    if (isArray(c)) {
      // Make sure we loop to the Array's new length
      l += c.length - 1;
      // Replace the current item with its contents
      splice.apply(a, [i, 1].concat(c));
      // Stay on the current index so we continue looping at the first
      // element of the array we just spliced in or removed.
      i--;
    }
  }
  // We flattened in-place, but return for chaining
  return a;
}

// ---------------------------------------------------------- Core utilities ---

/**
 * Distinguishes between Objects which represent attributes and Objects which
 * are created by output modes as elements.
 * @param {*} o the potential Object to be checked.
 * @param {?string=} mode the current mode being used to create content.
 * @return {boolean} false if given something which is not an Object or is an
 *    Object created by an ouput mode.
 */
function isPlainObject(o, mode) {
  return (!!o &&
          toString.call(o) == '[object Object]' &&
          (!mode || !DOMBuilder.modes[mode].isModeObject(o)));
}

/**
 * Distinguishes between Arrays which represent elements and Arrays which
 * represent their contents.
 * @param {*} o the potential Array to be checked.
 * @return {boolean} false if given something which is not an Array or is an
 *    Array which represents an element.
 */
function isPlainArray(o) {
  return (toString.call(o) == '[object Array]' &&
          typeof o.isElement == 'undefined');
}

/**
 * Adds a property to an Array indicating that it represents an element.
 * @param {Array} a
 * @return {Array} the given array.
 */
function elementArray(a) {
  a.isElement = true;
  return a;
}

// ---------------------------------- Element Creation Convenience Functions ---

/**
 * Creates on Object containing element creation functions with the given fixed
 * mode, if one is given.
 * @param {?string=} mode
 * @return {Object.<string, Function>}
 */
function createElementFunctions(mode) {
  var obj = {};
  for (var i = 0, tag; tag = TAG_NAMES[i]; i++) {
    obj[tag.toUpperCase()] = createElementFunction(tag, mode);
  }
  return obj;
}

/**
 * Creates a function which, when called, uses DOMBuilder to create an element
 * with the given tagName.
 *
 * The resulting function will also have a map function which calls
 * DOMBuilder.map with the given tagName and mode, if one is provided.
 *
 * @param {string} tag
 * @param {?string=} fixedMode
 * @return {function(...[*])}
 */
function createElementFunction(tag, fixedMode) {
  var elementFunction = function() {
    if (!arguments.length) {
      var mode = (typeof fixedMode != 'undefined'
                  ? fixedMode
                  : DOMBuilder.mode);
      // Short circuit if there are no arguments, to avoid further
      // argument inspection.
      if (mode) {
        return DOMBuilder.modes[mode].createElement(tag, {}, []);
      }
      return elementArray([tag]);
    }
    else {
      return createElementFromArguments(tag, fixedMode, slice.call(arguments));
    }
  };

  elementFunction.map = function() {
    return mapElementFromArguments(tag, fixedMode, slice.call(arguments));
  };

  return elementFunction;
}

/**
 * Normalises a list of arguments in order to create a new element using
 * DOMBuilder.createElement. Supported argument formats are:
 *
 * (attributes, child1, ...)
 *    an attributes object followed by an arbitrary number of children.
 * (attributes, [child1, ...])
 *    an attributes object and an Array of children.
 * (child1, ...)
 *    an arbitrary number of children.
 * ([child1, ...])
 *    an Array of children.
 *
 * At least one argument *must* be provided.
 *
 * @param {string} tagName
 * @param {?string|undefined} fixedMode
 * @param {Array} args
 * @return {*}
 */
function createElementFromArguments(tagName, fixedMode, args) {
  var attributes
    , children
      // The short circuit in createElementFunction ensures we will
      // always have at least one argument when called via element creation
      // functions.
    , argsLength = args.length
    , firstArg = args[0]
    ;

  if (argsLength === 1 &&
      isPlainArray(firstArg)) {
    children = firstArg; // ([child1, ...])
  }
  else if (isPlainObject(firstArg, (typeof fixedMode != 'undefined'
                                    ? fixedMode
                                    : DOMBuilder.mode))) {
    attributes = firstArg;
    children = (argsLength == 2 && isPlainArray(args[1])
                ? args[1]         // (attributes, [child1, ...])
                : args.slice(1)); // (attributes, child1, ...)
  }
  else {
    children = args; // (child1, ...)
  }

  return DOMBuilder.createElement(tagName, attributes, children, fixedMode);
}

/**
 * Normalises a list of arguments in order to create new elements using
 * DOMBuilder.map.
 *
 * Supported argument formats are:
 *
 * (defaultAttributes, [item1, ...], mappingFunction)
 *    a default attributes attributes object, a list of items and a mapping
 *    Function.
 * ([item1, ...], mappingFunction)
 *    a list of items and a mapping Function.
 *
 * @param {string} tagName
 * @param {?string|undefined} fixedMode
 * @param {Array} args
 * @return {Array}
 */
function mapElementFromArguments(tagName, fixedMode, args) {
  if (isPlainArray(args[0])) { // (items, func)
    var defaultAttrs = {}
      , items = args[0]
      , func = (isFunction(args[1]) ? args[1] : null)
      ;
  }
  else { // (attrs, items, func)
    var defaultAttrs = args[0]
      , items = args[1]
      , func = (isFunction(args[2]) ? args[2] : null)
      ;
  }

  return DOMBuilder.map(tagName, defaultAttrs, items, func, fixedMode);
}

/**
 * Creates an object with loops status details based on the current index and
 * total length.
 * @param {number} i
 * @param {number} l
 * @return {Object}
 */
function loopStatus(i, l) {
  return {
    index: i
  , first: i == 0
  , last: i == l - 1
  };
}

// === DOMBuilder API ==========================================================

var DOMBuilder = {
  version: '2.0.0'

// ------------------------------------------------------------------- Modes ---

  /**
   * Determines which mode content creation functions will operate in by
   * default.
   * @type {string}
   */
, mode: null

  /**
   * Additional modes registered using addMode.
   * @type {Object.<string, Object>}
   */
, modes: {}

  /**
   * Adds a new mode and exposes an API for it on the DOMBuilder object with the
   * mode's name.
   *
   * Modes are defined as an Object with the following properties.
   *
   * name
   *    the mode's name.
   * createElement(tagName, attributes, children)
   *    a Function which takes a tag name, attributes object and list of children
   *    and returns a content object.
   * fragment(children)
   *    a Function which takes a list of children and returns a content fragment.
   * isModeObject(object) (optional)
   *    a Function which can be used to eliminate false positives when DOMBuilder
   *    is trying to determine whether or not an attributes object was given - it
   *    should return true if given a mode-created content object.
   * api (optional)
   *    an Object defining a public API for the mode's implementation, exposing
   *    variables, functions and constructors used in implementation which may be
   *    of interest to anyone who wants to make use of the mode's internals.
   * apply (optional)
   *    an Object defining additional properties to be added to the object
   *    DOMBuilder creates for easy access to mode-specific element functions.
   * @param {Object} mode
   */
, addMode: function(mode) {
    mode = extend({
      isModeObject: function() { return false; }, api: {}, apply: {}
    }, mode);
    // Store the mode for later use of its content creation functions
    this.modes[mode.name] = mode;
    // Expose mode-specific element creation functions and the mode's exported
    // API as a DOMBuilder.<mode name> property.
    this[mode.name] = extend(createElementFunctions(mode.name), mode.apply);
    // If there is no default mode set, use the first mode added as the default
    if (this.mode === null) {
      this.mode = mode.name;
    }
  }

  /**
   * Calls a function using DOMBuilder temporarily in the given mode and
   * returns its output. Any additional arguments provided will be passed to
   * the function when it is called.
   * @param {string} mode
   * @param {Function} func
   * @return {*}
   */
, withMode: function(mode, func) {
    var originalMode = this.mode;
    this.mode = mode;
    try {
      return func.apply(null, slice.call(arguments, 2));
    }
    finally {
      this.mode = originalMode;
    }
  }

  /**
   * Element creation functions which create contents according to
   * DOMBuilder.mode.
   * @type {Object.<string, Object>}
   */
, elements: createElementFunctions()

  /**
   * Element creation functions which create nested Array contents.
   * @type {Object.<string, Object>}
   */
, array: createElementFunctions(null)

  /**
   * Adds element functions to a given context Object. If a valid mode argument
   * is given, mode-specific element functions are added, as well as any
   * additional functions specified for application by the mode.
   * @param {Object} context
   * @param {string=} mode
   * @return {Object} the object the functions were added to.
   */
, apply: function(context, mode) {
    if (mode && this.modes[mode]) {
      extend(context, this[mode]);
    }
    else {
      extend(context, this.elements);
    }
    return context;
  }

// -------------------------------------------------------- Content Creation ---

  /**
   * Generates content from a nested list using the given output mode, where
   * each list item and nested child item must be in one of the following
   * formats:
   *
   * [tagName[, attributes], child1, ...]
   *    a tag name, optional attributes Object and an arbitrary number of
   *    child elements.
   * ['#document-fragment', child1, ...]
   *    a fragment name and an arbitrary number of child elements.
   *
   * @param {Array} content
   * @param {string=} mode
   * @return {*}
   */
, build: function(content, mode) {
    mode = mode || this.mode;
    var elementName = content[0]
      , isFragment = (elementName == FRAGMENT_NAME)
      , attrs = (!isFragment && isPlainObject(content[1], mode)
                 ? content[1]
                 : null)
      , childStartIndex = (attrs === null ? 1 : 2)
      , l = content.length
      , built = []
      , item
      ;
    for (var i = childStartIndex; i < l; i++) {
      item = content[i];
      if (isArray(item)) {
        built.push(this.build(item, mode));
      }
      else {
        built.push(item);
      }
    }
    return (isFragment
            ? this.modes[mode].fragment(built)
            : this.modes[mode].createElement(elementName, attrs, built));
  }

  /**
   * Creates an element with the given tag name and, optionally, the given
   * attributes and children.
   * @param {string} tagName
   * @param {Object} attributes
   * @param {Array} children
   * @param {string=} mode
   */
, createElement: function(tagName, attributes, children, mode) {
    attributes = attributes || {};
    children = children || [];
    mode = (typeof mode != 'undefined' ? mode : this.mode);
    if (mode) {
      flatten(children);
      return this.modes[mode].createElement(tagName, attributes, children);
    }
    else {
      var arrayOutput = [tagName];
      for (var attr in attributes) {
        arrayOutput.push(attributes);
        break;
      }
      if (children.length) {
        arrayOutput = arrayOutput.concat(children);
      }
      return elementArray(arrayOutput);
    }
  }

  /**
   * Creates an element for (potentially) every item in a list.
   *
   * Arguments are as follows:
   *
   * tagName
   *    the name of the element to create for each item in the list.
   * defaultAttrs
   *    default attributes for the element.
   * items
   *    the list of items to use as the basis for creating elements.
   * mappingFunction (optional)
   *    a function to be called with each item in the list to provide
   *    contents for the element which will be created for that item.
   *
   *    If provided, the function will be called with the following
   *    arguments::
   *
   *       mappingFunction(item, attributes, loopsStatus)
   *    Contents returned by the mapping function can consist of a single
   *    value or a mixed Array.
   *
   *    Attributes on the element which will be created can be altered by
   *    modifying the attributes argument, which will initially contain
   *    the contents of defaultAttributes, if it was provided.
   *
   *    The loopStatus argument is an Object with the following properties:
   *
   *       index
   *          0-based index of the current item in the list.
   *       first``
   *         true if the current item is the first in the list.
   *       last
   *         true if the current item is the last in the list.
   *
   *    The mapping function can prevent an element being generated for a
   *    given item by returning null.
   *
   *    If a mapping function is not provided, a new element will be created
   *    for each item in the list and the item itself will be used as the
   *    contents.
   * mode (optional)
   *    an override for the DOMBuilder mode used for this call.
   *
   * @param {string} tagName
   * @param {Object} defaultAttrs
   * @param {Array} items
   * @param {Function=} func
   * @param {string=} mode
   */
, map: function(tagName, defaultAttrs, items, func, mode) {
    var results = [];
    for (var i = 0, l = items.length, attrs, children; i < l; i++) {
      attrs = extend({}, defaultAttrs);
      // If we were given a mapping function, call it and use the
      // return value as the contents, unless the function specifies
      // that the item shouldn't generate an element by explicity
      // returning null.
      if (func != null) {
        if (typeof mode != 'undefined') {
          children = DOMBuilder.withMode(mode, func, items[i], attrs,
                                         loopStatus(i, l));
        }
        else {
          children = func(items[i], attrs, loopStatus(i, l));
        }
        if (children === null) {
          continue;
        }
      }
      else {
        // If we weren't given a mapping function, use the item as the
        // contents.
        var children = items[i];
      }

      // Ensure children are in an Array, as required by createElement
      if (!isPlainArray(children)) {
        children = [children];
      }

      results.push(this.createElement(tagName, attrs, children, mode));
    }
    return results;
  }

  /**
   * Creates a fragment with the given children. Supported argument formats are:
   *
   * (child1, ...)
   *    an arbitrary number of children.
   * ([child1, ...])
   *    an Array of children.
   *
   * In DOM mode, a DocumentFragment conveniently allows you to append its
   * contents with a single call. If you're thinking of adding a wrapper
   * <div> solely to be able to insert a number of sibling elements at the
   * same time, a DocumentFragment will do the same job without the need for
   * the redundant wrapper element.
   *
   * See http://ejohn.org/blog/dom-documentfragments/ for more information
   * about DocumentFragment objects.
   *
   * @param {...[*]} args
   * @return {*}
   */
, fragment: (function() {
    var fragment = function() {
      var children;
      if (arguments.length === 1 &&
          isPlainArray(arguments[0])) {
        children = arguments[0]; // ([child1, ...])
      }
      else {
        children = slice.call(arguments); // (child1, ...)
      }

      if (this.mode) {
        // Inline the contents of any child Arrays
        flatten(children);
        return this.modes[this.mode].fragment(children);
      }
      else {
        return elementArray([FRAGMENT_NAME].concat(children));
      }
    };

    /**
     * Creates a fragment wrapping content created for every item in a
     * list.
     *
     * Arguments are as follows:
     *
     * items
     *    the list of items to use as the basis for creating fragment
     *    contents.
     * mappingFunction
     *    a function to be called with each item in the list, to provide
     *    contents for the fragment.
     *
     *    Contents can consist of a single value or a mixed Array.
     *
     *    The function will be called with the following arguments::
     *
     *       func(item, itemIndex)
     *
     *    The function can indicate that the given item shouldn't generate
     *    any content for the fragment by returning null.
     *
     * @param {Array} items
     * @param {Function=} func
     */
    fragment.map = function(items, func) {
      // If we weren't given a mapping function, the user may as well just
      // have created a fragment directly, as we're just wrapping content
      // here, not creating it.
      if (!isFunction(func)) {
        return DOMBuilder.fragment(items);
      }

      var results = [];
      for (var i = 0, l = items.length, children; i < l; i++) {
        // Call the mapping function and add the return value to the
        // fragment contents, unless the function specifies that the item
        // shouldn't generate content by explicity returning null.
        children = func(items[i], loopStatus(i, l));
        if (children === null) {
          continue;
        }
        results = results.concat(children);
      }
      return DOMBuilder.fragment(results);
    };

    return fragment;
  })()

  /* Exposes utilities for use in mode plugins. */
, util: {
    EVENT_ATTRS: EVENT_ATTRS
  , FRAGMENT_NAME: FRAGMENT_NAME
  , JQUERY_AVAILABLE: JQUERY_AVAILABLE
  , TAG_NAMES: TAG_NAMES
  , extend: extend
  , lookup: lookup
  , inheritFrom: inheritFrom
  , isArray: isArray
  , isFunction: isFunction
  , isString: isString
  , flatten: flatten
  , setInnerHTML: setInnerHTML
  }
};

// Export DOMBuilder or expose it to the global object
if (modules) {
  module.exports = DOMBuilder;
}
else {
  __global__.DOMBuilder = DOMBuilder;
}

})(this);
(function(__global__) {

// --------------------------------------------------------------- Utilities ---

var modules = !!(typeof module !== 'undefined' && module.exports)
  , DOMBuilder = (modules ? require('./DOMBuilder') : __global__.DOMBuilder)
  , document = __global__.document
  // Native functions
  , hasOwn = Object.prototype.hasOwnProperty
  // DOMBuilder utilities
  , EVENT_ATTRS = DOMBuilder.util.EVENT_ATTRS
  , JQUERY_AVAILABLE = DOMBuilder.util.JQUERY_AVAILABLE
  , setInnerHTML = DOMBuilder.util.setInnerHTML
  /**
   * Cross-browser means of creating a DOM Element with attributes.
   * @param {string} tagName
   * @param {Object} attributes
   * @return {Element}
   */
  , createElement = (JQUERY_AVAILABLE
      ? function(tagName, attributes) {
          if (hasOwn.call(attributes, 'innerHTML')) {
            var html = attributes.innerHTML;
            delete attributes.innerHTML;
            return jQuery('<' + tagName + '>', attributes).html(html).get(0);
          }
          else {
            return jQuery('<' + tagName + '>', attributes).get(0);
          }
        }
      : (function() {
          var attrFix = {
                tabindex: 'tabIndex'
              }
            , propFix = {
                tabindex: 'tabIndex'
              , readonly: 'readOnly'
              , 'for': 'htmlFor'
              , 'class': 'className'
              , maxlength: 'maxLength'
              , cellspacing: 'cellSpacing'
              , cellpadding: 'cellPadding'
              , rowspan: 'rowSpan'
              , colspan: 'colSpan'
              , usemap: 'useMap'
              , frameborder: 'frameBorder'
              , contenteditable: 'contentEditable'
              }
            , support = (function() {
                var div = document.createElement('div');
                div.setAttribute('className', 't');
                div.innerHTML = '<span style="color:silver">s<span>';
                var span = div.getElementsByTagName('span')[0];
                var input = document.createElement('input');
                input.value = 't';
                input.setAttribute('type', 'radio');
                return {
                  style: /silver/.test(span.getAttribute('style'))
                , getSetAttribute: div.className != 't'
                , radioValue: input.value == 't'
                }
              })()
            , formHook
            // Hook for boolean attributes
            , boolHook = function(elem, value, name) {
                var propName;
                if (value !== false) {
                  // value is true since we know at this point it's type boolean and not false
                  // Set boolean attributes to the same name and set the DOM property
                  propName = propFix[name] || name;
                  if (propName in elem) {
                    // Only set the IDL specifically if it already exists on the element
                    elem[propName] = true;
                  }
                  elem.setAttribute(name, name.toLowerCase());
                }
                return name;
              }
            , attrHooks = {
                type: function(elem, value) {
                  if (!support.radioValue && value == 'radio' && elem.nodeName == 'input') {
                    // Setting the type on a radio button after the value resets the value in IE6-9
                    // Reset value to its default in case type is set after value
                    var val = elem.value;
                    elem.setAttribute('type', value);
                    if (val) {
                      elem.value = val;
                    }
                    return value;
                  }
                }
                // Use the value property for back compat
                // Use the formHook for button elements in IE6/7
              , value: function(elem, value, name) {
                  if (formHook && elem.nodeName == 'button') {
                    return formHook.set(elem, value, name);
                  }
                  // Does not return so that setAttribute is also used
                  elem.value = value;
                }
              }
            , rboolean = /^(?:autofocus|autoplay|async|checked|controls|defer|disabled|hidden|loop|multiple|open|readonly|required|scoped|selected)$/i
            , rinvalidChar = /\:|^on/
            ;

          // IE6/7 do not support getting/setting some attributes with get/setAttribute
          if (!support.getSetAttribute) {
            // propFix is more comprehensive and contains all fixes
            attrFix = propFix;

            // Use this for any attribute on a form in IE6/7
            formHook = attrHooks.name = attrHooks.title = function(elem, value, name) {
              // Check form objects in IE (multiple bugs related)
              // Only use nodeValue if the attribute node exists on the form
              var ret = elem.getAttributeNode(name);
              if (ret) {
                ret.nodeValue = value;
                return value;
              }
            };

            // Set width and height to auto instead of 0 on empty string( Bug #8150 )
            // This is for removals
            attrHooks.width = attrHooks.height = function(elem, value) {
              if (value === '') {
                elem.setAttribute(name, 'auto');
                return value;
              }
            };
          }

          if (!support.style) {
            attrHooks.style = function(elem, value) {
              return (elem.style.cssText = ''+value);
            };
          }

          function setAttr(elem, name, value, pass) {
            // Fallback to prop when attributes are not supported
            if (!('getAttribute' in elem)) {
              // Inlined version of the relevant bits of prop
              name = propFix[name] || name;
              if (value !== undefined) {
                return (elem[name] = value);
              }
              return;
            }

            var ret, hook;
            // Normalize the name if needed
            name = attrFix[name] || name;
            var hook = attrHooks[name];

            if (!hook) {
              // Use boolHook for boolean attributes
              if (rboolean.test(name)) {
                hook = boolHook;
              }
              // Use formHook for forms and if the name contains certain characters
              else if (formHook && name != 'className' &&
                (elem.nodeName == 'form' || rinvalidChar.test(name))) {
                hook = formHook;
              }
            }

            if (value !== undefined ) {
              if (hook && (ret = hook(elem, value, name)) !== undefined) {
                return ret;
              }
              else {
                elem.setAttribute(name, ''+value );
                return value;
              }
            }
          }

          return function(tagName, attributes) {
            var el = document.createElement(tagName)
              , name
              , value
              ;
            if (hasOwn.call(attributes, 'innerHTML')) {
                setInnerHTML(el, attributes.innerHTML);
                delete attributes.innerHTML;
            }
            for (name in attributes) {
              value = attributes[name];
              if (EVENT_ATTRS[name]) {
                el['on' + name] = value;
              }
              else {
                setAttr(el, name, value);
              }
            }
            return el;
          };
        })())
  ;

// === Register mode plugin ====================================================

DOMBuilder.addMode({
  name: 'dom'
, createElement: function(tagName, attributes, children) {
    var hasInnerHTML = hasOwn.call(attributes, 'innerHTML')
      // Create the element and set its attributes and event listeners
      , el = createElement(tagName, attributes)
      ;

    // If content was set via innerHTML, we're done...
    if (!hasInnerHTML) {
      // ...otherwise, append children
      for (var i = 0, l = children.length, child; i < l; i++) {
        child = children[i];
        if (child && child.nodeType) {
          el.appendChild(child);
        }
        else {
          el.appendChild(document.createTextNode(''+child));
        }
      }
    }
    return el;
  }
, fragment: function(children) {
    var fragment = document.createDocumentFragment();
    for (var i = 0, l = children.length, child; i < l; i++) {
      child = children[i];
      if (child.nodeType) {
        fragment.appendChild(child);
      }
      else {
        fragment.appendChild(document.createTextNode(''+child));
      }
    }
    return fragment;
  }
, isModeObject: function(obj) {
    return !!obj.nodeType;
  }
, api: {
    createElement: createElement
  }
});

})(this);
(function(__global__) {

// --------------------------------------------------------------- Utilities ---

var modules = !!(typeof module !== 'undefined' && module.exports)
  , DOMBuilder = (modules ? require('./DOMBuilder') : __global__.DOMBuilder)
  // Native functions
  , hasOwn = Object.prototype.hasOwnProperty
  , splice = Array.prototype.splice
  // DOMBuilder utilities
  , EVENT_ATTRS = DOMBuilder.util.EVENT_ATTRS
  , FRAGMENT_NAME = DOMBuilder.util.FRAGMENT_NAME
  , JQUERY_AVAILABLE = DOMBuilder.util.JQUERY_AVAILABLE
  , TAG_NAMES = DOMBuilder.util.TAG_NAMES
  , extend = DOMBuilder.util.extend
  , inheritFrom = DOMBuilder.util.inheritFrom
  , lookup = DOMBuilder.util.lookup
  , setInnerHTML = DOMBuilder.util.setInnerHTML
  /**
   * Lookup for known tag names.
   * @const
   * @type {Object.<string, boolean>}
   */
  , TAG_NAME_LOOKUP = lookup(TAG_NAMES)
  /**
   * Lookup for tags defined as EMPTY in the HTML 4.01 Strict and Frameset DTDs
   * and in the HTML5 spec.
   * @const
   * @type {Object.<string, boolean>}
   */
  , EMPTY_TAGS = lookup(('area base br col command embed frame hr input img ' +
                         'keygen link meta param source track wbr').split(' '))
  /**
   * Cross-browser event registration.
   * @param {string} id
   * @param {string} event
   * @param {Function} handler
   */
  , addEvent = (JQUERY_AVAILABLE
      ? function(id, event, handler) { jQuery('#' + id)[event](handler); }
      : function(id, event, handler) {
          document.getElementById(id)['on' + event] = handler;
        })
  ;

// ----------------------------------------------------------- HTML Escaping ---

/**
 * String subclass which marks the given string as safe for inclusion
 * without escaping.
 * @constructor
 * @extends {String}
 * @param {string} value
 */
function SafeString(value) {
  this.value = value;
}
inheritFrom(SafeString, String);

/**
 * @return {string}
 */
SafeString.prototype.toString = SafeString.prototype.valueOf = function() {
  return this.value;
};

/**
 * Marks a string as safe
 * @param {string} value
 * @return {SafeString}
 */
function markSafe(value) {
  return new SafeString(value);
}

/**
 * Determines if a string is safe.
 * @param {string|SafeString} value
 * @return {boolean}
 */
function isSafe(value) {
  return (value instanceof SafeString);
}

/**
 * Escapes sensitive HTML characters.
 * @param {string} s
 * @return {string}
 */
function escapeHTML(s) {
  return s.split('&').join('&amp;')
           .split('<').join('&lt;')
            .split('>').join('&gt;')
             .split('"').join('&quot;')
              .split("'").join('&#39;');
}

/**
 * If the given input is a SafeString, returns its value; otherwise, coerces
 * to String and escapes.
 * @param {*} html
 * @return {string}
 */
function conditionalEscape(html) {
  if (html instanceof SafeString) {
    return html.value;
  }
  return escapeHTML(''+html);
}

// ------------------------------------------------------- Mock DOM Elements ---

/**
 * Partially emulates a DOM Node for HTML generation.
 * @constructor
 * @param {Array=} childNodes
 */
function HTMLNode(childNodes) {
  /**
   * @type {Array}
   */
  this.childNodes = childNodes || [];

  // Ensure MockFragment contents are inlined, as if this object's child
  // nodes were appended one-by-one.
  this._inlineFragments();
}
inheritFrom(HTMLNode, Object);

/**
 * Replaces any MockFragment objects in child nodes with their own
 * child nodes and empties the fragment.
 * @private
 */
HTMLNode.prototype._inlineFragments = function() {
  for (var i = 0, l = this.childNodes.length, child; i < l; i++) {
    child = this.childNodes[i];
    if (child instanceof MockFragment) {
      // Replace the fragment with its contents
      splice.apply(this.childNodes, [i, 1].concat(child.childNodes));
      // Clear the fragment on append, as per DocumentFragment
      child.childNodes = [];
    }
  }
};

/**
 * Emulates appendChild, inserting fragment child node contents and
 * emptying the fragment if one is given.
 * @param {*} node
 */
HTMLNode.prototype.appendChild = function(node) {
  if (node instanceof MockFragment) {
    this.childNodes = this.childNodes.concat(node.childNodes);
    // Clear the fragment on append, as per DocumentFragment
    node.childNodes = [];
  }
  else {
    this.childNodes.push(node);
  }
};

/**
 * Emulates cloneNode so cloning of MockFragment objects works
 * as expected.
 * @param {boolean} deep
 * @return {HTMLNode}
 */
HTMLNode.prototype.cloneNode = function(deep) {
  var clone = this._clone();
  if (deep === true)
  {
    for (var i = 0, l = this.childNodes.length, node; i < l; i++) {
      node = this.childNodes[i];
      if (node instanceof MockElement) {
        clone.childNodes.push(node.cloneNode(deep));
      }
      else {
        clone.childNodes.push(node);
      }
    }
  }
  return clone;
};

/**
 * Creates the object to be used for deep cloning.
 * @protected
 */
HTMLNode.prototype._clone = function() {
  return new Node();
};

/**
 * Partially emulates a DOM Element for HTML generation.
 * @constructor
 * @extends {HTMLNode}
 * @param {string} tagName
 * @param {Object=} attributes
 * @param {Array=} childNodes
 */
function MockElement(tagName, attributes, childNodes) {
  HTMLNode.call(this, childNodes);
  /** @type {string} */
  this.tagName = this.nodeName = tagName.toLowerCase();
  /** @type {Object} */
  this.attributes = attributes || {};
}
inheritFrom(MockElement, HTMLNode);
/** @type {number} */
MockElement.eventTrackerId = 1;
/** @type {number} */
MockElement.prototype.nodeType = 1;
/**
 * @protected
 * @return {MockElement}
 */
MockElement.prototype._clone = function() {
  return new MockElement(this.tagName, extend({}, this.attributes));
};

/**
 * Creates an HTML representation of an MockElement.
 *
 * If true is passed as an argument and any event attributes are found, this
 * method will ensure the resulting element has an id so  the handlers for the
 * event attributes can be registered after the element has been inserted into
 * the document via innerHTML.
 *
 * If necessary, a unique id will be generated.
 *
 * @param {boolean=} trackEvents
 * @return {string}
 */
MockElement.prototype.toString = function(trackEvents) {
  trackEvents = (typeof trackEvents != 'undefined' ? trackEvents : false);
  var tagName = (TAG_NAME_LOOKUP[this.tagName]
                 ? this.tagName
                 : conditionalEscape(this.tagName))
      // Opening tag
    , parts = ['<' + tagName]
    , attr
    ;
  // Tag attributes
  for (attr in this.attributes) {
    // innerHTML is a special case, as we can use it to (perhaps
    // inadvisedly) specify entire contents as a string.
    if (attr === 'innerHTML') {
      continue;
    }
    // Don't create attributes which wouldn't make sense in HTML mode when the
    // DOM is available - they can be dealt with after insertion using
    // addEvents().
    if (EVENT_ATTRS[attr]) {
      if (trackEvents === true && !this.eventsFound) {
        /** @type {boolean|undefined} */
        this.eventsFound = true;
      }
      continue;
    }
    parts.push(' ' + conditionalEscape(attr.toLowerCase()) + '="' +
               conditionalEscape(this.attributes[attr]) + '"');
  }
  if (this.eventsFound && !hasOwn.call(this.attributes, 'id')) {
    // Ensure an id is present so we can grab this element later
    this.id  = '__DB' + MockElement.eventTrackerId++ + '__';
    parts.push(' id="' + this.id + '"');
  }
  parts.push('>');

  if (EMPTY_TAGS[tagName]) {
    return parts.join('');
  }

  // If innerHTML was given, use it exclusively for the contents
  if (hasOwn.call(this.attributes, 'innerHTML')) {
    parts.push(this.attributes.innerHTML);
  }
  else {
    for (var i = 0, l = this.childNodes.length, node; i < l; i++) {
      node = this.childNodes[i];
      if (node instanceof MockElement || node instanceof SafeString) {
        parts.push(node.toString(trackEvents));
      }
      else {
        // Coerce to string and escape
        parts.push(escapeHTML(''+node));
      }
    }
  }

  // Closing tag
  parts.push('</' + tagName + '>');
  return parts.join('');
};

/**
 * If event attributes were found when toString(true) was called, this
 * method will retrieve the resulting DOM Element by id, attach event handlers
 * to it and call addEvents on any MockElement children.
 */
MockElement.prototype.addEvents = function() {
  if (this.eventsFound) {
    var id = (hasOwn.call(this.attributes, 'id')
              ? conditionalEscape(this.attributes.id)
              : this.id)
      , attr
      ;
    for (attr in this.attributes) {
      if (EVENT_ATTRS[attr]) {
        addEvent(id, attr, this.attributes[attr]);
      }
    }
    delete this.eventsFound;
    delete this.id;
  }

  for (var i = 0, l = this.childNodes.length, node; i < l; i++) {
    node = this.childNodes[i];
    if (node instanceof MockElement) {
      node.addEvents();
    }
  }
};

/**
 * @param {Element} el
 */
MockElement.prototype.insertWithEvents = function(el) {
  setInnerHTML(el, this.toString(true));
  this.addEvents();
};

/**
 * Partially emulates a DOM DocumentFragment for HTML generation.
 * @constructor
 * @extends {HTMLNode}
 * @param {Array=} childNodes
 */
function MockFragment(childNodes) {
  HTMLNode.call(this, childNodes);
}
inheritFrom(MockFragment, HTMLNode);
/**
 * @protected
 * @return {MockFragment}
 */
MockFragment.prototype._clone = function() {
  return new MockFragment();
};
/** @type {number} */
MockFragment.prototype.nodeType = 11;
/** @type {string} */
MockFragment.prototype.nodeName = FRAGMENT_NAME;

/**
 * Creates an HTML representation of an MockFragment.
 *
 * If true is passed as an argument, it will be passed on to
 * any child MockElements when their toString() is called.
 *
 * @param {boolean=} trackEvents
 * @return {string}
 */
MockFragment.prototype.toString = function(trackEvents) {
  trackEvents = (typeof trackEvents != 'undefined' ? trackEvents : false);
  var parts = [];
  // Contents
  for (var i = 0, l = this.childNodes.length, node; i < l; i++) {
    node = this.childNodes[i];
    if (node instanceof MockElement || node instanceof SafeString) {
      parts.push(node.toString(trackEvents));
    }
    else {
      // Coerce to string and escape
      parts.push(escapeHTML(''+node));
    }
  }

  return parts.join('');
};

/**
 * Calls addEvents() on any MockElement children.
 */
MockFragment.prototype.addEvents = function() {
  for (var i = 0, l = this.childNodes.length, node; i < l; i++) {
    node = this.childNodes[i];
    if (node instanceof MockElement) {
      node.addEvents();
    }
  }
};

/**
 * @param {Element} el
 */
MockFragment.prototype.insertWithEvents = function(el) {
  setInnerHTML(el, this.toString(true));
  this.addEvents();
};

// === Register mode plugin ====================================================

DOMBuilder.addMode({
  name: 'html'
, createElement: function(tagName, attributes, children) {
    return new MockElement(tagName, attributes, children);
  }
, fragment: function(children) {
    return new MockFragment(children);
  }
, isModeObject: function(obj) {
    return (obj instanceof HTMLNode ||
            obj instanceof SafeString);
  }
, api: {
    conditionalEscape: conditionalEscape
  , isSafe: isSafe
  , markSafe: markSafe
  , SafeString: SafeString
  , HTMLNode: HTMLNode
  , MockElement: MockElement
  , MockFragment: MockFragment
  }
, apply: {
    isSafe: isSafe
  , markSafe: markSafe
  }
});

})(this);
