# @austencloud/tka-elements

The six elemental icons from [The Kinetic Alphabet](https://tkaflowarts.com), exactly as
TKA renders them on pictographs, plus the timing-and-direction mapping behind them.

| Element | Code | Meaning                      |
| ------- | ---- | ---------------------------- |
| Earth   | TS   | Together, Same direction     |
| Air     | TO   | Together, Opposite direction |
| Water   | SS   | Split, Same direction        |
| Fire    | SO   | Split, Opposite direction    |
| Sun     | QS   | Quarter, Same direction      |
| Moon    | QO   | Quarter, Opposite direction  |

Earth, Water, Air, and Fire are folk-community labels applied to VTG timing-and-direction
categories. Sun and Moon extend the model to quarter timing and were created by Austen Cloud.

## Install

```sh
npm install @austencloud/tka-elements
```

## Use

Import an icon through your bundler to get a hashed asset URL:

```ts
import airIconUrl from '@austencloud/tka-elements/icons/air.webp'
```

Or drive it from the mapping:

```ts
import { elementForRelationship, elementLabel } from '@austencloud/tka-elements'

const element = elementForRelationship({ timing: 'Q', direction: 'S' }) // 'sun'
elementLabel(element) // 'Sun'
```

Files: `icons/earth.webp`, `icons/water.webp`, `icons/air.webp`, `icons/fire.webp`,
`icons/sun.webp`, `icons/moon.webp`. Each is 27 to 44 KB.

## Updating

When the icons change in TKA, this package gets a new version. Consumers on a caret range
pick it up on their next install; pin an exact version to review changes first.

## License

Code: MIT. Artwork: CC BY 4.0, credit "Austen Cloud, The Kinetic Alphabet
(https://tkaflowarts.com)". See `LICENSE` and `LICENSE-ARTWORK`.
