# 骨骼角色技术样本

humanoid-rig.glb 取自 Three.js 官方示例 examples/models/gltf/Soldier.glb，作为蒙皮骨架与动画剪辑的浏览器导入验证素材，不是最终三国角色模型。Three.js 仓库主许可证为 MIT；该示例模型的独立作者/再分发许可尚需核验，因此仅保留在本地开发样例阶段，不随游戏发布，不作为商业资产。发布前须换成明确可再分发的 CC0/CC-BY 模型并保留署名。

GPU 英雄层当前使用 Quaternius Universal Base Characters 的 `Superhero_Male_FullBody.gltf` 作为蒙皮网格，并使用 Quaternius Universal Animation Library 2 Standard 的 `ual2-standard.glb` 提供 43 个动画剪辑。两个资产均为 CC0 1.0，来源、许可与运行时限制记录在各自目录的 `ASSET.md`。

持续跑步已补充 Quaternius UAL1 Standard 的 CC0 `Jog_Fwd_Loop` 和 `Sprint_Loop` 原始动画循环，作为独立 JSON 动画资产加载；不再以加速 carry-walk 模拟持续奔跑。原始 43 个战斗剪辑与两个移动剪辑共同组成运行时动画库。来源、许可证和提取方法见 `animations/quaternius-ual1/ASSET.md`。

动画源与男性底模虽然骨骼同名，绑定旋转和肢体长度不同。运行时通过 `retarget-clips.js` 转换源骨骼世界旋转差，保留目标底模的骨长与比例，仅根骨/骨盆保留按比例缩放的位移动作。不可直接将源文件的骨骼平移与缩放套到人物底模。

关羽、吕布、赵云已有独立的横扫/下劈/突刺控制曲线与双手 IK，待机、行走及攻击保持副手接触；受击、冲刺和死亡释放约束。动作数据与限制见 `animations/polearm/ASSET.md`。贴身内衬由 CC0 底模的躯干、手臂与腿部表面派生，复用原蒙皮权重与骨架，保留头脸和手部皮肤。

质量边界：此基础模型仍是通用男性底模，现有三国辨识主要由独立盔甲、发型/胡须、披风、武器和材质调色构成；并非 59 个独立高模。移动循环虽来自原始动画资产，但未证实为动作捕捉，也不是武将专属表演。仍需补齐不同体型/性别/阵营的专属模型，以及高品质全身武术表演与受击动作。
