import json
from importlib.metadata import distribution

items=[]
for name in ('sympy','mpmath'):
    package=distribution(name)
    files=[p for p in package.files if p.name.upper() in ('LICENSE','LICENSE.TXT','LICENSE.MD','LICENCE','COPYING','NOTICE') and '.dist-info' in str(p)]
    text='\n\n'.join(package.locate_file(p).read_text(encoding='utf-8', errors='replace') for p in files)
    if not text or 'Redistribution and use in source and binary forms' not in text:
        raise RuntimeError(f'Unverified license text for {name}')
    items.append({'name':name,'version':package.version,'license':'BSD-3-Clause','text':text,'runtime':'python'})
print(json.dumps(items))
