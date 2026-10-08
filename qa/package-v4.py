"""Build a portable bundle from application files; never collect local desktop state."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'web/package.json').read_text(encoding='utf-8'))['version']
short_version = version.removesuffix('.0')
output = root / 'dist' / f'DesktopRug-Windows-v{short_version}.zip'
runtime = root / 'web/node_modules/electron/dist'
for required in [root / 'DesktopRug.exe', runtime / 'electron.exe', root / 'web/node_modules/three/build/three.module.js']:
    if not required.is_file():
        raise SystemExit(f'Build dependencies first with setup.ps1; missing {required.relative_to(root)}')

files = [root / name for name in ['DesktopRug.exe', 'README.md', 'AGENTS.md', 'ASSET_NOTICE.md', 'LICENSE', '使用说明.txt', 'setup.ps1', 'build.ps1']]
files += list((root / 'src').glob('*.cs')) + [root / 'src/app.manifest']
asset_names = {'rugs.json', 'wallpapers.json', 'rug.ico', 'persian-rug.png', 'asset-provenance.txt', 'style-prompts-v45.txt', 'style-prompts-ocean-dream.txt'}
for registry in ['rugs.json', 'wallpapers.json']:
    asset_names.update(style['file'] for style in json.loads((root / 'assets' / registry).read_text(encoding='utf-8')) if style.get('file'))
files += [root / 'assets' / name for name in asset_names]
files += [p for p in (root / 'web').iterdir() if p.is_file() and (p.suffix in ['.mjs', '.cjs', '.css', '.html', '.svg'] or p.name in ['package.json', 'package-lock.json', 'enabled.flag'])]
files += list((root / 'scripts').glob('*.mjs'))
files += list((root / 'docs').glob('*.md')) + list((root / 'docs/images').glob('*.png'))
files += [root / 'qa/README.md'] + list((root / 'qa').glob('*.mjs')) + [Path(__file__).resolve()]
files += [p for p in (root / 'qa/reference').iterdir() if p.suffix in ['.json', '.txt']]
files += list(runtime.rglob('*'))
files += [root / 'web/node_modules/electron/LICENSE', root / 'web/node_modules/three/build/three.module.js', root / 'web/node_modules/three/build/three.core.js', root / 'web/node_modules/three/LICENSE']
files = sorted(set(p for p in files if p.is_file()))
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for file in files:
        archive.write(file, 'DesktopRug/' + file.relative_to(root).as_posix())
with zipfile.ZipFile(output) as archive:
    names = archive.namelist()
    private_names = ['state.ini', 'plush-shape.json', 'cloth-shape.bin', 'floor-enabled.txt', 'rug-style.txt', 'status.txt', 'runtime.log', 'before-last-sweep.bin', 'push-active.txt']
    assert not any('/profile/' in name or '/wallpaper-backup/' in name or '/revisions/' in name for name in names)
    assert not any(name == 'DesktopRug/' + private for private in private_names for name in names)
    assert not any(name.startswith('DesktopRug/original-') for name in names)
    assert 'DesktopRug/web/node_modules/electron/dist/electron.exe' in names
    assert archive.testzip() is None
print(json.dumps({'output': str(output), 'files': len(files), 'bytes': output.stat().st_size, 'verified': True}, ensure_ascii=False))
