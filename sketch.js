let currentMode = "Fold";
let currentView = "home";
let isNightMode = true;
// Canvas colors are read from the same CSS palette as the interface.
let artworkPalette = { paper: "#000000", ink: "#FFFFFF", text: "#E6E6E6" };
let ui;
let canvasObserver;
let foldMesh;
let lastFoldFit;
let lastFoldRenderMs = 0;
let latestRenderedFrame;
let rotarySelector;
let displayedClockSecond = null;
let capsuleField;
let crossMesh;
let waveMesh;
const clockDateFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "2-digit" });
const clockZoneFormat = new Intl.DateTimeFormat("en-US", { hour: "2-digit", hourCycle: "h23", timeZoneName: "short" });

const rotarySettings = {
  degreesPerPixel: 0.65,
  snapDurationMs: 260,
  radiusRatio: 0.38, // Radius relative to selector width for Y-axis rotation.
};

// These amplify visual distances/angles, never the real-time cycle lengths.
const phaseVisualMultiplier = 3.4;
const surfaceMotionMultiplier = 6.0;
const foldVisualMultiplier = 1.45;
const orientationVisualMultiplier = 1.2;

// Time controls only: geometry, density and stroke settings stay unchanged.
const foldTimeSettings = {
  tilt: 0.08, // Base amplitude in radians, before the visual multiplier.
  foldBase: 2.125, foldSwing: 0.225,
  phaseBase: 0.16, phaseSwing: 0.14,
  shiftBase: 1.2, shiftSwing: 4.0, // Canvas pixels, localized to the fold.
};

// One set of geometry values feeds both the renderer and the parameter viewer.
const modes = {
  Fold: {
    mathematicalModel: "Parametric Curve Deformation",
    description: "Fine lines form a continuously twisting ribbon through parametric deformation and layered overlap. Real time controls its orientation, folding strength, and moving moiré patterns.",
    parameters: {
      // Main density controls. Lower counts increase spacing without changing width.
      lineCount: 56, secondaryLineCount: 58,
      strokeWeight: 0.38, secondaryStrokeWeight: 0.28,
      samples: 360, ribbonWidth: 132, ribbonHeight: 620,
      // Spacing is derived from width and count, before the fold deformation.
      get lineSpacing() { return this.ribbonWidth / (this.lineCount - 1); },
      get secondaryLineSpacing() { return this.ribbonWidth / (this.secondaryLineCount - 1); },
      foldSpread: 0.24, foldDiagonal: 0.32, topOpening: 0.18,
      upperLean: -52, lowerLean: 62, lowerReturn: 10,
      upperCurveCenter: -0.42, lowerCurveCenter: 0.48,
      upperCurveSpread: 0.32, lowerCurveSpread: 0.36,
      upperPinch: 0.18, lowerFlare: 0.28, waistPinch: 0.12,
      verticalCoverage: 2.2, // Target 220% of the visible canvas height.
      verticalExtent: 1.65, extensionSamples: 36,
      verticalSafetyMargin: 0.20, // Every thread end stays at least 20% offscreen.
      densityBias: 0.16, surfaceTurn: 0.12, surfaceCamber: 10,
      edgeSweep: 7, frontStart: -0.035, frontEnd: 0.045,
      tilt: 0, foldStrength: 2.1, phase: 0,
      layerPhase: 0.16, layerTwist: 0.045,
      layerTilt: 0.002, layerShift: 1.2,
      surfaceTravel: 0, surfaceTwist: 0, surfaceBend: 0,
    },
    render: drawFold,
  },
  Capsule: {
    mathematicalModel: "Gaussian Height Field & Contour Extraction",
    description: "A mathematical height field generates layered contours that form peaks, valleys, and a sculptural landscape. Real time reshapes the surface, continuously shifting its depth and contours.",
    parameters: {
      widthCoverage: 0.84, heightCoverage: 0.70,
      gridSpacing: 5.5, strokeWeight: 0.55, // Crisp screen-space strokes at every size.
      contourCount: 104, thresholdLow: 0.055, thresholdHigh: 5.5,
      densityBias: 0.07,
      // Organic coordinate warp keeps the landscape from reading as three cones.
      organicWarp: 0.32, ridgeHeight: 0.54, ridgeWidth: 184,
      travelingWarp: 0.25, reliefContrast: 1.10,
      // A sparse second family is draped onto the SAME surface, never screen-warped.
      secondaryEvery: 4, secondaryStart: 0.82, secondaryStrokeWeight: 0.31,
      layerShift: 14, layerWarp: 9, phaseVisualMultiplier: 1.20,
      footprintWidth: 755, footprintDepth: 385, baseHeight: 0.58,
      viewElevation: 0.91, elevationScale: 105, visibilityTolerance: 0.35,
      orientationVisualMultiplier: 1.2, deformationVisualMultiplier: 1.4,
      motionVisualMultiplier: 1.45,
      tiltAmplitude: 0.035, proportionAmplitude: 0.035,
      strengthAmplitude: 0.10, expansionAmplitude: 0.06,
      localBreathing: 0.19, heightBreathing: 0.28,
      // Three hills and two broad saddles; the foundation connects all five.
      attractors: [
        { name: "Left", x: -292, y: 18, radiusX: 205, radiusY: 181, strength: 2.75, driftX: 102, driftY: 60, offset: 0.15 },
        { name: "Rear", x: -38, y: -104, radiusX: 185, radiusY: 152, strength: 3.10, driftX: 95, driftY: 51, offset: 2.25 },
        { name: "Right", x: 285, y: 38, radiusX: 228, radiusY: 166, strength: 2.83, driftX: 119, driftY: 67, offset: 4.20 },
        { name: "Left saddle", x: -165, y: 47, radiusX: 123, radiusY: 127, strength: -0.37, driftX: 35, driftY: 25, offset: 0.8 },
        { name: "Right saddle", x: 144, y: 12, radiusX: 125, radiusY: 132, strength: -0.35, driftX: 36, driftY: 24, offset: 3.4 },
      ],
      tilt: 0, proportion: 1, expansion: 1, phase: 0, localShift: 0,
      centers: [],
    },
    render: drawCapsule,
  },
  Cross: {
    mathematicalModel: "Geometric Line Mapping & Envelope",
    description: "Four intersecting line systems create a rotating vortex through geometric repetition and overlap. Real time changes their angles, central tension, and optical interference.",
    parameters: {
      // 68 curves × 4 fans: twice the density, with finer strokes to keep gaps clear.
      lineCount: 68, samples: 260, strokeWeight: 0.42,
      widthCoverage: 0.94, heightCoverage: 1.10, horizontalScale: 1.13,
      outerRadius: 500, endTaper: 0.46,
      coreRadius: 36, coreSpread: 118, spiralRadius: 145,
      // Open the center; reserve the finer spacing for the outer part of each fan.
      coreSpacingExponent: 0.62, coreFanSoftness: 0.65, coreMotionFloor: 0.30,
      fanSpread: Math.PI / 2,
      openingBase: Math.PI / 4, openingAmplitude: 0.035,
      vortexBase: 1.05, vortexAmplitude: 0.14,
      // Stronger visible travel; the seconds cycle still takes exactly 60 seconds.
      flowAmplitude: 1.50, spiralBreath: 0.34, curveBreath: 0.12,
      armOpening: Math.PI / 4, vortexStrength: 1.05,
      spiralPhase: 0, phase: 0, renderScale: 1,
    },
    render: drawCross,
  },
  Wave: {
    mathematicalModel: "Lissajous Curves & Harmonic Oscillation",
   description: "Harmonic sine functions generate layered Lissajous curves that weave into intricate geometric patterns. Real time shifts their phases, continuously transforming the structure and its optical interference.",
    parameters: {
      // Odd integer frequencies keep every loop closed and centrally symmetric.
      frequencyX: 3, frequencyY: 1,
      lineCount: 42, samples: 960, strokeWeight: 0.42,
      amplitudeX: 225, amplitudeY: 280,
      widthCoverage: 0.86, heightCoverage: 0.88,
      tiltAmplitude: 0.055, proportionAmplitude: 0.06,
      phaseBase: Math.PI / 4, phaseAmplitude: 0.28,
      spreadBase: 1.42, spreadAmplitude: 0.12,
      twistBase: 0.30, twistAmplitude: 0.14,
      // Round the outer lobes and give the crossing a slight oblique view.
      lobeIndent: 0.25, obliqueShear: 0.12,
      tilt: 0, proportion: 1, phase: Math.PI / 4,
      phaseSpread: 1.42, layerTwist: 0.30, renderScale: 1,
    },
    render: drawWave,
  },
};

function setup() {
  pixelDensity(canvasPixelDensity());
  const canvas = createCanvas(820, 600);
  canvas.parent("canvas-container");
  canvas.attribute("role", "img");
  ui = {
    canvas,
    site: document.getElementById("site"),
    studyInfo: document.getElementById("study-info"),
    studyParameters: document.getElementById("study-parameters"),
    enterStudies: document.getElementById("enter-studies"),
    title: document.getElementById("mode-title"),
    description: document.getElementById("mode-description"),
    modelName: document.getElementById("model-name"),
    clock: document.getElementById("clock"),
    clockZone: document.getElementById("clock-zone"),
    clockDate: document.getElementById("clock-date"),
  };
  setupThemeToggle();
  setupTimeParameters();
  rotarySelector = createRotarySelector(
    document.getElementById("mode-selector"),
    document.getElementById("mode-rotor"),
    (name) => { if (name !== currentMode) selectMode(name); }
  );
  selectMode(currentMode);
  // Match the actual available artwork area, rather than a width-only CSS scale.
  canvasObserver = new ResizeObserver(([entry]) => {
    syncCanvasSize(entry.contentRect);
  });
  canvasObserver.observe(document.getElementById("canvas-container"));
  watchPixelRatio();
  window.addEventListener("hashchange", () => syncPageView(true));
  syncPageView();
}

// Hash links support entry, return, browser Back, and direct #studies links.
function syncPageView(moveFocus = false) {
  currentView = window.location.hash === "#studies" ? "studies" : "home";
  const home = currentView === "home";
  ui.site.dataset.view = currentView;
  ui.studyInfo.hidden = home;
  ui.studyParameters.hidden = home;
  ui.enterStudies.hidden = !home;
  // Stop any in-progress selector snap when leaving its page.
  rotarySelector.setMode(currentMode);
  if (home) {
    latestRenderedFrame = null;
    ui.canvas.attribute("aria-label", "Four animated mathematical studies in a two by two grid: Capsule and Cross above Fold and Wave");
  } else {
    selectMode(currentMode);
  }
  frameRate(home ? 30 : 60);
  syncCanvasSize();
  if (moveFocus) {
    const target = home ? ui.enterStudies : document.getElementById("mode-selector");
    target.focus({ preventScroll: true });
  }
}

function setupThemeToggle() {
  ui.themeToggle = document.getElementById("theme-toggle");
  ui.themeToggle.addEventListener("click", () => setNightMode(!isNightMode));
  setNightMode(isNightMode); // Every page load begins in night mode.
}

function setNightMode(enabled) {
  isNightMode = enabled;
  const root = document.documentElement;
  root.dataset.theme = enabled ? "night" : "day";
  const colors = getComputedStyle(root);
  artworkPalette = {
    paper: colors.getPropertyValue("--paper").trim(),
    ink: colors.getPropertyValue("--ink").trim(),
    text: colors.getPropertyValue("--text").trim(),
  };
  ui.themeToggle.setAttribute("aria-pressed", String(enabled));
  ui.themeToggle.title = enabled ? "Switch to day mode" : "Switch to night mode";
}

function canvasPixelDensity() {
  return Math.min(2, Math.max(1, window.devicePixelRatio || 1));
}

function syncCanvasSize(rect = document.getElementById("canvas-container").getBoundingClientRect()) {
  const density = canvasPixelDensity();
  if (pixelDensity() !== density) pixelDensity(density);
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (width !== w || height !== h) resizeCanvas(w, h, true);
  drawingContext.imageSmoothingEnabled = true;
  drawingContext.lineJoin = "round";
  drawingContext.lineCap = "round";
}

// Recreate the drawing buffer when moving between displays or changing zoom.
function watchPixelRatio() {
  const query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  query.addEventListener("change", () => {
    syncCanvasSize();
    watchPixelRatio();
  }, { once: true });
}

function selectMode(name) {
  currentMode = name;
  const mode = modes[currentMode];
  ui.title.setAttribute("aria-label", currentMode.toUpperCase());
  rotarySelector.setMode(currentMode);
  ui.description.textContent = mode.description;
  ui.modelName.textContent = mode.mathematicalModel;
  ui.canvas.attribute("aria-label", currentMode === "Fold" ? "Two fine line layers forming a folded ribbon with slowly drifting interference bands" : currentMode + " static placeholder");
  if (currentMode === "Capsule") {
    ui.canvas.attribute("aria-label", "A contained contour sculpture with three raised regions, visible front slopes and hidden rear surfaces, continuously reshaped by local time");
  }
  if (currentMode === "Cross") {
    ui.canvas.attribute("aria-label", "Four radiating line fans crossing around a compact, time-driven spiral vortex");
  }
  if (currentMode === "Wave") {
    ui.canvas.attribute("aria-label", "Fine Lissajous loops interweaving into a symmetric, time-driven geometric surface");
  }
  updateTimeParameters();
}

function draw() {
  background(artworkPalette.paper);
  noFill();
  stroke(artworkPalette.text);
  strokeWeight(2);

  // Sample once; the deformation, clock and viewer all use this same time.
  const now = new Date();
  const localTime = readLocalTime(now);
  if (currentView === "home") {
    drawOverview(localTime);
    updateReadout(null, localTime, now);
    return;
  }
  updateFold(modes.Fold.parameters, localTime);
  const mode = modes[currentMode];
  const p = mode.parameters;
  if (currentMode === "Capsule") updateCapsule(p, localTime);
  if (currentMode === "Cross") updateCross(p, localTime);
  if (currentMode === "Wave") updateWave(p, localTime);
  mode.render(p);

  latestRenderedFrame = {
    mode: currentMode,
    time: localTime,
    continuous: p.timeState,
    parameters: p,
    mesh: currentMode === "Fold" ? foldMesh : null,
    fit: currentMode === "Fold" ? lastFoldFit : null,
  };
  updateReadout(p, localTime, now);
  updateTimeParameters();
}

// Preview settings are separate: entering a study retains its original framing.
const overviewTiles = [
  { name: "Capsule", zoom: 1.35, update: updateCapsule, detail: { gridSpacing: 8 } },
  { name: "Cross", zoom: 1.16, update: updateCross, detail: { samples: 180 } },
  { name: "Fold", zoom: 1, update: updateFold, detail: { samples: 240 } },
  { name: "Wave", zoom: 1.65, update: updateWave, detail: { samples: 640 } },
].map(tile => ({ ...tile, parameters: { ...structuredClone(modes[tile.name].parameters), ...tile.detail } }));

function drawOverview(localTime) {
  const inset = Math.max(16, Math.min(32, Math.min(width, height) * 0.035));
  const size = Math.max(1, Math.min(width, height) - 2 * inset);
  const cell = size / 2;
  const left = (width - size) / 2, top = (height - size) / 2;
  const ctx = drawingContext;
  overviewTiles.forEach((tile, index) => {
    const x = left + (index % 2) * cell;
    const y = top + Math.floor(index / 2) * cell;
    tile.update(tile.parameters, localTime);
    push();
    // Each crop is independent, so full-bleed lines cannot enter another tile.
    ctx.beginPath();
    ctx.rect(x, y, cell, cell);
    ctx.clip();
    const viewSize = cell * tile.zoom;
    translate(x + (cell - viewSize) / 2, y + (cell - viewSize) / 2);
    modes[tile.name].render(tile.parameters, viewSize, viewSize);
    pop();
  });
  // Fine dividers are drawn last, above all four live crops.
  ctx.save();
  ctx.strokeStyle = artworkPalette.text;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.rect(left, top, size, size);
  ctx.moveTo(left + cell, top); ctx.lineTo(left + cell, top + size);
  ctx.moveTo(left, top + cell); ctx.lineTo(left + size, top + cell);
  ctx.stroke();
  ctx.restore();
}

function updateReadout(p, localTime, now = new Date()) {
  // One snapshot keeps the seconds, date and timezone consistent at midnight.
  // Intl work runs once per clock second, rather than once per drawing frame.
  const clockSecond = Math.floor(now.getTime() / 1000);
  if (clockSecond !== displayedClockSecond) {
    ui.clock.textContent = nf(now.getHours(), 2) + ":" + nf(now.getMinutes(), 2) + ":" + nf(now.getSeconds(), 2);
    ui.clock.dateTime = now.toISOString();
    ui.clockDate.textContent = clockDateFormat.format(now).toUpperCase();
    ui.clockZone.textContent = clockZoneFormat.formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value.toUpperCase() || "";
    displayedClockSecond = clockSecond;
  }
}

// One Date snapshot avoids mixing values captured on opposite sides of a tick.
// Passing a Date explicitly also allows repeatable simulated-time checks.
function readLocalTime(now = new Date()) {
  return { h: now.getHours(), m: now.getMinutes(), s: now.getSeconds(), ms: now.getMilliseconds() };
}

// Actual mapping executed before drawing; no dependence on previous frames.
function updateFold(p, localTime) {
  const a = foldTimeSettings;
  const seconds = localTime.s + (localTime.ms ?? 0) / 1000;
  const minutes = localTime.m + seconds / 60;
  const hours = localTime.h + minutes / 60;
  // Expose the exact evaluated inputs; the viewer never recalculates time.
  p.timeState = { seconds, minutes, hours };
  const day = TWO_PI * hours / 24;
  const hour = TWO_PI * minutes / 60;
  const minute = TWO_PI * seconds / 60;
  // Local aliases are visual amplitudes, not time or frequency multipliers.
  const tilt = a.tilt * orientationVisualMultiplier;
  const fold = a.foldSwing * foldVisualMultiplier;
  const phase = a.phaseSwing * phaseVisualMultiplier;
  const shift = a.shiftSwing * phaseVisualMultiplier;
  // Shared evaluated amplitudes, exposed for the educational viewer only.
  p.mappingState = { tilt, fold, phase, shift };
  p.tilt = tilt * sin(day);
  p.foldStrength = a.foldBase + fold * cos(hour);
  // The renderer uses phase only inside periodic sin(), so its wrap is seamless.
  p.phase = minute;
  p.layerPhase = a.phaseBase + phase * sin(minute);
  p.layerShift = a.shiftBase + shift * cos(minute);
  // Primary-surface motion: actual distances/angles, not a faster clock.
  p.surfaceTravel = 0.025 * surfaceMotionMultiplier * sin(minute);
  p.surfaceTwist = 0.035 * surfaceMotionMultiplier * cos(minute);
  p.surfaceBend = 4 * surfaceMotionMultiplier * sin(minute + PI / 4);
}

// Generate each curve once per frame, then reuse it for fitting and drawing.
// Foreground segments need fewer samples than the full-height rear curves.
function buildFoldMesh(p) {
  const frontSamples = 48;
  const rearSteps = p.samples + 2 * p.extensionSamples;
  const key = [p.lineCount, p.secondaryLineCount, rearSteps].join(":");
  if (!foldMesh || foldMesh.key !== key) {
    foldMesh = {
      key,
      layers: [p.lineCount, p.secondaryLineCount].map((count) => ({
        count,
        rear: new Float64Array(count * (rearSteps + 1) * 2),
        front: new Float64Array(count * (frontSamples + 1) * 2),
      })),
      edge: new Float64Array(162 * 2),
    };
  }
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const endCaps = { topMaxY: -Infinity, bottomMinY: Infinity };
  const point = { x: 0, y: 0 };
  // The S-profile depends on height, not thread index: reuse it across lines.
  const rearProfiles = Array.from({ length: rearSteps + 1 }, (_, j) =>
    foldProfile(p, foldSampleT(p, j)));
  const frames = [0, 1].map((layer) => ({
    cos: cos(p.tilt + layer * p.layerTilt),
    sin: sin(p.tilt + layer * p.layerTilt),
    phaseOffset: layer * 0.025 * (sin(p.phase + layer * p.layerPhase) - sin(p.phase)),
  }));
  function store(buffer, offset, u, t, layer, profile) {
    const frame = frames[layer];
    foldPoint(p, u, t, layer, point, frame.phaseOffset, profile);
    const x = point.x * frame.cos - point.y * frame.sin;
    const y = point.x * frame.sin + point.y * frame.cos;
    buffer[offset] = x;
    buffer[offset + 1] = y;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
  }
  foldMesh.layers.forEach((layerMesh, layer) => {
    const spacing = layer === 0 ? p.lineSpacing : p.secondaryLineSpacing;
    for (let i = 0; i < layerMesh.count; i++) {
      const u = -p.ribbonWidth / 2 + i * spacing;
      for (let j = 0; j <= rearSteps; j++) {
        store(layerMesh.rear, (i * (rearSteps + 1) + j) * 2,
          u, foldSampleT(p, j), layer, rearProfiles[j]);
      }
      // A bounding box can hide a slanted end still terminating on screen.
      // Check the closest upper and lower endpoints across BOTH line systems.
      endCaps.topMaxY = Math.max(endCaps.topMaxY, layerMesh.rear[i * (rearSteps + 1) * 2 + 1]);
      endCaps.bottomMinY = Math.min(endCaps.bottomMinY, layerMesh.rear[(i * (rearSteps + 1) + rearSteps) * 2 + 1]);
      for (let j = 0; j <= frontSamples; j++) {
        const t = map(j, 0, frontSamples, p.frontStart, p.frontEnd)
          + p.foldDiagonal * u / p.ribbonWidth + p.surfaceTravel;
        store(layerMesh.front, (i * (frontSamples + 1) + j) * 2, u, t, layer);
      }
    }
  });
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i <= 80; i++) {
      const u = map(side === 0 ? i : 80 - i, 0, 80, -p.ribbonWidth / 2, p.ribbonWidth / 2);
      const t = (side === 0 ? p.frontStart : p.frontEnd)
        + p.foldDiagonal * u / p.ribbonWidth + p.surfaceTravel;
      store(foldMesh.edge, (side * 81 + i) * 2, u, t, 0);
    }
  }
  foldMesh.bounds = bounds;
  foldMesh.endCaps = endCaps;
  foldMesh.rearSteps = rearSteps;
  foldMesh.frontSamples = frontSamples;
  foldMesh.rearProfiles = rearProfiles;
  // Frame the material's central crease, including its existing animated travel.
  foldPoint(p, 0, p.surfaceTravel, 0, point);
  foldMesh.foldAnchor = {
    x: point.x * frames[0].cos - point.y * frames[0].sin,
    y: point.x * frames[0].sin + point.y * frames[0].cos,
  };
  return foldMesh;
}

// Keep the original central sampling exactly; add gently curved continuation
// above and below it without spending full sampling density on offscreen tails.
function foldSampleT(p, j) {
  if (j < p.extensionSamples) {
    return map(j, 0, p.extensionSamples, -p.verticalExtent, -1);
  }
  if (j > p.extensionSamples + p.samples) {
    return map(j - p.extensionSamples - p.samples, 0, p.extensionSamples, 1, p.verticalExtent);
  }
  return map(j - p.extensionSamples, 0, p.samples, -1, 1);
}

function fitFoldToCanvas(bounds, canvasWidth = width, canvasHeight = height, foldAnchor, endCaps) {
  const geometryHeight = bounds.maxY - bounds.minY;
  const geometryWidth = bounds.maxX - bounds.minX;
  const desiredScale = modes.Fold.parameters.verticalCoverage * canvasHeight / geometryHeight;
  const anchorY = foldAnchor ? foldAnchor.y : (bounds.minY + bounds.maxY) / 2;
  const caps = endCaps || { topMaxY: bounds.minY, bottomMinY: bounds.maxY };
  const nearestEnd = Math.min(anchorY - caps.topMaxY, caps.bottomMinY - anchorY);
  const safetyScale = (0.5 + modes.Fold.parameters.verticalSafetyMargin) * canvasHeight / Math.max(1, nearestEnd);
  // Fit width when possible, but never shrink below guaranteed vertical coverage.
  // Extended tails make both requirements compatible at normal panel sizes.
  const scale = Math.max(safetyScale, Math.min(desiredScale, (canvasWidth - 2) / geometryWidth));
  return {
    scale,
    x: canvasWidth / 2 - (bounds.minX + bounds.maxX) / 2 * scale,
    y: canvasHeight / 2 - anchorY * scale,
    horizontalFit: geometryWidth * scale <= canvasWidth,
    heightCoverage: geometryHeight * scale / canvasHeight,
    topEndY: canvasHeight / 2 + (caps.topMaxY - anchorY) * scale,
    bottomEndY: canvasHeight / 2 + (caps.bottomMinY - anchorY) * scale,
  };
}

function drawFold(p, canvasWidth = width, canvasHeight = height) {
  const started = performance.now();
  const mesh = buildFoldMesh(p);
  const fit = fitFoldToCanvas(mesh.bounds, canvasWidth, canvasHeight, mesh.foldAnchor, mesh.endCaps);
  lastFoldFit = fit;
  push();
  translate(fit.x, fit.y);
  scale(fit.scale);
  drawFoldLayer(p, mesh.layers[0], 0, false);
  drawFoldLayer(p, mesh.layers[1], 1, false);

  // Hide rear lines beneath the front-facing part of the same ribbon.
  push();
  fill(artworkPalette.paper);
  noStroke();
  beginShape();
  for (let i = 0; i < mesh.edge.length; i += 2) vertex(mesh.edge[i], mesh.edge[i + 1]);
  endShape(CLOSE);
  pop();
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.moveTo(mesh.edge[0], mesh.edge[1]);
  for (let i = 2; i < mesh.edge.length; i += 2) drawingContext.lineTo(mesh.edge[i], mesh.edge[i + 1]);
  drawingContext.closePath();
  drawingContext.clip();
  drawFoldLayer(p, mesh.layers[0], 0, true);
  drawFoldLayer(p, mesh.layers[1], 1, true);
  drawingContext.restore();
  pop();
  lastFoldRenderMs = performance.now() - started;
}

function drawFoldLayer(p, layerMesh, layer, frontOnly) {
  const ctx = drawingContext;
  ctx.strokeStyle = artworkPalette.ink;
  ctx.lineWidth = layer === 0 ? p.strokeWeight : p.secondaryStrokeWeight;
  const points = frontOnly ? layerMesh.front : layerMesh.rear;
  const steps = frontOnly ? foldMesh.frontSamples : foldMesh.rearSteps;
  // Batch all threads into one native Canvas path per layer/pass, avoiding
  // thousands of p5 vertex allocations and one stroke call per thread.
  ctx.beginPath();
  for (let i = 0; i < layerMesh.count; i++) {
    const first = i * (steps + 1) * 2;
    ctx.moveTo(points[first], points[first + 1]);
    for (let j = 1; j <= steps; j++) {
      const offset = (i * (steps + 1) + j) * 2;
      ctx.lineTo(points[offset], points[offset + 1]);
    }
  }
  ctx.stroke();
}

// Optional console inspection; no additional information is added to the UI.
function getFoldRenderReport() {
  const rect = ui.canvas.elt.getBoundingClientRect();
  return {
    css: { width: rect.width, height: rect.height },
    buffer: { width: ui.canvas.elt.width, height: ui.canvas.elt.height },
    pixelDensity: pixelDensity(),
    bounds: foldMesh?.bounds,
    fit: lastFoldFit,
    lastFoldRenderMs,
  };
}

// Two unequal localized lobes define the S-centerline and its width profile.
// The analytical tangent gives a perpendicular direction for each cross-section.
function foldProfile(p, t) {
  const upper = exp(-pow((t - p.upperCurveCenter) / p.upperCurveSpread, 2));
  const lower = exp(-pow((t - p.lowerCurveCenter) / p.lowerCurveSpread, 2));
  const waist = exp(-pow(t / 0.22, 2));
  const centerX = p.upperLean * upper + p.lowerLean * lower - p.lowerReturn * t;
  const derivative = p.upperLean * upper * -2 * (t - p.upperCurveCenter) / pow(p.upperCurveSpread, 2)
    + p.lowerLean * lower * -2 * (t - p.lowerCurveCenter) / pow(p.lowerCurveSpread, 2) - p.lowerReturn;
  const slope = derivative / (p.ribbonHeight / 2);
  const normalX = 1 / Math.sqrt(1 + slope * slope);
  const normalY = -slope * normalX;
  const widthScale = 1 + p.lowerFlare * lower - p.upperPinch * upper
    - p.waistPinch * waist + p.topOpening * pow(max(-t, 0), 2);
  return { centerX, widthScale, normalX, normalY };
}

// A 2D surface projection shared by the lines and their occluding boundary.
function foldPoint(p, u, t, layer, out = {}, phaseOffset, profile) {
  profile ??= foldProfile(p, t);
  phaseOffset ??= layer * 0.025 * (sin(p.phase + layer * p.layerPhase) - sin(p.phase));
  const q = 2 * u / p.ribbonWidth;
  // Shift the fold along each thread so the crease runs diagonally.
  const z = t - p.foldDiagonal * u / p.ribbonWidth - p.surfaceTravel - phaseOffset;
  // Enter the fold gradually from above, release more tightly below.
  const spread = p.foldSpread * (z < 0 ? 1.2 : 0.75);
  const envelope = exp(-pow(z / spread, 2));
  const twist = (p.foldStrength + p.surfaceTwist
    + layer * p.layerTwist + p.surfaceTurn * q) * envelope;
  // A monotonic spacing bias gathers threads on one side, opening the other.
  const v = u + p.densityBias * p.ribbonWidth / 2 * (1 - q * q) * envelope;
  const bend = (24 + p.surfaceBend + 12 * z / spread) * envelope;
  // Relative displacement fades out at the ends to preserve the silhouette.
  const shift = layer * p.layerShift * envelope;
  // Across-ribbon position changes the twist, density and projected curvature.
  const across = v * profile.widthScale * cos(twist);
  const x = profile.centerX + across * profile.normalX + bend + shift
    + p.edgeSweep * q * q * envelope;
  const y = t * p.ribbonHeight / 2 + across * profile.normalY + v * sin(twist) * 0.65
    + p.surfaceCamber * (1 - q * q) * envelope;
  out.x = x;
  out.y = y;
  return out;
}

function updateCapsule(p, localTime) {
  const seconds = localTime.s + (localTime.ms ?? 0) / 1000;
  const minutes = localTime.m + seconds / 60;
  const hours = localTime.h + minutes / 60;
  p.timeState = { seconds, minutes, hours };
  const dayAngle = 2 * Math.PI * hours / 24;
  const hourAngle = 2 * Math.PI * minutes / 60;
  p.phase = 2 * Math.PI * seconds / 60;
  p.tilt = p.tiltAmplitude * p.orientationVisualMultiplier * Math.sin(dayAngle);
  p.proportion = 1 + p.proportionAmplitude * Math.cos(dayAngle);
  p.expansion = 1 + p.expansionAmplitude * p.deformationVisualMultiplier * Math.sin(hourAngle);
  p.attractors.forEach((source, i) => {
    const center = p.centers[i] ??= {};
    const phase = p.phase + source.offset;
    const motion = p.motionVisualMultiplier;
    center.x = source.x * p.proportion + source.driftX * motion * Math.cos(phase);
    center.y = source.y + source.driftY * motion * Math.sin(phase);
    center.radiusX = source.radiusX * p.proportion * p.expansion
      * (1 + p.localBreathing * motion * Math.sin(phase));
    center.radiusY = source.radiusY * p.expansion
      * (1 + p.localBreathing * motion * Math.cos(phase));
    center.strength = source.strength
      * (1 + p.strengthAmplitude * p.deformationVisualMultiplier * Math.cos(hourAngle + source.offset))
      * (1 + 0.04 * Math.sin(dayAngle + source.offset))
      * (1 + p.heightBreathing * motion * Math.sin(phase + 0.55));
  });
  p.centers.length = p.attractors.length;
  // The existing readout reports the left region's actual projected ground shift.
  const dx = p.centers[0].x - p.attractors[0].x * p.proportion;
  const dy = (p.centers[0].y - p.attractors[0].y) * Math.sin(p.viewElevation);
  p.localShift = Math.hypot(dx, dy);
}

function capsuleSmoothstep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

// This grid contains actual surface heights, not a screen-space distortion field.
function buildCapsuleField(p, canvasWidth = width, canvasHeight = height) {
  const halfWidth = p.footprintWidth * (1 + p.proportionAmplitude) + p.gridSpacing * 2;
  const halfDepth = p.footprintDepth + p.gridSpacing * 2;
  const cols = Math.ceil(halfWidth * 2 / p.gridSpacing) + 1;
  const rows = Math.ceil(halfDepth * 2 / p.gridSpacing) + 1;
  const key = [cols, rows, p.attractors.length, p.contourCount, p.thresholdLow, p.thresholdHigh, p.densityBias].join(":");
  if (!capsuleField || capsuleField.key !== key) {
    capsuleField = {
      key, cols, rows, values: new Float64Array(cols * rows),
      horizon: new Float64Array(cols * rows),
      xInfluences: new Float64Array(cols * p.attractors.length),
      yInfluences: new Float64Array(rows * p.attractors.length),
      levelLow: p.thresholdLow, levelHigh: p.thresholdHigh,
      lookupScale: 2048 / (p.thresholdHigh - p.thresholdLow), levelLookup: new Uint16Array(2049),
      levels: Array.from({ length: p.contourCount }, (_, i) => {
        const t = i / (p.contourCount - 1);
        const fraction = t + p.densityBias * Math.sin(2 * Math.PI * t) / (2 * Math.PI);
        return {
          value: p.thresholdLow + (p.thresholdHigh - p.thresholdLow) * fraction,
          count: 0, capacity: 1024, coordinates: new Float64Array(4096),
          links: new Int32Array(2048), visited: new Uint8Array(1024),
          horizontal: new Int32Array(cols - 1), vertical: new Int32Array(2),
        };
      }),
      path: [], paths: [],
    };
    let index = 0;
    for (let i = 0; i <= 2048; i++) {
      const value = p.thresholdLow + (p.thresholdHigh - p.thresholdLow) * i / 2048;
      while (index < capsuleField.levels.length && capsuleField.levels[index].value <= value) index++;
      capsuleField.levelLookup[i] = index;
    }
  }
  const field = capsuleField;
  field.x = -halfWidth; field.y = -halfDepth;
  field.stepX = field.stepY = p.gridSpacing;
  field.sinView = Math.sin(p.viewElevation); field.cosView = Math.cos(p.viewElevation);
  field.cosTilt = Math.cos(p.tilt); field.sinTilt = Math.sin(p.tilt);
  p.centers.forEach((center, n) => {
    for (let x = 0; x < cols; x++) {
      const distance = (field.x + x * field.stepX - center.x) / center.radiusX;
      field.xInfluences[n * cols + x] = center.strength * Math.exp(-distance * distance);
    }
    for (let y = 0; y < rows; y++) {
      const distance = (field.y + y * field.stepY - center.y) / center.radiusY;
      field.yInfluences[n * rows + y] = Math.exp(-distance * distance);
    }
  });
  for (let y = 0; y < rows; y++) {
    const wy = field.y + y * field.stepY;
    for (let x = 0; x < cols; x++) {
      const wx = field.x + x * field.stepX;
      // A quiet, compact foundation anchors the outside while the hills move inside.
      const nx = wx / (p.footprintWidth * p.proportion);
      const ny = (wy - 18 * Math.sin(nx * Math.PI)) / p.footprintDepth;
      const support = Math.max(0, 1 - nx * nx - ny * ny);
      // Bend the footprint of each hill in world space, rather than adding
      // screen-space wobbles to circles. This creates stretched folds, tilted
      // ridges and irregular saddle connections with smooth derivatives.
      let hills = 0;
      for (let n = 0; n < p.centers.length; n++) {
        const c = p.centers[n];
        const dx = (wx - c.x) / c.radiusX;
        const dy = (wy - c.y) / c.radiusY;
        const bend = p.organicWarp * (
          0.57 * Math.sin(1.55 * dx + n * 1.34)
          + 0.38 * dx
          + 0.27 * Math.sin(wx * 0.0055 + n * 0.9 + p.phase * 0.65)
        );
        const along = dy - bend;
        hills += field.xInfluences[n * cols + x] * Math.exp(-along * along);
      }
      // One low connecting ridge ties all centers into the same surface.
      // A seconds-driven transverse bend makes its saddles visibly flow.
      const ridgeCenter = 18 + 49 * Math.sin(wx * 0.0058 + 0.55)
        + 31 * Math.sin(wx * 0.0032 - p.phase);
      const ry = (wy - ridgeCenter) / p.ridgeWidth;
      const rx = wx / (p.footprintWidth * 0.76);
      const ridge = p.ridgeHeight * Math.exp(-ry * ry - Math.pow(rx, 4));
      // Traveling deformation is confined to the hills/ridge; the silhouette
      // stays stable and fits inside the same margins throughout the minute.
      const flow = p.travelingWarp * Math.sin(wx * 0.0068 - p.phase)
        * Math.cos(wy * 0.008 + p.phase * 0.70);
      const combined = hills + ridge + flow * capsuleSmoothstep(support / 0.34);
      const relief = (combined + Math.sqrt(combined * combined + 0.003)) / 2;
      field.values[y * cols + x] = p.baseHeight * support * support
        + capsuleSmoothstep(support / 0.60) * relief * p.reliefContrast;
    }
  }
  // Sweep front to back along each viewing ray. Anything below this horizon is
  // hidden by nearer terrain. This replaces the old flattening/slope clamp.
  for (let x = 0; x < cols; x++) {
    let horizon = Infinity;
    for (let y = rows - 1; y >= 0; y--) {
      const index = y * cols + x;
      const screenY = (field.y + y * field.stepY) * field.sinView
        - field.values[index] * p.elevationScale * field.cosView;
      horizon = Math.min(horizon, screenY);
      field.horizon[index] = horizon;
    }
  }
  extractCapsuleContours(field);
  fitCapsuleSurface(p, field, canvasWidth, canvasHeight);
  return field;
}

// Bilinear sampling keeps the draped lines and visibility tests on the same mesh.
function sampleCapsuleGrid(field, values, x, y) {
  const gx = Math.max(0, Math.min(field.cols - 1.000001, (x - field.x) / field.stepX));
  const gy = Math.max(0, Math.min(field.rows - 1.000001, (y - field.y) / field.stepY));
  const col = Math.floor(gx), row = Math.floor(gy), tx = gx - col, ty = gy - row;
  const i = row * field.cols + col;
  const a = values[i] * (1 - tx) + values[i + 1] * tx;
  const b = values[i + field.cols] * (1 - tx) + values[i + field.cols + 1] * tx;
  return a * (1 - ty) + b * ty;
}

function projectCapsulePoint(p, field, x, y, height, out) {
  // Orthographic camera: (x, y, z = height * elevationScale) -> (screenX, screenY).
  const screenY = y * field.sinView - height * p.elevationScale * field.cosView;
  out.x = field.cosTilt * x - field.sinTilt * screenY;
  out.y = field.sinTilt * x + field.cosTilt * screenY;
  out.visibility = sampleCapsuleGrid(field, field.horizon, x, y) - screenY + p.visibilityTolerance;
  return out;
}

function fitCapsuleSurface(p, field, canvasWidth, canvasHeight) {
  field.paths.length = 0;
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  // Include the continuous surface, even between contour levels. Otherwise a
  // tiny summit loop appearing/disappearing could suddenly change the framing.
  for (let row = 0; row < field.rows; row++) {
    const y = field.y + row * field.stepY;
    for (let col = 0; col < field.cols; col++) {
      const height = field.values[row * field.cols + col];
      if (height < p.thresholdLow) continue;
      const x = field.x + col * field.stepX;
      const sy = y * field.sinView - height * p.elevationScale * field.cosView;
      const px = field.cosTilt * x - field.sinTilt * sy;
      const py = field.sinTilt * x + field.cosTilt * sy;
      bounds.minX = Math.min(bounds.minX, px); bounds.maxX = Math.max(bounds.maxX, px);
      bounds.minY = Math.min(bounds.minY, py); bounds.maxY = Math.max(bounds.maxY, py);
    }
  }
  const point = {};
  for (let levelIndex = 0; levelIndex < field.levels.length; levelIndex++) {
    const level = field.levels[levelIndex];
    level.visited.fill(0, 0, level.count);
    for (let start = 0; start < level.count; start++) {
      if (level.visited[start]) continue;
      const closed = traceCapsuleContour(level, start, 0, field.path);
      const layers = levelIndex % p.secondaryEvery === 0 && level.value > p.secondaryStart ? 2 : 1;
      for (let layer = 0; layer < layers; layer++) {
        const projected = [], visibility = [];
        for (let k = 0; k < field.path.length; k += 2) {
          let x = field.path[k], y = field.path[k + 1], height = level.value;
          if (layer) {
            // Move the sparse secondary markings in ground coordinates, then lay
            // them back on the terrain. They obey exactly the same occlusion.
            const envelope = capsuleSmoothstep((height - p.secondaryStart) / 0.75);
            x += envelope * p.phaseVisualMultiplier * (p.layerShift * Math.cos(p.phase)
              + p.layerWarp * Math.sin(y * 0.008 + p.phase));
            y += envelope * p.phaseVisualMultiplier * p.layerShift * Math.sin(p.phase + x * 0.003);
            height = sampleCapsuleGrid(field, field.values, x, y);
          }
          projectCapsulePoint(p, field, x, y, height, point);
          projected.push(point.x, point.y); visibility.push(point.visibility);
          bounds.minX = Math.min(bounds.minX, point.x); bounds.maxX = Math.max(bounds.maxX, point.x);
          bounds.minY = Math.min(bounds.minY, point.y); bounds.maxY = Math.max(bounds.maxY, point.y);
        }
        clipCapsuleContour(field.paths, projected, visibility, closed, layer, level.value);
      }
    }
  }
  const spanX = Math.max(1, bounds.maxX - bounds.minX), spanY = Math.max(1, bounds.maxY - bounds.minY);
  p.renderScale = Math.max(0.001, Math.min(
    (canvasWidth * p.widthCoverage - p.strokeWeight) / spanX,
    (canvasHeight * p.heightCoverage - p.strokeWeight) / spanY
  ));
  p.fit = { ...bounds, centerX: (bounds.minX + bounds.maxX) / 2, centerY: (bounds.minY + bounds.maxY) / 2 };
}

// Keep only visible runs. At occlusions, interpolate each visibility boundary
// instead of drawing rear contours through the front slopes or painting fills.
function clipCapsuleContour(paths, points, visibility, closed, layer, level) {
  const count = visibility.length;
  if (count < 3) return;
  const hidden = visibility.findIndex(value => value < 0);
  if (hidden === -1) { paths.push({ points, closed, layer, level }); return; }
  let run = [];
  const edges = closed ? count : count - 1;
  for (let n = 0; n < edges; n++) {
    const a = closed ? (hidden + n) % count : n, b = (a + 1) % count;
    const va = visibility[a], vb = visibility[b];
    if (va >= 0 && !run.length) run.push(points[a * 2], points[a * 2 + 1]);
    if ((va >= 0) !== (vb >= 0)) {
      const t = va / (va - vb);
      run.push(points[a * 2] + t * (points[b * 2] - points[a * 2]),
        points[a * 2 + 1] + t * (points[b * 2 + 1] - points[a * 2 + 1]));
      if (va >= 0) {
        if (run.length >= 6) paths.push({ points: run, closed: false, layer, level });
        run = [];
      }
    }
    if (vb >= 0) run.push(points[b * 2], points[b * 2 + 1]);
  }
  if (run.length >= 6) paths.push({ points: run, closed: false, layer, level });
}

// First threshold strictly above a value; used to skip inactive levels per cell.
function capsuleLevelIndex(field, value) {
  if (value < field.levelLow) return 0;
  if (value >= field.levelHigh) return field.levels.length;
  const bucket = Math.floor((value - field.levelLow) * field.lookupScale);
  let index = field.levelLookup[bucket];
  // A coarse lookup plus exact comparisons replaces a binary search in every cell.
  while (index < field.levels.length && field.levels[index].value <= value) index++;
  while (index > 0 && field.levels[index - 1].value > value) index--;
  return index;
}

function extractCapsuleContours(field) {
  const { cols, rows, values, levels, stepX, stepY } = field;
  const region = field.activeBounds ?? { minX: 0, minY: 0, maxX: cols - 1, maxY: rows - 1 };
  for (const level of levels) { level.count = 0; level.horizontal.fill(-1); }
  const ex = new Float64Array(4), ey = new Float64Array(4);
  for (let y = region.minY; y < region.maxY; y++) {
    for (const level of levels) level.vertical.fill(-1);
    for (let x = region.minX; x < region.maxX; x++) {
      const index = y * cols + x;
      const a = values[index], b = values[index + 1];
      const c = values[index + cols + 1], d = values[index + cols];
      const first = capsuleLevelIndex(field, Math.min(a, b, c, d));
      const last = capsuleLevelIndex(field, Math.max(a, b, c, d));
      const px = field.x + x * stepX, py = field.y + y * stepY;
      for (let i = first; i < last; i++) {
        const level = levels[i], v = level.value;
        const topLeft = a > v, topRight = b > v, bottomRight = c > v, bottomLeft = d > v;
        let mask = 0;
        if (topLeft !== topRight) {
          ex[0] = px + stepX * (v - a) / (b - a); ey[0] = py;
          mask |= 1;
        }
        if (topRight !== bottomRight) {
          ex[1] = px + stepX; ey[1] = py + stepY * (v - b) / (c - b);
          mask |= 2;
        }
        if (bottomLeft !== bottomRight) {
          ex[2] = px + stepX * (v - d) / (c - d); ey[2] = py + stepY;
          mask |= 4;
        }
        if (topLeft !== bottomLeft) {
          ex[3] = px; ey[3] = py + stepY * (v - a) / (d - a);
          mask |= 8;
        }
        if (mask === 15) {
          // Bilinear saddle test: neighboring cells agree on which neck connects.
          const positive = (a - v) * (c - v) - (b - v) * (d - v) >= 0;
          addCapsuleSegment(level, positive ? 0 : 3, positive ? 1 : 0, x, ex, ey);
          addCapsuleSegment(level, positive ? 2 : 1, positive ? 3 : 2, x, ex, ey);
        } else if (mask !== 0) {
          let start = -1;
          for (let edge = 0; edge < 4; edge++) {
            if (!(mask & (1 << edge))) continue;
            if (start === -1) start = edge;
            else addCapsuleSegment(level, start, edge, x, ex, ey);
          }
        }
      }
    }
  }
  for (const level of levels) level.visited.fill(0, 0, level.count);
}

function addCapsuleSegment(level, a, b, column, x, y) {
  const segment = level.count++;
  if (segment === level.capacity) {
    level.capacity *= 2;
    for (const [name, Type, size] of [["coordinates", Float64Array, 4], ["links", Int32Array, 2], ["visited", Uint8Array, 1]]) {
      const larger = new Type(level.capacity * size);
      larger.set(level[name]); level[name] = larger;
    }
  }
  const k = segment * 4;
  level.coordinates[k] = x[a]; level.coordinates[k + 1] = y[a];
  level.coordinates[k + 2] = x[b]; level.coordinates[k + 3] = y[b];
  for (let side = 0; side < 2; side++) {
    const endpoint = segment * 2 + side;
    level.links[endpoint] = -1;
    const edge = side === 0 ? a : b;
    // Top/left edges meet earlier cells; bottom/right wait for the next cell.
    // Small rolling caches replace thousands of temporary hash-map entries.
    let neighbor = -1;
    if (edge === 0) {
      neighbor = level.horizontal[column]; level.horizontal[column] = -1;
    } else if (edge === 2) level.horizontal[column] = endpoint;
    else if (edge === 3) {
      neighbor = level.vertical[column & 1]; level.vertical[column & 1] = -1;
    } else level.vertical[(column + 1) & 1] = endpoint;
    if (neighbor !== -1) {
      level.links[endpoint] = neighbor >> 1;
      level.links[neighbor] = segment;
    }
  }
}

// Stitch shared grid edges into whole contours; no rounded-coordinate matching.
function traceCapsuleContour(level, start, side, path, coordinates = level.coordinates) {
  path.length = 0;
  let segment = start, closed = false;
  let k = segment * 4 + side * 2;
  path.push(coordinates[k], coordinates[k + 1]);
  while (!level.visited[segment]) {
    level.visited[segment] = 1;
    k = segment * 4 + (1 - side) * 2;
    path.push(coordinates[k], coordinates[k + 1]);
    const next = level.links[segment * 2 + 1 - side];
    if (next === -1) break;
    if (next === start) { closed = true; path.length -= 2; break; }
    side = level.links[next * 2] === segment ? 0 : 1;
    segment = next;
  }
  return closed;
}

function drawCapsuleContour(ctx, path, closed) {
  const count = path.length / 2;
  if (count < 3) return;
  if (closed) {
    ctx.moveTo((path[0] + path[path.length - 2]) / 2, (path[1] + path[path.length - 1]) / 2);
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      ctx.quadraticCurveTo(path[i * 2], path[i * 2 + 1],
        (path[i * 2] + path[next * 2]) / 2, (path[i * 2 + 1] + path[next * 2 + 1]) / 2);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(path[0], path[1]);
    for (let i = 1; i < count - 1; i++) {
      ctx.quadraticCurveTo(path[i * 2], path[i * 2 + 1],
        (path[i * 2] + path[i * 2 + 2]) / 2, (path[i * 2 + 1] + path[i * 2 + 3]) / 2);
    }
    ctx.lineTo(path[path.length - 2], path[path.length - 1]);
  }
}

function drawCapsule(p, canvasWidth = width, canvasHeight = height) {
  const field = buildCapsuleField(p, canvasWidth, canvasHeight);
  push();
  translate(canvasWidth / 2, canvasHeight / 2);
  scale(p.renderScale);
  translate(-p.fit.centerX, -p.fit.centerY);
  const ctx = drawingContext;
  ctx.strokeStyle = artworkPalette.ink;
  for (let layer = 0; layer < 2; layer++) {
    ctx.lineWidth = (layer === 0 ? p.strokeWeight : p.secondaryStrokeWeight) / p.renderScale;
    ctx.beginPath();
    for (const path of field.paths) {
      if (path.layer === layer) drawCapsuleContour(ctx, path.points, path.closed);
    }
    ctx.stroke();
  }
  pop();
}

// Cross: rotated hyperbolas form a woven envelope, with no filled ribbon surfaces.
function updateCross(p, localTime) {
  const seconds = localTime.s + (localTime.ms ?? 0) / 1000;
  const minutes = localTime.m + seconds / 60;
  const hours = localTime.h + minutes / 60;
  p.timeState = { seconds, minutes, hours };
  const day = 2 * Math.PI * hours / 24;
  const minuteCycle = 2 * Math.PI * minutes / 60;
  p.phase = 2 * Math.PI * seconds / 60;
  p.armOpening = p.openingBase + p.openingAmplitude * Math.sin(day);
  p.vortexStrength = p.vortexBase + p.vortexAmplitude * Math.cos(minuteCycle);
  // These amplitudes change geometry, never the clock's cycle lengths.
  p.spiralPhase = p.flowAmplitude * Math.sin(p.phase);
  p.coreMotion = p.spiralBreath * Math.cos(p.phase);
}

// u selects a curve across the fan; t travels from one outer end to the other.
function crossFilamentPoint(p, u, t, throat, out) {
  // x² - y² = throat²: a rounded bend joining two almost straight outer arms.
  const x = throat * Math.cosh(t);
  const y = throat * Math.sinh(t);
  const radius = Math.hypot(x, y);
  const near = Math.exp(-Math.pow(radius / p.spiralRadius, 2));
  const winding = (p.vortexStrength + p.spiralPhase) * near;
  // Align the inner bends more gently, rounding the negative space between them.
  const fanAngle = u * p.fanSpread * (1 - p.coreFanSoftness * near);
  const angle = -p.armOpening - fanAngle + winding;
  out.x = x * Math.cos(angle) - y * Math.sin(angle);
  out.y = x * Math.sin(angle) + y * Math.cos(angle);
  return out;
}

function buildCrossMesh(p, canvasWidth = width, canvasHeight = height) {
  const pointCount = (p.samples + 1) * 2;
  // Reuse the buffers rather than allocating thousands of points every frame.
  if (!crossMesh || crossMesh.lines.length !== p.lineCount * 4
      || crossMesh.lines[0].length !== pointCount) {
    crossMesh = { lines: Array.from({ length: p.lineCount * 4 }, () => new Float64Array(pointCount)) };
  }
  const point = { x: 0, y: 0 };
  for (let i = 0; i < p.lineCount; i++) {
    const u = (i + 0.5) / p.lineCount;
    // Wider inner intervals reduce stacking; the outer fan still has all 68 lines.
    const corePosition = Math.pow(u, p.coreSpacingExponent);
    // Keep the inner opening calm while preserving full motion farther out.
    const motionWeight = p.coreMotionFloor + (1 - p.coreMotionFloor) * u;
    const breathing = 1 + motionWeight * (p.coreMotion + p.curveBreath * Math.sin(p.phase + u * Math.PI));
    const throat = p.coreRadius + p.coreSpread * corePosition * breathing
      * (1 + 0.35 * (p.vortexStrength - p.vortexBase));
    const endRadius = p.outerRadius * (1 - p.endTaper * u);
    // Solve x² + y² = endRadius² for t, so endpoints stay on the fan boundary.
    const limit = 0.5 * Math.acosh(Math.max(1.001, endRadius * endRadius / (throat * throat)));
    for (let j = 0; j <= p.samples; j++) {
      const t = -limit + 2 * limit * j / p.samples;
      crossFilamentPoint(p, u, t, throat, point);
      for (let arm = 0; arm < 4; arm++) {
        // Exact quarter turns preserve the four-arm structure without extra trig.
        const x = arm === 0 ? point.x : arm === 1 ? -point.y : arm === 2 ? -point.x : point.y;
        const y = arm === 0 ? point.y : arm === 1 ? point.x : arm === 2 ? -point.y : -point.x;
        const line = crossMesh.lines[arm * p.lineCount + i];
        line[j * 2] = x * p.horizontalScale;
        line[j * 2 + 1] = y;
      }
    }
  }

  // Rotation preserves radius, so this bound is valid at EVERY clock phase.
  // A fixed fit prevents zoom pumping; only the far top/bottom rays may crop.
  p.renderScale = Math.min(
    canvasWidth * p.widthCoverage / (2 * p.outerRadius * p.horizontalScale),
    canvasHeight * p.heightCoverage / (2 * p.outerRadius)
  );
  return crossMesh;
}

function drawCross(p, canvasWidth = width, canvasHeight = height) {
  const mesh = buildCrossMesh(p, canvasWidth, canvasHeight);
  const ctx = drawingContext;
  push();
  translate(canvasWidth / 2, canvasHeight / 2);
  scale(p.renderScale);
  ctx.strokeStyle = artworkPalette.ink;
  ctx.lineWidth = p.strokeWeight / p.renderScale; // Constant CSS-pixel line weight.
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const line of mesh.lines) {
    ctx.moveTo(line[0], line[1]);
    for (let i = 2; i < line.length - 2; i += 2) {
      ctx.quadraticCurveTo(line[i], line[i + 1],
        (line[i] + line[i + 2]) / 2, (line[i + 1] + line[i + 3]) / 2);
    }
    ctx.lineTo(line[line.length - 2], line[line.length - 1]);
  }
  ctx.stroke();
  pop();
}

// Wave: two different sine frequencies trace each closed Lissajous loop.
function updateWave(p, localTime) {
  const seconds = localTime.s + (localTime.ms ?? 0) / 1000;
  const minutes = localTime.m + seconds / 60;
  const hours = localTime.h + minutes / 60;
  p.timeState = { seconds, minutes, hours };
  const dayPhase = TWO_PI * hours / 24;
  const hourPhase = TWO_PI * minutes / 60;
  const secondPhase = TWO_PI * seconds / 60;

  p.tilt = p.tiltAmplitude * Math.sin(dayPhase);
  p.proportion = 1 + p.proportionAmplitude * Math.cos(dayPhase);
  p.phaseSpread = p.spreadBase + p.spreadAmplitude * Math.sin(hourPhase);
  // Sine and cosine move in turn, keeping the weave visibly in motion.
  p.phase = p.phaseBase + p.phaseAmplitude * Math.sin(secondPhase);
  p.layerTwist = p.twistBase + p.twistAmplitude * Math.cos(secondPhase);
}

function buildWaveMesh(p, canvasWidth = width, canvasHeight = height) {
  if (!waveMesh || waveMesh.lines.length !== p.lineCount || waveMesh.samples !== p.samples
      || waveMesh.frequencyX !== p.frequencyX || waveMesh.frequencyY !== p.frequencyY) {
    waveMesh = {
      samples: p.samples, frequencyX: p.frequencyX, frequencyY: p.frequencyY,
      lines: Array.from({ length: p.lineCount }, () => new Float64Array(p.samples * 2)),
      sinX: new Float64Array(p.samples), cosX: new Float64Array(p.samples),
      sinY: new Float64Array(p.samples),
    };
    // These samples stay fixed; cache them instead of recalculating each frame.
    for (let j = 0; j < p.samples; j++) {
      const t = TWO_PI * j / p.samples;
      waveMesh.sinX[j] = Math.sin(p.frequencyX * t);
      waveMesh.cosX[j] = Math.cos(p.frequencyX * t);
      waveMesh.sinY[j] = Math.sin(p.frequencyY * t);
    }
  }

  const amplitudeX = p.amplitudeX * p.proportion;
  const amplitudeY = p.amplitudeY / p.proportion;
  const lobeRadius = Math.hypot(amplitudeX, amplitudeY);
  // Outer loop: neighboring curves have gradually different phases and angles.
  for (let i = 0; i < p.lineCount; i++) {
    const u = 2 * i / (p.lineCount - 1) - 1;
    const phase = p.phase + u * p.phaseSpread;
    const angle = p.tilt + u * p.layerTwist;
    const sinPhase = Math.sin(phase), cosPhase = Math.cos(phase);
    const sinAngle = Math.sin(angle), cosAngle = Math.cos(angle);
    const line = waveMesh.lines[i];
    // Inner loop: sample one full 0–2π trip around this curve.
    for (let j = 0; j < p.samples; j++) {
      // x = amplitudeX * sin(frequencyX * t + phase), using cached trig values.
      const x = amplitudeX * (waveMesh.sinX[j] * cosPhase + waveMesh.cosX[j] * sinPhase);
      const y = amplitudeY * waveMesh.sinY[j];
      const rotatedX = x * cosAngle - y * sinAngle;
      const rotatedY = x * sinAngle + y * cosAngle;
      // A smooth positive profile indents the middle of each outer arc.
      // Closed curves and central symmetry are preserved by this deformation.
      const side = rotatedX / lobeRadius;
      const shapedY = rotatedY * (1 - p.lobeIndent + p.lobeIndent * side * side);
      line[2 * j] = rotatedX + p.obliqueShear * shapedY;
      line[2 * j + 1] = shapedY;
    }
  }

  // Bound every possible phase/rotation, so fitting stays still as the lines move.
  const maxX = p.amplitudeX * (1 + Math.abs(p.proportionAmplitude));
  const maxY = p.amplitudeY / (1 - Math.abs(p.proportionAmplitude));
  const radius = Math.hypot(maxX, maxY);
  p.renderScale = Math.min(
    canvasWidth * p.widthCoverage / (2 * radius * (1 + Math.abs(p.obliqueShear))),
    canvasHeight * p.heightCoverage / (2 * radius)
  );
  return waveMesh;
}

function drawWave(p, canvasWidth = width, canvasHeight = height) {
  const mesh = buildWaveMesh(p, canvasWidth, canvasHeight);
  const ctx = drawingContext;
  push();
  translate(canvasWidth / 2, canvasHeight / 2);
  scale(p.renderScale);
  ctx.strokeStyle = artworkPalette.ink;
  ctx.lineWidth = p.strokeWeight / p.renderScale; // Crisp CSS-pixel strokes at any size.
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (const line of mesh.lines) {
    const last = line.length - 2;
    ctx.moveTo((line[last] + line[0]) / 2, (line[last + 1] + line[1]) / 2);
    for (let j = 0; j < line.length; j += 2) {
      const next = (j + 2) % line.length;
      // Midpoint curves close smoothly, with no straight seam at the last point.
      ctx.quadraticCurveTo(line[j], line[j + 1],
        (line[j] + line[next]) / 2, (line[j + 1] + line[next + 1]) / 2);
    }
    ctx.closePath();
  }
  ctx.stroke();
  pop();
}

function setupTimeParameters() {
  ui.timeParameters = {
    hours: document.getElementById("hours-control"),
    minutes: document.getElementById("minutes-control"),
    seconds: document.getElementById("seconds-control"),
  };
}

function updateTimeParameters() {
  const viewer = ui.timeParameters;
  if (!latestRenderedFrame || latestRenderedFrame.mode !== currentMode) return;
  const p = latestRenderedFrame.parameters;
  const values = currentMode === "Wave" ? {
    hours: "Tilt · " + p.tilt.toFixed(3) + " rad",
    minutes: "Phase spread · " + p.phaseSpread.toFixed(3) + " rad",
    seconds: "Phase " + p.phase.toFixed(3) + " / twist " + p.layerTwist.toFixed(3) + " rad",
  } : currentMode === "Cross" ? {
    hours: "Arm opening · " + p.armOpening.toFixed(3) + " rad",
    minutes: "Vortex strength · " + p.vortexStrength.toFixed(3),
    seconds: "Spiral phase · " + p.spiralPhase.toFixed(3) + " rad",
  } : currentMode === "Capsule" ? {
    hours: "Tilt · " + p.tilt.toFixed(3) + " rad",
    minutes: "Expansion · " + p.expansion.toFixed(3),
    seconds: "Phase " + p.phase.toFixed(2) + " rad / shift "
      + (p.localShift * p.renderScale).toFixed(1) + " px",
  } : {
    hours: "Tilt · " + p.tilt.toFixed(3) + " rad",
    minutes: "Fold strength · " + p.foldStrength.toFixed(3),
    seconds: "Phase " + p.layerPhase.toFixed(3) + " rad / shift " + p.layerShift.toFixed(2) + " px",
  };
  Object.entries(values).forEach(([name, text]) => {
    if (viewer[name].textContent !== text) viewer[name].textContent = text;
  });
}

// Four uppercase labels rotate horizontally around an invisible vertical axis.
// Pointer movement changes only its angle; artwork changes after a snap settles.
function createRotarySelector(element, rotor, onCommit) {
  const names = ["Fold", "Capsule", "Cross", "Wave"];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const state = {
    angle: 0, settledAngle: 0, targetAngle: null, modeIndex: 0,
    pointerId: null, startX: 0, startAngle: 0, raf: 0, snapping: false,
  };
  const wrapIndex = (step) => ((step % names.length) + names.length) % names.length;
  rotor.replaceChildren();
  const faces = names.map((name, index) => {
    const face = document.createElement("span");
    face.className = "rotary-face";
    face.style.transform = `rotateY(${index * 90}deg) translateZ(var(--rotary-radius))`;
    face.textContent = name.toUpperCase();
    face.setAttribute("aria-hidden", "true");
    rotor.append(face);
    return face;
  });

  function paint(moving) {
    rotor.style.transform = `translateZ(calc(-1 * var(--rotary-radius))) rotateY(${state.angle}deg)`;
    rotor.style.willChange = moving ? "transform" : "auto";
    faces.forEach((face, index) => {
      const facing = Math.cos((state.angle + index * 90) * Math.PI / 180) > 0.0001;
      face.style.visibility = (moving ? facing : index === state.modeIndex) ? "visible" : "hidden";
    });
  }

  function announceMode() {
    element.setAttribute("aria-valuenow", String(state.modeIndex));
    element.setAttribute("aria-valuetext", names[state.modeIndex].toUpperCase());
  }

  function stopSnap() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    state.snapping = false;
    state.targetAngle = null;
  }

  function settle(angle) {
    stopSnap();
    const index = wrapIndex(Math.round(-angle / 90));
    const changed = index !== state.modeIndex;
    state.modeIndex = index;
    // Equivalent whole-turn rebasing avoids numeric growth after many drags.
    // There is no CSS transition, so this cannot animate a full reverse turn.
    state.angle = -index * 90;
    state.settledAngle = state.angle;
    paint(false);
    announceMode();
    if (changed) onCommit(names[index]);
  }

  function snapTo(target) {
    stopSnap();
    const start = state.angle;
    if (reducedMotion.matches || Math.abs(target - start) < 0.001) {
      settle(target);
      return;
    }
    state.snapping = true;
    state.targetAngle = target;
    const started = performance.now();
    function tick(now) {
      const t = Math.min(1, Math.max(0, (now - started) / rotarySettings.snapDurationMs));
      const eased = 1 - Math.pow(1 - t, 3); // Gentle ease-out, no bouncing.
      state.angle = start + (target - start) * eased;
      paint(true);
      if (t < 1) state.raf = requestAnimationFrame(tick);
      else settle(target);
    }
    paint(true);
    state.raf = requestAnimationFrame(tick);
  }

  function movePointer(event) {
    if (event.pointerId !== state.pointerId) return;
    // Direct displacement mapping allows instant reversal during the same drag.
    // A leftward drag makes the front face turn left and the next enter right.
    state.angle = state.startAngle + (event.clientX - state.startX) * rotarySettings.degreesPerPixel;
    paint(true);
  }

  function releasePointer() {
    const id = state.pointerId;
    state.pointerId = null; // Ignore the expected lostpointercapture event.
    element.classList.remove("is-dragging");
    if (id !== null && element.hasPointerCapture(id)) element.releasePointerCapture(id);
  }

  element.addEventListener("pointerdown", (event) => {
    if (event.isPrimary === false || event.button !== 0 || state.pointerId !== null) return;
    event.preventDefault();
    stopSnap();
    state.pointerId = event.pointerId;
    state.startX = event.clientX;
    state.startAngle = state.angle;
    element.focus({ preventScroll: true });
    element.setPointerCapture(event.pointerId);
    element.classList.add("is-dragging");
  });
  element.addEventListener("pointermove", movePointer);
  element.addEventListener("pointerup", (event) => {
    if (event.pointerId !== state.pointerId) return;
    movePointer(event);
    releasePointer();
    snapTo(Math.round(state.angle / 90) * 90);
  });
  function cancelPointer(event) {
    if (event.pointerId !== state.pointerId) return;
    releasePointer();
    const nearestCommittedTurn = state.settledAngle
      + 360 * Math.round((state.angle - state.settledAngle) / 360);
    snapTo(nearestCommittedTurn);
  }
  element.addEventListener("pointercancel", cancelPointer);
  element.addEventListener("lostpointercapture", cancelPointer);
  element.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const base = state.targetAngle ?? Math.round(state.angle / 90) * 90;
    snapTo(base + (event.key === "ArrowRight" ? -90 : 90));
  });
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches && state.snapping) settle(state.targetAngle);
  });
  const sizeObserver = new ResizeObserver(([entry]) => {
    element.style.setProperty("--rotary-radius", `${entry.contentRect.width * rotarySettings.radiusRatio}px`);
  });
  sizeObserver.observe(element);
  paint(false);
  announceMode();

  return {
    setMode(name) {
      const index = names.indexOf(name);
      if (index < 0) return;
      stopSnap();
      releasePointer();
      state.modeIndex = index;
      state.angle = -index * 90;
      state.settledAngle = state.angle;
      paint(false);
      announceMode();
    },
  };
}
