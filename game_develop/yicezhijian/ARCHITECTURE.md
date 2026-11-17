# 《一策之间》客户端架构

## GPU 材质与动作质量

战场外层材质由 gpu-material-renderer.js 使用本地 Three.js WebGL2 绘制：全屏四边形采样 Poly Haven 2K 石板颜色/法线贴图，以 GLSL 计算动态 UV、法线漫反射和微细颗粒，再以透明 soft-light 层叠在 Canvas 场景下方。该层只影响地面背景，不覆盖角色、HUD 或战斗判定；没有 WebGL2 时自动降级为透明层。

动作数据集中在 heroes/motion.js：步态为反相双腿摆动，增加呼吸、攻击弧线、受击回弹、披风周期和微转身；模型层使用同一姿态数据驱动武器、护甲和披风，避免部件各自跳动。

## 设计目标

游戏规则必须能够在浏览器、Windows、iOS 和 Android 中复用。核心代码不能直接访问 DOM、Canvas、浏览器事件或 `localStorage`。

## 目录职责

```text
src/
├── content/                 # 英雄、羁绊、关卡等静态配置
├── core/                    # 平台无关规则与模拟
│   ├── game-app.js          # 应用门面，对外暴露命令
│   ├── game-state.js        # 状态结构、阵位规则
│   ├── shop-system.js       # 商店刷新和购买
│   ├── battle-simulation.js # 确定性自动战斗
│   ├── skill-director.js    # 全屏演出队列、技能飞行与命中调度
│   ├── battle-vfx.js        # 有上限的粒子、冲击、龙卷与单位物理
│   ├── battlefield.js       # 可破坏物体和持久地面印记
│   └── random.js            # 可注入种子的随机数
├── platform/                # 存档、时钟、支付等端口与适配器
└── web/                     # DOM、Canvas 和浏览器组合根
```

## 英雄域 `src/heroes/`

- `catalog.js`：59 名武将的纯数据名册、费用、属性、技能定义与程序化视觉 DNA。
- `hero-system.js`：棋子实例、唯一实例 ID、星级倍率、三合一递归升星和存档恢复。
- `skill-system.js`：与渲染无关的技能执行器，包括伤害、治疗、护盾、控制、持续伤害和召唤。
- `ultimates.js`：13 位武将的专属主题、技能名、色彩、范围、冲击和多段落星参数。
- `visual-factory.js`：兼容导出入口；头像、模型、配色、动作实现分别存放在 `src/assets/heroes/`，原生客户端可替换此适配层。
- `index.js`：英雄域唯一公共入口。

英雄模板与棋子实例分离：`heroId` 指向武将模板，`instanceId` 标识玩家实际拥有的棋子，支持同名多棋子、合成、存档和未来联网同步。

## 依赖方向

```text
Web / Windows / iOS / Android
              ↓
        Platform adapters
              ↓
           GameApp
              ↓
 Core systems ← Content configuration
```

`core` 永远不能反向依赖 `web` 或具体平台。渲染层只读取状态快照并发送命令，不直接修改战斗内部数据。

## 推荐移植方案

- Web：当前原生 ES Modules + Canvas/DOM。
- Windows：优先 Tauri 或 Electron，直接复用 JavaScript 核心；正式版本也可用 Unity/C# 重写适配器。
- iOS/Android：优先 Capacitor 封装 Web 渲染，快速验证；若采用 Unity、Godot 或原生渲染，则保持 `GameApp` 命令和状态协议一致。
- 联机/回放：使用带种子的 `Random` 和固定时间步，记录玩家在部署阶段发送的命令，而不是录制每帧画面。

## 下一阶段

1. 将敌人、关卡和路线移动至 `content/`。
2. 为核心层增加无浏览器单元测试。
3. 为状态定义版本号和迁移器。
4. 在现有事件驱动的音效/特效基础上完善录像与跨平台表现适配。
5. 选择正式跨平台壳：Capacitor/Tauri 或 Unity/Godot。

## 战斗表现管线

素材索引见 `src/assets/README.md`。英雄头像、战场模型、小兵、各专属特效、水面、印记及五类场景物体分别维护；Web 渲染器负责组合。默认以 1920×1200 绘制，再映射至 960×600 逻辑空间，渲染结束恢复上下文变换。测试可显式选择 1 倍输出，压力测试保持同一基线。

战斗画面跟随浏览器显示帧刷新；模拟事件仍实时驱动音效和 UI。同一显示帧内执行多次模拟步进时，不重复栅格化无法显示的高清中间帧。开始战斗、结算、编队等命令仍立即刷新画面。

青龙与火凤飞行持续 1.12 秒，从施法者朝目标方向直线延伸至画面外 420 逻辑单位，身体与拖尾跟随，火凤有独立振翅周期。核心调度器和渲染器共用 `flight-path.js` 路径；核心对每步扫过的线段判定沿途敌人，记录命中 ID，保证同次飞行对每个敌人只结算一次。七星及其他投射仍使用目标弧线与终点命中。

普通敌兵从四个屏外坐标按自身速度走入，`entering` 阶段不攻击，物理边界钳制暂不生效，避免屏外位置被拉回场内。精英入场显示脉冲红圈和来袭提示。`bossEntrance` 控制 2.8 秒全屏演出，期间暂停战斗时间与所有战斗推进；素材独立存放在 `assets/effects/boss-entrance.js`。战场模型显式传入阵营配色，英雄头像与专属施法演出保留个人配色。

`BattleSimulation` 调用平台无关的 `skill-director`，依次推进排队、全屏演出、飞行和命中。伤害、护阵、地面印记和物体破坏在实际命中时应用。诸葛亮的七颗星分别飞行并结算；目标提前死亡时会可见地重新寻敌。后续全屏演出等待所有飞行结束，并留出 0.55 秒展示冲击余波。

渲染器按地面/水面/印记、投影、按纵坐标排序的物体与角色、环境光、技能粒子/泛光、HUD、全屏演出的顺序绘制。`environment-renderer.js` 负责晨昏与水面，`vfx-renderer.js` 负责青龙、火凤、七星、龙卷、冲击与全屏构图；渲染不修改游戏状态。

`battle-audio.js` 订阅 `ultimate-cinematic` 与 `ultimate-impact` 事件，用 Web Audio 合成蓄力和空爆/音爆声音，首次用户操作后解锁，可随时静音。

表现预算上限：720 个粒子、36 个冲击波、12 个持续场、24 个瞬态光源、72 处地面印记。碎片采用重力和衰减弹跳，单位采用衰减冲量与腾空高度；回营时清空临时表现状态，保留原有存档键和武将阵容。

验收入口为 `tests/run-browser-checks.py`，其中 `visual-effects.test.html` 检查所有专属大招与可见变化，`runtime-flow.test.html` 从真实页面点击编队、出战、结算与再出战，并检查存档和音效。
