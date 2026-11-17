# 独立绘制素材

当前素材包括 Canvas 程序绘图、Quaternius CC0 蒙皮人物与骨骼动画、独立程序化装备和 GPU 特效。每类素材独立维护，网页渲染器负责组合；人物仍共享通用底模，尚未完成 59 名武将的独立高品质模型。

| 目录 / 文件 | 素材 |
| --- | --- |
| heroes/model.js | 英雄战场造型与武器 |
| heroes/models/quaternius-base-male/ | CC0 蒙皮底模与贴图，来源见目录内 ASSET.md |
| heroes/animations/quaternius-ual1/、quaternius-ual2/ | CC0 移动与战斗动作 |
| heroes/animations/polearm/ | 横扫、下劈、突刺动作曲线与质量边界 |
| heroes/retarget-clips.js、two-bone-ik.js | 底模动画重定向、双关节握持约束 |
| heroes/equipment/signature/ | 偃月刀、方天画戟、长枪独立模型 |
| heroes/equipment/tailored-underlayer.js | 从 CC0 底模派生的蒙皮内衬 |
| heroes/humanoid-rig.glb、RIG-ASSET.md | 骨骼/动画技术验证样本，非发布资产，许可待核 |
| heroes/portrait.js | 英雄头像，384×384 |
| heroes/palette.js、motion.js | 配色与骨架动作 |
| soldiers/model.js | 小兵造型 |
| effects/dragon.js | 青龙 |
| effects/phoenix.js | 火凤 |
| effects/constellation.js | 七星 |
| effects/tornado.js | 龙卷 |
| effects/boss-entrance.js | Boss 全屏登场演出 |
| effects/melee-impact.js | 按战斗命中事件驱动的 GPU 金属火星 |
| effects/particle.js、wave.js、field.js | 粒子、冲击波、持续场 |
| effects/flight-path.js | 飞行曲线、切线朝向、拖尾与龙凤离屏路径（战斗命中共用） |
| battlefield/terrain.js | 场地、光照、组合顺序 |
| battlefield/water.js、mark.js | 水面与地面印记 |
| battlefield/props/ | 岩石、木箱、拒马、树、火炬各一个文件 |
| render-quality.js | 画布精度与物件显示比例 |
| materials/stone_tiles_02_diff_2k.jpg、stone_tiles_02_nor_gl_2k.jpg | Poly Haven Stone Tiles 02，2K PBR 贴图，CC0 |

战斗逻辑坐标固定 960×600，默认输出 1920×1200（四倍像素），泛光独立输出 960×600。小兵与物件显示比例 0.64，投影、火炬光源和小兵血条同步缩放。地图边界与战斗规则不变，留白更多。画面没有视频码率；后续如接入录像，应在录像编码器中另设帧率和码率。
