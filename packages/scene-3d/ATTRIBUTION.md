# Attribution — @austencloud/scene-3d

## Original Source

This package extracts generic 3D rendering infrastructure from
[TKA Composer](https://github.com/austencloud/tka-sequence-constructor)
by Austen Cloud. The avatar system, IK solver, prop rendering, and scene
composition were originally built for the TKA platform's 3D viewer.

## Technical References

### Inverse Kinematics
- **Fundamentals of Computer Graphics** (Marschner & Shirley) — analytical 2-bone IK via law of cosines
- Standard Mixamo/humanoid bone conventions for skeleton mapping

### Biomechanics
- **Scapulohumeral rhythm** (Inman 1944, Ludewig 2009) — clavicle elevation model in ClavicleRaiser
- Thoracic/cervical axial rotation ranges — spine twist distribution in SpineTwister
- **Yale GRASP Taxonomy** (Feix et al. 2016) — grip pose presets
- Santello et al. 1998 kinematic ranges — finger joint angles

### Three.js / Threlte
- [Three.js](https://threejs.org/) (MIT) — 3D rendering engine
- [Threlte](https://threlte.xyz/) (MIT) — Svelte bindings for Three.js

### Prop Geometry
- Juggling prop dimensions from standard IJA equipment specifications
- Club proportions based on Renegade/PX3 standard club measurements
