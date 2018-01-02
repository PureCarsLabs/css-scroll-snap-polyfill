import './polyfill.min.js'

const NONE = 'none'
const START = 'start'
const END = 'end'
const CENTER = 'center'
const LENGTH_PERCENTAGE_REGEX = /(\d+)(px|vh|vw|%)/g

/**
 * constraint to jumping to the next snap-point.
 * when scrolling further than SNAP_CONSTRAINT snap-points,
 * but the current distance is less than 1-0.18 (read: 18 percent),
 * the snap-will go back to the closer snap-point.
 */
const CONSTRAINT = 0.18

/**
 * time in ms after which scrolling is considered finished.
 * the scroll timeouts are timed with this.
 * whenever a new scroll event is triggered, the previous timeout is deleted.
 * @type {Number}
 */
const SCROLL_TIMEOUT = 45

/**
 * time for the smooth scrolling
 * @type {Number}
 */
const SCROLL_TIME = 350

/**
 * doMatched is a callback for Polyfill to fill in the desired behaviour.
 * @param  {array} rules rules found for the polyfill
 */
function doMatched (rules) {
  // iterate over rules
  rules.each((rule) => {
    const elements = document.querySelectorAll(rule.getSelectors())
    const declaration = rule.getDeclaration();

    // iterate over elements
    [].forEach.call(elements, (el) => {
      // set up the behaviour
      setUpElement(el, declaration)
    })
  })
}

/**
 * unDomatched is a callback for polyfill to undo any polyfilled behaviour
 * @param  {Object} rules
 */
function undoUnmatched (rules) {
  // iterate over rules
  rules.each((rule) => {
    const elements = document.querySelectorAll(rule.getSelectors());

    // iterate over elements
    [].forEach.call(elements, (el) => {
      // tear down the behaviour
      tearDownElement(el)
    })
  })
}

/**
 * set up an element for scroll-snap behaviour
 * @param {Object} el           HTML element
 * @param {Object} declaration  CSS declarations
 */
function setUpElement (el, declaration) {
  // if this is a scroll-snap element in a scroll snap container, attach to the container only.
  if (typeof declaration['scroll-snap-align'] !== 'undefined') {
    // save declaration
    el.scrollSnapAlignment = parseScrollSnapAlignment(declaration)

    return attachToScrollParent(el)
  }

  // if the scroll snap attributes are applied on the body/html tag, use the doc for scroll events.
  const tag = el.tagName
  if (tag.toLowerCase() === 'body' ||
      tag.toLowerCase() === 'html') {
    el = document
  }

  // add the event listener
  el.addEventListener('scroll', handler, false)

  // set up scroll padding
  el.scrollPadding = parseScrollPadding(declaration)

  // save declaration
  // if (typeof declaration['scroll-snap-destination'] !== 'undefined') {
  //   el.snapLengthUnit = parseSnapCoordValue(declaration);
  // } else {
  //   el.snapLengthUnit = parseSnapPointValue(declaration);
  // }

  // init possible elements
  el.snapElements = []
}

/**
 * tear down an element. remove all added behaviour.
 * @param  {Object} el DomElement
 */
function tearDownElement (el) {
  // if the scroll snap attributes are applied on the body/html tag, use the doc for scroll events.
  const tag = el.tagName

  if (tag.toLowerCase() === 'body' ||
      tag.toLowerCase() === 'html') {
    el = document
  }

  document.removeEventListener('scroll', handler, false)
  el.removeEventListener('scroll', handler, false)

  el.snapLengthUnit = null
  el.snapElements = []
}

/**
 * parse snap alignment values.
 * @param  {Object} declaration
 * @return {Object}
 */
function parseScrollSnapAlignment (declaration) {
  const { 'scroll-snap-align': snapAlign } = declaration
  let xAlign = NONE
  let yAlign = NONE

  if (typeof snapAlign !== 'undefined') {
    // calculate scroll snap align
    const parts = snapAlign.split(' ')
    xAlign = parts[0]
    yAlign = parts.length > 1 ? parts[1] : xAlign
  }

  return {
    x: xAlign,
    y: yAlign
  }
}

function parseLengthPercentage (strValue) {
  // regex to parse lengths
  const result = LENGTH_PERCENTAGE_REGEX.exec(strValue)
  // if result is null return default values
  if (result === null) return { value: 0, unit: 'px' }

  const value = result[1]
  const unit = result[2]
  return { value: parseInt(value, 10), unit }
}

/**
 * parse scroll padding values.
 * @param  {Object} declaration
 * @return {Object}
 */
function parseScrollPadding (declaration) {
  const {
    'scroll-padding': scrollPadding,
    'scroll-padding-top': scrollPaddingTop,
    'scroll-padding-right': scrollPaddingRight,
    'scroll-padding-bottom': scrollPaddingBottom,
    'scroll-padding-left': scrollPaddingLeft
  } = declaration
  let paddingTop = { value: 0, unit: 'px' }
  let paddingRight = { value: 0, unit: 'px' }
  let paddingBottom = { value: 0, unit: 'px' }
  let paddingLeft = { value: 0, unit: 'px' }

  if (typeof scrollPadding !== 'undefined') {
    // calculate scroll padding
    const parts = scrollPadding.split(' ')
    parts.forEach((part, i) => {
      const value = parseLengthPercentage(part)
      switch (i) {
        case 0:
          paddingTop = value
          paddingRight = value
          paddingBottom = value
          paddingLeft = value
          break
        case 1:
          paddingRight = value
          paddingLeft = value
          break
        case 2:
          paddingBottom = value
          break
        case 3:
          paddingLeft = value
          break
        default:
      }
    })
  }

  if (typeof scrollPaddingTop !== 'undefined') {
    paddingTop = parseLengthPercentage(scrollPaddingTop)
  }
  if (typeof scrollPaddingRight !== 'undefined') {
    paddingRight = parseLengthPercentage(scrollPaddingRight)
  }
  if (typeof scrollPaddingBottom !== 'undefined') {
    paddingBottom = parseLengthPercentage(scrollPaddingBottom)
  }
  if (typeof scrollPaddingLeft !== 'undefined') {
    paddingLeft = parseLengthPercentage(scrollPaddingLeft)
  }

  return {
    top: paddingTop,
    right: paddingRight,
    bottom: paddingBottom,
    left: paddingLeft
  }
}

/**
 * attach a child-element onto a scroll-container
 * @param  {Object} el
 */
function attachToScrollParent (el) {
  const attach = el
  // iterate over parent elements
  for (; el && el !== document; el = el.parentNode) {
    if (typeof el.snapElements !== 'undefined') {
      el.snapElements.push(attach)
    }
  }
}

/**
 * the last created timeOutId for scroll event timeouts.
 * @type int
 */
let timeOutId = null

/**
 * starting point for current scroll
 * @type length
 */
let scrollStart = null

/**
 * the last object receiving a scroll event
 */
let lastObj, lastScrollObj

/**
 * scroll handler
 * this is the callback for scroll events.
 */
let handler = function (evt) {
  // use evt.target as target-element
  lastObj = evt.target
  lastScrollObj = getScrollObj(lastObj)

  // if currently animating, stop it. this prevents flickering.
  if (animationFrame) {
    // cross browser
    if (!cancelAnimationFrame(animationFrame)) {
      clearTimeout(animationFrame)
    }
  }

  // if a previous timeout exists, clear it.
  if (timeOutId) {
    // we only want to call a timeout once after scrolling..
    clearTimeout(timeOutId)
  } else {
    // save new scroll start
    scrollStart = {
      y: lastScrollObj.scrollTop,
      x: lastScrollObj.scrollLeft
    }
  }

  /* set a timeout for every scroll event.
   * if we have new scroll events in that time, the previous timeouts are cleared.
   * thus we can be sure that the timeout will be called 50ms after the last scroll event.
   * this means a huge improvement in speed, as we just assign a timeout in the scroll event, which will be called only once (after scrolling is finished)
   */
  timeOutId = setTimeout(handlerDelayed, SCROLL_TIMEOUT)
}

/**
 * a delayed handler for scrolling.
 * this will be called by setTimeout once, after scrolling is finished.
 */
let handlerDelayed = function () {
  // if we don't move a thing, we can ignore the timeout: if we did, there'd be another timeout added for scrollStart+1.
  if (scrollStart.y === lastScrollObj.scrollTop && scrollStart.x === lastScrollObj.scrollLeft) {
    // ignore timeout
    return
  }

  // detect direction of scroll. negative is up, positive is down.
  let direction = {
    y: (scrollStart.y - lastScrollObj.scrollTop > 0) ? -1 : 1,
    x: (scrollStart.x - lastScrollObj.scrollLeft > 0) ? -1 : 1
  }
  let snapPoint

  if (typeof lastScrollObj.snapElements !== 'undefined' && lastScrollObj.snapElements.length > 0) {
    snapPoint = getNextElementSnapPoint(lastScrollObj, lastObj, direction)
  }

  // before doing the move, unbind the event handler (otherwise it calls itself kinda)
  lastObj.removeEventListener('scroll', handler, false)

  // smoothly move to the snap point
  smoothScroll(lastScrollObj, snapPoint, function () {
    // after moving to the snap point, rebind the scroll event handler
    lastObj.addEventListener('scroll', handler, false)
  })

  // we just jumped to the snapPoint, so this will be our next scrollStart
  if (!isNaN(snapPoint.x) || !isNaN(snapPoint.y)) {
    scrollStart = snapPoint
  }
}

let currentIteratedObj = null
let currentIteration = 0

function toPx (value, unit, containerEl) {
  if (unit && unit.toLowerCase() === 'vw') {
    return getWidth(document.documentElement) * (value / 100)
  }
  if (unit && unit.toLowerCase() === 'vh') {
    return getHeight(document.documentElement) * (value / 100)
  }
  if (unit && unit === '%') {
    return getWidth(containerEl) * (value / 100)
  }
  return value
}

function getNextElementSnapPoint (scrollObj, obj, direction) {
  const l = obj.snapElements.length
  const top = scrollObj.scrollTop
  const left = scrollObj.scrollLeft
  // decide upon an iteration direction (favor -1, as 1 is default and will be applied when there is no direction on an axis)
  const primaryDirection = Math.min(direction.y, direction.x)
  let snapCoords = { y: 0, x: 0 }

  const { top: paddingTop, left: paddingLeft } = scrollObj.scrollPadding
  const pTop = roundByDirection(direction, toPx(paddingTop.value, paddingTop.unit, scrollObj))
  const pLeft = roundByDirection(direction, toPx(paddingLeft.value, paddingLeft.unit, scrollObj))

  function adjustForPadding (value, adjustment) {
    if (currentIteration === 0 || currentIteration === l - 1) {
      return value
    }
    return value - adjustment
  }

  // handle use-case where scrolling to end
  if ((left > 0 && (left + getWidth(scrollObj)) === getScrollWidth(scrollObj)) || (top > 0 && (top + getHeight(scrollObj)) === getScrollHeight(scrollObj))) {
    currentIteration = l - 1
    const lastSnapElement = obj.snapElements[currentIteration]
    const lastSnapCoords = {
      x: (getLeft(lastSnapElement) - getLeft(scrollObj)) + getXSnapLength(lastSnapElement, lastSnapElement.scrollSnapAlignment.x, direction),
      y: (getTop(lastSnapElement) - getTop(scrollObj)) + getYSnapLength(lastSnapElement, lastSnapElement.scrollSnapAlignment.y, direction)
    }
    lastSnapElement.snapCoords = lastSnapCoords
    // the for loop stopped at the last element
    return {y: stayInBounds(0, getScrollHeight(scrollObj), lastSnapCoords.y),
      x: stayInBounds(0, getScrollWidth(scrollObj), lastSnapCoords.x)}
  }

  const currentSnapElement = obj.snapElements[currentIteration]
  const currentSnapCoords = {
    x: currentIteration === 0 ? 0 : (getLeft(currentSnapElement) - getLeft(scrollObj)) + getXSnapLength(currentSnapElement, currentSnapElement.scrollSnapAlignment.x, direction) - getXSnapLength(scrollObj, currentSnapElement.scrollSnapAlignment.x, direction),
    y: currentIteration === 0 ? 0 : (getTop(currentSnapElement) - getTop(scrollObj)) + getYSnapLength(currentSnapElement, currentSnapElement.scrollSnapAlignment.y, direction) - getYSnapLength(scrollObj, currentSnapElement.scrollSnapAlignment.y, direction)
  }
  currentSnapElement.snapCoords = currentSnapCoords
  const xThreshold = currentSnapCoords.x + (direction.x * getWidth(currentSnapElement) * CONSTRAINT)
  const yThreshold = currentSnapCoords.y + (direction.y * getHeight(currentSnapElement) * CONSTRAINT)

  let i
  for (i = currentIteration + primaryDirection; i < l && i >= 0; i = i + primaryDirection) {
    currentIteratedObj = obj.snapElements[i]

    // get objects snap coords by adding obj.top + obj.snaplength.y
    snapCoords = {
      y: i === 0 ? 0 : (getTop(currentIteratedObj) - getTop(scrollObj)) + getYSnapLength(currentIteratedObj, currentIteratedObj.scrollSnapAlignment.y, direction) - getYSnapLength(scrollObj, currentIteratedObj.scrollSnapAlignment.y, direction),
      x: i === 0 ? 0 : (getLeft(currentIteratedObj) - getLeft(scrollObj)) + getXSnapLength(currentIteratedObj, currentIteratedObj.scrollSnapAlignment.x, direction) - getXSnapLength(scrollObj, currentIteratedObj.scrollSnapAlignment.x, direction)
    }

    currentIteratedObj.snapCoords = snapCoords
    // check if object snappoint is "close" enough to scrollable snappoint

    // check if not beyond scroll threshold
    if ((direction.x === 1 ? left < xThreshold : left > xThreshold) &&
      (direction.y === 1 ? top < yThreshold : top > yThreshold)) {
      break
    }

    const elementXThreshold = snapCoords.x + (direction.x * getWidth(currentIteratedObj) * CONSTRAINT)
    const elementYThreshold = snapCoords.y + (direction.y * getHeight(currentIteratedObj) * CONSTRAINT)

    // check if not scrolled past element snap point
    if ((direction.x === 1 ? left > elementXThreshold : left < elementXThreshold) ||
      (direction.y === 1 ? top > elementYThreshold : top < elementYThreshold)) {
      continue
    }

    // ok, we found a snap point.
    currentIteration = i
    // stay in bounds (minimum: 0, maxmimum: absolute height)
    return {y: stayInBounds(0, getScrollHeight(scrollObj), adjustForPadding(snapCoords.y, pTop)),
      x: stayInBounds(0, getScrollWidth(scrollObj), adjustForPadding(snapCoords.x, pLeft))}
  }
  // no snap found, use first or last?
  if (primaryDirection === 1 && i === l - 1) {
    currentIteration = l - 1
    // the for loop stopped at the last element
    return {y: stayInBounds(0, getScrollHeight(scrollObj), snapCoords.y),
      x: stayInBounds(0, getScrollWidth(scrollObj), snapCoords.x)}
  } else if (primaryDirection === -1 && i === 0) {
    currentIteration = 0
    // the for loop stopped at the first element
    return {y: stayInBounds(0, getScrollHeight(scrollObj), snapCoords.y),
      x: stayInBounds(0, getScrollWidth(scrollObj), snapCoords.x)}
  }
  // stay in the same place
  return {y: stayInBounds(0, getScrollHeight(scrollObj), adjustForPadding(obj.snapElements[currentIteration].snapCoords.y, pTop)),
    x: stayInBounds(0, getScrollWidth(scrollObj), adjustForPadding(obj.snapElements[currentIteration].snapCoords.x, pLeft))}
}

/**
 * ceil or floor a number based on direction
 * @param  {Number} direction
 * @param  {Number} currentPoint
 * @return {Number}
 */
function roundByDirection (direction, currentPoint) {
  if (direction === -1) {
    // when we go up, we floor the number to jump to the next snap-point in scroll direction
    return Math.floor(currentPoint)
  }
  // go down, we ceil the number to jump to the next in view.
  return Math.ceil(currentPoint)
}

/**
 * keep scrolling in bounds
 * @param  {Number} min
 * @param  {Number} max
 * @param  {Number} destined
 * @return {Number}
 */
function stayInBounds (min, max, destined) {
  return Math.max(Math.min(destined, max), min)
}

/**
 * calc length of one snap on y-axis
 * @param  {Object} declaration the parsed declaration
 * @return {Number}
 */
function getYSnapLength (obj, alignment, direction) {
  if (alignment === START) {
    return 0
  } else if (alignment === END) {
    return getHeight(obj)
  } else if (alignment === CENTER) {
    return roundByDirection(direction, getHeight(obj) / 2)
  }
  return 0
}

/**
 * calc length of one snap on x-axis
 * @param  {Object} declaration the parsed declaration
 * @return {Number}
 */
function getXSnapLength (obj, alignment, direction) {
  if (alignment === START) {
    return 0
  } else if (alignment === END) {
    return getWidth(obj)
  } else if (alignment === CENTER) {
    return roundByDirection(direction, getWidth(obj) / 2)
  }
  return 0
}

/**
 * get an elements scrollable height
 * @param  {Object} obj
 * @return {Number}
 */
function getScrollHeight (obj) {
  return obj.scrollHeight
}

/**
 * get an elements scrollable width
 * @param  {Object} obj
 * @return {Number}
 */
function getScrollWidth (obj) {
  return obj.scrollWidth
}

/**
 * get an elements height
 * @param  {Object} obj
 * @return {Number}
 */
function getHeight (obj) {
  return obj.offsetHeight
}

/**
 * get an elements width
 * @param  {Object} obj
 * @return {Number}
 */
function getWidth (obj) {
  return obj.offsetWidth
}

/**
 * get an elements height
 * @param  {Object} obj
 * @return {Number}
 */
function getLeft (obj) {
  return obj.offsetLeft + obj.clientLeft
}

/**
 * get an elements width
 * @param  {Object} obj
 * @return {Number}
 */
function getTop (obj) {
  return obj.offsetTop + obj.clientTop
}

/**
 * return the element scrolling values are applied to.
 * when receiving window.onscroll events, the actual scrolling is on the body.
 * @param  {Object} obj
 * @return {Object}
 */
function getScrollObj (obj) {
  // if the scroll container is body, the scrolling is invoked on window/doc.
  if (obj === document || obj === window) {
    // firefox scrolls on doc.documentElement
    if (document.documentElement.scrollTop > 0 || document.documentElement.scrollLeft > 0) {
      return document.documentElement
    }
    // chrome scrolls on body
    return document.querySelector('body')
  }

  return obj
}

/**
 * calc the duration of the animation proportional to the distance travelled
 * @param  {Number} start
 * @param  {Number} end
 * @return {Number}       scroll time in ms
 */
function getDuration (start, end) {
  const distance = Math.abs(start - end)
  const procDist = 100 / Math.max(document.documentElement.clientHeight, window.innerHeight || 1) * distance
  const duration = 100 / SCROLL_TIME * procDist

  if (isNaN(duration)) {
    return 0
  }

  return Math.max(SCROLL_TIME / 1.5, Math.min(duration, SCROLL_TIME))
}

/**
 * ease in out function thanks to:
 * http://blog.greweb.fr/2012/02/bezier-curve-based-easing-functions-from-concept-to-implementation/
 * @param  {Number} t timing
 * @return {Number}   easing factor
 */
const easeInCubic = function (t) {
  return t * t * t
}

/**
 * calculate the scroll position we should be in
 * @param  {Number} start    the start point of the scroll
 * @param  {Number} end      the end point of the scroll
 * @param  {Number} elapsed  the time elapsed from the beginning of the scroll
 * @param  {Number} duration the total duration of the scroll (default 500ms)
 * @return {Number}          the next position
 */
const position = function (start, end, elapsed, duration) {
  if (elapsed > duration) {
    return end
  }
  return start + (end - start) * easeInCubic(elapsed / duration)
}

// a current animation frame
let animationFrame = null

/**
 * smoothScroll function by Alice Lietieur.
 * @see https://github.com/alicelieutier/smoothScroll
 * we use requestAnimationFrame to be called by the browser before every repaint
 * @param  {Object}   obj      the scroll context
 * @param  {Number}  end      where to scroll to
 * @param  {Number}   duration scroll duration
 * @param  {Function} callback called when the scrolling is finished
 */
const smoothScroll = function (obj, end, callback) {
  const start = { y: obj.scrollTop, x: obj.scrollLeft }

  const clock = Date.now()

  // get animation frame or a fallback
  const requestAnimationFrame = window.requestAnimationFrame ||
                            window.mozRequestAnimationFrame ||
                            window.webkitRequestAnimationFrame ||
                            function (fn) { window.setTimeout(fn, 15) }
  const duration = Math.max(getDuration(start.y, end.y), getDuration(start.x, end.x))

  // setup the stepping function
  const step = function () {
    // calculate timings
    const elapsed = Date.now() - clock

    // change position on y-axis if result is a number.
    if (!isNaN(end.y)) {
      obj.scrollTop = position(start.y, end.y, elapsed, duration)
    }

    // change position on x-axis if result is a number.
    if (!isNaN(end.x)) {
      obj.scrollLeft = position(start.x, end.x, elapsed, duration)
    }

    // check if we are over due
    if (elapsed > duration) {
      // is there a callback?
      if (typeof callback === 'function') {
        // stop execution and run the callback
        return callback(end)
      }

      // stop execution
      return
    }

    // use a new animation frame
    animationFrame = requestAnimationFrame(step)
  }

  // start the first step
  step()
}

export default () => {
  /**
   * Feature detect scroll-snap-type, if it exists then do nothing (return)
   */
  if ('scrollSnapAlign' in document.documentElement.style ||
      'webkitScrollSnapAlign' in document.documentElement.style ||
      'msScrollSnapAlign' in document.documentElement.style) {
    // just return void to stop executing the polyfill.
    return
  }

  Polyfill({
    declarations: [
      'scroll-snap-type:*',
      'scroll-snap-align:*',
      'scroll-snap-padding:*'
    ]
  })
    .doMatched(doMatched)
    .undoUnmatched(undoUnmatched)
}
