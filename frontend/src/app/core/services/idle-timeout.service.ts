/**
 * HIPAA §164.312(a)(2)(iii) — Automatic Logoff.
 *
 * Monitors user activity (mouse, keyboard, touch). After 13 minutes of
 * inactivity, shows a warning dialog with a 2-minute countdown. If the user
 * does not interact within those 2 minutes, they are logged out automatically.
 */
import { Injectable, inject, OnDestroy, NgZone } from '@angular/core';
import { AuthService } from '../auth/auth.service';

const IDLE_WARN_MS   = 13 * 60 * 1000;  // 13 minutes → show warning
const IDLE_LOGOUT_MS = 15 * 60 * 1000;  // 15 minutes → auto-logout
const TICK_MS        = 1_000;            // countdown tick interval

@Injectable({ providedIn: 'root' })
export class IdleTimeoutService implements OnDestroy {
  private auth    = inject(AuthService);
  private zone    = inject(NgZone);

  /** Seconds remaining in the warning countdown (null = no warning shown) */
  warningSecondsLeft: number | null = null;

  private lastActivity  = Date.now();
  private warnTimer:   ReturnType<typeof setTimeout>  | null = null;
  private logoutTimer: ReturnType<typeof setTimeout>  | null = null;
  private countdownInt: ReturnType<typeof setInterval> | null = null;

  private boundReset = () => this.resetTimer();

  /** Call once (from LayoutComponent) after the user is authenticated. */
  start(): void {
    // Run outside Angular so event listeners don't trigger change detection.
    this.zone.runOutsideAngular(() => {
      const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
      events.forEach(e => window.addEventListener(e, this.boundReset, { passive: true }));
    });
    this.scheduleWarn();
  }

  stop(): void {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.removeEventListener(e, this.boundReset));
    this.clearAllTimers();
    this.zone.run(() => { this.warningSecondsLeft = null; });
  }

  /** Called when the user clicks "Stay logged in" in the warning dialog. */
  extendSession(): void {
    this.resetTimer();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private resetTimer(): void {
    this.lastActivity = Date.now();
    // If warning dialog is visible, close it
    if (this.warningSecondsLeft !== null) {
      this.zone.run(() => { this.warningSecondsLeft = null; });
    }
    this.clearAllTimers();
    this.scheduleWarn();
  }

  private scheduleWarn(): void {
    this.warnTimer = setTimeout(() => this.showWarning(), IDLE_WARN_MS);
  }

  private showWarning(): void {
    this.clearCountdown();
    const totalCountdown = (IDLE_LOGOUT_MS - IDLE_WARN_MS) / 1000; // 120 seconds
    this.zone.run(() => { this.warningSecondsLeft = totalCountdown; });

    // Tick down every second
    this.countdownInt = setInterval(() => {
      this.zone.run(() => {
        if (this.warningSecondsLeft !== null && this.warningSecondsLeft > 0) {
          this.warningSecondsLeft--;
        }
      });
    }, TICK_MS);

    // Schedule logout if no action taken
    this.logoutTimer = setTimeout(() => this.forceLogout(), IDLE_LOGOUT_MS - IDLE_WARN_MS);
  }

  private forceLogout(): void {
    this.stop();
    this.zone.run(() => {
      this.warningSecondsLeft = null;
      this.auth.logout();
    });
  }

  private clearAllTimers(): void {
    if (this.warnTimer)   { clearTimeout(this.warnTimer);   this.warnTimer   = null; }
    if (this.logoutTimer) { clearTimeout(this.logoutTimer); this.logoutTimer = null; }
    this.clearCountdown();
  }

  private clearCountdown(): void {
    if (this.countdownInt) { clearInterval(this.countdownInt); this.countdownInt = null; }
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
