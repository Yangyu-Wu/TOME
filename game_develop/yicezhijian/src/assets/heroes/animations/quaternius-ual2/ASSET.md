# Quaternius Universal Animation Library 2 — Standard

- Source: https://quaternius.com/packs/universalanimationlibrary2.html
- Download page: https://quaternius.itch.io/universal-animation-library-2
- License: CC0 1.0 Universal. The original `License.txt` is retained next to the extracted asset.
- Attribution requested by source: Models by Quaternius; https://www.patreon.com/quaternius
- Included runtime file: `ual2-standard.glb` (8,091,444 bytes), extracted from the Standard package's `Unreal-Godot/UAL2_Standard.glb`.
- Package `README.txt` says this variant has root motion disabled; `_RM` is the root-motion variant.
- Verification: GLB 2.0, one skinned mesh, one skin, 43 animation clips. Used as a development/retargeting source; not a finished Three Kingdoms hero model.
- The other package files are intentionally not copied into the repository.

## Runtime quality note

This UAL2 package contains no authored run-loop clip (`actionInventory()` on the
package alone reports `run: null`). The GPU battle layer supplements its combat
clips with the CC0 UAL1 `Jog_Fwd_Loop` and `Sprint_Loop` animation-only assets in
the adjacent `quaternius-ual1` directory. Sustained running uses those authored
cycles. Movement during an attack samples the lower-body quaternion tracks
from the locomotion clips while retaining the attack clip's upper body.
