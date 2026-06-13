p='/app/seed_demo.py'
with open(p,'r',encoding='utf-8') as f:
    s=f.read()
s=s.replace('("done", 100, 0, 6, "mfg")','("done", 100, 0, 6, "mfg1")')
with open(p,'w',encoding='utf-8') as f:
    f.write(s)
print('patched')
