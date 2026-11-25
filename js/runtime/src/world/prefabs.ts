/**
 * 系统预制件（004 第 6.12、15.11 节）：只有与玩法、风格无关的 entity。
 * 玩家、金币、子弹这类带口味的预制件由套件或游戏自己定义；同名时上层覆盖下层。
 */
import { definePrefab } from './registry'

/** 不带任何积木的空实体 */
export const entity = definePrefab('entity', {})

export const BUILTIN_PREFABS = [entity]
