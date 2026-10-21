import re,glob,sys
d={};grants={}
for f in sorted(glob.glob(sys.argv[1]+'/*.sql')):
    s=open(f).read()
    for m in re.finditer(r'create (?:or replace )?function (public\.\w+)\s*\((.*?)\$\$(.*?)\$\$', s, re.S|re.I):
        d[m.group(1)]=(f.split('/')[-1], m.group(2), m.group(3))
    for m in re.finditer(r'(grant|revoke)\s+(?:all|execute)\s+on\s+function\s+(public\.\w+)\s*\([^)]*\)\s+(?:to|from)\s+([\w, ]+);', s, re.I):
        grants.setdefault(m.group(2),[]).append((m.group(1).lower(), m.group(3)))
for k,(f,head,body) in sorted(d.items()):
    h=head.lower()
    if 'security definer' not in h or 'returns trigger' in h: continue
    if not re.search(r'\b(insert into|update public|delete from)\b', body, re.I): continue
    if re.search(r'exiger_|est_editeur|est_super_admin|est_membre|est_dirigeant|a_permission|peut_|auth\.uid\(\)', body): continue
    g=grants.get(k,[])
    last={}
    for act,who in g:
        for w in [x.strip() for x in who.split(',')]:
            last[w]=act
    ouvert=[w for w,a in last.items() if a=='grant' and w in('anon','authenticated','public')]
    print(k, f, 'OUVERT:'+','.join(ouvert) if ouvert else 'non exposé')
