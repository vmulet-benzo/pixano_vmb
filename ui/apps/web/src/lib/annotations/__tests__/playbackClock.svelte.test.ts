/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import { describe, expect, it } from "vitest";

import { PlaybackClock } from "../playbackClock.svelte.js";

describe("PlaybackClock", () => {
  it("starts paused at zero", () => {
    const clock = new PlaybackClock();
    expect(clock.playing).toBe(false);
    expect(clock.currentTimeMs).toBe(0);
    expect(clock.durationMs).toBeNull();
  });

  it("seek clamps to [0, duration]", () => {
    const clock = new PlaybackClock();
    clock.durationMs = 1000;
    clock.seek(-50);
    expect(clock.currentTimeMs).toBe(0);
    clock.seek(500);
    expect(clock.currentTimeMs).toBe(500);
    clock.seek(2000);
    expect(clock.currentTimeMs).toBe(1000);
  });

  it("advanceBy only moves while playing", () => {
    const clock = new PlaybackClock();
    clock.advanceBy(100);
    expect(clock.currentTimeMs).toBe(0);
    clock.play();
    clock.advanceBy(100);
    expect(clock.currentTimeMs).toBe(100);
  });

  it("pauses at the end of the medium", () => {
    const clock = new PlaybackClock();
    clock.durationMs = 150;
    clock.play();
    clock.advanceBy(100);
    expect(clock.playing).toBe(true);
    clock.advanceBy(100);
    expect(clock.currentTimeMs).toBe(150);
    expect(clock.playing).toBe(false);
  });

  it("seek works while paused (scrubbing)", () => {
    const clock = new PlaybackClock();
    clock.durationMs = 1000;
    clock.seek(420);
    expect(clock.currentTimeMs).toBe(420);
    expect(clock.playing).toBe(false);
  });
});
