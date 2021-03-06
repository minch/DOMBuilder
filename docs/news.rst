News for DOMBuilder
===================

Version 2.0.0
-------------

*July 17th, 2011*

* Output modes are now pluggable, using ``DOMBuilder.addMode``.
* Output mode specific element functions are now available under
  ``DOMBuilder.dom`` and ``DOMBuilder.html``.
* HTML Mode no longer has any dependency on DOM Mode.
* Updated attribute-setting code based on jQuery 1.6.2.
* Nested Array representations of HTML can now be used to generate output
  with an output mode, using ``DOMBuilder.build``.
* Nested Array structures can be built using element functions under
  ``DOMBuilder.array``.
* Added support for new tags defined in HTML 5.
* You can now specify a mode for ``DOMBuilder.apply``, which will also
  apply any additional API for the specified mode, if available.

Backwards-incompatible changes:

* When calling ``DOMBuilder.map``, the default attributes argument is now
  required - flexible arguments are now handled by the ``map`` functions
  exposed on element creation functions.
* ``DOMBuilder.map`` now passes a loop status object to the given mapping
  function instead of an index.
* The context argument object to ``DOMBuilder.apply`` is now required.
* ``DOMBuilder.apply`` no longer adds an ``NBSP`` property.
* HTML mode mock DOM objects were renamed to ``MockElement`` and
  ``MockFragment``.
* HTML mode no longer supports XHTML-style closing slashes for empty
  elements.
* ``markSafe`` and ``isSafe`` moved to ``DOMBuilder.html.markSafe`` and
  ``DOMBuilder.html.isSafe``, respectively.

Version 1.4.4
-------------

*May 19th, 2011*

- Additional arguments can now be passed in to ``withMode`` to be passed
  into the function which will be called.

Version 1.4.3
-------------

*April 26th, 2011*

- Fixed defect doing child checks on ``null`` and ``undefined`` children.

Version 1.4.2
-------------

*April 12th, 2011*

- Added support for using the ``innerHTML`` attribute to specify an
  element's entire contents consistently in DOM and HTML modes.

Version 1.4.1
-------------

*March 4th, 2011*

- Fixed HTML mode bug: event registration now works for nested elements.

- DOMBuilder can now be used as a `Node.js`_ module, defaulting to HTML
  mode.

- Fixed bug: SafeString is no longer used as an attributes object if passed
  as the first argument to an element creation function.

.. _`Node.js`: http://nodejs.org

Version 1.4
-----------

*February 13th, 2011*

- Fixed HTML escaping bugs: attribute names and unknown tag names are now
  escaped.

- A new ``insertWithEvents`` method on DOMBuilder.HTMLElement attempts to
  use ``innerHTML`` in a cross-browser friendly fashion. It's safe to use
  this method on elements for which innerHTML is readonly, as it drops
  back to creating DOM Elements in a new element and moving them. If
  jQuery is available, its more comprehensive ``html`` function is used.

- Fixed issue #1 - HTML mode now supports registering event listeners,
  specified in the same way as DOM mode, after HTML has been inserted
  with ``innerHTML``. If necessary, ``id`` attributes will be generated
  in order to target elements which need event listeners.

- Fixed issue #3 - jQuery is now optional, but will be made use of if
  present.

Version 1.3
-----------

*February 4th, 2011*

- Tag names passed into ``DOMBuilder.HTMLElement`` are now lower-cased.

- Added ``DOMBuilder.elementFunctions`` to hold element creation functions
  instead of creating them every time ``DOMBuilder.apply()`` is called.
  This also allows for the possibility of using a ``with`` statement for
  convenience (not that you should!) instead of adding element creation
  functions to the global scope.

- Added ``DOMBuilder.fragment.map()`` to create contents from a list of
  items using a mapping function and wrap them in a single fragment as
  siblings, negating the need for redundant wrapper elements.

- Fixed (Google Code) issue #5 - added ``HTMLFragment.toString()``.

- Fixed (Google Code) issue #3 - we now append "nodey" contents
  (anything with a truthy ``nodeType``) directly and coerce everything
  else to ``String`` when appending child nodes, rather than checking for
  types which should be coerced to ``String`` and appending everything
  else directly.

- Bit the bullet and switched to using jQuery for element creation and
  more. DOMBuilder now depends on jQuery >= 1.4.

- Fixed (Google Code) issue #2 - nested ``Array`` objects in child
  arguments to ``DOMBuilder.createElement()`` and ``DOMBuilder.fragment()``
  are now flattened.

- Extracted ``HTMLNode`` base class to contain common logic from
  ``HTMLElement`` and ``HTMLFragment``.

- Renamed ``Tag`` to ``HTMLElement``.

- ``DOMBuilder.fragment`` now works in HTML mode -
  ``DOMBuilder.HTMLFragment`` objects lightly mimic the DOM
  DocumentFragment API.

- Added ``DOMBuilder.map()`` to create elements based on a list, with an
  optional mapping function to control if and how resulting elements are
  created.

- Added ``DOMBuilder.fragment()``, a utility method for creating and
  populating DocumentFragment objects.

Version 1.2
-----------

*January 21st, 2011*

- Created Sphinx docs.

- ``Tag`` objects created when in HTML mode now remember which mode was
  active when they were created, as they may not be coerced until a later
  time, when the mode may have changed.

- Added ``DOMBuilder.withMode()`` to switch to HTML mode for the scope of
  a function call.

- Fixed short circuiting in element creation functions and decreased the
  number of checks required to determine which of the 4 supported argument
  combinations the user passed in.

- Attributes are now lowercased when generating HTML.

- ``DOMBuilder.isSafe()`` and ``DOMBuilder.markSafe()`` added as the public
  API for managing escaping of strings when generating HTML.

- Added support for using the DOMBuilder API to generate HTML/XHTML output
  instead of DOM elements. This is an experimental change for using the same
  codebase to generate HTML on the backend and DOM elements on the frontend,
  as is currently being implemented in https://github.com/insin/newforms

Version 1.1
-----------

*October 10th, 2008*

- An ``NBSP`` property is now also added to the context object by
  ``DOMBuilder.apply()``, for convenience.

- ``Boolean`` attributes are now only set if they're ``true``. Added
  items to the demo page to demonstrate that you can now create an
  explicitly unchecked checkbox and an explicitly non-multiple select.

- Added more IE workarounds for:

  - Creating multiple selects
  - Creating pre-selected radio and checkbox inputs

Version 1.0
-----------

*June 1st, 2008*

- Added support for passing children to element creation function as an
  ``Array``.

- Added more robust support for registering event handlers, including
  cross-browser event handling utility methods and context correction for IE
  when the event handler is fired.

- IE detection is now performed once and once only, using conditional
  compilation rather than user-agent ``String`` inspection.
