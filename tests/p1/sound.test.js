/**
 * @layer tests
 * @phase P1
 * @doc §6.2 UI 风格参考：多邻国
 */

import { createSoundPlayer } from '../../src/ui/sound.js';
import { assertEqual, test } from '../harness.js';

test('音效：没有 AudioContext 时全部方法静默降级，不影响流程', () => {
  const player = createSoundPlayer({ AudioContextClass: null });
  assertEqual(player.isMuted(), false);
  player.unlock();
  player.tap();
  player.pickup();
  player.drop();
  player.cancel();
  player.bounce();
  player.correct();
  player.wrong();
  player.complete();
  assertEqual(player.isMuted(), false);
});

test('音效：静音开关可来回切换，静音时播放不抛错', () => {
  const player = createSoundPlayer({ AudioContextClass: null });
  assertEqual(player.toggleMuted(), true);
  assertEqual(player.isMuted(), true);
  player.tap();
  player.correct();
  assertEqual(player.setMuted(false), false);
  assertEqual(player.isMuted(), false);
  player.drop();
});
