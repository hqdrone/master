import { registerPart } from './parts';
import { E, N, S, W } from './geom';

// Мир «Механика». Зубья: малая шестерня — 8, большая — 16.
registerPart({ type: 'gear_s', world: 'mechanic', anyRot: true, mech: { role: 'gear', teeth: 8 } });
registerPart({ type: 'gear_b', world: 'mechanic', anyRot: true, mech: { role: 'gear', teeth: 16 } });
registerPart({ type: 'axle', world: 'mechanic', autotile: 'mechanical', mech: { role: 'axle' } });
registerPart({ type: 'belt', world: 'mechanic', autotile: 'belt', mech: { role: 'belt' } });
registerPart({ type: 'conveyor', world: 'mechanic', autotile: 'belt', sides: [E, W], mech: { role: 'belt', output: true } });
registerPart({ type: 'crank', world: 'mechanic', anyRot: true, interactive: 'toggle', mech: { role: 'gear', teeth: 8, source: 'crank' } });
registerPart({ type: 'fan', world: 'mechanic', anyRot: true, mech: { role: 'gear', teeth: 8, output: true } });
registerPart({ type: 'wheel', world: 'mechanic', anyRot: true, mech: { role: 'gear', teeth: 8, output: true } });
// толкатель: кривошип + шток, шток торчит на восток (при rot = 0)
registerPart({ type: 'pusher', world: 'mechanic', mech: { role: 'gear', teeth: 8, sides: [N, S, W], output: true } });
