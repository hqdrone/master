import { registerPart } from './parts';
import { E, N, S, W } from './geom';

// Мир «Вода». Все водяные выводы — по центру сторон клетки.
registerPart({ type: 'pipe', world: 'water', autotile: 'water', fluid: { kind: 'pipe' } });
// насос: выход на восток (при rot = 0), включается щелчком
registerPart({ type: 'pump', world: 'water', terminals: [E], portKind: 'water', interactive: 'toggle', fluid: { kind: 'pump' } });
registerPart({ type: 'valve', world: 'water', terminals: [W, E], portKind: 'water', symmetric: true, interactive: 'toggle', fluid: { kind: 'valve' } });
// бак: вход слева, выход справа
registerPart({ type: 'tank', world: 'water', terminals: [W, E], portKind: 'water', fluid: { kind: 'tank' } });
registerPart({ type: 'drain', world: 'water', terminals: [W], portKind: 'water', fluid: { kind: 'drain' } });
// фонтан: вода приходит снизу
registerPart({ type: 'fountain', world: 'water', terminals: [S], portKind: 'water', fluid: { kind: 'fountain' } });
// водяное колесо: вода насквозь слева направо, сверху/снизу — шестерёнка
registerPart({
  type: 'waterwheel', world: 'water', terminals: [W, E], portKind: 'water', symmetric: true,
  fluid: { kind: 'wheel' }, mech: { role: 'gear', teeth: 8, sides: [N, S], source: 'water' },
});
