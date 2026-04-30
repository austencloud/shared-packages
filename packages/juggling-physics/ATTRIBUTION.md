# Attribution

## Physics Reference

All trajectory and timing calculations use standard Newtonian mechanics
(parabolic motion under constant gravity). These equations are textbook physics,
not derived from any specific codebase.

## Inspiration & Reference

### sani.js by Jan Ivica
- **Repository:** https://github.com/neunato/sani.js
- **License:** MIT
- **Contribution:** Reference for cubic spline hand path interpolation and
  beat-based timing architecture.

### gswap by Eric Gunther
- **Repository:** https://github.com/yDgunz/gswap
- **License:** MIT
- **Contribution:** Reference for circular/linear dwell path approaches
  and bounce physics (coefficient of restitution model).

### Hawkeye by Jack Boyce
- **Repository:** https://github.com/jkboyce/hawkeye
- **License:** MIT
- **Contribution:** Reference for parabolic trajectory fitting and
  juggling timing estimation (by the author of Juggling Lab).

### passist by Christian Helbling
- **Website:** https://passist.org/
- **License:** GPL-3.0 (no code used — conceptual inspiration only)
- **Contribution:** Demonstrated the value of IK-driven juggler animation
  and JIF-based animation pipelines.

### "Beyond the Cascade" (IROS 2024)
- **Paper:** https://arxiv.org/abs/2410.19591
- **Contribution:** Published equations for takeoff velocity calculation
  and dwell ratio parameterization in robotic juggling.

## IK Solver

The 2-link analytical inverse kinematics solver uses the law of cosines,
a standard technique documented in robotics and computer graphics textbooks
(e.g., "Fundamentals of Computer Graphics" by Marschner & Shirley).
