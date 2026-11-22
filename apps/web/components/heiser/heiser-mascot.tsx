"use client";

import { useEffect, useRef } from "react";
import { HEISER_SVG } from "./heiser-svg";

export type HeiserMode = "idle" | "listening" | "thinking" | "speaking" | "happy" | "surprised";

// A stable object keeps React from re-applying the host's innerHTML on every
// re-render, which would detach the rig's SVG nodes mid-animation.
const HEISER_INNER_HTML = { __html: HEISER_SVG };

type Props = {
  mode?: HeiserMode;
  className?: string;
};

const POSE_PRESETS: Record<string, {
  armL: [number, number];
  armR: [number, number];
  eyes: string;
  brow: number;
  tilt: number;
}> = {
  idle: { armL: [-64, -6], armR: [64, 6], eyes: "normal", brow: 0, tilt: 0 },
  friendly: { armL: [-14, -48], armR: [-22, -32], eyes: "normal", brow: -1.5, tilt: 1.5 },
  thinking: { armL: [-40, -48], armR: [118, 82], eyes: "normal", brow: 2.2, tilt: -3.2 },
  happy: { armL: [34, 26], armR: [-34, -26], eyes: "happy", brow: -3, tilt: 0 },
  surprised: { armL: [48, 22], armR: [-48, -22], eyes: "shock", brow: -5.5, tilt: -2.4 },
  speakA: { armL: [-60, -6], armR: [38, 16], eyes: "normal", brow: -1, tilt: -1.2 },
  speakB: { armL: [-38, -16], armR: [60, 6], eyes: "normal", brow: -1, tilt: 1.2 },
};

const TALK_CHOREO = ["speakA", "speakB", "speakA"];
const EXPRESSIONS = ["normal", "happy", "thinking", "surprised"];

class Spring {
  value: number;
  target: number;
  velocity = 0;
  stiffness: number;
  damping: number;

  constructor(initial = 0, stiffness = 170, damping = 18) {
    this.value = initial;
    this.target = initial;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  set(target: number) {
    this.target = target;
  }

  step(dt: number) {
    this.velocity += ((this.target - this.value) * this.stiffness - this.velocity * this.damping) * dt;
    this.value += this.velocity * dt;
    return this.value;
  }
}

export function HeiserMascot({ mode = "idle", className = "" }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<HeiserMode>(mode);
  const apiRef = useRef<((nextMode: HeiserMode) => void) | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const svg = host.querySelector<SVGSVGElement>("#heiser-svg");
    if (!svg) return;

    const q = <T extends Element = Element>(id: string) => host.querySelector<T>(`#${id}`);

    const springs = {
      bodyY: new Spring(0, 140, 16),
      bodyTilt: new Spring(0, 120, 15),
      bodyScaleY: new Spring(1, 150, 18),
      faceX: new Spring(0, 140, 18),
      faceY: new Spring(0, 140, 18),
      pupilX: new Spring(0, 210, 20),
      pupilY: new Spring(0, 210, 20),
      armLShoulder: new Spring(-22, 130, 16),
      armLElbow: new Spring(-18, 145, 17),
      armRShoulder: new Spring(22, 130, 16),
      armRElbow: new Spring(18, 145, 17),
      mouthOpen: new Spring(0, 290, 24),
      mouthWidth: new Spring(1, 260, 22),
      browLift: new Spring(0, 160, 18),
    };

    const rig = {
      torso: q("rig-torso"),
      shadow: q("rig-shadow"),
      face: q("rig-face"),
      eyesNormal: q("rig-eyes-normal"),
      eyesHappy: q("rig-eyes-happy"),
      eyesShock: q("rig-eyes-shock"),
      eyeLeft: q("eye-left-group"),
      eyeRight: q("eye-right-group"),
      eyeShockL: q("eye-shock-left-group"),
      eyeShockR: q("eye-shock-right-group"),
      pupilL: q("pupil-left"),
      pupilR: q("pupil-right"),
      shockPupilL: q("shock-pupil-left"),
      shockPupilR: q("shock-pupil-right"),
      browL: q("brow-left"),
      browR: q("brow-right"),
      armLSh: q("arm-left-shoulder"),
      armRSh: q("arm-right-shoulder"),
      tubeLD: q("arm-left-tube-dark"),
      tubeLW: q("arm-left-tube-white"),
      tubeRD: q("arm-right-tube-dark"),
      tubeRW: q("arm-right-tube-white"),
      armRFront: q("arm-right-front"),
      tubeRFD: q("arm-right-front-tube-dark"),
      tubeRFW: q("arm-right-front-tube-white"),
      mouthClosed: q("mouth-closed-path"),
      mouthOpenGroup: q("mouth-open-group"),
      mouthCavity: q("mouth-cavity"),
      mouthTeeth: q("mouth-teeth"),
      mouthTongue: q("mouth-tongue"),
    };

    if (!rig.torso || !rig.face || !rig.mouthCavity) return;

    const state = {
      expression: "normal",
      pose: "idle",
      talking: false,
      listening: false,
      lookX: 0,
      lookY: 0,
      blinkScale: 1,
      eyeScale: 1,
      nextBlinkAt: performance.now() + 2600,
      talkGestureIdx: 0,
      lastGestureSwitch: 0,
      mouthTimer: null as ReturnType<typeof setInterval> | null,
      talkEndTimer: null as ReturnType<typeof setTimeout> | null,
      startedAt: performance.now(),
    };

    function applyPosePreset(presetKey: string) {
      const preset = POSE_PRESETS[presetKey] ?? POSE_PRESETS.idle;
      springs.armLShoulder.set(preset.armL[0]);
      springs.armLElbow.set(preset.armL[1]);
      springs.armRShoulder.set(preset.armR[0]);
      springs.armRElbow.set(preset.armR[1]);
      springs.browLift.set(preset.brow);
      rig.eyesNormal?.classList.toggle("hidden", preset.eyes !== "normal");
      rig.eyesHappy?.classList.toggle("hidden", preset.eyes !== "happy");
      rig.eyesShock?.classList.toggle("hidden", preset.eyes !== "shock");
      rig.armRFront?.classList.toggle("hidden", presetKey !== "thinking");
    }

    function setVowel(vowel: string, isThinkingMouth = false) {
      if (vowel === "A") {
        springs.mouthOpen.set(1);
        springs.mouthWidth.set(1.18);
      } else if (vowel === "E") {
        springs.mouthOpen.set(0.68);
        springs.mouthWidth.set(1.12);
      } else if (vowel === "I") {
        springs.mouthOpen.set(0.42);
        springs.mouthWidth.set(1.08);
      } else if (vowel === "O") {
        springs.mouthOpen.set(0.76);
        springs.mouthWidth.set(0.68);
      } else if (vowel === "U") {
        springs.mouthOpen.set(0.44);
        springs.mouthWidth.set(0.56);
      } else {
        springs.mouthOpen.set(0);
        springs.mouthWidth.set(isThinkingMouth ? 0.72 : 1);
      }
    }

    function setMouth(shape: string) {
      const map: Record<string, string> = { closed: "closed", small: "I", medium: "E", wide: "A", thinking: "closed" };
      setVowel(map[shape] || "closed", shape === "thinking");
    }

    function updateLeds() {
      svg?.classList.toggle("leds-active", state.talking || state.listening);
      svg?.classList.toggle("leds-thinking", !state.talking && state.pose === "thinking");
    }

    function stopTalking() {
      state.talking = false;
      if (state.mouthTimer) clearInterval(state.mouthTimer);
      if (state.talkEndTimer) clearTimeout(state.talkEndTimer);
      state.mouthTimer = null;
      state.talkEndTimer = null;
    }

    function renderParametricMouth(open: number, width: number) {
      if (open < 0.12) {
        rig.mouthClosed?.classList.remove("hidden");
        rig.mouthOpenGroup?.classList.add("hidden");
        rig.mouthClosed?.setAttribute("d", state.pose === "thinking" ? "M -7 2 Q 0 -2.5 7 1" : "M -11 -1 Q 0 8 11 -1");
        return;
      }
      rig.mouthClosed?.classList.add("hidden");
      rig.mouthOpenGroup?.classList.remove("hidden");
      const halfW = 11.6 * width;
      const topY = -3.2 - open * 2;
      const botY = 3.2 + open * 10.8;
      const d =
        "M " + (-halfW).toFixed(1) + " " + topY.toFixed(1) +
        " Q 0 " + (topY - 1.8).toFixed(1) + " " + halfW.toFixed(1) + " " + topY.toFixed(1) +
        " C " + halfW.toFixed(1) + " " + (botY - 0.8).toFixed(1) + ", " + (halfW * 0.55).toFixed(1) + " " + botY.toFixed(1) + ", 0 " + botY.toFixed(1) +
        " C " + (-halfW * 0.55).toFixed(1) + " " + botY.toFixed(1) + ", " + (-halfW).toFixed(1) + " " + (botY - 0.8).toFixed(1) + ", " + (-halfW).toFixed(1) + " " + topY.toFixed(1) + " Z";
      rig.mouthCavity?.setAttribute("d", d);
      if (open > 0.38 && width > 0.78) {
        const tw = halfW * 0.72;
        const ty = topY + 0.5;
        rig.mouthTeeth?.classList.remove("hidden");
        rig.mouthTeeth?.setAttribute(
          "d",
          "M " + (-tw).toFixed(1) + " " + ty.toFixed(1) +
            " Q 0 " + (ty - 0.8).toFixed(1) + " " + tw.toFixed(1) + " " + ty.toFixed(1) +
            " L " + (tw * 0.9).toFixed(1) + " " + (ty + 2.8).toFixed(1) +
            " Q 0 " + (ty + 2.1).toFixed(1) + " " + (-tw * 0.9).toFixed(1) + " " + (ty + 2.8).toFixed(1) + " Z",
        );
      } else {
        rig.mouthTeeth?.classList.add("hidden");
      }
      const lgW = halfW * 0.62;
      const lgBase = botY - 0.5;
      const lgPeak = botY - Math.min(6.4, open * 6);
      rig.mouthTongue?.setAttribute(
        "d",
        "M " + (-lgW).toFixed(1) + " " + (lgBase - 1.6).toFixed(1) +
          " Q 0 " + lgPeak.toFixed(1) + " " + lgW.toFixed(1) + " " + (lgBase - 1.6).toFixed(1) +
          " Q 0 " + lgBase.toFixed(1) + " " + (-lgW).toFixed(1) + " " + (lgBase - 1.6).toFixed(1) + " Z",
      );
    }

    function bendTube(ex: number, ey: number, wx: number, wy: number) {
      const l1 = Math.hypot(ex, ey);
      const l2 = Math.hypot(wx - ex, wy - ey);
      const ux = ex / l1;
      const uy = ey / l1;
      const vx = (wx - ex) / l2;
      const vy = (wy - ey) / l2;
      const phi = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
      if (phi < 0.05) return "M 0 0 L " + wx.toFixed(2) + " " + wy.toFixed(2);
      const t = Math.min(14 * Math.tan(phi / 2), 0.45 * l1, 0.45 * l2);
      const r = t / Math.tan(phi / 2);
      const c = (4 / 3) * Math.tan(phi / 4) * r;
      const p1x = ex - ux * t;
      const p1y = ey - uy * t;
      const p2x = ex + vx * t;
      const p2y = ey + vy * t;
      return (
        "M 0 0 L " + p1x.toFixed(2) + " " + p1y.toFixed(2) +
        " C " + (p1x + ux * c).toFixed(2) + " " + (p1y + uy * c).toFixed(2) +
        ", " + (p2x - vx * c).toFixed(2) + " " + (p2y - vy * c).toFixed(2) +
        ", " + p2x.toFixed(2) + " " + p2y.toFixed(2) +
        " L " + wx.toFixed(2) + " " + wy.toFixed(2)
      );
    }

    let rigTime = 0;
    let frozen = false;

    function frameValues(dt: number, noWobble = false) {
      const t = rigTime;
      const amp = (v: number) => (noWobble ? 0 : v);
      const talking = state.pose === "talking";
      const happy = state.pose === "happy";
      const steady = noWobble || state.pose === "thinking";
      return {
        by: springs.bodyY.step(dt),
        bt: springs.bodyTilt.step(dt),
        bsy: springs.bodyScaleY.step(dt),
        fx: springs.faceX.step(dt),
        fy: springs.faceY.step(dt),
        px: springs.pupilX.step(dt),
        py: springs.pupilY.step(dt),
        lSh: springs.armLShoulder.step(dt) + amp(Math.sin(t * 2.4) * (talking ? 7 : 2.2)),
        lEl: springs.armLElbow.step(dt) + amp(Math.cos(t * 3.1) * (happy ? 12 : 2.5)),
        rSh: springs.armRShoulder.step(dt) - amp(steady ? 0 : Math.sin(t * 2.4 + 0.6) * (talking ? 7 : 2.2)),
        rEl: springs.armRElbow.step(dt) - amp(steady ? 0 : Math.cos(t * 3.1 + 0.6) * (happy ? 12 : 2.5)),
        mO: springs.mouthOpen.step(dt),
        mW: springs.mouthWidth.step(dt),
        bLift: springs.browLift.step(dt),
        blink: state.blinkScale,
        eyeScale: state.eyeScale,
      };
    }

    type Frame = ReturnType<typeof frameValues>;

    function applyFrame(v: Frame) {
      rig.torso!.setAttribute("transform", `translate(0, ${v.by.toFixed(2)}) rotate(${v.bt.toFixed(2)} 160 258) scale(1, ${v.bsy.toFixed(4)})`);
      const shadowScale = Math.max(0.84, 1 + v.by * 0.008);
      rig.shadow?.setAttribute("transform", `translate(160, 360) scale(${shadowScale.toFixed(3)}, 1) translate(-160, -360)`);
      rig.face!.setAttribute("transform", `translate(${v.fx.toFixed(2)}, ${v.fy.toFixed(2)})`);
      const es = v.eyeScale;
      rig.eyeLeft?.setAttribute("transform", `translate(134, 136) scale(${es.toFixed(3)}, ${(v.blink * es).toFixed(3)})`);
      rig.eyeRight?.setAttribute("transform", `translate(186, 136) scale(${es.toFixed(3)}, ${(v.blink * es).toFixed(3)})`);
      rig.eyeShockL?.setAttribute("transform", `translate(134, 136) scale(${es.toFixed(3)})`);
      rig.eyeShockR?.setAttribute("transform", `translate(186, 136) scale(${es.toFixed(3)})`);
      rig.pupilL?.setAttribute("transform", `translate(${v.px.toFixed(2)}, ${v.py.toFixed(2)})`);
      rig.pupilR?.setAttribute("transform", `translate(${v.px.toFixed(2)}, ${v.py.toFixed(2)})`);
      rig.shockPupilL?.setAttribute("transform", `translate(${(v.px * 0.5).toFixed(2)}, ${(v.py * 0.5).toFixed(2)})`);
      rig.shockPupilR?.setAttribute("transform", `translate(${(v.px * 0.5).toFixed(2)}, ${(v.py * 0.5).toFixed(2)})`);
      rig.browL?.setAttribute("transform", `translate(0, ${v.bLift.toFixed(2)})`);
      rig.browR?.setAttribute("transform", `translate(0, ${v.bLift.toFixed(2)})`);
      rig.armLSh?.setAttribute("transform", `translate(66, 182) rotate(${v.lSh.toFixed(2)})`);
      rig.armRSh?.setAttribute("transform", `translate(254, 182) rotate(${v.rSh.toFixed(2)})`);
      rig.armRFront?.setAttribute("transform", `translate(254, 182) rotate(${v.rSh.toFixed(2)})`);
      const d2r = Math.PI / 180;
      const la = v.lEl * d2r;
      const ra = v.rEl * d2r;
      const lwx0 = -25 - 26 * Math.cos(la) - 2 * Math.sin(la);
      const lwy0 = 4 - 26 * Math.sin(la) + 2 * Math.cos(la);
      const rwx0 = 25 + 26 * Math.cos(ra) - 2 * Math.sin(ra);
      const rwy0 = 4 + 26 * Math.sin(ra) + 2 * Math.cos(ra);
      const lTube = bendTube(-25, 4, lwx0, lwy0);
      const rTube = bendTube(25, 4, rwx0, rwy0);
      rig.tubeLD?.setAttribute("d", lTube);
      rig.tubeLW?.setAttribute("d", lTube);
      rig.tubeRD?.setAttribute("d", rTube);
      rig.tubeRW?.setAttribute("d", rTube);
      rig.tubeRFD?.setAttribute("d", rTube);
      rig.tubeRFW?.setAttribute("d", rTube);
      renderParametricMouth(v.mO, v.mW);
    }

    function snapAll() {
      Object.values(springs).forEach((spring) => {
        spring.value = spring.target;
        spring.velocity = 0;
      });
      applyFrame(frameValues(0, true));
    }

    function setExpression(name: string) {
      if (!EXPRESSIONS.includes(name)) name = "normal";
      stopTalking();
      state.expression = name;
      state.eyeScale = 1;
      if (name === "normal") {
        state.pose = "idle";
        applyPosePreset("idle");
        setVowel("closed");
      } else if (name === "happy") {
        state.pose = "happy";
        applyPosePreset("happy");
        setVowel("A");
      } else if (name === "thinking") {
        state.pose = "thinking";
        applyPosePreset("thinking");
        setVowel("closed");
      } else {
        state.pose = "surprised";
        applyPosePreset("surprised");
        springs.mouthOpen.set(1.02);
        springs.mouthWidth.set(0.46);
      }
      const thinkX = name === "thinking" ? -0.5 : 0;
      const thinkY = name === "thinking" ? -0.55 : 0;
      springs.faceX.set(thinkX * 4.5);
      springs.faceY.set(thinkY * 3.2);
      springs.pupilX.set(thinkX * 3.4);
      springs.pupilY.set(thinkY * 2.8);
      updateLeds();
    }

    function talk(duration = 3800) {
      stopTalking();
      state.talking = true;
      state.pose = "talking";
      state.talkGestureIdx = 0;
      state.lastGestureSwitch = performance.now();
      applyPosePreset(TALK_CHOREO[0]);
      rig.eyesNormal?.classList.remove("hidden");
      rig.eyesHappy?.classList.add("hidden");
      state.mouthTimer = setInterval(() => {
        const shapes = ["closed", "small", "medium", "wide"];
        setMouth(shapes[(Math.random() * shapes.length) | 0]);
      }, 70);
      state.talkEndTimer = setTimeout(() => setExpression(state.expression), duration);
      updateLeds();
    }

    function setMode(nextMode: HeiserMode) {
      if (nextMode === "speaking") {
        if (!state.talking) {
          state.listening = false;
          talk(1_000_000);
        }
        return;
      }
      stopTalking();
      state.listening = nextMode === "listening";
      if (nextMode === "thinking") {
        setExpression("thinking");
      } else if (nextMode === "happy") {
        setExpression("happy");
      } else if (nextMode === "surprised") {
        setExpression("surprised");
      } else if (nextMode === "listening") {
        setExpression("normal");
        state.pose = "friendly";
        applyPosePreset("friendly");
        springs.bodyTilt.set(-2.2);
        updateLeds();
      } else {
        setExpression("normal");
      }
    }

    let lastFrame = performance.now();
    let frameId = 0;
    let paused = false;
    let onScreen = true;

    function loop(now: number) {
      if (paused) return;
      const dt = Math.min(0.035, Math.max(0.001, (now - lastFrame) / 1000));
      lastFrame = now;
      rigTime += dt;
      const t = rigTime;

      if (now >= state.nextBlinkAt) {
        state.nextBlinkAt = now + 2700 + Math.random() * 2400;
        state.blinkScale = 0.08;
        setTimeout(() => {
          state.blinkScale = 1;
          if (frozen) applyFrame(frameValues(0));
        }, 125);
      }
      if (state.talking && now - state.lastGestureSwitch > 1450) {
        state.lastGestureSwitch = now;
        state.talkGestureIdx = (state.talkGestureIdx + 1) % TALK_CHOREO.length;
        applyPosePreset(TALK_CHOREO[state.talkGestureIdx]);
      }

      let targetY = Math.sin(t * 2.1) * 3.2;
      const targetScaleY = 1 + Math.sin(t * 2.1) * 0.008;
      const preset = POSE_PRESETS[state.pose];
      let baseTilt = preset ? preset.tilt : 0;
      let sway = Math.sin(t * 1.3) * 0.8;
      if (state.pose === "talking") {
        targetY = Math.sin(t * 8.5) * 3.8 - 1.5;
        sway = Math.sin(t * 3.6) * 1.9;
      } else if (state.pose === "happy") {
        targetY = -Math.abs(Math.sin(t * 5.8)) * 9.5;
        sway = Math.sin(t * 5.8) * 2.2;
      } else if (state.pose === "thinking") {
        targetY = Math.sin(t * 1.6) * 1.1;
        sway = 0;
      }
      springs.bodyY.set(targetY);
      springs.bodyScaleY.set(targetScaleY);
      springs.bodyTilt.set(baseTilt + sway + state.lookX * 2.2);

      const thinkX = state.pose === "thinking" ? -0.5 : state.lookX;
      const thinkY = state.pose === "thinking" ? -0.55 : state.lookY;
      springs.faceX.set(thinkX * 4.5);
      springs.faceY.set(thinkY * 3.2);
      springs.pupilX.set(thinkX * 3.4);
      springs.pupilY.set(thinkY * 2.8);

      applyFrame(frameValues(dt));
      frameId = requestAnimationFrame(loop);
    }

    function onPointerMove(event: PointerEvent) {
      const rect = host!.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      state.lookX = Math.max(-1, Math.min(1, nx));
      state.lookY = Math.max(-1, Math.min(1, ny));
    }

    function onPointerLeave() {
      state.lookX = 0;
      state.lookY = 0;
    }

    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function syncRunning() {
      const shouldRun = !reduceMotion && onScreen && !document.hidden;
      if (shouldRun && paused) {
        paused = false;
        lastFrame = performance.now();
        frameId = requestAnimationFrame((now) => {
          lastFrame = now;
          loop(now);
        });
      } else if (!shouldRun && !paused) {
        paused = true;
        cancelAnimationFrame(frameId);
      }
    }

    const visibilityHandler = () => syncRunning();
    document.addEventListener("visibilitychange", visibilityHandler);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              onScreen = entries[0]?.isIntersecting ?? true;
              syncRunning();
            },
            { threshold: 0.01 },
          );
    observer?.observe(host);

    frozen = reduceMotion;
    apiRef.current = setMode;
    setExpression("normal");
    setMode(modeRef.current);
    snapAll();

    paused = true;
    syncRunning();

    return () => {
      cancelAnimationFrame(frameId);
      apiRef.current = null;
      stopTalking();
      document.removeEventListener("visibilitychange", visibilityHandler);
      observer?.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
    };
    // HEISER_SVG is constant in production; in dev, a hot-reload replaces the
    // innerHTML without remounting, so the rig must re-initialize with it.
  }, [HEISER_SVG]);

  useEffect(() => {
    apiRef.current?.(mode);
  }, [mode]);

  return (
    <div
      ref={hostRef}
      className={`heiser-embed ${className}`}
      aria-label="Heiser, maskot Whoosh AI"
      dangerouslySetInnerHTML={HEISER_INNER_HTML}
    />
  );
}
