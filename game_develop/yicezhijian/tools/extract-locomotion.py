#!/usr/bin/env python3
"""Extract two Three.js clips from the official CC0 UAL1 Standard ZIP."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zipfile
import uuid

def extract(archive, output):
    with zipfile.ZipFile(archive) as package:
        prefix = 'Universal Animation Library[Standard]/'
        data = package.read(prefix + 'Unreal-Godot/UAL1_Standard.glb')
        if hashlib.sha256(data).hexdigest() != '69591853d817488edaa8fd9bf8fc1d821eaeaf789f8627b3cd23b41c4ed67997':
            raise ValueError('Unverified source version; inspect the archive before updating this hash')
        json_size = struct.unpack_from('<I', data, 12)[0]
        gltf = json.loads(data[20:20+json_size])
        binary = data[28+json_size:]
        def accessor(index):
            spec = gltf['accessors'][index]
            if spec['componentType'] != 5126 or 'sparse' in spec:
                raise ValueError('Expected dense float accessors')
            width = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[spec['type']]
            view = gltf['bufferViews'][spec['bufferView']]
            start = view.get('byteOffset', 0) + spec.get('byteOffset', 0)
            stride = view.get('byteStride', width*4)
            values = []
            for i in range(spec['count']):
                values.extend(struct.unpack_from('<'+'f'*width, binary, start+i*stride))
            return values
        output.mkdir(parents=True, exist_ok=True)
        for animation in gltf['animations']:
            if animation['name'] not in ['Jog_Fwd_Loop', 'Sprint_Loop']:
                continue
            tracks = []
            for channel in animation['channels']:
                sampler = animation['samplers'][channel['sampler']]
                if sampler.get('interpolation', 'LINEAR') != 'LINEAR':
                    raise ValueError('Unexpected interpolation')
                target = channel['target']; path = target['path']
                prop = {'translation': 'position', 'rotation': 'quaternion', 'scale': 'scale'}[path]
                node = gltf['nodes'][target['node']]['name']
                tracks.append({'name': node+'.'+prop, 'type': 'quaternion' if path=='rotation' else 'vector', 'times': accessor(sampler['input']), 'values': accessor(sampler['output'])})
            clip = {'uuid': str(uuid.uuid5(uuid.NAMESPACE_URL, 'quaternius-ual1-standard/'+animation['name'])), 'name': animation['name'], 'duration': max(t['times'][-1] for t in tracks), 'tracks': tracks}
            (output/(animation['name']+'.json')).write_text(json.dumps(clip, separators=(',', ':'))+'\n')
            print(animation['name'], 'tracks:', len(tracks), 'duration:', clip['duration'])
        for name in ['License.txt', 'README.txt']:
            (output/name).write_bytes(package.read(prefix+name))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args(); extract(args.archive, args.output)
