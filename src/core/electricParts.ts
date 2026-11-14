import { registerPart } from './parts';
import { E, W } from './geom';

// Мир «Электрика». Новые детали добавляются здесь, ядро не трогаем.
// Напряжение батарейки 3 В, внутреннее сопротивление 0.5 Ом.
registerPart({ type: 'wire', world: 'electric', autotile: 'electric' });
registerPart({
  type: 'battery', world: 'electric', terminals: [W, E], portKind: 'electric',
  electric: { kind: 'source', r: 0.5, volts: 3 },
});
registerPart({
  type: 'lamp', world: 'electric', terminals: [W, E], portKind: 'electric', symmetric: true,
  electric: { kind: 'load', r: 10, nominal: 3 / 10.5 }, output: 'light', onThreshold: 0.12,
});
registerPart({
  type: 'motor', world: 'electric', terminals: [W, E], portKind: 'electric', symmetric: true,
  electric: { kind: 'load', r: 8, nominal: 3 / 8.5 }, output: 'spin', onThreshold: 0.15,
});
registerPart({
  type: 'buzzer', world: 'electric', terminals: [W, E], portKind: 'electric', symmetric: true,
  electric: { kind: 'load', r: 15, nominal: 3 / 15.5 }, output: 'sound', onThreshold: 0.2,
});
registerPart({
  type: 'switch', world: 'electric', terminals: [W, E], portKind: 'electric', symmetric: true,
  electric: { kind: 'switch', r: 0.02 }, interactive: 'toggle',
});
registerPart({
  type: 'button', world: 'electric', terminals: [W, E], portKind: 'electric', symmetric: true,
  electric: { kind: 'switch', r: 0.02 }, interactive: 'hold',
});
registerPart({
  type: 'led', world: 'electric', terminals: [W, E], portKind: 'electric',
  electric: { kind: 'diode', r: 20, vf: 1.6, nominal: 1.4 / 20.5 }, output: 'led', onThreshold: 0.2,
});
