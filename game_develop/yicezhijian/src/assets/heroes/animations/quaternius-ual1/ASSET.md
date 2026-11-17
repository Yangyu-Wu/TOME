# Quaternius Universal Animation Library — Standard locomotion

- Official source: https://quaternius.com/packs/universalanimationlibrary.html
- Official free download: https://quaternius.itch.io/universal-animation-library
- License: CC0 1.0; original `License.txt` and `README.txt` retained here.
- Author: Quaternius, https://www.patreon.com/quaternius
- Retrieved 2026-11-14 from the Standard package's `Unreal-Godot/UAL1_Standard.glb`.
- Source GLB SHA-256: `69591853d817488edaa8fd9bf8fc1d821eaeaf789f8627b3cd23b41c4ed67997`.
- Package README identifies this GLB as root motion disabled. `_RM` is not used.
- Runtime assets: `Jog_Fwd_Loop.json` and `Sprint_Loop.json`; 195 original translation/quaternion/scale tracks each, extracted without resampling by `tools/extract-locomotion.py`.
- The JSON clips contain animation data only; no additional mesh or textures are loaded. Bone names match the existing UAL2/Base Characters skeleton.
- These are authored animation cycles supplied by Quaternius; their acquisition method is not documented as motion capture. They are not hero-specific combat performances.
