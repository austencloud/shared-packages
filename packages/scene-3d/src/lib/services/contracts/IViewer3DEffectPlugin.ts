import type { Scene } from "three";
import type { AvatarInstanceState } from "../../domain/types/AvatarInstanceState";

export interface IViewer3DEffectPlugin {
  readonly name: string;
  readonly label: string;
  readonly active: boolean;
  activate(scene: Scene, avatarState: AvatarInstanceState): void;
  deactivate(): void;
  update(delta: number): void;
  dispose(): void;
}
