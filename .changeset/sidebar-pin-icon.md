---
"@austencloud/sidebar": patch
---

The pin button draws its thumbtack and chevron through `renderIcon` when the host passes one, so hosts that render icons as SVG (no Font Awesome webfont) no longer get an empty button. Hosts without `renderIcon` keep the webfont class.
