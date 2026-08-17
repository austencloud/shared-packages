/**
 * Prop Finish State
 *
 * Some props exist in two real builds: the fire one you burn and the day one
 * you practise with. A triad is steel spines and kevlar wicks, or a printed hub
 * and glow heads. Same prop, same reach, same notation — different object.
 *
 * That is a display preference, not a notation change, so it lives here as one
 * reactive setting rather than as a second `PropType`. Prop components read it
 * and pick their build; nothing about the sequence changes.
 */

export type PropFinish = "fire" | "day";

class PropFinishState {
  private _finish = $state<PropFinish>("fire");

  get finish(): PropFinish {
    return this._finish;
  }

  set(finish: PropFinish): void {
    this._finish = finish;
  }

  toggle(): void {
    this._finish = this._finish === "fire" ? "day" : "fire";
  }
}

export const propFinishState = new PropFinishState();
