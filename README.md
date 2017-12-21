# scroll-snap-polyfill

Polyfill for CSS scroll snapping draft.

## Usage

#### Yarn
`yarn add scroll-snap-polyfill`

#### NPM
`npm install --save scroll-snap-polyfill`

```js
import scrollSnapPolyfill from 'scroll-snap-polyfill'

// whenever dom is ready
scrollSnapPolyfill()
```


## Dependencies

This uses [Polyfill.js](https://github.com/philipwalton/polyfill) by [@philipwalton](https://github.com/philipwalton), which is bundled.
No other dependencies.


Browser Support
---------------

This has been tested successfully in the following browsers:

* Chrome 63
* Firefox 57
* Safari 11


Standards documentation
-----------------------

* https://www.w3.org/TR/css-scroll-snap-1/


Limitations
-----------

This polyfill only supports the properties in the new spec, not the older deprecated
properties like `scoll-snap-points`, `scroll-snap-coordinate`, and `scroll-snap-destination`.
If you want to use those older properties (not recommended) you can use  [scrollsnap-polyfill](https://github.com/ckrack/scrollsnap-polyfill) from Github user [@ckrack](https://github.com/ckrack).

Length units for `scroll-padding` are limited to:

* vh/vw
* percentages
* pixels

## License

[MIT](LICENSE).
