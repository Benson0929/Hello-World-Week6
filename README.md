https://benson0929.github.io/Hello-World-Week6/

Moiré Time
Four Mathematical Studies of Time
Moiré Time is a generative clock that turns real local time into four different moving geometric studies. Instead of relying only on numbers or clock hands, it explores how hours, minutes, and seconds can shape lines, surfaces, and optical patterns.

All four studies read the same clock, but each interprets its values through a different mathematical system.
The Four Studies
Study	Mathematical approach	Visual behavior
Fold	Parametric curve deformation	Layers of fine lines twist and fold into a ribbon with moving moiré patterns.
Capsule	Gaussian height field and contour extraction	A sculptural landscape of peaks, valleys, and projected contour lines continuously changes shape.
Cross	Geometric line mapping and envelope-based forms	Four families of lines intersect to produce a shifting pinwheel-like vortex.
Wave	Lissajous curves and harmonic oscillation	Repeated sine-based curves overlap into a changing geometric weave.


How Time Shapes the Art
The website reads the computer's local hours, minutes, seconds, and milliseconds. It maps them to each study's geometry, using continuous 24-hour, 60-minute, and 60-second cycles. Hours generally influence the overall structure, minutes control a larger-scale deformation, and seconds drive visible changes in motion and interference.

The drawings are recalculated from the clock; they are not prerecorded animations.
Interaction
- Home: View all four animated studies together in a 2 × 2 grid.
- Enter the Four Studies: Open the full-size artwork view.
- Change studies: Drag the large mode title left or right, or focus it and use the ← / → arrow keys.
- Back to Home: Return to the four-study overview.
- Day / Night: Switch between light and dark display modes.
- Live Time Parameters: See values from the selected study's time-driven calculations.
Built With
- HTML and CSS for the interface and responsive layout
- JavaScript and p5.js for drawing and animation
- Nested loops, trigonometric functions, parametric curves, Gaussian fields, contour extraction, and geometric transformations
Run Locally
Open index.html using a local web server such as VS Code Live Server. The project loads p5.js from a CDN, so an internet connection is needed unless the library is hosted locally.
AI Use and Process
I used ChatGPT and Codex to help research mathematical approaches, develop and debug JavaScript, and iterate on the visual forms. I directed the concept, selected references, evaluated rendered results, and refined the interaction and interface through repeated testing.

Examples of development instructions included:
- “Refine the existing Fold mode ... make it feel more three-dimensional, while still remaining a 2D generative drawing.”
- “Redesign this mode as a multi-attractor contour field” for the Capsule study.
- “Implement the third visual mode, Cross ... a simplified Vortex Cross with four flowing line-based ribbon arms and a clearly recognizable central spiral vortex.”
AI-assisted code was reviewed and iterated as part of the design process.
Live Website
Add the GitHub Pages URL here after publishing.
