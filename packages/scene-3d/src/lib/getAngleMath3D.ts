import type { IAngleMathCalculator } from './services/contracts/IAngleMathCalculator';
import { AngleMathCalculator } from './services/implementations/AngleMathCalculator';

let instance: IAngleMathCalculator | null = null;

export function getAngleMath3D(): IAngleMathCalculator {
  return instance ??= new AngleMathCalculator();
}
