/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

/**
 * Record-scoped playback time for temporal annotation kinds (video, audio).
 *
 * One clock lives on `WorkspaceSession` per loaded record, mirroring the
 * shared `AnnotationCollection`: a video widget, an audio widget and a
 * timeline panel must agree on "now", so the playhead is shared truth, not
 * per-widget state.
 *
 * The clock owns its own advancing loop (requestAnimationFrame while
 * playing), so multiple widgets can *read* time without any of them — or
 * several of them — driving it. Widgets call their renderers'
 * `tick(currentTimeMs)` per frame; `sync()` stays reserved for collection
 * changes (see docs/ARCHITECTURE.md, decision D6).
 *
 * In non-browser environments (tests) there is no rAF: `play()` still flips
 * the flag and tests drive time explicitly via `advanceBy()` / `seek()`.
 */
export class PlaybackClock {
  currentTimeMs = $state(0);
  playing = $state(false);
  /** Null until the medium's duration is known (e.g. video metadata loaded). */
  durationMs = $state<number | null>(null);

  private rafId: number | null = null;

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this._startLoop();
  }

  pause(): void {
    this.playing = false;
    if (this.rafId !== null && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
  }

  seek(timeMs: number): void {
    const max = this.durationMs ?? Number.POSITIVE_INFINITY;
    this.currentTimeMs = Math.min(Math.max(timeMs, 0), max);
  }

  /** Advance while playing; pauses at the end of the medium. */
  advanceBy(deltaMs: number): void {
    if (!this.playing) return;
    this.seek(this.currentTimeMs + deltaMs);
    if (this.durationMs !== null && this.currentTimeMs >= this.durationMs) {
      this.pause();
    }
  }

  private _startLoop(): void {
    if (typeof requestAnimationFrame === "undefined") return;
    let last = performance.now();
    const step = (now: number) => {
      if (!this.playing) return;
      this.advanceBy(now - last);
      last = now;
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }
}
